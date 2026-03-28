# Frontend Gap Analysis (Web + Creator App V2)

Date: 2026-03-28

## Scope Reviewed

- SocialArena web frontend pages (`*.php`, `css/`, `js/`) and architecture docs.
- Standalone Creator App V2 (`standalone-editor-v2`) workflow shell, stage modules, state model, and endpoint integrations.

## What Is Already in Good Shape

1. **The V2 workflow foundation is clearly defined as seven stages** and aligned to a production pipeline.
   - Stage registry includes Idea Board, Idea Pitch, Script, Starting Images, Clip Generation, Edit, Export/Release.
2. **Session and shell flow is coherent** (`Authentication -> Studio Selection -> Dashboard -> Workflow`) and visibly enforced in app-shell routes.
3. **Idea Board persistence is implemented through API-backed project loading/saving**.
4. **Edit stage has meaningful non-trivial operations already wired** (build rough cut, assign to scene, move/split/trim/duplicate/remove, replace from approved take).
5. **Export/Release has practical endpoint integrations** (init/list/complete exports), not just static UI.

## Highest-Impact Gaps Still Remaining

## 1) End-to-end persistence is still inconsistent across stages (critical)

The biggest remaining risk is uneven save/load behavior between stages.

- Idea Board has explicit remote save/load integration.
- Idea Pitch and Script actions currently apply data from DOM into local workspace state, but no stage-level save endpoint call is made in their action flows.
- Edit draft and timeline operations are rich locally but still look primarily local-first and reconstruction-first rather than fully persisted as a canonical remote timeline model.

**Impact:** users can lose work or reopen into partial state; workflow confidence drops quickly when durability is uncertain.

## 2) Canonical model ownership (frontend vs backend) is still ambiguous (critical)

V2 currently carries strong local model construction for pitch/script/starting images/clip requests/edit timeline/export records in frontend state factories.

**Impact:** drift risk between frontend derivations and backend truth, especially after reopen, cross-device use, or future collaboration.

## 3) Edit surface is strong but still missing professional timeline UX layers (high)

Core operations exist, but timeline UX is still button-driven.

Missing/underdeveloped behaviors include:

- drag reorder and drag-to-track interactions
- playhead-driven scrubbing and insertion workflows
- clearer clip handle UX for trim/split precision
- scene-span manipulation affordances and collision handling feedback

**Impact:** orchestration concept is strong, but execution speed and editor feel lag behind user expectations.

## 4) Stage-depth imbalance (high)

App shell/dashboard presentation remains fairly heavy relative to deeper stage tooling.

- The app already has a good shell.
- Highest product value now depends on deepening Script, Clip Generation, and Edit stage surfaces.

**Impact:** polish effort can get misallocated away from the areas that actually unlock creator throughput.

## 5) Workflow automation loop is partially implemented (medium)

Slot semantics are present (missing/planned/generated/fulfilled/assembled), but the full action loop is not consistently one-click operational across stages.

**Impact:** users still perform too much manual context switching between Script, Clip Generation, and Edit.

## 6) Cross-stage validation and readiness gates are still thin (medium)

The stage rail exists, but hard readiness checks appear limited.

Needed examples:

- cannot advance to Clip Generation when required script scene fields are missing
- cannot export when sequence has unresolved required scene slots
- explicit warnings for stage data divergence

**Impact:** invalid project states can propagate too far downstream.

## 7) Unified design-system consistency across web and creator surfaces (medium)

The repo still contains a broad PHP+CSS+JS surface and a separate V2 creator UI stack.

**Impact:** long-term UI consistency, velocity, and maintainability will suffer without a shared token/component approach.

## Recommended Execution Plan (Prioritized)

### P0 — Durability + Canonical State (must ship first)

1. Define canonical ownership contract per stage:
   - authoritative backend fields
   - frontend cached/derived fields
   - rehydration precedence rules
2. Add explicit save/rehydrate pathways for Idea Pitch, Script, and Edit timeline.
3. Add reopen-project parity tests ensuring each stage restores expected data.

### P1 — Edit UX Maturity

1. Add drag-and-drop timeline operations (horizontal reorder + vertical track reassignment).
2. Add visible playhead and time-based insertion behavior.
3. Add trim/split controls with precise visual feedback.
4. Add scene-level move/delete behavior with safe reflow rules.

### P1 — Workflow Orchestration Depth

1. Convert slot statuses into action handlers with deterministic transitions:
   - missing -> generate
   - planned -> queue
   - generated -> review/select
   - fulfilled -> replace/regenerate
2. Add quick actions in Edit that dispatch into upstream stages and return with synced state.

### P2 — Quality and Product Hardening

1. Add stage readiness gates and preflight checks before stage transitions and export.
2. Add failure-state UX for async generation jobs (retry with context, stale-job detection).
3. Add visual/system consistency pass to align tokenized spacing/type/color patterns across app surfaces.

## Definition of “Frontend Ready” (Suggested)

Declare frontend “ready” only when all are true:

1. Reopen fidelity: no stage loses entered or generated data for supported fields.
2. Timeline usability: key edit tasks (assemble, reorder, trim, split, replace) are direct and discoverable.
3. Orchestration continuity: users can complete the slot lifecycle without manual data patching.
4. Stage safety: invalid upstream state is blocked or clearly warned before downstream actions.
5. Surface consistency: primary workflows share predictable interaction patterns and visual language.

## Immediate Next Sprint (Concrete)

1. Implement `savePitchDraft` + `saveScriptDraft` API flows and wire to stage actions.
2. Introduce persisted timeline payload contract and `saveEditDraft` endpoint integration.
3. Add project reopen integration test matrix for all seven stages.
4. Deliver first timeline DnD slice (reorder within V1 lane + track move between V1/A1).
5. Add export preflight guard: block export when required scene slots remain unresolved.
