/**
 * V3 · Eventströmmens läsprojektion: dedup, seq-ordning, gap-detektion, transient fas.
 *
 * AUKTORITATIV KÄLLA: docs/nortropic-control-room-plan-v1.md — READ_MODEL (SNAPSHOT_WINS),
 * EVENT_CLIENT (dedup, ordering, gap-detektion) och IMPLEMENTATION_SLICES §V3.
 * Vokabulär, validering och ordningsprimitiv ÄGS av V1:s lib/loop/schema.ts och byggs aldrig om
 * här — den här filen har ingen egen event- eller task-ordlista.
 *
 * BINDANDE REGLER SOM DENNA FIL BÄR MEKANISKT
 * -------------------------------------------
 * · EVENT_STREAM_IS_AUTHORITY = NO. En rad härifrån är ALDRIG authority: varje rad bär
 *   `authority: "NONE"`. Auktoritativ task-state, DONE, verdict, attestation, promotion,
 *   kandidatidentitet och current_main kommer ur controllerns snapshot — se ./snapshot.ts.
 * · Ordning läses ur `seq` ENSAMT (B3). `ts` läses aldrig som ordning; ankomstordningen
 *   läses aldrig som ordning. Vid identisk `seq` (ett backendfel) bryts liken deterministiskt
 *   på `event_id` så att utfallet är oberoende av hur strömmen kom in.
 * · Dedup sker på `event_id`, ALDRIG på `seq`. Två rader som delar `seq` men har olika
 *   `event_id` är två rader — och rapporteras som en varning (seq-kollision), aldrig som en
 *   tyst overwrite.
 * · Gap-detektion sker ENDAST på den ofiltrerade butiksströmmen (`scope: "store"`). En vy
 *   filtrerad på run_id/task_id har LEGITIMA hopp i seq (globalt monoton butik, B3) och
 *   gap-detekterar därför aldrig.
 * · En lucka RAPPORTERAS. Inga event hittas på för att fylla den, och ingen state ändras.
 * · Okänd `event_type` är data: den bevaras rå, får ingen semantik, flyttar ingen state och
 *   kastar aldrig.
 * · Tail får bara bidra med LIVE AKTIVITET, TRANSIENT fas-etikett och rader i strömmen.
 *
 * INPUT-RENHET — BINDANDE FÖR HELA LÄSMODELLEN
 * --------------------------------------------
 * Ingen exporterad funktion i den här filen får skriva i, frysa, sortera på plats eller på
 * annat sätt röra det anroparen skickade in. Indata ÄGS av anroparen; projektionen äger bara
 * de omslag den själv skapar.
 *
 * Det är inte en stilfråga. En `LoopEvent.payload` är en opak karta (B4) vars nästlade värden
 * går genom valideringen som ANROPARENS REFERENSER — zod kopierar bara den yttersta nivån.
 * En rekursiv `Object.freeze` över projektionen hade därför tyst fryst anroparens egna objekt
 * och gjort en ren läsfunktion till en dold mutation av transportens buffert. Frysning sker
 * i stället i ./snapshot.ts, och ENDAST på strukturer läsmodellen äger i sin helhet.
 *
 * VAD DENNA FIL ALDRIG GÖR
 * ------------------------
 * Ingen transport, ingen polling, ingen SSE, ingen Supabase, ingen route, inget kommando,
 * ingen Git- eller ref-uppslagning, ingen ingestion, ingen skrivning, ingen I/O, ingen klocka
 * och ingen slump. Rena funktioner in/ut — samma indata ger alltid samma utdata (E1).
 */
import {
  compareBySeq,
  isEventFamily,
  KNOWN_EVENT_TYPES,
  LOCKED,
  schemaDegradesTail,
  validateEvents,
  type EventClassification,
  type EventFamily,
  type LoopEvent,
  type Phase,
  type SchemaSupport,
  type ValidatedEvent,
} from "./schema";

/* ────────────────────────────────────────────────────────────────────────────
 * LÅSTA REGLER — speglar V1:s LOCKED, byggs inte om
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * V3:s regeluppsättning. Fem av fälten är HÄMTADE ur V1:s `LOCKED` i stället för omskrivna,
 * så att en glidning i V1 fälls här i stället för att tyst leva vidare i två versioner.
 */
