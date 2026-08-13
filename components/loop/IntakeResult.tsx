/**
 * V8* · Inlämningens utfall: källa → Nortropics tolkning → de uppgifter CONTROLLERN svarat med.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — MARKDOWN_INTAKE_UX ("Flödet", "Provenance och
 * inspektion", "NEEDS_SPEC", "Backend-avslag") och COMPONENT_PLAN (`IntakeResult.tsx`).
 *
 * BINDANDE REGLER SOM KOMPONENTEN BÄR
 * -----------------------------------
 * · ANTALET UPPGIFTER KOMMER UR CONTROLLERNS SVAR. Har controllern inte svarat visas
 *   väntetexten och antalet är "—" — aldrig 0 som påstående, aldrig en uppskattning och
 *   aldrig en uppgift som UI:t hittat på. `data-ui-generated-tasks` är mätbart noll.
 * · ORIGINALKÄLLAN renderas RÅTT och oförändrad. Ingen markdown-tolkning, ingen rubrikparsning,
 *   ingen sektionsindelning — bara texten som den kom in, plus tecken- och radräkning.
 * · BACKEND-AVSLAG ÅTERGES ORDAGRANT med rå `command_id` och rå `status`. Controllerns
 *   resultatkarta är OPAK (S13/B5 olöst): inget namngivet fält läses ur den, hela kartan visas.
 *   Ingen orsak skrivs om till något vänligare och ingen "försök igen"-knapp erbjuds.
 * · NEEDS_SPEC är ett ARBETSLÄGE i warning — aldrig en röd feldialog. Åtgärden är att
 *   komplettera källan, som visas oförändrad nedanför.
 * · Inlämningsläget (`submission.*`) är en UI-LOKAL namnrymd (B1) och är ALDRIG task state.
 * · Ingen transport, ingen hash, ingen klocka. Komponenten renderar det den fått.
 */
import * as React from "react";
import {
  NEEDS_SPEC_ACTION_HINT,
  NEEDS_SPEC_ACTION_LABEL,
  SUBMISSION_PRESENTATION,
  SUBMISSION_WAITING_TEXT,
  controllerTaskCount,
  groupDigits,
  isRejected,
  sourceStats,
  uiGeneratedTaskCount,
  verbatimRejection,
  type IntakeOutcome,
} from "@/lib/loop/intake";
import { MISSING } from "@/lib/loop/labels";
import TaskCard from "./TaskCard";
import { toneClass } from "./ui";

/** Källan i råläge plus de enda två mått Verkstadsgolvet räknar fram: tecken och rader. */
function SourcePanel({ outcome }: { outcome: IntakeOutcome }) {
  const stats = sourceStats(outcome.source.text);
  return (
    <div className="mk-group" data-intake-source="true">
      <div className="mk-group-head">
        <span className="mk-group-name">
          Originalkällan · {outcome.source.origin === "paste" ? "inklistrad text" : "fil"}
        </span>
        <span className="mk-group-count" data-source-name={outcome.source.source_name}>
          {outcome.source.source_name}
        </span>
      </div>
      <p className="mk-hint" data-source-stats="true">
        {stats.characters} tecken · {stats.lines} rader · {groupDigits(stats.bytes)} byte. Räkningen
        är hela den tolkning Verkstadsgolvet gör av källan.
      </p>
      <pre className="mk-raw" data-source-raw="true">
        {outcome.source.text}
      </pre>
    </div>
  );
}

/** Controllerns avslag, ordagrant. Rå identitet, rå status, hela den opaka resultatkartan. */
function RejectionPanel({ outcome }: { outcome: IntakeOutcome }) {
  const rejection = verbatimRejection(outcome.command);
  if (rejection === null) {
    return (
      <p className="mk-note" data-rejection-missing="true">
        Inlämningen är avvisad, men ingen transportrad finns att visa. {MISSING}
      </p>
    );
  }
  return (
    <div className="mk-group" data-intake-rejection="true">
      <div className="mk-fields">
        <div className="mk-field">
          <div className="mk-label">command_id</div>
          <div className="mk-value mk-mono" data-rejection-command-id={rejection.command_id}>
            {rejection.command_id}
          </div>
        </div>
        <div className="mk-field">
          <div className="mk-label">status</div>
          <div className="mk-value mk-mono" data-rejection-status={rejection.status}>
            {rejection.status}
          </div>
        </div>
      </div>
      {rejection.raw_result === null ? (
        <p className="mk-value mk-missing" data-missing="true">
          {MISSING}
        </p>
      ) : (
        <pre className="mk-raw" data-rejection-verbatim="true">
          {rejection.raw_result}
        </pre>
      )}
      <p className="mk-hint">
        Controllerns svar visas ordagrant och i sin helhet. Verkstadsgolvet läser inget namngivet
        fält ur det — svarets form ägs av nortropic-system (S13, B5) — och skriver aldrig om en
        orsak till något vänligare.
      </p>
    </div>
  );
}

export default function IntakeResult({ outcome }: { outcome: IntakeOutcome }) {
  const presentation = SUBMISSION_PRESENTATION[outcome.submission_state];
  const rejected = isRejected(outcome);
  const taskCount = controllerTaskCount(outcome);
  const tasks = outcome.controller_answer?.tasks ?? [];
  const needsSpec = tasks.some((task) => task.state === "NEEDS_SPEC");

  // `data-ui-generated-tasks` bär antalet uppgifter UI:t SJÄLVT skapat. Mätbart noll — alltid.
  return (
    <section
      className="mk-panel"
      data-intake-result="true"
      data-submission-id={outcome.submission_id}
      data-submission-state={outcome.submission_state}
      data-ui-generated-tasks={uiGeneratedTaskCount()}
      data-controller-task-count={taskCount === null ? MISSING : taskCount}
      aria-label={`Inlämning ${outcome.submission_id}`}
    >
      <h2 className="mk-panel-title">
        <span>Inlämning {outcome.submission_id}</span>
        <span
          className={`mk-badge ${toneClass(presentation.tone)}`}
          data-submission-badge={outcome.submission_state}
          data-task-state="false"
        >
          {presentation.label}
        </span>
      </h2>

      <SourcePanel outcome={outcome} />

      <div className="mk-group" data-intake-interpretation="true">
        <div className="mk-group-head">
          <span className="mk-group-name">Nortropics tolkning</span>
          <span className="mk-group-count" data-task-count={taskCount === null ? MISSING : taskCount}>
            {taskCount === null ? MISSING : taskCount}
          </span>
        </div>

        {rejected ? (
          <RejectionPanel outcome={outcome} />
        ) : outcome.controller_answer === null ? (
          <>
            <p className="mk-note" data-awaiting="true">
              {SUBMISSION_WAITING_TEXT}
            </p>
            <p className="mk-hint">
              Ingen uppgift finns förrän controllern svarat. Verkstadsgolvet delar aldrig upp en
              källa, räknar aldrig fram uppgifter ur rubriker och visar aldrig ett uppskattat
              antal — antalet ovan är därför {MISSING}.
            </p>
          </>
        ) : (
          <>
            <p className="mk-hint">
              Uppgifterna nedan kommer ur controllerns svar. De är Nortropics tolkning av källan,
              aldrig Verkstadsgolvets.
            </p>
            {tasks.map((task) => (
              <TaskCard key={task.task_id} task={task} variant="compact" />
            ))}
            {needsSpec && (
              <div className="mk-note mk-tone-warning" data-needs-spec-action="true">
                <strong>{NEEDS_SPEC_ACTION_LABEL}</strong>
                <div>{NEEDS_SPEC_ACTION_HINT}</div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
