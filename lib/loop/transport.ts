/**
 * V4 · Live läsyta — server-only transport mot KONTROLLPLANETS Supabase.
 *
 * AUKTORITATIV KÄLLA: docs/nortropic-control-room-plan-v1.md — TRANSPORT_PLAN
 * ("Behörighetskrav på Verkstadsgolvets kontrollplansnyckel", tabellskissen, failure
 * semantics), READ_MODEL (SNAPSHOT_WINS), REALTIME (ordning/gap), AUTH_SECURITY
 * (DJUPFÖRSVAR, INGA UNDANTAG) och IMPLEMENTATION_SLICES §V4.
 *
 * BINDANDE REGLER SOM DENNA FIL BÄR MEKANISKT
 * -------------------------------------------
 * · NOLL SKRIVNINGAR mot `loop_events` och `loop_snapshots`. Transporten exponerar ETT
 *   verb — SELECT — genom en smal port (`TransportReader`). Ingen kodväg här anropar
 *   insert/update/upsert/delete/rpc, och Supabase-klienten LÄMNAR ALDRIG modulen, så en
 *   anropare kan inte heller nå en skrivmetod via ett returvärde. Att appens DB-ROLL
 *   dessutom saknar INSERT/UPDATE är en deploy-/backendfakta (V4 exit 2) som mäts där,
 *   inte här: den här filen gör den mätningen möjlig genom att aldrig behöva rätten.
 * · NYCKELN FÅR INTE VARA service_role. En nyckel som självdeklarerar `role:service_role`
 *   (JWT) eller bär Supabases hemliga nyckelprefix avvisas FAIL-CLOSED innan någon klient
 *   skapas — den kringgår RLS projektbrett och kan därmed skriva i eventströmmen.
 * · ORDNING läses ur `seq` ENSAMT (B3). `ts` sorterar aldrig. `published_ts` används bara
 *   som LIKABRYTARE när två snapshotrader delar `seq_watermark`.
 * · GAP-DETEKTION ENDAST på den OFILTRERADE butiksströmmen. Så fort ett `run_id`- eller
 *   `task_id`-filter är satt är vyn `filtered` och gap-detektionen AVSTÄNGD (legitima hopp).
 * · SNAPSHOT_WINS. Auktoritativ state kommer ur controllerns snapshot. Den här filen
 *   rekonstruerar ALDRIG state genom event-fold — task-vyer byggs av ./snapshot.ts, som
 *   kopierar snapshotens fält och låter tail bidra med ström och transient fas.
 * · Verkstadsgolvet slår ALDRIG upp `origin/main`. `current_main` läses ur snapshoten.
 * · Okänd eller otillgänglig backenddata blir `null` + orsak. Aldrig en nolla, aldrig ett
 *   uppfunnet fält, aldrig en tyst tom vy. Vyerna renderar `—`.
 *
 * VAD DENNA FIL ALDRIG GÖR
 * ------------------------
 * Ingen skrivning, ingen ingestion, inget kommando (V7), ingen intake (V8), ingen SSE (V9),
 * ingen Git-/ref-uppslagning, ingen verifiering, ingen attestation, ingen promotion, ingen
 * lease-/breaker-beröring. Ingen import av lib/github-read.ts eller lib/github-write.ts
 * (MASKINEN_GITHUB_CREDENTIAL=NONE). Inga hemligheter i returvärden eller felmeddelanden.
 *
 * SERVER-ONLY: modulen läser LOOP_SUPABASE_KEY ur process.env och får aldrig importeras av
 * klientkod. Klientvägen går via app/api/loop/**-routarna, som gatar med auth() själva.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  EVENT_ENVELOPE_COLUMNS,
  validateSnapshot,
  type LoopSnapshot,
} from "./schema";
import { projectEvents, type IngestReport, type StreamScope, type StreamView } from "./events";
import {
  buildReadModel,
  type SnapshotStatus,
  type TailOnlyTaskProjection,
  type TaskProjection,
} from "./snapshot";

/* ────────────────────────────────────────────────────────────────────────────
 * LÅSTA REGLER — greppbara konstanter, så att en senare skiva inte kan glida
 * ──────────────────────────────────────────────────────────────────────────── */

