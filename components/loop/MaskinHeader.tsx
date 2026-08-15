/**
 * /loop · Sidhuvudet, sanningsenligt.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — TARGET_UX (sidhuvudet) och de bindande
 * ärlighetsreglerna: en fixtur- eller kontraktsyta beskrivs ALDRIG som live.
 *
 * VARFÖR EN EGEN KOMPONENT
 * ------------------------
 * · PageHeader tar bara en STRÄNG som undertext. Sanningen om /loop har tre delar med olika
 *   läge; pressas de in i en enda mening blir de en lång oavgränsad caption-paragraf som ingen
 *   läser. Här står ingressen kvar i `sub`, och de tre lägena renderas som korta, avgränsade
 *   segment med varsitt `data-truth-mode`.
 * · Stilen är namnrymdad (`mk-header*`) och injiceras här. app/globals.css rörs INTE: `.ph-sub`
 *   delas av hela appen, och den här skivan får bara begränsa radlängden på /loop.
 *
 * BINDANDE REGLER
 * ---------------
 * · Komponenten äger INGEN datahämtning och ingen policy. Texten härleds i components/loop/ui.ts
 *   ur de faktiska lägena (`commandChannelEnabled`, fixturflaggan) — inte ur en fri mening här.
 * · Ingen animation, ingen procentsats, ingen liveness-markör: ordet "Live" gäller VILKEN KÄLLA
 *   panelen läser, aldrig ett påstående om att något rör sig just nu.
 * · TRANSPORTLÄGET ÄGS AV STRÖMPANELEN (V9), som har den faktiska signalen och renderar den
 *   med orsak. Sidhuvudet upprepar det aldrig — det hänvisar till det. Ett huvud som gissade
 *   anslutningsläge skulle förr eller senare motsäga panelen två rader längre ned.
 * · SHREDDER-01A · LÄGESRADEN ÄR EN RAD. Produktläget (lib/loop/room/mode.ts) står som en kort
 *   rad med `data-room-mode`, inte som en försvarsvägg av friskrivningar: den långa tekniska
 *   detaljen hör hemma i de tekniska ytorna (statusraden, strömpanelen, orsakskedjan), där den
 *   går att granska. Huvudet ska läsas som en produkt och ändå vara sant.
 */
import * as React from "react";
import PageHeader from "@/components/PageHeader";
import {
  SHOWROOM_MODE_LINE,
  factoryRoomMode,
  type FactoryRoomMode,
} from "@/lib/loop/room/mode";
import {
  MASKIN_HEADER_CSS,
  MASKIN_HEADER_SUB,
  MASKIN_HEADER_TRANSPORT_NOTE,
  maskinHeaderTruth,
} from "./ui";

/** Etiketten på huvudets upplysningsyta. Den säger vad som ligger bakom luckan, aldrig ett läge. */
export const MASKIN_HEADER_MORE_LABEL = "Om ytorna: ström, kommandokanal och datakälla";

/**
 * VISARE FRAMFÖR ETIKETTEN — LUCKAN SKA SE UT SOM EN LUCKA.
 *
 * FYNDET: «display: inline-flex» på en summary släcker webbläsarens EGEN triangel, och utan den
 * återstod nedtonad 10,5-punkters versal mono — alltså något som läser som en BILDTEXT. På
 * telefonen är den raden den enda ledtråden om att de tre sanningssegmenten och transportnotisen
 * fortfarande finns, så en ledtråd som inte ser klickbar ut är hela fold-åtgärdens synliga söm.
 *
 * Visaren står som konstant och inte som ett CSS-«content», eftersom injicerad text inte går att
 * mäta i markupen och inte följer med i en kopierad rad. Den är `aria-hidden`: riktningen är
 * dekor, och det öppna eller stängda läget bärs redan av `<details>` självt för den som lyssnar.
 */
export const MASKIN_HEADER_MORE_MARKER = "▸";

