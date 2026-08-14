/**
 * V7 · "Senaste kommandon" — verb, tidpunkt, status. Ingenting mer.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — COMMAND_CLIENT ("Kommandostatus i UI:t":
 * köad → hämtad av controllern → utförd / avvisad: <orsak> / utgången) och COMPONENT_PLAN
 * (CommandLog).
 *
 * BINDANDE REGLER SOM KOMPONENTEN BÄR
 * -----------------------------------
 * · Loggen visar KOMMANDONS öde. Aldrig en uppgifts tillstånd, aldrig en fas, aldrig en dom.
 * · Status ägs av controllern. Vet Verkstadsgolvet inte, står det "okänd" — aldrig "utförd".
 * · Ett avslag visas ORDAGRANT. Ingen omskrivning, ingen sammanfattning, ingen "försök igen".
 * · Saknad tidpunkt renderas exakt "—" (samma regel som resten av kontrollrummet).
 * · Ren komponent utan eget tillstånd: samma rader ger samma markup.
 */
import * as React from "react";
import {
  COMMAND_VERB_LABELS,
  commandLogPresentation,
  type CommandLogEntry,
} from "@/lib/loop/commands";
import { MISSING, orMissing } from "@/lib/loop/labels";

export default function CommandLog({
  entries,
  now = new Date(),
}: {
  entries: readonly CommandLogEntry[];
  /** Klockan är injicerbar så att provet kan mäta utgångna rader utan att vänta i realtid. */
  now?: Date;
}) {
  return (
    <div className="mk-group" data-command-log="true">
      <div className="mk-group-head">
        <span className="mk-group-name">Senaste kommandon</span>
        <span className="mk-group-count">{entries.length}</span>
      </div>

      {entries.length === 0 ? (
        <p className="mk-empty">Inga kommandon skickade i den här vyn.</p>
      ) : (
        <div className="mk-list">
          {entries.map((entry) => (
            <CommandLogRow key={entry.command_id} entry={entry} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommandLogRow({ entry, now }: { entry: CommandLogEntry; now: Date }) {
  const presentation = commandLogPresentation(entry, now);
  const issuedAt = orMissing(entry.issued_at);

  return (
    <div
      className="mk-file"
      data-command-row={entry.command_id}
      data-command-verb={entry.verb}
      data-command-tone={presentation.tone}
    >
      <span className="mk-file-name">
        {COMMAND_VERB_LABELS[entry.verb]}
        {" · "}
        <span
          className={issuedAt === MISSING ? "mk-value mk-missing" : "mk-value"}
          data-missing={issuedAt === MISSING ? "true" : "false"}
        >
          {issuedAt}
        </span>
      </span>

      <span className="mk-file-reason" data-command-status={presentation.label}>
        {presentation.label}
      </span>

      {presentation.verbatim !== null && (
        <span className="mk-file-reason" data-command-verbatim="true">
          {presentation.verbatim}
        </span>
      )}

      <span className="mk-card-id" data-command-id={entry.command_id}>
        {entry.command_id}
      </span>
    </div>
  );
}
