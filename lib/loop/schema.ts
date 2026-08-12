/**
 * V1 · Typade backendkontrakt och schemavalidering för Maskinen (kontrollrummet).
 *
 * AUKTORITATIV KÄLLA: docs/nortropic-control-room-plan-v1.md (avsnitten READ_MODEL,
 * EVENT_CLIENT, COMMAND_CLIENT, TASK-LIFECYCLE) samt docs/nortropic-control-room-codex-handoff.md
 * (CODEX_START_HERE: sexton eventfamiljer, fem kommandoverb).
 *
 * BINDANDE REGLER SOM DENNA FIL BÄR MEKANISKT
 * -------------------------------------------
 * · Ordning läses ur `seq` ENSAMT. `ts` används ALDRIG till ordning (B3).
 * · `run_id` grupperar men är ingen ordering authority.
 * · Dedup sker på `event_id`, aldrig på `seq` (dedupen själv byggs i V3, lib/loop/events.ts).
 * · Okänd `event_type` valideras som "okänd", bevaras rå, flyttar ingen state, kastar aldrig.
 * · SNAPSHOT_WINS: auktoritativa fält kommer ur controllerns snapshot, aldrig ur en tail-fold.
 * · Inget fält uppfinns. Saknas backendens kontrakt är fältet OLÖST och renderas "—" (B4/B6).
 *
 * VAD DENNA FIL ALDRIG GÖR
 * ------------------------
 * Den validerar och beskriver. Den utför ingenting: ingen shell, ingen Git, ingen ref-upplösning,
 * ingen verifiering, ingen attestation, ingen promotion, ingen lease-/breaker-manipulation och
 * ingen I/O. Fälten `verification`, `task_gate`, `attestation`, `promotion` nedan är LÄSTA
 * projektionsfält ur controllerns snapshot — inga skrivvägar och inga beslutsvägar (jfr X7).
 * Ingen import av lib/github-read.ts eller lib/github-write.ts (MASKINEN_GITHUB_CREDENTIAL=NONE).
 */
import { z } from "zod";

/* ────────────────────────────────────────────────────────────────────────────
 * BINDNING MOT BACKENDENS PLAN OCH KONTRAKTSIDENTITET
 * ──────────────────────────────────────────────────────────────────────────── */

/** Backendplanen som denna fils vokabulär är härledd ur. Pinnad, inte minnesbaserad. */
export const BACKEND_PLAN_BINDING = {
  repository: "Nortropic/nortropic-system",
  plan_commit: "0b3212c991d4227c8df2656465ae2c0252dda39e",
  plan_path: "docs/loop/autonomous-loop-plan-v1.md",
  frontend_plan_path: "docs/nortropic-control-room-plan-v1.md",
} as const;

/**
 * B4 · canonical payload-kontrakt PER event_type ägs av backendens S5 och FINNS INTE vid
 * NORTROPIC_PLAN_COMMIT. Därför är identiteten OLÖST och `payload` valideras som en opak
 * nyckel/värde-karta utan namngivna fält. Verkstadsgolvet hittar ALDRIG på payloadfält.
 * När S5 låser kontraktet sätts id/version här och payloadtyper införs per event_type.
 */
export const PAYLOAD_CONTRACT = {
  id: null,
  version: null,
  status: "UNRESOLVED",
  owner: "nortropic-system S5 (B4)",
} as const;

/**
 * Planens B4-text kräver ordagrant att denna fil "bär ett PAYLOAD_CONTRACT_ID och en
 * PAYLOAD_CONTRACT_VERSION som pekar på backendens kontraktsidentitet". Konstanterna bärs
 * därför under exakt de namnen — greppbara — och är `null` så länge S5:s kontrakt saknas.
 * Ett värde här får ALDRIG hittas på; det sätts när backenden publicerat sin identitet.
 */
export const PAYLOAD_CONTRACT_ID: string | null = PAYLOAD_CONTRACT.id;
export const PAYLOAD_CONTRACT_VERSION: string | null = PAYLOAD_CONTRACT.version;

/** Låsta värden ur ägarbesluten. Bärs som konstanter så senare skivor inte kan glida. */
export const LOCKED = {
  EVENT_SEQ_SCOPE: "GLOBAL_PER_OPERATIONS_EVENT_STORE",
  EVENT_SEQ_RESETS_PER_RUN: false,
  ORDERING_KEY: "seq",
  DEDUP_KEY: "event_id",
  SNAPSHOT_WINS: true,
  EVENT_STREAM_IS_AUTHORITY: false,
  DISPLAYED_TRUTH: "CONTROLLER_PUBLISHED_SNAPSHOT",
} as const;

