/**
 * V2 · Taskkortet.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — COMPONENT_PLAN ("Taskkortets fält") och
 * TASK-LIFECYCLE ("Statuspresentation"). Datat kommer ur V1:s TaskView, ALDRIG ur en
 * parallell handskriven modell och aldrig ur en tail-fold.
 *
 * BINDANDE REGLER
 * ---------------
 * · Statusetikett och färgroll läses ur TASK_LIFECYCLE_PRESENTATION (V1). Kortet hittar
 *   aldrig på ett tillstånd och utökar aldrig TASK_LIFECYCLE.
 * · Endast DONE får se ut som klart (`may_look_done`). STOPPED bär `danger`, NEEDS_SPEC
 *   bär `warning` — ett ARBETSLÄGE, aldrig ett fel.
 * · Varje saknat (null) fält renderas som exakt "—" via orMissing. Aldrig 0, aldrig tomt,
 *   aldrig en gissning, aldrig ett uppfunnet fält.
 * · `merge` och `promotion.state` är OLÖSTA kontrakt (S8/B7 respektive S7): kortet läser
 *   inga namngivna fält ur dem och visar dem som "—" eller som "opakt värde".
 * · Ingen procentsats, ingen framstegsstapel, ingen kvot presenterad som framsteg.
 */
import * as React from "react";
import {
  MISSING,
  NEEDS_SPEC_EXPLANATION,
  TASK_LIFECYCLE_PRESENTATION,
  orMissing,
} from "@/lib/loop/labels";
import type { TaskView, Verdict } from "@/lib/loop/schema";
import { shortSha, toneClass } from "./ui";

/** Ett fält i kortet. Saknat värde blir "—" och märks visuellt som saknat. */
function Field({
  label,
  value,
  mono = false,
  wide = false,
  title,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  wide?: boolean;
  title?: string;
}) {
  const text = orMissing(value);
  const isMissing = text === MISSING;
  const classes = ["mk-value"];
  if (mono) classes.push("mk-mono");
  if (isMissing) classes.push("mk-missing");
  return (
    <div className={wide ? "mk-field mk-field-wide" : "mk-field"}>
      <div className="mk-label">{label}</div>
      <div className={classes.join(" ")} data-missing={isMissing ? "true" : "false"} title={title}>
        {text}
      </div>
    </div>
  );
}

/** null → "—". `false` är ett VÄRDE och blir "nej" — aldrig sammanblandat med saknat. */
function yesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return MISSING;
  return value ? "ja" : "nej";
}

/**
 * PASS/FAIL/NOT_RUN/UNKNOWN. NOT_RUN är visuellt SKILT från PASS: egen kontur, ingen
 * success-färg, egen etikett. Ett ej kört prov får aldrig läsas som ett godkänt prov.
 */
function VerdictBadge({ name, verdict }: { name: string; verdict: Verdict }) {
  const presentation: Record<Verdict, { text: string; className: string }> = {
    PASS: { text: "PASS", className: "mk-badge mk-tone-success" },
    FAIL: { text: "FAIL", className: "mk-badge mk-tone-danger" },
    NOT_RUN: { text: "EJ KÖRD", className: "mk-badge mk-verdict-not-run" },
    UNKNOWN: { text: "OKÄND", className: "mk-badge" },
  };
  const shown = presentation[verdict];
  return (
    <span className={shown.className} data-verdict={verdict} data-verdict-name={name}>
      {name} {shown.text}
    </span>
  );
}

export default function TaskCard({
  task,
  variant = "compact",
}: {
  task: TaskView;
  variant?: "compact" | "full";
}) {
  const presentation = TASK_LIFECYCLE_PRESENTATION[task.state];
  const full = variant === "full";
  /**
   * "1 av —" när försöksnumret finns men budgeten saknas i kontraktet (planens exempel).
   * Saknas BÅDA blir fältet exakt "—" — aldrig "— av —", som hade läst som ett värde.
   */
  const attempts =
    task.attempt.n === null && task.attempt.budget === null
      ? null
      : `${orMissing(task.attempt.n)} av ${orMissing(task.attempt.budget)}`;

  return (
    <article
      className={`mk-card ${toneClass(presentation.tone)}`}
      data-task-id={task.task_id}
      data-state={task.state}
      data-tone={presentation.tone}
      data-may-look-done={presentation.may_look_done ? "true" : "false"}
      data-variant={variant}
    >
      <div className="mk-card-head">
        <span className="mk-card-id">{task.task_id}</span>
        <span className={`mk-badge ${toneClass(presentation.tone)}`} data-state-badge={task.state}>
          <span className="mk-badge-dot" aria-hidden="true" />
          {presentation.label}
        </span>
      </div>

      <div className="mk-card-title">{orMissing(task.title)}</div>

      {task.state === "NEEDS_SPEC" && (
        <p className="mk-note mk-tone-warning" data-needs-spec-explanation="true">
          {NEEDS_SPEC_EXPLANATION}
        </p>
      )}

      <div className="mk-fields">
        <Field
          label="Källa"
          value={task.source ? task.source.source_id : null}
          mono
        />
        <Field
          label="Käll-sha256"
          value={task.source ? shortSha(task.source.sha256, 12) : null}
          mono
          title={task.source ? task.source.sha256 : undefined}
        />
        <Field label="Försök / budget" value={attempts} />
        <Field label="Aktuell fas" value={task.phase} mono />

        {full && (
          <>
            <Field label="Källans adress" value={task.source ? task.source.locator : null} mono />
            <Field label="Riskklass" value={task.risk_class} />
            <Field label="Builder" value={task.builder.agent} />
            <Field label="Modell" value={task.builder.model} />
            <Field
              label="Bas-SHA"
              value={shortSha(task.base_sha)}
              mono
              title={task.base_sha ?? undefined}
            />
            <Field
              label="Kandidat-SHA"
              value={shortSha(task.candidate_sha)}
              mono
              title={task.candidate_sha ?? undefined}
            />
            <Field label="Först sedd" value={task.first_seen_ts} mono />
            <Field label="Taskgrind-id" value={task.task_gate.grind_id} mono />
            <Field label="Evaluator krävd" value={yesNo(task.evaluation.required)} />
            <Field label="Evaluator-fynd" value={task.evaluation.findings} />
            <Field
              label="Attestation"
              value={task.attestation ? yesNo(task.attestation.exists) : null}
            />
            <Field
              label="Promotion-berättigad"
              value={task.attestation ? yesNo(task.attestation.promotion_eligible) : null}
            />
            {/* OLÖSTA kontrakt: inga namngivna fält läses ur dem. */}
            <Field
              label="Merge"
              value={task.merge === null ? null : "opakt värde (kontrakt olöst)"}
            />
            <Field
              label="Promotion"
              value={task.promotion === null ? null : task.promotion.state}
            />
            <Field
              label="Promotion från"
              value={task.promotion ? shortSha(task.promotion.from_sha) : null}
              mono
            />
            <Field
              label="Promotion till"
              value={task.promotion ? shortSha(task.promotion.to_sha) : null}
              mono
            />
          </>
        )}
      </div>

      {full && (
        <div className="mk-verdicts">
          <VerdictBadge name="POLICY" verdict={task.policy} />
          <VerdictBadge name="VERIFIERING" verdict={task.verification} />
          <VerdictBadge name="TASKGRIND" verdict={task.task_gate.verdict} />
          <VerdictBadge name="EVALUATOR" verdict={task.evaluation.verdict} />
        </div>
      )}
    </article>
  );
}
