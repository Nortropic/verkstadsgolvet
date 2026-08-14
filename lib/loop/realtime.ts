/**
 * V9 · Realtid, reconnect och dedup — klientens tail-butik och dess anslutningsmaskin.
 *
 * AUKTORITATIV KÄLLA: docs/nortropic-control-room-plan-v1.md — REALTIME (transport, ordning,
 * dedup, reconnect, gap, stale, okänd typ, schema-bump, synlighet), EVENT_CLIENT (Set med tak
 * + seq-baserad low-water, backoff 1→30 s med jitter), ERROR_EMPTY_RECONNECT_STATES och
 * IMPLEMENTATION_SLICES §V9.
 *
 * BINDANDE REGLER SOM DENNA FIL BÄR MEKANISKT
 * -------------------------------------------
 * · DEDUP PÅ `event_id`, ALDRIG på `seq`. Två rader som delar seq men har olika event_id är
 *   två rader och rapporteras som en SYNLIG varning av V3:s projektion — aldrig som en tyst
 *   overwrite. En dubblett ger ingen andra rad och ingen state-ändring.
 * · RECONNECT_CURSOR är HÖGSTA SEQ SETT I BUTIKEN — aldrig per run. Den regredierar aldrig,
 *   inte ens när äldre rader vräks ur minnet.
 * · ORDNING på `seq` ensamt (B3). `ts` och ankomstordningen ordnar aldrig. En omkastad eller
 *   dubblerad leverans ger därför samma sluttillstånd som en ordnad.
 * · GAP-DETEKTION endast på den OFILTRERADE butiksströmmen; en run-/task-filtrerad vy har
 *   legitima hopp och larmar aldrig. Regeln ägs av V3:s projectEvents och byggs inte om här.
 * · UI:T PÅSTÅR ALDRIG REALTID NÄR DET POLLAR. `realtime` är sant i EXAKT ett läge — `live`,
 *   och `live` sätts först när strömmen faktiskt har öppnats. Backoff, poll-fallback, paus och
 *   återanslutning bär alla `realtime: false` och en egen synlig etikett.
 * · Okänd `event_type` och nyare major `schema_version` passerar utan att kasta: klassificering
 *   och banner kommer ur V1/V3 och den här filen lägger ingen egen semantik ovanpå.
 * · INGEN AUTHORITY. Butiken bär eventrader — aktivitet och bevis. Auktoritativ task-state,
 *   DONE, verdict, attestation och promotion kommer ur controllerns snapshot (SNAPSHOT_WINS).
 *
 * VAD DENNA FIL ALDRIG GÖR
 * ------------------------
 * Ingen I/O. Ingen fetch, ingen EventSource, ingen timer, ingen klocka, ingen slump, ingen
 * DOM, ingen Supabase, ingen env-läsning. Allt sådant kommer in som INJICERADE PORTAR, så att
 * hela reconnect-, backfill- och fallback-beteendet kan mätas utan att en socket öppnas.
 * Filen är klientsäker: den importerar aldrig lib/loop/transport.ts.
 */
import {
  compareBySeq,
  validateEvents,
  type LoopEvent,
  type SchemaSupport,
} from "./schema";
import {
  projectEvents,
  stableStringify,
  type SeqGap,
  type StreamScope,
  type StreamView,
} from "./events";
import type { Tone } from "./labels";

/* ────────────────────────────────────────────────────────────────────────────
 * LÅSTA REGLER — planens REALTIME-block som greppbar data
 * ──────────────────────────────────────────────────────────────────────────── */

export const REALTIME_RULES = {
  TRANSPORT: "SSE_FROM_API_LOOP_STREAM",
  FALLBACK: "CLIENT_POLL_API_LOOP_EVENTS",
  ORDERING_KEY: "seq",
  TS_IS_ORDERING: false,
  ARRIVAL_ORDER_IS_ORDERING: false,
  DEDUP_KEY: "event_id",
  DEDUP_ON_SEQ: false,
  RECONNECT_CURSOR: "HIGHEST_SEQ_SEEN_IN_STORE",
  RECONNECT_CURSOR_IS_PER_RUN: false,
  GAP_DETECTION_SCOPE: "UNFILTERED_STORE_STREAM_ONLY",
  /** Ett tail-event flyttar ingen lifecycle-state. Det gäller oavsett transportläge. */
  EVENT_STREAM_IS_AUTHORITY: false,
  /** Endast läget `live` får kallas realtid. Allt annat märks ut som det det är. */
  CLAIMS_REALTIME_WHILE_POLLING: false,
  UNKNOWN_EVENT_TYPE: "RENDERED_RAW_NO_SEMANTICS_NO_CRASH",
  NEWER_MAJOR_SCHEMA: "BANNER_TAIL_STOPS_DERIVING_SNAPSHOT_KEEPS_RENDERING",
} as const;

