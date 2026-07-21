import TopBar from "@/components/TopBar";
import ProcessGuide from "@/components/ProcessGuide";
import AgentPanel from "@/components/AgentPanel";
import DocPanel from "@/components/DocPanel";
import PipelinePanel from "@/components/PipelinePanel";
import MetricsPanel from "@/components/MetricsPanel";
import DoctorPanel from "@/components/DoctorPanel";
import RetroPanel from "@/components/RetroPanel";
import NattmanPanel from "@/components/NattmanPanel";
import SystemMapPanel from "@/components/SystemMapPanel";
import EffektPanel from "@/components/EffektPanel";
import OvertimePanel from "@/components/OvertimePanel";

/**
 * Dashboard — full prototyp-layout. Middleware skyddar routen (inloggad = når hit).
 * Läs-only. Dokumentnavigering läser RIKTIG GitHub-data; övriga paneler visar ärliga
 * graceful-lägen tills deras källfiler produceras (agent-loggar, doctor-output,
 * retro-inbox, AUTO-DIGEST, Graphify). Ingen fabricerad data.
 */
export default function Dashboard() {
  return (
    <>
      <TopBar />

      <ProcessGuide />

      <div className="grid">
        <AgentPanel />
        <DocPanel />
      </div>

      <div className="bottom">
        <PipelinePanel />
        <MetricsPanel />
      </div>

      <div className="sysrow">
        <DoctorPanel />
        <RetroPanel />
        <NattmanPanel />
      </div>

      <div className="sysmap-row">
        <SystemMapPanel />
        <EffektPanel />
      </div>

      <OvertimePanel />

      <div className="foot">
        läser <b>{process.env.WORKFLOW_REPO ?? "Workflow-repo"}</b> · <b>kund-*</b> ·{" "}
        <b>läs-only</b>
      </div>
    </>
  );
}
