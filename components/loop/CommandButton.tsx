"use client";

/**
 * V7 · En knapp = EN typad intention. Ingenting mer.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — COMMAND_CLIENT ("De fem verben",
 * "Idempotens och replay", "run.pause_at_safe_boundary", "Kommandostatus i UI:t") och
 * COMPONENT_PLAN (CommandButton).
 *
 * BINDANDE REGLER SOM KOMPONENTEN BÄR
 * -----------------------------------
 * · INGEN OPTIMISTISK STATE. Knappen ändrar aldrig en uppgifts tillstånd, aldrig en kolumn och
 *   aldrig en fas. Den visar kommandots eget öde: köad, avvisad eller okänd. Task state kommer
 *   ur controllerns snapshot, alltid.
 * · ETT command_id PER INTENTION. Regeln bor i createIntentDispatcher (lib/loop/commands.ts) så
 *   att den kan MÄTAS utan en webbläsare: ett klick medan ett anrop pågår blir inget andra
 *   anrop, ett avslag behåller id:t (en retry är samma kommando) och först ett KÖAT kommando
 *   släpper id:t. Knappen är dessutom avstängd medan anropet pågår.
 * · KNAPPEN PÅSTÅR ALDRIG ATT NÅGOT STARTAT. Den säger "skickar…" medan anropet pågår och
 *   därefter exakt vad servern svarade — ordagrant vid avslag.
 * · Är kommandokanalen stängd är knappen AVSTÄNGD med ordagrann orsak, och det finns då ingen
 *   väg alls till ett anrop. Ingen fejkad kö, ingen låtsad inlämning.
 * · Komponenten känner ingen shell, ingen Git, ingen lease, ingen brytare, ingen dom, ingen
 *   attestation och ingen promotion. Den bär en payload som DATA.
 */
import * as React from "react";
import { useCallback, useId, useRef, useState } from "react";
import {
  COMMAND_QUEUE_BLOCKED_ON,
  COMMAND_QUEUE_DISABLED_REASON,
  COMMAND_VERB_EXPLANATIONS,
  COMMAND_VERB_LABELS,
  commandChannelEnabled,
  createIntentDispatcher,
  type CommandIntent,
  type CommandLogEntry,
  type CommandSender,
  type IntentDispatcher,
} from "@/lib/loop/commands";

/**
 * Standardvägen är webbläsarens egen fetch. Den är injicerbar av EXAKT ett skäl: provet ska
 * kunna mäta att två klick ger ETT kommando utan att öppna en socket.
 */
const defaultSender: CommandSender = async (input, init) => {
  const response = await fetch(input, init);
  try {
    return (await response.json()) as unknown;
  } catch {
    // Icke-JSON betyder i praktiken utgången session (redirect till /login). Kuvertläsaren
    // gör det till en ärlig rad — aldrig till ett antagande om att kommandot gick fram.
    return null;
  }
};

/** UUIDv4 ur plattformens kryptokälla. Ingen egen slumpgenerator, ingen tidsbaserad nyckel. */
function newCommandId(): string {
  return crypto.randomUUID();
}

export type CommandButtonProps = {
  intent: CommandIntent;
  /** Avstängd av ett annat skäl än kanalen (t.ex. ingen körning att pausa). Orsaken visas. */
  disabledReason?: string | null;
  onEntry?: (entry: CommandLogEntry) => void;
  send?: CommandSender;
  /** Bara prov och fixturvyer sätter denna. Produktionsvärdet kommer ur lib/loop/commands.ts. */
  channelEnabled?: boolean;
};