/**
 * Kontrakt som backendplanen NAMNGER men INTE låser formen på vid NORTROPIC_PLAN_COMMIT.
 * De valideras som opaka värden (sträng eller nyckellös karta) och renderas "—" i UI:t.
 * Att fylla dem med uppfunna fält är förbjudet — det är en spec-radsfråga i backendrepot.
 */
export const UNRESOLVED_CONTRACTS = [
  { field: "LoopEvent.payload", owner: "S5 (B4)", rendering: "opak, aldrig uppfunna fält" },
  { field: "LoopSnapshot.run.state", owner: "S5", rendering: "opak sträng" },
  { field: "LoopSnapshot.run.breaker", owner: "S5", rendering: "opak karta / —" },
  { field: "LoopSnapshot.run.budget", owner: "S5", rendering: "opak karta / —" },
  { field: "TaskView.merge", owner: "S8 + B7", rendering: "opak karta / —" },
  { field: "TaskView.promotion.state", owner: "S7", rendering: "opak sträng" },
  { field: "liveness-eventets namn (run.heartbeat är ett EXEMPEL)", owner: "S3 + S5 (B2)", rendering: "okänd typ → rå rad" },
  { field: "submission.*-familjens exakta typer", owner: "S5 + S10 (B1)", rendering: "UI-lokal, aldrig task state" },
  { field: "tokens/kostnad", owner: "— (B6 DEFERRED_NON_BLOCKING)", rendering: "—, inget fält i TaskView" },
] as const;

/**
 * REGISTRERADE ÖPPNA VAL — beslut som V1 har tagit medvetet och som en senare skiva ska
 * ompröva mot ett verkligt backendschema. De står här för att de ska vara greppbara och
 * ärvda med avsikt, inte av slentrian. Ett prov mäter att registret är ifyllt.
 */
export const OPEN_DECISIONS = [
  {
    id: "STRICT_EVENT_ENVELOPE",
    decision: "LoopEventSchema är strikt: okänt kuvertfält avvisar raden.",
    rationale:
      "Fäller uppfunna fält (V1:s negativa kontroll). Avvisade rader rapporteras av " +
      "validateEvents med index — de tystas aldrig.",
    revisit_in: "V4",
    depends_on: "nortropic-system S5 (B4) canonical kontrakt",
  },
  {
    id: "STRICT_SNAPSHOT",
    decision: "LoopSnapshotSchema och TaskViewSchema är strikta: okänt fält avvisar snapshoten.",
    rationale:
      "Snapshoten är DISPLAYED_TRUTH och ingen form är låst i backenden ännu. Insatsen är " +
      "högre än för kuvertet: ett tillagt minor-fält avvisar hela snapshoten i stället för " +
      "att degradera, medan planens regel för ett nyare schema är banner + fortsatt " +
      "rendering. Avvisandet är synligt (envelope med orsak), aldrig en tyst tom vy.",
    revisit_in: "V3/V4",
    depends_on: "nortropic-system S13 (B8) snapshotschema",
  },
] as const;

/* ────────────────────────────────────────────────────────────────────────────
 * VOKABULÄR
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Backendens kanoniska task-lifecycle. Elva tillstånd, ordagrant, ALDRIG utökade av UI:t.
 * `VERIFYING_SPEC`, `UPLOADED` och `ANALYZING` finns INTE här — de två senare lever i
 * SUBMISSION_LIFECYCLE, den förra är på sin höjd en härledd underetikett på PLANNING.
 */
export const TASK_LIFECYCLE = [
  "RAW",
  "PLANNING",
  "NEEDS_SPEC",
  "READY",
  "QUEUED",
  "WORKING",
  "VERIFYING",
  "REVIEWING",
  "MERGING",
  "DONE",
  "STOPPED",
] as const;
export type TaskLifecycle = (typeof TASK_LIFECYCLE)[number];

/** UI-LOKAL namnrymd för webbläsarens inlämning. Är ALDRIG en task och renderas aldrig som task state. */
export const SUBMISSION_LIFECYCLE = [
  "submission.selected",
  "submission.uploading",
  "submission.stored",
  "submission.command_queued",
  "submission.claimed_by_controller",
  "submission.rejected",
] as const;
export type SubmissionLifecycle = (typeof SUBMISSION_LIFECYCLE)[number];