export const TRANSPORT_RULES = {
  /** V4 exit 2. Transporten har inget skrivverb alls. */
  APP_WRITES_TO_EVENT_STORE: false,
  APP_WRITES_TO_SNAPSHOT_STORE: false,
  /** V4 negativ kontroll: "UI som slår upp origin/main själv". */
  RESOLVES_ORIGIN_MAIN: false,
  /** V4 negativ kontroll: "authoritative state rekonstruerat genom event-fold". */
  RECONSTRUCTS_STATE_BY_EVENT_FOLD: false,
  /** V4 exit 5 (B3). */
  GAP_DETECTION_SCOPE: "UNFILTERED_STORE_STREAM_ONLY",
  ORDERING_KEY: "seq",
  TS_IS_ORDERING: false,
  DISPLAYED_TRUTH: "CONTROLLER_PUBLISHED_SNAPSHOT",
  /** V4 exit 4. Routarna gatas av middleware OCH av auth() i varje handler. */
  MIDDLEWARE_EXEMPTION_FOR_API_LOOP: false,
  /** TRANSPORT_PLAN: "Detta får INTE vara en service_role-nyckel". */
  SERVICE_ROLE_KEY_ACCEPTED: false,
} as const;

/** De två tabeller läsytan rör. Båda med EXAKT en rättighet: SELECT. */
export const READABLE_TABLES = {
  events: "loop_events",
  snapshots: "loop_snapshots",
} as const;
export type ReadableTable = (typeof READABLE_TABLES)[keyof typeof READABLE_TABLES];

/**
 * Den behörighet transporten faktiskt BEHÖVER, ordagrant ur TRANSPORT_PLAN. Bärs som data
 * så att ett prov kan mäta att ingen skrivrättighet någonsin krävs av läsytan.
 */
export const REQUIRED_GRANTS: Readonly<Record<ReadableTable, "SELECT">> = Object.freeze({
  loop_events: "SELECT",
  loop_snapshots: "SELECT",
});

/**
 * Snapshotradens KONTRAKTSKOLUMNER. Precis som för eventkuvertet (se V1:s
 * EVENT_ENVELOPE_COLUMNS) projiceras exakt dessa — aldrig `select("*")` — så att en
 * transportkolumn utanför kontraktet inte kan fälla raden.
 */
export const SNAPSHOT_ROW_COLUMNS = [
  "run_id",
  "schema_version",
  "seq_watermark",
  "published_ts",
  "snapshot",
] as const;

/**
 * ÖPPNA VAL som V4 tagit medvetet och som ska omprövas mot ett VERKLIGT backendschema.
 * De står här för att vara ärvda med avsikt i stället för av slentrian (samma mönster som
 * V1:s OPEN_DECISIONS). Ett prov mäter att registret är ifyllt.
 */
export const TRANSPORT_OPEN_DECISIONS = [
  {
    id: "SNAPSHOT_ROW_TO_CONTRACT_COMPOSITION",
    decision:
      "Snapshotens kontraktsobjekt sätts ihop av radens typade kolumner (run_id, " +
      "schema_version, seq_watermark, published_ts) och kroppen i `snapshot`-kolumnen. Bär " +
      "kroppen samma fält måste de vara IDENTISKA med kolumnerna, annars avvisas snapshoten " +
      "med orsak.",
    rationale:
      "B8:s snapshotkropp är inte låst vid NORTROPIC_PLAN_COMMIT. Att tyst låta kroppen " +
      "vinna över kolumnerna (eller tvärtom) hade gjort DISPLAYED_TRUTH beroende av vilken " +
      "av två motstridiga källor som råkade läsas sist. Ett avvisande är synligt.",
    revisit_in: "V5",
    depends_on: "nortropic-system S13 (B8)",
  },
  {
    id: "SNAPSHOT_SELECTION_WITHOUT_RUN_ID",
    decision:
      "Utan explicit run_id väljs raden med HÖGST seq_watermark; published_ts bryter bara " +
      "lika. Valet rapporteras i svaret som `selection`.",
    rationale:
      "seq är butiksglobalt monoton (B3) och är därför den enda ordningsnyckel planen " +
      "erkänner. Att välja på published_ts ensamt hade gjort en klockjustering till en " +
      "vy-ändring. Backenden pekar ännu inte ut någon 'aktiv run' i kontraktet — gör den " +
      "det ska den peka ut den, inte den här heuristiken.",
    revisit_in: "V5",
    depends_on: "nortropic-system S5/S13",
  },
  {
    id: "BACKEND_AVAILABILITY_RETURNS_200_ENVELOPE",
    decision:
      "Otillgänglig eller okonfigurerad transport svarar 200 med ett ok:false-envelope. " +
      "Endast en felformad FÖRFRÅGAN ger 400, saknad session 401 och avslagen flagga 404.",
    rationale:
      "Repots etablerade mönster (app/api/repos/route.ts, lib/github-read.ts): 'alltid 200 " +
      "med envelope — klienten renderar graceful-läge från result.ok'. Orsaken bärs " +
      "maskinläsbart i `reason`, så UI:t kan visa planens exakta feltext i stället för att " +
      "krascha på ett icke-JSON-svar.",
    revisit_in: "V9/V10",
    depends_on: "—",
  },
] as const;

