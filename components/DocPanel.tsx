"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ---- typer (speglar lib/github-read.ts envelopes) ---- */
type SourceRepo = { name: string; kind: "workflow" | "kund"; fullName: string };
type TreeEntry = { path: string; type: "blob" | "tree"; size?: number };
type FileContent = { path: string; text: string; truncated: boolean };
type Envelope<T> = { ok: true; data: T } | { ok: false; reason: string; message: string };

async function getJSON<T>(url: string): Promise<Envelope<T>> {
  try {
    const r = await fetch(url, { credentials: "same-origin" });
    // Middleware kan redirecta oinloggade till /login (HTML) — då är sessionen borta.
    if (r.redirected || !r.headers.get("content-type")?.includes("application/json")) {
      return { ok: false, reason: "auth", message: "Sessionen gick ut — ladda om sidan." };
    }
    return (await r.json()) as Envelope<T>;
  } catch (e) {
    return { ok: false, reason: "error", message: (e as Error).message };
  }
}

/* gruppera blobs på översta katalognivå (docs/, agents/, skills/ … ; rot = "ROT") */
function groupTree(tree: TreeEntry[]) {
  const groups: Record<string, string[]> = {};
  for (const b of tree) {
    if (b.type !== "blob") continue;
    const seg = b.path.includes("/") ? b.path.split("/")[0] : "ROT";
    (groups[seg] ??= []).push(b.path);
  }
  const order = Object.keys(groups).sort((a, b) =>
    a === "ROT" ? -1 : b === "ROT" ? 1 : a.localeCompare(b, "sv")
  );
  for (const k of order) groups[k].sort((a, b) => a.localeCompare(b, "sv"));
  return { order, groups };
}

/* lätt, SÄKER highlight — bygger React-element, aldrig innerHTML */
function renderLine(line: string, i: number) {
  if (/^#{1,6}\s/.test(line)) {
    return (
      <div key={i}>
        <span className="h">{line}</span>
      </div>
    );
  }
  if (/^\s*(\/\/|<!--|\/\*|\*)/.test(line)) {
    return (
      <div key={i}>
        <span className="c">{line || " "}</span>
      </div>
    );
  }
  // key:: value (spec-taggning) eller key: "value" (ts-config)
  const m = line.match(/^(\s*[\wåäöÅÄÖ.-]+::?\s+)(.+)$/);
  if (m) {
    return (
      <div key={i}>
        <span className="k">{m[1]}</span>
        <span className="v">{m[2]}</span>
      </div>
    );
  }
  return <div key={i}>{line || " "}</div>;
}

function StateBox({ err, title, children }: { err?: boolean; title: string; children: React.ReactNode }) {
  return (
    <div className={err ? "state err" : "state"}>
      <div className="st-title">{title}</div>
      {children}
    </div>
  );
}

export default function DocPanel() {
  const [repos, setRepos] = useState<Envelope<SourceRepo[]> | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [tree, setTree] = useState<Envelope<TreeEntry[]> | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [file, setFile] = useState<Envelope<FileContent> | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const reqSeq = useRef(0);

  // 1. hämta repo-listan en gång
  useEffect(() => {
    let live = true;
    getJSON<SourceRepo[]>("/api/repos").then((res) => {
      if (!live) return;
      setRepos(res);
      if (res.ok && res.data.length) {
        const preferred = res.data.find((r) => r.kind === "workflow") ?? res.data[0];
        setSelectedRepo(preferred.name);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  // 2. hämta trädet när repo byts
  useEffect(() => {
    if (!selectedRepo) return;
    const seq = ++reqSeq.current;
    setTreeLoading(true);
    setSelectedPath("");
    setFile(null);
    getJSON<TreeEntry[]>(`/api/tree?repo=${encodeURIComponent(selectedRepo)}`).then((res) => {
      if (seq !== reqSeq.current) return; // ignorera inaktuellt svar
      setTree(res);
      setTreeLoading(false);
    });
  }, [selectedRepo]);

  // 3. hämta filinnehåll vid klick
  const openFile = useCallback(
    (path: string) => {
      setSelectedPath(path);
      setFileLoading(true);
      const url = `/api/file?repo=${encodeURIComponent(selectedRepo)}&path=${encodeURIComponent(path)}`;
      getJSON<FileContent>(url).then((res) => {
        setFile(res);
        setFileLoading(false);
      });
    },
    [selectedRepo]
  );

  const grouped = useMemo(
    () => (tree && tree.ok ? groupTree(tree.data) : null),
    [tree]
  );

  return (
    <div className="panel">
      <h2>
        <span className="idx">◆</span> Dokumentation{" "}
        <span className="hint">— bläddra det som produceras (läs-only)</span>
      </h2>

      {/* repo-väljare */}
      {repos?.ok && repos.data.length > 0 && (
        <div className="repo-select" style={{ marginBottom: 14 }}>
          <label htmlFor="repo">Repo</label>
          <select
            id="repo"
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
          >
            {repos.data.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name} {r.kind === "workflow" ? "· workflow" : "· kund"}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* graceful-lägen för repo-listan */}
      {!repos && <div className="skeleton" style={{ height: 120 }} />}
      {repos && !repos.ok && (
        <StateBox err title={repos.reason === "no-config" ? "Ej konfigurerad" : "Kunde inte läsa"}>
          {repos.message}
          <div className="st-hint">
            Sätt GITHUB_TOKEN_READ + WORKFLOW_REPO i Railway så tänds panelen.
          </div>
        </StateBox>
      )}
      {repos?.ok && repos.data.length === 0 && (
        <StateBox title="Inga repon än">
          Varken Workflow-repo eller kund-repon är åtkomliga med nuvarande token.
        </StateBox>
      )}

      {/* filträd + innehåll */}
      {repos?.ok && repos.data.length > 0 && (
        <div className="doc-layout">
          <div className="doc-tree">
            {treeLoading && <div className="skeleton" style={{ height: 200 }} />}
            {!treeLoading && tree && !tree.ok && (
              <div className="state err" style={{ padding: "14px 12px" }}>
                <div className="st-title">Fel</div>
                {tree.message}
              </div>
            )}
            {!treeLoading &&
              grouped &&
              grouped.order.map((group) => (
                <div key={group}>
                  <div className="tree-group">{group}</div>
                  {grouped.groups[group].map((path) => {
                    const name = path.includes("/") ? path.slice(path.indexOf("/") + 1) : path;
                    return (
                      <button
                        key={path}
                        className={`doc-file${selectedPath === path ? " sel" : ""}`}
                        onClick={() => openFile(path)}
                        title={path}
                      >
                        <span className="fi" />
                        <span className="fname">{name}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
          </div>

          <div className="doc-content">
            {fileLoading && <span className="dl c">hämtar…</span>}
            {!fileLoading && !file && <span className="dl c">välj en fil…</span>}
            {!fileLoading && file && !file.ok && (
              <span className="dl c">Kunde inte läsa filen: {file.message}</span>
            )}
            {!fileLoading && file && file.ok && (
              <div className="dl">{file.data.text.split("\n").map(renderLine)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
