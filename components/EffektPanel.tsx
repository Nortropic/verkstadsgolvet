/**
 * Effekt: token-besparing (data ur Graphify → "—" tills grafen finns) + kritiker-loopen
 * (konceptuell, fast diagram — ingen data att fabricera, så den renderas som prototypen).
 */
const LOOP = ["Exekvera", "Utvärdera", "Reflektera", "Minnas", "Optimera"];

export default function EffektPanel() {
  return (
    <div className="panel">
      <h2>
        <span className="idx">◆</span> Effekt{" "}
        <span className="hint">— vad grafen sparar</span>
      </h2>
      <div className="savings">
        <div className="sav-big">—</div>
        <div className="sav-sub">token/session sparade · behöver graf</div>
      </div>
      <div className="loop-viz">
        <div className="loop-label">Kritiker-loop · self-improving</div>
        <div className="loop-steps">
          {LOOP.map((s, i) => (
            <span key={s} style={{ display: "contents" }}>
              <div className={`loop-step${s === "Reflektera" ? " hl" : ""}`}>{s}</div>
              {i < LOOP.length - 1 && <span className="loop-arr">→</span>}
            </span>
          ))}
        </div>
        <div className="loop-note">
          Evaluator-optimizer: granskaren dömer med skills byggaren aldrig såg.
          Reflektera = Z-loggar. Minnas = lessons.md (§A-grindad).
        </div>
      </div>
    </div>
  );
}
