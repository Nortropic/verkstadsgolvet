/**
 * V1 · FIXTURPROVET.
 *
 * EXIT-KRITERIUM V1(2): fixturer GENERERAS ur schema.ts — en handskriven fixtur som avviker
 * från schemat fälls av ett prov.
 *
 * Två oberoende lås:
 *   A. BYTE-JÄMFÖRELSE mot generatorn → en handredigerad fil fälls även om den vore giltig.
 *   B. SCHEMAVALIDERING → en fixtur som saknar den verkliga kanalens form fälls.
 *
 * NEGATIV KONTROLL: "fixtur som saknar den verkliga kanalens form men ändå går grön."
 * Provet muterar därför fixturer med EN lögn var och kräver att var och en fälls.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FIXTURE_DIR,
  FIXTURE_FILES,
  moduleDir,
  serializeFixture,
  verifyFixtures,
  writeFixtures,
  type FixtureFileName,
} from "../../lib/loop/fixtures/generate";
import { RAW_FIXTURES } from "../../lib/loop/fixtures";
import { validateEvent, validateEvents, validateSnapshot } from "../../lib/loop/schema";

/**
 * Provets EGEN, oberoende härledning av katalogen (ur process.cwd()). Den hålls skild från
 * modulens FIXTURE_DIR med flit: då kan provet korsverifiera modulens stigberäkning i stället
 * för att ärva samma eventuella fel.
 */
const REPO_FIXTURE_DIR = path.join(process.cwd(), "lib", "loop", "fixtures");

function onDisk(name: FixtureFileName): string {
  return readFileSync(path.join(REPO_FIXTURE_DIR, name), "utf8");
}

test("V1(2): varje fixturfil är byte-identisk med generatorns utdata", () => {
  const names = Object.keys(FIXTURE_FILES) as FixtureFileName[];
  assert.ok(names.length >= 7);
  for (const name of names) {
    assert.equal(
      onDisk(name),
      serializeFixture(name),
      `${name} avviker från generatorn — fixturer handskrivs aldrig (kör: npm run loop:fixtures)`,
    );
  }
});

test("V1(2): generatorn är deterministisk — två körningar ger samma bytes", () => {
  const names = Object.keys(FIXTURE_FILES) as FixtureFileName[];
  for (const name of names) {
    assert.equal(serializeFixture(name), serializeFixture(name));
  }
});

test("V1(2): enforcement-vägen är grön mot repots faktiska fixturkatalog", () => {
  const verdicts = verifyFixtures(REPO_FIXTURE_DIR);
  assert.equal(verdicts.length, Object.keys(FIXTURE_FILES).length);
  assert.deepEqual(
    verdicts.filter((verdict) => !verdict.matches),
    [],
  );
});

/**
 * NEG: provet skriver en RIKTIG handredigerad fixtur till en temporär katalog och kräver att
 * verifyFixtures() — samma funktion som bevakar repot — fäller exakt den filen. Det mäter
 * enforcement-mekanismen, inte strängolikhet.
 */
