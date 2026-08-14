/**
 * V7 · SMAL KOMMANDOYTA.
 *
 * Provar exit-kriterierna i docs/nortropic-control-room-plan-v1.md §V7:
 *   (1) Exakt fem verb accepteras; ett sjätte ger 400 UTAN sidoeffekt.
 *   (2) En payload som bär en shell-sträng exekveras aldrig — mätt med en payload vars
 *       innehåll skulle skapat en kanariefil om den tolkats.
 *   (3) Oautentiserad ger 401. Fel origin ger 403.
 *   (4) Samma command_id två gånger ger EN rad. Dubbelklick ger ETT kommando.
 *   (5) Utgånget eller stale kommando avvisas med orsak och visas som avvisat.
 *   (6) run.pause_at_safe_boundary presenteras som "efter aktuell uppgift".
 *   (7) Ingen optimistisk state-uppdatering: task state ändras först ur snapshot.
 *   (8) Statiskt: noll kodvägar under app/api/loop/** och lib/loop/** som rör lease, breaker,
 *       Git-refs, verdict, attestation eller promotion.
 * samt de negativa kontrollerna: generisk shell-/Git-yta · godtycklig filredigering ·
 * force merge · direkt attestation- eller promotion-skrivning · lease- eller
 * breaker-manipulation · replay som utför två gånger · UI som visar "startad" innan
 * controllern svarat.
 *
 * PROVSTIL (samma som V1–V4): varje kriterium bär en LÖGNSTUB — den vanligaste genvägen —
 * och provet mäter att stuben FÄLLS av exakt samma data.
 *
 * ÄRLIGHET OM LÄGET: kommandokön (loop_commands) ägs av nortropic-system S13 och FINNS INTE.
 * Ytan, grindarna och idempotensen är byggda och mäts här mot en INJICERAD kö som emulerar
 * tabellens två unika index. Ingen rad i provet påstår att kanalen är live.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import {
  COMMAND_ENDPOINT,
  COMMAND_HEADERS,
  COMMAND_MAX_BODY_BYTES,
  COMMAND_OPEN_DECISIONS,
  COMMAND_QUEUE_BLOCKED_ON,
  COMMAND_QUEUE_DISABLED_REASON,
  COMMAND_QUEUE_TRANSPORT,
  COMMAND_RATE_LIMIT,
  COMMAND_RULES,
  COMMAND_STATUS_PRESENTATION,
  COMMAND_TTL_MS,
  COMMAND_UNAUTHORIZED_ENVELOPE,
  COMMAND_VERB_EXPLANATIONS,
  COMMAND_VERB_LABELS,
  blockedCommandQueue,
  buildCommandRecord,
  commandChannelEnabled,
  commandExpired,
  commandIsStale,
  commandLogEntry,
  commandLogPresentation,
  commandRequestBody,
  commandRequestInit,
  commandStatusCoverage,
  createCommandGateway,
  createIntentDispatcher,
  createCommandLedger,
  createRateLimiter,
  handleCommandRequest,
  httpStatusForCommandReason,
  jsonMediaTypeVerdict,
  readCommandEnvelope,
  sameOriginVerdict,
  validateCommandRequest,
  type CommandEnvelope,
  type CommandGateway,
  type CommandIntent,
  type CommandQueue,
  type CommandResponse,
} from "../../lib/loop/commands";
import {
  COMMAND_STATUSES,
  COMMAND_VERBS,
  dedupKey,
  type Command,
  type CommandRecord,
  type CommandVerb,
} from "../../lib/loop/schema";
import { PAUSE_AT_SAFE_BOUNDARY_EXPLANATION, PAUSE_AT_SAFE_BOUNDARY_LABEL } from "../../lib/loop/labels";
import { fixtureCommands, fixtureSnapshot } from "../../lib/loop/fixtures";
import CommandButton from "../../components/loop/CommandButton";
import CommandDeck from "../../components/loop/CommandDeck";
import CommandLog from "../../components/loop/CommandLog";
import MaskinShell from "../../components/loop/MaskinShell";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");

/* ────────────────────────────────────────────────────────────────────────────
 * HARNESS — en kö som emulerar loop_commands, och en klocka som går när vi säger till
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Tabellskissens TVÅ unika index, och ingenting mer:
 *   · `command_id` PRIMARY KEY            → samma id två gånger blir EN rad.
 *   · unikt `dedup_key` bland icke-terminala rader → dubbelklick blir ETT kommando.
 * Kön är ett PROVDUBBEL. Den enda kö som finns i produkten är blockedCommandQueue().
 */
function memoryQueue(): CommandQueue & { rows: () => CommandRecord[]; calls: () => number } {
  const rows = new Map<string, CommandRecord>();
  let calls = 0;
  return {
    enqueue: async (record) => {
      calls += 1;
      if (rows.has(record.command_id)) return { ok: true, outcome: "duplicate_command_id" };
      for (const existing of rows.values()) {
        if (existing.dedup_key === record.dedup_key && existing.status === "pending") {
          return { ok: true, outcome: "duplicate_dedup_key" };
        }
      }
      rows.set(record.command_id, record);
      return { ok: true, outcome: "queued" };
    },
    rows: () => [...rows.values()],
    calls: () => calls,
  };
}

const T0 = new Date("2026-08-14T10:00:00.000Z");

/** Klocka som levererar en bestämd sekvens. Sista värdet upprepas. */
function clock(...stamps: Date[]): () => Date {
  let index = 0;
  return () => {
    const stamp = stamps[Math.min(index, stamps.length - 1)];
    index += 1;
    return stamp;
  };
}

const ORIGIN = "https://kontrollrummet.test";
const HOST = "kontrollrummet.test";

type RequestOptions = {
  origin?: string | null;
  host?: string | null;
  secFetchSite?: string | null;
  contentType?: string | null;
  method?: string;
  body?: string;
};

function commandRequest(body: unknown, options: RequestOptions = {}): Request {
  const headers = new Headers();
  const origin = options.origin === undefined ? ORIGIN : options.origin;
  const host = options.host === undefined ? HOST : options.host;
  const contentType =
    options.contentType === undefined ? "application/json" : options.contentType;
  if (origin !== null) headers.set("origin", origin);
  // `Host` sätts av värden och kan inte sättas på en Request i alla runtimes — planens
  // grind läser därför x-forwarded-host först, precis som bakom Railways proxy.
  if (host !== null) headers.set("x-forwarded-host", host);
  if (options.secFetchSite != null) headers.set("sec-fetch-site", options.secFetchSite);
  if (contentType !== null) headers.set("content-type", contentType);

  return new Request(`${ORIGIN}${COMMAND_ENDPOINT}`, {
    method: options.method ?? "POST",
    headers,
    body: options.body ?? JSON.stringify(body),
  });
}

