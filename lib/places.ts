/**
 * Google Places API (New) — SERVER-ONLY. Nyckeln (PLACES_API_KEY) läses ur miljön och
 * får ALDRIG nå klienten / NEXT_PUBLIC_. Två anrop:
 *  - textSearch: BILLIG Pro-mask (id, namn, websiteUri) → filtrera bort de med sajt först.
 *  - placeDetails: Enterprise-mask (reviews m.m.) — körs BARA på kandidater (kostnadsstyrning).
 * Graceful: saknas nyckel returneras null/tomt.
 */
const KEY = process.env.PLACES_API_KEY;

export function placesConfigured(): boolean {
  return Boolean(KEY);
}

// Pro-tier: bara det vi behöver för att hitta + filtrera. Lägg ALDRIG till rating/reviews här.
const SEARCH_MASK = "places.id,places.displayName,places.websiteUri";
// Enterprise+atmosphere (reviews) — bara på kandidater.
const DETAILS_MASK =
  "id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,rating,userRatingCount,businessStatus,googleMapsUri,reviews,regularOpeningHours,photos,editorialSummary";

export type PlaceSok = { id: string; displayName?: { text?: string }; websiteUri?: string };

/** Text Search (Pro). Returnerar upp till 20 träffar (1 sida — v1 pagineras ej). */
export async function textSearch(textQuery: string, includedType?: string): Promise<PlaceSok[]> {
  if (!KEY) return [];
  const body: Record<string, unknown> = { textQuery, languageCode: "sv", regionCode: "SE" };
  if (includedType) body.includedType = includedType;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": SEARCH_MASK },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Text Search ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data.places ?? []) as PlaceSok[];
}

export type PlaceDetaljer = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  googleMapsUri?: string;
  reviews?: { publishTime?: string }[];
  regularOpeningHours?: unknown;
  photos?: unknown[];
  editorialSummary?: { text?: string };
};

/** Place Details (Enterprise+atmosphere). Ett anrop per kandidat. */
export async function placeDetails(placeId: string): Promise<PlaceDetaljer> {
  if (!KEY) throw new Error("PLACES_API_KEY saknas.");
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    method: "GET",
    headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": DETAILS_MASK },
  });
  if (!res.ok) throw new Error(`Place Details ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as PlaceDetaljer;
}