export const READ_MODEL_RULES = {
  ORDERING_KEY: LOCKED.ORDERING_KEY,
  DEDUP_KEY: LOCKED.DEDUP_KEY,
  SNAPSHOT_WINS: LOCKED.SNAPSHOT_WINS,
  EVENT_STREAM_IS_AUTHORITY: LOCKED.EVENT_STREAM_IS_AUTHORITY,
  DISPLAYED_TRUTH: LOCKED.DISPLAYED_TRUTH,
  TS_IS_ORDERING: false,
  ARRIVAL_ORDER_IS_ORDERING: false,
  /** Det enda tail får flytta. Allt annat är snapshotens. */
  TAIL_MAY_CONTRIBUTE: "LIVE_ACTIVITY_AND_TRANSIENT_PHASE_AND_STREAM_ROWS",
  GAP_DETECTION_SCOPE: "UNFILTERED_STORE_STREAM_ONLY",
  /** Anroparens indata ägs av anroparen: den läses, aldrig skrivs, sorteras eller fryses. */
  MUTATES_CALLER_INPUT: false,
} as const;

/* ────────────────────────────────────────────────────────────────────────────
 * TRANSIENT FAS — display-only, aldrig lifecycle-state
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Familj → transient fas-etikett (`● BUILD pågår`). DISPLAY-ONLY och alltid obekräftad.
 *
 * Kartan är MEDVETET GLES. Bara familjer vars fasmening står i planens PhaseRail finns med;
 * övriga familjer ger `null`, alltså inget fas-påstående alls. Att gissa en fas för t.ex.
 * `candidate` eller `feedback` hade varit en uppfunnen semantik, och husets regel är hellre
 * "—" än ett tyst antagande.
 *
 * `attestation`, `promotion` och `main` finns AVSIKTLIGT INTE här: de pekar på terminala
 * utfall och hanteras som "väntar på bekräftelse" (se nedan), aldrig som fas och aldrig
 * som state.
 *
 * Objektet är fryst — men det är läsmodellens EGET objekt, inte anroparens. Se filhuvudets
 * avsnitt om input-renhet.
 */
export const TRANSIENT_PHASE_BY_FAMILY: Readonly<Partial<Record<EventFamily, Phase>>> =
  Object.freeze({
    agent: "BUILD",
    policy: "VERIFY",
    verification: "VERIFY",
    evaluation: "REVIEW",
    merge: "MERGE",
  } as const);

/** Familjer vars event pekar på ett TERMINALT utfall. De ändrar aldrig state. */
export const TERMINAL_SUGGESTING_FAMILIES: readonly EventFamily[] = Object.freeze([
  "attestation",
  "promotion",
  "main",
] as const);

/** Enskilda typer utanför de familjerna som ändå pekar på ett terminalt utfall. */
const TERMINAL_SUGGESTING_TYPE_CANDIDATES: readonly string[] = Object.freeze([
  "merge.resolution.completed",
]);

/**
 * De typer som får markeras "väntar på bekräftelse".
 *
 * HÄRLEDD ur V1:s `KNOWN_EVENT_TYPES` — aldrig en parallell handskriven lista. En typ som
 * försvinner ur schema.ts försvinner därmed automatiskt här i stället för att bli en död
 * sträng som låtsas ha mening. Okända typer kan per definition inte hamna här: de får ingen
 * semantik alls.
 *
 * URVALET ÄR MEDVETET KONSERVATIVT: hela attestation-/promotion-/main-familjerna räknas in,
 * även rader som `promotion.started` eller `promotion.failed` som i sig inte är ett avslut.
 * Konsekvensen är att markeringen "väntar på bekräftelse" ibland sätts på en rad som aldrig
 * kommer att bekräftas som terminal. Det är den ofarliga riktningen — markeringen är
 * uttryckligen OBEKRÄFTAD, den flyttar ingen state, och alternativet (att finkorna urvalet
 * per typ) hade krävt en semantik per event_type som backendens kontrakt (B4) inte låst ännu.
 */
export const TERMINAL_SUGGESTING_EVENT_TYPES: readonly string[] = Object.freeze(
  KNOWN_EVENT_TYPES.filter((eventType) => {
    const family = eventType.split(".")[0];
    const inTerminalFamily =
      isEventFamily(family) && TERMINAL_SUGGESTING_FAMILIES.includes(family);
    return inTerminalFamily || TERMINAL_SUGGESTING_TYPE_CANDIDATES.includes(eventType);
  }),
);

/**
 * Transient fas för ett event. Endast KÄNDA typer kan ge en fas — en okänd typ är data utan
 * mening. Returnerar null när familjen saknar fasmening.
 */
export function transientPhaseFor(classification: EventClassification): Phase | null {
  if (!classification.known || classification.family === null) return null;
  return TRANSIENT_PHASE_BY_FAMILY[classification.family] ?? null;
}

