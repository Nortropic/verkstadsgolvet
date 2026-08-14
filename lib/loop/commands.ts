/**
 * V7 · SMAL KOMMANDOYTA — de fem typade intentionerna, och ingenting mer.
 *
 * AUKTORITATIV KÄLLA: docs/nortropic-control-room-plan-v1.md — COMMAND_CLIENT ("De fem verben
 * — ingenting mer", "Idempotens och replay", "run.pause_at_safe_boundary", "Kommandostatus i
 * UI:t"), AUTH_SECURITY (DJUPFÖRSVAR · CSRF · RATE LIMIT · LOGGNING), TRANSPORT_PLAN
 * (loop_commands, failure semantics) och IMPLEMENTATION_SLICES §V7.
 *
 * VAD ETT KOMMANDO ÄR
 * -------------------
 * En INTENTION. Ingenting mer. Verkstadsgolvet formulerar den, stämplar den med sin egen klocka
 * och lämnar den till controllerns kö. Controllern claimar, validerar om och FÅR ALLTID AVVISA.
 * Ingen rad i den här filen utför något: det finns ingen shell, ingen Git, ingen filredigering,
 * ingen merge, ingen verifiering, ingen attestation och ingen promotion. `payload` är DATA —
 * en sträng i en payload får aldrig ges någon annan mening än sina tecken.
 *
 * BINDANDE REGLER SOM FILEN BÄR MEKANISKT
 * ---------------------------------------
 * · EXAKT FEM VERB. Vokabulären ägs av V1:s COMMAND_VERBS; ett sjätte verb faller redan i
 *   valideringen och når aldrig en kö, en ledger eller en räknare (400, noll sidoeffekt).
 * · IDEMPOTENS PÅ command_id i tre lager: (1) `command_id` är PRIMARY KEY i controllerns kö,
 *   (2) den här filens ledger stoppar en andra utskickning från SAMMA instans (dubbelklick,
 *   dubbelflik), (3) `expires_at` gör ett kommando som legat kvar dött i stället för utfört
 *   långt senare mot ett annat läge. Lager 1 är auktoritativt; 2 och 3 är djupförsvar.
 * · SERVERKLOCKA. `issued_at` och `expires_at` stämplas här — aldrig ur klientens klocka och
 *   aldrig ur en klientskickad tidsstämpel (fältet finns inte i förfrågningskontraktet).
 * · INGEN OPTIMISTISK STATE. Den här filen returnerar kommandots eget öde, aldrig en task-state.
 *   Task state ändras uteslutande ur controllerns snapshot (SNAPSHOT_WINS).
 * · FAIL-CLOSED. Saknad session, fel origin, fel medietyp, för stor kropp, okänt verb, stale
 *   läge eller stängd kanal ger AVSLAG MED ORSAK. Aldrig ett tyst "kanske", aldrig ett
 *   påstående om att något startats.
 *
 * VAD FILEN ALDRIG GÖR
 * --------------------
 * Ingen lease, ingen brytare, ingen Git-ref, ingen dom (PASS/FAIL), ingen attestation, ingen
 * promotion, ingen merge-upplösning. Ingen `eval`, ingen `Function`, ingen process. Ingen
 * GitHub-credential av något slag (MASKINEN_GITHUB_CREDENTIAL=NONE). Ingen läsning av
 * process.env. Ingen loggning av payloadvärden.
 *
 * KLIENTSÄKER: filen importeras av både routen och komponenterna. Den rör därför varken
 * transport, Supabase-klient eller miljövariabler — den serverspecifika inkopplingen injiceras.
 */
import { z } from "zod";

import {
  COMMAND_STATUSES,
  COMMAND_VERBS,
  CommandRecordSchema,
  CommandSchema,
  dedupKey,
  type Command,
  type CommandRecord,
  type CommandStatus,
  type CommandVerb,
} from "./schema";
import {
  PAUSE_AT_SAFE_BOUNDARY_EXPLANATION,
  PAUSE_AT_SAFE_BOUNDARY_LABEL,
  type Tone,
} from "./labels";

/* ────────────────────────────────────────────────────────────────────────────
 * LÅSTA REGLER — greppbara konstanter, så att en senare skiva inte kan glida
 * ──────────────────────────────────────────────────────────────────────────── */

export const COMMAND_RULES = {
  /** Exakt planens COMMAND_SCHEMA_PLAN. Ett sjätte verb är inte en utbyggnad, det är ett fel. */
  VERB_COUNT: COMMAND_VERBS.length,
  /** Ett kommando är en intention. Controllern är sista instans och får alltid avvisa. */
  CONTROLLER_MAY_ALWAYS_REJECT: true,
  /** Task state ändras ENDAST ur controllerns snapshot. Kommandot ändrar ingen vy. */
  OPTIMISTIC_TASK_STATE: false,
  /** En payload är data. Den tolkas aldrig som kommando, sökväg eller uttryck. */
  PAYLOAD_IS_EXECUTED: false,
  /** `issued_at`/`expires_at` sätts av servern. Klientens klocka är aldrig indata. */
  SERVER_STAMPS_TIME: true,
  /** Idempotensens auktoritativa lager: PRIMARY KEY på command_id i controllerns kö. */
  IDEMPOTENCY_AUTHORITY: "command_id PRIMARY KEY (controller queue)",
  /** De ytor V7 uttryckligen ALDRIG rör (exit 8). Bärs som data så ett prov kan mäta dem. */
  TOUCHES_LEASE: false,
  TOUCHES_BREAKER: false,
  TOUCHES_GIT_REFS: false,
  WRITES_VERDICT: false,
  WRITES_ATTESTATION: false,
  WRITES_PROMOTION: false,
  GITHUB_CREDENTIAL: "NONE",
  DISPLAYED_TRUTH: "CONTROLLER_PUBLISHED_SNAPSHOT",
} as const;

