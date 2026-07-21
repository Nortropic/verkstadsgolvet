"use client";

import { useMemo, useState } from "react";
import { toRepoName } from "@/lib/slug";
import type { OnboardingInput } from "@/lib/prompt-research";

/**
 * Onboarding-formulär (Fas B). Två-fas: formulär → (ev. ≤2 klargörande frågor i UI)
 * → research.md-förhandsvisning → skapa PRIVAT kund-repo + pusha → STOPP för granskning.
 * Ingen "starta bygget"-knapp. När ONBOARDING_ENABLED=false är allt avstängt (submit
 * disabled, inga anrop) och en tydlig banner visas.
 */

type Phase = "form" | "questions" | "research" | "done";

type ResearchResp =
  | { ok: true; kind: "questions"; questions: string[] }
  | { ok: true; kind: "research"; markdown: string }
  | { ok: true; kind: "error"; message: string }
  | { ok: false; reason: string; message: string };

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

  const [phase, setPhase] = useState<Phase>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState("");
  const [research, setResearch] = useState("");
  const [result, setResult] = useState<{ repo: string; url: string } | null>(null);

  const repoName = useMemo(() => toRepoName(kundnamn), [kundnamn]);

  const input = (): OnboardingInput => ({
    kundnamn,
    formularsvar,
    facebook,
    instagram,
    hemsida,
    branschOrt,
    kanaler,
  });

  async function runResearchPhase(withAnswers?: string) {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ phase: "research", input: input(), answers: withAnswers }),
      });
      const data = (await r.json()) as ResearchResp;
      if (!data.ok) {
        setError(data.message);
        return;
      }
      if (data.kind === "error") {
        setError(data.message);
        return;
      }
      if (data.kind === "questions") {
        setQuestions(data.questions);
        setPhase("questions");
        return;
      }
      // research
      setResearch(data.markdown);
      setPhase("research");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
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
        body: JSON.stringify({ phase: "create", input: input(), research }),
      });
      const data = (await r.json()) as CreateResp;
      if (!data.ok) {
        setError(data.message);
        return;
      }
      setResult({ repo: data.repo, url: data.url });
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!enabled) return;
    runResearchPhase();
  }

  return (
    <>
      {enabled ? (
        <div className="onb-banner on">
          <div className="b-title">Onboarding aktiverad</div>
          Kör research via Claude, skapar ett <b>privat</b> kund-repo och pushar research.md
          — och <b>stannar där</b> för din granskning. Aldrig ett bygge.
        </div>
      ) : (
        <div className="onb-banner">
          <div className="b-title">Avstängd · förhandsvisning</div>
          <b>ONBOARDING_ENABLED=false.</b> Detta är bara formulär-skalet — ingenting
          skickas, inga Claude-anrop görs, inga repon skapas. Slå på flaggan i Railway och
          ge go-ahead för att aktivera det skrivande/AI-steget.
        </div>
      )}

      {/* FAS: formulär */}
      {phase === "form" && (
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

          <button className="onb-submit" type="submit" disabled={!enabled || loading}>
            {loading ? "Kör research…" : enabled ? "Starta research" : "Starta research (avstängd)"}
          </button>
        </form>
      )}

      {/* FAS: klargörande frågor */}
      {phase === "questions" && (
        <div className="form-grid">
          <div className="onb-banner on">
            <div className="b-title">Klargörande frågor</div>
            Claude behöver svar på detta innan repot skapas:
            <ul style={{ margin: "8px 0 0 18px" }}>
              {questions.map((q, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{q}</li>
              ))}
            </ul>
          </div>
          <div className="form-field">
            <label htmlFor="answers">Dina svar</label>
            <textarea id="answers" value={answers} onChange={(e) => setAnswers(e.target.value)} placeholder="Svara på frågorna ovan…" />
          </div>
          <button className="onb-submit" type="button" disabled={loading} onClick={() => runResearchPhase(answers)}>
            {loading ? "Kör research…" : "Fortsätt med svaren"}
          </button>
        </div>
      )}

      {/* FAS: research-förhandsvisning */}
      {phase === "research" && (
        <div className="form-grid">
          <div className="onb-banner on">
            <div className="b-title">research.md klar för granskning</div>
            Granska (och redigera vid behov) nedan. När du är nöjd skapas ett <b>privat</b>{" "}
            <b>{repoName}</b> och research.md pushas dit. Flödet stannar där.
          </div>
          <div className="form-field">
            <label htmlFor="research">research.md</label>
            <textarea id="research" value={research} onChange={(e) => setResearch(e.target.value)} style={{ minHeight: 340, fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6 }} />
          </div>
          <button className="onb-submit" type="button" disabled={loading} onClick={createRepo}>
            {loading ? "Skapar repo & pushar…" : `Skapa privat ${repoName} & pusha research.md`}
          </button>
        </div>
      )}

      {/* FAS: klart */}
      {phase === "done" && result && (
        <div className="onb-banner on">
          <div className="b-title">✓ Klart för granskning</div>
          research.md pushad till <b>{result.repo}</b>.{" "}
          <a href={result.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent-text)" }}>
            Öppna repot →
          </a>
          <div style={{ marginTop: 8 }}>
            Granska research.md ([OSÄKER]-flaggor + kontrollrad), starta sedan bygget själv i
            Claude Code. Ingen &quot;starta bygget&quot;-knapp här — flödet slutar här.
          </div>
        </div>
      )}

      {error && <div className="onb-status" style={{ color: "var(--danger-text)" }}>Fel: {error}</div>}

      {phase === "form" && (
        <div className="onb-status">
          Flödet slutar alltid vid <b>&quot;research.md klar för granskning&quot;</b> — det finns ingen
          &quot;starta bygget&quot;-knapp, och kund-repot skapas alltid privat.
        </div>
      )}
    </>
  );
}
