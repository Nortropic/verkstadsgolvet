# Nortropic — integrationer & tjänster att känna till

*Komplement till verktygslistan. Fokus på INTEGRATIONER (mejl, SMS, kalender, betalning m.m.) — vad som finns, bra alternativ, och vad att överväga. Taggar: [gratis] / [freemium] / [betalt]. ★ = passar din stack/modell särskilt väl. 🇪🇺/🇸🇪 = EU/svenskt (matchar din integritetspositionering). Priser ändras — verifiera innan du binder upp dig. Uppdaterad 2026-07-22.*

---

## TRANSAKTIONSMEJL (skicka mejl från kod: kvitton, formulär, notiser)
Det du redan gör med Resend. Alternativen, om behovet växer eller en kund kräver annat:
- **Resend ★**  [freemium] – Din nuvarande. Bästa developer-upplevelsen på marknaden, React Email-mallar, TypeScript-SDK, webhooks, regional sändning (US/EU 🇪🇺). Gratis 3 000 mejl/mån, från $20/mån för 50 000. Nackdel: relativt ny, ingen SMTP-relay, ingen inbound-hantering.
- **Postmark**  [betalt] – Kung på LEVERANSSÄKERHET för transaktionsmejl. Om mejl ALLTID måste fram (lösenordsåterställning, bokningsbekräftelser). Endast mejl (ingen SMS). Från ~$15/mån/10k. Kostar mer vid volym.
- **Amazon SES**  [betalt] – Billigast vid skala ($0,10/1000 mejl, 62k gratis/mån från EC2/Lambda). Men kräver teknisk setup och egna e-postingenjörer. Överkurs för dig nu.
- **Brevo** 🇪🇺  [freemium] – Allt-i-ett: transaktion + nyhetsbrev + SMS + CRM i ett. Franskt (EU-data). Bra om en kund vill ha allt samlat. Gratis 300 mejl/dag.
- **MailerSend**  [freemium] – Byggt för transaktionsmejl MED visuell mallbyggare (icke-tekniker kan redigera). Buntad SMS. Bra om kund vill pilla i mallar själv.
- **SendGrid (Twilio)**  [freemium] – "Ingen fick sparken för att välja SendGrid". Enterprise-standard, SMS via Twilio-moderbolaget. Tung UI för små team. Överkurs.
- **GatewayAPI** 🇩🇰  [betalt] – Dansk, SMS + transaktionsmejl, EU-hostat. Nordiskt alternativ värt att känna till.

## NYHETSBREV / E-POSTMARKNADSFÖRING (utskick till kunders kunder — DIN LUCKA)
För den ägda e-postkanalen (identifierad lucka). Skilj från transaktionsmejl:
- **MailerLite** 🇪🇺  [freemium] – Prisvärt, enkelt, EU. Bra för kunder som vill ha kvartalsbrev. Gratis upp till 1000 kontakter.
- **Buttondown**  [freemium] – Minimalistiskt, utvecklarvänligt, integritetsfokuserat. Passar din estetik.
- **Brevo** 🇪🇺  [freemium] – Se ovan; om du vill ha transaktion + nyhetsbrev från samma ställe.
- **Resend Broadcasts ★**  [freemium] – Resend har lagt till nyhetsbrevs-funktion. VÄRT ATT KOLLA FÖRST eftersom du redan har Resend — kanske täcker luckan utan ny tjänst.
- **Ghost** 🇪🇺  [betalt] – Om en kund vill ha nyhetsbrev + blogg + medlemskap i ett. Self-hostbart.

## SMS & TELEFONI (notiser, bokningspåminnelser, lead-flöde)
Du kör 46elks. Alternativen:
- **46elks ★** 🇸🇪  [betalt] – Din nuvarande. SVENSKT, EU-data (utanför US CLOUD Act — stark integritetspoäng), SMS/MMS/röst, interaktiv dokumentation. Perfekt matchning för din positionering. Behåll.
- **GatewayAPI** 🇩🇰  [betalt] – Danskt, SMS + mejl, EU. Nordiskt alternativ.
- **Twilio**  [betalt] – Global standard, 180+ länder, mest dokumentation/integrationer, SMS+röst+WhatsApp+Verify (2FA). Men: dyrare, komplex prissättning (avgifter ovanpå), US-baserat (sämre integritetsstory för dig). Bra att KÄNNA TILL, ej byta till.
- **Sinch** 🇸🇪  [betalt] – SVENSKT (fd CLX), direkta operatörsrelationer i 200+ länder. För internationell volym. Enterprise.
- **Telnyx / Plivo / Vonage**  [betalt] – Twilio-alternativ, billigare, developer-vänliga. Relevanta om volym växer och pris pressar.

