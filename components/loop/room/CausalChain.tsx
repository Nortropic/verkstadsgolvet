/**
 * ROOM-03 · Orsakskedjan för rummets aktuella uppgift — FIXTURSIDANS projektion.
 *
 * VAD YTAN ÄR — OCH INTE ÄR
 * -------------------------
 * En presentation av `lib/loop/room/causality.ts`: operatör/källa → kommando → körning →
 * uppgift → försök → agentsession → kandidat → verifiering → granskning → attestation →
 * promotion. Varje länk som skrivs ut bärs av ett VERKLIGT id ur en validerad post. Ett hopp
 * utan bindande identifierare renderas som "—" med sin ordagranna orsak — aldrig gissat, aldrig
 * härlett ur närhet eller tidsstämplar.
 *
 * Ytan är ALDRIG live-komplett: den fulla kedjan kräver nortropic-system S5 + S13. Den märks
 * därför som fixtur, maskinläsbart (`data-chain-source="fixture"`), och blandas aldrig med
 * strömpanelens live-yta.
 *
 * BINDANDE REGLER SOM YTAN BÄR
 * ----------------------------
 * · Ytan hämtar ingenting, ansluter ingenting och kör ingenting. Serverrenderad projektion av
 *   redan validerade poster; rådataläget är ett nativt `<details>` utan skript.
 * · INGEN EGEN FOLD (ROOM-01:s regel för rummets filer): ytan bygger ingen läsmodell och viker
 *   ingen ström. Uppgiftsposten kommer ur controllerns snapshot, och strömmens rader bidrar
 *   bara med identifierare, bevisreferenser och rå inspektion — aldrig med ett tillstånd.
 * · RÅ INSPEKTION GÖMS ALDRIG: varje närvarande hopp bär sin post ordagrant — hela TaskView:n,
 *   hela inlämningen, hela kommandoraden, och för strömmens hopp HELA eventkuverten. Det enda
 *   som inte upprepas är snapshotens uppgiftslistor, som redan ligger råa i uppgiftshoppet.
 * · Ingen ETIKETT för uppgiftstillstånd renderas här: tillståndet ägs av snapshoten och visas i
 *   uppgiftens kort. Rådatan är posten i sin helhet och kortas aldrig ned för den skull.
 * · Bevisreferenser är REFERENSER: strängarna visas som de står, ingen nyttolast hämtas och
 *   inget hemligt material bäddas in.
 * · Ingen procentandel, ingen stapel och ingen rörelse: kedjan har ingen liveness-signal.
 */
import * as React from "react";
import { shortSha, toneClass } from "../ui";
import { MISSING } from "@/lib/loop/labels";
import { SHOWROOM } from "@/lib/loop/room/mode";
import { fixtureEvents, fixtureIntakeOutcomes, fixtureSnapshot } from "@/lib/loop/fixtures";
import type { TaskView } from "@/lib/loop/schema";
import {
  CAUSAL_CHAIN_LIVE_BLOCKED_ON,
  EVIDENCE_REFERENCE_NOTE,
  buildCausalChain,
  type ChainField,
  type ChainHop,
  type ChainIdentifier,
} from "@/lib/loop/room/causality";

export const CHAIN_HEADING = "Orsakskedjan";

export const CHAIN_INTRO =
  "Kedjan för den uppgift rummet arbetar med, monterad ur FIXTURENS validerade poster. Varje " +
  "länk bärs av en verklig identifierare; ett hopp utan bindande id står som em-streck med sin " +
  `orsak. Den fulla, levande kedjan är blockerad på ${CAUSAL_CHAIN_LIVE_BLOCKED_ON} och finns ` +
  "inte i den här skivan.";

export const CHAIN_ORDER_NOTE =
  "Ordningen är kedjans egen semantiska sekvens — ingen tidssortering. Inom strömmen gäller seq " +
  "ensamt, och väggklockan är ingen ordningsauktoritet. Kedjan är en presentation: den viker " +
  "aldrig ihop strömmen till ett tillstånd och är aldrig en authority.";

export const CHAIN_NO_FIXTURE_TEXT =
  "Kedjan är fixtursidans projektion. Utan fixturläge finns ingen validerad källa att binda den " +
  "mot, och rummet visar hellre ingenting än en kedja mot en omärkt källa. Den levande kedjan " +
  `är blockerad på ${CAUSAL_CHAIN_LIVE_BLOCKED_ON}.`;

