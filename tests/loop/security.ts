/**
 * V10 · SÄKERHETSHÄRDNING — policyn som REGLER, inte som prosa.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — IMPLEMENTATION_SLICES §V10, AUTH_SECURITY
 * ("DJUPFÖRSVAR" · "INGA UNDANTAG" · "LOGGNING" · MASKINEN_GITHUB_CREDENTIAL=NONE) och
 * TEST_MATRIX A4/A6, C10, X1–X3, X6–X7.
 *
 * VARFÖR EN MODUL OCH INTE ETT GREP
 * ---------------------------------
 * Planens V10-krav är STATISKT MÄTBARA. Ett `grep -r promotion lib/loop` mäter fel sak: det
 * fäller kommentarer, svenska etiketter och läsmodellens fältnamn (`TaskView.promotion.state`
 * ÄR en projektion controllern publicerar och SKA kunna renderas) medan det missar den enda
 * sak kravet handlar om — en KODVÄG som RÖR lease, brytare, Git-refs, dom, attestation eller
 * promotion. Därför partitioneras källan först i kod / strängar / kommentarer, och reglerna
 * mäter EFFEKTER (import av en credential-modul, shell, filskrivning, ref-manipulation,
 * mutationsverb) i den delen där effekter kan uppstå.
 *
 * VARFÖR MODULEN LIGGER I tests/loop/ OCH INTE I lib/loop/
 * ------------------------------------------------------
 * En mätare som ligger INUTI det den mäter måste undanta sig själv — och ett undantag är
 * precis den sortens hål V10 finns för att stänga. Regeldatan nedan bär med nödvändighet
 * credentialnamn och kontrollplansverb; låg filen under lib/loop/** vore repots enda träff
 * mätarens egen. Därför är mätaren PROVINFRASTRUKTUR, aldrig produktkod, och loop-trädet mäts
 * utan ett enda undantag. Av samma skäl sätts klient-env-prefixet ihop ur delar: annars vore
 * mätaren repots enda kodträff på just det mönstret.
 *
 * BINDANDE
 * · Modulen är REN. Ingen fs, ingen nätverksväg, ingen process.env, ingen klocka. All IO
 *   (filvandring, .next/static-läsning, git) ligger i tests/loop/v10-security-hardening.test.ts.
 *   Det gör reglerna körbara mot både den riktiga källan och mot LÖGNSTUBBAR.
 * · Modulen importeras ALDRIG av produktkod. Den är inte en runtime-grind och kan inte bli en.
 * · Modulen är INTE en säkerhetsgräns och INTE en trust-anchor. Den mäter repots källa.
 *   Nortropics kontrollplan (lease/fencing, verifiering, attestation, promotion) ägs av
 *   controllern och kan varken bekräftas eller påverkas härifrån.
 * · Ett utfall härifrån är en MÄTNING, aldrig en dom. `NOT_RUN` är inte `PASS`: en mätning som
 *   inte kunde köras (t.ex. saknad klientbundle) rapporteras som omätt, aldrig som grön.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * LÅSTA FAKTA UR PLANEN
 * ──────────────────────────────────────────────────────────────────────────── */

/** Planens bas-commit. Matchern nedan är avläst ur middleware.ts vid exakt den commiten. */
export const PLAN_BASE_SHA = "ae9d250240e47c40eccf72ff045198f8f5f054ea";

/**
 * Middleware-matchern BYTE FÖR BYTE som den ser ut vid PLAN_BASE_SHA (TEST_MATRIX A4).
 * V10 får inte röra middleware.ts; konstanten finns för att kunna BEVISA att den inte rörts,
 * och för att fälla den farligaste tänkbara ändringen: `/api/loop` tillagd som undantag.
 */
export const MIDDLEWARE_MATCHER_AT_PLAN_BASE =
  "/((?!api/auth|api/leads/worker|_next/static|_next/image|favicon.ico|nortropic-logo.png).*)";

/** Undantagslistan, uppdelad — planens AUTH_SECURITY: "matcher-undantagen förblir EXAKT". */
export const MIDDLEWARE_MATCHER_EXCEPTIONS = [
  "api/auth",
  "api/leads/worker",
  "_next/static",
  "_next/image",
  "favicon.ico",
  "nortropic-logo.png",
] as const;

