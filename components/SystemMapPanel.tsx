import Graceful from "./Graceful";

/**
 * Systemkarta (Graphify). Map confidence + nav-filer (god nodes) läses ur
 * graphify-out/ (GRAPH_REPORT.md, graph.json). Detta är den enda källan som kanske
 * inte finns dag 1 (spec) → graceful "graf ej byggd än".
 */
export default function SystemMapPanel() {
  return (
    <div className="panel">
      <h2>
        <span className="idx">◆</span> Systemkarta{" "}
        <span className="hint">— delad graf (Graphify)</span>
      </h2>
      <Graceful
        title="Graf ej byggd än"
        hint="källa: graphify-out/ (GRAPH_REPORT.md, graph.json)"
      >
        Map confidence (found/inferred) och systemets nav-filer (god nodes) visas här
        när Graphify-output finns. Högre &quot;found&quot; = mer av kartan är verifierat
        faktum, inte gissning.
      </Graceful>
    </div>
  );
}
