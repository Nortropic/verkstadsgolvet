/**
 * ROOM-01 · Rummets tidslinje som PRESENTATIONSPROJEKTION — aldrig en authority.
 *
 * KÄLLA: docs/nortropic-factory-room-master-roadmap-v1.md §5 (ROOM-01, exit 4).
 *
 * SEGMENTERAD, INTE HOPSLAGEN
 * ---------------------------
 * Två källor med olika ordningsnyklar får inte vävas ihop till en enda "konversation": resultatet
 * hade sett ut som en orsakskedja utan att vara det. Segmenten hålls därför isär, var och en med
 * SIN ordning utskriven:
 *
 *   LIVE_EVENT_ORDER              = seq                                (strömpanelens egen ordning)
 *   COMMAND_DISPLAY_ORDER         = serverns issued_at, ENDAST visning
 *   FIXTURE_OPERATOR_ORDER        = fixturens egen ordning
 *   GLOBAL_CAUSAL_ORDER_NOT_CLAIMED = YES
 *   WALL_CLOCK_IS_ORDERING_AUTHORITY = NO
 *
 * BINDANDE REGLER SOM FILEN BÄR
 * -----------------------------
 * · INGEN ORSAK UTAN ID. Två poster får ligga bredvid varandra utan att något påstås; en
 *   BINDNING skrivs bara ut när ett verkligt identifierare-värde (här `command_id`) finns i båda.
 * · Varje post bär sin KÄLLA maskinläsbart. Fixtur och live är aldrig samma yta, och en fixtur
 *   beskrivs aldrig som livedata.
 * · Transportradens `payload` och `result` är OPAKA kontrakt (B4/B5). Inget namngivet fält läses
 *   ur dem — de bärs vidare RÅTT, i sin helhet, så att teknisk inspektion är möjlig.
 * · Filen har ingen klocka, ingen anslutning och ingen state. Ren funktion in, poster ut.
 */
import { COMMAND_STATUS_PRESENTATION, COMMAND_VERB_LABELS } from "../commands";
import { SUBMISSION_PRESENTATION, type IntakeOutcome } from "../intake";
import { MISSING, type Tone } from "../labels";
import type { Command, CommandRecord } from "../schema";

/** Ordningslåsen som DATA, så att de kan mätas i stället för att bara läsas. */
export const TIMELINE_ORDER = {
  LIVE_EVENT_ORDER: "seq",
  COMMAND_DISPLAY_ORDER: "server issued_at (presentation only)",
  FIXTURE_OPERATOR_ORDER: "fixture-defined",
  GLOBAL_CAUSAL_ORDER_NOT_CLAIMED: "YES",
  WALL_CLOCK_IS_ORDERING_AUTHORITY: "NO",
} as const;

/** Källorna en post kan ha. Live-strömmen är en EGEN yta och renderas av strömpanelen. */
export const TIMELINE_SOURCES = ["fixture-intake", "fixture-command", "live-stream-boundary"] as const;
export type TimelineSource = (typeof TIMELINE_SOURCES)[number];

export type TimelineSegmentId = "operator" | "factory";

export type TimelineIdentifier = {
  /** Nyckelns namn som det heter i kontraktet — aldrig omdöpt till något vänligare. */
  key: string;
  label: string;
  value: string;
  mono: boolean;
};

export type TimelineBinding = {
  /** Identifieraren som binder posterna. Utan den skrivs ingen bindning ut. */
  key: "command_id";
  value: string;
  entry_id: string;
};

export type TimelineEntry = {
  entry_id: string;
  segment: TimelineSegmentId;
  source: TimelineSource;
  headline: string;
  /** Fixturens/controllerns eget läge i klartext, eller "—" när ingen statusrad finns. */
  status_label: string;
  status_tone: Tone;
  /** Klartext under posten: orsak, ordagrant avslag eller varför status saknas. */
  detail: string | null;
  /**
   * Controllerns egen resultatkarta, ORDAGRANT serialiserad. Kartans form är olöst (B5), så
   * inget fält läses ur den — och ett avslag får aldrig skrivas om till något vänligare.
   */
  verbatim: string | null;
  identifiers: TimelineIdentifier[];
  /** Bindning till en annan post — bara när ett verkligt id finns i båda. */
  binding: TimelineBinding | null;
  /** Hela den validerade posten, ordagrant. Teknisk inspektion kortas aldrig ned. */
  raw: string;
};

export type TimelineSegment = {
  id: TimelineSegmentId;
  title: string;
  /** Vad segmentet ÄR, i klartext. Fixtur märks som fixtur. */
  description: string;
  /** Segmentets ordningsnyckel, utskriven. */
  order_note: string;
  entries: TimelineEntry[];
};

export const TIMELINE_HEADING = "Vad som hänt";

