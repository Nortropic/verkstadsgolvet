# Manual — YouTube-video → destillerad kunskap

*Steg-för-steg. Syftet: fånga vad en byggvideo faktiskt lär ut, mätt mot Nortropic-systemet, utan att samla textmassa. Slutprodukten är en destillering i valvet + eventuellt en retro-rad.*

---

## DEL 1 — ENGÅNGSUPPSÄTTNING (gör en gång)

> **✅ Klart på den här maskinen (2026-07-22).** yt-dlp, ffmpeg/ffprobe, de två skillsen, `inspiration/` och `tools/` är installerade och verifierade. DEL 1 är referens om du sätter upp flödet på nytt. Hoppa till **DEL 2** för att köra.
> **Notera:** öppna ett *nytt* terminalfönster efter en install — `yt-dlp`/`ffmpeg` hamnar i PATH men syns inte i redan öppna skal.
>
> **⚠️ Windows / föråldrad PATH i en redan startad session.** `ffmpeg`-bin och Python\Scripts (där `yt-dlp.exe` ligger) finns i User-PATH i registret, men en Claude Code-session som startades *före* installationen ärver en gammal PATH och hittar dem inte — även om ett nytt terminalfönster gör det. Symptom + lösning:
> - **Frame-scriptet hittar inte ffmpeg** → starta om Claude Code, ELLER ge full sökväg: winget-ffmpeg ligger i `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_*\ffmpeg-*-full_build\bin` (lägg först på `PATH` i skalet, eller peka `yt-dlp --ffmpeg-location <dir>`).
> - **yt-dlp hittas inte** → använd modulen: `python -m yt_dlp …` fungerar alltid.
> - **youtube-fetcher-skillen varnar "yt-dlp saknas"** och hoppar då över beskrivning/kapitel/längd. Hämta dem separat (billigt, ingen nedladdning): `python -m yt_dlp --skip-download --print "%(description)s" <url>`. Beskrivningens länkar ska ändå kollas FÖRST (Steg 1).

### 1.1 Installera beroenden
```bash
pip install youtube-transcript-api requests yt-dlp
```

**ffmpeg** (krävs för bildrutor):
- Windows: `winget install --id Gyan.FFmpeg -e` (bara `winget install ffmpeg` är tvetydigt) eller `scoop install ffmpeg`
- macOS: `brew install ffmpeg`
- Ubuntu: `sudo apt install ffmpeg`

Verifiera i ett **nytt** skal: `yt-dlp --version` och `ffmpeg -version` ska svara. (På Windows lägger pip `yt-dlp.exe` i `%APPDATA%\Python\Python3xx\Scripts` — den mappen måste ligga i PATH.)

### 1.2 Installera de två skillsen
```bash
# Transkript + metadata → markdown  (hamnar i ~/Workflow/.agents/skills/youtube-fetcher)
npx skills add JimmySadek/youtube-fetcher-to-markdown

# Bildrutor optimerade för LLM-läsning  (klona in i tools/ så valvet hålls rent)
git clone https://github.com/mugnimaestra/video-frames-skill.git tools/video-frames-skill
```

**Obs sökväg:** skriptet ligger nästlat på
`tools/video-frames-skill/skills/video-frames/scripts/extract_frames.py` — inte `scripts/extract_frames.py`.

### 1.3 ⚠️ LÄS SKRIPTEN INNAN FÖRSTA KÖRNINGEN
Båda är tredjeparts och körs lokalt med dina rättigheter. Kontrollera:
- Vart skriver de filer?
- Anropar de något utanför YouTube/ffmpeg?
- Läser de något de inte behöver?

Fem minuter, engångskostnad. Samma vaksamhet som gäller alla externa verktyg i systemet.

### 1.4 Lägg prompten på plats
Spara `PROMPT-VIDEO-DESTILLERING.md` i `~/Workflow/` så Claude Code hittar den.

Skapa mapp för resultaten:
```bash
mkdir ~/Workflow/inspiration
```

---

## DEL 2 — PER VIDEO (så här gör du varje gång)

### Steg 1 — Kolla beskrivningen FÖRST (30 sekunder, sparar mest)
Öppna videon, läs beskrivningstexten. Finns ett **GitHub-repo, gist eller blogginlägg** med koden?

**Om ja:** läs repot istället. Det är alltid en bättre källa än en OCR:ad skärmdump. Du kanske inte behöver resten av flödet alls för just den videon.

**Om nej, eller om du vill ha resonemanget bakom koden:** fortsätt.

### Steg 2 — Kör flödet i Claude Code
Öppna Claude Code i `~/Workflow/` och klistra in:

