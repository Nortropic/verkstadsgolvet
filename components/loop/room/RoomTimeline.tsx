/**
 * ROOM-01 · Rummets tidslinje: SEGMENTERAD presentation, aldrig en hopslagen konversation.
 *
 * VAD DEN VISAR
 * -------------
 * Två fixturbaserade segment — operatörens inlämningar och intentioner, samt fabrikens kvitton
 * (kommandoradernas öde). LIVE-segmentet är strömpanelen, som monteras EN gång av skalet och bär
 * sin egen anslutning och sitt eget transportläge. De två källorna blandas aldrig ihop till en
 * enda "levande" tidslinje: gränsstycket mellan dem står kvar i skalet och märker skiftet.
 *
 * BINDANDE REGLER SOM YTAN BÄR
 * ----------------------------
 * · Varje post bär sin KÄLLA maskinläsbart (`data-room-source`) och sitt segment. En fixtur
 *   beskrivs aldrig som livedata.
 * · Ingen orsakskedja påstås mellan segmenten. En BINDNING skrivs bara ut när samma verkliga
 *   identifierare finns i båda posterna.
 * · Ytan hämtar ingenting, ansluter ingenting och kör ingenting. Den är en serverrenderad
 *   projektion av redan validerade poster; rådataläget är ett nativt `<details>` utan skript.
 * · Ingen post bär ett uppgiftstillstånd. Lifecycle-state kommer ur snapshoten, i mittkolumnen.
 */
import * as React from "react";
import { toneClass } from "../ui";
import { MISSING } from "@/lib/loop/labels";
import { fixtureCommands, fixtureIntakeOutcomes } from "@/lib/loop/fixtures";
import {
  TIMELINE_EMPTY_TEXT,
  TIMELINE_HEADING,
  TIMELINE_NO_GLOBAL_ORDER_NOTE,
  roomTimeline,
  type TimelineEntry,
} from "@/lib/loop/room/timeline";

/** Texten när rummet inte har någon validerad fixturkälla att visa. Aldrig en tom, tyst yta. */
export const TIMELINE_NO_FIXTURE_TEXT =
  "Rummet visar bara poster ur validerade källor. Fixturläget är av, och ingen annan källa av " +
  "operatörsposter finns i den här skivan — därför står här ingenting i stället för en gissning.";

function Entry({ entry }: { entry: TimelineEntry }) {
  const missingStatus = entry.status_label === MISSING;

  return (
    <li
      className="rm-entry"
      data-room-entry={entry.entry_id}
      data-room-source={entry.source}
      data-room-segment={entry.segment}
    >
      <div className="rm-entry-head">
        <span className="rm-source" data-room-source-label={entry.source}>
          {entry.source}
        </span>
        <span className="rm-entry-title">{entry.headline}</span>
        <span
          className={`mk-badge ${toneClass(entry.status_tone)}`}
          data-entry-status={entry.status_label}
          data-missing={missingStatus ? "true" : "false"}
        >
          {entry.status_label}
        </span>
      </div>

      {entry.detail !== null && <p className="rm-entry-text">{entry.detail}</p>}

      {entry.identifiers.length > 0 && (
        <ul className="rm-ids" data-room-identifiers="true">
          {entry.identifiers.map((id) => (
            <li className="rm-id" key={id.key} data-room-identifier={id.key} data-value={id.value}>
              <span className="rm-id-key">{id.label}</span>
              <span className={id.mono ? "rm-id-value mk-mono" : "rm-id-value"}>{id.value}</span>
            </li>
          ))}
        </ul>
      )}

      {entry.binding !== null && (
        <p
          className="rm-entry-text"
          data-room-binding={entry.binding.key}
          data-room-bound-to={entry.binding.entry_id}
        >
          Bunden till operatörsposten · {entry.binding.key}{" "}
          <span className="mk-mono">{entry.binding.value}</span>
        </p>
      )}

      {entry.verbatim !== null && (
        <pre className="mk-raw rm-scroll-x" data-rejection-verbatim="true">
          {entry.verbatim}
        </pre>
      )}

      <details className="rm-details" data-room-raw="true">
        <summary>{"{ }"} rådata</summary>
        <pre className="mk-raw rm-scroll-x" data-room-raw-json="true">
          {entry.raw}
        </pre>
      </details>
    </li>
  );
}

export default function RoomTimeline({ fixture }: { fixture: boolean }) {
  /*
    Fixturkatalogen är den ENDA källan till operatörsposter i den här skivan. Är fixturläget av
    finns det ingenting validerat att visa — och då visas ingenting, med orsak. Fixturposter får
    aldrig följa med in i en vy som inte är märkt som fixtur.
  */
  const segments = fixture
    ? roomTimeline({ outcomes: fixtureIntakeOutcomes(), commands: fixtureCommands() })
    : [];

  return (
    <section className="rm-timeline" data-room-timeline="true" aria-label={TIMELINE_HEADING}>
      {/* h2: rummets ytor ligger på samma nivå. Segmenten under är h3. */}
      <h2 className="rm-attention-heading">{TIMELINE_HEADING}</h2>
      <p className="rm-timeline-note">{TIMELINE_NO_GLOBAL_ORDER_NOTE}</p>

      {segments.length === 0 ? (
        <p className="rm-timeline-note" data-timeline-empty="true">
          {TIMELINE_NO_FIXTURE_TEXT}
        </p>
      ) : (
        segments.map((segment) => (
          <div
            className="rm-segment"
            key={segment.id}
            data-room-timeline-segment={segment.id}
            data-room-segment-source="fixture"
          >
            <h3 className="rm-segment-title">{segment.title}</h3>
            <p className="rm-timeline-note">{segment.description}</p>
            <p className="rm-timeline-note" data-room-order-note={segment.id}>
              {segment.order_note}
            </p>

            {segment.entries.length === 0 ? (
              <p className="rm-timeline-note">{TIMELINE_EMPTY_TEXT}</p>
            ) : (
              <ul className="rm-entries">
                {segment.entries.map((entry) => (
                  <Entry entry={entry} key={entry.entry_id} />
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </section>
  );
}
