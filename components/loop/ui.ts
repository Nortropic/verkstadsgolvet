/**
 * V2 · Delat presentationslager för Maskinen (/loop).
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — TARGET_UX, COMPONENT_PLAN och
 * TASK-LIFECYCLE ("Statuspresentation"). Färgrollerna kommer ur lib/loop/labels.ts (V1) —
 * de skrivs ALDRIG om här.
 *
 * BINDANDE REGLER SOM DEN HÄR FILEN BÄR
 * -------------------------------------
 * · Endast BEFINTLIGA CSS-variabler ur app/globals.css används. Inga nya tokens, inga
 *   hårdkodade färger vid sidan av temat, ingen ändring i globals.css.
 * · Klassnamnen är namnrymdade med prefixet `mk-` och lever bara i /loop-trädet.
 * · INGEN procentsats, INGEN framstegsstapel, INGEN animation och ingen `@keyframes` —
 *   varken som text eller som stil. Procenttecknet förekommer inte ens i CSS:en (radier anges
 *   i px, bredder i fr/minmax) så att planens statiska kontroll (S10t) blir entydig: provet
 *   läser koden med kommentarerna bortskalade och den renderade markupen i sin helhet.
 * · Saknat värde renderas via MISSING/orMissing ur lib/loop/labels.ts — aldrig 0, aldrig tomt.
 */
import { COMMAND_QUEUE_BLOCKED_ON, commandChannelEnabled } from "@/lib/loop/commands";
import { MISSING, type Tone } from "@/lib/loop/labels";

/** Färgroll → namnrymdad klass. Rollen ägs av V1:s labels.ts, inte av den här filen. */
export function toneClass(tone: Tone): string {
  return `mk-tone-${tone}`;
}

/**
 * Kort SHA för mono-visning. `null`/tom sträng → "—".
 *
 * Trunkering är PRESENTATION, aldrig identitet: den fulla strängen bärs i `title` av den
 * som renderar. Ingen SHA hittas på, och Verkstadsgolvet slår aldrig upp en ref själv.
 */
export function shortSha(value: string | null | undefined, length = 7): string {
  if (value === null || value === undefined) return MISSING;
  const text = value.trim();
  if (text === "") return MISSING;
  return text.length <= length ? text : text.slice(0, length);
}

/**
 * Antal + substantiv i klartext. Ett ANTAL är inte ett framsteg: här produceras aldrig en
 * kvot, en andel eller en stapel — bara "3 uppgifter".
 */
export function countLabel(n: number): string {
  return n === 1 ? "1 uppgift" : `${n} uppgifter`;
}

/* ── Sidhuvudets sanning (/loop) ──────────────────────────────────────────────
 *
 * Sidhuvudet påstod tidigare att /loop varken hade transport, kommandon eller eventström.
 * Det är inte sant om den sida som FAKTISKT monteras: MaskinShell renderar V7:s kommandoyta
 * och V9:s live-strömpanel. En osann etikett är värre än ingen etikett — därför beskrivs de
 * tre källorna var för sig, med det läge var och en verkligen har:
 *
 *   LIVE          — strömpanelen talar med kontrollplanets läsyta på riktigt. Att den ofta är
 *                   tom är ett ÄRLIGT tomläge, inte ett fel och inte heller "nästan live".
 *   KONTRAKTSLÄGE — kommandoytan är byggd men kanalen är stängd (503) tills backendens skiva
 *                   finns. Ytan får aldrig beskrivas som en fungerande väg.
 *   SHOWROOM      — statusraden, kolumnerna och korten kommer ur den GENERERADE fixturen. Ordet
 *                   är produktens (lib/loop/room/mode.ts); påståendet är oförändrat, och texten
 *                   namnger fortfarande fixturen i klartext.
 *
 * Texten HÄRLEDS ur samma värden som ytorna själva läser (`commandChannelEnabled`,
 * FIXTURE_MODE via `fixture`-flaggan) i stället för att skrivas som en fri mening. Byts ett
 * läge byts etiketten med det — en sanning som måste redigeras för hand blir osann.
 *
 * VAD "LIVE" BETYDER HÄR — OCH VAD DET INTE BETYDER
 * -------------------------------------------------
 * `mode: "live"` för strömsegmentet betecknar KÄLLAN: vilket plan panelen läser. Det är
 * INGET påstående om att transporten är uppe, ansluten eller konfigurerad just nu.
 *
 * Därför är strömsegmentets läge medvetet konstant medan `commands` och `snapshot` härleds:
 *   · KÄLLAN är strukturell. Panelen läser kontrollplanets läsyta i varje läge — även när
 *     transporten inte är konfigurerad och den återansluter eller pollar. Byts källan byts
 *     koden, inte en flagga.
 *   · TRANSPORTLÄGET är däremot rörligt, och det ÄGS AV PANELEN: V9 renderar det som märke
 *     (`data-transport-mode`) med en orsaksrad under sig. Sidhuvudet har ingen egen
 *     liveness-signal och skulle bara kunna gissa. Två ägare av samma sanning glider isär —
 *     och den som gissar hinner alltid bli den som ljuger.
 *
 * Sidhuvudet duplicerar därför INTE panelens läge; det PEKAR på det
 * (MASKIN_HEADER_TRANSPORT_NOTE), så att en läsare som ser "LIVE" i huvudet och "transporten
 * är inte konfigurerad" i panelen vet vilken av raderna som bär det rörliga läget.
 *
 * FORM: en kort ingress plus korta, avgränsade segment — aldrig en lång oavgränsad
 * caption-paragraf. Radlängden begränsas dessutom av `max-width` i MASKIN_HEADER_CSS.
 */

