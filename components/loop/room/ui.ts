/**
 * ROOM-01 · Fabriksrummets EGET stilark (`rm-`), injicerat som ett ANDRA stiltagg-block
 * bredvid LOOP_CSS.
 *
 * ROOM-08 · MOBILT FÖRST — SAMMA RUM, INTE ETT MINDRE RUM
 * -------------------------------------------------------
 * Vid 390 px visas EXAKT samma markup som vid 1440 px. Media-frågorna får bara ARRANGERA om
 * ytorna; ingen regel tar bort en bevis- eller upplysningsyta, och det finns ingen mobilvariant
 * av rummet som visar färre fält. Den disciplinen bärs av tre saker i den här filen:
 *
 *   1. INGEN `display: none` PÅ EN BEVISYTA. Det enda som döljs i en media-fråga är
 *      ordningstalet `.rm-step-n` — ett PÅSTÅENDE OM LAYOUTEN, inte information ur snapshoten.
 *      Regeln ligger i 959-blocket och är frusen av ROOM-LAYOUT i tests/loop/room-shell.test.ts;
 *      efter SHREDDER-01C är talen sanna även i det intervallet, så det som utelämnas är ett
 *      SANT tal och aldrig en uppgift. Skälet står utskrivet vid regeln, inte här.
 *   2. INGÅNGEN LEDER I VARJE SMAL VY (SHREDDER-01C). Vid ≤959 px är scenen EN spalt, och då är
 *      läsordningen hela layouten: huvud → uppmärksamhet → mata maskinen → kön → arbetet med sin
 *      orsakskedja och sin kommandoyta → hyllan → tidslinjen → strömmen. Fokusbanan lyfts INTE
 *      längre över ingången vid 720–959 px: ägarkriteriet — det ska vara uppenbart VAR ARBETE
 *      KOMMER IN, vid varje bredd — står över ROOM-01:s tidigare surfplatteval, och `order`
 *      skrivs därför ut som noll på fokusbanan i hela intervallet ≤959 px.
 *   3. TUMSTORA TRÄFFYTOR OCH INGEN SIDLED-SCROLL PÅ SIDAN. Rummets EGNA vägar till bevisen —
 *      upplysningsytan (`<details>`) och köns genväg till inlämningen — har minst samma höjd som
 *      rummets primära kontroll (`.rm-cta`) i VARJE vy, som basregler: en bevisytas åtkomlighet
 *      får inte bero på fönstrets bredd. Husets egna komponenter inuti rummet lyfts bara i de
 *      smala vyerna, av ett utskrivet skäl (se 959-blocket). Bred mono-text (SHA:er, JSON) bryts
 *      eller scrollar i SIN EGEN behållare — som dessutom går att nå med tangentbordet.
 *
 * BINDANDE REGLER SOM FILEN BÄR
 * -----------------------------
 * · components/loop/ui.ts och LOOP_CSS RÖRS INTE. Rummet lägger till en egen namnrymd i stället
 *   för att ändra Maskinens etablerade regler — det som redan är provat ska förbli provat.
 * · Endast BEFINTLIGA CSS-variabler ur app/globals.css används. Inga nya tokens, inga fristående
 *   färger, ingen ändring i globals.css.
 * · INGET procenttecken förekommer i filen: bredder anges i fr/minmax/px och radlängder i ch.
 *   Ingen framstegsstapel, ingen rörelse och ingen fejkad liveness-markör finns här.
 * · Brytpunkterna är Maskinens egna (1279 / 959 / 719 px). Inga nya brytpunkter införs.
 * · Bred teknisk text scrollar i SIN EGEN behållare (`rm-scroll-x`) — sidan får aldrig scrolla
 *   i sidled vid 1440, 900 eller 390 px.
 * · Tangentbordsfokus syns på allt som går att fokusera, via husets `--focus-ring`.
 */

/** Namnrymdens prefix, bärt som data så att provet kan mäta det i stället för att anta det. */
export const ROOM_CSS_PREFIX = "rm-";

