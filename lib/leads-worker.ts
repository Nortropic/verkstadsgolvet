/**
 * Svep-workern (server-only) — STEP-0A CONTAINMENT (2026-08-24, ägarbeslut).
 *
 * Den tidigare insamlingen skapade durabla poster med Places-härledda fält
 * (namn/adress/telefon/betyg m.m.) — otillåtet enligt Maps-ToS (endast place_id
 * får lagras varaktigt; EEA-villkoren 2025-07-08 skärpte ytterligare), med
 * asymmetrisk risk mot samma Google-kontofamilj som bär GBP/Ads/GSC-leveransen.
 *
 * OVILLKORLIGT FAIL-CLOSED: ingen miljövariabel eller konfiguration får kringgå
 * en containment av en vederlagd väg. Hävs ENDAST genom en granskad kodändring
 * när P1:s Bolagsverket-rebase (registret som durabel källa + place_id-pekare
 * med färskhämtning vid användning) ersätter denna insamlingsväg.
 *
 * Den borttagna legacy-implementationen finns i git-historiken
 * (t.o.m. föräldern till denna commit) som underlag för P1:s granskade ersättare.
 * Se content/leads/LEADS-TEST-SMS-DEMO.md och masterplanen (Part 9 steg 7).
 */

const SECRET = process.env.N8N_WEBHOOK_SECRET;

export function workerSecretOk(header: string | null): boolean {
  return Boolean(SECRET) && header === SECRET;
}

export type WorkerSvar =
  | { ok: true; aktiv: boolean; budget_slut?: boolean; jobb: number; leads: number; sok_anrop: number; detalj_anrop: number }
  | { ok: false; reason: string; message: string };

export async function runWorkerBatch(_batch = 2): Promise<WorkerSvar> {
  return {
    ok: false,
    reason: "step0a-containment",
    message:
      "Insamlingen är stoppad (STEP-0A): durabel lagring av Places-data väntar P1:s Bolagsverket-rebase. Se content/leads/LEADS-TEST-SMS-DEMO.md.",
  };
}
