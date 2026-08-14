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
 * controllerns bekräftelse — och gör det som en BILDTEXT till raden, inte som ett eget fält med
 * egen rubrik. En egen rubrik hade läst som en tredje redovisning av samma bekräftelse.
 *
 * VARFÖR HUVUDET ÄR KORT
 * ----------------------
 * Höjden här är höjd som trycker ned rummets arbetsytor. Varje rad måste därför förtjäna sin
 * plats: ingressen är en rad, åldern är en bildtext, uppmärksamhetsposterna är rader och inte
 * kort, och notisen om transportläget står VID strömmen i stället för här. Ingen ärlighetstext
 * är borttagen — de har flyttat dit de hör hemma eller kortats till samma påstående.
 *
 * BINDANDE REGLER
 * ---------------
 * · Ingen egen anslutning: ONE_TAIL_CONNECTION_PER_FACTORY_ROOM. Transportläget ägs av
 *   strömpanelen; huvudet gissar aldrig.
 * · Ingen liveness-signal finns i den här skivan. Åldern är en tidsstämpels ålder, inte ett
 *   påstående om aktivitet — och ingenting i huvudet rör sig.
 * · "ÄGARÅTGÄRD KRÄVS" renderas inte: kontraktet har inget fält som säger att ägarens behörighet
 *   krävs, och rummet härleder aldrig ett sådant krav.
 */
import * as React from "react";
import RunStatusBar from "../RunStatusBar";
import { toneClass } from "../ui";
import { MISSING } from "@/lib/loop/labels";
import type { LoopSnapshot } from "@/lib/loop/schema";
import {
  ATTENTION_EMPTY_TEXT,
  ATTENTION_HEADING,
  OWNER_AUTHORITY_NOTE,
  OWNER_AUTHORITY_SOURCE,
  deriveAttention,
} from "@/lib/loop/room/attention";
import {
  AGE_CAPTION_LEAD,
  AGE_NOTE,
  ROOM_INTRO,
  ROOM_TITLE,
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
  const ageMissing = confirmation.age_text === null;

  return (
    <header className="rm-head" data-factory-room-header="true">
      <h2 className="rm-head-title">{ROOM_TITLE}</h2>
      <p className="rm-head-intro">{ROOM_INTRO}</p>

      {/* Maskinens egen statusrad — samma värden, samma märkning, en enda ägare. */}
      <RunStatusBar snapshot={snapshot} fixture={fixture} />

      {/*
        Bildtext till raden ovan, inte ett eget fält: statusraden äger sha och tidsstämpel, och
        åldern är det enda den inte redan visar. Tidsstämpeln bärs i `title` så att den går att
        läsa av utan att skrivas ut en andra gång.
      */}
      <p className="rm-head-note" data-main-confirmation="true" data-age-is-liveness="false">
        {AGE_CAPTION_LEAD}{" "}
        <span
          className={ageMissing ? "mk-missing" : undefined}
          data-missing={ageMissing ? "true" : "false"}
          title={confirmation.confirmed_ts ?? undefined}
        >
          {confirmation.age_text ?? MISSING}
        </span>{" "}
        · {AGE_NOTE}.
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
                <span className={`mk-badge ${toneClass(item.tone)}`} data-attention-state={item.id}>
                  {item.label} · {item.id}
                </span>
                <span className="rm-attention-ids" data-attention-task-ids={item.task_ids.join(" ")}>
                  {item.task_ids.join(" · ")}
                </span>
                <span className="rm-attention-text">{item.detail}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="rm-head-note" data-owner-authority-note="true">
          {OWNER_AUTHORITY_NOTE}
        </p>
      </section>
    </header>
  );
}