/** Vilket läge ett segment beskriver. Bärs i markupen så att provet kan mäta distinktionen. */
export type HeaderSourceMode = "live" | "contract" | "fixture";

export type HeaderTruthSegment = {
  /** Vilken yta segmentet gäller. Stabil nyckel — etiketten får byta läge, inte identitet. */
  id: "stream" | "commands" | "snapshot";
  mode: HeaderSourceMode;
  label: string;
  text: string;
};

/** Ingressen. Kort med avsikt: detaljerna bärs av segmenten, inte av en löpande mening. */
export const MASKIN_HEADER_SUB =
  "Kontrollrummets läsvy — ingen authority. Tre källor med olika läge:";

/**
 * SHREDDER-01A · Etiketten för den källa som är simulerad fabriksdata.
 *
 * Ordet "FIXTUR" är fabriksteknik; showroom är produktens ord för samma sanning. Etiketten byter
 * alltså vokabulär, aldrig påstående: segmentets text NAMNGER fortfarande fixturen, och strängen
 * som märker läget kommer ur lib/loop/room/mode.ts så att en yta inte kan börja säga något annat
 * än en annan.
 */
export const MASKIN_HEADER_SHOWROOM_LABEL = "Showroom";

/**
 * Hänvisningen till den som FAKTISKT äger transportläget. Sidhuvudet säger vilken källa
 * panelen läser; om anslutningen är öppen, återansluter, pollar eller inte ens är konfigurerad
 * står i panelen — och bara där.
 */
export const MASKIN_HEADER_TRANSPORT_NOTE =
  "Strömpanelen nedan bär sitt eget transportläge — det står där, inte här.";

/**
 * Segmenten. `channelEnabled` och `fixture` kommer ur de FAKTISKA lägena, aldrig ur en
 * handskriven bedömning: står kanalen öppen påstår texten inte 503, och är snapshoten inte
 * längre en fixtur påstås ingen fixtur.
 */
export function maskinHeaderTruth({
  fixture,
  channelEnabled = commandChannelEnabled(),
}: {
  fixture: boolean;
  channelEnabled?: boolean;
}): HeaderTruthSegment[] {
  return [
    {
      /*
        KÄLLA, inte transportstatus: se blocket ovan. Texten påstår därför bara vad panelen
        LÄSER och skriver ut det ärliga tomläget — aldrig att anslutningen är uppe.
      */
      id: "stream",
      mode: "live",
      label: "Live",
      text: "Eventströmmen läser kontrollplanet — tom tills backend publicerar.",
    },
    channelEnabled
      ? {
          id: "commands",
          mode: "live",
          label: "Live",
          text: "Kommandoytan lämnar typade intentioner till controllerns kö.",
        }
      : {
          id: "commands",
          mode: "contract",
          label: "Kontraktsläge",
          text: `Kommandokanalen svarar 503 tills ${COMMAND_QUEUE_BLOCKED_ON} finns.`,
        },
    fixture
      ? {
          id: "snapshot",
          mode: "fixture",
          label: MASKIN_HEADER_SHOWROOM_LABEL,
          text: "Statusrad, kolumner och kort ur en genererad fixtur.",
        }
      : {
          id: "snapshot",
          mode: "live",
          label: "Live",
          text: "Statusrad, kolumner och kort kommer ur controllerns snapshot.",
        },
  ];
}

