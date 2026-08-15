/**
 * ROOM-01 · Banans stegetikett.
 *
 * ORDNINGSTALET ÄR ETT PÅSTÅENDE — OCH DET GÄLLER BARA DÄR DET STÄMMER
 * -------------------------------------------------------------------
 * Vid ≥960 px står banorna sida vid sida i berättelsens ordning: in, arbetet, ut. Då är "1 · IN"
 * sant och hjälper läsaren att se axeln.
 *
 * SHREDDER-01C · TALET ÄR NUMERA SANT I VARJE VY. Regeln som en gång lyfte fokusbanan över
 * ingången mellan 720 och 959 px är upphävd: ingången leder i alla tre bredderna, alltså
 * stämmer 1, 2, 3 överallt. Talet är dessutom `aria-hidden`: DOM-ordningen är oförändrad
 * in → arbetet → ut, så en skärmläsare får sekvensen ur strukturen och behöver ingen uppläst
 * siffra som kan hamna i konflikt med den visuella ordningen.
 *
 * VARFÖR TALET ÄNDÅ UTELÄMNAS I ETT INTERVALL
 * -------------------------------------------
 * Mellan 720 och 959 px döljer ROOM_CSS fortfarande `.rm-step-n`. Regeln finns kvar därför att
 * den är FRUSEN av ROOM-LAYOUT i tests/loop/room-shell.test.ts, vars mätning ligger utanför den
 * här skivans skrivrätt — inte längre därför att ordningen skulle vara en annan där. Att
 * utelämna ett SANT tal är en utelämning, aldrig en osanning: bannamnet (in, arbetet, ut) står
 * kvar i varje vy, och ingenting ur snapshoten döljs. Vid ≤719 px visas talet igen.
 *
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
