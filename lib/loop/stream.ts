/**
 * V9 · SSE-tailens serversida: ramformat, cursor och den multiplexerande lässlingan.
 *
 * AUKTORITATIV KÄLLA: docs/nortropic-control-room-plan-v1.md — "Realtid: SSE från Railway,
 * inte Supabase Realtime i browsern" (browser ──SSE──▶ /api/loop/stream ──▶ Supabase med
 * server-side nyckel), REALTIME (ordning, reconnect-cursor, poll-fallback) och
 * IMPLEMENTATION_SLICES §V9.
 *
 * BINDANDE REGLER SOM DENNA FIL BÄR MEKANISKT
 * -------------------------------------------
 * · INGEN NYCKEL LÄMNAR SERVERN. Rutten läser kontrollplanet genom V4:s läsport och skickar
 *   ut EVENTKUVERT — aldrig konfiguration, aldrig transportnyckel, aldrig ett felmeddelande
 *   som bär mer än orsakstexten.
 * · CURSORN ÄR BUTIKSGLOBAL: SSE-ramens `id` är eventets `seq`, och `Last-Event-ID` läses som
 *   högsta sedda seq I BUTIKEN. Aldrig per run. Klientens `?after_seq=` används bara när
 *   `Last-Event-ID` saknas — headern vinner alltid, eftersom det är den webbläsaren själv
 *   skickar vid en automatisk återanslutning.
 * · TAILEN HOPPAR ALDRIG ÖVER EN RAD. Varje varv läser `seq > cursor` och flyttar cursorn till
 *   sista levererade raden. Är fönstret fullt läses nästa fönster DIREKT, utan paus, tills
 *   strömmen är ikapp — annars hade en burst tystnat i limitens kant.
 * · INGEN DEDUP HÄR. Dedup är klientens och sker på `event_id` (V9:s realtime.ts). Servern får
 *   hellre leverera ett event två gånger över två anslutningar än att tappa ett.
 * · INGEN STATE. Ramarna bär eventkuvert och driftnotiser. DONE, verdict, attestation och
 *   promotion kommer ur controllerns snapshot (SNAPSHOT_WINS) och finns inte i den här filen.
 * · Anslutningen har en TAKTID. Vid taket skickas en `closing`-ram med cursorn och strömmen
 *   stängs; klienten återansluter med samma cursor och tappar därför ingenting. Det är
 *   billigare än att lita på att en proxy håller en socket öppen i timmar (planens öppna
 *   fråga om Railways proxy — därför är poll-fallback ett krav).
 *
 * VAD DENNA FIL ALDRIG GÖR
 * ------------------------
 * Ingen skrivning, inget kommando, ingen ingestion, ingen Git- eller ref-uppslagning, ingen
 * verifiering, ingen attestation, ingen promotion. Ingen egen Supabase-klient: läsningen sker
 * genom den injicerade porten, som i produktion är V4:s `loadEvents`.
 */
import { LOOP_READ_HEADERS, type EventsQuery, type EventsRead, type LoopReadResult } from "./transport";
import type { LoopEvent } from "./schema";

/* ────────────────────────────────────────────────────────────────────────────
 * LÅSTA REGLER
 * ──────────────────────────────────────────────────────────────────────────── */

export const STREAM_RULES = {
  TRANSPORT: "SSE",
  /** SSE-ramens id ÄR eventets seq, och seq är butiksglobalt monoton (B3). */
  FRAME_ID: "seq",
  RECONNECT_CURSOR: "HIGHEST_SEQ_SEEN_IN_STORE",
  RECONNECT_CURSOR_IS_PER_RUN: false,
  /** Dedup är klientens, på event_id. Servern dedupar aldrig och överlappar hellre. */
  SERVER_DEDUPES: false,
  DEDUP_KEY: "event_id",
  WRITES: false,
  EMITS_STATE: false,
  EMITS_SECRETS: false,
} as const;

export const SSE_MEDIA_TYPE = "text/event-stream";

/**
 * SSE-svarets headers. `no-store` ärvs ur V4:s LOOP_READ_HEADERS så att kontrollrummets
 * cachningsregel bara finns på ETT ställe. `X-Accel-Buffering: no` ber mellanliggande proxyer
 * att inte buffra strömmen — utan den kan en tail se ut att stå still i minuter.
 */
export const SSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  ...LOOP_READ_HEADERS,
  "Content-Type": `${SSE_MEDIA_TYPE}; charset=utf-8`,
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
});

/** Ramtyperna. Klienten känner igen dem på namn och tolkar aldrig en okänd ram som ett event. */
export const STREAM_FRAME_NAMES = {
  open: "loop.open",
  event: "loop.event",
  notice: "loop.notice",
  closing: "loop.closing",
} as const;
export type StreamFrameName = (typeof STREAM_FRAME_NAMES)[keyof typeof STREAM_FRAME_NAMES];