let idCounter = 0;
function uuid(): string {
  idCounter += 1;
  const tail = idCounter.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${tail}`;
}

function intent(command: Command, watermark: number | null = null): CommandIntent {
  return { command, expected_watermark: watermark };
}

/** En gateway med provdubblar. Allt injiceras — inget prov rör en socket eller en klocka. */
function gatewayWith(
  overrides: Partial<CommandGateway> = {},
): CommandGateway & { queue: ReturnType<typeof memoryQueue> } {
  const queue = overrides.queue ? (overrides.queue as ReturnType<typeof memoryQueue>) : memoryQueue();
  return {
    ...createCommandGateway({ now: clock(T0), ...overrides, queue }),
    queue,
  } as CommandGateway & { queue: ReturnType<typeof memoryQueue> };
}

async function post(
  body: unknown,
  gateway: CommandGateway,
  options: RequestOptions = {},
): Promise<CommandResponse> {
  return handleCommandRequest(commandRequest(body, options), {
    issued_by: "operator@example.test",
    gateway,
  });
}

function bodyFor(command: Command, watermark: number | null = null, id: string = uuid()): unknown {
  return commandRequestBody(intent(command, watermark), id);
}

/* ── Källkodsskanning ─────────────────────────────────────────────────────── */

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

const LOOP_SERVER_FILES = [
  ...filesUnder("lib/loop", [".ts"]),
  ...filesUnder("app/api/loop", [".ts"]),
];

const COMMAND_COMPONENTS = [
  "components/loop/CommandButton.tsx",
  "components/loop/CommandDeck.tsx",
  "components/loop/CommandLog.tsx",
].map((relative) => path.join(REPO, relative));

const COMMAND_ROUTE = path.join(REPO, "app/api/loop/command/route.ts");

/** Kommandovägen: kontraktet, routen och de tre komponenterna. Inget annat rör ett kommando. */
const COMMAND_PATH_FILES = [
  path.join(REPO, "lib/loop/commands.ts"),
  COMMAND_ROUTE,
  ...COMMAND_COMPONENTS,
];

function source(file: string): string {
  return readFileSync(file, "utf8");
}

/**
 * Kod utan kommentarer. De statiska kontrollerna ska mäta vad koden GÖR, inte vilka förbud
 * filhuvudena skriver ut i klartext — en fil som förbjuder promotion-skrivning med ordet
 * "promotion" får inte fällas av sitt eget förbud.
 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function code(file: string): string {
  return stripComments(source(file));
}

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 1 · EXAKT FEM VERB — ETT SJÄTTE GER 400 UTAN SIDOEFFEKT
 * ════════════════════════════════════════════════════════════════════════════ */

test("V7 exit 1 · alla fem verben accepteras av ytan — varken fler eller färre", async () => {
  assert.equal(COMMAND_VERBS.length, 5);
  assert.equal(COMMAND_RULES.VERB_COUNT, 5);

  const gateway = gatewayWith();
  const seen: CommandVerb[] = [];
  for (const command of fixtureCommands()) {
    const response = await post(bodyFor(command), gateway);
    assert.equal(response.status, 200, `verbet ${command.verb} avvisades av ytan`);
    assert.equal(response.body.ok, true);
    if (response.body.ok) seen.push(response.body.command.verb);
  }
  assert.deepEqual([...seen].sort(), [...COMMAND_VERBS].sort());
  assert.equal(gateway.queue.rows().length, 5);
});

test("V7 exit 1 · ett sjätte verb ger 400 och lämnar INGET spår", async () => {
  const ledger = createCommandLedger();
  const limiter = createRateLimiter();
  const gateway = gatewayWith({ ledger, limiter });

  const forbidden = [
    { verb: "run.force_merge", payload: { run_id: "run-fixture-a" } },
    { verb: "shell", payload: { command: "rm -rf /" } },
    { verb: "attestation.write", payload: { task_id: "p-200" } },
    { verb: "promotion.execute", payload: { run_id: "run-fixture-a" } },
    { verb: "lease.steal", payload: { run_id: "run-fixture-a" } },
  ];

  for (const command of forbidden) {
    const response = await post(
      { command_id: uuid(), expected_watermark: null, command },
      gateway,
    );
    assert.equal(response.status, 400, `${command.verb} gav inte 400`);
    assert.equal(response.body.ok, false);
    if (!response.body.ok) assert.equal(response.body.reason, "invalid-command");
  }

  // NOLL SIDOEFFEKT: ingen kö rörd, ingen ledgerrad, ingen förbrukad kvot.
  assert.equal(gateway.queue.calls(), 0, "ett okänt verb nådde kön");
  assert.equal(ledger.size(), 0, "ett okänt verb lämnade en ledgerrad");
  assert.equal(limiter.check("operator@example.test", T0).allowed, true, "kvoten förbrukades");

  // LÖGNSTUB: en "verb är en sträng"-grind hade släppt igenom precis dessa fem.
  for (const command of forbidden) {
    assert.equal(typeof command.verb === "string", true);
    assert.equal(
      validateCommandRequest({ command_id: uuid(), expected_watermark: null, command }).ok,
      false,
      "schemat släppte igenom ett sjätte verb",
    );
  }
});

test("V7 exit 1 · payload valideras MOT verbet, och ett extrafält fälls", async () => {
  const gateway = gatewayWith();
  const bad: unknown[] = [
    { command_id: uuid(), expected_watermark: null, command: { verb: "run.start", payload: { run_id: "r" } } },
    {
      command_id: uuid(),
      expected_watermark: null,
      command: { verb: "run.start", payload: { config_ref: "c", shell: "rm -rf /" } },
    },
    { command_id: "inte-en-uuid", expected_watermark: null, command: { verb: "inspect", payload: { task_id: "p-200" } } },
    // issued_at får ALDRIG komma ur klienten — fältet finns inte i kontraktet.
    {
      command_id: uuid(),
      expected_watermark: null,
      issued_at: "2000-01-01T00:00:00.000Z",
      command: { verb: "inspect", payload: { task_id: "p-200" } },
    },
    // status ägs av controllern och kan inte påstås av en klient.
    {
      command_id: uuid(),
      expected_watermark: null,
      command: { verb: "inspect", payload: { task_id: "p-200" } },
      status: "applied",
    },
  ];

  for (const candidate of bad) {
    const response = await post(candidate, gateway);
    assert.equal(response.status, 400, `${JSON.stringify(candidate)} gav inte 400`);
  }
  assert.equal(gateway.queue.calls(), 0);
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 2 · EN PAYLOAD ÄR DATA — ALDRIG ETT UTTRYCK
 * ════════════════════════════════════════════════════════════════════════════ */

test("V7 exit 2 · en payload som BÄR en shell-sträng skapar ingen kanariefil", async () => {
  const canary = path.join(os.tmpdir(), `v7-kanarie-${process.pid}-${Date.now()}`);
  assert.equal(existsSync(canary), false, "kanariefilen fanns redan — provet mäter ingenting");

  const shellish = [
    `$(touch ${canary})`,
    `\`touch ${canary}\``,
    `; touch ${canary}`,
    `&& touch ${canary}`,
    `../../${canary}`,
  ];

  const gateway = gatewayWith();
  for (const value of shellish) {
    const response = await post(
      bodyFor({ verb: "run.start", payload: { config_ref: value } }),
      gateway,
    );
    assert.equal(response.body.ok, true, "en sträng med shell-tecken avvisades som om den vore kod");
  }

  assert.equal(existsSync(canary), false, "payloaden tolkades — kanariefilen skapades");

  // Strängen bevaras BYTE-IDENTISKT och dedup_key är ren sammanfogning, ingen expansion.
  const rows = gateway.queue.rows();
  assert.equal(rows.length, shellish.length);
  for (const [index, row] of rows.entries()) {
    assert.equal((row.payload as { config_ref: string }).config_ref, shellish[index]);
    assert.equal(row.dedup_key, `run.start:${shellish[index]}`);
  }
});