/** Dedup-Setets tak. Planens exempel: "t.ex. 5 000 senaste" + seq-baserad low-water för äldre. */
export const TAIL_DEDUP_CAP = 5000;

/** Poll-fallbackens intervall. Planen: "klientpoll … var 5:e sekund". */
export const POLL_INTERVAL_MS = 5000;

/** Backoff 1 s → 30 s med jitter (EVENT_CLIENT · reconnect). */
export const BACKOFF_MIN_MS = 1000;
export const BACKOFF_MAX_MS = 30000;

/** Dokumentet dolt → strömmen pausas efter 60 s, återupptas med backfill vid fokus. */
export const HIDDEN_PAUSE_AFTER_MS = 60000;

/** Backfillfönstrets storlek och hur många fönster en enskild backfill drar innan tail tar vid. */
export const BACKFILL_PAGE_LIMIT = 200;
export const BACKFILL_MAX_PAGES = 10;

/**
 * Efter så här många strömfel i rad märks läget som POLL i UI:t. Ett enstaka avbrott ska inte
 * skrika "poll" när återanslutningen redan är på väg — men två i rad är ett läge operatören
 * ska se, och då pollar vi också på riktigt i stället för att stå still.
 */
export const POLL_FALLBACK_AFTER_ATTEMPTS = 2;

/* ────────────────────────────────────────────────────────────────────────────
 * BACKOFF — ren funktion, slumpen injiceras
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Exponentiell backoff med jitter. `attempt` är antalet misslyckanden I RAD (1 = första).
 *
 * Jittern är HALV: fördröjningen ligger i [bas/2, bas]. Full jitter (0…bas) hade kunnat ge en
 * ny anslutning efter någon millisekund och därmed hamra en redan trasig transport; halv
 * jitter sprider ändå flikar och klienter åt varandra. Slumpen kommer in som port, så provet
 * kan mäta både golvet och taket exakt.
 */
export function nextBackoffDelay(attempt: number, random: () => number): number {
  const step = Math.max(1, Math.floor(attempt));
  const exponent = Math.min(step - 1, 30);
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** exponent);
  const spread = base / 2;
  const jitter = Math.min(Math.max(random(), 0), 1) * spread;
  return Math.round(spread + jitter);
}

/* ────────────────────────────────────────────────────────────────────────────
 * TAIL-BUTIKEN — dedup på event_id, tak + low-water, cursor som aldrig regredierar
 * ──────────────────────────────────────────────────────────────────────────── */

/** Var raderna kom ifrån. Rapport om LEVERANSEN — aldrig något som ändrar utfallet. */
export type TailIngestSource = "backfill" | "stream" | "poll";

export type TailIngestOutcome = {
  source: TailIngestSource;
  received: number;
  /** Nya rader som faktiskt lades till butiken. */
  admitted: number;
  /** Samma event_id igen. Ingen andra rad, ingen state-ändring. */
  duplicates: number;
  /**
   * event_id som inte längre finns i minnet OCH vars seq ligger under low-water. De räknas som
   * redan sedda — det är low-watermärkets hela syfte — och rapporteras så att en verklig
   * bakåtgående leverans syns i stället för att försvinna tyst.
   */
  below_low_water: number;
  invalid: { index: number; message: string }[];
  /** Butikens reconnect-cursor EFTER leveransen. */
  cursor: number | null;
};

export type TailStoreStats = {
  retained: number;
  cap: number;
  /** Högsta seq som vräkts ur minnet. Allt ≤ detta räknas som redan sett. */
  low_water_seq: number | null;
  /** RECONNECT_CURSOR: högsta seq sett i BUTIKEN. Regredierar aldrig. */
  cursor: number | null;
  evicted: number;
  admitted: number;
  duplicates: number;
  below_low_water: number;
  invalid: number;
};

