/**
 * ROOM-01 · "Mata maskinen" — rummets PRIMÄRA handling.
 *
 * VAD DEN ÄR
 * ----------
 * En tydlig ingång till den befintliga inlämningsytan (`/loop/mata`), med ärlig text om vad det
 * innebär att mata maskinen. Ingenting mer: ROOM-01 bygger ingen uppladdning, inget kommando,
 * ingen modellanrop och ingen tolkning av Markdown.
 *
 * BINDANDE REGLER
 * ---------------
 * · INGET FÄLT SOM LÅTSAS SKICKA. En ruta att skriva i, utan mottagare, är ett löfte som inte
 *   kan hållas — ytan visar därför bara vägen till den byggda inlämningsytan.
 * · Länken är en `next/link` precis som backlog-kolumnens CTA: en rå `<a>` river hela
 *   kontrollrummet vid klick och tvingar fram en kall omstart av vyn.
 * · Verkstadsgolvet kompilerar ALDRIG en källa till uppgifter. Controllern läser bytes, hashar
 *   själv och skapar sin egen oföränderliga källa innan någon planering börjar.
 * · Inlämningsytan är byggd i fixturläge. Den beskrivs aldrig som en levande kanal.
 */
import * as React from "react";
import Link from "next/link";
import { INTAKE_BLOCKED_ON, INTAKE_MODE } from "@/lib/loop/intake";

export const COMPOSER_TITLE = "Mata maskinen";

export const COMPOSER_WHAT =
  "Lämna in en källa i Markdown. Controllern läser bytes, räknar om hashen själv och skapar sin " +
  "egen oföränderliga källa innan planering börjar — den här vyn tolkar aldrig texten till uppgifter.";

export const COMPOSER_MODE_NOTE =
  `Inlämningsytan är byggd i fixturläge (${INTAKE_MODE}): den visar hela vägen, men lämnar ` +
  `ingenting till controllern förrän ${INTAKE_BLOCKED_ON} finns. Det är inte livedata.`;

export default function WorkComposer() {
  return (
    <section className="rm-composer" data-work-composer="true" aria-label={COMPOSER_TITLE}>
      {/* h2: samma nivå som kolumnernas rubriker — rummets ytor är syskon, inte nästlade. */}
      <h2 className="rm-composer-title">{COMPOSER_TITLE}</h2>

      {/*
        HANDLINGEN FÖRST. Rummets primära ingång ska nås utan att först läsa två stycken; texten
        under är ramen kring handlingen, inte ett villkor för den. Ingen av raderna är borta —
        de har bytt plats med knappen.
      */}
      <Link className="rm-cta" href="/loop/mata" data-room-composer-cta="true">
        Öppna inlämningen
      </Link>

      <p className="rm-composer-text">{COMPOSER_WHAT}</p>
      <p className="rm-composer-text" data-composer-mode="fixture">
        {COMPOSER_MODE_NOTE}
      </p>
    </section>
  );
}
