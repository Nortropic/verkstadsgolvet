/**
 * ROOM-03 · Orsakskedjan som PRESENTATIONSPROJEKTION — aldrig en authority.
 *
 * KÄLLA: docs/nortropic-factory-room-master-roadmap-v1.md §ROOM-03 (fryst) ovanpå
 * docs/nortropic-control-room-plan-v1.md.
 *
 * DEN HÄR SKIVAN ÄR FIXTURSIDAN OCH ÄR ALDRIG LIVE-KOMPLETT
 * ---------------------------------------------------------
 * Den fulla kedjan och det empiriska kriteriet ("för EN verklig körning löser varje hopp upp till
 * en lagrad identifierare") kräver backendens S5 (eventbutik) och S13 (läsyta). Ingendera finns.
 * Projektionen nedan monterar kedjan ur de VALIDERADE fixturposterna och märks som fixtur i UI:t.
 *
 * ```text
 * CAUSAL_CHAIN_MODE                 = FIXTURE_PROJECTION
 * CAUSAL_CHAIN_LIVE_BLOCKED_ON      = nortropic-system S5 + S13
 * INFERRED_RELATIONSHIP_WITHOUT_ID  = NEVER
 * CLIENT_SIDE_FOLD_IS_AUTHORITY     = NO
 * WALL_CLOCK_IS_ORDERING_AUTHORITY  = NO
 * RAW_RECORDS_HIDDEN                = NO
 * ```
 *
 * BINDANDE REGLER SOM FILEN BÄR MEKANISKT
 * ---------------------------------------
 * · INGEN BINDNING UTAN ETT VERKLIGT ID. Ett hopp skrivs ut som BUNDET bara när samma verkliga
 *   identifierarvärde finns i båda posterna (eller när posten bevisligen LIGGER I den post som
 *   bär identifieraren). Närhet, ordning, ordningstal och tidsstämplar binder ingenting.
 * · Saknas den bindande identifieraren är hoppet FRÅNVARANDE och renderas "—" med orsak. Ett
 *   frånvarande hopp bär inga id, ingen bindning och inget påstående.
 * · Agentsessionen och granskningen har INGEN identitet i dagens kontrakt. De är därför
 *   strukturellt frånvarande med en ärlig orsak — ingen identitet uppfinns.
 * · ORDNINGEN ÄR SEMANTISK OCH FAST (`CHAIN_HOPS`). Den är ingen tidssortering: `ts` läses
 *   aldrig här, och inom strömmen gäller `seq` ensamt.
 * · INGEN EGEN FOLD. Filen bygger ingen läsmodell och viker ingen ström till ett tillstånd —
 *   ROOM-01:s regel för rummets filer gäller oförändrat. Uppgiftsposten LÄSES orörd ur
 *   controllerns snapshot (DISPLAYED_TRUTH, SNAPSHOT_WINS), och kedjan renderar inget
 *   lifecycle-tillstånd alls: det ägs av snapshoten och visas av uppgiftens kort.
 * · Strömmens rader används BARA till identifierare (run_id, attempt_id), bevisreferenser och
 *   rå inspektion. De ordnas med V1:s egen `orderEvents` — `seq` ensamt, `ts` läses aldrig —
 *   och de är aldrig authority.
 * · Varje hopp bär sin POST ORDAGRANT (`raw`). Rå inspektion göms aldrig bakom projektionen.
 * · Bevisreferenser är REFERENSER. Filen hämtar ingen nyttolast och bäddar inte in något
 *   hemligt material — den bär strängarna vidare precis som de står i posten.
 *
 * VAD FILEN ALDRIG GÖR
 * --------------------
 * Ingen I/O, ingen transport, ingen klocka, ingen slump, ingen loggning, ingen state. Rena
 * funktioner in och ut: samma indata ger alltid samma kedja.
 */
import type { IntakeOutcome } from "../intake";
import { orderEvents, type Command, type LoopEvent, type LoopSnapshot, type TaskView } from "../schema";

/* ────────────────────────────────────────────────────────────────────────────
 * LÄGET OCH ORDNINGEN — som DATA, så att de kan mätas i stället för att läsas
 * ──────────────────────────────────────────────────────────────────────────── */

/** Fixtursidan. Den levande kedjan byter det här värdet, inte filens regler. */
export const CAUSAL_CHAIN_MODE = "FIXTURE_PROJECTION" as const;

/** Ägaren av den fulla kedjan. Bärs ordagrant så ingen skiva kan kalla fixturen live-komplett. */
export const CAUSAL_CHAIN_LIVE_BLOCKED_ON = "nortropic-system S5 + S13" as const;