export type TailStoreOptions = {
  /** Default TAIL_DEDUP_CAP. */
  cap?: number;
  /** "store" = ofiltrerad butiksström (gap-detektion PÅ). "filtered" = aldrig gap-larm (B3). */
  scope?: StreamScope;
  /** Snapshotens watermark. Event ≤ detta är `stale` och bidrar aldrig med fas. */
  seq_watermark?: number | null;
  /** Känd baslinje för gap-detektion (fönstrets `after_seq` vid första hämtningen). */
  expected_after_seq?: number | null;
};

export type TailStore = {
  ingest: (input: unknown, source: TailIngestSource) => TailIngestOutcome;
  /** Butikens projicerade vy (V3). Memoiserad: samma referens tills något faktiskt ändrats. */
  view: () => StreamView;
  cursor: () => number | null;
  stats: () => TailStoreStats;
  setWatermark: (watermark: number | null) => void;
  /** Ökar vid varje faktisk ändring. Används av React-bindningen, aldrig av logiken. */
  version: () => number;
};

/**
 * Deterministiskt val mellan två leveranser av SAMMA event_id. Samma regel som V3:s dedup:
 * seq först, därefter kanonisk form. Utfallet blir därmed oberoende av ankomstordningen —
 * "senast vinner" hade gjort butiken till en funktion av nätverket i stället för av data.
 */
function canonicalOf(a: LoopEvent, b: LoopEvent): LoopEvent {
  const bySeq = compareBySeq(a, b);
  if (bySeq !== 0) return bySeq <= 0 ? a : b;
  return stableStringify(a) <= stableStringify(b) ? a : b;
}

