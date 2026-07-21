import TopBar from "@/components/TopBar";
import DocPanel from "@/components/DocPanel";

/**
 * Dashboard. Middleware skyddar routen (inloggad = når hit). Läs-only.
 *
 * Steg 3–4: Dokumentnavigering är kopplad till RIKTIG GitHub-data (bevisar
 * läs-arkitekturen server→/api→klient). Övriga paneler byggs i steg 5 och visar
 * tills dess graceful "ej aktiv än"-lägen eftersom deras källfiler (agent-loggar,
 * doctor-output, retro-inbox, AUTO-DIGEST, Graphify) inte finns än.
 */
export default function Dashboard() {
  return (
    <>
      <TopBar />

      <div className="grid">
        {/* Agenter — kräver Z1 agent-loggning som inte finns än */}
        <div className="panel">
          <h2>
            <span className="idx">◆</span> Agenter{" "}
            <span className="hint">— arbetsloggar per agent</span>
          </h2>
          <div className="state">
            <div className="st-title">Loggning ej aktiv än</div>
            Agent-inblick kräver agent-loggning (Z1) i Workflow-repot. När loggarna
            börjar produceras fylls den här panelen automatiskt.
          </div>
        </div>

        {/* Dokumentation — RIKTIG data */}
        <DocPanel />
      </div>
    </>
  );
}
