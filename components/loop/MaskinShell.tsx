/**
 * V2 · Maskinens skal: statusrad + tre kolumner.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — TARGET_UX (desktop-skissen och de
 * responsiva brytpunkterna 1280 / 960 / 720) och COMPONENT_PLAN ("MaskinShell.tsx — tre
 * kolumner + responsiv kollaps; äger ingen datahämtning").
 *
 * BINDANDE REGLER
 * ---------------
 * · Skalet ÄGER INGEN DATAHÄMTNING. Snapshoten skickas in av routen; komponenten läser
 *   varken transport, env eller fixturkatalog.
 * · Snapshoten är DISPLAYED_TRUTH (SNAPSHOT_WINS). Inget fältvärde härleds ur något annat.
 * · En snapshot som inte validerar renderas som ett SYNLIGT läge med orsak — aldrig som en
 *   tyst tom kontrollrumsvy och aldrig som påhittat innehåll.
 * · Inget i den här filen importerar PipelinePanel, ProcessGuide eller MetricsPanel.
 * · Stilarket är namnrymdat (`mk-`) och lever bara här. app/globals.css rörs inte.
 * · Vid ≤959 px lägger sig Maskinen först och kolumnerna staplas i planens ordning. Planens
 *   flikvariant kräver klientinteraktion och hör till en senare skiva — V2 staplar hellre än
 *   att bygga en halv flikmekanik.
 */
import * as React from "react";
import Graceful from "@/components/Graceful";
import type { LoopSnapshot } from "@/lib/loop/schema";
import BacklogColumn from "./BacklogColumn";
import CommandDeck from "./CommandDeck";
import CompletedColumn from "./CompletedColumn";
import CurrentTaskPanel from "./CurrentTaskPanel";
import LiveEventStream from "./LiveEventStream";
import RunStatusBar from "./RunStatusBar";
import { LOOP_CSS } from "./ui";

export default function MaskinShell({
  snapshot,
  fixture = false,
}: {
  snapshot: LoopSnapshot | null;
  fixture?: boolean;
}) {
  return (
    <div className="mk-shell" data-maskin-shell="true" data-fixture={fixture ? "true" : "false"}>
      <style dangerouslySetInnerHTML={{ __html: LOOP_CSS }} />

      {snapshot === null ? (
        <Graceful
          title="Ingen giltig snapshot"
          hint="Kontrollrummet visar hellre ingenting än ett gissat läge."
        >
          Snapshoten kunde inte valideras mot kontraktet i lib/loop/schema.ts. Inget läge visas,
          eftersom Verkstadsgolvet aldrig fyller i controllerns tillstånd åt den.
        </Graceful>
      ) : (
        <>
          <RunStatusBar snapshot={snapshot} fixture={fixture} />
          {/*
            V7 · kommandoytan. Den läser BARA snapshotens egna värden (run_id, aktuell uppgift
            och det vattenmärke vyn såg) och ändrar aldrig något i vyerna nedan: task state
            kommer ur controllerns snapshot, aldrig ur ett klick.
          */}
          <CommandDeck
            runId={snapshot.run_id}
            watermark={snapshot.seq_watermark}
            currentTaskId={snapshot.current_task?.task_id ?? null}
          />
          <div className="mk-cols">
            <BacklogColumn tasks={snapshot.backlog} />
            <CurrentTaskPanel task={snapshot.current_task} />
            <CompletedColumn tasks={snapshot.completed} />
          </div>
          {/*
            V9 · strömpanelen. Den ansluter mot läsplanet SJÄLV (skalet äger fortfarande ingen
            datahämtning) och bär sitt eget transportläge: öppen ström, återanslutning eller
            poll — märkt som det det är. Vattenmärket kommer ur snapshoten så att rader som
            controllern redan bekräftat kan skiljas från tail.
          */}
          {fixture && (
            <p className="mk-hint" data-stream-source-boundary="true">
              Kolumnerna ovan kommer ur den genererade fixturen. Strömpanelen nedan talar med
              kontrollplanets läsyta på riktigt och märker själv ut sitt transportläge — de två
              källorna blandas aldrig.
            </p>
          )}
          <LiveEventStream watermark={snapshot.seq_watermark} />
        </>
      )}
    </div>
  );
}
