/**
 * LANE-01 · ARBETSDOMÄNENS MÄRKE — en rad, inte ett kort.
 *
 * VAD YTAN ÄR
 * -----------
 * Den visar vilket av Nortropics två fabriksspår något tillhör: KUNDPRODUKTION eller
 * SYSTEMFÖRBÄTTRINGAR (lib/loop/room/lane.ts). Värdet SKICKAS IN — ytan läser ingen snapshot,
 * ingen adress och ingen miljö, och den härleder aldrig en domän ur ett namn, en titel eller ett
 * kodförråd.
 *
 * VARFÖR NULL RENDERAS SOM EM-STRECK OCH INTE DÖLJS
 * -------------------------------------------------
 * En yta som försvinner när värdet saknas gör «okänd» oskiljbar från «finns inte». Rummets regel
 * är den motsatta och gäller här också: ett hål är information, det renderas som em-streck och
 * märks maskinläsbart (`data-missing`). Attributet `data-work-domain` finns därför ALLTID, också
 * när det bär em-strecket.
 *
 * VARFÖR MÄRKET INTE ÄR «.rm-flag»
 * --------------------------------
 * Rummets lägesmärke bär ett LÄGE (SHOWROOM, LIVE, OFFLINE, BLOCKED, em-streck) och den
 * disciplinen är mätt i tests/loop/showroom-navigation.test.ts. En arbetsdomän är en annan sorts
 * ord — en kategori, inte ett tillstånd — och att låna lägesmärkets form hade urholkat värdet av
 * varje lägesmärke på sidan. Ytan har därför en egen, dämpad form.
 *
 * BINDANDE REGLER
 * ---------------
 * · Ingen hämtning, ingen intention, inget kommando. Ytan är text.
 * · Ingen rörelse, ingen andel, ingen stapel — ett värde eller ett em-streck.
 * · Etiketterna kommer ur lane-modulen; ingen yta stavar dem för hand.
 */
import * as React from "react";
import {
  WORK_DOMAIN_CAPTION,
  workDomainAttribute,
  workDomainLabel,
  type WorkDomain,
} from "@/lib/loop/room/lane";

export type WorkDomainIndicatorProps = {
  /** Den uttryckligen burna domänen, eller null när ingen följt med. */
  domain: WorkDomain | null;
  /**
   * Vems domän raden gäller — ALLTID utskrivet, aldrig underförstått.
   *
   * Förvalet är rummets egen etikett. Ytor som visar NÅGON ANNANS domän (showroom-väljaren visar
   * SCENARIOTS) skickar in sin egen, så att två rader på samma skärm aldrig kan läsas som två
   * påståenden om samma sak — och så att ett em-streck läses som «den här ägarens domän är
   * okänd» i stället för som ett trasigt fält.
   */
  caption?: string;
};

export default function WorkDomainIndicator({
  domain,
  caption = WORK_DOMAIN_CAPTION,
}: WorkDomainIndicatorProps) {
  const missing = domain === null;

  return (
    <p
      className="rm-domain"
      data-work-domain-indicator="true"
      data-work-domain={workDomainAttribute(domain)}
    >
      <span className="rm-domain-key">{caption}</span>
      <span
        className={missing ? "rm-domain-value mk-missing" : "rm-domain-value"}
        data-missing={missing ? "true" : "false"}
      >
        {workDomainLabel(domain)}
      </span>
    </p>
  );
}
