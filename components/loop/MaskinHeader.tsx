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
      <PageHeader title="Maskinen" sub={MASKIN_HEADER_SUB} />
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
    </div>
  );
}
