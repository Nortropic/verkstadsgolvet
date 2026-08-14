"use client";

/**
 * V8* · Dropzonen: dra · välj · klistra in — och FORMELL validering, ingenting mer.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — MARKDOWN_INTAKE_UX ("Tre inmatningssätt",
 * "Validering i klienten (endast formell, aldrig semantisk)") och COMPONENT_PLAN
 * (`IntakeDropzone.tsx — dra/välj/klistra, formell validering`).
 *
 * BINDANDE REGLER SOM KOMPONENTEN BÄR
 * -----------------------------------
 * · INGEN TRANSPORT. Ingen `fetch`, ingen `XMLHttpRequest`, ingen `FormData`, ingen `action`,
 *   ingen route. Knappen för inlämning är avstängd med ORDAGRANN orsak: intake-transporten ägs
 *   av nortropic-system S10 + S13 (B5) och finns inte. Ingen fejkad inlämning, ingen kö.
 * · INGEN HASH. Klienten beräknar aldrig sha256 — och ett värde beräknat här hade ändå aldrig
 *   varit trust-anchor (B5, låst).
 * · INGEN SEMANTIK. Ingen rubrikparsning, ingen uppgiftsdelning, ingen uppskattning av antal
 *   tasks. Endast tecken och rader räknas, och bara för texten användaren själv klistrat in.
 * · Filens BYTES läses inte ens. Det finns ingen transport att lämna dem till i den här skivan,
 *   så att läsa dem hade bara gett sken av att något skickades.
 * · Ett avvisat val visas med sin orsak. Ingen fil faller bort tyst.
 */
import * as React from "react";
import { useRef, useState } from "react";
import {
  INTAKE_ACCEPTED_EXTENSIONS,
  INTAKE_ACCEPT_ATTRIBUTE,
  INTAKE_BLOCKED_ON,
  INTAKE_DISABLED_REASON,
  INTAKE_EMPTY_DROP_TEXT,
  INTAKE_EMPTY_PICK_TEXT,
  INTAKE_MAX_FILES,
  INTAKE_MAX_FILE_BYTES,
  INTAKE_NO_SELECTION_TEXT,
  INTAKE_PASTE_ACCEPTED_TEXT,
  classifyIntakeCandidate,
  groupDigits,
  intakeRejectionMessage,
  intakeSubmissionEnabled,
  pasteSourceName,
  sourceStats,
  sourceStatsText,
  validateIntakeSelection,
  type IntakeCandidate,
  type IntakeSelection,
  type IntakeVerdict,
} from "@/lib/loop/intake";

/**
 * DOM-identiteter för kopplingen etikett ↔ kontroll och kontroll ↔ förklaring.
 *
 * Bärs som konstanter (och exporteras) av två skäl: en `htmlFor` som pekar på ett id som inte
 * finns är en TYST tillgänglighetsregression som ingen ser i en skärmdump, och provet ska kunna
 * mäta att varje koppling faktiskt landar i markupen. Ytan renderas en gång per sida, så
 * stabila id är korrekta här — ingen id-kollision kan uppstå.
 */
export const INTAKE_DOM_IDS = {
  filePicker: "intake-filvaljare",
  fileLimits: "intake-filgranser",
  pasteArea: "intake-inklistrad-text",
  pasteStats: "intake-inklistrad-matt",
  pasteRule: "intake-inklistrad-regel",
  pasteVerdict: "intake-inklistrad-dom",
  blockedOn: "intake-blockerad-pa",
  disabledReason: "intake-avstangd-orsak",
} as const;

const IDS = INTAKE_DOM_IDS;

/**
 * BESKRIVNINGSKEDJORNA — högst TVÅ noder per kontroll, och en enda plats där de bestäms.
 *
 * En `aria-describedby` med fem id:n läses upp som ett stycke utan andhämtning varje gång
 * kontrollen får fokus, och det som faktiskt gällde just då drunknar. Kedjan hålls därför kort
 * och SAMMANHÄNGANDE: varje kontroll beskrivs av sin egen regel, och blockeringsorsaken hänger
 * på den kontroll den faktiskt blockerar — inlämningsknappen — i stället för att upprepas vid
 * varje inmatningssätt.
 *
 * Domen över en inklistrad text ingår medvetet INTE i kedjan: den är ett live-område (den
 * annonserar sig själv när den ändras), och en beskrivning som också annonseras hörs dubbelt.
 */
