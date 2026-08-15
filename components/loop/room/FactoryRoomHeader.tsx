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
 * plats: uppmärksamhetsposterna är rader och inte kort, och notisen om transportläget står VID
 * strömmen i stället för här. Ingen ärlighetstext är borttagen — de har flyttat dit de hör hemma
 * eller kortats till samma påstående.
 *
 * SHREDDER-01B · DE TRE TEKNISKA NOTISERNA DELAR EN UPPLYSNINGSYTA (§owner-8). Ingressen om
 * källan, bildtexten om bekräftelsens ålder och notisen om det saknade ägarbehörighetsfältet
 * står ordagrant kvar bakom EN växel längst ned i huvudet. Skälet är mätt: de tre styckena sköt
 * rummets ingång under vikningen vid 390 px. Det som är MÄRKNING och inte prosa — statusradens
 * DATAKÄLLA, showroom-märket och liveness-märket — står kvar synligt och orört ovanför.
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
import WorkDomainIndicator from "./WorkDomainIndicator";
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
  ROOM_TITLE,
  mainConfirmation,
  roomIntro,
} from "@/lib/loop/room/header";
import { factoryRoomMode, type FactoryRoomMode } from "@/lib/loop/room/mode";
import { workDomainNote, type WorkDomain } from "@/lib/loop/room/lane";

export type FactoryRoomHeaderProps = {
  snapshot: LoopSnapshot;
  fixture: boolean;
  /**
   * SHREDDER-01A · rummets produktläge (lib/loop/room/mode.ts). Huvudet MÄRKER läget; själva
   * märket renderas av statusraden nedanför, som redan äger fixturmärkningen. Två ägare av
   * samma etikett glider isär, så huvudet lägger bara till den maskinläsbara märkningen.
   */
  mode?: FactoryRoomMode;
  /**
   * LANE-01 · rummets ARBETSDOMÄN (lib/loop/room/lane.ts), om någon uttryckligen bärs hit.
   *
   * FÖRVALET ÄR `null`, OCH DET ÄR ETT PÅSTÅENDE OM VERKLIGHETEN: kontraktet i
   * lib/loop/schema.ts bär inget arbetsdomänfält, så det finns idag ingen källa som kan fylla
   * fältet för en riktig körning. Huvudet renderar då em-streck och skriver ut orsaken — det
   * härleder ALDRIG en domän ur ett kodförråd, en titel eller ett uppgifts-id. Den dag
   * controllern publicerar värdet (LANE-08) skickas det in här, på samma väg som läget.
   */
  workDomain?: WorkDomain | null;
  /** Klockan skickas in så att åldern är mätbar. Ingen komponent läser tiden i smyg. */
  now?: Date;
};

