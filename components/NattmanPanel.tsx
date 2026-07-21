import Graceful from "./Graceful";

/**
 * Nattmannen (SÄKERHETSKRITISK): AUTOPILOT-status, senaste N2-ändring, zon, eval-stöd.
 * Data ur AUTO-DIGEST.md. Vi PÅSTÅR aldrig en status vi inte läst (t.ex. "AUTOPILOT=off")
 * — det vore att gissa om ett säkerhetsläge. Graceful tills AUTO-DIGEST.md finns.
 */
export default function NattmanPanel() {
  return (
    <div className="panel">
      <h2>
        <span className="idx">05</span> Nattmannen{" "}
        <span className="hint">— autonom självförbättring</span>
      </h2>
      <Graceful
        title="Status ej inläst"
        hint="källa: AUTO-DIGEST.md (ej producerad än)"
      >
        AUTOPILOT-status, senaste N2-ändring, zon och eval-stöd visas här när
        AUTO-DIGEST.md produceras. Misevolution-vakten: om systemet driftar syns det
        här först. Ingen status gissas.
      </Graceful>
    </div>
  );
}