export const INTAKE_DESCRIBED_BY = {
  filePicker: [IDS.fileLimits],
  pasteArea: [IDS.pasteStats, IDS.pasteRule],
  submit: [IDS.blockedOn, IDS.disabledReason],
} as const;

/** Högst två beskrivningsnoder per kontroll — bärs som en MÄTBAR gräns, inte som en vana. */
export const INTAKE_MAX_DESCRIBED_BY_NODES = 2;

/**
 * Panelens namn — SAMMA sträng i den synliga rubriken och i sektionens `aria-label`.
 *
 * Sidans h1 är "Mata maskinen"; panelen namnger därför sin egen uppgift i stället för att
 * upprepa sidans titel som en andra rubrik med identisk text.
 */
export const INTAKE_PANEL_TITLE = "Välj en Markdown-källa";

/**
 * Hur många gånger dragytan har fått `dragenter` utan matchande `dragleave`.
 *
 * `dragleave` utlöses ÄVEN när pekaren går in i ett BARN i zonen (titeln, hinten, etiketten).
 * Släcks markeringen på varje `dragleave` blinkar den medan användaren rör sig inom samma yta.
 * Räknaren gör i stället lämnandet symmetriskt: zonen är aktiv så länge fler `dragenter` än
 * `dragleave` observerats, och ett släpp nollställer alltid (ingen `dragleave` följer på ett
 * `drop`, så utan nollställning hade zonen fastnat i aktivt läge).
 *
 * Ren funktion, exporterad, så flimret kan BEVISAS i prov i stället för att provas för hand.
 */
export function dragDepthAfter(depth: number, kind: "enter" | "leave" | "drop"): number {
  if (kind === "drop") return 0;
  if (kind === "enter") return depth + 1;
  return Math.max(0, depth - 1);
}

/** Zonen är markerad så länge något faktiskt svävar över den. */
export function isDragActive(depth: number): boolean {
  return depth > 0;
}

/**
 * Det klienten läser ur en vald fil: namn, storlek och webbläsarens påstådda typ.
 * INNEHÅLLET rörs inte. Exporterad så provet kan mäta exakt den avbildningen.
 */
export function toCandidate(file: { name: string; size: number; type: string }): IntakeCandidate {
  return { file_name: file.name, byte_size: file.size, mime_type: file.type };
}

/**
 * En händelse som INTE gav ett urval. Båda inmatningssätten kan producera noll filer, och
 * ingetdera får då rita ett rapportskal: ett tomt skal i positiv ton läser som "det gick bra".
 */
export type IntakeEmptyEvent = "drop" | "pick";

/** Tomlägets ordagranna text. Säger vad som inte hände — aldrig ett tyst ingenting. */
export function emptyEventText(event: IntakeEmptyEvent | null): string {
  if (event === "drop") return INTAKE_EMPTY_DROP_TEXT;
  if (event === "pick") return INTAKE_EMPTY_PICK_TEXT;
  return INTAKE_NO_SELECTION_TEXT;
}

/**
 * Den ANNONSERADE domen över inklistrad text — beroende av utfallets KOD, aldrig av storleken.
 *
 * Orsakstexten kan bära kandidatens exakta bytetal ("… (filen är 1 048 601 byte)"). I ett
 * live-område är den formen ett löpande mått förklätt till dom: varje tangenttryck i en text
 * som redan passerat gränsen ändrar siffran, och ett artigt live-område köar då en uppläsning
 * per tecken — precis den defekt måttraden gjordes icke-live för att slippa. Kandidaten utelämnas
 * därför här (argumentet är valfritt i `intakeRejectionMessage`), så texten är IDENTISK för alla
 * storlekar över gränsen och området tiger tills utfallet faktiskt vänder.
 *
 * Det exakta bytetalet försvinner inte: det står kvar i den icke-live måttraden
 * (`intake-inklistrad-matt`), där det kan läsas utan att annonseras.
 */
export function pasteVerdictText(verdict: IntakeVerdict | null): string {
  if (verdict === null) return "";
  return verdict.accepted ? INTAKE_PASTE_ACCEPTED_TEXT : intakeRejectionMessage(verdict.code);
}

