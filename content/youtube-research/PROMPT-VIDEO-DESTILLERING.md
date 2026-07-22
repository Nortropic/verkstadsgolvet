# PROMPT — destillera videotranskript mot Nortropic-systemet

*Används efter att transkript OCH bildrutor hämtats. Syftet är INTE att referera videon — det är att avgöra vad som faktiskt bär sin vikt för Nortropics system, och vad som är hype. Skeptisk default. Producerar en destillering som sparas ovanför/bredvid transkriptet.*

**Indata (två källor):**
1. **Transkript** — md-fil från youtube-fetcher-skillen (metadata, beskrivning, kapitel, tal)
2. **Bildrutor** — från video-frames-skill, helst `--preset ocr --timestamps` med tidsstämpel inbränd (`yt-dlp` → `extract_frames.py --max-frames 30 --preset ocr --timestamps`). OBS: `--preset ocr` ensamt bränner INTE in tidsstämpeln — `--timestamps` krävs för korsreferensen nedan.

Transkript ensamt räcker INTE för byggvideor — det mesta av värdet (kod, filstruktur, UI, kommandon) finns bara i bild. Kör med båda när det går; om bara transkript finns, säg det och markera luckorna.

---

Du läser ett transkript från en YouTube-video (bifogas / ligger i filen). Din uppgift är att destillera det mot MITT system, inte att sammanfatta videon.

## KONTEXT — vad mitt system är
Nortropic: Claude Code-baserad multi-agent-pipeline som bygger Next.js-sajter åt svenska småföretag i Fyrkanten. Stack: Next.js, Vercel (kundsajter), Railway (egna verktyg), Cloudflare (framför Railway), Supabase, Resend, n8n, 46elks, GitHub. Systemet har konstitution (§A aldrig-självmodifierbara ytor + eval-grindad självförbättringstrappa), doctor-kontroller, agent-loggning, retro-flöde med förslag→godkännande.

## HÅLLNING (viktig)
- **Skepsis som default.** Byggvideor säljer nästan alltid något, även när de lär ut. Anta att entusiasm ≠ bevis.
- **Mät mot faktiska filer och beslut**, inte mot vad som låter bra.
- **Fabricera inte.** Står det varken i transkript eller bild — säg det.
- **KORSREFERERA de två källorna.** Bildrutorna har tidsstämpel inbränd; transkriptet har tidsordning. Koppla ihop dem: när talaren säger "så lägger vi in det här", leta i rutan från samma tidpunkt efter vad "det här" faktiskt var. Det är hela poängen med att ha båda.
- **Läs kod och UI från bild, försiktigt.** Skärmtext kan vara suddig eller avklippt. Återge ALDRIG kod du inte kan läsa säkert — skriv `[OLÄSLIGT vid MM:SS]` istället för att gissa. Felläst kod är värre än ingen kod.
- **Ange källa per påstående:** `[TAL]` (sagt i transkript), `[SKÄRM MM:SS]` (läst ur bildruta), `[BESKRIVNING]` (ur videons beskrivningstext).

## FYRA SIKTFRÅGOR (kör varje idé genom dessa)
1. **Har jag redan detta?** (i pipeline, skills, grindar, docs)
2. **Krockar det med ett medvetet val?** (t.ex. läs-only-dashboard, ingen självmodifiering utan grind, ingen fullservice-drift)
3. **Bär det sin vikt?** (värde ÷ komplexitet + underhåll)
4. **Källkritik:** säljer videon något? Är påståendet belagt eller anekdot?

## OUTPUT (i denna struktur)

### 1. VAD VIDEON FAKTISKT VISAR
3-6 meningar. Vad byggdes/lärdes ut, i vilket sammanhang, för vilken publik. Ingen entusiasm, ingen marknadsföringston.

### 2. KONKRETA TEKNIKER, VERKTYG & BESLUT
Lista allt namngivet: bibliotek, tjänster, kommandon, arkitekturval, prompt-mönster, arbetsflöden. Per post: vad det är + vad det påstods lösa + källmärkning (`[TAL]` / `[SKÄRM MM:SS]` / `[BESKRIVNING]`). Markera `[EJ BELAGT]` när påståendet är obevisat.

### 2b. VAD BILDRUTORNA VISAR (som talet inte sa)
Det här är varför bildrutorna finns. Gå igenom rutorna och fånga:
- **Kod/kommandon** som syns — återge exakt, eller `[OLÄSLIGT vid MM:SS]`
- **Filstruktur / mappträd** som visas
- **Arkitekturskisser, diagram, dashboards**
- **UI-val och layoutmönster** (om videon rör design)
- **Terminal-output, felmeddelanden, konfigfiler**
Per post: tidsstämpel + vad som syns + varför det är relevant (eller "ej relevant för mig"). Hoppa över rutor som bara visar talarens ansikte, intro, eller upprepad information.

