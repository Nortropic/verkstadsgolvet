/**
 * SMS-mallen (ren funktion, klient-säker). GENERERAR text — systemet skickar ALDRIG.
 * Johnny kopierar och skickar manuellt från telefonen (invariant). Speglar mallen i
 * content/leads/LEADS-TEST-SMS-DEMO.md. Anpassa alltid en aning innan du skickar.
 */
import type { Lead } from "./leads-types";

export function buildSms(lead: Pick<Lead, "namn" | "ort" | "demo_url">): string {
  const namn = lead.namn?.trim() || "ert företag";
  const ortDel = lead.ort ? ` i ${lead.ort}` : "";
  const demo = lead.demo_url?.trim() || "[LÄGG IN DEMO-LÄNKEN]";
  return (
    `Hej! Jag heter Johnny och driver Nortropic. Jag såg att ${namn} har fina recensioner${ortDel} ` +
    `men ingen egen hemsida — så jag byggde ett snabbt förslag på hur en skulle kunna se ut, med era egna bilder: ${demo}\n\n` +
    `Ingen kostnad, ingen förpliktelse — bara nyfiken på vad du tycker. Hör av dig om det är intressant så visar jag mer. Mvh Johnny, Nortropic`
  );
}
