/**
 * Processvägledning (topp-strip). De 8 stegen är den fasta arbetsgången (spec),
 * inte data — så de renderas som mall. Live-spårning av "var är bygget / nästa steg"
 * kräver ett kund-bygge (research.md / pipeline-data), vilket inte finns än → neutralt
 * läge + not. När onboarding kört blir steg 1–2 gjorda av flödet och Johnny börjar på 3.
 */
const STEPS = [
  { name: "Skapa research.md", who: "DU" },
  { name: "Skapa privat kund-repo", who: "DU" },
  { name: "Kör pipelinen", who: "DU" },
  { name: "Godkänn planen", who: "DU · nod 3" },
  { name: "Granska bygget", who: "DU" },
  { name: "Signera lansering", who: "DU · nod 8" },
  { name: "Fyll launch-fakta", who: "DU" },
  { name: "Cutover till live", who: "DU" },
];

export default function ProcessGuide() {
  return (
    <div className="process">
      <div className="process-head">
        <h2>Din process · steg för steg</h2>
        <div className="next-badge">Nästa: starta ett kund-bygge</div>
      </div>
      <div className="steps">
        {STEPS.map((s, i) => (
          <div className="step" key={i}>
            <div className="s-num">{i + 1}</div>
            <div className="s-name">{s.name}</div>
            <div className="s-who you">{s.who}</div>
          </div>
        ))}
      </div>
      <div className="sys-note" style={{ marginTop: 12 }}>
        Läges-spårning per kund-bygge aktiveras när ett <b>kund-repo</b> finns —
        stegen fylls då från research.md / pipeline-noderna.
      </div>
    </div>
  );
}
