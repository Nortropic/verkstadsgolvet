/**
 * V1 · Svenska etiketter för Maskinen.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — avsnitten EVENT_CLIENT
 * ("Översättningstabell") och TASK-LIFECYCLE ("Statuspresentation"). Kartorna är
 * TRANSKRIBERADE ur planen och täcker backendens familjer — ingenting mer.
 *
 * BINDANDE: saknas en översättning visas RÅ event_type. Det är rätt beteende, inte ett fel.
 * Ingen etikett uppfinns, och ingen okänd typ får en semantisk betydelse.
 */
import { classifyEventType, TASK_LIFECYCLE, type TaskLifecycle } from "./schema";

/**
 * Uppslagstabell UTAN prototypkedja.
 *
 * Ett `event_type` är otrodd indata från strömmen. Slås det upp i ett vanligt objektliteral
 * returnerar `karta["constructor"]`, `karta["toString"]` eller `karta["__proto__"]` en ärvd
 * medlem ur `Object.prototype` i stället för `undefined` — och en OKÄND typ hade då fått både
 * en "översättning" och ett värde som inte går att rendera. Kartan byggs därför på en
 * null-prototyp, så hålet är stängt REDAN I KONSTRUKTIONEN och inte bara vid en anropsplats.
 */
function sealedMap<T extends object>(entries: T): Readonly<T> {
  // Object.create(null) ger ett objekt helt utan ärvda medlemmar.
  return Object.freeze(Object.assign(Object.create(null) as T, entries));
}

/** event_type → svenska. Exakt planens tabell. */
export const EVENT_TYPE_LABELS: Readonly<Record<string, string>> = sealedMap({
  "run.started": "Körning startad",
  "task.claimed": "Uppgift tagen",
  "attempt.started": "Försök startat",
  "workspace.created": "Arbetsyta skapad",
  "agent.started": "Builder startad",
  "candidate.created": "Kandidat skapad",
  "policy.failed": "Policy fällde",
  "verification.failed": "Verifiering fällde",
  "feedback.created": "Återkoppling skapad",
  "evaluation.finding": "Evaluator-fynd",
  "attestation.created": "Attestation skriven",
  "promotion.started": "Promotion inledd",
  "promotion.completed": "Promotion klar",
  "promotion.failed": "Promotion misslyckades",
  "merge.conflict": "Mergekonflikt",
  "merge.resolution.started": "Konfliktlösare arbetar",
  "merge.resolution.completed": "Konfliktlösning klar",
  "main.advanced": "main flyttad",
  "breaker.opened": "Brytare öppnad",
  "budget.exhausted": "Kvot slut",
});

export type EventLabel = {
  /** Svensk etikett om den finns, annars den råa typsträngen. */
  text: string;
  /** false = ingen översättning fanns; UI:t visar rå typ och märker den inte som fel. */
  translated: boolean;
  /** Rå typ, alltid tillgänglig för [raw event_type]-läget. */
  raw_type: string;
  /** true = typen känns inte igen alls; raden får ingen semantik och flyttar ingen state. */
  unknown_type: boolean;
};

export function eventLabel(eventType: string): EventLabel {
  // Egen-egenskapsgrind UTÖVER null-prototypen: livrem och hängslen, så att en framtida
  // refaktor som återinför ett vanligt objektliteral inte tyst öppnar hålet igen.
  // Sista ledet (typeof === "string") gör att bara en faktisk etikett räknas som översättning.
  const candidate = Object.hasOwn(EVENT_TYPE_LABELS, eventType)
    ? EVENT_TYPE_LABELS[eventType]
    : undefined;
  const translation = typeof candidate === "string" ? candidate : undefined;
  const classification = classifyEventType(eventType);
  return {
    text: translation ?? eventType,
    translated: translation !== undefined,
    raw_type: eventType,
    unknown_type: !classification.known,
  };
}

/** Färgroller ur planens statustabell. `warning` ≠ `danger`: NEEDS_SPEC är ett arbetsläge. */
export const TONES = ["neutral", "accent", "warning", "success", "danger"] as const;
export type Tone = (typeof TONES)[number];

export type LifecyclePresentation = {
  /** Svensk etikett, ordagrant ur planen. */
  label: string;
  tone: Tone;
  /** Får tillståndet se ut som "klart"? Endast DONE — och endast ur snapshot, aldrig ur tail. */
  may_look_done: boolean;
};

/**
 * Samma null-prototyp här. Nycklarna kommer i dag ur en validerad TASK_LIFECYCLE-enum, så
 * hålet är inte nåbart — men kartan hålls symmetrisk så att ingen läsare behöver avgöra
 * vilken av två kartor som råkar vara säker att slå upp i.
 */
export const TASK_LIFECYCLE_PRESENTATION: Readonly<
  Record<TaskLifecycle, LifecyclePresentation>
> = sealedMap({
  RAW: { label: "Rå källa", tone: "neutral", may_look_done: false },
  PLANNING: { label: "Planeras", tone: "neutral", may_look_done: false },
  NEEDS_SPEC: { label: "Behöver spec", tone: "warning", may_look_done: false },
  READY: { label: "Redo", tone: "neutral", may_look_done: false },
  QUEUED: { label: "I kö", tone: "neutral", may_look_done: false },
  WORKING: { label: "Arbetar", tone: "accent", may_look_done: false },
  VERIFYING: { label: "Verifieras", tone: "accent", may_look_done: false },
  REVIEWING: { label: "Granskas", tone: "accent", may_look_done: false },
  MERGING: { label: "Slås ihop", tone: "accent", may_look_done: false },
  DONE: { label: "Klar", tone: "success", may_look_done: true },
  STOPPED: { label: "Stoppad", tone: "danger", may_look_done: false },
});

/** NEEDS_SPEC är ett legitimt arbetsläge. Ordagrant ur planen — skrivs aldrig om. */
export const NEEDS_SPEC_EXPLANATION =
  "Nortropic kunde inte göra den här uppgiften tillräckligt verifierbar. Ingen builder startades.";

/** run.pause_at_safe_boundary presenteras aldrig som omedelbart stopp. */
export const PAUSE_AT_SAFE_BOUNDARY_LABEL = "Pausa efter aktuell uppgift";
export const PAUSE_AT_SAFE_BOUNDARY_EXPLANATION =
  "Nortropic avslutar den uppgift som pågår och stannar sedan. Ingenting avbryts mitt i.";

/** Saknat värde renderas alltid så här. Aldrig 0, aldrig "okänd", aldrig en gissning. */
export const MISSING = "—";

/** Hjälpare för vyerna: null/undefined/tom sträng → "—". */
export function orMissing(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return MISSING;
  const text = String(value).trim();
  return text === "" ? MISSING : text;
}

/** Alla elva tillstånd har en presentation — mätbart, så inget tillstånd kan glömmas. */
export function lifecyclePresentationCoverage(): boolean {
  return TASK_LIFECYCLE.every((state) => Boolean(TASK_LIFECYCLE_PRESENTATION[state]));
}
