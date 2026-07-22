"use client";

import { useEffect, useMemo, useState } from "react";
import { SWEDEN } from "@/lib/sweden-geo";
import { KATEGORIER, KATEGORI_GRUPPER } from "@/lib/leads-categories";

type Status = {
  ok: true;
  config: { dygns_budget: number; aktiv: boolean };
  idag: { sok_anrop: number; detalj_anrop: number };
  manad: { sok_anrop: number; detalj_anrop: number; kostnad_kr: number };
  totalt: { kombon: number; klar: number; ko: number; fel: number; leads: number };
  perLan: { lan: string; kombon: number; klar: number; ko: number; fel: number; leads: number }[];
};
type StatusSvar = Status | { ok: false; reason: string; message: string };

const ALLA_KAT_IDS = KATEGORIER.map((k) => k.id);

export default function SweepPlanner() {
  const [status, setStatus] = useState<StatusSvar | null>(null);
  const [laddar, setLaddar] = useState(true);

  const [valdaKommuner, setValdaKommuner] = useState<Set<string>>(new Set());
  const [valdaKats, setValdaKats] = useState<Set<string>>(new Set(ALLA_KAT_IDS));
  const [oppetLan, setOppetLan] = useState<Set<string>>(new Set());

  const [koar, setKoar] = useState(false);
  const [koResultat, setKoResultat] = useState<string | null>(null);

  async function ladda() {
    const r = await fetch("/api/leads/sweep", { credentials: "same-origin" }).then((x) => x.json());
    setStatus(r);
    setLaddar(false);
  }
  useEffect(() => {
    ladda();
  }, []);

  const kommunNyckel = (lan: string, kommun: string) => `${lan}|${kommun}`;

  function toggleKommun(lan: string, kommun: string) {
    setValdaKommuner((prev) => {
      const n = new Set(prev);
      const k = kommunNyckel(lan, kommun);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }
  function toggleLan(lan: string, kommuner: string[], på: boolean) {
    setValdaKommuner((prev) => {
      const n = new Set(prev);
      for (const k of kommuner) {
        if (på) n.add(kommunNyckel(lan, k));
        else n.delete(kommunNyckel(lan, k));
      }
      return n;
    });
  }
  function toggleHelaSverige(på: boolean) {
    setValdaKommuner(() => {
      if (!på) return new Set();
      const n = new Set<string>();
      for (const l of SWEDEN) for (const k of l.kommuner) n.add(kommunNyckel(l.lan, k));
      return n;
    });
  }
  function toggleKat(id: string) {
    setValdaKats((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleGrupp(ids: string[], på: boolean) {
    setValdaKats((prev) => {
      const n = new Set(prev);
      for (const id of ids) {
        if (på) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  }

  const antalKommuner = valdaKommuner.size;
  const antalKat = valdaKats.size;
  const kombon = antalKommuner * antalKat;
  const kostnadLag = Math.round(kombon * 0.8);
  const kostnadHog = Math.round(kombon * 2);

  const helaSverigeVald = useMemo(() => {
    let total = 0;
    for (const l of SWEDEN) total += l.kommuner.length;
    return antalKommuner === total && total > 0;
  }, [antalKommuner]);

  async function köa() {
    setKoar(true);
    setKoResultat(null);
    const kommuner = [...valdaKommuner].map((s) => {
      const [lan, kommun] = s.split("|");
      return { lan, kommun };
    });
    const r = await fetch("/api/leads/sweep", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ kommuner, kategoriIds: [...valdaKats] }),
    }).then((x) => x.json());
    setKoar(false);
    if (r.ok) {
      setKoResultat(`${r.nya} nya sökjobb köade${r.skippade ? `, ${r.skippade} fanns redan` : ""}. n8n betar av dem i bakgrunden.`);
      ladda();
    } else {
      setKoResultat(`Fel: ${r.message}`);
    }
  }

  async function sättConfig(patch: { dygns_budget?: number; aktiv?: boolean }) {
    await fetch("/api/leads/sweep", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(patch),
    });
    ladda();
  }

  if (laddar) return <div className="panel"><p className="dim">Laddar…</p></div>;

  if (status && !status.ok) {
    const ejKonfig = status.reason === "no-config";
    return (
      <div className="panel" style={{ maxWidth: 720 }}>
        <h2><span className="idx">◆</span> {ejKonfig ? "Väntar på Supabase" : "Kunde inte läsa svep-status"}</h2>
        <p style={{ color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>{status.message}</p>
        {ejKonfig && (
          <p style={{ color: "var(--text-muted)", marginTop: 8, lineHeight: 1.6 }}>
            Kör <code>db/leads-sweep-schema.sql</code> i Supabase och lägg in <code>SUPABASE_URL</code> +{" "}
            <code>SUPABASE_SERVICE_KEY</code> i Railway → så tänds svep-planeraren.
          </p>
        )}
      </div>
    );
  }

  const s = status as Status;
  const anropIdag = s.idag.sok_anrop + s.idag.detalj_anrop;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
      {/* Status + takt */}
      <div className="panel">
        <h2><span className="idx">◆</span> Svep-status</h2>
        <div className="sweep-stats">
          <div className="sweep-stat"><span className="v">{s.totalt.klar}/{s.totalt.kombon}</span><span className="l">jobb klara</span></div>
          <div className="sweep-stat"><span className="v">{s.totalt.ko}</span><span className="l">i kö</span></div>
          <div className="sweep-stat"><span className="v">{s.totalt.leads}</span><span className="l">leads totalt</span></div>
          <div className="sweep-stat"><span className="v">{anropIdag}/{s.config.dygns_budget}</span><span className="l">anrop idag</span></div>
          <div className="sweep-stat"><span className="v" title={`${s.manad.sok_anrop + s.manad.detalj_anrop} anrop denna månad`}>~{s.manad.kostnad_kr} kr</span><span className="l">kostnad ~denna månad</span></div>
        </div>
        <div className="sweep-config">
          <label>
            Dygnsbudget (anrop)
            <input
              type="number"
              defaultValue={s.config.dygns_budget}
              min={0}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== s.config.dygns_budget) sättConfig({ dygns_budget: v });
              }}
            />
          </label>
          <button
            type="button"
            className={`replay${s.config.aktiv ? "" : " paused"}`}
            onClick={() => sättConfig({ aktiv: !s.config.aktiv })}
          >
            {s.config.aktiv ? "⏸ Pausa svepet" : "▶ Återuppta svepet"}
          </button>
          {!s.config.aktiv && <span className="badge warning">Pausat</span>}
        </div>
        {s.perLan.length > 0 && (
          <div className="sweep-lan">
            {s.perLan.map((l) => (
              <div className="sweep-lan-row" key={l.lan}>
                <span className="n">{l.lan}</span>
                <span className="bar"><span style={{ width: `${l.kombon ? (100 * l.klar) / l.kombon : 0}%` }} /></span>
                <span className="c">{l.klar}/{l.kombon} · {l.leads} leads</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Geografi */}
      <div className="panel">
        <h2><span className="idx">◆</span> Geografi <span className="hint">{antalKommuner} kommuner valda</span></h2>
        <label className="sweep-master">
          <input type="checkbox" checked={helaSverigeVald} onChange={(e) => toggleHelaSverige(e.target.checked)} />
          Hela Sverige (290 kommuner)
        </label>
        <div className="sweep-tree">
          {SWEDEN.map((l) => {
            const valda = l.kommuner.filter((k) => valdaKommuner.has(kommunNyckel(l.lan, k))).length;
            const alla = valda === l.kommuner.length;
            const öppen = oppetLan.has(l.lan);
            return (
              <div className="sweep-lan-block" key={l.lan}>
                <div className="sweep-lan-head">
                  <input type="checkbox" checked={alla} ref={(el) => { if (el) el.indeterminate = valda > 0 && !alla; }} onChange={(e) => toggleLan(l.lan, l.kommuner, e.target.checked)} />
                  <button type="button" className="sweep-lan-name" onClick={() => setOppetLan((p) => { const n = new Set(p); if (n.has(l.lan)) n.delete(l.lan); else n.add(l.lan); return n; })}>
                    {l.lan} <span className="dim">({valda}/{l.kommuner.length})</span>
                    <span className={`nav-caret${öppen ? " open" : ""}`}><svg viewBox="0 0 12 12" width="11" height="11" fill="none"><path d="M4 2.5 7.5 6 4 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  </button>
                </div>
                {öppen && (
                  <div className="sweep-kommuner">
                    {l.kommuner.map((k) => (
                      <label key={k} className="sweep-kommun">
                        <input type="checkbox" checked={valdaKommuner.has(kommunNyckel(l.lan, k))} onChange={() => toggleKommun(l.lan, k)} />
                        {k}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Kategorier */}
      <div className="panel">
        <h2><span className="idx">◆</span> Branscher <span className="hint">{antalKat} valda</span></h2>
        <div className="sweep-katgrupper">
          {KATEGORI_GRUPPER.map((g) => {
            const ids = g.kategorier.map((k) => k.id);
            const valda = ids.filter((id) => valdaKats.has(id)).length;
            const alla = valda === ids.length;
            return (
              <div className="sweep-katgrupp" key={g.grupp}>
                <label className="sweep-grupp-head">
                  <input type="checkbox" checked={alla} ref={(el) => { if (el) el.indeterminate = valda > 0 && !alla; }} onChange={(e) => toggleGrupp(ids, e.target.checked)} />
                  {g.grupp}
                </label>
                <div className="sweep-kats">
                  {g.kategorier.map((k) => (
                    <label key={k.id} className={`sweep-kat${valdaKats.has(k.id) ? " on" : ""}`}>
                      <input type="checkbox" checked={valdaKats.has(k.id)} onChange={() => toggleKat(k.id)} />
                      {k.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Köa */}
      <div className="panel sweep-run">
        <div className="sweep-est">
          <strong>{kombon.toLocaleString("sv")}</strong> sökjobb ({antalKommuner} kommuner × {antalKat} branscher)
          {kombon > 0 && <> · grovt ~{kostnadLag.toLocaleString("sv")}–{kostnadHog.toLocaleString("sv")} kr · betas av ~{s.config.dygns_budget}/dygn</>}
        </div>
        <button type="button" className="btn-primary" disabled={koar || kombon === 0} onClick={köa}>
          {koar ? "Köar…" : "Köa svep"}
        </button>
      </div>
      {koResultat && <div className="onb-banner on" style={{ margin: 0 }}>{koResultat}</div>}
    </div>
  );
}
