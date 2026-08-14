/**
 * V9 · Bannern för strömmens avvikande lägen: nyare schema, lucka i seq, poll-fallback, paus
 * och ordagrann transportorsak.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — ERROR_EMPTY_RECONNECT_STATES,
 * EVENT_CLIENT ("schema versioning", "stale/out-of-order") och COMPONENT_PLAN (StaleBanner.tsx).
 *
 * BINDANDE
 * · Texterna kommer FÄRDIGA ur lib/loop/realtime.ts (tailNotices). Komponenten skriver aldrig
 *   om en orsak och lägger aldrig till en egen tolkning.
 * · En lucka döljs aldrig, ett nyare schema tolkas aldrig, och ett poll-läge presenteras
 *   aldrig som en direktström.
 * · Inga notiser → ingen markup alls. En tom banner är ett påstående om att allt är bra, och
 *   det påståendet får bara ett faktiskt läge göra.
 */
import * as React from "react";
import { toneClass } from "./ui";
import type { TailNotice } from "@/lib/loop/realtime";

export default function StaleBanner({ notices }: { notices: readonly TailNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <div className="mk-banners" data-stale-banner="true" role="status" aria-live="polite">
      {notices.map((notice, index) => (
        <p
          className={`mk-note ${toneClass(notice.tone)}`}
          key={`${notice.id}-${index}`}
          data-notice={notice.id}
        >
          {notice.text}
          {notice.detail !== null && (
            <span className="mk-hint" data-notice-detail="true">
              {" "}
              {notice.detail}
            </span>
          )}
        </p>
      ))}
    </div>
  );
}
