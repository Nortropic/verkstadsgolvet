"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { LeadMedScore, LeadStatus } from "@/lib/leads-types";

/* human-läsbara etiketter för score-signalerna (för "varför fick den sin poäng") */
const SIGNAL_LABEL: Record<string, string> = {
  ingen_sajt: "Ingen sajt",
  rec_20plus: "≥20 recensioner",
  rec_10_19: "10–19 recensioner",
  rec_5_9: "5–9 recensioner",
  rec_1_4: "1–4 recensioner",
  betyg_45plus: "Betyg ≥4,5",
  betyg_40_44: "Betyg 4,0–4,4",
  betyg_35_39: "Betyg 3,5–3,9",
  farskhet_u3man: "Recension <3 mån",
  farskhet_3_6man: "Recension 3–6 mån",
  farskhet_6_12man: "Recension 6–12 mån",
  farskhet_over12man: "Recension >12 mån (vilande)",
  flode_6man: "≥3 recensioner sen. 6 mån",
  agare_svarar: "Ägaren svarar på recensioner",
  gbp_foton: "GBP har foton",
  gbp_oppettider: "GBP har öppettider",
  gbp_beskrivning: "GBP har beskrivning",
  har_fb_ig: "Har Facebook/Instagram",
  bildmaterial_bra: "Bildmaterial: bra",
  bildmaterial_saknas: "Bildmaterial: saknas",
  bransch_ring1: "Bransch i Ring 1",
  noll_recensioner: "0 recensioner",
  betyg_u35: "Betyg <3,5",
};

const STATUS_BADGE: Record<LeadStatus, string> = {
  kandidat: "neutral", kvalificerad: "accent", diskvalificerad: "danger", demo_byggd: "accent",
  kontaktad: "warning", svar: "success", mote: "success", kund: "success", nej: "danger",
};
const STATUS_LABEL: Record<LeadStatus, string> = {
  kandidat: "Kandidat", kvalificerad: "Kvalificerad", diskvalificerad: "Diskvalificerad",
  demo_byggd: "Demo byggd", kontaktad: "Kontaktad", svar: "Svar", mote: "Möte", kund: "Kund", nej: "Nej",
};

function månaderSedan(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return (Date.now() - d) / (1000 * 60 * 60 * 24 * 30.44);
}
function färskhetText(iso: string | null): { text: string; cls: string } {
  const m = månaderSedan(iso);
  if (m == null) return { text: "—", cls: "dim" };
  const mån = Math.round(m);
  const text = mån < 1 ? "denna månad" : mån === 1 ? "1 mån sedan" : `${mån} mån sedan`;
  const cls = m < 6 ? "fresh" : m > 12 ? "stale" : "dim";
  return { text, cls };
}

type ApiSvar =
  | { ok: true; leads: LeadMedScore[]; config: { version: number; bygg_demo_min: number; kvalificerad_min: number } }
  | { ok: false; reason: string; message: string };

