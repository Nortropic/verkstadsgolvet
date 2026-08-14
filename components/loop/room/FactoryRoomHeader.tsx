/**
 * ROOM-01 · Fabriksrummets huvud: läget, controllerns bekräftade main och härledd uppmärksamhet.
 *
 * VARFÖR STATUSRADEN LIGGER HÄR INNE
 * ----------------------------------
 * Rummets huvud SKA visa controllerns bekräftade main-SHA, körningens id, fixturmärkningen och
 * liveness-märket. Allt det renderas redan av `RunStatusBar` — provat, med rätt em-streck och
 * med den ihåliga punkten för "okänt". Huvudet MONTERAR därför raden i stället för att rita en
 * andra uppsättning av samma sanning: två ägare av ett värde glider isär, och den som gissar
 * hinner alltid bli den som ljuger. Huvudet lägger bara till det raden inte har — ÅLDERN på
 * controllerns bekräftelse — och märker den som ren visning.
 *
 * BINDANDE REGLER
 * ---------------
 * · Ingen egen anslutning: ONE_TAIL_CONNECTION_PER_FACTORY_ROOM. Transportläget ägs av
 *   strömpanelen längst ned; huvudet hänvisar till det och gissar aldrig.
 * · Ingen liveness-signal finns i den här skivan. Åldern är en tidsstämpels ålder, inte ett
 *   påstående om aktivitet — och ingenting i huvudet rör sig.
 * · "ÄGARÅTGÄRD KRÄVS" renderas inte: kontraktet har inget fält som säger att ägarens behörighet
 *   krävs, och rummet härleder aldrig ett sådant krav.
 */
import * as React from "react";
import RunStatusBar from "../RunStatusBar";
import RoomField from "./RoomField";
import { toneClass } from "../ui";
import type { LoopSnapshot } from "@/lib/loop/schema";
import {
  ATTENTION_EMPTY_TEXT,
  ATTENTION_HEADING,
  OWNER_AUTHORITY_NOTE,
  OWNER_AUTHORITY_SOURCE,
  TRANSPORT_NOTICE_OWNER,
  deriveAttention,
} from "@/lib/loop/room/attention";
import {
  AGE_NOTE,
  ROOM_INTRO,
  ROOM_TITLE,
  ROOM_TRANSPORT_NOTE,
  mainConfirmation,
} from "@/lib/loop/room/header";

export type FactoryRoomHeaderProps = {
  snapshot: LoopSnapshot;
  fixture: boolean;
  /** Klockan skickas in så att åldern är mätbar. Ingen komponent läser tiden i smyg. */
  now?: Date;
};

export default function FactoryRoomHeader({ snapshot, fixture, now }: FactoryRoomHeaderProps) {
  const clock = now ?? new Date();
  const confirmation = mainConfirmation(snapshot, clock);
  const attention = deriveAttention(snapshot);

  return (
    <header className="rm-head" data-factory-room-header="true">
      <h2 className="rm-head-title">{ROOM_TITLE}</h2>
      <p className="rm-head-intro">{ROOM_INTRO}</p>

      {/* Maskinens egen statusrad — samma värden, samma märkning, en enda ägare. */}
      <RunStatusBar snapshot={snapshot} fixture={fixture} />

      <div className="rm-confirm" data-main-confirmation="true">
        <RoomField
          className="rm-confirm-item"
          fieldId="main_confirmed_age"
          label="main bekräftad · ålder (visning)"
          value={confirmation.age_text}
          title={confirmation.confirmed_ts ?? undefined}
        />
      </div>
      <p className="rm-head-note" data-age-is-liveness="false">
        {AGE_NOTE}
      </p>

      <section
        className="rm-attention"
        data-room-attention="true"
        data-owner-authority-source={OWNER_AUTHORITY_SOURCE}
        aria-label={ATTENTION_HEADING}
      >
        <h3 className="rm-attention-heading">{ATTENTION_HEADING}</h3>

        {attention.length === 0 ? (
          <p className="rm-attention-text" data-attention-empty="true">
            {ATTENTION_EMPTY_TEXT}
          </p>
        ) : (
          <ul className="rm-attention-list">
            {attention.map((item) => (
              <li
                className={`rm-attention-item ${toneClass(item.tone)}`}
                key={item.id}
                data-attention-item={item.id}
                data-tone={item.tone}
              >
                <div className="rm-attention-head">
                  <span className={`mk-badge ${toneClass(item.tone)}`} data-attention-state={item.id}>
                    {item.label} · {item.id}
                  </span>
                  <span className="rm-attention-ids" data-attention-task-ids={item.task_ids.join(" ")}>
                    {item.task_ids.join(" · ")}
                  </span>
                </div>
                <p className="rm-attention-text">{item.detail}</p>
              </li>
            ))}
          </ul>
        )}

        <p className="rm-head-note" data-owner-authority-note="true">
          {OWNER_AUTHORITY_NOTE}
        </p>
        <p className="rm-head-note" data-room-transport-state="unknown">
          {ROOM_TRANSPORT_NOTE} {TRANSPORT_NOTICE_OWNER}
        </p>
      </section>
    </header>
  );
}