export const CAUSAL_ORDER = {
  /** Hoppen ligger i en FAST semantisk sekvens. Ingen tidssortering, ingen omflyttning. */
  HOP_ORDER: "fixed semantic sequence (CHAIN_HOPS)",
  HOP_ORDER_IS_TIME_SORTED: "NO",
  /** Inom strömmen: `seq` ensamt, via V1:s egen `orderEvents`. `ts` läses aldrig. */
  EVENT_ORDER_WITHIN_HOP: "seq",
  WALL_CLOCK_IS_ORDERING_AUTHORITY: "NO",
  /** Tillståndet ägs av controllerns snapshot. Kedjan renderar inget tillstånd alls. */
  LIFECYCLE_STATE_AUTHORITY: "CONTROLLER_PUBLISHED_SNAPSHOT",
  LIFECYCLE_STATE_RENDERED_HERE: "NO",
  CLIENT_SIDE_FOLD_IS_AUTHORITY: "NO",
  RAW_RECORDS_HIDDEN: "NO",
} as const;

/**
 * Kedjans hopp i roadmapens ordning:
 * operatör/källa → kommando → körning → uppgift → försök → agentsession → kandidat →
 * verifiering → granskning → attestation → promotion.
 *
 * "operatör/källa" bärs som TVÅ hopp, därför att det är två SKILDA poster: operatörens
 * inlämning (submission_id) och controllerns registrerade källidentitet (source_id + sha256).
 * Att slå ihop dem hade dolt vilken av dem en bindning faktiskt kom ur.
 */
export const CHAIN_HOPS = [
  "operator",
  "source",
  "command",
  "run",
  "task",
  "attempt",
  "agent_session",
  "candidate",
  "verification",
  "review",
  "attestation",
  "promotion",
] as const;
export type ChainHopKind = (typeof CHAIN_HOPS)[number];

/** Svenska rubriker per hopp. Namnen i `ids` är kontraktets egna och döps aldrig om. */
export const CHAIN_HOP_TITLES: Readonly<Record<ChainHopKind, string>> = Object.freeze({
  operator: "Operatör och inlämning",
  source: "Källans identitet",
  command: "Kommando",
  run: "Körning",
  task: "Uppgift",
  attempt: "Försök",
  agent_session: "Agentsession",
  candidate: "Kandidat",
  verification: "Verifiering",
  review: "Granskning",
  attestation: "Attestation",
  promotion: "Promotion",
});

/* ────────────────────────────────────────────────────────────────────────────
 * DE ÄRLIGA ORSAKERNA — konstanter, aldrig fritext vid renderingen
 * ──────────────────────────────────────────────────────────────────────────── */

/** Agentsessionen har ingen identitet i något validerat kontrakt i dag. */
export const AGENT_SESSION_IDENTITY_IN_CONTRACT = "NONE" as const;

export const AGENT_SESSION_ABSENT_NOTE =
  "Ingen agentsession har en identifierare i dagens kontrakt: varken snapshoten, eventkuvertet " +
  "eller kommandoraden bär ett sessions-id. Hoppet är strukturellt frånvarande — ett sessions-id " +
  "uppfinns aldrig, och en agent-händelse i strömmen är ingen sessionsidentitet.";

/** Granskningen har ingen identitet i dagens kontrakt — bara en dom och ett antal fynd. */
export const REVIEW_IDENTITY_IN_CONTRACT = "NONE" as const;

export const REVIEW_ABSENT_NOTE =
  "Kontraktet har ingen granskningsidentitet. TaskView.evaluation bär en dom och ett antal fynd, " +
  "men varken gransknings-id, granskare eller bevisreferens — det finns alltså ingenting att " +
  "binda med. Domen visas i uppgiftens kort; här uppfinns ingen granskningsidentitet.";

export const OPERATOR_ABSENT_NOTE =
  "Ingen inlämning i fixturen bär den här uppgiftens task_id i controllerns svar. Kopplingen " +
  "inlämning → uppgift ägs av controllern och härleds aldrig här.";

export const COMMAND_WITHOUT_SUBMISSION_NOTE =
  "Ingen inlämning binder uppgiften, och därför finns ingen kommandorad att binda till. Ett " +
  "command_id gissas aldrig fram ur en intention eller ur ordningen i en lista.";

export const COMMAND_WITHOUT_RECORD_NOTE =
  "Inlämningen bär ingen kommandorad i fixturen: kommandots öde är okänt, aldrig lyckat.";

export const RUN_ABSENT_NOTE =
  "Ingen körningsidentitet binder uppgiften: varken en händelse med uppgiftens task_id eller en " +
  "snapshot som bär uppgiften finns. run_id härleds aldrig ur en annan uppgifts händelser.";

export const TASK_ABSENT_NOTE =
  "Ingen validerad post bär det här task_id — varken controllerns snapshot eller ett svar på en " +
  "inlämning. Utan posten finns ingen identitet att binda med.";

export const ATTEMPT_ABSENT_NOTE =
  "Ingen händelse i strömmen bär ett attempt_id för den här uppgiften. Snapshotens attempt.n är " +
  "ett ORDNINGSTAL, inte en identitet, och används därför aldrig som bindning.";

export const CANDIDATE_ABSENT_NOTE =
  "Snapshoten bär ingen candidate_sha för uppgiften. Ingen kandidatidentitet härleds ur bas-SHA, " +
  "ur en fas eller ur en händelse i strömmen.";

