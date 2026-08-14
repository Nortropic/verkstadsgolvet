/**
 * ROOM-01 · Härledd uppmärksamhet: "BEHÖVER UPPMÄRKSAMHET".
 *
 * KÄLLA: docs/nortropic-factory-room-master-roadmap-v1.md §5 (ROOM-01, exit 3).
 *
 * BINDANDE REGLER SOM FILEN BÄR
 * -----------------------------
 * · Uppmärksamhet är HÄRLEDD PRESENTATION, aldrig ett tillstånd. Den flyttar ingen uppgift,
 *   ändrar ingen lifecycle-state och skapar inget nytt vokabulär: posterna pekar bara ut
 *   uppgifter som redan står i snapshotens egna listor, med snapshotens egna tillstånd.
 * · NEEDS_SPEC ÄR ETT ARBETSLÄGE. Den får färgrollen `warning` ur V1:s presentation och
 *   beskrivs aldrig som ett fel.
 * · "ÄGARÅTGÄRD KRÄVS" FINNS INTE HÄR. Kontraktet (lib/loop/schema.ts) har inget fält som
 *   säger att ägarens behörighet krävs, och en UI-sida får aldrig härleda ett sådant påstående.
 *   Etiketten är därför inte ens definierad i den här filen — det finns ingenting att rendera
 *   den ur. Det är avsiktligt: en konstant som ligger och väntar blir förr eller senare renderad.
 * · Transportnotiser (återanslutning, poll, utgången session) ÄGS AV STRÖMPANELEN och upprepas
 *   inte här. Rummet har ingen egen anslutning och kan bara gissa — och en gissning som ligger
 *   bredvid panelens verkliga läge blir en lögn så fort de glider isär.
 */
import { TASK_LIFECYCLE_PRESENTATION, type Tone } from "../labels";
import { TASK_LIFECYCLE, type LoopSnapshot, type TaskLifecycle, type TaskView } from "../schema";

export const ATTENTION_HEADING = "BEHÖVER UPPMÄRKSAMHET";

export const ATTENTION_EMPTY_TEXT =
  "Snapshoten pekar inte ut något som behöver uppmärksamhet just nu.";

/**
 * Varför ingen ägaråtgärd kan visas. Texten beskriver ett HÅL i kontraktet — den är inte en
 * mildare formulering av ett påstående vi ändå gör.
 */
export const OWNER_AUTHORITY_SOURCE = "NONE" as const;
export const OWNER_AUTHORITY_NOTE =
  "Ingen ägaråtgärd kan visas: kontraktet har inget fält som säger att ägarens behörighet krävs.";

/*
  TRANSPORTNOTISER SKRIVS INTE HÄR. Anslutningens läge — öppen ström, återanslutning eller poll —
  ägs och renderas av strömpanelen, och sidhuvudet pekar redan på den. En tredje formulering av
  samma sak är dubblerad statusinformation, inte extra tydlighet. Rummets enda mening om
  anslutningen står i ROOM_TRANSPORT_NOTE (./header.ts) och handlar om rummets EGET löfte:
  ingen andra anslutning öppnas.
*/

/**
 * De tillstånd som drar uppmärksamhet till sig, i TASK_LIFECYCLE:s EGEN ordning. Ordningen
 * hittas alltså inte på här, och mängden kan inte växa utan att V1:s enum växer.
 */
export const ATTENTION_STATES: readonly TaskLifecycle[] = TASK_LIFECYCLE.filter(
  (state) => state === "NEEDS_SPEC" || state === "STOPPED",
);

/** Klartext per tillstånd. NEEDS_SPEC beskrivs som arbete, STOPPED som stopp — aldrig tvärtom. */
const ATTENTION_DETAIL: Readonly<Record<"NEEDS_SPEC" | "STOPPED", string>> = Object.freeze({
  NEEDS_SPEC: "Källan räckte inte till en verifierbar uppgift. Nästa steg är att komplettera den.",
  STOPPED: "Stoppat i snapshoten. Ett stopp är aldrig ett klart arbete.",
});

export type AttentionItem = {
  /** Stabil nyckel = tillståndet posten pekar på. Ingen egen namnrymd uppfinns. */
  id: TaskLifecycle;
  /** Svensk etikett ur V1:s presentation — aldrig omskriven här. */
  label: string;
  tone: Tone;
  detail: string;
  /** Uppgifterna posten pekar på, i snapshotens egen ordning. */
  task_ids: string[];
};

function tasksOf(snapshot: LoopSnapshot): TaskView[] {
  return [
    ...(snapshot.current_task === null ? [] : [snapshot.current_task]),
    ...snapshot.backlog,
    ...snapshot.completed,
  ];
}

/**
 * Härleder uppmärksamhetsposterna. REN funktion: ingen klocka, ingen ström, ingen tolkning
 * utöver de tillstånd snapshoten själv redovisar.
 */
export function deriveAttention(snapshot: LoopSnapshot | null): AttentionItem[] {
  if (snapshot === null) return [];
  const tasks = tasksOf(snapshot);
  const items: AttentionItem[] = [];
  for (const state of ATTENTION_STATES) {
    const matched = tasks.filter((task) => task.state === state);
    if (matched.length === 0) continue;
    const presentation = TASK_LIFECYCLE_PRESENTATION[state];
    items.push({
      id: state,
      label: presentation.label,
      tone: presentation.tone,
      detail: ATTENTION_DETAIL[state as "NEEDS_SPEC" | "STOPPED"],
      task_ids: matched.map((task) => task.task_id),
    });
  }
  return items;
}