## KALENDER & BOKNING (Nästa nivå-tjänst)
- **Cal.com ★** 🇪🇺  [freemium] – Öppen källkod, self-hostbar på Railway (din profil!), EU. Bokningssystem för kunder. Din bästa bygg-sten för bokning.
- **Google Calendar API ★**  [gratis] – Redan i din stack. Bygg bokningsunderlag, synka tider. Bra i tidigt skede.
- **Calendly**  [freemium] – Snabbast att sätta upp, kommersiellt. När kund vill ha det NU utan bygge.
- **Cal.com + Google Calendar-synk** – vanligt mönster: Cal.com som gränssnitt, Google som kalender-backend.
- **Bokadirekt** 🇸🇪  [betalt] – Svenskt, stort inom frisör/skönhet/verkstad. Default: sajten INTEGRERAR kundens befintliga Bokadirekt, bygger ej eget.
- **Nylas / Cronofy** 🇪🇺  [betalt] – Kalender-API:er som kopplar flera kalendersystem (Google/Outlook/iCloud) via ett API. Om du bygger avancerad boknings-synk över flera kalendrar.

## BETALNING (om kund vill ta betalt online — Nästa nivå / e-handel)
Ej i din nuvarande lista, men värt att känna till när e-handel/bokning-med-betalning dyker upp:
- **Stripe ★**  [betalt] – Global standard, bäst developer-upplevelse, Next.js-vänligt. Kort, prenumerationer, fakturor. Default-valet för utvecklare.
- **Swish (via förmedlare)** 🇸🇪  [betalt] – Svenskarnas favorit. Nås via förmedlare (Swish Handel + PSP). Kunder FÖRVÄNTAR sig det i Sverige — viktigt att känna till.
- **Klarna** 🇸🇪  [betalt] – Svenskt, "betala senare/faktura". Stark i svensk e-handel, kunder litar på det.
- **Stripe + Klarna/Swish** – vanligt: Stripe som motor, med Klarna/Swish som betalmetoder ovanpå.
- **Paddle**  [betalt] – "Merchant of record" — hanterar moms/VAT åt dig. Bra för digitala produkter om du vill slippa momskrångel.

## E-HANDEL / WEBBSHOP (STRATEGISKT VÄGVAL — läs noten först)
**VIKTIGT:** e-handel är både en fälla och en möjlighet. Fällan: att bygga fullständiga webbshoppar drar Nortropic från "vassa tjänstesajter med kundägande" till "e-handelsbyrå" (lager, frakt, returer, moms, support = annan business, samma scope-creep som fullservice/IT-leverantör). Möjligheten: ENKEL betalning ovanpå sajter du redan bygger. Tre vägar efter kundstorlek:
- **Väg 1 — Stripe Checkout / Snipcart ★ (DIN DEFAULT).** För tjänsteföretag som vill ta betalt ENKELT: presentkort, liten produktlinje, deposition, betala-för-tjänst. Ovanpå din befintliga Next.js-sajt, inom din stack, kundägt. INGEN Shopify behövs. "Nästa nivå"-material, ej ny affärsmodell.
  - **Stripe Checkout ★** [betalt] – Färdig betalsida, minimal kod. + Swish/Klarna som metoder (svensk kund förväntar Swish).
  - **Snipcart** [betalt] – Lägg "köp"-knappar på vilken sajt som helst, hanterar kundvagn/checkout. Bra för handfull produkter.
  - **Foxy.io** [betalt] – Liknande, flexibelt, för enkel produktförsäljning utan full plattform.
- **Väg 2 — Shopify (när kunden FAKTISKT är en butik).** Om kund har riktig e-handel (många produkter, lager, frakt, returer) → Shopify är rätt, bygg INTE från grunden. Live på en helg, allt skött (hosting/SSL/PCI/CDN). Men ~200-500$/mån i app-avgifter, och DÅ är du Shopify-konsult, ej Next.js-byggare. Rätt verktyg för butik — men ej din kärnmodell. Hänvisa/samarbeta hellre än att bli e-handelsbyrå.
  - **Alternativ till känna till:** WooCommerce (WordPress-baserat, om kund redan har WP), BigCommerce (mid-market), Swell (headless-vänligt).
