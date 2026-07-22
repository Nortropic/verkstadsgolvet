"use client";

import { useEffect, useState } from "react";

type Data = {
  ok: true;
  version: number;
  bygg_demo_min: number;
  kvalificerad_min: number;
  antal_leads: number;
  antal_utfall: number;
  snitt_demo_min: number | null;
  intervaller: { namn: string; leads: number; kontaktade: number; svar: number; kunder: number; svarsfrekvens: number | null }[];
  vikter: { signal: string; poang: number; beskrivning: string | null }[];
};
type Svar = Data | { ok: false; reason: string; message: string };

export default function Kalibrering() {
  const [d, setD] = useState<Svar | null>(null);
  const [poang, setPoang] = useState<Record<string, number>>({});
  const [byggMin, setByggMin] = useState(85);
  const [kvalMin, setKvalMin] = useState(60);
  const [kommentar, setKommentar] = useState("");
  const [sparar, setSparar] = useState(false);
  const [resultat, setResultat] = useState<string | null>(null);

  function ladda() {
    fetch("/api/leads/kalibrering", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j: Svar) => {
        setD(j);
        if (j.ok) {
          const p: Record<string, number> = {};
          j.vikter.forEach((v) => (p[v.signal] = v.poang));
          setPoang(p);
          setByggMin(j.bygg_demo_min);
          setKvalMin(j.kvalificerad_min);
        }
      })
      .catch(() => setD({ ok: false, reason: "network", message: "Kunde inte nå servern." }));
  }
  useEffect(() => { ladda(); }, []);

  async function sparaNyVersion() {
    if (!d || !d.ok) return;
    setSparar(true);
    setResultat(null);
    const vikter = d.vikter.map((v) => ({ signal: v.signal, poang: poang[v.signal] ?? v.poang, beskrivning: v.beskrivning }));
    const r = await fetch("/api/leads/kalibrering", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ vikter, bygg_demo_min: byggMin, kvalificerad_min: kvalMin, kommentar }),
    }).then((x) => x.json());
    setSparar(false);
    if (r.ok) { setResultat(`Version ${r.version} skapad och aktiverad. Alla leads scoras nu om.`); setKommentar(""); ladda(); }
    else setResultat(`Fel: ${r.message}`);
  }

  if (!d) return <div className="panel"><p className="dim">Laddar…</p></div>;
  if (!d.ok) {
    return <div className="panel" style={{ maxWidth: 720 }}><h2><span className="idx">◆</span> {d.reason === "no-config" ? "Väntar på Supabase" : "Fel"}</h2><p style={{ color: "var(--text-muted)", marginTop: 10 }}>{d.message}</p></div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
      <div className="panel">
        <h2><span className="idx">◆</span> Träffsäkerhet <span className="hint">modell v{d.version}</span></h2>
        <div className="sweep-stats" style={{ marginBottom: 4 }}>
          <div className="sweep-stat"><span className="v">{d.antal_leads}</span><span className="l">leads</span></div>
          <div className="sweep-stat"><span className="v">{d.antal_utfall}</span><span className="l">kontaktade (utfall)</span></div>
          <div className="sweep-stat"><span className="v">{d.snitt_demo_min ?? "—"}</span><span className="l">snitt demo-min</span></div>
        </div>
        {d.antal_utfall < 15 && (
          <div className="onb-banner" style={{ margin: "12px 0 0" }}>
            <div className="b-title">För tidigt att kalibrera</div>
            Modellen är byggd på gissningar och blir meningsfull först efter ~15 utfall (kontaktade leads med svar). Just nu: {d.antal_utfall}. Beta av leads i arbetsvyn så fylls detta på.
          </div>
        )}
        <div className="leads-tablewrap" style={{ marginTop: 14 }}>
          <table className="leads-table">
            <thead><tr><th>Score-intervall</th><th className="num">Leads</th><th className="num">Kontaktade</th><th className="num">Svar</th><th className="num">Kunder</th><th className="num">Svarsfrekvens</th></tr></thead>
            <tbody>
              {d.intervaller.map((i) => (
                <tr key={i.namn}>
                  <td><span className={`score-badge ${i.namn === "85+" ? "bygg_demo" : i.namn === "60–84" ? "kvalificerad" : "lag_prio"}`}>{i.namn}</span></td>
                  <td className="num">{i.leads}</td><td className="num">{i.kontaktade}</td><td className="num">{i.svar}</td><td className="num">{i.kunder}</td>
                  <td className="num">{i.svarsfrekvens == null ? "—" : `${i.svarsfrekvens}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="dim" style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5 }}>
          Funkar modellen? Då ska svarsfrekvensen vara HÖGRE i 85+ än i lägre intervall. Är den inte det — skruva vikterna nedan och skapa en ny version.
        </p>
      </div>

      <div className="panel">
        <h2><span className="idx">◆</span> Skruva modellen <span className="hint">redigera → skapa ny version</span></h2>
        <div className="kal-troskel">
          <label>Tröskel "bygg demo" (≥)<input type="number" value={byggMin} onChange={(e) => setByggMin(Number(e.target.value))} /></label>
          <label>Tröskel "kvalificerad" (≥)<input type="number" value={kvalMin} onChange={(e) => setKvalMin(Number(e.target.value))} /></label>
        </div>
        <div className="leads-tablewrap">
          <table className="leads-table">
            <thead><tr><th>Signal</th><th>Beskrivning</th><th className="num">Poäng</th></tr></thead>
            <tbody>
              {d.vikter.map((v) => (
                <tr key={v.signal}>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{v.signal}</td>
                  <td style={{ color: "var(--text-muted)" }}>{v.beskrivning}</td>
                  <td className="num">
                    <input className="kal-poang" type="number" value={poang[v.signal] ?? v.poang} onChange={(e) => setPoang((p) => ({ ...p, [v.signal]: Number(e.target.value) }))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="kal-spara">
          <input placeholder="Kommentar (varför du ändrar)…" value={kommentar} onChange={(e) => setKommentar(e.target.value)} />
          <button type="button" className="btn-primary" disabled={sparar} onClick={sparaNyVersion}>{sparar ? "Skapar…" : "Skapa ny version & aktivera"}</button>
        </div>
        {resultat && <div className="onb-banner on" style={{ margin: "12px 0 0" }}>{resultat}</div>}
        <p className="dim" style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5 }}>
          En ny version aktiveras direkt och alla leads scoras om mot de nya vikterna. Gamla versioner behålls (leads du redan scorat under dem påverkas inte historiskt). Vikterna bor i Supabase <code>score_vikter</code>.
        </p>
      </div>
    </div>
  );
}
