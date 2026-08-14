/**
 * ROOM-01 · Identitetsremsan: sju SEPARATA fält, aldrig ett sammanslaget "vem gjorde detta".
 *
 * KÄLLA: docs/nortropic-factory-room-master-roadmap-v1.md §5 (ROOM-01, exit 2) och
 * CLAUDE.md (`CLAUDE_ROLE_SEPARATION=WORKFLOW`,
 * `CLAUDE_ROLE_SEPARATION_IS_SECURITY_BOUNDARY=NO`).
 *
 * VARFÖR SJU FÄLT OCH INTE ETT
 * ----------------------------
 * Workflowsroll, exekverande principal och promotionsbehörighet är TRE OLIKA SAKER. Slås de
 * ihop till en rad börjar rollnamnet läsas som ett bevis: "builder" ser ut att vara någon med
 * behörighet, fast det bara är en etikett för ett arbetsflöde. Fälten hålls därför isär, och
 * de som inte finns i validerad data renderas som em-streck — aldrig som en gissning och
 * aldrig som ett grannfält som "ligger nära nog".
 *
 * BINDANDE REGLER SOM FILEN BÄR
 * -----------------------------
 * · `builder.agent` är REGISTRERAD BUILDER-AGENT ur snapshoten. Den etiketteras ALDRIG som
 *   workflowsroll, principal, behörighet eller promotionsrätt.
 * · Ett rollnamn bevisar aldrig en mekanisk förmåga. Remsan bär det utskrivet.
 * · Endast värden som FAKTISKT finns i validerad data får ett värde. Övriga är null → "—".
 * · Ingen härledning: saknas fältet i kontraktet finns det ingen källa att härleda ur, och
 *   filen har därför ingen kodväg som kan fylla det.
 */
import type { TaskView } from "../schema";

/** Den mening remsan MÅSTE bära. Ordagrant — den skrivs aldrig om till något mjukare. */
export const IDENTITY_DISCLAIMER = "Workflowsroll är arbetsflöde — aldrig en säkerhetsgräns.";

/** Rubriken. Remsan handlar om identitet OCH behörighet, som två olika frågor. */
export const IDENTITY_HEADING = "Identitet och behörighet";

/** Bildtexten över remsan. En UI-etikett, aldrig ett identitetsbevis. */
export const IDENTITY_WORKFLOW_CAPTION = "builder-plats i arbetsflödet";

export const IDENTITY_FIELD_IDS = [
  "asked_by",
  "workflow_role",
  "builder_agent",
  "builder_model",
  "execution_principal",
  "capability_evidence",
  "promotion_authority",
] as const;
export type IdentityFieldId = (typeof IDENTITY_FIELD_IDS)[number];

/**
 * Var ett fält kommer ifrån.
 *   snapshot            — läst ur controllerns validerade snapshot.
 *   no_field_in_schema  — kontraktet har inget sådant fält. Det finns alltså ingenting att läsa,
 *                         och ingenting att härleda. Renderas som "—".
 */
export type IdentitySource = "snapshot" | "no_field_in_schema";

export type IdentityField = {
  id: IdentityFieldId;
  label: string;
  /** null = okänt. Vyn renderar em-streck och märker fältet som saknat. */
  value: string | null;
  source: IdentitySource;
  /** Varför fältet ser ut som det gör. Alltid utskrivet — ett hål ska kunna läsas. */
  note: string;
};

const NO_LINK_NOTE =
  "Kontraktet bär ingen validerad koppling mellan uppgift och beställare. Rummet gissar inte.";
const NO_ROLE_NOTE =
  "Workflowsroll är en etikett för arbetsflödet och finns inte i kontraktet. Ett rollnamn " +
  "bevisar aldrig en mekanisk förmåga.";
const NO_PRINCIPAL_NOTE =
  "Exekverande principal är något annat än en workflowsroll. Kontraktet bär inget sådant fält, " +
  "och en builder-agent är inte ett svar på frågan.";
const NO_CAPABILITY_NOTE =
  "Behörighetsbunt och dess evidens ägs utanför den här vyn. Utan ett fält att läsa visas " +
  "ingenting — inte ens ett antagande om att behörighet saknas.";
const NO_PROMOTION_NOTE =
  "Promotionsbehörighet ägs av kontrollplanet. Rummet varken utför, härleder eller påstår den.";
const BUILDER_AGENT_NOTE =
  "Registrerad builder-agent ur snapshoten. Det är en NOTERING om vad som kördes — inte en " +
  "workflowsroll, inte en principal och inte en behörighet.";
const BUILDER_MODEL_NOTE = "Registrerad modell ur snapshoten. Samma sak: en notering, inget bevis.";

/**
 * Remsans fält, i låst ordning. Alltid alla sju — ett saknat fält döljs aldrig, för då hade
 * hålet sett ut som att frågan inte fanns.
 */
export function identityFields(task: TaskView | null): IdentityField[] {
  return [
    {
      id: "asked_by",
      label: "Beställd av",
      value: null,
      source: "no_field_in_schema",
      note: NO_LINK_NOTE,
    },
    {
      id: "workflow_role",
      label: "Aktuell workflowsroll",
      value: null,
      source: "no_field_in_schema",
      note: NO_ROLE_NOTE,
    },
    {
      id: "builder_agent",
      label: "Registrerad builder-agent",
      value: task === null ? null : task.builder.agent,
      source: "snapshot",
      note: BUILDER_AGENT_NOTE,
    },
    {
      id: "builder_model",
      label: "Registrerad builder-modell",
      value: task === null ? null : task.builder.model,
      source: "snapshot",
      note: BUILDER_MODEL_NOTE,
    },
    {
      id: "execution_principal",
      label: "Exekverande principal",
      value: null,
      source: "no_field_in_schema",
      note: NO_PRINCIPAL_NOTE,
    },
    {
      id: "capability_evidence",
      label: "Behörighetsbunt / evidens",
      value: null,
      source: "no_field_in_schema",
      note: NO_CAPABILITY_NOTE,
    },
    {
      id: "promotion_authority",
      label: "Promotionsbehörighet",
      value: null,
      source: "no_field_in_schema",
      note: NO_PROMOTION_NOTE,
    },
  ];
}

/**
 * De fält som ALDRIG får bära ett värde i den här skivan, som data. Påståendet blir mätbart
 * i stället för att bara stå i en kommentar: fylls ett av dem i faller provet.
 */
export const IDENTITY_FIELDS_WITHOUT_SOURCE: readonly IdentityFieldId[] = [
  "asked_by",
  "workflow_role",
  "execution_principal",
  "capability_evidence",
  "promotion_authority",
];

/** Alla sju fält har en plats i ordningen — mätbart, så inget fält kan tappas bort. */
export function identityFieldCoverage(): boolean {
  const ids = identityFields(null).map((field) => field.id);
  return (
    ids.length === IDENTITY_FIELD_IDS.length &&
    IDENTITY_FIELD_IDS.every((id, index) => ids[index] === id)
  );
}
