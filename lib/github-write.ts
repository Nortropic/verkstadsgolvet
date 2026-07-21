/**
 * SKRIVANDE GitHub-klient (Fas B, onboarding). Server-only. Skapar ett PRIVAT
 * kund-<slug>-repo och pushar research.md som första commit. Använder
 * GITHUB_TOKEN_WRITE (separat variabel, kan peka på annan token än läs-token).
 *
 * PRIVAT VID SKAPANDE ÄR HÅRDKODAT (private: true) — aldrig valbart (kunddata).
 * Robust felhantering: repo finns redan, behörighet, push-fel.
 */
import { Octokit } from "@octokit/rest";
import { toRepoName } from "./slug";

const OWNER = process.env.GITHUB_OWNER;
const TOKEN = process.env.GITHUB_TOKEN_WRITE;

export type CreateResult =
  | { ok: true; repo: string; url: string }
  | { ok: false; reason: "no-config" | "bad-name" | "exists" | "create-failed" | "push-failed"; message: string };

export async function createKundRepoAndPush(
  kundnamn: string,
  researchMd: string
): Promise<CreateResult> {
  if (!TOKEN || !OWNER) {
    return { ok: false, reason: "no-config", message: "GITHUB_TOKEN_WRITE / GITHUB_OWNER saknas." };
  }
  const repo = toRepoName(kundnamn);
  if (!repo) {
    return { ok: false, reason: "bad-name", message: "Kunde inte generera slug ur kundnamnet." };
  }

  const ok = new Octokit({ auth: TOKEN });

  // 1. Skapa privat repo (hårdkodat private: true)
  try {
    await ok.repos.createForAuthenticatedUser({
      name: repo,
      private: true,
      auto_init: false,
      description: `Nortropic kund: ${kundnamn}`,
    });
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 422) {
      return { ok: false, reason: "exists", message: `Repo "${repo}" finns redan — välj ett annat kundnamn.` };
    }
    return { ok: false, reason: "create-failed", message: (e as Error)?.message ?? "Kunde inte skapa repo." };
  }

  // 2. Pusha research.md som första commit
  try {
    await ok.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo,
      path: "research.md",
      message: "Lägg till research.md (Nortropic onboarding)",
      content: Buffer.from(researchMd, "utf-8").toString("base64"),
    });
  } catch (e) {
    return {
      ok: false,
      reason: "push-failed",
      message: `Repot skapades men push av research.md misslyckades: ${(e as Error)?.message ?? "okänt fel"}`,
    };
  }

  return { ok: true, repo, url: `https://github.com/${OWNER}/${repo}` };
}
