"use client";

import { useEffect, useState } from "react";
import type { LeadMedScore, LeadStatus, SvarTon } from "@/lib/leads-types";
import { buildSms } from "@/lib/leads-sms";

const FLODE: { status: LeadStatus; label: string }[] = [
  { status: "kvalificerad", label: "Kvalificerad" },
  { status: "demo_byggd", label: "Demo byggd" },
  { status: "kontaktad", label: "Kontaktad" },
  { status: "svar", label: "Svar" },
  { status: "mote", label: "Möte" },
];
const FLODE_STATUSAR = FLODE.map((f) => f.status);
const FLYTT: { status: LeadStatus; label: string }[] = [...FLODE, { status: "kund", label: "Kund ✓" }, { status: "nej", label: "Nej" }];

type ApiSvar = { ok: true; leads: LeadMedScore[] } | { ok: false; reason: string; message: string };

export default function Arbetsvy() {
  const [data, setData] = useState<ApiSvar | null>(null);
  const [loading, setLoading] = useState(true);
  const [öppen, setÖppen] = useState<string | null>(null);

  function ladda() {
    fetch("/api/leads", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j: ApiSvar) => { setData(j); setLoading(false); })
      .catch(() => { setData({ ok: false, reason: "network", message: "Kunde inte nå servern." }); setLoading(false); });
  }
  useEffect(() => { ladda(); }, []);

  function uppdatera(l: LeadMedScore) {
    setData((d) => (d && d.ok ? { ...d, leads: d.leads.map((x) => (x.id === l.id ? l : x)) } : d));
  }

  if (loading && !data) return <div className="panel"><p className="dim">Laddar…</p></div>;
  if (data && !data.ok) {
    return <div className="panel" style={{ maxWidth: 720 }}><h2><span className="idx">◆</span> {data.reason === "no-config" ? "Väntar på Supabase" : "Fel"}</h2><p style={{ color: "var(--text-muted)", marginTop: 10 }}>{data.message}</p></div>;
  }

  const alla = data?.ok ? data.leads : [];
  const iFlode = alla.filter((l) => FLODE_STATUSAR.includes(l.status));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
      {iFlode.length === 0 && (
        <div className="panel" style={{ maxWidth: 720 }}>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
            Inga leads i flödet än. Gå till <strong style={{ color: "var(--text-secondary)" }}>Kvalificering</strong>, klicka en rad och tryck <strong style={{ color: "var(--text-secondary)" }}>Kvalificera</strong> — då dyker den upp här.
          </p>
        </div>
      )}
      {FLODE.map((kol) => {
        const leads = iFlode.filter((l) => l.status === kol.status);
        if (leads.length === 0) return null;
        return (
          <div className="panel" key={kol.status}>
            <h2><span className="idx">◆</span> {kol.label} <span className="hint">{leads.length}</span></h2>
            <div className="arb-list">
              {leads.map((l) => (
                <Kort key={l.id} lead={l} öppen={öppen === l.id} onToggle={() => setÖppen(öppen === l.id ? null : l.id)} onUpdate={uppdatera} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Kort({ lead, öppen, onToggle, onUpdate }: { lead: LeadMedScore; öppen: boolean; onToggle: () => void; onUpdate: (l: LeadMedScore) => void }) {
  const [sparar, setSparar] = useState(false);
  const [demoUrl, setDemoUrl] = useState(lead.demo_url ?? "");
  const [demoTid, setDemoTid] = useState(lead.demo_byggtid_min?.toString() ?? "");
  const [svarText, setSvarText] = useState(lead.svar_text ?? "");
  const [sms, setSms] = useState(lead.sms_text ?? "");
  const [kopierad, setKopierad] = useState(false);

  async function patcha(patch: Record<string, unknown>) {
    setSparar(true);
    try {
      const r = await fetch(`/api/leads/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(patch) }).then((x) => x.json());
      if (r.ok) onUpdate(r.lead);
    } finally { setSparar(false); }
  }

  function generera() {
    const t = buildSms({ namn: lead.namn, ort: lead.ort, demo_url: demoUrl || lead.demo_url });
    setSms(t);
    patcha({ sms_text: t });
  }
  async function kopiera() {
    try { await navigator.clipboard.writeText(sms); setKopierad(true); setTimeout(() => setKopierad(false), 1500); } catch { /* blockerad */ }
  }

  return (
    <div className={`arb-kort${öppen ? " exp" : ""}`}>
      <div className="arb-huvud" onClick={onToggle}>
        <span className={`score-badge ${lead.berakning.niva}`}>{lead.berakning.score}</span>
        <span className="arb-namn">{lead.namn}</span>
        <span className="arb-ort">{lead.ort}</span>
        {lead.sms_skickat_at && <span className="badge success">SMS skickat</span>}
        {lead.svar_ton && <span className={`badge ${lead.svar_ton === "positiv" ? "success" : lead.svar_ton === "negativ" ? "danger" : "neutral"}`}>{lead.svar_ton}</span>}
      </div>

      {öppen && (
        <div className="arb-detalj">
          <div className="arb-falt">
            <label>Demo-länk (Vercel preview)
              <input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} onBlur={() => { if (demoUrl !== (lead.demo_url ?? "")) patcha({ demo_url: demoUrl || null }); }} placeholder="https://…" />
            </label>
            <label style={{ maxWidth: 150 }}>Byggtid (min)
              <input type="number" value={demoTid} onChange={(e) => setDemoTid(e.target.value)} onBlur={() => { const v = demoTid ? Number(demoTid) : null; if (v !== lead.demo_byggtid_min) patcha({ demo_byggtid_min: v }); }} />
            </label>
          </div>

          <div className="ld-h" style={{ marginTop: 4 }}>SMS-mall <span className="dim" style={{ textTransform: "none", letterSpacing: 0 }}>— systemet skickar aldrig, du kopierar och skickar själv</span></div>
          <div className="arb-sms-rad">
            <button type="button" className="replay" onClick={generera}>Generera SMS</button>
            {sms && <button type="button" className="copy-btn" onClick={kopiera}>{kopierad ? "✓ Kopierad" : "Kopiera"}</button>}
            {!lead.sms_skickat_at && sms && <button type="button" className="replay" disabled={sparar} onClick={() => patcha({ sms_skickat_at: new Date().toISOString(), status: "kontaktad" })}>Markera skickat →</button>}
          </div>
          {sms && <textarea className="prompt-box" style={{ minHeight: 110 }} readOnly value={sms} onFocus={(e) => e.currentTarget.select()} />}

          <div className="ld-h" style={{ marginTop: 14 }}>Svar</div>
          <div className="bedom-btns">
            {(["positiv", "neutral", "negativ"] as SvarTon[]).map((t) => (
              <button key={t} type="button" disabled={sparar} className={`bedom-btn${lead.svar_ton === t ? " on" : ""}`} onClick={() => patcha({ svar_ton: t, svar_at: new Date().toISOString(), status: lead.status === "kvalificerad" || lead.status === "demo_byggd" ? "svar" : lead.status })}>{t}</button>
            ))}
          </div>
          <input className="arb-svar-text" value={svarText} onChange={(e) => setSvarText(e.target.value)} onBlur={() => { if (svarText !== (lead.svar_text ?? "")) patcha({ svar_text: svarText || null }); }} placeholder="Vad svarade de?" />

          <div className="ld-h" style={{ marginTop: 14 }}>Flytta till</div>
          <div className="bedom-btns">
            {FLYTT.map((f) => (
              <button key={f.status} type="button" disabled={sparar || lead.status === f.status} className={`bedom-btn${lead.status === f.status ? " on" : ""}${f.status === "kund" ? " ja" : f.status === "nej" ? " nej" : ""}`} onClick={() => patcha({ status: f.status })}>{f.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
