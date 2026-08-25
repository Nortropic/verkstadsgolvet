import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { lasProjektforstaelse, sammanfatta } from '../../lib/research-understanding';

const KOMPLETT = `# research.md — Testkund AB

## 1. Organisation & typade kontaktvägar
Telefon 0700-000000 (formulär).

## 2. Erbjudande
Snickeri.

## 4. Toppuppgifter + primärhandling
Ring nu.

## 5. Geografi & språk
Luleå.

## 6. Förtroende/evidens
F-skatt.

## 14. Framgångsmått
Fler offertförfrågningar.

## 15. Kapacitetssignaler
Extern bokning saknas.

## 17. Kontrollrad
RESEARCH-CONTROL v3.0.0 | pack=lokal-se | pack_module=1.0.0
  org=ja | kontaktvag=ja | erbjudande=ja | geografi=ja
  primarhandling=kandidat | framgangsmatt=ja
  osakra=2 | konflikter=1 | status=KOMPLETT
`;

test('TOM: ingen research inklistrad redovisas som tom, aldrig som ok', () => {
  const f = lasProjektforstaelse('');
  assert.equal(f.parseStatus, 'TOM');
  assert.equal(f.sagerSigKomplett, false);
  assert.equal(f.kontrollrad, null);
});

test('TOLKAD: kontrollraden läses fält för fält', () => {
  const f = lasProjektforstaelse(KOMPLETT);
  assert.equal(f.parseStatus, 'TOLKAD');
  assert.equal(f.kontrollrad?.kontraktsversion, '3.0.0');
  assert.equal(f.kontrollrad?.pack, 'lokal-se');
  assert.equal(f.kontrollrad?.packModule, '1.0.0');
  assert.equal(f.kontrollrad?.osakra, 2);
  assert.equal(f.kontrollrad?.konflikter, 1);
  assert.equal(f.kontrollrad?.status, 'KOMPLETT');
  assert.equal(f.sagerSigKomplett, true);
});

test('PARSE-FAIL-ÄRLIGHET: saknad kontrollrad redovisas som saknad, aldrig uppfunnen', () => {
  const f = lasProjektforstaelse('# research.md\n\nEn massa text utan kontrollrad.\n');
  assert.equal(f.parseStatus, 'KONTROLLRAD_SAKNAS');
  assert.equal(f.kontrollrad, null);
  assert.equal(f.sagerSigKomplett, false, 'en fil utan kontrollrad får ALDRIG räknas som komplett');
  assert.match(f.parseNot, /Vi gissar inte/);
});

test('PARSE-FAIL-ÄRLIGHET: otolkbar kontrollrad tolkas inte välvilligt', () => {
  const f = lasProjektforstaelse('## 17\nRESEARCH-CONTROL\n\nresten saknas\n');
  assert.equal(f.parseStatus, 'KONTROLLRAD_OTOLKBAR');
  assert.equal(f.kontrollrad, null);
  assert.equal(f.sagerSigKomplett, false);
});

test('OFULLSTÄNDIG rapporteras som filen säger — appen skönmålar aldrig', () => {
  const f = lasProjektforstaelse(KOMPLETT.replace('status=KOMPLETT', 'status=OFULLSTÄNDIG'));
  assert.equal(f.kontrollrad?.status, 'OFULLSTÄNDIG');
  assert.equal(f.sagerSigKomplett, false);
});

test('okänt statusvärde blir OKÄNT_VÄRDE — aldrig tyst uppgraderat till KOMPLETT', () => {
  const f = lasProjektforstaelse(KOMPLETT.replace('status=KOMPLETT', 'status=NÄSTAN'));
  // Eget läge, inte null: "anges inte" hade varit falskt om en fil FAKTISKT angav
  // något — det angav bara något vi inte känner igen.
  assert.equal(f.kontrollrad?.status, 'OKÄNT_VÄRDE');
  assert.equal(f.sagerSigKomplett, false);
});

test('icke-numeriska räknare blir null i stället för 0 (0 vore en lögn)', () => {
  const f = lasProjektforstaelse(KOMPLETT.replace('osakra=2', 'osakra=många'));
  assert.equal(f.kontrollrad?.osakra, null);
  assert.notEqual(f.kontrollrad?.osakra, 0);
});

test('saknade sektioner rapporteras som saknade, inte som tomma', () => {
  const f = lasProjektforstaelse(KOMPLETT);
  assert.equal(f.sektioner.length, 17);
  const saknade = f.sektioner.filter((s) => !s.hittad).map((s) => s.nr);
  assert.ok(saknade.includes(13), 'designreferenser saknas i fixturen och ska rapporteras saknad');
  assert.ok(f.sektioner.find((s) => s.nr === 14)?.hittad, 'framgångsmått finns och ska hittas');
});