export const ROOM_CSS = `
.rm-room { display: flex; flex-direction: column; gap: var(--gap-lg); }

/* ── Rummets huvud ─────────────────────────────────────────────────────────── */
.rm-head { display: flex; flex-direction: column; gap: var(--gap-sm); }
/* Rubrik + källa på en rad; källan bryts till egen rad först när bredden inte räcker. */
.rm-head-top { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; min-width: 0; }
.rm-head-title { font-size: var(--fs-heading); line-height: var(--lh-heading); font-weight: 600;
  color: var(--text-primary); margin: 0; }
.rm-head-intro { margin: 0; font-size: 12.5px; line-height: 18px; color: var(--text-secondary);
  max-width: 82ch; overflow-wrap: anywhere; }
.rm-head-note { margin: 0; font-size: 11px; line-height: 16px; color: var(--text-muted);
  max-width: 96ch; overflow-wrap: anywhere; }

/* ── Uppmärksamhet ────────────────────────────────────────────────────────────
   RADER, INTE KORT. Posterna pekar ut något som redan står i kolumnerna; blir de kort med egen
   rubrik och eget stycke trycker de ned rummets arbetsytor under vikningen — och en operatör som
   inte ser sitt arbete letar i stället för att arbeta. Varje post ryms därför på en rad: märke,
   uppgifts-id, klartext. Ingen information är borta, den är bara inte längre ett eget kort. */
.rm-attention { display: flex; flex-direction: column; gap: 6px; background: var(--bg-surface-0);
  box-shadow: var(--hairline); border-radius: var(--radius-card); padding: 10px 12px; }
.rm-attention-heading { margin: 0; font-family: var(--font-mono); font-size: 10.5px;
  letter-spacing: 1.3px; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; }
.rm-attention-list { list-style: none; margin: 0; padding: 0; display: flex;
  flex-direction: column; gap: 5px; }
.rm-attention-item { display: flex; flex-wrap: wrap; align-items: baseline; gap: 3px 10px;
  background: var(--bg-surface-1); box-shadow: var(--hairline);
  border-radius: var(--radius-control); padding: 5px 9px; min-width: 0; }
.rm-attention-item.mk-tone-warning { background: var(--tint-warning-bg);
  box-shadow: inset 0 0 0 1px var(--tint-warning-border); }
.rm-attention-item.mk-tone-danger { background: var(--tint-danger-bg);
  box-shadow: inset 0 0 0 1px var(--tint-danger-border); }
.rm-attention-text { font-size: 12px; line-height: 17px; color: var(--text-secondary);
  min-width: 0; overflow-wrap: anywhere; }
.rm-attention-ids { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);
  overflow-wrap: anywhere; }

/* ── Rummets scen: in → arbete → ut ────────────────────────────────────────── */
/* TVÅ banor sida vid sida: ingången och arbetet. Utmatningen är en hylla UNDER scenen, i full
   bredd — se MaskinShell. Med tre smala spalter blev höjdskillnaden mellan en lång kö och en kort
   utmatning drygt en skärmhöjd tomt rutnät till höger. */
.rm-stage { display: grid; gap: var(--gap-md); align-items: start;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.55fr); }
.rm-lane { display: flex; flex-direction: column; gap: var(--gap-sm); min-width: 0; }
/*
  BANANS EGEN ORDNING ÄR DOM-ORDNINGEN: stegetikett → ytan → notis.

  Kolumnerna låg tidigare som GRID-barn i .mk-cols, och LOOP_CSS ordnar dem där för de smala
  vyerna (.mk-col-current får order -1 vid 959 px, .mk-col-backlog och .mk-col-completed får
  order 1 respektive 2 vid 719 px). I rummet är samma kolumner i stället FLEX-barn i en bana —
  och order gäller flexbarn precis som gridbarn. Utan den här regeln hoppar aktuell uppgift ovanför sin egen
  etikett "2 · arbetet" vid surfplattans bredd, och notisen under utmatningen hamnar ovanför
  kolumnen vid 390 px: berättelsen tappar sin ordning exakt i de vyer som granskas.

  Ordningen nollställs därför HÄR, i rummets eget stilark, med en mer specifik väljare
  (0,2,0 mot LOOP_CSS 0,1,0). components/loop/ui.ts rörs inte: den regeln är riktig för det
  rutnät den skrevs för, och en skiva som skriver om en annan skivas provade stilark hade
  flyttat problemet i stället för att lösa det. Regeln står utanför media-blocken med flit —
  media-frågor höjer inte specificitet, så en enda regel täcker båda brytpunkterna och även
  en framtida brytpunkt som ännu inte finns.
*/
.rm-lane > .mk-col { order: 0; }
.rm-step { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 1.4px;
  text-transform: uppercase; color: var(--text-muted); }
/* Ordningstalet är ett påstående om layouten — se RoomStep.tsx. Efter SHREDDER-01C leder
   ingången i varje vy, så 1, 2, 3 är sant överallt; talet utelämnas ändå i EXAKT ett intervall
   (720–959 px), eftersom ROOM-LAYOUT fryser just den regeln. Skälet står vid regeln i
   959-blocket nedan, och 719-blocket EFTER det visar talet igen. */
.rm-step-n { color: var(--text-disabled); }
/* Mitten är rummets blick: samma tokens, men lyft ur sidan så att den läses först. */
.rm-lane-focus .mk-col { box-shadow: inset 0 0 0 1px var(--border-strong),
  0 10px 26px -12px rgba(0, 0, 0, 0.7); padding: var(--pad-card) 20px; }
.rm-lane-focus .mk-col-title { color: var(--text-primary); }
/* Sidorna är stödytor och ska INTE väga lika tungt som mitten. */
.rm-lane-in .mk-col, .rm-lane-out .mk-col { background: var(--bg-surface-0); }
/*
  KÖN ÄR EN LISTA ÖVER VÄNTANDE ARBETE, INTE TIO LIKVÄRDIGA PANELER.

  Varje kort behåller ALLA sina fält och sin färgroll — NEEDS_SPEC:s warning-ton och STOPPED:s
  danger-ton kommer ur klasserna och rörs inte här. Det som ändras är vikten: tätare luft, lägre
  radhöjd och en nedtonad titel, så att blicken landar i mitten i stället för att räkna kort.
  Detta är viktning, inte datareduktion: ingenting kortas bort och ingenting döljs.
*/
.rm-lane-in .mk-col .mk-card { padding: 8px 10px; gap: 6px; }
.rm-lane-in .mk-col .mk-card-title { font-size: 12px; line-height: 16px; font-weight: 500;
  color: var(--text-secondary); }
.rm-lane-in .mk-col .mk-fields { gap: 5px 10px; }
.rm-lane-in .mk-col .mk-value { font-size: 11.5px; line-height: 15px; }
.rm-lane-in .mk-col .mk-group { gap: 5px; }
/* Backlog-kolumnens egen CTA pekar på SAMMA inlämningsyta som kompositören ovanför. Den tas
   inte bort (den är kolumnens etablerade ingång och provad som sådan i H3-grinden) men den får
   inte se ut som en andra knapp för samma sak: EN knappform i banan, och den tillhör rummets
   primära handling. Här blir länken därför ren text — samma mål, samma räckvidd, ingen yta.

   ROOM-08: länken är ren text, men dess TRÄFFYTA är rummets kontrollhöjd i varje vy — samma
   skäl som upplysningsytan ovan, och samma mått som rummets primära knapp den pekar mot. Formen
   ändras inte av det: «inline-flex» med «min-height» gör ytan hög, inte texten stor. */
.rm-lane-in .mk-col [data-intake-cta="true"] { align-self: flex-start; font-size: 11.5px;
  padding: 0; background: none; box-shadow: none; color: var(--accent-text);
  text-decoration: underline; text-underline-offset: 2px; border-radius: var(--radius-chip);
  display: inline-flex; align-items: center; min-height: 38px; }
.rm-lane-in .mk-col [data-intake-cta="true"]:hover { color: var(--text-primary); }
.rm-lane-in .mk-col [data-intake-cta="true"]:focus-visible { box-shadow: var(--focus-ring); }

/* ── Mata maskinen: rummets primära handling ─────────────────────────────────
   SHREDDER-01B · INGÅNGEN SKA SYNAS SOM INGÅNG.
   Ytan är den enda i rummet där arbete KOMMER IN, och den ska vara omöjlig att missa i
   ingångsbanan i varje vy. Vikten kommer ur en tydligare kant och en djupare skugga — samma
   grepp som fokusbanan redan använder, med husets egna tokens. Ingen ny färg, ingen ny token
   och ingen rörelse: en yta får väga tyngre utan att röra sig. */
.rm-composer { background: var(--bg-panel); box-shadow: inset 0 0 0 1px var(--border-strong),
  0 12px 30px -14px rgba(0, 0, 0, 0.8); border-radius: var(--radius-card);
  padding: var(--pad-card) 18px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.rm-composer-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px;
  min-width: 0; }
.rm-composer-title { margin: 0; font-size: var(--fs-body); line-height: var(--lh-body);
  font-weight: 600; color: var(--text-primary); }
.rm-composer-lead { margin: 0; font-size: 12.5px; line-height: 18px; color: var(--text-secondary);
  max-width: 62ch; overflow-wrap: anywhere; }
.rm-composer-question { margin: 0; font-size: var(--fs-body); line-height: var(--lh-body);
  font-weight: 600; color: var(--text-primary); overflow-wrap: anywhere; }
.rm-composer-note { margin: 0; font-size: 11px; line-height: 16px; color: var(--text-muted);
  max-width: 72ch; overflow-wrap: anywhere; }
.rm-composer-text { margin: 0; font-size: 12px; line-height: 17px; color: var(--text-secondary);
  max-width: 62ch; overflow-wrap: anywhere; }
/*
  PEKAREN TILL SCENARIOVÄLJAREN — RUMMETS EGEN YTA, ALLTSÅ RUMMETS KONTROLLHÖJD.

  Höjden är «.rm-cta»:s 38 px och står som BASREGEL, inte i en brytpunkt: den här skivan lade
  väljaren under rummet på telefonen, och då är pekaren den enda vägen dit — en väg vars
  träffbarhet aldrig får bero på fönstrets bredd. Samma disciplin som rådataväxeln och köns
  genväg redan bär, av samma skäl.

  Formen är nedtonad med flit. Den ska läsas som en genväg till ett demoreglage, aldrig som
  rummets handling: den primära vägen ur kompositören är «Öppna inlämningen», och en andra yta
  med knappform hade konkurrerat med den.
*/
.rm-composer-scenario { display: inline-flex; align-items: center; align-self: flex-start;
  min-height: 38px; padding: 0 10px; margin-left: -10px; border-radius: var(--radius-control);
  font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.8px;
  text-transform: uppercase; color: var(--text-muted); text-decoration: none; }
.rm-composer-scenario:hover { color: var(--text-secondary); background: var(--bg-surface-2); }
.rm-composer-scenario:focus-visible { box-shadow: var(--focus-ring); }
/*
  DE TVÅ ARBETSSPÅREN. En spalt i varje vy: valet ska läsas uppifrån och ned även när
  ingångsbanan är smal, och två halvbreda kort i en 0.95fr-bana hade brutit exempelraderna mitt
  i meningen. Ytorna är länkar med rummets kontrollhöjd — de går att träffa med en tumme.
*/
.rm-intents { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.rm-intent { display: flex; flex-direction: column; gap: 3px; min-height: 38px; padding: 9px 11px;
  background: var(--bg-surface-1); box-shadow: var(--hairline); border-radius: var(--radius-control);
  color: var(--text-secondary); min-width: 0; }
.rm-intent:hover { background: var(--bg-surface-2); }
.rm-intent:focus-visible { box-shadow: var(--focus-ring); }
.rm-intent-label { font-size: 12.5px; line-height: 17px; font-weight: 600;
  color: var(--text-primary); overflow-wrap: anywhere; }
.rm-intent-example { font-size: 11px; line-height: 16px; color: var(--text-muted);
  overflow-wrap: anywhere; }
/* Förhandsvisningens tre vägar in — TEXT om en yta som ligger på /loop/mata, aldrig en yta som
   tar emot något här. Formen är därför en rad märken, inte en ram att släppa i. */
.rm-affordances { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
.rm-affordance { display: inline-flex; align-items: center; min-height: 26px; padding: 0 9px;
  border-radius: var(--radius-chip); background: var(--bg-surface-1); box-shadow: var(--hairline);
  font-size: 11.5px; color: var(--text-muted); overflow-wrap: anywhere; }
.rm-cta { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 18px;
  border-radius: var(--radius-control); background: var(--fill-primary); color: var(--on-primary);
  font-family: var(--font-mono); font-size: 12.5px; letter-spacing: 0.6px; font-weight: 600;
  text-decoration: none; align-self: flex-start; }
.rm-cta:hover { background: var(--fill-primary-hover); }
.rm-cta:focus-visible { box-shadow: var(--focus-ring); }

/* ── SHREDDER-01B · kompakta märken (§owner-8) ────────────────────────────────
   Ett MÄRKE i stället för ett stycke, på rummets primära ytor: läget, källan eller sorten står
   som ett kort ord, och den fulla tekniska texten ligger ORDAGRANT kvar i upplysningsytan
   bredvid. Ingen mening är borttagen någonstans — bara omplacerad, så att den färdiga produkten
   syns före sina brasklappar. Märket bryts hellre än trycker ut sin rad (ingen «nowrap»). */
.rm-flag { display: inline-flex; align-items: center; font-family: var(--font-mono);
  font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted);
  background: var(--bg-surface-0); box-shadow: var(--hairline); border-radius: var(--radius-chip);
  padding: 2px 6px; min-width: 0; overflow-wrap: anywhere; }
/* En upplysningsytas stycken är STYCKEN. Rummets prosa bär «margin: 0» med flit (luften kommer
   ur layouten), och utan den här regeln rann de omplacerade styckena ihop till ett block i det
   ögonblick de flyttade in bakom en växel — exakt det fel ROOM-08 löste för kedjans inledning. */
.rm-details > p + p { margin-top: 9px; }

/* ── Identitetsremsan ─────────────────────────────────────────────────────── */
.rm-identity { display: flex; flex-direction: column; gap: 9px; background: var(--bg-surface-0);
  box-shadow: var(--hairline); border-radius: var(--radius-card); padding: 12px 14px; min-width: 0; }
.rm-identity-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; }
/* RUMMETS h2-NIVÅ, SYNLIG SOM NIVÅ.
   Identitetsremsan och tidslinjen är sektioner på samma nivå som kompositören (h2). Bar de
   samma 10.5px mono-versaler som h3-rubrikerna under sig gick nivån bara att läsa i DOM:en —
   ett sett gränssnitt måste visa sin egen hierarki. Samma form som .rm-composer-title. */
.rm-identity-title, .rm-timeline-title { margin: 0; font-size: var(--fs-body);
  line-height: var(--lh-body); font-weight: 600; color: var(--text-primary); letter-spacing: 0.2px; }
.rm-identity-caption { font-size: 11px; color: var(--text-muted); }
.rm-identity-grid { display: grid; gap: 8px 14px; grid-template-columns: minmax(0, 1fr); }
.rm-identity-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rm-identity-note { font-size: 11px; line-height: 16px; color: var(--text-muted);
  max-width: 72ch; overflow-wrap: anywhere; }
/* SHREDDER-01B §owner-8 · LÅSRADEN ÄR EN RAD, INTE EN RUTA.
   Meningen om workflowsroll måste stå kvar i förstaläget (den är remsans skäl), men den behöver
   ingen egen inramning för att göra det. Rutan blev tre gånger så hög som sin enda mening och
   läste som en varning; formen är därför en dämpad rad i rubrikraden. Ingen text är ändrad, och
   märkningen «data-identity-lock» är kvar för den som mäter.

   NOT OM SKRIVSÄTTET: kommentaren ligger INUTI stilarkets mall-literal, så ett bakåtfnutt här
   avslutar strängen och fäller hela bygget. Filen använder därför « » om kod, aldrig bakåtfnuttar. */
.rm-identity-lock { margin: 0; font-size: 11px; line-height: 16px; color: var(--text-muted);
  max-width: 72ch; overflow-wrap: anywhere; }

/* ── Tidslinjen ───────────────────────────────────────────────────────────── */
.rm-timeline { display: flex; flex-direction: column; gap: var(--gap-sm); }
/* Rubrik och lägesmärke på samma rad — märket är rummets läge, inte en andra rubrik. */
.rm-timeline-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px;
  min-width: 0; }
.rm-timeline-note { margin: 0; font-size: 11px; line-height: 16px; color: var(--text-muted);
  max-width: 82ch; overflow-wrap: anywhere; }
.rm-segment { display: flex; flex-direction: column; gap: 8px; background: var(--bg-surface-0);
  box-shadow: var(--hairline); border-radius: var(--radius-card); padding: 12px 14px; min-width: 0; }
.rm-segment-title { margin: 0; font-family: var(--font-mono); font-size: 10.5px;
  letter-spacing: 1.3px; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; }
.rm-entries { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 7px; }
.rm-entry { display: flex; flex-direction: column; gap: 6px; background: var(--bg-surface-1);
  box-shadow: var(--hairline); border-radius: var(--radius-control); padding: 9px 11px; min-width: 0; }
.rm-entry-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.rm-entry-title { font-size: 12.5px; line-height: 17px; color: var(--text-primary);
  overflow-wrap: anywhere; }
.rm-entry-text { font-size: 11.5px; line-height: 16px; color: var(--text-secondary);
  max-width: 82ch; overflow-wrap: anywhere; }
.rm-ids { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 8px; }
.rm-id { display: inline-flex; align-items: baseline; gap: 5px; font-size: 11px;
  color: var(--text-muted); min-width: 0; }
.rm-id-key { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 1px;
  text-transform: uppercase; color: var(--text-disabled); }
.rm-id-value { font-size: 11px; color: var(--text-secondary); overflow-wrap: anywhere; }
.rm-source { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 1px;
  text-transform: uppercase; color: var(--text-muted); }
.rm-details { min-width: 0; }
/*
  ROOM-08 · UPPLYSNINGSYTANS TRÄFFYTA ÄR EN BASREGEL, INTE EN MOBILREGEL.

  Växeln «{ } rådata» är rummets väg till rådata, bevisreferenser och identifierare — den ENDA
  vägen till flera av dem. Måttet stod först i 959-blocket, och då hängde det på VYBREDD i
  stället för på pekdonet: en pekskärmsbärbar eller en surfplatta i liggande läge vid ≥960 px
  fick kvar en 24 px hög yta för samma bevis. Ett bevis vars åtkomlighet beror på fönstrets
  bredd är precis den sortens skrivbordsbundenhet ROOM-08 finns för att ta bort.

  Höjden är därför rummets egen kontrollhöjd («.rm-cta», 38 px) i VARJE vy, och den är satt som
  «min-height» så att ytan kan växa om etiketten någon gång bryts. Ingenting döljs och ingen text
  kortas — bara träffytan. Skrivbordet blir en aning luftigare av det; den ändringen är avsedd
  och ska granskas på skrivbordets vyklipp.
*/
.rm-details > summary { display: inline-flex; align-items: center; gap: 7px; min-height: 38px; padding: 0 12px;
  border-radius: var(--radius-control); font-family: var(--font-mono); font-size: 11px;
  letter-spacing: 0.6px; color: var(--text-secondary); background: var(--bg-surface-0);
  box-shadow: inset 0 0 0 1px var(--border-strong); cursor: pointer; list-style: none; }
.rm-details > summary::-webkit-details-marker { display: none; }
.rm-details > summary:hover { color: var(--text-primary); background: var(--bg-surface-2); }
.rm-details > summary:focus-visible { box-shadow: var(--focus-ring); }
.rm-details[open] > summary { margin-bottom: 6px; }

/* ── Orsakskedjan (ROOM-03) ───────────────────────────────────────────────────
   Kedjan är en LISTA, inte ett rutnät: hoppen läses i sin fasta semantiska ordning uppifrån och
   ned. Ett frånvarande hopp tonas ned men göms ALDRIG — em-strecket och orsaken är information,
   inte brus. Ingen rörelse, ingen stapel och ingen kopplingsgrafik som antyder en kedja där
   bindningen saknas: bindningen står i klartext med sitt id. */
.rm-chain { display: flex; flex-direction: column; gap: 9px; background: var(--bg-surface-0);
  box-shadow: var(--hairline); border-radius: var(--radius-card); padding: 12px 14px; min-width: 0; }
.rm-chain-title { margin: 0; font-size: var(--fs-body); line-height: var(--lh-body);
  font-weight: 600; color: var(--text-primary); letter-spacing: 0.2px; }
.rm-chain-note { margin: 0; font-size: 11px; line-height: 16px; color: var(--text-muted);
  max-width: 82ch; overflow-wrap: anywhere; }
/*
  ROOM-08 · KEDJANS INLEDNING ÄR TRE STYCKEN, INTE ETT.

  Notiserna ligger i en egen behållare (data-chain-source) INNE i .rm-chain. Behållaren var inte
  en flex-förälder, så sektionens gap nådde inte in — och eftersom .rm-chain-note har margin: 0
  (med flit: luften ska komma ur layouten, inte ur marginalkollaps) rann ingressen, ordningsnotisen
  och bevisnotisen ihop till ETT block. Vid 390 px blev det ett femtontal solida rader innan
  kedjans första hopp: precis den mobilläsbarhet den här skivan finns för.

  Behållaren får därför samma spaltform och samma gap som sektionen den ligger i. Basregel, inte
  media-regel: styckena ska vara stycken i varje vy — det är läsbarhet, inte en brytpunktsfråga.
*/
.rm-chain > [data-chain-source] { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.rm-chain-violations { list-style: none; margin: 0; padding: 8px 10px; display: flex;
  flex-direction: column; gap: 4px; background: var(--tint-danger-bg);
  box-shadow: inset 0 0 0 1px var(--tint-danger-border); border-radius: var(--radius-control); }
.rm-chain-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column;
  gap: 7px; }
.rm-chain-hop { display: flex; flex-direction: column; gap: 6px; background: var(--bg-surface-1);
  box-shadow: var(--hairline); border-radius: var(--radius-control); padding: 9px 11px;
  min-width: 0; }
.rm-chain-hop-absent { background: var(--bg-surface-0); }
.rm-chain-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.rm-chain-kind { font-size: 10.5px; letter-spacing: 0.6px; color: var(--text-muted); }
.rm-chain-hop-title { font-size: 12.5px; line-height: 17px; color: var(--text-primary);
  overflow-wrap: anywhere; }
.rm-chain-bind, .rm-chain-absent { margin: 0; font-size: 11.5px; line-height: 16px;
  color: var(--text-secondary); max-width: 82ch; overflow-wrap: anywhere; }
/* Härkomstmärket vid en identifierare som står i den BÄRANDE posten, inte i hoppets eget utdrag.
   Dämpat och litet: det är en upplysning bredvid värdet, aldrig en etikett som tar över raden. */
.rm-id-origin { font-size: 9.5px; line-height: 14px; color: var(--text-disabled);
  background: var(--bg-surface-0); box-shadow: var(--hairline); border-radius: var(--radius-control);
  padding: 0 5px; white-space: nowrap; }
.rm-chain-dash { font-family: var(--font-mono); color: var(--text-muted); }

/* ── SHREDDER-01B · Showroom-scenariot (§owner-11) ────────────────────────────
   Valet mellan två GENERERADE fixturer, renderat av routen ovanför rummet. Formen är med flit
   INTE kommandoytans: länkar i en remsa, inte knappar i en panel — en visningsväxel får aldrig
   se ut som en intention mot controllern. Ytorna har rummets kontrollhöjd, bryter sin text och
   bär husets fokusring. */
.rm-scenarios { display: flex; flex-direction: column; gap: 8px;
  background: var(--bg-surface-0); box-shadow: var(--hairline); border-radius: var(--radius-card);
  padding: 10px 14px; margin-bottom: var(--gap-md); min-width: 0; }
/* EN rad: rubriken och chipsen tillsammans, radbrytande när bredden inte räcker. Ytan ligger
   ovanför produkten, så varje rad den tar är en rad rummets ingång skjuts ned på en telefon. */
.rm-scenario-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px;
  min-width: 0; }
.rm-scenario-title { margin: 0; font-size: var(--fs-body); line-height: var(--lh-body);
  font-weight: 600; color: var(--text-primary); letter-spacing: 0.2px; }
/* Ett CHIP per val: etiketten i förstaläget, beskrivningen i upplysningsytan under. Höjden är
   rummets kontrollhöjd, så valet går att träffa med en tumme utan att ta korthöjd i anspråk. */
.rm-scenario { display: inline-flex; align-items: center; min-height: 38px; padding: 0 12px;
  background: var(--bg-surface-1); box-shadow: var(--hairline); border-radius: var(--radius-control);
  color: var(--text-secondary); min-width: 0; overflow-wrap: anywhere; }
.rm-scenario:hover { background: var(--bg-surface-2); }
.rm-scenario:focus-visible { box-shadow: var(--focus-ring); }
.rm-scenario-on { box-shadow: inset 0 0 0 1px var(--border-stronger); color: var(--text-primary); }
.rm-scenario-label { font-size: 12px; line-height: 17px; font-weight: 600;
  overflow-wrap: anywhere; }
/* Det VALDA scenariots rad står synlig under chipsen: en rad, i sekundär ton så att den läses som
   upplysning och inte som varning. Den finns för att en synlig motsägelse (tom fabrik, full
   tidslinje) måste ha en synlig förklaring — se ScenarioPicker.tsx. */
.rm-scenario-scope { margin: 0; font-size: 11.5px; line-height: 16px; color: var(--text-secondary);
  max-width: 82ch; overflow-wrap: anywhere; }
/* Beskrivningarna och notisen är stycken i upplysningsytan: margin noll som rummets övriga prosa,
   luften kommer ur «.rm-details > p + p». */
.rm-scenario-desc { margin: 0; font-size: 11px; line-height: 16px; color: var(--text-muted);
  max-width: 82ch; overflow-wrap: anywhere; }

/* Bred teknisk text scrollar i SIN EGEN behållare — aldrig hela sidan. */
.rm-scroll-x { overflow-x: auto; min-width: 0; }
/*
  ROOM-08 · EN SCROLLYTA SOM BARA GÅR ATT NÅ MED PEKARE ÄR OTILLGÄNGLIGA BEVIS.

  Behållaren är fokuserbar (tabIndex i RoomTimeline/CausalChain), så rådatan går att bläddra i
  med tangentbord — och då måste fokus också SYNAS.

  RINGEN RÄCKER INTE ENSAM PÅ EN RÅDATARUTA. Husets --focus-ring är en 1px kantlinje plus ett
  svagt sken, och rutans VILOLÄGE är redan en 1px kantlinje («.mk-raw» i LOOP_CSS): skillnaden
  mellan fokuserad och ofokuserad hade då bara varit kantens FÄRG, och en kritisk skillnad som
  bärs av färg ensam är en frusen negativ kontroll i ROOM-08. Fokusläget får därför också en
  TJOCKLEK: en 3px inre kant ur husets egen --border-stronger ovanpå ringen. Skillnaden syns
  då i form, inte bara i kulör — och ingen ny token införs.
*/
.rm-scroll-x:focus-visible { box-shadow: var(--focus-ring), inset 0 0 0 3px var(--border-stronger); }

/* ── ROOM-08 · räckvidd i strömpanelen ───────────────────────────────────────
   Strömmens metarad bär mono-identifierare (ts, run_id, task_id) i en flex-rad vars behållare
   klipper i sidled («.mk-stream-rows overflow-x: hidden» i LOOP_CSS). Vid 390 px är ett
   run_id bredare än raden, och utan de här två egenskaperna KLIPPS slutet av identifieraren
   bort: bevis som finns på skrivbordet men inte i telefonen. Regeln ändrar inte LOOP_CSS — den
   ligger i rummets namnrymd och gäller bara inuti rummet. */
.rm-room .mk-event-meta > * { min-width: 0; overflow-wrap: anywhere; }

@media (max-width: 1279px) {
  .rm-stage { gap: var(--gap-sm); grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); }
}
/* Hyllan är bred: klart och ej promoverat står SIDA VID SIDA så att bandet blir en hylla och
   inte en smal remsa. Rubriken spänner över båda. */
@media (min-width: 960px) {
  .rm-lane-out .mk-col { display: grid; align-items: start; gap: var(--gap-sm) var(--gap-md);
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .rm-lane-out .mk-col > .mk-col-title { grid-column: 1 / -1; }
}
/* Remsan ligger numera i fokusbanan, inte i full sidbredd: två spalter är rätt täthet där.
   Fyra spalter hade klämt ihop sju fält och deras förklaringar i en halv sidbredd. */
@media (min-width: 720px) {
  .rm-identity-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 959px) {
  .rm-stage { grid-template-columns: minmax(0, 1fr); }
  /*
    SHREDDER-01C · INGÅNGEN LEDER OCKSÅ VID 720–959 PX.

    Fokusbanan lyftes tidigare över ingången här (order minus ett), samma disciplin som
    Maskinens mk-col-current haft sedan V2. Ägarkriteriet står över det valet: det ska vara
    uppenbart VAR ARBETE KOMMER IN vid varje bredd, och kompositören sitter först i
    ingångsbanan. Lyfts blicken hit hamnar rummets enda ingång under en uppgiftsyta med
    orsakskedja och kommandorad — vilket två oberoende visuella granskningar fällde vid 900 px.

    Banan behåller därför sin DOM-plats. Nollan skrivs UT i stället för att utelämnas, så att en
    ärvd order från ett annat stilark inte tyst kan flytta banan tillbaka, och regeln täcker
    HELA intervallet ≤959 px: 719-blocket längst ned behöver ingen egen nollställning.
  */
  .rm-lane-focus { grid-column: 1 / -1; order: 0; }
  /*
    ORDNINGSTALET UTELÄMNAS HÄR — OCH SKÄLET ÄR INTE LÄNGRE DET SOM EN GÅNG SKREVS.

    Regeln kom till när fokusbanan låg först i det här intervallet: då hade ett synligt 1 bredvid
    den andra ytan påstått en ordning ögat inte såg. Efter SHREDDER-01C leder ingången även här,
    alltså är 1, 2, 3 SANT också vid 720–959 px och regeln behövs inte längre av det skälet.

    Den står kvar därför att den är FRUSEN av ROOM-LAYOUT i tests/loop/room-shell.test.ts, vars
    mätning ligger utanför den här skivans skrivrätt. Att utelämna ett sant tal är en utelämning
    och aldrig en osanning: bannamnet (in, arbetet, ut) står kvar i varje vy, och ingenting ur
    snapshoten döljs. Att ta tillbaka talet hör till den skiva som äger 959-mätningen där.
  */
  .rm-step-n { display: none; }
  /*
    ROOM-08 · TRÄFFYTOR FÖR EN TUMME — OCH GRÄNSEN FÖR VAD RUMMET FÅR ÄNDRA.

    Under 960 px är pekdonet en tumme lika ofta som en muspekare. Rummets EGNA ytor — växeln
    «{ } rådata» och köns genväg till inlämningen — har redan rummets kontrollhöjd i varje vy;
    de reglerna står som BASREGLER längre upp, eftersom en bevisytas åtkomlighet inte får bero
    på fönstrets bredd.

    Kvar här står husets egna komponenter inuti rummet. Väljarna träffar exakt två klassfamiljer,
    och vad de FAKTISKT når i rummets markup räknas upp utan avrundning, eftersom en av ytorna
    BÄR ETT BEVIS:

      · «.mk-button» (V7) når i rummet EN familj av ytor: kommandoytans typade intentioner
        (CommandButton ur CommandDeck — pausa, återuppta, inspektera), som alla är blockerade så
        länge kommandokanalen är stängd. Husets andra knapp med samma klass sitter i inlämningens
        IntakeDropzone, och den ligger på /loop/mata — utanför «.rm-room», alltså utanför den här
        regelns räckvidd.
      · «.mk-toggle» (V9) når två slags växlar, båda inuti strömpanelen:
        – panelens egen kontrollrad (data-stream-controls i EventStream): språkparet «[sv]» och
          «[raw event_type]» samt pausa/återuppta autoskroll. De väljer VISNING och filtrerar
          ingenting — inga rader tas bort ur strömmen av dem;
        – VARJE RADS egen «{ }»-växel (EventRow), som är den enda dörren till händelsens råa
          nyttolast.
        Rummet renderar ingen «.mk-toggle» utanför strömpanelen.

    De lyfts i de smala vyerna och BARA där. Det är ett medvetet val, inte en kvarglömd rest:

      · Deras skrivbordsform är en ANNAN SKIVAS PROVADE YTA (V7:s kommandoyta, V9:s strömpanel),
        och att skriva om den från rummets stilark är precis det den här filens bindande regler
        förbjuder — samma skäl som gör att strömmens rådataruta får behålla sin form vid ≥960 px.
      · Vid ≥960 px behåller de därför husets egna höjder: idag 30 px för «.mk-button» och 26 px
        för «.mk-toggle». Båda ligger över WCAG 2.5.8:s golv på 24 px, så radens rådataväxel är
        aldrig under kravet i någon vy — men den får rummets strängare mått bara i de smala, till
        skillnad från rummets EGNA bevisytor, som bär det överallt. Siffrorna upprepas inte i
        provet: det LÄSER dem ur LOOP_CSS, så en framtida förtätning av husets knapp fäller
        mätaren i stället för att tyst ta med sig rummet under golvet.

    Provet mäter båda nivåerna: rummets kontrollhöjd på rummets egna ytor i ALLA tre vyerna,
    och golvet på husets komponenter läst ur husets eget stilark.
  */
  .rm-room .mk-button, .rm-room .mk-toggle { min-height: 38px; }
  /*
    RÅDATA BRYTS DÄR RUMMET ÄR EN SPALT — BÅDA RUTORNA, VID SAMMA BRYTPUNKT.

    Skälet är ETT och gäller lika för rummets egna rådatarutor och för strömmens: vid ≤959 px är
    rummet en enda spalt, och då finns ingen bredd kvar att panorera i. En horisontell panorering
    INUTI en vertikal scroll är den sämsta läsvägen genom ett bevis som finns; där behovet kan tas
    bort tas det bort, i stället för att lämnas kvar bakom en scrollbehållare.

    ATT DE HAR OLIKA VÄGAR UT ÄR INTE ETT SKÄL ATT GE DEM OLIKA BRYTPUNKT. Rummets egna rutor
    (tidslinjens och kedjans) är fokuserbara och scrollar med tangentbord; strömmens ruta ägs av
    EventRow — utanför den här skivans skrivrätt — och kan därför inte få ett tabindex, så utan
    ombrytning vore dess enda väg genom en bred rad en pekarrörelse. Den skillnaden avgör hur
    ALLVARLIGT ett kvarvarande panoreringsbehov är, inte VAR behovet upphör: rummet är lika smalt
    för båda vid 900 px. Regeln stod först i 719-blocket för rummets egna rutor, och då bar
    surfplattan en pekarpanorering för samma sorts bevis som strömmen redan slapp — en asymmetri
    utan mätt skäl. Den är borta.

    Ombrytningen är samma behandling LOOP_CSS självt ger originalkällan vid 719 px: byte-identiskt,
    bara ombrutet — aldrig kapat.

    KVARSTÅENDE BEGRÄNSNING, UTSKRIVEN I STÄLLET FÖR UNDERFÖRSTÅDD: vid ≥960 px behåller båda
    rutorna Maskinens egen form (white-space: pre med egen sidled-scroll). Rummets egna går då att
    bläddra med tangentbord; strömmens kan bara panoreras med pekare. Att skriva om den formen på
    skrivbordet vore att göra om en annan skivas provade yta från rummets stilark; rätt åtgärd för
    strömmen är ett tabindex i EventRow, och den hör till den skiva som äger strömpanelen.
  */
  .rm-details > .mk-raw, .rm-room .mk-raw[data-event-raw="true"] {
    white-space: pre-wrap; overflow-wrap: anywhere; }
}
/*
  ORDNING SÄTTS BARA PÅ SCENENS EGNA BARN.

  Utmatningen är sedan hyllan flyttades ut ur .rm-stage ett direkt flexbarn till .rm-room. Ett
  order-värde på .rm-lane-out gäller därför inte längre "tredje spalten i scenen" utan HELA
  rummets ordning — och eftersom rummets övriga barn ligger på order 0 målades hyllan sist på mobilen:
  efter tidslinjen, efter gränsstycket och efter live-panelen. Två saker gick sönder av det:
  axeln in → arbete → ut stämde inte längre med vad ögat såg, och gränsstyckets påstående
  ("ytorna ovan kommer ur fixturen, panelen nedan talar med läsplanet") blev falskt, eftersom en
  fixturbaserad yta hamnade UNDER live-panelen.

  Regeln är därför borta. Scenens interna ordning räcker: banorna står i sin DOM-ordning —
  ingången först, blicken efter den — i varje vy, och hyllan ligger kvar där skalet satte den.
  Provet ROOM-LAYOUT mäter numera att inget order-värde sätts på något annat än scenens egna
  barn, så samma miss inte kan komma tillbaka nästa gång en yta flyttar.
*/
/*
  ROOM-08 · DEN ENKLA SPALTEN ÄR BERÄTTELSEN, INTE EN HOPPRESSAD SKRIVBORDSVY.

  Vid 390 px finns ingen scen att ordna om i sidled: allt ligger i EN spalt, och då är
  läsordningen hela layouten. Rummets axel är då densamma som DOM:en redan bär —

      huvud → uppmärksamhet → mata maskinen → kön → arbetet (uppgift, identitet, orsakskedja,
      kommandoyta) → hyllan → tidslinjen → strömmen

  — alltså in → arbete → ut, uppifrån och ned.

  SHREDDER-01C · DE TVÅ SMALA INTERVALLEN HAR NUMERA SAMMA LÄSORDNING.

  Scenen är EN spalt redan vid ≤959 px; banorna står alltså inte sida vid sida i något av dem,
  och skillnaden mellan intervallen var aldrig rutnät mot remsa utan ren läsordning. ROOM-08
  lät 720–959 px behålla ROOM-01:s arrangemang (blicken först) och gav bara ≤719 px axeln
  in → arbete → ut. Ägarkriteriet — det ska vara uppenbart VAR ARBETE KOMMER IN, vid VARJE
  bredd — upphäver den skillnaden: ingången leder i båda, och nollan står i 959-blocket ovan så
  att EN regel täcker dem. Ingen ny väljare sätter order, eftersom order på ett direktbarn till
  rummet ordnar om HELA rummet (se blocket ovan).

  Det operatören möter först är fortfarande huvudets läge och BEHÖVER UPPMÄRKSAMHET, som pekar
  ut de uppgifts-id det gäller; därefter ingången, och först därefter det pågående arbetet.
*/
@media (max-width: 719px) {
  .rm-stage { grid-template-columns: minmax(0, 1fr); }
  /* Ordningen 1 · in, 2 · arbetet, 3 · ut är sann i den enkla spalten — och en lång spalt som
     scrollas i telefonen är precis där ett stegtal hjälper. Här visas det därför, medan
     959-blocket ovan utelämnar det av ett skäl som står vid den regeln. Talet är fortfarande
     aria-hidden: DOM-ordningen bär sekvensen för den som lyssnar. */
  .rm-step-n { display: inline; }
  /* All rådata — rummets egna rutor OCH strömmens — bryter redan sina rader vid ≤959 px, och
     regeln gäller därför här också. Den står i 959-blocket ovan, med sitt skäl, och upprepas
     inte här: en andra regel för samma sak hade blivit två sanningar att hålla i takt.
     Behållarens egen scroll («.rm-scroll-x») står kvar och gäller de bredare vyerna. */
  /*
    ETT MÄRKE FÅR ALDRIG BLI SIDANS BREDD.

    Husets märke (.mk-badge) bär «white-space: nowrap» — riktigt på ett rutnät där märkena är
    korta tillstånd, men rummet renderar också tidslinjens statusetiketter, och den längsta i
    fixturen är fyrtio tecken («Inlämnad — väntar på Nortropics tolkning»). Ett märke som inte
    får brytas är ett flexbarn som inte kan krympa: vid 390 px trycker det ut sin rad, sin
    behållare och till slut SIDAN i sidled — exakt den frusna negativa kontrollen. Märket får
    därför brytas här, och växer i höjd i stället för i bredd. Ingen text kortas, inget märke
    döljs, och formen är oförändrad så länge etiketten ryms på en rad.
  */
  .rm-room .mk-badge { white-space: normal; overflow-wrap: anywhere; height: auto;
    min-height: 20px; padding: 2px 8px; }
  /*
    SHREDDER-01B · STATUSRADENS FÄLT LÄGGER SIG PÅ RADEN I STÄLLET FÖR I EN TRAPPA.

    MÄTT, INTE ANTAGET. Statusraden bär elva fält (liveness, senaste event, kör-id, kör-tillstånd,
    brytare, kvot, main, main bekräftad, snapshot publicerad, seq-vattenmärke och datakällans
    märke). Varje fält staplar sin etikett ÖVER sitt värde, alltså två rader per fält. Vid 390 px
    blir «.mk-bar» då 330 px hög — nästan 40 procentenheter av telefonens första skärm spenderade
    på fältetiketter innan operatören sett var arbete matas in, och «Mata maskinen» hamnade under
    vikningen. Vid 900 px är samma rad 174 px, och vid 1440 px 122 px: problemet finns bara i den
    smalaste vyn, och regeln gäller bara där.

    ÅTGÄRDEN ÄR EN RAD, INTE EN TRAPPA: etikett och värde ställs bredvid varandra i stället för
    över varandra. Fältet blir då en rad i stället för två, och husets egen flex-radbrytning
    packar de korta fälten två och två av sig själv. Raden mäter 223 px efter ändringen.

    INGEN MAGISK ETIKETTBREDD. En låst etikettspalt provades först och mättes som SÄMRE och
    instabil: «.mk-bar» radbryter sina fält, så en bredd som låser etiketten ändrar också hur
    många fält som får plats per rad — höjden hoppade fram och tillbaka mellan 287 och 382 px för
    bredder som skilde åtta pixlar. Etiketterna bär därför sin egen innehållsbredd, och
    packningen sköts av den flex-radbrytning raden redan hade. Det finns inget tal att kalibrera
    om nästa gång ett fält byter namn.

    INGENTING DÖLJS OCH INGENTING KORTAS: samma elva fält, samma etiketter, samma värden, samma
    ordning, samma märkning — inklusive SHOWROOM-märket för datakällan, som är själva skälet till
    att raden aldrig får vika undan bakom en lucka.

    VARFÖR REGELN LIGGER HÄR OCH INTE I LOOP_CSS: «.mk-bar» ägs av V2:s statusrad, och att skriva
    om en annan skivas provade yta från rummets stilark är precis det den här filens bindande
    regler förbjuder. Väljaren är därför scopad till «.rm-head» — statusraden INUTI rummets huvud.
    Samma rad renderad någon annanstans behåller sin egen form, och LOOP_CSS är orört.
  */
  .rm-head .mk-bar { gap: 2px var(--gap-lg); padding: 8px 12px; }
  .rm-head .mk-bar-item { flex-direction: row; align-items: baseline; gap: 8px; }
  /*
    SHREDDER-01B (rond 2) · TELEFONENS MELLANRUM ÄR TÄTARE ÄN SKRIVBORDETS.

    FYNDET SOM REGELN SVARAR PÅ: i skärmklippet vid 390 px låg kompositörens kort på ~805 px och
    rubriken «Mata maskinen» på ~817 px — en remsa på tjugo pixlar längst ned, och varken
    spårfrågan eller något av de två spårkorten syntes i första vyn. Första telefonskärmen blev
    huvud + statusrutnät + två uppmärksamhetsrader, alltså en instrumentpanel, inte ett showroom.
    Att det tomma scenariot klarade gränsen räknas inte: acceptansen får inte hänga på att
    uppmärksamhetsblocket råkar krympa till en mening.

    VAD REGELN GÖR: den ARRANGERAR tätare i den smalaste vyn. Varje deklaration är ett mellanrum
    eller en utfyllnad — inget döljs, inget kortas, ingen yta byter plats, och ordningen
    huvud → status → uppmärksamhet → kompositör står kvar precis som ROOM-MOBIL-ORDNING fryser
    den. Egenskaperna är de som room-mobile.test.ts räknar som arrangerande (gap, padding).

    VARFÖR MELLANRUM OCH INTE EN LUCKA TILL: uppmärksamheten och identiteten är BEVIS
    (EVIDENCE_TOKENS), och en brytpunkt får aldrig dölja dem. Skrivbordets luftigare mått är
    riktiga där det finns höjd att ge bort; på en telefon är samma luft det som trycker ned
    rummets ingång. Inget värde, ingen etikett och ingen mening är borta ur någon vy.

    MÄTT: rubriken flyttar från 778 px till 705 px i mätställningen, spårkorten från 868 px till
    795 px — alltså 73 px, och båda ligger då inom telefonens första vy. Inget radmellanrum är
    nollställt; den tätaste raden behåller två pixlar.
  */
  .rm-room { gap: var(--gap-sm); }
  .rm-head { gap: 6px; }
  .rm-head-top { gap: 0 8px; }
  .rm-attention { padding: 8px 10px; gap: 3px; }
  .rm-attention-list { gap: 3px; }
  .rm-attention-item { padding: 4px 8px; gap: 2px 8px; }
  .rm-lane { gap: 6px; }
  .rm-stage { gap: var(--gap-sm); }
}
`;
