/**
 * V2 · Statusraden överst i Maskinen.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — TARGET_UX ("● AUTONOM visas bara när det
 * finns en faktisk liveness-signal … annars ○ OKÄNT med ålder. Aldrig en animation utan
 * signal." samt "main <sha> är controllerns BEKRÄFTADE värde med tidsstämpel") och
 * COMPONENT_PLAN (RunStatusBar).
 *
 * BINDANDE REGLER
 * ---------------
 * · Den här skivan har ingen eventström och därmed INGEN liveness-signal. Raden visar därför
 *   alltid "○ OKÄNT" med eventålder "—". Den påstår aldrig AUTONOM, och den animerar aldrig.
 * · `main`-SHA:t kommer ur snapshotens `current_main`. Verkstadsgolvet slår ALDRIG upp
 *   origin/main själv — det vore en andra sanning.
 * · `run.state`, `run.breaker` och `run.budget` är OLÖSTA kontrakt (S5). De renderas som "—"
 *   respektive som opakt värde; inga namngivna fält läses ur dem.
 * · Fixturläget märks ut. En fixtur är aldrig livedata och får aldrig se ut som livedata.
 */
import * as React from "react";
import { MISSING, orMissing } from "@/lib/loop/labels";
import type { LoopSnapshot } from "@/lib/loop/schema";
import { shortSha } from "./ui";

function Item({
  label,
  value,
  mono = false,
  title,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  title?: string;
}) {
  const text = orMissing(value);
  const isMissing = text === MISSING;
  const classes = ["mk-value"];
  if (mono) classes.push("mk-mono");
  if (isMissing) classes.push("mk-missing");
  return (
    <div className="mk-bar-item">
      <span className="mk-label">{label}</span>
      <span className={classes.join(" ")} data-missing={isMissing ? "true" : "false"} title={title}>
        {text}
      </span>
    </div>
  );
}

export default function RunStatusBar({
  snapshot,
  fixture,
}: {
  snapshot: LoopSnapshot;
  fixture: boolean;
}) {
  return (
    <div className="mk-bar" data-run-status-bar="true">
      <div className="mk-bar-item">
        <span className="mk-label">Liveness</span>
        <span className="mk-liveness" data-liveness="unknown">
          <span className="mk-liveness-dot" aria-hidden="true" />
          OKÄNT
        </span>
      </div>

      <Item label="Senaste event" value={null} title="Eventströmmen kopplas in i en senare skiva." />
      <Item label="Kör-id" value={snapshot.run_id} mono />
      <Item label="Kör-tillstånd" value={snapshot.run.state} />
      <Item label="Brytare" value={snapshot.run.breaker === null ? null : "opakt värde"} />
      <Item label="Kvot" value={snapshot.run.budget === null ? null : "opakt värde"} />
      <Item
        label="main (bekräftad av controllern)"
        value={shortSha(snapshot.current_main.sha)}
        mono
        title={snapshot.current_main.sha ?? undefined}
      />
      <Item label="main bekräftad" value={snapshot.current_main.confirmed_ts} mono />
      <Item label="Snapshot publicerad" value={snapshot.published_ts} mono />
      <Item label="seq-vattenmärke" value={snapshot.seq_watermark} mono />

      {fixture && (
        <div className="mk-bar-item">
          <span className="mk-label">Datakälla</span>
          <span className="mk-badge mk-tone-warning" data-fixture-mode="true">
            FIXTUR · INTE LIVEDATA
          </span>
        </div>
      )}
    </div>
  );
}
