/**
 * Svep-workern (server-only). Appen äger HELA logiken; n8n är bara en cron som pingar
 * /api/leads/worker/run (secret-skyddat, undantaget session-gaten i middleware).
 *
 * runWorkerBatch: hämta nästa sats 'ko'-jobb (om aktivt + budget kvar) → per jobb:
 * billig Text Search (Pro) → filtrera bort de med sajt → Details (Enterprise) på kandidater
 * → extrahera signaler → upsert leads (dedup place_id) → markera jobbet klart → logga anrop.
 * Self-healing: ett jobb markeras klart först efter lyckad bearbetning; annars stannar det 'ko'.
 */
import { supa } from "./supabase";
import { textSearch, placeDetails, placesConfigured, type PlaceDetaljer } from "./places";

const SECRET = process.env.N8N_WEBHOOK_SECRET;

export function workerSecretOk(header: string | null): boolean {
  return Boolean(SECRET) && header === SECRET;
}

function idag(): string {
  return new Date().toISOString().slice(0, 10);
}

type Combo = { id: string; lan: string; kommun: string; kategori_label: string; query_typ: string; query_varde: string };

function extrahera(d: PlaceDetaljer, combo: Combo): Record<string, unknown> {
  let senaste: number | null = null;
  let flode6 = 0;
  const sexMan = Date.now() - 1000 * 60 * 60 * 24 * 182;
  for (const r of d.reviews ?? []) {
    const t = r.publishTime ? new Date(r.publishTime).getTime() : null;
    if (t && (senaste === null || t > senaste)) senaste = t;
    if (t && t >= sexMan) flode6++;
  }
  return {
    place_id: d.id,
    namn: d.displayName?.text ?? null,
    bransch: combo.kategori_label,
    ort: combo.kommun,
    adress: d.formattedAddress ?? null,
    telefon: d.nationalPhoneNumber ?? null,
    gbp_url: d.googleMapsUri ?? null,
    har_sajt: false,
    sajt_url: null,
    betyg: d.rating ?? null,
    recensioner_antal: d.userRatingCount ?? null,
    senaste_recension_at: senaste ? new Date(senaste).toISOString() : null,
    recensioner_senaste_6man: flode6,
    gbp_har_foton: Array.isArray(d.photos) && d.photos.length > 0,
    gbp_har_oppettider: Boolean(d.regularOpeningHours),
    gbp_har_beskrivning: Boolean(d.editorialSummary?.text),
    agare_svarar_pa_recensioner: null,
    fb_url: null,
    ig_url: null,
    status: "kandidat",
  };
}

export type WorkerSvar =
  | { ok: true; aktiv: boolean; budget_slut?: boolean; jobb: number; leads: number; sok_anrop: number; detalj_anrop: number }
  | { ok: false; reason: string; message: string };

