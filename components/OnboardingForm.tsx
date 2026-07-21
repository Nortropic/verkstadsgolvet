"use client";

import { useMemo, useState } from "react";
import { toRepoName } from "@/lib/slug";
import { buildResearchPrompt, type OnboardingInput } from "@/lib/prompt-research";

/**
 * Onboarding-formulär (Fas B, variant A). Appen anropar INTE Claude.
 * Flöde:
 *  1. Fyll i kunduppgifter → formuläret genererar en färdig research-prompt.
 *  2. "Kopiera prompt" → klistra in i Claude-i-browsern (med kundens socials öppna)
 *     → kör → få research.md (+ bild-URL:er).
 *  3. Klistra in research.md → "Skapa privat kund-repo & pusha" → STOPP för granskning.
 * Enda skrivande anropet (repo-skapande) gatas av ONBOARDING_ENABLED.
 */

type CreateResp =
  | { ok: true; repo: string; url: string }
  | { ok: false; reason: string; message: string };

export default function OnboardingForm({ enabled }: { enabled: boolean }) {
  const [kundnamn, setKundnamn] = useState("");
  const [formularsvar, setFormularsvar] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [hemsida, setHemsida] = useState("");
  const [branschOrt, setBranschOrt] = useState("");
  const [kanaler, setKanaler] = useState("");

  const [research, setResearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ repo: string; url: string } | null>(null);

  const input: OnboardingInput = {
    kundnamn,
    formularsvar,
    facebook,
    instagram,
    hemsida,
    branschOrt,
    kanaler,
  };
  const repoName = useMemo(() => toRepoName(kundnamn), [kundnamn]);
  const prompt = useMemo(
    () => buildResearchPrompt(input),
    [kundnamn, formularsvar, facebook, instagram, hemsida, branschOrt, kanaler]
  );

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Kunde inte kopiera automatiskt — markera texten och kopiera manuellt.");
    }
  }

  async function createRepo() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ kundnamn, research }),
      });
      const data = (await r.json()) as CreateResp;
      if (!data.ok) {
        setError(data.message);
        return;
      }
      setResult({ repo: data.repo, url: data.url });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="onb-banner on">
        <div className="b-title">✓ Klart för granskning</div>
        research.md pushad till <b>{result.repo}</b> (privat).{" "}
        <a href={result.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent-text)" }}>
          Öppna repot →
        </a>
        <div style={{ marginTop: 8 }}>
          Granska research.md ([OSÄKER]-flaggor + kontrollrad), starta sedan bygget själv i
          Claude Code. Flödet slutar här — ingen &quot;starta bygget&quot;-knapp.
        </div>
      </div>
    );
  }

  return (
    <>
      {enabled ? (
        <div className="onb-banner on">
          <div className="b-title">Onboarding aktiverad</div>
          Fyll i uppgifterna → kopiera prompten till Claude-i-browsern (läs kundens socials
          där) → klistra tillbaka research.md → appen skapar ett <b>privat</b> kund-repo och
          pushar. <b>Stannar där</b> för din granskning. Aldrig ett bygge.
        </div>
      ) : (
        <div className="onb-banner">
          <div className="b-title">Avstängd</div>
          <b>ONBOARDING_ENABLED=false.</b> Du kan förbereda prompten nedan, men
          repo-skapandet är avstängt. Slå på flaggan i Railway för att aktivera.
        </div>
      )}

      <div className="form-grid">
        {/* Kunduppgifter */}
        <div className="form-field">
          <label htmlFor="kundnamn">Kundnamn <span className="req">*</span></label>
          <input id="kundnamn" value={kundnamn} onChange={(e) => setKundnamn(e.target.value)} placeholder="t.ex. Fanérverket" />
          <div className="slug-preview">repo: <b>{repoName || "kund-…"}</b> · privat vid skapande (hårdkodat)</div>
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
          <input id="facebook" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="URL eller saknas" />
        </div>
        <div className="form-field">
          <label htmlFor="instagram">Instagram</label>
          <input id="instagram" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="URL eller saknas" />
        </div>
        <div className="form-field">
          <label htmlFor="hemsida">Befintlig hemsida</label>
          <input id="hemsida" value={hemsida} onChange={(e) => setHemsida(e.target.value)} placeholder="URL eller saknas" />
        </div>

        {/* Steg 1: kopiera prompt */}
        <div className="onb-step">
          <div className="onb-step-head">
            <span>Steg 1 · Kopiera prompten till Claude-i-browsern</span>
            <button type="button" className="copy-btn" onClick={copyPrompt}>
              {copied ? "✓ Kopierad" : "Kopiera prompt"}
            </button>
          </div>
          <textarea className="prompt-box" readOnly value={prompt} onFocus={(e) => e.currentTarget.select()} />
          <div className="onb-status">
            Öppna kundens FB/IG/sajt i webbläsaren, klistra in prompten i Claude, kör.
            Claude läser (read-only) och producerar research.md + bild-URL:er.
          </div>
        </div>

        {/* Steg 2: klistra in research.md */}
        <div className="form-field">
          <label htmlFor="research">Steg 2 · Klistra in research.md <span className="req">*</span></label>
          <textarea id="research" value={research} onChange={(e) => setResearch(e.target.value)} placeholder="Klistra in det Claude-i-browsern producerade…" style={{ minHeight: 260, fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6 }} />
        </div>

        {/* Steg 3: skapa */}
        <button
          type="button"
          className="onb-submit"
          disabled={!enabled || loading || !kundnamn.trim() || !research.trim()}
          onClick={createRepo}
        >
          {loading ? "Skapar repo & pushar…" : `Steg 3 · Skapa privat ${repoName || "kund-…"} & pusha research.md`}
        </button>

        {error && <div className="onb-status" style={{ color: "var(--danger-text)" }}>Fel: {error}</div>}

        <div className="onb-status">
          Flödet slutar alltid vid <b>&quot;research.md klar för granskning&quot;</b> — ingen
          &quot;starta bygget&quot;-knapp, och kund-repot skapas alltid privat.
        </div>
      </div>
    </>
  );
}
