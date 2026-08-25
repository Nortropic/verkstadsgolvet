"use client";

import { useMemo, useState } from "react";
import { toRepoName } from "@/lib/slug";
import { buildResearchPrompt, type OnboardingInput, type VerifiedContract } from "@/lib/prompt-research";
import { lasProjektforstaelse, sammanfatta } from "@/lib/research-understanding";

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

export default function OnboardingForm({
  enabled,
  contract,
  tillgangligaPaket,
}: {
  enabled: boolean;
  /** Redan FAIL-CLOSED-verifierad på servern. Klienten komponerar aldrig utan den. */
  contract: VerifiedContract;
  /** Verifierade paketmoduler. Klienten kan välja bland dem — aldrig uppfinna en. */
  tillgangligaPaket: { pack: string; version: string; text: string }[];
}) {
  // S2: pakethypotesen är OPERATÖRSVÄND och ÖVERSTYRBAR. Default är core-only,
  // eftersom kontraktet säger att en ANTAGEN bransch aldrig aktiverar en modul.
  const [pakethypotes, setPakethypotes] = useState<string>("");
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
  const valtPaket = tillgangligaPaket.find((p) => p.pack === pakethypotes) ?? null;
  const aktivtKontrakt: VerifiedContract = { ...contract, pack: valtPaket };
  const prompt = useMemo(
    () => buildResearchPrompt(input, aktivtKontrakt),
    [kundnamn, formularsvar, facebook, instagram, hemsida, branschOrt, kanaler, contract, valtPaket]
  );
  const forstaelse = useMemo(() => lasProjektforstaelse(research), [research]);

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
        {/* S2 · Grupp 1 — ORGANISATIONEN */}
        <div className="onb-group">
          <h3 className="onb-group-title">1 · Organisationen</h3>
          <p className="onb-group-sub">Vilka de är. Motsvarar kontraktets sektion 1–2.</p>
        </div>
        <div className="form-field">
          <label htmlFor="kundnamn">Kundnamn <span className="req">*</span></label>
          <input id="kundnamn" value={kundnamn} onChange={(e) => setKundnamn(e.target.value)} placeholder="t.ex. Fanérverket" />
          <div className="slug-preview">repo: <b>{repoName || "kund-…"}</b> · privat vid skapande (hårdkodat)</div>
        </div>
        <div className="form-field">
          <label htmlFor="branschOrt">Bransch + huvudort <span className="req">*</span></label>
          <input id="branschOrt" value={branschOrt} onChange={(e) => setBranschOrt(e.target.value)} placeholder="t.ex. snickeri, Luleå" />
        </div>

        {/* S2 · Grupp 2 — VAD SAJTEN SKA ÅSTADKOMMA */}
        <div className="onb-group">
          <h3 className="onb-group-title">2 · Vad sajten ska åstadkomma</h3>
          <p className="onb-group-sub">Kundens egna ord om målet. Matar kontraktets sektion 4 och 14 (framgångsmått → Utfallshypotes).</p>
        </div>
        <div className="form-field">
          <label htmlFor="formularsvar">Kundens formulärsvar <span className="req">*</span></label>
          <textarea id="formularsvar" value={formularsvar} onChange={(e) => setFormularsvar(e.target.value)} placeholder="Klistra in allt kunden uppgett…" />
        </div>

        {/* S2 · Grupp 3 — VILKA SOM ANVÄNDER DEN */}
        <div className="onb-group">
          <h3 className="onb-group-title">3 · Vilka som använder den</h3>
          <p className="onb-group-sub">Appen frågar inte vilka som använder sajten — det avgör researchen (sektion 3). Det du bidrar med här är belägget: hur kunder faktiskt hör av sig i dag.</p>
        </div>
        <div className="form-field">
          <label htmlFor="kanaler">Bokning/kontaktkanaler i dag</label>
          <input id="kanaler" value={kanaler} onChange={(e) => setKanaler(e.target.value)} placeholder="t.ex. telefon + Instagram-DM" />
        </div>

        {/* S2 · Grupp 4 — BEFINTLIGT MATERIAL, KANALER OCH SYSTEM */}
        <div className="onb-group">
          <h3 className="onb-group-title">4 · Befintligt material, kanaler och system</h3>
          <p className="onb-group-sub">Vad som redan finns att läsa read-only. Sektion 7 och 10.</p>
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

        {/* S2 · Pakethypotes — operatörsvänd och överstyrbar */}
        <div className="form-field">
          <label htmlFor="pakethypotes">Pakethypotes</label>
          <select id="pakethypotes" value={pakethypotes} onChange={(e) => setPakethypotes(e.target.value)}>
            <option value="">core-only — inget paket belagt (default)</option>
            {tillgangligaPaket.map((p) => (
              <option key={p.pack} value={p.pack}>{p.pack} v{p.version} — belagt, aktivera paketmodulen</option>
            ))}
          </select>
          <div className="onb-status">
            Default är <b>core-only</b>: en ANTAGEN bransch aktiverar aldrig en paketmodul. Välj ett
            paket bara när det är <b>belagt</b> — det är din bedömning, inte appens, och den skärper
            researchkraven i prompten.
          </div>
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

        {/* S2 · Projektförståelse — READ-ONLY. Godkänner ingenting, startar ingenting. */}
        {forstaelse.parseStatus !== "TOM" && (
          <div className="onb-step">
            <div className="onb-step-head">
              <span>Projektförståelse · vad appen läste ur filen</span>
              <span className="onb-badge">{forstaelse.parseStatus}</span>
            </div>
            <p className="onb-status" aria-live="polite">{sammanfatta(forstaelse)}</p>

            {forstaelse.parseNot && (
              <div className="onb-parsefail" role="note">
                <b>{forstaelse.parseStatus === "KONTROLLRAD_TVETYDIG" ? "Tvetydigt:" : "Kunde inte tolka:"}</b> {forstaelse.parseNot}
              </div>
            )}

            {forstaelse.kontrollrad && (
              <dl className="onb-facts">
                <div><dt>Kontraktsversion</dt><dd>{forstaelse.kontrollrad.kontraktsversion ?? "okänd"}</dd></div>
                <div><dt>Paket</dt><dd>{forstaelse.kontrollrad.pack ?? "okänt"}</dd></div>
                <div><dt>Paketmodul</dt><dd>{forstaelse.kontrollrad.packModule ?? "anges inte"}</dd></div>
                <div><dt>Filens status</dt><dd>{forstaelse.kontrollrad.status === "OKÄNT_VÄRDE" ? `okänt värde: ${forstaelse.kontrollrad.falt.status}` : (forstaelse.kontrollrad.status ?? "anges inte")}</dd></div>
                <div><dt>Osäkra (kontrollrad)</dt><dd>{forstaelse.kontrollrad.osakra ?? "går ej att läsa"}</dd></div>
                <div><dt>Konflikter</dt><dd>{forstaelse.kontrollrad.konflikter ?? "går ej att läsa"}</dd></div>
                <div><dt>[OSÄKER]-markeringar i texten</dt><dd>{forstaelse.antalOsakraMarkeringar}</dd></div>
              </dl>
            )}

            <details>
              <summary>Sektioner appen kunde se ({forstaelse.sektioner.filter((x) => x.hittad).length}/17)</summary>
              <ul className="onb-sections">
                {forstaelse.sektioner.map((sek) => (
                  <li key={sek.nr} className={sek.hittad ? "ok" : "saknas"}>
                    {sek.nr}. {sek.namn} — {sek.hittad ? "syns" : "syns inte"}
                  </li>
                ))}
              </ul>
            </details>

            <p className="onb-status">
              Detta är en <b>läsyta</b>. Appen godkänner ingenting, underkänner ingenting och startar
              inget bygge. &quot;Syns&quot; betyder att en <b>rubrik</b> för sektionen finns — inte att den
              är ifylld; en tom rubrikskelett räknas alltså som synlig. Och att en sektion
              &quot;syns inte&quot; kan betyda att den saknas ELLER att den heter något annat. Läs filen
              själv innan du går vidare.
            </p>
          </div>
        )}

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