/**
 * Sidhuvudets egna regler. Egen liten stil i stället för en ändring i app/globals.css: `.ph-sub`
 * delas av hela appen, och den här skivan får bara begränsa radlängden PÅ /loop.
 *
 * `max-width` i `ch` binder taket till textens egen storlek — måttet är radlängd, inte pixlar,
 * och kräver ingen ny brytpunkt för att vara läsbart i 1440 / 900 / 390.
 */
export const MASKIN_HEADER_CSS = `
.mk-header { display: flex; flex-direction: column; min-width: 0; margin-bottom: 22px; }
/* Appens egen luft under sidhuvudet (22px) flyttas till HELA blocket. Annars hade segmenten
   hamnat 22px under sin egen ingress och tätt mot skalet — läget de beskriver hade sett ut att
   höra till panelen nedanför i stället för till huvudet. */
.mk-header .page-header { margin-bottom: 0; }
.mk-header .ph-sub { max-width: 64ch; }
.mk-header-truth { list-style: none; margin: 7px 0 0; padding: 0; display: flex;
  flex-direction: column; gap: 5px; max-width: 64ch; }
.mk-header-truth-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; min-width: 0; }
.mk-header-truth-label { display: inline-flex; align-items: center; height: 17px; padding: 0 7px;
  border-radius: var(--radius-chip); font-family: var(--font-mono); font-size: 9.5px;
  letter-spacing: 1.3px; text-transform: uppercase; color: var(--text-muted);
  background: var(--bg-surface-1); box-shadow: var(--hairline); flex: none; }
.mk-header-truth-text { font-size: 12px; line-height: 17px; color: var(--text-secondary);
  min-width: 0; overflow-wrap: anywhere; }
/* Hänvisningen är en fotnot till segmenten, inte ett fjärde läge: nedtonad, utan etikettchip,
   och med samma radlängdstak som resten av huvudet. */
.mk-header-truth-note { margin: 6px 0 0; max-width: 64ch; font-size: 11px; line-height: 16px;
  color: var(--text-muted); overflow-wrap: anywhere; }
`;

/**
 * Maskinens stilark. Injiceras en gång av MaskinShell och gäller bara `mk-`-klasserna.
 * Brytpunkterna är planens (1280 / 960 / 720) och app/globals.css egna — inga nya.
 */
