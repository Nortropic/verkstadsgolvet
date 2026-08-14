/**
 * V8* · MARKDOWN-INTAKE I FIXTURLÄGE — formell klientvalidering och UI-lokala inlämningslägen.
 *
 * AUKTORITATIV KÄLLA: docs/nortropic-control-room-plan-v1.md — MARKDOWN_INTAKE_UX
 * ("Tre inmatningssätt", "Validering i klienten (endast formell, aldrig semantisk)", "Flödet",
 * "source_ref — ägd av S10+S13, uppfinns inte här", "NEEDS_SPEC", "Backend-avslag") samt
 * IMPLEMENTATION_SLICES §V8 och IMPLEMENTATION_ORDER-raden `V8*` (UI mot fixtur).
 *
 * DENNA SKIVA ÄR FIXTURLÄGE OCH ÄR ALDRIG LIVE-KOMPLETT
 * -----------------------------------------------------
 * Den levande motsvarigheten (V8) är blockerad på nortropic-system S10 + S13 (B5), som äger
 * intake-transportens form. Tills dess finns:
 *
 * ```text
 * INTAKE_MODE                    = FIXTURE_ONLY
 * INTAKE_TRANSPORT               = NONE      (ingen fetch, ingen route, ingen kö)
 * INTAKE_SERVER_ROUTE            = null      (app/api/loop/intake finns INTE)
 * INTAKE_CLIENT_COMPUTES_SHA256  = false     (appens hash är aldrig trust-anchor)
 * FRONTEND_COMPILES_TASKS        = false     (noll UI-genererade tasks, alltid)
 * ```
 *
 * BINDANDE REGLER SOM FILEN BÄR MEKANISKT
 * ---------------------------------------
 * · Valideringen är ENDAST FORMELL: filändelse, MIME, storlek, antal och tomhet. Aldrig
 *   semantisk. Ingen rubrikparsning, ingen uppgiftsdelning, ingen uppskattning av antal tasks.
 *   Klienten räknar tecken och rader — inget annat.
 * · Ingen hashning. Ingen `crypto.subtle`, ingen `createHash`. Transitens sha256 beräknas
 *   server-side i den LEVANDE skivan och är även då ett PÅSTÅENDE; controllern räknar om och
 *   avvisar vid avvikelse (B5, låst).
 * · `source_ref` uppfinns aldrig här. Formen ägs av S10 + S13.
 * · Antalet uppgifter kommer ur controllerns svar. Har controllern inte svarat är antalet
 *   OKÄNT och renderas "—" — aldrig 0 som påstående och aldrig en uppskattning.
 * · Controllerns avslag återges ORDAGRANT. Resultatkartan är opak (S13/B5 olöst): inget
 *   namngivet fält läses ur den, och ingen orsak skrivs om till något vänligare.
 * · `SUBMISSION_LIFECYCLE` är en UI-LOKAL namnrymd (B1, ägd av S5 + S10 när den finns). Den
 *   är ALDRIG task lifecycle-state och renderas aldrig i task-kolumnerna.
 *
 * VAD FILEN ALDRIG GÖR
 * --------------------
 * Ingen I/O, ingen transport, ingen klocka, ingen slump, ingen hashning, ingen markdown-tolkning,
 * ingen task-kompilering, ingen controller-skrivning. Rena funktioner och typer.
 */
import { z } from "zod";
import type { Tone } from "./labels";
import {
  CommandRecordSchema,
  SUBMISSION_LIFECYCLE,
  TaskViewSchema,
  type CommandRecord,
  type SubmissionLifecycle,
} from "./schema";

/* ────────────────────────────────────────────────────────────────────────────
 * LÄGET — bärs som konstanter så ingen läsare eller senare skiva behöver gissa
 * ──────────────────────────────────────────────────────────────────────────── */

/** Fixturläge. Den levande skivan (V8) byter detta värde, inte den här filens regler. */
export const INTAKE_MODE = "FIXTURE_ONLY" as const;

/** Ingen transport finns. Ingen `fetch`, ingen route, ingen kö, ingen blob-lagring. */
export const INTAKE_TRANSPORT = "NONE" as const;

