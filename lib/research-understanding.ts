/**
 * PROJEKTFÖRSTÅELSE (S2, Webbförvaltningen).
 *
 * Läser en inklistrad `research.md` och redovisar READ-ONLY vad appen faktiskt
 * förstod — aldrig vad den gissar. Ren funktion, inga sidoeffekter, inga anrop.
 *
 * PARSE-FAIL-ÄRLIGHET är hela poängen: en fil vi inte kan tolka redovisas som
 * OTOLKAD med orsak. Vi hittar ALDRIG på en kontrollrad, och en saknad sektion
 * rapporteras som saknad — aldrig som tom eller som "ok".
 *
 * Detta är en LÄSYTA. Den startar ingenting, godkänner ingenting och är aldrig
 * en grind: kontraktets kontrollrad är producentens ansvar, och plannerns INPUT
 * GATE är den riktiga grinden nedströms.
 */

export type ParseStatus =
  | 'TOLKAD'
  | 'KONTROLLRAD_SAKNAS'
  | 'KONTROLLRAD_OTOLKBAR'
  | 'KONTROLLRAD_TVETYDIG'
  | 'TOM'

export type Kontrollrad = {
  kontraktsversion: string | null
  pack: string | null
  packModule: string | null
  falt: Record<string, string>
  osakra: number | null
  konflikter: number | null
  /** `OKÄNT_VÄRDE` = raden angav något vi inte känner igen. Aldrig tyst uppgraderat. */
  status: 'KOMPLETT' | 'OFULLSTÄNDIG' | 'OKÄNT_VÄRDE' | null
}

export type SektionsFynd = { nr: number; namn: string; hittad: boolean }

export type Projektforstaelse = {
  parseStatus: ParseStatus
  parseNot: string
  kontrollrad: Kontrollrad | null
  sektioner: SektionsFynd[]
  antalOsakraMarkeringar: number
  radlangd: number
  /** Sant endast när vi VET att filen säger sig vara komplett. Aldrig en gissning. */
  sagerSigKomplett: boolean
}

/** Den universella ryggradens sektioner (kontrakt v3) — namnen speglar kontraktet. */
const SEKTIONER: [number, string, RegExp][] = [
  [1, 'Organisation & typade kontaktvägar', /organisation|företag & kontakt|kontaktväg/i],
  [2, 'Erbjudande', /erbjudande|tjänster/i],
  [3, 'Användare / målgrupper', /användare|målgrupp/i],
  [4, 'Toppuppgifter + primärhandling', /toppuppgift|primärhandling/i],
  [5, 'Geografi & språk', /geografi|orter|språk/i],
  [6, 'Förtroende/evidens', /förtroende|kvitton|evidens/i],
  [7, 'Innehåll + bildmaterial', /bildmaterial|innehåll/i],
  [8, 'Röst/varumärke', /röst|varumärke|ton/i],
  [9, 'Transaktions-/dataobservationer', /transaktion|persondata|betalning/i],
  [10, 'Integrationer', /integration|bokningstjänst/i],
  [11, 'Juridik-/riskobservationer', /juridik|risk/i],
  [12, 'Konkurrenter/alternativ', /konkurrent|alternativ/i],
  [13, 'Designreferenser', /designreferens/i],
  [14, 'Framgångsmått', /framgångsmått|framgangsmatt/i],
  [15, 'Kapacitetssignaler', /kapacitetssignal/i],
  [16, 'Öppna frågor', /öppna frågor/i],
  [17, 'Kontrollrad', /kontrollrad|RESEARCH-CONTROL/i],
]

/**
 * En KONTROLLRADSBLOCK är `RESEARCH-CONTROL`-raden plus de omedelbart följande
 * FORTSÄTTNINGSRADERNA — rader som enbart består av `nyckel=värde` separerade av `|`.
 * Vi slutar vid första rad som inte är en fortsättning.
 *
 * Detta är hela poängen: skannade vi till första tomrad kunde en efterföljande
 * ANTECKNING ("kunden anser att status=KOMPLETT") skriva över filens verkliga status.
 * En läsyta som kan uppgradera OFULLSTÄNDIG till KOMPLETT är värre än ingen läsyta.
 */
function ärFortsättningsrad(rad: string): boolean {
  const t = rad.trim()
  if (!t) return false
  if (!t.includes('=')) return false
  // Varje segment mellan | måste se ut som nyckel=värde (värdet får vara tomt).
  return t.split('|').every((seg) => /^\s*[a-zA-ZåäöÅÄÖ_]+\s*=[^=]*$/.test(seg))
}

