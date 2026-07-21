# Analytics & spårning — setup-checklista (för Nortropic, internt)

*Teknisk uppsättning per kundsajt. TVÅ SPÅR: cookiefritt för sajter utan annonser, full spårning för Ads-kunder. Byggd så fundamentet BÄR framtida annonshantering (Google Ads + Meta) — gör det rätt från början, för Smart Bidding lever/dör på datakvalitet. Uppdaterad mot 2026 best practice.*

---

## GRUNDPRINCIP
Uppsättningen du gör NU är fundamentet all framtida annonshantering står på. En slarvig spårning betyder att varje framtida annonskrona styrs av felaktig data. Gör lager 1-3 ordentligt; hoppa lager 4 (server-side) tills en kund spenderar stort (~50k+/mån).

Den moderna stacken (varje lager gör lagren under mer exakt):
1. GA4 + Google-tagg (mät)
2. Enhanced Conversions (bättre matchning utan cookies)
3. Consent Mode v2 (EU-obligatoriskt)
4. Server-side tagging (SENARE — bara vid hög spend)

---

## SPÅR A — Sajt UTAN annonser (cookiefritt, ingen banner)
För rena informations-/tjänstesajter som inte kör Ads.

☐ **Google Search Console** — verifiera (DNS-post eller HTML-tagg vid bygget), skicka in sitemap. Gratis, cookiefritt, oumbärligt. Visar organisk sök-prestanda.
☐ **Cookiefri besöksstatistik** — Umami (självhostad på Railway, MIT, din stack) ELLER Plausible (betald, EU-hostad). Ingen cookie-banner behövs, GDPR-säkert out-of-the-box.
☐ **Ingen GA4, ingen cookie-banner** — håll det rent tills/om kunden vill annonsera.

## SPÅR B — Ads-kund (full spårning, kräver samtycke)
För kunder som kör (eller ska köra) Google Ads / Meta.

☐ **Google Search Console** — som ovan (organiska sidan, komplement till betald).
☐ **GA4-property** — egen data-stream per sajt. Aktivera Enhanced Measurement (scroll, utgående klick, filnedladdningar auto-spåras).
☐ **Google-tagg installerad** — via GTM (rekommenderas, flexibelt) eller direkt.
☐ **Konverteringar definierade** — vad är en "konvertering" för DENNA kund? Offertformulär skickat, samtal, bokning. Detta är kärnan — utan det är annonser blindflygning.
☐ **VÄLJ EN källa per konvertering** — ANTINGEN GA4-import TILL Google Ads, ELLER Google Ads native tag. ALDRIG båda för samma händelse utan deduplicering (transaction_id) → dubbelräknar, blåser upp ROAS, förstör datan. Vanligaste misstaget.
☐ **Enhanced Conversions** — skickar hashad förstapartsdata (mejl/telefon från formulär), förbättrar matchning utan cookies. Aktivera.
☐ **Consent Mode v2** — OBLIGATORISKT i EU. Kopplat till en riktig cookie-banner. KRITISKT: bristande Consent Mode v2 bryter spårningen TYST (inget felmeddelande) — annonspengar flyger blint. Pick "Advanced" om ingen juridisk anledning till annat.
☐ **Cookie-banner (CMP)** — inget spårnings-script får avfyras FÖRE samtycke. Använd en CMP som stödjer TCF v2.3 (v2.2 utfasad feb 2026).
☐ **Integritetspolicy** — måste namnge GA4/Google Ads, beskriva insamlad data, laglig grund. (Se GDPR-lathund — ej juridisk rådgivning.)

## FÖRBERED FÖR ANNONSHANTERING (Google Ads + Meta) — gör redan nu
Så fundamentet bär när du börjar sköta annonser:
☐ **Namnge konverteringar konsekvent** — samma struktur på alla kunder (t.ex. "lead_offert", "call", "booking") → lätt att hantera i skala.
☐ **Meta-förberedelse** — samma logik: Meta Pixel + Conversions API, samma Consent Mode. Sätt upp när kunden vill köra Meta, men bygg banner/samtycke så det redan täcker Meta.
☐ **GTM som nav** — installera via Google Tag Manager, ej hårdkodat, så nya taggar (Meta, konverteringar) läggs utan kodändring.
☐ **Dokumentera per kund** — vilka konverteringar, vilken källa, vilket samtycke. (Kan bo i kund-repot → syns i dashboarden senare.)

## VERIFIERING (obligatoriskt, hoppa aldrig)
☐ **Tag Assistant i produktion** — bekräfta att varje konvertering avfyras EXAKT en gång.
☐ **GA4 vs Google Ads matchning** — konverteringar ska matcha inom 10-20%. Gör de inte → något är trasigt, fixa FÖRE annonsering.
☐ **Pre-consent-kontroll** — öppna DevTools → Network, filtrera "google-analytics"/"collect", bekräfta INGET avfyras före samtycke. Runtime-bevis, inte bara inställningar.
☐ **Re-audit var 90:e dag** — särskilt efter CMS-/sajtändring (antag trasigt, bevisa motsatsen).

## VAD DU INTE GÖR
- Kör ALDRIG GA4-import + native tag för samma konvertering utan dedup.
- Låt ALDRIG script avfyras före samtycke (juridisk risk + trasig data).
- Bygg INTE server-side förrän spend motiverar det (~50k+/mån).
- Ge INTE kunden falsk trygghet att GDPR är "fixat" — de har eget ansvar (se GDPR-lathund).
