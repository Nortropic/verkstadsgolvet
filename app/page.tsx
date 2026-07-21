import BrandMark from "@/components/BrandMark";
import LogoutButton from "@/components/LogoutButton";

/**
 * Dashboard-skelett (steg 1). Middleware skyddar denna route — når man hit är
 * man inloggad. Datapanelerna (agenter, dokument, doktorn, retro, nattman,
 * systemkarta, över-tid) kopplas in i steg 3–5 mot riktig GitHub-data, var och
 * en med graceful "ej aktiv än"-läge. Allt är läs-only.
 */
export default function Dashboard() {
  return (
    <>
      <div className="top">
        <BrandMark />
        <div className="controls">
          <div className="status-pill">
            <span className="live-dot" />
            <span>skelett · auth aktiv</span>
          </div>
          <LogoutButton />
        </div>
      </div>

      <div className="panel">
        <h2>
          <span className="idx">◆</span> Verkstadsgolvet <span className="hint">— skelett</span>
        </h2>
        <div className="state">
          <div className="st-title">Steg 1 klart</div>
          Skelettet är rest och appen är lösenordsskyddad från första deploy.
          Datapanelerna kopplas in när <b>GITHUB_OWNER</b> + <b>WORKFLOW_REPO</b> är
          satta och läs-token (<b>GITHUB_TOKEN_READ</b>) finns i Railways env.
          <div className="st-hint">läs-only · inga writes · token endast server-side</div>
        </div>
      </div>
    </>
  );
}