function extraheraBlock(text: string): string[] {
  const rader = text.split('\n')
  const block: string[] = []
  for (let i = 0; i < rader.length; i++) {
    // ANKRAT till radbörjan. En prosanämning ("Målet är en RESEARCH-CONTROL med
    // status=KOMPLETT") eller en att-göra-punkt ("- RESEARCH-CONTROL …") är INTE
    // en kontrollrad, och får aldrig konkurrera med filens verkliga rad.
    if (!/^[^\S\n]{0,3}RESEARCH-CONTROL/i.test(rader[i])) continue
    const delar = [rader[i]]
    for (let j = i + 1; j < rader.length && ärFortsättningsrad(rader[j]); j++) delar.push(rader[j])
    block.push(delar.join('\n'))
  }
  return block
}

function parseKontrollrad(text: string): { rad: Kontrollrad | null; status: ParseStatus; not: string } {
  const block = extraheraBlock(text)
  if (block.length === 0) {
    return {
      rad: null,
      status: 'KONTROLLRAD_SAKNAS',
      not:
        'Ingen `RESEARCH-CONTROL`-rad hittades. Kontraktets sektion 17 kräver en — utan den ' +
        'vet vi inte vilken kontraktsversion filen är skriven mot, vilket paket som gällde, ' +
        'eller hur många osäkerheter den bär. Vi gissar inte.',
    }
  }

  const lasFalt = (kropp: string) => {
    const falt: Record<string, string> = {}
    // `[^\S\n]*` = blanksteg UTOM radbrytning. Med `\s*` spände separatorn över
    // radbrytningar: ett tomt fält sist på en rad (`osakra=`) slukade då hela nästa
    // rad som sitt värde och raderade den stående statusen. En läsyta som säger
    // "filen anger ingen status" om en fil som uttryckligen säger OFULLSTÄNDIG är
    // lika osann som en som uppgraderar den.
    for (const m of kropp.matchAll(/([a-zA-ZåäöÅÄÖ_]+)[^\S\n]*=[^\S\n]*([^|\n]*)/g)) {
      falt[m[1].trim().toLowerCase()] = m[2].trim()
    }
    return falt
  }

  // Flera block kan finnas: en citerad formatmall, en bilaga som ILLUSTRERAR en
  // färdig rad, eller en korrigerad rad efter en inaktuell.
  //
  // TRE heuristiker prövades och föll: "flest fält vinner" (lät en inaktuell fältrik
  // rad överrösta en sparsam rättelse), "senaste med känd status vinner" (lät en
  // enfältsprosa överrösta en verklig OFULLSTÄNDIG-rad) och "sista välformade vinner"
  // (lät en bilagas exempelrad göra samma sak). Var och en flyttade sprängradien i
  // stället för att ta bort den.
  //
  // Slutsatsen: INGENTING strukturellt skiljer en bilagas exempelrad från en genuin
  // rättelse — båda är ankrade, välformade, senare och rimliga. Position och form kan
  // inte avgöra det. Alltså VÄLJER VI INTE. Är blocken oense om status redovisar vi
  // TVETYDIGHETEN — det är precis vad en läsyta ska göra med något den inte kan veta.
  const alla = block.map((b) => ({ kropp: b, falt: lasFalt(b) }))
  // En rad vars värden bär platshållarsyntax (<...>) är en FORMATMALL, aldrig data.
  const arMall = (k: { falt: Record<string, string> }) =>
    Object.values(k.falt).some((v) => /[<>]/.test(v))
  const kandidater = alla.filter((k) => !arMall(k))
  const valformade = kandidater.filter((k) => Object.keys(k.falt).length >= 2)

  // OENIGHET räknas över ALLA ankrade block som UTTALAR en känd status — inte bara
  // över de välformade. Annars kunde ett filter som tar bort den avvikande raden
  // också ta bort oenigheten, och den kvarvarande raden rapporteras tyst:
  // en sparsam verklig rad (under fältkravet) eller en verklig rad med ett
  // vinkelparentesvärde försvann då, och bilagans exempelrad stod ensam kvar som
  // "sanning". En rad som INTE uttalar någon känd status är däremot inget motpåstående
  // — en identifierande rubrikrad utan `status` gör inte filen tvetydig.
  const KANDA = ['KOMPLETT', 'OFULLSTÄNDIG']
  const uttalade = alla
    .map((k) => (k.falt['status'] ?? '').trim().toUpperCase())
    .filter((v) => KANDA.includes(v))
  const oeniga = new Set(uttalade)
  if (oeniga.size > 1) {
    return {
      rad: null,
      status: 'KONTROLLRAD_TVETYDIG',
      not:
        `Filen innehåller ${uttalade.length} kontrollrader som säger OLIKA saker om status ` +
        `(${[...oeniga].join(' / ')}). Appen kan inte veta vilken som gäller — en bilagas ` +
        'exempelrad ser likadan ut som en rättelse. Vi väljer INTE åt dig: läs filen och ta ' +
        'bort den rad som inte är den verkliga.',
    }
  }

  const bast =
    valformade.length > 0
      ? valformade[valformade.length - 1]
      : (kandidater.length > 0 ? kandidater : alla).reduce((a, b) =>
          Object.keys(b.falt).length >= Object.keys(a.falt).length ? b : a)

  if (Object.keys(bast.falt).length === 0) {
    return {
      rad: null,
      status: 'KONTROLLRAD_OTOLKBAR',
      not:
        'En `RESEARCH-CONTROL`-rad finns men inga `nyckel=värde`-par kunde läsas ur den. ' +
        'Raden redovisas som otolkbar i stället för att tolkas välvilligt.',
    }
  }

  // Ett TOMT värde är inte noll. `Number("")` är 0 i JS — och en utskriven nolla
  // om en fil som inte angav något vore en lögn med decimaler.
  const tal = (v: string | undefined) => {
    if (v === undefined || v.trim() === '') return null
    const n = Number(v.trim())
    return Number.isFinite(n) ? n : null
  }
  const version = /RESEARCH-CONTROL\s+v?([0-9]+\.[0-9]+\.[0-9]+)/i.exec(bast.kropp)?.[1] ?? null
  const statusRa = (bast.falt['status'] ?? '').trim().toUpperCase()
  const status =
    statusRa === '' ? null
      : statusRa === 'KOMPLETT' ? 'KOMPLETT'
      : statusRa === 'OFULLSTÄNDIG' ? 'OFULLSTÄNDIG'
      : 'OKÄNT_VÄRDE'

  return {
    rad: {
      kontraktsversion: version,
      pack: bast.falt['pack'] ?? null,
      packModule: bast.falt['pack_module'] ?? null,
      falt: bast.falt,
      osakra: tal(bast.falt['osakra']),
      konflikter: tal(bast.falt['konflikter']),
      status,
    },
    status: 'TOLKAD',
    not: '',
  }
}

