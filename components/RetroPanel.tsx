/**
 * Retro-kö: öppna ärenden per tier. Tier-strukturen är fast (mall); antalen läses ur
 * retro-inbox.md som inte produceras än → "—" per tier, ingen fabricerad siffra.
 */
const TIERS: { cls: string; txt: string }[] = [
  { cls: "t1", txt: "Tier 1 · före autopilot" },
  { cls: "t2", txt: "Tier 2 · quick wins" },
  { cls: "t3", txt: "Tier 3 · systemkärna" },
];

export default function RetroPanel() {
  return (
    <div className="panel">
      <h2>
        <span className="idx">04</span> Retro-kö{" "}
        <span className="hint">— vad väntar på dig</span>
      </h2>
      <div className="tier-list">
        {TIERS.map((t) => (
          <div className={`tier ${t.cls}`} key={t.cls}>
            <span className="t-badge">{t.cls.toUpperCase()}</span>
            <span className="t-txt">{t.txt}</span>
            <span className="t-count">—</span>
          </div>
        ))}
      </div>
      <div className="sys-note">Antal öppna läses ur <b>retro-inbox.md</b> (ej producerad än).</div>
    </div>
  );
}
