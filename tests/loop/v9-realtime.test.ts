/**
 * V9 · REALTID, RECONNECT OCH DEDUP.
 *
 * Provar exit-kriterierna i docs/nortropic-control-room-plan-v1.md §V9:
 *   (1) SSE levererar tail; avbrott återansluter och backfillar UTAN dubbletter och UTAN att
 *       tappa ett enda seq.
 *   (2) Ett dubblerat event ger ingen andra rad och ingen state-ändring.
 *   (3) Out-of-order ger samma sluttillstånd som ordnat.
 *   (4) Okänd framtida event_type visas rått och kraschar inte.
 *   (5) Nyare major schema_version ger banner, inte krasch.
 *   (6) SSE nere → poll-fallback med SYNLIG markering.
 * samt de negativa kontrollerna: reconnect som tappar event · dedup som släpper igenom en
 * dubblett · UI som påstår realtid när det pollar.
 *
 * PROVSTIL (samma som V1–V8): varje kriterium bär en LÖGNSTUB — den vanligaste genvägen — och
 * provet mäter att stuben FÄLLS av exakt samma data. Ett prov som bara mäter den riktiga
 * implementationen bevisar inte att datan kan skilja rätt från fel.
 *
 * INGEN SOCKET ÖPPNAS. Anslutningsmaskinen körs genom sina injicerade portar (ström, fönster,
 * klocka, slump, timers), och SSE-tailen körs genom en injicerad läsport. Det är hela skälet
 * till att policyn ligger i lib/loop/** och inte i en komponent.
 *
 * ÄRLIGHET OM LÄGET: kontrollplanets Supabase (S5/S13) finns inte vid NORTROPIC_PLAN_COMMIT.
 * Det som mäts här är transportens BETEENDE mot en injicerad butik plus routens grindar. Ingen
 * rad i provet påstår att strömmen är live mot en verklig backend.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import {
  BACKOFF_MAX_MS,
  BACKOFF_MIN_MS,
  POLL_INTERVAL_MS,
  REALTIME_RULES,
  TAIL_DEDUP_CAP,
  TRANSPORT_MODES,
  TRANSPORT_PRESENTATION,
  claimsRealtime,
  createTailConnection,
  createTailStore,
  gapLabel,
  idleSnapshot,
  nextBackoffDelay,
  tailNotices,
  visibleRows,
  type StreamHandlers,
  type StreamPort,
  type TailPorts,
  type TailSnapshot,
  type WindowPort,
} from "../../lib/loop/realtime";
import {
  SSE_HEADERS,
  SSE_MEDIA_TYPE,
  STREAM_FRAME_NAMES,
  STREAM_RULES,
  parseCursor,
  sseComment,
  sseFrame,
  streamCursor,
  tailFrames,
  type TailPorts as ServerTailPorts,
} from "../../lib/loop/stream";
import { loadEvents, type EventsQuery, type TransportReader } from "../../lib/loop/transport";
import { dedupeByEventId, projectEvents } from "../../lib/loop/events";
import { validateEvents, type LoopEvent } from "../../lib/loop/schema";
import { fixtureEvents, fixtureUnknownEvents } from "../../lib/loop/fixtures";
import EventStream from "../../components/loop/EventStream";
import EventRow from "../../components/loop/EventRow";
import StaleBanner from "../../components/loop/StaleBanner";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function source(relative: string): string {
  return readFileSync(path.join(REPO, relative), "utf8");
}

/** Kod utan kommentarer: en fil som FÖRBJUDER en väg i klartext får inte fällas av sitt förbud. */
function code(relative: string): string {
  return source(relative)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/* ════════════════════════════════════════════════════════════════════════════
 * HJÄLPARE — data, klocka och portar
 * ════════════════════════════════════════════════════════════════════════════ */

/** Ett avtalsenligt event. Formen mäts mot V1:s schema av det första provet nedan. */
function ev(seq: number, over: Partial<LoopEvent> = {}): LoopEvent {
  return {
    schema_version: "1.0.0",
    event_id: `e-${seq}`,
    seq,
    ts: new Date(Date.UTC(2026, 0, 1, 0, 0, Math.min(seq, 59))).toISOString(),
    run_id: "run-a",
    task_id: null,
    attempt_id: null,
    event_type: "run.started",
    payload: {},
    evidence_refs: [],
    ...over,
  };
}

function range(from: number, to: number): LoopEvent[] {
  const out: LoopEvent[] = [];
  for (let seq = from; seq <= to; seq += 1) out.push(ev(seq));
  return out;
}

function seqsOf(snapshot: TailSnapshot): number[] {
  return snapshot.stream.rows.map((row) => row.event.seq);
}

function eventIdsOf(snapshot: TailSnapshot): string[] {
  return snapshot.stream.rows.map((row) => row.event.event_id);
}

/** Väntar ut mikrotaskkön så att portarnas löften hinner slutföras. */
async function flush(): Promise<void> {
  for (let index = 0; index < 50; index += 1) await Promise.resolve();
}

type FakeClock = {
  now: () => number;
  setTimer: (ms: number, run: () => void) => number;
  clearTimer: (id: number) => void;
  advance: (ms: number) => Promise<void>;
  pending: () => number;
};

/** Deterministisk klocka. Ingen riktig timer används — provet styr tiden helt. */
function createClock(): FakeClock {
  let now = 0;
  let nextId = 1;
  let timers: { id: number; at: number; run: () => void }[] = [];
  return {
    now: () => now,
    setTimer: (ms, run) => {
      const id = nextId;
      nextId += 1;
      timers.push({ id, at: now + ms, run });
      return id;
    },
    clearTimer: (id) => {
      timers = timers.filter((timer) => timer.id !== id);
    },
    advance: async (ms) => {
      const target = now + ms;
      for (;;) {
        const due = timers.filter((timer) => timer.at <= target).sort((a, b) => a.at - b.at)[0];
        if (due === undefined) break;
        timers = timers.filter((timer) => timer.id !== due.id);
        now = due.at;
        due.run();
        await flush();
      }
      now = target;
      await flush();
    },
    pending: () => timers.length,
  };
}

type FakeStream = {
  port: StreamPort;
  /** `after_seq` för varje öppnad anslutning — bevis på vilken cursor reconnect använde. */
  opens: (number | null)[];
  isOpen: () => boolean;
  closes: () => number;
  open: () => void;
  emit: (event: unknown) => void;
  fail: (message: string) => void;
};

/** En ström som provet styr helt: öppna, leverera, dö. */
function createFakeStream(options: { failSynchronously?: string } = {}): FakeStream {
  const opens: (number | null)[] = [];
  let current: { handlers: StreamHandlers; alive: boolean } | null = null;
  let closed = 0;
  const port: StreamPort = ({ after_seq, handlers }) => {
    opens.push(after_seq);
    if (options.failSynchronously !== undefined) {
      handlers.onError(options.failSynchronously);
      return { close: () => { closed += 1; } };
    }
    const connection = { handlers, alive: true };
    current = connection;
    return {
      close: () => {
        closed += 1;
        connection.alive = false;
        if (current === connection) current = null;
      },
    };
  };
  return {
    port,
    opens,
    isOpen: () => current !== null,
    closes: () => closed,
    open: () => current?.handlers.onOpen(),
    emit: (event: unknown) => current?.handlers.onEvent(event),
    fail: (message: string) => {
      const connection = current;
      current = null;
      connection?.handlers.onError(message);
    },
  };
}

type FakeWindow = {
  port: WindowPort;
  /** `after_seq` för varje fönsterhämtning — bevis på att backfill börjar på cursorn. */
  requests: (number | null)[];
  setEvents: (events: LoopEvent[]) => void;
  setFailure: (message: string | null) => void;
};

/** Butiken bakom `/api/loop/events`: `seq > after_seq`, stigande, kapad av limit. */
function createFakeWindow(initial: LoopEvent[]): FakeWindow {
  let events = [...initial];
  let failure: string | null = null;
  const requests: (number | null)[] = [];
  const port: WindowPort = async ({ after_seq, limit }) => {
    requests.push(after_seq);
    if (failure !== null) return { ok: false, message: failure };
    const rows = events
      .filter((event) => after_seq === null || event.seq > after_seq)
      .sort((a, b) => a.seq - b.seq)
      .slice(0, limit);
    return { ok: true, page: { events: rows, may_have_more: rows.length === limit } };
  };
  return {
    port,
    requests,
    setEvents: (next: LoopEvent[]) => {
      events = [...next];
    },
    setFailure: (message: string | null) => {
      failure = message;
    },
  };
}

function portsFor(stream: FakeStream, window: FakeWindow, clock: FakeClock): TailPorts {
  return {
    openStream: stream.port,
    fetchWindow: window.port,
    now: clock.now,
    // Fast slump: backoffen blir exakt förutsägbar och provet mäter policy, inte tur.
    random: () => 0.5,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  };
}

function renderStream(snapshot: TailSnapshot): string {
  return renderToStaticMarkup(createElement(EventStream, { snapshot }));
}

/* ════════════════════════════════════════════════════════════════════════════
 * 0 · PROVETS EGEN DATA MÅSTE VARA AVTALSENLIG
 * ════════════════════════════════════════════════════════════════════════════ */

test("V9-DATA · provets event validerar mot V1:s kontrakt — annars mäter provet ingenting", () => {
  const batch = validateEvents(range(1, 5));
  assert.equal(batch.invalid.length, 0, "provets egna event bröt mot V1-kontraktet");
  assert.equal(batch.valid.length, 5);
  assert.ok(fixtureEvents().length > 0, "fixturströmmen är tom");
  assert.ok(fixtureUnknownEvents().length > 0, "fixturen med okända typer är tom");
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 1 · SSE LEVERERAR TAIL — AVBROTT ÅTERANSLUTER OCH BACKFILLAR
 * ════════════════════════════════════════════════════════════════════════════ */

test("V9 exit 1 · serverns tail levererar varje rad i seq-ordning, med seq som ram-id", async () => {
  const store = range(1, 5);
  const load: ServerTailPorts["load"] = async (query: EventsQuery) => {
    const rows = store.filter((event) => query.after_seq === null || event.seq > query.after_seq);
    return await Promise.resolve(
      projectEvents(rows, { scope: "store", expected_after_seq: query.after_seq }).stream.rows
        .length >= 0
        ? {
            ok: true,
            data: {
              source: "control_plane_supabase" as const,
              fixture: false as const,
              scope: "store" as const,
              gap_detection: "store_stream" as const,
              filters: { run_id: null, task_id: null },
              window: {
                after_seq: query.after_seq,
                limit: query.limit,
                returned: rows.length,
                may_have_more: false,
              },
              ...projectEvents(rows, { scope: "store", expected_after_seq: query.after_seq }),
            },
          }
        : { ok: false, reason: "transport-error", message: "omöjligt" },
    );
  };

  const signal = { aborted: false };
  const frames: string[] = [];
  const ports: ServerTailPorts = {
    load,
    now: () => 0,
    sleep: async () => {
      // Första vilan betyder "ikapp". Då kopplar provet ner, precis som en klient som stänger.
      signal.aborted = true;
      await Promise.resolve();
    },
  };

  for await (const frame of tailFrames(
    { after_seq: null, run_id: null, task_id: null, signal },
    ports,
  )) {
    frames.push(frame);
  }

  assert.ok(frames[0].includes(`event: ${STREAM_FRAME_NAMES.open}`), "ingen open-ram först");
  const eventFrames = frames.filter((frame) => frame.includes(`event: ${STREAM_FRAME_NAMES.event}`));
  assert.equal(eventFrames.length, 5, "tailen levererade inte varje rad");
  assert.deepEqual(
    eventFrames.map((frame) => Number(/^id: (\d+)$/m.exec(frame)?.[1])),
    [1, 2, 3, 4, 5],
    "ram-id är inte eventets seq, i seq-ordning",
  );
  assert.ok(
    frames[frames.length - 1].includes(`event: ${STREAM_FRAME_NAMES.closing}`),
    "anslutningen stängdes utan closing-ram",
  );
  // Cursorn i closing-ramen är sista LEVERERADE seq — klienten återansluter på exakt den.
  assert.ok(frames[frames.length - 1].includes('"after_seq":5'));
});

test("V9 exit 1 · avbrott → backfill från butikens cursor → tail igen, utan dubblett och utan tapp", async () => {
  const clock = createClock();
  const stream = createFakeStream();
  const window = createFakeWindow(range(1, 10));
  const tail = createTailConnection({
    ports: portsFor(stream, window, clock),
    // Litet fönster: backfillen måste paginera, precis som mot en verklig butik.
    backfillPageLimit: 4,
    storeOptions: { scope: "store" },
  });

  tail.start();
  await flush();

  // Backfill drog 1..10 i tre fönster och öppnade sedan tail på cursorn.
  assert.deepEqual(window.requests, [null, 4, 8]);
  assert.deepEqual(stream.opens, [10], "tailen öppnades inte på butikens cursor");
  stream.open();
  await flush();
  assert.equal(tail.snapshot().connection.mode, "live");

  // Tail levererar 11. Sedan dör anslutningen INNAN 12 och 13 har levererats.
  window.setEvents(range(1, 13));
  stream.emit(ev(11));
  await flush();
  assert.equal(tail.snapshot().connection.cursor, 11);

  stream.fail("Anslutningen bröts.");
  await flush();
  const broken = tail.snapshot();
  assert.equal(broken.connection.mode, "reconnecting");
  assert.equal(broken.connection.realtime, false, "ett brutet läge påstod realtid");
  assert.ok(broken.connection.next_retry_in_ms !== null, "ingen backoff schemalagd");

  await clock.advance(BACKOFF_MAX_MS);
  stream.open();
  await flush();

  const healed = tail.snapshot();
  assert.equal(healed.connection.mode, "live");
  assert.deepEqual(seqsOf(healed), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], "seq tappades");
  assert.equal(new Set(eventIdsOf(healed)).size, 13, "en rad dubblerades vid reconnect");
  assert.deepEqual(healed.stream.gaps, [], "backfillen lämnade en lucka");
  // Reconnect frågade efter fönstret som börjar på HÖGSTA SEDDA SEQ — aldrig per run, aldrig 0.
  assert.equal(window.requests[window.requests.length - 1], 11);
  assert.deepEqual(stream.opens, [10, 13]);
});

test("V9-NEG · en reconnect som frågar efter fel cursor tappar ett event — provets data kan skilja", async () => {
  const window = createFakeWindow(range(1, 13));
  const seen = new Set<number>(range(1, 11).map((event) => event.seq));

  // SANNINGEN: fönstret börjar på högsta sedda seq. `seq > after_seq` ger 12 och 13.
  const honest = await window.port({ after_seq: 11, limit: 200 });
  assert.ok(honest.ok);
  const honestSeqs = honest.ok ? honest.page.events.map((event) => (event as LoopEvent).seq) : [];
  assert.deepEqual(honestSeqs, [12, 13]);

  // LÖGNSTUB: "vi såg 11, alltså börjar vi på 12" — ett klassiskt av-med-ett som tappar 12.
  const lie = await window.port({ after_seq: 12, limit: 200 });
  const lieSeqs = lie.ok ? lie.page.events.map((event) => (event as LoopEvent).seq) : [];
  assert.deepEqual(lieSeqs, [13], "lögnstuben tappade inget — provet kunde inte skilja rätt från fel");
  assert.ok(!lieSeqs.includes(12));
  assert.equal(seen.has(12), false);
});

test("V9 exit 1 · backfill och tail får ÖVERLAPPA — dedupen gör överlappet till noll extra rader", () => {
  const store = createTailStore();
  store.ingest(range(1, 6), "backfill");
  // Tailen levererar om 5 och 6 (t.ex. efter en återanslutning mot en generös cursor).
  store.ingest([ev(5), ev(6), ev(7)], "stream");
  const view = store.view();
  assert.deepEqual(view.rows.map((row) => row.event.seq), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(store.stats().duplicates, 2, "överlappet räknades inte som dubbletter");
  assert.equal(store.stats().retained, 7);
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 2 · DUBBLETT → INGEN ANDRA RAD, INGEN STATE-ÄNDRING (E2)
 * ════════════════════════════════════════════════════════════════════════════ */

test("V9 exit 2 · samma event_id igen ger ingen andra rad och ingen ändrad vy", () => {
  const store = createTailStore();
  const events = range(1, 4);
  store.ingest(events, "backfill");
  const before = JSON.stringify(store.view());

  store.ingest(events, "stream");
  store.ingest(events, "poll");
  const after = JSON.stringify(store.view());

  assert.equal(after, before, "en dubblerad leverans ändrade den visade vyn");
  assert.equal(store.stats().retained, 4);
  assert.equal(store.stats().duplicates, 8);
  assert.equal(store.stats().cursor, 4, "cursorn flyttades av en dubblett");
});

test("V9 exit 2 · dedupen ligger på event_id — ALDRIG på seq (E2/negativ kontroll)", () => {
  // Två OLIKA event_id som delar seq är ett backendfel: båda ska överleva och SYNAS.
  const collision = [
    ev(7, { event_id: "e-7-a" }),
    ev(7, { event_id: "e-7-b", event_type: "task.claimed" }),
  ];
  const store = createTailStore();
  store.ingest(collision, "stream");
  const view = store.view();

  assert.equal(view.rows.length, 2, "dedupen slog ihop två rader som bara delade seq");
  assert.deepEqual(view.seq_collisions, [{ seq: 7, event_ids: ["e-7-a", "e-7-b"] }]);
  assert.equal(store.stats().duplicates, 0);

  // LÖGNSTUB: dedup på seq. Den tappar en rad ur exakt samma data.
  const bySeq = new Map<number, LoopEvent>();
  for (const event of collision) bySeq.set(event.seq, event);
  assert.equal(bySeq.size, 1, "seq-dedupen tappade inget — lögnstuben mäter ingenting");

  // Och den varning UI:t visar är en varning, inte en tyst överskrivning.
  const notices = tailNotices({ connection: idleSnapshot().connection, stream: view, stats: store.stats() });
  assert.ok(notices.some((notice) => notice.id === "seq_collision"));
});

test("V9 exit 2 · två leveranser av samma event_id med olika innehåll väljs på DATA, inte på ankomst", () => {
  const first = ev(3, { payload: { a: 1 } });
  const second = ev(3, { payload: { b: 2 } });

  const forward = createTailStore();
  forward.ingest([first], "stream");
  forward.ingest([second], "backfill");

  const backward = createTailStore();
  backward.ingest([second], "backfill");
  backward.ingest([first], "stream");

  assert.equal(
    JSON.stringify(forward.view()),
    JSON.stringify(backward.view()),
    "utfallet berodde på i vilken ordning leveranserna kom",
  );
  // …och valet är samma som V3:s dedup gör på samma mängd.
  const canonical = dedupeByEventId(validateEvents([first, second]).valid).unique[0].event;
  assert.equal(JSON.stringify(forward.view().rows[0].event), JSON.stringify(canonical));
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 3 · OUT-OF-ORDER → SAMMA SLUTTILLSTÅND SOM ORDNAT (E3)
 * ════════════════════════════════════════════════════════════════════════════ */

test("V9 exit 3 · omkastad, styckad och dubblerad leverans ger identisk sluttillstånd", () => {
  const ordered = range(1, 8);

  const straight = createTailStore();
  straight.ingest(ordered, "backfill");

  const scrambled = createTailStore();
  scrambled.ingest([ordered[5], ordered[0]], "stream");
  scrambled.ingest([ordered[7], ordered[2], ordered[5]], "poll");
  scrambled.ingest([ordered[1], ordered[6], ordered[4], ordered[3]], "backfill");

  assert.equal(
    JSON.stringify(scrambled.view()),
    JSON.stringify(straight.view()),
    "ankomstordningen läckte in i läsordningen",
  );
  assert.deepEqual(scrambled.view().rows.map((row) => row.event.seq), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("V9 exit 3 · bakåtgående ts ändrar inte läsordningen (E8) — seq ensamt ordnar", () => {
  const late = ev(1, { ts: "2030-01-01T00:00:00.000Z" });
  const early = ev(2, { ts: "2020-01-01T00:00:00.000Z" });
  const store = createTailStore();
  store.ingest([early, late], "stream");
  assert.deepEqual(store.view().rows.map((row) => row.event.seq), [1, 2]);
  assert.equal(REALTIME_RULES.TS_IS_ORDERING, false);
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 4 · OKÄND FRAMTIDA EVENT_TYPE — RÅ RAD, INGEN STATE, INGEN KRASCH (E4)
 * ════════════════════════════════════════════════════════════════════════════ */

test("V9 exit 4 · okänd event_type passerar, renderas rått och flyttar ingen state", () => {
  const future = ev(9, { event_type: "quantum.entangled", payload: { note: "framtida familj" } });
  const store = createTailStore();
  store.ingest([future, ...fixtureUnknownEvents().map((validated) => validated.event)], "stream");

  const view = store.view();
  const row = view.rows.find((candidate) => candidate.event.event_id === future.event_id);
  assert.ok(row, "det okända eventet föll bort ur strömmen");
  assert.equal(row.classification.known, false);
  assert.equal(row.transient_phase, null, "en okänd typ fick en fas");
  assert.equal(row.authority, "NONE");
  assert.ok(view.counts.unknown_type >= 1);

  const html = renderToStaticMarkup(createElement(EventRow, { row, raw: false }));
  assert.ok(html.includes("quantum.entangled"), "rå typ visas inte");
  assert.ok(html.includes('data-unknown-type="true"'));
  assert.ok(html.includes('data-authority="NONE"'));
  assert.ok(!/data-transient-phase/.test(html), "en okänd rad påstod en fas");

  // Hela panelen renderar också — kravet är att den inte kraschar på okänd data.
  const panel = renderStream({ connection: idleSnapshot().connection, stream: view, stats: store.stats() });
  assert.ok(panel.includes("quantum.entangled"));
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 5 · NYARE MAJOR SCHEMA_VERSION → BANNER, INTE KRASCH (E10)
 * ════════════════════════════════════════════════════════════════════════════ */

test("V9 exit 5 · nyare major ger banner, stoppar fas-härledning ur tail och kraschar aldrig", () => {
  const store = createTailStore();
  store.ingest(
    [ev(1, { event_type: "agent.started" }), ev(2, { schema_version: "2.0.0", event_id: "e-2-next" })],
    "stream",
  );
  const view = store.view();

  assert.equal(view.schema_banner, true, "ingen banner vid nyare major");
  assert.equal(view.tail_phase_derivation, "disabled_unsupported_schema");
  assert.equal(view.rows.length, 2, "raderna föll bort i stället för att visas");
  for (const row of view.rows) assert.equal(row.transient_phase, null, "tail härledde fas ändå");

  const snapshot: TailSnapshot = {
    connection: idleSnapshot().connection,
    stream: view,
    stats: store.stats(),
  };
  const notices = tailNotices(snapshot);
  const banner = notices.find((notice) => notice.id === "schema_ahead");
  assert.ok(banner, "ingen bannernotis");
  assert.equal(banner.text, "Nyare eventschema än detta gränssnitt känner till");

  const html = renderToStaticMarkup(createElement(StaleBanner, { notices }));
  assert.ok(html.includes("Nyare eventschema än detta gränssnitt känner till"));
  assert.ok(renderStream(snapshot).includes('data-notice="schema_ahead"'));
});

/* ════════════════════════════════════════════════════════════════════════════
 * EXIT 6 · SSE NERE → POLL-FALLBACK MED SYNLIG MARKERING
 * ════════════════════════════════════════════════════════════════════════════ */

test("V9 exit 6 · upprepade strömfel ger poll-fallback som HÄMTAR event och SYNS i vyn", async () => {
  const clock = createClock();
  const stream = createFakeStream();
  const window = createFakeWindow(range(1, 3));
  const tail = createTailConnection({
    ports: portsFor(stream, window, clock),
    pollIntervalMs: POLL_INTERVAL_MS,
    storeOptions: { scope: "store" },
  });

  tail.start();
  await flush();
  stream.open();
  await flush();
  assert.equal(tail.snapshot().connection.mode, "live");

  stream.fail("bruten 1");
  await flush();
  assert.equal(tail.snapshot().connection.mode, "reconnecting");

  await clock.advance(BACKOFF_MAX_MS);
  await flush();
  stream.fail("bruten 2");
  await flush();

  const polling = tail.snapshot();
  assert.equal(polling.connection.mode, "polling", "ingen poll-fallback efter upprepade fel");
  assert.equal(polling.connection.realtime, false);

  // Poll-läget HÄMTAR faktiskt: nya event dyker upp utan att strömmen öppnats igen.
  window.setEvents(range(1, 6));
  await clock.advance(POLL_INTERVAL_MS);
  const polled = tail.snapshot();
  assert.deepEqual(seqsOf(polled), [1, 2, 3, 4, 5, 6], "pollen hämtade inga nya event");
  assert.equal(polled.connection.counts.polls >= 1, true);

  // …och markeringen SYNS, ordagrant, i markupen.
  const html = renderStream(polled);
  assert.ok(html.includes('data-transport-mode="polling"'));
  assert.ok(html.includes('data-realtime="false"'));
  assert.ok(html.includes('data-notice="polling"'));
  assert.ok(html.includes("Poll"), "poll-läget märks inte ut i vyn");

  // När strömmen kommer tillbaka slutar pollen och läget blir live igen.
  await clock.advance(BACKOFF_MAX_MS);
  stream.open();
  await flush();
  const live = tail.snapshot();
  assert.equal(live.connection.mode, "live");
  assert.equal(live.connection.polling_since, null, "pollen fortsatte efter att strömmen öppnats");
});

test("V9 exit 6 · en miljö utan EventSource faller till poll direkt — utan att tappa handtaget", async () => {
  const clock = createClock();
  const stream = createFakeStream({ failSynchronously: "ingen ström i den här miljön" });
  const window = createFakeWindow(range(1, 2));
  const tail = createTailConnection({
    ports: portsFor(stream, window, clock),
    pollFallbackAfterAttempts: 1,
    storeOptions: { scope: "store" },
  });

  tail.start();
  await flush();

  const snapshot = tail.snapshot();
  assert.equal(snapshot.connection.mode, "polling");
  assert.equal(snapshot.connection.realtime, false);
  assert.equal(snapshot.connection.last_error, "ingen ström i den här miljön");
  assert.equal(stream.closes() >= 1, true, "den döda anslutningen stängdes aldrig");
  assert.deepEqual(seqsOf(snapshot), [1, 2], "backfillen kom aldrig fram");
});

test("V9 · poll-fallbacken håller EN kedja — ett nytt strömfel startar ingen andra poll", async () => {
  const clock = createClock();
  const stream = createFakeStream();
  const window = createFakeWindow(range(1, 2));
  const tail = createTailConnection({
    ports: portsFor(stream, window, clock),
    pollFallbackAfterAttempts: 1,
  });

  tail.start();
  await flush();
  stream.open();
  await flush();

  stream.fail("ett");
  await flush();
  assert.equal(tail.snapshot().connection.mode, "polling");
  const timersInFallback = clock.pending();
  assert.equal(timersInFallback, 2, "fallback ska hålla exakt en pollkedja och ett återförsök");

  // Återanslutningen får ett nytt fel medan pollkedjan lever.
  await clock.advance(BACKOFF_MIN_MS);
  stream.fail("två");
  await flush();

  assert.equal(tail.snapshot().connection.mode, "polling");
  assert.equal(clock.pending(), timersInFallback, "en andra pollkedja startades");
});

test("V9-NEG · UI:t påstår ALDRIG realtid utom när strömmen faktiskt är öppen", () => {
  assert.equal(REALTIME_RULES.CLAIMS_REALTIME_WHILE_POLLING, false);
  for (const mode of TRANSPORT_MODES) {
    assert.equal(claimsRealtime(mode), mode === "live", `${mode} klassades fel som realtid`);
  }

  const store = createTailStore();
  store.ingest(range(1, 2), "poll");
  for (const mode of TRANSPORT_MODES) {
    const snapshot: TailSnapshot = {
      connection: { ...idleSnapshot().connection, mode, realtime: claimsRealtime(mode) },
      stream: store.view(),
      stats: store.stats(),
    };
    const html = renderStream(snapshot);
    assert.ok(html.includes(`data-transport-mode="${mode}"`));
    assert.ok(
      html.includes(`data-realtime="${mode === "live" ? "true" : "false"}"`),
      `${mode} renderade fel realtidspåstående`,
    );
    if (mode !== "live") {
      assert.ok(
        !new RegExp(`data-realtime="false"[^>]*>\\s*${TRANSPORT_PRESENTATION.live.label}`).test(html),
        `${mode} bar direktströmmens etikett`,
      );
    }
  }

  // LÖGNSTUB: en presentation som kallar poll för realtid ska fällas av exakt samma kontroll.
  const lie = { ...TRANSPORT_PRESENTATION.polling, realtime: true };
  assert.notEqual(lie.realtime, TRANSPORT_PRESENTATION.polling.realtime);
});

/* ════════════════════════════════════════════════════════════════════════════
 * DEDUP-SETETS TAK OCH LOW-WATER (EVENT_CLIENT)
 * ════════════════════════════════════════════════════════════════════════════ */

test("V9 · Set med tak + seq-baserad low-water: äldre rader vräks, cursorn regredierar aldrig", () => {
  const store = createTailStore({ cap: 10 });
  store.ingest(range(1, 25), "backfill");

  const stats = store.stats();
  assert.equal(stats.retained, 10, "taket höll inte");
  assert.equal(stats.cursor, 25, "cursorn följde inte med");
  assert.equal(stats.low_water_seq, 15, "low-water sattes inte till högsta vräkta seq");
  assert.deepEqual(store.view().gaps, [], "vräkta rader larmade som lucka");

  // En vräkt rad som levereras igen är REDAN SEDD — den får inte bli en ny rad.
  store.ingest([ev(3)], "stream");
  assert.equal(store.stats().retained, 10);
  assert.equal(store.stats().below_low_water, 1);
  assert.equal(store.stats().cursor, 25);

  assert.equal(TAIL_DEDUP_CAP, 5000, "planens exempeltak ändrades utan att provet uppdaterades");
});

/* ════════════════════════════════════════════════════════════════════════════
 * GAP OCH STALE (E9, E6, E11)
 * ════════════════════════════════════════════════════════════════════════════ */

test("V9 · lucka i den OFILTRERADE butiksströmmen syns med planens text — filtrerad vy larmar aldrig", () => {
  const events = [...range(410, 411), ...range(418, 419)];

  const unfiltered = createTailStore({ scope: "store", expected_after_seq: 409 });
  unfiltered.ingest(events, "stream");
  const gaps = unfiltered.view().gaps;
  assert.deepEqual(gaps, [{ from: 412, to: 417, missing: 6 }]);
  assert.equal(gapLabel(gaps[0]), "seq 412–417");

  const notices = tailNotices({
    connection: idleSnapshot().connection,
    stream: unfiltered.view(),
    stats: unfiltered.stats(),
  });
  const gapNotice = notices.find((notice) => notice.id === "seq_gap");
  assert.ok(gapNotice);
  assert.equal(gapNotice.text, "Lucka i strömmen (seq 412–417) — hämtar");

  // B3: en run-/task-filtrerad vy har LEGITIMA hopp och gap-detekterar aldrig.
  const filtered = createTailStore({ scope: "filtered", expected_after_seq: 409 });
  filtered.ingest(events, "stream");
  assert.deepEqual(filtered.view().gaps, [], "en filtrerad vy larmade om en legitim lucka");
  assert.equal(filtered.view().gap_detection, "disabled_filtered_view");
  assert.equal(REALTIME_RULES.GAP_DETECTION_SCOPE, "UNFILTERED_STORE_STREAM_ONLY");
});

test("V9 · event vid eller under snapshotens vattenmärke bidrar inte med fas (E6)", () => {
  const store = createTailStore({ seq_watermark: 3 });
  store.ingest([ev(2, { event_type: "agent.started" }), ev(5, { event_type: "agent.started" })], "stream");
  const [older, newer] = store.view().rows;
  assert.equal(older.relation, "stale");
  assert.equal(older.transient_phase, null, "en bekräftad rad bidrog med fas");
  assert.equal(newer.relation, "tail");
  assert.equal(newer.transient_phase, "BUILD");

  const html = renderToStaticMarkup(createElement(EventRow, { row: older, raw: false }));
  assert.ok(html.includes('data-relation="stale"'));
});

/* ════════════════════════════════════════════════════════════════════════════
 * BACKOFF, SYNLIGHET OCH LIVSCYKEL
 * ════════════════════════════════════════════════════════════════════════════ */

test("V9 · backoff 1 s → 30 s med jitter, och aldrig utanför de gränserna", () => {
  for (const attempt of [1, 2, 3, 4, 5, 6, 7, 8, 20]) {
    const low = nextBackoffDelay(attempt, () => 0);
    const high = nextBackoffDelay(attempt, () => 1);
    const base = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** (attempt - 1));
    assert.equal(low, base / 2, `golvet för försök ${attempt}`);
    assert.equal(high, base, `taket för försök ${attempt}`);
    assert.ok(low >= BACKOFF_MIN_MS / 2 && high <= BACKOFF_MAX_MS);
  }
  assert.equal(nextBackoffDelay(50, () => 1), BACKOFF_MAX_MS, "backoffen växte förbi taket");
  assert.notEqual(nextBackoffDelay(4, () => 0), nextBackoffDelay(4, () => 1), "ingen jitter alls");
});

test("V9 · dold flik pausar strömmen efter tröskeln och återupptar MED backfill", async () => {
  const clock = createClock();
  const stream = createFakeStream();
  const window = createFakeWindow(range(1, 2));
  const tail = createTailConnection({
    ports: portsFor(stream, window, clock),
    hiddenPauseAfterMs: 60000,
    storeOptions: { scope: "store" },
  });

  tail.start();
  await flush();
  stream.open();
  await flush();

  tail.setVisibility("hidden");
  await clock.advance(59000);
  assert.equal(tail.snapshot().connection.mode, "live", "strömmen pausades för tidigt");

  await clock.advance(2000);
  const paused = tail.snapshot();
  assert.equal(paused.connection.mode, "paused");
  assert.equal(paused.connection.realtime, false);
  assert.equal(stream.isOpen(), false, "anslutningen lämnades öppen i pausat läge");

  // Medan vyn var dold hände saker i butiken. De får inte gå förlorade.
  window.setEvents(range(1, 9));
  tail.setVisibility("visible");
  await flush();
  stream.open();
  await flush();

  const resumed = tail.snapshot();
  assert.equal(resumed.connection.mode, "live");
  assert.deepEqual(seqsOf(resumed), [1, 2, 3, 4, 5, 6, 7, 8, 9], "pausen kostade event");
});

test("V9 · stop() stänger allt: ingen ström, ingen timer, inget läge som påstår realtid", async () => {
  const clock = createClock();
  const stream = createFakeStream();
  const window = createFakeWindow(range(1, 2));
  const tail = createTailConnection({ ports: portsFor(stream, window, clock) });

  tail.start();
  await flush();
  stream.open();
  await flush();

  tail.stop();
  assert.equal(tail.snapshot().connection.mode, "stopped");
  assert.equal(tail.snapshot().connection.realtime, false);
  assert.equal(stream.isOpen(), false);
  assert.equal(clock.pending(), 0, "en timer levde vidare efter stop()");
});

test("V9 · en misslyckad backfill går ALDRIG vidare till tail på en okänd cursor", async () => {
  const clock = createClock();
  const stream = createFakeStream();
  const window = createFakeWindow(range(1, 3));
  window.setFailure("Kontrollplanets transport är inte konfigurerad (LOOP_SUPABASE_URL saknas).");
  const tail = createTailConnection({
    ports: portsFor(stream, window, clock),
    pollFallbackAfterAttempts: 5,
  });

  tail.start();
  await flush();

  const snapshot = tail.snapshot();
  assert.deepEqual(stream.opens, [], "tailen öppnades trots att backfillen misslyckades");
  assert.equal(snapshot.connection.mode, "reconnecting");
  assert.equal(
    snapshot.connection.last_error,
    "Kontrollplanets transport är inte konfigurerad (LOOP_SUPABASE_URL saknas).",
  );
  // Orsaken visas ordagrant för operatören — aldrig omskriven, aldrig en tom vy.
  assert.ok(renderStream(snapshot).includes("LOOP_SUPABASE_URL saknas"));
});

/* ════════════════════════════════════════════════════════════════════════════
 * SSE-RAMFORMAT OCH CURSOR
 * ════════════════════════════════════════════════════════════════════════════ */

test("V9 · ramformatet är giltig SSE och kan inte brytas av ett payloadvärde", () => {
  const frame = sseFrame({
    event: STREAM_FRAME_NAMES.event,
    id: 42,
    data: ev(42, { payload: { text: "rad ett\nrad två", quote: '"' } }),
  });
  assert.ok(frame.startsWith("id: 42\nevent: loop.event\ndata: "));
  assert.ok(frame.endsWith("\n\n"));
  const dataLines = frame.split("\n").filter((line) => line.startsWith("data: "));
  assert.equal(dataLines.length, 1, "en radbrytning i payloaden bröt ramen i förtid");
  assert.ok(sseComment("håller anslutningen\nvid liv").split("\n\n")[0].split("\n").length === 1);
});

test("V9 · Last-Event-ID är den butiksglobala cursorn och vinner över ?after_seq=", () => {
  assert.equal(STREAM_RULES.RECONNECT_CURSOR, "HIGHEST_SEQ_SEEN_IN_STORE");
  assert.equal(STREAM_RULES.RECONNECT_CURSOR_IS_PER_RUN, false);
  assert.equal(STREAM_RULES.FRAME_ID, "seq");

  const headers = new Headers({ "Last-Event-ID": "412" });
  assert.equal(streamCursor(headers, new URLSearchParams("after_seq=7")), 412);
  assert.equal(streamCursor(new Headers(), new URLSearchParams("after_seq=7")), 7);
  assert.equal(streamCursor(new Headers(), new URLSearchParams()), null);

  // Skräp tolkas ALDRIG som en cursor: hellre "vet inte" än att spola om eller hoppa över.
  for (const junk of ["", " ", "abc", "4.5", "-2", "1e3", String(Number.MAX_VALUE)]) {
    assert.equal(parseCursor(junk), null, `${junk} tolkades som cursor`);
  }
  assert.equal(parseCursor("-1"), -1, "'från butikens början' måste gå att uttrycka");
  assert.equal(parseCursor(" 88 "), 88);
});

test("V9 · SSE-svaret cachas inte och märks som text/event-stream", () => {
  assert.equal(SSE_HEADERS["Cache-Control"], "no-store");
  assert.ok(SSE_HEADERS["Content-Type"].startsWith(SSE_MEDIA_TYPE));
  assert.equal(SSE_HEADERS["X-Accel-Buffering"], "no");
});

test("V9 · tailen stänger ordnat vid transportfel och bär orsaken — utan hemligheter", async () => {
  const frames: string[] = [];
  const ports: ServerTailPorts = {
    load: async () =>
      await Promise.resolve({
        ok: false,
        reason: "not-configured",
        message: "Kontrollplanets transport är inte konfigurerad (LOOP_SUPABASE_URL saknas).",
      }),
    now: () => 0,
    sleep: async () => {
      await Promise.resolve();
    },
  };

  for await (const frame of tailFrames(
    { after_seq: null, run_id: null, task_id: null, maxConsecutiveErrors: 2 },
    ports,
  )) {
    frames.push(frame);
  }

  const notices = frames.filter((frame) => frame.includes(`event: ${STREAM_FRAME_NAMES.notice}`));
  assert.equal(notices.length, 2, "tailen slutade inte efter taket för fel i rad");
  assert.ok(notices[0].includes("LOOP_SUPABASE_URL saknas"));
  const closing = frames[frames.length - 1];
  assert.ok(closing.includes('"reason":"transport_unavailable"'));
  for (const frame of frames) {
    assert.ok(!/eyJ|sb_secret_|service_role|SUPABASE_KEY/.test(frame), "en ram bar en hemlighet");
  }
});

test("V9 · en nedkopplad klient stoppar tailen — ingen slinga lever vidare utan mottagare", async () => {
  const signal = { aborted: false };
  let loads = 0;
  const ports: ServerTailPorts = {
    load: async () => {
      loads += 1;
      signal.aborted = true;
      return await Promise.resolve({
        ok: false,
        reason: "transport-error",
        message: "nätet försvann",
      });
    },
    now: () => 0,
    sleep: async () => {
      await Promise.resolve();
    },
  };

  const frames: string[] = [];
  for await (const frame of tailFrames(
    { after_seq: 5, run_id: null, task_id: null, signal },
    ports,
  )) {
    frames.push(frame);
  }
  assert.equal(loads, 1, "tailen fortsatte läsa efter nedkopplingen");
  assert.ok(frames[frames.length - 1].includes('"reason":"client_disconnected"'));
  assert.ok(frames[frames.length - 1].includes('"after_seq":5'), "cursorn tappades vid stängning");
});

test("V9 · fullt fönster läses om DIREKT — en burst levereras i takt med butiken", async () => {
  const store = range(1, 7);
  let sleeps = 0;
  const ports: ServerTailPorts = {
    load: async (query: EventsQuery) => {
      const rows = store
        .filter((event) => query.after_seq === null || event.seq > query.after_seq)
        .slice(0, query.limit);
      const projection = projectEvents(rows, { scope: "store" });
      return await Promise.resolve({
        ok: true,
        data: {
          source: "control_plane_supabase" as const,
          fixture: false as const,
          scope: "store" as const,
          gap_detection: "store_stream" as const,
          filters: { run_id: null, task_id: null },
          window: {
            after_seq: query.after_seq,
            limit: query.limit,
            returned: rows.length,
            may_have_more: rows.length === query.limit,
          },
          ...projection,
        },
      });
    },
    now: () => 0,
    sleep: async () => {
      sleeps += 1;
      throw new Error("stopp");
    },
  };

  const frames: string[] = [];
  await assert.rejects(async () => {
    for await (const frame of tailFrames(
      { after_seq: null, run_id: null, task_id: null, limit: 3 },
      ports,
    )) {
      frames.push(frame);
    }
  });

  const delivered = frames
    .filter((frame) => frame.includes(`event: ${STREAM_FRAME_NAMES.event}`))
    .map((frame) => Number(/^id: (\d+)$/m.exec(frame)?.[1]));
  assert.deepEqual(delivered, [1, 2, 3, 4, 5, 6, 7], "burst levererades inte i ett svep");
  assert.equal(sleeps, 1, "tailen sov mellan fulla fönster");
});

test("V9 · rader som inte validerar stoppar tailen SYNLIGT — aldrig en tight slinga, aldrig tystnad", async () => {
  // Butiken lämnar rader, men ingen av dem validerar mot V1:s kuvert: cursorn kan inte flytta.
  const broken = [{ event_id: "trasig", seq: "inte ett tal" }];
  let loads = 0;
  let sleeps = 0;
  const ports: ServerTailPorts = {
    load: async (query: EventsQuery) => {
      loads += 1;
      const projection = projectEvents(broken, { scope: "store" });
      return await Promise.resolve({
        ok: true,
        data: {
          source: "control_plane_supabase" as const,
          fixture: false as const,
          scope: "store" as const,
          gap_detection: "store_stream" as const,
          filters: { run_id: null, task_id: null },
          window: {
            after_seq: query.after_seq,
            limit: query.limit,
            returned: broken.length,
            may_have_more: true,
          },
          ...projection,
        },
      });
    },
    now: () => 0,
    sleep: async () => {
      sleeps += 1;
      await Promise.resolve();
    },
  };

  const frames: string[] = [];
  for await (const frame of tailFrames(
    { after_seq: 3, run_id: null, task_id: null, maxConsecutiveErrors: 2 },
    ports,
  )) {
    frames.push(frame);
  }

  assert.equal(loads, 2, "tailen snurrade vidare på ett fönster som inte kan passeras");
  assert.equal(sleeps, 1, "tailen läste om det fastnade fönstret utan att pausa");
  const notices = frames.filter((frame) => frame.includes(`event: ${STREAM_FRAME_NAMES.notice}`));
  assert.equal(notices.length, 2);
  assert.ok(notices[0].includes("inte validerar"));
  assert.ok(frames[frames.length - 1].includes('"reason":"transport_unavailable"'));
  assert.ok(frames[frames.length - 1].includes('"after_seq":3'), "cursorn flyttades av en ogiltig rad");
});

/* ════════════════════════════════════════════════════════════════════════════
 * ROUTENS GRINDAR OCH STATISKA KONTROLLER
 * ════════════════════════════════════════════════════════════════════════════ */

const STREAM_ROUTE = "app/api/loop/stream/route.ts";

test("V9-GATE · strömroutens grindar: auth() först, 401, 404, endast GET, ingen skrivning", () => {
  const text = source(STREAM_ROUTE);

  assert.ok(/from\s+"@\/auth"/.test(text), "routen importerar inte auth");
  const authIndex = text.indexOf("await auth()");
  assert.ok(authIndex > 0, "routen anropar inte await auth()");
  assert.ok(text.includes("status: 401"), "401-vägen saknas");
  assert.ok(text.includes("isLoopEnabled()"), "LOOP_ENABLED-grinden saknas");
  assert.ok(text.includes("status: 404"), "404-vägen saknas");

  // Grinden får inte hänga på middleware: transporten nås ALDRIG före auth().
  for (const call of ["loadEvents(", "tailFrames(", "streamCursor("]) {
    const callIndex = text.indexOf(call);
    assert.ok(callIndex > authIndex, `${call} ligger före auth()`);
  }

  for (const verb of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.ok(
      !new RegExp(`export\\s+(async\\s+)?function\\s+${verb}\\b`).test(text),
      `strömmen exporterar ${verb} — den är en LÄSYTA`,
    );
  }
  assert.ok(/export\s+async\s+function\s+GET\b/.test(text));

  for (const writeVerb of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("]) {
    assert.ok(!text.includes(writeVerb), `strömroutens kod bär skrivverbet ${writeVerb}`);
  }
  // Ingen egen väg till kontrollplanet: läsningen går genom V4:s port.
  assert.ok(!/@supabase\//.test(text), "strömrouten skaffade sig en egen Supabase-klient");
});

test("V9-STATIC · realtime.ts är KLIENTSÄKER — ingen transport, ingen nyckel, ingen I/O", () => {
  const text = code("lib/loop/realtime.ts");
  for (const forbidden of [
    /@supabase\//,
    /from\s+"\.\/transport"/,
    /process\.env/,
    /\bfetch\s*\(/,
    /new\s+EventSource\b/,
    /\bsetTimeout\s*\(/,
    /\bsetInterval\s*\(/,
    /\bDate\.now\s*\(/,
    /\bMath\.random\s*\(/,
  ]) {
    assert.ok(!forbidden.test(text), `lib/loop/realtime.ts rör omvärlden direkt (${forbidden})`);
  }
  // …och portarna finns, annars vore filen bara ren av att inte göra något.
  assert.ok(/openStream/.test(text) && /fetchWindow/.test(text) && /setTimer/.test(text));
});

/**
 * Detektorn mäter KODVÄGAR, aldrig ord — samma hållning som V7:s exit 8. Panelen SKRIVER UT att
 * domar, attestation och promotion kommer ur snapshoten; en detektor som fällde substantivet
 * hade bara lärt oss att sluta skriva ut regeln. Det som fälls är att LÄSA eller SÄTTA ett
 * auktoritativt fält.
 */
const AUTHORITY_CODE_PATHS: { pattern: RegExp; lie: string }[] = [
  { pattern: /TASK_LIFECYCLE/, lie: "import { TASK_LIFECYCLE } from '@/lib/loop/schema';" },
  { pattern: /\.(verdict|attestation|promotion|current_main)\b/, lie: "const done = task.promotion;" },
  { pattern: /data-state-badge/, lie: '<span data-state-badge="DONE" />' },
];

test("V9-STATIC · strömkomponenterna hämtar inget själva utom anslutningen", () => {
  for (const file of [
    "components/loop/EventStream.tsx",
    "components/loop/EventRow.tsx",
    "components/loop/StaleBanner.tsx",
  ]) {
    const text = code(file);
    assert.ok(!/\bfetch\s*\(|EventSource|XMLHttpRequest|WebSocket/.test(text), `${file} hämtar data`);
    for (const detector of AUTHORITY_CODE_PATHS) {
      assert.ok(!detector.pattern.test(text), `${file} rör authority (${detector.pattern})`);
    }
  }

  // LÖGNSTUBBAR: varje detektor måste fälla exakt den genväg den finns för att fånga…
  for (const detector of AUTHORITY_CODE_PATHS) {
    assert.ok(detector.pattern.test(detector.lie), `detektorn fäller inte sin egen lögnstub`);
  }
  // …och ingen av dem får fälla panelens UTSKRIVNA regel om var authority kommer ifrån.
  const writtenRule =
    "Strömmen är aktivitet och bevis. Uppgifternas tillstånd, domar, attestation och " +
    "promotion kommer ur controllerns snapshot — aldrig härifrån.";
  for (const detector of AUTHORITY_CODE_PATHS) {
    assert.ok(!detector.pattern.test(writtenRule), "detektorn fäller en utskriven regel");
  }
  const live = code("components/loop/LiveEventStream.tsx");
  assert.ok(/EventSource/.test(live) && /fetch\(/.test(live), "anslutningen saknar sina portar");
  assert.ok(
    !/loop_events|loop_snapshots|LOOP_SUPABASE|createClient/.test(live),
    "anslutningen känner till kontrollplanets insida",
  );
});

test("V9-STATIC · V4:s läsport används oförändrad — strömmen bygger ingen egen frågeväg", async () => {
  // loadEvents tar en injicerad läsare; strömmen ska inte behöva någon annan väg in i butiken.
  const seen: unknown[] = [];
  const reader: TransportReader = async (query) => {
    seen.push(query);
    return await Promise.resolve({ ok: true, data: [] });
  };
  const result = await loadEvents(
    { after_seq: 11, limit: 50, run_id: null, task_id: null },
    reader,
  );
  assert.equal(result.ok, true);
  assert.equal(seen.length, 1);
  assert.equal((seen[0] as { after_seq: number }).after_seq, 11);
  assert.ok(source(STREAM_ROUTE).includes("loadEvents"), "strömmen läser inte genom V4:s port");
});

/* ════════════════════════════════════════════════════════════════════════════
 * PANELENS ÄRLIGHET
 * ════════════════════════════════════════════════════════════════════════════ */

test("V9 · panelen redovisar avkortning, dedup och cursor — inget försvinner tyst", () => {
  const store = createTailStore();
  store.ingest(range(1, 40), "backfill");
  store.ingest(range(1, 40), "stream");
  const snapshot: TailSnapshot = {
    connection: { ...idleSnapshot().connection, mode: "live", realtime: true, cursor: 40 },
    stream: store.view(),
    stats: store.stats(),
  };

  assert.equal(visibleRows(snapshot.stream, 10).length, 10);
  assert.deepEqual(
    visibleRows(snapshot.stream, 10).map((row) => row.event.seq),
    [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
    "avkortningen visar inte de SENASTE raderna",
  );

  const html = renderToStaticMarkup(createElement(EventStream, { snapshot, maxRows: 10 }));
  assert.ok(html.includes('data-stream-truncated="30"'), "avkortningen redovisas inte");
  assert.ok(html.includes('data-ledger-duplicates="40"'), "dedupen redovisas inte");
  assert.ok(html.includes('data-ledger-cursor="40"'));
  assert.ok(html.includes('data-stream-authority="NONE"'));
});

test("V9 · [sv] / [raw event_type] är en GLOBAL växel och rå typ finns alltid tillgänglig", () => {
  const store = createTailStore();
  store.ingest([ev(1, { event_type: "promotion.completed" })], "stream");
  const snapshot: TailSnapshot = {
    connection: idleSnapshot().connection,
    stream: store.view(),
    stats: store.stats(),
  };

  const swedish = renderToStaticMarkup(createElement(EventStream, { snapshot, initialRaw: false }));
  assert.ok(swedish.includes("Promotion klar"), "svensk etikett saknas");
  assert.ok(swedish.includes('data-raw-type="promotion.completed"'), "rå typ är inte tillgänglig");

  const raw = renderToStaticMarkup(createElement(EventStream, { snapshot, initialRaw: true }));
  assert.ok(raw.includes(">promotion.completed<"), "råläget visar inte rå typ");
  assert.ok(!raw.includes("Promotion klar"), "råläget översatte ändå");
});

test("V9 · en tom ström säger vad läget är i stället för att visa en tyst tom vy", () => {
  const html = renderStream(idleSnapshot());
  assert.ok(html.includes('data-stream-empty="true"'));
  assert.ok(html.includes(TRANSPORT_PRESENTATION.idle.detail));
  assert.ok(!html.includes('data-realtime="true"'), "en tom vy påstod realtid");
});