export function lasProjektforstaelse(research: string): Projektforstaelse {
  const text = (research ?? '').trim()
  if (!text) {
    return {
      parseStatus: 'TOM',
      parseNot: 'Ingen research inklistrad ännu.',
      kontrollrad: null,
      sektioner: [],
      antalOsakraMarkeringar: 0,
      radlangd: 0,
      sagerSigKomplett: false,
    }
  }

  const { rad, status, not } = parseKontrollrad(text)
  // ANKRAD igenkänning: en sektion räknas som synlig bara om den har en RUBRIK som
  // bär sektionsnumret, eller en rubrik vars text matchar sektionsnamnet. Fri prosa
  // någonstans i dokumentet duger inte — annars kunde ett stycke som FÖRNEKAR allt
  // innehåll rapporteras som "alla 17 sektioner syns".
  const rubriker = text.split('\n').filter((r) => /^\s{0,3}#{1,6}\s/.test(r))
  const sektioner = SEKTIONER.map(([nr, namn, mönster]) => ({
    nr,
    namn,
    hittad: rubriker.some((r) => new RegExp(`^\\s{0,3}#{1,6}\\s*${nr}[.)\\s]`).test(r) || mönster.test(r)),
  }))
  const antalOsakraMarkeringar = [...text.matchAll(/\[OSÄKER\]/g)].length

  return {
    parseStatus: status,
    parseNot: not,
    kontrollrad: rad,
    sektioner,
    antalOsakraMarkeringar,
    radlangd: text.split('\n').length,
    // Aldrig en gissning: bara när raden EXPLICIT säger KOMPLETT.
    sagerSigKomplett: rad?.status === 'KOMPLETT',
  }
}

/**
 * Kort, ärlig sammanfattning för läsytan. Formulerad så att den aldrig låter som
 * ett godkännande — appen godkänner ingenting.
 */
export function sammanfatta(f: Projektforstaelse): string {
  switch (f.parseStatus) {
    case 'TOM':
      return 'Inget att visa ännu.'
    case 'KONTROLLRAD_SAKNAS':
    case 'KONTROLLRAD_OTOLKBAR':
    case 'KONTROLLRAD_TVETYDIG':
      return 'Kunde inte tolka filens kontrollrad — se orsaken nedan. Detta är inte ett godkännande eller ett underkännande, bara vad appen kunde läsa.'
    case 'TOLKAD': {
      const saknade = f.sektioner.filter((s) => !s.hittad).length
      const delar = [
        `Kontraktsversion ${f.kontrollrad?.kontraktsversion ?? 'okänd'}`,
        `paket ${f.kontrollrad?.pack ?? 'okänt'}`,
        f.kontrollrad?.status === 'OKÄNT_VÄRDE'
          ? `filen anger ett statusvärde vi inte känner igen (${f.kontrollrad.falt.status})`
          : f.kontrollrad?.status
            ? `filen säger ${f.kontrollrad.status}`
            : 'filen anger ingen status',
        saknade === 0 ? 'alla 17 sektioner syns' : `${saknade} av 17 sektioner syns inte`,
      ]
      return delar.join(' · ')
    }
  }
}
