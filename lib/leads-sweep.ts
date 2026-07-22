/**
 * Svep-kön (server-only, Supabase service-key). Appen ENQUEUEAR kommun×kategori-kombon;
 * n8n cron betar av dem. Här: enqueue (idempotent), status/täckning, config (takt/paus).
 * Envelope-retur — kastar aldrig mot anroparen (graceful "ej konfigurerad").
 */
import { supa } from "./supabase";
import { KATEGORIER } from "./leads-categories";

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string; message: string };

const EJ_KONFIG: Result<never> = {
  ok: false,
  reason: "no-config",
  message: "Supabase är inte konfigurerat (SUPABASE_URL / SUPABASE_SERVICE_KEY saknas i Railway).",
};

function idag(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function enqueueSweep(
  kommuner: { lan: string; kommun: string }[],
  kategoriIds: string[]
): Promise<Result<{ nya: number; skippade: number; total: number }>> {
  const client = supa();
  if (!client) return EJ_KONFIG;

  const kats = KATEGORIER.filter((k) => kategoriIds.includes(k.id));
  if (kommuner.length === 0 || kats.length === 0) {
    return { ok: false, reason: "bad-request", message: "Välj minst en kommun och en kategori." };
  }

  const rows = [];
  for (const { lan, kommun } of kommuner) {
    for (const k of kats) {
      rows.push({
        lan,
        kommun,
        kategori_id: k.id,
        kategori_label: k.label,
        query_typ: k.includedType ? "includedType" : "text",
        query_varde: k.includedType ?? k.textTerm ?? k.label,
        status: "ko",
      });
    }
  }

  // on conflict (kommun, kategori_id) do nothing → RETURNING ger bara nyinsatta rader
  const { data, error } = await client
    .from("sok_kombinationer")
    .upsert(rows, { onConflict: "kommun,kategori_id", ignoreDuplicates: true })
    .select("id");
  if (error) return { ok: false, reason: "db-error", message: error.message };

  const nya = data?.length ?? 0;
  return { ok: true, data: { nya, skippade: rows.length - nya, total: rows.length } };
}

export type SweepStatus = {
  config: { dygns_budget: number; aktiv: boolean };
  idag: { sok_anrop: number; detalj_anrop: number };
  totalt: { kombon: number; klar: number; ko: number; fel: number; leads: number };
  perLan: { lan: string; kombon: number; klar: number; ko: number; fel: number; leads: number }[];
};

export async function getSweepStatus(): Promise<Result<SweepStatus>> {
  const client = supa();
  if (!client) return EJ_KONFIG;

  const [cfgRes, tackRes, dagRes] = await Promise.all([
    client.from("sok_config").select("dygns_budget, aktiv").eq("id", 1).maybeSingle(),
    client.from("sok_tackning").select("*"),
    client.from("sok_dagslogg").select("sok_anrop, detalj_anrop").eq("datum", idag()).maybeSingle(),
  ]);

  if (cfgRes.error) return { ok: false, reason: "db-error", message: cfgRes.error.message };
  if (tackRes.error) return { ok: false, reason: "db-error", message: tackRes.error.message };

  const perLanMap = new Map<string, SweepStatus["perLan"][number]>();
  const totalt = { kombon: 0, klar: 0, ko: 0, fel: 0, leads: 0 };
  for (const r of (tackRes.data ?? []) as Array<Record<string, unknown>>) {
    const lan = String(r.lan);
    const acc = perLanMap.get(lan) ?? { lan, kombon: 0, klar: 0, ko: 0, fel: 0, leads: 0 };
    acc.kombon += Number(r.kombon_total) || 0;
    acc.klar += Number(r.klar) || 0;
    acc.ko += Number(r.ko) || 0;
    acc.fel += Number(r.fel) || 0;
    acc.leads += Number(r.leads) || 0;
    perLanMap.set(lan, acc);
  }
  for (const v of perLanMap.values()) {
    totalt.kombon += v.kombon;
    totalt.klar += v.klar;
    totalt.ko += v.ko;
    totalt.fel += v.fel;
    totalt.leads += v.leads;
  }

  return {
    ok: true,
    data: {
      config: { dygns_budget: cfgRes.data?.dygns_budget ?? 400, aktiv: cfgRes.data?.aktiv ?? true },
      idag: { sok_anrop: dagRes.data?.sok_anrop ?? 0, detalj_anrop: dagRes.data?.detalj_anrop ?? 0 },
      totalt,
      perLan: [...perLanMap.values()].sort((a, b) => a.lan.localeCompare(b.lan, "sv")),
    },
  };
}

export async function updateSweepConfig(patch: { dygns_budget?: number; aktiv?: boolean }): Promise<Result<Record<string, never>>> {
  const client = supa();
  if (!client) return EJ_KONFIG;

  const upd: Record<string, unknown> = { uppdaterad_at: new Date().toISOString() };
  if (typeof patch.dygns_budget === "number" && patch.dygns_budget >= 0) upd.dygns_budget = Math.floor(patch.dygns_budget);
  if (typeof patch.aktiv === "boolean") upd.aktiv = patch.aktiv;

  const { error } = await client.from("sok_config").update(upd).eq("id", 1);
  if (error) return { ok: false, reason: "db-error", message: error.message };
  return { ok: true, data: {} };
}
