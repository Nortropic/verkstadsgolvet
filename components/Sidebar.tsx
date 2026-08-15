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
  integrationer: (
    <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  leads: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M2.5 3.5H13.5L8.7 8.5V12.5H7.3V8.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
  ),
  /* YouTube-loggan i sina egna varumärkesfärger (röd platta + vit play-triangel),
     till skillnad från de monokroma linje-ikonerna ovan — så den läses som just YouTube. */
  youtube: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8Z" fill="#FF0000" /><path d="M9.6 15.5 15.8 12 9.6 8.5v7Z" fill="#fff" /></svg>
  ),
  /* Hästskomagnet — "attrahera leads", visuellt skild från trattikonen (I.leads). */
  leadscraper: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M4 2.5v4.5a4 4 0 0 0 8 0V2.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M2.5 2.5h3M10.5 2.5h3M2.5 5.5h3M10.5 5.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
  ),
  /* Kartongförstöraren — lådan på toppen, inmatningsspringan och remsorna som kommer ut.
     Egen form bland linje-ikonerna: ingen annan post i navigeringen är en maskin man matar. */
  kartong: (
    <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><rect x="3.2" y="1.8" width="9.6" height="3.6" rx="1" stroke="currentColor" strokeWidth="1.4" /><rect x="1.6" y="6.2" width="12.8" height="3" rx="1" stroke="currentColor" strokeWidth="1.4" /><path d="M4.4 11v3M8 11v3.5M11.6 11v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
  ),
  /* Uthoppspil för externa länkar (öppnas i ny flik). */
  extlink: (
    <svg viewBox="0 0 16 16" fill="none" width="13" height="13"><path d="M6 3.5H4A1.5 1.5 0 0 0 2.5 5v7A1.5 1.5 0 0 0 4 13.5h7A1.5 1.5 0 0 0 12.5 12v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M9 2.5h4.5V7M13.2 2.8 7.5 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
};

const HEALTH = [
  { href: "/systemhalsa/doktorn", label: "Doktorn" },
  { href: "/systemhalsa/retro", label: "Retro" },
  { href: "/systemhalsa/nattmannen", label: "Nattmannen" },
];

const LEADS = [
  { href: "/leads/insamling", label: "Insamling" },
  { href: "/leads/lista", label: "Kvalificering" },
  { href: "/leads/arbetsvy", label: "Arbetsvy" },
  { href: "/leads/kalibrering", label: "Kalibrering" },
];

/**
 * NAVIGERINGSPOSTENS MÅTT I DEN SMALA REMSAN.
 *
 * `.nav-item` bär i app/globals.css full bredd OCH dold overflow. Vid smala vyer blir
 * `.sidebar-nav` en RAD, och då gäller två flexregler samtidigt: basbredden blir hela radens,
 * och en post med annan overflow än synlig får automatisk minimistorlek noll. Posterna krymper
 * därför mot noll bredd, och sidomenyns egen sidled-scroll bläddrar förbi osynliga länkar i
 * stället för att visa dem.
 *
 * Måttet ger varje post sin innehållsbredd, vilket är precis vad den horisontella scrollen behöver.
 *
 * DET GÄLLER ALLA POSTER, INTE BARA DEN NYA — OCH DET ÄR SKÄLET TILL ATT DET LIGGER HÄR.
 * Att immunisera en enda post hade gett den full bredd och lämnat de övriga MINDRE restbredd än
 * före ändringen: en post blir nåbar genom att tio blir sämre. Konstanten delas därför av samtliga
 * poster. Det är en storleksegenskap per post, inte en omstrukturering av menyn: ordning, klasser,
 * ikoner och mål är oförändrade.
 *
 * «ALLA POSTER» BETYDER OCKSÅ GRUPPERNAS KNAPPAR, INTE BARA LÄNKARNA.
 * Leads och Systemhälsa är `<button className="nav-item">`, inte `<Link>` — men de bär samma
 * klass, samma mått och samma navigering (de gör `router.push` när de fälls ut). Lämnas de utan
 * måttet blir de de ENDA flexbarn som får krympa, och då absorberar de HELA det negativa
 * utrymmet i remsan och klämts till noll bredd: två nåbara poster försvinner för att de andra
 * immuniserades. Regeln är alltså «varje element med klassen nav-item», aldrig «varje länk».
 *
 * DEN RIKTIGA FIXEN LIGGER I STILARKET, som den här skivan inte äger: full bredd hör inte hemma i
 * radläget alls. Tills en skiva som äger app/globals.css tar bort den bär posterna sitt mått själva.
 */
