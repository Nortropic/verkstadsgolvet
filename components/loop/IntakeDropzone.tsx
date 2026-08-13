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
import { useState } from "react";
import {
  INTAKE_ACCEPTED_EXTENSIONS,
  INTAKE_ACCEPT_ATTRIBUTE,
  INTAKE_BLOCKED_ON,
  INTAKE_DISABLED_REASON,
  INTAKE_MAX_FILES,
  INTAKE_MAX_FILE_BYTES,
  groupDigits,
  intakeSubmissionEnabled,
  pasteSourceName,
  sourceStats,
  validateIntakeSelection,
  type IntakeCandidate,
  type IntakeSelection,
} from "@/lib/loop/intake";

/**
 * Det klienten läser ur en vald fil: namn, storlek och webbläsarens påstådda typ.
 * INNEHÅLLET rörs inte. Exporterad så provet kan mäta exakt den avbildningen.
 */
export function toCandidate(file: { name: string; size: number; type: string }): IntakeCandidate {
  return { file_name: file.name, byte_size: file.size, mime_type: file.type };
}

/**
 * Domarna över ett urval. Ren komponent utan tillstånd — samma urval ger samma markup, och
 * provet kan rendera den utan att simulera drag-and-drop i en webbläsare.
 */
export function SelectionReport({ selection }: { selection: IntakeSelection | null }) {
  if (selection === null) {
    return (
      <p className="mk-hint" data-selection="empty">
        Ingen fil är vald ännu.
      </p>
    );
  }

  return (
    <div className="mk-list" data-selection="report">
      {selection.selection_rejection && (
        <p
          className="mk-note mk-tone-warning"
          data-selection-rejection={selection.selection_rejection.code}
        >
          {selection.selection_rejection.message}
        </p>
      )}

      {selection.verdicts.map((verdict, index) => (
        <div
          className={`mk-file ${verdict.accepted ? "mk-tone-success" : "mk-tone-danger"}`}
          key={`${verdict.candidate.file_name}-${index}`}
          data-file-name={verdict.candidate.file_name}
          data-accepted={verdict.accepted ? "true" : "false"}
          data-rejection-code={verdict.accepted ? undefined : verdict.code}
        >
          <span className="mk-file-name">
            {verdict.candidate.file_name} · {groupDigits(verdict.candidate.byte_size)} byte
          </span>
          <span className="mk-file-reason">
            {verdict.accepted ? "Formellt godkänd. Inget skickas i fixturläge." : verdict.message}
          </span>
        </div>
      ))}

      <p className="mk-hint" data-accepted-count={selection.accepted.length}>
        Formellt godkända filer: {selection.accepted.length}. Varje fil hade blivit en EGEN källa
        med eget sha256 hos controllern — filer slås aldrig ihop.
      </p>
    </div>
  );
}

export default function IntakeDropzone() {
  const [selection, setSelection] = useState<IntakeSelection | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pasted, setPasted] = useState("");

  /** Enda vägen till en dom: formell validering i lib/loop/intake.ts. */
  function classify(files: readonly { name: string; size: number; type: string }[]) {
    setSelection(validateIntakeSelection(files.map((file) => toCandidate(file))));
  }

  const stats = sourceStats(pasted);
  const enabled = intakeSubmissionEnabled();

  return (
    <section className="mk-panel" data-intake-dropzone="true" aria-label="Mata maskinen">
      <h2 className="mk-panel-title">
        <span>Mata maskinen</span>
        <span className="mk-col-count">fixturläge</span>
      </h2>

      <div
        className={dragOver ? "mk-drop mk-drop-over" : "mk-drop"}
        data-drop-target="true"
        data-drag-over={dragOver ? "true" : "false"}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          classify(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="mk-drop-title">Dra Markdown-filer hit</span>
        <span className="mk-hint">
          Endast {INTAKE_ACCEPTED_EXTENSIONS.join(" och ")} · högst {INTAKE_MAX_FILES} filer per
          inlämning · högst {groupDigits(INTAKE_MAX_FILE_BYTES)} byte per fil
        </span>
        <input
          className="mk-file-input"
          type="file"
          multiple
          accept={INTAKE_ACCEPT_ATTRIBUTE}
          data-file-picker="true"
          onChange={(event) => classify(Array.from(event.target.files ?? []))}
        />
      </div>

      <SelectionReport selection={selection} />

      <div className="mk-group">
        <span className="mk-label">Klistra in text</span>
        <textarea
          className="mk-textarea"
          rows={8}
          value={pasted}
          data-paste-area="true"
          placeholder="Klistra in Markdown här. Texten sparas som en egen källa med genererat filnamn."
          onChange={(event) => setPasted(event.target.value)}
        />
        <p className="mk-hint" data-paste-stats="true">
          {pasted === ""
            ? "Ingen text inklistrad ännu."
            : `${pasteSourceName(1)} · ${stats.characters} tecken · ${stats.lines} rader · ${groupDigits(stats.bytes)} byte`}
        </p>
        <p className="mk-hint">
          Verkstadsgolvet räknar tecken och rader — inget annat. Rubriker läses inte, källan delas
          inte upp och antalet uppgifter uppskattas aldrig här. Tolkningen är Nortropics.
        </p>
      </div>

      <div className="mk-actions">
        <button
          type="button"
          className="mk-button"
          disabled={!enabled}
          aria-disabled={enabled ? undefined : "true"}
          data-submit-disabled={enabled ? "false" : "true"}
        >
          Lämna in källan
        </button>
        <span className="mk-hint" data-blocked-on={INTAKE_BLOCKED_ON}>
          Blockerad på {INTAKE_BLOCKED_ON}.
        </span>
      </div>

      <p className="mk-note mk-tone-warning" data-disabled-reason="true">
        {INTAKE_DISABLED_REASON}
      </p>
    </section>
  );
}