- **Väg 3 — Headless (Your Next Store / Shopify Hydrogen) — ÖVERKURS, undvik nu.** Next.js-storefront + commerce-backend. Kraftfullt men kräver oftast Shopify Plus (dyrt), för stora butiker (>500k$/år). Inte din marknad.
- **Tumregel:** under ~100k/år utan teknik → Shopify är snabbast för EN RIKTIG butik; men för dina TJÄNSTEkunder som vill sälja lite → Väg 1 (Stripe) inom din stack. Bygg aldrig full webbshop från grunden själv — det är fällan.

## FORMULÄR (om du inte vill koda hanteringen)
- **Resend ★**  [freemium] – Du hanterar formulär via Resend redan.
- **Formspree / Web3Forms**  [freemium] – Enkla formulärbackends utan egen kod.
- **Basin / Formcarry**  [freemium] – Fler alternativ, spam-skydd inbyggt.

## AUTOMATION & KOPPLINGAR
- **n8n ★** 🇪🇺/🇩🇪  [freemium] – Din motor. Self-hostad på Railway, EU. Lead → SMS → kalender → sheet.
- **Zapier / Make** 🇪🇺(Make)  [freemium] – Färdiga integrationer utan self-hosting. Make är EU-baserat. Om du vill koppla snabbt utan att bygga i n8n.
- **Trigger.dev ★**  [freemium] – Kod-först bakgrundsjobb/automation, developer-vänligt, passar Next.js. Modernt alternativ till n8n för kod-tunga flöden.

## CRM / KUNDHANTERING (när du växer — men VAR FÖRSIKTIG, lätt scope-creep)
- **Google Sheets ★**  [gratis] – Din nuvarande. Räcker LÅNGT. Börja aldrig tyngre än du behöver.
- **Airtable**  [freemium] – Sheets++ med databas-känsla. Om kundhantering växer.
- **Attio / Folk** 🇪🇺(Folk)  [freemium] – Moderna, lätta CRM om du vill ha något mellan Sheets och Salesforce.
- (Undvik tunga CRM som HubSpot/Salesforce — overkill, scope-creep, mot din modell.)

## AUTH / INLOGGNING (om Nästa nivå kräver kundinlogg)
- **Auth.js (NextAuth) ★**  [gratis] – Standard för Next.js. Din default om inloggning behövs.
- **Clerk ★**  [freemium] – Färdig auth med UI, snabbast att sätta upp, Next.js-vänligt.
- **Supabase Auth ★**  [freemium] – Du har Supabase i stacken — auth ingår. Naturligt val om du redan kör Supabase.

## DATABAS (du har Supabase — alternativ att känna till)
- **Supabase ★** 🇪🇺(EU-region)  [freemium] – Din nuvarande. Postgres + auth + storage. Välj EU-region för integritet.
- **Neon / Railway Postgres ★**  [freemium] – Postgres, Railway-nära. Om du vill hålla allt på Railway.
- **Turso**  [freemium] – SQLite vid edge, lätt och snabbt för enklare behov.

---

## PRIORITERING — vad som faktiskt är värt att kolla NU
1. **Resend Broadcasts** – kolla om det täcker nyhetsbrev-luckan utan ny tjänst (du har redan Resend). ★ FÖRST.
2. **Cal.com self-hosted** – bygg-sten för Nästa nivå-bokning, passar Railway/EU.
3. **Stripe + Swish/Klarna** – känn till inför första kunden som vill ta betalt (svensk kund förväntar Swish). För ENKEL försäljning = Väg 1 (Stripe Checkout/Snipcart), ej Shopify. Bygg aldrig full webbshop från grunden (fällan).
4. **Supabase Auth** – om Nästa nivå kräver inlogg, du har redan Supabase.
Resten: känn till att de finns, plocka in vid FAKTISKT behov — inte i förväg (samma disciplin som resten av systemet: verktyg mot verkligt problem, ej hype).

## INTEGRITETSNOT (din positionering)
Där det är enkelt, välj EU/svenskt (🇪🇺/🇸🇪): 46elks (sv), Supabase EU-region, Make/n8n (EU), Brevo/MailerLite (EU). Det stärker "kundägd, integritetssäker"-budskapet och undviker US CLOUD Act-frågor. Inte dogmatiskt — Stripe/Resend är för bra för att välja bort — men en tumregel vid likvärdiga val.
