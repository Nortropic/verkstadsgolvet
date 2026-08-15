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
import { SHOWROOM, factoryRoomMode, type FactoryRoomMode } from "@/lib/loop/room/mode";

/** Texten när rummet inte har någon validerad fixturkälla att visa. Aldrig en tom, tyst yta. */
export const TIMELINE_NO_FIXTURE_TEXT =
  "Rummet visar bara poster ur validerade källor. Fixturläget är av, och ingen annan källa av " +
  "operatörsposter finns i den här skivan — därför står här ingenting i stället för en gissning.";

/**
 * ROOM-08 · Namnen på rummets fokuserbara bevisytor.
 *
 * En rullbar ruta som går att tabba till måste kunna presentera sig: vad den är, vilken post
 * den hör till och att den rullar. Namnen byggs av postens EGET id — aldrig av en påhittad
 * beskrivning — och exporteras så att provet kan mäta dem i stället för att leta efter en
 * handskriven sträng i markupen.
 */
export const rawLabel = (entryId: string) => `Rådata (rullbar) · ${entryId}`;
export const verbatimLabel = (entryId: string) =>
  `Controllerns svar ordagrant (rullbar) · ${entryId}`;

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
        /*
          ROOM-08 · CONTROLLERNS ORDAGRANNA SVAR ÄR OCKSÅ EN SCROLLYTA.

          Ytan bryter visserligen sina rader (LOOP_CSS ger data-rejection-verbatim pre-wrap), men
          `.mk-raw` bär också max-height med overflow-y: auto — ett långt avslag scrollar alltså
          VERTIKALT i sin egen behållare, i varje vy. Utan tabindex nås den scrollen bara med
          pekare, och då är controllerns avslag ett bevis som kräver mus. Samma behandling som
          rådatalägena därför: fokuserbar behållare, ring ur ROOM_CSS (.rm-scroll-x:focus-visible).
        */
        <pre
          className="mk-raw rm-scroll-x"
          data-rejection-verbatim="true"
          tabIndex={0}
          role="group"
          aria-label={verbatimLabel(entry.entry_id)}
        >
          {entry.verbatim}
        </pre>
      )}

      <details className="rm-details" data-room-raw="true">
        <summary>{"{ }"} rådata</summary>
        {/*
          ROOM-08 · behållaren är FOKUSERBAR. Bred rådata scrollar i sin egen behållare (och
          bryts vid ≤959 px, där rummet är en spalt); en scrollyta utan tabindex går bara att
          nå med pekare, och ett
          bevis som kräver mus är inte ett tillgängligt bevis. Fokusringen målas i ROOM_CSS.

          ETT FOKUSSTOPP UTAN NAMN ÄR EN TYST STATION. Rutan får därför en roll och ett namn:
          en skärmläsare säger vad ytan ÄR, vilken post den hör till och att den är rullbar,
          i stället för att bara läsa upp en vägg av JSON utan sammanhang. Namnet bär postens
          id — samma id som står i posten ovanför — och hittar aldrig på ett värde.
        */}
        <pre
          className="mk-raw rm-scroll-x"
          data-room-raw-json="true"
          tabIndex={0}
          role="group"
          aria-label={rawLabel(entry.entry_id)}
        >
          {entry.raw}
        </pre>
      </details>
    </li>
  );
}

export default function RoomTimeline({
  fixture,
  mode = factoryRoomMode(),
}: {
  fixture: boolean;
  /**
   * Rummets produktläge. Skalet skickar det inte hit, så ytan FRÅGAR lägesmodulen i stället för
   * att påstå ett läge — samma mönster som FactoryRoomHeader använder. Skillnaden är hela
   * poängen: märket nedan blir då en avläsning av `factoryRoomMode()` (fail-closed), aldrig en
   * yta som skriver ordet «showroom» för hand.
   */
  mode?: FactoryRoomMode;
}) {
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
      {/*
        h2: rummets ytor ligger på samma nivå, och nivån ska SYNAS. Egen klass i stället för
        h3-rubrikernas mono-versaler, annars går sektionen inte att skilja från segmenten under.
      */}
      <div className="rm-timeline-head">
        <h2 className="rm-timeline-title">{TIMELINE_HEADING}</h2>
        {/* Läget som VÄRDE ur lib/loop/room/mode.ts — ingen avskriven sträng, inget gissat läge.
            Källan (fixtur) står i segmentens egna rubriker, som äger den sanningen. */}
        <span className="rm-flag" data-timeline-flag={mode}>
          {mode}
        </span>
      </div>

      {/*
        SHREDDER-01B §owner-8 · ORDNINGSNOTISEN ÄR FLYTTAD, INTE BORTTAGEN.
        Den fulla texten står ordagrant kvar, i en upplysningsyta av exakt samma sort som
        rummets bevisytor. Kravet var att den primära ytan ska LÄSAS som en färdig produkt —
        aldrig att ärligheten ska kortas.

        VÄXELN BÄR INGET MÄRKE, OCH DET ÄR EN REGEL OM ORDFÖRRÅD — INTE OM SMAK.
        «.rm-flag» är rummets LÄGESMÄRKE, och dess ordförråd är lägen: SHOWROOM, LIVE, OFFLINE,
        BLOCKED, em-streck. Här stod en gång ordet «ORDNING» i samma märke — en kategoriBETECKNING
        formad exakt som ett tillstånd. En operatör som ögnar sidan efter statusmarkörer läste då
        ett sektionsord som om det vore ett läge, och märkets värde som markör sjunker för varje
        ord som inte är ett läge. Rubriken säger redan vad luckan innehåller, så växeln är ren
        text — samma form som kommandoytans egna växlar. Läget för hela tidslinjen står som märke
        i rubrikraden ovan, en gång, där det hör hemma.
      */}
      <details className="rm-details" data-timeline-note="true">
        <summary>Så är tidslinjen sorterad</summary>
        <p className="rm-timeline-note">{TIMELINE_NO_GLOBAL_ORDER_NOTE}</p>
      </details>

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
            {/*
              Segmentets två inledande stycken bärs av en upplysningsyta: de beskriver hur
              posterna är ordnade och varifrån de kommer, vilket är teknisk bakgrund — medan
              själva posterna är det operatören kom hit för att läsa. Texten är oförändrad.
            */}
            <details className="rm-details" data-segment-note={segment.id}>
              <summary>
                <span className="rm-flag">{SHOWROOM}</span> Om segmentet
              </summary>
              <p className="rm-timeline-note">{segment.description}</p>
              <p className="rm-timeline-note" data-room-order-note={segment.id}>
                {segment.order_note}
              </p>
            </details>

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