test('[OSÄKER]-markeringar räknas ur texten', () => {
  const f = lasProjektforstaelse(KOMPLETT + '\nBetyg [OSÄKER]\nRestid [OSÄKER]\n');
  assert.equal(f.antalOsakraMarkeringar, 2);
});

test('sammanfattningen låter aldrig som ett godkännande', () => {
  const trasig = sammanfatta(lasProjektforstaelse('utan kontrollrad'));
  assert.match(trasig, /inte ett godkännande/);
  for (const text of [KOMPLETT, '', 'utan kontrollrad']) {
    const s = sammanfatta(lasProjektforstaelse(text));
    assert.ok(!/godkänd\b|klar att bygga|redo att bygga/i.test(s), `sammanfattningen antyder godkännande: ${s}`);
  }
});

test('läsytan är REN — inga sidoeffekter, ingen bygg-/nätväg i modulen', () => {
  const src = readFileSync(new URL('../../lib/research-understanding.ts', import.meta.url), 'utf8');
  // OBS: inte bara "exec(" — det matchar RegExp.prototype.exec och gav en falsk träff.
  for (const forbjudet of ['fetch(', 'XMLHttpRequest', 'child_process', 'writeFile', 'execSync', 'execFile', 'spawn(']) {
    assert.ok(!src.includes(forbjudet), `läsytan innehåller ${forbjudet} — den ska bara läsa`);
  }
});

test('ingen bygg-start-väg finns i onboardingflödet', () => {
  const form = readFileSync(new URL('../../components/OnboardingForm.tsx', import.meta.url), 'utf8');
  for (const forbjudet of ['/api/build', 'startBuild', 'nortropic-autobygg', 'deploy(']) {
    assert.ok(!form.includes(forbjudet), `formuläret exponerar en bygg-startväg: ${forbjudet}`);
  }
});

/* ---------------------------------------------------------------------------
 * KONTROLLRADENS AVGRÄNSNING (B1–B3 ur oberoende granskning).
 * Vakten skannade tidigare till första TOMRAD, så en anteckning EFTER raden kunde
 * skriva över filens verkliga status. Dessa prov driver exakt den mekaniken.
 * ------------------------------------------------------------------------- */

const OFULLSTANDIG = `## 17. Kontrollrad
RESEARCH-CONTROL v3.0.0 | pack=core-only | pack_module=none
  osakra=9 | konflikter=4 | status=OFULLSTÄNDIG
`;

test('B1: en anteckning EFTER kontrollraden får ALDRIG uppgradera status', () => {
  const f = lasProjektforstaelse(OFULLSTANDIG + 'Not: kunden anser att status=KOMPLETT\n');
  assert.equal(f.kontrollrad?.status, 'OFULLSTÄNDIG', 'efterföljande prosa skrev över den verkliga statusen');
  assert.equal(f.sagerSigKomplett, false);
  assert.match(sammanfatta(f), /OFULLSTÄNDIG/);
});

test('B1b: prosa efter raden får inte heller RADERA fält', () => {
  const f = lasProjektforstaelse(OFULLSTANDIG + 'Kommentar utan likhetstecken\n');
  assert.equal(f.kontrollrad?.osakra, 9);
  assert.equal(f.kontrollrad?.konflikter, 4);
  assert.equal(f.kontrollrad?.status, 'OFULLSTÄNDIG');
});

test('B2: ett TOMT räknarvärde blir null, aldrig 0', () => {
  const f = lasProjektforstaelse(
    '## 17\nRESEARCH-CONTROL v3.0.0 | osakra= | konflikter=2 | status=OFULLSTÄNDIG\n'
  );
  assert.equal(f.kontrollrad?.osakra, null, 'tomt värde blev 0 — en nolla vore en lögn');
  assert.equal(f.kontrollrad?.konflikter, 2);
});

test('okänt statusvärde får ett EGET läge och sägs ut, aldrig "anges inte"', () => {
  const f = lasProjektforstaelse(OFULLSTANDIG.replace('OFULLSTÄNDIG', 'NÄSTAN_KLAR'));
  assert.equal(f.kontrollrad?.status, 'OKÄNT_VÄRDE');
  assert.equal(f.sagerSigKomplett, false);
  assert.match(sammanfatta(f), /statusvärde vi inte känner igen/);
});