/** app/api/loop/intake finns INTE i den här skivan och skapas inte av den. */
export const INTAKE_SERVER_ROUTE: string | null = null;

/** Klienten hashar aldrig. Ett värde beräknat i webbläsaren vore ändå aldrig trust-anchor. */
export const INTAKE_CLIENT_COMPUTES_SHA256 = false;

/** Trust-anchor-regeln (B5, låst): controllern räknar om sha256 och avvisar vid avvikelse. */
export const INTAKE_TRUST_ANCHOR = "CONTROLLER_RECOMPUTED_SHA256" as const;

/** Frontenden kompilerar ALDRIG tasks. Antalet kommer ur controllerns svar. */
export const FRONTEND_COMPILES_TASKS = false;

/** Den levande intaken väntar på backendens ägare — inte på den här skivan. */
export const INTAKE_BLOCKED_ON = "nortropic-system S10 + S13 (B5)" as const;

/** Ordagrann orsak vid den avstängda inlämningsknappen. Ingen fejkad inlämning, ingen kö. */
export const INTAKE_DISABLED_REASON =
  "Inlämning är avstängd. Intake-transporten ägs av nortropic-system S10 + S13 (B5) och " +
  "finns inte. Verkstadsgolvet lämnar hellre ingenting än låtsas skicka en källa.";

/** Sant först när det finns en faktisk transport att lämna bytes till. */
export function intakeSubmissionEnabled(): boolean {
  return INTAKE_TRANSPORT !== "NONE";
}

/* ────────────────────────────────────────────────────────────────────────────
 * FORMELLA GRÄNSER — planens förslag, ännu inte ägarlåsta
 * ──────────────────────────────────────────────────────────────────────────── */

/** 1 MiB per fil. Planen kallar det ett förslag; värdet bärs här så det kan låsas på ett ställe. */
export const INTAKE_MAX_FILE_BYTES = 1_048_576;

/** Max 20 filer per inlämning. Varje fil blir en EGEN källa — ingen sammanslagning. */
export const INTAKE_MAX_FILES = 20;

/** Gränserna är planens förslag (ej ägarbeslut). Statusen bärs så den inte glider tyst. */
export const INTAKE_LIMITS_STATUS = "PROPOSED_NOT_OWNER_LOCKED" as const;

/** Endast markdown. Jämförelsen görs på gemener — "PLAN.MD" är samma ändelse som ".md". */
export const INTAKE_ACCEPTED_EXTENSIONS = [".md", ".markdown"] as const;

/**
 * Tillåtna MIME-typer. Tom sträng ingår därför att webbläsare ofta lämnar `File.type` tom för
 * markdown — en tom typ är ingen upplysning och får inte fällas som fel typ.
 */
export const INTAKE_ACCEPTED_MIME_TYPES = ["text/markdown", "text/plain", ""] as const;

/** `accept`-attributet på filväljaren. Planens sträng, utökad med den ändelse som också tas emot. */
export const INTAKE_ACCEPT_ATTRIBUTE = ".md,.markdown,text/markdown";

/* ────────────────────────────────────────────────────────────────────────────
 * KANDIDATER OCH FORMELL VALIDERING
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Det klienten faktiskt vet om en vald fil INNAN någon byte lästs: namn, storlek och den typ
 * webbläsaren påstår. Ingenting mer används i valideringen — och ingenting mer behövs.
 */
export const IntakeCandidateSchema = z.strictObject({
  file_name: z.string().min(1),
  byte_size: z.number().int().min(0),
  /** Webbläsarens påstådda MIME-typ. Tom sträng är ett giltigt (och vanligt) värde. */
  mime_type: z.string(),
});
export type IntakeCandidate = z.infer<typeof IntakeCandidateSchema>;

/** Avslagskoder. Varje kod har EN orsak — ingen samlingskod, ingen tyst hopslagning. */
export const INTAKE_REJECTION_CODES = [
  "extension",
  "mime_type",
  "empty",
  "too_large",
  "too_many_files",
] as const;
export type IntakeRejectionCode = (typeof INTAKE_REJECTION_CODES)[number];

