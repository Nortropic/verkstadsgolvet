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
.mk-drop { border-radius: var(--radius-control); background: var(--bg-surface-0);
  box-shadow: inset 0 0 0 1px var(--border-strong); padding: 22px 18px; display: flex;
  flex-direction: column; align-items: center; gap: 8px; text-align: center; }
.mk-drop-over { background: var(--tint-accent-bg); box-shadow: inset 0 0 0 1px var(--tint-accent-border); }
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
   ingen egen orsak och kan därför stå i flera spalter på breda vyer. */
@media (min-width: 960px) {
  .mk-list-dense { display: grid; gap: 6px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.mk-file { display: flex; flex-direction: column; gap: 3px; background: var(--bg-surface-1);
  box-shadow: var(--hairline); border-radius: var(--radius-control); padding: 9px 11px; min-width: 0; }
.mk-file.mk-tone-danger { background: var(--tint-danger-bg); box-shadow: inset 0 0 0 1px var(--tint-danger-border); }
.mk-file.mk-tone-success { background: var(--tint-success-bg); box-shadow: inset 0 0 0 1px var(--tint-success-border); }
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
.mk-button:focus-visible { box-shadow: var(--focus-ring); }
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
