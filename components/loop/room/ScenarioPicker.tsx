/**
 * SHREDDER-01B · Väljaren mellan showroomets scenarier.
 *
 * VAD YTAN ÄR — OCH INTE ÄR
 * -------------------------
 * Två vanliga länkar under rubriken «Showroom-scenario». De byter vilken GENERERAD, validerad
 * fixtur rummet visar upp — ingenting annat. Ytan är med flit INTE formad som kommandoytans
 * knappar: en visningsväxel får aldrig se ut som en intention mot controllern.
 *
 * BINDANDE REGLER SOM YTAN BÄR
 * ----------------------------
 * · INGA KNAPPAR, INGET FORMULÄR, INGEN HÄMTNING. Länkar och serverrendering; valet läses ur
 *   adressen av routen, som väljer bland en sluten lista (lib/loop/room/scenarios.ts).
 * · VALET ÄR MÄRKT SOM SHOWROOM. Märket står i ytan, med samma konstant som resten av rummet
 *   använder — ingen yta stavar det för hand.
 * · INGEN STATUS. Ytan visar inget värde ur en snapshot och påstår därför ingenting om fabriken;
 *   den säger bara vilken uppsättning simulerad data som är vald.
 */
import * as React from "react";
import Link from "next/link";
import {
  DEFAULT_SCENARIO,
  SCENARIO_ANCHOR_ID,
  SCENARIO_PICKER_LABEL,
  SCENARIO_PICKER_NOTE,
  SCENARIO_TIMELINE_SCOPE_NOTE,
  SHOWROOM_SCENARIOS,
  scenarioById,
  scenarioHref,
  type ShowroomScenarioId,
} from "@/lib/loop/room/scenarios";
import { SHOWROOM, factoryRoomMode, type FactoryRoomMode } from "@/lib/loop/room/mode";

/**
 * SHREDDER-01B · VÄLJARENS PLATS PÅ TELEFONEN — UNDER PRODUKTEN, INTE FÖRE DEN.
 *
 * MÄTT, INTE ANTAGET: vid 390 px kostar väljaren 126 px (raden, luckan och mellanrummet) OVANFÖR
 * rummet. Det är 126 px av telefonens första skärm spenderade på ett demoreglage innan
 * operatören sett var arbete matas in — och «Mata maskinen» låg då under vikningen.
 *
 * Vid 720 px och uppåt står väljaren kvar exakt där den alltid stått: överst, under sidhuvudet.
 * Skrivbordet och surfplattan har höjd att avvara, och där är valet en naturlig ram kring rummet.
 *
 * VARFÖR REGELN INTE LIGGER I ROOM_CSS: väljaren är INTE ett barn till «.rm-room» — den är ett
 * syskon till rummet under sidans «main». En `order` i ROOM_CSS gäller dessutom bara rummets
 * egna barn, och tests/loop/room-mobile.test.ts fryser med rätta att ingen annan väljare där får
 * sätta `order`: en order på ett direktbarn till rummet ordnar om HELA rummet. Ytan bär därför
 * sin egen placering, i sin egen namnrymd.
 *
 * VARFÖR «:has()» OCH INTE BARA «.main»: «.main» är husets delade innehållsyta och ägs av
 * app/globals.css, som ligger utanför den här skivans skrivrätt. Villkoret gör regeln
 * INNEHÅLLSBEROENDE: bara en «main» som FAKTISKT bär den här väljaren blir en flexspalt. Varje
 * annan sida i appen är oberörd, vid varje bredd.
 *
 * INGENTING DÖLJS OCH INGENTING KORTAS: samma markup, samma länkar, samma text, samma ordning i
 * DOM:en. Det som ändras är var i spalten sektionen målas — alltså ren arrangering.
 */
export const SCENARIO_PICKER_CSS = `
@media (max-width: 719px) {
  .main:has(> [data-showroom-scenarios="true"]) { display: flex; flex-direction: column; }
  .main > [data-showroom-scenarios="true"] { order: 1; }
}
`;