test('citerad formatmall före den riktiga raden vinner ALDRIG över den riktiga', () => {
  const f = lasProjektforstaelse(
    'Format: RESEARCH-CONTROL v3.0.0 | pack=<paket-id>\n\n' + OFULLSTANDIG
  );
  assert.equal(f.kontrollrad?.status, 'OFULLSTÄNDIG');
  assert.equal(f.kontrollrad?.osakra, 9);
});

test('saknat pack_module rapporteras som saknat, aldrig som det påstådda värdet "none"', () => {
  const f = lasProjektforstaelse('## 17\nRESEARCH-CONTROL v3.0.0 | pack=core-only | status=KOMPLETT\n');
  assert.equal(f.kontrollrad?.packModule, null, 'frånvaro får aldrig bli ett bekräftande värde');
});

test('sektionsräkningen går INTE att blåsa upp med fri prosa', () => {
  // Ett stycke som nämner alla nyckelorden utan att ha en enda rubrik.
  const prosa =
    'Vi har ingen organisation, inget erbjudande, inga användare, inga toppuppgifter, ingen geografi, ' +
    'inget förtroende, inget innehåll, ingen röst, inga transaktioner, inga integrationer, ingen juridik, ' +
    'inga konkurrenter, inga designreferenser, inga framgångsmått, inga kapacitetssignaler, inga öppna frågor ' +
    'och ingen kontrollrad.\n';
  const f = lasProjektforstaelse(prosa);
  const synliga = f.sektioner.filter((s) => s.hittad).length;
  assert.ok(synliga <= 1, `fri prosa rapporterade ${synliga} synliga sektioner — igenkänningen är inte ankrad`);
});

test('rubriker med sektionsnummer räknas korrekt', () => {
  const f = lasProjektforstaelse('## 1. Organisation\n\n## 14. Framgångsmått\n\n## 17. Kontrollrad\n');
  const synliga = f.sektioner.filter((s) => s.hittad).map((s) => s.nr);
  assert.deepEqual(synliga.sort((a, b) => a - b), [1, 14, 17]);
});

/* ---------------------------------------------------------------------------
 * OMVÄND BLÖDNING (granskningsrunda 2).
 * `\s*` efter `=` spände över radbrytningar: ett TOMT fält sist på en rad slukade
 * hela nästa rad som sitt värde och RADERADE den stående statusen. Att påstå
 * "filen anger ingen status" om en fil som säger OFULLSTÄNDIG är lika osant som
 * att uppgradera den. Dessa prov driver exakt den mekaniken.
 * ------------------------------------------------------------------------- */

test('OMVÄND BLÖDNING: tomt fält sist på raden får inte sluka nästa rad', () => {
  const f = lasProjektforstaelse(
    '## 17\nRESEARCH-CONTROL v3.0.0 | pack=lokal-se | pack_module=none\n' +
    '  konflikter=0 | osakra=\n' +
    '  status=OFULLSTÄNDIG\n'
  );
  assert.equal(f.kontrollrad?.osakra, null, 'tomt värde ska vara null');
  assert.equal(f.kontrollrad?.status, 'OFULLSTÄNDIG', 'statusen raderades av föregående tomma fält');
  assert.equal(f.sagerSigKomplett, false);
  assert.match(sammanfatta(f), /OFULLSTÄNDIG/);
});

test('OMVÄND BLÖDNING: tomt pack sist på raden ger inte ett skräpvärde som paket', () => {
  const f = lasProjektforstaelse(
    '## 17\nRESEARCH-CONTROL v3.0.0 | pack=\n  pack_module=1.0.0 | status=KOMPLETT\n'
  );
  assert.equal(f.kontrollrad?.pack, '', 'paketet ska vara tomt, aldrig nästa rads innehåll');
  assert.ok(!(f.kontrollrad?.pack ?? '').includes('='), 'ett skräpvärde med = renderades som paket-id');
  assert.equal(f.kontrollrad?.packModule, '1.0.0');
});

test('två oense kontrollrader ⇒ TVETYDIG — appen väljer inte åt användaren', () => {
  // En inaktuell rad + en rättelse ser exakt likadan ut som en verklig rad + en
  // bilagas exempelrad. Appen KAN inte veta vilken som gäller, och att gissa vore
  // att uppfinna auktoritet. Den redovisar tvetydigheten i stället.
  const f = lasProjektforstaelse(
    '## 17 (tidig, inaktuell)\n' +
    'RESEARCH-CONTROL v3.0.0 | pack=lokal-se | pack_module=1.0.0 | org=ja | kontaktvag=ja\n' +
    '  erbjudande=ja | geografi=ja | osakra=0 | konflikter=0 | status=KOMPLETT\n' +
    '\nEfter komplettering:\n\n' +
    '## 17 (korrigerad)\n' +
    'RESEARCH-CONTROL v3.0.0 | osakra=6 | status=OFULLSTÄNDIG\n'
  );
  assert.equal(f.parseStatus, 'KONTROLLRAD_TVETYDIG');
  assert.equal(f.kontrollrad, null, 'ingen rad får utses till vinnare');
  assert.equal(f.sagerSigKomplett, false);
  assert.match(f.parseNot, /Vi väljer INTE åt dig/);
});

