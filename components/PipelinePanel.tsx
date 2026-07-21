import Graceful from "./Graceful";

/**
 * Löpande band: pipeline-noder + grindar. Nodernas SEKVENS är fast (mall) och visas
 * i idle-läge; live-status (vilken nod kör, grind-utfall) läses ur AUTOBYGG-LOG.md
 * som inte produceras än → not nedanför. Inga fejkade utfall.
 */
const NODES = ["Research", "Plan", "Bygge", "Text", "Gransk", "SEO", "Grind", "Slut"];

export default function PipelinePanel() {
  return (
    <div className="panel">
      <h2>
        <span className="idx">01</span> Löpande band{" "}
        <span className="hint">— pipeline-läge</span>
      </h2>
      <div className="mini-pipe">
        {NODES.map((n, i) => (
          <div className="mini-node" key={i}>
            <div className="mn-n">{i + 1}</div>
            <div className="mn-l">{n}</div>
          </div>
        ))}
      </div>
      <div className="gates" style={{ marginTop: 12 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div className="gate" key={i}>
            <div className="g-ic" />
          </div>
        ))}
      </div>
      <div className="sys-note" style={{ marginTop: 12 }}>
        Idle — live-läge (aktiv nod, grind-utfall) läses ur <b>AUTOBYGG-LOG.md</b>{" "}
        när ett bygge körs.
      </div>
    </div>
  );
}
