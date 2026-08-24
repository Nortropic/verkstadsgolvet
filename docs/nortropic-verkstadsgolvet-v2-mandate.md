You are working on **Verkstadsgolvet**, the operational interface for Nortropic.

Treat this as a serious product-design and implementation project.

The current problem is not primarily visual polish.

**The interface exposes too much of Nortropic's internal complexity at the same information level, making it cognitively overwhelming.**

Nortropic itself may remain extremely complex internally. Verkstadsgolvet must become radically simpler to operate.

## PRODUCT VISION

Verkstadsgolvet should evolve from:

> a technical dashboard showing the machinery

into:

> **an executive cockpit for leading an AI-native digital organization.**

The default user perspective is not:

* developer
* terminal operator
* agent debugger
* infrastructure engineer

The default perspective is:

> **unit manager / organizational leader of a digital AI factory.**

The UI should answer five questions immediately:

1. Is the factory healthy?
2. What is it currently working on?
3. What has recently completed?
4. Does anything require my attention or decision?
5. What happens next?

Everything else should be progressively disclosed.

---

# CORE DESIGN PRINCIPLE

**Complexity belongs in the system, not in the user's head.**

Nortropic may internally contain:

* many agents
* hundreds of gates
* candidate SHAs
* worktrees
* evidence artifacts
* model/provider state
* process identities
* reviews
* temporal contracts
* trust transitions
* queues
* retries
* resource budgets
* events

The default Verkstadsgolvet view should NOT expose all of this.

Technical truth must remain fully inspectable, but mostly below the default information layer.

Think:

> simple at the top, exact at the bottom.

---

# INFORMATION ARCHITECTURE

Design Verkstadsgolvet around three primary information depths.

## LEVEL 1 — EXECUTIVE / CHEFSLÄGE

This is the default home screen.

It should be calm, sparse and understandable in seconds.

It should prominently expose:

### Factory health

Example:

`● Healthy · 12 working · 2 reviewing · 0 blocked`

### NEEDS YOU

This is one of the most important components in the entire product.

The ideal state is:

> **Nothing needs you. The factory is operating autonomously.**

If human intervention is required, show the decision in business/organizational language first.

Example:

```
NEEDS YOU · 1

New authority required

A current workstream cannot safely proceed
under its existing authority.

Impact
Bootstrap blocked

Risk
High

[Understand] [Review decision]
```

Do not lead with internal gate names or boolean flags.

Technical evidence must be available underneath.

### Active work

Organize primarily by:

* project
* objective
* workstream
* product

NOT primarily by agent.

Examples:

* Nortropic Bootstrap
* Customer Aurora
* Internal R&D
* Automation Project X

Each should answer:

* what is happening?
* current phase
* meaningful progress
* next step
* whether blocked

### Recently completed

Human-readable outcomes.

Example:

```
✓ A1a review-first contract completed
✓ PR #100 promoted
✓ 7 independent verification runs passed
```

### Workforce summary

Only aggregate initially:

`18 active · 4 reviewing · 1 waiting · 0 blocked`

### Optional business layer

Prepare the architecture so Home can eventually surface:

* projects
* customers
* delivered value
* cost
* capacity
* strategic objectives

without turning the current implementation into fake business telemetry.

Do not fabricate metrics that do not exist.

---

# LEVEL 2 — OPERATIONS

Clicking an active workstream should open an operational view.

Translate low-level machinery into organizational meaning.

For example, instead of showing only:

`R128 / A1b / H032 / +1310/-60`

show:

```
A1b · Temporal Process Contract

STATUS
In progress

CURRENT PHASE
Test authoring

OBJECTIVE
Prove that authority remains valid throughout
the complete execution interval and process family.

WORKFORCE

Orchestrator       Active
Test Author         Editing
Reviewer            Waiting for frozen candidate
Process Auditor     Completed

PROGRESS

Endpoint contract          Complete
Setup timing               In progress
Restore attacks            In progress
Git authority              In progress
Role intervals             Pending
Surviving descendants      Pending

NEXT
Freeze exact candidate
→ independent review
```

Technical identifiers may appear as secondary metadata, not as the primary story.

---

# LEVEL 3 — ENGINEERING / FORENSICS

All technical depth must remain available.

This can contain:

* candidate SHA
* tree SHA
* parent identity
* gate SHA
* exact gate counts
* H031/H032/H033/H034/H035/H017
* invariants
* worktree
* process details
* sandbox/confinement events
* raw evidence
* reviewer reports
* diffs
* logs
* event history
* model/provider identity
* temp roots
* execution metadata