/** true = raden PEKAR på ett terminalt utfall. Den flyttar ändå ingen state. */
export function suggestsTerminalOutcome(classification: EventClassification): boolean {
  if (!classification.known) return false;
  return TERMINAL_SUGGESTING_EVENT_TYPES.includes(classification.raw_type);
}

/* ────────────────────────────────────────────────────────────────────────────
 * KANONISK SERIALISERING — grunden för determinism
 * ──────────────────────────────────────────────────────────────────────────── */

function compareStrings(a: string, b: string): number {
  // Kodpunktsjämförelse, aldrig localeCompare: ordningen ska vara oberoende av miljöns locale.
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * JSON med SORTERADE nycklar, rekursivt. Två strukturer med samma innehåll ger samma sträng
 * oavsett i vilken ordning fälten råkade skapas. Används både till dedup-företräde och till
 * ./snapshot.ts:s `serializeReadModel`.
 *
 * LÄSER BARA. Inga nycklar sorteras på plats i indatat, ingenting fryses: funktionen tar
 * `unknown` och kan därför få anroparens egna objekt direkt i knät.
 *
 * `undefined` utelämnas i objekt och blir `null` i listor — samma regel som JSON.stringify,
 * men explicit, så att determinismen inte hänger på en implementationsdetalj.
 */
export function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : stableStringify(item))).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    // Object.keys() ger en NY lista; sorteringen rör alltså aldrig objektet den läser.
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareStrings);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
  }
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : "null";
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    return "null";
  }
  return JSON.stringify(value) ?? "null";
}

/* ────────────────────────────────────────────────────────────────────────────
 * TYPER
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * `store` = den OFILTRERADE butiksströmmen; bara den gap-detekterar.
 * `filtered` = en run-/task-filtrerad vy; legitima seq-hopp, ALDRIG gap-larm (B3).
 */
export type StreamScope = "store" | "filtered";

/** Radens läge mot snapshotens watermark. `stale` bidrar aldrig med fas eller aktivitet. */
export type WatermarkRelation = "stale" | "tail" | "no_watermark";

export type ProjectedEventRow = {
  /** Eventet oförändrat, precis som V1 validerade det. */
  event: LoopEvent;
  classification: EventClassification;
  schema_support: SchemaSupport;
  relation: WatermarkRelation;
  /** DISPLAY-ONLY fas. null för okänd typ, stale rad, degraderat schema och faslös familj. */
  transient_phase: Phase | null;
  /** Raden pekar på ett terminalt utfall → "väntar på bekräftelse", aldrig state. */
  suggests_terminal_outcome: boolean;
  /** Konstant. En eventrad är aldrig authority. */
  authority: "NONE";
};

/** En LUCKA i den ofiltrerade butiksströmmen. Rapporteras — fylls aldrig med påhittade rader. */
export type SeqGap = {
  /** Första saknade seq (inklusive). */
  from: number;
  /** Sista saknade seq (inklusive). */
  to: number;
  /** Antal saknade seq i intervallet. */
  missing: number;
};

/** Två OLIKA event_id som delar samma seq. Ett backendfel som ska SYNAS, inte tystas. */
export type SeqCollision = { seq: number; event_ids: string[] };

/** Samma event_id levererat flera gånger. Rapport om LEVERANSEN, inte om läget. */
export type DuplicateReport = {
  event_id: string;
  occurrences: number;
  /** false = dubbletterna skilde sig åt i innehåll; kanonisk form valdes deterministiskt. */
  identical: boolean;
  distinct_forms: number;
};

/** Tail slutar härleda fas vid nyare/oläsbar major (EVENT_CLIENT). Snapshot renderas vidare. */
export type TailPhaseDerivation = "enabled" | "disabled_unsupported_schema";

/** Den DETERMINISTISKA delen: identisk för varje permutation och duplicering av samma mängd. */
export type StreamView = {
  scope: StreamScope;
  gap_detection: "store_stream" | "disabled_filtered_view";
  /** Ordnade på seq, unika på event_id. */
  rows: ProjectedEventRow[];
  gaps: SeqGap[];
  seq_collisions: SeqCollision[];
  first_seq: number | null;
  last_seq: number | null;
  seq_watermark: number | null;
  /** Nyare eller oläsbar major någonstans i strömmen → banner i UI:t, aldrig krasch. */
  schema_banner: boolean;
  tail_phase_derivation: TailPhaseDerivation;
  counts: { rows: number; stale: number; tail: number; unknown_type: number };
};

