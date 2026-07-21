import Link from "next/link";
import BrandMark from "./BrandMark";
import LogoutButton from "./LogoutButton";

/**
 * Topbar: klickbart märke (→ dashboard) + status-pill + nav till onboarding + logga ut.
 * `status` är avsiktligt ärlig per vy — dashboarden är "läs-only", onboarding är inte det.
 */
export default function TopBar({ status = "läs-only" }: { status?: string }) {
  return (
    <div className="top">
      <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
        <BrandMark />
      </Link>
      <div className="controls">
        <div className="status-pill">
          <span className="live-dot" />
          <span>{status}</span>
        </div>
        <Link className="navlink" href="/onboarding">
          ＋ Ny kund
        </Link>
        <LogoutButton />
      </div>
    </div>
  );
}