/** Kommandorutten. Bärs som konstant så klient och prov aldrig gissar sökvägen. */
export const COMMAND_ENDPOINT = "/api/loop/command";

/**
 * KANALENS LÄGE. Kommandokön (`loop_commands`) ägs av nortropic-system S13 och finns inte vid
 * NORTROPIC_PLAN_COMMIT. Ytan är byggd — kontraktet, grindarna, idempotensen och vyerna — men
 * det finns ingen mottagare att köa mot, och Verkstadsgolvet låtsas aldrig att det finns.
 *
 * Detta är en ÄRLIGHETSKONSTANT, inte en funktionsflagga: den byts när backendens skiva är
 * byggd OCH verifierad, inte när någon tycker att ytan ser färdig ut.
 */
export const COMMAND_QUEUE_TRANSPORT = "NONE" as const;

/** Backendens ägare av kommandokön. Ordagrant ur planens BACKEND_DEPENDENCY. */
export const COMMAND_QUEUE_BLOCKED_ON = "nortropic-system S13" as const;

/** Ordagrann orsak vid avstängd knapp och vid avslag från routen. Ingen fejkad kö. */
export const COMMAND_QUEUE_DISABLED_REASON =
  "Kommandokanalen är stängd. Kommandokön ägs av nortropic-system S13 och finns inte. " +
  "Verkstadsgolvet köar hellre ingenting än låtsas skicka ett kommando.";

/** Sant först när det finns en faktisk kö att lämna intentionen till. */
export function commandChannelEnabled(): boolean {
  return COMMAND_QUEUE_TRANSPORT !== "NONE";
}

/* ── Gränser. Planens förslag där planen föreslår, annars smalast rimliga. ─── */

/** TTL enligt planens förslag: 120 s. En utgången rad claimas aldrig. */
export const COMMAND_TTL_MS = 120_000;

/** En intention är några hundra byte. Taket stoppar en kropp som inte kan vara ett kommando. */
export const COMMAND_MAX_BODY_BYTES = 4_096;

/** Enkel per-session-räknare (AUTH_SECURITY · RATE LIMIT). */
export const COMMAND_RATE_LIMIT = { max_per_window: 30, window_ms: 60_000 } as const;

/**
 * ÖPPNA VAL som V7 tagit medvetet och som ska omprövas mot en VERKLIG kö (S13). Samma mönster
 * som V1:s OPEN_DECISIONS och V4:s TRANSPORT_OPEN_DECISIONS: ärvda med avsikt, inte av
 * slentrian. Ett prov mäter att registret är ifyllt.
 */
export const COMMAND_OPEN_DECISIONS = [
  {
    id: "QUEUE_PORT_WITHOUT_LIVE_WRITER",
    decision:
      "Kommandokön nås genom en smal port (CommandQueue) med EN operation: enqueue. Den enda " +
      "implementationen i repot är blockedCommandQueue(), som avvisar med orsak. Ingen " +
      "INSERT-väg mot loop_commands byggs innan S13 är byggd och verifierad.",
    rationale:
      "Tabellen finns inte. En skrivväg mot en tabell som inte finns hade varit en ospårbar " +
      "livepåstående i en fixturbaserad skiva, och den hade dessutom krävt en skrivrättighet " +
      "som läsytans nyckel medvetet saknar. Porten gör inkopplingen till ETT byte av " +
      "implementation, mätbart på ett ställe.",
    revisit_in: "V7-live",
    depends_on: "nortropic-system S13 (loop_commands + claim)",
  },
  {
    id: "STALE_CHECK_MAY_ONLY_REFUSE",
    decision:
      "Routen jämför `expected_watermark` mot ett OBSERVERAT vattenmärke först om ett sådant " +
      "går att läsa. Utfallet kan bara AVVISA. Ett kommando släpps aldrig igenom för att " +
      "kontrollen såg 'rätt' ut — controllern gör om bedömningen och är sista instans.",
    rationale:
      "Planens replayskydd lägger stale-domen hos controllern. En egen dom här hade blivit en " +
      "andra sanning. Att ändå refusera tidigt är gratis och strikt fail-closed.",
    revisit_in: "V7-live",
    depends_on: "nortropic-system S13",
  },
  {
    id: "LEDGER_IS_DEFENCE_IN_DEPTH_ONLY",
    decision:
      "Instansens ledger är BEGRÄNSAD och lokal. Den stoppar dubbelklick och dubbelflik mot " +
      "samma instans men är aldrig en sanning om controllerns tillstånd, och den återskapas " +
      "vid omstart.",
    rationale:
      "Idempotensens auktoritet är `command_id` som PRIMARY KEY i kön. En ledger som utgav sig " +
      "för att vara mer hade blivit ett andra, felbart register över vad controllern gjort.",
    revisit_in: "V7-live",
    depends_on: "nortropic-system S13",
  },
] as const;

