# Nortropic — digital närvaro: erbjudande, strategi & luckor

*Samlad översikt (2026-07-22). Vad Nortropic erbjuder för en kunds digitala närvaro, vad som medvetet valts bort, vad som är genuina luckor, och hur det positioneras. Förankrat i omvärldsbevakning mot vad fullservice-byråer erbjuder 2026.*

---

## KÄRNPOSITIONERING (det viktigaste)

Nortropic är INTE en fullservice-marknadsbyrå. Fullservice-byråer (Thrive med 200+ specialister, Hibu med 70 000 kunder) är "outsourca hela din marknadsavdelning till oss för alltid" — det kräver personal, löpande åtaganden, och är en annan business.

**Nortropics nisch:** bygg den ägda digitala grunden exceptionellt bra och systematiskt (sajt, GBP, spårning, verktyg), ge kunden ÄGANDESKAP + guider att sköta det själv. Motsatsen till evigt beroende.

**Det underutnyttjade budskapet — ÄGANDESKAP:** Nortropic bygger på Next.js, kunden äger domänen, koden ligger i kundens repo. Det är ÄKTA ägandeskap. Billiga byråer bygger på stängda plattformar (Squarespace, Wix, Webflow, GoHighLevel) och "hyr" i praktiken ut sajten — kunden kan inte ta den någonstans. → SÄLJ detta: "din sajt är DIN, inte hyrd. Du äger koden, domänen, allt." Ingen kostnad att börja säga, stark differentiering.

---

## VAD NORTROPIC ERBJUDER (byggt/klart)

### 1. Webbsajt (kärnan)
Next.js, lead-fokuserad, mobil-först, snabb (Vercel edge), egen domän (kunden köper). Byggd av agent-pipeline, granskad mot kvalitetsgrindar. Kunden äger koden.

### 2. Google Business Profile (GBP)
Uppsättning + optimering enligt 2026 best practice. Primärkategori (viktigaste rankingfaktorn), tjänster, attribut, beskrivning. Kunden gör videoverifieringen själv (guide finns).
- Material: PROMPT-GBP, KUND-LATHUND-GBP

### 3. Recensioner
QR-kod direkt till recensionssida + guide till kundens kunder om vad en bra recension innehåller.
- Material: QR-RECENSION-GUIDE

### 4. Statistik & spårning
- Search Console (alla sajter, gratis, cookiefritt)
- Cookiefri besöksstatistik (Umami självhostad på Railway / Plausible) för icke-Ads-sajter
- GA4 + Enhanced Conversions + Consent Mode v2 för Ads-kunder
- Material: CHECKLISTA-ANALYTICS-SETUP, KUND-LATHUND-STATISTIK, KUND-LATHUND-COOKIES-GDPR

### 5. Annonsering (setup nu, hantering senare)
- Google Ads + Meta: setup av spårning nu, förberett för löpande hantering längre fram
- Material: GUIDE-GOOGLE-ADS-NYBORJARE, GUIDE-META-ADS-NYBORJARE, ANNONSKANALER-SVENSK-SMAFORETAGARE

### 6. Teknisk SEO (i bygget)
LocalBusiness-schema, sitemap, robots.txt, snabb/mobil/HTTPS. NAP på sajten.

---

## INFRASTRUKTUR (delning mellan Vercel/Railway/Cloudflare — förtydligat)
- **Kundsajter → Vercel** + kundens egen domän pekad dit. INGEN Cloudflare (Vercel har CDN/DNS/SSL/säkerhet inbyggt — Cloudflare vore dubbelt, oavsett trafik).
- **Nortropics egna verktyg (dashboard, onboarding) → Railway** + Cloudflare framför (Railway är ren host utan inbyggt edge → Cloudflare tillför DNS/CDN/säkerhet där).
- **Regel:** Cloudflare behövs när hosten INTE redan har CDN/DNS/säkerhet — inte "vid mycket trafik". Vercel har det, Railway inte lika färdigt.
- Kunden KÖPER sin egen domän (renare ansvar, kunden äger, Nortropic ej beroende-punkt).
- Stack: Next.js, Vercel, Railway, Cloudflare, Resend, n8n, Supabase.

