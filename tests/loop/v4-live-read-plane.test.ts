/**
 * V4 · LIVE LÄSYTA — transport, läsroutar och deras negativa kontroller.
 *
 * Provar exit-kriterierna i docs/nortropic-control-room-plan-v1.md §V4, i den mån de kan
 * mätas i repot (S5/S13 finns inte vid NORTROPIC_PLAN_COMMIT — se filens sista avsnitt):
 *   (1) Läsytan tar VERKLIGA snapshots och event ur kontrollplanets Supabase-form: exakta
 *       kontraktskolumner, `seq`-ordning, snapshotens kropp + typade kolumner.
 *   (2) NOLL SKRIVNINGAR: ingen kodväg under lib/loop/** eller app/api/loop/** anropar
 *       insert/update/upsert/delete/rpc, transporten exponerar bara en SELECT-port och
 *       Supabase-klienten lämnar aldrig modulen. (DB-rollens grants mäts i deployen.)
 *   (4) Ingen /api/loop-route finns i middleware-matcherns undantag, OCH varje handler
 *       anropar auth() själv före varje läsning → 401 utan session.
 *   (5) Gap-detektion körs ENDAST på den ofiltrerade butiksströmmen; en run-filtrerad vy
 *       larmar aldrig om legitima seq-hopp (B3).
 * samt de negativa kontrollerna: appen skriver i eventtabellen · service_role-nyckel ·
 * UI som slår upp origin/main själv · authoritative state rekonstruerat genom event-fold ·
 * falsklarm om lucka i en run-filtrerad vy.
 *
 * PROVSTIL (samma som V1–V3): varje kriterium bär en LÖGNSTUB — den vanligaste genvägen —
 * och provet mäter att stuben FÄLLS av exakt samma data. Ett prov som bara mäter den
 * riktiga implementationen bevisar inte att datan kan skilja rätt från fel.
 *
 * Ingen del av provet öppnar en socket: transporten läses genom sin injicerade port.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RAW_FIXTURES } from "../../lib/loop/fixtures";
import {
  EVENT_ENVELOPE_COLUMNS,
  validateEvents,
  type LoopSnapshot,
} from "../../lib/loop/schema";
import { projectEvents } from "../../lib/loop/events";
import * as transport from "../../lib/loop/transport";
import {
  EVENTS_DEFAULT_LIMIT,
  EVENTS_MAX_LIMIT,
  READABLE_TABLES,
  REQUIRED_GRANTS,
  SNAPSHOT_ROW_COLUMNS,
  TRANSPORT_OPEN_DECISIONS,
  TRANSPORT_RULES,
  classifyTransportKey,
  composeSnapshotFromRow,
  httpStatusForReason,
  loadEvents,
  loadSnapshot,
  loadTask,
  parseEventsQuery,
  parseIdParam,
  scopeFor,
  supabaseReader,
  transportConfig,
  type SelectQuery,
  type TransportReader,
  type TransportRow,
} from "../../lib/loop/transport";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");

/* ────────────────────────────────────────────────────────────────────────────
 * PROVDATA — allt härleds ur V1:s GENERERADE fixturer
 * ──────────────────────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Fixturens snapshot delad i transportens KOLUMNER + kropp, precis som tabellskissen. */
function snapshotRow(options: { columns?: Row; body?: Row } = {}): Row {
  const fixture = deepCopy(RAW_FIXTURES.snapshot) as Row;
  const { schema_version, run_id, seq_watermark, published_ts, ...body } = fixture;
  return {
    run_id,
    schema_version,
    seq_watermark,
    published_ts,
    snapshot: { ...body, ...(options.body ?? {}) },
    ...(options.columns ?? {}),
  };
}

function eventRows(): Row[] {
  return deepCopy(RAW_FIXTURES.events) as Row[];
}

function eventOfType(eventType: string): Row {
  const found = eventRows().find((row) => row.event_type === eventType);
  assert.ok(found, `fixturen saknar ett event av typen ${eventType}`);
  return found;
}

/**
 * En läsare som emulerar PostgREST: den filtrerar, ordnar och begränsar SJÄLV. Så mäter
 * provet att transporten verkligen skickar filter/ordning/limit till butiken i stället för
 * att hämta allt och sila i appen.
 */
function fakeReader(rows: { events?: Row[]; snapshots?: Row[] } = {}): {
  reader: TransportReader;
  queries: SelectQuery[];
} {
  const queries: SelectQuery[] = [];
  const reader: TransportReader = async (query) => {
    queries.push(query);
    // Porten kan bara uttrycka SELECT — men provet mäter formen ändå, så att en framtida
    // utvidgning av SelectQuery inte tyst kan smyga in ett skrivverb.
    assert.ok(
      (Object.values(READABLE_TABLES) as string[]).includes(query.table),
      "transporten frågade en tabell utanför läsytan",
    );
    assert.ok(query.columns.length > 0, "transporten bad om noll kolumner");
    assert.ok(!query.columns.includes("*"), "transporten använde select(*)");
    assert.ok(query.limit > 0 && query.limit <= EVENTS_MAX_LIMIT, "orimlig limit");

    if (query.table === READABLE_TABLES.snapshots) {
      let selected = (rows.snapshots ?? []).slice();
      for (const filter of query.filters) {
        selected = selected.filter((row) => row[filter.column] === filter.value);
      }
      selected.sort((a, b) => Number(b.seq_watermark) - Number(a.seq_watermark));
      return { ok: true, data: selected.slice(0, query.limit) as TransportRow[] };
    }

    let selected = (rows.events ?? []).slice();
    for (const filter of query.filters) {
      selected = selected.filter((row) => row[filter.column] === filter.value);
    }
    if (query.after_seq !== null) {
      selected = selected.filter((row) => Number(row.seq) > (query.after_seq as number));
    }
    selected.sort((a, b) => Number(a.seq) - Number(b.seq));
    return { ok: true, data: selected.slice(0, query.limit) as TransportRow[] };
  };
  return { reader, queries };
}