export default function ScenarioPicker({
  current,
  mode = factoryRoomMode(),
}: {
  /** Det scenario routen faktiskt valde. Ytan härleder det aldrig själv. */
  current: ShowroomScenarioId;
  /** Rummets produktläge, inskickat av routen. Ytan gissar aldrig ett läge. */
  mode?: FactoryRoomMode;
}) {
  return (
    <section
      className="rm-scenarios"
      id={SCENARIO_ANCHOR_ID}
      data-showroom-scenarios="true"
      data-scenario-current={current}
      data-room-mode={mode}
      aria-label={SCENARIO_PICKER_LABEL}
    >
      <style dangerouslySetInnerHTML={{ __html: SCENARIO_PICKER_CSS }} />
      {/*
        RUBRIK OCH VAL PÅ SAMMA RAD — OCH INGEN ANDRA LÄGESETIKETT.

        Ytan står OVANFÖR produkten. På en telefon åt den tidigare en dryg tredjedel av första
        skärmen, och «Mata maskinen» hamnade under vikningen: en scenariovalslista är hjälpmedel,
        inte rummets ärende. Rubriken och de två chipsen delar därför EN radbrytande rad.

        Det fulla showroom-märket är också borta HÄRIFRÅN, och bara härifrån: sidhuvudets lägesrad
        står strax ovanför och statusraden bär samma märke strax under, så etiketten fanns tre
        gånger inom en skärm. Ytan är fortfarande märkt — upplysningsytans märke bär läget ur
        lägesmodulen — men den upprepar inte en etikett som redan står två rader bort.
      */}
      <div className="rm-scenario-row">
        <h2 className="rm-scenario-title">{SCENARIO_PICKER_LABEL}</h2>

        {SHOWROOM_SCENARIOS.map((scenario) => {
          const selected = scenario.id === current;
          return (
            <Link
              key={scenario.id}
              className={selected ? "rm-scenario rm-scenario-on" : "rm-scenario"}
              href={scenarioHref(scenario.id)}
              data-scenario-option={scenario.id}
              data-scenario-selected={selected ? "true" : "false"}
              aria-current={selected ? "page" : undefined}
            >
              <span className="rm-scenario-label">{scenario.label}</span>
            </Link>
          );
        })}
      </div>

      {/*
        DEN SYNLIGA RADEN FINNS DÄR MOTSÄGELSEN FINNS — OCH BARA DÄR.

        Kompakteringen fick först med sig för mycket: både beskrivningarna OCH meningen om vad
        valet inte rör hamnade bakom en stängd växel. Väljer man då «Tom fabrik» ser operatören en
        tom fabrik med en full tidslinje under — en synlig motsägelse vars enda förklaring låg
        bakom en dörr. En förklaring som måste öppnas är ingen förklaring.

        Raden står därför framme när valet INTE är förvalet, och bär då både det valda scenariots
        beskrivning och gränsmeningen. I förvalet finns ingen motsägelse att förklara: kön,
        blicken och hyllan är fulla precis som tidslinjen, och en rad som beskriver den normala
        vyn hade bara varit en rad krom ovanför produkten — på en telefon den rad som trycker
        ned rummets ingång. BÅDA beskrivningarna står kvar ordagrant i upplysningsytan under, så
        ingenting är borttaget: det som växlar är var texten står, aldrig om den finns.
      */}
      {current !== DEFAULT_SCENARIO && (
        <p className="rm-scenario-scope" data-scenario-selected-description={current}>
          {scenarioById(current).description} {SCENARIO_TIMELINE_SCOPE_NOTE}
        </p>
      )}

      <details className="rm-details" data-scenario-note="true">
        <summary>
          <span className="rm-flag">{SHOWROOM}</span> Vad valet byter
        </summary>

        {SHOWROOM_SCENARIOS.map((scenario) => (
          <p
            className="rm-scenario-desc"
            key={scenario.id}
            data-scenario-description={scenario.id}
          >
            {scenario.label} — {scenario.description}
          </p>
        ))}

        <p className="rm-scenario-desc" data-scenario-note-text="true">
          {SCENARIO_PICKER_NOTE}
        </p>
      </details>
    </section>
  );
}
