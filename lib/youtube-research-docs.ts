/**
 * YouTube research — flödet för att destillera byggvideor mot Nortropic-systemet.
 * Läses VERBATIM ur content/youtube-research/*.md så innehållet bevaras exakt.
 * Server-only (fs) — importeras av server-sidan /youtube-research, aldrig av klientkod.
 *
 * Läs-only referens: sidan VISAR manualen och prompten (kopierbara), den KÖR inget.
 * Själva flödet är ett Claude Code-flöde vid skrivbordet — dashboarden speglar bara
 * systemet, den ska inte bli ett kontrollrum (se manualens not "Var det INTE hör hemma").
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type YoutubeResearchDoc = {
  id: string;
  title: string;
  description: string;
  audience: "dig" | "kund";
  content: string;
};

function load(file: string): string {
  return readFileSync(join(process.cwd(), "content/youtube-research", file), "utf-8");
}

export const YOUTUBE_RESEARCH_DOCS: YoutubeResearchDoc[] = [
  {
    id: "manual-video-destillering",
    title: "Manual — YouTube-video → destillerad kunskap",
    description:
      "Steg-för-steg vid skrivbordet: engångsuppsättning (yt-dlp, ffmpeg, de två skillsen) och sedan per video — transkript, bildrutor, destillering, spara i valvet. Kör lokalt, inte på Railway.",
    audience: "dig",
    content: load("MANUAL-VIDEO-DESTILLERING.md"),
  },
  {
    id: "prompt-video-destillering",
    title: "Prompt — destillera transkript mot systemet",
    description:
      "Prompten som körs efter att transkript + bildrutor hämtats. Skeptisk default, fyra siktfrågor, källmärkning per påstående, och en färdig retro-rad om något passerar sikten. Klistra in i Claude Code.",
    audience: "dig",
    content: load("PROMPT-VIDEO-DESTILLERING.md"),
  },
];