export const TIMELINE_NO_GLOBAL_ORDER_NOTE =
  "Segmenten står var för sig. Ingen gemensam kronologi och ingen orsakskedja påstås mellan " +
  "dem — en bindning skrivs bara ut när samma identifierare finns i båda posterna.";

export const TIMELINE_EMPTY_TEXT = "Inga validerade poster finns att visa.";

const OPERATOR_TITLE = "Operatör och källa · fixtur";
const OPERATOR_DESCRIPTION =
  "Inlämningar och typade intentioner ur den genererade fixturen. Det här är INTE livedata och " +
  "har aldrig varit det. En intention utan kommandorad har ett OKÄNT öde — em-strecket betyder " +
  "okänt, aldrig lyckat.";
const OPERATOR_ORDER_NOTE = "Ordning: fixturens egen (FIXTURE_OPERATOR_ORDER). Ingen kronologi påstås.";

const FACTORY_TITLE = "Fabrikens kvitton · fixtur";
const FACTORY_DESCRIPTION =
  "Kommandoradernas öde ur samma fixtur: köad, hämtad av controllern, utförd, avvisad eller " +
  "utgången. Ett kvitto är ett kommandos öde — aldrig en uppgifts tillstånd. Radernas payload och " +
  "resultat är opaka kontrakt: inget namngivet fält läses ur dem, de visas rått. En bindning " +
  "skrivs bara ut när samma command_id finns i båda posterna.";
const FACTORY_ORDER_NOTE =
  "Visningsordning: serverns issued_at (COMMAND_DISPLAY_ORDER). Ordningen är presentation — " +
  "väggklockan är ingen ordningsauktoritet.";

/** Kort och lokal: den står vid posten det gäller, inte som en upprepad paragraf. */
const NO_COMMAND_RECORD_DETAIL = "Ingen kommandorad i fixturen: ödet är okänt, inte lyckat.";

function identifier(key: string, label: string, value: string | null, mono = true): TimelineIdentifier[] {
  if (value === null) return [];
  const text = value.trim();
  return text === "" ? [] : [{ key, label, value: text, mono }];
}

/**
 * Identifierare ur en TYPAD `Command`. Payloaden är typad per verb i V1:s kontrakt, så fälten
 * läses med en switch i stället för med en indexering som hade tvingat fram en gissning.
 */
function commandIdentifiers(command: Command): TimelineIdentifier[] {
  switch (command.verb) {
    case "intake.submit":
      return [
        ...identifier("source_ref", "source_ref", command.payload.source_ref),
        ...identifier("source_sha256", "source_sha256", command.payload.source_sha256),
      ];
    case "run.start":
      return identifier("config_ref", "config_ref", command.payload.config_ref);
    case "run.pause_at_safe_boundary":
    case "run.resume":
      return identifier("run_id", "run_id", command.payload.run_id);
    case "inspect":
      return "task_id" in command.payload
        ? identifier("task_id", "task_id", command.payload.task_id)
        : identifier("run_id", "run_id", command.payload.run_id);
  }
}

/** Identifierare ur en transportrad. Payload och result rörs INTE fältvis — de är opaka. */
function recordIdentifiers(record: CommandRecord): TimelineIdentifier[] {
  return [
    ...identifier("command_id", "command_id", record.command_id),
    ...identifier("verb", "verb", record.verb),
    ...identifier("issued_by", "utfärdad av", record.issued_by, false),
    ...identifier("issued_at", "issued_at", record.issued_at),
    ...identifier("claimed_at", "claimed_at", record.claimed_at),
    ...identifier("expires_at", "expires_at", record.expires_at),
    ...identifier(
      "expected_watermark",
      "expected_watermark",
      record.expected_watermark === null ? null : String(record.expected_watermark),
    ),
  ];
}

/** Identifierare ur controllerns svar. Uppgifternas TILLSTÅND renderas aldrig här. */
function answerIdentifiers(outcome: IntakeOutcome): TimelineIdentifier[] {
  const answer = outcome.controller_answer;
  if (answer === null) return [];
  const taskIds = answer.tasks.map((task) => task.task_id);
  const candidates = answer.tasks
    .map((task) => task.candidate_sha)
    .filter((sha): sha is string => sha !== null);
  const evidence = answer.tasks.flatMap((task) => task.evidence_refs);
  return [
    ...identifier("task_id", "task_id", taskIds.length === 0 ? null : taskIds.join(" · ")),
    ...identifier(
      "candidate_sha",
      "candidate_sha",
      candidates.length === 0 ? null : candidates.join(" · "),
    ),
    ...identifier(
      "evidence_refs",
      "evidence_refs",
      evidence.length === 0 ? null : evidence.join(" · "),
    ),
  ];
}