export const VERIFICATION_ABSENT_NOTE =
  "task_gate bär ingen grind_id: verifieringen har ingen egen identifierare att binda med. " +
  "Domen (PASS/FAIL/NOT_RUN) står i uppgiftens kort och är ingen identitet.";

export const ATTESTATION_ABSENT_NOTE =
  "Ingen attestationspost finns i uppgiften. Frånvaron betyder OKÄNT, aldrig “inte attesterad”.";

export const ATTESTATION_NO_OWN_ID_NOTE =
  "Attestationsposten bär exists och promotion_eligible men INGEN egen identifierare i " +
  "kontraktet. Bindningen är därför uppgiftens task_id — inget attestations-id uppfinns.";

export const PROMOTION_ABSENT_NOTE =
  "Ingen promotionspost finns i uppgiften. Ingen promotion härleds ur en attestation, ur en " +
  "kandidat eller ur en händelse i strömmen.";

export const PROMOTION_WITHOUT_SHA_NOTE =
  "Promotionsposten bär varken from_sha eller to_sha. Utan en SHA finns ingen identitet att " +
  "binda med — promotion.state är en opak sträng (S7), inte en identifierare.";

/**
 * Typade intentioner (`fixtureCommands()`) bär verb och payload men INGET command_id: de är
 * ännu inte transportrader. En intention kan därför aldrig binda ett hopp, och ingår inte i
 * kedjan. Att para ihop en intention med en uppgift på verb eller ordning hade varit precis den
 * härledda relation utan id som ROOM-03 förbjuder.
 */
export const COMMAND_INTENTS_CARRY_NO_IDENTITY = "YES" as const;

export const COMMAND_INTENT_EXCLUSION_NOTE =
  "Typade intentioner utan command_id ingår inte i kedjan: de bär ingen identitet och kan " +
  "därför inte binda något hopp.";

/** Bevisreferenser är referenser. Ingen nyttolast hämtas och inget hemligt material bäddas in. */
export const EVIDENCE_REFERENCE_NOTE =
  "Bevisreferenser är REFERENSER, inte innehåll. Rummet hämtar ingen nyttolast bakom dem och " +
  "bäddar aldrig in hemligt material i en renderad post.";

/** En intention kan inte binda: hjälparen finns så att påståendet kan mätas, inte bara läsas. */
export function commandIntentHasIdentity(command: Command): boolean {
  return Object.prototype.hasOwnProperty.call(command, "command_id");
}

/* ────────────────────────────────────────────────────────────────────────────
 * TYPER
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Var identifieraren står.
 * · "record"    — i hoppets EGEN post (t.ex. command_id i kommandoraden).
 * · "container" — i den post som BÄR hoppets post (t.ex. task_id i den TaskView som innehåller
 *   source, task_gate, attestation …). Det är en verklig, utskriven identifierare — aldrig en
 *   gissning ur närhet.
 */
export type ChainIdentifierOrigin = "record" | "container";

export type ChainIdentifier = {
  /** Kontraktets eget nyckelnamn. Aldrig omdöpt till något vänligare. */
  key: string;
  value: string;
  mono: boolean;
  origin: ChainIdentifierOrigin;
};

/** Hur bindningen bärs. Båda vilar på ett VERKLIGT id — ingen av dem är en slutsats. */
export type ChainBindingKind =
  | "root"
  | "shared_identifier"
  | "record_containment"
  | "none";

/** Vilken validerad post hoppet lästes ur. Fixtur och live blandas aldrig. */
export type ChainRecordSource =
  | "snapshot"
  | "controller_answer"
  | "submission"
  | "command_record"
  | "event_stream"
  | "none";

export type ChainHop = {
  kind: ChainHopKind;
  title: string;
  present: boolean;
  record_source: ChainRecordSource;
  /** Endast de identifierare som FAKTISKT finns i posten. Tom lista när hoppet är frånvarande. */
  ids: ChainIdentifier[];
  /** Hoppet som den här posten är bunden till. null = kedjans rot (eller frånvarande hopp). */
  bound_to: ChainHopKind | null;
  /** Identifierarna som bär bindningen. Tom när hoppet är rot eller frånvarande. */
  bound_by: ChainIdentifier[];
  binding: ChainBindingKind;
  /** Ordagrann orsak när hoppet är frånvarande. null när hoppet finns. */
  absent_reason: string | null;
  /** Ärlig upplysning om ett hopp som finns men saknar egen identitet. */
  note: string | null;
  /**
   * Bevisreferenser ur hoppets poster, UNIKA och i första förekomstens ordning. De är referenser,
   * inte innehåll: ingen nyttolast hämtas. Multipliciteten (samma ref i två poster) finns kvar i
   * `raw`, som visas ordagrant.
   */
  evidence_refs: string[];
  /** Posten ORDAGRANT. Rå inspektion göms aldrig. null endast för frånvarande hopp. */
  raw: string | null;
};

/**
 * Nycklar som får BÄRA en bindning. Listan är avsiktligt smal: bara det som är en identitet i
 * kontraktet. `verb`, `origin`, `issued_by` och `source_name` finns i posterna och visas — men
 * de identifierar ingen enskild post och får därför aldrig hålla ihop två hopp.
 */