/** Hur ofta tailen frågar butiken när den är ikapp. */
export const TAIL_POLL_INTERVAL_MS = 1000;
/** Väntan efter ett transportfel innan nästa försök i SAMMA anslutning. */
export const TAIL_ERROR_INTERVAL_MS = 5000;
/** Kommentarsram som håller anslutningen vid liv genom proxyer utan att påstå något. */
export const TAIL_KEEPALIVE_INTERVAL_MS = 15000;
/** Anslutningens taktid. Vid taket stängs den ordnat och klienten återansluter på sin cursor. */
export const TAIL_MAX_DURATION_MS = 900000;
/** Antal transportfel i rad innan anslutningen stängs och klienten får falla tillbaka på poll. */
export const TAIL_MAX_CONSECUTIVE_ERRORS = 3;
/** Fönsterstorlek per varv. Samma tak som V4:s läsroute. */
export const TAIL_WINDOW_LIMIT = 200;

/* ────────────────────────────────────────────────────────────────────────────
 * RAMFORMAT
 * ──────────────────────────────────────────────────────────────────────────── */

const FRAME_SEPARATOR = "\n\n";

/**
 * En SSE-ram. `data` serialiseras som EN rad JSON — JSON.stringify producerar aldrig en rå
 * radbrytning, så ramen kan inte brytas i förtid av ett payloadvärde.
 */
export function sseFrame(frame: {
  event: StreamFrameName;
  data: unknown;
  /** Sätts endast för eventramar, och är då eventets seq. */
  id?: number | null;
}): string {
  const lines: string[] = [];
  if (frame.id !== undefined && frame.id !== null) lines.push(`id: ${frame.id}`);
  lines.push(`event: ${frame.event}`);
  lines.push(`data: ${JSON.stringify(frame.data)}`);
  return `${lines.join("\n")}${FRAME_SEPARATOR}`;
}

/** En kommentarsram. Håller anslutningen vid liv och bär ingen data alls. */
export function sseComment(text: string): string {
  return `: ${text.replace(/[\r\n]+/g, " ")}${FRAME_SEPARATOR}`;
}

/**
 * `Last-Event-ID` (eller `?after_seq=`) som cursor. Ett obegripligt värde ger `null` =
 * "ingen känd cursor" i stället för en gissning: att tolka skräp som 0 hade kunnat spola om
 * hela butiken, och att tolka det som "senaste" hade tappat allt däremellan.
 */
export function parseCursor(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const text = raw.trim();
  if (!/^-?\d+$/.test(text)) return null;
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < -1) return null;
  return parsed;
}

/**
 * Cursorn för en anslutning. `Last-Event-ID` VINNER över `?after_seq=`: headern är den
 * webbläsaren själv skickar när EventSource återansluter, och den speglar exakt vad klienten
 * har tagit emot. Saknas båda börjar tailen där fönstret börjar (null = butikens början).
 */
export function streamCursor(headers: Headers, params: URLSearchParams): number | null {
  const fromHeader = parseCursor(headers.get("Last-Event-ID"));
  if (fromHeader !== null) return fromHeader;
  return parseCursor(params.get("after_seq"));
}

/* ────────────────────────────────────────────────────────────────────────────
 * TAILEN
 * ──────────────────────────────────────────────────────────────────────────── */

export type StreamLoad = (query: EventsQuery) => Promise<LoopReadResult<EventsRead>>;

export type TailPorts = {
  /** I produktion V4:s loadEvents. I provet en injicerad butik — ingen socket öppnas. */
  load: StreamLoad;
  now: () => number;
  /** Väntan. Avbryts av signalen; en avbruten väntan får aldrig kasta. */
  sleep: (ms: number) => Promise<void>;
};

export type TailOptions = {
  after_seq: number | null;
  run_id: string | null;
  task_id: string | null;
  limit?: number;
  /** Avbryts när klienten kopplar ner. Utan den skulle slingan leva vidare utan mottagare. */
  signal?: { aborted: boolean };
  maxDurationMs?: number;
  pollIntervalMs?: number;
  errorIntervalMs?: number;
  keepAliveIntervalMs?: number;
  maxConsecutiveErrors?: number;
};

/** Varför anslutningen stängdes. Klienten visar orsaken och återansluter på sin cursor. */
export type TailClosingReason =
  | "client_disconnected"
  | "max_duration"
  | "transport_unavailable";

/**
 * Ramarna för EN anslutning, i ordning.
 *
 * Sekvensen är alltid: `open` → noll eller fler `event`/`notice`/kommentarer → `closing`.
 * Klienten kan därför alltid skilja "servern stängde ordnat" från "socketen dog", och
 * behandlar båda likadant: backoff, backfill från cursor, tail igen.
 *
 * Ingen rad släpps: cursorn flyttas bara till rader som FAKTISKT skickats, och ett fullt
 * fönster läses om direkt utan paus.
 */
