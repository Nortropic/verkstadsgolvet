/**
 * ROOM-01 · "Mata maskinen" — rummets PRIMÄRA handling.
 *
 * VAD DEN ÄR
 * ----------
 * Rummets ingång: den yta som ska gå att peka på och säga «här matar jag in arbete». Den visar
 * VAD man kan mata in (de två arbetsspåren), VÄGEN till den byggda inlämningsytan (`/loop/mata`)
 * och en ÄRLIG förhandsvisning av hur inlämningen kommer att kännas. Ingenting mer: skivan
 * bygger ingen uppladdning, inget kommando, inget modellanrop och ingen tolkning av Markdown.
 *
 * SHREDDER-01B · TVÅ ARBETSSPÅR, SOM FÖRSTA STEG
 * ----------------------------------------------
 * Nortropic tar emot två slags arbete: kundproduktion (bygg eller ändra ett kundprojekt) och
 * systemförbättringar (gör Nortropic självt bättre). Den som öppnar rummet ska se BÅDA utan att
 * läsa dokumentation, därför står valet först — med ett exempel per spår, i sin egen domäns språk.
 *
 * Och det är ett VISNINGSVAL i den här skivan, inte en typad modell: båda affordanserna leder
 * till samma byggda inlämningsyta, ingen klassificering sker, ingen modell tillfrågas och inget
 * tillstånd sparas. Den typade arbetsdomänen ägs av sin egen kontraktsskiva; att smyga in den i
 * ett schema härifrån hade varit att låta en visningsyta uppfinna ett kontrakt.
 *
 * BINDANDE REGLER
 * ---------------
 * · INGET FÄLT SOM LÅTSAS SKICKA. En ruta att skriva i, utan mottagare, är ett löfte som inte
 *   kan hållas — ytan visar därför bara vägen till den byggda inlämningsytan. Förhandsvisningen
 *   av dess tre vägar in är TEXT, aldrig en yta som tar emot något.
 * · Länkarna är `next/link` precis som backlog-kolumnens CTA: en rå `<a>` river hela
 *   kontrollrummet vid klick och tvingar fram en kall omstart av vyn.
 * · Verkstadsgolvet kompilerar ALDRIG en källa till uppgifter. Controllern läser bytes, hashar
 *   själv och skapar sin egen oföränderliga källa innan någon planering börjar.
 * · Inlämningsytan är byggd i fixturläge. Den beskrivs aldrig som en levande kanal, och den
 *   tekniska texten om det finns kvar ORDAGRANT — i upplysningsytan, ett svep bort.
 */
import * as React from "react";
import Link from "next/link";
import { INTAKE_BLOCKED_ON, INTAKE_MODE } from "@/lib/loop/intake";
import { SHOWROOM, SHOWROOM_BADGE } from "@/lib/loop/room/mode";

export const COMPOSER_TITLE = "Mata maskinen";

/** Ingressen: EN rad om vad ytan är till för. Detaljerna bärs av upplysningsytan längre ned. */
export const COMPOSER_LEAD = "Här går arbete in i Nortropic.";

/** Första steget i den kommande inlämningen: vilket slags arbete det gäller. */
export const COMPOSER_INTENT_QUESTION = "Vad vill du göra?";

/**
 * De två arbetsspåren, som PRESENTATION.
 *
 * `id` är ytans egen krok (och granskningens), aldrig ett kontraktsvärde: ingen snapshot, inget
 * schema och ingen fixtur känner till de här namnen. Exemplen är skrivna i respektive domäns
 * språk, så att skillnaden mellan spåren syns utan förklaring.
 */
export const COMPOSER_LANES = [
  {
    id: "kundproduktion",
    label: "Bygg / ändra kundprojekt",
    example: "Bygg en hemsida för Nisses Måleri med offertformulär och tre referensbilder.",
  },
  {
    id: "systemforbattringar",
    label: "Förbättra Nortropic",
    example: "Bygg klart credential proxy så att ingen agent hanterar en token själv.",
  },
] as const;

/** Inlämningens tre vägar in, som ÄRLIG förhandsvisning. Ytan tar inte emot något här. */
export const COMPOSER_AFFORDANCES = [
  "Dra Markdown hit",
  "Välj Markdown",
  "Klistra in arbete",
] as const;

