/**
 * ROOM-03 · ORSAKSKEDJAN OCH BEVISPROJEKTIONEN — negativa kontroller (FIXTURSIDAN).
 *
 * Provar exit-kriterierna i docs/nortropic-factory-room-master-roadmap-v1.md §ROOM-03 för den
 * skiva som faktiskt byggts: FIXTURSIDANS projektion och yta. Den fulla, levande kedjan och det
 * empiriska kriteriet ("för EN verklig körning löser varje hopp upp till en lagrad identifierare")
 * kräver backendens S5 + S13 och mäts INTE här — ingen mätare i filen får läsas som ett bevis för
 * en levande kedja.
 *
 * DE FRYSTA NEGATIVA KONTROLLERNA SOM VARJE PROV HÄR VILAR PÅ
 * -----------------------------------------------------------
 *   1. En härledd relation UTAN ett verkligt id → FAIL.
 *   2. En klientsidig hopvikning av strömmen presenterad som authority → FAIL.
 *   3. Väggklockan som ordningsauktoritet → FAIL.
 *   4. En projektion som göms undan rådata → FAIL.
 *
 * Provstilen är husets: varje krav mäts på det projektionen FAKTISKT bygger eller på den markup
 * som renderas, aldrig på prosa, och varje mätare bär en lögnstubbe — ett mönster som inte kan
 * fälla sitt eget brott mäter ingenting.
 *
 * HARNESS-NOT: tsconfig har `jsx: "preserve"`, så komponenter behöver en global React när de
 * renderas utanför Next.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import MaskinShell from "../../components/loop/MaskinShell";
import CausalChain, {
  CHAIN_NO_FIXTURE_TEXT,
  CHAIN_NO_TASK_TEXT,
} from "../../components/loop/room/CausalChain";
import {
  RAW_FIXTURES,
  fixtureCommands,
  fixtureIntakeOutcomes,
  fixtureSnapshot,
} from "../../lib/loop/fixtures";
import { TASK_LIFECYCLE_PRESENTATION } from "../../lib/loop/labels";
import {
  TaskViewSchema,
  validateEvents,
  validateSnapshot,
  type LoopEvent,
  type LoopSnapshot,
  type TaskView,
} from "../../lib/loop/schema";
import {
  AGENT_SESSION_ABSENT_NOTE,
  AGENT_SESSION_IDENTITY_IN_CONTRACT,
  ATTEMPT_ABSENT_NOTE,
  CHAIN_IDENTITY_KEYS,
  CAUSAL_CHAIN_LIVE_BLOCKED_ON,
  CAUSAL_CHAIN_MODE,
  CAUSAL_ORDER,
  CHAIN_HOPS,
  COMMAND_INTENTS_CARRY_NO_IDENTITY,
  COMMAND_WITHOUT_SUBMISSION_NOTE,
  EVIDENCE_REFERENCE_NOTE,
  OPERATOR_ABSENT_NOTE,
  PROMOTION_ABSENT_NOTE,
  PROMOTION_WITHOUT_SHA_NOTE,
  REVIEW_ABSENT_NOTE,
  REVIEW_IDENTITY_IN_CONTRACT,
  TASK_ABSENT_NOTE,
  buildCausalChain,
  commandIntentHasIdentity,
  validateCausalChain,
  type CausalChain as CausalChainProjection,
  type ChainHop,
  type ChainHopKind,
} from "../../lib/loop/room/causality";

/* ── Hjälpare ─────────────────────────────────────────────────────────────── */

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

/** Etiketten som ALDRIG får renderas utan ett auktoritativt fält bakom sig. */
const OWNER_ACTION_LABEL = "ÄGARÅTGÄRD KRÄVS";

/** Filerna den här skivan lägger till eller rör. Mätarna nedan gäller exakt dem. */
const SLICE_FILES = [
  "lib/loop/room/causality.ts",
  "components/loop/room/CausalChain.tsx",
  "components/loop/room/TaskFocusRail.tsx",
  "components/loop/room/ui.ts",
  "components/loop/MaskinShell.tsx",
] as const;

