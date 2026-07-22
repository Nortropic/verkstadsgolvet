/**
 * Leads-scoring. REGEL-logiken (vilken bucket ett råvärde hamnar i) ligger här i kod;
 * POÄNGEN kommer från score_vikter i databasen (ScoreConfig.vikter) → kalibrerbart utan
 * omdeploy. Ren funktion, inga anrop. Se db/leads-schema.sql för signal-nycklarna.
 *
 * VIKTERNA ÄR GISSNINGAR (v1, 2026-07, hypotes "bryr sig redan men saknar sajt"). Ingen
 * empirisk grund — kalibreras mot faktiska svar efter ~15 utfall.
 */
import type { Lead, ScoreConfig, ScoreResultat, ScoreRad } from "./leads-types";

/**
 * Alla insamlade branscher är Ring 1 (bygg & hantverk, hem & fastighet, fordon & verkstad,
 * persontjänster) — insamlingen söker bara Ring 1-termer. Därför: har leaden en bransch
 * räknas den som Ring 1. (Blir en riktig lista om andra ringar tillkommer.)
 */
function ärRing1(bransch: string | null): boolean {
  return Boolean(bransch && bransch.trim());
}

function månaderSedan(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return (Date.now() - d) / (1000 * 60 * 60 * 24 * 30.44);
}

export function beräknaScore(lead: Lead, config: ScoreConfig): ScoreResultat {
  const v = config.vikter;
  const rader: ScoreRad[] = [];
  const lägg = (signal: string) => {
    const poang = v[signal];
    if (poang != null) rader.push({ signal, poang });
  };

  // A. Kärnsignal
  if (lead.har_sajt === false) lägg("ingen_sajt");

  // B. Volym
  const rc = lead.recensioner_antal ?? 0;
  if (rc >= 20) lägg("rec_20plus");
  else if (rc >= 10) lägg("rec_10_19");
  else if (rc >= 5) lägg("rec_5_9");
  else if (rc >= 1) lägg("rec_1_4");

  const bt = lead.betyg;
  if (bt != null) {
    if (bt >= 4.5) lägg("betyg_45plus");
    else if (bt >= 4.0) lägg("betyg_40_44");
    else if (bt >= 3.5) lägg("betyg_35_39");
  }

  // C. Färskhet
  const m = månaderSedan(lead.senaste_recension_at);
  if (m != null) {
    if (m < 3) lägg("farskhet_u3man");
    else if (m < 6) lägg("farskhet_3_6man");
    else if (m < 12) lägg("farskhet_6_12man");
    else lägg("farskhet_over12man");
  }
  if ((lead.recensioner_senaste_6man ?? 0) >= 3) lägg("flode_6man");

  // D. Engagemang ("bryr sig redan")
  if (lead.agare_svarar_pa_recensioner === true) lägg("agare_svarar");
  if (lead.gbp_har_foton === true) lägg("gbp_foton");
  if (lead.gbp_har_oppettider === true) lägg("gbp_oppettider");
  if (lead.gbp_har_beskrivning === true) lägg("gbp_beskrivning");

  // E. Demo-förutsättning (manuell bedömning)
  if (lead.fb_url || lead.ig_url) lägg("har_fb_ig");
  if (lead.bildmaterial_bedomning === "bra") lägg("bildmaterial_bra");
  else if (lead.bildmaterial_bedomning === "saknas") lägg("bildmaterial_saknas");

  // F. Passform
  if (ärRing1(lead.bransch)) lägg("bransch_ring1");

  // Negativa
  if (rc === 0) lägg("noll_recensioner");
  if (bt != null && bt < 3.5) lägg("betyg_u35");

  const score = rader.reduce((s, r) => s + r.poang, 0);
  const niva: ScoreResultat["niva"] =
    score >= config.bygg_demo_min ? "bygg_demo" : score >= config.kvalificerad_min ? "kvalificerad" : "lag_prio";

  return { score, rader, niva };
}
