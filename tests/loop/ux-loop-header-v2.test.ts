/**
 * UX-LOOP-HEADER-V2 · Sidhuvudets sanning och CTA:ns rendering på /loop.
 *
 * VAD PROVET ÄGER
 * ---------------
 * H1 · Sidhuvudet påstår inte längre att /loop saknar kommandoyta och eventström. Texten skiljer
 *      LIVE (strömpanelen läser kontrollplanet) från KONTRAKTSLÄGE (kommandokanalen svarar 503)
 *      från FIXTUR (statusrad, kolumner och kort) — och påståendena mäts mot vad sidan FAKTISKT
 *      monterar, inte mot sig själva.
 * H2 · Formen: ingressen är kort, segmenten är korta och avgränsade, och radlängden har ett tak
 *      i CSS. En ~330 teckens oavgränsad caption-paragraf faller här.
 * H3 · Den primära CTA:n till /loop/mata renderas PÅ /loop och navigerar med next/link — ingen
 *      full dokumentladdning av kontrollrummet.
 *
 * HARNESS-NOT: samma skäl som i tests/loop/v2-maskinen-shell.test.ts — tsconfig har
 * `jsx: "preserve"`, så de DELADE komponenterna (PageHeader) behöver en global React när de
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

import MaskinHeader from "../../components/loop/MaskinHeader";
import BacklogColumn from "../../components/loop/BacklogColumn";
import {
  MASKIN_HEADER_CSS,
  MASKIN_HEADER_SUB,
  MASKIN_HEADER_TRANSPORT_NOTE,
  maskinHeaderTruth,
  type HeaderTruthSegment,
} from "../../components/loop/ui";
import MaskinenPage from "../../app/(app)/loop/page";
import { COMMAND_QUEUE_BLOCKED_ON, commandChannelEnabled } from "../../lib/loop/commands";
import { FIXTURE_MODE } from "../../lib/loop/fixtures";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

function sourceOf(relative: string): string {
  return readFileSync(join(REPO_ROOT, relative), "utf8");
}

/** Kod utan kommentarer — en fil som beskriver en regel i klartext får inte fällas av sin egen text. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function headerHtml(fixture = FIXTURE_MODE): string {
  return renderToStaticMarkup(createElement(MaskinHeader, { fixture }));
}

/** Markupen utan stilarket: påståenden om vad UI:t SÄGER mäts på det som syns. */
function withoutStyles(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

/** Synlig text, taggarna bortskalade och blanktecken normaliserade. */
function visibleText(html: string): string {
  return withoutStyles(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Varje sammanhängande textnod i markupen — måttet på "en enda lång paragraf". */
function textNodes(html: string): string[] {
  return withoutStyles(html)
    .split(/<[^>]+>/g)
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter((chunk) => chunk.length > 0);
}

/** Sidan renderad som markup, med grinden öppen. */
function pageHtml(): string {
  const before = process.env.LOOP_ENABLED;
  try {
    process.env.LOOP_ENABLED = "true";
    return renderToStaticMarkup(MaskinenPage() as React.ReactElement);
  } finally {
    if (before === undefined) delete process.env.LOOP_ENABLED;
    else process.env.LOOP_ENABLED = before;
  }
}

function segmentFor(segments: HeaderTruthSegment[], id: HeaderTruthSegment["id"]): HeaderTruthSegment {
  const found = segments.find((segment) => segment.id === id);
  assert.ok(found, `sidhuvudet saknar segment för ${id}`);
  return found;
}

/* ── H1 · Sidhuvudets sanning ─────────────────────────────────────────────── */

test("H1: sidhuvudet påstår inte längre att /loop saknar kommandoyta och eventström", () => {
  /*
    Den gamla texten löd "Fixturläge — ingen livedata, inga kommandon, ingen authority." medan
    sidan monterade BÅDE V7:s kommandoyta och V9:s strömpanel. En osann etikett är värre än
    ingen etikett: nästa läsare tror att panelerna nedanför är dekoration.
  */
  const text = visibleText(headerHtml());

  for (const claim of [
    /inga kommandon/i,
    /ingen eventström/i,
    /ingen ström/i,
    /ingen transport/i,
    /ingen kommandoyta/i,
    /ingen livedata/i,
  ]) {
    assert.ok(!claim.test(text), `sidhuvudet påstår fortfarande ${claim} trots att ytan finns`);
  }

  // Och den gamla meningen finns inte kvar någonstans i routen.
  assert.ok(
    !/ingen livedata, inga kommandon/i.test(sourceOf("app/(app)/loop/page.tsx")),
    "routens gamla, osanna undertext ligger kvar",
  );
});

test("H1: texten skiljer LIVE, KONTRAKTSLÄGE och FIXTUR åt — en yta i taget", () => {
  const html = headerHtml(true);
  const segments = maskinHeaderTruth({ fixture: true, channelEnabled: false });

  // Ett segment per yta, med det läge ytan verkligen har.
  assert.deepEqual(
    segments.map((segment) => [segment.id, segment.mode]),
    [
      ["stream", "live"],
      ["commands", "contract"],
      ["snapshot", "fixture"],
    ],
  );

  // Läsplanet: LIVE, med det ärliga tomläget utskrivet — aldrig som ett fel och aldrig som "nästan".
  const stream = segmentFor(segments, "stream");
  assert.match(stream.text, /eventström/i, "live-segmentet namnger inte eventströmmen");
  assert.match(stream.text, /tom/i, "det ärliga tomläget står inte utskrivet");

  // Kommandokanalen: KONTRAKTSLÄGE med svarskoden och backendens ägare, ordagrant ur V7.
  const commands = segmentFor(segments, "commands");
  assert.match(commands.text, /503/, "kontraktsläget nämner inte svarskoden");
  assert.ok(
    commands.text.includes(COMMAND_QUEUE_BLOCKED_ON),
    "kontraktsläget namnger inte backendens ägare av kommandokön",
  );
  assert.ok(
    !/live|direkt|fungerar/i.test(commands.text),
    "kommandokanalen beskrevs som en fungerande väg",
  );

  // Fixturen: märkt som fixtur, aldrig som livedata.
  const snapshot = segmentFor(segments, "snapshot");
  assert.match(snapshot.text, /fixtur/i, "fixturkällan märks inte ut som fixtur");
  assert.ok(!/\blive\b/i.test(snapshot.text), "fixturen beskrevs som live");

  // Distinktionen bärs i markupen, inte bara i prosan.
  for (const mode of ["live", "contract", "fixture"]) {
    assert.ok(
      html.includes(`data-truth-mode="${mode}"`),
      `läget ${mode} går inte att läsa ur markupen`,
    );
  }
  assert.equal((html.match(/data-truth-source="/g) ?? []).length, 3, "antalet segment är inte tre");
});

test("H1: påståendena stämmer med vad sidan FAKTISKT monterar", () => {
  /*
    Sanningstexten är bara sann så länge den beskriver samma sida som renderas. Provet läser
    därför skalet och sidan, inte texten mot sig själv.
  */
  const shell = stripComments(sourceOf("components/loop/MaskinShell.tsx"));
  assert.match(shell, /<CommandDeck/, "skalet monterar ingen kommandoyta — kontraktsläget vore påhittat");
  assert.match(shell, /<LiveEventStream/, "skalet monterar ingen strömpanel — live-påståendet vore falskt");

  // Kanalen är stängd på riktigt (V7:s ärlighetskonstant), alltså är "kontraktsläge" rätt ord.
  assert.equal(commandChannelEnabled(), false, "kanalen är öppen — texten skulle då ljuga om 503");
  // Kolumnerna kommer på riktigt ur fixturen.
  assert.equal(FIXTURE_MODE, true, "fixturläget är av — fixturmärkningen skulle då vara osann");

  const page = pageHtml();
  assert.ok(page.includes('data-maskin-header="true"'), "sidhuvudet renderas inte på /loop");
  assert.ok(page.includes('data-command-deck="true"'), "kommandoytan renderas inte på /loop");
  assert.ok(page.includes('data-truth-mode="contract"'), "kontraktsläget syns inte på /loop");
  assert.ok(page.includes('data-truth-mode="fixture"'), "fixturmärkningen syns inte på /loop");
});

test("H1: texten följer läget — inget påstående skrivs för hand", () => {
  // Öppnas kanalen försvinner 503-påståendet av sig självt.
  const openChannel = maskinHeaderTruth({ fixture: true, channelEnabled: true });
  const commands = segmentFor(openChannel, "commands");
  assert.equal(commands.mode, "live");
  assert.ok(!commands.text.includes("503"), "en öppen kanal påstods fortfarande svara 503");

  // Och utan fixtur påstås ingen fixtur.
  const liveSnapshot = maskinHeaderTruth({ fixture: false, channelEnabled: false });
  const snapshot = segmentFor(liveSnapshot, "snapshot");
  assert.equal(snapshot.mode, "live");
  assert.ok(!/fixtur/i.test(snapshot.text), "en icke-fixtur märktes som fixtur");
  assert.ok(
    !/fixtur/i.test(visibleText(headerHtml(false))),
    "fixturordet ligger kvar i markupen när fixturläget är av",
  );
});

test("H1: strömsegmentets LIVE betecknar KÄLLAN — transportläget ägs av panelen", () => {
  /*
    Fyndet HDR-STREAM-MODE-HARDCODED: strömsegmentets `mode` är konstant medan `commands` och
    `snapshot` härleds. Asymmetrin är AVSIKTLIG och får därför bäras av tre mekaniska krav:

      1 · Segmentet påstår aldrig att transporten är uppe, ansluten eller konfigurerad. Det
          säger vilken KÄLLA panelen läser, och skriver ut det ärliga tomläget.
      2 · Sidhuvudet duplicerar inte panelens rörliga läge — det HÄNVISAR till det, så att
          "LIVE" i huvudet och "transporten är inte konfigurerad" i panelen inte läses som en
          motsägelse på fotoytan.
      3 · Skälet står utskrivet i components/loop/ui.ts, så nästa läsare inte "rättar" en
          medveten konstant till en gissad flagga.
  */
  const stream = segmentFor(maskinHeaderTruth({ fixture: true }), "stream");

  for (const claim of [
    /\bansluten\b/i,
    /\buppkopplad\b/i,
    /\bkonfigurerad\b/i,
    /\bstr[öo]mmar\b/i,
    /\bjust nu\b/i,
    /\brealtid\b/i,
  ]) {
    assert.ok(
      !claim.test(stream.text),
      `strömsegmentet påstår ${claim} — det är panelens rörliga läge, inte huvudets`,
    );
  }
  // Källan och tomläget står däremot utskrivna.
  assert.match(stream.text, /kontrollplanet/i, "källan namnges inte");
  assert.match(stream.text, /tom/i, "det ärliga tomläget står inte utskrivet");

  // Hänvisningen finns, och pekar på panelen som faktiskt bär läget.
  assert.match(MASKIN_HEADER_TRANSPORT_NOTE, /transportläge/i);
  assert.match(MASKIN_HEADER_TRANSPORT_NOTE, /panel/i);
  const markup = withoutStyles(headerHtml());
  assert.ok(markup.includes('data-truth-note="transport"'), "hänvisningen renderas inte");
  assert.ok(markup.includes(MASKIN_HEADER_TRANSPORT_NOTE), "hänvisningens text når inte markupen");

  // Och panelen bär verkligen läget — annars vore hänvisningen en tom gest.
  const panel = sourceOf("components/loop/EventStream.tsx");
  assert.match(panel, /data-transport-mode=/, "strömpanelen renderar inget transportläge");

  // Avsikten är dokumenterad där konstanten bor.
  const ui = sourceOf("components/loop/ui.ts");
  assert.ok(
    /betecknar KÄLLAN/.test(ui),
    "ui.ts dokumenterar inte att LIVE betecknar källan, inte transportstatus",
  );
  assert.ok(
    /ÄGS AV PANELEN/.test(ui),
    "ui.ts dokumenterar inte vem som äger det rörliga transportläget",
  );
});

/* ── H2 · Textens form ────────────────────────────────────────────────────── */

test("H2: ingressen är kort och segmenten är korta — ingen oavgränsad paragraf", () => {
  /*
    Rond 6-fyndet ur UX-ADVISORY-SWEEP-V1: sanningen hade blivit en ~330 teckens oavgränsad
    paragraf i caption-storlek. Taket nedan gäller SYNLIG text, inte källkod.
  */
  assert.ok(
    MASKIN_HEADER_SUB.length < 160,
    `ingressen är ${MASKIN_HEADER_SUB.length} tecken — riktmärket är under 160`,
  );

  for (const segment of maskinHeaderTruth({ fixture: true, channelEnabled: false })) {
    assert.ok(
      segment.text.length <= 100,
      `segmentet ${segment.id} är ${segment.text.length} tecken — segmenten ska vara korta`,
    );
  }

  // Ingen enskild textnod i det renderade sidhuvudet får vara en lång paragraf.
  const longest = textNodes(headerHtml()).reduce((max, node) => Math.max(max, node.length), 0);
  assert.ok(longest < 160, `längsta textnoden är ${longest} tecken — sanningen blev en paragraf`);

  // Och sanningen står i avgränsade segment, inte i en löpande mening. Räkningen görs på
  // markupen UTAN stilarket — annars räknas CSS-regelns egen selektor med.
  const markup = withoutStyles(headerHtml());
  assert.ok(markup.includes('data-header-truth="true"'));
  assert.equal((markup.match(/mk-header-truth-row/g) ?? []).length, 3);
});

test("H2: radlängden har ett tak i CSS, och taket når markupen", () => {
  assert.match(
    MASKIN_HEADER_CSS,
    /\.mk-header \.ph-sub \{[^}]*max-width:\s*\d+ch/,
    "undertexten saknar max-bredd — radlängden blir oläsbar på desktop",
  );
  assert.match(
    MASKIN_HEADER_CSS,
    /\.mk-header-truth \{[^}]*max-width:\s*\d+ch/,
    "sanningssegmenten saknar max-bredd",
  );
  assert.match(
    MASKIN_HEADER_CSS,
    /\.mk-header-truth-note \{[^}]*max-width:\s*\d+ch/,
    "hänvisningen till panelens transportläge saknar max-bredd",
  );

  const html = headerHtml();
  assert.ok(html.includes(MASKIN_HEADER_CSS), "sidhuvudets stilark når aldrig markupen");

  // app/globals.css är inte den här skivans yta: `.ph-sub` delas av hela appen.
  assert.ok(
    !/\.ph-sub[^{]*\{[^}]*max-width/.test(sourceOf("app/globals.css")),
    "det delade .ph-sub fick en max-bredd — taket ska gälla /loop, inte hela appen",
  );

  // Samma invarianter som resten av /loop-trädet: ingen procent, ingen rörelse.
  assert.ok(!html.includes("%"), "procenttecken i sidhuvudets markup");
  assert.ok(!/@keyframes|animation:/i.test(html), "animation i sidhuvudet");
});

/* ── H3 · CTA:n på /loop ──────────────────────────────────────────────────── */

test("H3: CTA:n till /loop/mata renderas PÅ /loop och navigerar med next/link", () => {
  const source = stripComments(sourceOf("components/loop/BacklogColumn.tsx"));
  assert.match(source, /import Link from "next\/link"/, "CTA:n importerar inte next/link");
  assert.match(source, /<Link className="mk-link" href="\/loop\/mata"/, "CTA:n använder inte Link");
  assert.ok(
    !/<a\s[^>]*href="\/loop\/mata"/.test(source),
    "en rå <a> till intake-routen finns kvar — den river hela kontrollrummet",
  );

  // Renderad på /loop: en riktig länk, rätt mål, kvar i markupen.
  const page = pageHtml();
  assert.match(page, /<a[^>]*href="\/loop\/mata"[^>]*>/, "CTA:n renderar ingen länk på /loop");
  assert.ok(page.includes('data-intake-cta="true"'), "CTA:ns märkning saknas på /loop");
  assert.ok(page.includes("Mata maskinen"), "CTA:ns text saknas på /loop");

  // Även med tom backlog står CTA:n kvar — den är kolumnens ingång, inte en följd av innehåll.
  const empty = renderToStaticMarkup(createElement(BacklogColumn, { tasks: [] }));
  assert.match(empty, /<a[^>]*href="\/loop\/mata"[^>]*>/);
});