/** En kompakt mening om urvalet — det som ska HÖRAS när valet ändras, inte tjugoen rader. */
function selectionStatusText(
  selection: IntakeSelection | null,
  emptyEvent: IntakeEmptyEvent | null,
): string {
  if (selection === null) return emptyEventText(emptyEvent);
  const chosen = selection.verdicts.length;
  const rejected = selection.verdicts.filter((verdict) => !verdict.accepted).length;
  if (selection.selection_rejection !== null) {
    return `${groupDigits(chosen)} filer valda. Antalsgränsen fällde hela urvalet — ingen fil lämnas in.`;
  }
  return (
    `${groupDigits(chosen)} valda: ${groupDigits(selection.accepted.length)} formellt godkända, ` +
    `${groupDigits(rejected)} avvisade.`
  );
}

/**
 * Domarna över ett urval. Ren komponent utan tillstånd — samma urval ger samma markup, och
 * provet kan rendera den utan att simulera drag-and-drop i en webbläsare.
 *
 * `live` gör statusraden till ett artigt live-område. Den sätts BARA av dropzonen, vars urval
 * faktiskt ändras: en statisk kopia i fixturpanelen ska inte annonsera något. Behållaren
 * renderas alltid — även utan urval — så att live-området finns i DOM:en INNAN det uppdateras;
 * ett område som skapas samtidigt som sitt innehåll annonseras inte pålitligt.
 */
export function SelectionReport({
  selection,
  live = false,
  emptyEvent = null,
}: {
  selection: IntakeSelection | null;
  live?: boolean;
  /**
   * Varför det inte finns något urval, när orsaken är en händelse och inte "inget har hänt".
   * Utan den blir ett släpp av markerad text eller ett avbrutet filval helt TYST: inget ändras
   * på skärmen, och inget annonseras. Tomläget säger i stället vad som inte togs emot.
   */
  emptyEvent?: IntakeEmptyEvent | null;
}) {
  /** Hela urvalet fällt (antalsgränsen) — då lämnas ingen fil in, hur ren den än är. */
  const selectionFell = selection !== null && selection.selection_rejection !== null;

  return (
    <div
      className="mk-group"
      data-selection={selection === null ? "empty" : "report"}
      data-selection-fell={selectionFell ? "true" : "false"}
      data-selection-empty-event={selection === null && emptyEvent !== null ? emptyEvent : undefined}
    >
      <p
        className="mk-hint"
        data-selection-status="true"
        role={live ? "status" : undefined}
        aria-live={live ? "polite" : undefined}
      >
        {selectionStatusText(selection, emptyEvent)}
      </p>

      {/*
        INGET rapportskal utan ett urval. En `change`-händelse med noll filer (avbruten dialog)
        och ett släpp utan filer går båda hit med `selection === null`, och då renderas varken
        rader, banner eller sammanfattning — bara meningen ovan.
      */}
      {selection !== null && <SelectionDetails selection={selection} />}
    </div>
  );
}

/** Banner, rader och sammanfattning. Renderas först när ett urval finns. */
function SelectionDetails({ selection }: { selection: IntakeSelection }) {
  const selectionFell = selection.selection_rejection !== null;

  return (
    <>
      {selection.selection_rejection && (
        <p
          className="mk-note mk-tone-warning"
          data-selection-rejection={selection.selection_rejection.code}
        >
          {selection.selection_rejection.message}
        </p>
      )}

      {/*
        Fälls hela urvalet bär banneret ovan orsaken EN gång. Att upprepa exakt samma mening på
        var och en av tjugoen rader hade inte gjort avslaget tydligare — det hade dränkt den
        information som faktiskt skiljer sig åt. Raderna står då tätare, och ingen fil utelämnas.
      */}
      <div className={selectionFell ? "mk-list mk-list-dense" : "mk-list"} data-selection-rows="true">
        {selection.verdicts.map((verdict, index) => {
        /*
          `verdict.accepted` är filens EGNA formella dom. Att den domen är grön betyder inte att
          filen skulle lämnas in: fälls hela urvalet på antalsgränsen lämnas ingen fil in alls
          (validateIntakeSelection tömmer `accepted` fail-closed). Raden får då varken grön färg
          eller texten "godkänd" — annars svarar ytan två olika saker på samma fråga.
        */
          const included = verdict.accepted && !selectionFell;
          /*
            En formellt felfri fil i ett FÄLLT urval får varken succéton (den lämnas inte in)
            eller danger (den är inte fel). Den ritas nedtonad — blockerad — så att hela utfallet
            läses blockerat i sin helhet i stället för som en grön lista med en varning ovanför.
          */
          const tone = !verdict.accepted
            ? "mk-tone-danger"
            : included
              ? "mk-tone-success"
              : "mk-file-blocked";
          /*
            Egen orsak per rad så snart raden HAR en egen orsak. En formellt felfri fil i ett
            fällt urval har ingen — dess orsak är urvalets, och den står redan i banneret.
          */
          const reason = !verdict.accepted
            ? verdict.message
            : included
              ? "Formellt godkänd. Inget skickas i fixturläge."
              : null;
          return (
            <div
              className={`mk-file ${tone}`}
              key={`${verdict.candidate.file_name}-${index}`}
              data-file-name={verdict.candidate.file_name}
              data-accepted={verdict.accepted ? "true" : "false"}
              data-included={included ? "true" : "false"}
              data-rejection-code={verdict.accepted ? undefined : verdict.code}
            >
              <span className="mk-file-name">
                {verdict.candidate.file_name} · {groupDigits(verdict.candidate.byte_size)} byte
              </span>
              {reason !== null && <span className="mk-file-reason">{reason}</span>}
            </div>
          );
        })}
      </div>

      <p className="mk-hint" data-accepted-count={selection.accepted.length}>
        {selectionFell
          ? "Antalsgränsen fäller hela urvalet — Verkstadsgolvet väljer aldrig ut några filer åt dig."
          : "Varje fil hade blivit en EGEN källa med eget sha256 hos controllern — filer slås aldrig ihop."}
      </p>
    </>
  );
}

