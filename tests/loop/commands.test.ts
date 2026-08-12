/**
 * V1 · COMMAND_SCHEMA_PLAN — exakt fem verb, typad payload.
 *
 * V1 bygger endast KONTRAKTET. Ingen kö, ingen route, ingen transport: kommandoytan (V7) är
 * blockerad tills nortropic-system S13 är byggd OCH verifierad. Provet mäter därför att
 * valideringen är smal — inte att något kan skickas.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMAND_STATUSES,
  COMMAND_VERBS,
  dedupKey,
  validateCommand,
} from "../../lib/loop/schema";
import { RAW_FIXTURES, fixtureCommands } from "../../lib/loop/fixtures";
import { assertCoversEveryVerb } from "../../lib/loop/fixtures/generate";

test("exakt fem verb — varken fler eller färre", () => {
  assert.deepEqual([...COMMAND_VERBS], [
    "intake.submit",
    "run.start",
    "run.pause_at_safe_boundary",
    "run.resume",
    "inspect",
  ]);
});

test("kommandofixturerna validerar och täcker alla fem verben", () => {
  const commands = fixtureCommands();
  assert.equal(commands.length, 5);
  assert.deepEqual(commands.map((command) => command.verb).sort(), [...COMMAND_VERBS].sort());
  assert.equal((RAW_FIXTURES.commands as unknown[]).length, 5);
});

test("ett sjätte verb avvisas", () => {
  const result = validateCommand({ verb: "run.force_merge", payload: { run_id: "run-a" } });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "invalid-command");
});

test("payload valideras MOT verbet — fel payload för rätt verb avvisas", () => {
  assert.equal(validateCommand({ verb: "run.start", payload: { run_id: "run-a" } }).ok, false);
  assert.equal(validateCommand({ verb: "run.resume", payload: { config_ref: "c" } }).ok, false);
  assert.equal(
    validateCommand({ verb: "intake.submit", payload: { source_ref: "s", source_sha256: "kort" } }).ok,
    false,
  );
});

test("inget extrafält smyger med i en payload", () => {
  const result = validateCommand({
    verb: "run.start",
    payload: { config_ref: "config-a", shell: "rm -rf /" },
  });
  assert.equal(result.ok, false, "ett extrafält i payloaden måste avvisas");
});

test("ett verb är en enum, aldrig en sträng som blir ett kommando", () => {
  for (const bad of ["", "RUN.START", "run.start ", "inspect;whoami", null, 42]) {
    assert.equal(validateCommand({ verb: bad, payload: {} }).ok, false);
  }
});

test("en payload som BÄR en shell-sträng är bara data — den valideras, aldrig tolkas", () => {
  // Fältet config_ref är en sträng; innehållet får aldrig ges någon annan mening.
  const result = validateCommand({
    verb: "run.start",
    payload: { config_ref: "$(touch /tmp/kanarie)" },
  });
  assert.equal(result.ok, true);
  if (result.ok && result.data.verb === "run.start") {
    assert.equal(result.data.payload.config_ref, "$(touch /tmp/kanarie)");
    // dedup_key är ren strängsammansättning — ingen expansion, ingen exekvering.
    assert.equal(dedupKey(result.data), "run.start:$(touch /tmp/kanarie)");
  }
});

test("dedup_key är verb + naturlig nyckel och skiljer inspect på task respektive run", () => {
  const perTask = validateCommand({ verb: "inspect", payload: { task_id: "p-200" } });
  const perRun = validateCommand({ verb: "inspect", payload: { run_id: "run-a" } });
  assert.equal(perTask.ok && perRun.ok, true);
  if (perTask.ok && perRun.ok) {
    assert.equal(dedupKey(perTask.data), "inspect:task:p-200");
    assert.equal(dedupKey(perRun.data), "inspect:run:run-a");
    assert.notEqual(dedupKey(perTask.data), dedupKey(perRun.data));
  }
});

test("V1-R-002: generatorn är BUNDEN till COMMAND_VERBS — ofullständig täckning kastar", () => {
  // Grön väg: de faktiska fixturerna täcker exakt verbenumet.
  assert.doesNotThrow(() => assertCoversEveryVerb(fixtureCommands()));

  // Lögn 1: ett verb saknas → generering stoppas, ingen tyst fixtur.
  assert.throws(
    () => assertCoversEveryVerb(fixtureCommands().slice(1)),
    /täcker inte COMMAND_SCHEMA_PLAN exakt/,
  );

  // Lögn 2: dubblett utan täckning av alla verb → fälls också.
  const duplicates = fixtureCommands().filter((command) => command.verb === "inspect");
  assert.throws(() => assertCoversEveryVerb(duplicates), /täcker inte COMMAND_SCHEMA_PLAN exakt/);
});

test("kommandostatus ägs av controllern och har fem lägen", () => {
  assert.deepEqual([...COMMAND_STATUSES], [
    "pending",
    "claimed",
    "applied",
    "rejected",
    "expired",
  ]);
});