export default function FactoryRoomHeader({
  snapshot,
  fixture,
  mode = factoryRoomMode(),
  workDomain = null,
  now,
}: FactoryRoomHeaderProps) {
  const clock = now ?? new Date();
  const confirmation = mainConfirmation(snapshot, clock);
  const attention = deriveAttention(snapshot);
  const ageMissing = confirmation.age_text === null;

  return (
    <header className="rm-head" data-factory-room-header="true" data-room-mode={mode}>
      {/*
        Rubrik och källa på SAMMA rad. Rummet öppnar redan under sidans egen h1, som sedan
        SHREDDER-01C bär produktens namn (Kartongförstöraren, components/loop/MaskinHeader.tsx);
        en andra titel med ett eget stycke under sig blir en andra ingress, och varje rad här är
        höjd som trycker ned arbetsytorna.

        KÄLLAN FÖLJER LÄGET: ingressen får aldrig påstå controllerpublicerad härkomst för data
        som statusraden två rader ned märker som fixtur — samma disciplin som sidhuvudets egen
        sanningsrad. `fixture` är redan skalets flagga; den härleds inte om här.
      */}
      <div className="rm-head-top">
        <h2 className="rm-head-title">{ROOM_TITLE}</h2>
        {/*
          LANE-01 · ARBETSDOMÄNEN STÅR HÖGST UPP, DÄR FRÅGAN STÄLLS.

          Nortropic har två fabriksspår (KUNDPRODUKTION / SYSTEMFÖRBÄTTRINGAR), och den som
          öppnar rummet ska kunna se vilket spår arbetet tillhör utan att öppna en bevisyta.
          Raden ligger därför bredvid rubriken — samma radbrytande rad, ingen ny höjd på en
          telefon när den ryms, och den bär ingen egen rubriknivå.

          IDAG STÅR DEN PÅ EM-STRECK, OCH DET ÄR SANNINGEN OCH INTE EN LUCKA: propet är null om
          ingen skickar in ett uttryckligt värde, och kontraktet har inget fält att skicka.
          Orsaken står utskriven i upplysningsytan nedan, så em-strecket aldrig läses som ett
          fel i vyn.
        */}
        <WorkDomainIndicator domain={workDomain} />
      </div>

      {/* Maskinens egen statusrad — samma värden, samma märkning, en enda ägare. */}
      <RunStatusBar snapshot={snapshot} fixture={fixture} />

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

      </section>

      {/*
        SHREDDER-01B §owner-8 · HUVUDETS TRE TEKNISKA NOTISER, I EN ENDA UPPLYSNINGSYTA.

        Ingressen om källan, bildtexten om bekräftelsens ålder och notisen om att kontraktet
        saknar ägarbehörighetsfält är alla SANNA och står kvar ORDAGRANT — men de är tre stycken
        som låg mellan operatören och rummets ingång. Vid 390 px sköt de «Mata maskinen» under
        vikningen, och den första telefonskärmen av /loop kom då att handla om brasklappar i
        stället för om IN → ARBETE → UT.

        VARFÖR EN dörr och inte tre: rummets upplysningsyta är 38 px hög (kontrollhöjden, så den
        går att träffa med en tumme). Att vika in ett tvåradigt stycke bakom en egen sådan växel
        är ungefär höjdneutralt — tre stycken bakom EN växel är det inte. Notiserna delar därför
        en dörr, i den ordning de hade i vyn.

        VAD SOM INTE FLYTTADE, EFTERSOM DET INTE ÄR EN BRASKLAPP: statusraden ovanför äger
        DATAKÄLLA-märket, showroom-märket och liveness-märket, och den är oförändrad. Källan är
        alltså fortfarande SYNLIG utan att något öppnas — det som vek undan är prosan som
        upprepade den, aldrig märkningen själv.

        Märkningen på varje stycke (data-room-intro-source, data-main-confirmation,
        data-age-is-liveness, data-owner-authority-note) är oförändrad, så varje mätare som
        läser dem läser exakt samma element som förut.
      */}
      <details className="rm-details" data-head-notes="true">
        <summary>
          <span className="rm-flag">{mode}</span> Om källan, åldern, behörigheten och arbetsdomänen
        </summary>

        <p className="rm-head-intro" data-room-intro-source={fixture ? "fixture" : "snapshot"}>
          — {roomIntro(fixture)}.
        </p>

        {/*
          Bildtext till statusraden, inte ett eget fält: raden äger sha och tidsstämpel, och
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

        <p className="rm-head-note" data-owner-authority-note="true">
          {OWNER_AUTHORITY_NOTE}
        </p>

        {/*
          LANE-01 · VARFÖR ARBETSDOMÄNEN STÅR SOM DEN GÖR.

          Bärs ett uttryckligt värde säger raden vad domänen OMFATTAR; saknas det säger den varför
          fältet är tomt. Båda är samma slags mening — en upplysning om ett värde ovanför, aldrig
          en gissning om vilket spår arbetet tillhör.
        */}
        <p className="rm-head-note" data-work-domain-note="true">
          {workDomainNote(workDomain)}
        </p>
      </details>
    </header>
  );
}