/* ────────────────────────────────────────────────────────────────────────────
 * FÖRFRÅGNINGSKONTRAKT — smalt, strikt, och utan en enda klientklocka
 * ──────────────────────────────────────────────────────────────────────────── */

/** UUIDv4. Klienten genererar id:t; servern litar bara på dess FORM, aldrig dess mening. */
export const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Kroppen routen tar emot. STRIKT: inga extrafält, ingen klientstämplad tid, ingen status och
 * ingen `issued_by` — identiteten kommer ur sessionen, aldrig ur kroppen.
 *
 * `expected_watermark` är OBLIGATORISKT men får vara null: en klient som inte har sett något
 * vattenmärke ska säga det uttryckligen, inte utelämna fältet och låta servern gissa.
 */
export const CommandRequestSchema = z.strictObject({
  command_id: z.string().regex(UUID_V4_PATTERN, "command_id måste vara en UUIDv4"),
  expected_watermark: z
    .number()
    .int("expected_watermark måste vara ett heltal")
    .min(0, "expected_watermark får inte vara negativt")
    .max(Number.MAX_SAFE_INTEGER, "expected_watermark utanför säkert heltalsintervall")
    .nullable(),
  command: CommandSchema,
});
export type CommandRequest = z.infer<typeof CommandRequestSchema>;

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Ogiltig form.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/**
 * Validerar en förfrågningskropp. Ett sjätte verb, en payload som inte hör till verbet eller
 * ett extrafält faller HÄR — före ledger, före räknare, före kö. Noll sidoeffekt.
 */
export function validateCommandRequest(
  input: unknown,
): { ok: true; data: CommandRequest } | { ok: false; message: string } {
  const parsed = CommandRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  return { ok: true, data: parsed.data };
}

/* ────────────────────────────────────────────────────────────────────────────
 * KOMMANDORADEN — serverstämplad, validerad mot V1:s kontrakt
 * ──────────────────────────────────────────────────────────────────────────── */

export type BuildRecordInput = {
  command: Command;
  command_id: string;
  issued_by: string;
  /** SERVERNS klocka. Klientens tid finns inte i kontraktet och kan därför inte smyga in. */
  issued_at: Date;
  expected_watermark: number | null;
};

/**
 * Bygger den rad controllern ska claima. `status` sätts till "pending" — det är radens
 * STARTVÄRDE i tabellskissen, inte ett påstående om vad controllern gjort.
 *
 * Raden valideras mot V1:s CommandRecordSchema innan den lämnar funktionen: en rad som inte
 * håller kontraktet skickas aldrig vidare, den rapporteras.
 */
export function buildCommandRecord(
  input: BuildRecordInput,
): { ok: true; record: CommandRecord } | { ok: false; message: string } {
  const issuedAt = input.issued_at.toISOString();
  const candidate = {
    command_id: input.command_id,
    verb: input.command.verb,
    payload: input.command.payload,
    dedup_key: dedupKey(input.command),
    issued_by: input.issued_by,
    issued_at: issuedAt,
    expires_at: new Date(input.issued_at.getTime() + COMMAND_TTL_MS).toISOString(),
    expected_watermark: input.expected_watermark,
    status: "pending" as CommandStatus,
    claimed_at: null,
    result: null,
  };
  const parsed = CommandRecordSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  return { ok: true, record: parsed.data };
}

/** true = radens TTL har passerat. Utgången rad claimas aldrig och skickas aldrig. */
export function commandExpired(record: CommandRecord, now: Date): boolean {
  const expires = Date.parse(record.expires_at);
  return Number.isFinite(expires) && now.getTime() > expires;
}

/**
 * Stale-domen, och bara i EN riktning: ett kommando vars antagande om läget ligger BAKOM det
 * observerade vattenmärket avvisas. Ett okänt vattenmärke (null) friar aldrig — det betyder
 * bara att Verkstadsgolvet inte vet, och då är controllern ensam domare.
 */
export function commandIsStale(
  expectedWatermark: number | null,
  observedWatermark: number | null,
): boolean {
  if (expectedWatermark === null || observedWatermark === null) return false;
  return expectedWatermark < observedWatermark;
}

/* ────────────────────────────────────────────────────────────────────────────
 * KÖPORTEN — en operation, och ingen implementation som skriver någonstans
 * ──────────────────────────────────────────────────────────────────────────── */

/** Köns svar på en accepterad överlämning. Alla tre är controllerns ord, inte appens. */
export type QueueOutcome = "queued" | "duplicate_command_id" | "duplicate_dedup_key";