export const BINDING_IDENTIFIER_KEYS = [
  "submission_id",
  "command_id",
  "dedup_key",
  "run_id",
  "task_id",
  "attempt_id",
  "event_id",
  "source_id",
  "sha256",
  "grind_id",
  "grind_sha256",
  "base_sha",
  "candidate_sha",
  "from_sha",
  "to_sha",
] as const;

export const CHAIN_VIOLATION_CODES = [
  "present_without_ids",
  "binding_on_non_identifier",
  "bound_to_absent_hop",
  "binding_without_identifier",
  "binding_identifier_not_shared",
  "self_binding",
  "multiple_roots",
  "unbound_hop",
  "absent_hop_carries_claim",
  "present_without_raw",
  "hop_sequence_not_canonical",
] as const;
export type ChainViolationCode = (typeof CHAIN_VIOLATION_CODES)[number];

export type ChainViolation = {
  hop: ChainHopKind | null;
  code: ChainViolationCode;
  message: string;
};

export type CausalChain = {
  task_id: string;
  /** Hoppen i den FASTA semantiska sekvensen — aldrig tidssorterade. */
  hops: ChainHop[];
  /** Tomt när kedjan håller. En överträdelse RENDERAS, den tystas aldrig. */
  violations: ChainViolation[];
  ordering: typeof CAUSAL_ORDER;
  mode: typeof CAUSAL_CHAIN_MODE;
  blocked_on: typeof CAUSAL_CHAIN_LIVE_BLOCKED_ON;
};

export type CausalInput = {
  task_id: string;
  /**
   * Controllerns VALIDERADE snapshot (DISPLAYED_TRUTH). Uppgiftsposten slås upp här och bärs
   * vidare ORÖRD. Ingen state härleds, inget fält skrivs om och ingen läsmodell byggs.
   */
  snapshot: LoopSnapshot | null;
  /**
   * VALIDERADE eventkuvert. De bidrar BARA med identifierare (run_id, attempt_id),
   * bevisreferenser och rå inspektion — aldrig med ett tillstånd. Ordningen är `seq` ensamt.
   */
  events: readonly LoopEvent[];
  outcomes: readonly IntakeOutcome[];
};