/**
 * Grupperar tusental med hårt mellanslag så siffran inte bryts mitt itu i en smal kolumn.
 * Grupperingen görs för hand och ALDRIG med `toLocaleString`: den senare beror på värdmiljöns
 * ICU-data, och samma orsakstext hade då kunnat se olika ut i två miljöer.
 */
export function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
}

/** Byte-tal i klartext. En ENDA formatering delas av orsakstexterna och vyerna. */
function bytes(n: number): string {
  return `${groupDigits(n)} byte`;
}

/** Orsakstexterna. Klartext, svenska, utan skuld — ett avvisat val är inte ett fel i systemet. */
export function intakeRejectionMessage(code: IntakeRejectionCode, candidate?: IntakeCandidate): string {
  switch (code) {
    case "extension":
      return `Filändelsen tas inte emot. Endast ${INTAKE_ACCEPTED_EXTENSIONS.join(" och ")} accepteras.`;
    case "mime_type":
      return (
        `Filtypen som webbläsaren uppger (${candidate?.mime_type || "tom"}) tas inte emot. ` +
        `Endast text/markdown, text/plain eller tom typ accepteras.`
      );
    case "empty":
      return "Filen är tom. En tom källa lämnas aldrig in.";
    case "too_large":
      return (
        `Filen är större än gränsen ${bytes(INTAKE_MAX_FILE_BYTES)}` +
        `${candidate ? ` (filen är ${bytes(candidate.byte_size)})` : ""}.`
      );
    case "too_many_files":
      return `Fler än ${INTAKE_MAX_FILES} filer i en inlämning. Dela upp inlämningen.`;
  }
}

export type IntakeVerdict =
  | { accepted: true; candidate: IntakeCandidate; extension: string }
  | { accepted: false; candidate: IntakeCandidate; code: IntakeRejectionCode; message: string };