export async function* tailFrames(
  options: TailOptions,
  ports: TailPorts,
): AsyncGenerator<string> {
  const limit = options.limit ?? TAIL_WINDOW_LIMIT;
  const maxDuration = options.maxDurationMs ?? TAIL_MAX_DURATION_MS;
  const pollInterval = options.pollIntervalMs ?? TAIL_POLL_INTERVAL_MS;
  const errorInterval = options.errorIntervalMs ?? TAIL_ERROR_INTERVAL_MS;
  const keepAliveInterval = options.keepAliveIntervalMs ?? TAIL_KEEPALIVE_INTERVAL_MS;
  const maxErrors = options.maxConsecutiveErrors ?? TAIL_MAX_CONSECUTIVE_ERRORS;

  const startedAt = ports.now();
  let cursor = options.after_seq;
  let lastKeepAlive = startedAt;
  let consecutiveErrors = 0;

  const aborted = () => options.signal?.aborted === true;

  yield sseFrame({
    event: STREAM_FRAME_NAMES.open,
    data: {
      after_seq: cursor,
      run_id: options.run_id,
      task_id: options.task_id,
      /** Filtrerade vyer gap-detekterar aldrig (B3) — klienten ska veta vilken vy den fick. */
      scope: options.run_id === null && options.task_id === null ? "store" : "filtered",
      ordering: "seq",
      dedup_key: "event_id",
    },
  });

  let closing: TailClosingReason = "client_disconnected";

  while (!aborted()) {
    if (ports.now() - startedAt >= maxDuration) {
      closing = "max_duration";
      break;
    }

    const result = await ports.load({
      after_seq: cursor,
      limit,
      run_id: options.run_id,
      task_id: options.task_id,
    });
    if (aborted()) break;

    if (!result.ok) {
      consecutiveErrors += 1;
      // Orsaken ordagrant, ingenting mer. Envelopet bär redan planens texter och inga hemligheter.
      yield sseFrame({
        event: STREAM_FRAME_NAMES.notice,
        data: { ok: false, reason: result.reason, message: result.message, after_seq: cursor },
      });
      if (consecutiveErrors >= maxErrors) {
        closing = "transport_unavailable";
        break;
      }
      await ports.sleep(errorInterval);
      continue;
    }

    const cursorBefore = cursor;
    const rows = result.data.stream.rows;
    for (const row of rows) {
      const event: LoopEvent = row.event;
      yield sseFrame({ event: STREAM_FRAME_NAMES.event, data: event, id: event.seq });
      cursor = cursor === null ? event.seq : Math.max(cursor, event.seq);
    }

    /**
     * Ett fönster som lämnade rader men INTE flyttade cursorn betyder att butikens rader inte
     * validerar mot kontraktet (V1). Att läsa om samma fönster direkt hade snurrat i en tight
     * slinga för alltid; att sova vidare hade gjort en fastnad ström tyst. Läget rapporteras
     * därför som en notis — samma väg som ett transportfel — och klienten faller tillbaka på
     * poll, där läsroutens envelope redovisar de ogiltiga raderna med index.
     */
    const stalled = result.data.window.returned > 0 && cursor === cursorBefore;
    if (stalled) {
      consecutiveErrors += 1;
      yield sseFrame({
        event: STREAM_FRAME_NAMES.notice,
        data: {
          ok: false,
          reason: "transport-error",
          message:
            "Kontrollplanet lämnade rader som inte validerar mot eventkontraktet. Strömmen kan " +
            "inte gå vidare förbi dem.",
          after_seq: cursor,
        },
      });
      if (consecutiveErrors >= maxErrors) {
        closing = "transport_unavailable";
        break;
      }
      await ports.sleep(errorInterval);
      continue;
    }

    // FÖRST här är varvet faktiskt lyckat: fönstret lästes OCH strömmen kom vidare. Att
    // nollställa räknaren tidigare hade gjort taket för fel i rad omöjligt att nå för ett
    // fönster som svarar utan att gå att passera — alltså en evig slinga.
    consecutiveErrors = 0;

    // Fullt fönster → strömmen är inte ikapp. Läs nästa fönster DIREKT, annars hade en burst
    // levererats i takt med pausen i stället för i takt med butiken.
    if (result.data.window.may_have_more) continue;

    if (ports.now() - lastKeepAlive >= keepAliveInterval) {
      lastKeepAlive = ports.now();
      yield sseComment("open");
    }
    await ports.sleep(pollInterval);
  }

  yield sseFrame({
    event: STREAM_FRAME_NAMES.closing,
    data: { reason: aborted() ? "client_disconnected" : closing, after_seq: cursor },
  });
}