### 2c. LÄNKAR I BESKRIVNINGEN (kolla FÖRST — billigare än att OCR:a)
Leta i videons beskrivningstext efter GitHub-repo, gist, blogginlägg, dokumentation. **Om koden finns i ett länkat repo är det ALLTID bättre källa än en skärmdump.** Lista länkarna och notera vilka som verkar innehålla det som visades i videon. Om en länk gör bildrutorna överflödiga för ett visst avsnitt — säg det.

### 3. VAD SOM ÄR ANVÄNDBART FÖR NORTROPIC
Bara det som passerar de fyra siktfrågorna. Per post:
- **Vad:** kort beskrivning
- **Var det hör hemma:** vilken del av systemet (agent, grind, docs, dashboard, tjänst)
- **Varför det bär sin vikt:** konkret vinst
- **Vad det kostar:** komplexitet, underhåll, ny beroendeyta
- **Nästa steg:** utvärdera hur? mot vad? (aldrig "implementera direkt")
Om inget passerar sikten — säg det rakt. Det är ett giltigt och vanligt utfall.

### 4. VAD JAG REDAN HAR (och gör bättre/annorlunda)
Där videon lär ut något systemet redan löser. Kort per punkt: vad de gör, vad jag gör, varför min version är medveten. Detta motverkar att samma idé återuppstår om tre månader.

### 5. VAD SOM ÄR HYPE ELLER FEL FÖR MIG
- Säljande påståenden utan belägg
- Saker som krockar med medvetna val (namnge vilket)
- Verktyg som löser problem jag inte har
- Säkerhets-/underhållsrisker (särskilt: självmodifierande agenter utan grind, breda extensions/skrapning, tjänster med åtkomst till kunddata eller nycklar)

### 6. ÖPPNA FRÅGOR
Vad som skulle behöva verifieras innan något av detta tas vidare — och hur (kör mot systemrepot? testa på ett bygge? läsa källkoden?).

### 7. RETRO-RAD (om något passerade sikten)
En färdig rad att klistra i retro-inbox, i samma stil som befintliga ärenden:
`- [ÖPPET] **XN · <kort titel>.** <vad, varför det bär sin vikt, vad som ska utvärderas FÖRST, vilken grind det ska genom.>`
Om inget passerade: skriv `INGEN RETRO-RAD — inget passerade sikten.`

---

Håll det kort och konkret. Hellre fem skarpa rader än tre stycken prosa. Om transkriptet är tunt eller mest talspråk, säg det istället för att fylla ut.

---

## ARBETSFLÖDE (så här produceras indatan)

1. **Transkript:** `npx skills add JimmySadek/youtube-fetcher-to-markdown` → peka på URL → md-fil med metadata, beskrivning, kapitel, transkript. Hittar skillen inte `yt-dlp` på PATH tappar den beskrivning/kapitel — hämta dem då separat: `python -m yt_dlp --skip-download --print "%(description)s" <url>`.
2. **Video:** `yt-dlp <url>` (ladda ner lokalt — YouTube blockerar moln-IP:n). Fungerar inte kommandot: `python -m yt_dlp <url>`. Kräver ffmpeg för att slå ihop video+ljud; saknas det på PATH, se Windows-noten i MANUAL-VIDEO-DESTILLERING.md.
3. **Bildrutor:** `python tools/video-frames-skill/skills/video-frames/scripts/extract_frames.py video.mp4 --max-frames 30 --preset ocr --timestamps` (från mugnimaestra/video-frames-skill). OCR-preset = gråskala + hög kontrast + skärpning, byggt för skärmtext. `--timestamps` bränner in filnamn + källtidsstämpel i varje ruta (krävs — preseten gör det inte själv). *(Windows: `drawtext` segfaultade utan explicit font — patchat i scriptet, flaggan fungerar nu direkt.)*
   - **`--max-frames` har ett fps-golv (0.05):** på en lång video ger den fler rutor än begärt (25 min → ~76 för `--max-frames 25`). Vill du hålla ~N: sätt `--fps $(python -c "print(N/DURATION)")` eller använd `--scene-threshold`.
   - Alternativ vid långa videor: `--scene-threshold 0.3` (en ruta per scenövergång istället för fast intervall).
   - **Börja lågt (20-30 rutor).** Kostnaden är linjär i antal bilder. Öka bara om destilleringen säger att den saknar information.
4. **Kör denna prompt** med transkript + rutor som indata.
5. **Spara destilleringen** i valvet. Transkriptet blir källa, destilleringen blir kunskapen.

**Säkerhetsnot:** båda skillsen är tredjeparts och körs lokalt med dina rättigheter. Läs skripten innan första körningen — vart de skriver, vad de anropar. Engångskostnad, värd fem minuter.

**Kostnadsnot:** bilder är dyra i kontext. Detta flöde är för videor du faktiskt vill lära av — inte för att beta av en spellista. Om transkript + beskrivningens länkar räcker: hoppa över bildrutorna.
