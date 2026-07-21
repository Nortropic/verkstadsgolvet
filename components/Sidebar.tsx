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
        <Link href="/onboarding" className={`nav-item${isActive("/onboarding") ? " active" : ""}`}>
          <span className="nav-ic">{I.nykund}</span> Ny kund
        </Link>
      </nav>

      <div className="account">
        <div className="status-pill">
          <span className="live-dot" />
          <span>läs-only</span>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
