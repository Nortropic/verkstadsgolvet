"use client";

import { useMemo, useState } from "react";
import { toRepoName } from "@/lib/slug";

/**
 * Onboarding-formulär (Fas A). Fälten matchar PROMPT-RESEARCH INDATA-blocket.
 * Detta skal gör INGA anrop — det skrivande/AI-steget (Fas B) wiras separat efter
 * Johnnys go-ahead. När ONBOARDING_ENABLED=false visas en tydlig avstängd-banner.
 */
export default function OnboardingForm({ enabled }: { enabled: boolean }) {
  const [kundnamn, setKundnamn] = useState("");
  const [formularsvar, setFormularsvar] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [hemsida, setHemsida] = useState("");
  const [branschOrt, setBranschOrt] = useState("");
  const [kanaler, setKanaler] = useState("");

  const repoName = useMemo(() => toRepoName(kundnamn), [kundnamn]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Fas A: inget anrop görs. Fas B wirar research (Claude) → skapa privat repo → push.
  }

  return (
    <>
      {enabled ? (
        <div className="onb-banner on">
          <div className="b-title">Onboarding aktiverad</div>
          Det skrivande flödet är påslaget. När Fas B är wirad kör detta research via
          Claude, skapar ett <b>privat</b> kund-repo och pushar research.md — och{" "}
          <b>stannar där</b> för din granskning. Aldrig ett bygge.
        </div>
      ) : (
        <div className="onb-banner">
          <div className="b-title">Avstängd · förhandsvisning</div>
          <b>ONBOARDING_ENABLED=false.</b> Detta är bara formulär-skalet — ingenting
          skickas, inga Claude-anrop görs, inga repon skapas. Det skrivande/AI-steget
          (Fas B) wiras efter ditt uttryckliga go-ahead.
        </div>
      )}

      <form className="form-grid" onSubmit={onSubmit}>
        <div className="form-field">
          <label htmlFor="kundnamn">Kundnamn <span className="req">*</span></label>
          <input id="kundnamn" value={kundnamn} onChange={(e) => setKundnamn(e.target.value)} placeholder="t.ex. Fanérverket" />
          <div className="slug-preview">
            repo: <b>{repoName || "kund-…"}</b> · privat vid skapande (hårdkodat)
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="formularsvar">Kundens formulärsvar <span className="req">*</span></label>
          <textarea id="formularsvar" value={formularsvar} onChange={(e) => setFormularsvar(e.target.value)} placeholder="Klistra in allt kunden uppgett…" />
        </div>

        <div className="form-field">
          <label htmlFor="branschOrt">Bransch + huvudort <span className="req">*</span></label>
          <input id="branschOrt" value={branschOrt} onChange={(e) => setBranschOrt(e.target.value)} placeholder="t.ex. snickeri, Luleå" />
        </div>

        <div className="form-field">
          <label htmlFor="kanaler">Bokning/kontaktkanaler i dag</label>
          <input id="kanaler" value={kanaler} onChange={(e) => setKanaler(e.target.value)} placeholder="t.ex. telefon + Instagram-DM" />
        </div>

        <div className="form-field">
          <label htmlFor="facebook">Facebook-sida</label>
          <input id="facebook" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="URL eller lämna tomt" />
        </div>

        <div className="form-field">
          <label htmlFor="instagram">Instagram</label>
          <input id="instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="URL eller lämna tomt" />
        </div>

        <div className="form-field">
          <label htmlFor="hemsida">Befintlig hemsida</label>
          <input id="hemsida" value={hemsida} onChange={(e) => setHemsida(e.target.value)} placeholder="URL eller lämna tomt" />
        </div>

        <button className="onb-submit" type="submit" disabled title="Wiras i Fas B efter go-ahead">
          Starta research (wiras i Fas B)
        </button>
        <div className="onb-status">
          Flödet slutar alltid vid <b>&quot;research.md klar för granskning&quot;</b> — det finns ingen
          &quot;starta bygget&quot;-knapp, och kund-repot skapas alltid privat.
        </div>
      </form>
    </>
  );
}
