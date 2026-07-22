/**
 * Dataåtkomst mot Supabase för Leads-modulen. SERVER-ONLY (importerar lib/supabase).
 * Läser leads + aktiv scoring-config, beräknar score per lead (lib/leads-scoring), och
 * exponerar CRUD som app-API-routes använder. Returnerar envelopes — kastar aldrig mot
 * anroparen, så vyerna kan rendera graceful "ej konfigurerad"-lägen.
 */
import { supa, isConfigured } from "./supabase";
import { beräknaScore } from "./leads-scoring";
import type { Lead, LeadMedScore, ScoreConfig } from "./leads-types";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string; message: string };

const EJ_KONFIG: Result<never> = {
  ok: false,
  reason: "no-config",
  message: "Supabase är inte konfigurerat (SUPABASE_URL / SUPABASE_SERVICE_KEY saknas i Railway).",
};

function fel(reason: string, message: string): Result<never> {
  return { ok: false, reason, message };
}

/** Fält Johnny får ändra via detaljvyn/arbetsvyn (whitelist — inget annat skrivs). */
const PATCHBARA: (keyof Lead)[] = [
  "bildmaterial_bedomning",
  "social_aktivitet",
  "agare_svarar_pa_recensioner",
  "fb_url",
  "ig_url",
  "bedomning_anteckning",
  "status",
  "diskvalificerings_skal",
  "demo_url",
  "demo_byggtid_min",
  "sms_text",
  "sms_skickat_at",
  "svar_at",
  "svar_ton",
  "svar_text",
  "anteckningar",
];

export async function getScoreConfig(): Promise<Result<ScoreConfig>> {
  const client = supa();
  if (!client) return EJ_KONFIG;

  const { data: ver, error: e1 } = await client
    .from("score_versioner")
    .select("version, bygg_demo_min, kvalificerad_min")
    .eq("aktiv", true)
    .maybeSingle();
  if (e1) return fel("db-error", e1.message);
  if (!ver) return fel("no-version", "Ingen aktiv score-version i score_versioner.");

  const { data: vikter, error: e2 } = await client
    .from("score_vikter")
    .select("signal, poang")
    .eq("version", ver.version);
  if (e2) return fel("db-error", e2.message);

  const map: Record<string, number> = {};
  (vikter ?? []).forEach((w) => (map[w.signal] = w.poang));

  return {
    ok: true,
    data: {
      version: ver.version,
      bygg_demo_min: ver.bygg_demo_min,
      kvalificerad_min: ver.kvalificerad_min,
      vikter: map,
    },
  };
}

export type LeadFilter = { status?: string; bransch?: string; ort?: string };

export async function listLeads(filter: LeadFilter = {}): Promise<Result<{ leads: LeadMedScore[]; config: ScoreConfig }>> {
  const client = supa();
  if (!client) return EJ_KONFIG;

  const cfg = await getScoreConfig();
  if (!cfg.ok) return cfg;

  let q = client.from("leads").select("*");
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.bransch) q = q.eq("bransch", filter.bransch);
  if (filter.ort) q = q.ilike("ort", `%${filter.ort}%`);

  const { data, error } = await q;
  if (error) return fel("db-error", error.message);

  const leads = (data as Lead[])
    .map((l) => ({ ...l, berakning: beräknaScore(l, cfg.data) }))
    .sort((a, b) => b.berakning.score - a.berakning.score);

  return { ok: true, data: { leads, config: cfg.data } };
}

export type Kalibrering = {
  version: number;
  bygg_demo_min: number;
  kvalificerad_min: number;
  antal_leads: number;
  antal_utfall: number; // kontaktade (status ∈ kontaktad/svar/mote/kund/nej)
  snitt_demo_min: number | null;
  intervaller: { namn: string; leads: number; kontaktade: number; svar: number; kunder: number; svarsfrekvens: number | null }[];
  vikter: { signal: string; poang: number; beskrivning: string | null }[];
};