/**
 * Hur strömmen LEVERERADES. Ingår avsiktligt INTE i den kanoniska serialiseringen av
 * read-modellen: en dubblerad eller omkastad leverans ska ge ett IDENTISKT visat läge
 * (V3 exit 2), men leveransen i sig får såklart rapporteras.
 */
export type IngestReport = {
  received: number;
  accepted: number;
  invalid: { index: number; message: string }[];
  duplicates: DuplicateReport[];
};

export type EventProjection = { stream: StreamView; ingest: IngestReport };

export type ProjectEventsOptions = {
  /** Default "store". "filtered" stänger av gap-detektion helt. */
  scope?: StreamScope;
  /** Snapshotens seq_watermark. null = ingen snapshot → ingen stale/tail-gräns. */
  seq_watermark?: number | null;
  /**
   * Känd baslinje (t.ex. `after_seq` i ett backfill-fönster). Sätts den upptäcks även en
   * lucka FÖRE strömmens första rad. Utan baslinje antas ingenting om vad som låg innan.
   */
  expected_after_seq?: number | null;
};

/* ────────────────────────────────────────────────────────────────────────────
 * DEDUP · ORDNING · GAP
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Företräde mellan två leveranser av SAMMA event_id. Rent innehållsbaserat (seq, sedan
 * kanonisk form) och därmed oberoende av ankomstordningen — annars hade "senast vinner"
 * gjort utfallet till en funktion av nätverket i stället för av data.
 */
function dedupPrecedence(a: ValidatedEvent, b: ValidatedEvent): number {
  const bySeq = compareBySeq(a.event, b.event);
  if (bySeq !== 0) return bySeq;
  return compareStrings(stableStringify(a.event), stableStringify(b.event));
}

/**
 * Dedup på `event_id` — ALDRIG på `seq`. Två olika event_id med samma seq överlever båda.
 * Returnerar de unika raderna (osorterade) plus en rapport om dubbletterna.
 *
 * Listan som skickas in läses bara: inget element flyttas, skrivs eller fryses.
 */
export function dedupeByEventId(events: readonly ValidatedEvent[]): {
  unique: ValidatedEvent[];
  duplicates: DuplicateReport[];
} {
  const byEventId = new Map<string, ValidatedEvent[]>();
  for (const validated of events) {
    const key = validated.event.event_id;
    const bucket = byEventId.get(key);
    if (bucket) bucket.push(validated);
    else byEventId.set(key, [validated]);
  }

  const unique: ValidatedEvent[] = [];
  const duplicates: DuplicateReport[] = [];
  for (const [eventId, bucket] of byEventId) {
    let winner = bucket[0];
    for (const candidate of bucket.slice(1)) {
      if (dedupPrecedence(candidate, winner) < 0) winner = candidate;
    }
    unique.push(winner);
    if (bucket.length > 1) {
      const forms = new Set(bucket.map((validated) => stableStringify(validated.event)));
      duplicates.push({
        event_id: eventId,
        occurrences: bucket.length,
        identical: forms.size === 1,
        distinct_forms: forms.size,
      });
    }
  }
  duplicates.sort((a, b) => compareStrings(a.event_id, b.event_id));
  return { unique, duplicates };
}

/**
 * Läsordning: `seq` ensamt, med `event_id` som deterministisk likabrytare. Likabrytaren är
 * INTE en andra ordningsnyckel i ordets mening — den finns bara för att en seq-kollision
 * (backendfel) annars hade gjort serialiseringen beroende av ankomstordningen.
 *
 * Sorterar en KOPIA. Anroparens lista ligger kvar i sin ursprungliga ordning.
 */
export function orderProjectedRows<T extends { event: LoopEvent }>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      compareBySeq(a.event, b.event) || compareStrings(a.event.event_id, b.event.event_id),
  );
}

/**
 * Luckor i en STIGANDE lista av seq-värden. Rapport, inte reparation: inget event hittas på,
 * ingen rad hoppas tyst över och ingen state ändras.
 */
export function detectSeqGaps(
  ascendingSeqs: readonly number[],
  expectedAfterSeq: number | null = null,
): SeqGap[] {
  const gaps: SeqGap[] = [];
  let previous = expectedAfterSeq;
  for (const seq of ascendingSeqs) {
    if (previous !== null && seq > previous + 1) {
      gaps.push({ from: previous + 1, to: seq - 1, missing: seq - previous - 1 });
    }
    // Vid seq-kollision (samma seq två gånger) flyttas inte baslinjen bakåt.
    if (previous === null || seq > previous) previous = seq;
  }
  return gaps;
}