/** Uppgiftens post ur snapshoten. Ett UPPSLAG på task_id — aldrig en hopvikning av något. */
function taskFromSnapshot(snapshot: LoopSnapshot | null, taskId: string): TaskView | null {
  if (snapshot === null) return null;
  const buckets: readonly TaskView[] = [
    ...(snapshot.current_task === null ? [] : [snapshot.current_task]),
    ...snapshot.backlog,
    ...snapshot.completed,
  ];
  return buckets.find((task) => task.task_id === taskId) ?? null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * HJÄLPARE
 * ──────────────────────────────────────────────────────────────────────────── */

function identifier(
  key: string,
  value: string | null | undefined,
  options: { mono?: boolean; origin?: ChainIdentifierOrigin } = {},
): ChainIdentifier[] {
  if (value === null || value === undefined) return [];
  const text = value.trim();
  if (text === "") return [];
  return [
    { key, value: text, mono: options.mono ?? true, origin: options.origin ?? "record" },
  ];
}

/** Ett frånvarande hopp bär INGENTING: inga id, ingen bindning, ingen post — bara en orsak. */
function absentHop(kind: ChainHopKind, reason: string): ChainHop {
  return {
    kind,
    title: CHAIN_HOP_TITLES[kind],
    present: false,
    record_source: "none",
    ids: [],
    bound_to: null,
    bound_by: [],
    binding: "none",
    absent_reason: reason,
    note: null,
    evidence_refs: [],
    raw: null,
  };
}

function presentHop(input: {
  kind: ChainHopKind;
  record_source: ChainRecordSource;
  ids: ChainIdentifier[];
  bound_to: ChainHopKind | null;
  bound_by: ChainIdentifier[];
  binding: ChainBindingKind;
  note?: string | null;
  evidence_refs?: readonly string[];
  raw: string;
}): ChainHop {
  return {
    kind: input.kind,
    title: CHAIN_HOP_TITLES[input.kind],
    present: true,
    record_source: input.record_source,
    ids: input.ids,
    bound_to: input.bound_to,
    bound_by: input.bound_by,
    binding: input.binding,
    absent_reason: null,
    note: input.note ?? null,
    evidence_refs: [...(input.evidence_refs ?? [])],
    raw: input.raw,
  };
}

function verbatim(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Unika värden i FÖRSTA förekomstens ordning.
 *
 * Samma identifierare eller bevisreferens kan stå i flera poster — två event i samma körning bär
 * samma `run_id`, och två rader kan peka på samma bevis. Listan är en MÄNGD av referenser, inte en
 * räkning: att skriva ut samma värde två gånger tillför ingen upplysning och hade dessutom gett två
 * identiska nycklar i renderingen. Multipliciteten finns kvar där den betyder något — i hoppets råa
 * poster, som visas ordagrant och aldrig kortas ned.
 */
function distinct(values: readonly string[]): string[] {
  const unique: string[] = [];
  for (const value of values) {
    if (!unique.includes(value)) unique.push(value);
  }
  return unique;
}

/* ────────────────────────────────────────────────────────────────────────────
 * VALIDERINGEN — projektionens EGEN negativa kontroll
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Mäter kedjan mot ROOM-03:s negativa kontroller. Den fäller bland annat den lögnstubbe som
 * binder två hopp UTAN ett delat identifierarvärde: en bindning måste bäras av ett värde som
 * finns i BÅDA posterna, annars är den en slutsats och inte en bindning.
 *
 * Dessutom mäts att kedjan hänger ihop: alla närvarande hopp ska nå EN rot genom bindningarna.
 * Ett hopp som svävar fritt hade sett ut som en del av kedjan utan att vara det.
 */
export function validateCausalChain(chain: {
  hops: readonly ChainHop[];
}): ChainViolation[] {
  const violations: ChainViolation[] = [];
  const hops = chain.hops;

  const sequence = hops.map((hop) => hop.kind);
  const canonical = CHAIN_HOPS.filter((kind) => sequence.includes(kind));
  if (sequence.length !== canonical.length || sequence.some((kind, i) => kind !== canonical[i])) {
    violations.push({
      hop: null,
      code: "hop_sequence_not_canonical",
      message:
        "Hoppen ligger inte i den fasta semantiska sekvensen. Ordningen är aldrig en sortering " +
        "på tid eller på vad som råkade finnas.",
    });
  }

  const byKind = new Map<ChainHopKind, ChainHop>();
  for (const hop of hops) byKind.set(hop.kind, hop);

  for (const hop of hops) {
    if (!hop.present) {
      if (hop.ids.length > 0 || hop.bound_to !== null || hop.bound_by.length > 0 || hop.raw !== null) {
        violations.push({
          hop: hop.kind,
          code: "absent_hop_carries_claim",
          message: `${hop.kind}: ett frånvarande hopp bär id, bindning eller post.`,
        });
      }
      if (hop.absent_reason === null || hop.absent_reason.trim() === "") {
        violations.push({
          hop: hop.kind,
          code: "absent_hop_carries_claim",
          message: `${hop.kind}: frånvaron saknar ordagrann orsak.`,
        });
      }
      continue;
    }

    if (hop.ids.length === 0) {
      violations.push({
        hop: hop.kind,
        code: "present_without_ids",
        message: `${hop.kind}: hoppet renderas som närvarande utan en enda identifierare.`,
      });
    }
    if (hop.raw === null || hop.raw.trim() === "") {
      violations.push({
        hop: hop.kind,
        code: "present_without_raw",
        message: `${hop.kind}: hoppet bär ingen rå post — teknisk inspektion vore omöjlig.`,
      });
    }

    if (hop.bound_to === null) continue;

    if (hop.bound_to === hop.kind) {
      violations.push({
        hop: hop.kind,
        code: "self_binding",
        message: `${hop.kind}: hoppet binds till sig självt.`,
      });
      continue;
    }

    const target = byKind.get(hop.bound_to);
    if (target === undefined || !target.present) {
      violations.push({
        hop: hop.kind,
        code: "bound_to_absent_hop",
        message: `${hop.kind}: bunden till ${hop.bound_to}, som inte finns.`,
      });
      continue;
    }

    if (hop.bound_by.length === 0) {
      violations.push({
        hop: hop.kind,
        code: "binding_without_identifier",
        message: `${hop.kind}: bindning till ${hop.bound_to} utan en bärande identifierare.`,
      });
      continue;
    }

    const ownValues = new Set(hop.ids.map((one) => one.value));
    const targetValues = new Set(target.ids.map((one) => one.value));
    for (const bond of hop.bound_by) {
      if (!(BINDING_IDENTIFIER_KEYS as readonly string[]).includes(bond.key)) {
        violations.push({
          hop: hop.kind,
          code: "binding_on_non_identifier",
          message:
            `${hop.kind}: bindningen bärs av ${bond.key}, som inte är en identitet i kontraktet.`,
        });
      }
      if (!ownValues.has(bond.value) || !targetValues.has(bond.value)) {
        violations.push({
          hop: hop.kind,
          code: "binding_identifier_not_shared",
          message:
            `${hop.kind}: bindningen ${bond.key} bärs inte av ett värde som finns i BÅDA ` +
            `posterna (${hop.kind} och ${hop.bound_to}).`,
        });
      }
    }
  }

  /* Sammanhanget: alla närvarande hopp ska nå EN rot genom sina bindningar. */
  const present = hops.filter((hop) => hop.present);
  const roots = present.filter((hop) => hop.bound_to === null);
  if (present.length > 0 && roots.length > 1) {
    violations.push({
      hop: null,
      code: "multiple_roots",
      message: `Kedjan har ${roots.length} obundna rötter — då är den inte EN kedja.`,
    });
  }
  if (present.length > 0 && roots.length === 1) {
    const reached = new Set<ChainHopKind>([roots[0].kind]);
    /* Bindningarna pekar bakåt mot en post; kedjan gås igenom tills inget nytt hopp nås. */
    let grew = true;
    while (grew) {
      grew = false;
      for (const hop of present) {
        if (reached.has(hop.kind)) continue;
        if (hop.bound_to !== null && reached.has(hop.bound_to)) {
          reached.add(hop.kind);
          grew = true;
        }
      }
    }
    for (const hop of present) {
      if (!reached.has(hop.kind)) {
        violations.push({
          hop: hop.kind,
          code: "unbound_hop",
          message: `${hop.kind}: hoppet hänger inte ihop med kedjans rot genom något id.`,
        });
      }
    }
  }

  return violations;
}

/* ────────────────────────────────────────────────────────────────────────────
 * PROJEKTIONEN
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Bygger kedjan för EN uppgift. Ren funktion: samma indata ger alltid samma kedja, och
 * ingenting hämtas, ansluts, loggas eller sorteras på tid.
 *
 * ORDNINGEN som funktionen använder:
 * · Hoppen läggs i `CHAIN_HOPS` ordning — semantik, inte kronologi.
 * · Strömmens rader ordnas med V1:s `orderEvents`: `seq` ENSAMT. `ts` läses inte en enda gång,
 *   och ankomstordningen bär ingenting.
 */
export function buildCausalChain(input: CausalInput): CausalChain {
  const taskId = input.task_id;

  /* 1 · Uppgiftens post. Snapshoten går FÖRE controllerns inlämningssvar (SNAPSHOT_WINS). */
  const snapshotTask = taskFromSnapshot(input.snapshot, taskId);

  /* Inlämningen binds ENDAST via controllerns eget svar — aldrig via ordning eller närhet. */
  const outcome =
    input.outcomes.find((one) =>
      (one.controller_answer?.tasks ?? []).some((task) => task.task_id === taskId),
    ) ?? null;

  const answerTask =
    outcome?.controller_answer?.tasks.find((task) => task.task_id === taskId) ?? null;

  const task: TaskView | null = snapshotTask ?? answerTask;
  const taskSource: ChainRecordSource =
    snapshotTask !== null ? "snapshot" : answerTask !== null ? "controller_answer" : "none";

  /* 2 · Strömmens rader för uppgiften, ordnade på seq ENSAMT (V1:s egen komparator). */
  const events = orderEvents(input.events).filter((event) => event.task_id === taskId);

  const taskIdentifier: ChainIdentifier[] = identifier("task_id", taskId);
  const containerTaskIdentifier: ChainIdentifier[] = identifier("task_id", taskId, {
    origin: "container",
  });

  /* ── operatör ────────────────────────────────────────────────────────────── */
  const operator: ChainHop =
    outcome === null
      ? absentHop("operator", OPERATOR_ABSENT_NOTE)
      : presentHop({
          kind: "operator",
          record_source: "submission",
          ids: [
            ...identifier("submission_id", outcome.submission_id),
            ...identifier("source_name", outcome.source.source_name, { mono: false }),
            ...identifier("origin", outcome.source.origin, { mono: false }),
            ...identifier("command_id", outcome.command?.command_id ?? null),
            ...taskIdentifier,
          ],
          bound_to: null,
          bound_by: [],
          binding: "root",
          raw: verbatim(outcome),
        });

  /* ── uppgift ─────────────────────────────────────────────────────────────── */
  const taskHop: ChainHop =
    task === null
      ? absentHop("task", TASK_ABSENT_NOTE)
      : presentHop({
          kind: "task",
          record_source: taskSource,
          ids: [...taskIdentifier, ...identifier("base_sha", task.base_sha)],
          /* Binds till inlämningen ENDAST via controllerns egen task_id i svaret. */
          bound_to: operator.present ? "operator" : null,
          bound_by: operator.present ? taskIdentifier : [],
          binding: operator.present ? "shared_identifier" : "root",
          evidence_refs: task.evidence_refs,
          raw: verbatim(task),
        });

  /* ── källa ───────────────────────────────────────────────────────────────── */
  const source: ChainHop =
    task === null
      ? absentHop("source", TASK_ABSENT_NOTE)
      : task.source === null
        ? absentHop(
            "source",
            "Uppgiften bär ingen källidentitet i posten: varken source_id eller sha256 finns.",
          )
        : presentHop({
            kind: "source",
            record_source: taskSource,
            ids: [
              ...identifier("source_id", task.source.source_id),
              ...identifier("sha256", task.source.sha256),
              ...identifier("locator", task.source.locator, { mono: false }),
              ...containerTaskIdentifier,
            ],
            bound_to: "task",
            bound_by: containerTaskIdentifier,
            binding: "record_containment",
            raw: verbatim(task.source),
          });

  /* ── kommando ────────────────────────────────────────────────────────────── */
  const record = outcome?.command ?? null;
  const command: ChainHop =
    outcome === null
      ? absentHop("command", COMMAND_WITHOUT_SUBMISSION_NOTE)
      : record === null
        ? absentHop("command", COMMAND_WITHOUT_RECORD_NOTE)
        : presentHop({
            kind: "command",
            record_source: "command_record",
            ids: [
              ...identifier("command_id", record.command_id),
              ...identifier("verb", record.verb),
              ...identifier("dedup_key", record.dedup_key),
              ...identifier("issued_by", record.issued_by, { mono: false }),
            ],
            bound_to: "operator",
            bound_by: identifier("command_id", record.command_id),
            binding: "shared_identifier",
            raw: verbatim(record),
          });

  /* ── körning ─────────────────────────────────────────────────────────────── */
  const runIdsFromEvents = distinct(events.map((event) => event.run_id));
  /* Snapshotens run_id gäller bara när snapshoten FAKTISKT bär uppgiften. */
  const snapshotRunId = snapshotTask === null || input.snapshot === null ? null : input.snapshot.run_id;
  const run: ChainHop =
    runIdsFromEvents.length > 0
      ? presentHop({
          kind: "run",
          record_source: "event_stream",
          ids: [
            ...runIdsFromEvents.flatMap((runId) => identifier("run_id", runId)),
            ...taskIdentifier,
          ],
          /*
            STRÖMMEN FÅR NÄMNA EN UPPGIFT SOM SNAPSHOTEN INTE PUBLICERAT.

            Då finns ingen uppgiftspost att binda till, och en bindning mot ett frånvarande hopp
            hade varit ett påstående om en post som inte finns. Körningen blir i stället kedjans
            ROT: dess run_id och task_id står ordagrant i eventkuverten, så identiteten är verklig
            även när uppgiftsposten saknas. Det här är exakt formen live-kedjan får vid S5 + S13.
          */
          bound_to: taskHop.present ? "task" : null,
          /* Raderna bär BÅDE run_id och task_id: bindningen är ett delat, utskrivet värde. */
          bound_by: taskHop.present ? taskIdentifier : [],
          binding: taskHop.present ? "shared_identifier" : "root",
          evidence_refs: distinct(events.flatMap((event) => event.evidence_refs)),
          raw: verbatim(events),
        })
      : snapshotRunId === null
        ? absentHop("run", RUN_ABSENT_NOTE)
        : presentHop({
            kind: "run",
            record_source: "snapshot",
            ids: [...identifier("run_id", snapshotRunId), ...containerTaskIdentifier],
            bound_to: "task",
            /* Snapshoten BÄR både run_id och uppgiften. Containment, inte närhet. */
            bound_by: containerTaskIdentifier,
            binding: "record_containment",
            /*
              Snapshotens KÖR-NIVÅ, ordagrant fält för fält. Uppgiftslistorna upprepas inte här:
              uppgiftens egen post ligger rå i uppgiftshoppet, och en andra kopia av hela
              snapshoten hade varit samma rådata två gånger, inte mer inspektion.
            */
            raw: verbatim({
              schema_version: input.snapshot?.schema_version ?? null,
              run_id: snapshotRunId,
              seq_watermark: input.snapshot?.seq_watermark ?? null,
              published_ts: input.snapshot?.published_ts ?? null,
              run: input.snapshot?.run ?? null,
              current_main: input.snapshot?.current_main ?? null,
            }),
          });

  /* ── försök ──────────────────────────────────────────────────────────────── */
  const attemptEvents = events.filter((event) => event.attempt_id !== null);
  const attemptIds = distinct(
    attemptEvents.flatMap((event) => (event.attempt_id === null ? [] : [event.attempt_id])),
  );
  /* Försökets egna rader bär run_id ordagrant — det är bindningen när uppgiftsposten saknas. */
  const attemptRunIds = distinct(attemptEvents.map((event) => event.run_id));
  const attemptRunIdentifiers = attemptRunIds.flatMap((runId) => identifier("run_id", runId));
  const attempt: ChainHop =
    attemptIds.length === 0
      ? absentHop("attempt", ATTEMPT_ABSENT_NOTE)
      : presentHop({
          kind: "attempt",
          record_source: "event_stream",
          ids: [
            ...attemptIds.flatMap((attemptId) => identifier("attempt_id", attemptId)),
            ...attemptRunIdentifiers,
            ...taskIdentifier,
          ],
          /*
            Uppgiftsposten först, körningen som andrahand. Saknas uppgiftsposten (strömmen nämner
            en uppgift snapshoten inte publicerat) binds försöket till KÖRNINGEN via run_id — ett
            värde som står ordagrant i båda postmängderna. Ingen bindning pekar mot ett hopp som
            inte finns, och ingen bindning gissas fram ur ordningen mellan raderna.
          */
          bound_to: taskHop.present ? "task" : "run",
          bound_by: taskHop.present ? taskIdentifier : attemptRunIdentifiers,
          binding: "shared_identifier",
          evidence_refs: distinct(attemptEvents.flatMap((event) => event.evidence_refs)),
          raw: verbatim(attemptEvents),
        });

  /* ── agentsession och granskning: ingen identitet finns, punkt ───────────── */
  const agentSession = absentHop("agent_session", AGENT_SESSION_ABSENT_NOTE);
  const review = absentHop("review", REVIEW_ABSENT_NOTE);

  /* ── kandidat ────────────────────────────────────────────────────────────── */
  const candidateSha = task?.candidate_sha ?? null;
  const candidate: ChainHop =
    task === null
      ? absentHop("candidate", TASK_ABSENT_NOTE)
      : candidateSha === null
        ? absentHop("candidate", CANDIDATE_ABSENT_NOTE)
        : presentHop({
            kind: "candidate",
            record_source: taskSource,
            ids: [...identifier("candidate_sha", candidateSha), ...containerTaskIdentifier],
            bound_to: "task",
            bound_by: containerTaskIdentifier,
            binding: "record_containment",
            /*
              Kandidaten har ingen EGEN delpost i kontraktet: `candidate_sha` är ett fält i
              TaskView. Rådatan är därför hela den bärande posten, ordagrant — hellre mer att
              inspektera än ett hopklippt utdrag som ser ut som en post den inte är.
            */
            raw: verbatim(task),
          });

  /* ── verifiering ─────────────────────────────────────────────────────────── */
  const gate = task?.task_gate ?? null;
  const verification: ChainHop =
    task === null
      ? absentHop("verification", TASK_ABSENT_NOTE)
      : gate === null || gate.grind_id === null
        ? absentHop("verification", VERIFICATION_ABSENT_NOTE)
        : presentHop({
            kind: "verification",
            record_source: taskSource,
            ids: [
              ...identifier("grind_id", gate.grind_id),
              ...identifier("grind_sha256", gate.grind_sha256),
              ...containerTaskIdentifier,
            ],
            bound_to: "task",
            bound_by: containerTaskIdentifier,
            binding: "record_containment",
            raw: verbatim(gate),
          });

  /* ── attestation ─────────────────────────────────────────────────────────── */
  const attestationRecord = task?.attestation ?? null;
  const attestation: ChainHop =
    task === null
      ? absentHop("attestation", TASK_ABSENT_NOTE)
      : attestationRecord === null
        ? absentHop("attestation", ATTESTATION_ABSENT_NOTE)
        : presentHop({
            kind: "attestation",
            record_source: taskSource,
            ids: [...containerTaskIdentifier],
            bound_to: "task",
            bound_by: containerTaskIdentifier,
            binding: "record_containment",
            note: ATTESTATION_NO_OWN_ID_NOTE,
            raw: verbatim(attestationRecord),
          });

  /* ── promotion ───────────────────────────────────────────────────────────── */
  const promotionRecord = task?.promotion ?? null;
  const promotionShas =
    promotionRecord === null
      ? []
      : [
          ...identifier("from_sha", promotionRecord.from_sha),
          ...identifier("to_sha", promotionRecord.to_sha),
        ];
  /* Kandidatbindningen skrivs ut ENDAST när båda SHA-värdena finns OCH är samma värde. */
  const promotionBindsCandidate =
    candidate.present &&
    promotionRecord !== null &&
    promotionRecord.to_sha !== null &&
    promotionRecord.to_sha === candidateSha;
  const promotion: ChainHop =
    task === null
      ? absentHop("promotion", TASK_ABSENT_NOTE)
      : promotionRecord === null
        ? absentHop("promotion", PROMOTION_ABSENT_NOTE)
        : promotionShas.length === 0
          ? absentHop("promotion", PROMOTION_WITHOUT_SHA_NOTE)
          : presentHop({
              kind: "promotion",
              record_source: taskSource,
              ids: [...promotionShas, ...containerTaskIdentifier],
              bound_to: promotionBindsCandidate ? "candidate" : "task",
              bound_by: promotionBindsCandidate
                ? identifier("to_sha", promotionRecord.to_sha)
                : containerTaskIdentifier,
              binding: promotionBindsCandidate ? "shared_identifier" : "record_containment",
              raw: verbatim(promotionRecord),
            });

  const hops: ChainHop[] = [
    operator,
    source,
    command,
    run,
    taskHop,
    attempt,
    agentSession,
    candidate,
    verification,
    review,
    attestation,
    promotion,
  ];

  const chain: CausalChain = {
    task_id: taskId,
    hops,
    violations: validateCausalChain({ hops }),
    ordering: CAUSAL_ORDER,
    mode: CAUSAL_CHAIN_MODE,
    blocked_on: CAUSAL_CHAIN_LIVE_BLOCKED_ON,
  };

  /*
    FRYST UTDATA. Kedjan är byggd av egna strukturer (nya listor, nya objekt och serialiserade
    strängar) — ingenting här aliaserar anroparens poster, så frysningen kan inte krypa ut i
    läsmodellen eller i fixturkatalogen.
  */
  for (const hop of hops) {
    Object.freeze(hop.ids);
    Object.freeze(hop.bound_by);
    Object.freeze(hop.evidence_refs);
    Object.freeze(hop);
  }
  Object.freeze(chain.hops);
  Object.freeze(chain.violations);
  return Object.freeze(chain);
}
