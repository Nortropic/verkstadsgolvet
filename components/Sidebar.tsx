"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import NortropicLogo from "./NortropicLogo";
import LogoutButton from "./LogoutButton";

/* enkla 16px linje-ikoner (stroke = currentColor) */
const I = {
  oversikt: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" /><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" /><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" /><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" /></svg>
  ),
  agenter: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="4" r="2.2" stroke="currentColor" strokeWidth="1.4" /><path d="M3 13c0-2.5 2.2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
  ),
  dokument: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M4 2h5l3 3v9H4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M9 2v3h3M6 8h4M6 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
  ),
  halsa: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M2 8h3l1.5-3 2 6 1.5-3H14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  karta: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="4" cy="4" r="1.8" stroke="currentColor" strokeWidth="1.4" /><circle cx="12" cy="5" r="1.8" stroke="currentColor" strokeWidth="1.4" /><circle cx="7" cy="12" r="1.8" stroke="currentColor" strokeWidth="1.4" /><path d="M5.5 4.6 10.3 4.9M5.2 5.6 6.3 10.4M8.5 11.3 10.7 6.6" stroke="currentColor" strokeWidth="1.3" /></svg>
  ),
  nykund: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" /><path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
  ),
  gbp: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M8 1.6c-2.4 0-4.3 1.9-4.3 4.3 0 3 4.3 7.5 4.3 7.5s4.3-4.5 4.3-7.5c0-2.4-1.9-4.3-4.3-4.3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><circle cx="8" cy="5.9" r="1.5" stroke="currentColor" strokeWidth="1.4" /></svg>
  ),
  marknad: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M2.5 6.3v3.4l6.5 2.3V4L2.5 6.3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M11 6c1 .7 1 3.3 0 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M4.5 9.5v2.2a1 1 0 0 0 2 .3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
  ),
  statistik: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M2.5 13h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><rect x="3.5" y="8" width="2.2" height="4" rx=".4" stroke="currentColor" strokeWidth="1.4" /><rect x="6.9" y="5" width="2.2" height="7" rx=".4" stroke="currentColor" strokeWidth="1.4" /><rect x="10.3" y="9.5" width="2.2" height="2.5" rx=".4" stroke="currentColor" strokeWidth="1.4" /></svg>
  ),
  framtiden: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M2 11.5h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M4.5 11.5a3.5 3.5 0 0 1 7 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M8 2.4v1.7M3.4 5.6l1.1 1.1M12.6 5.6l-1.1 1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
  ),
};

const HEALTH = [
  { href: "/systemhalsa/doktorn", label: "Doktorn" },
  { href: "/systemhalsa/retro", label: "Retro" },
  { href: "/systemhalsa/nattmannen", label: "Nattmannen" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const inHealth = pathname.startsWith("/systemhalsa");
  const [open, setOpen] = useState(inHealth);
  useEffect(() => {
    if (inHealth) setOpen(true);
  }, [inHealth]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Link href="/" aria-label="Nortropic — översikt">
          <NortropicLogo src="/nortropic-mark.png" />
        </Link>
      </div>

      <nav className="sidebar-nav">
        <Link href="/onboarding" className={`nav-cta${isActive("/onboarding") ? " active" : ""}`}>
          <span className="nav-cta-ic">
            <svg viewBox="0 0 16 16" fill="none" width="15" height="15"><circle cx="6.3" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5" /><path d="M2.3 13c0-2.4 1.9-3.9 4-3.9.5 0 1 .1 1.5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M11.6 8.6v4M9.6 10.6h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </span>
          <span className="nav-cta-label">Ny kund</span>
          <span className="nav-cta-arrow" aria-hidden="true">
            <svg viewBox="0 0 12 12" width="13" height="13" fill="none"><path d="M4 2.5 7.5 6 4 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </Link>

        <Link href="/" className={`nav-item${isActive("/") ? " active" : ""}`}>
          <span className="nav-ic">{I.oversikt}</span> Översikt
        </Link>
        <Link href="/agenter" className={`nav-item${isActive("/agenter") ? " active" : ""}`}>
          <span className="nav-ic">{I.agenter}</span> Agenter
        </Link>
        <Link href="/dokument" className={`nav-item${isActive("/dokument") ? " active" : ""}`}>
          <span className="nav-ic">{I.dokument}</span> Dokument
        </Link>

        {/* Systemhälsa — nästad grupp. Parent = knapp (togglar + navigerar till översikt
            vid expansion). Caret är en icke-interaktiv span → giltig HTML, ingen a>button. */}
        <div className="nav-group">
          <button
            type="button"
            className={`nav-item${inHealth ? " active" : ""}`}
            aria-expanded={open}
            onClick={() =>
              setOpen((o) => {
                const next = !o;
                if (next) router.push("/systemhalsa");
                return next;
              })
            }
          >
            <span className="nav-ic">{I.halsa}</span> Systemhälsa
            <span className={`nav-caret${open ? " open" : ""}`} aria-hidden="true">
              <svg viewBox="0 0 12 12" width="12" height="12" fill="none"><path d="M4 2.5 7.5 6 4 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </button>
          {open && (
            <div className="nav-sub">
              {HEALTH.map((h) => (
                <Link key={h.href} href={h.href} className={`nav-item${isActive(h.href) ? " active" : ""}`}>
                  {h.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link href="/systemkarta" className={`nav-item${isActive("/systemkarta") ? " active" : ""}`}>
          <span className="nav-ic">{I.karta}</span> Systemkarta
        </Link>
        <Link href="/gbp" className={`nav-item${isActive("/gbp") ? " active" : ""}`}>
          <span className="nav-ic">{I.gbp}</span> Google Business Profile
        </Link>
        <Link href="/statistik" className={`nav-item${isActive("/statistik") ? " active" : ""}`}>
          <span className="nav-ic">{I.statistik}</span> Cookies, GDPR & statistik
        </Link>
        <Link href="/marknadsforing" className={`nav-item${isActive("/marknadsforing") ? " active" : ""}`}>
          <span className="nav-ic">{I.marknad}</span> Marknadsföring
        </Link>
        <Link href="/framtiden" className={`nav-item${isActive("/framtiden") ? " active" : ""}`}>
          <span className="nav-ic">{I.framtiden}</span> Framtiden
        </Link>
      </nav>

      <div className="account">
        <LogoutButton />
      </div>
    </aside>
  );
}
