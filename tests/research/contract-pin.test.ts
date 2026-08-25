import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import pin from '../../lib/research-contract/pin.json';
import {
  CONTRACT_CORE_TEXT,
  CONTRACT_CORE_VERSION,
  CONTRACT_PACK_MODULES,
} from '../../lib/research-contract/generated';
import {
  verifyIdentity,
  satisfiesRange,
  sha256,
  ResearchContractDriftError,
  type ContractPin,
  type DerivedContract,
} from '../../lib/research-contract/verify';
import {
  verifyResearchContractIdentity,
  getContractCore,
  getPackModule,
} from '../../lib/research-contract';
import { buildResearchPrompt, type VerifiedContract } from '../../lib/prompt-research';

const PIN = pin as ContractPin;

/** Det verkliga, synkade tillståndet — utgångspunkt för varje drift-mutation. */
function derived(): DerivedContract {
  return {
    coreVersion: CONTRACT_CORE_VERSION,
    coreText: CONTRACT_CORE_TEXT,
    modules: CONTRACT_PACK_MODULES.map((m) => ({ ...m })),
  };
}
function clonePin(): ContractPin {
  return JSON.parse(JSON.stringify(PIN));
}
/** Varje negativ MÅSTE driva den riktiga vakten i fällande riktning. */
function assertDrift(d: DerivedContract, p: ContractPin, what: string) {
  assert.throws(() => verifyIdentity(d, p), ResearchContractDriftError, `vakten fällde INTE: ${what}`);
}

const INPUT = {
  kundnamn: 'Testkund AB',
  formularsvar: 'Vi vill ha fler offertförfrågningar.',
  facebook: '', instagram: '', hemsida: '', branschOrt: '', kanaler: '',
};

test('POSITIV: det synkade tillståndet verifierar', () => {
  assert.doesNotThrow(() => verifyIdentity(derived(), clonePin()));
  assert.doesNotThrow(() => verifyResearchContractIdentity());
});

test('NEGATIV: en enda ändrad byte i kärntexten fäller vakten', () => {
  const d = derived();
  d.coreText = d.coreText + '\n';
  assertDrift(d, clonePin(), 'en extra radbrytning i kärntexten');
});

test('NEGATIV: ändrad kärntext i MITTEN fäller (inte bara i kanten)', () => {
  const d = derived();
  d.coreText = d.coreText.replace('ODÖMBART blir aldrig grönt', 'ODÖMBART kan vara grönt');
  assert.notEqual(d.coreText, CONTRACT_CORE_TEXT, 'mutationen måste faktiskt ha träffat texten');
  assertDrift(d, clonePin(), 'omskriven lag mitt i kontraktet');
});

test('NEGATIV: versionsdrift mellan härledd kopia och pinn fäller', () => {
  const d = derived();
  d.coreVersion = '9.9.9';
  assertDrift(d, clonePin(), 'kärnversion 9.9.9 mot pinnad version');
});

test('NEGATIV: manipulerad pinn-hash fäller', () => {
  const p = clonePin();
  p.karna.sha256 = '0'.repeat(64);
  assertDrift(derived(), p, 'nollställd pinn-hash');
});

test('NEGATIV: borttagen paketmodul fäller', () => {
  const d = derived();
  d.modules = [];
  assertDrift(d, clonePin(), 'tom modullista mot pinnad modul');
});

test('NEGATIV: omdöpt paketmodul fäller', () => {
  const d = derived();
  d.modules[0] = { ...d.modules[0], pack: 'nagot-annat' };
  assertDrift(d, clonePin(), 'omdöpt paket');
});

test('NEGATIV: ändrad modultext fäller', () => {
  const d = derived();
  d.modules[0] = { ...d.modules[0], text: d.modules[0].text.replace('ENDAST SKÄRPA', 'ENDAST LÄTTA') };
  assertDrift(d, clonePin(), 'bruten skärpningslag i modultexten');
});

test('NEGATIV: modulversion som inte matchar pinnen fäller', () => {
  const d = derived();
  d.modules[0] = { ...d.modules[0], version: '2.0.0' };
  assertDrift(d, clonePin(), 'modulversion 2.0.0 mot pinnad 1.0.0');
});

test('NEGATIV: motKarna-intervall som inte matchar pinnen fäller', () => {
  const d = derived();
  d.modules[0] = { ...d.modules[0], motKarna: '>=1.0.0 <2.0.0' };
  assertDrift(d, clonePin(), 'modulens intervall omskrivet');
});

test('NEGATIV: kärnversion utanför modulens intervall fäller (motKarna PRÖVAS, inte bara transporteras)', () => {
  const d = derived();
  const p = clonePin();
  // Konsekvent omskrivning på båda sidor — endast intervallprövningen kan fånga detta.
  d.coreVersion = '5.0.0';
  p.karna.version = '5.0.0';
  assertDrift(d, p, 'kärna 5.0.0 mot modulintervall >=3.0.0 <4.0.0');
});

test('ANKARE: en TOM pinn får aldrig passera som verifierad', () => {
  const p = clonePin();
  p.paketmoduler = [];
  const d = derived();
  d.modules = [];
  // Utan ankarkravet vore detta vacuöst sant (0 === 0, tom loop).
  assertDrift(d, p, 'tom pinn + tom kopia');
});

