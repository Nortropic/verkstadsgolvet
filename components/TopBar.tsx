import BrandMark from "./BrandMark";
import LogoutButton from "./LogoutButton";

/**
 * Topbar: märke + status-pill + logga ut. Server-komponent; LogoutButton är
 * klient. Status-pillen är avsiktligt ärlig — "läs-only", ingen realtids-påstående.
 */
export default function TopBar() {
  return (
    <div className="top">
      <BrandMark />
      <div className="controls">
        <div className="status-pill">
          <span className="live-dot" />
          <span>läs-only</span>
        </div>
        <LogoutButton />
      </div>
    </div>
  );
}