/** Faserna i PhaseRail. `✓ ● — ✗` kommer ur event, aldrig ur gissning. */
export const PHASES = ["PLAN", "BUILD", "VERIFY", "REVIEW", "MERGE"] as const;
export type Phase = (typeof PHASES)[number];

/** Fasmarkörer. `—` betyder "inte inträffat" — aldrig noll, aldrig grönt. */
export const PHASE_MARKS = ["done", "active", "not_reached", "failed"] as const;
export type PhaseMark = (typeof PHASE_MARKS)[number];

/** Tre skilda domar per kandidat. NOT_RUN är SKILT från PASS. */
export const VERDICTS = ["PASS", "FAIL", "NOT_RUN", "UNKNOWN"] as const;
export type Verdict = (typeof VERDICTS)[number];

export const RISK_CLASSES = ["low", "normal", "high"] as const;
export type RiskClass = (typeof RISK_CLASSES)[number];

/** Kommandots livscykel i transporten. Status ägs av controllern, aldrig av appen. */
export const COMMAND_STATUSES = ["pending", "claimed", "applied", "rejected", "expired"] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

/** De sexton eventfamiljerna (CODEX_START_HERE). Familjen är den typade enheten. */
export const EVENT_FAMILIES = [
  "run",
  "task",
  "attempt",
  "workspace",
  "agent",
  "candidate",
  "policy",
  "verification",
  "feedback",
  "evaluation",
  "attestation",
  "promotion",
  "merge",
  "main",
  "breaker",
  "budget",
] as const;
export type EventFamily = (typeof EVENT_FAMILIES)[number];

/**
 * Kända event_type per familj. Härledda ur frontendplanens översättningstabell
 * (EVENT_CLIENT) och MERGE_CONFLICT_UX:s tillståndsavbildning — ingenting mer.
 * Listan är avsiktligt INTE uttömmande: en nyare controller får emittera typer detta bygge
 * inte känner, och de renderas då rått utan semantik.
 */
export const KNOWN_EVENT_TYPES_BY_FAMILY: Readonly<Record<EventFamily, readonly string[]>> = {
  run: ["run.started"],
  task: ["task.claimed"],
  attempt: ["attempt.started"],
  workspace: ["workspace.created"],
  agent: ["agent.started"],
  candidate: ["candidate.created"],
  policy: ["policy.started", "policy.failed"],
  verification: ["verification.started", "verification.failed"],
  feedback: ["feedback.created"],
  evaluation: ["evaluation.started", "evaluation.finding"],
  attestation: ["attestation.created"],
  promotion: ["promotion.started", "promotion.completed", "promotion.failed"],
  merge: ["merge.conflict", "merge.resolution.started", "merge.resolution.completed"],
  main: ["main.advanced"],
  breaker: ["breaker.opened"],
  budget: ["budget.exhausted"],
} as const;

/** Platt lista över kända typer, i familjeordning. Deterministisk — fixturerna hänger på den. */
export const KNOWN_EVENT_TYPES: readonly string[] = EVENT_FAMILIES.flatMap(
  (family) => KNOWN_EVENT_TYPES_BY_FAMILY[family],
);

export function isTaskLifecycle(value: unknown): value is TaskLifecycle {
  return typeof value === "string" && (TASK_LIFECYCLE as readonly string[]).includes(value);
}

export function isEventFamily(value: unknown): value is EventFamily {
  return typeof value === "string" && (EVENT_FAMILIES as readonly string[]).includes(value);
}

/* ────────────────────────────────────────────────────────────────────────────
 * SCHEMAVERSION
 * ──────────────────────────────────────────────────────────────────────────── */

export type SchemaVersion = `${number}.${number}.${number}`;

const SCHEMA_VERSION_RE = /^\d+\.\d+\.\d+$/;

/**
 * Den major detta gränssnitt förstår. Detta är en KLIENTFÖRMÅGA, inte ett påstående om
 * backenden: en nyare major avvisas ALDRIG, den flaggas (banner i UI:t) och tail slutar
 * härleda fas medan snapshot fortsätter renderas.
 */
export const SUPPORTED_SCHEMA_MAJOR = 1;