function failingReader(fail: transport.LoopReadFail): TransportReader {
  return async () => fail;
}

/* ────────────────────────────────────────────────────────────────────────────
 * KÄLLKODSSKANNING — de statiskt mätbara kriterierna
 * ──────────────────────────────────────────────────────────────────────────── */

function filesUnder(relative: string, suffixes: string[]): string[] {
  const root = path.join(REPO, relative);
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (suffixes.some((suffix) => entry.endsWith(suffix))) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

const LOOP_LIB_FILES = filesUnder("lib/loop", [".ts"]);
const LOOP_API_FILES = filesUnder("app/api/loop", [".ts"]);
const LOOP_SERVER_FILES = [...LOOP_LIB_FILES, ...LOOP_API_FILES];

function source(file: string): string {
  return readFileSync(file, "utf8");
}

/** Filerna som faktiskt KAN nå kontrollplanet: transporten och routarna ovanpå den. */
const CONTROL_PLANE_FILES = [path.join(REPO, "lib/loop/transport.ts"), ...LOOP_API_FILES];

/**
 * Skrivverb i PostgREST-kedjan (`from(...).insert(...)`) plus `rpc(` — de enda vägar
 * @supabase/supabase-js har till en skrivning i en tabell. Detektorn är avsiktligt KEDJEBUNDEN
 * i stället för att fälla varje `.update(` i repot: `createHash().update()` i
 * fixturgeneratorn är inte en databasskrivning, och ett prov som inte kan skilja dem åt
 * hade fått fixas genom att undanta filer — vilket är precis hur en verklig skrivning
 * senare hade kunnat glida igenom.
 */
const TRANSPORT_WRITE_CHAIN = /\.from\s*\([^)]*\)[\s\S]{0,400}?\.(insert|update|upsert|delete)\s*\(/;
const RPC_CALL = /\.rpc\s*\(/;

/**
 * En PostgREST-tabellhandtag: `client.from(...)`. `Array.from` / `Object.fromEntries` är
 * inte transportvägar och undantas i MÖNSTRET — inte genom att undanta filer, så att en
 * verklig `client.from()` i en ny fil fortfarande fälls.
 */
const TABLE_HANDLE = /(?<!\b(?:Array|Object|Buffer|Set|Map))\.from\s*\(/;

/** Rå ordagrann skanning. Används där ingen hash-kod finns: transporten och routarna. */
const WRITE_CALL_PATTERNS = [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("];

function writeCallsIn(text: string): string[] {
  return WRITE_CALL_PATTERNS.filter((pattern) => text.includes(pattern));
}

/** Alla modulspecificerare en fil importerar (import … from "x" och require("x")). */
function importsOf(text: string): string[] {
  const specifiers: string[] = [];
  const pattern = /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) specifiers.push(match[1]);
  return specifiers;
}

/* ────────────────────────────────────────────────────────────────────────────
 * EXIT 2 · NOLL SKRIVNINGAR MOT loop_events / loop_snapshots
 * ──────────────────────────────────────────────────────────────────────────── */

test("V4 exit 2 · ingen kodväg under lib/loop/** eller app/api/loop/** anropar ett skrivverb", () => {
  assert.ok(LOOP_LIB_FILES.length > 0 && LOOP_API_FILES.length > 0, "hittade inga källfiler att mäta");

  // 1 · Hela loop-serverytan: ingen PostgREST-kedja som slutar i en skrivning, ingen rpc.
  for (const file of LOOP_SERVER_FILES) {
    const text = source(file);
    const relative = path.relative(REPO, file);
    assert.ok(!TRANSPORT_WRITE_CHAIN.test(text), `${relative} skriver i en transporttabell`);
    assert.ok(!RPC_CALL.test(text), `${relative} anropar rpc()`);
  }

  // 2 · Filerna som faktiskt kan nå klienten mäts dessutom ordagrant — där finns ingen
  //     hash-kod att förväxla med, så den strängaste skanningen kan användas rakt av.
  for (const file of CONTROL_PLANE_FILES) {
    assert.deepEqual(
      writeCallsIn(source(file)),
      [],
      `${path.relative(REPO, file)} innehåller ett skrivverb`,
    );
  }

  // 3 · Bara transporten importerar Supabase-klienten, och bara den rör .from(). En framtida
  //     fil kan alltså inte skaffa sig en egen väg till kontrollplanet utan att fällas här.
  const supabaseImporters = LOOP_SERVER_FILES.filter((file) =>
    importsOf(source(file)).some((specifier) => specifier.startsWith("@supabase/")),
  ).map((file) => path.relative(REPO, file));
  assert.deepEqual(supabaseImporters, ["lib/loop/transport.ts"]);

  const tableTouchers = LOOP_SERVER_FILES.filter((file) => TABLE_HANDLE.test(source(file))).map(
    (file) => path.relative(REPO, file),
  );
  assert.deepEqual(tableTouchers, ["lib/loop/transport.ts"]);

  // LÖGNSTUB: båda detektorerna måste fälla exakt de genvägar de finns för att fånga —
  // och den kedjebundna får INTE fälla en hashning, annars hade provet fixats med undantag.
  const lie = 'const q = client.from("loop_events").insert({ seq: 1 });';
  assert.ok(TRANSPORT_WRITE_CHAIN.test(lie), "kedjedetektorn fäller inte en insert");
  assert.deepEqual(writeCallsIn(lie), [".insert("], "ordagranna detektorn fäller inte en insert");
  assert.ok(
    !TRANSPORT_WRITE_CHAIN.test('createHash("sha256").update(label).digest("hex")'),
    "kedjedetektorn fäller en hashning — då hade provet krävt undantag i stället för precision",
  );
});

test("V4 exit 2 · transporten kräver bara SELECT och exponerar aldrig Supabase-klienten", () => {
  assert.equal(TRANSPORT_RULES.APP_WRITES_TO_EVENT_STORE, false);
  assert.equal(TRANSPORT_RULES.APP_WRITES_TO_SNAPSHOT_STORE, false);
  assert.deepEqual(Object.values(REQUIRED_GRANTS), ["SELECT", "SELECT"]);
  assert.deepEqual(Object.keys(REQUIRED_GRANTS).sort(), ["loop_events", "loop_snapshots"]);

  // Inget exporterat värde bär en PostgREST-yta: en anropare kan alltså inte nå .insert()
  // via ett returvärde från modulen.
  for (const [name, value] of Object.entries(transport)) {
    if (value === null || typeof value !== "object") continue;
    for (const method of ["from", "insert", "update", "upsert", "delete", "rpc"]) {
      assert.equal(
        typeof (value as Record<string, unknown>)[method],
        "undefined",
        `exporten ${name} exponerar en transportmetod (${method})`,
      );
    }
  }

  // createClient får finnas exakt en gång, och bara i en icke-exporterad hjälpare.
  const transportSource = source(path.join(REPO, "lib/loop/transport.ts"));
  const creations = transportSource.split("createClient(").length - 1;
  assert.equal(creations, 1, "createClient anropas på fler än ett ställe");
  assert.ok(
    !/export\s+(async\s+)?function\s+\w*[Cc]lient/.test(transportSource),
    "transporten exporterar en klientfabrik",
  );
});

test("V4 negativ kontroll · ingen GitHub-, Git- eller origin/main-väg i Maskinens serveryta", () => {
  /**
   * Mätningen går på IMPORTER och KODANVÄNDNING, aldrig på prosa: filerna beskriver med
   * flit i klartext att de aldrig slår upp origin/main, och ett prov som fällde ordet hade
   * bara lärt oss att sluta skriva ut regeln.
   */
  const forbiddenModules = /github-(read|write)|@octokit|child_process|simple-git|node:child_process/;
  for (const file of LOOP_SERVER_FILES) {
    const relative = path.relative(REPO, file);
    for (const specifier of importsOf(source(file))) {
      assert.ok(
        !forbiddenModules.test(specifier),
        `${relative} importerar ${specifier} — MASKINEN_GITHUB_CREDENTIAL=NONE`,
      );
    }
  }

  // Ingen credential utanför kontrollplanets transport, och ingen ref-uppslagning.
  for (const file of LOOP_SERVER_FILES) {
    const text = source(file);
    const relative = path.relative(REPO, file);
    const envReads = [...text.matchAll(/process\.env\.(\w+)/g)].map((match) => match[1]);
    for (const name of envReads) {
      assert.ok(
        ["LOOP_SUPABASE_URL", "LOOP_SUPABASE_KEY", "LOOP_ENABLED"].includes(name),
        `${relative} läser ${name} — Maskinen bär bara LOOP_*-variabler`,
      );
    }
    for (const needle of ["refs/heads", "git/refs", "getRef(", "GITHUB_TOKEN"]) {
      assert.ok(!text.includes(needle), `${relative} rör en Git-ref-väg (${needle})`);
    }
  }

  assert.equal(TRANSPORT_RULES.RESOLVES_ORIGIN_MAIN, false);
});

/* ────────────────────────────────────────────────────────────────────────────
 * EXIT 4 · MIDDLEWARE-UNDANTAG OCH DJUPFÖRSVAR
 * ──────────────────────────────────────────────────────────────────────────── */

/** Planens EXAKTA undantagslista (AUTH_SECURITY). Den får inte växa med en loop-route. */
const ALLOWED_MATCHER_EXEMPTIONS = [
  "api/auth",
  "api/leads/worker",
  "_next/static",
  "_next/image",
  "favicon.ico",
  "nortropic-logo.png",
];

function matcherExemptions(middlewareSource: string): string[] {
  const match = middlewareSource.match(/matcher:\s*\[\s*"([^"]+)"/);
  assert.ok(match, "kunde inte läsa middleware-matchern");
  const inner = match[1].match(/\(\?!([^)]+)\)/);
  assert.ok(inner, "matchern saknar en negativ lookahead med undantag");
  return inner[1].split("|");
}

test("V4 exit 4 · ingen /api/loop-route finns i middleware-matcherns undantag", () => {
  const middlewareSource = source(path.join(REPO, "middleware.ts"));
  const exemptions = matcherExemptions(middlewareSource);

  assert.deepEqual(
    exemptions,
    ALLOWED_MATCHER_EXEMPTIONS,
    "matcherns undantagslista har ändrats — planen kräver att den står EXAKT still",
  );
  for (const exemption of exemptions) {
    assert.ok(!exemption.includes("loop"), `matchern undantar ${exemption}`);
  }
  assert.equal(TRANSPORT_RULES.MIDDLEWARE_EXEMPTION_FOR_API_LOOP, false);

  // LÖGNSTUB: en matcher som undantar api/loop måste fällas av samma läsare.
  const lie = 'matcher: ["/((?!api/auth|api/loop|_next/static).*)"],';
  assert.ok(
    matcherExemptions(lie).includes("api/loop"),
    "läsaren hittar inte ett loop-undantag — då mäter provet ovan ingenting",
  );
});

test("V4 exit 4 · varje /api/loop-handler anropar auth() SJÄLV, före varje läsning", () => {
  assert.ok(LOOP_API_FILES.length >= 3, "förväntade minst snapshot-, events- och task-routen");

  for (const file of LOOP_API_FILES) {
    const relative = path.relative(REPO, file);
    const text = source(file);

    assert.ok(/from\s+"@\/auth"/.test(text), `${relative} importerar inte auth`);
    const authIndex = text.indexOf("await auth()");
    assert.ok(authIndex > 0, `${relative} anropar inte await auth()`);
    assert.ok(text.includes("status: 401"), `${relative} saknar 401-vägen`);

    // Grinden får inte hänga på middleware: auth() måste ligga FÖRE varje transportanrop.
    for (const call of ["loadSnapshot(", "loadEvents(", "loadTask("]) {
      const callIndex = text.indexOf(call);
      if (callIndex < 0) continue;
      assert.ok(callIndex > authIndex, `${relative} läser transporten före auth()`);
    }

    // LOOP_ENABLED gatar hela trädet; direktlänk utan flagga ger 404, aldrig en halv yta.
    assert.ok(text.includes("isLoopEnabled()"), `${relative} saknar LOOP_ENABLED-grinden`);
    assert.ok(text.includes("status: 404"), `${relative} saknar 404-vägen`);

    // Läsyta = läsyta. Ingen handler får ta emot en skrivmetod (kommandon är V7).
    for (const verb of ["POST", "PUT", "PATCH", "DELETE"]) {
      assert.ok(
        !new RegExp(`export\\s+(async\\s+)?function\\s+${verb}\\b`).test(text),
        `${relative} exporterar ${verb} — V4 är en LÄSYTA`,
      );
    }
    assert.ok(/export\s+async\s+function\s+GET\b/.test(text), `${relative} saknar GET`);
    assert.ok(text.includes("no-store") || text.includes("LOOP_READ_HEADERS"), `${relative} cachar`);
  }
});

test("A2 · 401-kroppen är gemensam och avslöjar ingenting om kontrollplanet", () => {
  assert.equal(transport.UNAUTHORIZED_ENVELOPE.ok, false);
  assert.equal(transport.LOOP_DISABLED_ENVELOPE.ok, false);
  for (const envelope of [transport.UNAUTHORIZED_ENVELOPE, transport.LOOP_DISABLED_ENVELOPE]) {
    assert.ok(!/supabase|loop_events|loop_snapshots|run_id/i.test(envelope.message));
  }
  assert.equal(httpStatusForReason("invalid-request"), 400);
  assert.equal(httpStatusForReason("not-configured"), 200);
  assert.equal(httpStatusForReason("transport-error"), 200);
  assert.equal(httpStatusForReason("refused-service-role"), 200);
});

/* ────────────────────────────────────────────────────────────────────────────
 * KONFIGURATION · service_role-nyckeln avvisas fail-closed
 * ──────────────────────────────────────────────────────────────────────────── */

function jwtWithRole(role: string): string {
  const segment = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${segment({ alg: "HS256", typ: "JWT" })}.${segment({ role, iss: "supabase" })}.sig`;
}

test("transport ej konfigurerad · planens feltext, inga nollor, ingen krasch", async () => {
  const missingUrl = transportConfig({});
  assert.equal(missingUrl.configured, false);
  assert.ok(
    missingUrl.configured === false &&
      missingUrl.message.includes("LOOP_SUPABASE_URL saknas") &&
      missingUrl.reason === "not-configured",
  );

  const missingKey = transportConfig({ LOOP_SUPABASE_URL: "https://control.example" });
  assert.ok(missingKey.configured === false && missingKey.message.includes("LOOP_SUPABASE_KEY saknas"));

  // Läsaren når aldrig nätet när konfigurationen saknas — den svarar envelope.
  const result = await supabaseReader({})({
    table: READABLE_TABLES.events,
    columns: EVENT_ENVELOPE_COLUMNS,
    filters: [],
    after_seq: null,
    order: [{ column: "seq", ascending: true }],
    limit: 1,
  });
  assert.equal(result.ok, false);
  assert.ok(result.ok === false && result.reason === "not-configured");

  // Och läsytan ovanpå den svarar med orsak — aldrig med en tom vy full av nollor.
  const snapshot = await loadSnapshot({}, supabaseReader({}));
  assert.equal(snapshot.ok, false);
  assert.ok(snapshot.ok === false && snapshot.message.includes("LOOP_SUPABASE_URL"));
});

test("V4 negativ kontroll · en service_role-nyckel avvisas innan någon klient skapas", () => {
  const serviceRole = classifyTransportKey(jwtWithRole("service_role"));
  assert.equal(serviceRole.role, "service_role");
  assert.equal(serviceRole.bypasses_rls, true);

  const anon = classifyTransportKey(jwtWithRole("loop_reader"));
  assert.equal(anon.bypasses_rls, false);

  assert.equal(classifyTransportKey("sb_secret_abc123").bypasses_rls, true);
  assert.equal(classifyTransportKey("sb_publishable_abc123").bypasses_rls, false);

  const refused = transportConfig({
    LOOP_SUPABASE_URL: "https://control.example",
    LOOP_SUPABASE_KEY: jwtWithRole("service_role"),
  });
  assert.equal(refused.configured, false);
  assert.ok(refused.configured === false && refused.reason === "refused-service-role");
  // Nyckeln får ALDRIG läcka ut i ett felmeddelande.
  assert.ok(refused.configured === false && !refused.message.includes("eyJ"));
  assert.equal(TRANSPORT_RULES.SERVICE_ROLE_KEY_ACCEPTED, false);

  const accepted = transportConfig({
    LOOP_SUPABASE_URL: "https://control.example",
    LOOP_SUPABASE_KEY: jwtWithRole("loop_reader"),
  });
  assert.equal(accepted.configured, true);

  // Predikatet som vyerna gatar på följer samma dom — en avvisad nyckel är INTE konfigurerad.
  assert.equal(transport.isTransportConfigured({}), false);
  assert.equal(
    transport.isTransportConfigured({
      LOOP_SUPABASE_URL: "https://control.example",
      LOOP_SUPABASE_KEY: jwtWithRole("service_role"),
    }),
    false,
  );
  assert.equal(
    transport.isTransportConfigured({
      LOOP_SUPABASE_URL: "https://control.example",
      LOOP_SUPABASE_KEY: jwtWithRole("loop_reader"),
    }),
    true,
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * KOLUMNPROJEKTION OCH ORDNING
 * ──────────────────────────────────────────────────────────────────────────── */

test("läsytan projicerar EXAKT kontraktskolumnerna och ordnar på seq — aldrig ts", async () => {
  const { reader, queries } = fakeReader({ events: eventRows(), snapshots: [snapshotRow()] });

  await loadEvents({ after_seq: null, limit: 50, run_id: null, task_id: null }, reader);
  const eventQuery = queries.find((query) => query.table === READABLE_TABLES.events);
  assert.ok(eventQuery);
  assert.deepEqual([...eventQuery.columns], [...EVENT_ENVELOPE_COLUMNS]);
  assert.deepEqual([...eventQuery.order], [{ column: "seq", ascending: true }]);

  await loadSnapshot({}, reader);
  const snapshotQuery = queries.find((query) => query.table === READABLE_TABLES.snapshots);
  assert.ok(snapshotQuery);
  assert.deepEqual([...snapshotQuery.columns], [...SNAPSHOT_ROW_COLUMNS]);
  assert.equal(snapshotQuery.order[0].column, "seq_watermark");
  assert.equal(snapshotQuery.order[0].ascending, false);

  // Ingen ordning i hela läsytan får någonsin ske på ts.
  for (const query of queries) {
    for (const order of query.order) assert.notEqual(order.column, "ts");
  }
  assert.ok(!source(path.join(REPO, "lib/loop/transport.ts")).includes('column: "ts"'));

  // LÖGNSTUB: select("*") hade tagit med transportkolumnen ingested_at, och V1:s strikta
  // kuvert hade då fällt VARJE rad. Det är precis vad kolumnprojektionen finns för.
  const withTransportColumn = eventRows().map((row) => ({ ...row, ingested_at: "2026-01-01T00:00:00Z" }));
  const { invalid } = validateEvents(withTransportColumn);
  assert.equal(invalid.length, withTransportColumn.length);
});

/* ────────────────────────────────────────────────────────────────────────────
 * EXIT 5 · GAP-DETEKTION ENDAST PÅ DEN OFILTRERADE BUTIKSSTRÖMMEN (B3)
 * ──────────────────────────────────────────────────────────────────────────── */

test("V4 exit 5 · butiksströmmen gap-detekterar, den run-filtrerade vyn gör det ALDRIG", async () => {
  const rows = eventRows();
  const withHole = rows.filter((row) => row.seq !== 5);
  const { reader } = fakeReader({ events: withHole });

  const store = await loadEvents(
    { after_seq: null, limit: EVENTS_MAX_LIMIT, run_id: null, task_id: null },
    reader,
  );
  assert.ok(store.ok);
  assert.equal(store.data.scope, "store");
  assert.equal(store.data.gap_detection, "store_stream");
  assert.deepEqual(store.data.stream.gaps, [{ from: 5, to: 5, missing: 1 }]);

  const filtered = await loadEvents(
    { after_seq: null, limit: EVENTS_MAX_LIMIT, run_id: "run-fixture-a", task_id: null },
    reader,
  );
  assert.ok(filtered.ok);
  assert.equal(filtered.data.scope, "filtered");
  assert.equal(filtered.data.gap_detection, "disabled_filtered_view");
  assert.deepEqual(filtered.data.stream.gaps, [], "en run-filtrerad vy larmade om en lucka");

  // LÖGNSTUB: EXAKT samma rader, projicerade som om vyn vore butiksströmmen, larmar om
  // luckor — de legitima hoppen mellan två interfolierade runs (B3, E11). Provet ovan mäter
  // alltså en verklig skillnad, inte en tom lista.
  const filteredRows = filtered.data.stream.rows.map((row) => row.event);
  assert.ok(filteredRows.length > 1);
  const lie = projectEvents(filteredRows, { scope: "store" });
  assert.ok(
    lie.stream.gaps.length > 0,
    "provdatan kan inte skilja rätt från fel — den filtrerade vyn har inga legitima hopp",
  );

  assert.equal(TRANSPORT_RULES.GAP_DETECTION_SCOPE, "UNFILTERED_STORE_STREAM_ONLY");
  assert.equal(scopeFor({ run_id: null, task_id: null }), "store");
  assert.equal(scopeFor({ run_id: null, task_id: "p-100" }), "filtered");
  assert.equal(scopeFor({ run_id: "run-fixture-a", task_id: null }), "filtered");
});

test("V4 exit 5 · baslinjen after_seq ger gap FÖRE fönstret — men bara i butiksströmmen", async () => {
  const rows = eventRows().filter((row) => Number(row.seq) >= 6);
  const { reader } = fakeReader({ events: rows });

  const store = await loadEvents(
    { after_seq: 3, limit: EVENTS_MAX_LIMIT, run_id: null, task_id: null },
    reader,
  );
  assert.ok(store.ok);
  assert.deepEqual(store.data.stream.gaps, [{ from: 4, to: 5, missing: 2 }]);
  assert.equal(store.data.window.after_seq, 3);

  const filtered = await loadEvents(
    { after_seq: 3, limit: EVENTS_MAX_LIMIT, run_id: "run-fixture-b", task_id: null },
    reader,
  );
  assert.ok(filtered.ok);
  assert.deepEqual(filtered.data.stream.gaps, []);
});

test("fönstret rapporteras ärligt: returnerat antal och 'kan finnas fler'", async () => {
  const { reader } = fakeReader({ events: eventRows() });

  const full = await loadEvents({ after_seq: null, limit: 5, run_id: null, task_id: null }, reader);
  assert.ok(full.ok);
  assert.equal(full.data.window.returned, 5);
  assert.equal(full.data.window.may_have_more, true);

  const rest = await loadEvents(
    { after_seq: 20, limit: 50, run_id: null, task_id: null },
    reader,
  );
  assert.ok(rest.ok);
  assert.equal(rest.data.window.returned, 3);
  assert.equal(rest.data.window.may_have_more, false);
  assert.equal(rest.data.fixture, false);
  assert.equal(rest.data.source, "control_plane_supabase");
});

test("okänd event_type och ogiltig rad kastar aldrig — de rapporteras", async () => {
  const rows = [
    ...eventRows(),
    { ...eventOfType("run.started"), event_id: "evt-unknown", seq: 90, event_type: "kosmisk.stråle" },
    { ...eventOfType("run.started"), event_id: "evt-broken", seq: undefined },
  ];
  const { reader } = fakeReader({ events: rows as Row[] });

  const result = await loadEvents(
    { after_seq: null, limit: EVENTS_MAX_LIMIT, run_id: null, task_id: null },
    reader,
  );
  assert.ok(result.ok);
  assert.equal(result.data.stream.counts.unknown_type, 1);
  assert.equal(result.data.ingest.invalid.length, 1);
  // Den ogiltiga raden TYSTAS inte: den rapporteras med index.
  assert.ok(result.data.ingest.invalid[0].message.length > 0);
});

test("bigint som sträng normaliseras — men aldrig med tyst precisionsförlust", async () => {
  const rows = eventRows().map((row) => ({ ...row, seq: String(row.seq) }));
  const { reader } = fakeReader({ events: rows });
  const result = await loadEvents(
    { after_seq: null, limit: EVENTS_MAX_LIMIT, run_id: null, task_id: null },
    reader,
  );
  assert.ok(result.ok);
  assert.equal(result.data.stream.rows.length, rows.length);
  assert.equal(result.data.stream.first_seq, 1);

  // Ett värde utanför säkert heltalsintervall skrivs ALDRIG om: raden fälls synligt i stället.
  const unsafe = [{ ...eventOfType("run.started"), seq: "9007199254740993" }];
  const unsafeResult = await loadEvents(
    { after_seq: null, limit: 10, run_id: null, task_id: null },
    fakeReader({ events: unsafe as Row[] }).reader,
  );
  assert.ok(unsafeResult.ok);
  assert.equal(unsafeResult.data.stream.rows.length, 0);
  assert.equal(unsafeResult.data.ingest.invalid.length, 1);
});

/* ────────────────────────────────────────────────────────────────────────────
 * SNAPSHOT — DISPLAYED_TRUTH, sammansatt ur rad + kropp
 * ──────────────────────────────────────────────────────────────────────────── */

test("snapshotraden sätts ihop till exakt fixturens kontraktsobjekt", async () => {
  const { reader, queries } = fakeReader({ snapshots: [snapshotRow()] });
  const result = await loadSnapshot({}, reader);

  assert.ok(result.ok);
  assert.equal(result.data.status, "present");
  assert.equal(result.data.reason, null);
  assert.equal(result.data.selection, "highest_seq_watermark");
  assert.deepEqual(result.data.snapshot, RAW_FIXTURES.snapshot as unknown as LoopSnapshot);
  assert.equal(result.data.row_head?.run_id, "run-fixture-a");
  assert.equal(queries[0].filters.length, 0, "utan run_id ska ingen filtrering ske");

  const explicit = await loadSnapshot({ run_id: "run-fixture-a" }, reader);
  assert.ok(explicit.ok);
  assert.equal(explicit.data.selection, "explicit_run_id");
  assert.deepEqual(queries[1].filters, [{ column: "run_id", value: "run-fixture-a" }]);
});

test("kropp och kolumn som säger olika → snapshoten AVVISAS med orsak, aldrig tyst vald", () => {
  const row = snapshotRow({ body: { run_id: "run-som-kroppen-hittat-på" } });
  const composed = composeSnapshotFromRow(row);

  assert.equal(composed.ok, false);
  assert.ok(composed.ok === false && composed.reason.includes("run_id"));

  // LÖGNSTUB: den lata vägen — låta kroppen vinna — hade gett en GILTIG snapshot med fel
  // run_id. Provet mäter alltså att skillnaden syns i datan.
  const lie = { ...(row.snapshot as Row), schema_version: row.schema_version, seq_watermark: row.seq_watermark, published_ts: row.published_ts };
  assert.equal((lie as Row).run_id, "run-som-kroppen-hittat-på");
});

test("avvisad eller saknad snapshot ger orsak och null — aldrig nollor eller uppfunna fält", async () => {
  const absent = await loadSnapshot({}, fakeReader({ snapshots: [] }).reader);
  assert.ok(absent.ok);
  assert.equal(absent.data.status, "absent");
  assert.equal(absent.data.snapshot, null);
  assert.equal(absent.data.row_head, null);
  assert.equal(absent.data.reason, null);

  const rejected = await loadSnapshot(
    {},
    fakeReader({ snapshots: [snapshotRow({ body: { hittepa_falt: 1 } })] }).reader,
  );
  assert.ok(rejected.ok);
  assert.equal(rejected.data.status, "rejected");
  assert.equal(rejected.data.snapshot, null);
  assert.ok(rejected.data.reason && rejected.data.reason.length > 0);
  // Radens typade kolumner finns kvar, så UI:t kan visa "senast bekräftade läge" + orsak.
  assert.equal(rejected.data.row_head?.seq_watermark, 23);

  const noBody = await loadSnapshot(
    {},
    fakeReader({ snapshots: [{ ...snapshotRow(), snapshot: null }] }).reader,
  );
  assert.ok(noBody.ok);
  assert.equal(noBody.data.status, "rejected");
  assert.equal(noBody.data.snapshot, null);
});

test("transportfel bubblar som envelope med orsak — ingen krasch, ingen tom vy utan skäl", async () => {
  const reader = failingReader({
    ok: false,
    reason: "transport-error",
    message: "connection refused",
  });
  const snapshot = await loadSnapshot({}, reader);
  const events = await loadEvents({ after_seq: null, limit: 10, run_id: null, task_id: null }, reader);
  const task = await loadTask({ task_id: "p-205" }, reader);

  for (const result of [snapshot, events, task]) {
    assert.equal(result.ok, false);
    assert.ok(result.ok === false && result.reason === "transport-error");
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * SNAPSHOT_WINS · ingen state rekonstrueras genom event-fold
 * ──────────────────────────────────────────────────────────────────────────── */

/** Tail som för ett mänskligt öga avslutar uppgiften — allt ovanför snapshotens watermark. */
function tailThatLooksFinished(taskId: string, watermark: number): Row[] {
  return ["attestation.created", "promotion.completed", "main.advanced"].map((eventType, index) => ({
    ...eventOfType(eventType),
    event_id: `evt-v4-tail-${index}`,
    seq: watermark + 1 + index,
    task_id: taskId,
    run_id: "run-fixture-a",
  }));
}

test("V4 negativ kontroll · en tail som ser klar ut flyttar ALDRIG state till DONE", async () => {
  const snapshot = RAW_FIXTURES.snapshot as unknown as LoopSnapshot;
  const taskId = snapshot.current_task?.task_id;
  assert.ok(taskId);
  const tail = tailThatLooksFinished(taskId, snapshot.seq_watermark);
  const { reader } = fakeReader({ snapshots: [snapshotRow()], events: tail });

  const result = await loadTask({ task_id: taskId }, reader);
  assert.ok(result.ok);
  assert.equal(result.data.found_in_snapshot, true);
  const task = result.data.task;
  assert.ok(task);
  assert.ok(task.lifecycle_state !== null, "uppgiften saknade lifecycle-state ur snapshoten");
  assert.equal(task.lifecycle_state, "WORKING", "tail flyttade lifecycle-state");
  assert.equal(task.lifecycle_source, "snapshot", "lifecycle-state kom inte ur snapshoten");
  assert.ok(task.pending.length > 0, "terminala tail-rader ska markeras som obekräftade");
  for (const pending of task.pending) {
    assert.equal(pending.status, "AWAITING_SNAPSHOT_CONFIRMATION");
    assert.equal(pending.confirms_state, null);
  }
  assert.equal(result.data.gap_detection, "disabled_filtered_view");
  assert.equal(result.data.scope, "filtered");

  // LÖGNSTUB: den naiva folden — "sista terminala eventet vinner" — hade sagt DONE på exakt
  // samma data. Skillnaden är alltså mätbar, och läsytan väljer snapshoten.
  const naiveFold = tail.some((row) => row.event_type === "promotion.completed") ? "DONE" : null;
  assert.equal(naiveFold, "DONE");
  assert.notEqual(task.lifecycle_state, naiveFold);
  assert.equal(TRANSPORT_RULES.RECONSTRUCTS_STATE_BY_EVENT_FOLD, false);
});

test("en task som bara finns i strömmen får INGEN lifecycle-state, och en okänd task ger null", async () => {
  const tail = tailThatLooksFinished("p-999", 23);
  const { reader } = fakeReader({ snapshots: [snapshotRow()], events: tail });

  const tailOnly = await loadTask({ task_id: "p-999" }, reader);
  assert.ok(tailOnly.ok);
  assert.equal(tailOnly.data.found_in_snapshot, false);
  assert.equal(tailOnly.data.task?.lifecycle_state, null);
  assert.equal(tailOnly.data.task?.authoritative, null);

  const unknown = await loadTask({ task_id: "p-finns-inte" }, reader);
  assert.ok(unknown.ok);
  assert.equal(unknown.data.task, null);
  assert.equal(unknown.data.found_in_snapshot, false);
  assert.equal(unknown.data.snapshot_status, "present");
});

test("task-vyns fönster rapporteras ärligt — en avkortad ström påstår aldrig hela historiken", async () => {
  const snapshot = RAW_FIXTURES.snapshot as unknown as LoopSnapshot;
  const taskId = snapshot.current_task?.task_id;
  assert.ok(taskId);
  const tail = tailThatLooksFinished(taskId, snapshot.seq_watermark);
  const { reader, queries } = fakeReader({ snapshots: [snapshotRow()], events: tail });

  const truncated = await loadTask({ task_id: taskId, limit: 2 }, reader);
  assert.ok(truncated.ok);
  assert.equal(truncated.data.window.returned, 2);
  assert.equal(truncated.data.window.may_have_more, true);

  // Fönstret paginerar på seq — aldrig på ts, och aldrig genom att hämta allt och sila i appen.
  const paged = await loadTask({ task_id: taskId, after_seq: snapshot.seq_watermark + 1 }, reader);
  assert.ok(paged.ok);
  assert.equal(paged.data.window.after_seq, snapshot.seq_watermark + 1);
  assert.equal(paged.data.window.may_have_more, false);
  assert.equal(paged.data.stream.rows.length, tail.length - 1);

  const eventQueries = queries.filter((query) => query.table === READABLE_TABLES.events);
  for (const query of eventQueries) {
    assert.ok(
      query.filters.some((filter) => filter.column === "task_id" && filter.value === taskId),
      "task-vyn filtrerade inte i butiken",
    );
  }
});

test("current_main läses ur snapshoten — läsytan slår aldrig upp origin/main", async () => {
  const { reader } = fakeReader({ snapshots: [snapshotRow()] });
  const result = await loadSnapshot({}, reader);
  assert.ok(result.ok);
  const main = result.data.snapshot?.current_main;
  assert.ok(main);
  assert.deepEqual(main, (RAW_FIXTURES.snapshot as unknown as LoopSnapshot).current_main);
});

/* ────────────────────────────────────────────────────────────────────────────
 * FÖRFRÅGAN — ogiltiga värden avvisas, aldrig tyst omtolkade
 * ──────────────────────────────────────────────────────────────────────────── */

test("frågesträngen tolkas typat; ett ogiltigt värde ger 400 i stället för ett tyst default", () => {
  const ok = parseEventsQuery(new URLSearchParams("after_seq=12&limit=50&run_id=run-a"));
  assert.ok(ok.ok);
  assert.deepEqual(ok.data, { after_seq: 12, limit: 50, run_id: "run-a", task_id: null });

  const defaults = parseEventsQuery(new URLSearchParams(""));
  assert.ok(defaults.ok);
  assert.equal(defaults.data.limit, EVENTS_DEFAULT_LIMIT);
  assert.equal(defaults.data.after_seq, null);

  for (const bad of [
    "after_seq=abc",
    "after_seq=1.5",
    "after_seq=-2",
    "limit=0",
    `limit=${EVENTS_MAX_LIMIT + 1}`,
    "limit=nio",
    "run_id=",
  ]) {
    const result = parseEventsQuery(new URLSearchParams(bad));
    assert.equal(result.ok, false, `${bad} borde ha avvisats`);
    assert.ok(result.ok === false && result.reason === "invalid-request");
  }

  assert.equal(parseIdParam("task_id", null).ok, true);
  assert.equal(parseIdParam("task_id", "p-205").ok, true);
  assert.equal(parseIdParam("task_id", "").ok, false);
  assert.equal(parseIdParam("task_id", "a".repeat(1000)).ok, false);
  assert.equal(parseIdParam("task_id", "p-2 05").ok, false);
});

/* ────────────────────────────────────────────────────────────────────────────
 * REGISTER — öppna val ärvs med avsikt, och V4:s blockering står kvar
 * ──────────────────────────────────────────────────────────────────────────── */

test("V4:s öppna val är registrerade med orsak, omprövningspunkt och ägare", () => {
  assert.ok(TRANSPORT_OPEN_DECISIONS.length >= 3);
  for (const decision of TRANSPORT_OPEN_DECISIONS) {
    assert.ok(decision.id.length > 0);
    assert.ok(decision.decision.length > 0);
    assert.ok(decision.rationale.length > 0);
    assert.ok(decision.revisit_in.length > 0);
  }
});

test("V4 är INTE live-komplett: transporten är byggd, backendens S5/S13 är det inte", () => {
  // Planen: "V4+ backend-prerequisites måste bevisas innan en live-integrationsskiva kallas
  // klar." Ingenting i repot får påstå att läsytan är verifierad mot en verklig kanal —
  // varken fixturer eller den här provfilen är den kanalen.
  const transportSource = source(path.join(REPO, "lib/loop/transport.ts"));
  assert.ok(
    !/live-?komplett|live[_ -]?complete/i.test(transportSource),
    "transporten påstår sig vara live-komplett",
  );
  // Läsytan får aldrig servera fixturer som om de vore kontrollplanet.
  assert.ok(!transportSource.includes("./fixtures"));
  for (const file of LOOP_API_FILES) {
    assert.ok(!source(file).includes("fixtures"), `${path.relative(REPO, file)} serverar fixturer`);
  }
});