/** Den kompakta sanningen vid förhandsvisningen: inget lämnas härifrån. */
export const COMPOSER_PREVIEW_NOTE =
  "Förhandsvisning i showroom — ingenting lämnas till controllern från den här ytan.";

export const COMPOSER_WHAT =
  "Lämna in en källa i Markdown. Controllern läser bytes, räknar om hashen själv och skapar sin " +
  "egen oföränderliga källa innan planering börjar — den här vyn tolkar aldrig texten till uppgifter.";

export const COMPOSER_MODE_NOTE =
  `Inlämningsytan är byggd i fixturläge (${INTAKE_MODE}): den visar hela vägen, men lämnar ` +
  `ingenting till controllern förrän ${INTAKE_BLOCKED_ON} finns. Det är inte livedata.`;

/** Etiketten på upplysningsytan som bär den fulla tekniska texten. */
export const COMPOSER_DISCLOSURE_LABEL = "Så behandlas källan";

export default function WorkComposer() {
  return (
    <section className="rm-composer" data-work-composer="true" aria-label={COMPOSER_TITLE}>
      {/* h2: samma nivå som kolumnernas rubriker — rummets ytor är syskon, inte nästlade. */}
      <div className="rm-composer-head">
        <h2 className="rm-composer-title">{COMPOSER_TITLE}</h2>
        <span className="rm-flag" data-composer-flag="true">
          {SHOWROOM_BADGE}
        </span>
      </div>
      <p className="rm-composer-lead">{COMPOSER_LEAD}</p>

      {/*
        VALET FÖRST. Det är så inlämningen kommer att börja, och det är också det snabbaste sättet
        att se att Nortropic tar emot två slags arbete. Båda länkarna går till samma byggda yta:
        de är affordanser, inte en klassificering.
      */}
      <p className="rm-composer-question" data-composer-question="true">
        {COMPOSER_INTENT_QUESTION}
      </p>
      <div
        className="rm-intents"
        data-composer-intents="true"
        role="group"
        aria-label={COMPOSER_INTENT_QUESTION}
      >
        {COMPOSER_LANES.map((lane) => (
          <Link
            key={lane.id}
            className="rm-intent"
            href="/loop/mata"
            data-composer-lane={lane.id}
          >
            <span className="rm-intent-label">{lane.label}</span>
            <span className="rm-intent-example">{lane.example}</span>
          </Link>
        ))}
      </div>

      {/*
        HANDLINGEN. Rummets primära ingång ska nås utan att först läsa två stycken; texten under
        är ramen kring handlingen, inte ett villkor för den. Ingen av raderna är borta — de har
        bytt plats med knappen och ligger nu i upplysningsytan längst ned.
      */}
      <Link className="rm-cta" href="/loop/mata" data-room-composer-cta="true">
        Öppna inlämningen
      </Link>

      {/*
        Förhandsvisningen är STATISK TEXT om hur inlämningen kommer att kännas. Den ser med flit
        inte ut som en mottagande yta: inga fält, ingen ram att släppa i, ingen knapp.
      */}
      <div className="rm-affordances" data-composer-preview="true">
        {COMPOSER_AFFORDANCES.map((step) => (
          <span className="rm-affordance" key={step} data-composer-affordance={step}>
            {step}
          </span>
        ))}
      </div>
      <p className="rm-composer-note" data-composer-preview-note="true">
        {COMPOSER_PREVIEW_NOTE}
      </p>

      {/*
        PROSAN ÄR FLYTTAD, INTE BORTTAGEN (§owner-8). Båda styckena står ordagrant kvar — och
        fixturmärkningen med dem — bakom en upplysningsyta av samma sort som rummets bevisytor.
        Rummets primära handling ska kunna läsas på en rad; det tekniska ska kunna läsas i sin
        helhet av den som vill.
      */}
      <details className="rm-details" data-composer-disclosure="true">
        <summary>
          <span className="rm-flag">{SHOWROOM}</span> {COMPOSER_DISCLOSURE_LABEL}
        </summary>
        <p className="rm-composer-text">{COMPOSER_WHAT}</p>
        <p className="rm-composer-text" data-composer-mode="fixture">
          {COMPOSER_MODE_NOTE}
        </p>
      </details>
    </section>
  );
}