export const SCHEMA_SUPPORT = ["supported", "ahead_major", "behind_major", "unknown"] as const;
export type SchemaSupport = (typeof SCHEMA_SUPPORT)[number];

/**
 * Klassificerar en schemaversion mot det denna klient förstår.
 *
 * FAIL-CLOSED I RÄTT RIKTNING: en version vars major inte går att läsa returnerar `unknown`,
 * ALDRIG `supported`. Att rapportera en oläsbar version som förstådd hade låtit en tail
 * fortsätta härleda fas mot ett schema den bevisligen inte känner — precis fel riktning för
 * husets grundregel (hellre "—" och banner än ett tyst antagande).
 *
 * Ingen av utfallen avvisar eventet: okänd och nyare major renderas vidare, snapshot består.
 */
export function schemaSupport(schemaVersion: string): SchemaSupport {
  const rawMajor = schemaVersion.split(".")[0];
  if (!/^\d+$/.test(rawMajor ?? "")) return "unknown";
  const major = Number(rawMajor);
  if (!Number.isFinite(major)) return "unknown";
  if (major === SUPPORTED_SCHEMA_MAJOR) return "supported";
  return major > SUPPORTED_SCHEMA_MAJOR ? "ahead_major" : "behind_major";
}

/**
 * Den enda platsen där V2/V3 avgör om tail får härleda fas. `ahead_major` och `unknown`
 * behandlas IDENTISKT: banner i UI:t, tail slutar härleda, snapshot fortsätter renderas.
 */
export function schemaDegradesTail(support: SchemaSupport): boolean {
  return support === "ahead_major" || support === "unknown";
}

/* ────────────────────────────────────────────────────────────────────────────
 * ZOD-SCHEMAN — STRIKTA. Ett okänt fält är ett uppfunnet fält och fälls.
 * ──────────────────────────────────────────────────────────────────────────── */

const schemaVersionField = z.string().regex(SCHEMA_VERSION_RE, "schema_version måste vara major.minor.patch");
const nonEmpty = z.string().min(1);
const seqField = z
  .number()
  .int("seq måste vara ett heltal")
  .min(0, "seq får inte vara negativt")
  .max(Number.MAX_SAFE_INTEGER, "seq utanför säkert heltalsintervall");
const wallClock = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)), "ts måste vara en läsbar tidsstämpel");
const uuidV4 = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  "command_id måste vara en UUIDv4",
);

/** Opak karta: backenden äger formen, UI:t läser inga namngivna fält ur den. */
const opaqueMap = z.looseObject({});

/** Opak sträng: bevaras rå, mappas aldrig till en UI-mening förrän backenden låser enumen. */
const opaqueState = z.string();

/**
 * Eventets kuvert. STRIKT: ett okänt toppnivåfält är ett uppfunnet fält och fälls — det är
 * precis den negativa kontroll V1 ska bära.
 *
 * BINDANDE FÖR V4:s LÄSPLAN — läs detta innan transporten kopplas in.
 * `loop_events`-tabellen i TRANSPORT_PLAN bär transportkolumner som INTE hör till kontraktet
 * (i dag `ingested_at`). Route-handlern under app/api/loop/** ska därför SELECTa exakt dessa
 * tio kontraktskolumner — schema_version, event_id, seq, ts, run_id, task_id, attempt_id,
 * event_type, payload, evidence_refs — och aldrig skicka en rå tabellrad in i validateEvent().
 * En `select("*")` hade fällt varje rad på `ingested_at`.
 *
 * FORWARD-KOMPATIBILITET: skulle en framtida minor från S5 lägga till ett kuvertfält faller
 * raderna i dag i stället för att degradera, vilket är strängare än planens regel för ett
 * NYARE schema (banner + fortsatt rendering). Det är acceptabelt i V1 av två skäl: ogiltiga
 * rader TYSTAS aldrig — validateEvents() rapporterar dem med index — och inget kuvertfält
 * utöver dessa tio finns låst någonstans än. Frågan ska tas om när S5 publicerar sitt
 * canonical kontrakt (B4); då avgörs om kuvertet ska bli framåtkompatibelt i minor.
 */
export const LoopEventSchema = z.strictObject({
  schema_version: schemaVersionField,
  event_id: nonEmpty,
  seq: seqField,
  ts: wallClock,
  run_id: nonEmpty,
  task_id: z.string().nullable(),
  attempt_id: z.string().nullable(),
  event_type: nonEmpty,
  payload: opaqueMap,
  evidence_refs: z.array(z.string()),
});
export type LoopEvent = z.infer<typeof LoopEventSchema>;

