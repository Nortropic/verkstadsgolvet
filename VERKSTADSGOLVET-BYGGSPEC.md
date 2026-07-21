# Verkstadsgolvet — byggspec för Claude Code

*Ge denna till Claude Code i en TOM mapp (ej i systemrepot, ej i Workflow). Den bygger en läs-only Next.js-dashboard som läser allt via GitHub API. Prototypen (nortropic-verkstadsgolvet.html) är den visuella förlagan — matcha dess design, palett och paneler.*

---

## VAD DU BYGGER
En läs-only övervakningsdashboard ("Verkstadsgolvet") för Nortropics agent-system. Den läser data från privata GitHub-repon via API och visar: processvägledning, agent-inblick, dokumentnavigering, systemhälsa (doctor/retro/nattman), över-tid-aggregering, och en Graphify-driven systemkarta. Next.js (App Router) + Vercel-redo.

## HÅRDA INVARIANTER (bryt aldrig)
1. **LÄS-ONLY. ALLTID.** Appen läser GitHub, skriver ALDRIG. Inga knappar som ändrar systemet, inga writes, ingen styrning. Den speglar, den styr aldrig. (Motverkar scope-creep till kontrollrum/OS.)
2. **GitHub-token ALDRIG i klienten.** Token bor i server-side env (`GITHUB_TOKEN` i `.env.local`, och i Vercel som encrypted env var). All GitHub-läsning sker i API-routes / server components — ALDRIG i browser-kod. Token får aldrig nå `NEXT_PUBLIC_*`.
3. **Minsta behörighet.** Token ska vara en fine-grained PAT med ENDAST `Contents: read-only` på de aktuella privata repona. Ingen write, ingen admin, ingen org-scope. Dokumentera i README hur den skapas.
4. **Alla källrepon är PRIVATA.** Bär kunddata. Hantera 404/403 elegant (repo finns ej / token saknar åtkomst) — visa tydligt fel-läge, krascha inte.

## DATAKÄLLOR (alla via GitHub API, tre st)
1. **Workflow-repo** (privat, `workflow` eller liknande — fråga användaren om exakt namn): läser AUTOBYGG-LOG.md, doctor-output, retro-inbox.md, AUTO-DIGEST.md, agent-loggar.
2. **Kund-repon** (privata, mönster `kund-<slug>`): läser research.md, PROJECT-BRIEF.md, profile.ts, REVIEW-REPORT.md, VERIFY-SUITE-RESULT.md, byggd kod. Lista alla repon som matchar `kund-*` via GitHub API, låt användaren välja vilket bygge som visas.
3. **Graphify-output** (när den finns — i system-repot eller kund-repot under `graphify-out/`): GRAPH_REPORT.md, graph.json. GRACEFUL: om filerna saknas, visa "graf ej byggd än"-läge, krascha inte. Detta är den enda källan som kanske ej finns dag 1.

## ARKITEKTUR
- **Next.js App Router.** Server components hämtar GitHub-data (håller token server-side). Client components för interaktivitet (klicka agent, bläddra filer).
- **GitHub-läsning:** använd Octokit (@octokit/rest) eller fetch mot api.github.com med token i Authorization-header, server-side.
- **Uppdatering:** "live" = poll var 30:e sekund (client-side revalidation eller Next.js revalidate). VAR ÄRLIG i UI: detta är "senaste push", ej realtidsström. En "senast uppdaterad"-tidsstämpel synlig.
- **Parsning:** markdown-loggarna har inline-fält (`bygge:: X`, `gate:: 4`, `status:: FAIL`) — se agent-loggnings-spec (Z1). Parsa dem till strukturerad data. Om taggning ej finns än, degradera elegant (visa rå md).
- **Caching:** cacha GitHub-svar rimligt (GitHub API har rate limits — 5000/h autentiserat). Poll:a inte hårdare än nödvändigt.

