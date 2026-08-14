/**
 * V10 · SÄKERHETSHÄRDNING — statisk mätning, inte prosa.
 *
 * Provar exit-kriterierna i docs/nortropic-control-room-plan-v1.md §V10 och TEST_MATRIX
 * A4/A6, C10, X1–X3, X6–X7:
 *   (1) Klientbundlen bär noll hemligheter — mätt över .next/static: noll värdeformer, noll
 *       credentialnamn MED ett värde bredvid sig, noll klientexponerad env, och noll
 *       credentialspår alls i Maskinens egna chunkar. Ett ensamt NAMN i en operatörsanvisning
 *       ("Sätt X i Railway så tänds panelen") är prosa, inte en nyckel; provet kräver att varje
 *       sådant namn har en känd prosakälla i repots egen klientkod. Se BundleHit i
 *       tests/loop/security.ts för varför skillnaden görs i stället för att undantas.
 *   (2) Noll NEXT_PUBLIC_*-variabler i repot (kommentarer räknas inte).
 *   (3) Oinloggad når ingen /loop- eller /api/loop-route: matchern täcker båda OCH varje
 *       handler gatar själv (djupförsvar).
 *   (4) Ingen serverloggning och inga payloadvärden i loop-trädet.
 *   (5) middleware-matchern byte-identisk med den vid PLAN_BASE_SHA.
 *   (6) NOLL import av lib/github-read.ts eller lib/github-write.ts under app/api/loop/**
 *       och lib/loop/** — även TRANSITIVT.
 *   (7) NOLL kodvägar där som rör lease, brytare, Git-refs, dom, attestation eller promotion.
 *
 * PROVSTIL (samma som V1–V9): varje kriterium bär LÖGNSTUBBAR med EN lögn var, och en
 * fällningskarta skriven FÖRE körning. En mätare som bara mäter den gröna verkligheten
 * bevisar inte att den kan skilja rätt från fel — därför mäts också NEGATIVA KONTROLLER:
 * legitim vokabulär (kommentarer, svenska etiketter, `TaskView.promotion.state`,
 * `sameOriginVerdict`) får ALDRIG fällas, annars är mätaren värdelös i praktiken.
 *
 * ÄRLIGHET OM RÄCKVIDD: det här provet mäter REPOTS KÄLLA och byggets klientutdata. Det säger
 * ingenting om Railway-miljöns faktiska variabler (X4 är ett ägaransvar utanför repot) och det
 * är varken en trust-anchor eller en säkerhetsgräns för Nortropics kontrollplan.
 * En omätt mätning (t.ex. saknad .next/static) rapporteras som NOT_RUN och FÄLLER provet —
 * NOT_RUN är aldrig PASS.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BROAD_RULES,
  CLIENT_ENV_PREFIX,
  CLIENT_FORBIDDEN_SECRET_NAMES,
  MIDDLEWARE_MATCHER_AT_PLAN_BASE,
  MIDDLEWARE_MATCHER_EXCEPTIONS,
  PLAN_BASE_SHA,
  REACHABLE_RULES,
  SECURITY_FACTS,
  checkMiddlewareMatcher,
  checkNextConfig,
  checkRouteGate,
  hardBundleHits,
  importSpecifiers,
  isGithubCredentialModule,
  isLocalSpecifier,
  partitionSource,
  resolveLocalSpecifier,
  scanBundleChunk,
  scanSourceFile,
  type Finding,
  type RuleId,
  type SourceFile,
} from "./security";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const LOOP_TREE = ["app/api/loop", "lib/loop", "components/loop"] as const;
const ROUTE_DIR = "app/api/loop";
const SOURCE_EXT = new Set([".ts", ".tsx"]);

/* ── läsning (all IO ligger här; lib/loop/security.ts är ren) ─────────────── */

function readRepoFile(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, relative), "utf8");
}

function walk(relativeDir: string, keep: (file: string) => boolean): string[] {
  const absolute = path.join(REPO_ROOT, relativeDir);
  if (!existsSync(absolute)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(absolute)) {
    const relative = `${relativeDir}/${entry}`;
    const stats = statSync(path.join(REPO_ROOT, relative));
    if (stats.isDirectory()) out.push(...walk(relative, keep));
    else if (keep(relative)) out.push(relative);
  }
  return out.sort();
}

function loopSourceFiles(): SourceFile[] {
  const files: string[] = [];
  for (const dir of LOOP_TREE) files.push(...walk(dir, (f) => SOURCE_EXT.has(path.extname(f))));
  return files.map((relative) => ({ path: relative, source: readRepoFile(relative) }));
}

function routeFiles(): SourceFile[] {
  return walk(ROUTE_DIR, (f) => f.endsWith("/route.ts")).map((relative) => ({
    path: relative,
    source: readRepoFile(relative),
  }));
}