/**
 * SHREDDER-01B · HUVUDETS EGEN BRYTPUNKTSREGEL — EN LUCKA SOM STÅR ÖPPEN PÅ SKRIVBORDET.
 *
 * PROBLEMET, MÄTT: vid 390 px låg «Mata maskinen» på 1098 px, alltså en hel skärm under
 * vikningen. Sidhuvudets tre sanningssegment och transportnotisen står för 120 px av det —
 * fyra rader brasklapp mellan produktens namn och rummets ingång.
 *
 * LÖSNINGEN: segmenten och notisen flyttar in i ett nativt `<details>`. Ingen sträng raderas,
 * ingen märkning ändras, och varje frusen mätare i tests/loop/ux-loop-header-v2.test.ts läser
 * exakt samma element som förut — de tre `mk-header-truth-row`, de tre `data-truth-source`,
 * `data-truth-note="transport"` och transportnotisens text ligger kvar i markupen.
 *
 * OCH SKRIVBORDET ÄR OFÖRÄNDRAT: vid 720 px och uppåt fälls luckan ut av CSS och summaryn döljs,
 * så huvudet ser ut precis som före den här skivan. Bara telefonen får den stängda formen.
 *
 * DEGRADERINGEN ÄR UTSKRIVEN I STÄLLET FÖR UNDERFÖRSTÅDD. Utfällningen kräver
 * `::details-content`, och regeln står därför bakom `@supports selector(::details-content)`. En
 * motor som saknar väljaren tillämpar INGEN av de två raderna — varken utfällningen eller
 * döljandet av summaryn — och möter då en stängd lucka med synlig, klickbar etikett på
 * skrivbordet. Det är en ärlig degradering: texten finns, den är nåbar, den är bara ett svep
 * bort. Vore raderna oskyddade hade samma motor fått en dold summary över ett dolt innehåll,
 * alltså text som varken syns eller går att nå — och det är skillnaden regeln finns för.
 *
 * Stilarket är eget och namnrymdat («mk-header-more»). MASKIN_HEADER_CSS ligger i
 * components/loop/ui.ts, utanför den här skivans skrivrätt, och är orört: det injiceras
 * fortfarande ordagrant av komponenten nedan.
 */
export const MASKIN_HEADER_MORE_CSS = `
/* Ingen egen marginal: segmentlistan bär redan sin «margin: 7px 0 0» ur MASKIN_HEADER_CSS, och
   «.mk-header» är en flexspalt där marginaler inte kollapsar. En marginal här hade lagt sig
   OVANPÅ den och flyttat skrivbordets sidhuvud sex pixlar — luckan ska vara osynlig vid ≥720 px. */
.mk-header-more { margin: 0; }
/*
  AFFORDANSEN ÄR HÖJDNEUTRAL — MED FLIT.

  Raden bär redan rummets kontrollhöjd (38 px) och ligger innanför den uppmätta budgeten för
  telefonens första vy. Ledtrådarna nedan är därför TECKENNIVÅ: en visare, en understruken
  etikett och en mindre nedtonad färg. Ingen bakgrund, ingen ram, ingen extra utfyllnad — en
  chipform som «.rm-details > summary» hade lagt på höjd, och höjd är exakt det som en gång sköt
  «Mata maskinen» under vikningen.
*/
.mk-header-more > summary { display: inline-flex; align-items: center; gap: 8px;
  min-height: 38px; cursor: pointer; font-family: var(--font-mono); font-size: 10.5px;
  letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-secondary); }
.mk-header-more > summary:focus-visible { box-shadow: var(--focus-ring); border-radius: 4px; }
.mk-header-more > summary:hover { color: var(--text-primary); }
/* Visaren pekar åt höger när luckan är stängd och nedåt när den är öppen. Ingen övergång och
   ingen rörelse: två statiska lägen, inte en animation. */
.mk-header-more-marker { display: inline-flex; flex: none; font-size: 11px; line-height: 1; }
.mk-header-more[open] > summary .mk-header-more-marker { transform: rotate(90deg); }
/* Understrykningen är det som skiljer en kontroll från en bildtext vid en snabb blick. Den
   ligger på etiketten och inte på hela raden, så visaren inte får ett streck under sig. */
.mk-header-more-text { text-decoration: underline; text-decoration-color: var(--border-stronger);
  text-underline-offset: 3px; }
.mk-header-more > summary:hover .mk-header-more-text { text-decoration-color: currentColor; }
@media (min-width: 720px) {
  @supports selector(::details-content) {
    .mk-header-more::details-content { content-visibility: visible; }
    .mk-header-more > summary { display: none; }
  }
}
`;

