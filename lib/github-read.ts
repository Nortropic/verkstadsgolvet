/**
 * LÄS-only GitHub-klient. Importeras ENDAST av server-side route-handlers —
 * aldrig av klientkod. GITHUB_TOKEN_READ läses ur process.env och lämnar aldrig
 * servern. Alla anrop returnerar ett envelope ({ok:true,data} | {ok:false,reason})
 * så anropare kan rendera graceful-lägen istället för att krascha (invariant 4).
 *
 * Tokenen ska vara en fine-grained PAT med ENDAST Contents: Read-only. Denna modul
 * anropar aldrig någon skrivande endpoint — dashboarden speglar, den styr aldrig.
 */
import { Octokit } from "@octokit/rest";
import { cached } from "./cache";

export type ReadFail = {
  ok: false;
  reason: "no-config" | "not-found" | "forbidden" | "error";
  message: string;
};
export type ReadResult<T> = { ok: true; data: T } | ReadFail;

export type SourceRepo = {
  name: string;
  kind: "workflow" | "kund";
  fullName: string;
};
export type TreeEntry = { path: string; type: "blob" | "tree"; size?: number };
export type FileContent = { path: string; text: string; truncated: boolean };

const OWNER = process.env.GITHUB_OWNER;
const TOKEN = process.env.GITHUB_TOKEN_READ;
const WORKFLOW_REPO = process.env.WORKFLOW_REPO;
const TTL = 20_000;
const MAX_FILE_BYTES = 400_000;

export function isConfigured(): boolean {
  return Boolean(TOKEN && OWNER);
}

function client(): Octokit | null {
  return TOKEN ? new Octokit({ auth: TOKEN }) : null;
}

function noConfig(): ReadFail {
  return {
    ok: false,
    reason: "no-config",
    message: "GITHUB_TOKEN_READ / GITHUB_OWNER saknas i miljön.",
  };
}

function fail(e: unknown): ReadFail {
  const status = (e as { status?: number })?.status;
  if (status === 404) return { ok: false, reason: "not-found", message: "Hittades inte (404)." };
  if (status === 403) return { ok: false, reason: "forbidden", message: "Åtkomst nekad (403) — token saknar behörighet." };
  return { ok: false, reason: "error", message: (e as Error)?.message ?? "Okänt fel." };
}

/** Skydd: dashboarden får bara läsa Workflow-repot eller kund-*-repon. */
function allowedRepo(repo: string): boolean {
  return repo === WORKFLOW_REPO || /^kund-[a-z0-9-]+$/.test(repo);
}

export async function listSourceRepos(): Promise<ReadResult<SourceRepo[]>> {
  const ok = client();
  if (!ok || !OWNER) return noConfig();

  try {
    const data = await cached(`repos:${OWNER}`, TTL, async () => {
      const repos: SourceRepo[] = [];

      // Workflow-repot läggs in explicit (verifiera åtkomst).
      if (WORKFLOW_REPO) {
        try {
          await ok.repos.get({ owner: OWNER, repo: WORKFLOW_REPO });
          repos.push({
            name: WORKFLOW_REPO,
            kind: "workflow",
            fullName: `${OWNER}/${WORKFLOW_REPO}`,
          });
        } catch {
          // Utelämna om ej åtkomlig — panelen visar graceful-läge.
        }
      }

      // kund-*-repon som tokenen har åtkomst till.
      const all = await ok.paginate(ok.repos.listForAuthenticatedUser, {
        per_page: 100,
        affiliation: "owner,collaborator,organization_member",
      });
      for (const r of all) {
        if (
          r.owner?.login?.toLowerCase() === OWNER.toLowerCase() &&
          r.name.startsWith("kund-")
        ) {
          repos.push({ name: r.name, kind: "kund", fullName: r.full_name });
        }
      }
      return repos;
    });

    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function getRepoTree(repo: string): Promise<ReadResult<TreeEntry[]>> {
  const ok = client();
  if (!ok || !OWNER) return noConfig();
  if (!allowedRepo(repo)) return { ok: false, reason: "not-found", message: "Otillåtet repo." };

  try {
    const data = await cached(`tree:${OWNER}/${repo}`, TTL, async () => {
      const info = await ok.repos.get({ owner: OWNER, repo });
      const branch = info.data.default_branch;
      const tree = await ok.git.getTree({
        owner: OWNER,
        repo,
        tree_sha: branch,
        recursive: "1",
      });
      return tree.data.tree
        .filter((t): t is typeof t & { path: string } => Boolean(t.path))
        .map((t) => ({
          path: t.path,
          type: (t.type === "tree" ? "tree" : "blob") as "tree" | "blob",
          size: t.size,
        }));
    });
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

export async function getFileContent(
  repo: string,
  path: string
): Promise<ReadResult<FileContent>> {
  const ok = client();
  if (!ok || !OWNER) return noConfig();
  if (!allowedRepo(repo)) return { ok: false, reason: "not-found", message: "Otillåtet repo." };

  try {
    const data = await cached(`file:${OWNER}/${repo}:${path}`, TTL, async () => {
      const res = await ok.repos.getContent({ owner: OWNER, repo, path });
      const d = res.data;
      if (Array.isArray(d) || d.type !== "file") {
        throw Object.assign(new Error("Ej en fil."), { status: 404 });
      }
      if (typeof d.size === "number" && d.size > MAX_FILE_BYTES) {
        return { path, text: "(filen är för stor för förhandsvisning)", truncated: true };
      }
      const text = Buffer.from(d.content, "base64").toString("utf-8");
      return { path, text, truncated: false };
    });
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}
