/**
 * V3 · SNAPSHOT_WINS-sammanslagningen: controllerns snapshot + eventströmmen → read model.
 *
 * AUKTORITATIV KÄLLA: docs/nortropic-control-room-plan-v1.md — READ_MODEL ("Grundregel —
 * SNAPSHOT_WINS") och IMPLEMENTATION_SLICES §V3.
 *
 * GRUNDREGELN, MEKANISKT
 * ----------------------
 * ```text
 * DISPLAYED_TRUTH           = controller-publicerad snapshot
 * LIVE_TAIL                 = event med seq > snapshot.seq_watermark
 * SNAPSHOT_WINS             = YES
 * EVENT_STREAM_IS_AUTHORITY = NO
 * ```
 *
 * · AUKTORITATIVA FÄLT — task lifecycle-state, DONE, policy/verification/task_gate/evaluation,
 *   attestation, promotion, merge, kandidatidentiteter (base_sha/candidate_sha) och
 *   current_main — KOPIERAS oförändrade ur snapshoten. Ingen fold rör dem. Modellen lämnas
 *   dessutom fryst (se INPUT-RENHET nedan), så ett senare lager inte ens kan skriva i dem.
 * · TAIL får bidra med tre saker och inget mer: rader i strömmen, liveaktivitet och en
 *   TRANSIENT fas-etikett där snapshoten inte påstår någon fas.
 * · Ett tail-event som pekar på ett terminalt utfall (attestation/promotion/main/löst merge)
 *   blir en OBEKRÄFTAD markering — planens *"väntar på bekräftelse"* — tills en snapshot med
 *   tillräcklig `seq_watermark` bekräftar det. Det ändrar aldrig state.
 * · KONFLIKT snapshot ↔ tail: snapshoten vinner alltid. Divergensen OBSERVERAS och loggas i
 *   `divergences` — ett observerbarhetslarm, aldrig en dom och aldrig något som ändrar det
 *   som visas.
 * · Ingen snapshot (eller en avvisad snapshot) → INGEN task lifecycle-state alls. Bara ström
 *   och transienta faser (E13). Aldrig en uppfunnen tom kontrollrumsvy utan orsak.
 * · Inga procent, ingen stapel, ingen uppskattning, inget härlett controllerbeslut. Saknat
 *   värde är `null` och renderas "—" av vyerna.
 *
 * INPUT-RENHET — LIKA BINDANDE SOM SNAPSHOT_WINS
 * ----------------------------------------------
 * `buildReadModel` läser sin indata och skriver ALDRIG i den. Anroparens eventlista, dess
 * event, deras `payload` och snapshotens opaka kartor ska efter anropet vara strukturellt
 * oförändrade OCH lika muterbara som innan.
 *
 * Det kräver omsorg, för valideringen ensam räcker inte: zod kopierar objektets yttersta
 * nivå, men en opak karta (`payload`, `run.breaker`, `run.budget`, `TaskView.merge` — B4/S5/S8)
 * bär sina NÄSTLADE värden vidare som anroparens egna referenser. En rekursiv `Object.freeze`
 * över den färdiga modellen — den självklara vägen till "tail kan inte skriva över snapshot" —
 * hade därför krupit ut genom de referenserna och tyst fryst transportens buffert hos
 * anroparen. En ren läsfunktion hade blivit en dold mutation.
 *
 * Lösningen är `frozenDeepCopy`: modellen KOPIERAS till strukturer som läsmodellen äger i sin
 * helhet, och först de fryses. Immutabiliteten är kvar, anroparens objekt är orörda, och
 * modellen aliaserar inte längre indata åt någotdera hållet. Objekt som varken är enkla
 * objekt eller listor (Date, klassinstans, …) kan komma ur en opak karta och ägs alltid av
 * anroparen: de bärs vidare som de är, varken kopierade eller frysta.
 *
 * VAD DENNA FIL ALDRIG GÖR
 * ------------------------
 * Ingen transport, ingen polling/SSE, ingen Supabase, ingen route, inget kommando, ingen
 * ingestion, ingen controller-skrivning, ingen Git- eller origin/main-uppslagning, ingen I/O,
 * ingen klocka. Rena funktioner.
 */
import {
  liveRows,
  projectEvents,
  stableStringify,
  type ProjectedEventRow,
  type StreamScope,
  type StreamView,
  type IngestReport,
} from "./events";
import {
  validateSnapshot,
  type LoopSnapshot,
  type Phase,
  type TaskLifecycle,
  type TaskView,
} from "./schema";