export default function CommandButton({
  intent,
  disabledReason = null,
  onEntry,
  send = defaultSender,
  channelEnabled = commandChannelEnabled(),
}: CommandButtonProps) {
  const [sending, setSending] = useState(false);
  const [entry, setEntry] = useState<CommandLogEntry | null>(null);
  const dispatcher = useRef<IntentDispatcher | null>(null);
  const reasonId = useId();

  const verb = intent.command.verb;
  const label = COMMAND_VERB_LABELS[verb];
  const explanation = COMMAND_VERB_EXPLANATIONS[verb] ?? null;

  /**
   * Hela dubbelklickskyddet på klientsidan ligger i createIntentDispatcher (lib/loop/commands.ts)
   * — ren logik, utan DOM, och därmed mätbar av provet. Komponenten äger bara det som SYNS.
   */
  const dispatch = useCallback(async () => {
    if (dispatcher.current === null) {
      dispatcher.current = createIntentDispatcher({ send, newCommandId });
    }
    // Ett klick medan ett anrop pågår blir inget andra kommando — och rör ingen vy.
    if (dispatcher.current.inFlight()) return;
    setSending(true);
    try {
      const next = await dispatcher.current.dispatch(intent);
      if (next === null) return;
      setEntry(next);
      onEntry?.(next);
    } finally {
      setSending(false);
    }
  }, [intent, onEntry, send]);

  const blockedReason = !channelEnabled ? COMMAND_QUEUE_DISABLED_REASON : disabledReason;
  const disabled = blockedReason !== null || sending;

  return (
    <div className="mk-command" data-command-button={verb}>
      <div className="mk-actions">
        <button
          type="button"
          className="mk-button"
          disabled={disabled}
          aria-disabled={disabled ? "true" : undefined}
          aria-describedby={blockedReason === null ? undefined : reasonId}
          data-command-disabled={disabled ? "true" : "false"}
          data-command-sending={sending ? "true" : "false"}
          onClick={() => {
            void dispatch();
          }}
        >
          {sending ? "Skickar…" : label}
        </button>
        {!channelEnabled && (
          <span className="mk-hint" data-blocked-on={COMMAND_QUEUE_BLOCKED_ON}>
            Blockerad på {COMMAND_QUEUE_BLOCKED_ON}.
          </span>
        )}
      </div>

      {/*
        SHREDDER-01B §owner-8 · PRESENTATIONEN KOMPAKTERAS — SEMANTIKEN RÖRS INTE.

        Förklaringen och den ordagranna orsaken låg som två alltid synliga stycken PER KNAPP,
        alltså sex prosablock i fokusbanan innan operatören nådde något. De står kvar ORDAGRANT,
        med samma klasser, samma märkning och samma `id`, men bakom rummets egen upplysningsdörr.

        TRE SAKER ÄR MED FLIT OFÖRÄNDRADE, eftersom de är kommandots semantik och inte dess form:
          · knappens `aria-describedby` pekar fortfarande på `reasonId`, och elementet renderas
            fortfarande — en direkt referens till en dold nod tas med i beskrivningen, så
            hjälpmedlet får orsaken oavsett om ytan är öppen;
          · `data-blocked-on`-raden står kvar SYNLIG vid knappen: den är den korta lägesmarkören,
            och en avstängd knapp får aldrig sakna sitt skäl i vyn;
          · orsakssträngen skrivs aldrig om och kortas aldrig.
      */}
      {(explanation !== null || blockedReason !== null) && (
        <details className="rm-details" data-command-detail={verb}>
          <summary>Vad knappen gör och varför den är låst</summary>

          {explanation !== null && (
            <p className="mk-hint" data-command-explanation={verb}>
              {explanation}
            </p>
          )}

          {blockedReason !== null && (
            <p className="mk-note mk-tone-warning" id={reasonId} data-command-reason="true">
              {blockedReason}
            </p>
          )}
        </details>
      )}

      {entry !== null && <CommandResult entry={entry} />}
    </div>
  );
}

/**
 * Svaret på det senaste försöket, vid knappen. Avslaget står ORDAGRANT — Verkstadsgolvet
 * skriver aldrig om controllerns eller routens orsak, och lägger aldrig till en egen tolkning.
 */
export function CommandResult({ entry }: { entry: CommandLogEntry }) {
  const refused = entry.reason !== null;
  return (
    <p
      className={refused ? "mk-note mk-tone-danger" : "mk-note"}
      data-command-result={refused ? "refused" : "accepted"}
      data-command-id={entry.command_id}
      role="status"
      aria-live="polite"
    >
      {refused
        ? entry.message
        : "Kommandot är köat. Ingenting har hänt förrän controllern har agerat och det syns i en snapshot."}
    </p>
  );
}
