/**
 * V2 · Maskinen (/loop) — Fabriksrummet i SHOWROOM-läge.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — ROUTE_PLAN, TARGET_UX och
 * IMPLEMENTATION_SLICES §V2, med produktsynlighetsregeln UPPHÄVD av ägarbeslutet i
 * docs/nortropic-factory-room-roadmap-erratum-01.md (SHOWROOM_BEFORE_BACKEND_COMPLETE=YES,
 * HIDE_LOOP_ROUTE_UNTIL_BACKEND=NO, FIXTURE_DATA_MUST_BE_EXPLICITLY_LABELLED=YES).
 *
 * BINDANDE REGLER
 * ---------------
 * · SYNLIGHET: den INLOGGADE routen renderar alltid. Den gamla regeln "utan `LOOP_ENABLED=true`
 *   finns routen inte" gällde produktens synlighet och är upphävd; inloggningen (middleware.ts +
 *   auth()) och /api/loop-grinden (components/loop/flag.ts) är oförändrade. En dold route var
 *   aldrig en säkerhetsgräns — den dolde bara produkten.
 * · LÄGET ÄR EXPLICIT: `factoryRoomMode()` löser ut "SHOWROOM" och skickas in i skalen, som
 *   märker varje yta med `data-room-mode`. Läget kan inte flyttas av en env-variabel
 *   (lib/loop/room/mode.ts), bara av den skiva som gör live sant (ROOM-05, backend S5 + S13).
 * · Kolumnernas datakälla är V1:s GENERERADE fixtur (lib/loop/fixtures). Den är ALDRIG livedata,
 *   märks ut som simulerad fabriksdata i UI:t, och den delen är inte live-komplett i någon mening.
 * · Sidan monterar sedan V7:s kommandoyta (kanalen STÄNGD — 503 tills backendens skiva finns)
 *   och V9:s strömpanel (som talar med kontrollplanets läsyta på riktigt). Distinktionen —
 *   live / kontraktsläge / showroom — bärs av MaskinHeader och härleds ur de faktiska lägena.
 * · Routen rör fortfarande ingen Git-, ref-, verifierings- eller promotionsväg och äger ingen
 *   authority: den läser en fixtur, renderar den och låter panelerna bära sina egna lägen.
 * · `force-dynamic` gör att läget läses vid REQUEST, inte bakas in vid build.
 *
 * SHREDDER-01B · SCENARIOVALET
 * ----------------------------
 * Adressen får bära ETT valfritt urval: `?scenario=…`, validerat mot den slutna listan i
 * lib/loop/room/scenarios.ts. Reglerna som gör det ofarligt:
 *
 *   · Utan parameter — och vid varje okänt, upprepat eller tomt värde — renderas EXAKT samma
 *     fixtur som förut (`fixtureSnapshot()`), alltså är den omärkta adressen oförändrad.
 *   · Urvalet går bara mellan GENERERADE, schemavaliderade ögonblicksbilder. Ingen handskriven
 *     data finns i vägen, och ingen scenario kan hitta på ett tillstånd.
 *   · Valet är ingen intention: inget kommando köas, ingen transport rörs och controllern får
 *     aldrig veta att det gjordes. Det är en visning av simulerad fabriksdata.
 */
import { use, type ReactElement } from "react";
import MaskinHeader from "@/components/loop/MaskinHeader";
import MaskinShell from "@/components/loop/MaskinShell";
import ScenarioPicker from "@/components/loop/room/ScenarioPicker";
import { FIXTURE_MODE } from "@/lib/loop/fixtures";
import { factoryRoomMode } from "@/lib/loop/room/mode";
import { SCENARIO_PARAM, resolveScenario, scenarioSnapshot } from "@/lib/loop/room/scenarios";

export const dynamic = "force-dynamic";

/** Adressens frågeparametrar, i den form Next levererar dem. */
type ScenarioSearch = { [key: string]: string | string[] | undefined };

/** Routens propsform. Fältet är valfritt — routen fungerar utan att någon parameter finns. */
type MaskinenPageProps = { searchParams?: Promise<ScenarioSearch> };

/**
 * TVÅ SIGNATURER, EN IMPLEMENTATION — OCH BÅDA ÄR KRAV, INTE STIL.
 *
 * · Next typkontrollerar routens FÖRSTA argument mot sin egen `PageProps` (.next/types/app/**):
 *   kontrollen kräver att argumenttypen UTVIDGAR PageProps. Både ett frågetecken (`props?:`)
 *   OCH en defaultparameter (`props: X = {}`) ger `Parameters<typeof MaskinenPage>[0]` värdet
 *   `X | undefined` — och `undefined` utvidgar ingenting, så bygget faller på båda. MÄTT, inte
 *   antaget: defaultparametern provades först och gav exakt det felet.
 *   Med en ÖVERLAGRING läser TypeScript i stället den SISTA deklarerade signaturen, som bär
 *   parametern utan `undefined`. Det är därför överlagringen står här.
 * · Provfilerna (showroom-contract, V2, ux-loop-header, och den här skivans egen) anropar
 *   `MaskinenPage()` UTAN argument och renderar resultatet synkront. Den första signaturen
 *   håller det anropet giltigt.
 *
 * Överlagringen är dessutom robust åt båda hållen: väljer TS den sista signaturen får Next
 * `MaskinenPageProps` (utvidgar PageProps), väljer den den första blir `FirstArg` `any`, som
 * Next självt släpper igenom. Ingen av vägarna kan alltså tysta kontrollen.
 */
function MaskinenPage(): ReactElement;
function MaskinenPage(props: MaskinenPageProps): ReactElement;
function MaskinenPage(props?: MaskinenPageProps): ReactElement {
  const mode = factoryRoomMode();
  const searchParams = props?.searchParams;

  /*
    Parametern läses BARA när routen faktiskt fick några. Utan dem tas ingen väg alls — därför
    är den omärkta renderingen byte för byte densamma som före den här skivan, och provet som
    fryser routens props mäter fortfarande det den skrevs för.

    Formen tolereras i båda sina utföranden (utlovad respektive redan uppslagen) eftersom det är
    ramverkets sak, inte produktens: ett urval får aldrig hänga på vilken form ramverket råkar
    skicka in.
  */
  const requested =
    searchParams === undefined
      ? undefined
      : typeof (searchParams as { then?: unknown }).then === "function"
        ? use(searchParams)[SCENARIO_PARAM]
        : (searchParams as unknown as ScenarioSearch)[SCENARIO_PARAM];

  const scenario = resolveScenario(requested);
  const snapshot = scenarioSnapshot(scenario);

  return (
    <>
      <MaskinHeader fixture={FIXTURE_MODE} mode={mode} />
      <ScenarioPicker current={scenario} mode={mode} />
      <MaskinShell snapshot={snapshot} fixture={FIXTURE_MODE} mode={mode} />
    </>
  );
}

/*
  Default-exporten står som ett eget uttalande eftersom en överlagrad funktion inte kan bära
  `export default` på varje signatur. Routen är oförändrad för Next: modulen exporterar samma
  två namn som förut — `default` och `dynamic`, och ingenting mer (Next fäller extra exporter).
*/
export default MaskinenPage;