---

## MEDVETET BORTVALT (och VARFÖR — dessa är rätt att sakna)

Fullservice-byråer erbjuder dessa. För Nortropics kunder (svenska hantverkare/tjänsteföretag) är de fel:
- **Löpande social media-hantering** — kräver bemanning, skapar kanal ingen sköter bra.
- **Blogg / content-abonnemang** — "blogg ingen skriver" slår inte GBP+recensioner.
- **Hyperlokala landningssidor per område** — byrå-uppförsäljning, för mycket maskineri.
- **AI-chat / live chat** — för enmansfirma är bra formulär + telefon bättre än obemannad chatt.
- **CRM-integration** — overkill för målgruppen.
- **Fullservice "outsourcad marknadsavdelning"** — kräver personal, drar bort från kärnstyrkan (systematiskt bygge). Detta är den STORA fällan att inte falla i.

Att lägga till dessa vore att missförstå vad Nortropic är.

---

## GENUINA LUCKOR (värda att överväga)

### LUCKA 1 — E-post/nyhetsbrev (den tydligaste, passar filosofin)
Den enda ÄGDA kanalen — ingen algoritm mellan kund och deras kunder. Sociala plattformar stryper organisk räckvidd; e-post gör de inte. För en hantverkare: samla kunders mejl, skicka kvartalsbrev ("dags för takservice?"), äg relationen.
- **Du har redan Resend i stacken** → infrastrukturen finns, låg tröskel att fylla.
- Enkel version: mejlinsamling på sajten + ett enkelt kvartalsbrev. Ej stort content-maskineri.
- Passar ägandeskap-filosofin perfekt (ägd kanal).

### LUCKA 2 — llms.txt / GEO (framåtblickande, systemvänlig)
Folk söker via AI nu (ChatGPT, Googles AI Overviews) — "bra snickare i Luleå?". llms.txt = nytt robots.txt för AI-crawlers, gör sajten läsbar/rekommenderbar för språkmodeller. Genererbar fil per sajt (som sitemap/robots). Ingen konkurrent gör det än → positionering: "optimerar för AI-sök, inte bara Google." (Retro-ärende AA1.)

### LUCKA 3 — NAP-konsistens över kataloger (löpande tjänst)
NAP finns på sajten, men inte nödvändigtvis konsekvent över Hitta.se/Eniro/Facebook/branschkataloger. Inkonsekvens sänker Googles förtroende. Manuell tjänst/checklista, kandidat för framtida agent-del. (Retro-ärende AA3.)

### Halvt täckt — reputation bortom GBP
GBP-recensioner täckt. Trustpilot/flera plattformar = troligen overkill för hantverkare, men finns om större kund frågar.

---

## FRAMTIDA (noterat, bygg EJ nu)

- **Löpande annonshantering** (Google Ads + Meta) — planerad tjänstelinje längre fram. Setup byggs nu, hantering när mönstret är känt.
- **Marknadsförings-agent i pipelinen** — GBP+analytics+schema+llms.txt+NAP+annonsspårning börjar likna en samlad "digital synlighet"-tjänst som långt fram kunde bli ett systemkapitel/agent. MEN: kör tjänsterna MANUELLT med guiderna först → lär mönstret → agent sen (samma disciplin som kund-repo/Graphify: mät innan bygg).

---

## SAMLAD DOM
Nortropic har ett anmärkningsvärt komplett erbjudande för sin nisch. Det mesta fullservice-byråer listar utöver detta är antingen medvetet (och rätt) bortvalt, eller framtida. Den enda äkta pusselbiten värd att fylla snart är E-POST (infrastrukturen finns via Resend). Ägandeskap-budskapet är en gratis differentiering att börja använda direkt. Den stora risken är inte att sakna tjänster — det är att driva mot fullservice-byrå och tappa kärnstyrkan: systematiskt, vasst bygge med kundägandeskap.