/** Låsta påståenden ur AUTH_SECURITY. Bärs som data så prov kan citera dem ordagrant. */
export const SECURITY_FACTS = Object.freeze({
  MASKINEN_GITHUB_CREDENTIAL: "NONE",
  PROMOTION_CREDENTIAL_IN_RAILWAY: "NO",
  GENERIC_GITHUB_WRITE_TO_UI: "NO",
  CLAUDE_ROLE_SEPARATION_IS_SECURITY_BOUNDARY: "NO",
  NORTROPIC_TRUST_AUTHORITY: "NO",
});

/**
 * Prefixet som gör en env-variabel KLIENTEXPONERAD i Next. Sätts ihop ur delar med FLIT:
 * planens X2 säger "noll NEXT‑PUBLIC‑variabler i repot", och en mätare som bär mönstret som
 * literal vore repots enda kodträff — alltså ett undantag, alltså ett hål. Ihopsatt blir
 * kravet bokstavligt sant och behöver ingen undantagslista.
 */
export const CLIENT_ENV_PREFIX = ["NEXT", "PUBLIC", ""].join("_");

/** Mönstret för en klientexponerad variabel, byggt ur prefixet ovan. */
export const CLIENT_ENV_PATTERN = new RegExp(`${CLIENT_ENV_PREFIX}[A-Z0-9_]*`);

/**
 * Namn som ALDRIG får förekomma i klientbundlen (TEST_MATRIX X1). Namnet räcker som träff:
 * en bundle som bär variabelnamnet bär i praktiken också platsen där värdet bakats in.
 */
export const CLIENT_FORBIDDEN_SECRET_NAMES = [
  "LOOP_SUPABASE_KEY",
  "SUPABASE_SERVICE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GITHUB_TOKEN_READ",
  "GITHUB_TOKEN_WRITE",
  "AUTH_SECRET",
  "AUTH_PASSWORD",
  "N8N_WEBHOOK_SECRET",
  "PLACES_API_KEY",
] as const;

/**
 * Samma namn som mönster. Byggs UR listan ovan så att en tillagd credential automatiskt gäller
 * både i bundle-mätningen och i källmätningen — två listor hade garanterat glidit isär.
 * `LOOP_SUPABASE_KEY` är UNDANTAGEN här: den är Maskinens egen transportnyckel och LÄSES
 * legitimt server-side i lib/loop/transport.ts. Den mäts i stället i klientbundlen (X1).
 */
export const SECRET_ENV_PATTERN = new RegExp(
  `\\b(${CLIENT_FORBIDDEN_SECRET_NAMES.filter((name) => name !== "LOOP_SUPABASE_KEY").join("|")})\\b`,
);