/* ────────────────────────────────────────────────────────────────────────────
 * TYPER
 * ──────────────────────────────────────────────────────────────────────────── */

export type SnapshotStatus = "present" | "absent" | "rejected";

/**
 * Statusen för en tail-rad som pekar på ett terminalt utfall.
 *
 * Planens UI-text är *"väntar på bekräftelse"*. Strängen bor i V1:s labels.ts-yta när den
 * behövs — här bärs bara det maskinläsbara tillståndet, så att ingen vy kan råka läsa det
 * som en dom.
 */
export type PendingStatus = "AWAITING_SNAPSHOT_CONFIRMATION";

export type PendingConfirmation = {
  task_id: string | null;
  event_id: string;
  seq: number;
  event_type: string;
  status: PendingStatus;
  /** Konstant `null`: tail-raden bekräftar ingen state. Bara en senare snapshot gör det. */
  confirms_state: null;
};

/** Snapshot och tail sa olika. Observeras och loggas — ändrar aldrig det som visas. */
export type Divergence =
  | {
      kind: "phase";
      task_id: string;
      snapshot_value: Phase | null;
      tail_value: Phase | null;
      resolution: "SNAPSHOT_WINS";
      observed_only: true;
    }
  | {
      kind: "terminal_suggested_by_tail";
      task_id: string | null;
      event_id: string;
      event_type: string;
      snapshot_state: TaskLifecycle | null;
      resolution: "SNAPSHOT_WINS";
      observed_only: true;
    };

/**
 * Fasens tre lager hålls ISÄR med flit. `authoritative` skrivs aldrig av tail, och
 * `displayed` faller tillbaka på tail ENDAST när snapshoten inte påstår någon fas — en
 * verklig konflikt löses alltid till snapshotens värde.
 */
export type PhaseProjection = {
  /** Ur snapshot. Orörd. */
  authoritative: Phase | null;
  /** Ur tail. DISPLAY-ONLY och alltid obekräftad. */
  transient: Phase | null;
  displayed: Phase | null;
  displayed_source: "snapshot" | "tail_transient" | "none";
  /** true endast när `displayed` kom ur snapshoten. */
  confirmed: boolean;
  diverges_from_snapshot: boolean;
};

/** Liveaktivitet ur tail. `last_ts` är DISPLAY-ONLY och används aldrig till ordning. */
export type LiveActivity = {
  tail_event_count: number;
  last_seq: number | null;
  last_ts: string | null;
};

export type TaskBucket = "current" | "backlog" | "completed";

export type TaskProjection = {
  task_id: string;
  bucket: TaskBucket;
  /** ENDAST ur snapshot. Tail kan aldrig flytta den — inte ens till DONE. */
  lifecycle_state: TaskLifecycle;
  lifecycle_source: "snapshot";
  /** Snapshotens TaskView, kopierad oförändrad. Auktoritativa fält läses HÄRIFRÅN. */
  authoritative: TaskView;
  phase: PhaseProjection;
  pending: PendingConfirmation[];
  live: LiveActivity;
};

/**
 * En task som bara finns i strömmen. Den har INGEN lifecycle-state — inget första
 * lifecycle-tillstånd, ingen etikett okänd, ingen nolla. Bara ström och transient fas,
 * precis som E13 kräver.
 */
export type TailOnlyTaskProjection = {
  task_id: string;
  lifecycle_state: null;
  lifecycle_source: "unavailable_without_snapshot";
  authoritative: null;
  phase: PhaseProjection;
  pending: PendingConfirmation[];
  live: LiveActivity;
};

export type SnapshotHead = {
  status: SnapshotStatus;
  /** Orsak när status är "rejected". Ett avvisande är alltid SYNLIGT, aldrig en tyst tom vy. */
  reason: string | null;
  schema_version: string | null;
  run_id: string | null;
  seq_watermark: number | null;
  published_ts: string | null;
  run: LoopSnapshot["run"] | null;
  /** Controllerns BEKRÄFTADE main. Verkstadsgolvet slår aldrig upp origin/main själv. */
  current_main: LoopSnapshot["current_main"] | null;
};

