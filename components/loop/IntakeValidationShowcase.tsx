/**
 * V8* · Den formella valideringen körd på FIXTURENS kandidatfiler — synlig utan interaktion.
 *
 * VARFÖR YTAN FINNS
 * -----------------
 * Avslagsraderna, antalsgränsens fail-closed-banner och orsakstexterna är exit-kriterier för
 * den här skivan, men de uppstår först efter att någon dragit eller valt filer. En serverrenderad
 * sida visar dem därför aldrig, och en granskning av faktiska skärmbilder kan inte se dem — de
 * blir bevisade i prov men osedda i verkligheten. Panelen kör därför de GENERERADE
 * fixturkandidaterna genom EXAKT samma funktion som dropzonen använder
 * (`validateIntakeSelection`) och renderar resultatet med EXAKT samma komponent
 * (`SelectionReport`).
 *
 * BINDANDE REGLER
 * ---------------
 * · Detta är INGEN inlämning och ingen fil användaren valt. Panelen är märkt som fixturdriven
 *   både i text och maskinläsbart (`data-validation-showcase`), och får aldrig läsas som
 *   operatörens aktuella urval.
 * · Ingen parallell validering: hade panelen haft en egen kopia av reglerna vore den värdelös
 *   som bevis. Den enda vägen till en dom är lib/loop/intake.ts.
 * · Ingen datahämtning här. Kandidaterna skickas in av routen.
 * · Ingen transport, ingen hash, ingen tolkning av källor.
 */
import * as React from "react";
import { validateIntakeSelection, type IntakeCandidate } from "@/lib/loop/intake";
import { SelectionReport } from "./IntakeDropzone";

function Sample({
  id,
  title,
  note,
  candidates,
}: {
  id: string;
  title: string;
  note: string;
  candidates: readonly IntakeCandidate[];
}) {
  return (
    <div className="mk-group" data-sample={id}>
      <div className="mk-group-head">
        <span className="mk-group-name">{title}</span>
        <span className="mk-group-count">{candidates.length}</span>
      </div>
      <p className="mk-hint">{note}</p>
      {/* Samma funktion, samma komponent som dropzonen — ingen parallell sanning. */}
      <SelectionReport selection={validateIntakeSelection(candidates)} />
    </div>
  );
}

/**
 * Panelens namn — EN sträng, använd både som synlig rubrik och som `aria-label`.
 *
 * Två formuleringar av samma rubrik ("Formell validering av fixturens kandidatfiler" mot
 * "Formell validering · fixturkandidater") ger seende och lyssnande läsare olika landmärken:
 * den som hör "kandidatfiler" hittar aldrig rubriken någon annan läser upp för dem. Namnet
 * bärs därför på ETT ställe.
 */
export const VALIDATION_SHOWCASE_TITLE = "Formell validering · fixturkandidater";

export default function IntakeValidationShowcase({
  candidates,
  overCount,
}: {
  candidates: readonly IntakeCandidate[];
  overCount: readonly IntakeCandidate[];
}) {
  return (
    <section
      className="mk-panel"
      data-validation-showcase="true"
      data-fixture-driven="true"
      aria-label={VALIDATION_SHOWCASE_TITLE}
    >
      <h2 className="mk-panel-title">
        <span>{VALIDATION_SHOWCASE_TITLE}</span>
        <span className="mk-col-count">inget urval, ingen inlämning</span>
      </h2>

      <p className="mk-hint">
        Raderna nedan är GENERERADE fixturfiler körda genom samma validering som dropzonen
        använder. Det är ingen fil du valt, ingenting lämnas in och ingen byte läses — panelen
        visar bara vad klienten svarar på en filtyp, en storlek och ett antal.
      </p>

      <Sample
        id="mixed"
        title="Blandat urval"
        note="Markdown accepteras. Fel ändelse, fel MIME-typ, tom fil och fil över storleksgränsen avvisas var och en med sin egen orsak."
        candidates={candidates}
      />

      <Sample
        id="over-count"
        title="Urval över antalsgränsen"
        note="Alla filer är formellt felfria, men antalsgränsen fäller HELA urvalet: ingen fil lämnas in, och Verkstadsgolvet väljer aldrig ut några åt dig."
        candidates={overCount}
      />
    </section>
  );
}