## PANELER (matcha prototypen nortropic-verkstadsgolvet.html)
1. **Processvägledning** (topp): 8 steg (research.md → kund-repo → kör pipeline → godkänn nod3 → granska → signera nod8 → fyll fakta → cutover). Visa var bygget är, "nästa: X"-badge.
2. **Agent-inblick** (stjärna): lista agenter, klicka → arbetslogg (beslut / källa→beslut / friktion / "var förfina"). Data från agent-loggar (Z1). Om ej loggat än: "loggning ej aktiv".
3. **Dokumentnavigering** (stjärna): filträd grupperat (indata/plan/granskning/byggd kod), klicka → läs innehåll. Data = filer i valt kund-repo.
4. **Doctor-panel:** 12-kontroll-rutnät, PASS/WARN/FAIL + "kunde-ej-köras" (randig, SKILT från grön). Data = doctor-output i Workflow-repo.
5. **Retro-panel:** öppna ärenden per tier från retro-inbox.md.
6. **Nattman-panel** (SÄKERHETSKRITISK): AUTOPILOT-status, senaste N2-ändring, zon, eval-stöd. Data = AUTO-DIGEST.md. Misevolution-vakt: om drift → syns här.
7. **Över-tid-vy:** återkommande friktion per agent över flera byggen (aggregera Z1-loggar över alla kund-repon). Staplar per agent.
8. **Systemkarta (Graphify):** map confidence (found/inferred), nav-filer (god nodes ur GRAPH_REPORT), token-besparing, kritiker-loop-visualisering. Graceful om graf saknas.
9. **Nyckeltal:** eval-poäng, tokens, grindar, öppna fynd.

## DESIGN (matcha prototypen exakt)
- Palett: sval slate/nära-svart (`--bg:#0d0f14`), EN violett accent (`--accent:#7c6cf0`), status grön/bärnsten/rost dämpat. En accent i hav av grått.
- Typografi: Space Grotesk (rubriker), Inter (brödtext), JetBrains Mono (data/kod).
- Skiktad höjd (paneler snäpp ljusare än bg). Rundade hörn 14px. Läs prototypen för exakta värden.
- Responsiv ner till mobil. Reduced-motion respekterad. Synlig keyboard-focus.

## BYGG-ORDNING (föreslagen)
1. Next.js-skelett + palett/typografi från prototypen.
2. GitHub-klient server-side (Octokit + token). Testa: lista `kund-*`-repon.
3. En panel end-to-end mot RIKTIG data (dokumentnavigering — enklast, läser bara filer). Bevisa arkitekturen.
4. Resten av panelerna, en i taget, mot riktig data.
5. Poll/revalidation. "Senast uppdaterad"-stämpel.
6. Graceful-lägen (repo saknas, graf ej byggd, loggning ej aktiv).
7. Deploy till Vercel (token som encrypted env var).

## FRÅGA ANVÄNDAREN INNAN DU BÖRJAR
- Exakt namn på Workflow-repot?
- Är kund-repon skapade än, eller ska dashboarden hantera "inga kund-repon än"?
- Ska den deployas till Vercel (publik URL, token i Vercel-env) eller köra bara lokalt (`npm run dev`) tills vidare? För kunddata-känslighet: lokalt först är tryggare tills auth/åtkomst är genomtänkt.

## BEROENDEN PÅ ANDRA ÄRENDEN (dashboarden visar bara vad som finns)
- Full agent-inblick kräver Z1 (agent-loggning) — torsdag+.
- Systemkarta kräver Ö1 (Graphify) — torsdag+.
- Kund-repo-panel kräver Y1 (kund-repo som byggsteg) — eller minst ett manuellt skapat kund-repo.
- Tills de finns: bygg panelerna med graceful "ej aktiv än"-lägen. Dashboarden växer i takt med att datakällorna byggs.

## VAD DU INTE GÖR
- Ingen write till GitHub. Ingen styrknapp. Ingen token i klienten. Ingen realtids-påstående (det är poll). Inget publikt repo. Ingen panel som kräver data som inte finns utan graceful-läge.
