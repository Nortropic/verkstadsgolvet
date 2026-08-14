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
 */
import * as React from "react";
import PageHeader from "@/components/PageHeader";
import {
  MASKIN_HEADER_CSS,
  MASKIN_HEADER_SUB,
  MASKIN_HEADER_TRANSPORT_NOTE,
  maskinHeaderTruth,
} from "./ui";

export default function MaskinHeader({ fixture }: { fixture: boolean }) {
  const segments = maskinHeaderTruth({ fixture });

  return (
    <div className="mk-header" data-maskin-header="true">
      <style dangerouslySetInnerHTML={{ __html: MASKIN_HEADER_CSS }} />
      <PageHeader title="Maskinen" sub={MASKIN_HEADER_SUB} />
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