export type ReadModel = {
  displayed_truth: "CONTROLLER_PUBLISHED_SNAPSHOT" | "NONE";
  snapshot: SnapshotHead;
  /** Tasks ur snapshoten, i ordningen current → backlog → completed. */
  tasks: TaskProjection[];
  /** Task-id som bara setts i strömmen. Ingen lifecycle-state. */
  tail_only_tasks: TailOnlyTaskProjection[];
  /** Avvikelser i snapshoten som ska synas i stället för att tystas. */
  snapshot_anomalies: { duplicate_task_ids: string[] };
  stream: StreamView;
  /** Alla obekräftade terminala tail-signaler, inklusive dem utan task_id. */
  pending_confirmations: PendingConfirmation[];
  divergences: Divergence[];
  /** Leveransrapport. Ingår INTE i `serializeReadModel` — se dess doc. */
  ingest: IngestReport;
};

export type ReadModelInput = {
  /**
   * Rå eller redan validerad snapshot. Går ALLTID genom V1:s `validateSnapshot`, så en
   * uppfunnen form avvisas här i stället för att renderas. null/undefined = ingen snapshot.
   */
  snapshot: unknown;
  /** Rå eventström. Går genom V1:s `validateEvents` via ./events.ts. */
  events: unknown;
  /** "filtered" (run-/task-filtrerad vy) stänger av gap-detektion. Default "store". */
  scope?: StreamScope;
  expected_after_seq?: number | null;
};

/* ────────────────────────────────────────────────────────────────────────────
 * ÄGANDE OCH IMMUTABILITET
 * ──────────────────────────────────────────────────────────────────────────── */

/** Enkelt objekt = objektliteral eller nollprototyp. Allt annat ägs av den som skapade det. */
function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

/**
 * Djupkopia som fryser KOPIAN — aldrig originalet.
 *
 * Skälet står i filhuvudet: modellen bär nästlade referenser som i själva verket ägs av
 * anroparen (opaka kartor, B4). `Object.freeze` rakt över modellen hade därmed frusit dem.
 * Här skapas i stället nya listor och objekt hela vägen ner, och bara de fryses.
 *
 * · `seen` bevarar delade referenser som delade och gör funktionen tålig mot en cyklisk
 *   opak karta i stället för att spinna i en oändlig rekursion.
 * · Objekt som varken är listor eller enkla objekt (Date, Map, klassinstans, …) kan bara ha
 *   kommit ur anroparens opaka data. De bärs vidare oförändrade: att kopiera dem hade krävt
 *   en gissning om deras form, att frysa dem hade varit exakt den mutation vi undviker.
 */
function frozenDeepCopy<T>(value: T, seen: Map<object, unknown> = new Map()): T {
  if (value === null || typeof value !== "object") return value;

  const source = value as unknown as object;
  if (seen.has(source)) return seen.get(source) as T;

  if (Array.isArray(source)) {
    const copy: unknown[] = [];
    seen.set(source, copy);
    for (const item of source) copy.push(frozenDeepCopy(item, seen));
    return Object.freeze(copy) as T;
  }

  if (!isPlainObject(source)) {
    // Lånat av anroparen. Varken kopierat eller fryst — bara vidarebefordrat.
    seen.set(source, source);
    return value;
  }

  const copy: Record<string, unknown> = {};
  seen.set(source, copy);
  for (const [key, nested] of Object.entries(source as Record<string, unknown>)) {
    copy[key] = frozenDeepCopy(nested, seen);
  }
  return Object.freeze(copy) as T;
}

/* ────────────────────────────────────────────────────────────────────────────
 * HJÄLPARE
 * ──────────────────────────────────────────────────────────────────────────── */

function pendingFor(row: ProjectedEventRow): PendingConfirmation {
  return {
    task_id: row.event.task_id,
    event_id: row.event.event_id,
    seq: row.event.seq,
    event_type: row.event.event_type,
    status: "AWAITING_SNAPSHOT_CONFIRMATION",
    confirms_state: null,
  };
}

/** Sista transienta fasen i seq-ordning. `ts` läses aldrig. */
function transientPhaseFromRows(rows: readonly ProjectedEventRow[]): Phase | null {
  let phase: Phase | null = null;
  for (const row of rows) {
    if (row.transient_phase !== null) phase = row.transient_phase;
  }
  return phase;
}

function liveActivityFromRows(rows: readonly ProjectedEventRow[]): LiveActivity {
  const last = rows.length > 0 ? rows[rows.length - 1] : null;
  return {
    tail_event_count: rows.length,
    last_seq: last ? last.event.seq : null,
    // DISPLAY-ONLY. Aldrig ordning, aldrig ett härlett "det gick bra".
    last_ts: last ? last.event.ts : null,
  };
}