/** Kalibrering beräknad i TS (score live, ej persisterad). Svarsfrekvens per score-intervall. */
export async function getKalibrering(): Promise<Result<Kalibrering>> {
  const client = supa();
  if (!client) return EJ_KONFIG;
  const cfg = await getScoreConfig();
  if (!cfg.ok) return cfg;

  const { data, error } = await client.from("leads").select("*");
  if (error) return fel("db-error", error.message);
  const { data: vikter } = await client
    .from("score_vikter")
    .select("signal, poang, beskrivning")
    .eq("version", cfg.data.version)
    .order("poang", { ascending: false });

  const kontaktStatus = new Set(["kontaktad", "svar", "mote", "kund", "nej"]);
  const svarStatus = new Set(["svar", "mote", "kund"]);
  const bucket = (s: number) => (s >= 85 ? "85+" : s >= 60 ? "60–84" : s >= 40 ? "40–59" : "<40");
  const ordning = ["85+", "60–84", "40–59", "<40"];
  const acc: Record<string, { leads: number; kontaktade: number; svar: number; kunder: number }> = {};
  for (const n of ordning) acc[n] = { leads: 0, kontaktade: 0, svar: 0, kunder: 0 };

  const tider: number[] = [];
  let antalUtfall = 0;
  for (const l of data as Lead[]) {
    const s = beräknaScore(l, cfg.data).score;
    const b = acc[bucket(s)];
    b.leads++;
    if (kontaktStatus.has(l.status)) { b.kontaktade++; antalUtfall++; }
    if (svarStatus.has(l.status)) b.svar++;
    if (l.status === "kund") b.kunder++;
    if (typeof l.demo_byggtid_min === "number") tider.push(l.demo_byggtid_min);
  }

  return {
    ok: true,
    data: {
      version: cfg.data.version,
      bygg_demo_min: cfg.data.bygg_demo_min,
      kvalificerad_min: cfg.data.kvalificerad_min,
      antal_leads: (data as Lead[]).length,
      antal_utfall: antalUtfall,
      snitt_demo_min: tider.length ? Math.round(tider.reduce((a, b) => a + b, 0) / tider.length) : null,
      intervaller: ordning.map((namn) => {
        const a = acc[namn];
        return { namn, leads: a.leads, kontaktade: a.kontaktade, svar: a.svar, kunder: a.kunder, svarsfrekvens: a.kontaktade ? Math.round((100 * a.svar) / a.kontaktade) : null };
      }),
      vikter: (vikter ?? []) as Kalibrering["vikter"],
    },
  };
}

export async function getLead(id: string): Promise<Result<LeadMedScore>> {
  const client = supa();
  if (!client) return EJ_KONFIG;

  const cfg = await getScoreConfig();
  if (!cfg.ok) return cfg;

  const { data, error } = await client.from("leads").select("*").eq("id", id).maybeSingle();
  if (error) return fel("db-error", error.message);
  if (!data) return fel("not-found", "Lead hittades inte.");

  const lead = data as Lead;
  return { ok: true, data: { ...lead, berakning: beräknaScore(lead, cfg.data) } };
}

export async function updateLead(id: string, patch: Partial<Lead>): Promise<Result<LeadMedScore>> {
  const client = supa();
  if (!client) return EJ_KONFIG;

  const rent: Record<string, unknown> = {};
  for (const key of PATCHBARA) {
    if (key in patch) rent[key] = patch[key];
  }
  if (Object.keys(rent).length === 0) return fel("bad-request", "Inga giltiga fält att uppdatera.");

  const cfg = await getScoreConfig();
  if (!cfg.ok) return cfg;

  const { data, error } = await client.from("leads").update(rent).eq("id", id).select("*").maybeSingle();
  if (error) return fel("db-error", error.message);
  if (!data) return fel("not-found", "Lead hittades inte.");

  const lead = data as Lead;
  return { ok: true, data: { ...lead, berakning: beräknaScore(lead, cfg.data) } };
}

export type NyVersionInput = {
  vikter: { signal: string; poang: number; beskrivning?: string | null }[];
  bygg_demo_min: number;
  kvalificerad_min: number;
  kommentar?: string;
};

/** Skapar en ny score_version med givna vikter/trösklar och aktiverar den (gamla behålls). */
export async function createScoreVersion(input: NyVersionInput): Promise<Result<{ version: number }>> {
  const client = supa();
  if (!client) return EJ_KONFIG;

  const vikter = input.vikter.filter((v) => v.signal && Number.isFinite(v.poang));
  if (vikter.length === 0) return fel("bad-request", "Inga giltiga vikter.");

  const { data: maxV } = await client.from("score_versioner").select("version").order("version", { ascending: false }).limit(1).maybeSingle();
  const ny = (maxV?.version ?? 0) + 1;

  const { error: e1 } = await client.from("score_versioner").insert({
    version: ny,
    aktiv: false,
    bygg_demo_min: Math.round(input.bygg_demo_min),
    kvalificerad_min: Math.round(input.kvalificerad_min),
    kommentar: input.kommentar?.trim() || `Kalibrerad ${new Date().toISOString().slice(0, 10)}`,
  });
  if (e1) return fel("db-error", e1.message);

  const rader = vikter.map((v) => ({ version: ny, signal: v.signal, poang: Math.round(v.poang), beskrivning: v.beskrivning ?? null }));
  const { error: e2 } = await client.from("score_vikter").insert(rader);
  if (e2) return fel("db-error", e2.message);

  // aktivera: deaktivera nuvarande (unik-index tillåter bara en aktiv), aktivera nya
  await client.from("score_versioner").update({ aktiv: false }).eq("aktiv", true);
  const { error: e3 } = await client.from("score_versioner").update({ aktiv: true }).eq("version", ny);
  if (e3) return fel("db-error", e3.message);

  return { ok: true, data: { version: ny } };
}

export { isConfigured };
