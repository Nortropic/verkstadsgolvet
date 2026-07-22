import PageHeader from "@/components/PageHeader";

/** Scaffold — Fas 4 fyller detta med kvalificeringstabell + detaljvy. */
export default function LeadsListaPage() {
  return (
    <>
      <PageHeader
        title="Kvalificering"
        sub="Sorterbar tabell på score + detaljvy som bedömningsverktyg (mål <2 min/lead)"
      />
      <div className="panel" style={{ maxWidth: 720 }}>
        <h2>
          <span className="idx">◆</span> Byggs — Fas 4
        </h2>
        <p style={{ color: "var(--text-muted)", marginTop: 10, lineHeight: 1.65 }}>
          Tabell sorterad på score, filtrerbar på status/bransch/ort. Klick → detaljvy med
          score-uppdelning per signal, direktlänkar (GBP · FB · IG · Google) och snabbknappar
          för manuell bedömning: bildmaterial, ägaren svarar på recensioner, FB/IG-aktivitet,
          samt kvalificera / diskvalificera / senare. &quot;Nästa lead&quot;-knapp för att beta
          av i rad.
        </p>
      </div>
    </>
  );
}