/** Gemener och utan MIME-parametrar: "text/plain; charset=utf-8" → "text/plain". */
function normalizedMime(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

/** Den matchande ändelsen i gemener, annars null. Jämförelsen är hel-ändelse, aldrig delsträng. */
export function acceptedExtensionOf(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  return INTAKE_ACCEPTED_EXTENSIONS.find((extension) => lower.endsWith(extension)) ?? null;
}

/**
 * Formell klassificering av EN kandidat.
 *
 * Ordningen är fast och dokumenterad: ändelse → MIME → tomhet → storlek. Varje avslag bär
 * exakt EN orsak; en fil som bryter mot två regler faller på den första i ordningen, så att
 * orsaken är förutsägbar i stället för att bero på iterationsordning.
 *
 * Filens INNEHÅLL läses aldrig här. Den här skivan har ingen transport att lämna bytes till,
 * och Verkstadsgolvet hashar dem aldrig.
 */
export function classifyIntakeCandidate(candidate: IntakeCandidate): IntakeVerdict {
  const reject = (code: IntakeRejectionCode): IntakeVerdict => ({
    accepted: false,
    candidate,
    code,
    message: intakeRejectionMessage(code, candidate),
  });

  const extension = acceptedExtensionOf(candidate.file_name);
  if (extension === null) return reject("extension");
  if (!(INTAKE_ACCEPTED_MIME_TYPES as readonly string[]).includes(normalizedMime(candidate.mime_type))) {
    return reject("mime_type");
  }
  if (candidate.byte_size === 0) return reject("empty");
  if (candidate.byte_size > INTAKE_MAX_FILE_BYTES) return reject("too_large");
  return { accepted: true, candidate, extension };
}

export type IntakeSelection = {
  /** En dom per kandidat, i inmatningsordning. Ingen fil tystas bort. */
  verdicts: IntakeVerdict[];
  /** Formellt godkända filer. Tom när hela urvalet fälls på antalsgränsen. */
  accepted: IntakeCandidate[];
  /** Fälls hela urvalet (antalsgränsen) står orsaken här — aldrig som ett tyst bortfall. */
  selection_rejection: { code: IntakeRejectionCode; message: string } | null;
  /**
   * Kan urvalet lämnas in? I den här skivan ALLTID false, och orsaken är transportens frånvaro
   * (S10 + S13), inte urvalets kvalitet. Ett formellt grönt urval får aldrig ge sken av att en
   * inlämning skett.
   */
  submittable: boolean;
  /** Varför inlämning inte går. Renderas ordagrant vid den avstängda knappen. */
  blocked_reason: string;
};

/**
 * Formell validering av ett HELT urval.
 *
 * Antalsgränsen fälls FAIL-CLOSED: överskrids den accepteras ingen fil alls. Att tyst
 * ta emot de tjugo första hade varit ett systemval användaren aldrig gjorde.
 */
export function validateIntakeSelection(candidates: readonly IntakeCandidate[]): IntakeSelection {
  const verdicts = candidates.map((candidate) => classifyIntakeCandidate(candidate));
  const overCount = candidates.length > INTAKE_MAX_FILES;
  const selection_rejection = overCount
    ? { code: "too_many_files" as const, message: intakeRejectionMessage("too_many_files") }
    : null;

  return {
    verdicts,
    accepted: overCount
      ? []
      : verdicts.flatMap((verdict) => (verdict.accepted ? [verdict.candidate] : [])),
    selection_rejection,
    submittable: intakeSubmissionEnabled(),
    blocked_reason: INTAKE_DISABLED_REASON,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * KÄLLTEXT — tecken och rader. Ingenting annat läses ur en markdownkälla.
 * ──────────────────────────────────────────────────────────────────────────── */

export type SourceStats = {
  /** Tecken räknade som kodpunkter, så att emoji och kombinerade tecken inte dubbelräknas. */
  characters: number;
  /** Rader. En avslutande radbrytning skapar ingen extra tom rad. */
  lines: number;
  /** UTF-8-byte. Ett MÅTT för storleksgränsen — aldrig en identitet och aldrig en hash. */
  bytes: number;
};

/**
 * Räknar tecken, rader och byte. Detta är HELA den tolkning Verkstadsgolvet gör av en
 * markdownkälla: ingen rubrik läses, ingen sektion delas, inget arbetsmål identifieras och
 * inget antal uppgifter uppskattas.
 */
export function sourceStats(text: string): SourceStats {
  const newlines = (text.match(/\n/g) ?? []).length;
  return {
    characters: [...text].length,
    lines: text === "" ? 0 : newlines + (text.endsWith("\n") ? 0 : 1),
    bytes: new TextEncoder().encode(text).length,
  };
}

/**
 * Måttraden i klartext — EN formatering delad av intakens alla statusrader.
 *
 * Tecken, rader och byte grupperas med SAMMA regel (`groupDigits`). Att gruppera bara bytetalet
 * hade fått tre tal på samma rad att se ut som tre olika sorters mått, och en läsare hade fått
 * lägga energi på att avgöra om skillnaden betydde något. Funktionen bärs här, i lib, så att
 * dropzonens rad och utfallets rad inte kan glida isär.
 */
export function sourceStatsText(stats: SourceStats): string {
  return (
    `${groupDigits(stats.characters)} tecken · ${groupDigits(stats.lines)} rader · ` +
    `${groupDigits(stats.bytes)} byte`
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * TOMLÄGEN — en händelse UTAN filer är inget urval, och får aldrig se ut som ett
 * ──────────────────────────────────────────────────────────────────────────── */

/** Inget har hänt ännu. Grundläget innan någon dragit, valt eller klistrat in. */
export const INTAKE_NO_SELECTION_TEXT = "Ingen fil är vald ännu.";

/**
 * Ett släpp som inte bar en enda fil (markerad text, en länk, en mapp i vissa webbläsare).
 * Ytan säger vad som INTE hände i stället för att rita ett rapportskal i positiv ton över noll
 * filer — ett tomt skal hade läst som "urvalet gick igenom".
 */
export const INTAKE_EMPTY_DROP_TEXT =
  "Inget släpptes som fil. Markerad text, länkar och mappar tas inte emot — ingen fil är vald.";

/**
 * En `change`-händelse med NOLL filer. Webbläsare skickar den när dialogen avbryts, och ett
 * avbrutet val är inte ett urval: samma ärliga tomläge som ett släpp utan filer.
 */
export const INTAKE_EMPTY_PICK_TEXT = "Filvalet avbröts. Ingen fil är vald.";

/** Den inklistrade källans dom när den är formellt felfri. Ingen inlämning påstås. */
export const INTAKE_PASTE_ACCEPTED_TEXT =
  "Formellt godkänd som källa. Inget skickas i fixturläge.";

/** Inklistrad text sparas som en källa med GENERERAT filnamn (planens tredje inmatningssätt). */
export const PASTE_SOURCE_NAME_PREFIX = "inklistrad-kalla";

/**
 * Deterministiskt filnamn ur ett löpnummer. Ingen klocka och ingen slump: samma urval ska ge
 * samma namn två gånger, annars hade två renderingar av samma inlämning sett olika ut.
 */
export function pasteSourceName(index: number): string {
  return `${PASTE_SOURCE_NAME_PREFIX}-${String(index).padStart(2, "0")}.md`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * UI-LOKALA INLÄMNINGSLÄGEN — aldrig task state (B1)
 * ──────────────────────────────────────────────────────────────────────────── */

export type SubmissionPresentation = {
  label: string;
  tone: Tone;
  /** Alltid false. Bärs som ett fält så att påståendet kan MÄTAS, inte bara läsas i en kommentar. */
  is_task_state: false;
};

/** Planens ordagranna väntetext. Inga siffror, ingen förhandstolkning, ingen antydd framgång. */
export const SUBMISSION_WAITING_TEXT = "Inlämnad — väntar på Nortropics tolkning";

/**
 * Svenska etiketter för den UI-LOKALA `submission.*`-namnrymden. Avbildas 1:1 mot backendens
 * familj när S5 + S10 låst den (B1). Ingen av dem är ett task lifecycle-tillstånd, och ingen
 * av dem får renderas i task-kolumnerna.
 */
export const SUBMISSION_PRESENTATION: Readonly<Record<SubmissionLifecycle, SubmissionPresentation>> =
  Object.freeze(
    Object.assign(Object.create(null) as Record<SubmissionLifecycle, SubmissionPresentation>, {
      "submission.selected": { label: "Vald i webbläsaren", tone: "neutral", is_task_state: false },
      "submission.uploading": { label: "Lämnas över", tone: "neutral", is_task_state: false },
      "submission.stored": { label: "Mottagen av transporten", tone: "neutral", is_task_state: false },
      "submission.command_queued": { label: SUBMISSION_WAITING_TEXT, tone: "accent", is_task_state: false },
      "submission.claimed_by_controller": {
        label: "Hämtad av controllern",
        tone: "accent",
        is_task_state: false,
      },
      "submission.rejected": { label: "Avvisad av controllern", tone: "danger", is_task_state: false },
    } satisfies Record<SubmissionLifecycle, SubmissionPresentation>),
  );

/** Alla sex lägen har en presentation — mätbart, så inget läge kan glömmas bort. */
export function submissionPresentationCoverage(): boolean {
  return SUBMISSION_LIFECYCLE.every((state) => Boolean(SUBMISSION_PRESENTATION[state]));
}

/**
 * NEEDS_SPEC är ett ARBETSLÄGE. Åtgärden är att komplettera källan — aldrig en "försök igen"
 * som bara skickar samma sak en gång till, och aldrig en röd feldialog.
 */
export const NEEDS_SPEC_ACTION_LABEL = "Komplettera källan";
/**
 * RIKTNINGEN ÄR ETT PÅSTÅENDE OM RENDERINGSORDNINGEN. IntakeResult ritar originalkällan
 * (`SourcePanel`) FÖRE tolkningsgruppen där den här hinten står — källan finns alltså OVANFÖR
 * texten, aldrig nedanför. En riktningsangivelse som pekar åt fel håll skickar läsaren till
 * slutet av panelen efter något som stod högst upp.
 */
export const NEEDS_SPEC_ACTION_HINT =
  "Originalkällan visas oförändrad ovanför. Komplettera den och lämna in den som en ny källa " +
  "när intake-transporten finns — samma sak skickas aldrig igen oförändrad.";

/* ────────────────────────────────────────────────────────────────────────────
 * INLÄMNINGENS UTFALL — fixturens form, byggd av V1:s LÅSTA kontrakt
 * ──────────────────────────────────────────────────────────────────────────── */

/** Originalkällan som den kom in. Renderas RÅTT — aldrig tolkad och aldrig omskriven. */
export const IntakeSourceSchema = z.strictObject({
  source_name: z.string().min(1),
  /** Fil eller inklistrad text. Båda går EXAKT samma väg — inget genvägsspår för den ena. */
  origin: z.enum(["file", "paste"]),
  text: z.string(),
});
export type IntakeSource = z.infer<typeof IntakeSourceSchema>;

/**
 * Ett utfall för EN inlämning.
 *
 * `command` är V1:s LÅSTA CommandRecord och `controller_answer.tasks` är V1:s LÅSTA TaskView —
 * inget parallellt vokabulär uppfinns här. `controller_answer === null` betyder att controllern
 * INTE svarat: då finns noll uppgifter att visa och antalet är OKÄNT ("—"), aldrig 0 som
 * påstående. Kopplingen inlämning → uppgifter ägs av controllern (S10, B5) och härleds ALDRIG
 * av UI:t; den bärs hit som controllerns eget svar.
 */
export const IntakeOutcomeSchema = z.strictObject({
  submission_id: z.string().min(1),
  source: IntakeSourceSchema,
  submission_state: z.enum(SUBMISSION_LIFECYCLE),
  command: CommandRecordSchema.nullable(),
  controller_answer: z.strictObject({ tasks: z.array(TaskViewSchema) }).nullable(),
});
export type IntakeOutcome = z.infer<typeof IntakeOutcomeSchema>;

export type IntakeFailReason = "invalid-intake-outcome" | "invalid-intake-candidate";
export type IntakeFail = { ok: false; reason: IntakeFailReason; message: string };
export type IntakeEnvelope<T> = { ok: true; data: T } | IntakeFail;

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Ogiltig form.";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** Envelope-mönstret ur lib/github-read.ts: aldrig kast, alltid en läsbar orsak. */
export function validateIntakeOutcome(input: unknown): IntakeEnvelope<IntakeOutcome> {
  const parsed = IntakeOutcomeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid-intake-outcome", message: firstIssue(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

export function validateIntakeCandidate(input: unknown): IntakeEnvelope<IntakeCandidate> {
  const parsed = IntakeCandidateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid-intake-candidate", message: firstIssue(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Antalet uppgifter controllern faktiskt svarat med. `null` = inget svar ännu → "—".
 * Det här är den ENDA vägen till en siffra i intake-vyn; källan räknas aldrig om till tasks.
 */
export function controllerTaskCount(outcome: IntakeOutcome): number | null {
  return outcome.controller_answer === null ? null : outcome.controller_answer.tasks.length;
}

/**
 * Antalet uppgifter UI:t självt har skapat. Konstant 0 — bärs som funktion så att exit-provet
 * kan mäta påståendet i stället för att läsa det i en kommentar.
 */
export function uiGeneratedTaskCount(): number {
  return 0;
}

export type VerbatimRejection = {
  /** Rå command_id ur transportraden. Aldrig omformaterad. */
  command_id: string;
  /** Rå status ur transportraden. Aldrig översatt till något vänligare. */
  status: string;
  /**
   * Controllerns resultatkarta serialiserad ORDAGRANT. Kartans form är OLÖST (S13/B5): UI:t
   * läser inget namngivet fält ur den och visar den därför i sin helhet, rått.
   */
  raw_result: string | null;
};

/** Är utfallet avvisat? Läses ur transportens status och det UI-lokala läget — aldrig gissat. */
export function isRejected(outcome: IntakeOutcome): boolean {
  return outcome.command?.status === "rejected" || outcome.submission_state === "submission.rejected";
}

/**
 * Avslaget som det ska visas: rå `command_id`, rå `status` och hela den opaka resultatkartan
 * ordagrant. Ingen orsak skrivs om, ingen kortas ned och ingen ersätts med en vänligare text.
 */
export function verbatimRejection(command: CommandRecord | null): VerbatimRejection | null {
  if (command === null) return null;
  return {
    command_id: command.command_id,
    status: command.status,
    raw_result: command.result === null ? null : JSON.stringify(command.result, null, 2),
  };
}