test("NEG: en handredigerad fixtur på disk fälls av verifyFixtures", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "loop-fixtures-"));
  try {
    writeFixtures(dir);
    assert.deepEqual(
      verifyFixtures(dir).filter((verdict) => !verdict.matches),
      [],
      "en nyskriven katalog måste vara grön innan lögnen införs",
    );

    // EN lögn: ett run_id byts för hand, precis som en människa hade gjort i en editor.
    const target = path.join(dir, "snapshot.json");
    const handEdited = readFileSync(target, "utf8").replace(
      '"run-fixture-a"',
      '"run-handskriven"',
    );
    writeFileSync(target, handEdited, "utf8");

    const failed = verifyFixtures(dir).filter((verdict) => !verdict.matches);
    assert.deepEqual(
      failed.map((verdict) => [verdict.name, verdict.reason]),
      [["snapshot.json", "byte-mismatch"]],
      "exakt den handredigerade filen ska fällas, och ingen annan",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("V1-R-01: stighärledningen avkodar mellanslag och icke-ASCII i modul-URL:en", () => {
  // Detta prov är oberoende av var repot råkar ligga — det fäller `new URL(...).pathname`
  // även på en checkout utan specialtecken, där symtomet annars vore osynligt.
  const dir = moduleDir("file:///Users/n/Min%20mapp/%C3%A5%C3%A4%C3%B6/loop/generate.ts");
  assert.equal(dir, "/Users/n/Min mapp/åäö/loop");
  assert.equal(dir.includes("%"), false, "stigen bär kvar procentkodning");
});

test("V1-R-01: FIXTURE_DIR pekar på den faktiska katalogen, utan procentkodning", () => {
  // `new URL(...).pathname` hade lämnat kvar %20 m.m. på en repostig med specialtecken.
  assert.equal(FIXTURE_DIR.includes("%"), false, "FIXTURE_DIR bär procentkodning");
  // Korsverifiering mot provets oberoende härledning ur process.cwd().
  assert.equal(FIXTURE_DIR, REPO_FIXTURE_DIR);

  // Default-argumentet måste träffa rätt katalog — annars vore allt nedan grönt av misstag.
  assert.deepEqual(
    verifyFixtures().filter((verdict) => !verdict.matches),
    [],
  );
});

test("V1-R-01: generatorn klarar en stig med mellanslag och icke-ASCII", () => {
  // Ägarens macOS-hem kan innehålla båda. Stigen skrivs och läses tillbaka skarpt.
  const dir = mkdtempSync(path.join(tmpdir(), "loop fixturer å ä ö "));
  try {
    assert.ok(/[ åäö]/.test(dir), "temporära stigen måste faktiskt bära specialtecken");
    writeFixtures(dir);
    assert.deepEqual(
      verifyFixtures(dir).filter((verdict) => !verdict.matches),
      [],
      "fixturerna ska skrivas och verifieras korrekt även på en stig med specialtecken",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("NEG: en saknad fixtur fälls som 'missing', inte som tyst grön", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "loop-fixtures-"));
  try {
    writeFixtures(dir);
    rmSync(path.join(dir, "commands.json"));
    const failed = verifyFixtures(dir).filter((verdict) => !verdict.matches);
    assert.deepEqual(
      failed.map((verdict) => [verdict.name, verdict.reason]),
      [["commands.json", "missing"]],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("alla eventfixturer validerar gröna genom schemat", () => {
  for (const raw of [
    RAW_FIXTURES.events,
    RAW_FIXTURES.eventsBackwardsTs,
    RAW_FIXTURES.eventsAscendingTs,
    RAW_FIXTURES.eventsUnknown,
  ]) {
    const { valid, invalid } = validateEvents(raw as unknown[]);
    assert.deepEqual(invalid, []);
    assert.ok(valid.length > 0);
  }
});

test("event_id är unikt i varje fixturström (dedup-nyckeln är event_id, inte seq)", () => {
  const ids = (RAW_FIXTURES.events as { event_id: string }[]).map((event) => event.event_id);
  assert.equal(new Set(ids).size, ids.length);
});

test("NEG: fixtur med EN lögn var fälls — en lögn, ett fall", () => {
  const base = (RAW_FIXTURES.events as Record<string, unknown>[])[0];

  const lies: { namn: string; event: Record<string, unknown> }[] = [
    { namn: "seq som sträng", event: { ...base, seq: "1" } },
    { namn: "saknat event_id", event: { ...base, event_id: undefined } },
    { namn: "uppfunnet payloadfält på toppnivå", event: { ...base, builder_model: "opus" } },
    { namn: "evidence_refs som objekt i stället för lista", event: { ...base, evidence_refs: {} } },
    { namn: "ts som nonsenssträng", event: { ...base, ts: "i går" } },
  ];

  for (const lie of lies) {
    assert.equal(validateEvent(lie.event).ok, false, `lögnen "${lie.namn}" gick grön`);
  }
});

test("NEG: snapshot vars TaskView tappat ett kontraktsfält fälls", () => {
  const snapshot = JSON.parse(JSON.stringify(RAW_FIXTURES.snapshot)) as {
    backlog: Record<string, unknown>[];
  };
  delete snapshot.backlog[0].task_gate;
  assert.equal(validateSnapshot(snapshot).ok, false);
});

test("fixturerna innehåller ingen grindtext — endast grind_id och grind_sha256", () => {
  const serialized = JSON.stringify(RAW_FIXTURES.snapshot);
  assert.equal(/grind_source|grind_code|check_name|grind_registry/.test(serialized), false);
});

test("V1-R3: SHA-fälten är FULLÄNGD i fixturerna — förkortning är en vyfråga (V2/V5)", () => {
  const result = validateSnapshot(RAW_FIXTURES.snapshot);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const tasks = [
    ...result.data.backlog,
    ...result.data.completed,
    ...(result.data.current_task ? [result.data.current_task] : []),
  ];

  const gitShas = [
    result.data.current_main.sha,
    ...tasks.flatMap((task) => [task.base_sha, task.candidate_sha]),
  ].filter((sha): sha is string => sha !== null);

  assert.ok(gitShas.length > 0, "fixturen måste bära minst en Git-SHA");
  for (const sha of gitShas) {
    assert.match(sha, /^[0-9a-f]{40}$/, `Git-SHA ${sha} är inte full 40-hex`);
  }

  // Källhashen är och förblir 64 hex — samma rigor i båda ändar, ingen asymmetri.
  for (const task of tasks) {
    if (task.source) assert.match(task.source.sha256, /^[0-9a-f]{64}$/);
  }
});

test("fixturerna bär inga uppfunna payloadfält (B4 är olöst → payload är tom)", () => {
  for (const raw of [RAW_FIXTURES.events, RAW_FIXTURES.eventsUnknown]) {
    for (const event of raw as { payload: Record<string, unknown> }[]) {
      assert.deepEqual(event.payload, {}, "payload får inte fyllas innan S5 låst kontraktet");
    }
  }
});