/* ────────────────────────────────────────────────────────────────────────────
 * ENVELOPE — samma hållning som lib/github-read.ts: aldrig kast, alltid orsak
 * ──────────────────────────────────────────────────────────────────────────── */

export type LoopReadFailReason =
  /** LOOP_SUPABASE_URL/KEY saknas. Planens text: "Kontrollplanets transport är inte konfigurerad". */
  | "not-configured"
  /** Nyckeln kringgår RLS. Fail-closed innan någon klient skapas. */
  | "refused-service-role"
  /** Nätverk, PostgREST-fel, saknad tabell, saknad SELECT-rätt. */
  | "transport-error"
  /** Felformad förfrågan från vår egen route (400). */
  | "invalid-request";

export type LoopReadFail = { ok: false; reason: LoopReadFailReason; message: string };
export type LoopReadResult<T> = { ok: true; data: T } | LoopReadFail;

/** Ingen läsroute cachas: kontrollplansläge är per-request och per-session. */
export const LOOP_READ_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Cache-Control": "no-store",
});

/**
 * HTTP-status för ett misslyckat läsanrop. Se TRANSPORT_OPEN_DECISIONS
 * (BACKEND_AVAILABILITY_RETURNS_200_ENVELOPE) för varför otillgänglig backend ger 200.
 */
export function httpStatusForReason(reason: LoopReadFailReason): number {
  return reason === "invalid-request" ? 400 : 200;
}

/** 401-kroppen. Bärs här så att alla tre routar svarar IDENTISKT (A2). */
export const UNAUTHORIZED_ENVELOPE: LoopReadFail = Object.freeze({
  ok: false,
  reason: "invalid-request",
  message: "Ingen giltig session.",
});

/** 404-kroppen när LOOP_ENABLED är av. Ingen halv kontrollrumsyta läcker ut. */
export const LOOP_DISABLED_ENVELOPE: LoopReadFail = Object.freeze({
  ok: false,
  reason: "invalid-request",
  message: "Maskinen är inte aktiverad.",
});

function fail(reason: LoopReadFailReason, message: string): LoopReadFail {
  return { ok: false, reason, message };
}

/** Felmeddelande utan nycklar, utan payloadvärden och utan stacktrace. */
function transportErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Okänt transportfel.";
}

/* ────────────────────────────────────────────────────────────────────────────
 * KONFIGURATION OCH NYCKELKLASSIFICERING
 * ──────────────────────────────────────────────────────────────────────────── */

export type KeyClassification = {
  /** "jwt" = klassisk anon/service_role-nyckel · "prefixed" = sb_*-nyckel · "opaque" = okänd form. */
  kind: "jwt" | "prefixed" | "opaque";
  /** Rollanspråket i en JWT, om det finns. Aldrig ett bevis — bara nyckelns självdeklaration. */
  role: string | null;
  /** true = nyckeln kringgår RLS enligt sin egen form → avvisas. */
  bypasses_rls: boolean;
};

/** Nyckelformer som per Supabases dokumentation kringgår RLS projektbrett. */
const RLS_BYPASSING_JWT_ROLES: readonly string[] = ["service_role"];
const RLS_BYPASSING_KEY_PREFIXES: readonly string[] = ["sb_secret_"];