/**
 * Sätter ihop fasens tre lager.
 *
 * VAL SOM ÄR VÄRT ATT LÄSA: planen tillåter tail att flytta fas-etiketten, men V3:s regel är
 * att en KONFLIKT alltid löses till snapshoten. Båda hålls genom att tail bara får fylla
 * tomrummet: har snapshoten en fas visas den, har den ingen får tail visa en obekräftad. En
 * avvikelse loggas ändå i `divergences`, så att den är observerbar utan att ändra vyn.
 */
function buildPhase(snapshotPhase: Phase | null, transient: Phase | null): PhaseProjection {
  const displayed = snapshotPhase ?? transient;
  const displayedSource: PhaseProjection["displayed_source"] =
    snapshotPhase !== null ? "snapshot" : transient !== null ? "tail_transient" : "none";
  return {
    authoritative: snapshotPhase,
    transient,
    displayed,
    displayed_source: displayedSource,
    confirmed: displayedSource === "snapshot",
    diverges_from_snapshot:
      transient !== null && snapshotPhase !== null && transient !== snapshotPhase,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * SAMMANSLAGNINGEN
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Bygger read-modellen. Ren funktion, kastar aldrig, rör aldrig anroparens indata, och samma
 * indata ger alltid samma utdata (E1) — även om strömmen kom omkastad eller dubblerad
 * (V3 exit 2).
 */
export function buildReadModel(input: ReadModelInput): ReadModel {
  /* 1 · Snapshoten först. Den är DISPLAYED_TRUTH och sätter watermarken. */
  let status: SnapshotStatus = "absent";
  let reason: string | null = null;
  let snapshot: LoopSnapshot | null = null;
  if (input.snapshot !== null && input.snapshot !== undefined) {
    const result = validateSnapshot(input.snapshot);
    if (result.ok) {
      status = "present";
      snapshot = result.data;
    } else {
      // En avvisad snapshot är "ingen färsk snapshot" MED orsak — aldrig en tyst tom vy och
      // aldrig ett tillfälle för tail att ta över authority.
      status = "rejected";
      reason = result.message;
    }
  }

  /* 2 · Strömmen projiceras UNDER snapshoten, med dess watermark som stale/tail-gräns. */
  const { stream, ingest } = projectEvents(input.events, {
    scope: input.scope ?? "store",
    seq_watermark: snapshot ? snapshot.seq_watermark : null,
    expected_after_seq: input.expected_after_seq ?? null,
  });

  const live = liveRows(stream);
  const rowsByTask = new Map<string, ProjectedEventRow[]>();
  for (const row of live) {
    const taskId = row.event.task_id;
    if (taskId === null) continue;
    const bucket = rowsByTask.get(taskId);
    if (bucket) bucket.push(row);
    else rowsByTask.set(taskId, [row]);
  }

  const divergences: Divergence[] = [];

  /* 3 · Tasks — auktoritativa fält KOPIERAS ur snapshoten, aldrig foldade fram. */
  const tasks: TaskProjection[] = [];
  const duplicateTaskIds: string[] = [];
  const seenTaskIds = new Set<string>();

  const snapshotTasks: { view: TaskView; bucket: TaskBucket }[] = snapshot
    ? [
        ...(snapshot.current_task ? [{ view: snapshot.current_task, bucket: "current" as const }] : []),
        ...snapshot.backlog.map((view) => ({ view, bucket: "backlog" as const })),
        ...snapshot.completed.map((view) => ({ view, bucket: "completed" as const })),
      ]
    : [];

  for (const { view, bucket } of snapshotTasks) {
    if (seenTaskIds.has(view.task_id)) {
      // Samma task i två hinkar är en avvikelse i snapshoten. Den SYNS i stället för att
      // ge två motstridiga kort. Första förekomsten (current → backlog → completed) gäller.
      if (!duplicateTaskIds.includes(view.task_id)) duplicateTaskIds.push(view.task_id);
      continue;
    }
    seenTaskIds.add(view.task_id);

    const taskRows = rowsByTask.get(view.task_id) ?? [];
    const pending = taskRows.filter((row) => row.suggests_terminal_outcome).map(pendingFor);
    const phase = buildPhase(view.phase, transientPhaseFromRows(taskRows));

    if (phase.diverges_from_snapshot) {
      divergences.push({
        kind: "phase",
        task_id: view.task_id,
        snapshot_value: phase.authoritative,
        tail_value: phase.transient,
        resolution: "SNAPSHOT_WINS",
        observed_only: true,
      });
    }
    for (const row of taskRows) {
      if (!row.suggests_terminal_outcome) continue;
      divergences.push({
        kind: "terminal_suggested_by_tail",
        task_id: view.task_id,
        event_id: row.event.event_id,
        event_type: row.event.event_type,
        snapshot_state: view.state,
        resolution: "SNAPSHOT_WINS",
        observed_only: true,
      });
    }

    tasks.push({
      task_id: view.task_id,
      bucket,
      // Ur snapshoten. Punkt. Ingen tail-sekvens kan flytta den hit.
      lifecycle_state: view.state,
      lifecycle_source: "snapshot",
      authoritative: view,
      phase,
      pending,
      live: liveActivityFromRows(taskRows),
    });
  }

  /* 4 · Tasks som BARA finns i strömmen: ström + transient fas, ingen lifecycle-state. */
  const tailOnlyTasks: TailOnlyTaskProjection[] = [];
  for (const [taskId, taskRows] of [...rowsByTask].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (seenTaskIds.has(taskId)) continue;
    const pending = taskRows.filter((row) => row.suggests_terminal_outcome).map(pendingFor);
    for (const row of taskRows) {
      if (!row.suggests_terminal_outcome) continue;
      divergences.push({
        kind: "terminal_suggested_by_tail",
        task_id: taskId,
        event_id: row.event.event_id,
        event_type: row.event.event_type,
        // Ingen snapshot känner uppgiften → ingen state att jämföra mot. Aldrig en gissning.
        snapshot_state: null,
        resolution: "SNAPSHOT_WINS",
        observed_only: true,
      });
    }
    tailOnlyTasks.push({
      task_id: taskId,
      lifecycle_state: null,
      lifecycle_source: "unavailable_without_snapshot",
      authoritative: null,
      phase: buildPhase(null, transientPhaseFromRows(taskRows)),
      pending,
      live: liveActivityFromRows(taskRows),
    });
  }

  /* 5 · Terminala signaler utan task_id (t.ex. main.advanced) är också obekräftade. */
  const pendingConfirmations: PendingConfirmation[] = live
    .filter((row) => row.suggests_terminal_outcome)
    .map(pendingFor);
  for (const row of live) {
    if (!row.suggests_terminal_outcome || row.event.task_id !== null) continue;
    divergences.push({
      kind: "terminal_suggested_by_tail",
      task_id: null,
      event_id: row.event.event_id,
      event_type: row.event.event_type,
      snapshot_state: null,
      resolution: "SNAPSHOT_WINS",
      observed_only: true,
    });
  }

  const model: ReadModel = {
    displayed_truth: snapshot ? "CONTROLLER_PUBLISHED_SNAPSHOT" : "NONE",
    snapshot: {
      status,
      reason,
      schema_version: snapshot ? snapshot.schema_version : null,
      run_id: snapshot ? snapshot.run_id : null,
      seq_watermark: snapshot ? snapshot.seq_watermark : null,
      published_ts: snapshot ? snapshot.published_ts : null,
      run: snapshot ? snapshot.run : null,
      current_main: snapshot ? snapshot.current_main : null,
    },
    tasks,
    tail_only_tasks: tailOnlyTasks,
    snapshot_anomalies: { duplicate_task_ids: duplicateTaskIds },
    stream,
    pending_confirmations: pendingConfirmations,
    divergences,
    ingest,
  };

  // Modellen lämnas ifrån sig som en FRUSEN KOPIA. Anroparens event, payloads och opaka
  // kartor ligger kvar precis som de kom in — lika muterbara som innan.
  return frozenDeepCopy(model);
}

/* ────────────────────────────────────────────────────────────────────────────
 * SERIALISERING
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Nycklar som UTELÄMNAS ur den kanoniska serialiseringen. `ingest` beskriver hur strömmen
 * LEVERERADES (antal mottagna rader, dubbletter, ogiltiga rader) — inte vad som visas. V3:s
 * exit 2 kräver att en dubblerad och omkastad leverans ger ett IDENTISKT visat läge, och det
 * vore meningslöst om leveransstatistiken räknades in i jämförelsen.
 */
export const SERIALIZATION_EXCLUDED_KEYS: readonly (keyof ReadModel)[] = ["ingest"];

/**
 * Kanonisk sträng för det VISADE läget. Sorterade nycklar hela vägen ner, så jämförelsen
 * mäter innehåll och inte i vilken ordning fälten råkade byggas.
 */
export function serializeReadModel(model: ReadModel): string {
  const { ingest: _deliveryReport, ...displayed } = model;
  return stableStringify(displayed);
}
