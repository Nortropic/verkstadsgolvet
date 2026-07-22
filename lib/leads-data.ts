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

export { isConfigured };
