/**
 * Kundnamn → repo-slug. Gemener, bindestreck, inga specialtecken.
 * Svenska diakriter translittereras via NFD-normalisering (å/ä→a, ö→o, é→e …).
 * Ex: "Fanérverket" → "fanerverket" → repo "kund-fanerverket".
 */
export function toSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // ta bort diakritiska kombinationsmärken
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // allt annat → bindestreck
    .replace(/^-+|-+$/g, ""); // trimma ledande/avslutande bindestreck
}

/** Fullt repo-namn: alltid prefixet "kund-". */
export function toRepoName(name: string): string {
  const slug = toSlug(name);
  return slug ? `kund-${slug}` : "";
}