function readSlice(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function snapshotOrThrow(): LoopSnapshot {
  const snapshot = fixtureSnapshot();
  assert.ok(snapshot, "V1-fixturen validerade inte mot V1-kontraktet");
  return snapshot;
}

/** Validerade eventkuvert ur en RÅ leverans — exakt vägen ytan själv går. */
function validEvents(events: unknown = RAW_FIXTURES.events): LoopEvent[] {
  const { valid, invalid } = validateEvents(events);
  assert.deepEqual(invalid, [], "leveransen bar ogiltiga rader — provet mäter inte det det säger");
  return valid.map((one) => one.event);
}

function chainFor(
  taskId: string,
  options: { snapshot?: LoopSnapshot | null; events?: LoopEvent[] } = {},
): CausalChainProjection {
  return buildCausalChain({
    task_id: taskId,
    snapshot: options.snapshot === undefined ? fixtureSnapshot() : options.snapshot,
    events: options.events ?? validEvents(),
    outcomes: fixtureIntakeOutcomes(),
  });
}

function hop(chain: CausalChainProjection, kind: ChainHopKind): ChainHop {
  const found = chain.hops.find((one) => one.kind === kind);
  assert.ok(found, `hoppet ${kind} finns inte i kedjan`);
  return found;
}

function renderChain(task: TaskView | null, fixture = true): string {
  return renderToStaticMarkup(createElement(CausalChain, { task, fixture }));
}

function renderRoom(snapshot: LoopSnapshot | null, fixture = true): string {
  return renderToStaticMarkup(createElement(MaskinShell, { snapshot, fixture }));
}

function withoutStyles(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

/** React escapar citattecken i textinnehåll; rådatan jämförs därför mot den avkodade texten. */
function decoded(html: string): string {
  return html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
}

/**
 * Markupen för ETT hopp: HELA elementet, från dess egen `<li` fram till nästa hopps. Uppslaget
 * går bakåt till elementets början med flit — annars hade hoppets EGNA attribut (märkningen
 * provet mäter) legat utanför det uppmätta stycket.
 */
function hopMarkup(html: string, kind: string): string {
  const marker = html.indexOf(`data-chain-hop="${kind}"`);
  assert.ok(marker >= 0, `hoppet ${kind} renderades inte`);
  const start = html.lastIndexOf("<li", marker);
  const nextMarker = html.indexOf('data-chain-hop="', marker + 1);
  const end = nextMarker === -1 ? html.length : html.lastIndexOf("<li", nextMarker);
  return html.slice(start === -1 ? marker : start, end === -1 ? html.length : end);
}

/** Alla hoppmärkta block i markupen, som par av kind och blockets text. */
function hopBlocks(html: string): { kind: string; markup: string }[] {
  const kinds = [...html.matchAll(/data-chain-hop="([a-z_]+)"/g)].map((match) => match[1]);
  return kinds.map((kind) => ({ kind, markup: hopMarkup(html, kind) }));
}

/** MÄTAREN: hopp som renderas som närvarande men saknar rådataläge. Ska alltid vara tom. */
function presentHopsWithoutRaw(html: string): string[] {
  return hopBlocks(html)
    .filter((block) => block.markup.includes('data-chain-present="true"'))
    .filter((block) => !block.markup.includes('data-chain-raw="true"'))
    .map((block) => block.kind);
}

/** MÄTAREN: hopp som renderas som närvarande utan en enda identifierare. Ska alltid vara tom. */
function presentHopsWithoutIds(html: string): string[] {
  return hopBlocks(html)
    .filter((block) => block.markup.includes('data-chain-present="true"'))
    .filter((block) => !/data-chain-id="[^"]+"[^>]*data-value="[^"]+"/.test(block.markup))
    .map((block) => block.kind);
}

/** Den fixturinlämning som controllern FAKTISKT svarat på — kedjans bundna operatörsfall. */
function linkedOutcome() {
  const outcome = fixtureIntakeOutcomes().find(
    (one) => one.controller_answer !== null && one.controller_answer.tasks.length > 0,
  );
  assert.ok(outcome, "fixturen har ingen inlämning med controllersvar — provet mäter ingenting");
  assert.ok(outcome.command, "den bundna inlämningen saknar kommandorad i fixturen");
  return outcome;
}

/** Alla TaskView-poster fixturen bär, oavsett hink. */
function allFixtureTasks(): TaskView[] {
  const snapshot = snapshotOrThrow();
  return [
    ...(snapshot.current_task ? [snapshot.current_task] : []),
    ...snapshot.backlog,
    ...snapshot.completed,
    ...fixtureIntakeOutcomes().flatMap((outcome) => outcome.controller_answer?.tasks ?? []),
  ];
}

/**
 * Uppgifts-id som BARA finns i strömmen — snapshoten har aldrig publicerat dem.
 *
 * Det är den form live-kedjan får vid S5 + S13: eventbutiken nämner en uppgift innan (eller utan
 * att) controllern publicerat den. Kedjan måste klara den utan att påstå en bindning mot en post
 * som inte finns, så varje mätare nedan körs på DEM också, inte bara på snapshotens uppgifter.
 */
function streamOnlyTaskIds(): string[] {
  const known = new Set(allFixtureTasks().map((task) => task.task_id));
  const fromStream = (RAW_FIXTURES.events as unknown as { task_id: string | null }[])
    .map((event) => event.task_id)
    .filter((taskId): taskId is string => taskId !== null);
  return [...new Set(fromStream)].filter((taskId) => !known.has(taskId));
}

/** Varje uppgifts-id kedjan över huvud taget kan byggas för ur fixturen. */
function allChainTaskIds(): string[] {
  return [...allFixtureTasks().map((task) => task.task_id), ...streamOnlyTaskIds()];
}

/** En snapshot där aktuell uppgift bytts ut — VALIDERAD, så formen är kontraktets egen. */
function snapshotWithCurrentTask(task: unknown): LoopSnapshot {
  const parsedTask = TaskViewSchema.safeParse(task);
  assert.equal(parsedTask.success, true, "den konstruerade uppgiften är inte kontraktets form");
  const result = validateSnapshot({ ...structuredClone(snapshotOrThrow()), current_task: task });
  assert.equal(result.ok, true, "den konstruerade snapshoten validerade inte");
  assert.ok(result.ok);
  return result.data;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 1 · VARJE LÄNK BÄRS AV ETT VERKLIGT ID
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-03-ID: varje utskriven länk bärs av ett verkligt id som finns i BÅDA posterna", () => {
  const snapshot = snapshotOrThrow();
  assert.ok(snapshot.current_task, "fixturen har ingen aktuell uppgift");

  /*
    Kedjan mäts på rummets aktuella uppgift, på varje annan uppgift fixturen bär OCH på de
    uppgifts-id som bara finns i strömmen — den sista gruppen är den form live-kedjan får när
    eventbutiken nämner en uppgift snapshoten inte publicerat.
  */
  assert.ok(streamOnlyTaskIds().length > 0, "fixturen har inga ström-endast-uppgifter att mäta på");
  const chains = [
    chainFor(snapshot.current_task.task_id),
    ...allChainTaskIds().map((taskId) => chainFor(taskId)),
  ];

  for (const chain of chains) {
    assert.deepEqual(
      chain.violations,
      [],
      `kedjan för ${chain.task_id} bryter mot sin egen validering`,
    );

    /* Ordningen är den FASTA semantiska sekvensen — aldrig "det som råkade finnas". */
    assert.deepEqual(chain.hops.map((one) => one.kind), [...CHAIN_HOPS]);

    for (const one of chain.hops) {
      if (!one.present) {
        // Ett frånvarande hopp bär INGET påstående: inga id, ingen bindning, ingen post.
        assert.deepEqual(one.ids, [], `${one.kind}: frånvarande hopp bär id`);
        assert.deepEqual(one.bound_by, [], `${one.kind}: frånvarande hopp bär bindning`);
        assert.equal(one.bound_to, null, `${one.kind}: frånvarande hopp pekar på ett annat hopp`);
        assert.equal(one.raw, null, `${one.kind}: frånvarande hopp bär en post`);
        assert.ok(
          one.absent_reason !== null && one.absent_reason.length > 0,
          `${one.kind}: frånvaron saknar ordagrann orsak`,
        );
        continue;
      }

      assert.ok(one.ids.length > 0, `${one.kind}: närvarande hopp utan identifierare`);
      assert.ok(one.raw !== null, `${one.kind}: närvarande hopp utan rå post`);
      if (one.bound_to === null) continue;

      const target = hop(chain, one.bound_to);
      assert.equal(target.present, true, `${one.kind}: bunden till ett frånvarande hopp`);
      assert.ok(one.bound_by.length > 0, `${one.kind}: bindning utan bärande identifierare`);
      for (const bond of one.bound_by) {
        assert.ok(
          (CHAIN_IDENTITY_KEYS as readonly string[]).includes(bond.key),
          `${one.kind}: bindningen bärs av ${bond.key}, som inte är en identitet`,
        );
        // Värdet ska finnas i BÅDA posternas identifierare …
        assert.ok(
          one.ids.some((id) => id.value === bond.value),
          `${one.kind}: bindningsvärdet saknas i hoppets egna id`,
        );
        assert.ok(
          target.ids.some((id) => id.value === bond.value),
          `${one.kind}: bindningsvärdet saknas i ${one.bound_to}`,
        );
        // … och ordagrant i den råa posten, så bindningen inte kan vara en efterhandskonstruktion.
        assert.ok(
          (one.raw ?? "").includes(bond.value) || bond.origin === "container",
          `${one.kind}: bindningsvärdet står inte i hoppets egen råa post`,
        );
      }
    }
  }
});

test("ROOM-03-ID: en uppgift som BARA finns i strömmen ger en hel kedja utan föräldralös bindning", () => {
  /*
    LIVE-FORMEN, MÄTT I DAG. Vid S5 + S13 kommer eventbutiken att nämna uppgifter som controllern
    ännu inte publicerat i sin snapshot. Då finns ingen uppgiftspost att binda till — och en
    bindning mot ett frånvarande hopp hade varit ett påstående om en post som inte finns. Kedjan
    ska i stället ha KÖRNINGEN som rot och binda försöket till den via ett run_id som står
    ordagrant i båda postmängderna.
  */
  const streamOnly = streamOnlyTaskIds();
  assert.ok(streamOnly.length > 0, "fixturens ström nämner ingen okänd uppgift — provet mäter inget");

  const rawEvents = RAW_FIXTURES.events as unknown as {
    task_id: string | null;
    run_id: string;
    attempt_id: string | null;
  }[];

  for (const taskId of streamOnly) {
    const chain = chainFor(taskId);
    assert.deepEqual(chain.violations, [], `kedjan för ström-uppgiften ${taskId} självrapporterar fel`);

    // Uppgiftsposten saknas ärligt — den hämtas aldrig ur strömmen.
    const task = hop(chain, "task");
    assert.equal(task.present, false, `${taskId}: en uppgiftspost uppfanns ur strömmen`);
    assert.equal(task.absent_reason, TASK_ABSENT_NOTE);

    // Körningen är kedjans ROT och pekar inte på något frånvarande hopp.
    const run = hop(chain, "run");
    assert.equal(run.present, true, `${taskId}: körningen tappades bort`);
    assert.equal(run.bound_to, null, `${taskId}: körningen binds till ett hopp som inte finns`);
    assert.equal(run.binding, "root");
    assert.deepEqual(run.bound_by, []);

    // Försöket binds till körningen via ett run_id som FAKTISKT står i båda postmängderna.
    const attempt = hop(chain, "attempt");
    const expectedRunIds = [
      ...new Set(
        rawEvents
          .filter((event) => event.task_id === taskId && event.attempt_id !== null)
          .map((event) => event.run_id),
      ),
    ];
    assert.equal(attempt.present, true, `${taskId}: försöket tappades bort`);
    assert.equal(attempt.bound_to, "run");
    assert.deepEqual(
      attempt.bound_by.map((id) => [id.key, id.value]),
      expectedRunIds.map((runId) => ["run_id", runId]),
    );
    for (const bond of attempt.bound_by) {
      assert.ok(run.ids.some((id) => id.value === bond.value), "run_id saknas i körningens id");
      assert.ok((attempt.raw ?? "").includes(bond.value), "run_id står inte i försökets råa poster");
    }

    // Exakt EN rot i hela kedjan, och inget hopp pekar på ett frånvarande hopp.
    const present = chain.hops.filter((one) => one.present);
    assert.equal(present.filter((one) => one.bound_to === null).length, 1, "kedjan har inte en rot");
    for (const one of present) {
      if (one.bound_to === null) continue;
      assert.equal(hop(chain, one.bound_to).present, true, `${one.kind} binds till ett tomt hopp`);
    }
  }

  /*
    LÖGNSTUBBE: den gamla formen — ett närvarande hopp bundet till ett FRÅNVARANDE uppgiftshopp —
    måste fällas av samma validering. Utan den här stubben mätte provet ovan ingenting.
  */
  const orphan = validateCausalChain({
    hops: [
      stubHop({ kind: "task", present: false, binding: "none", absent_reason: "…", raw: null }),
      stubHop({
        kind: "run",
        ids: [
          { key: "run_id", value: "run-x", mono: true, origin: "record" },
          { key: "task_id", value: "p-x", mono: true, origin: "record" },
        ],
        bound_to: "task",
        bound_by: [{ key: "task_id", value: "p-x", mono: true, origin: "record" }],
        binding: "shared_identifier",
      }),
    ],
  });
  assert.ok(
    orphan.some((violation) => violation.code === "bound_to_absent_hop"),
    "en bindning mot ett frånvarande uppgiftshopp gick igenom valideringen",
  );

  // …och den formen når aldrig ytan: markupen för en ström-uppgift bär noll överträdelser.
  const html = renderChain(null);
  assert.ok(!html.includes('data-chain-violations="true"'), "en tom vy ritade en överträdelselista");
});

test("ROOM-03-ID: inlämning → kommando → uppgift binds via command_id och controllerns task_id", () => {
  const outcome = linkedOutcome();
  const answer = outcome.controller_answer;
  assert.ok(answer);
  const taskId = answer.tasks[0].task_id;
  const chain = chainFor(taskId);

  const operator = hop(chain, "operator");
  assert.equal(operator.present, true, "den bundna inlämningen renderas inte");
  assert.equal(operator.bound_to, null, "operatörsposten är inte kedjans rot");
  assert.ok(
    operator.ids.some((id) => id.key === "submission_id" && id.value === outcome.submission_id),
  );

  const command = hop(chain, "command");
  assert.equal(command.present, true);
  assert.equal(command.bound_to, "operator");
  assert.deepEqual(
    command.bound_by.map((id) => [id.key, id.value]),
    [["command_id", outcome.command?.command_id]],
    "kommandot binds inte via command_id",
  );

  const task = hop(chain, "task");
  assert.equal(task.present, true);
  assert.equal(task.bound_to, "operator", "uppgiften binds inte till inlämningen");
  assert.deepEqual(
    task.bound_by.map((id) => [id.key, id.value]),
    [["task_id", taskId]],
    "uppgiften binds inte via controllerns egen task_id",
  );
  assert.equal(task.record_source, "controller_answer");

  /*
    NEGATIV KONTROLL: en uppgift som INGEN inlämning nämner får varken operatörs- eller
    kommandohopp. Kedjan får aldrig para ihop en uppgift med den inlämning som råkar ligga
    närmast i listan.
  */
  const snapshot = snapshotOrThrow();
  assert.ok(snapshot.current_task);
  const unlinked = chainFor(snapshot.current_task.task_id);
  assert.equal(hop(unlinked, "operator").present, false);
  assert.equal(hop(unlinked, "operator").absent_reason, OPERATOR_ABSENT_NOTE);
  assert.equal(hop(unlinked, "command").present, false);
  assert.equal(hop(unlinked, "command").absent_reason, COMMAND_WITHOUT_SUBMISSION_NOTE);
});

test("ROOM-03-ID: typade intentioner utan command_id kan aldrig binda ett hopp", () => {
  const intents = fixtureCommands();
  assert.ok(intents.length > 0, "fixturen har inga intentioner — mätaren mäter ingenting");
  for (const intent of intents) {
    assert.equal(commandIntentHasIdentity(intent), false, "en intention bär plötsligt ett id");
  }
  assert.equal(COMMAND_INTENTS_CARRY_NO_IDENTITY, "YES");

  // Och kommandohoppet kommer ALLTID ur en transportrad, aldrig ur en intention.
  for (const task of allFixtureTasks()) {
    const command = hop(chainFor(task.task_id), "command");
    if (command.present) assert.equal(command.record_source, "command_record");
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * 2 · PROMOTION BINDS PÅ SHA — OCH BARA NÄR DEN FINNS
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-03-ID: identifierarytan är EXAKT identiteterna — beskrivande fält står för sig", () => {
  /*
    Skivans hela påstående är att varje länk bärs av ett verkligt id. Då får identifierarytan inte
    innehålla något annat: `verb`, `origin`, `source_name`, `issued_by` och `locator` står i
    posterna och visas, men de identifierar ingen enskild post. Låg de bland `ids` kunde ett hopp
    påstå närvaro på styrkan av ett verb — och den maskinläsbara ytan hade påstått fem
    identifierare som inte är identifierare.
  */
  const descriptive = ["verb", "origin", "source_name", "issued_by", "locator"];

  for (const taskId of allChainTaskIds()) {
    for (const one of chainFor(taskId).hops) {
      for (const id of one.ids) {
        assert.ok(
          (CHAIN_IDENTITY_KEYS as readonly string[]).includes(id.key),
          `${taskId}/${one.kind}: ${id.key} står bland identifierarna utan att vara en identitet`,
        );
      }
      if (one.present) {
        assert.ok(
          one.ids.some((id) => (CHAIN_IDENTITY_KEYS as readonly string[]).includes(id.key)),
          `${taskId}/${one.kind}: närvarande hopp utan en enda verklig identitet`,
        );
      }
      for (const item of one.fields) {
        assert.ok(
          !(CHAIN_IDENTITY_KEYS as readonly string[]).includes(item.key),
          `${taskId}/${one.kind}: identiteten ${item.key} degraderades till ett beskrivande fält`,
        );
      }
    }
  }

  // Fälten är INTE bortkastade — de visas, bara under sin egen märkning.
  const outcome = linkedOutcome();
  const answer = outcome.controller_answer;
  assert.ok(answer);
  const linkedChain = chainFor(answer.tasks[0].task_id);
  assert.deepEqual(
    hop(linkedChain, "operator").fields.map((item) => item.key),
    ["source_name", "origin"],
  );
  assert.deepEqual(
    hop(linkedChain, "command").fields.map((item) => item.key),
    ["verb", "issued_by"],
  );
  assert.equal(
    hop(linkedChain, "operator").fields.find((item) => item.key === "source_name")?.value,
    outcome.source.source_name,
  );

  // …och `locator` följer samma regel när kontraktet faktiskt bär ett värde.
  const base = snapshotOrThrow().current_task;
  assert.ok(base?.source);
  const withLocator = chainFor(base.task_id, {
    snapshot: snapshotWithCurrentTask({
      ...structuredClone(base),
      source: { ...structuredClone(base.source), locator: "fixtur://kalla/005" },
    }),
  });
  const sourceHop = hop(withLocator, "source");
  assert.deepEqual(withLocator.violations, []);
  assert.deepEqual(sourceHop.fields.map((item) => item.key), ["locator"]);
  assert.ok(!sourceHop.ids.some((id) => id.key === "locator"));

  /* MARKUPEN: varje data-chain-id är en identitet, och de beskrivande värdena bär data-chain-field. */
  const html = [renderChain(base), renderChain(answer.tasks[0])].join("\n");
  const renderedIdKeys = [...html.matchAll(/data-chain-id="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(renderedIdKeys.length > 0, "ingen identifierare renderades — mätaren mäter ingenting");
  for (const key of renderedIdKeys) {
    assert.ok(
      (CHAIN_IDENTITY_KEYS as readonly string[]).includes(key),
      `markupen påstår ${key} som identifierare`,
    );
    assert.ok(!descriptive.includes(key), `markupen påstår det beskrivande fältet ${key} som id`);
  }
  const renderedFieldKeys = [...html.matchAll(/data-chain-field="([^"]+)"/g)].map((m) => m[1]);
  for (const key of ["source_name", "origin", "verb", "issued_by"]) {
    assert.ok(renderedFieldKeys.includes(key), `det beskrivande fältet ${key} visas inte alls`);
  }

  /* LÖGNSTUBBAR: valideringen måste fälla båda formerna som fanns innan. */
  const asId = (key: string, value: string) => [
    { key, value, mono: false, origin: "record" as const },
  ];
  assert.ok(
    validateCausalChain({
      hops: [stubHop({ kind: "operator", ids: asId("origin", "file") })],
    }).some((violation) => violation.code === "non_identity_in_ids"),
    "ett beskrivande fält fick stå bland identifierarna",
  );
  assert.ok(
    validateCausalChain({
      hops: [stubHop({ kind: "command", ids: asId("verb", "intake.submit") })],
    }).some((violation) => violation.code === "present_without_ids"),
    "ett hopp fick påstå närvaro på styrkan av ett verb",
  );
  // POSITIV KONTROLL: en riktig identitet fälls inte.
  assert.deepEqual(
    validateCausalChain({ hops: [stubHop({ kind: "task", ids: asId("task_id", "p-1") })] }),
    [],
  );
});

test("ROOM-03-PROMOTION: candidate_sha/to_sha binder bara när båda finns och är samma värde", () => {
  // Fixturen bär ingen promotion: hoppet är då FRÅNVARANDE med orsak, aldrig ett tomt påstående.
  for (const task of allFixtureTasks()) {
    const promotion = hop(chainFor(task.task_id), "promotion");
    if (task.promotion === null) {
      assert.equal(promotion.present, false, `${task.task_id}: promotion uppfanns`);
      assert.equal(promotion.absent_reason, PROMOTION_ABSENT_NOTE);
    }
  }

  const base = snapshotOrThrow().current_task;
  assert.ok(base);
  const candidateSha = "b1d5c0de00000000000000000000000000000001";
  const otherSha = "0000000000000000000000000000000000000002";

  // (a) to_sha === candidate_sha → bindningen bärs av SHA-värdet, mot kandidathoppet.
  const bound = chainFor(base.task_id, {
    snapshot: snapshotWithCurrentTask({
      ...structuredClone(base),
      candidate_sha: candidateSha,
      promotion: { state: "promoted", from_sha: otherSha, to_sha: candidateSha },
    }),
  });
  const boundPromotion = hop(bound, "promotion");
  assert.deepEqual(bound.violations, []);
  assert.equal(boundPromotion.present, true);
  assert.equal(boundPromotion.bound_to, "candidate");
  assert.deepEqual(
    boundPromotion.bound_by.map((id) => [id.key, id.value]),
    [["to_sha", candidateSha]],
  );

  // (b) to_sha ≠ candidate_sha → ingen SHA-bindning påstås; hoppet binds via uppgiftens task_id.
  const divergent = chainFor(base.task_id, {
    snapshot: snapshotWithCurrentTask({
      ...structuredClone(base),
      candidate_sha: candidateSha,
      promotion: { state: "promoted", from_sha: null, to_sha: otherSha },
    }),
  });
  const divergentPromotion = hop(divergent, "promotion");
  assert.deepEqual(divergent.violations, []);
  assert.equal(divergentPromotion.bound_to, "task");
  assert.ok(
    !divergentPromotion.bound_by.some((id) => id.value === candidateSha),
    "en kandidatbindning påstods trots att SHA-värdena skiljer sig",
  );

  // (c) promotion utan SHA → FRÅNVARANDE. En opak state-sträng är ingen identitet.
  const stateOnly = chainFor(base.task_id, {
    snapshot: snapshotWithCurrentTask({
      ...structuredClone(base),
      promotion: { state: "promoting", from_sha: null, to_sha: null },
    }),
  });
  assert.equal(hop(stateOnly, "promotion").present, false);
  assert.equal(hop(stateOnly, "promotion").absent_reason, PROMOTION_WITHOUT_SHA_NOTE);
});

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · LÖGNSTUBBAR: PROJEKTIONENS EGEN VALIDERING MÅSTE FÄLLA DEM
 * ──────────────────────────────────────────────────────────────────────────── */

function stubHop(overrides: Partial<ChainHop> & { kind: ChainHopKind }): ChainHop {
  return {
    title: "stubbe",
    present: true,
    record_source: "snapshot",
    ids: [],
    fields: [],
    bound_to: null,
    bound_by: [],
    binding: "root",
    absent_reason: null,
    note: null,
    evidence_refs: [],
    raw: "{}",
    ...overrides,
  };
}

test("ROOM-03-LÖGN: en kedja som binder två hopp UTAN ett delat id avvisas av valideringen", () => {
  const idOf = (key: string, value: string) =>
    [{ key, value, mono: true, origin: "record" as const }];

  /* POSITIV KONTROLL: samma form, men med ett verkligt delat värde → inga överträdelser. */
  const honest = [
    stubHop({ kind: "task", ids: idOf("task_id", "p-1") }),
    stubHop({
      kind: "attempt",
      ids: [...idOf("attempt_id", "a-1"), ...idOf("task_id", "p-1")],
      bound_to: "task",
      bound_by: idOf("task_id", "p-1"),
      binding: "shared_identifier",
    }),
  ];
  assert.deepEqual(validateCausalChain({ hops: honest }), []);

  /* LÖGNSTUBBE 1 — bindningen bärs av ett värde som inte finns i den andra posten. */
  const lie = [
    stubHop({ kind: "task", ids: idOf("task_id", "p-1") }),
    stubHop({
      kind: "attempt",
      ids: idOf("attempt_id", "a-1"),
      bound_to: "task",
      bound_by: idOf("task_id", "p-ANNAT"),
      binding: "shared_identifier",
    }),
  ];
  assert.ok(
    validateCausalChain({ hops: lie }).some(
      (violation) => violation.code === "binding_identifier_not_shared",
    ),
    "en bindning utan delat id gick igenom valideringen",
  );

  /* LÖGNSTUBBE 2 — bindningen bärs av något som inte ens är en identitet. */
  const verbBond = [
    stubHop({ kind: "operator", ids: idOf("verb", "intake.submit") }),
    stubHop({
      kind: "command",
      ids: idOf("verb", "intake.submit"),
      bound_to: "operator",
      bound_by: idOf("verb", "intake.submit"),
      binding: "shared_identifier",
    }),
  ];
  assert.ok(
    validateCausalChain({ hops: verbBond }).some(
      (violation) => violation.code === "binding_on_non_identifier",
    ),
    "ett verb fick hålla ihop två hopp",
  );

  /* LÖGNSTUBBE 3 — närvarande hopp med tomma id. */
  assert.ok(
    validateCausalChain({ hops: [stubHop({ kind: "task", ids: [] })] }).some(
      (violation) => violation.code === "present_without_ids",
    ),
    "ett närvarande hopp utan id gick igenom",
  );

  /* LÖGNSTUBBE 4 — närvarande hopp utan rå post (rådata bortgömd). */
  assert.ok(
    validateCausalChain({
      hops: [stubHop({ kind: "task", ids: idOf("task_id", "p-1"), raw: null })],
    }).some((violation) => violation.code === "present_without_raw"),
    "ett hopp utan rådata gick igenom",
  );

  /* LÖGNSTUBBE 5 — frånvarande hopp som ändå bär ett id. */
  assert.ok(
    validateCausalChain({
      hops: [
        stubHop({
          kind: "review",
          present: false,
          ids: idOf("review_id", "r-1"),
          binding: "none",
          absent_reason: "…",
          raw: null,
        }),
      ],
    }).some((violation) => violation.code === "absent_hop_carries_claim"),
    "ett frånvarande hopp fick bära ett påhittat id",
  );

  /* LÖGNSTUBBE 6 — bunden till ett hopp som inte finns. */
  assert.ok(
    validateCausalChain({
      hops: [
        stubHop({ kind: "task", present: false, binding: "none", absent_reason: "…", raw: null }),
        stubHop({
          kind: "attempt",
          ids: idOf("attempt_id", "a-1"),
          bound_to: "task",
          bound_by: idOf("task_id", "p-1"),
        }),
      ],
    }).some((violation) => violation.code === "bound_to_absent_hop"),
    "en bindning mot ett frånvarande hopp gick igenom",
  );

  /* LÖGNSTUBBE 7 — två obundna rötter, alltså två kedjor som utges för en. */
  assert.ok(
    validateCausalChain({
      hops: [
        stubHop({ kind: "task", ids: idOf("task_id", "p-1") }),
        stubHop({ kind: "promotion", ids: idOf("to_sha", "abc") }),
      ],
    }).some((violation) => violation.code === "multiple_roots"),
    "två fristående rötter presenterades som en kedja",
  );

  /* LÖGNSTUBBE 8 — hoppen ligger i en annan ordning än den fasta sekvensen. */
  assert.ok(
    validateCausalChain({
      hops: [
        stubHop({ kind: "promotion", ids: idOf("to_sha", "abc") }),
        stubHop({
          kind: "task",
          ids: [...idOf("task_id", "p-1"), ...idOf("to_sha", "abc")],
          bound_to: "promotion",
          bound_by: idOf("to_sha", "abc"),
          binding: "shared_identifier",
        }),
      ],
    }).some((violation) => violation.code === "hop_sequence_not_canonical"),
    "en omkastad sekvens gick igenom",
  );

  // Och de verkliga fixturkedjorna har NOLL överträdelser — mätaren ovan visar att den kan fälla.
  for (const task of allFixtureTasks()) {
    assert.deepEqual(chainFor(task.task_id).violations, [], `kedjan för ${task.task_id}`);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · VÄGGKLOCKAN ÄR INGEN ORDNINGSAUKTORITET
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-03-ORDNING: bakvänd `ts` ger en IDENTISK kedja — bara `seq` bär ordning", () => {
  const raw = RAW_FIXTURES.events as unknown as { ts: string; seq: number; task_id: string | null }[];
  const taskId = raw.find((event) => event.task_id !== null)?.task_id;
  assert.ok(taskId, "fixturens ström bär ingen uppgift — mätaren mäter ingenting");

  /* Samma event, samma seq, samma event_id — men tidsstämplarna bakvända mot seq. */
  const reversedStamps = raw.map((event) => event.ts).reverse();
  const backwards = raw.map((event, index) => ({ ...event, ts: reversedStamps[index] }));
  /* … och dessutom levererade i omkastad ordning, så ankomstordningen inte heller kan bära något. */
  const delivered = [...backwards].reverse();

  assert.notDeepEqual(
    raw.map((event) => event.ts),
    backwards.map((event) => event.ts),
    "de två leveranserna är identiska — provet skulle inte se skillnaden",
  );
  assert.deepEqual(
    raw.map((event) => event.seq),
    backwards.map((event) => event.seq),
    "seq ändrades också — då mäter provet inte tidsstämpeln",
  );

  const forwardChain = chainFor(taskId, { events: validEvents(RAW_FIXTURES.events) });
  const backwardsChain = chainFor(taskId, { events: validEvents(delivered) });

  /*
    KEDJAN ÄR IDENTISK. Den enda tillåtna skillnaden är tidsstämpeln INNE i den råa posten —
    den är data som visas ordagrant, aldrig ordning. Allt annat (hoppens ordning, närvaro,
    identifierare, bindningar, bevisreferenser och den råa postens övriga innehåll) jämförs
    som det är; `ts`-raderna skalas bort ur rådatan innan jämförelsen.
  */
  const withoutStamps = (chain: CausalChainProjection) =>
    JSON.parse(
      JSON.stringify(chain).replace(/\\"ts\\": \\"[^\\"]*\\",\\n/g, ""),
    ) as unknown;
  assert.deepEqual(
    withoutStamps(backwardsChain),
    withoutStamps(forwardChain),
    "tidsstämplarna flyttade kedjan",
  );
  assert.deepEqual(
    backwardsChain.hops.map((one) => [one.kind, one.present, one.bound_to, one.ids, one.bound_by]),
    forwardChain.hops.map((one) => [one.kind, one.present, one.bound_to, one.ids, one.bound_by]),
    "tidsstämplarna flyttade en bindning",
  );

  // Samma sak på husets egna ts-fixturer: stigande och bakvänd tid ger samma kedja.
  assert.deepEqual(
    chainFor(taskId, { events: validEvents(RAW_FIXTURES.eventsBackwardsTs) }),
    chainFor(taskId, { events: validEvents(RAW_FIXTURES.eventsAscendingTs) }),
  );

  // Ordningslåsen bärs som DATA, så de kan mätas i stället för att bara läsas.
  assert.equal(CAUSAL_ORDER.WALL_CLOCK_IS_ORDERING_AUTHORITY, "NO");
  assert.equal(CAUSAL_ORDER.HOP_ORDER_IS_TIME_SORTED, "NO");
  assert.equal(CAUSAL_ORDER.EVENT_ORDER_WITHIN_HOP, "seq");

  /*
    Och koden själv: projektionen läser aldrig en klocka och sorterar aldrig om något. Mätt på
    koden med kommentarerna bortskalade — en fil som i klartext FÖRBJUDER tidssortering får inte
    fällas av sitt eget förbud.
  */
  for (const path of ["lib/loop/room/causality.ts", "components/loop/room/CausalChain.tsx"]) {
    const code = stripComments(readSlice(path));
    for (const pattern of [/Date\s*\./, /getTime\s*\(/, /\.sort\s*\(/, /localeCompare/, /\bts\b\s*[:.]/]) {
      assert.ok(!pattern.test(code), `${path}: läser klocka eller sorterar om (${pattern})`);
    }
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · RÅ INSPEKTION GÖMS ALDRIG
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-03-RÅ: varje närvarande hopp bär sin post ordagrant i markupen", () => {
  const snapshot = snapshotOrThrow();
  assert.ok(snapshot.current_task);
  const html = renderChain(snapshot.current_task);

  const blocks = hopBlocks(html);
  assert.equal(blocks.length, CHAIN_HOPS.length, "alla hopp renderas inte");
  assert.deepEqual(presentHopsWithoutRaw(html), [], "ett närvarande hopp göms undan rådata");

  const chain = chainFor(snapshot.current_task.task_id);
  const text = decoded(html);
  for (const one of chain.hops) {
    if (!one.present) continue;
    assert.ok(
      one.raw !== null && text.includes(one.raw),
      `${one.kind}: den råa posten återges inte ordagrant i markupen`,
    );
  }

  // Rådatan når läsaren utan skript: ett nativt <details> med en <pre>.
  assert.ok(/<details[^>]*data-chain-raw="true"/.test(html));
  assert.ok(!/<script/i.test(html), "kedjan monterar skript");

  /* LÖGNSTUBBE: en vy där rådataläget tagits bort MÅSTE fällas av samma mätare. */
  const stubbed = html.replace(/<details[\s\S]*?<\/details>/g, "");
  assert.ok(
    presentHopsWithoutRaw(stubbed).length > 0,
    "mätaren ser inte ens en vy helt utan rådata",
  );
});

test("ROOM-03-RÅ: rå EVENT-inspektion finns kvar där kedjan bygger på strömmen", () => {
  const raw = RAW_FIXTURES.events as unknown as { task_id: string | null; event_id: string }[];
  const taskId = raw.find((event) => event.task_id !== null)?.task_id;
  assert.ok(taskId);

  const chain = chainFor(taskId);
  const run = hop(chain, "run");
  assert.equal(run.present, true, "kedjan hittar ingen körning för en uppgift som finns i strömmen");
  assert.equal(run.record_source, "event_stream");

  const eventIds = raw.filter((event) => event.task_id === taskId).map((event) => event.event_id);
  assert.ok(eventIds.length > 0);
  for (const eventId of eventIds) {
    assert.ok(
      (run.raw ?? "").includes(eventId),
      `eventet ${eventId} går inte att inspektera rått ur körningshoppet`,
    );
  }

  // Försökshoppet bär attempt_id ur strömmen — aldrig snapshotens ordningstal attempt.n.
  const attempt = hop(chain, "attempt");
  assert.equal(attempt.present, true);
  /*
    Försöket bär bara identiteter som STÅR i eventkuverten: attempt_id, kuvertets run_id (det som
    binder försöket till körningen när uppgiftsposten saknas) och task_id. Snapshotens attempt.n
    är ett ordningstal och får aldrig smyga in som en identitet.
  */
  assert.ok(
    attempt.ids.every((id) => ["attempt_id", "run_id", "task_id"].includes(id.key)),
    `försöket bär en identifierare som inte står i kuvertet: ${attempt.ids.map((id) => id.key).join("/")}`,
  );
  assert.ok(!attempt.ids.some((id) => id.key === "n" || id.key === "attempt_n"));
});

/* ────────────────────────────────────────────────────────────────────────────
 * 6 · AGENTSESSION OCH GRANSKNING: INGEN IDENTITET UPPFINNS
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-03-FRÅNVARO: agentsessionen och granskningen är ABSENT i varje kedja", () => {
  for (const task of allFixtureTasks()) {
    const chain = chainFor(task.task_id);
    const session = hop(chain, "agent_session");
    const review = hop(chain, "review");
    assert.equal(session.present, false, `${task.task_id}: en agentsession uppfanns`);
    assert.equal(session.absent_reason, AGENT_SESSION_ABSENT_NOTE);
    assert.deepEqual(session.ids, []);
    assert.equal(review.present, false, `${task.task_id}: en granskningsidentitet uppfanns`);
    assert.equal(review.absent_reason, REVIEW_ABSENT_NOTE);
    assert.deepEqual(review.ids, []);
  }

  assert.equal(AGENT_SESSION_IDENTITY_IN_CONTRACT, "NONE");
  assert.equal(REVIEW_IDENTITY_IN_CONTRACT, "NONE");

  /* Och påståendet mäts mot kontraktet självt: det FINNS ingen sådan identitet att rendera. */
  const schema = readSlice("lib/loop/schema.ts");
  for (const pattern of [/session_id/, /agent_session/, /review_id/, /reviewer/, /reviewed_by/]) {
    assert.ok(!pattern.test(schema), `kontraktet bär numera ${pattern} — kedjan ska då mäta om`);
  }

  // I markupen syns frånvaron som em-streck med orsak — aldrig som ett tyst hål.
  const snapshot = snapshotOrThrow();
  const html = renderChain(snapshot.current_task);
  for (const kind of ["agent_session", "review"]) {
    const markup = hopMarkup(html, kind);
    assert.ok(markup.includes('data-chain-present="false"'), `${kind} renderas som närvarande`);
    assert.ok(markup.includes('data-missing="true"'), `${kind} saknar em-streckets märkning`);
    assert.ok(markup.includes("—"), `${kind} renderas utan em-streck`);
    assert.ok(markup.includes('data-chain-absent="true"'), `${kind} saknar sin orsak`);
  }
});

test("ROOM-03-FRÅNVARO: attempt utan attempt_id i strömmen blir ABSENT, aldrig ett ordningstal", () => {
  const snapshot = snapshotOrThrow();
  assert.ok(snapshot.current_task);
  assert.notEqual(
    snapshot.current_task.attempt.n,
    null,
    "fixturens aktuella uppgift saknar attempt.n — provet mäter inte det det säger",
  );
  const attempt = hop(chainFor(snapshot.current_task.task_id), "attempt");
  assert.equal(attempt.present, false, "ett ordningstal blev en identitet");
  assert.equal(attempt.absent_reason, ATTEMPT_ABSENT_NOTE);
});

/* ────────────────────────────────────────────────────────────────────────────
 * 7 · MARKUPEN: MASKINLÄSBAR, ÄRLIG OCH ALDRIG PÅSTÅENDE UTAN ID
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-03-MARKUP: inget hopp renderas som närvarande med tomma id", () => {
  const snapshot = snapshotOrThrow();
  /* Varje vy mäts FÖR SIG: en hopslagen sträng hade bara mätt den första renderingen. */
  for (const task of [snapshot.current_task, ...allFixtureTasks()]) {
    assert.deepEqual(
      presentHopsWithoutIds(renderChain(task)),
      [],
      `${task?.task_id}: ett hopp påstår närvaro utan identifierare`,
    );
  }

  /* LÖGNSTUBBE: ett hopp som märks närvarande men saknar id-lista MÅSTE fällas. */
  const stub =
    '<li data-chain-hop="task" data-chain-present="true"><span>utan id</span></li>';
  assert.deepEqual(presentHopsWithoutIds(stub), ["task"], "mätaren ser inte ett tomt hopp");

  // Och de maskinläsbara attributen finns på varje hopp.
  for (const block of hopBlocks(renderChain(snapshot.current_task))) {
    for (const attribute of ["data-chain-hop", "data-chain-bound-by", "data-chain-present"]) {
      assert.ok(block.markup.includes(`${attribute}=`), `${block.kind} saknar ${attribute}`);
    }
  }
});

test("ROOM-03-MARKUP: bindningen som renderas är alltid ett id ur den validerade posten", () => {
  const outcome = linkedOutcome();
  const answer = outcome.controller_answer;
  assert.ok(answer);
  const task = answer.tasks[0];
  const html = renderChain(task);
  const chain = chainFor(task.task_id);

  for (const block of hopBlocks(html)) {
    const match = block.markup.match(/data-chain-bound-by="([^"]*)"/);
    assert.ok(match, `${block.kind} saknar data-chain-bound-by`);
    const keys = match[1].split(" ").filter((key) => key.length > 0);
    const projected = hop(chain, block.kind as ChainHopKind);
    assert.deepEqual(keys, projected.bound_by.map((id) => id.key));
    for (const key of keys) {
      assert.ok(
        (CHAIN_IDENTITY_KEYS as readonly string[]).includes(key),
        `${block.kind}: markupen påstår en bindning på ${key}`,
      );
    }
  }

  // Kommandots id står i markupen som ett verkligt värde, inte som en omskrivning.
  assert.ok(html.includes(`data-value="${outcome.command?.command_id}"`));
  assert.ok(html.includes(`data-value="${task.task_id}"`));
});

test("ROOM-03-MARKUP: kedjan är märkt som FIXTUR och blandas aldrig med live-strömmen", () => {
  const snapshot = snapshotOrThrow();

  // Utan fixturläge visas ingen kedja alls — hellre tomt än en kedja mot en omärkt källa.
  const live = renderChain(snapshot.current_task, false);
  assert.equal(hopBlocks(live).length, 0, "fixturposter läckte in i en icke-fixturvy");
  assert.ok(live.includes('data-chain-unavailable="no-fixture"'));
  assert.ok(live.includes(CHAIN_NO_FIXTURE_TEXT));

  // Utan aktuell uppgift: tomläge MED orsak, aldrig en uppgift lyft ur kön.
  const noTask = renderChain(null);
  assert.equal(hopBlocks(noTask).length, 0);
  assert.ok(noTask.includes('data-chain-unavailable="no-task"'));
  assert.ok(noTask.includes(CHAIN_NO_TASK_TEXT));

  // I rummet är kedjan monterad, märkt som fixtur — och rummet har fortfarande EN anslutning.
  const room = renderRoom(snapshot, true);
  assert.ok(room.includes('data-causal-chain="true"'), "kedjan monteras inte i rummet");
  assert.ok(room.includes('data-chain-source="fixture"'), "kedjan märks inte som fixtur");
  assert.equal((room.match(/data-event-stream="true"/g) ?? []).length, 1, "fler än en strömyta");
  assert.equal((room.match(/data-column="/g) ?? []).length, 3, "rummets tre kolumner ändrades");

  // Kedjan ligger i fokusbanan, hos den uppgift den beskriver.
  const markup = withoutStyles(room);
  const railStart = markup.indexOf('data-task-focus-rail="true"');
  const trayStart = markup.indexOf('data-output-tray="true"');
  assert.ok(railStart >= 0 && trayStart > railStart);
  assert.ok(
    markup.slice(railStart, trayStart).includes('data-causal-chain="true"'),
    "kedjan ligger utanför fokusbanan",
  );

  assert.equal(CAUSAL_CHAIN_MODE, "FIXTURE_PROJECTION");
  assert.equal(CAUSAL_CHAIN_LIVE_BLOCKED_ON, "nortropic-system S5 + S13");
  assert.ok(room.includes(CAUSAL_CHAIN_LIVE_BLOCKED_ON), "blockeringen sägs inte i rummet");
});

test("ROOM-03-AUTHORITY: kedjan bär inget uppgiftstillstånd och viker aldrig strömmen själv", () => {
  const snapshot = snapshotOrThrow();
  const html = renderChain(snapshot.current_task);
  // Rådatan ÄR posten och får innehålla allt; prosan runt den får inte bära ett tillstånd.
  const prose = html.replace(/<pre[\s\S]*?<\/pre>/g, " ").replace(/<[^>]+>/g, " ");
  for (const state of Object.values(TASK_LIFECYCLE_PRESENTATION)) {
    assert.ok(
      !prose.includes(state.label),
      `kedjan renderar uppgiftstillståndet «${state.label}» — det ägs av snapshoten och kortet`,
    );
  }

  /*
    INGEN EGEN FOLD. ROOM-01:s frysta regel gäller rummets alla filer: ingen av dem får bygga en
    läsmodell eller vika strömmen. Kedjan tar därför emot REDAN VALIDERADE poster och läser bara
    identifierare ur dem; den enda ordningshjälp den använder är V1:s `orderEvents`, som är
    `seq` ensamt.
  */
  for (const path of ["lib/loop/room/causality.ts", "components/loop/room/CausalChain.tsx"]) {
    const code = stripComments(readSlice(path));
    for (const pattern of [/buildReadModel/, /projectEvents/, /liveRows/, /validateEvents/]) {
      assert.ok(!pattern.test(code), `${path} bygger en egen fold över strömmen (${pattern})`);
    }
  }
  assert.match(
    stripComments(readSlice("lib/loop/room/causality.ts")),
    /orderEvents/,
    "kedjan ordnar strömmen med något annat än V1:s seq-komparator",
  );

  // Uppgiftsposten läses ur controllerns snapshot, och inget tillstånd renderas av kedjan.
  assert.equal(CAUSAL_ORDER.LIFECYCLE_STATE_AUTHORITY, "CONTROLLER_PUBLISHED_SNAPSHOT");
  assert.equal(CAUSAL_ORDER.LIFECYCLE_STATE_RENDERED_HERE, "NO");
  assert.equal(CAUSAL_ORDER.CLIENT_SIDE_FOLD_IS_AUTHORITY, "NO");
  assert.equal(CAUSAL_ORDER.RAW_RECORDS_HIDDEN, "NO");

  // En uppgift utan snapshotpost får INGEN post lyft ur en annan hink eller ur strömmen.
  const orphan = chainFor("p-finns-inte", { snapshot: null });
  for (const one of orphan.hops) assert.equal(one.present, false, `${one.kind}: uppfanns`);
  assert.deepEqual(orphan.violations, []);
});

/* ────────────────────────────────────────────────────────────────────────────
 * 8 · BEVISREFERENSER ÄR REFERENSER
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-03-BEVIS: varje bevisreferens kommer ordagrant ur en validerad post", () => {
  const raw = RAW_FIXTURES.events as unknown as {
    task_id: string | null;
    evidence_refs: string[];
  }[];
  const known = new Set<string>([
    ...raw.flatMap((event) => event.evidence_refs),
    ...allFixtureTasks().flatMap((task) => task.evidence_refs),
  ]);
  assert.ok(known.size > 0, "fixturen bär inga bevisreferenser — mätaren mäter ingenting");

  let rendered = 0;
  for (const taskId of allChainTaskIds()) {
    for (const one of chainFor(taskId).hops) {
      for (const ref of one.evidence_refs) {
        assert.ok(known.has(ref), `bevisreferensen ${ref} finns inte i någon validerad post`);
        rendered += 1;
      }
      // Listan är en MÄNGD av referenser — samma referens skrivs aldrig ut två gånger.
      assert.equal(
        new Set(one.evidence_refs).size,
        one.evidence_refs.length,
        `${taskId}/${one.kind}: bevisreferenserna innehåller dubbletter`,
      );
    }
  }
  assert.ok(rendered > 0, "ingen bevisreferens nådde kedjan");

  // Referensen är en REFERENS: ytan hämtar ingen nyttolast och läser ingen hemlighet.
  const html = renderChain(snapshotOrThrow().current_task);
  assert.ok(html.includes(EVIDENCE_REFERENCE_NOTE), "bevisregeln sägs inte vid ytan");
  for (const path of SLICE_FILES) {
    const code = stripComments(readSlice(path));
    for (const pattern of [/process\.env/, /\bfetch\s*\(/, /readFile/, /createHash/]) {
      assert.ok(!pattern.test(code), `${path}: hämtar eller läser något (${pattern})`);
    }
  }
});

test("ROOM-03-BEVIS: samma referens i två poster skrivs ut EN gång — och finns kvar rått i båda", () => {
  /*
    Fixturen råkar i dag ha unika bevisreferenser. Mätaren får inte vila på den turen: här
    konstrueras en leverans där TVÅ event för samma uppgift bär SAMMA referens. Listan ska då
    innehålla referensen en gång (den är en mängd av referenser, inte en räkning), medan
    multipliciteten finns kvar där den betyder något — i den råa posten, ordagrant.
  */
  const rawEvents = structuredClone(RAW_FIXTURES.events) as unknown as {
    task_id: string | null;
    evidence_refs: string[];
    attempt_id: string | null;
  }[];
  const taskId = rawEvents.find((event) => event.task_id !== null)?.task_id;
  assert.ok(taskId);

  const shared = "evidence-ref-delad";
  const touched = rawEvents.filter((event) => event.task_id === taskId).slice(0, 2);
  assert.equal(touched.length, 2, "fixturen har inte två event för samma uppgift");
  for (const event of touched) {
    event.evidence_refs = [...event.evidence_refs, shared];
    event.attempt_id = event.attempt_id ?? "a-delad";
  }

  const chain = chainFor(taskId, { events: validEvents(rawEvents) });
  assert.deepEqual(chain.violations, []);
  for (const kind of ["run", "attempt"] as const) {
    const one = hop(chain, kind);
    assert.equal(one.present, true, `${kind} byggdes inte`);
    assert.equal(
      one.evidence_refs.filter((ref) => ref === shared).length,
      1,
      `${kind}: den delade referensen skrevs ut mer än en gång`,
    );
    assert.equal(new Set(one.evidence_refs).size, one.evidence_refs.length);
    // Rådatan är oförkortad: BÅDA posterna bär fortfarande sin egen referens.
    assert.equal(
      (one.raw ?? "").split(shared).length - 1,
      2,
      `${kind}: rådatan tappade en av posternas bevisreferens`,
    );
  }

  // LÖGNSTUBBE: mätaren måste kunna fälla en lista som FAKTISKT bär dubbletter.
  const duplicated = [shared, shared];
  assert.notEqual(new Set(duplicated).size, duplicated.length, "dubblettmätaren mäter ingenting");

  // Och renderingen ger varje bevisrad en egen nyckel även om listan skulle bära dubbletter.
  const markup = renderToStaticMarkup(
    createElement(CausalChain, { task: snapshotOrThrow().current_task, fixture: true }),
  );
  assert.ok(!markup.includes("undefined"), "en bevisrad renderades utan värde");
});

/* ────────────────────────────────────────────────────────────────────────────
 * 9 · V2/V10-SCANNINGEN UTSTRÄCKT ÖVER SKIVANS FILER
 * ──────────────────────────────────────────────────────────────────────────── */

const FORBIDDEN: { pattern: RegExp; why: string; scope: "raw" | "code"; stub: string }[] = [
  {
    pattern: /<progress|role=["']progressbar|aria-valuenow|<meter\b/i,
    why: "framstegselement",
    scope: "raw",
    stub: '<progress value="1" max="2" />',
  },
  {
    pattern: /\b(progressbar|progress-bar|framstegsstapel|procentsats|percentage)\b/i,
    why: "framstegs-/procentsemantik",
    scope: "code",
    stub: "export const percentage = 1;",
  },
  {
    pattern: /@keyframes|animation:|animate-|\bpulse\b|\bblink\b/i,
    why: "fabricerad liveness-rörelse",
    scope: "raw",
    stub: ".rm-x { animation: pulse 1s infinite; }",
  },
  {
    pattern: /console\.(log|info|warn|error|debug|trace)\s*\(/,
    why: "loggning",
    scope: "code",
    stub: "console.log(1);",
  },
  {
    pattern: /EventSource|WebSocket|XMLHttpRequest|child_process|\beval\s*\(|new Function\s*\(/,
    why: "anslutning eller exekvering",
    scope: "code",
    stub: "const s = new EventSource(url);",
  },
  {
    pattern: /github-read|github-write|GITHUB_TOKEN|simple-git|octokit/i,
    why: "credentialväg",
    scope: "code",
    stub: 'import { x } from "@/lib/github-write";',
  },
];

test("ROOM-03-NEG: skivans filer bär varken procent, framsteg, rörelse eller förbjuden kodväg", () => {
  for (const path of SLICE_FILES) {
    const source = readSlice(path);
    assert.ok(!source.includes("%"), `procenttecken i ${path}`);
    for (const rule of FORBIDDEN) {
      const measured = rule.scope === "raw" ? source : stripComments(source);
      assert.ok(!rule.pattern.test(measured), `${rule.why} i ${path}`);
    }
    assert.ok(
      !stripComments(source).includes(OWNER_ACTION_LABEL),
      `${path} bär etiketten som inte får renderas`,
    );
  }

  // LÖGNSTUBBAR: varje mönster måste fälla sitt eget brott.
  for (const rule of FORBIDDEN) {
    assert.ok(rule.pattern.test(rule.stub), `mönstret för ${rule.why} fäller inte sin egen stubbe`);
  }

  const snapshot = snapshotOrThrow();
  const html = [
    renderRoom(snapshot, true),
    renderRoom(snapshot, false),
    renderChain(snapshot.current_task),
  ].join("\n");
  assert.ok(!html.includes("%"), "procenttecken i markupen");
  assert.ok(!/<progress|<meter\b|progressbar|aria-valuenow/i.test(html), "framstegselement i markup");
  assert.ok(!/@keyframes|animation:/i.test(html), "rörelse i markupen");
  assert.ok(!withoutStyles(html).includes(OWNER_ACTION_LABEL), "rummet påstod ägaråtgärd");
});