/**
 * Kuvertets kontraktskolumner, härledda UR schemat (aldrig en handskriven parallellista som
 * kan glida). V4:s läsroute ska projicera exakt dessa och utelämna transportkolumner som
 * `ingested_at`, så att en tabellrad aldrig fälls på ett fält som inte hör till kontraktet.
 */
export const EVENT_ENVELOPE_COLUMNS = Object.keys(LoopEventSchema.shape) as (keyof LoopEvent)[];

export const TaskViewSchema = z.strictObject({
  task_id: nonEmpty,
  title: z.string().nullable(),
  state: z.enum(TASK_LIFECYCLE),
  source: z
    .strictObject({
      source_id: nonEmpty,
      sha256: z.string().regex(/^[0-9a-f]{64}$/, "sha256 ska vara 64 hex-tecken"),
      locator: z.string().nullable(),
    })
    .nullable(),
  attempt: z.strictObject({
    n: z.number().int().min(0).nullable(),
    budget: z.number().int().min(0).nullable(),
  }),
  phase: z.enum(PHASES).nullable(),
  builder: z.strictObject({
    agent: z.string().nullable(),
    model: z.string().nullable(),
  }),
  risk_class: z.enum(RISK_CLASSES).nullable(),
  base_sha: z.string().nullable(),
  candidate_sha: z.string().nullable(),
  first_seen_ts: z.string().nullable(),
  policy: z.enum(VERDICTS),
  verification: z.enum(VERDICTS),
  task_gate: z.strictObject({
    verdict: z.enum(VERDICTS),
    grind_id: z.string().nullable(),
    grind_sha256: z.string().nullable(),
  }),
  evaluation: z.strictObject({
    required: z.boolean().nullable(),
    verdict: z.enum(VERDICTS),
    findings: z.number().int().min(0).nullable(),
  }),
  attestation: z
    .strictObject({
      exists: z.boolean(),
      promotion_eligible: z.boolean().nullable(),
    })
    .nullable(),
  /** OLÖST form (S8 + B7). Opak karta eller null → renderas "—". */
  merge: opaqueMap.nullable(),
  promotion: z
    .strictObject({
      /** OLÖST enum (S7). Opak sträng eller null → "—". */
      state: opaqueState.nullable(),
      from_sha: z.string().nullable(),
      to_sha: z.string().nullable(),
    })
    .nullable(),
  evidence_refs: z.array(z.string()),
});
export type TaskView = z.infer<typeof TaskViewSchema>;

/**
 * Controllerns publicerade read-model. DISPLAYED_TRUTH.
 *
 * STRIKT — och det är ett MEDVETET val, inte en olycka. Samma avvägning som för kuvertet
 * (se LoopEventSchema) men med högre insats: snapshoten ÄR det som visas, så ett tillagt
 * minor-fält från S5/S13 avvisar i dag hela snapshoten i stället för att degradera, medan
 * planens regel för ett NYARE schema är banner + "snapshot fortsätter renderas".
 *
 * Varför strikt ändå i V1: ingen snapshot-form är låst i backenden vid NORTROPIC_PLAN_COMMIT,
 * och den negativa kontroll V1 bär ("fixtur utan den verkliga kanalens form som ändå går
 * grön") kräver att ett okänt fält fälls. Ett avvisande är dessutom SYNLIGT — validateSnapshot
 * returnerar ett envelope med orsak, aldrig en tyst tom vy.
 *
 * BESLUTET ÄR REGISTRERAT som en öppen punkt för V3/V4 i OPEN_DECISIONS nedan: när S13
 * publicerar snapshotens schema ska strikt-vs-framåtkompatibel-i-minor avgöras uttryckligen,
 * inte ärvas. V3:s SNAPSHOT_WINS-lager måste dessutom behandla en avvisad snapshot som
 * "ingen färsk snapshot" (senast bekräftade läge + orsak), aldrig som en tom kontrollrumsvy.
 */