/* ---------------------------------------------------------------------------
 * BLOCKVALETS SPRÄNGRADIE (granskningsrunda 3).
 * Två tidigare regler gick fel: "flest fält vinner" lät en inaktuell fältrik rad
 * överrösta en sparsam rättelse, och "senaste med känd status vinner" lät en
 * ENFÄLTSPROSA överrösta en verklig OFULLSTÄNDIG-rad med KOMPLETT. Proven nedan
 * testar regelns SPRÄNGRADIE, inte dess avsikt.
 * ------------------------------------------------------------------------- */

const RIKTIG_RAD = `## 17. Kontrollrad
RESEARCH-CONTROL v3.0.0 | pack=core-only | pack_module=none
  osakra=8 | konflikter=3 | status=OFULLSTÄNDIG
`;

for (const [namn, prosa] of [
  ['löpande mening', 'Målet är en RESEARCH-CONTROL med status=KOMPLETT'],
  ['att-göra-punkt', '- RESEARCH-CONTROL status=KOMPLETT'],
  ['negerad mening', 'Vi når inte RESEARCH-CONTROL status=KOMPLETT'],
  ['citat i öppna frågor', '## 16. Öppna frågor\nNär blir RESEARCH-CONTROL status=KOMPLETT?'],
] as const) {
  test(`prosanämning (${namn}) får ALDRIG överrösta den verkliga kontrollraden`, () => {
    const f = lasProjektforstaelse(RIKTIG_RAD + prosa + '\n');
    assert.equal(f.kontrollrad?.status, 'OFULLSTÄNDIG', 'prosa blev auktoritativ');
    assert.equal(f.sagerSigKomplett, false);
    assert.equal(f.kontrollrad?.osakra, 8, 'filens osäkerheter försvann');
    assert.equal(f.kontrollrad?.konflikter, 3);
  });
}

test('malformerad status degraderas ärligt — en tidigare exempelrad tar inte över', () => {
  // Endast EN rad uttalar en känd status (exempelraden), så det finns ingen oenighet
  // att redovisa. Den verkliga raden står sist och vinner; dess status känns inte
  // igen och degraderas till OKÄNT_VÄRDE — med filens osäkerheter bevarade.
  const f = lasProjektforstaelse(
    'Exempel:\nRESEARCH-CONTROL v3.0.0 | pack=lokal-se | pack_module=1.0.0 | status=KOMPLETT\n\n' +
    '## 17. Kontrollrad\nRESEARCH-CONTROL v3.0.0 | pack=core-only | osakra=8 | status=OFULLSTÄNDIG (se rättelse nedan)\n'
  );
  assert.equal(f.parseStatus, 'TOLKAD');
  assert.equal(f.kontrollrad?.status, 'OKÄNT_VÄRDE', 'exempelraden ersatte den verkliga raden');
  assert.equal(f.kontrollrad?.osakra, 8, 'filens osäkerheter försvann');
  assert.equal(f.sagerSigKomplett, false);
});

test('en ANKRAD rad som uttalar avvikande status räknas som motpåstående (även sparsam)', () => {
  // En rad under fältkravet filtreras bort ur VALET, men den uttalar ändå en känd
  // status. Räknades oenigheten bara över de välformade kunde ett filter som tar
  // bort den avvikande raden också ta bort oenigheten — och den kvarvarande raden
  // rapporteras tyst som sanning.
  const f = lasProjektforstaelse(RIKTIG_RAD + '\nRESEARCH-CONTROL status=KOMPLETT\n');
  assert.equal(f.parseStatus, 'KONTROLLRAD_TVETYDIG');
  assert.equal(f.sagerSigKomplett, false);
});

test('ANKRINGEN är lastbärande: flerfältsprosa MITT i en rad är ingen kontrollrad', () => {
  // Detta prov finns för att fältantalsfiltret INTE ska vara det enda skyddet.
  // Prosan bär två läsbara fält, så bara ankringen till radbörjan kan utesluta den.
  const f = lasProjektforstaelse(
    RIKTIG_RAD + 'Vi siktar på RESEARCH-CONTROL v3.0.0 med osakra=0 | status=KOMPLETT till fredag.\n'
  );
  assert.equal(f.kontrollrad?.status, 'OFULLSTÄNDIG', 'flerfältsprosa mitt i raden blev auktoritativ');
  assert.equal(f.kontrollrad?.osakra, 8, 'filens osäkerheter ersattes av prosans nolla');
  assert.equal(f.sagerSigKomplett, false);
});

