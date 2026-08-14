/**
 * ROOM-01 · Fabriksrummets EGET stilark (`rm-`), injicerat som ett ANDRA stiltagg-block
 * bredvid LOOP_CSS.
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
.rm-head-title { font-size: var(--fs-heading); line-height: var(--lh-heading); font-weight: 600;
  color: var(--text-primary); margin: 0; }
.rm-head-intro { margin: 0; font-size: 12.5px; line-height: 18px; color: var(--text-secondary);
  max-width: 82ch; overflow-wrap: anywhere; }
.rm-head-note { margin: 0; font-size: 11px; line-height: 16px; color: var(--text-muted);
  max-width: 82ch; overflow-wrap: anywhere; }
.rm-confirm { display: flex; flex-wrap: wrap; gap: 6px var(--gap-lg); align-items: flex-start; }
.rm-confirm-item { display: flex; flex-direction: column; gap: 3px; min-width: 0; }

/* ── Uppmärksamhet ────────────────────────────────────────────────────────── */
.rm-attention { display: flex; flex-direction: column; gap: 7px; background: var(--bg-surface-0);
  box-shadow: var(--hairline); border-radius: var(--radius-card); padding: 12px 14px; }
.rm-attention-heading { margin: 0; font-family: var(--font-mono); font-size: 10.5px;
  letter-spacing: 1.3px; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; }
.rm-attention-list { list-style: none; margin: 0; padding: 0; display: flex;
  flex-direction: column; gap: 7px; }
.rm-attention-item { display: flex; flex-direction: column; gap: 4px; background: var(--bg-surface-1);
  box-shadow: var(--hairline); border-radius: var(--radius-control); padding: 9px 11px; min-width: 0; }
.rm-attention-item.mk-tone-warning { background: var(--tint-warning-bg);
  box-shadow: inset 0 0 0 1px var(--tint-warning-border); }
.rm-attention-item.mk-tone-danger { background: var(--tint-danger-bg);
  box-shadow: inset 0 0 0 1px var(--tint-danger-border); }
.rm-attention-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.rm-attention-text { font-size: 12px; line-height: 17px; color: var(--text-secondary);
  max-width: 82ch; overflow-wrap: anywhere; }
.rm-attention-ids { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted);
  overflow-wrap: anywhere; }

/* ── Rummets scen: in → arbete → ut ────────────────────────────────────────── */
.rm-stage { display: grid; gap: var(--gap-md); align-items: start;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.7fr) minmax(0, 0.85fr); }
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
/* Mitten är rummets blick: samma tokens, men lyft ur sidan så att den läses först. */
.rm-lane-focus .mk-col { box-shadow: inset 0 0 0 1px var(--border-strong),
  0 10px 26px -12px rgba(0, 0, 0, 0.7); padding: var(--pad-card) 20px; }
.rm-lane-focus .mk-col-title { color: var(--text-primary); }
/* Sidorna är stödytor och ska INTE väga lika tungt som mitten. */
.rm-lane-in .mk-col, .rm-lane-out .mk-col { background: var(--bg-surface-0); }
/* Backlog-kolumnens egen CTA pekar på SAMMA inlämningsyta som kompositören ovanför. Den tas
   inte bort (den är kolumnens etablerade ingång och provad som sådan) men den ska läsas som en
   genväg, inte som rummets primära handling — annars konkurrerar två knappar om samma roll. */
.rm-lane-in .mk-col [data-intake-cta="true"] { align-self: flex-start; font-size: 11.5px;
  padding: 5px 9px; color: var(--text-secondary); background: var(--bg-surface-1); }
.rm-lane-in .mk-col [data-intake-cta="true"]:hover { color: var(--text-primary); }
.rm-lane-in .mk-col [data-intake-cta="true"]:focus-visible { box-shadow: var(--focus-ring); }

/* ── Mata maskinen: rummets primära handling ───────────────────────────────── */
.rm-composer { background: var(--bg-panel); box-shadow: var(--hairline),
  0 2px 10px -4px rgba(0, 0, 0, 0.45); border-radius: var(--radius-card);
  padding: var(--pad-card) 18px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.rm-composer-title { margin: 0; font-size: var(--fs-body); line-height: var(--lh-body);
  font-weight: 600; color: var(--text-primary); }
.rm-composer-text { margin: 0; font-size: 12px; line-height: 17px; color: var(--text-secondary);
  max-width: 62ch; overflow-wrap: anywhere; }
.rm-cta { display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 18px;
  border-radius: var(--radius-control); background: var(--fill-primary); color: var(--on-primary);
  font-family: var(--font-mono); font-size: 12.5px; letter-spacing: 0.6px; font-weight: 600;
  text-decoration: none; align-self: flex-start; }
.rm-cta:hover { background: var(--fill-primary-hover); }
.rm-cta:focus-visible { box-shadow: var(--focus-ring); }

/* ── Identitetsremsan ─────────────────────────────────────────────────────── */
.rm-identity { display: flex; flex-direction: column; gap: 9px; background: var(--bg-surface-0);
  box-shadow: var(--hairline); border-radius: var(--radius-card); padding: 12px 14px; min-width: 0; }
.rm-identity-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; }
.rm-identity-title { margin: 0; font-family: var(--font-mono); font-size: 10.5px;
  letter-spacing: 1.3px; text-transform: uppercase; color: var(--text-secondary); font-weight: 600; }
.rm-identity-caption { font-size: 11px; color: var(--text-muted); }
.rm-identity-grid { display: grid; gap: 8px 14px; grid-template-columns: minmax(0, 1fr); }
.rm-identity-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.rm-identity-note { font-size: 11px; line-height: 16px; color: var(--text-muted);
  max-width: 72ch; overflow-wrap: anywhere; }
.rm-identity-lock { margin: 0; font-size: 11.5px; line-height: 16px; color: var(--text-secondary);
  background: var(--bg-surface-1); box-shadow: var(--hairline);
  border-radius: var(--radius-control); padding: 8px 10px; }

/* ── Tidslinjen ───────────────────────────────────────────────────────────── */
.rm-timeline { display: flex; flex-direction: column; gap: var(--gap-sm); }
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
.rm-details > summary { display: inline-flex; align-items: center; height: 24px; padding: 0 9px;
  border-radius: var(--radius-control); font-family: var(--font-mono); font-size: 11px;
  letter-spacing: 0.6px; color: var(--text-secondary); background: var(--bg-surface-0);
  box-shadow: inset 0 0 0 1px var(--border-strong); cursor: pointer; list-style: none; }
.rm-details > summary::-webkit-details-marker { display: none; }
.rm-details > summary:hover { color: var(--text-primary); background: var(--bg-surface-2); }
.rm-details > summary:focus-visible { box-shadow: var(--focus-ring); }
.rm-details[open] > summary { margin-bottom: 6px; }

/* Bred teknisk text scrollar i SIN EGEN behållare — aldrig hela sidan. */
.rm-scroll-x { overflow-x: auto; min-width: 0; }

@media (max-width: 1279px) {
  .rm-stage { gap: var(--gap-sm);
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.5fr) minmax(0, 0.9fr); }
}
@media (min-width: 720px) {
  .rm-identity-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1280px) {
  .rm-identity-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (max-width: 959px) {
  .rm-stage { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .rm-lane-focus { grid-column: 1 / -1; order: -1; }
}
@media (max-width: 719px) {
  .rm-stage { grid-template-columns: minmax(0, 1fr); }
  .rm-lane-focus { order: -1; }
  .rm-lane-in { order: 1; }
  .rm-lane-out { order: 2; }
}
`;
