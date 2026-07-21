/**
 * Nortropic-märket + wordmark, exakt som prototypens .brand-block.
 * Server-komponent (ren markup, ingen interaktivitet).
 */
export default function BrandMark({ sub = "Nortropic · byggövervakning" }: { sub?: string }) {
  return (
    <div className="brand">
      <div className="mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <rect x="4" y="4" width="32" height="32" rx="9" stroke="#7c6cf0" strokeWidth="1.5" />
          <path
            d="M20 11 L20 29 M20 16 L15 13 M20 16 L25 13 M20 22 L14 19 M20 22 L26 19"
            stroke="#9d8fff"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div>
        <h1>Verkstadsgolvet</h1>
        <div className="sub">{sub}</div>
      </div>
    </div>
  );
}