/* Granskningsrunda 4: bilagans exempelrad och den citerade formatmallen. */

test('BILAGANS EXEMPELRAD får aldrig uppgradera den verkliga raden', () => {
  const f = lasProjektforstaelse(
    RIKTIG_RAD +
    '\n## Bilaga — så här ser en färdig kontrollrad ut\n' +
    'RESEARCH-CONTROL v3.0.0 | pack=lokal-se | pack_module=1.0.0 | status=KOMPLETT\n'
  );
  assert.equal(f.parseStatus, 'KONTROLLRAD_TVETYDIG', 'exempelraden vann tyst');
  assert.equal(f.sagerSigKomplett, false, 'en bilaga gjorde filen "komplett"');
  assert.equal(f.kontrollrad, null);
});

test('CITERAD FORMATMALL i bilaga är inte data — den raderar inte den verkliga statusen', () => {
  const f = lasProjektforstaelse(
    RIKTIG_RAD +
    '\n## Bilaga — formatkrav\n' +
    'RESEARCH-CONTROL v3.0.0 | pack=<paket-id eller "core-only"> | pack_module=<version eller "none">\n'
  );
  // Mallen filtreras bort som platshållarrad ⇒ den verkliga raden står ensam kvar.
  assert.equal(f.parseStatus, 'TOLKAD');
  assert.equal(f.kontrollrad?.status, 'OFULLSTÄNDIG', 'mallen raderade filens status');
  assert.equal(f.kontrollrad?.pack, 'core-only', 'mallens platshållare blev paket-id');
  assert.equal(f.kontrollrad?.osakra, 8);
});

test('två SAMSTÄMMIGA kontrollrader är inte tvetydiga — sista gäller', () => {
  const f = lasProjektforstaelse(
    RIKTIG_RAD + '\n## 17 (upprepad)\nRESEARCH-CONTROL v3.0.0 | osakra=8 | status=OFULLSTÄNDIG\n'
  );
  assert.equal(f.parseStatus, 'TOLKAD');
  assert.equal(f.kontrollrad?.status, 'OFULLSTÄNDIG');
});

/* Granskningsrunda 5: filtreringsförbigång, falsk tvetydighet och den otestade tiebreaken. */

test('en sparsam VERKLIG rad kan inte filtreras bort så att bilagan blir sanning', () => {
  const f = lasProjektforstaelse(
    'RESEARCH-CONTROL v3.0.0 | status=OFULLSTÄNDIG\n\n' +
    '## Bilaga\nRESEARCH-CONTROL v3.0.0 | pack=lokal-se | pack_module=1.0.0 | status=KOMPLETT\n'
  );
  assert.equal(f.parseStatus, 'KONTROLLRAD_TVETYDIG', 'den avvikande raden filtrerades bort med oenigheten');
  assert.equal(f.sagerSigKomplett, false);
});

test('en rad UTAN status är inget motpåstående — ingen falsk tvetydighet', () => {
  const f = lasProjektforstaelse(
    'RESEARCH-CONTROL v3.0.0 | pack=core-only | pack_module=none\n\n' + RIKTIG_RAD
  );
  assert.equal(f.parseStatus, 'TOLKAD', 'en tyst rad gjorde filen tvetydig');
  assert.equal(f.kontrollrad?.status, 'OFULLSTÄNDIG');
  assert.equal(f.kontrollrad?.osakra, 8);
});

test('TIEBREAKEN: samstämmig status men olika räknare ⇒ SENARE radens räknare gäller', () => {
  // Detta prov saknades: mutationen "sista → första välformade" dödade inget, så en
  // inaktuell rad kunde rapportera NOLL osäkerheter med helgrön svit.
  const f = lasProjektforstaelse(
    'RESEARCH-CONTROL v3.0.0 | pack=core-only | pack_module=none | osakra=0 | konflikter=0 | status=OFULLSTÄNDIG\n\n' +
    '## 17 (korrigerad)\nRESEARCH-CONTROL v3.0.0 | pack=core-only | pack_module=none | osakra=8 | konflikter=3 | status=OFULLSTÄNDIG\n'
  );
  assert.equal(f.parseStatus, 'TOLKAD');
  assert.equal(f.kontrollrad?.osakra, 8, 'en inaktuell rad rapporterade noll osäkerheter');
  assert.equal(f.kontrollrad?.konflikter, 3);
});