```
Hämta och destillera den här videon: [URL]

1. Kör youtube-fetcher-skillen → transkript + metadata + beskrivning
2. Ladda ner videon lokalt med yt-dlp
3. Extrahera bildrutor: python tools/video-frames-skill/skills/video-frames/scripts/extract_frames.py video.mp4 --max-frames 25 --preset ocr --timestamps
4. Destillera enligt PROMPT-VIDEO-DESTILLERING.md (transkript + rutor som indata)
5. Spara destilleringen i inspiration/ som YYYY-MM-DD_kanal_ämne.md
6. Radera videofilen när extraktionen är klar

Kör på Opus (bildläsning kräver precision).
```

**Varför 25 rutor:** kostnaden är linjär i antal bilder. Börja lågt. Om destilleringen säger att den saknar information, kör om med fler.

**⚠️ `--max-frames` har ett golv:** skriptet klampar fps till minst `0.05` (en ruta per 20 s). På en lång video ger `--max-frames 25` alltså *fler* rutor än 25 — en 25-min-video landar på ~76. Vill du hålla ~25 på en lång video: låt Claude sätta `fps` direkt (`--fps $(python -c "print(25/DURATION)")`) eller använd `--scene-threshold` (se nedan). Tidsstämpeln som bränns in är videons **källtid**, så korsreferensen mot transkriptet stämmer oavsett antal.

**Varför `--timestamps`:** `--preset ocr` sätter gråskala/kontrast/skärpa men bränner INTE in tidsstämpeln. Utan `--timestamps` faller promptens korsreferens mellan tal och bild (`[SKÄRM MM:SS]`) — flaggan är alltså inte valfri för det här flödet. *(Windows: den medföljande gyan-ffmpeg:en segfaultade tidigare i `drawtext` utan explicit font — det är patchat i `extract_frames.py`, flaggan fungerar nu direkt.)*

**Alternativ vid långa videor (>40 min):** be den använda `--scene-threshold 0.3` istället för `--max-frames` — då tas en ruta per scenövergång istället för fast intervall.

### Steg 3 — Läs destilleringen
Den är strukturerad så du snabbt ser:
- **Sektion 3** — vad som är användbart för dig (det viktigaste)
- **Sektion 4** — vad du redan har och gör annorlunda
- **Sektion 5** — vad som är hype eller fel för dig
- **Sektion 7** — färdig retro-rad, om något passerade sikten

### Steg 4 — Agera
**Om det finns en retro-rad:** klistra in den i `~/Workflow/retro-inbox.md`. Då är idén i systemet och granskas på nästa retro som allt annat — genom grinden, inte förbi den.

**Om ingen retro-rad:** det vanligaste utfallet. Spara destilleringen ändå som dokumentation på att du redan utvärderat videon — så du inte gör om jobbet om tre månader.

---

## DEL 3 — FÖRSTA GÅNGEN

**Kör på en video du redan sett** och vet innehållet i. Då ser du direkt om destilleringen fångade rätt saker eller missade poängen — och kan justera prompten innan du börjar lita på den.

Sådant du kan behöva justera efter första körningen:
- För få/många bildrutor
- Prompten missar en sektion du bryr dig om
- Källmärkningen är för tjatig eller för gles

---

## SNABBREFERENS

| Vad | Kommando |
|---|---|
| Transkript | youtube-fetcher-skill via Claude Code |
| Ladda ner video | `yt-dlp <url>` |
| Bildrutor (standard) | `python tools/video-frames-skill/skills/video-frames/scripts/extract_frames.py video.mp4 --max-frames 25 --preset ocr --timestamps` |
| Bildrutor (lång video) | `... extract_frames.py video.mp4 --scene-threshold 0.3 --preset ocr --timestamps` |
| Destillera | Claude Code + `PROMPT-VIDEO-DESTILLERING.md` |
| Spara | `~/Workflow/inspiration/YYYY-MM-DD_kanal_ämne.md` |

---

## NOTER

**Kör lokalt, inte på Railway.** YouTube blockerar transcript-anrop från många moln-IP:n.

**Kostnad.** Bilder är dyra i kontext. Detta flöde är för videor du faktiskt vill lära av — inte för att beta av en spellista. Om transkript + länkar räcker: hoppa över bildrutorna.

**Upphovsrätt.** Spara destillerade insikter i egna ord, inte råkopior av andras innehåll. Transkriptet är källmaterial för din egen förståelse, inte ett bibliotek att bygga.

**Var det INTE hör hemma.** Detta är ett Claude Code-flöde vid skrivbordet, inte en dashboard-funktion. Dashboarden speglar systemet (läs-only); den ska inte bli ett kontrollrum. Kopplingen sker via retro-inbox, som dashboarden redan läser.
