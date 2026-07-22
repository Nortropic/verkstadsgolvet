/**
 * Delade typer för Leads-modulen. Ren TypeScript, säker att importera från både
 * server och klient (inga hemligheter, inga anrop).
 */

export type LeadStatus =
  | "kandidat"
  | "kvalificerad"
  | "diskvalificerad"
  | "demo_byggd"
  | "kontaktad"
  | "svar"
  | "mote"
  | "kund"
  | "nej";

export type SvarTon = "positiv" | "neutral" | "negativ";
export type BildmaterialBedomning = "bra" | "tunt" | "saknas" | "ej_bedomd";
export type SocialAktivitet = "aktiv" | "sporadisk" | "dod" | "ej_bedomd";

/** En rad ur leads-tabellen (fälten n8n + manuell bedömning fyller). */
export type Lead = {
  id: string;
  skapad_at: string;
  uppdaterad_at: string;
  namn: string;
  bransch: string | null;
  ort: string | null;
  adress: string | null;
  telefon: string | null;
  place_id: string;
  gbp_url: string | null;
  har_sajt: boolean | null;
  sajt_url: string | null;
  betyg: number | null;
  recensioner_antal: number | null;
  senaste_recension_at: string | null;
  recensioner_senaste_6man: number | null;
  agare_svarar_pa_recensioner: boolean | null;
  gbp_har_foton: boolean | null;
  gbp_har_oppettider: boolean | null;
  gbp_har_beskrivning: boolean | null;
  fb_url: string | null;
  ig_url: string | null;
  bildmaterial_bedomning: BildmaterialBedomning;
  social_aktivitet: SocialAktivitet;
  bedomning_anteckning: string | null;
  score: number | null;
  score_version: number | null;
  status: LeadStatus;
  diskvalificerings_skal: string | null;
  demo_url: string | null;
  demo_byggd_at: string | null;
  demo_byggtid_min: number | null;
  sms_text: string | null;
  sms_skickat_at: string | null;
  svar_at: string | null;
  svar_ton: SvarTon | null;
  svar_text: string | null;
  anteckningar: string | null;
};

/** Aktiv scoring-konfiguration (score_versioner + score_vikter). */
export type ScoreConfig = {
  version: number;
  bygg_demo_min: number;
  kvalificerad_min: number;
  /** signal → poäng */
  vikter: Record<string, number>;
};

/** En tillämpad signal i score-uppdelningen (för detaljvyns "varför"). */
export type ScoreRad = { signal: string; poang: number; beskrivning?: string };

export type ScoreResultat = {
  score: number;
  rader: ScoreRad[];
  /** föreslagen nivå utifrån trösklarna */
  niva: "bygg_demo" | "kvalificerad" | "lag_prio";
};

/** Lead med beräknad score-uppdelning (det API:t returnerar till vyerna). */
export type LeadMedScore = Lead & { berakning: ScoreResultat };

/** Standard-envelope (som github-read/onboarding) — aldrig throw mot klienten. */
export type Envelope<T> =
  | ({ ok: true } & T)
  | { ok: false; reason: string; message: string };
