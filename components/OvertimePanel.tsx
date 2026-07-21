import Graceful from "./Graceful";

/**
 * Över tid: återkommande friktion per agent, aggregerat över FLERA kund-byggen.
 * Kräver agent-loggar (Z1) över flera byggen — inga än → graceful.
 */
export default function OvertimePanel() {
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h2>
        <span className="idx">◆</span> Över tid{" "}
        <span className="hint">— återkommande friktion per agent (det du faktiskt kan förbättra)</span>
      </h2>
      <Graceful
        title="Inga byggen att aggregera än"
        hint="källa: agent-loggar (Z1) över flera kund-byggen"
      >
        När flera kund-byggen körts summeras varje agents återkommande friktion här
        (staplar per agent) — det ger dig det som är värt att förbättra i systemet.
      </Graceful>
    </div>
  );
}
