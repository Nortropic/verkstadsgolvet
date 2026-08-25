#!/usr/bin/env node
/**
 * Synkar den KANONISKA researchkontraktskärnan + paketmoduler från `nortropic-system`
 * in i denna app som PINNAD, HÄRLEDD bygg-tids-konstant.
 *
 * Detta är den ENDA sanktionerade vägen att uppdatera `lib/research-contract/generated.ts`.
 * Filen redigeras ALDRIG för hand.
 *
 * Auktoritetsordningen (kontraktet är kanoniskt i nortropic-system, aldrig här):
 *   1. nortropic-system äger kontraktstexten OCH dess pinn-manifest.
 *   2. Denna app pinnar {version, sha256} och bär en HÄRLEDD kopia för bygg-tid.
 *   3. Vid minsta identitets-/hash-drift: FAIL-CLOSED — hellre stopp än att komponera
 *      mot text som ingen granskat.
 *
 * Färskhetslagen gäller: radar → kandidat → verifiering → granskad promotion.
 * ALDRIG latest/main → runtime-auktoritet. Skriptet hämtar aldrig något över nätet;
 * det läser en LOKAL, utpekad nortropic-system-checkout och verifierar mot dess manifest.
 *
 * Användning:
 *   node scripts/sync-research-contract.mjs --system-root /path/to/nortropic-system
 *
 * Exit: 0 = synkad (eller redan i synk), 1 = drift/fel (fail-closed), 2 = ODÖMBART.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const rootFlag = argv.indexOf('--system-root')
if (rootFlag === -1 || !argv[rootFlag + 1]) {
  console.error('ODÖMBART: --system-root <path-till-nortropic-system> krävs. Skriptet gissar aldrig var kanon bor.')
  process.exit(2)
}
const SYS = resolve(argv[rootFlag + 1])

if (!existsSync(join(SYS, 'docs/07-konstitution.md')) || !existsSync(join(SYS, 'AUTOPILOT'))) {
  console.error(`ODÖMBART: ${SYS} ser inte ut som nortropic-system (ankarfiler saknas) — vägrar läsa okänt träd.`)
  process.exit(2)
}
// Identitetsverifiering: rätt repo, aldrig en gissad rot (samma disciplin som K1).
try {
  const origin = execFileSync('git', ['-C', SYS, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
  if (!/Nortropic\/nortropic-system(\.git)?$/.test(origin)) {
    console.error(`FAIL: origin är ${origin} — inte Nortropic/nortropic-system.`)
    process.exit(1)
  }
} catch {
  console.error('ODÖMBART: kunde inte läsa origin ur den utpekade roten.')
  process.exit(2)
}

const MANIFEST = join(SYS, 'config/research-contract.v3.json')
if (!existsSync(MANIFEST)) {
  console.error('FAIL: kanoniskt pinn-manifest saknas i nortropic-system (config/research-contract.v3.json).')
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const sha = (buf) => createHash('sha256').update(buf).digest('hex')

/** Läser en pinnad artefakt och FÄLLER om dess bytes inte matchar kanons eget manifest. */
function readPinned(relPath, expected, label) {
  const p = join(SYS, relPath)
  if (!existsSync(p)) {
    console.error(`FAIL: ${label} saknas i kanon: ${relPath}`)
    process.exit(1)
  }
  const buf = readFileSync(p)
  const got = sha(buf)
  if (got !== expected) {
    console.error(`FAIL (fail-closed): ${label} hash ${got.slice(0, 12)}… matchar inte kanons manifest ${expected.slice(0, 12)}…`)
    console.error('  Kanon är själv i drift — synka ALDRIG en okänd text hit. Åtgärda i nortropic-system först.')
    process.exit(1)
  }
  return { text: buf.toString('utf8'), sha256: got }
}

const karna = readPinned(manifest.karna.path, manifest.karna.sha256, 'kontraktskärnan')
const moduler = manifest.paketmoduler.map((m) => ({
  pack: m.pack,
  version: m.version,
  motKarna: m.motKarna,
  ...readPinned(m.path, m.sha256, `paketmodul ${m.pack}`),
}))

