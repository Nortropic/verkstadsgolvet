/**
 * Nyckeltal. Ärliga "—" tills data finns (eval-poäng, tokens, grindar, öppna fynd
 * kommer ur bygg-/granskningsdata i kund-repot + Workflow-repot). Aldrig fejkade tal.
 */
const METRICS: { lbl: string; val: string; unit?: string }[] = [
  { lbl: "Eval-poäng", val: "—" },
  { lbl: "Tokens", val: "—" },
  { lbl: "Grindar", val: "—" },
  { lbl: "Fynd öppna", val: "—" },
];

export default function MetricsPanel() {
  return (
    <div className="panel">
      <h2>
        <span className="idx">02</span> Nyckeltal{" "}
        <span className="hint">— fylls från bygg- &amp; granskningsdata</span>
      </h2>
      <div className="metrics">
        {METRICS.map((m) => (
          <div className="metric" key={m.lbl}>
            <div className="m-val">{m.val}</div>
            <div className="m-lbl">{m.lbl}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
