/**
 * Doktorn: 12-kontroll-rutnät. Idle tills doctor-output produceras i Workflow-repot.
 * VIKTIGT (spec): "kunde-ej-köras" (idle/blind) är SKILT från grön — en blind kontroll
 * har inte passerat, den sågs bara inte. Här är alla idle eftersom ingen körning finns.
 */
export default function DoctorPanel() {
  return (
    <div className="panel">
      <h2>
        <span className="idx">03</span> Doktorn{" "}
        <span className="hint">— systemets hälsa</span>
      </h2>
      <div className="doc-grid">
        {Array.from({ length: 12 }).map((_, i) => (
          <div className="dc" key={i}>
            #{i + 1}
          </div>
        ))}
      </div>
      <div className="sys-note">
        Ingen körning inläst — 12 kontroller <b>idle</b>. Läses ur doctor-output i
        Workflow-repot. <span className="b">Idle ≠ grön: vakten har inte passerat, den har inte körts.</span>
      </div>
    </div>
  );
}
