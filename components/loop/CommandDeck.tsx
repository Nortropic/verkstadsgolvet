"use client";

/**
 * V7 · Kommandoytan i kontrollrummet: knapparna och "senaste kommandon".
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — COMMAND_CLIENT och TRANSPORT_PLAN
 * ("failure semantics": fail-closed på kommandon — knappar avaktiveras MED ORSAK).
 *
 * BINDANDE REGLER SOM YTAN BÄR
 * ----------------------------
 * · Ytan äger ENDAST kommandologgen. Den rör aldrig en uppgift, en kolumn eller en fas: task
 *   state kommer ur controllerns snapshot och ändras aldrig av ett klick (SNAPSHOT_WINS).
 * · Payloads byggs ur SNAPSHOTENS egna värden (`run_id`, `task_id`) och `expected_watermark`
 *   är exakt det vattenmärke vyn faktiskt såg. Ingenting hittas på.
 * · Två av de fem verben har medvetet ingen knapp här, och det står utskrivet:
 *   `intake.submit` hör till intake-ytan (V8), och `run.start` kräver ett `config_ref` som
 *   ägs av controllern (S13). Verkstadsgolvet uppfinner aldrig en konfigurationsreferens.
 * · Kommandokanalen är stängd tills S13 är byggd OCH verifierad. Knapparna är då avstängda med
 *   ordagrann orsak — aldrig en knapp som ser klickbar ut mot en kö som inte finns.
 */
import * as React from "react";
import { useCallback, useState } from "react";
import {
  COMMAND_QUEUE_BLOCKED_ON,
  commandChannelEnabled,
  type CommandIntent,
  type CommandLogEntry,
} from "@/lib/loop/commands";
import CommandButton from "./CommandButton";
import CommandLog from "./CommandLog";

/** Verb utan knapp i den här vyn, med sitt skäl. Bärs som data så provet kan mäta ärligheten. */
export const VERBS_WITHOUT_BUTTON_HERE = [
  {
    verb: "intake.submit",
    reason: "hör till intake-ytan (Mata maskinen), inte till körningens kontrollpanel",
  },
  {
    verb: "run.start",
    reason:
      "kräver ett config_ref som ägs av controllern (nortropic-system S13). Verkstadsgolvet " +
      "uppfinner aldrig en konfigurationsreferens",
  },
] as const;

export type CommandDeckProps = {
  runId: string;
  /** Vattenmärket vyn SÅG. Controllern avvisar kommandot om läget hunnit ändras. */
  watermark: number;
  currentTaskId: string | null;
  channelEnabled?: boolean;
  now?: Date;
};

export default function CommandDeck({
  runId,
  watermark,
  currentTaskId,
  channelEnabled = commandChannelEnabled(),
  now,
}: CommandDeckProps) {
  const [entries, setEntries] = useState<CommandLogEntry[]>([]);

  /** En rad per command_id. Samma id två gånger uppdaterar raden — den dubbleras aldrig. */
  const remember = useCallback((entry: CommandLogEntry) => {
    setEntries((current) => [entry, ...current.filter((row) => row.command_id !== entry.command_id)]);
  }, []);

  const pause: CommandIntent = {
    command: { verb: "run.pause_at_safe_boundary", payload: { run_id: runId } },
    expected_watermark: watermark,
  };
  const resume: CommandIntent = {
    command: { verb: "run.resume", payload: { run_id: runId } },
    expected_watermark: watermark,
  };
  /**
   * `inspect` bär task-nyckeln när snapshoten HAR en aktuell uppgift, annars körningens.
   * Verbet tar båda formerna — och ett task_id hittas aldrig på för att fylla fältet.
   */
  const inspect: CommandIntent = {
    command:
      currentTaskId === null
        ? { verb: "inspect", payload: { run_id: runId } }
        : { verb: "inspect", payload: { task_id: currentTaskId } },
    expected_watermark: watermark,
  };

  return (
    <section className="mk-panel" data-command-deck="true" aria-label="Kommandon">
      <h2 className="mk-panel-title">
        <span>Kommandon</span>
        <span className="mk-col-count">{channelEnabled ? "kanal öppen" : "kanal stängd"}</span>
      </h2>

      {/*
        Vad intentionerna FAKTISKT bär, ur snapshoten: körningens id och det vattenmärke vyn
        såg. Controllern avvisar kommandot om läget hunnit gå förbi det — därför ska operatören
        kunna se exakt vilket läge knapparna talar om.
      */}
      <p className="mk-hint" data-command-target="true">
        Gäller <span className="mk-mono" data-command-run-id={runId}>{runId}</span> vid
        vattenmärke <span className="mk-mono" data-command-watermark={watermark}>{watermark}</span>.
      </p>

      <CommandButton intent={pause} onEntry={remember} channelEnabled={channelEnabled} />
      <CommandButton intent={resume} onEntry={remember} channelEnabled={channelEnabled} />
      <CommandButton intent={inspect} onEntry={remember} channelEnabled={channelEnabled} />

      <CommandLog entries={entries} now={now} />

      {/*
        SHREDDER-01B §owner-8 · YTANS EGEN PROSA SAMLAS BAKOM EN DÖRR.

        Räckvidden, de två verben utan knapp och kanalens öppningsvillkor är sanna och står kvar
        ORDAGRANT — men de är bakgrund, och de låg som fyra alltid synliga stycken i den bana som
        ska visa PÅGÅENDE ARBETE. Det operatören behöver se utan att öppna något står kvar synligt
        ovanför: vilken körning och vilket vattenmärke intentionerna gäller, att kanalen är stängd
        (rubrikens egen märkning) och varje knapps korta blockeringsrad.
      */}
      <details className="rm-details" data-command-notes="true">
        <summary>Om kommandoytan och den stängda kanalen</summary>

        <p className="mk-hint" data-command-scope="true">
          Ett kommando är en intention. Controllern validerar, claimar och får alltid avvisa —
          ingenting i den här vyn ändras förrän det syns i controllerns snapshot.
        </p>

        <div className="mk-group" data-verbs-without-button="true">
          {VERBS_WITHOUT_BUTTON_HERE.map((entry) => (
            <p className="mk-hint" key={entry.verb} data-verb-without-button={entry.verb}>
              <span className="mk-mono">{entry.verb}</span> {entry.reason}.
            </p>
          ))}
        </div>

        {!channelEnabled && (
          <p className="mk-hint" data-command-channel-blocked-on={COMMAND_QUEUE_BLOCKED_ON}>
            Kommandokanalen öppnas när {COMMAND_QUEUE_BLOCKED_ON} är byggd och verifierad. Ytan är
            byggd, mottagaren finns inte — och Verkstadsgolvet påstår aldrig något annat.
          </p>
        )}
      </details>
    </section>
  );
}