function outcomeEntry(outcome: IntakeOutcome, index: number): TimelineEntry {
  const presentation = SUBMISSION_PRESENTATION[outcome.submission_state];
  const record = outcome.command;
  return {
    entry_id: `fixture-intake-${outcome.submission_id}-${index}`,
    segment: "operator",
    source: "fixture-intake",
    headline: outcome.source.source_name,
    status_label: presentation.label,
    status_tone: presentation.tone,
    detail: null,
    verbatim: null,
    identifiers: [
      ...identifier("submission_id", "submission_id", outcome.submission_id),
      ...identifier("source_kind", "source_kind", outcome.source.origin, false),
      ...identifier("command_id", "command_id", record === null ? null : record.command_id),
      ...answerIdentifiers(outcome),
    ],
    binding: null,
    raw: JSON.stringify(outcome, null, 2),
  };
}

function intentEntry(command: Command, index: number): TimelineEntry {
  return {
    entry_id: `fixture-command-intent-${index}-${command.verb}`,
    segment: "operator",
    source: "fixture-command",
    headline: COMMAND_VERB_LABELS[command.verb],
    status_label: MISSING,
    status_tone: "neutral",
    detail: NO_COMMAND_RECORD_DETAIL,
    verbatim: null,
    identifiers: [
      ...identifier("verb", "verb", command.verb),
      ...commandIdentifiers(command),
    ],
    binding: null,
    raw: JSON.stringify(command, null, 2),
  };
}

function recordEntry(
  record: CommandRecord,
  boundTo: string | null,
): TimelineEntry {
  const presentation = COMMAND_STATUS_PRESENTATION[record.status];
  return {
    entry_id: `fixture-command-record-${record.command_id}`,
    segment: "factory",
    source: "fixture-command",
    headline: COMMAND_VERB_LABELS[record.verb],
    status_label: presentation.label,
    status_tone: presentation.tone,
    /* Regeln om opaka kontrakt står EN gång, i segmentets beskrivning — inte på varje rad. */
    detail: null,
    /* Ordagrant och i sin helhet. Ingen orsak skrivs om och ingen kortas ned. */
    verbatim: record.result === null ? null : JSON.stringify(record.result, null, 2),
    identifiers: recordIdentifiers(record),
    binding:
      boundTo === null ? null : { key: "command_id", value: record.command_id, entry_id: boundTo },
    raw: JSON.stringify(record, null, 2),
  };
}

/**
 * Visningsordning för kvittona: serverns `issued_at`, med `command_id` som stabil tiebreak.
 * Det är PRESENTATION. Väggklockan avgör ingen kausalitet, och två rader med samma stämpel
 * påstås aldrig ha hänt i den ordning listan råkar visa dem.
 */
function byIssuedAt(a: CommandRecord, b: CommandRecord): number {
  const left = Date.parse(a.issued_at);
  const right = Date.parse(b.issued_at);
  const leftOk = Number.isFinite(left);
  const rightOk = Number.isFinite(right);
  if (leftOk && rightOk && left !== right) return left - right;
  if (leftOk !== rightOk) return leftOk ? -1 : 1;
  return a.command_id.localeCompare(b.command_id);
}

export type TimelineInput = {
  outcomes: readonly IntakeOutcome[];
  commands: readonly Command[];
};

/**
 * Bygger segmenten. REN funktion: samma indata ger alltid samma utdata, och ingenting hämtas,
 * ansluts eller loggas.
 */
export function roomTimeline(input: TimelineInput): TimelineSegment[] {
  const operatorEntries: TimelineEntry[] = [
    ...input.outcomes.map((outcome, index) => outcomeEntry(outcome, index)),
    ...input.commands.map((command, index) => intentEntry(command, index)),
  ];

  /** command_id → posten i operatörssegmentet. Bindningen kräver ett VERKLIGT delat id. */
  const boundByCommandId = new Map<string, string>();
  for (const outcome of input.outcomes) {
    if (outcome.command === null) continue;
    const entry = operatorEntries.find((candidate) =>
      candidate.identifiers.some(
        (id) => id.key === "command_id" && id.value === outcome.command?.command_id,
      ),
    );
    if (entry !== undefined) boundByCommandId.set(outcome.command.command_id, entry.entry_id);
  }

  const records = input.outcomes
    .map((outcome) => outcome.command)
    .filter((record): record is CommandRecord => record !== null)
    .slice()
    .sort(byIssuedAt);

  return [
    {
      id: "operator",
      title: OPERATOR_TITLE,
      description: OPERATOR_DESCRIPTION,
      order_note: OPERATOR_ORDER_NOTE,
      entries: operatorEntries,
    },
    {
      id: "factory",
      title: FACTORY_TITLE,
      description: FACTORY_DESCRIPTION,
      order_note: FACTORY_ORDER_NOTE,
      entries: records.map((record) =>
        recordEntry(record, boundByCommandId.get(record.command_id) ?? null),
      ),
    },
  ];
}
