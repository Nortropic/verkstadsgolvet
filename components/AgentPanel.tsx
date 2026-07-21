import Graceful from "./Graceful";

/**
 * Agent-inblick. Kräver agent-loggning (Z1) i Workflow-repot — finns inte än.
 * Graceful tills loggarna produceras; då listas agenter med arbetslogg
 * (beslut / källa→beslut / friktion / var förfina).
 */
export default function AgentPanel() {
  return (
    <div className="panel">
      <h2>
        <span className="idx">◆</span> Agenter{" "}
        <span className="hint">— arbetsloggar per agent</span>
      </h2>
      <Graceful
        title="Loggning ej aktiv än"
        hint="källa: agent-loggar (Z1) i Workflow-repot"
      >
        Agent-inblick kräver agent-loggning. När loggarna börjar produceras listas
        varje agent här med sin arbetslogg — beslut, källa→beslut, friktion och var
        du kan förfina.
      </Graceful>
    </div>
  );
}