export const LoopSnapshotSchema = z.strictObject({
  schema_version: schemaVersionField,
  run_id: nonEmpty,
  seq_watermark: seqField,
  published_ts: wallClock,
  run: z.strictObject({
    /** OLÖST enum (S5). Opak sträng eller null → "—". Mappas aldrig till en UI-mening här. */
    state: opaqueState.nullable(),
    /** OLÖST form (S5). */
    breaker: opaqueMap.nullable(),
    /** OLÖST form (S5). */
    budget: opaqueMap.nullable(),
  }),
  current_main: z.strictObject({
    /** Controllerns BEKRÄFTADE värde. Verkstadsgolvet slår aldrig upp origin/main själv. */
    sha: z.string().nullable(),
    confirmed_ts: z.string().nullable(),
  }),
  current_task: TaskViewSchema.nullable(),
  backlog: z.array(TaskViewSchema),
  completed: z.array(TaskViewSchema),
});
export type LoopSnapshot = z.infer<typeof LoopSnapshotSchema>;

/* ── COMMAND_SCHEMA_PLAN — exakt fem verb, typad payload ──────────────────── */

export const COMMAND_VERBS = [
  "intake.submit",
  "run.start",
  "run.pause_at_safe_boundary",
  "run.resume",
  "inspect",
] as const;
export type CommandVerb = (typeof COMMAND_VERBS)[number];

/**
 * Ett kommando är ENDAST en intention. Controllern validerar och får alltid avvisa.
 * Ingen sträng här blir någonsin ett kommando: `verb` är en enum, payload är typad per verb.
 */
