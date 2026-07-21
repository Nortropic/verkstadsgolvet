# Kund-onboarding-flöde — byggspec för Claude Code

*Ge denna till Claude Code tillsammans med PROMPT-RESEARCH.md (research-prompten den ska automatisera). Bygger ett formulär → auto-research → repo-flöde. Kan vara en del av samma Next.js-app som Verkstadsgolvet-dashboarden, eller fristående. HALV-AUTO: stannar vid granskning, startar ALDRIG bygget självt.*

---

## VAD DU BYGGER
Ett webbinterface där Johnny fyller i en ny kunds uppgifter → appen kör research-prompten via Claude API → producerar research.md → skapar privat kund-repo på GitHub → pushar research.md dit → NOTIFIERAR Johnny "klar för granskning". STOPP DÄR. Johnny granskar research.md (den har [OSÄKER]-flaggor med flit), och startar SJÄLV bygget i Claude Code sen.

## DEN HÅRDA GRÄNSEN (bryt aldrig)
**Appen startar ALDRIG ett bygge automatiskt.** Den producerar research.md och stannar. Skälet: research-prompten producerar [OSÄKER]-flaggor och kräver mänsklig blick — auto-start skulle hoppa över den blicken och bygga på overifierad fakta. Flödet slutar vid "research.md klar för granskning", aldrig vid "bygget kör".

## FLÖDET (4 steg, sista är människa)
1. **Formulär** → Johnny fyller i kunduppgifter.
2. **Auto-research** → appen kör PROMPT-RESEARCH.md via Claude API mot ifyllda uppgifter → research.md.
3. **Repo** → appen skapar privat `kund-<slug>`-repo, pushar research.md.
4. **STOPP + notis** → "research.md klar för kund-<slug>, granska den". Johnny granskar, startar bygget själv i Claude Code.

## FORMULÄRFÄLT (matcha PROMPT-RESEARCH INDATA-blocket)
- Kundens formulärsvar (fritext, stort fält)
- Facebook-sida (URL eller "saknas")
- Instagram (URL eller "saknas")
- Befintlig hemsida (URL eller "saknas")
- Bransch + huvudort (t.ex. "snickeri, Luleå")
- Bokning/kontaktkanaler idag (t.ex. "telefon + IG-DM")
- Kundnamn (→ genererar `<slug>` för repo-namnet, t.ex. "Fanérverket" → `kund-fanerverket`)

## RESEARCH-STEGET (kärnan)
- Använd Claude API (server-side, nyckel i env — ALDRIG i klienten).
- System/user-prompt = innehållet i PROMPT-RESEARCH.md, med formulärfälten inmatade i INDATA-blocket.
- VIKTIGT — research-promptens read-only-regel gäller: prompten säger "skicka aldrig formulär, DM eller kontaktförfrågningar". Claude LÄSER FB/IG/sajt men agerar aldrig. Om du ger Claude web-verktyg, se till att de är läs-only.
- Output = research.md-innehållet enligt promptens struktur (10 sektioner, [OSÄKER]-flaggor, källnoter, kontrollrad sist).
- Om research-prompten vill ställa "max 2 klargörande frågor" (den får) — visa dem i UI:t för Johnny att svara på INNAN repot skapas, eller spara dem som öppna frågor i research.md. Bestäm med Johnny vilket.

## REPO-STEGET (= Y1, samma invarianter)
- Skapa privat GitHub-repo `kund-<slug>` via API. **PRIVAT VID SKAPANDE, hårdkodat, aldrig valbart** (kunddata).
- Namnkonvention `kund-<slug>` — slug från kundnamn (gemener, bindestreck, inga specialtecken/åäö → aa/ae/o eller translitererat).
- Pusha research.md som första commit.
- Robust felhantering (Y3): repo finns redan? (visa "finns, välj annat namn"). Token saknar behörighet? Namnkrock? Push avbruten? Tydliga fel, ingen krasch.
- GitHub-token server-side, fine-grained, `Contents: write` bara för repo-skapande (detta steg SKRIVER, till skillnad från dashboarden som bara läser — så det behöver en separat, mer betrodd token eller flow).

## SÄKERHET
- Claude API-nyckel OCH GitHub-token: server-side env, ALDRIG i klienten, aldrig i git, aldrig NEXT_PUBLIC.
- Detta interface är för Johnny själv (intern), inte publikt för kunder → överväg enkel auth (lösenord/Vercel-skydd) så inte vem som helst kan trigga research + repo-skapande.
- Read-only mot kundens FB/IG/sajt (research-promptens regel).

## NOTIS-STEGET
- När research.md är pushad: visa tydligt "✓ research.md klar för kund-<slug> — [länk till repot]. Granska den, starta sedan bygget i Claude Code."
- Visa gärna en förhandsvisning av research.md i UI:t (särskilt [OSÄKER]-flaggorna och kontrollraden) så Johnny ser direkt vad som behöver verifieras.
- INGEN "starta bygget"-knapp. Flödet slutar här.

## KOPPLING TILL DASHBOARDEN
- Kan vara samma Next.js-app (en /onboarding-route + dashboardens /). Delar GitHub-klient.
- Efter att research.md pushats syns det nya kund-repot i dashboardens kund-väljare automatiskt (dashboarden listar `kund-*`).
- Processvägledningen i dashboarden: steg 1-2 (research.md + kund-repo) blir nu GJORDA av onboarding-flödet; Johnny börjar på steg 3 (kör pipeline).

## FRÅGA JOHNNY INNAN DU BÖRJAR
- Ska detta vara del av dashboard-appen eller fristående?
- Var ska klargörande frågor hamna — UI innan repo, eller som öppna frågor i research.md?
- Har du en Claude API-nyckel redo, eller ska research-steget köras annorlunda?
- Auth för interfacet: lösenord, Vercel-skydd, eller kör bara lokalt?

## VAD DU INTE GÖR
- Startar ALDRIG ett bygge. Slutar vid granskning.
- Ingen nyckel i klienten. Inget publikt kund-repo. Ingen skrivning mot kundens FB/IG/sajt.
- Fabricerar ALDRIG research (promptens regel: allt obelagt = [OSÄKER], källnot per påstående).
- Skippar aldrig kontrollraden (5 obligatoriska fält, eller markerat nystartad-läge).