/** Värdeformer, för det fall ett värde bakats in UTAN sitt variabelnamn. */
export const CLIENT_FORBIDDEN_VALUE_SHAPES: readonly { id: string; pattern: RegExp }[] = [
  { id: "github-classic-token", pattern: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { id: "github-fine-grained-token", pattern: /github_pat_[A-Za-z0-9_]{20,}/ },
  { id: "supabase-jwt", pattern: /eyJhbGciOiJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\./ },
  { id: "private-key-block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

/* ────────────────────────────────────────────────────────────────────────────
 * KÄLLPARTITION — kod / strängar / kommentarer
 * ──────────────────────────────────────────────────────────────────────────── */

export type SourceFile = { path: string; source: string };

export type SourceSpan = { line: number; value: string };

export type SourcePartition = {
  /** Källan med kommentarer och stränginnehåll utraderade (radstruktur bevarad). */
  code: string;
  /** Stränglitteralernas INNEHÅLL, utan citattecken. Template-uttryck (${…}) räknas som kod. */
  strings: SourceSpan[];
  /** Kommentarernas innehåll. Räknas ALDRIG som kodväg (planens X2: "kommentarer räknas inte"). */
  comments: SourceSpan[];
};

/**
 * Delar källan i kod, strängar och kommentarer med en liten tillståndsmaskin.
 *
 * ÄRLIGHET OM PRECISION: maskinen skiljer inte regexlitteral från division. Följden är
 * konservativ åt rätt håll — en regexkropp (t.ex. /refs\/heads/) blir kvar som KOD och kan
 * därmed fällas, aldrig gömmas. Template-litteraler behandlas som sträng, men `${…}` bryts ut
 * som kod så att ingen effekt kan gömmas i en interpolation.
 */
export function partitionSource(source: string): SourcePartition {
  const code: string[] = [];
  const strings: SourceSpan[] = [];
  const comments: SourceSpan[] = [];

  let line = 1;
  let index = 0;
  /** "code" | "template": var tillståndsmaskinen står just nu. */
  let mode: "code" | "template" = "code";
  /** Öppna `${…}`-interpolationer, med klammerdjupet vi stod på när de öppnades. */
  const interpolations: number[] = [];
  let braceDepth = 0;
  let templateValue = "";
  let templateLine = 1;

  const push = (ch: string) => code.push(ch === "\n" ? "\n" : ch);
  const blank = (ch: string) => code.push(ch === "\n" ? "\n" : " ");

  while (index < source.length) {
    const ch = source[index];
    const next = source[index + 1];

    if (mode === "template") {
      if (ch === "\\") {
        templateValue += source.slice(index, index + 2);
        blank(" ");
        blank(next === "\n" ? "\n" : " ");
        if (next === "\n") line += 1;
        index += 2;
        continue;
      }
      if (ch === "$" && next === "{") {
        strings.push({ line: templateLine, value: templateValue });
        templateValue = "";
        blank(" ");
        blank(" ");
        interpolations.push(braceDepth);
        braceDepth = 0;
        mode = "code";
        index += 2;
        continue;
      }
      if (ch === "`") {
        strings.push({ line: templateLine, value: templateValue });
        templateValue = "";
        blank(" ");
        mode = "code";
        index += 1;
        continue;
      }
      if (ch === "\n") line += 1;
      templateValue += ch;
      blank(ch);
      index += 1;
      continue;
    }

    // ── mode === "code" ────────────────────────────────────────────────────
    if (ch === "/" && next === "/") {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      comments.push({ line, value: source.slice(index + 2, stop) });
      for (const c of source.slice(index, stop)) blank(c);
      index = stop;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      const body = source.slice(index, stop);
      comments.push({ line, value: body });
      for (const c of body) blank(c);
      line += countNewlines(body);
      index = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const startLine = line;
      let cursor = index + 1;
      let value = "";
      while (cursor < source.length) {
        const c = source[cursor];
        if (c === "\\") {
          value += source.slice(cursor, cursor + 2);
          cursor += 2;
          continue;
        }
        if (c === ch || c === "\n") break;
        value += c;
        cursor += 1;
      }
      const stop = Math.min(cursor + 1, source.length);
      strings.push({ line: startLine, value });
      for (const c of source.slice(index, stop)) blank(c);
      index = stop;
      continue;
    }
    if (ch === "`") {
      templateLine = line;
      templateValue = "";
      blank(" ");
      mode = "template";
      index += 1;
      continue;
    }
    if (ch === "{") {
      braceDepth += 1;
      push(ch);
      index += 1;
      continue;
    }
    if (ch === "}") {
      if (braceDepth === 0 && interpolations.length > 0) {
        braceDepth = interpolations.pop() ?? 0;
        blank(" ");
        mode = "template";
        templateLine = line;
        templateValue = "";
        index += 1;
        continue;
      }
      braceDepth = Math.max(0, braceDepth - 1);
      push(ch);
      index += 1;
      continue;
    }
    if (ch === "\n") line += 1;
    push(ch);
    index += 1;
  }

  if (mode === "template" && templateValue !== "") {
    strings.push({ line: templateLine, value: templateValue });
  }

  return { code: code.join(""), strings, comments };
}

function blankInto(sink: string[], text: string): void {
  for (const ch of text) sink.push(ch === "\n" ? "\n" : " ");
}

function countNewlines(text: string): number {
  let n = 0;
  for (const ch of text) if (ch === "\n") n += 1;
  return n;
}

/** Radnummer för ett teckenindex i en källa. */
export function lineOf(source: string, index: number): number {
  return countNewlines(source.slice(0, Math.max(0, index))) + 1;
}

/* ────────────────────────────────────────────────────────────────────────────
 * IMPORTER
 * ──────────────────────────────────────────────────────────────────────────── */

export type ImportRef = { line: number; specifier: string };

const IMPORT_PATTERNS: readonly RegExp[] = [
  /\bimport\s+[^;]*?from\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\bexport\s+[^;]*?from\s*["']([^"']+)["']/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

/**
 * Alla modulspecifikatorer i en källa. Kommentarer räknas bort FÖRST (en utkommenterad import
 * är ingen kodväg), men strängarna behövs för att specifikatorn ska finnas kvar — därför körs
 * matchningen mot källan med enbart kommentarerna utraderade.
 */
export function importSpecifiers(source: string): ImportRef[] {
  const withoutComments = stripComments(source);
  const found: ImportRef[] = [];
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(withoutComments)) !== null) {
      found.push({ line: lineOf(withoutComments, match.index), specifier: match[1] });
    }
  }
  return found.sort((a, b) => a.line - b.line || a.specifier.localeCompare(b.specifier));
}

/**
 * Källan med ENBART kommentarerna utraderade (radstruktur bevarad).
 *
 * Skild från partitionSource därför att importläsningen behöver stränglitteralerna kvar —
 * modulspecifikatorn ÄR en sträng — medan en utkommenterad import aldrig är en kodväg.
 */
export function stripComments(source: string): string {
  const out: string[] = [];
  let index = 0;
  let inString: string | null = null;
  while (index < source.length) {
    const ch = source[index];
    const next = source[index + 1];
    if (inString !== null) {
      if (ch === "\\") {
        out.push(ch, next ?? "");
        index += 2;
        continue;
      }
      if (ch === inString) inString = null;
      out.push(ch);
      index += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      out.push(ch);
      index += 1;
      continue;
    }
    if (ch === "/" && next === "/") {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      blankInto(out, source.slice(index, stop));
      index = stop;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      blankInto(out, source.slice(index, stop));
      index = stop;
      continue;
    }
    out.push(ch);
    index += 1;
  }
  return out.join("");
}

/** Är specifikatorn någon av lib/github-read.ts eller lib/github-write.ts? */
export function isGithubCredentialModule(specifier: string): boolean {
  const cleaned = specifier.replace(/\.(ts|tsx|js|mjs|cjs)$/, "");
  return /(^|\/)github-(read|write)$/.test(cleaned);
}

/** Är specifikatorn en relativ/alias-lokal modul (dvs. del av repots egen graf)? */
export function isLocalSpecifier(specifier: string): boolean {
  return specifier.startsWith(".") || specifier.startsWith("@/");
}

/**
 * Löser en lokal specifikator till repo-relativa KANDIDATVÄGAR (utan fs). Anroparen väljer den
 * som finns på disk. Ren strängmatematik med POSIX-semantik — ingen node:path-import behövs.
 */
export function resolveLocalSpecifier(fromPath: string, specifier: string): string[] {
  const base = specifier.startsWith("@/")
    ? specifier.slice(2)
    : joinPosix(dirnamePosix(fromPath), specifier);
  if (/\.(ts|tsx|json|js|mjs|cjs)$/.test(base)) return [base];
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, `${base}.json`];
}