function collectSeqCollisions(rows: readonly ProjectedEventRow[]): SeqCollision[] {
  const bySeq = new Map<number, string[]>();
  for (const row of rows) {
    const bucket = bySeq.get(row.event.seq);
    if (bucket) bucket.push(row.event.event_id);
    else bySeq.set(row.event.seq, [row.event.event_id]);
  }
  const collisions: SeqCollision[] = [];
  for (const [seq, eventIds] of bySeq) {
    if (eventIds.length > 1) collisions.push({ seq, event_ids: [...eventIds].sort(compareStrings) });
  }
  return collisions.sort((a, b) => a.seq - b.seq);
}

function watermarkRelation(seq: number, watermark: number | null): WatermarkRelation {
  if (watermark === null) return "no_watermark";
  return seq <= watermark ? "stale" : "tail";
}

/* ────────────────────────────────────────────────────────────────────────────
 * PROJEKTIONEN
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Projicerar en RÅ eventström till en deterministisk läsvy.
 *
 * Tar `unknown` och kastar aldrig: valideringen är V1:s (`validateEvents`), ogiltiga rader
 * rapporteras med index i stället för att tystas, och en indata som inte ens är en lista
 * degraderar till en tom ström med rapporterat fel.
 *
 * INPUT-RENHET: `input` läses, aldrig skrivs. Observera att en validerad `payload` kan bära
 * NÄSTLADE referenser till anroparens objekt (opak karta, B4) — projektionen behandlar dem
 * som lånade och rör dem aldrig.
 *
 * Ingenting här flyttar state. Resultatet konsumeras av ./snapshot.ts, som lägger det UNDER
 * controllerns snapshot — aldrig över den.
 */
export function projectEvents(
  input: unknown,
  options: ProjectEventsOptions = {},
): EventProjection {
  const scope: StreamScope = options.scope ?? "store";
  const watermark = options.seq_watermark ?? null;
  const expectedAfterSeq = options.expected_after_seq ?? null;

  const { valid, invalid } = validateEvents(input);
  const { unique, duplicates } = dedupeByEventId(valid);

  // Schemadegradering är GLOBAL enligt EVENT_CLIENT: en nyare eller oläsbar major någonstans
  // i strömmen stoppar all fas-härledning ur tail. Snapshoten fortsätter renderas.
  const schemaBanner = unique.some((validated) => schemaDegradesTail(validated.schema_support));
  const tailPhaseDerivation: TailPhaseDerivation = schemaBanner
    ? "disabled_unsupported_schema"
    : "enabled";

  const rows: ProjectedEventRow[] = orderProjectedRows(
    unique.map((validated) => ({ event: validated.event, validated })),
  ).map(({ validated }) => {
    const relation = watermarkRelation(validated.event.seq, watermark);
    const phaseAllowed = relation !== "stale" && tailPhaseDerivation === "enabled";
    return {
      event: validated.event,
      classification: validated.classification,
      schema_support: validated.schema_support,
      relation,
      transient_phase: phaseAllowed ? transientPhaseFor(validated.classification) : null,
      suggests_terminal_outcome: suggestsTerminalOutcome(validated.classification),
      authority: "NONE" as const,
    };
  });

  const gaps =
    scope === "store"
      ? detectSeqGaps(
          rows.map((row) => row.event.seq),
          expectedAfterSeq,
        )
      : [];

  const stream: StreamView = {
    scope,
    gap_detection: scope === "store" ? "store_stream" : "disabled_filtered_view",
    rows,
    gaps,
    seq_collisions: collectSeqCollisions(rows),
    first_seq: rows.length > 0 ? rows[0].event.seq : null,
    last_seq: rows.length > 0 ? rows[rows.length - 1].event.seq : null,
    seq_watermark: watermark,
    schema_banner: schemaBanner,
    tail_phase_derivation: tailPhaseDerivation,
    counts: {
      rows: rows.length,
      stale: rows.filter((row) => row.relation === "stale").length,
      tail: rows.filter((row) => row.relation === "tail").length,
      unknown_type: rows.filter((row) => !row.classification.known).length,
    },
  };

  return {
    stream,
    ingest: {
      received: Array.isArray(input) ? input.length : 0,
      accepted: rows.length,
      invalid,
      duplicates,
    },
  };
}

/** Raderna som får bidra med liveaktivitet och transient fas: allt utom `stale`. */
export function liveRows(stream: StreamView): ProjectedEventRow[] {
  return stream.rows.filter((row) => row.relation !== "stale");
}