This should feel similar to developer tools or forensic inspection.

It should NOT dominate normal navigation.

---

# EXCEPTION-FIRST DESIGN

Do not present every healthy subsystem equally.

If:

* 30 things are healthy
* 1 thing requires attention

the interface should primarily communicate:

> `1 item needs attention`

not display 31 equal cards.

Healthy operation should collapse into a calm signal.

Problems should expand.

---

# PROJECT-FIRST, NOT AGENT-FIRST

Agents are implementation machinery.

Users care primarily about:

* goals
* projects
* customers
* products
* outcomes

The main information hierarchy should therefore be:

```
Organization
→ Project / Objective
→ Workstream
→ Task / Round
→ Agents
→ Technical execution
```

not:

```
Agents
→ tasks
→ projects
```

Workforce should have its own dedicated view.

---

# WORKFORCE VIEW

Create or redesign a Workforce area around the concept of a digital organization.

Example:

```
WORKFORCE

Engineering
Builder             Working
Architect           Working
Test Author         Working
Reviewer             Waiting

Research
Frontier Scout      Idle
Researcher           Idle

Quality
Security Reviewer   Completed
Evaluator            Idle
```

Long-term, each role may expose:

* current assignment
* model/provider
* status
* historical success
* strengths
* weaknesses
* competency trend
* cost/efficiency

Do NOT fabricate unavailable telemetry now.

Design the structure so real metrics can be added later.

---

# FACTORY PULSE

Create a compact, persistent high-level status element.

Example:

`● HEALTHY · 12 working · 2 reviewing · 0 blocked`

Clicking it may expand into:

```
Factory Pulse

Supervisor      Healthy
Workers         14 / 16 available
Git             Healthy
Queue           23
Blocked         0
Incidents       0
```

Only show metrics that can be derived truthfully from current state.

---

# FRONTIER / IMPROVEMENT

The future Frontier view should NOT become a news feed.

It should surface only material discoveries.

Example:

```
FRONTIER

2 material discoveries

HIGH
New task-provenance architecture
Impact: Supervisor / Context
Status: Experiment recommended

MEDIUM
Sandbox lifecycle behavior changed
Impact: Worker runtime
Status: Watching
```

Prepare information architecture for:

* Frontier
* Experiments
* Workforce development
* Competency
* Evolution

but do not implement fake functionality merely to fill screens.

---

# ASK NORTROPIC / COMMAND SURFACE

Explore a command/search surface such as:

`Ask Nortropic…`

Future queries might include:

* What happened overnight?
* Why is A1b waiting?
* What needs my decision?
* What blocks first-real launch?
* Which projects are behind schedule?
* What has consumed the most compute?
* Show me all current blockers.

If the existing backend does not support this yet, design the UI seam without fabricating responses.

A command palette/search interface can initially route to real existing data and views.

---

# NAVIGATION

Aggressively reduce persistent navigation.

Consider something close to:

```
Home
Work
Workforce
Quality
Frontier

Search
Settings
```

Do not create one permanent sidebar item per internal subsystem.

Within `Work`, use contextual subviews for things such as:

* Projects
* Tasks
* Runs
* Backlog

Technical/internal sections can live further down.

---

# VISUAL DIRECTION

Target:

> **Linear × Raycast × Vercel × Apple**

but do not clone any of them.

Characteristics:

* calm
* extremely clean
* professional
* dense only when necessary
* strong typography hierarchy
* generous whitespace
* subtle borders
* restrained use of color
* meaningful motion only
* no visual noise
* no unnecessary gradients
* no cyberpunk
* no “AI glow”
* no giant robot imagery
* no gratuitous status badges
* no dashboard-template aesthetic

Color should primarily communicate:

* attention
* failure
* active state
* success
* selection

The interface should feel like:

> **premium industrial operating software from the near future**

not:

> “AI SaaS dashboard template”.

---

# PROGRESSIVE DISCLOSURE

A work item should progressively reveal complexity.

Example:

### Layer 1

`A1b — Reviewing`

### Layer 2

```
Test Author working
Reviewer waiting
4/5 contract areas covered
```

### Layer 3

```
Candidate SHA
H032 details
process matrix
raw evidence
```

Consider peek/drawer/popover patterns so users can inspect details without constantly losing context.

---

# LANGUAGE

Default copy should describe organizational meaning.

Prefer:

> Reviewer waiting for frozen candidate.

over:

> REVIEWER_WAIT_STATE=TRUE