function decodeJwtRole(key: string): string | null {
  const segments = key.split(".");
  if (segments.length !== 3) return null;
  try {
    const payload: unknown = JSON.parse(
      Buffer.from(segments[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    );
    if (payload === null || typeof payload !== "object") return null;
    const role = (payload as { role?: unknown }).role;
    return typeof role === "string" ? role : null;
  } catch {
    // En oläsbar payload är inte ett bevis på något. Den klassas som opak, inte som säker.
    return null;
  }
}

/**
 * Klassificerar transportnyckeln UTAN att någonsin returnera eller logga den.
 *
 * FAIL-CLOSED I RÄTT RIKTNING: en nyckel vars form vi inte känner igen blockeras INTE (den
 * kan mycket väl vara den begränsade DB-rollen planen kräver), men en nyckel som själv
 * säger sig kringgå RLS avvisas. Att gissa fel åt andra hållet — släppa igenom en
 * service_role-nyckel — hade gett appen skrivrätt i eventströmmen, vilket är exakt V4:s
 * negativa kontroll ("service_role-nyckel i Railway").
 */
export function classifyTransportKey(key: string): KeyClassification {
  const role = decodeJwtRole(key);
  if (role !== null) {
    return { kind: "jwt", role, bypasses_rls: RLS_BYPASSING_JWT_ROLES.includes(role) };
  }
  const prefix = RLS_BYPASSING_KEY_PREFIXES.find((candidate) => key.startsWith(candidate));
  if (prefix) return { kind: "prefixed", role: null, bypasses_rls: true };
  return { kind: "opaque", role: null, bypasses_rls: false };
}

export type TransportConfig =
  | { configured: true; url: string; key: string; key_classification: KeyClassification }
  | {
      configured: false;
      reason: Extract<LoopReadFailReason, "not-configured" | "refused-service-role">;
      message: string;
    };

/**
 * Läser kontrollplanets transportkonfiguration. `env` injiceras så att ett prov kan mäta
 * grinden utan att mutera processens riktiga miljö (samma mönster som components/loop/flag.ts).
 *
 * Texten vid saknad URL är planens ordagranna: "Kontrollplanets transport är inte
 * konfigurerad (LOOP_SUPABASE_URL saknas)".
 */
export function transportConfig(
  env: Record<string, string | undefined> = process.env,
): TransportConfig {
  const url = env.LOOP_SUPABASE_URL;
  const key = env.LOOP_SUPABASE_KEY;
  if (!url) {
    return {
      configured: false,
      reason: "not-configured",
      message: "Kontrollplanets transport är inte konfigurerad (LOOP_SUPABASE_URL saknas).",
    };
  }
  if (!key) {
    return {
      configured: false,
      reason: "not-configured",
      message: "Kontrollplanets transport är inte konfigurerad (LOOP_SUPABASE_KEY saknas).",
    };
  }
  const classification = classifyTransportKey(key);
  if (classification.bypasses_rls) {
    return {
      configured: false,
      reason: "refused-service-role",
      message:
        "Kontrollplanets transportnyckel avvisades: den kringgår RLS (service_role eller " +
        "hemlig nyckel) och skulle kunna skriva i eventströmmen. Använd den begränsade " +
        "DB-rollen med SELECT på loop_events och loop_snapshots.",
    };
  }
  return { configured: true, url, key, key_classification: classification };
}

/** true = transporten är konfigurerad OCH nyckeln är inte en RLS-kringgående nyckel. */
export function isTransportConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return transportConfig(env).configured;
}

/* ────────────────────────────────────────────────────────────────────────────
 * DEN SMALA LÄSPORTEN — enda vägen till transporten, och den kan bara SELECTa
 * ──────────────────────────────────────────────────────────────────────────── */

export type TransportRow = Record<string, unknown>;

/** Jämlikhetsfilter. Endast grupperingskolumner — aldrig ett fritt uttryck. */
export type SelectFilter = { column: "run_id" | "task_id"; value: string };

/** Ordning. `published_ts` finns ENBART som likabrytare för snapshotval, aldrig för event. */
export type SelectOrder = {
  column: "seq" | "seq_watermark" | "published_ts";
  ascending: boolean;
};

export type SelectQuery = {
  table: ReadableTable;
  /** Exakta kontraktskolumner. Aldrig "*". */
  columns: readonly string[];
  filters: readonly SelectFilter[];
  /** `seq > after_seq`. null = inget nedre fönster. */
  after_seq: number | null;
  order: readonly SelectOrder[];
  limit: number;
};

/**
 * Portens hela yta. Ett verb: läs rader. Det finns ingen motsvarande skrivport, och
 * Supabase-klienten exponeras aldrig — därför kan varken den här modulen eller en anropare
 * nå en skrivmetod (V4 exit 2, negativ kontroll "appen skriver i eventtabellen").
 */
export type TransportReader = (query: SelectQuery) => Promise<LoopReadResult<TransportRow[]>>;

/**
 * Lazy klientcache (samma mönster som lib/supabase.ts). Cachen nycklas på BÅDE url och
 * nyckel: en roterad nyckel måste ge en ny klient, annars hade processen kunnat fortsätta
 * läsa med en återkallad credential tills den startades om.
 *
 * Separatorn mellan url och nyckel är en NUL-byte (U+0000) — en byte som varken en URL eller en
 * Supabase-nyckel kan innehålla, så två olika par kan aldrig ge samma identitetssträng.
 * Den skrivs som ESCAPE och aldrig som en rå byte: en litteral NUL i källan gör filen
 * binär för file(1), grep och ripgrep, och en grep-baserad statisk grind (repots sätt att
 * mäta skrivverb, credentialer och markörsträngar) hade då hoppat över just den här filen
 * medan den såg ut att gå grön. Ett prov längre ner mäter att regeln håller.
 */
let cachedClient: SupabaseClient | null = null;
let cachedClientIdentity: string | null = null;

function controlPlaneClient(config: Extract<TransportConfig, { configured: true }>): SupabaseClient {
  if (typeof window !== "undefined") {
    // Server-only. Skulle modulen någonsin dras in i en klientbundle ska det smälla här
    // i stället för att en transportnyckel hamnar i webbläsaren.
    throw new Error("lib/loop/transport.ts är server-only och får aldrig köras i klienten.");
  }
  const identity = `${config.url}\u0000${config.key}`;
  if (!cachedClient || cachedClientIdentity !== identity) {
    cachedClient = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    cachedClientIdentity = identity;
  }
  return cachedClient;
}

/**
 * Den riktiga läsaren mot kontrollplanets Supabase. Bygger en PostgREST-fråga som ENDAST
 * kan bli en SELECT: tabellen är en av två, kolumnerna är kontraktskolumner, filtren är
 * jämlikhet på grupperingskolumner och ordningen är `seq` (eller snapshotens watermark).
 */
export function supabaseReader(
  env: Record<string, string | undefined> = process.env,
): TransportReader {
  return async (query: SelectQuery): Promise<LoopReadResult<TransportRow[]>> => {
    const config = transportConfig(env);
    if (!config.configured) return fail(config.reason, config.message);

    try {
      const client = controlPlaneClient(config);
      let builder = client.from(query.table).select(query.columns.join(","));
      for (const filter of query.filters) builder = builder.eq(filter.column, filter.value);
      if (query.after_seq !== null) builder = builder.gt("seq", query.after_seq);
      for (const order of query.order) {
        builder = builder.order(order.column, { ascending: order.ascending });
      }
      const { data, error } = await builder.limit(query.limit);
      if (error) return fail("transport-error", transportErrorMessage(error));
      return { ok: true, data: Array.isArray(data) ? (data as unknown as TransportRow[]) : [] };
    } catch (error) {
      return fail("transport-error", transportErrorMessage(error));
    }
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * NORMALISERING — transportens enda tillåtna omskrivning
 * ──────────────────────────────────────────────────────────────────────────── */

const INTEGER_STRING = /^-?\d+$/;

/**
 * `bigint` kan serialiseras som STRÄNG av PostgREST beroende på klient och kolumntyp.
 * Transporten normaliserar därför ENDAST exakta heltalssträngar i `seq`/`seq_watermark`
 * till number. Ett värde utanför säkert heltalsintervall lämnas som det kom in, så att
 * V1:s validering fäller raden SYNLIGT i stället för att en tyst precisionsförlust
 * förvandlar en seq till fel tal.
 *
 * Ingenting annat skrivs om. Transporten uppfinner aldrig ett fält och fyller aldrig ett
 * saknat värde.
 */
export function normalizeIntegerField(value: unknown): unknown {
  if (typeof value !== "string" || !INTEGER_STRING.test(value)) return value;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

/** Kopia av eventraden med normaliserad `seq`. Radens övriga fält lämnas orörda. */
export function normalizeEventRow(row: TransportRow): TransportRow {
  if (!("seq" in row)) return row;
  return { ...row, seq: normalizeIntegerField(row.seq) };
}

/* ────────────────────────────────────────────────────────────────────────────
 * SNAPSHOT — DISPLAYED_TRUTH
 * ──────────────────────────────────────────────────────────────────────────── */

export type SnapshotSelection = "explicit_run_id" | "highest_seq_watermark";

/** Radens typade kolumner, även när kroppen avvisas. Saknat värde är null → renderas "—". */
export type SnapshotRowHead = {
  run_id: string | null;
  schema_version: string | null;
  seq_watermark: number | null;
  published_ts: string | null;
};

export type SnapshotRead = {
  source: "control_plane_supabase";
  /** Aldrig fixtur. Konstanten finns för att en vy inte ska kunna blanda ihop lägena. */
  fixture: false;
  selection: SnapshotSelection;
  /** "present" · "absent" (ingen run registrerad ännu) · "rejected" (form avviker, MED orsak). */
  status: SnapshotStatus;
  reason: string | null;
  snapshot: LoopSnapshot | null;
  row_head: SnapshotRowHead | null;
};

function snapshotRowHead(row: TransportRow): SnapshotRowHead {
  const watermark = normalizeIntegerField(row.seq_watermark);
  return {
    run_id: typeof row.run_id === "string" ? row.run_id : null,
    schema_version: typeof row.schema_version === "string" ? row.schema_version : null,
    seq_watermark: typeof watermark === "number" ? watermark : null,
    published_ts: typeof row.published_ts === "string" ? row.published_ts : null,
  };
}

/**
 * Sätter ihop radens kolumner och kroppen till ett KONTRAKTSOBJEKT för V1:s
 * `validateSnapshot`. Se TRANSPORT_OPEN_DECISIONS.SNAPSHOT_ROW_TO_CONTRACT_COMPOSITION:
 * bär kroppen samma huvudfält som kolumnerna måste de vara identiska, annars avvisas
 * snapshoten med orsak i stället för att en av två motstridiga källor tyst vinner.
 */
export function composeSnapshotFromRow(
  row: TransportRow,
): { ok: true; candidate: Record<string, unknown> } | { ok: false; reason: string } {
  const body = row.snapshot;
  if (!isPlainRecord(body)) {
    return {
      ok: false,
      reason: "snapshot-kolumnen är inte ett objekt — controllerns snapshotkropp saknas.",
    };
  }

  const header: Record<string, unknown> = {
    schema_version: row.schema_version,
    run_id: row.run_id,
    seq_watermark: normalizeIntegerField(row.seq_watermark),
    published_ts: row.published_ts,
  };

  for (const [field, columnValue] of Object.entries(header)) {
    if (!(field in body)) continue;
    const bodyValue = normalizeIntegerField(body[field]);
    if (bodyValue !== columnValue) {
      return {
        ok: false,
        reason:
          `snapshotens kropp och transportkolumn säger olika om ${field} ` +
          `(kolumn: ${JSON.stringify(columnValue)}, kropp: ${JSON.stringify(bodyValue)}).`,
      };
    }
  }

  return { ok: true, candidate: { ...body, ...header } };
}

export type LoadSnapshotOptions = {
  /** Explicit run. Utan den väljs raden med högst seq_watermark (se TRANSPORT_OPEN_DECISIONS). */
  run_id?: string | null;
};

/**
 * Läser controllerns publicerade snapshot. Enda källan till auktoritativ state i UI:t.
 *
 * · Ingen rad → `absent`. Planens text: "Ingen körning registrerad ännu". Inga nollor.
 * · Rad som inte validerar → `rejected` MED orsak, snapshot null. Aldrig en tyst tom vy.
 * · Ingen fold, ingen härledning, ingen origin/main-uppslagning.
 */
export async function loadSnapshot(
  options: LoadSnapshotOptions = {},
  reader: TransportReader = supabaseReader(),
): Promise<LoopReadResult<SnapshotRead>> {
  const runId = options.run_id ?? null;
  const result = await reader({
    table: READABLE_TABLES.snapshots,
    columns: SNAPSHOT_ROW_COLUMNS,
    filters: runId === null ? [] : [{ column: "run_id", value: runId }],
    after_seq: null,
    // seq är den enda ordningsnyckeln planen erkänner (B3). published_ts bryter bara lika.
    order: [
      { column: "seq_watermark", ascending: false },
      { column: "published_ts", ascending: false },
    ],
    limit: 1,
  });
  if (!result.ok) return result;

  const selection: SnapshotSelection = runId === null ? "highest_seq_watermark" : "explicit_run_id";
  const row = result.data[0];
  if (!row) {
    return {
      ok: true,
      data: {
        source: "control_plane_supabase",
        fixture: false,
        selection,
        status: "absent",
        reason: null,
        snapshot: null,
        row_head: null,
      },
    };
  }

  const head = snapshotRowHead(row);
  const composed = composeSnapshotFromRow(row);
  if (!composed.ok) {
    return {
      ok: true,
      data: {
        source: "control_plane_supabase",
        fixture: false,
        selection,
        status: "rejected",
        reason: composed.reason,
        snapshot: null,
        row_head: head,
      },
    };
  }

  const validated = validateSnapshot(composed.candidate);
  return {
    ok: true,
    data: {
      source: "control_plane_supabase",
      fixture: false,
      selection,
      status: validated.ok ? "present" : "rejected",
      reason: validated.ok ? null : validated.message,
      snapshot: validated.ok ? validated.data : null,
      row_head: head,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * EVENT — fönsterläsning ur butiken
 * ──────────────────────────────────────────────────────────────────────────── */

export const EVENTS_DEFAULT_LIMIT = 200;
export const EVENTS_MAX_LIMIT = 500;
/** `after_seq=-1` betyder "från butikens början" (seq får vara 0 enligt V1:s schema). */
export const EVENTS_MIN_AFTER_SEQ = -1;
/** Ett id är en ogenomskinlig sträng från backenden. Taket stoppar bara absurda frågor. */
export const MAX_ID_LENGTH = 200;

export type EventsQuery = {
  after_seq: number | null;
  limit: number;
  run_id: string | null;
  task_id: string | null;
};

/**
 * En vy är `filtered` så snart ETT filter är satt. Filtrerade vyer gap-detekterar ALDRIG:
 * seq är butiksglobalt monoton, så andra runs event ligger legitimt emellan (B3, V4 exit 5).
 */
export function scopeFor(query: { run_id: string | null; task_id: string | null }): StreamScope {
  return query.run_id === null && query.task_id === null ? "store" : "filtered";
}

/** Kontrolltecken. De hör inte hemma i ett backend-id och gör felmeddelanden oläsbara. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * Id-parser för routarna (`?run_id=`, `?task_id=`). Ett id är en OGENOMSKINLIG sträng från
 * backenden — formen ägs inte här — så den enda kontrollen är längd och kontrolltecken.
 * Ett ogiltigt id ger 400, aldrig en gissning och aldrig ett tyst bortfall av filtret.
 */
export function parseIdParam(name: string, raw: string | null): LoopReadResult<string | null> {
  if (raw === null) return { ok: true, data: null };
  if (raw.length === 0 || raw.length > MAX_ID_LENGTH) {
    return fail("invalid-request", `${name} måste vara 1–${MAX_ID_LENGTH} tecken.`);
  }
  if (CONTROL_CHARACTERS.test(raw)) {
    return fail("invalid-request", `${name} innehåller ogiltiga tecken.`);
  }
  return { ok: true, data: raw };
}

/**
 * Tolkar frågesträngen till en typad fönsterfråga. Ett ogiltigt värde AVVISAS (400) i
 * stället för att tyst falla tillbaka på ett default — annars hade `?limit=abc` gett ett
 * annat fönster än det anroparen bad om, utan att någon sa det.
 */
export function parseEventsQuery(params: URLSearchParams): LoopReadResult<EventsQuery> {
  const rawAfterSeq = params.get("after_seq");
  let afterSeq: number | null = null;
  if (rawAfterSeq !== null) {
    if (!INTEGER_STRING.test(rawAfterSeq)) {
      return fail("invalid-request", "after_seq måste vara ett heltal.");
    }
    const parsed = Number(rawAfterSeq);
    if (!Number.isSafeInteger(parsed) || parsed < EVENTS_MIN_AFTER_SEQ) {
      return fail(
        "invalid-request",
        `after_seq måste vara ett heltal ≥ ${EVENTS_MIN_AFTER_SEQ} inom säkert intervall.`,
      );
    }
    afterSeq = parsed;
  }

  const rawLimit = params.get("limit");
  let limit = EVENTS_DEFAULT_LIMIT;
  if (rawLimit !== null) {
    if (!INTEGER_STRING.test(rawLimit)) {
      return fail("invalid-request", "limit måste vara ett heltal.");
    }
    const parsed = Number(rawLimit);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > EVENTS_MAX_LIMIT) {
      return fail("invalid-request", `limit måste vara mellan 1 och ${EVENTS_MAX_LIMIT}.`);
    }
    limit = parsed;
  }

  const runId = parseIdParam("run_id", params.get("run_id"));
  if (!runId.ok) return runId;
  const taskId = parseIdParam("task_id", params.get("task_id"));
  if (!taskId.ok) return taskId;

  return { ok: true, data: { after_seq: afterSeq, limit, run_id: runId.data, task_id: taskId.data } };
}

export type EventsRead = {
  source: "control_plane_supabase";
  fixture: false;
  scope: StreamScope;
  /** "store_stream" endast för den ofiltrerade butiksströmmen (V4 exit 5). */
  gap_detection: StreamView["gap_detection"];
  filters: { run_id: string | null; task_id: string | null };
  window: {
    after_seq: number | null;
    limit: number;
    returned: number;
    /** true = fönstret var fullt; det kan finnas fler rader efter `stream.last_seq`. */
    may_have_more: boolean;
  };
  stream: StreamView;
  ingest: IngestReport;
};

/** Rådata ur butiken, normaliserad men OVALIDERAD. Intern — valideringen är V1:s. */
async function fetchEventRows(
  query: EventsQuery,
  reader: TransportReader,
): Promise<LoopReadResult<TransportRow[]>> {
  const filters: SelectFilter[] = [];
  if (query.run_id !== null) filters.push({ column: "run_id", value: query.run_id });
  if (query.task_id !== null) filters.push({ column: "task_id", value: query.task_id });

  const result = await reader({
    table: READABLE_TABLES.events,
    // EXAKT kuvertets kontraktskolumner (V1). Aldrig "*" — `ingested_at` hade fällt varje rad.
    columns: EVENT_ENVELOPE_COLUMNS,
    filters,
    after_seq: query.after_seq,
    // `seq` ENSAMT, stigande. `ts` sorterar aldrig (B3).
    order: [{ column: "seq", ascending: true }],
    limit: query.limit,
  });
  if (!result.ok) return result;
  return { ok: true, data: result.data.map(normalizeEventRow) };
}

/**
 * Läser ett fönster ur eventbutiken och projicerar det med V3:s läsmodell.
 *
 * GAP-DETEKTION: bara när vyn är OFILTRERAD. `expected_after_seq` sätts bara då, så att en
 * lucka före fönstrets första rad kan upptäckas i butiksströmmen — och aldrig larmas om i
 * en run-/task-filtrerad vy (V4 exit 5, negativ kontroll "falsklarm om lucka i en
 * run-filtrerad vy").
 *
 * Ingen state härleds här. Raderna är aktivitet och bevis, aldrig authority.
 */
export async function loadEvents(
  query: EventsQuery,
  reader: TransportReader = supabaseReader(),
): Promise<LoopReadResult<EventsRead>> {
  const rows = await fetchEventRows(query, reader);
  if (!rows.ok) return rows;

  const scope = scopeFor(query);
  const { stream, ingest } = projectEvents(rows.data, {
    scope,
    // Stale/tail-gränsen hör till snapshotens watermark och sätts när snapshoten är med
    // (se loadTask / buildReadModel). Ett eventfönster ensamt påstår ingen sådan gräns.
    seq_watermark: null,
    expected_after_seq: scope === "store" ? query.after_seq : null,
  });

  return {
    ok: true,
    data: {
      source: "control_plane_supabase",
      fixture: false,
      scope,
      gap_detection: stream.gap_detection,
      filters: { run_id: query.run_id, task_id: query.task_id },
      window: {
        after_seq: query.after_seq,
        limit: query.limit,
        returned: rows.data.length,
        may_have_more: rows.data.length === query.limit,
      },
      stream,
      ingest,
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * TASK — snapshotens vy, aldrig en fold
 * ──────────────────────────────────────────────────────────────────────────── */

export type TaskRead = {
  source: "control_plane_supabase";
  fixture: false;
  task_id: string;
  snapshot_status: SnapshotStatus;
  snapshot_reason: string | null;
  /** true = uppgiften finns i controllerns snapshot och har därmed en lifecycle-state. */
  found_in_snapshot: boolean;
  /**
   * Snapshotens task-projektion (auktoritativa fält KOPIERADE ur snapshoten) eller — när
   * uppgiften bara setts i strömmen — en tail-only-projektion UTAN lifecycle-state. null när
   * uppgiften varken finns i snapshot eller ström: då är svaret "vet inte", inte ett tomt kort.
   */
  task: TaskProjection | TailOnlyTaskProjection | null;
  /** Alltid filtrerad vy → gap-detektion AVSTÄNGD (B3). */
  scope: "filtered";
  gap_detection: "disabled_filtered_view";
  /**
   * Fönstret rapporteras ÄRLIGT: en avkortad ström får aldrig se ut som hela uppgiftens
   * historik. `may_have_more` betyder att anroparen ska paginera med `after_seq`.
   */
  window: {
    after_seq: number | null;
    limit: number;
    returned: number;
    may_have_more: boolean;
  };
  stream: StreamView;
};

export type LoadTaskOptions = {
  task_id: string;
  run_id?: string | null;
  /** Fönstrets nedre gräns (`seq > after_seq`). null = uppgiftens äldsta rader. */
  after_seq?: number | null;
  limit?: number;
};

/**
 * Läser EN uppgift: snapshotens auktoritativa vy plus uppgiftens egna eventrader.
 *
 * SNAPSHOT_WINS mekaniskt: sammanslagningen görs av V3:s `buildReadModel`, som kopierar
 * lifecycle-state ur snapshoten och låter tail bidra med ström och transient fas. En
 * tail-sekvens som "avslutar" uppgiften ger därför `pending`-markeringar — aldrig DONE.
 */
export async function loadTask(
  options: LoadTaskOptions,
  reader: TransportReader = supabaseReader(),
): Promise<LoopReadResult<TaskRead>> {
  const snapshotResult = await loadSnapshot({ run_id: options.run_id ?? null }, reader);
  if (!snapshotResult.ok) return snapshotResult;

  const afterSeq = options.after_seq ?? null;
  const limit = options.limit ?? EVENTS_DEFAULT_LIMIT;
  const rows = await fetchEventRows(
    { after_seq: afterSeq, limit, run_id: options.run_id ?? null, task_id: options.task_id },
    reader,
  );
  if (!rows.ok) return rows;

  const model = buildReadModel({
    snapshot: snapshotResult.data.snapshot,
    events: rows.data,
    // En task-vy är per definition filtrerad: aldrig gap-detektion (B3).
    scope: "filtered",
    expected_after_seq: null,
  });

  const fromSnapshot = model.tasks.find((task) => task.task_id === options.task_id) ?? null;
  const fromTail = model.tail_only_tasks.find((task) => task.task_id === options.task_id) ?? null;

  return {
    ok: true,
    data: {
      source: "control_plane_supabase",
      fixture: false,
      task_id: options.task_id,
      snapshot_status: snapshotResult.data.status,
      snapshot_reason: snapshotResult.data.reason,
      found_in_snapshot: fromSnapshot !== null,
      task: fromSnapshot ?? fromTail,
      scope: "filtered",
      gap_detection: "disabled_filtered_view",
      window: {
        after_seq: afterSeq,
        limit,
        returned: rows.data.length,
        may_have_more: rows.data.length === limit,
      },
      stream: model.stream,
    },
  };
}