export function createTailStore(options: TailStoreOptions = {}): TailStore {
  const cap = Math.max(1, options.cap ?? TAIL_DEDUP_CAP);
  const scope: StreamScope = options.scope ?? "store";
  const baseline = options.expected_after_seq ?? null;

  /** event_id → event. Nyckeln ÄR dedup-nyckeln; en seq-kollision överlever därför som två rader. */
  const retained = new Map<string, LoopEvent>();
  let lowWaterSeq: number | null = null;
  let cursorSeq: number | null = null;
  let watermark: number | null = options.seq_watermark ?? null;
  let version = 0;

  let evicted = 0;
  let admittedTotal = 0;
  let duplicateTotal = 0;
  let belowLowWaterTotal = 0;
  let invalidTotal = 0;

  let cachedView: StreamView | null = null;
  let cachedVersion = -1;

  function evictIfNeeded(): void {
    if (retained.size <= cap) return;
    const ordered = [...retained.values()].sort(
      (a, b) => compareBySeq(a, b) || (a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0),
    );
    const surplus = retained.size - cap;
    for (let index = 0; index < surplus; index += 1) {
      const victim = ordered[index];
      retained.delete(victim.event_id);
      evicted += 1;
      lowWaterSeq = lowWaterSeq === null ? victim.seq : Math.max(lowWaterSeq, victim.seq);
    }
  }

  function ingest(input: unknown, source: TailIngestSource): TailIngestOutcome {
    const batch = validateEvents(input);
    let admitted = 0;
    let duplicates = 0;
    let belowLowWater = 0;

    for (const validated of batch.valid) {
      const event = validated.event;
      const known = retained.get(event.event_id);
      if (known !== undefined) {
        duplicates += 1;
        // Två leveranser av samma id som SKILJER SIG i innehåll: kanonisk form väljs på data,
        // aldrig på ankomstordning. Raden blir ändå bara EN rad.
        const winner = canonicalOf(known, event);
        if (winner !== known) {
          retained.set(event.event_id, winner);
          version += 1;
        }
        continue;
      }
      if (lowWaterSeq !== null && event.seq <= lowWaterSeq) {
        belowLowWater += 1;
        continue;
      }
      retained.set(event.event_id, event);
      admitted += 1;
      version += 1;
      cursorSeq = cursorSeq === null ? event.seq : Math.max(cursorSeq, event.seq);
    }

    if (admitted > 0) evictIfNeeded();

    admittedTotal += admitted;
    duplicateTotal += duplicates;
    belowLowWaterTotal += belowLowWater;
    invalidTotal += batch.invalid.length;

    return {
      source,
      received: Array.isArray(input) ? input.length : 0,
      admitted,
      duplicates,
      below_low_water: belowLowWater,
      invalid: batch.invalid,
      cursor: cursorSeq,
    };
  }

  function view(): StreamView {
    if (cachedView !== null && cachedVersion === version) return cachedView;
    // Baslinjen för gap-detektion är den SENARE av fönstrets kända start och low-water: rader
    // som vräkts ur minnet är sedda, inte saknade, och ska inte larma som lucka.
    const expectedAfterSeq =
      baseline === null
        ? lowWaterSeq
        : lowWaterSeq === null
          ? baseline
          : Math.max(baseline, lowWaterSeq);
    const projection = projectEvents([...retained.values()], {
      scope,
      seq_watermark: watermark,
      expected_after_seq: expectedAfterSeq,
    });
    cachedView = projection.stream;
    cachedVersion = version;
    return cachedView;
  }

  return {
    ingest,
    view,
    cursor: () => cursorSeq,
    stats: () => ({
      retained: retained.size,
      cap,
      low_water_seq: lowWaterSeq,
      cursor: cursorSeq,
      evicted,
      admitted: admittedTotal,
      duplicates: duplicateTotal,
      below_low_water: belowLowWaterTotal,
      invalid: invalidTotal,
    }),
    setWatermark: (next: number | null) => {
      if (next === watermark) return;
      watermark = next;
      version += 1;
    },
    version: () => version,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * TRANSPORTLÄGE — ETT läge får kallas realtid
 * ──────────────────────────────────────────────────────────────────────────── */

export const TRANSPORT_MODES = [
  "idle",
  "connecting",
  "live",
  "reconnecting",
  "polling",
  "paused",
  "stopped",
] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export type TransportPresentation = {
  label: string;
  detail: string;
  tone: Tone;
  /** SANT ENDAST för `live`. Planens negativa kontroll: "UI som påstår realtid när det pollar". */
  realtime: boolean;
};

/**
 * Lägenas presentation. Etiketterna är medvetet formulerade så att INGEN av dem kan läsas som
 * ett realtidspåstående utom `live` — varken "ansluter", "återansluter" eller "poll" lovar en
 * öppen ström, och poll-läget säger rakt ut att det inte är en direktström.
 */
export const TRANSPORT_PRESENTATION: Readonly<Record<TransportMode, TransportPresentation>> =
  Object.freeze({
    idle: {
      label: "Inte ansluten",
      detail: "Strömmen har inte öppnats i den här vyn ännu.",
      tone: "neutral",
      realtime: false,
    },
    connecting: {
      label: "Ansluter",
      detail: "Hämtar backfill och öppnar strömmen. Inget läge påstås förrän den är öppen.",
      tone: "neutral",
      realtime: false,
    },
    live: {
      label: "Direktström",
      detail: "Strömmen är öppen och levererar tail.",
      tone: "accent",
      realtime: true,
    },
    reconnecting: {
      label: "Återansluter",
      detail: "Strömmen bröts. Backfill hämtas från senast sedda seq innan tail återupptas.",
      tone: "warning",
      realtime: false,
    },
    polling: {
      label: "Poll — inte direktström",
      detail:
        "Strömmen är nere. Vyn hämtar nya event med jämna mellanrum och kan därför ligga efter.",
      tone: "warning",
      realtime: false,
    },
    paused: {
      label: "Pausad",
      detail: "Fliken var dold. Strömmen återupptas med backfill när vyn får fokus igen.",
      tone: "neutral",
      realtime: false,
    },
    stopped: {
      label: "Stoppad",
      detail: "Strömmen är stängd i den här vyn.",
      tone: "neutral",
      realtime: false,
    },
  });

/** true = läget FÅR kallas realtid. Enda sanna läget är `live`. */
export function claimsRealtime(mode: TransportMode): boolean {
  return TRANSPORT_PRESENTATION[mode].realtime;
}

/* ────────────────────────────────────────────────────────────────────────────
 * PORTAR — allt som rör omvärlden injiceras
 * ──────────────────────────────────────────────────────────────────────────── */

export type StreamHandlers = {
  /** Anslutningen är faktiskt öppen. Först här får läget bli `live`. */
  onOpen: () => void;
  /** Ett event ur tail. Rådata — valideras av butiken, aldrig av porten. */
  onEvent: (data: unknown) => void;
  /** Avbrott, fel eller serverstängning. Meddelandet visas ordagrant. */
  onError: (message: string) => void;
};

export type StreamHandle = { close: () => void };

export type StreamPort = (args: {
  after_seq: number | null;
  handlers: StreamHandlers;
}) => StreamHandle;

export type WindowPage = { events: unknown[]; may_have_more: boolean };

export type WindowPort = (args: {
  after_seq: number | null;
  limit: number;
}) => Promise<{ ok: true; page: WindowPage } | { ok: false; message: string }>;

export type TailPorts = {
  openStream: StreamPort;
  fetchWindow: WindowPort;
  now: () => number;
  random: () => number;
  setTimer: (ms: number, run: () => void) => number;
  clearTimer: (id: number) => void;
};

/* ────────────────────────────────────────────────────────────────────────────
 * ANSLUTNINGSMASKINEN
 * ──────────────────────────────────────────────────────────────────────────── */

export type TailConnectionState = {
  mode: TransportMode;
  /** Spegel av TRANSPORT_PRESENTATION[mode].realtime. Bärs i state så vyn inte kan gissa fel. */
  realtime: boolean;
  /** Misslyckanden I RAD. Nollställs först när strömmen faktiskt öppnats. */
  attempt: number;
  last_error: string | null;
  /** Planerad väntetid till nästa försök (backoff + jitter), null när inget är schemalagt. */
  next_retry_in_ms: number | null;
  live_since: number | null;
  polling_since: number | null;
  /** Butikens reconnect-cursor: högsta seq sett i BUTIKEN. */
  cursor: number | null;
  backfilling: boolean;
  visibility: "visible" | "hidden";
  counts: {
    stream_opens: number;
    stream_errors: number;
    backfill_pages: number;
    polls: number;
    poll_errors: number;
  };
};

export type TailSnapshot = {
  connection: TailConnectionState;
  stream: StreamView;
  stats: TailStoreStats;
};

export type TailConnection = {
  start: () => void;
  stop: () => void;
  setVisibility: (visibility: "visible" | "hidden") => void;
  setWatermark: (watermark: number | null) => void;
  snapshot: () => TailSnapshot;
  subscribe: (listener: () => void) => () => void;
  store: TailStore;
};

export type TailConnectionOptions = {
  ports: TailPorts;
  store?: TailStore;
  storeOptions?: TailStoreOptions;
  backfillPageLimit?: number;
  backfillMaxPages?: number;
  pollIntervalMs?: number;
  hiddenPauseAfterMs?: number;
  pollFallbackAfterAttempts?: number;
};

/**
 * Anslutningsmaskinen: backfill → tail, avbrott → backoff → backfill → tail, upprepade avbrott
 * → SYNLIG poll-fallback, dold flik → paus efter 60 s → backfill vid fokus.
 *
 * TVÅ EGENSKAPER SOM ÄR HELA POÄNGEN, OCH SOM PROVET MÄTER:
 * · INGET EVENT TAPPAS. Varje ny anslutning och varje poll börjar på butikens cursor, alltså
 *   högsta seq som faktiskt setts. Ett avbrott mitt i en sekvens fylls av backfill innan tail
 *   återupptas — luckan syns dessutom i vyn tills den är fylld.
 * · INGEN DUBBLETT SLÄPPS IGENOM. Backfill och tail överlappar med flit (hellre samma event
 *   två gånger än ett tappat), och dedupen på event_id gör överlappet till noll extra rader.
 *
 * Maskinen påstår ALDRIG realtid utan öppen ström: `live` sätts i onOpen och lämnas vid
 * första fel. Under poll-fallback står läget kvar på `polling` även medan en återanslutning
 * pågår — annars hade en misslyckad återanslutning blinkat förbi som "ansluten".
 */
export function createTailConnection(options: TailConnectionOptions): TailConnection {
  const ports = options.ports;
  const store = options.store ?? createTailStore(options.storeOptions);
  const pageLimit = options.backfillPageLimit ?? BACKFILL_PAGE_LIMIT;
  const maxPages = options.backfillMaxPages ?? BACKFILL_MAX_PAGES;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const hiddenPauseAfterMs = options.hiddenPauseAfterMs ?? HIDDEN_PAUSE_AFTER_MS;
  const fallbackAfter = options.pollFallbackAfterAttempts ?? POLL_FALLBACK_AFTER_ATTEMPTS;

  let mode: TransportMode = "idle";
  let attempt = 0;
  let lastError: string | null = null;
  let nextRetryInMs: number | null = null;
  let liveSince: number | null = null;
  let pollingSince: number | null = null;
  let backfilling = false;
  let visibility: "visible" | "hidden" = "visible";
  const counts = {
    stream_opens: 0,
    stream_errors: 0,
    backfill_pages: 0,
    polls: 0,
    poll_errors: 0,
  };

  let handle: StreamHandle | null = null;
  let retryTimer: number | null = null;
  let pollTimer: number | null = null;
  let pollInFlight = false;
  let pauseTimer: number | null = null;
  let running = false;
  /** Varje anslutningsförsök bär en generation: svar från en stängd omgång ignoreras. */
  let generation = 0;

  const listeners = new Set<() => void>();
  let cachedSnapshot: TailSnapshot | null = null;
  let connectionVersion = 0;
  let cachedFor = -1;
  let cachedStoreVersion = -1;

  function emit(): void {
    connectionVersion += 1;
    for (const listener of listeners) listener();
  }

  function setMode(next: TransportMode): void {
    if (mode === next) return;
    mode = next;
    if (next !== "live") liveSince = null;
    if (next !== "polling") pollingSince = null;
  }

  function clear(timer: number | null): null {
    if (timer !== null) ports.clearTimer(timer);
    return null;
  }

  function closeStream(): void {
    if (handle === null) return;
    const open = handle;
    handle = null;
    open.close();
  }

  /* ── Backfill ──────────────────────────────────────────────────────────── */

  /**
   * Hämtar fönster från butikens cursor tills strömmen är ikapp eller taket nås. Taket är
   * inte en avkortning av historiken: tail fortsätter från exakt samma cursor, så resten
   * levereras av strömmen i stället — inget hoppas över.
   */
  async function backfill(myGeneration: number): Promise<boolean> {
    backfilling = true;
    emit();
    try {
      for (let page = 0; page < maxPages; page += 1) {
        const before = store.cursor();
        const result = await ports.fetchWindow({ after_seq: before, limit: pageLimit });
        if (myGeneration !== generation || !running) return false;
        if (!result.ok) {
          lastError = result.message;
          return false;
        }
        counts.backfill_pages += 1;
        store.ingest(result.page.events, "backfill");
        emit();
        if (!result.page.may_have_more) return true;
        // Skydd mot en oändlig slinga när fönstret säger "mer finns" men cursorn inte flyttar.
        if (store.cursor() === before) return true;
      }
      return true;
    } finally {
      backfilling = false;
    }
  }

  /* ── Ström ─────────────────────────────────────────────────────────────── */

  function openStream(myGeneration: number): void {
    if (!running || myGeneration !== generation) return;
    const after = store.cursor();
    /**
     * En port får rapportera fel SYNKRONT, innan handtaget ens har returnerats (t.ex. en miljö
     * utan EventSource). Felet parkeras då här och hanteras när handtaget finns — annars hade
     * `closeStream()` kört på ett handtag som ännu inte var satt, och en död anslutning hade
     * blivit kvar utan att någon stängde den.
     */
    const early: { message: string | null } = { message: null };
    let assigned = false;
    const created = ports.openStream({
      after_seq: after,
      handlers: {
        onOpen: () => {
          if (myGeneration !== generation || !running) return;
          counts.stream_opens += 1;
          attempt = 0;
          lastError = null;
          nextRetryInMs = null;
          stopPolling();
          liveSince = ports.now();
          setMode("live");
          emit();
        },
        onEvent: (data: unknown) => {
          if (myGeneration !== generation || !running) return;
          store.ingest([data], "stream");
          emit();
        },
        onError: (message: string) => {
          if (myGeneration !== generation || !running) return;
          if (!assigned) {
            early.message = message;
            return;
          }
          failStream(message);
        },
      },
    });
    handle = created;
    assigned = true;
    if (early.message !== null) {
      const message = early.message;
      early.message = null;
      failStream(message);
      return;
    }
    emit();
  }

  function failStream(message: string): void {
    counts.stream_errors += 1;
    lastError = message;
    closeStream();
    generation += 1;
    attempt += 1;
    if (attempt >= fallbackAfter) startPolling();
    else setMode("reconnecting");
    scheduleRetry();
    emit();
  }

  function scheduleRetry(): void {
    retryTimer = clear(retryTimer);
    const delay = nextBackoffDelay(attempt, ports.random);
    nextRetryInMs = delay;
    retryTimer = ports.setTimer(delay, () => {
      retryTimer = null;
      nextRetryInMs = null;
      void connect();
    });
  }

  /**
   * En omgång: backfill från cursor, sedan tail. Misslyckas backfillen räknas det som ett
   * försök till och nästa omgång schemaläggs — vi går aldrig vidare till tail på ett okänt
   * läge, eftersom tail då hade startat från en cursor vi inte vet är sann.
   */
  async function connect(): Promise<void> {
    if (!running) return;
    generation += 1;
    const myGeneration = generation;
    if (mode !== "polling") setMode("connecting");
    emit();

    const filled = await backfill(myGeneration);
    if (!running || myGeneration !== generation) return;
    if (!filled) {
      attempt += 1;
      if (attempt >= fallbackAfter) startPolling();
      else setMode("reconnecting");
      scheduleRetry();
      emit();
      return;
    }
    openStream(myGeneration);
  }

  /* ── Poll-fallback ─────────────────────────────────────────────────────── */

  function startPolling(): void {
    if (pollingSince === null) pollingSince = ports.now();
    setMode("polling");
    schedulePoll();
  }

  /**
   * EN pollkedja åt gången. Utan den här grinden hade ett strömfel MITT I en pågående poll
   * startat en andra kedja, och fallback-läget hade pollat i dubbel takt utan att någon
   * bett om det.
   */
  function schedulePoll(): void {
    if (pollTimer !== null || pollInFlight) return;
    pollTimer = ports.setTimer(pollIntervalMs, () => {
      pollTimer = null;
      void poll();
    });
  }

  async function poll(): Promise<void> {
    if (!running || mode !== "polling") return;
    pollInFlight = true;
    try {
      const result = await ports.fetchWindow({ after_seq: store.cursor(), limit: pageLimit });
      if (!running || mode !== "polling") return;
      if (result.ok) {
        counts.polls += 1;
        store.ingest(result.page.events, "poll");
      } else {
        counts.poll_errors += 1;
        lastError = result.message;
      }
      emit();
    } finally {
      pollInFlight = false;
    }
    if (running && mode === "polling") schedulePoll();
  }

  function stopPolling(): void {
    pollTimer = clear(pollTimer);
    pollingSince = null;
  }

  /* ── Synlighet ─────────────────────────────────────────────────────────── */

  function setVisibility(next: "visible" | "hidden"): void {
    if (visibility === next) return;
    visibility = next;
    if (next === "hidden") {
      pauseTimer = clear(pauseTimer);
      pauseTimer = ports.setTimer(hiddenPauseAfterMs, () => {
        pauseTimer = null;
        if (!running) return;
        generation += 1;
        closeStream();
        stopPolling();
        retryTimer = clear(retryTimer);
        nextRetryInMs = null;
        setMode("paused");
        emit();
      });
      emit();
      return;
    }
    pauseTimer = clear(pauseTimer);
    if (running && mode === "paused") {
      // Återupptagning sker ALLTID via backfill från cursor: pausen får inte kosta ett event.
      attempt = 0;
      void connect();
    }
    emit();
  }

  /* ── Livscykel ─────────────────────────────────────────────────────────── */

  function start(): void {
    if (running) return;
    running = true;
    attempt = 0;
    lastError = null;
    void connect();
  }

  function stop(): void {
    running = false;
    generation += 1;
    closeStream();
    retryTimer = clear(retryTimer);
    pauseTimer = clear(pauseTimer);
    stopPolling();
    nextRetryInMs = null;
    setMode("stopped");
    emit();
  }

  function connectionState(): TailConnectionState {
    return {
      mode,
      realtime: claimsRealtime(mode),
      attempt,
      last_error: lastError,
      next_retry_in_ms: nextRetryInMs,
      live_since: liveSince,
      polling_since: pollingSince,
      cursor: store.cursor(),
      backfilling,
      visibility,
      counts: { ...counts },
    };
  }

  function snapshot(): TailSnapshot {
    const storeVersion = store.version();
    if (
      cachedSnapshot !== null &&
      cachedFor === connectionVersion &&
      cachedStoreVersion === storeVersion
    ) {
      return cachedSnapshot;
    }
    cachedSnapshot = {
      connection: connectionState(),
      stream: store.view(),
      stats: store.stats(),
    };
    cachedFor = connectionVersion;
    cachedStoreVersion = storeVersion;
    return cachedSnapshot;
  }

  return {
    start,
    stop,
    setVisibility,
    setWatermark: (watermark: number | null) => {
      store.setWatermark(watermark);
      emit();
    },
    snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    store,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * NOTISER — planens ordagranna lägen, härledda ur vyn
 * ──────────────────────────────────────────────────────────────────────────── */

export type TailNoticeId =
  | "schema_ahead"
  | "seq_gap"
  | "seq_collision"
  | "polling"
  | "reconnecting"
  | "paused"
  | "transport_error";

export type TailNotice = {
  id: TailNoticeId;
  tone: Tone;
  text: string;
  /** Extra rad med ordagrann orsak eller intervall. null = inget mer att säga. */
  detail: string | null;
};

/** "seq 412–417" respektive "seq 412". Intervallet skrivs aldrig om till ett antal. */
export function gapLabel(gap: SeqGap): string {
  return gap.from === gap.to ? `seq ${gap.from}` : `seq ${gap.from}–${gap.to}`;
}

/**
 * Vyns synliga lägen, i den ordning de ska läsas. Texterna är planens:
 * · nyare major → "Nyare eventschema än detta gränssnitt känner till"
 * · lucka → "Lucka i strömmen (seq 412–417) — hämtar"
 * · poll → uttrycklig markering att läget INTE är en ström.
 *
 * Ingen notis påstår att något är åtgärdat, och ingen döljer en lucka.
 */
export function tailNotices(snapshot: TailSnapshot): TailNotice[] {
  const notices: TailNotice[] = [];
  const { connection, stream } = snapshot;

  if (stream.schema_banner) {
    notices.push({
      id: "schema_ahead",
      tone: "warning",
      text: "Nyare eventschema än detta gränssnitt känner till",
      detail:
        "Strömmen visas rå och tail slutar härleda fas. Controllerns snapshot renderas vidare.",
    });
  }

  for (const gap of stream.gaps) {
    notices.push({
      id: "seq_gap",
      tone: "warning",
      text: `Lucka i strömmen (${gapLabel(gap)}) — hämtar`,
      detail: null,
    });
  }

  if (stream.seq_collisions.length > 0) {
    notices.push({
      id: "seq_collision",
      tone: "danger",
      text: "Två event delar samma seq i strömmen",
      detail:
        "Båda raderna visas — ingen skrivs över. Det är ett backendfel och ska rapporteras, " +
        "inte tolkas här.",
    });
  }

  if (connection.mode === "polling") {
    notices.push({
      id: "polling",
      tone: "warning",
      text: "Direktströmmen är nere — vyn pollar",
      detail: TRANSPORT_PRESENTATION.polling.detail,
    });
  } else if (connection.mode === "reconnecting") {
    notices.push({
      id: "reconnecting",
      tone: "warning",
      text: "Strömmen bröts — återansluter",
      detail: TRANSPORT_PRESENTATION.reconnecting.detail,
    });
  } else if (connection.mode === "paused") {
    notices.push({
      id: "paused",
      tone: "neutral",
      text: "Strömmen är pausad medan vyn är dold",
      detail: TRANSPORT_PRESENTATION.paused.detail,
    });
  }

  if (connection.last_error !== null) {
    notices.push({
      id: "transport_error",
      tone: "warning",
      text: "Senaste transportsvar",
      detail: connection.last_error,
    });
  }

  return notices;
}

/** Schemastöd som kräver banner. Speglar V1:s regel utan att bygga om den. */
export function rowSchemaIsAhead(support: SchemaSupport): boolean {
  return support === "ahead_major";
}

/**
 * De rader vyn faktiskt renderar: de `limit` NYASTE, i seq-ordning. Avkortningen är
 * presentation och rapporteras ärligt av den som renderar — ingen rad tas bort ur butiken,
 * och ingen rad hoppas över tyst.
 */
export function visibleRows(stream: StreamView, limit: number): StreamView["rows"] {
  if (limit >= stream.rows.length) return stream.rows;
  return stream.rows.slice(stream.rows.length - limit);
}

/**
 * Ett tomt läge för serverrendering: inget påstås innan klienten har anslutit.
 *
 * Värdet MEMOISERAS. React:s `useSyncExternalStore` jämför server-snapshoten på REFERENS —
 * en ny struktur per anrop hade sett ut som en oändlig ström av ändringar.
 */
let idle: TailSnapshot | null = null;

export function idleSnapshot(): TailSnapshot {
  if (idle !== null) return idle;
  const store = createTailStore();
  idle = {
    connection: {
      mode: "idle",
      realtime: false,
      attempt: 0,
      last_error: null,
      next_retry_in_ms: null,
      live_since: null,
      polling_since: null,
      cursor: null,
      backfilling: false,
      visibility: "visible",
      counts: {
        stream_opens: 0,
        stream_errors: 0,
        backfill_pages: 0,
        polls: 0,
        poll_errors: 0,
      },
    },
    stream: store.view(),
    stats: store.stats(),
  };
  return idle;
}