Prefer:

> Candidate blocked by independent review.

over:

> BLOCKING_FINDINGS=1

Prefer:

> No decisions required.

over:

> OWNER_DECISION_REQUIRED=false

Technical source labels remain available in engineering views.

---

# IMPORTANT ARCHITECTURAL RULE

Do NOT weaken, remove, reinterpret or bypass any Nortropic trust semantics in order to simplify the UI.

UI simplification must be:

> **representational compression**

not:

> **loss of underlying evidence or control.**

The backend/control plane remains authoritative.

The UI is a view over canonical state.

Where information cannot currently be derived reliably, do not guess.

Show:

* unknown
* unavailable
* not yet measured

or omit it.

---

# EXECUTION PLAN

Start by inspecting the actual current Verkstadsgolvet repository and implementation.

Do not assume architecture from this prompt.

## Phase 1 — Inventory

Map:

* current routes
* components
* data sources
* state model
* navigation
* design tokens
* current views
* duplicated information
* technical information currently exposed too high
* functionality that must remain
* dead/legacy UI
* responsive behavior

Produce a concise current-state map.

## Phase 2 — Cognitive Load Audit

Classify current information as:

* `EXECUTIVE`
* `OPERATIONS`
* `ENGINEERING`
* `FORENSICS`

Identify where lower-level data is currently polluting higher-level views.

Also identify:

* visual duplication
* repeated badges
* navigation overload
* inconsistent terminology
* excessively dense cards/tables
* unclear hierarchy

## Phase 3 — Information Architecture

Design the new hierarchy before doing cosmetic work.

Propose:

* routes
* navigation
* Home
* Work
* Work detail
* Workforce
* Quality
* Frontier
* Engineering/Forensics access

Explicitly show what moves out of the default UI.

## Phase 4 — Design System

Establish or refine:

* typography hierarchy
* spacing
* borders
* surfaces
* radius
* status semantics
* icon usage
* layout primitives
* responsive rules
* motion principles

Reuse the existing stack where sensible.

Avoid unnecessary dependencies.

## Phase 5 — Implement

Implement in coherent vertical slices.

Prioritize:

1. application shell/navigation
2. Home / Executive cockpit
3. Needs You
4. Factory Pulse
5. Work overview
6. Work detail
7. progressive disclosure into technical evidence
8. Workforce

Do not build speculative fake dashboards.

Use real available state.

## Phase 6 — Validate

Check:

* desktop
* laptop
* narrow/mobile layouts where applicable
* keyboard navigation
* accessibility
* empty states
* loading states
* error states
* very long names
* many simultaneous workstreams
* zero active work
* many blockers
* healthy autonomous state

Also evaluate cognitive load manually:

> Can a person who understands Nortropic conceptually but does not know H032 internals open Home and understand the situation within ~10 seconds?

If not, continue simplifying.

---

# DESIGN CHALLENGE

Before considering the redesign successful, answer this:

Imagine Nortropic eventually has:

* 100 active agents
* 25 simultaneous projects
* multiple providers
* thousands of gates/events
* customer work
* internal R&D
* Frontier monitoring
* competency development

Can the Home screen STILL honestly communicate something as simple as:

```
Good afternoon.

Everything is healthy.

4 projects are progressing.
18 workers are active.
3 things completed since yesterday.
Nothing needs you.
```

If the architecture cannot scale toward that level of compression, redesign it.

---

# DO NOT

Do not:

* merely reskin the existing dashboard
* add more cards because more data exists
* expose every agent on Home
* expose every gate on Home
* make technical identifiers the main hierarchy
* invent data
* fabricate progress percentages
* remove forensic depth
* rewrite backend trust semantics for UI convenience
* turn this into a cyberpunk AI dashboard
* optimize for screenshots over real operational use

---

# SUCCESS CRITERIA

Verkstadsgolvet v2 should make Nortropic feel:

* calmer as the factory becomes more complex
* understandable without reading terminal output
* managerial rather than operator-centric
* trustworthy
* inspectable
* modern
* fast
* scalable to many projects and agents
* useful every day

The ideal emotional response should be:

> **“I understand my digital organization.”**

not:

> **“There is an impressive amount of telemetry here.”**

Use the current implementation as evidence, but challenge the current information architecture aggressively.

Think from first principles.

Inspect first, then design, then implement.

Do not stop after producing a mockup if the repository and current task authority permit implementation. Build the strongest coherent version that can be honestly supported by the current backend, and clearly separate implemented functionality from future seams.
