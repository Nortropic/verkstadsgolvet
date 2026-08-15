/**
 * ROOM-01 · Banans stegetikett.
 *
 * ORDNINGSTALET ÄR ETT PÅSTÅENDE — OCH DET GÄLLER BARA DÄR DET STÄMMER
 * -------------------------------------------------------------------
 * Vid ≥960 px står banorna sida vid sida i berättelsens ordning: in, arbetet, ut. Då är "1 · IN"
 * sant och hjälper läsaren att se axeln. Mellan 720 och 959 px lägger sig ARBETET FÖRST (samma
 * disciplin som Maskinens egen mk-col-current har haft sedan V2 — det pågående arbetet är det
 * man kom hit för), och då skulle ett synligt "2" bredvid den första ytan påstå en ordning som
 * ögat inte ser.
 *
 * Ordningstalet bärs därför i ett eget element som döljs i EXAKT de vyer där påståendet inte
 * stämmer (regeln står i ROOM_CSS). Kvar står namnet, som är sant i alla vyer. Talet är dessutom
 * `aria-hidden`: DOM-ordningen är oförändrad in → arbetet → ut, så en skärmläsare får sekvensen
 * ur strukturen och behöver ingen uppläst siffra som kan hamna i konflikt med den visuella
 * ordningen.
 *
 * ROOM-08 · TALET KOMMER TILLBAKA NÄR PÅSTÅENDET GÖR DET
 * ------------------------------------------------------
 * Vid ≤719 px finns ingen scen kvar att ordna om: allt ligger i en spalt i DOM-ordningen
 * in → arbetet → ut, och då är "1 · IN" sant igen. Talet visas därför på nytt i det blocket.
 * Detta är den enda anledningen till att något över huvud taget döljs i en media-fråga i
 * rummet — ett påstående om layouten får inte överleva den layout det beskriver. Ingen
 * bevisyta, inget fält och ingen upplysning döljs någonsin på det sättet.
 */
import * as React from "react";

export default function RoomStep({ ordinal, name }: { ordinal: string; name: string }) {
  return (
    <span className="rm-step" data-room-step={name}>
      <span className="rm-step-n" aria-hidden="true">
        {ordinal} ·{" "}
      </span>
      {name}
    </span>
  );
}
