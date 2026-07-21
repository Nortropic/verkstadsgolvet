#!/usr/bin/env node
/**
 * download-images.mjs — Nortropic bygg-verktyg (fristående, beroendefritt, Node 18+).
 *
 * Läser en research.md, extraherar bild-URL:er (ur "Bild-URL:er"-sektionen eller hela
 * dokumentet), och laddar hem dem till en assets-mapp — men ENDAST med en uttrycklig
 * rättighets-bekräftelse (--confirm). Utan --confirm = TORRKÖRNING (rör aldrig nätet).
 *
 * Rader som säger "kräver original från kund" (research-promptens rättighetsflagga)
 * hoppas över — de laddas aldrig automatiskt.
 *
 * Användning:
 *   node tools/download-images.mjs --research ./research.md            # torrkörning
 *   node tools/download-images.mjs --research ./research.md --confirm  # laddar hem
 *   node tools/download-images.mjs --repo kund-slasktest-snickeri --confirm   # hämtar research.md via `gh`
 *   node tools/download-images.mjs --research ./research.md --out ./public/assets --confirm
 *
 * Flaggor:
 *   --research <fil>   research.md att läsa
 *   --repo <namn>      hämta research.md ur ett kund-repo via `gh api` (kräver gh inloggad)
 *   --out <mapp>       målmapp (default ./assets)
 *   --confirm          BEKRÄFTA att du har publiceringsrätt (original + godkännande) → laddar hem
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, extname, join } from "node:path";

// ---- args ----
const args = process.argv.slice(2);
function opt(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const researchPath = opt("research");
const repo = opt("repo");
const outDir = opt("out") || "./assets";
const confirmed = args.includes("--confirm");

// ---- läs research.md ----
function loadResearch() {
  if (researchPath) {
    if (!existsSync(researchPath)) fail(`Hittar inte ${researchPath}`);
    return readFileSync(researchPath, "utf-8");
  }
  if (repo) {
    // hämta via gh (owner = auth-kontot); kräver gh inloggad
    try {
      const b64 = execFileSync(
        "gh",
        ["api", `repos/{owner}/${repo}/contents/research.md`, "--jq", ".content"],
        { encoding: "utf-8" }
      ).trim();
      // gh {owner} funkar inte alltid — fall tillbaka via viewer
      return Buffer.from(b64, "base64").toString("utf-8");
    } catch {
      // fallback: hämta owner ur gh
      const owner = execFileSync("gh", ["api", "user", "--jq", ".login"], { encoding: "utf-8" }).trim();
      const b64 = execFileSync(
        "gh",
        ["api", `repos/${owner}/${repo}/contents/research.md`, "--jq", ".content"],
        { encoding: "utf-8" }
      ).trim();
      return Buffer.from(b64, "base64").toString("utf-8");
    }
  }
  fail("Ange --research <fil> eller --repo <namn>.");
}

function fail(msg) {
  console.error(`FEL: ${msg}`);
  process.exit(1);
}

// ---- extrahera bild-URL:er, grupperade per sektion ----
const SECTION_KEYS = [
  { re: /hero/i, label: "hero" },
  { re: /galleri|projekt|f[öo]re.?efter/i, label: "galleri" },
  { re: /portr[äa]tt|ansikte|\b[äa]gare/i, label: "portratt" },
  { re: /milj[öo]|verkstad|lokal/i, label: "miljo" },
];
const IMG_URL = /(https?:\/\/[^\s)\]"'<>]+\.(?:jpe?g|png|webp|avif|gif))(?:\?[^\s)\]"'<>]*)?/gi;

function labelFor(lineBefore) {
  for (const s of SECTION_KEYS) if (s.re.test(lineBefore)) return s.label;
  return "bild";
}

function extract(md) {
  const lines = md.split("\n");
  const found = [];
  let currentLabel = "bild";
  let needsOriginals = 0;
  for (const line of lines) {
    IMG_URL.lastIndex = 0;
    const matches = line.match(IMG_URL);
    if (matches) {
      // URL-rader byter ALDRIG sektionsetikett — de tillhör den aktuella sektionen
      for (const url of matches) found.push({ url, label: currentLabel });
      continue;
    }
    if (/kr[äa]ver original|saknas|ej tillg[äa]nglig/i.test(line)) needsOriginals++;
    // sektionsetikett uppdateras bara på rubriker / fetstil / etikett-rader (utan URL)
    const isHeadingish = /^#{1,6}\s|\*\*.+\*\*|:\s*$/.test(line);
    if (isHeadingish) {
      const lbl = labelFor(line);
      if (lbl !== "bild") currentLabel = lbl;
    }
  }
  // dedupe på url
  const seen = new Set();
  const unique = found.filter((f) => (seen.has(f.url) ? false : (seen.add(f.url), true)));
  return { images: unique, needsOriginals };
}

// ---- filnamn ----
function fileName(url, label, idx) {
  let ext = extname(new URL(url).pathname).toLowerCase();
  if (!/\.(jpe?g|png|webp|avif|gif)$/.test(ext)) ext = ".jpg";
  const base = basename(new URL(url).pathname, ext).replace(/[^a-z0-9-]+/gi, "-").slice(0, 24) || "img";
  return `${label}-${String(idx).padStart(2, "0")}-${base}${ext}`;
}

// ---- ladda hem ----
async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

// ---- main ----
const md = loadResearch();
const { images, needsOriginals } = extract(md);

console.log(`\nNortropic bild-nedladdare`);
console.log(`Källa: ${researchPath || `repo ${repo}`}`);
console.log(`Hittade ${images.length} bild-URL:er` + (needsOriginals ? ` · ${needsOriginals} rad(er) markerade "kräver original / saknas" (hoppas över)` : ""));

if (images.length === 0) {
  console.log(`\nInga nedladdningsbara bild-URL:er i research.md. Klart.\n`);
  process.exit(0);
}

// gruppera för utskrift
for (const [i, img] of images.entries()) {
  console.log(`  [${i + 1}] (${img.label}) ${img.url}`);
}

if (!confirmed) {
  console.log(`\n⚠️  TORRKÖRNING — inget laddades hem (nätet rördes aldrig).`);
  console.log(`Kör om med --confirm när du BEKRÄFTAR att du har publiceringsrätt`);
  console.log(`(högupplösta original + kundens godkännande) för bilderna ovan.\n`);
  process.exit(0);
}

// bekräftad → ladda hem
mkdirSync(outDir, { recursive: true });
console.log(`\n✓ Rättighet bekräftad (--confirm) — laddar hem till ${outDir}\n`);

let okCount = 0;
let failCount = 0;
const perLabel = {};
for (const img of images) {
  perLabel[img.label] = (perLabel[img.label] || 0) + 1;
  const name = fileName(img.url, img.label, perLabel[img.label]);
  const dest = join(outDir, name);
  try {
    const buf = await download(img.url);
    writeFileSync(dest, buf);
    console.log(`  ✓ ${name}  (${(buf.length / 1024).toFixed(0)} kB)`);
    okCount++;
  } catch (e) {
    console.log(`  ✗ ${name}  — ${e.message}  (${img.url})`);
    failCount++;
  }
}

console.log(`\nKlart: ${okCount} hämtade, ${failCount} misslyckades.`);
if (needsOriginals) {
  console.log(`Påminnelse: ${needsOriginals} bilder markerades "kräver original från kund" — begär högupplösta original + publiceringsgodkännande.`);
}
console.log("");