export const CHAIN_NO_TASK_TEXT =
  "Ingen aktuell uppgift i snapshoten: det finns ingen kedja att visa, och ingen uppgift lyfts " +
  "hit ur kön för att fylla ytan.";

/**
 * ROOM-08 · Namnet på ett hopps fokuserbara rådataruta.
 *
 * Rutan går att tabba till (den rullar i sin egen behållare) och måste därför kunna säga vad
 * den är och vilket hopp den hör till. Namnet bär hoppets EGEN art ur projektionen — aldrig en
 * påhittad beskrivning — och exporteras så att provet kan mäta det.
 */
export const chainRawLabel = (kind: string) => `Rådata (rullbar) · hoppet ${kind}`;

/** Nycklar vars värde visas KORTAT i mono. Hela värdet bärs i `title` och i rådatan. */
const SHA_KEYS = ["sha256", "base_sha", "candidate_sha", "from_sha", "to_sha", "grind_sha256"];

/**
 * Märket vid en identifierare som står i den post som BÄR hoppets utdrag.
 *
 * Flera hopp är delposter: källan, kandidaten, verifieringen, attestationen och promotionen är
 * fält INNE i uppgiftsposten, och den snapshotbundna körningen står i snapshoten. Deras `task_id`
 * står därför i den bärande posten och INTE i hoppets egna rådata. Utan märket ser en operatör som
 * jämför id-listan med rådatan strax under den en avvikelse och har inget sätt att avgöra om den
 * är ärlig — märket säger var identifieraren faktiskt står.
 */
export const CONTAINER_ORIGIN_LABEL = "ur bärande post";

export const CONTAINER_ORIGIN_NOTE =
  `Identifierare märkta «${CONTAINER_ORIGIN_LABEL}» står i posten som BÄR det här utdraget — ` +
  "uppgiftsposten respektive snapshoten — och syns därför inte i utdragets rådata nedan. Värdet " +
  "är utskrivet där, aldrig gissat, och det är precis det värdet bindningen vilar på.";

/**
 * ETT identifierarvärde, EN implementation.
 *
 * Trunkeringen är PRESENTATION och aldrig identitet: en SHA visas kort och bär hela strängen i
 * `title` (husets regel i components/loop/ui.ts). Både identifierarlistan och bindningsraden
 * renderar genom den HÄR komponenten — annars kunde den ena drifta ifrån den andra och visa en
 * kapad SHA utan att någonstans bära hela värdet.
 */
function IdValue({ id }: { id: ChainIdentifier }) {
  const isSha = SHA_KEYS.includes(id.key);
  return (
    <span
      className={id.mono ? "rm-id-value mk-mono" : "rm-id-value"}
      title={isSha ? id.value : undefined}
    >
      {isSha ? shortSha(id.value) : id.value}
    </span>
  );
}

function Identifier({ id }: { id: ChainIdentifier }) {
  return (
    <li
      className="rm-id"
      data-chain-id={id.key}
      data-chain-identifier-origin={id.origin}
      data-value={id.value}
    >
      <span className="rm-id-key">{id.key}</span>
      <IdValue id={id} />
      {/* Härkomsten SYNS, inte bara i ett dataattribut: id-listan och rådatan ska kunna jämföras. */}
      {id.origin === "container" && (
        <span className="rm-id-origin" data-chain-origin-label="container">
          {CONTAINER_ORIGIN_LABEL}
        </span>
      )}
    </li>
  );
}

/**
 * Ett BESKRIVANDE fält. Egen märkning (`data-chain-field`), aldrig `data-chain-id`: den
 * maskinläsbara identifierarytan ska vara exakt identiteterna, så att påståendet "varje länk bärs
 * av ett verkligt id" går att mäta utan att först sortera bort ett `verb` eller ett `origin`.
 */
function Field({ item }: { item: ChainField }) {
  return (
    <li className="rm-id" data-chain-field={item.key} data-value={item.value}>
      <span className="rm-id-key">{item.key}</span>
      <span className={item.mono ? "rm-id-value mk-mono" : "rm-id-value"}>{item.value}</span>
    </li>
  );
}