export default function IntakeDropzone() {
  const [selection, setSelection] = useState<IntakeSelection | null>(null);
  const [emptyEvent, setEmptyEvent] = useState<IntakeEmptyEvent | null>(null);
  const [dragDepth, setDragDepth] = useState(0);
  const [pasted, setPasted] = useState("");
  /** Filkontrollen behövs som referens för att kunna NOLLSTÄLLAS efter varje val (se nedan). */
  const filePicker = useRef<HTMLInputElement | null>(null);

  const dragOver = isDragActive(dragDepth);

  /**
   * Enda vägen till en dom: formell validering i lib/loop/intake.ts.
   *
   * NOLL filer är inget urval. Både ett släpp utan filer (markerad text, en länk, en mapp) och
   * en `change`-händelse med tom fillista (avbruten dialog) landar här, och båda ska ge samma
   * ärliga tomläge — aldrig ett rapportskal byggt över ingenting.
   */
  function classify(
    files: readonly { name: string; size: number; type: string }[],
    event: IntakeEmptyEvent,
  ) {
    if (files.length === 0) {
      setSelection(null);
      setEmptyEvent(event);
      return;
    }
    setSelection(validateIntakeSelection(files.map((file) => toCandidate(file))));
    setEmptyEvent(null);
  }

  const stats = sourceStats(pasted);
  const enabled = intakeSubmissionEnabled();

  /*
    Inklistrad text går "samma väg som en fil" (I7) — då ska den också dömas av SAMMA funktion.
    Storleksgränsen är den enda regel skivan påstår sig hålla, och en inklistrad källa över
    gränsen fick tidigare bara sitt bytetal utskrivet. Namn och typ är GENERERADE av appen (en
    inklistrad källa har inget filnamn från en webbläsare), så i praktiken kan bara storleken
    fälla — men domen hämtas ur classifyIntakeCandidate så att de två vägarna inte kan glida isär.
  */
  const pasteVerdict =
    pasted === ""
      ? null
      : classifyIntakeCandidate({
          file_name: pasteSourceName(1),
          byte_size: stats.bytes,
          mime_type: "text/markdown",
        });

  return (
    <section className="mk-panel" data-intake-dropzone="true" aria-label={INTAKE_PANEL_TITLE}>
      {/*
        Sidans h1 heter redan "Mata maskinen" (PageHeader). En h2 med EXAKT samma ord — versal
        i mono-stilen — läser som samma rubrik två gånger och säger ingenting om vad panelen
        gör. Hierarkin behålls (h1 → h2), men den andra nivån namnger sin egen yta. Panelens
        `aria-label` och den synliga rubriken är SAMMA sträng, ur samma konstant: ett
        programmatiskt namn som avviker från det synliga är en tyst regression.
      */}
      <h2 className="mk-panel-title">
        <span>{INTAKE_PANEL_TITLE}</span>
        <span className="mk-col-count">fixturläge</span>
      </h2>

      <div
        className={dragOver ? "mk-drop mk-drop-over" : "mk-drop"}
        data-drop-target="true"
        data-drag-over={dragOver ? "true" : "false"}
        data-drag-depth={dragDepth}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragDepth((depth) => dragDepthAfter(depth, "enter"));
        }}
        onDragOver={(event) => {
          /*
            `dragover` måste avbrytas för att ett släpp ska vara möjligt — men den sätter INGET
            tillstånd. Händelsen upprepas några gånger per sekund så länge pekaren rör sig över
            zonen, och att skriva markeringen därifrån hade gjort räknaren nedan meningslös.
          */
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          /*
            `dragleave` utlöses ÄVEN när pekaren går in i ett BARN i zonen (titeln, hinten,
            etiketten) — och det `dragenter` som barnet skickar först har redan räknats upp.
            Räknaren gör därför lämnandet symmetriskt och markeringen slutar flimra: zonen
            släcks först när lika många `dragleave` som `dragenter` observerats.
          */
          event.preventDefault();
          setDragDepth((depth) => dragDepthAfter(depth, "leave"));
        }}
        onDrop={(event) => {
          event.preventDefault();
          // Inget `dragleave` följer på ett släpp — räknaren nollställs, annars fastnar zonen.
          setDragDepth((depth) => dragDepthAfter(depth, "drop"));
          classify(Array.from(event.dataTransfer.files), "drop");
        }}
      >
        <span className="mk-drop-title">Dra Markdown-filer hit</span>
        <span className="mk-hint" id={IDS.fileLimits}>
          Endast {INTAKE_ACCEPTED_EXTENSIONS.join(" och ")} · högst {INTAKE_MAX_FILES} filer per
          inlämning · högst {groupDigits(INTAKE_MAX_FILE_BYTES)} byte per fil
        </span>
        {/*
          Den nativa filkontrollen ritar värdens EGEN krom på värdens EGET språk ("Choose Files",
          "No file chosen") — strängar som CSS inte når. I ett svenskt kontrollrum blir det både
          främmande och dubblerat: filnamnsstatusen bärs redan av SelectionReport nedanför.

          Kontrollen ligger därför kvar i DOM:en, med sitt id och sin etikett, men döljs VISUELLT
          (klipp-rektangel — aldrig display:none, som hade tagit bort den ur tabbordningen). Den
          synliga knappen är etiketten, som öppnar samma väljare vid klick. Fokusringen målas på
          etiketten via syskonregeln i LOOP_CSS, så tangentbordsfokus syns även när kontrollen
          inte gör det. Ordningen input → label är vad den regeln kräver.

          Den klippta rutan positioneras ABSOLUT och behöver därför en positionerad förälder:
          .mk-drop bär `position: relative` i LOOP_CSS. Utan den hade kontrollen lagt sig mot
          sidans hörn i stället för mot sin egen zon — osynligt, men inte där den hör hemma.
        */}
        <input
          className="mk-sr-only"
          id={IDS.filePicker}
          ref={filePicker}
          type="file"
          multiple
          accept={INTAKE_ACCEPT_ATTRIBUTE}
          aria-describedby={INTAKE_DESCRIBED_BY.filePicker.join(" ")}
          data-file-picker="true"
          onChange={(event) => {
            classify(Array.from(event.target.files ?? []), "pick");
            /*
              Kontrollens värde NOLLSTÄLLS efter varje val. Väljer någon samma fil igen skickar
              webbläsaren annars ingen `change`-händelse — värdet är oförändrat — och ytan står
              kvar med gammal dom trots att användaren precis gjorde ett val. Nollställningen
              utlöser ingen ny händelse och rör inget urval; den gör bara nästa val möjligt.
            */
            if (filePicker.current !== null) filePicker.current.value = "";
          }}
        />
        <label className="mk-file-label" htmlFor={IDS.filePicker}>
          Välj Markdown-filer
        </label>
      </div>

      {/*
        Ett av intakens TVÅ live-områden: urvalets status (här) och domen över inklistrad text.
        Båda annonserar en FÖRÄNDRING i utfall — aldrig löpande statistik. Fixturpanelens
        statiska kopia av samma rapport annonserar ingenting alls (`live` sätts inte där).
      */}
      <SelectionReport selection={selection} live emptyEvent={emptyEvent} />

      <div className="mk-group">
        {/* Programmatiskt namn på ytan, inte bara en visuell rubrik: placeholder är inget namn. */}
        <label className="mk-control-label" htmlFor={IDS.pasteArea}>
          Klistra in text
        </label>
        <textarea
          className="mk-textarea"
          id={IDS.pasteArea}
          rows={8}
          value={pasted}
          aria-describedby={INTAKE_DESCRIBED_BY.pasteArea.join(" ")}
          data-paste-area="true"
          placeholder="Klistra in Markdown här. Texten sparas som en egen källa med genererat filnamn."
          onChange={(event) => setPasted(event.target.value)}
        />
        {/*
          MÅTTRADEN ÄR INGET LIVE-OMRÅDE.

          Tecken, rader och byte ändras vid VARJE tangenttryck. Som artigt live-område hade raden
          därför köat en ny uppläsning per tecken, och skärmläsaren hade läst statistik i stället
          för det användaren skrev. Måttet står kvar synligt och ingår i textareans beskrivning
          (det hörs när kontrollen får fokus) — men det annonserar inte.

          Samma gruppering på alla tre talen, ur den delade `sourceStatsText`.
        */}
        <p className="mk-hint" id={IDS.pasteStats} data-paste-stats="true" data-paste-live="false">
          {pasted === ""
            ? "Ingen text inklistrad ännu."
            : `${pasteSourceName(1)} · ${sourceStatsText(stats)}`}
        </p>
        {/*
          DOMEN är det som annonseras — och den beror BARA på utfallets kod (se
          `pasteVerdictText`). Texten är därför oförändrad medan texten växer, oavsett om den
          ligger under eller redan över gränsen: området tiger under skrivandet och hörs i den
          stund utfallet faktiskt vänder. Ett bytetal i den annonserade texten hade gjort raden
          till löpande statistik igen, en uppläsning per tangenttryck.

          Behållaren renderas alltid, även tom: ett live-område som skapas samtidigt som sitt
          innehåll annonseras inte pålitligt.
        */}
        <p
          className={
            pasteVerdict !== null && !pasteVerdict.accepted
              ? "mk-note mk-tone-danger"
              : "mk-hint"
          }
          id={IDS.pasteVerdict}
          data-paste-verdict="true"
          data-paste-accepted={pasteVerdict === null ? undefined : pasteVerdict.accepted ? "true" : "false"}
          data-paste-rejection={pasteVerdict === null || pasteVerdict.accepted ? undefined : pasteVerdict.code}
          role="status"
          aria-live="polite"
        >
          {pasteVerdictText(pasteVerdict)}
        </p>
        <p className="mk-hint" id={IDS.pasteRule}>
          Verkstadsgolvet räknar tecken och rader — inget annat. Rubriker läses inte, källan delas
          inte upp och antalet uppgifter uppskattas aldrig här. Tolkningen är Nortropics.
        </p>
      </div>

      <div className="mk-actions">
        {/*
          ETT mönster för blockeringen, och det gäller HELA ytan: knappen bär `aria-disabled`
          plus `aria-describedby` — aldrig nativt `disabled` tillsammans med en beskrivning.
          Ett nativt avstängt element hoppas över eller töms på sin beskrivning av flera
          skärmläsarpar, och då hörs "Lämna in källan, otillgänglig" utan ett ord om varför.
          Med `aria-disabled` når fokus knappen, orsaken läses upp, och knappen gör ändå
          ingenting: den har ingen `onClick`, ingen `form` och ingen transport att anropa.

          Blockeringsorsaken hänger på den kontroll den faktiskt blockerar. Filväljaren och
          textarean beskriver sina EGNA regler i stället för att upprepa samma gula ruta — så
          blir varje beskrivningskedja högst två noder lång.
        */}
        <button
          type="button"
          className="mk-button"
          aria-disabled={enabled ? undefined : "true"}
          aria-describedby={enabled ? undefined : INTAKE_DESCRIBED_BY.submit.join(" ")}
          data-submit-disabled={enabled ? "false" : "true"}
        >
          Lämna in källan
        </button>
        <span className="mk-hint" id={IDS.blockedOn} data-blocked-on={INTAKE_BLOCKED_ON}>
          Blockerad på {INTAKE_BLOCKED_ON}.
        </span>
      </div>

      <p className="mk-note mk-tone-warning" id={IDS.disabledReason} data-disabled-reason="true">
        {INTAKE_DISABLED_REASON}
      </p>
    </section>
  );
}