function dirnamePosix(filePath: string): string {
  const cut = filePath.lastIndexOf("/");
  return cut === -1 ? "" : filePath.slice(0, cut);
}

function joinPosix(dir: string, relative: string): string {
  const parts = [...dir.split("/").filter(Boolean)];
  for (const segment of relative.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

/* ────────────────────────────────────────────────────────────────────────────
 * REGLERNA
 * ──────────────────────────────────────────────────────────────────────────── */

export type RuleId =
  | "GITHUB_CREDENTIAL_IMPORT"
  | "SHELL_EXECUTION"
  | "FILESYSTEM_WRITE"
  | "GIT_SURFACE"
  | "CONTROL_PLANE_EFFECT"
  | "SECRET_ENV_REFERENCE"
  | "CLIENT_ENV_REFERENCE"
  | "SERVER_LOGGING";

export type Finding = {
  rule: RuleId;
  path: string;
  line: number;
  evidence: string;
  why: string;
};

/** Modulspecifikatorer som aldrig får nås från Maskinens kodvägar. */
const FORBIDDEN_MODULES: readonly { pattern: RegExp; rule: RuleId; why: string }[] = [
  {
    pattern: /^(node:)?child_process$/,
    rule: "SHELL_EXECUTION",
    why: "shell/underprocess i en loop-väg (C10)",
  },
  {
    pattern: /^(node:)?(fs|fs\/promises)$/,
    rule: "FILESYSTEM_WRITE",
    why: "filsystemsåtkomst i en request-nådd loop-väg (C10)",
  },
  {
    pattern: /^(simple-git|isomorphic-git|nodegit|dugite)$/,
    rule: "GIT_SURFACE",
    why: "Git-bibliotek i en loop-väg (C10/X7)",
  },
  {
    pattern: /^@octokit(\/|$)/,
    rule: "GIT_SURFACE",
    why: "GitHub-klient i en loop-väg (MASKINEN_GITHUB_CREDENTIAL=NONE)",
  },
];

/** Effekter i KOD (kommentarer och stränginnehåll borträknade). */
const CODE_PATTERNS: readonly { rule: RuleId; pattern: RegExp; why: string }[] = [
  {
    rule: "SHELL_EXECUTION",
    pattern: /(?<![.\w])(execSync|execFileSync|spawnSync|execFile|spawn|exec)\s*\(/,
    why: "shell-exekvering",
  },
  {
    rule: "FILESYSTEM_WRITE",
    pattern:
      /\b(writeFileSync|writeFile|appendFileSync|appendFile|unlinkSync|rmSync|rmdirSync|mkdirSync|renameSync|copyFileSync)\s*\(/,
    why: "filskrivning",
  },
  {
    rule: "CONTROL_PLANE_EFFECT",
    // MEDVETET UTANFÖR MÖNSTRET: `Watermark`. Vattenmärket är ett LÄST värde ur controllerns
    // snapshot, och klientens läsmodell håller sin egen observerade kopia (`setWatermark` i
    // lib/loop/realtime.ts). Att sätta en lokal kopia är ingen kontrollplanseffekt — och
    // vägen att skriva controllerns vattenmärke finns inte, vilket de övriga reglerna mäter.
    // Att fälla ordet hade gjort mätaren till brus, och en mätare som ropar varg ignoreras.
    pattern:
      /\b(acquire|renew|release|steal|revoke|extend|heartbeat|trip|arm|disarm|reset|clear|write|set|sign|issue|mint|create|update|delete|record|publish|emit|force|apply|advance|bump)[A-Za-z]*(Lease|Fence|Fencing|FencingToken|Breaker|Verdict|Attestation|Promotion|Ref|Refs)\b/,
    why: "mutationsverb mot kontrollplanet (lease/brytare/ref/dom/attestation/promotion)",
  },
  {
    rule: "CONTROL_PLANE_EFFECT",
    pattern:
      /\b(promoteToMain|promoteTask|promote|attest|attestTask|updateRef|createRef|deleteRef|pushRef|fastForward|mergeToMain|openBreaker|closeBreaker|claimLease|takeLease)\s*\(/,
    why: "direkt anrop mot kontrollplanets verb",
  },
  {
    rule: "SERVER_LOGGING",
    pattern: /\bconsole\.(log|info|warn|error|debug|trace|dir|table)\s*\(/,
    why: "serverloggning i en loop-väg (AUTH_SECURITY · LOGGNING)",
  },
  {
    rule: "CLIENT_ENV_REFERENCE",
    pattern: CLIENT_ENV_PATTERN,
    why: "klientexponerad env-variabel (X2)",
  },
  {
    rule: "SECRET_ENV_REFERENCE",
    pattern: SECRET_ENV_PATTERN,
    why: "credential utanför Maskinens minsta behörighet",
  },
];

/** Effekter som bara kan uttryckas som STRÄNG (t.ex. en ref-väg eller ett shell-kommando). */
const STRING_PATTERNS: readonly { rule: RuleId; pattern: RegExp; why: string }[] = [
  { rule: "GIT_SURFACE", pattern: /refs\/(heads|tags|remotes)\//, why: "Git-ref-väg" },
  {
    rule: "GIT_SURFACE",
    pattern: /\bgit\s+(push|commit|checkout|merge|fetch|rev-parse|update-ref|tag|reset)\b/,
    why: "Git-kommando",
  },
  {
    rule: "GIT_SURFACE",
    pattern: /\b(api\.)?github\.com\b/,
    why: "GitHub-endpoint (MASKINEN_GITHUB_CREDENTIAL=NONE)",
  },
  { rule: "SECRET_ENV_REFERENCE", pattern: SECRET_ENV_PATTERN, why: "credentialnamn i en loop-väg" },
  { rule: "CLIENT_ENV_REFERENCE", pattern: CLIENT_ENV_PATTERN, why: "klientexponerad env" },
];

/** Reglerna som gäller VARJE fil under app/api/loop/** och lib/loop/** (planens X6). */
export const BROAD_RULES: readonly RuleId[] = ["GITHUB_CREDENTIAL_IMPORT"];

/** Reglerna som gäller kod som kan NÅS från en /api/loop-request (planens C10/X7). */
export const REACHABLE_RULES: readonly RuleId[] = [
  "GITHUB_CREDENTIAL_IMPORT",
  "SHELL_EXECUTION",
  "FILESYSTEM_WRITE",
  "GIT_SURFACE",
  "CONTROL_PLANE_EFFECT",
  "SECRET_ENV_REFERENCE",
  "CLIENT_ENV_REFERENCE",
  "SERVER_LOGGING",
];

/**
 * Mäter EN källfil mot ett regelurval.
 *
 * Den viktiga skillnaden mot ett grep: `TaskView.promotion.state`, etiketten
 * "Promotion inledd" och kommentaren "ingen promotion" passerar — de är projektion, språk och
 * dokumentation. `promoteToMain(...)`, `updateRef(...)`, `refs/heads/main` och
 * `import { … } from "@/lib/github-write"` fälls, för de är effekter.
 */
export function scanSourceFile(file: SourceFile, rules: readonly RuleId[] = REACHABLE_RULES): Finding[] {
  const active = new Set(rules);
  const findings: Finding[] = [];
  const { code, strings } = partitionSource(file.source);

  for (const ref of importSpecifiers(file.source)) {
    if (active.has("GITHUB_CREDENTIAL_IMPORT") && isGithubCredentialModule(ref.specifier)) {
      findings.push({
        rule: "GITHUB_CREDENTIAL_IMPORT",
        path: file.path,
        line: ref.line,
        evidence: ref.specifier,
        why: "import av lib/github-read.ts eller lib/github-write.ts (X6)",
      });
    }
    for (const forbidden of FORBIDDEN_MODULES) {
      if (!active.has(forbidden.rule)) continue;
      if (forbidden.pattern.test(ref.specifier)) {
        findings.push({
          rule: forbidden.rule,
          path: file.path,
          line: ref.line,
          evidence: ref.specifier,
          why: forbidden.why,
        });
      }
    }
  }

  const codeLines = code.split("\n");
  for (const rule of CODE_PATTERNS) {
    if (!active.has(rule.rule)) continue;
    codeLines.forEach((text, offset) => {
      const match = rule.pattern.exec(text);
      if (match !== null) {
        findings.push({
          rule: rule.rule,
          path: file.path,
          line: offset + 1,
          evidence: match[0],
          why: rule.why,
        });
      }
    });
  }

  for (const span of strings) {
    for (const rule of STRING_PATTERNS) {
      if (!active.has(rule.rule)) continue;
      const match = rule.pattern.exec(span.value);
      if (match !== null) {
        findings.push({
          rule: rule.rule,
          path: file.path,
          line: span.line,
          evidence: match[0],
          why: rule.why,
        });
      }
    }
  }

  return findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}

/* ────────────────────────────────────────────────────────────────────────────
 * MIDDLEWARE, NEXT-KONFIG OCH DJUPFÖRSVAR
 * ──────────────────────────────────────────────────────────────────────────── */

/** Plockar ut matcher-strängarna ur middleware.ts utan att importera modulen. */
export function middlewareMatchers(source: string): string[] {
  const withoutComments = stripComments(source);
  const block = /matcher\s*:\s*\[([\s\S]*?)\]/.exec(withoutComments);
  if (block === null) return [];
  const literals = block[1].match(/"([^"]*)"|'([^']*)'/g) ?? [];
  return literals.map((literal) => literal.slice(1, -1));
}

export type MiddlewareVerdict =
  | { ok: true }
  | { ok: false; reason: "SAKNAD_MATCHER" | "ANDRAD_MATCHER" | "LOOP_UNDANTAGEN"; detail: string };

/**
 * A4 + planens "INGA UNDANTAG": matchern ska vara byte-identisk med PLAN_BASE_SHA, och
 * /api/loop får aldrig läggas till i undantagslistan — inte ens som en oskyldig prefix.
 */
export function checkMiddlewareMatcher(source: string): MiddlewareVerdict {
  const matchers = middlewareMatchers(source);
  if (matchers.length !== 1) {
    return { ok: false, reason: "SAKNAD_MATCHER", detail: `antal matchers: ${matchers.length}` };
  }
  if (/api\/loop|api%2Floop/i.test(matchers[0])) {
    return { ok: false, reason: "LOOP_UNDANTAGEN", detail: matchers[0] };
  }
  if (matchers[0] !== MIDDLEWARE_MATCHER_AT_PLAN_BASE) {
    return { ok: false, reason: "ANDRAD_MATCHER", detail: matchers[0] };
  }
  return { ok: true };
}

export type ConfigFinding = { rule: string; evidence: string; why: string };

/**
 * next.config.ts: den enda konfigurationsvägen som kan baka in ett serverhemligt värde i
 * klientbundlen är `env:`/`publicRuntimeConfig:` (och källkartor som bär serverkod).
 */
export function checkNextConfig(source: string): ConfigFinding[] {
  const code = partitionSource(source).code;
  const findings: ConfigFinding[] = [];
  if (/(^|[\s,{])env\s*:/.test(code)) {
    findings.push({
      rule: "NEXT_CONFIG_ENV_BLOCK",
      evidence: "env:",
      why: "env-blocket bakar in värden i klientbundlen (X1)",
    });
  }
  if (/publicRuntimeConfig\s*:/.test(code)) {
    findings.push({
      rule: "NEXT_CONFIG_PUBLIC_RUNTIME",
      evidence: "publicRuntimeConfig:",
      why: "publicRuntimeConfig exponeras för klienten",
    });
  }
  if (/productionBrowserSourceMaps\s*:\s*true/.test(code)) {
    findings.push({
      rule: "NEXT_CONFIG_SOURCE_MAPS",
      evidence: "productionBrowserSourceMaps: true",
      why: "källkartor vidgar den statiskt mätbara klientytan",
    });
  }
  if (code.includes(CLIENT_ENV_PREFIX)) {
    findings.push({
      rule: "NEXT_CONFIG_CLIENT_ENV",
      evidence: CLIENT_ENV_PREFIX,
      why: "noll klientexponerade env-variabler i repot (X2)",
    });
  }
  return findings;
}

export type GateFinding = { rule: string; handler: string; why: string };

/**
 * DJUPFÖRSVAR (A6): varje exporterad route-handler under app/api/loop/** ska anropa auth()
 * SJÄLV, svara 401 utan session, och göra det FÖRE varje annan effekt. Mäts på källtext:
 * `await auth()` ska förekomma före första transport-/kommando-/flaggeanrop.
 */
export function checkRouteGate(file: SourceFile): GateFinding[] {
  const code = partitionSource(file.source).code;
  const findings: GateFinding[] = [];
  const handlers = [...code.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g)];
  if (handlers.length === 0) {
    return [{ rule: "INGEN_HANDLER", handler: "-", why: `${file.path}: ingen exporterad handler` }];
  }
  for (let i = 0; i < handlers.length; i += 1) {
    const start = handlers[i].index ?? 0;
    const end = i + 1 < handlers.length ? (handlers[i + 1].index ?? code.length) : code.length;
    const body = code.slice(start, end);
    const name = handlers[i][1];
    const authAt = body.indexOf("await auth()");
    if (authAt === -1) {
      findings.push({ rule: "SAKNAD_AUTH", handler: name, why: `${file.path}: ingen await auth()` });
      continue;
    }
    if (!/status:\s*401/.test(body)) {
      findings.push({ rule: "SAKNAD_401", handler: name, why: `${file.path}: ingen 401-väg` });
    }
    const effects = [
      /isLoopEnabled\s*\(/,
      /loadSnapshot\s*\(/,
      /loadEvents\s*\(/,
      /loadTask\s*\(/,
      /handleCommandRequest\s*\(/,
      /openStream\s*\(/,
      /request\.json\s*\(/,
      /request\.text\s*\(/,
    ];
    for (const effect of effects) {
      const match = effect.exec(body);
      if (match !== null && (match.index ?? 0) < authAt) {
        findings.push({
          rule: "EFFEKT_FORE_AUTH",
          handler: name,
          why: `${file.path}: ${match[0]} körs före await auth()`,
        });
      }
    }
  }
  return findings;
}

/* ────────────────────────────────────────────────────────────────────────────
 * KLIENTBUNDLEN
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Ett fynd i klientbundlen, klassat efter vad det FAKTISKT är:
 *
 * · `värdeform`  — en sträng som SER UT som en hemlighet (token, JWT, privat nyckel).
 * · `namn+värde` — ett credentialnamn med ett värde bredvid sig. Så ser en inbakad nyckel ut.
 * · `namn`       — enbart namnet, utan värde.
 * · `klient-env` — ett klientexponerat env-prefix (X2).
 *
 * VARFÖR SKILLNADEN GÖRS: repot renderar sedan V0 operatörsanvisningar i klientkomponenter
 * ("Sätt GITHUB‑läs‑token + WORKFLOW_REPO i Railway så tänds panelen"). Den texten bär ett
 * NAMN, aldrig ett värde, och är inte en läcka — men den finns mätbart i bundlen. En mätare
 * som fäller den skulle antingen tvinga fram ett undantag (ett hål) eller göra V10 omöjlig av
 * fel skäl. Provet kräver därför NOLL `värdeform`, NOLL `namn+värde` och NOLL `klient-env`,
 * och bevisar separat att varje kvarvarande `namn` har en känd prosakälla i repots egen
 * klientkod — samt att Maskinens egna chunkar inte bär ens ett namn.
 */
export type BundleHit = {
  file: string;
  needle: string;
  kind: "värdeform" | "namn+värde" | "namn" | "klient-env";
};

/** Ett namn räknas som "med värde" när en literal på minst åtta tecken ligger direkt intill. */
function nameWithValuePattern(name: string): RegExp {
  return new RegExp(`${name}["'\`]?\\s*[:=]\\s*["'\`][^"'\`\\n]{8,}["'\`]`);
}

/** X1: mäter en bundle-chunk mot förbjudna namn, namn-med-värde och värdeformer. */
export function scanBundleChunk(file: string, text: string): BundleHit[] {
  const hits: BundleHit[] = [];
  for (const name of CLIENT_FORBIDDEN_SECRET_NAMES) {
    if (!text.includes(name)) continue;
    const withValue = nameWithValuePattern(name).test(text);
    hits.push({ file, needle: name, kind: withValue ? "namn+värde" : "namn" });
  }
  if (text.includes(CLIENT_ENV_PREFIX)) {
    hits.push({ file, needle: CLIENT_ENV_PREFIX, kind: "klient-env" });
  }
  for (const shape of CLIENT_FORBIDDEN_VALUE_SHAPES) {
    if (shape.pattern.test(text)) hits.push({ file, needle: shape.id, kind: "värdeform" });
  }
  return hits;
}

/** Fynd som ALDRIG får finnas: ett värde, ett namn med värde bredvid, eller klient-env. */
export function hardBundleHits(hits: readonly BundleHit[]): BundleHit[] {
  return hits.filter((hit) => hit.kind !== "namn");
}

/*
 * OMÄTT ÄR INTE GODKÄNT. Saknas .next/static har bundle-kriteriet inte körts, och provet
 * FÄLLER med NOT_RUN i stället för att tiga — samma hållning som planens VerdictBadge, där
 * NOT_RUN är visuellt skilt från PASS. Se tests/loop/v10-security-hardening.test.ts.
 */