export const LOOP_CSS = `
.mk-shell { display: flex; flex-direction: column; gap: var(--gap-md); }

.mk-bar { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--gap-sm) var(--gap-lg);
  background: var(--bg-panel); box-shadow: var(--hairline), 0 2px 10px -4px rgba(0,0,0,0.45);
  border-radius: var(--radius-card); padding: 12px 18px; }
.mk-bar-item { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.mk-label { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 1.3px;
  text-transform: uppercase; color: var(--text-muted); }
.mk-value { font-size: 12.5px; line-height: 17px; color: var(--text-secondary); overflow-wrap: anywhere; }
.mk-mono { font-family: var(--font-mono); font-size: 11.5px; }
.mk-missing { color: var(--text-disabled); }
.mk-liveness { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--text-secondary); }
/* Ihålig ring = planens "○ OKÄNT". Den FYLLDA punkten är reserverad för "● AUTONOM" och
   får bara användas av en skiva som har en FAKTISK liveness-signal (B2). Formen — inte bara
   färgen och etiketten — ska skilja de två lägena åt vid en snabb blick. */
.mk-liveness-dot { width: 7px; height: 7px; border-radius: 999px; background: transparent;
  box-shadow: inset 0 0 0 1px var(--border-strong); flex: none; }

.mk-cols { display: grid; gap: var(--gap-md); align-items: start;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.3fr) minmax(0, 0.85fr); }
.mk-col { background: var(--bg-panel); box-shadow: var(--hairline), 0 2px 10px -4px rgba(0,0,0,0.45);
  border-radius: var(--radius-card); padding: var(--pad-card) 18px; display: flex;
  flex-direction: column; gap: var(--gap-sm); min-width: 0; }
.mk-col-title { font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 1.2px;
  text-transform: uppercase; color: var(--text-secondary); display: flex; justify-content: space-between;
  gap: 10px; flex-wrap: wrap; }
.mk-col-title .mk-col-count { color: var(--text-muted); font-weight: 400; letter-spacing: 0.6px; }
.mk-group { display: flex; flex-direction: column; gap: 7px; }
.mk-group-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.mk-group-name { font-family: var(--font-mono); font-size: 9.5px; letter-spacing: 1.3px;
  text-transform: uppercase; color: var(--text-muted); }
.mk-group-count { font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); }
.mk-empty { font-size: 12px; line-height: 1.5; color: var(--text-muted); }

.mk-card { background: var(--bg-surface-1); box-shadow: var(--hairline); border-radius: var(--radius-control);
  padding: 12px 13px; display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.mk-card.mk-tone-accent { background: var(--tint-accent-bg); box-shadow: inset 0 0 0 1px var(--tint-accent-border); }
.mk-card.mk-tone-warning { background: var(--tint-warning-bg); box-shadow: inset 0 0 0 1px var(--tint-warning-border); }
.mk-card.mk-tone-success { background: var(--tint-success-bg); box-shadow: inset 0 0 0 1px var(--tint-success-border); }
.mk-card.mk-tone-danger { background: var(--tint-danger-bg); box-shadow: inset 0 0 0 1px var(--tint-danger-border); }
.mk-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.mk-card-id { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.4px; color: var(--text-muted); }
.mk-card-title { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--text-primary); }

.mk-badge { display: inline-flex; align-items: center; gap: 5px; height: 20px; padding: 0 8px;
  border-radius: var(--radius-chip); font-family: var(--font-mono); font-size: var(--fs-caption);
  line-height: 15px; font-weight: 600; letter-spacing: 0.6px; background: var(--chip-neutral-bg);
  color: var(--text-secondary); box-shadow: var(--hairline); white-space: nowrap; }
.mk-badge.mk-tone-accent { background: var(--tint-accent-bg); color: var(--accent-text); box-shadow: inset 0 0 0 1px var(--tint-accent-border); }
.mk-badge.mk-tone-warning { background: var(--tint-warning-bg); color: var(--warning-text); box-shadow: inset 0 0 0 1px var(--tint-warning-border); }
.mk-badge.mk-tone-success { background: var(--tint-success-bg); color: var(--success-text); box-shadow: inset 0 0 0 1px var(--tint-success-border); }
.mk-badge.mk-tone-danger { background: var(--tint-danger-bg); color: var(--danger-text); box-shadow: inset 0 0 0 1px var(--tint-danger-border); }
.mk-badge-dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; flex: none; }
.mk-badge.mk-verdict-not-run { border-radius: var(--radius-chip); box-shadow: inset 0 0 0 1px var(--border-strong);
  background: transparent; color: var(--text-muted); }

.mk-verdicts { display: flex; flex-wrap: wrap; gap: 6px; }
.mk-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px 12px; }
.mk-field { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mk-field-wide { grid-column: 1 / -1; }

.mk-note { font-size: 11.5px; line-height: 1.5; color: var(--text-secondary); background: var(--bg-surface-0);
  box-shadow: var(--hairline); border-radius: var(--radius-control); padding: 9px 11px; }
.mk-note.mk-tone-warning { background: var(--tint-warning-bg); box-shadow: inset 0 0 0 1px var(--tint-warning-border);
  color: var(--warning-text); }
.mk-hint { font-size: 11px; line-height: 1.5; color: var(--text-muted); }

.mk-phases { display: flex; flex-direction: column; gap: 4px; }
.mk-phase { display: flex; align-items: center; gap: 10px; padding: 7px 10px; background: var(--bg-surface-1);
  box-shadow: var(--hairline); border-radius: var(--radius-control); }
.mk-phase-mark { font-family: var(--font-mono); font-size: 12px; width: 14px; text-align: center;
  color: var(--text-disabled); flex: none; }
.mk-phase-name { font-family: var(--font-mono); font-size: 11px; letter-spacing: 1px; color: var(--text-secondary); }
.mk-phase-note { margin-left: auto; font-size: 11px; color: var(--text-muted); }
.mk-phase.mk-mark-active { background: var(--tint-accent-bg); box-shadow: inset 0 0 0 1px var(--tint-accent-border); }
.mk-phase.mk-mark-active .mk-phase-mark, .mk-phase.mk-mark-active .mk-phase-name { color: var(--accent-text); }
.mk-phase.mk-mark-done { background: var(--tint-success-bg); box-shadow: inset 0 0 0 1px var(--tint-success-border); }
.mk-phase.mk-mark-done .mk-phase-mark, .mk-phase.mk-mark-done .mk-phase-name { color: var(--success-text); }
.mk-phase.mk-mark-failed { background: var(--tint-danger-bg); box-shadow: inset 0 0 0 1px var(--tint-danger-border); }
.mk-phase.mk-mark-failed .mk-phase-mark, .mk-phase.mk-mark-failed .mk-phase-name { color: var(--danger-text); }

/* V8* · Markdown-intake (fixturläge). Samma tokens, samma namnrymd, ingen ny färg. */
.mk-intake { display: flex; flex-direction: column; gap: var(--gap-md); }
.mk-panel { background: var(--bg-panel); box-shadow: var(--hairline), 0 2px 10px -4px rgba(0,0,0,0.45);
  border-radius: var(--radius-card); padding: var(--pad-card) 18px; display: flex;
  flex-direction: column; gap: var(--gap-sm); min-width: 0; }
.mk-panel-title { font-family: var(--font-mono); font-size: 11px; font-weight: 600; letter-spacing: 1.2px;
  text-transform: uppercase; color: var(--text-secondary); display: flex; justify-content: space-between;
  gap: 10px; flex-wrap: wrap; }
.mk-panel-title .mk-col-count { color: var(--text-muted); font-weight: 400; letter-spacing: 0.6px; }
/* Zonen ska SE droppbar ut i vila. En jämn kant läser som en vanlig ruta; den streckade kanten
   är den etablerade affordansen för "något kan släppas här" och kräver ingen ny färg och ingen
   ny text. Regeln position: relative är inte kosmetik: den dolda filkontrollen (.mk-sr-only)
   positioneras absolut och skulle utan en positionerad förälder lägga sig mot viewporten i
   stället för mot sin egen zon. */
.mk-drop { position: relative; border-radius: var(--radius-control); background: var(--bg-surface-0);
  border: 1px dashed var(--border-strong); padding: 21px 17px; display: flex;
  flex-direction: column; align-items: center; gap: 8px; text-align: center; }
/* Aktivt läge: samma tint som förut, men kanten blir HEL — skillnaden mellan "kan släppas här"
   och "släpp nu" syns då även utan färgseende. */
.mk-drop-over { background: var(--tint-accent-bg); border-style: solid; border-color: var(--tint-accent-border);
  box-shadow: inset 0 0 0 1px var(--tint-accent-border); }
.mk-drop-title { font-size: 13px; font-weight: 600; color: var(--text-primary); }
/* Namnet PÅ en kontroll, inte en sektionsrubrik: .mk-label:s versala 9.5px-mono läses som
   kapitälrubrik och gör kontrollens namn otydligt. Egen klass, samma tokens. */
.mk-control-label { font-size: 12.5px; line-height: 17px; font-weight: 600; color: var(--text-primary); }
/* Kvar för hjälpmedel, borta för ögat. ALDRIG display:none — det hade tagit kontrollen ur
   tabbordningen. Inga procentmått (t.ex. clip-path: inset(50…)) används: /loop-trädet är fritt
   från procenttecken, och en 1×1-ruta med inset(1px) är lika osynlig. */
.mk-sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
  overflow: hidden; white-space: nowrap; clip: rect(0 0 0 0); clip-path: inset(1px); }
/* Etiketten ÄR den synliga knappen: svensk text, husets färger, öppnar samma filväljare. */
.mk-file-label { display: inline-flex; align-items: center; height: 30px; padding: 0 14px;
  border-radius: var(--radius-control); font-family: var(--font-mono); font-size: 11.5px;
  letter-spacing: 0.6px; background: var(--bg-surface-2); color: var(--text-primary);
  box-shadow: inset 0 0 0 1px var(--border-strong); cursor: pointer; }
.mk-file-label:hover { background: var(--bg-surface-3); }
/* Tangentbordsfokus måste synas trots att kontrollen är dold — ringen målas på etiketten. */
.mk-sr-only:focus-visible + .mk-file-label { box-shadow: var(--focus-ring); }
.mk-textarea { font-family: var(--font-mono); font-size: 12px; line-height: 18px; color: var(--text-primary);
  background: var(--bg-surface-0); box-shadow: inset 0 0 0 1px var(--border-strong);
  border: 0; border-radius: var(--radius-control); padding: 10px 11px; resize: vertical; min-height: 120px; }
.mk-list { display: flex; flex-direction: column; gap: 6px; }
/* Ett fällt urval listar fortfarande VARJE fil — ingen faller bort tyst — men raderna bär då
   ingen egen orsak och kan därför stå i flera spalter så snart bredden räcker. Regeln sitter på
   den BEFINTLIGA 720-pinnen (ingen ny brytpunkt införs): vid 960px stackades tjugoen orsakslösa
   kort till en enda spalt på surfplattans 900px — exakt den vy de var tänkta att komprimera.
   Radernas namn bryts vid behov (overflow-wrap i .mk-file-name), så en smalare spalt kapar
   ingenting. */
@media (min-width: 720px) {
  .mk-list-dense { display: grid; gap: 6px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.mk-file { display: flex; flex-direction: column; gap: 3px; background: var(--bg-surface-1);
  box-shadow: var(--hairline); border-radius: var(--radius-control); padding: 9px 11px; min-width: 0; }
.mk-file.mk-tone-danger { background: var(--tint-danger-bg); box-shadow: inset 0 0 0 1px var(--tint-danger-border); }
.mk-file.mk-tone-success { background: var(--tint-success-bg); box-shadow: inset 0 0 0 1px var(--tint-success-border); }
/* En formellt felfri fil i ett FÄLLT urval: varken grön (den lämnas inte in) eller röd (den är
   inte fel). Nedtonad — utfallet ska läsas blockerat i sin helhet. */
.mk-file.mk-file-blocked { background: var(--bg-surface-0); box-shadow: var(--hairline); }
.mk-file.mk-file-blocked .mk-file-name { color: var(--text-muted); }
.mk-file-name { font-family: var(--font-mono); font-size: 11.5px; color: var(--text-primary); overflow-wrap: anywhere; }
.mk-file-reason { font-size: 11.5px; line-height: 1.5; color: var(--text-secondary); }
.mk-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.mk-button { height: 30px; padding: 0 14px; border: 0; border-radius: var(--radius-control);
  font-family: var(--font-mono); font-size: 11.5px; letter-spacing: 0.6px; background: var(--bg-surface-1);
  color: var(--text-disabled); box-shadow: inset 0 0 0 1px var(--border-strong); cursor: not-allowed; }
/* V7 · en knapp = en typad intention. Grundformen ovan är AVSTÄNGD (kommandokanalen är stängd
   tills nortropic-system S13 finns); en klickbar knapp måste därför skilja sig synligt från en
   avstängd, annars ser en stängd kanal ut som en öppen. */
.mk-button:not(:disabled) { color: var(--text-primary); background: var(--bg-surface-2);
  box-shadow: inset 0 0 0 1px var(--border-strong); cursor: pointer; }
.mk-button:not(:disabled):hover { background: var(--bg-surface-3); }
/* En knapp med aria-disabled är blockerad utan att vara nativt avstängd: fokus når den,
   så att orsaken FAKTISKT läses upp (nativt disabled hoppas över av flera skärmläsarpar). Då
   måste den också SE avstängd ut — annars ser en stängd kanal öppen ut. Reglerna står efter
   :not(:disabled)-paret och vinner på ordning vid samma specificitet. */
.mk-button[aria-disabled="true"], .mk-button[aria-disabled="true"]:hover {
  color: var(--text-disabled); background: var(--bg-surface-1);
  box-shadow: inset 0 0 0 1px var(--border-strong); cursor: not-allowed; }
.mk-button:focus-visible { box-shadow: var(--focus-ring); }
/* Fokusringen måste vinna över den avstängda formens egen skugga — annars blir en blockerad
   knapp osynlig för tangentbordet i samma stund den blir fokuserbar. */
.mk-button[aria-disabled="true"]:focus-visible { box-shadow: var(--focus-ring); }
.mk-command { display: flex; flex-direction: column; gap: 6px; }
.mk-link { font-size: 12px; color: var(--accent-text); text-decoration: none; box-shadow: var(--hairline);
  border-radius: var(--radius-control); padding: 7px 11px; background: var(--bg-surface-1); display: inline-block; }
.mk-raw { font-family: var(--font-mono); font-size: 11.5px; line-height: 17px; color: var(--text-secondary);
  background: var(--bg-surface-0); box-shadow: inset 0 0 0 1px var(--border-strong);
  border-radius: var(--radius-control); padding: 10px 11px; margin: 0; overflow-x: auto;
  white-space: pre; max-height: 420px; overflow-y: auto; }
/* Controllerns avslag PÅSTÅS visas "ordagrant och i sin helhet" — då ska det också SYNAS i sin
   helhet, utan att läsaren först måste upptäcka en horisontell scroll. Radbrytning ändrar inga
   tecken (byte-identiteten mäts på DOM:en), kapar ingenting och lägger ingen "visa mer"-lucka
   mellan läsaren och orsaken. */
.mk-raw[data-rejection-verbatim="true"] { white-space: pre-wrap; overflow-wrap: anywhere; }
.mk-intake-results { display: flex; flex-direction: column; gap: var(--gap-md); }

/* V9 · Eventströmmen. Samma tokens, samma namnrymd, ingen ny färg — och ingen rörelse:
   panelen får aldrig se levande ut utan ett faktiskt event bakom sig. */
.mk-stream { gap: var(--gap-sm); }
.mk-banners { display: flex; flex-direction: column; gap: 6px; }
.mk-toggle { height: 26px; padding: 0 10px; border: 0; border-radius: var(--radius-control);
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.6px; background: var(--bg-surface-1);
  color: var(--text-secondary); box-shadow: inset 0 0 0 1px var(--border-strong); cursor: pointer; }
.mk-toggle:hover { background: var(--bg-surface-2); color: var(--text-primary); }
.mk-toggle:focus-visible { box-shadow: var(--focus-ring); }
.mk-toggle[aria-pressed="true"] { background: var(--tint-accent-bg); color: var(--accent-text);
  box-shadow: inset 0 0 0 1px var(--tint-accent-border); }
/* Strömmen scrollar i EGEN behållare — aldrig sidled-scroll på hela sidan. */
.mk-stream-rows { max-height: 420px; overflow-y: auto; overflow-x: hidden;
  border-radius: var(--radius-control); background: var(--bg-surface-0);
  box-shadow: inset 0 0 0 1px var(--border-strong); padding: 8px; }
.mk-events { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
.mk-event { background: var(--bg-surface-1); box-shadow: var(--hairline); border-radius: var(--radius-control);
  padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mk-event[data-unknown-type="true"] { background: var(--tint-warning-bg);
  box-shadow: inset 0 0 0 1px var(--tint-warning-border); }
.mk-event[data-relation="stale"] { background: var(--bg-surface-0); }
.mk-event-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mk-event-seq { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); flex: none; }
.mk-event-type { font-family: var(--font-mono); font-size: 11.5px; color: var(--text-primary);
  overflow-wrap: anywhere; }
.mk-event-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11px; color: var(--text-muted); }

@media (max-width: 1279px) { .mk-cols { gap: var(--gap-sm); } }
@media (max-width: 959px) {
  .mk-cols { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .mk-col-current { grid-column: 1 / -1; order: -1; }
}
@media (max-width: 719px) {
  .mk-cols { grid-template-columns: minmax(0, 1fr); }
  .mk-col-current { order: -1; }
  .mk-col-backlog { order: 1; }
  .mk-col-completed { order: 2; }
  .mk-fields { grid-template-columns: minmax(0, 1fr); }
  /* På den smalaste vyn bryts även originalkällan hellre än att kräva sidled-scroll för att
     läsas. Källan är fortfarande byte-identisk — bara ombruten, aldrig kapad. */
  .mk-raw[data-source-raw="true"] { white-space: pre-wrap; overflow-wrap: anywhere; }
}
`;