test("V7 exit 2 · ingen exekverande yta finns i kommandovägen — statiskt", () => {
  /** Exekvering: ingen kodväg i hela Maskinens serveryta får kunna köra en sträng. */
  const executors = [
    /\beval\s*\(/,
    /new\s+Function\s*\(/,
    /\bexecSync\b/,
    /\bexecFile\b/,
    /\bspawn\b/,
    /child_process/,
    /\bsimple-git\b/,
  ];
  /**
   * Godtycklig filredigering: mäts på KOMMANDOVÄGEN. Fixturgeneratorn skriver med flit sina
   * egna genererade fixturer (V1) — det är ett byggverktyg, inte en kommandoväg, och ett prov
   * som fällde den hade fixats med ett filundantag i stället för med precision.
   */
  const fileWriters = [/\bwriteFile(Sync)?\s*\(/, /\bunlink(Sync)?\s*\(/, /\brm(Sync)?\s*\(/, /\bmkdir(Sync)?\s*\(/];

  const scanned = [...LOOP_SERVER_FILES, ...COMMAND_COMPONENTS];
  assert.ok(scanned.length > 0, "hittade inga filer att mäta");

  for (const file of scanned) {
    const text = code(file);
    const relative = path.relative(REPO, file);
    for (const pattern of executors) {
      assert.ok(!pattern.test(text), `${relative} bär en exekverande yta (${pattern})`);
    }
  }

  for (const file of COMMAND_PATH_FILES) {
    const text = code(file);
    const relative = path.relative(REPO, file);
    for (const pattern of fileWriters) {
      assert.ok(!pattern.test(text), `${relative} redigerar filer (${pattern})`);
    }
  }

  // LÖGNSTUBBAR: detektorerna måste fälla exakt de genvägar de finns för att fånga.
  assert.ok(
    executors.some((pattern) => pattern.test('const run = (payload) => eval(payload.config_ref);')),
    "detektorn fäller inte en eval",
  );
  assert.ok(
    fileWriters.some((pattern) => pattern.test('writeFileSync(payload.path, payload.body);')),
    "detektorn fäller inte en filskrivning",
  );
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 3 · 401 UTAN SESSION, 403 VID FEL ORIGIN
 * ════════════════════════════════════════════════════════════════════════════ */

test("V7 exit 3 · routen gatar med auth() FÖRE varje överlämning, och svarar 401", () => {
  const text = source(COMMAND_ROUTE);

  assert.ok(/from\s+"@\/auth"/.test(text), "routen importerar inte auth");
  const authIndex = text.indexOf("await auth()");
  assert.ok(authIndex > 0, "routen anropar inte await auth()");
  assert.ok(text.includes("status: 401"), "routen saknar 401-vägen");
  assert.ok(text.includes("isLoopEnabled()") && text.includes("status: 404"), "flaggan gatar inte");

  const handleIndex = text.indexOf("handleCommandRequest(request");
  assert.ok(handleIndex > authIndex, "routen behandlar kommandot före auth()");
  const readIndex = text.indexOf("loadSnapshot(");
  assert.ok(readIndex > authIndex, "routen läser kontrollplanet före auth()");

  // 401-kroppen avslöjar ingenting om kontrollplanet.
  assert.equal(COMMAND_UNAUTHORIZED_ENVELOPE.ok, false);
  assert.ok(!/supabase|loop_commands|loop_events|run_id/i.test(COMMAND_UNAUTHORIZED_ENVELOPE.message));
  assert.equal(COMMAND_HEADERS["Cache-Control"], "no-store");
});

test("V7 exit 3 · fel origin ger 403 och når aldrig kön", async () => {
  const gateway = gatewayWith();
  const command: Command = { verb: "run.resume", payload: { run_id: "run-fixture-a" } };

  const refused: RequestOptions[] = [
    { origin: "https://angriparen.example" },
    { origin: null },
    { host: null },
    { secFetchSite: "cross-site" },
    { secFetchSite: "none" },
    { origin: "inte-en-adress" },
  ];

  for (const options of refused) {
    const response = await post(bodyFor(command), gateway, options);
    assert.equal(response.status, 403, `${JSON.stringify(options)} gav inte 403`);
    assert.equal(response.body.ok, false);
    if (!response.body.ok) assert.equal(response.body.reason, "wrong-origin");
  }
  assert.equal(gateway.queue.calls(), 0, "en cross-site-förfrågan nådde kön");

  // Same-origin släpps igenom — annars hade grinden bara varit ett generellt avslag.
  const ok = await post(bodyFor(command), gateway, { secFetchSite: "same-origin" });
  assert.equal(ok.status, 200);

  // LÖGNSTUB: en grind som bara läser Origin när den FINNS hade släppt igenom en förfrågan
  // helt utan Origin. Verdikten mäts direkt på huvudena.
  const headerless = new Headers();
  assert.equal(sameOriginVerdict(headerless).ok, false, "en förfrågan utan origin släpptes igenom");
});

test("V7 exit 3 · endast POST med JSON — ingen form-post-väg in", async () => {
  const gateway = gatewayWith();
  const command: Command = { verb: "run.resume", payload: { run_id: "run-fixture-a" } };

  for (const contentType of [
    "application/x-www-form-urlencoded",
    "multipart/form-data; boundary=x",
    "text/plain;charset=UTF-8",
    null,
  ]) {
    const response = await post(bodyFor(command), gateway, { contentType });
    assert.equal(response.status, 415, `medietypen ${String(contentType)} gav inte 415`);
  }

  for (const method of ["GET", "PUT", "PATCH", "DELETE"]) {
    const response = await handleCommandRequest(
      new Request(`${ORIGIN}${COMMAND_ENDPOINT}`, {
        method,
        headers: { origin: ORIGIN, "x-forwarded-host": HOST, "content-type": "application/json" },
      }),
      { issued_by: "operator@example.test", gateway },
    );
    assert.equal(response.status, 405, `${method} gav inte 405`);
  }

  assert.equal(gateway.queue.calls(), 0);
  assert.equal(jsonMediaTypeVerdict(new Headers({ "content-type": "application/json; charset=utf-8" })).ok, true);
});

test("V7 · en orimligt stor kropp avvisas innan den tolkas", async () => {
  const gateway = gatewayWith();
  const huge = JSON.stringify(
    commandRequestBody(
      intent({ verb: "run.start", payload: { config_ref: "x".repeat(COMMAND_MAX_BODY_BYTES) } }),
      uuid(),
    ),
  );
  const response = await post(null, gateway, { body: huge });
  assert.equal(response.status, 413);
  assert.equal(gateway.queue.calls(), 0);
});

test("V7 · rate limit per session — och ett avslag förbrukar ingen kvot", async () => {
  const limiter = createRateLimiter({ max_per_window: 3, window_ms: 60_000 });
  const gateway = gatewayWith({ limiter });

  for (let index = 0; index < 3; index += 1) {
    const response = await post(
      bodyFor({ verb: "inspect", payload: { task_id: `p-${index}` } }),
      gateway,
    );
    assert.equal(response.status, 200);
  }

  const throttled = await post(bodyFor({ verb: "inspect", payload: { task_id: "p-x" } }), gateway);
  assert.equal(throttled.status, 429);
  assert.equal(gateway.queue.calls(), 3, "det strypta kommandot nådde kön");

  assert.equal(COMMAND_RATE_LIMIT.max_per_window > 0, true);
  assert.equal(COMMAND_RATE_LIMIT.window_ms > 0, true);
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 4 · SAMMA command_id TVÅ GÅNGER GER EN RAD
 * ════════════════════════════════════════════════════════════════════════════ */

test("V7 exit 4 · samma command_id två gånger ger EN rad och ETT köanrop", async () => {
  const gateway = gatewayWith();
  const id = uuid();
  const body = bodyFor({ verb: "run.start", payload: { config_ref: "config-fixture-0001" } }, null, id);

  const first = await post(body, gateway);
  const second = await post(body, gateway);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.body.ok && first.body.result, "queued");
  assert.equal(second.body.ok && second.body.result, "already_queued");
  assert.equal(gateway.queue.rows().length, 1, "replay gav två rader");
  assert.equal(gateway.queue.calls(), 1, "replay nådde kön en andra gång");

  // Svaret på replayen är den FÖRSTA radens — ingen ny stämpel, ingen ny TTL.
  if (first.body.ok && second.body.ok) {
    assert.deepEqual(second.body.command, first.body.command);
  }
});

test("V7 exit 4 · dubbelklick ger ETT kommando även med två olika id", async () => {
  const gateway = gatewayWith();
  const command: Command = { verb: "run.pause_at_safe_boundary", payload: { run_id: "run-fixture-a" } };

  const first = await post(bodyFor(command), gateway);
  const second = await post(bodyFor(command), gateway);

  assert.equal(first.status, 200);
  assert.equal(second.status, 409, "andra klicket köades som ett eget kommando");
  assert.equal(second.body.ok, false);
  if (!second.body.ok) {
    assert.equal(second.body.reason, "duplicate-dedup-key");
    assert.match(second.body.message, /redan köat/);
  }
  assert.equal(gateway.queue.rows().length, 1);

  // LÖGNSTUB: utan dedup_key hade de två klicken varit två olika rader.
  assert.equal(dedupKey(command), "run.pause_at_safe_boundary:run-fixture-a");
  assert.notEqual(gateway.queue.rows()[0].command_id, "");
});

test("V7 exit 4 · köns PRIMARY KEY är sista ordet — även utan ledger blir det EN rad", async () => {
  // Ledgern är djupförsvar, inte auktoritet. Nollställs den (omstart, ny instans) ska köns
  // egen unika nyckel fortfarande ge ett kommando, inte två.
  const queue = memoryQueue();
  const id = uuid();
  const body = bodyFor({ verb: "run.resume", payload: { run_id: "run-fixture-a" } }, null, id);

  const first = await post(body, gatewayWith({ queue }));
  const second = await post(body, gatewayWith({ queue }));

  assert.equal(first.body.ok && first.body.result, "queued");
  assert.equal(second.body.ok && second.body.result, "already_queued");
  assert.equal(queue.rows().length, 1, "en ny instans skapade en andra rad");
  assert.equal(queue.calls(), 2, "provet mätte inte den andra vägen till kön");
});

test("V7 exit 4 · KLIENTEN: två klick ger ETT anrop och ETT command_id", async () => {
  const sent: { id: string; verb: string }[] = [];
  const gateway = gatewayWith();
  // En grind som håller det första anropet öppet, så att det andra klicket sker MITT I det
  // första — precis som ett dubbelklick.
  let open: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    open = resolve;
  });

  const send = async (_input: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { command_id: string; command: { verb: string } };
    sent.push({ id: body.command_id, verb: body.command.verb });
    if (sent.length === 1) await held;
    const response = await post(body, gateway);
    return response.body;
  };

  let ids = 0;
  const dispatcher = createIntentDispatcher({
    send,
    newCommandId: () => {
      ids += 1;
      return `00000000-0000-4000-8000-0000000000${ids.toString().padStart(2, "0")}`;
    },
  });

  const pause = intent({ verb: "run.pause_at_safe_boundary", payload: { run_id: "run-fixture-a" } });
  const first = dispatcher.dispatch(pause);
  const second = await dispatcher.dispatch(pause); // klick nummer två, mitt i anropet
  assert.equal(second, null, "det andra klicket blev ett eget anrop");
  assert.equal(sent.length, 1, "två klick gav två anrop");

  open();
  const entry = await first;
  assert.notEqual(entry, null);
  assert.equal(sent.length, 1);
  assert.equal(ids, 1, "två klick genererade två command_id");
  assert.equal(gateway.queue.rows().length, 1, "två klick gav två rader i kön");

  // Ett KÖAT kommando släpper id:t — ett senare, avsiktligt klick är en NY intention, och
  // servern avvisar den ändå så länge den förra ligger kvar i kön.
  assert.equal(dispatcher.commandId(), null);
  const again = await dispatcher.dispatch(pause);
  assert.notEqual(again, null);
  assert.equal(again?.reason, "duplicate-dedup-key");
  assert.equal(ids, 2);
  assert.equal(gateway.queue.rows().length, 1, "det andra klicket köades ändå");
});

test("V7 exit 4 · KLIENTEN: ett avslag byter aldrig id — en retry är samma kommando", async () => {
  const sent: string[] = [];
  let fail = true;
  const dispatcher = createIntentDispatcher({
    send: async (_input, init) => {
      sent.push((JSON.parse(String(init.body)) as { command_id: string }).command_id);
      if (fail) throw new Error("nätet svarade inte");
      return {
        ok: true,
        result: "queued",
        command: {
          command_id: sent[sent.length - 1],
          verb: "run.resume",
          dedup_key: "run.resume:run-fixture-a",
          issued_at: T0.toISOString(),
          expires_at: new Date(T0.getTime() + COMMAND_TTL_MS).toISOString(),
          expected_watermark: null,
          status: "pending",
        },
      };
    },
    newCommandId: uuid,
  });

  const resume = intent({ verb: "run.resume", payload: { run_id: "run-fixture-a" } });
  const refused = await dispatcher.dispatch(resume);
  assert.equal(refused?.reason, "unexpected", "ett nätfel blev inte en ärlig rad");
  assert.match(String(refused?.message), /vet inte om det nådde fram/);
  assert.notEqual(dispatcher.commandId(), null, "avslaget släppte id:t och gjorde retryn till ett andra kommando");

  fail = false;
  const retried = await dispatcher.dispatch(resume);
  assert.equal(retried?.reason, null);
  assert.equal(sent.length, 2);
  assert.equal(sent[0], sent[1], "retryn skickades som ett ANNAT kommando");
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 5 · UTGÅNGET ELLER STALE AVVISAS MED ORSAK — OCH VISAS SOM AVVISAT
 * ════════════════════════════════════════════════════════════════════════════ */

test("V7 exit 5 · ett föråldrat antagande om läget avvisas med orsak", async () => {
  const gateway = gatewayWith({ observedWatermark: async () => 512 });
  const response = await post(
    bodyFor({ verb: "run.resume", payload: { run_id: "run-fixture-a" } }, 412),
    gateway,
  );

  assert.equal(response.status, 409);
  assert.equal(response.body.ok, false);
  if (!response.body.ok) {
    assert.equal(response.body.reason, "stale-watermark");
    assert.match(response.body.message, /läget hade ändrats/);
  }
  assert.equal(gateway.queue.calls(), 0, "ett stale kommando nådde kön");

  // Kontrollen kan bara REFUSERA: lika eller nyare vattenmärke släpps igenom, och ett OKÄNT
  // vattenmärke friar aldrig — det lämnar bara domen till controllern.
  assert.equal(commandIsStale(412, 512), true);
  assert.equal(commandIsStale(512, 512), false);
  assert.equal(commandIsStale(600, 512), false);
  assert.equal(commandIsStale(412, null), false);
  assert.equal(commandIsStale(null, 512), false);
});

test("V7 exit 5 · ett kommando som hinner gå ut köas aldrig", async () => {
  const late = new Date(T0.getTime() + COMMAND_TTL_MS + 1);
  const gateway = gatewayWith({
    // Första klockslaget stämplar raden, det andra läses efter vattenmärkesläsningen.
    now: clock(T0, late),
    observedWatermark: async () => 1,
  });

  const response = await post(
    bodyFor({ verb: "run.resume", payload: { run_id: "run-fixture-a" } }, 1),
    gateway,
  );

  assert.equal(response.status, 409);
  assert.equal(response.body.ok, false);
  if (!response.body.ok) assert.equal(response.body.reason, "expired");
  assert.equal(gateway.queue.calls(), 0, "en utgången intention nådde kön");

  const built = buildCommandRecord({
    command: { verb: "run.resume", payload: { run_id: "run-fixture-a" } },
    command_id: uuid(),
    issued_by: "operator@example.test",
    issued_at: T0,
    expected_watermark: null,
  });
  assert.equal(built.ok, true);
  if (built.ok) {
    assert.equal(commandExpired(built.record, new Date(T0.getTime() + COMMAND_TTL_MS - 1)), false);
    assert.equal(commandExpired(built.record, late), true);
    assert.equal(Date.parse(built.record.expires_at) - Date.parse(built.record.issued_at), COMMAND_TTL_MS);
  }
});

test("V7 exit 5 · ett avvisat kommando VISAS som avvisat, med orsaken ordagrant", () => {
  const message = "Avvisad: läget hade ändrats sedan kommandot skickades.";
  const envelope: CommandEnvelope = {
    ok: false,
    reason: "stale-watermark",
    message,
    command_id: "00000000-0000-4000-8000-00000000abcd",
  };
  const entry = commandLogEntry("run.resume", "00000000-0000-4000-8000-00000000abcd", envelope);
  const presentation = commandLogPresentation(entry, T0);

  assert.equal(presentation.label, "avvisad");
  assert.equal(presentation.tone, "danger");
  assert.equal(presentation.verbatim, message, "orsaken skrevs om");

  const html = renderToStaticMarkup(createElement(CommandLog, { entries: [entry], now: T0 }));
  assert.ok(html.includes(message), "avslaget visas inte ordagrant");
  assert.ok(html.includes('data-command-verbatim="true"'));
  assert.ok(html.includes(entry.command_id), "command_id visas inte vid avslaget");

  // En KÖAD rad vars TTL passerat visas som utgången — aldrig som utförd.
  const queued = commandLogEntry("run.start", "x", {
    ok: true,
    result: "queued",
    command: {
      command_id: "00000000-0000-4000-8000-00000000ffff",
      verb: "run.start",
      dedup_key: "run.start:config-a",
      issued_at: T0.toISOString(),
      expires_at: new Date(T0.getTime() + COMMAND_TTL_MS).toISOString(),
      expected_watermark: null,
      status: "pending",
    },
  });
  assert.equal(commandLogPresentation(queued, T0).label, "köad");
  assert.equal(
    commandLogPresentation(queued, new Date(T0.getTime() + COMMAND_TTL_MS + 1)).label,
    "utgången",
  );

  // LÖGNSTUB: en logg som läste status rakt av hade sagt "köad" i all evighet.
  assert.equal(COMMAND_STATUS_PRESENTATION.pending.label, "köad");
  assert.equal(commandStatusCoverage(), true);
  assert.deepEqual([...COMMAND_STATUSES], ["pending", "claimed", "applied", "rejected", "expired"]);
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 6 · PAUSEN PRESENTERAS SOM "EFTER AKTUELL UPPGIFT"
 * ════════════════════════════════════════════════════════════════════════════ */

test("V7 exit 6 · run.pause_at_safe_boundary säger 'efter aktuell uppgift' och lovar aldrig stopp nu", () => {
  assert.equal(COMMAND_VERB_LABELS["run.pause_at_safe_boundary"], PAUSE_AT_SAFE_BOUNDARY_LABEL);
  assert.equal(PAUSE_AT_SAFE_BOUNDARY_LABEL, "Pausa efter aktuell uppgift");
  assert.equal(
    COMMAND_VERB_EXPLANATIONS["run.pause_at_safe_boundary"],
    PAUSE_AT_SAFE_BOUNDARY_EXPLANATION,
  );

  const html = renderToStaticMarkup(
    createElement(CommandButton, {
      intent: intent({ verb: "run.pause_at_safe_boundary", payload: { run_id: "run-fixture-a" } }),
    }),
  );

  assert.ok(html.includes(PAUSE_AT_SAFE_BOUNDARY_LABEL), "knappen bär inte planens formulering");
  assert.ok(html.includes(PAUSE_AT_SAFE_BOUNDARY_EXPLANATION), "förklaringen följer inte med knappen");
  assert.ok(
    !/omedelbar|stoppa nu|tvinga|\bkill\b|\bstoppa mitt i\b/i.test(html),
    "pausknappen lovade ett omedelbart stopp",
  );
  /**
   * "Avbryt" får förekomma på EXAKT ett sätt: i planens egen mening om att ingenting avbryts
   * mitt i. Räkningen mäter det — ett tillagt "Avbryt körningen" hade fällt provet, medan
   * ett förbud mot ordstammen hade fällt själva löftet den finns för att bevaka.
   */
  const occurrences = (text: string) => text.toLowerCase().split("avbry").length - 1;
  assert.equal(
    occurrences(html),
    occurrences(PAUSE_AT_SAFE_BOUNDARY_EXPLANATION),
    "knappen bär ett avbrott utanför planens mening om att ingenting avbryts mitt i",
  );

  // Alla fem verben har en etikett, och ingen etikett påstår något verbet inte gör.
  for (const verb of COMMAND_VERBS) {
    assert.equal(typeof COMMAND_VERB_LABELS[verb], "string");
    assert.ok(COMMAND_VERB_LABELS[verb].length > 0, `${verb} saknar etikett`);
  }
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 7 · INGEN OPTIMISTISK STATE
 * ════════════════════════════════════════════════════════════════════════════ */

test("V7 exit 7 · kommandosvaret bär kommandots öde — aldrig en uppgifts tillstånd", async () => {
  const gateway = gatewayWith();
  const response = await post(bodyFor({ verb: "inspect", payload: { task_id: "p-200" } }), gateway);

  assert.equal(response.body.ok, true);
  if (response.body.ok) {
    assert.deepEqual(Object.keys(response.body.command).sort(), [
      "command_id",
      "dedup_key",
      "expected_watermark",
      "expires_at",
      "issued_at",
      "status",
      "verb",
    ]);
    // Ingen task-state, ingen fas, ingen dom och ingen payload-echo i svaret.
    const serialized = JSON.stringify(response.body);
    for (const forbidden of ["WORKING", "DONE", "phase", "verdict", "task_state", "payload"]) {
      assert.ok(!serialized.includes(forbidden), `svaret bar ${forbidden}`);
    }
  }
  assert.equal(COMMAND_RULES.OPTIMISTIC_TASK_STATE, false);
});

test("V7 exit 7 · kommandoytan renderar ingen uppgiftsstate — den läser bara snapshotens värden", () => {
  const snapshot = fixtureSnapshot();
  assert.ok(snapshot, "V1-fixturen validerade inte");

  const deck = renderToStaticMarkup(
    createElement(CommandDeck, {
      runId: snapshot.run_id,
      watermark: snapshot.seq_watermark,
      currentTaskId: snapshot.current_task?.task_id ?? null,
      now: T0,
    }),
  );

  // Inget kort, ingen lifecycle-märkning, ingen fas — kommandoytan visar bara kommandon.
  for (const marker of ["data-state-badge", "data-may-look-done", "data-phase=", "<article"]) {
    assert.ok(!deck.includes(marker), `kommandoytan renderade ${marker}`);
  }
  assert.ok(deck.includes(snapshot.run_id), "kör-id ur snapshoten saknas");

  // Och skalet: uppgifternas markup är IDENTISK med och utan kommandoytan i vyn.
  const shell = renderToStaticMarkup(createElement(MaskinShell, { snapshot, fixture: true }));
  const cards = shell.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) ?? [];
  assert.ok(cards.length > 0, "skalet renderade inga kort");
  for (const card of cards) {
    assert.ok(!card.includes("data-command"), "ett kommando trängde in i ett uppgiftskort");
  }

  // Statiskt: kommandokomponenterna importerar ingen lifecycle-presentation och sätter
  // ingen task-state. Ett klick kan därför inte flytta ett kort.
  for (const file of COMMAND_COMPONENTS) {
    const text = code(file);
    const relative = path.relative(REPO, file);
    for (const pattern of [
      /TASK_LIFECYCLE/,
      /TASK_LIFECYCLE_PRESENTATION/,
      /setTask\w*\(/,
      /\bstate:\s*["'](WORKING|DONE|QUEUED|MERGING|STOPPED)["']/,
    ]) {
      assert.ok(!pattern.test(text), `${relative} rör task state (${pattern})`);
    }
  }
});

test("V7-NEG · UI:t säger aldrig 'startad' innan controllern svarat", () => {
  const html = renderToStaticMarkup(
    createElement(CommandButton, {
      intent: intent({ verb: "run.start", payload: { config_ref: "config-fixture-0001" } }),
    }),
  );
  assert.ok(!/\bstartad\b|\bkörning pågår\b|\bigång\b/i.test(html), "knappen påstod att något startat");

  // Ett KÖAT kommando beskrivs som köat — och kopplas uttryckligen till snapshoten.
  const queued = commandLogEntry("run.start", "id", {
    ok: true,
    result: "queued",
    command: {
      command_id: "00000000-0000-4000-8000-0000000000a1",
      verb: "run.start",
      dedup_key: "run.start:config-a",
      issued_at: T0.toISOString(),
      expires_at: new Date(T0.getTime() + COMMAND_TTL_MS).toISOString(),
      expected_watermark: 412,
      status: "pending",
    },
  });
  const log = renderToStaticMarkup(createElement(CommandLog, { entries: [queued], now: T0 }));
  assert.ok(log.includes("köad"));
  assert.ok(!/\butförd\b|\bstartad\b/i.test(log), "en köad rad såg utförd ut");
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 8 · NOLL KODVÄGAR MOT LEASE, BREAKER, GIT-REFS, VERDICT, ATTESTATION, PROMOTION
 * ════════════════════════════════════════════════════════════════════════════ */

/**
 * Detektorerna mäter KODVÄGAR, aldrig ord. Snapshotens LÄSTA projektionsfält heter med flit
 * `breaker`, `attestation` och `promotion` (V1:s kontrakt) — ett prov som fällde substantivet
 * hade bara lärt oss att döpa om fälten. Det som fälls är att GÖRA något: mutera, besluta,
 * skriva eller lösa upp.
 */
const FORBIDDEN_CODE_PATHS: { name: string; pattern: RegExp; lie: string }[] = [
  {
    name: "lease/fencing",
    pattern: /\blease\b|fencing[_-]?token|\bfence_token\b|\bheartbeat\s*\(/i,
    lie: 'await renewLease({ lease: token });',
  },
  {
    name: "breaker-manipulation",
    pattern: /\b(open|close|trip|reset|arm|disarm)[A-Za-z]*Breaker\b|breaker\s*=|breaker\.(open|close|trip|reset)\s*\(/i,
    lie: 'await openBreaker(runId);',
  },
  {
    name: "git-ref",
    pattern: /refs\/(heads|tags)|git\/refs|\b(getRef|updateRef|createRef|deleteRef)\s*\(|rev-parse|\bgit\s+(push|merge|reset|rebase|commit)\b/i,
    lie: 'await octokit.git.updateRef({ ref: "refs/heads/main" });',
  },
  {
    name: "verdict-skrivning",
    pattern: /\b(set|compute|decide|assign|write)[A-Za-z]*Verdict\b|\b(verdict|policy|verification)\s*[:=]\s*["'](PASS|FAIL)["']/i,
    lie: 'const verdict = "PASS";\ntask.verdict = "PASS";',
  },
  {
    name: "attestation-skrivning",
    pattern: /\b(write|create|sign|issue|store|emit)[A-Za-z]*Attestation\b|attestation\s*=[^=]/i,
    lie: 'await writeAttestation(candidate);',
  },
  {
    name: "promotion-utförande",
    pattern: /\bpromote[A-Za-z]*\s*\(|\b(start|complete|perform|execute|force)[A-Za-z]*Promotion\b|promotion\s*=[^=]/i,
    lie: 'await promoteCandidate(sha);',
  },
  {
    name: "force-merge",
    pattern: /force[_-]?merge|\bmergeAnyway\b|\bforceMerge\b/i,
    lie: 'await forceMerge(pr);',
  },
];

test("V7 exit 8 · noll kodvägar mot lease, breaker, Git-refs, verdict, attestation eller promotion", () => {
  const scanned = [...LOOP_SERVER_FILES, ...COMMAND_COMPONENTS];
  assert.ok(scanned.length >= 10, "hittade inte Maskinens serveryta — kontrollen mäter inget");

  for (const file of scanned) {
    const text = code(file);
    const relative = path.relative(REPO, file);
    for (const detector of FORBIDDEN_CODE_PATHS) {
      assert.ok(
        !detector.pattern.test(text),
        `${relative} bär en kodväg mot ${detector.name}`,
      );
    }
  }

  // LÖGNSTUBBAR: varje detektor måste fälla exakt den genväg den finns för att fånga.
  for (const detector of FORBIDDEN_CODE_PATHS) {
    assert.ok(
      detector.pattern.test(detector.lie),
      `detektorn för ${detector.name} fäller inte sin egen lögnstub`,
    );
  }

  // …och den får INTE fälla V1:s LÄSTA projektionsfält, annars hade provet fixats med undantag.
  const readOnlyProjection = [
    'attestation: z.strictObject({ exists: z.boolean() }).nullable(),',
    'promotion: z.strictObject({ state: opaqueState.nullable() }).nullable(),',
    'breaker: opaqueMap.nullable(),',
    'const verdicts = ["PASS", "FAIL", "NOT_RUN", "UNKNOWN"];',
  ].join("\n");
  for (const detector of FORBIDDEN_CODE_PATHS) {
    assert.ok(
      !detector.pattern.test(readOnlyProjection),
      `detektorn för ${detector.name} fäller ett LÄST projektionsfält`,
    );
  }

  assert.equal(COMMAND_RULES.TOUCHES_LEASE, false);
  assert.equal(COMMAND_RULES.TOUCHES_BREAKER, false);
  assert.equal(COMMAND_RULES.TOUCHES_GIT_REFS, false);
  assert.equal(COMMAND_RULES.WRITES_VERDICT, false);
  assert.equal(COMMAND_RULES.WRITES_ATTESTATION, false);
  assert.equal(COMMAND_RULES.WRITES_PROMOTION, false);
});

test("V7 exit 8 · ingen GitHub-credential av något slag i kommandovägen", () => {
  const scanned = [...LOOP_SERVER_FILES, ...COMMAND_COMPONENTS];
  const forbiddenModules = /github-(read|write)|@octokit|child_process|simple-git/;

  for (const file of scanned) {
    const text = source(file);
    const relative = path.relative(REPO, file);
    const imports = [...text.matchAll(/(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)["']([^"']+)["']/g)];
    for (const [, specifier] of imports) {
      assert.ok(!forbiddenModules.test(specifier), `${relative} importerar ${specifier}`);
    }
    for (const needle of ["GITHUB_TOKEN", "GITHUB_APP", "installation token"]) {
      assert.ok(!text.includes(needle), `${relative} nämner ${needle} som en väg`);
    }
    for (const [, name] of text.matchAll(/process\.env\.(\w+)/g)) {
      assert.ok(
        ["LOOP_SUPABASE_URL", "LOOP_SUPABASE_KEY", "LOOP_ENABLED"].includes(name),
        `${relative} läser ${name} — Maskinen bär bara LOOP_*-variabler`,
      );
    }
  }
  assert.equal(COMMAND_RULES.GITHUB_CREDENTIAL, "NONE");
});

test("V7 exit 8 · kommandovägen skriver ingenting någonstans — inte ens i kön", () => {
  // Kön nås genom EN port med EN operation. Det finns ingen implementation i repot som
  // skriver: den enda som finns avvisar med orsak (S13 saknas).
  for (const file of [...LOOP_SERVER_FILES, ...COMMAND_COMPONENTS]) {
    const text = code(file);
    const relative = path.relative(REPO, file);
    assert.ok(
      !/\.from\s*\([^)]*\)[\s\S]{0,400}?\.(insert|update|upsert|delete)\s*\(/.test(text),
      `${relative} skriver i en transporttabell`,
    );
    assert.ok(!/\.rpc\s*\(/.test(text), `${relative} anropar rpc()`);
  }

  /**
   * Och ingen kodväg tar ens ett TABELLHANDTAG. Samma kedjebundna detektor som V4:s, med
   * samma undantag för Array/Object/Buffer/Set/Map — inte för filer.
   */
  for (const file of COMMAND_PATH_FILES) {
    const text = code(file);
    assert.ok(
      !/(?<!\b(?:Array|Object|Buffer|Set|Map))\.from\s*\(/.test(text),
      `${path.relative(REPO, file)} tar ett tabellhandtag`,
    );
  }

  // LÖGNSTUB: detektorn måste fälla en verklig kö-insert.
  const lie = 'await client.from("loop_commands").insert(record);';
  assert.ok(/\.from\s*\([^)]*\)[\s\S]{0,400}?\.(insert|update|upsert|delete)\s*\(/.test(lie));
});

/* ════════════════════════════════════════════════════════════════════════════
 * ÄRLIGHET OM KANALEN — ytan är byggd, mottagaren finns inte
 * ════════════════════════════════════════════════════════════════════════════ */

test("V7 · kommandokanalen är stängd tills S13 finns, och det syns i svaret och i UI:t", async () => {
  assert.equal(COMMAND_QUEUE_TRANSPORT, "NONE");
  assert.equal(commandChannelEnabled(), false);
  assert.equal(COMMAND_QUEUE_BLOCKED_ON, "nortropic-system S13");

  const queue = blockedCommandQueue();
  const built = buildCommandRecord({
    command: { verb: "run.resume", payload: { run_id: "run-fixture-a" } },
    command_id: uuid(),
    issued_by: "operator@example.test",
    issued_at: T0,
    expected_watermark: null,
  });
  assert.equal(built.ok, true);
  if (built.ok) {
    const result = await queue.enqueue(built.record);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.message, COMMAND_QUEUE_DISABLED_REASON);
  }

  // Genom hela ytan: 503 med ordagrann orsak — aldrig 200, aldrig ett tyst "kanske".
  const gateway = createCommandGateway({ now: clock(T0) });
  const response = await post(
    bodyFor({ verb: "run.resume", payload: { run_id: "run-fixture-a" } }),
    gateway,
  );
  assert.equal(response.status, 503);
  assert.equal(response.body.ok, false);
  if (!response.body.ok) {
    assert.equal(response.body.reason, "queue-unavailable");
    assert.equal(response.body.message, COMMAND_QUEUE_DISABLED_REASON);
  }

  // UI:t säger samma sak, och påstår ingenstans att skivan är live.
  const snapshot = fixtureSnapshot();
  assert.ok(snapshot);
  const deck = renderToStaticMarkup(
    createElement(CommandDeck, {
      runId: snapshot.run_id,
      watermark: snapshot.seq_watermark,
      currentTaskId: snapshot.current_task?.task_id ?? null,
      now: T0,
    }),
  );
  assert.ok(deck.includes(COMMAND_QUEUE_DISABLED_REASON), "orsaken saknas i UI:t");
  assert.ok(deck.includes(COMMAND_QUEUE_BLOCKED_ON), "blockeringen på S13 nämns inte");
  assert.ok(deck.includes('data-command-disabled="true"'), "knapparna ser klickbara ut");
  assert.ok(!/live-komplett|live complete|nu live\b/i.test(deck), "UI:t beskrev kanalen som live");
});

test("V7 · en stängd kanal lämnar inget spår — nytt försök är fritt", async () => {
  const ledger = createCommandLedger();
  const limiter = createRateLimiter({ max_per_window: 2, window_ms: 60_000 });
  const gateway = createCommandGateway({ now: clock(T0), ledger, limiter });

  for (let index = 0; index < 5; index += 1) {
    const response = await post(
      bodyFor({ verb: "run.resume", payload: { run_id: "run-fixture-a" } }),
      gateway,
    );
    assert.equal(response.status, 503);
  }
  assert.equal(ledger.size(), 0, "en avvisad överlämning lämnade en ledgerrad");
  assert.equal(limiter.check("operator@example.test", T0).allowed, true, "kvoten förbrukades");
});

/* ════════════════════════════════════════════════════════════════════════════
 * KONTRAKTETS ÖVRIGA MEKANIK
 * ════════════════════════════════════════════════════════════════════════════ */

test("V7 · servern stämplar tiden — klientens klocka finns inte i kontraktet", async () => {
  const gateway = gatewayWith();
  const response = await post(
    bodyFor({ verb: "inspect", payload: { run_id: "run-fixture-a" } }),
    gateway,
  );
  assert.equal(response.body.ok, true);
  if (response.body.ok) {
    assert.equal(response.body.command.issued_at, T0.toISOString());
    assert.equal(
      response.body.command.expires_at,
      new Date(T0.getTime() + COMMAND_TTL_MS).toISOString(),
    );
  }
  assert.equal(COMMAND_RULES.SERVER_STAMPS_TIME, true);
  assert.equal(COMMAND_RULES.CONTROLLER_MAY_ALWAYS_REJECT, true);
});

test("V7 · klientens anrop är same-origin, JSON och utan egen tid eller identitet", () => {
  const init = commandRequestInit(
    intent({ verb: "run.resume", payload: { run_id: "run-fixture-a" } }, 412),
    "00000000-0000-4000-8000-00000000000a",
  );
  assert.equal(init.method, "POST");
  assert.equal(init.credentials, "same-origin");
  assert.equal(init.mode, "same-origin");
  assert.equal(init.cache, "no-store");
  assert.deepEqual(init.headers, { "Content-Type": "application/json" });

  const body = JSON.parse(String(init.body)) as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), ["command", "command_id", "expected_watermark"]);
  assert.equal(body.expected_watermark, 412);

  // Ett icke-JSON-svar (utgången session) blir en ÄRLIG rad, aldrig ett antagande.
  const envelope = readCommandEnvelope(null);
  assert.equal(envelope.ok, false);
  if (!envelope.ok) {
    assert.equal(envelope.reason, "unexpected");
    assert.match(envelope.message, /Sessionen gick ut|ladda om/);
  }
});

test("V7 · statuskoderna skiljer form, läge och stängd kanal åt", () => {
  assert.equal(httpStatusForCommandReason("invalid-command"), 400);
  assert.equal(httpStatusForCommandReason("wrong-origin"), 403);
  assert.equal(httpStatusForCommandReason("method-not-allowed"), 405);
  assert.equal(httpStatusForCommandReason("payload-too-large"), 413);
  assert.equal(httpStatusForCommandReason("unsupported-media-type"), 415);
  assert.equal(httpStatusForCommandReason("rate-limited"), 429);
  assert.equal(httpStatusForCommandReason("stale-watermark"), 409);
  assert.equal(httpStatusForCommandReason("expired"), 409);
  assert.equal(httpStatusForCommandReason("duplicate-dedup-key"), 409);
  assert.equal(httpStatusForCommandReason("queue-unavailable"), 503);
  assert.equal(httpStatusForCommandReason("unexpected"), 500);

  // Ingen av avslagsvägarna får vara 200: ett kommando som inte köades får aldrig kunna
  // misstas för ett som köades.
  for (const reason of [
    "invalid-command",
    "wrong-origin",
    "method-not-allowed",
    "payload-too-large",
    "unsupported-media-type",
    "rate-limited",
    "stale-watermark",
    "expired",
    "duplicate-dedup-key",
    "queue-unavailable",
    "unexpected",
  ] as const) {
    assert.notEqual(httpStatusForCommandReason(reason), 200);
  }
});

test("V7 · en trasig kropp kraschar aldrig ytan", async () => {
  const gateway = gatewayWith();
  for (const body of ["", "{", "null", "[]", '"sträng"', "42"]) {
    const response = await post(null, gateway, { body });
    assert.equal(response.body.ok, false, `kroppen ${body} accepterades`);
    assert.equal(response.status, 400);
  }
  assert.equal(gateway.queue.calls(), 0);
});

test("V7 · ledgern är begränsad och är aldrig en sanning om controllern", () => {
  const ledger = createCommandLedger({ capacity: 3 });
  const record = (id: string, key: string): CommandRecord => {
    const built = buildCommandRecord({
      command: { verb: "inspect", payload: { task_id: key } },
      command_id: id,
      issued_by: "operator@example.test",
      issued_at: T0,
      expected_watermark: null,
    });
    assert.equal(built.ok, true);
    if (!built.ok) throw new Error("provets rad bröt mot V1-kontraktet");
    return built.record;
  };

  for (let index = 0; index < 5; index += 1) {
    ledger.remember({ record: record(uuid(), `p-${index}`), outcome: "queued" });
  }
  assert.equal(ledger.size(), 3, "ledgern växer obegränsat");

  // En utgången rad blockerar inte längre samma naturliga nyckel.
  const stale = record(uuid(), "p-stale");
  ledger.remember({ record: stale, outcome: "queued" });
  assert.notEqual(ledger.pendingByDedupKey(stale.dedup_key, T0), null);
  assert.equal(
    ledger.pendingByDedupKey(stale.dedup_key, new Date(T0.getTime() + COMMAND_TTL_MS + 1)),
    null,
  );
});

test("V7 · de öppna valen är registrerade, inte ärvda av slentrian", () => {
  assert.ok(COMMAND_OPEN_DECISIONS.length >= 3);
  for (const decision of COMMAND_OPEN_DECISIONS) {
    assert.ok(decision.id.length > 0);
    assert.ok(decision.decision.length > 40, `${decision.id} saknar ett faktiskt beslut`);
    assert.ok(decision.rationale.length > 40, `${decision.id} saknar skäl`);
    assert.ok(decision.revisit_in.length > 0);
    assert.ok(decision.depends_on.length > 0);
  }
});

test("V7 · routen exponerar POST och ingenting annat", () => {
  const text = source(COMMAND_ROUTE);
  assert.ok(/export\s+async\s+function\s+POST\b/.test(text), "routen saknar POST");
  for (const method of ["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
    assert.ok(
      !new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`).test(text),
      `routen exporterar ${method}`,
    );
  }
  assert.ok(text.includes('export const dynamic = "force-dynamic"'), "flaggan kan bakas in vid build");
  // LOGGNING: inga payloadvärden i serverloggen — den här vägen loggar över huvud taget inte.
  for (const file of [COMMAND_ROUTE, path.join(REPO, "lib/loop/commands.ts")]) {
    assert.ok(!/console\.(log|info|warn|error|debug)\s*\(/.test(code(file)), "kommandovägen loggar");
  }
});
