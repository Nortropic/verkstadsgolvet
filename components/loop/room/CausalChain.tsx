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
import { fixtureEvents, fixtureIntakeOutcomes, fixtureSnapshot } from "@/lib/loop/fixtures";
import type { TaskView } from "@/lib/loop/schema";
import {
  CAUSAL_CHAIN_LIVE_BLOCKED_ON,
  EVIDENCE_REFERENCE_NOTE,
  buildCausalChain,
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

/** Nycklar vars värde visas KORTAT i mono. Hela värdet bärs i `title` och i rådatan. */
const SHA_KEYS = ["sha256", "base_sha", "candidate_sha", "from_sha", "to_sha", "grind_sha256"];

function Identifier({ id }: { id: ChainIdentifier }) {
  const isSha = SHA_KEYS.includes(id.key);
  const shown = isSha ? shortSha(id.value) : id.value;
  return (
    <li
      className="rm-id"
      data-chain-id={id.key}
      data-chain-identifier-origin={id.origin}
      data-value={id.value}
    >
      <span className="rm-id-key">{id.key}</span>
      <span
        className={id.mono ? "rm-id-value mk-mono" : "rm-id-value"}
        title={isSha ? id.value : undefined}
      >
        {shown}
      </span>
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

          {hop.bound_to === null ? (
            <p className="rm-chain-bind" data-chain-root="true">
              Kedjans rot: posten är den första med en egen identitet. Ingen tidigare post binder
              den, och ingen bindning påstås.
            </p>
          ) : (
            <p className="rm-chain-bind" data-chain-binding-line={hop.binding}>
              Bunden till <span className="rm-chain-kind mk-mono">{hop.bound_to}</span> via{" "}
              {hop.bound_by.map((id) => (
                <span key={`${id.key}-${id.value}`}>
                  <span className="rm-id-key">{id.key}</span>{" "}
                  <span className="mk-mono">{SHA_KEYS.includes(id.key) ? shortSha(id.value) : id.value}</span>
                </span>
              ))}
            </p>
          )}

          {hop.note !== null && (
            <p className="rm-chain-note" data-chain-note="true">
              {hop.note}
            </p>
          )}

          {hop.evidence_refs.length > 0 && (
            <ul className="rm-ids" data-chain-evidence="true">
              {hop.evidence_refs.map((ref) => (
                <li className="rm-id" data-chain-evidence-ref={ref} key={ref}>
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
          <pre className="mk-raw rm-scroll-x" data-chain-raw-json={hop.kind}>
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
          <p className="rm-chain-note">{CHAIN_INTRO}</p>
          <p className="rm-chain-note" data-chain-order-note="true">
            {CHAIN_ORDER_NOTE}
          </p>
          <p className="rm-chain-note" data-chain-evidence-note="true">
            {EVIDENCE_REFERENCE_NOTE}
          </p>

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
