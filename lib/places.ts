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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Text Search (Pro). Paginerar upp till maxPages sidor (20/sida → upp till 60, Googles tak).
 * nextPageToken blir giltig först efter ~2s → paus mellan sidor. Returnerar antal anrop
 * så workern kan logga dem mot dagsbudgeten.
 */
export async function textSearch(textQuery: string, includedType?: string, maxPages = 2): Promise<{ places: PlaceSok[]; calls: number }> {
  if (!KEY) return { places: [], calls: 0 };
  const places: PlaceSok[] = [];
  let calls = 0;
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const body: Record<string, unknown> = { textQuery, languageCode: "sv", regionCode: "SE" };
    if (includedType) body.includedType = includedType;
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": SEARCH_MASK },
      body: JSON.stringify(body),
    });
    calls++;
    if (!res.ok) throw new Error(`Text Search ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    for (const p of (data.places ?? []) as PlaceSok[]) places.push(p);

    pageToken = data.nextPageToken;
    if (!pageToken) break;
    await sleep(2100);
  }
  return { places, calls };
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