test('ANKARE: vakten är inte borttagbar utan att prov faller', () => {
  // Om verifyIdentity() gjordes till en no-op skulle SAMTLIGA negativa prov ovan
  // falla. Detta prov dokumenterar den egenskapen explicit.
  let threw = 0;
  const muts: (() => void)[] = [
    () => { const d = derived(); d.coreText += ' '; verifyIdentity(d, clonePin()); },
    () => { const d = derived(); d.coreVersion = '0.0.1'; verifyIdentity(d, clonePin()); },
    () => { const d = derived(); d.modules = []; verifyIdentity(d, clonePin()); },
  ];
  for (const m of muts) { try { m(); } catch { threw++; } }
  assert.equal(threw, muts.length, 'varje mutation måste fälla — annars är vakten borta');
});

test('satisfiesRange: okänd intervallform godkänns ALDRIG tyst', () => {
  assert.equal(satisfiesRange('3.0.0', '>=3.0.0 <4.0.0'), true);
  assert.equal(satisfiesRange('3.9.9', '>=3.0.0 <4.0.0'), true);
  assert.equal(satisfiesRange('4.0.0', '>=3.0.0 <4.0.0'), false);
  assert.equal(satisfiesRange('2.9.9', '>=3.0.0 <4.0.0'), false);
  assert.equal(satisfiesRange('3.0.0', '^3.0.0'), false, 'okänd form = FEL, aldrig tyst OK');
  assert.equal(satisfiesRange('3.0.0', ''), false);
});

test('den härledda kopian är byte-identisk med pinnen', () => {
  assert.equal(sha256(CONTRACT_CORE_TEXT), PIN.karna.sha256);
  assert.equal(CONTRACT_CORE_VERSION, PIN.karna.version);
  assert.ok(PIN.paketmoduler.length > 0);
  for (const p of PIN.paketmoduler) {
    const m = CONTRACT_PACK_MODULES.find((x) => x.pack === p.pack);
    assert.ok(m, `paketmodul ${p.pack} saknas i den härledda kopian`);
    assert.equal(sha256(m!.text), p.sha256);
  }
});

test('kontraktstexten bär de bärande lagarna ordagrant', () => {
  assert.match(CONTRACT_CORE_TEXT, /radar → kandidat → verifiering → granskad promotion/);
  assert.match(CONTRACT_CORE_TEXT, /latest\/main/);
  assert.match(CONTRACT_CORE_TEXT, /ODÖMBART blir aldrig grönt/);
  assert.match(CONTRACT_CORE_TEXT, /Fakta ≠ strategi/);
  assert.match(CONTRACT_CORE_TEXT, /\[OSÄKER\]/);
});

test('composern bär INGEN egen kopia av frågelistan (ingen mutabel andra sanning)', () => {
  const src = readFileSync(new URL('../../lib/prompt-research.ts', import.meta.url), 'utf8');
  for (const frag of ['Kvitton-inventeringen', 'Designreferensjakt', 'Bildinventeringen', 'ARBETSGÅNG']) {
    assert.ok(!src.includes(frag), `composern återger "${frag}" själv — det är en andra mutabel sanning`);
  }
  assert.ok(src.includes('contract.coreText'), 'composern måste komponera ur den verifierade kontraktstexten');
});

test('GENERERAD FIL är märkt som icke-handredigerbar', () => {
  const gen = readFileSync(new URL('../../lib/research-contract/generated.ts', import.meta.url), 'utf8');
  assert.match(gen, /GENERERAD FIL — REDIGERA ALDRIG FÖR HAND/);
  assert.match(gen, /sync-research-contract\.mjs/);
});

test('core-only är ett giltigt läge och aktiverar ingen paketmodul', () => {
  assert.equal(getPackModule(null), null);
  const core = getContractCore();
  const contract: VerifiedContract = {
    version: core.version, coreText: core.text, sourceCommit: core.sourceCommit, pack: null,
  };
  const prompt = buildResearchPrompt(INPUT, contract);
  assert.match(prompt, /KOMPOSITIONSLÄGE: core-only/);
  assert.match(prompt, /pack=core-only/);
  assert.match(prompt, /ANTAGEN bransch aktiverar aldrig en paketmodul/);
  assert.ok(prompt.includes(core.text), 'kontraktskärnan måste återges ordagrant i prompten');
});

test('belagt paket komponerar in modulen ordagrant och märker kontrollraden', () => {
  const core = getContractCore();
  const mod = getPackModule('lokal-se');
  assert.ok(mod, 'lokal-se måste vara pinnad');
  const prompt = buildResearchPrompt(INPUT, {
    version: core.version, coreText: core.text, sourceCommit: core.sourceCommit,
    pack: { pack: mod!.pack, version: mod!.version, text: mod!.text },
  });
  assert.ok(prompt.includes(mod!.text), 'paketmodulen måste återges ordagrant');
  assert.match(prompt, /pack=lokal-se/);
  assert.match(prompt, /pack_module=1\.0\.0/);
  assert.match(prompt, /SKÄRPER kärnan ovan/);
});

test('prompten stämplar kontraktsidentiteten så den går att spåra', () => {
  const core = getContractCore();
  const prompt = buildResearchPrompt(INPUT, {
    version: core.version, coreText: core.text, sourceCommit: core.sourceCommit, pack: null,
  });
  assert.match(prompt, new RegExp(`Kontraktsversion: ${core.version.replace(/\./g, '\\.')}`));
  assert.ok(prompt.includes(core.sourceCommit.slice(0, 12)));
});
