/**
 * Svep-workerns app-sida (server-only). n8n cron anropar dessa via secret-header
 * (x-webhook-secret = N8N_WEBHOOK_SECRET) — därför är /api/leads/worker/* undantaget
 * session-gaten i middleware.ts och skyddas av hemligheten här i stället.
 *
 * APPEN äger logiken (budget, kö, dedup, upsert). n8n är tunt: hämtar en sats jobb
 * (claim), kör Places, rapporterar tillbaka enrichade leads (report). Self-healing:
 * claim MARKERAR inte — ett jobb som aldrig rapporteras stannar 'ko' och tas om nästa varv.
 */
import { supa } from "./supabase";

const SECRET = process.env.N8N_WEBHOOK_SECRET;

export function workerSecretOk(header: string | null): boolean {
  return Boolean(SECRET) && header === SECRET;
}

function idag(): string {
  return new Date().toISOString().slice(0, 10);
}

const EJ_KONFIG = { ok: false as const, reason: "no-config", message: "Supabase ej konfigurerat." };

/** Leads-kolumner n8n får skriva (whitelist — resten ignoreras vid upsert). */
const LEAD_KOLUMNER = [
  "place_id", "namn", "bransch", "ort", "adress", "telefon", "gbp_url", "har_sajt", "sajt_url",
  "betyg", "recensioner_antal", "senaste_recension_at", "recensioner_senaste_6man",
  "agare_svarar_pa_recensioner", "gbp_har_foton", "gbp_har_oppettider", "gbp_har_beskrivning",
  "fb_url", "ig_url", "status",
];

export type ClaimSvar = {
  ok: true;
  aktiv: boolean;
  budget_slut?: boolean;
  combos: { id: string; lan: string; kommun: string; kategori_label: string; query_typ: string; query_varde: string }[];
};

/** Hämtar nästa sats 'ko'-kombon om svepet är aktivt och dagsbudgeten inte är slut. */
export async function claimCombos(batch = 8): Promise<ClaimSvar | typeof EJ_KONFIG> {
  const client = supa();
  if (!client) return EJ_KONFIG;

  const { data: cfg } = await client.from("sok_config").select("dygns_budget, aktiv").eq("id", 1).maybeSingle();
  if (!cfg?.aktiv) return { ok: true, aktiv: false, combos: [] };

  const { data: dag } = await client.from("sok_dagslogg").select("sok_anrop, detalj_anrop").eq("datum", idag()).maybeSingle();
  const anropIdag = (dag?.sok_anrop ?? 0) + (dag?.detalj_anrop ?? 0);
  if (anropIdag >= (cfg?.dygns_budget ?? 400)) return { ok: true, aktiv: true, budget_slut: true, combos: [] };

  const { data: combos } = await client
    .from("sok_kombinationer")
    .select("id, lan, kommun, kategori_label, query_typ, query_varde")
    .eq("status", "ko")
    .order("skapad_at", { ascending: true })
    .limit(Math.min(Math.max(batch, 1), 25));

  return { ok: true, aktiv: true, combos: combos ?? [] };
}

export type ReportInput = {
  combo_id: string;
  placer_hittade?: number;
  records?: Record<string, unknown>[];
  sok_anrop?: number;
  detalj_anrop?: number;
};

/** Tar emot enrichade leads från n8n → upsert (dedup place_id), markera kombo klar, logga anrop. */
export async function reportCombo(input: ReportInput): Promise<{ ok: true; upsertade: number } | typeof EJ_KONFIG | { ok: false; reason: string; message: string }> {
  const client = supa();
  if (!client) return EJ_KONFIG;
  if (!input.combo_id) return { ok: false, reason: "bad-request", message: "combo_id saknas." };

  const rena = (input.records ?? [])
    .filter((r) => r && typeof r.place_id === "string" && r.place_id)
    .map((r) => {
      const rad: Record<string, unknown> = {};
      for (const k of LEAD_KOLUMNER) if (k in r) rad[k] = r[k];
      if (!rad.status) rad.status = "kandidat";
      return rad;
    });

  if (rena.length > 0) {
    const { error } = await client.from("leads").upsert(rena, { onConflict: "place_id" });
    if (error) return { ok: false, reason: "db-error", message: error.message };
  }

  await client
    .from("sok_kombinationer")
    .update({ status: "klar", kord_at: new Date().toISOString(), placer_hittade: input.placer_hittade ?? null, kandidater: rena.length })
    .eq("id", input.combo_id);

  // dagslogg: läs + addera + upsert (en cron → låg samtidighet)
  const { data: dag } = await client.from("sok_dagslogg").select("sok_anrop, detalj_anrop").eq("datum", idag()).maybeSingle();
  await client.from("sok_dagslogg").upsert({
    datum: idag(),
    sok_anrop: (dag?.sok_anrop ?? 0) + (input.sok_anrop ?? 0),
    detalj_anrop: (dag?.detalj_anrop ?? 0) + (input.detalj_anrop ?? 0),
  });

  return { ok: true, upsertade: rena.length };
}