function Hop({ hop }: { hop: ChainHop }) {
  const boundByKeys = hop.bound_by.map((id) => id.key).join(" ");
  const badge = hop.present ? (hop.bound_to === null ? "ROT" : "BUNDEN") : MISSING;

  return (
    <li
      className={hop.present ? "rm-chain-hop" : "rm-chain-hop rm-chain-hop-absent"}
      data-chain-hop={hop.kind}
      data-chain-present={hop.present ? "true" : "false"}
      data-chain-bound-by={boundByKeys}
      data-chain-bound-to={hop.bound_to ?? ""}
      data-chain-binding={hop.binding}
      data-chain-record-source={hop.record_source}
    >
      <div className="rm-chain-head">
        <span className="rm-chain-kind mk-mono">{hop.kind}</span>
        <span className="rm-chain-hop-title">{hop.title}</span>
        <span
          className={`mk-badge ${toneClass(hop.present ? "accent" : "neutral")}`}
          data-chain-badge={hop.present ? "present" : "absent"}
          data-missing={hop.present ? "false" : "true"}
        >
          {badge}
        </span>
      </div>

      {hop.present ? (
        <>
          <ul className="rm-ids" data-chain-identifiers="true">
            {hop.ids.map((id) => (
              <Identifier id={id} key={`${id.key}-${id.value}`} />
            ))}
          </ul>

          {/*
            Notisen står BARA vid de hopp den gäller. Ett hopp vars alla identifierare finns i dess
            egen rådata behöver ingen förklaring, och en upprepad brasklapp vid varje hopp hade
            gjort den till bakgrundsbrus i stället för en upplysning.
          */}
          {hop.ids.some((id) => id.origin === "container") && (
            <p className="rm-chain-note" data-chain-origin-note="container">
              {CONTAINER_ORIGIN_NOTE}
            </p>
          )}

          {hop.fields.length > 0 && (
            <ul className="rm-ids" data-chain-fields="true">
              {hop.fields.map((item, index) => (
                <Field item={item} key={`${index}-${item.key}`} />
              ))}
            </ul>
          )}

          {hop.bound_to === null ? (
            <p className="rm-chain-bind" data-chain-root="true">
              Kedjans rot: posten är den första med en egen identitet. Ingen tidigare post binder
              den, och ingen bindning påstås.
            </p>
          ) : (
            <>
              <p className="rm-chain-bind" data-chain-binding-line={hop.binding}>
                Bunden till <span className="rm-chain-kind mk-mono">{hop.bound_to}</span> via
              </p>
              {/*
                EN LISTA, INTE EN RAD MED INTILLIGGANDE SPANS. Ett hopp kan bindas av FLERA
                identifierare (försöket mot körningen när strömmen bär två run_id), och två värden
                utan avgränsare hade runnit ihop till en enda oläsbar sträng. Samma inline-flex-
                mönster som identifierarlistan, så avgränsningen kommer ur stilarket och inte ur
                ett hoppas-på-mellanslag.
              */}
              <ul className="rm-ids" data-chain-binding-ids="true">
                {hop.bound_by.map((id, index) => (
                  <li
                    className="rm-id"
                    data-chain-binding-id={id.key}
                    data-value={id.value}
                    key={`${index}-${id.key}-${id.value}`}
                  >
                    <span className="rm-id-key">{id.key}</span>
                    <IdValue id={id} />
                  </li>
                ))}
              </ul>
            </>
          )}

          {hop.note !== null && (
            <p className="rm-chain-note" data-chain-note="true">
              {hop.note}
            </p>
          )}

          {hop.evidence_refs.length > 0 && (
            <ul className="rm-ids" data-chain-evidence="true">
              {/*
                Nyckeln bär positionen OCH referensen. Projektionen lämnar unika referenser, men
                ytan är en publik komponent: en lista som råkar innehålla samma referens två gånger
                ska renderas, inte kollidera med sig själv.
              */}
              {hop.evidence_refs.map((ref, index) => (
                <li className="rm-id" data-chain-evidence-ref={ref} key={`${index}-${ref}`}>
                  <span className="rm-id-key">evidence_ref</span>
                  <span className="rm-id-value mk-mono">{ref}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="rm-chain-absent" data-chain-absent="true">
          <span className="rm-chain-dash" data-missing="true">
            {MISSING}
          </span>{" "}
          {hop.absent_reason}
        </p>
      )}

      {/*
        RÅ INSPEKTION FINNS PÅ VARJE NÄRVARANDE HOPP. Ett frånvarande hopp har ingen post att
        visa — att rita ett tomt rådataläge hade antytt att det fanns något bakom em-strecket.
      */}
      {hop.raw !== null && (
        <details className="rm-details" data-chain-raw="true">
          <summary>{"{ }"} rådata</summary>
          {/*
            ROOM-08 · behållaren är FOKUSERBAR, av samma skäl som i tidslinjen: rådatan scrollar
            i sin egen behållare (och bryts vid ≤959 px, där rummet är en spalt), och en
            scrollyta utan tabindex är
            stängd för tangentbordet. Fokusringen målas i ROOM_CSS.

            Och den presenterar sig: roll plus namn med HOPPETS EGEN art, så att ett fokusstopp
            mitt i en kedja med elva hopp säger vilket hopp rådatan tillhör i stället för att
            vara en namnlös station.
          */}
          <pre
            className="mk-raw rm-scroll-x"
            data-chain-raw-json={hop.kind}
            tabIndex={0}
            role="group"
            aria-label={chainRawLabel(hop.kind)}
          >
            {hop.raw}
          </pre>
        </details>
      )}
    </li>
  );
}

export default function CausalChain({
  task,
  fixture,
}: {
  /** Rummets aktuella uppgift, EXAKT som skalet fick den ur snapshoten. */
  task: TaskView | null;
  /** Fixturläget. Kedjan är fixtursidans projektion och märks alltid som sådan. */
  fixture: boolean;
}) {
  /*
    Fixturkatalogen är den ENDA källan till kedjans poster i den här skivan, och varje post har
    gått genom V1:s validering innan den når hit. Ytan viker ingen ström och bygger ingen
    läsmodell: den lämnar de validerade posterna vidare till projektionen som de är.
  */
  const chain =
    fixture && task !== null
      ? buildCausalChain({
          task_id: task.task_id,
          snapshot: fixtureSnapshot(),
          events: fixtureEvents().map((validated) => validated.event),
          outcomes: fixtureIntakeOutcomes(),
        })
      : null;

  return (
    <section className="rm-chain" data-causal-chain="true" aria-label={CHAIN_HEADING}>
      <h2 className="rm-chain-title">{CHAIN_HEADING}</h2>

      {!fixture ? (
        <p className="rm-chain-note" data-chain-unavailable="no-fixture">
          {CHAIN_NO_FIXTURE_TEXT}
        </p>
      ) : chain === null ? (
        <p className="rm-chain-note" data-chain-unavailable="no-task">
          {CHAIN_NO_TASK_TEXT}
        </p>
      ) : (
        <div data-chain-source="fixture" data-chain-task={chain.task_id}>
          {/*
            SHREDDER-01B §owner-8 · KEDJANS TRE INLEDANDE STYCKEN ÄR FLYTTADE, INTE BORTTAGNA.

            De beskriver hur kedjan är monterad, hur den är ordnad och vad en bevisreferens är —
            alltihop sant, alltihop kvar ordagrant, men det är BAKGRUND. Framför dem låg elva hopp
            som operatören kom hit för att läsa, och vid smala vyer betydde det ett dussin rader
            prosa före kedjans första länk. Bakgrunden bärs därför av rummets egen upplysningsdörr,
            med ett kompakt märke som säger vad ytan är: en fixtursidans projektion.
          */}
          <details className="rm-details" data-chain-intro="true">
            <summary>
              <span className="rm-flag">{SHOWROOM}</span> Om kedjan och dess ordning
            </summary>
            <p className="rm-chain-note">{CHAIN_INTRO}</p>
            <p className="rm-chain-note" data-chain-order-note="true">
              {CHAIN_ORDER_NOTE}
            </p>
            <p className="rm-chain-note" data-chain-evidence-note="true">
              {EVIDENCE_REFERENCE_NOTE}
            </p>
          </details>

          {/*
            En överträdelse i projektionens EGEN validering syns. Att tysta den hade gjort ytan
            till precis det den finns för att förhindra: en kedja som ser bunden ut utan att vara det.
          */}
          {chain.violations.length > 0 && (
            <ul className="rm-chain-violations" data-chain-violations="true">
              {chain.violations.map((violation) => (
                <li
                  className="rm-chain-note"
                  data-chain-violation={violation.code}
                  key={`${violation.hop ?? "chain"}-${violation.code}-${violation.message}`}
                >
                  {violation.message}
                </li>
              ))}
            </ul>
          )}

          <ol className="rm-chain-list">
            {chain.hops.map((hop) => (
              <Hop hop={hop} key={hop.kind} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