// Proveniens: en pinn som pekar på en SMUTSIG arbetskopia ljuger om sitt ursprung.
// Vi vägrar hellre än registrerar en commit vars innehåll inte är det vi läste.
let dirty = ''
try {
  dirty = execFileSync('git', ['-C', SYS, 'status', '--porcelain', '--',
    manifest.karna.path, ...manifest.paketmoduler.map((m) => m.path), 'config/research-contract.v3.json'],
    { encoding: 'utf8' }).trim()
} catch {
  console.error('ODÖMBART: kunde inte läsa git-status i kanon — pinnar aldrig okänd proveniens.')
  process.exit(2)
}
if (dirty) {
  console.error('FAIL (fail-closed): kanons kontraktsfiler har OCOMMITTADE ändringar:')
  console.error(dirty.split('\n').map((l) => '  ' + l).join('\n'))
  console.error('  En pinn måste peka på granskad, committad text. Committa i nortropic-system först.')
  process.exit(1)
}

let sourceCommit = 'OKÄND'
try {
  sourceCommit = execFileSync('git', ['-C', SYS, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
} catch {
  console.error('ODÖMBART: kunde inte läsa HEAD i kanon.')
  process.exit(2)
}

const pin = {
  schema: 'verkstadsgolvet.research-contract.pin/v1',
  kommentar:
    'HÄRLEDD pinn. Kontraktet är kanoniskt i Nortropic/nortropic-system och ALDRIG här. ' +
    'Uppdateras enbart av scripts/sync-research-contract.mjs. Drift = fail-closed.',
  kalla: { repo: 'Nortropic/nortropic-system', commit: sourceCommit },
  karna: { version: manifest.karna.version, path: manifest.karna.path, sha256: karna.sha256 },
  paketmoduler: moduler.map((m) => ({
    pack: m.pack, version: m.version, motKarna: m.motKarna,
    path: manifest.paketmoduler.find((x) => x.pack === m.pack).path, sha256: m.sha256,
  })),
}

const generated =
  `// GENERERAD FIL — REDIGERA ALDRIG FÖR HAND.\n` +
  `// Källa: Nortropic/nortropic-system @ ${sourceCommit}\n` +
  `// Regenereras med: node scripts/sync-research-contract.mjs --system-root <path>\n` +
  `//\n` +
  `// Detta är en HÄRLEDD bygg-tids-kopia av den KANONISKA researchkontraktstexten.\n` +
  `// Den är aldrig auktoritet: auktoriteten bor i nortropic-system och verifieras\n` +
  `// mot pin.json vid modulladdning (fail-closed).\n\n` +
  `export const CONTRACT_SOURCE_COMMIT = ${JSON.stringify(sourceCommit)}\n\n` +
  `export const CONTRACT_CORE_VERSION = ${JSON.stringify(manifest.karna.version)}\n\n` +
  `export const CONTRACT_CORE_TEXT = ${JSON.stringify(karna.text)}\n\n` +
  `export type PackModule = { pack: string; version: string; motKarna: string; text: string }\n\n` +
  `export const CONTRACT_PACK_MODULES: PackModule[] = ${JSON.stringify(
    moduler.map((m) => ({ pack: m.pack, version: m.version, motKarna: m.motKarna, text: m.text })),
    null, 2
  )}\n`

const PIN_OUT = 'lib/research-contract/pin.json'
const GEN_OUT = 'lib/research-contract/generated.ts'
const before = existsSync(GEN_OUT) ? readFileSync(GEN_OUT, 'utf8') : ''
writeFileSync(PIN_OUT, JSON.stringify(pin, null, 2) + '\n')
writeFileSync(GEN_OUT, generated)

console.log(`kärna    ${pin.karna.version}  ${karna.sha256.slice(0, 12)}…`)
for (const m of pin.paketmoduler) console.log(`modul    ${m.pack} ${m.version}  ${m.sha256.slice(0, 12)}…`)
console.log(`källa    ${sourceCommit}`)
console.log(before === generated ? 'RESULTAT: redan i synk — inga bytes ändrade.' : 'RESULTAT: synkad.')
process.exit(0)
