/**
 * Bransch-taxonomi för insamlingssvepet. Klient-säker statisk data. Varje kategori kör
 * antingen via Googles kanoniska place type (`includedType` — = GBP-kategorin, robust och
 * språkoberoende) ELLER via en svensk fritext-term (`textTerm`) för de kategorier Googles
 * Table A saknar. OBS: städfirma + trädgård saknas i Table A men är de TVÅ högsta
 * no-website-kategorierna → därför fritext-fallback. n8n väljer query utifrån vilket fält som satt.
 *
 * Kurerad mot "lokala SMB som ofta saknar hemsida och tjänar på en" (research 2026-07).
 */
export type Kategori = {
  id: string;
  label: string;
  grupp: string;
  /** Googles place type (Table A) — används som includedType i Places. */
  includedType?: string;
  /** Svensk fritext-sökterm — används när Table A saknar kategorin. */
  textTerm?: string;
};

export const KATEGORIER: Kategori[] = [
  // Bygg & hantverk
  { id: "elektriker", label: "Elektriker", grupp: "Bygg & hantverk", includedType: "electrician" },
  { id: "rormokare", label: "Rörmokare / VVS", grupp: "Bygg & hantverk", includedType: "plumber" },
  { id: "malare", label: "Målare", grupp: "Bygg & hantverk", includedType: "painter" },
  { id: "taklaggare", label: "Takläggare", grupp: "Bygg & hantverk", includedType: "roofing_contractor" },
  { id: "byggfirma", label: "Byggfirma", grupp: "Bygg & hantverk", textTerm: "byggfirma" },
  { id: "snickare", label: "Snickare", grupp: "Bygg & hantverk", textTerm: "snickare" },
  { id: "golvlaggare", label: "Golvläggare", grupp: "Bygg & hantverk", textTerm: "golvläggare" },
  { id: "plattsattare", label: "Plattsättare", grupp: "Bygg & hantverk", textTerm: "plattsättare" },
  { id: "murare", label: "Murare", grupp: "Bygg & hantverk", textTerm: "murare" },
  { id: "markarbete", label: "Markarbete", grupp: "Bygg & hantverk", textTerm: "markarbete" },
  { id: "fonsterputs", label: "Fönsterputsning", grupp: "Bygg & hantverk", textTerm: "fönsterputsning" },
  { id: "lassmed", label: "Låssmed", grupp: "Bygg & hantverk", textTerm: "låssmed" },

  // Hem & fastighet
  { id: "stadfirma", label: "Städfirma", grupp: "Hem & fastighet", textTerm: "städfirma" },
  { id: "flyttfirma", label: "Flyttfirma", grupp: "Hem & fastighet", includedType: "moving_company" },
  { id: "tradgard", label: "Trädgård / anläggning", grupp: "Hem & fastighet", textTerm: "trädgårdsanläggning" },
  { id: "fastighetsskotsel", label: "Fastighetsskötsel", grupp: "Hem & fastighet", textTerm: "fastighetsskötsel" },

  // Fordon
  { id: "bilverkstad", label: "Bilverkstad", grupp: "Fordon", includedType: "car_repair" },
  { id: "biltvatt", label: "Biltvätt", grupp: "Fordon", includedType: "car_wash" },
  { id: "dackverkstad", label: "Däckverkstad", grupp: "Fordon", textTerm: "däckverkstad" },
  { id: "bilrekond", label: "Bilrekond", grupp: "Fordon", textTerm: "bilrekond" },

  // Skönhet & hälsa
  { id: "frisor", label: "Frisör", grupp: "Skönhet & hälsa", includedType: "hair_salon" },
  { id: "barberare", label: "Barberare", grupp: "Skönhet & hälsa", includedType: "barber_shop" },
  { id: "nagelsalong", label: "Nagelsalong", grupp: "Skönhet & hälsa", includedType: "nail_salon" },
  { id: "spa", label: "Spa", grupp: "Skönhet & hälsa", includedType: "spa" },
  { id: "massage", label: "Massage", grupp: "Skönhet & hälsa", textTerm: "massage" },
  { id: "tandlakare", label: "Tandläkare", grupp: "Skönhet & hälsa", includedType: "dentist" },
  { id: "fysioterapeut", label: "Fysioterapeut", grupp: "Skönhet & hälsa", includedType: "physiotherapist" },
  { id: "veterinar", label: "Veterinär", grupp: "Skönhet & hälsa", includedType: "veterinary_care" },

  // Mat & servering
  { id: "restaurang", label: "Restaurang", grupp: "Mat & servering", includedType: "restaurant" },
  { id: "cafe", label: "Café", grupp: "Mat & servering", includedType: "cafe" },
  { id: "bageri", label: "Bageri", grupp: "Mat & servering", includedType: "bakery" },

  // Handel
  { id: "jarnhandel", label: "Järnhandel", grupp: "Handel", includedType: "hardware_store" },
  { id: "mobelbutik", label: "Möbelbutik", grupp: "Handel", includedType: "furniture_store" },
  { id: "blomsterhandel", label: "Blomsterhandel", grupp: "Handel", textTerm: "blomsterhandel" },

  // Övriga tjänster
  { id: "fotograf", label: "Fotograf", grupp: "Övriga tjänster", textTerm: "fotograf" },
  { id: "akeri", label: "Åkeri", grupp: "Övriga tjänster", textTerm: "åkeri" },
];

/** Kategorierna grupperade (för väljaren i svep-planeraren). */
export const KATEGORI_GRUPPER: { grupp: string; kategorier: Kategori[] }[] = (() => {
  const ordning = ["Bygg & hantverk", "Hem & fastighet", "Fordon", "Skönhet & hälsa", "Mat & servering", "Handel", "Övriga tjänster"];
  return ordning.map((grupp) => ({ grupp, kategorier: KATEGORIER.filter((k) => k.grupp === grupp) }));
})();