export type QueueResult =
  | { ok: true; outcome: QueueOutcome }
  | { ok: false; message: string };

/**
 * Kommandoköns HELA yta sett från Verkstadsgolvet: lämna över en rad. Det finns ingen
 * uppdatering, ingen borttagning och ingen statusskrivning — `status` ägs av controllern.
 */
export type CommandQueue = { enqueue: (record: CommandRecord) => Promise<QueueResult> };

/**
 * Den enda kön som finns i repot i dag: den som ärligt säger att den inte finns.
 *
 * Den rör ingen transport, ingen tabell och ingen credential. När S13 är byggd OCH verifierad
 * ersätts den av en implementation som INSERTar en rad — ett byte på ETT ställe.
 */
export function blockedCommandQueue(): CommandQueue {
  return {
    enqueue: async () => ({ ok: false, message: COMMAND_QUEUE_DISABLED_REASON }),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * LEDGER — dubbelklickets andra lager. Aldrig en sanning om controllern.
 * ──────────────────────────────────────────────────────────────────────────── */

export type LedgerEntry = { record: CommandRecord; outcome: QueueOutcome };

export type CommandLedger = {
  /** Raden vi redan lämnat över med detta command_id, om någon. */
  get: (commandId: string) => LedgerEntry | null;
  /** En icke-utgången rad med samma naturliga nyckel — planens UNIQUE bland icke-terminala. */
  pendingByDedupKey: (dedupKeyValue: string, now: Date) => LedgerEntry | null;
  remember: (entry: LedgerEntry) => void;
  /** Senast överlämnade först. Bara för vyn "senaste kommandon". */
  recent: (limit?: number) => LedgerEntry[];
  size: () => number;
};

/** Taket är en minnesgräns, inte en policy: idempotensens auktoritet är köns PRIMARY KEY. */
export const LEDGER_CAPACITY = 100;

export function createCommandLedger(options: { capacity?: number } = {}): CommandLedger {
  const capacity = options.capacity ?? LEDGER_CAPACITY;
  const entries = new Map<string, LedgerEntry>();

  return {
    get: (commandId) => entries.get(commandId) ?? null,
    pendingByDedupKey: (dedupKeyValue, now) => {
      for (const entry of [...entries.values()].reverse()) {
        if (entry.record.dedup_key !== dedupKeyValue) continue;
        if (commandExpired(entry.record, now)) continue;
        return entry;
      }
      return null;
    },
    remember: (entry) => {
      entries.set(entry.record.command_id, entry);
      while (entries.size > capacity) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
    },
    recent: (limit = 20) => [...entries.values()].reverse().slice(0, limit),
    size: () => entries.size,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * RATE LIMIT — en räknare per session, inget mer avancerat än planen ber om
 * ──────────────────────────────────────────────────────────────────────────── */

export type RateLimiter = {
  /** REN LÄSNING. Att fråga kostar ingenting — bara en överlämning gör det. */
  check: (key: string, now: Date) => { allowed: boolean; retry_after_ms: number };
  consume: (key: string, now: Date) => void;
};

export function createRateLimiter(
  options: { max_per_window?: number; window_ms?: number } = {},
): RateLimiter {
  const max = options.max_per_window ?? COMMAND_RATE_LIMIT.max_per_window;
  const windowMs = options.window_ms ?? COMMAND_RATE_LIMIT.window_ms;
  const hits = new Map<string, number[]>();

  const live = (key: string, now: number): number[] => {
    const kept = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
    if (kept.length === 0) hits.delete(key);
    else hits.set(key, kept);
    return kept;
  };

  return {
    check: (key, now) => {
      const stamps = live(key, now.getTime());
      if (stamps.length < max) return { allowed: true, retry_after_ms: 0 };
      const oldest = stamps[0] ?? now.getTime();
      return { allowed: false, retry_after_ms: Math.max(0, windowMs - (now.getTime() - oldest)) };
    },
    consume: (key, now) => {
      const stamps = live(key, now.getTime());
      hits.set(key, [...stamps, now.getTime()]);
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * GRINDARNA — CSRF, medietyp och storlek. Alla fail-closed.
 * ──────────────────────────────────────────────────────────────────────────── */

export type GateVerdict = { ok: true } | { ok: false; message: string };

/** Den enda metoden kommandoytan har. Ingen form-post-väg, ingen GET-biverkan. */
export const COMMAND_METHOD = "POST";

/**
 * Same-origin-kravet (AUTH_SECURITY · CSRF), utöver sessionen.
 *
 * FAIL-CLOSED I RÄTT RIKTNING: saknas både `Origin` och en läsbar värd kan förfrågan inte
 * bevisas komma från kontrollrummet, och då avvisas den. Att gissa åt andra hållet hade gjort
 * kommandoytan nåbar från en främmande sida med operatörens inloggade session.
 *
 * Endast VÄRDEN jämförs. Bakom Railways TLS-terminering är webbläsarens origin `https://…`
 * medan `Host` bara bär värdnamnet; en schemajämförelse hade fällt varje äkta förfrågan.
 */
export function sameOriginVerdict(headers: Headers): GateVerdict {
  const site = headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") {
    return { ok: false, message: "Kommandot kom inte från kontrollrummet (cross-site)." };
  }

  const origin = headers.get("origin");
  if (origin === null || origin === "") {
    return { ok: false, message: "Kommandot saknar origin och kan inte hänföras till kontrollrummet." };
  }

  const forwarded = headers.get("x-forwarded-host");
  const host = (forwarded === null ? headers.get("host") : forwarded.split(",")[0])?.trim() ?? "";
  if (host === "") {
    return { ok: false, message: "Kommandot saknar värd och kan inte hänföras till kontrollrummet." };
  }

  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    return { ok: false, message: "Kommandots origin är inte en läsbar adress." };
  }
  if (originHost.toLowerCase() !== host.toLowerCase()) {
    return { ok: false, message: "Kommandot kom från en annan origin än kontrollrummet." };
  }
  return { ok: true };
}

/** Endast JSON. En form-post kan inte nå kommandoytan — det är hela poängen med kravet. */
export function jsonMediaTypeVerdict(headers: Headers): GateVerdict {
  const raw = headers.get("content-type");
  const mediaType = (raw ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType === "application/json") return { ok: true };
  return { ok: false, message: "Kommandoytan tar emot enbart application/json." };
}

/** Byten, inte tecken: ett tak i tecken hade kunnat överskridas tyst av flerbytetecken. */
export function bodyByteLength(body: string): number {
  return new TextEncoder().encode(body).length;
}

/* ────────────────────────────────────────────────────────────────────────────
 * SVARSKUVERT — orsaken är maskinläsbar OCH ordagrant visningsbar
 * ──────────────────────────────────────────────────────────────────────────── */

export type CommandFailReason =
  | "method-not-allowed"
  | "wrong-origin"
  | "unsupported-media-type"
  | "payload-too-large"
  | "invalid-command"
  | "rate-limited"
  | "stale-watermark"
  | "expired"
  | "duplicate-dedup-key"
  | "queue-unavailable"
  | "unexpected";

/** Kommandoradens PUBLIKA delar. `payload` echas inte tillbaka och `issued_by` lämnar aldrig servern. */
export type AcceptedCommand = {
  command_id: string;
  verb: CommandVerb;
  dedup_key: string;
  issued_at: string;
  expires_at: string;
  expected_watermark: number | null;
  /** Radens STARTVÄRDE i kön. Controllern äger fältet därefter. */
  status: CommandStatus;
};

export type CommandEnvelope =
  | { ok: true; result: "queued" | "already_queued"; command: AcceptedCommand }
  | { ok: false; reason: CommandFailReason; message: string; command_id: string | null };

export type CommandResponse = { status: number; body: CommandEnvelope };

/**
 * HTTP-status per orsak.
 *
 * 409 bär de tre avslagen som handlar om LÄGET, inte om formen: samma naturliga nyckel redan i
 * kö, ett föråldrat antagande och en utgången intention. 503 bär den stängda kanalen — den är
 * ett tillfälligt tillstånd i backenden, inte ett fel i förfrågan. Ingen av dem är 200: ett
 * kommando som inte köades får aldrig kunna misstas för ett som köades.
 */
export function httpStatusForCommandReason(reason: CommandFailReason): number {
  switch (reason) {
    case "method-not-allowed":
      return 405;
    case "wrong-origin":
      return 403;
    case "unsupported-media-type":
      return 415;
    case "payload-too-large":
      return 413;
    case "invalid-command":
      return 400;
    case "rate-limited":
      return 429;
    case "stale-watermark":
    case "expired":
    case "duplicate-dedup-key":
      return 409;
    case "queue-unavailable":
      return 503;
    case "unexpected":
      return 500;
  }
}

function refuse(
  reason: CommandFailReason,
  message: string,
  commandId: string | null = null,
): CommandResponse {
  return {
    status: httpStatusForCommandReason(reason),
    body: { ok: false, reason, message, command_id: commandId },
  };
}

function accepted(record: CommandRecord, result: "queued" | "already_queued"): CommandResponse {
  return {
    status: 200,
    body: {
      ok: true,
      result,
      command: {
        command_id: record.command_id,
        verb: record.verb,
        dedup_key: record.dedup_key,
        issued_at: record.issued_at,
        expires_at: record.expires_at,
        expected_watermark: record.expected_watermark,
        status: record.status,
      },
    },
  };
}

/** 401-kroppen. Identisk form som läsytans, och den avslöjar ingenting om kontrollplanet. */
export const COMMAND_UNAUTHORIZED_ENVELOPE: CommandEnvelope = Object.freeze({
  ok: false,
  reason: "invalid-command",
  message: "Ingen giltig session.",
  command_id: null,
});

/** 404-kroppen när LOOP_ENABLED är av. Ingen halv kommandoyta läcker ut. */
export const COMMAND_DISABLED_ENVELOPE: CommandEnvelope = Object.freeze({
  ok: false,
  reason: "invalid-command",
  message: "Maskinen är inte aktiverad.",
  command_id: null,
});

/** Ett kommandosvar cachas aldrig, av någon, någonstans. */
export const COMMAND_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "Cache-Control": "no-store",
});

/* ────────────────────────────────────────────────────────────────────────────
 * PORTEN IN — allt servern behöver, injicerat och därmed mätbart
 * ──────────────────────────────────────────────────────────────────────────── */

export type CommandGateway = {
  queue: CommandQueue;
  ledger: CommandLedger;
  limiter: RateLimiter;
  /** Serverklockan. Injicerad så att TTL och räknare kan mätas utan att vänta i realtid. */
  now: () => Date;
  /**
   * Controllerns senast publicerade `seq_watermark`, om det går att läsa. null = okänt.
   * Kopplas in av routen (läsytan), aldrig av den här filen — den rör ingen transport.
   */
  observedWatermark: () => Promise<number | null>;
};

export function createCommandGateway(overrides: Partial<CommandGateway> = {}): CommandGateway {
  return {
    queue: overrides.queue ?? blockedCommandQueue(),
    ledger: overrides.ledger ?? createCommandLedger(),
    limiter: overrides.limiter ?? createRateLimiter(),
    now: overrides.now ?? (() => new Date()),
    observedWatermark: overrides.observedWatermark ?? (async () => null),
  };
}

export type CommandContext = {
  /** Operatörens identitet UR SESSIONEN. Kroppen kan inte påstå den. */
  issued_by: string;
  gateway: CommandGateway;
};

/**
 * Hela kommandoytans beteende, i EN funktion och utan Next-beroenden — routen är ett skal som
 * gatar med auth() och lämnar över.
 *
 * ORDNINGEN ÄR EN DEL AV KONTRAKTET, och den är vald så att ett avslag aldrig kan lämna spår:
 *
 *   metod → origin → medietyp → storlek → JSON → SCHEMA → räknare(läs) → rad → ledger →
 *   stale → utgången → kö → ledger(skriv) + räknare(skriv)
 *
 * Ett sjätte verb faller i SCHEMA-steget: ingen ledgerrad, ingen förbrukad kvot, inget
 * köanrop, ingen läsning av kontrollplanet. Exakt planens "400 utan sidoeffekt".
 *
 * Funktionen kastar aldrig. Den loggar aldrig payloadvärden — den loggar över huvud taget inte.
 */
export async function handleCommandRequest(
  request: Request,
  context: CommandContext,
): Promise<CommandResponse> {
  const { gateway } = context;
  try {
    if (request.method.toUpperCase() !== COMMAND_METHOD) {
      return refuse("method-not-allowed", "Kommandoytan tar emot enbart POST.");
    }

    const origin = sameOriginVerdict(request.headers);
    if (!origin.ok) return refuse("wrong-origin", origin.message);

    const mediaType = jsonMediaTypeVerdict(request.headers);
    if (!mediaType.ok) return refuse("unsupported-media-type", mediaType.message);

    const body = await request.text();
    if (bodyByteLength(body) > COMMAND_MAX_BODY_BYTES) {
      return refuse(
        "payload-too-large",
        `Kommandokroppen får vara högst ${COMMAND_MAX_BODY_BYTES} byte.`,
      );
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(body) as unknown;
    } catch {
      return refuse("invalid-command", "Kommandokroppen är inte giltig JSON.");
    }

    // SCHEMAT ÄR GRINDEN. Ett sjätte verb, en payload som inte hör till verbet eller ett
    // extrafält faller här — före varje sidoeffekt. Strängen i en payload förblir en sträng.
    const validated = validateCommandRequest(parsedBody);
    if (!validated.ok) return refuse("invalid-command", validated.message);

    const { command_id: commandId, expected_watermark: expectedWatermark } = validated.data;
    const now = gateway.now();

    const budget = gateway.limiter.check(context.issued_by, now);
    if (!budget.allowed) {
      return refuse(
        "rate-limited",
        "För många kommandon under kort tid. Vänta en stund och försök igen.",
        commandId,
      );
    }

    const built = buildCommandRecord({
      command: validated.data.command,
      command_id: commandId,
      issued_by: context.issued_by,
      issued_at: now,
      expected_watermark: expectedWatermark,
    });
    if (!built.ok) return refuse("invalid-command", built.message, commandId);
    const record = built.record;

    // LAGER 2 · samma command_id igen ger samma svar och INGEN andra överlämning.
    const known = gateway.ledger.get(commandId);
    if (known !== null) return accepted(known.record, "already_queued");

    const inFlight = gateway.ledger.pendingByDedupKey(record.dedup_key, now);
    if (inFlight !== null) {
      return refuse("duplicate-dedup-key", "Kommandot är redan köat.", commandId);
    }

    // LAGER 3a · ett föråldrat antagande om läget avvisas. Kan bara refusera, aldrig fria.
    if (expectedWatermark !== null) {
      const observed = await gateway.observedWatermark();
      if (commandIsStale(expectedWatermark, observed)) {
        return refuse(
          "stale-watermark",
          "Avvisad: läget hade ändrats sedan kommandot skickades.",
          commandId,
        );
      }
    }

    // LAGER 3b · TTL mäts mot serverklockan EFTER varje väntan ovan.
    if (commandExpired(record, gateway.now())) {
      return refuse("expired", "Kommandot hann gå ut innan det kunde köas.", commandId);
    }

    const queued = await gateway.queue.enqueue(record);
    if (!queued.ok) {
      // Ingen ledgerrad, ingen förbrukad kvot: ingenting köades, så ett nytt försök är fritt.
      return refuse("queue-unavailable", queued.message, commandId);
    }

    if (queued.outcome === "duplicate_dedup_key") {
      return refuse("duplicate-dedup-key", "Kommandot är redan köat.", commandId);
    }

    gateway.ledger.remember({ record, outcome: queued.outcome });
    gateway.limiter.consume(context.issued_by, now);
    return accepted(record, queued.outcome === "queued" ? "queued" : "already_queued");
  } catch {
    // Ingen stacktrace, ingen payload, ingen nyckel. Bara felklassen.
    return refuse("unexpected", "Kommandot kunde inte behandlas.");
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * PRESENTATION — verb, status och den obligatoriska pausformuleringen
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Verbens svenska etiketter. `run.pause_at_safe_boundary` bär planens ORDAGRANNA formulering
 * ur labels.ts: "efter aktuell uppgift". Ingen etikett här påstår omedelbart stopp.
 */
export const COMMAND_VERB_LABELS: Readonly<Record<CommandVerb, string>> = Object.freeze({
  "intake.submit": "Lämna in källan",
  "run.start": "Starta körningen",
  "run.pause_at_safe_boundary": PAUSE_AT_SAFE_BOUNDARY_LABEL,
  "run.resume": "Återuppta körningen",
  inspect: "Inspektera",
});

/** Förklaringen som MÅSTE följa med pausen. Ingenting avbryts mitt i ett försök. */
export const COMMAND_VERB_EXPLANATIONS: Readonly<Partial<Record<CommandVerb, string>>> =
  Object.freeze({
    "run.pause_at_safe_boundary": PAUSE_AT_SAFE_BOUNDARY_EXPLANATION,
  });

export type CommandStatusPresentation = { label: string; tone: Tone };

/** Planens statuskedja: köad → hämtad av controllern → utförd / avvisad / utgången. */
export const COMMAND_STATUS_PRESENTATION: Readonly<
  Record<CommandStatus, CommandStatusPresentation>
> = Object.freeze({
  pending: { label: "köad", tone: "neutral" },
  claimed: { label: "hämtad av controllern", tone: "accent" },
  applied: { label: "utförd", tone: "success" },
  rejected: { label: "avvisad", tone: "danger" },
  expired: { label: "utgången", tone: "warning" },
});

/** Alla fem statuslägen har en presentation — mätbart, så inget läge kan glömmas. */
export function commandStatusCoverage(): boolean {
  return COMMAND_STATUSES.every((status) => Boolean(COMMAND_STATUS_PRESENTATION[status]));
}

/**
 * En rad i "senaste kommandon". Den bär KOMMANDOTS öde — aldrig en uppgifts tillstånd.
 * Fält som Verkstadsgolvet inte vet är null och renderas "—".
 */
export type CommandLogEntry = {
  command_id: string;
  verb: CommandVerb;
  /** Serverstämpel. null när kommandot aldrig kom så långt som till en rad. */
  issued_at: string | null;
  expires_at: string | null;
  /** Controllerns fält. null = Verkstadsgolvet vet inte, och gissar inte. */
  status: CommandStatus | null;
  /** Avslagets ORSAK, ordagrant. Skrivs aldrig om. */
  message: string | null;
  reason: CommandFailReason | null;
};

/**
 * Översätter routens svar till en loggrad. REN funktion: ingen klocka, ingen task-state och
 * ingen tolkning utöver det svaret faktiskt säger.
 */
export function commandLogEntry(
  verb: CommandVerb,
  commandId: string,
  envelope: CommandEnvelope,
): CommandLogEntry {
  if (envelope.ok) {
    return {
      command_id: envelope.command.command_id,
      verb: envelope.command.verb,
      issued_at: envelope.command.issued_at,
      expires_at: envelope.command.expires_at,
      status: envelope.command.status,
      message: null,
      reason: null,
    };
  }
  return {
    command_id: envelope.command_id ?? commandId,
    verb,
    issued_at: null,
    expires_at: null,
    status: null,
    message: envelope.message,
    reason: envelope.reason,
  };
}

/**
 * Hur en loggrad ska se ut just nu.
 *
 * En rad som fortfarande är `pending` när dess TTL passerat visas som UTGÅNGEN. Det är ingen
 * uppfunnen state: `expires_at` är serverns egen stämpel, och en utgången rad claimas per
 * kontrakt aldrig. Status i övrigt kommer ur controllern — den härleds aldrig här.
 */
export function commandLogPresentation(
  entry: CommandLogEntry,
  now: Date,
): CommandStatusPresentation & { verbatim: string | null } {
  if (entry.reason !== null) {
    return { ...COMMAND_STATUS_PRESENTATION.rejected, verbatim: entry.message };
  }
  if (entry.status === null) {
    return { label: "okänd", tone: "neutral", verbatim: null };
  }
  const expires = entry.expires_at === null ? Number.NaN : Date.parse(entry.expires_at);
  if (entry.status === "pending" && Number.isFinite(expires) && now.getTime() > expires) {
    return { ...COMMAND_STATUS_PRESENTATION.expired, verbatim: null };
  }
  return { ...COMMAND_STATUS_PRESENTATION[entry.status], verbatim: null };
}

/* ────────────────────────────────────────────────────────────────────────────
 * KLIENTENS SIDA — en intention, ett id, ett anrop
 * ──────────────────────────────────────────────────────────────────────────── */

export type CommandIntent = { command: Command; expected_watermark: number | null };

/** Kroppen klienten skickar. Ingen tid, ingen identitet, ingen status — servern äger dem. */
export function commandRequestBody(intent: CommandIntent, commandId: string): CommandRequest {
  return {
    command_id: commandId,
    expected_watermark: intent.expected_watermark,
    command: intent.command,
  };
}

/**
 * Anropets form. `same-origin` på credentials OCH på begäran: kommandoytan ska inte ens
 * försöka nås från en annan sida — och gör den det, avvisar servern den ändå (403).
 */
export function commandRequestInit(intent: CommandIntent, commandId: string): RequestInit {
  return {
    method: COMMAND_METHOD,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    mode: "same-origin",
    cache: "no-store",
    body: JSON.stringify(commandRequestBody(intent, commandId)),
  };
}

/** Nätet svarade inte. Då VET klienten ingenting — och säger det, i stället för att gissa. */
export const COMMAND_UNREACHABLE_MESSAGE =
  "Kommandot kunde inte skickas. Verkstadsgolvet vet inte om det nådde fram — läget visas när " +
  "controllern publicerar nästa snapshot.";

/**
 * Läser routens svar UTAN att lita på HTTP-statusen ensam: en utloggad session svarar med en
 * redirect eller HTML, och då är rätt svar en ärlig rad om att sessionen gick ut — aldrig ett
 * tyst antagande om att kommandot gick fram.
 */
export function readCommandEnvelope(body: unknown): CommandEnvelope {
  if (body !== null && typeof body === "object" && "ok" in body) {
    const candidate = body as { ok: unknown };
    if (candidate.ok === true || candidate.ok === false) return body as CommandEnvelope;
  }
  return {
    ok: false,
    reason: "unexpected",
    message: "Sessionen gick ut eller svaret var inte ett kommandosvar — ladda om sidan.",
    command_id: null,
  };
}

/** Hur ett anrop faktiskt görs. Injicerbar så att dubbelklicket kan MÄTAS utan en webbläsare. */
export type CommandSender = (input: string, init: RequestInit) => Promise<unknown>;

/**
 * Klientens halva av idempotensen. Ren logik, ingen DOM, inget React — och därmed mätbar.
 *
 * REGELN, som ÄR dubbelklickskyddet:
 * · Ett `command_id` genereras EN gång per intention och återanvänds vid varje nytt försök.
 *   Ett avslag byter aldrig id: en retry är samma kommando, aldrig ett andra.
 * · Ett anrop åt gången. Ett klick medan ett anrop pågår IGNORERAS (returnerar null) — det
 *   blir alltså inte ens ett andra anrop att deduplicera.
 * · Först när intentionen KÖATS släpps id:t. Ett senare, avsiktligt klick är då en ny
 *   intention — och servern avvisar den ändå om den förra fortfarande ligger i kön
 *   (dedup_key är unik bland icke-terminala rader).
 *
 * Ingen rad här ändrar en uppgifts tillstånd. Den returnerar kommandots eget öde.
 */
export type IntentDispatcher = {
  dispatch: (intent: CommandIntent) => Promise<CommandLogEntry | null>;
  inFlight: () => boolean;
  /** Det id nästa försök skulle använda. null = intentionen har inget öppet kommando. */
  commandId: () => string | null;
};

export function createIntentDispatcher(options: {
  send: CommandSender;
  newCommandId: () => string;
}): IntentDispatcher {
  let commandId: string | null = null;
  let busy = false;

  return {
    inFlight: () => busy,
    commandId: () => commandId,
    dispatch: async (intent) => {
      if (busy) return null;
      if (commandId === null) commandId = options.newCommandId();
      const id = commandId;
      busy = true;
      try {
        let envelope: CommandEnvelope;
        try {
          envelope = readCommandEnvelope(
            await options.send(COMMAND_ENDPOINT, commandRequestInit(intent, id)),
          );
        } catch {
          envelope = {
            ok: false,
            reason: "unexpected",
            message: COMMAND_UNREACHABLE_MESSAGE,
            command_id: id,
          };
        }
        const entry = commandLogEntry(intent.command.verb, id, envelope);
        if (entry.reason === null) commandId = null;
        return entry;
      } finally {
        busy = false;
      }
    },
  };
}