export default function LeadsList() {
  const [data, setData] = useState<ApiSvar | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [bransch, setBransch] = useState("");
  const [ort, setOrt] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (bransch) q.set("bransch", bransch);
    if (ort) q.set("ort", ort);
    fetch(`/api/leads?${q.toString()}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((j: ApiSvar) => { if (alive) { setData(j); setLoading(false); } })
      .catch(() => { if (alive) { setData({ ok: false, reason: "network", message: "Kunde inte nå servern." }); setLoading(false); } });
    return () => { alive = false; };
  }, [status, bransch, ort]);

  const brancher = useMemo(() => {
    if (!data?.ok) return [];
    return Array.from(new Set(data.leads.map((l) => l.bransch).filter(Boolean))).sort() as string[];
  }, [data]);

  function uppdateraLead(uppdaterad: LeadMedScore) {
    setData((d) => (d && d.ok ? { ...d, leads: d.leads.map((l) => (l.id === uppdaterad.id ? uppdaterad : l)) } : d));
  }
  function nästaLead(nuvarande: string) {
    if (!data?.ok) return;
    const i = data.leads.findIndex((l) => l.id === nuvarande);
    setExpanded(i >= 0 && i < data.leads.length - 1 ? data.leads[i + 1].id : null);
  }

  if (loading && !data) return <div className="panel"><p className="dim">Laddar leads…</p></div>;

  if (data && !data.ok) {
    const ejKonfig = data.reason === "no-config";
    return (
      <div className="panel" style={{ maxWidth: 720 }}>
        <h2><span className="idx">◆</span> {ejKonfig ? "Väntar på Supabase" : "Kunde inte hämta leads"}</h2>
        <p style={{ color: "var(--text-muted)", marginTop: 10, lineHeight: 1.6 }}>{data.message}</p>
      </div>
    );
  }

  const leads = data?.ok ? data.leads : [];

  return (
    <>
      <div className="leads-toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Alla statusar</option>
          {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}
        </select>
        <select value={bransch} onChange={(e) => setBransch(e.target.value)}>
          <option value="">Alla branscher</option>
          {brancher.map((b) => (<option key={b} value={b}>{b}</option>))}
        </select>
        <input placeholder="Ort…" value={ort} onChange={(e) => setOrt(e.target.value)} />
        <span className="leads-meta">{leads.length} leads{data?.ok ? ` · modell v${data.config.version}` : ""}</span>
      </div>

      <div className="leads-tablewrap">
        <table className="leads-table">
          <thead>
            <tr>
              <th className="num">Score</th><th>Företag</th><th className="num">Betyg</th>
              <th className="num">Rec.</th><th>Senaste rec.</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <FragmentRow
                key={l.id}
                lead={l}
                färskhet={färskhetText(l.senaste_recension_at)}
                expanded={expanded === l.id}
                onToggle={() => setExpanded(expanded === l.id ? null : l.id)}
                onUpdate={uppdateraLead}
                onNext={() => nästaLead(l.id)}
              />
            ))}
            {leads.length === 0 && (<tr><td colSpan={6} style={{ color: "var(--text-muted)", padding: 20 }}>Inga leads matchar filtret.</td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FragmentRow({
  lead, färskhet, expanded, onToggle, onUpdate, onNext,
}: {
  lead: LeadMedScore;
  färskhet: { text: string; cls: string };
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (l: LeadMedScore) => void;
  onNext: () => void;
}) {
  const b = lead.berakning;
  const [sparar, setSparar] = useState(false);
  const [not, setNot] = useState(lead.bedomning_anteckning ?? "");
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`${lead.namn} ${lead.ort ?? ""}`)}`;

  async function patcha(patch: Record<string, unknown>, sedan?: () => void) {
    setSparar(true);
    try {
      const r = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(patch),
      }).then((x) => x.json());
      if (r.ok) { onUpdate(r.lead); sedan?.(); }
    } finally {
      setSparar(false);
    }
  }

  const Grupp = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="bedom-grupp"><span className="bedom-label">{label}</span><div className="bedom-btns">{children}</div></div>
  );
  const Knapp = ({ aktiv, onClick, children, variant }: { aktiv: boolean; onClick: () => void; children: ReactNode; variant?: string }) => (
    <button type="button" disabled={sparar} className={`bedom-btn${aktiv ? " on" : ""}${variant ? " " + variant : ""}`} onClick={onClick}>{children}</button>
  );

  return (
    <>
      <tr className={`lead-row${expanded ? " exp" : ""}`} onClick={onToggle}>
        <td className="num"><span className={`score-badge ${b.niva}`}>{b.score}</span></td>
        <td><div className="lead-namn">{lead.namn}</div><div className="lead-sub">{[lead.bransch, lead.ort].filter(Boolean).join(" · ")}</div></td>
        <td className="num">{lead.betyg ?? "—"}</td>
        <td className="num">{lead.recensioner_antal ?? 0}</td>
        <td><span className={färskhet.cls}>{färskhet.text}</span></td>
        <td><span className={`badge ${STATUS_BADGE[lead.status]}`}>{STATUS_LABEL[lead.status]}</span></td>
      </tr>
      {expanded && (
        <tr>
          <td className="lead-detail-td" colSpan={6}>
            <div className="lead-detail">
              <div>
                <div className="ld-h">Varför score {b.score}</div>
                {b.rader.map((r) => (
                  <div className="sig-row" key={r.signal}>
                    <span>{SIGNAL_LABEL[r.signal] ?? r.signal}</span>
                    <span className={`p ${r.poang >= 0 ? "pos" : "neg"}`}>{r.poang >= 0 ? "+" : ""}{r.poang}</span>
                  </div>
                ))}
                <div className="ld-links" style={{ marginTop: 12 }}>
                  {lead.gbp_url && <a className="ld-link" href={lead.gbp_url} target="_blank" rel="noopener noreferrer">Google-profil ↗</a>}
                  <a className="ld-link" href={googleUrl} target="_blank" rel="noopener noreferrer">Google-sök ↗</a>
                  {lead.fb_url && <a className="ld-link" href={lead.fb_url} target="_blank" rel="noopener noreferrer">Facebook ↗</a>}
                  {lead.ig_url && <a className="ld-link" href={lead.ig_url} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}
                </div>
              </div>

              <div>
                <div className="ld-h">Bedöm (sparar direkt)</div>
                <Grupp label="Bildmaterial">
                  <Knapp aktiv={lead.bildmaterial_bedomning === "bra"} onClick={() => patcha({ bildmaterial_bedomning: "bra" })}>Bra</Knapp>
                  <Knapp aktiv={lead.bildmaterial_bedomning === "tunt"} onClick={() => patcha({ bildmaterial_bedomning: "tunt" })}>Tunt</Knapp>
                  <Knapp aktiv={lead.bildmaterial_bedomning === "saknas"} onClick={() => patcha({ bildmaterial_bedomning: "saknas" })}>Saknas</Knapp>
                </Grupp>
                <Grupp label="Ägaren svarar på recensioner">
                  <Knapp aktiv={lead.agare_svarar_pa_recensioner === true} onClick={() => patcha({ agare_svarar_pa_recensioner: true })}>Ja</Knapp>
                  <Knapp aktiv={lead.agare_svarar_pa_recensioner === false} onClick={() => patcha({ agare_svarar_pa_recensioner: false })}>Nej</Knapp>
                  <Knapp aktiv={lead.agare_svarar_pa_recensioner === null} onClick={() => patcha({ agare_svarar_pa_recensioner: null })}>Okänd</Knapp>
                </Grupp>
                <Grupp label="FB/IG-aktivitet">
                  <Knapp aktiv={lead.social_aktivitet === "aktiv"} onClick={() => patcha({ social_aktivitet: "aktiv" })}>Aktiv</Knapp>
                  <Knapp aktiv={lead.social_aktivitet === "sporadisk"} onClick={() => patcha({ social_aktivitet: "sporadisk" })}>Sporadisk</Knapp>
                  <Knapp aktiv={lead.social_aktivitet === "dod"} onClick={() => patcha({ social_aktivitet: "dod" })}>Död</Knapp>
                </Grupp>
                <textarea
                  className="bedom-note"
                  placeholder="Anteckning — varför (matar kalibreringen)…"
                  value={not}
                  onChange={(e) => setNot(e.target.value)}
                  onBlur={() => { if (not !== (lead.bedomning_anteckning ?? "")) patcha({ bedomning_anteckning: not }); }}
                />
                <Grupp label="Beslut">
                  <Knapp variant="ja" aktiv={lead.status === "kvalificerad"} onClick={() => patcha({ status: "kvalificerad" }, onNext)}>Kvalificera</Knapp>
                  <Knapp variant="nej" aktiv={lead.status === "diskvalificerad"} onClick={() => patcha({ status: "diskvalificerad", diskvalificerings_skal: not || null }, onNext)}>Diskvalificera</Knapp>
                  <Knapp aktiv={false} onClick={onNext}>Senare →</Knapp>
                </Grupp>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
