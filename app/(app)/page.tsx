import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ProcessGuide from "@/components/ProcessGuide";
import PipelinePanel from "@/components/PipelinePanel";
import MetricsPanel from "@/components/MetricsPanel";

/**
 * SHREDDER-01B · PRODUKTINGÅNGEN, INTE EN STATUSPANEL.
 *
 * Ytan gör EN sak: den talar om att Kartongförstöraren finns och tar en klickning dit. Den visar
 * med flit ingen siffra, ingen liveness-markör och ingen fixturdata — startsidan äger ingen
 * sanning om fabriken, och en ingång som låtsas vara en mätare vore ett påstående utan källa.
 * Rummets egna ytor (/loop) bär läget, märkningen och all data.
 */
const ENTRY_TITLE = "Kartongförstöraren";
const ENTRY_LEAD = "Mata in arbete och se Nortropic arbeta.";
const ENTRY_CTA = "Öppna kartongförstöraren";

/*
  Formen är sidans egen: hårlinjekortet «panel», seriftiteln från sidhuvudet och husets primära
  knapp. Raden sätts med husets EGNA variabler i stället för klassen `.ph-row`, som är scopad till
  `.page-header` i app/globals.css — och det stilarket ligger utanför den här skivan. Ingen ny
  färg, ingen ny storlek och ingen ny token införs.
*/
function ShredderEntry() {
  return (
    <section className="panel" data-product-entry="kartongforstoraren" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "var(--fs-title)",
              lineHeight: "var(--lh-title)",
              fontWeight: 500,
              letterSpacing: "-0.2px",
              textTransform: "none",
              color: "var(--text-primary)",
              display: "block",
              marginBottom: 6,
            }}
          >
            {ENTRY_TITLE}
          </h2>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--fs-body)",
              lineHeight: "var(--lh-body)",
              color: "var(--text-secondary)",
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            {ENTRY_LEAD}
          </div>
        </div>
        <Link
          className="btn-primary"
          href="/loop"
          data-product-entry-cta="true"
          style={{ display: "inline-flex", alignItems: "center", flex: "none" }}
        >
          {ENTRY_CTA}
        </Link>
      </div>
    </section>
  );
}

// Översikt ("/") — ingången till Kartongförstöraren, sedan process, löpande band och nyckeltal.
export default function Oversikt() {
  return (
    <>
      <PageHeader title="Översikt" sub="Var bygget står och vad som händer härnäst" />
      <ShredderEntry />
      <ProcessGuide />
      <div className="bottom">
        <PipelinePanel />
        <MetricsPanel />
      </div>
    </>
  );
}
