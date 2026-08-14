/**
 * ROOM-01 · Maskinens skal ÄR numera Fabriksrummet.
 *
 * KÄLLA: docs/nortropic-factory-room-master-roadmap-v1.md §5 (ROOM-01) ovanpå
 * docs/nortropic-control-room-plan-v1.md — TARGET_UX (desktop-skissen och de responsiva
 * brytpunkterna 1280 / 960 / 720) och COMPONENT_PLAN ("MaskinShell.tsx — tre kolumner +
 * responsiv kollaps; äger ingen datahämtning").
 *
 * RUMMETS AXEL
 * ------------
 *   huvud → (mata in | arbetet | ut) → identitet → kommandon → tidslinje → live-ström
 *
 * Kolumnerna finns kvar — de är rummets tre banor, inte tre likvärdiga instrumentpaneler:
 * vänsterbanan är ingången (mata maskinen + backlog), mittbanan är rummets blick (aktuell
 * uppgift), högerbanan är utmatningen. Ordningen är en berättelse, inte ett rutnät.
 *
 * BINDANDE REGLER
 * ---------------
 * · Skalet ÄGER INGEN DATAHÄMTNING. Snapshoten skickas in av routen; komponenten läser
 *   varken transport, env eller kataloger.
 * · Snapshoten är DISPLAYED_TRUTH (SNAPSHOT_WINS). Inget fältvärde härleds ur något annat.
 * · En snapshot som inte validerar renderas som ett SYNLIGT läge med orsak — aldrig som en
 *   tyst tom kontrollrumsvy och aldrig som påhittat innehåll.
 * · Inget i den här filen importerar PipelinePanel, ProcessGuide eller MetricsPanel.
 * · Stilarken är namnrymdade och lever bara här: LOOP_CSS (`mk-`) OCH rummets ROOM_CSS (`rm-`)
 *   som ett andra stiltagg-block. LOOP_CSS ändras inte av den här skivan. app/globals.css rörs
 *   inte alls.
 * · EN ENDA TAIL-ANSLUTNING PER RUM: bara `LiveEventStream` ansluter. Rummet öppnar ingen andra
 *   SSE- eller poll-klient, och huvudet gissar därför aldrig ett transportläge.
 * · Vid ≤959 px lägger sig rummets blick först och banorna staplas i planens ordning.
 */
import * as React from "react";
import Graceful from "@/components/Graceful";
import type { LoopSnapshot } from "@/lib/loop/schema";
import BacklogColumn from "./BacklogColumn";
import CommandDeck from "./CommandDeck";
import LiveEventStream from "./LiveEventStream";
import FactoryRoomHeader from "./room/FactoryRoomHeader";
import OutputTray from "./room/OutputTray";
import RoomStep from "./room/RoomStep";
import RoomTimeline from "./room/RoomTimeline";
import TaskFocusRail from "./room/TaskFocusRail";
import WorkComposer from "./room/WorkComposer";
import { ROOM_CSS } from "./room/ui";
import { LOOP_CSS } from "./ui";
import { ROOM_TRANSPORT_NOTE } from "@/lib/loop/room/header";

export default function MaskinShell({
  snapshot,
  fixture = false,
}: {
  snapshot: LoopSnapshot | null;
  fixture?: boolean;
}) {
  return (
    <div
      className="mk-shell rm-room"
      data-maskin-shell="true"
      data-factory-room="true"
      data-fixture={fixture ? "true" : "false"}
    >
      <style dangerouslySetInnerHTML={{ __html: LOOP_CSS }} />
      <style dangerouslySetInnerHTML={{ __html: ROOM_CSS }} />

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
          {/*
            Rummets huvud monterar statusraden (liveness, kör-id, controllerns bekräftade main och
            fixturmärkningen) och lägger till den härledda uppmärksamheten. Statusraden har kvar
            ensamt ägarskap över sina värden — huvudet ritar dem aldrig en andra gång.
          */}
          <FactoryRoomHeader snapshot={snapshot} fixture={fixture} />

          {/*
            SCENEN ÄR TVÅ BANOR, INTE TRE.

            Ingången (mata + kö) och arbetet står sida vid sida; UTMATNINGEN är en HYLLA under
            dem, i rummets fulla bredd. Skälet är mätt, inte smaksatt: kön är lång och
            utmatningen kort, så en tredje smal bana lämnade drygt en skärmhöjd tomt rutnät till
            höger — precis den "vägg av kort" som en rumsvy inte får bli. Ordningen är fortfarande
            planens: in → arbete → ut, nu som läsordning i stället för tre lika tunga spalter.
          */}
          <div className="rm-stage" data-room-stage="true">
            <div className="rm-lane rm-lane-in" data-room-lane="in">
              <RoomStep ordinal="1" name="in" />
              <WorkComposer />
              <BacklogColumn tasks={snapshot.backlog} />
            </div>

            {/*
              Fokusbanan bär det som handlar om det pågående arbetet: uppgiften, identiteten och
              V7:s kommandoyta. Kommandoytan monteras HÄR av skalet (den läser bara snapshotens
              egna värden — run_id, aktuell uppgift och det vattenmärke vyn såg) och skickas in
              som barn, så att banan äger placeringen utan att äga ytan.
            */}
            <TaskFocusRail task={snapshot.current_task}>
              <CommandDeck
                runId={snapshot.run_id}
                watermark={snapshot.seq_watermark}
                currentTaskId={snapshot.current_task?.task_id ?? null}
              />
            </TaskFocusRail>
          </div>

          {/* Hyllan: klart och ej promoverat, i full bredd under scenen. */}
          <OutputTray tasks={snapshot.completed} />

          {/*
            Tidslinjen är SEGMENTERAD presentation: operatörens poster och fabrikens kvitton ur
            fixturen, aldrig sammanvävda med live-strömmen till en enda påstådd kronologi.
          */}
          <RoomTimeline fixture={fixture} />

          {/*
            V9 · strömpanelen. Den ansluter mot läsplanet SJÄLV (skalet äger fortfarande ingen
            datahämtning) och bär sitt eget transportläge: öppen ström, återanslutning eller
            poll — märkt som det det är. Vattenmärket kommer ur snapshoten så att rader som
            controllern redan bekräftat kan skiljas från tail. Detta är rummets ENDA anslutning.
          */}
          {fixture && (
            <p className="mk-hint" data-stream-source-boundary="true">
              Ytorna ovan kommer ur den genererade fixturen. Strömpanelen nedan talar med
              kontrollplanets läsyta på riktigt och märker själv ut sitt transportläge — de två
              källorna blandas aldrig.
            </p>
          )}
          {/*
            EN mening, vid anslutningen den handlar om. Den säger bara det som är rummets eget
            att säga — att rummet inte öppnar någon andra anslutning. Vem som äger transportläget
            står redan i sidhuvudet och i panelen själv; en tredje formulering hade varit
            dubblerad statusinformation.
          */}
          <p className="rm-head-note" data-room-transport-state="unknown">
            {ROOM_TRANSPORT_NOTE}
          </p>
          <LiveEventStream watermark={snapshot.seq_watermark} />
        </>
      )}
    </div>
  );
}