const NAV_ITEM_ROW_FIT = { flex: "none", width: "auto" } as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const inHealth = pathname.startsWith("/systemhalsa");
  const [open, setOpen] = useState(inHealth);
  useEffect(() => {
    if (inHealth) setOpen(true);
  }, [inHealth]);

  const inLeads = pathname.startsWith("/leads");
  const [openLeads, setOpenLeads] = useState(inLeads);
  useEffect(() => {
    if (inLeads) setOpenLeads(true);
  }, [inLeads]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href;

  /**
   * SEKTIONENS ROT **OCH** DESS UNDERSIDOR.
   *
   * `isActive` är exakt-matchning och släcks därför på en undersida — riktigt för de poster som
   * ÄR en sida. Kartongförstöraren är en sektion: /loop och /loop/mata är samma produkt, och
   * navigeringen får inte se ut som att man lämnat den när man står i inlämningen. Samma
   * mekanism som grupperna ovan redan använder (`pathname.startsWith`), men med
   * snedstrecket utskrivet så att ett framtida "/loopa" aldrig kan tändas av misstag.
   */
  const inSection = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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

        {/* Kartongförstöraren — produktens ingång för arbete. Står direkt under "Ny kund" och
            före Översikt: det är den yta man kommer hit för att använda, inte en undersida i en
            rapport. Aktiv även på /loop/**, eftersom inlämningen är samma produkt. */}
        <Link
          href="/loop"
          className={`nav-item${inSection("/loop") ? " active" : ""}`}
          data-nav-loop="true"
          style={NAV_ITEM_ROW_FIT}
        >
          <span className="nav-ic">{I.kartong}</span> Kartongförstöraren
        </Link>

        <Link href="/" className={`nav-item${isActive("/") ? " active" : ""}`} style={NAV_ITEM_ROW_FIT}>
          <span className="nav-ic">{I.oversikt}</span> Översikt
        </Link>
        <Link href="/agenter" className={`nav-item${isActive("/agenter") ? " active" : ""}`} style={NAV_ITEM_ROW_FIT}>
          <span className="nav-ic">{I.agenter}</span> Agenter
        </Link>
        <Link href="/dokument" className={`nav-item${isActive("/dokument") ? " active" : ""}`} style={NAV_ITEM_ROW_FIT}>
          <span className="nav-ic">{I.dokument}</span> Dokument
        </Link>
        <Link href="/youtube-research" className={`nav-item${isActive("/youtube-research") ? " active" : ""}`} style={NAV_ITEM_ROW_FIT}>
          <span className="nav-ic">{I.youtube}</span> YouTube research
        </Link>

        {/* Leads — nästad grupp (samma mönster som Systemhälsa). Parent togglar +
            navigerar till /leads (→ redirect till /leads/lista) vid expansion. */}
        <div className="nav-group">
          <button
            type="button"
            className={`nav-item${inLeads ? " active" : ""}`}
            style={NAV_ITEM_ROW_FIT}
            aria-expanded={openLeads}
            onClick={() =>
              setOpenLeads((o) => {
                const next = !o;
                if (next) router.push("/leads");
                return next;
              })
            }
          >
            <span className="nav-ic">{I.leads}</span> Leads
            <span className={`nav-caret${openLeads ? " open" : ""}`} aria-hidden="true">
              <svg viewBox="0 0 12 12" width="12" height="12" fill="none"><path d="M4 2.5 7.5 6 4 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </button>
          {openLeads && (
            <div className="nav-sub">
              {LEADS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`nav-item${isActive(l.href) ? " active" : ""}`}
                  style={NAV_ITEM_ROW_FIT}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Systemhälsa — nästad grupp. Parent = knapp (togglar + navigerar till översikt
            vid expansion). Caret är en icke-interaktiv span → giltig HTML, ingen a>button. */}
        <div className="nav-group">
          <button
            type="button"
            className={`nav-item${inHealth ? " active" : ""}`}
            style={NAV_ITEM_ROW_FIT}
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
                <Link
                  key={h.href}
                  href={h.href}
                  className={`nav-item${isActive(h.href) ? " active" : ""}`}
                  style={NAV_ITEM_ROW_FIT}
                >
                  {h.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link href="/systemkarta" className={`nav-item${isActive("/systemkarta") ? " active" : ""}`} style={NAV_ITEM_ROW_FIT}>
          <span className="nav-ic">{I.karta}</span> Systemkarta
        </Link>
        <Link href="/gbp" className={`nav-item${isActive("/gbp") ? " active" : ""}`} style={NAV_ITEM_ROW_FIT}>
          <span className="nav-ic">{I.gbp}</span> Google Business Profile
        </Link>
        <Link href="/statistik" className={`nav-item${isActive("/statistik") ? " active" : ""}`} style={NAV_ITEM_ROW_FIT}>
          <span className="nav-ic">{I.statistik}</span> Cookies, GDPR & statistik
        </Link>
        <Link href="/marknadsforing" className={`nav-item${isActive("/marknadsforing") ? " active" : ""}`} style={NAV_ITEM_ROW_FIT}>
          <span className="nav-ic">{I.marknad}</span> Marknadsföring
        </Link>
        <Link href="/integrationer" className={`nav-item${isActive("/integrationer") ? " active" : ""}`} style={NAV_ITEM_ROW_FIT}>
          <span className="nav-ic">{I.integrationer}</span> Integrationer
        </Link>
        <Link href="/framtiden" className={`nav-item${isActive("/framtiden") ? " active" : ""}`} style={NAV_ITEM_ROW_FIT}>
          <span className="nav-ic">{I.framtiden}</span> Framtiden
        </Link>
      </nav>

      <div className="account">
        <LogoutButton />
      </div>
    </aside>
  );
}
