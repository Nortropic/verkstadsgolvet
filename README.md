# Verkstadsgolvet

Intern **läs-only** övervakningsdashboard för Nortropics agent-system + ett
halv-automatiskt **kund-onboarding**-flöde. En Next.js-app (App Router), deployad
på **Railway** från ett **privat** GitHub-repo.

> **Säkerhet i ett ögonkast**
> - Appen är lösenordsskyddad (NextAuth) från första deploy — aldrig publikt nåbar.
> - Dashboarden **läser** GitHub, **skriver aldrig**.
> - Alla tokens/nycklar bor i server-side env / Railway encrypted vars. Aldrig i
>   klienten, aldrig i git, aldrig `NEXT_PUBLIC_*`.

---

## Delar

1. **Verkstadsgolvet-dashboard** (`/`) — läser tre privata GitHub-källor via API och
   visar process, agent-inblick, dokument, doktorn/retro/nattman, över-tid och
   systemkarta. Läs-only. Matchar `reference/nortropic-verkstadsgolvet.html`.
2. **Kund-onboarding** (`/onboarding`) — byggs **sist**, bakom flaggan
   `ONBOARDING_ENABLED`. Formulär → research via Claude API → skapar privat
   `kund-<slug>`-repo → pushar `research.md` → **stopp för granskning**. Startar
   aldrig ett bygge.

---

## Miljövariabler

Se [`.env.example`](./.env.example) för hela listan. Kopiera till `.env.local` för
lokal utveckling; lägg in samma nycklar som **encrypted variables** i Railway.

| Variabel | Del | Beskrivning |
| --- | --- | --- |
| `AUTH_SECRET` | auth | `openssl rand -base64 32` |
| `AUTH_URL` | auth | Publik Railway-URL i produktion |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | auth | Den enda interna användaren |
| `GITHUB_TOKEN_READ` | dashboard | Fine-grained PAT, **Contents: Read-only** |
| `GITHUB_OWNER` | dashboard | Konto/org som äger repona |
| `WORKFLOW_REPO` | dashboard | Exakt namn på Workflow/system-repot |
| `GITHUB_TOKEN_WRITE` | onboarding | Fine-grained PAT, **Contents: Read and write** |
| `ANTHROPIC_API_KEY` | onboarding | Claude API-nyckel |
| `ONBOARDING_ENABLED` | onboarding | `false` tills flödet är bekräftat |

---

## Skapa de två GitHub-tokenarna (minsta behörighet)

Två **separata** fine-grained Personal Access Tokens — läs-token och skriv-token är
åtskilda så att den läs-only dashboarden fysiskt inte kan skriva.

**GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**

### 1. `GITHUB_TOKEN_READ` (dashboarden)
- **Resource owner:** kontot/org som äger repona (`GITHUB_OWNER`).
- **Repository access:** *Only select repositories* → välj Workflow-repot + alla
  `kund-*`-repon (uppdatera token när nya kund-repon tillkommer).
- **Permissions → Repository permissions:** `Contents` = **Read-only**. Inget annat.
  (Ingen write, ingen admin, ingen org-scope.)
- Kopiera token → `GITHUB_TOKEN_READ`.

### 2. `GITHUB_TOKEN_WRITE` (onboarding — skapas först när onboarding aktiveras)
- **Resource owner:** samma konto/org.
- **Repository access:** *All repositories* (krävs för att kunna **skapa** nya
  `kund-*`-repon) — eller begränsa enligt din policy.
- **Permissions → Repository permissions:** `Administration` = **Read and write**
  (skapa repo) och `Contents` = **Read and write** (pusha `research.md`).
- Kopiera token → `GITHUB_TOKEN_WRITE`. Lämna tom tills `ONBOARDING_ENABLED=true`.

> Fine-grained tokens har utgångsdatum — sätt en påminnelse att rotera dem.

---

## Deploy till Railway

1. Skapa ett **privat** GitHub-repo och pusha koden (se nedan).
2. Railway → **New Project → Deploy from GitHub repo** → välj repot.
3. Railway auto-detekterar Next.js (`npm run build` → `npm run start`). `PORT`
   sätts automatiskt av Railway och läses av `next start`.
4. **Variables:** lägg in alla env-nycklar ovan som encrypted variables. Sätt
   `AUTH_URL` till Railway-domänen och `ONBOARDING_ENABLED=false`.
5. Öppna URL:en → du möts av **/login**. Ingen route är nåbar utan inloggning.

Varje `git push` till standardbranchen triggar en ny deploy automatiskt.

---

## Lokalt (valfritt)

```bash
npm install
cp .env.example .env.local   # fyll i värden
npm run dev                  # http://localhost:3000
```

---

## Invarianter (bryts aldrig)

1. Dashboarden är **läs-only**. Ingen write, ingen styrknapp.
2. Inga hemligheter i klienten. Aldrig `NEXT_PUBLIC_*`, aldrig i git.
3. Lösenordsskyddad från **första** deploy.
4. Alla källrepon och kund-repot är **privata**. 404/403 hanteras graceful.
5. Onboarding startar **aldrig** ett bygge; stannar vid research-granskning.
6. Onboarding är avstängd bakom `ONBOARDING_ENABLED` tills flödet är bekräftat.