/**
 * Transitiv modulstängning från givna ingångar, begränsad till repots EGNA filer.
 * Externa paket (next, zod, next-auth, @supabase/*) stannar som löv: de kan inte importera
 * repots lib/github-*.ts, och deras innehåll är inte den här skivans mätobjekt.
 */
function localClosure(entries: string[]): string[] {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    if (!current.endsWith(".ts") && !current.endsWith(".tsx")) continue;
    const source = readRepoFile(current);
    for (const ref of importSpecifiers(source)) {
      if (!isLocalSpecifier(ref.specifier)) continue;
      const resolved = resolveLocalSpecifier(current, ref.specifier).find((candidate) =>
        existsSync(path.join(REPO_ROOT, candidate)),
      );
      if (resolved !== undefined && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return [...seen].sort();
}

function inLoopTree(relative: string): boolean {
  return LOOP_TREE.some((dir) => relative.startsWith(`${dir}/`));
}

function describe(findings: Finding[]): string {
  return findings.map((f) => `${f.path}:${f.line} ${f.rule} «${f.evidence}» — ${f.why}`).join("\n");
}

/* ────────────────────────────────────────────────────────────────────────────
 * (5) + A4 · MIDDLEWARE-MATCHERN
 * ──────────────────────────────────────────────────────────────────────────── */

test("V10/A4 · middleware-matchern är byte-identisk med den vid PLAN_BASE_SHA", () => {
  const source = readRepoFile("middleware.ts");
  const verdict = checkMiddlewareMatcher(source);
  assert.deepEqual(verdict, { ok: true }, `matchern har ändrats: ${JSON.stringify(verdict)}`);

  // Byte för byte, inte "ser lika ut".
  const matchers = /matcher:\s*\[([\s\S]*?)\]/.exec(source);
  assert.ok(matchers !== null, "middleware.ts saknar matcher-block");
  assert.equal(
    JSON.parse(matchers[1].trim().replace(/,$/, "")),
    MIDDLEWARE_MATCHER_AT_PLAN_BASE,
  );

  // Undantagslistan EXAKT enligt AUTH_SECURITY — varken fler eller färre.
  const exceptions = MIDDLEWARE_MATCHER_AT_PLAN_BASE.match(/\(\?!([^)]*)\)/);
  assert.ok(exceptions !== null);
  assert.deepEqual(exceptions[1].split("|"), [...MIDDLEWARE_MATCHER_EXCEPTIONS]);
});

test("V10/A4 · matchern jämförs mot GIT-objektet vid PLAN_BASE_SHA, inte mot minnet", () => {
  let baseSource: string;
  try {
    baseSource = execFileSync("git", ["show", `${PLAN_BASE_SHA}:middleware.ts`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    // Git-objektet kan saknas i en grund klon. Då är detta prov OMÄTT — och OMÄTT är inte
    // godkänt: konstanten ovan bär mätningen, och den här raden ska synas som ett hål.
    assert.fail(
      `NOT_RUN: kunde inte läsa ${PLAN_BASE_SHA}:middleware.ts ur git. ` +
        "Kör provet i en full klon; en omätt jämförelse får aldrig räknas som grön.",
    );
    return;
  }
  const base = checkMiddlewareMatcher(baseSource);
  assert.deepEqual(base, { ok: true }, "PLAN_BASE_SHA-matchern matchar inte konstanten");
  assert.equal(readRepoFile("middleware.ts"), baseSource, "middleware.ts har ändrats sedan basen");
});

test("V10 · matcher-lögnstubbar fälls, en lögn var (fällningskarta skriven före körning)", () => {
  const wrap = (matcher: string) => `export const config = { matcher: [${JSON.stringify(matcher)}] };`;
  const map: { name: string; source: string; reason: string }[] = [
    {
      name: "api/loop tillagd som undantag",
      source: wrap("/((?!api/auth|api/loop|api/leads/worker|_next/static|_next/image|favicon.ico|nortropic-logo.png).*)"),
      reason: "LOOP_UNDANTAGEN",
    },
    {
      name: "ett undantag borttaget",
      source: wrap("/((?!api/auth|_next/static|_next/image|favicon.ico|nortropic-logo.png).*)"),
      reason: "ANDRAD_MATCHER",
    },
    {
      name: "extra matcher tillagd",
      source: `export const config = { matcher: [${JSON.stringify(MIDDLEWARE_MATCHER_AT_PLAN_BASE)}, "/extra"] };`,
      reason: "SAKNAD_MATCHER",
    },
    { name: "matcher borttagen helt", source: "export const config = {};", reason: "SAKNAD_MATCHER" },
  ];
  for (const stub of map) {
    const verdict = checkMiddlewareMatcher(stub.source);
    assert.equal(verdict.ok, false, `stub «${stub.name}» släpptes igenom`);
    assert.equal(verdict.ok === false ? verdict.reason : "", stub.reason, stub.name);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * (3) · OINLOGGAD NÅR VARKEN /loop ELLER /api/loop
 * ──────────────────────────────────────────────────────────────────────────── */

test("V10 · matchern TÄCKER /loop och /api/loop (middleware körs → redirect till /login)", () => {
  const matcher = new RegExp(`^${MIDDLEWARE_MATCHER_AT_PLAN_BASE}$`);
  for (const gated of [
    "/loop",
    "/loop/mata",
    "/api/loop/snapshot",
    "/api/loop/events",
    "/api/loop/stream",
    "/api/loop/task",
    "/api/loop/command",
    "/api/loop/intake",
  ]) {
    assert.ok(matcher.test(gated), `${gated} gatas inte av middleware`);
  }
  for (const exempt of [
    "/api/auth/session",
    "/api/leads/worker",
    "/_next/static/chunks/main.js",
    "/favicon.ico",
    "/nortropic-logo.png",
  ]) {
    assert.equal(matcher.test(exempt), false, `${exempt} skulle vara undantagen`);
  }
});

test("V10/A6 · DJUPFÖRSVAR: varje /api/loop-handler gatar auth() själv, före varje effekt", () => {
  const routes = routeFiles();
  assert.ok(routes.length >= 5, `förväntade minst 5 route-filer, fann ${routes.length}`);
  for (const route of routes) {
    assert.deepEqual(checkRouteGate(route), [], `${route.path}: djupförsvaret brister`);
  }
});

test("V10/A6 · djupförsvars-lögnstubbar fälls, en lögn var", () => {
  const stubs: { name: string; source: string; rule: string }[] = [
    {
      name: "handler utan auth()",
      source: `export async function GET() { return NextResponse.json(await loadSnapshot({})); }`,
      rule: "SAKNAD_AUTH",
    },
    {
      name: "auth() men ingen 401-väg",
      source: `export async function GET() { const s = await auth(); if (!s) return NextResponse.json({}, { status: 200 }); return NextResponse.json({}); }`,
      rule: "SAKNAD_401",
    },
    {
      name: "transportläsning före auth()",
      source: `export async function GET() { const snap = await loadSnapshot({}); const s = await auth(); if (!s) return NextResponse.json({}, { status: 401 }); return NextResponse.json(snap); }`,
      rule: "EFFEKT_FORE_AUTH",
    },
    {
      name: "kroppen läses före auth()",
      source: `export async function POST(request: Request) { const body = await request.json(); const s = await auth(); if (!s) return NextResponse.json({}, { status: 401 }); return NextResponse.json(body); }`,
      rule: "EFFEKT_FORE_AUTH",
    },
    { name: "ingen handler alls", source: `export const runtime = "nodejs";`, rule: "INGEN_HANDLER" },
  ];
  for (const stub of stubs) {
    const findings = checkRouteGate({ path: `stub/${stub.name}/route.ts`, source: stub.source });
    assert.ok(findings.length > 0, `stub «${stub.name}» släpptes igenom`);
    assert.ok(
      findings.some((f) => f.rule === stub.rule),
      `stub «${stub.name}» fälldes av fel regel: ${JSON.stringify(findings)}`,
    );
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * (6) + X6 · INGEN GITHUB-CREDENTIAL NÅS FRÅN NÅGON LOOP-VÄG
 * ──────────────────────────────────────────────────────────────────────────── */

test("V10/X6 · noll DIREKTA importer av lib/github-read.ts eller lib/github-write.ts", () => {
  const files = loopSourceFiles();
  assert.ok(files.length >= 15, `förväntade hela loop-trädet, fann ${files.length} filer`);
  const findings = files.flatMap((file) => scanSourceFile(file, BROAD_RULES));
  assert.deepEqual(findings, [], `GitHub-credential importerad:\n${describe(findings)}`);
});

test("V10/X6 · noll TRANSITIVA vägar till github-read/github-write från loop-trädet", () => {
  const entries = loopSourceFiles().map((file) => file.path);
  const closure = localClosure(entries);
  const credentialModules = closure.filter((file) =>
    isGithubCredentialModule(file.replace(/\.(ts|tsx)$/, "")),
  );
  assert.deepEqual(
    credentialModules,
    [],
    `credential-modul nådd transitivt via:\n${credentialModules.join("\n")}`,
  );
  // Stängningen ska vara VERKLIG, inte tom av misstag (annars mäter provet ingenting).
  assert.ok(
    closure.length > entries.length,
    `stängningen (${closure.length}) följde inga importer utanför trädet — mätaren är trasig`,
  );
  assert.ok(closure.includes("auth.ts"), "stängningen nådde inte ens auth.ts");
  assert.equal(SECURITY_FACTS.MASKINEN_GITHUB_CREDENTIAL, "NONE");
});

test("V10/X6 · specifikatorprovet känner igen credential-modulen i alla former", () => {
  for (const specifier of [
    "@/lib/github-read",
    "@/lib/github-write",
    "../github-write",
    "../../lib/github-read.ts",
    "./github-write.js",
  ]) {
    assert.equal(isGithubCredentialModule(specifier), true, specifier);
  }
  // NEGATIV KONTROLL: ord som bara LIKNAR credential-modulen får inte fällas.
  for (const specifier of ["@/lib/github-readme-docs", "./github-read-model", "@/lib/loop/schema"]) {
    assert.equal(isGithubCredentialModule(specifier), false, specifier);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * (7) + C10/X7 · INGA KONTROLLPLANS-, SHELL-, GIT- ELLER FILEFFEKTER
 * ──────────────────────────────────────────────────────────────────────────── */

test("V10/X7 · noll kontrollplans-, shell-, Git- eller filskrivningsvägar i loop-trädet", () => {
  const findings = loopSourceFiles()
    // Fixturgeneratorn är ett BYGGVERKTYG, aldrig request-nådd (den importeras av inget under
    // app/api/loop/**). Den mäts därför med de breda reglerna, inte med request-reglerna.
    .filter((file) => file.path !== "lib/loop/fixtures/generate.ts")
    .flatMap((file) => scanSourceFile(file, REACHABLE_RULES));
  assert.deepEqual(findings, [], `förbjuden kodväg i loop-trädet:\n${describe(findings)}`);
});

test("V10/X7 · fixturgeneratorn är inte nådd från någon request-väg", () => {
  const closure = localClosure(routeFiles().map((file) => file.path));
  assert.equal(
    closure.includes("lib/loop/fixtures/generate.ts"),
    false,
    "byggverktyget nås från en route — då gäller request-reglerna även där",
  );
  const findings = closure
    .filter((file) => inLoopTree(file))
    .map((file) => ({ path: file, source: readRepoFile(file) }))
    .flatMap((file) => scanSourceFile(file, REACHABLE_RULES));
  assert.deepEqual(findings, [], `förbjuden kodväg i request-stängningen:\n${describe(findings)}`);
});

test("V10/X7 · effekt-lögnstubbar fälls, EN lögn var (fällningskarta före körning)", () => {
  const stubs: { name: string; source: string; rule: RuleId }[] = [
    {
      name: "shell i kommandorutten",
      source: `import { execSync } from "node:child_process";\nexport function run(cmd: string) { return execSync(cmd); }`,
      rule: "SHELL_EXECUTION",
    },
    {
      name: "filskrivning i en loop-väg",
      source: `export function persist(x: string) { writeFileSync("/tmp/x", x); }`,
      rule: "FILESYSTEM_WRITE",
    },
    {
      name: "Git-ref i en sträng",
      source: `export const REF = "refs/heads/main";`,
      rule: "GIT_SURFACE",
    },
    {
      name: "GitHub-endpoint",
      source: `export const URL_ = "https://api.github.com/repos/x/y/git/refs";`,
      rule: "GIT_SURFACE",
    },
    {
      name: "octokit-import",
      source: `import { Octokit } from "@octokit/rest";\nexport const o = new Octokit();`,
      rule: "GIT_SURFACE",
    },
    {
      name: "credential-import",
      source: `import { readFile } from "@/lib/github-write";\nexport const r = readFile;`,
      rule: "GITHUB_CREDENTIAL_IMPORT",
    },
    {
      name: "promotion-verb",
      source: `export async function go(id: string) { await promoteToMain(id); }`,
      rule: "CONTROL_PLANE_EFFECT",
    },
    {
      name: "lease-mutation",
      source: `export function take(id: string) { return acquireLease(id); }`,
      rule: "CONTROL_PLANE_EFFECT",
    },
    {
      name: "dom skriven i UI-lagret",
      source: `export function fake(t: string) { return writeVerdict(t, "PASS"); }`,
      rule: "CONTROL_PLANE_EFFECT",
    },
    {
      name: "dom SATT i UI-lagret",
      source: `export function fake(t: string) { return setVerdict(t, "PASS"); }`,
      rule: "CONTROL_PLANE_EFFECT",
    },
    {
      name: "brytare rörd",
      source: `export function stop() { return tripBreaker("manual"); }`,
      rule: "CONTROL_PLANE_EFFECT",
    },
    {
      name: "attestation skriven",
      source: `export function seal(t: string) { return signAttestation(t); }`,
      rule: "CONTROL_PLANE_EFFECT",
    },
    {
      name: "serverloggning av payload",
      source: `export function log(payload: unknown) { console.log("kommando", payload); }`,
      rule: "SERVER_LOGGING",
    },
    {
      name: "credential läst ur miljön",
      source: `export const token = process.env.GITHUB_TOKEN_WRITE;`,
      rule: "SECRET_ENV_REFERENCE",
    },
    {
      name: "klientexponerad variabel",
      source: `export const url = process.env.${CLIENT_ENV_PREFIX}LOOP_URL;`,
      rule: "CLIENT_ENV_REFERENCE",
    },
    {
      name: "effekt gömd i en template-interpolation",
      source: "export const s = `ref ${updateRef(\"main\")} klar`;",
      rule: "CONTROL_PLANE_EFFECT",
    },
    {
      name: "Git-kommando gömt i en template-litteral",
      source: "export const cmd = `git push origin main`;",
      rule: "GIT_SURFACE",
    },
  ];

  for (const stub of stubs) {
    const findings = scanSourceFile({ path: `stub/${stub.name}.ts`, source: stub.source });
    assert.ok(findings.length > 0, `stub «${stub.name}» släpptes igenom`);
    assert.ok(
      findings.some((f) => f.rule === stub.rule),
      `stub «${stub.name}» fälldes av fel regel: ${JSON.stringify(findings)}`,
    );
  }
});

test("V10/X7 · NEGATIV KONTROLL: legitim vokabulär fälls aldrig", () => {
  const benign: { name: string; source: string }[] = [
    {
      name: "kommentar som beskriver vad koden ALDRIG gör",
      source: `// Ingen promotion, ingen attestation, ingen lease-beröring, inget git push, refs/heads/main.\n/* console.log("hemlighet") och process.env.GITHUB_TOKEN_WRITE nämns bara i prosa */\nexport const ok = true;`,
    },
    {
      name: "läsmodellens projektion",
      source: `export function state(task: { promotion: { state: string | null } }) { return task.promotion.state ?? "—"; }`,
    },
    {
      name: "svenska etiketter för controllerns event",
      source: `export const LABELS = { "promotion.started": "Promotion inledd", "attestation.created": "Attestation skriven", "breaker.opened": "Brytare öppnad" } as const;`,
    },
    {
      name: "grindens interna dom-typ",
      source: `export type GateVerdict = { ok: true } | { ok: false; message: string };\nexport function sameOriginVerdict(h: Headers): GateVerdict { return h.get("origin") === null ? { ok: false, message: "—" } : { ok: true }; }`,
    },
    {
      name: "regexens .exec() är ingen shell-exekvering",
      source: `const RE = /^task-[0-9]+$/;\nexport function ok(id: string) { return RE.exec(id) !== null; }`,
    },
    {
      name: "opak vidarerendering av brytarkartan",
      source: `export function breakerMap(run: { breaker: Record<string, unknown> | null }) { return run.breaker ?? null; }`,
    },
    {
      name: "vattenmärke LÄST ur snapshot",
      source: `export function readWatermark(s: { seq_watermark: number } | null) { return s === null ? null : s.seq_watermark; }`,
    },
    {
      name: "läsmodellens LOKALA vattenmärkeskopia (setWatermark) är ingen kontrollplanseffekt",
      source: `export function reduce(store: { setWatermark: (n: number | null) => void }, n: number | null) { store.setWatermark(n); }`,
    },
  ];
  for (const stub of benign) {
    const findings = scanSourceFile({ path: `benign/${stub.name}.ts`, source: stub.source });
    assert.deepEqual(findings, [], `NEGATIV KONTROLL «${stub.name}» fälldes felaktigt:\n${describe(findings)}`);
  }
});

test("V10 · partitionen skiljer kod, sträng och kommentar (mätarens fundament)", () => {
  const source = [
    '// promoteToMain("a")',
    '/* execSync("rm -rf /") */',
    'const label = "Promotion inledd";',
    "const cmd = `git push ${target}`;",
    "const real = promoteToMain(taskId);",
  ].join("\n");
  const { code, strings, comments } = partitionSource(source);
  assert.equal(code.includes("promoteToMain(taskId)"), true, "kod tappades bort");
  assert.equal(code.split("\n")[0].trim(), "", "kommentar läckte in i koden");
  assert.equal(code.includes("Promotion inledd"), false, "stränginnehåll läckte in i koden");
  assert.equal(code.includes("target"), true, "template-interpolation räknades inte som kod");
  assert.deepEqual(
    strings.map((s) => s.value),
    ["Promotion inledd", "git push ", ""],
  );
  assert.equal(comments.length, 2);
  // Radnumren ska överleva utraderingen — annars pekar fynden på fel rad.
  assert.equal(code.split("\n").length, source.split("\n").length);
});

/* ────────────────────────────────────────────────────────────────────────────
 * (2) + X2 · NOLL KLIENTEXPONERADE ENV-VARIABLER I REPOT
 * ──────────────────────────────────────────────────────────────────────────── */

/** Repots egen källa (inte node_modules, inte byggutdata). */
function repoSourceFiles(): string[] {
  const scanned = ["app", "lib", "components", "tests", "scripts", "tools", "db", "content"];
  return [
    ...scanned.flatMap((dir) =>
      walk(dir, (f) => [".ts", ".tsx", ".js", ".mjs", ".cjs"].includes(path.extname(f))),
    ),
    "middleware.ts",
    "next.config.ts",
    "auth.ts",
    "auth.config.ts",
  ].filter((f) => existsSync(path.join(REPO_ROOT, f)));
}

test("V10/X2 · noll klientexponerade env-referenser i kod (kommentarer räknas inte)", () => {
  const files = repoSourceFiles();
  assert.ok(files.length > 50, `förväntade hela repots källa, fann ${files.length} filer`);

  // INGEN UNDANTAGSLISTA. Mätaren bär inte mönstret som literal (se CLIENT_ENV_PREFIX), så
  // kravet kan mätas rakt över hela källan utan att undanta sig själv.
  const hits: string[] = [];
  for (const relative of files) {
    const { code, strings } = partitionSource(readRepoFile(relative));
    if (code.includes(CLIENT_ENV_PREFIX)) hits.push(`${relative} (kod)`);
    for (const span of strings) {
      if (span.value.includes(CLIENT_ENV_PREFIX)) hits.push(`${relative}:${span.line} (sträng)`);
    }
  }
  assert.deepEqual(hits, [], `klientexponerad env funnen:\n${hits.join("\n")}`);

  // package.json är ingen TS-fil men kan bära variabeln i ett skript.
  assert.equal(readRepoFile("package.json").includes(CLIENT_ENV_PREFIX), false);
});

test("V10/X2 · varje RÅ förekomst i repot ligger i en kommentar, inte i en kodväg", () => {
  const raw: string[] = [];
  for (const relative of repoSourceFiles()) {
    const source = readRepoFile(relative);
    if (!source.includes(CLIENT_ENV_PREFIX)) continue;
    const { comments } = partitionSource(source);
    const occurrences = (text: string) => text.split(CLIENT_ENV_PREFIX).length - 1;
    const inComments = comments.reduce((sum, c) => sum + occurrences(c.value), 0);
    const total = occurrences(source);
    raw.push(`${relative}: ${total} förekomst(er), ${inComments} i kommentar`);
    assert.equal(
      total,
      inComments,
      `${relative}: förekomst utanför kommentar — kommentarer räknas inte som kodväg, men detta är en`,
    );
  }
  // Mätningen ska vara VERKLIG: repot har (vid PLAN_BASE_SHA och nu) exakt en prosaträff,
  // kommentaren i lib/places.ts om att nyckeln aldrig får nå klienten.
  assert.ok(
    raw.some((row) => row.startsWith("lib/places.ts:")),
    `förväntade prosaträffen i lib/places.ts; fann:\n${raw.join("\n")}`,
  );
});

test("V10/X2 · mätaren fäller en klientexponerad referens men INTE en kommentar om den", () => {
  const inCode = partitionSource(`export const u = process.env.${CLIENT_ENV_PREFIX}API;`);
  assert.equal(inCode.code.includes(CLIENT_ENV_PREFIX), true);
  const inComment = partitionSource(
    `// får ALDRIG nå klienten / ${CLIENT_ENV_PREFIX}.\nexport const ok = true;`,
  );
  assert.equal(inComment.code.includes(CLIENT_ENV_PREFIX), false);
  assert.equal(CLIENT_ENV_PREFIX, ["NEXT", "PUBLIC", ""].join("_"));
});

/* ────────────────────────────────────────────────────────────────────────────
 * (1) + X1 · KLIENTBUNDLEN
 * ──────────────────────────────────────────────────────────────────────────── */

/** Bundle-chunkarna, eller NOT_RUN om bygget inte körts. */
function bundleChunks(): string[] {
  const staticDir = path.join(REPO_ROOT, ".next", "static");
  if (!existsSync(staticDir)) {
    assert.fail(
      "NOT_RUN: .next/static saknas — bundle-mätningen kunde inte köras. Kör `npm run build` " +
        "före `npm run loop:test` (planens grindordning). En omätt bundle är aldrig godkänd.",
    );
  }
  const chunks = walk(".next/static", (f) =>
    [".js", ".mjs", ".map", ".json", ".css"].includes(path.extname(f)),
  );
  assert.ok(chunks.length > 0, "NOT_RUN: .next/static innehöll inga chunkar att mäta");
  return chunks;
}

/** Är filen en klientkomponent? Direktivet står först, men kan föregås av kommentarer. */
function isClientComponent(source: string): boolean {
  return /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(source);
}

/**
 * Namn som repots EGEN klientkod nämner som operatörsanvisning (prosa, aldrig värde).
 * Listan HÄRLEDS ur källan — den skrivs aldrig för hand, för då vore den en undantagslista
 * som tyst kunde växa. Server-only-moduler (t.ex. lib/github-read.ts) räknas ALDRIG som
 * förklaring: de får inte vara i klientbundlen till att börja med.
 */
function proseNamesInClientSource(): Set<string> {
  const prose = new Set<string>();
  const sources = [
    ...walk("app", (f) => SOURCE_EXT.has(path.extname(f))),
    ...walk("components", (f) => SOURCE_EXT.has(path.extname(f))),
  ];
  for (const relative of sources) {
    const source = readRepoFile(relative);
    if (!isClientComponent(source)) continue;
    for (const name of CLIENT_FORBIDDEN_SECRET_NAMES) {
      if (source.includes(name)) prose.add(name);
    }
  }
  return prose;
}

test("V10/X1 · klientbundlen bär NOLL hemliga VÄRDEN och noll klientexponerad env", () => {
  const hits = bundleChunks().flatMap((relative) =>
    scanBundleChunk(relative, readRepoFile(relative)),
  );
  const hard = hardBundleHits(hits);
  assert.deepEqual(
    hard,
    [],
    `hemlighet i klientbundlen:\n${hard.map((h) => `${h.file}: ${h.needle} (${h.kind})`).join("\n")}`,
  );
});

test("V10/X1 · varje kvarvarande NAMN i bundlen har en känd prosakälla i repots klientkod", () => {
  const bare = bundleChunks()
    .flatMap((relative) => scanBundleChunk(relative, readRepoFile(relative)))
    .filter((hit) => hit.kind === "namn");
  const prose = proseNamesInClientSource();
  const unexplained = bare.filter((hit) => !prose.has(hit.needle));
  assert.deepEqual(
    unexplained,
    [],
    "namn i bundlen utan prosakälla i klientkoden — det är inte en anvisning, det är ett läckage:\n" +
      unexplained.map((h) => `${h.file}: ${h.needle}`).join("\n"),
  );
  // Och prosan får aldrig ha ett värde bredvid sig i källan.
  for (const name of prose) {
    for (const relative of walk("components", (f) => SOURCE_EXT.has(path.extname(f)))) {
      const source = readRepoFile(relative);
      if (!source.includes(name)) continue;
      assert.equal(
        new RegExp(`${name}["'\`]?\\s*[:=]\\s*["'\`][^"'\`\\n]{8,}["'\`]`).test(source),
        false,
        `${relative}: ${name} står med ett värde bredvid sig`,
      );
    }
  }
});

test("V10/X1 · Maskinens EGNA chunkar bär inte ens ett credentialnamn", () => {
  const loopChunks = bundleChunks().filter((chunk) => /loop/i.test(chunk));
  const hits = loopChunks.flatMap((relative) => scanBundleChunk(relative, readRepoFile(relative)));
  assert.deepEqual(
    hits,
    [],
    `credentialspår i Maskinens chunkar:\n${hits.map((h) => `${h.file}: ${h.needle} (${h.kind})`).join("\n")}`,
  );
});

test("V10/X1 · bundle-mätaren fäller en nyckel som faktiskt bakats in (namn MED värde)", () => {
  for (const name of CLIENT_FORBIDDEN_SECRET_NAMES) {
    const baked = scanBundleChunk("chunk.js", `var a={${name}:"sb_secret_0123456789abcdef"};`);
    assert.ok(
      hardBundleHits(baked).some((hit) => hit.needle === name && hit.kind === "namn+värde"),
      `${name} med inbakat värde upptäcktes inte: ${JSON.stringify(baked)}`,
    );
    // …men NAMNET ensamt är en anvisning, inte en hemlighet, och klassas som mjukt fynd.
    const prose = scanBundleChunk("chunk.js", `"Sätt ${name} i Railway så tänds panelen."`);
    assert.deepEqual(hardBundleHits(prose), [], `${name} i prosa klassades som läckage`);
    assert.deepEqual(
      prose.map((hit) => hit.kind),
      ["namn"],
    );
  }
  const shapes = [
    'var t="ghp_0123456789abcdefghijklmnopqrstuvwx";',
    'var t="github_pat_11ABCDEFG0123456789_abcdefghijklmnop";',
    'var k="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.sig";',
    'var p="-----BEGIN RSA PRIVATE KEY-----";',
    `var u=process.env.${CLIENT_ENV_PREFIX}X;`,
  ];
  for (const chunk of shapes) {
    assert.ok(hardBundleHits(scanBundleChunk("chunk.js", chunk)).length > 0, `missad: ${chunk}`);
  }
  // NEGATIV KONTROLL: vanlig bundle-text får inte fällas.
  assert.deepEqual(scanBundleChunk("chunk.js", 'var s="Maskinen";var t="promotion.started";'), []);
});

/* ────────────────────────────────────────────────────────────────────────────
 * next.config.ts · den enda vägen som kan baka in ett serverhemligt värde
 * ──────────────────────────────────────────────────────────────────────────── */

test("V10 · next.config.ts exponerar ingen env mot klienten", () => {
  const findings = checkNextConfig(readRepoFile("next.config.ts"));
  assert.deepEqual(findings, [], `next.config.ts läcker:\n${JSON.stringify(findings, null, 2)}`);
  // Härdningen ska vara UTTALAD i konfigurationen, inte bara en default som kan glida.
  assert.match(readRepoFile("next.config.ts"), /productionBrowserSourceMaps:\s*false/);
});

test("V10 · next.config-lögnstubbar fälls, en lögn var", () => {
  const stubs: { name: string; source: string; rule: string }[] = [
    {
      name: "env-blocket bakar in en nyckel",
      source: `const c = { env: { LOOP_SUPABASE_KEY: process.env.LOOP_SUPABASE_KEY } };\nexport default c;`,
      rule: "NEXT_CONFIG_ENV_BLOCK",
    },
    {
      name: "publicRuntimeConfig",
      source: `const c = { publicRuntimeConfig: { token: "x" } };\nexport default c;`,
      rule: "NEXT_CONFIG_PUBLIC_RUNTIME",
    },
    {
      name: "källkartor påslagna",
      source: `const c = { productionBrowserSourceMaps: true };\nexport default c;`,
      rule: "NEXT_CONFIG_SOURCE_MAPS",
    },
    {
      name: "klientexponerad env i konfigurationen",
      source: `const c = { serverExternalPackages: [process.env.${CLIENT_ENV_PREFIX}X ?? ""] };\nexport default c;`,
      rule: "NEXT_CONFIG_CLIENT_ENV",
    },
  ];
  for (const stub of stubs) {
    const findings = checkNextConfig(stub.source);
    assert.ok(findings.length > 0, `stub «${stub.name}» släpptes igenom`);
    assert.equal(findings[0].rule, stub.rule, stub.name);
  }
  // NEGATIV KONTROLL: den riktiga konfigurationens form får inte fällas av en slarvig regex.
  assert.deepEqual(
    checkNextConfig(`const c = { reactStrictMode: true, productionBrowserSourceMaps: false };\nexport default c;`),
    [],
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * (4) + X3 · LOGGNING OCH PAYLOADVÄRDEN
 * ──────────────────────────────────────────────────────────────────────────── */

test("V10/X3 · noll serverloggning i hela loop-trädet (inga payloadvärden kan läcka)", () => {
  const findings = loopSourceFiles().flatMap((file) =>
    scanSourceFile(file, ["SERVER_LOGGING", "SECRET_ENV_REFERENCE"] as RuleId[]),
  );
  assert.deepEqual(findings, [], `loggning eller credential i loop-trädet:\n${describe(findings)}`);
});

/* ────────────────────────────────────────────────────────────────────────────
 * PLANBINDNING — konstanterna är avlästa ur planen, inte hittade på
 * ──────────────────────────────────────────────────────────────────────────── */

test("V10 · de låsta fakta står ordagrant i den auktoritativa planen", () => {
  const plan = readRepoFile("docs/nortropic-control-room-plan-v1.md");
  assert.ok(plan.includes(`PLAN_BASE_SHA                 = ${PLAN_BASE_SHA}`));
  assert.ok(plan.includes("MASKINEN_GITHUB_CREDENTIAL      = NONE"));
  assert.ok(plan.includes("PROMOTION_CREDENTIAL_IN_RAILWAY = NO"));
  assert.ok(plan.includes("GENERIC_GITHUB_WRITE_TO_UI      = NO"));
  assert.equal(SECURITY_FACTS.PROMOTION_CREDENTIAL_IN_RAILWAY, "NO");
  assert.equal(SECURITY_FACTS.GENERIC_GITHUB_WRITE_TO_UI, "NO");
  assert.equal(SECURITY_FACTS.NORTROPIC_TRUST_AUTHORITY, "NO");
  for (const exception of MIDDLEWARE_MATCHER_EXCEPTIONS) {
    assert.ok(plan.includes(exception), `undantaget ${exception} saknas i planen`);
  }
});