export default function MaskinHeader({
  fixture,
  mode = factoryRoomMode(),
}: {
  fixture: boolean;
  /** Rummets produktläge. Skickas in av routen; komponenten läser aldrig env i smyg. */
  mode?: FactoryRoomMode;
}) {
  const segments = maskinHeaderTruth({ fixture });

  return (
    <div className="mk-header" data-maskin-header="true" data-room-mode={mode}>
      <style dangerouslySetInnerHTML={{ __html: MASKIN_HEADER_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: MASKIN_HEADER_MORE_CSS }} />
      {/*
        SHREDDER-01C · SIDANS h1 ÄR PRODUKTENS NAMN.

        Rubriken hette «Maskinen» — husets ord för MASKINKONCEPTET — medan produkten heter
        Kartongförstöraren överallt där den namnger sig själv. En operatör som klickade sig hit
        fick gissa att de två orden betecknade samma sak, och två oberoende granskningsronder
        fällde diskontinuiteten. Namnet står här, en gång, som sidans identitet. Ordet
        «maskinen» finns kvar i löpande text där det betyder maskinen — aldrig som sidans namn.
      */}
      <PageHeader title="Kartongförstöraren" sub={MASKIN_HEADER_SUB} />
      {/*
        Lägesraden bär husets befintliga notisform (`mk-header-truth-note`): den har redan
        radlängdstak och nedtonad vikt i MASKIN_HEADER_CSS, och en ny klass utan regel hade
        krävt en ändring i ett stilark som ligger utanför den här skivan. Det SYNLIGA märket
        för samma läge bärs av statusraden nedanför, en gång.
      */}
      {mode === "SHOWROOM" && (
        <p className="mk-header-truth-note" data-room-mode-line="true">
          {SHOWROOM_MODE_LINE}
        </p>
      )}
      {/*
        SHREDDER-01B · SANNINGEN ÄR FLYTTAD, ALDRIG KORTAD (§owner-8).

        De tre sanningssegmenten och transportnotisen står ordagrant kvar, med oförändrad
        märkning, i en nativ upplysningsyta. Skälet är mätt vid 390 px och står i sin helhet vid
        MASKIN_HEADER_MORE_CSS ovan; formen är densamma som rummet redan använder för teknisk
        text (FactoryRoomHeader, WorkComposer, RoomTimeline).

        VAD SOM MED FLIT STÅR KVAR FRAMME, EFTERSOM DET ÄR LÄGE OCH INTE BRASKLAPP: produktens
        namn i sidans h1, ingressen, och lägesraden «SHOWROOM · simulerad fabriksdata». En
        operatör som öppnar telefonen ska mötas av VAD ytan är och VILKET läge den står i — inte
        av fyra rader om vem som äger transportläget.
      */}
      <details className="mk-header-more" data-header-more="true">
        <summary>
          <span className="mk-header-more-marker" aria-hidden="true">
            {MASKIN_HEADER_MORE_MARKER}
          </span>
          <span className="mk-header-more-text">{MASKIN_HEADER_MORE_LABEL}</span>
        </summary>

        <ul className="mk-header-truth" data-header-truth="true">
          {segments.map((segment) => (
            <li
              className="mk-header-truth-row"
              key={segment.id}
              data-truth-source={segment.id}
              data-truth-mode={segment.mode}
            >
              <span className="mk-header-truth-label">{segment.label}</span>
              <span className="mk-header-truth-text">{segment.text}</span>
            </li>
          ))}
        </ul>
        <p className="mk-header-truth-note" data-truth-note="transport">
          {MASKIN_HEADER_TRANSPORT_NOTE}
        </p>
      </details>
    </div>
  );
}