export async function runWorkerBatch(batch = 2): Promise<WorkerSvar> {
  // STEP-0A CONTAINMENT (2026-08-24): svepet skapar durabla poster med Places-härledda
  // fält (namn/adress/telefon/betyg m.m.) — otillåtet enligt Maps-ToS (endast place_id
  // får lagras varaktigt; EEA-villkoren 2025-07-08 skärpte ytterligare). Insamlingen är
  // stoppad tills P1:s Bolagsverket-rebase (registret som durabel källa + place_id-pekare
  // med färskhämtning vid användning) är på plats. Hävs ENDAST genom att ägaren sätter
  // env STEP0A_CONTAINMENT_OVERRIDE=jag-forstar-tos-risken — aldrig i förbifarten.
  if (process.env.STEP0A_CONTAINMENT_OVERRIDE !== "jag-forstar-tos-risken") {
    return { ok: false, reason: "step0a-containment", message: "Insamlingen är stoppad (STEP-0A): durabel lagring av Places-data väntar P1:s Bolagsverket-rebase. Se content/leads/LEADS-TEST-SMS-DEMO.md." };
  }
  const client = supa();
  if (!client) return { ok: false, reason: "no-config", message: "Supabase ej konfigurerat." };
  if (!placesConfigured()) return { ok: false, reason: "no-places", message: "PLACES_API_KEY saknas i Railway." };

  const { data: cfg } = await client.from("sok_config").select("dygns_budget, aktiv").eq("id", 1).maybeSingle();
  if (!cfg?.aktiv) return { ok: true, aktiv: false, jobb: 0, leads: 0, sok_anrop: 0, detalj_anrop: 0 };

  const budget = cfg?.dygns_budget ?? 400;
  const { data: dag } = await client.from("sok_dagslogg").select("sok_anrop, detalj_anrop").eq("datum", idag()).maybeSingle();
  const anropIdagStart = (dag?.sok_anrop ?? 0) + (dag?.detalj_anrop ?? 0);
  if (anropIdagStart >= budget) return { ok: true, aktiv: true, budget_slut: true, jobb: 0, leads: 0, sok_anrop: 0, detalj_anrop: 0 };

  const { data: combos } = await client
    .from("sok_kombinationer")
    .select("id, lan, kommun, kategori_label, query_typ, query_varde")
    .eq("status", "ko")
    .order("skapad_at", { ascending: true })
    .limit(Math.min(Math.max(batch, 1), 5));

  let sokAnrop = 0;
  let detaljAnrop = 0;
  let leadsTotal = 0;
  let jobbKlara = 0;

  for (const combo of (combos ?? []) as Combo[]) {
    if (anropIdagStart + sokAnrop + detaljAnrop >= budget) break; // budgettak nått mitt i satsen

    try {
      // Svensk term + ort i textfrågan (som gamla flödet "elektriker Luleå") ger bäst lokala
      // träffar; includedType läggs till som filter för de kategorier Google har en typ för.
      const includedType = combo.query_typ === "includedType" ? combo.query_varde : undefined;
      const sokterm = combo.query_typ === "text" ? combo.query_varde : combo.kategori_label.split("/")[0].trim();
      const textQuery = `${sokterm} ${combo.kommun}`;
      const { places, calls } = await textSearch(textQuery, includedType);
      sokAnrop += calls;

      const utanSajt = places.filter((p) => !p.websiteUri && p.id);
      // hoppa över place_id vi redan har → betala inte för Details på kända företag igen
      let kanda = new Set<string>();
      if (utanSajt.length > 0) {
        const { data: fanns } = await client.from("leads").select("place_id").in("place_id", utanSajt.map((p) => p.id));
        kanda = new Set((fanns ?? []).map((r) => r.place_id as string));
      }
      const nya = utanSajt.filter((p) => !kanda.has(p.id));

      const records: Record<string, unknown>[] = [];
      for (const p of nya) {
        if (anropIdagStart + sokAnrop + detaljAnrop >= budget) break;
        try {
          const d = await placeDetails(p.id);
          detaljAnrop++;
          if (d.websiteUri) continue; // hade sajt ändå
          if (d.businessStatus && d.businessStatus !== "OPERATIONAL") continue; // stängt
          records.push(extrahera(d, combo));
        } catch {
          detaljAnrop++;
        }
      }

      if (records.length > 0) {
        const { error: upErr } = await client.from("leads").upsert(records, { onConflict: "place_id" });
        if (upErr) throw new Error(`upsert leads: ${upErr.message}`);
        leadsTotal += records.length;
      }
      await client
        .from("sok_kombinationer")
        .update({ status: "klar", kord_at: new Date().toISOString(), placer_hittade: places.length, kandidater: records.length })
        .eq("id", combo.id);
      jobbKlara++;
    } catch (e) {
      await client
        .from("sok_kombinationer")
        .update({ status: "fel", kord_at: new Date().toISOString(), fel_text: (e as Error).message.slice(0, 300) })
        .eq("id", combo.id);
    }
  }

  // dagslogg: läs + addera + upsert (en cron → låg samtidighet)
  const { data: dag2 } = await client.from("sok_dagslogg").select("sok_anrop, detalj_anrop").eq("datum", idag()).maybeSingle();
  await client.from("sok_dagslogg").upsert({
    datum: idag(),
    sok_anrop: (dag2?.sok_anrop ?? 0) + sokAnrop,
    detalj_anrop: (dag2?.detalj_anrop ?? 0) + detaljAnrop,
  });

  return { ok: true, aktiv: true, jobb: jobbKlara, leads: leadsTotal, sok_anrop: sokAnrop, detalj_anrop: detaljAnrop };
}