export const CommandSchema = z.discriminatedUnion("verb", [
  z.strictObject({
    verb: z.literal("intake.submit"),
    payload: z.strictObject({
      /** OPAK transportreferens (B5). Controllern resolvar, läser bytes och hashar SJÄLV. */
      source_ref: nonEmpty,
      /** PÅSTÅENDE, aldrig trust-anchor. Controllern räknar om och avvisar vid avvikelse. */
      source_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  }),
  z.strictObject({
    verb: z.literal("run.start"),
    payload: z.strictObject({ config_ref: nonEmpty }),
  }),
  z.strictObject({
    verb: z.literal("run.pause_at_safe_boundary"),
    payload: z.strictObject({ run_id: nonEmpty }),
  }),
  z.strictObject({
    verb: z.literal("run.resume"),
    payload: z.strictObject({ run_id: nonEmpty }),
  }),
  z.strictObject({
    verb: z.literal("inspect"),
    payload: z.union([
      z.strictObject({ task_id: nonEmpty }),
      z.strictObject({ run_id: nonEmpty }),
    ]),
  }),
]);
export type Command = z.infer<typeof CommandSchema>;

/** Kommandots transportrad. `issued_at`/`status` sätts av server respektive controller. */
export const CommandRecordSchema = z.strictObject({
  command_id: uuidV4,
  verb: z.enum(COMMAND_VERBS),
  payload: opaqueMap,
  dedup_key: nonEmpty,
  issued_by: nonEmpty,
  issued_at: wallClock,
  expires_at: wallClock,
  expected_watermark: seqField.nullable(),
  status: z.enum(COMMAND_STATUSES),
  claimed_at: z.string().nullable(),
  result: opaqueMap.nullable(),
});
export type CommandRecord = z.infer<typeof CommandRecordSchema>;

/**
 * dedup_key = verb + naturlig nyckel. UNIQUE bland icke-terminala rader i transporten;
 * stoppar dubbelklick och dubbelflik. Här byggs bara nyckeln — ingen kö rörs i V1.
 */
export function dedupKey(command: Command): string {
  switch (command.verb) {
    case "intake.submit":
      return `intake.submit:${command.payload.source_sha256}`;
    case "run.start":
      return `run.start:${command.payload.config_ref}`;
    case "run.pause_at_safe_boundary":
      return `run.pause_at_safe_boundary:${command.payload.run_id}`;
    case "run.resume":
      return `run.resume:${command.payload.run_id}`;
    case "inspect":
      return "task_id" in command.payload
        ? `inspect:task:${command.payload.task_id}`
        : `inspect:run:${command.payload.run_id}`;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * KLASSIFICERING AV EVENT_TYPE — okänd typ är ett giltigt utfall, inte ett fel
 * ──────────────────────────────────────────────────────────────────────────── */

export type EventClassification = {
  raw_type: string;
  /** Känd familj, annars null. */
  family: EventFamily | null;
  /** Känd familj OCH känd typ inom den. */
  known: boolean;
  /**
   * "known" · "unknown_type_in_known_family" · "unknown_family".
   * Allt utom "known" renderas rått, saknar semantik och flyttar ingen state.
   */
  kind: "known" | "unknown_type_in_known_family" | "unknown_family";
};

export function classifyEventType(eventType: string): EventClassification {
  const family = eventType.split(".")[0];
  if (!isEventFamily(family)) {
    return { raw_type: eventType, family: null, known: false, kind: "unknown_family" };
  }
  const known = KNOWN_EVENT_TYPES_BY_FAMILY[family].includes(eventType);
  return {
    raw_type: eventType,
    family,
    known,
    kind: known ? "known" : "unknown_type_in_known_family",
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * VALIDERING — envelope-mönstret ur lib/github-read.ts, aldrig kast
 * ──────────────────────────────────────────────────────────────────────────── */

export type LoopFailReason = "invalid-event" | "invalid-snapshot" | "invalid-command";

export type LoopFail = { ok: false; reason: LoopFailReason; message: string };
export type LoopResult<T> = { ok: true; data: T } | LoopFail;

/** En validerad händelse plus dess klassificering och schemastöd. Inget kastas någonsin. */
export type ValidatedEvent = {
  event: LoopEvent;
  classification: EventClassification;
  schema_support: SchemaSupport;
};

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Ogiltig form.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/**
 * Validerar ett event ur strömmen.
 * · Saknat `seq`, `event_id` eller `schema_version` → avvisat (V1 exit 3).
 * · Okänd `event_type` → GODKÄNT, klassificerat som okänt, bevarat rått (V1 exit 1).
 * · Nyare major → GODKÄNT och flaggat `ahead_major`; UI:t visar banner, kraschar aldrig.
 */
export function validateEvent(input: unknown): LoopResult<ValidatedEvent> {
  const parsed = LoopEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid-event", message: firstIssue(parsed.error) };
  }
  return {
    ok: true,
    data: {
      event: parsed.data,
      classification: classifyEventType(parsed.data.event_type),
      schema_support: schemaSupport(parsed.data.schema_version),
    },
  };
}

export type ValidatedEventBatch = {
  valid: ValidatedEvent[];
  invalid: { index: number; message: string }[];
};

/**
 * Validerar en lista av event. Ogiltiga rader rapporteras separat — de tystas aldrig bort.
 *
 * Tar `unknown`, inte `unknown[]`: transporten kan svara med en felkropp, ett objekt eller
 * `null` i stället för en lista, och modulens kontrakt är att den ALDRIG kastar. En icke-lista
 * degraderar därför till ett rapporterat fel — samma envelope-hållning som resten av filen —
 * i stället för att kasta TypeError in i en V4-route.
 */
export function validateEvents(input: unknown): ValidatedEventBatch {
  if (!Array.isArray(input)) {
    return {
      valid: [],
      invalid: [
        {
          index: 0,
          message: `förväntade en lista av event, fick ${input === null ? "null" : typeof input}`,
        },
      ],
    };
  }

  const valid: ValidatedEvent[] = [];
  const invalid: { index: number; message: string }[] = [];
  input.forEach((raw, index) => {
    const result = validateEvent(raw);
    if (result.ok) valid.push(result.data);
    else invalid.push({ index, message: result.message });
  });
  return { valid, invalid };
}

export function validateSnapshot(input: unknown): LoopResult<LoopSnapshot> {
  const parsed = LoopSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid-snapshot", message: firstIssue(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

/** Ett sjätte verb, eller en payload som inte hör till verbet, avvisas här. */
export function validateCommand(input: unknown): LoopResult<Command> {
  const parsed = CommandSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid-command", message: firstIssue(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

/* ────────────────────────────────────────────────────────────────────────────
 * ORDNING — `seq` ENSAMT (B3). `ts` läses aldrig här.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Jämför två event för läsordning. Endast `seq`. `ts`, `run_id` och ankomstordning
 * påverkar ingenting. `seq` är globalt monoton i operations-eventbutiken och nollställs
 * aldrig per run (EVENT_SEQ_RESETS_PER_RUN=NO).
 */
export function compareBySeq(a: { seq: number }, b: { seq: number }): number {
  return a.seq - b.seq;
}

/** Läsordning för en eventlista. Ren funktion, stabil, rör aldrig `ts`. */
export function orderEvents<T extends { seq: number }>(events: readonly T[]): T[] {
  return [...events].sort(compareBySeq);
}
