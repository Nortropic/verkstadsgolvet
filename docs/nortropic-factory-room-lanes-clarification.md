# NORTROPIC FACTORY ROOM — OWNER PRODUCT CLARIFICATION: TWO FACTORY LANES

(Owner-authored clarification, recorded verbatim 2026-08-15. Additive required product correction to the Product-V2/V3 programme. Applied without stopping autonomous execution.)

## 1. Nortropic has two different work domains
The current Codex/bootstrap/autopilot loop is primarily a SYSTEM IMPROVEMENT factory — it builds and improves Nortropic itself (S5/S10/S13, verifier, supervisor, Credential Proxy, Nortropic Slack, Factory Room, control-plane capabilities). This is NOT the future CUSTOMER WEBSITE PRODUCTION factory (build Nisses Måleri website, redesign customer hero, service pages, visual/a11y/SEO QA, preview, deploy, smoke, monitoring).
Locks: FACTORY_LANE_SYSTEM=SYSTEM_IMPROVEMENT · FACTORY_LANE_CUSTOMER=CUSTOMER_PRODUCTION · BOOTSTRAP_AUTOPILOT_PRIMARY_LANE=SYSTEM_IMPROVEMENT · SYSTEM_IMPROVEMENT_LOOP_IS_CUSTOMER_WEBSITE_FACTORY=NO · SHARED_TRUST_KERNEL_BETWEEN_LANES=YES.

## 2. One product, not two
One Verkstadsgolvet, one Kartongförstöraren. Work domain is a first-class context inside the product; the operator switches between KUNDPRODUKTION and SYSTEMFÖRBÄTTRINGAR (visual treatment decided by independent visual review). No second dashboard, scheduler, canonical backlog or trust kernel.

## 3. First-class work domain
Smallest safe typed presentation/domain model distinguishing CUSTOMER_PRODUCTION / SYSTEM_IMPROVEMENT. NOT task states — never added to TASK_LIFECYCLE. One canonical field name chosen by architect review (work_domain / factory_lane / project_kind) and used consistently. Future controller provenance must fit. Until the backend publishes the value: showroom scenarios may carry it explicitly; live UI never guesses; missing live value renders —. SYSTEM_IMPROVEMENT is never inferred from repository name unless a frozen projection later authorizes that derivation.

## 4. Customer-production UX
Communicates: customer/project, brief/source, research, website plan, current website task, build, review, quality checks, preview, deploy, post-deploy smoke, monitoring. The output is the WEBSITE (showroom example: NISSES MÅLERI with Design/responsive ✓, Accessibility ✓, SEO ✓, Kontaktuppgifter ✓, Preview ↗, Deploy ●, smoke —, Production URL —). Synthetic showroom data only; never a real customer, domain or live deployment.

## 5. System-improvement UX
Communicates that Nortropic improves its own machinery: system component/capability, roadmap slice, task, current role, candidate SHA, gate, review, publication, authoritative main, blocker/dependency, autonomous continuation state (example: NORTROPIC SYSTEM · S13 read/command interface · Architect ✓ Test Author ✓ Builder ● Reviewer — Gate — Publication — · Dependency: S5 required). The bootstrap/Codex autopilot work belongs here. A control-plane task is never represented as a customer website being deployed.

## 6. Intake must distinguish intent
Preferred flow: "Mata maskinen — Vad vill du göra? [ Bygg / ändra kundprojekt ] [ Förbättra Nortropic ]" then domain-appropriate examples. LLM classification is never the authority for the work domain: explicit operator selection or later controller-owned typed classification is the source. Natural language may suggest, never silently decide, for a real live submission.

## 7. Navigation/overview
Both lanes discoverable without clutter; operator immediately answers "WHAT IS NORTROPIC BUILDING FOR CUSTOMERS?" and "WHAT IS NORTROPIC IMPROVING ABOUT ITSELF?". Compact overview counts allowed only when backed by the current source; showroom values labelled showroom; no completion percentages.

## 8. Shared core, different verification profiles
Both domains reuse the shared trust machinery (task/attempt/workspace/candidate/policy/gate/review/attestation/promotion/audit). SYSTEM_IMPROVEMENT emphasizes frozen task gates, controller invariants, provider identity, trust boundaries, regression tests, Nortropic-repo publication. CUSTOMER_PRODUCTION emphasizes build/typecheck, visual/responsive, accessibility, SEO, business/contact data, no-secret/client-leak, preview, domain/config, deployment, post-deploy smoke. Website QA semantics are not forced onto control-plane tasks; customer production is not reduced to generic code gates.

## 9. Remote UX carries the same distinction
Nortropic Slack eventually supports "@nortropic status customer" / "@nortropic status system" (or equivalent, e.g. "@nortropic vad bygger vi åt kunder?" / "vad förbättrar Nortropic just nu?"). Remote command/status responses carry the actual work domain or —. One room/context architecture may span both domains; context and search retain domain identity.

## 10. Search, history, notifications and audit
Every relevant long-lived record preserves the work domain where the authoritative contract supports it (room, source, project, run, task, command, notification, standing work, release, audit chain) enabling per-lane history filtering. Notifications are lane-legible ("SYSTEM: S13 blocked on S5." vs "CUSTOMER: Nisses Måleri post-deploy smoke failed.") — never collapsed into one generic task-failed UX.

## 11. Roadmap ledger items
LANE-01 work-domain contract · LANE-02 customer-production showroom · LANE-03 system-improvement showroom · LANE-04 intake domain selection · LANE-05 lane-aware history/search · LANE-06 lane-aware notifications · LANE-07 lane-aware Slack/remote UX · LANE-08 live controller work-domain projection · LANE-09 domain-specific verification profiles.
CURRENT_BOOTSTRAP_WORK_DOMAIN=SYSTEM_IMPROVEMENT. CUSTOMER_PRODUCTION_LOOP_STATUS=separate future production capability using the shared Nortropic trust kernel; the Codex bootstrap autopilot is not claimed to already be this complete customer-production loop.

## 12. Showroom scenarios
At least one clearly synthetic scenario per lane (SYSTEM: S13 read/command interface WORKING with candidate/gates/review/publication; CUSTOMER: "Nisses Måleri DEMO" website build → visual QA → preview → deploy → smoke). Immediately visually distinguishable. No real customer data.

## 13. Visual review (blocking questions)
Can a first-time operator understand that Nortropic has customer-production work AND system-improvement work? Can they tell which lane the current task belongs to without opening technical evidence? Does CUSTOMER_PRODUCTION feel like a website factory? Does SYSTEM_IMPROVEMENT feel like Nortropic improving its own machinery? Is it still ONE coherent Factory Room? Failure on the distinction is blocking.

## 14. Do not delay the showroom
Build the complete lane distinction in showroom UX now with explicit schema-valid synthetic scenario metadata; replace with the live source when the controller publishes the domain; the UX shape must not require redesign.

## 15. Continue autonomously
Applied to the active SHREDDER/Product-V2 programme without restart; merged SHREDDER-01A work preserved; domain distinction lands through the next eligible bounded slices via the normal Factory path. Status-report keys: WORK_DOMAIN_CONTRACT_STATUS, CUSTOMER_PRODUCTION_SHOWROOM_STATUS, SYSTEM_IMPROVEMENT_SHOWROOM_STATUS, INTAKE_DOMAIN_SELECTION_STATUS, CURRENT_BOOTSTRAP_LANE=SYSTEM_IMPROVEMENT, CUSTOMER_PRODUCTION_LOOP_STATUS, LANE_VISUAL_REVIEW.
