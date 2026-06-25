# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.9

**Primary Dependencies**: React 19, Vite, three.js, Tailwind, `lammps.js`

**Storage**: Browser memory and user-imported/exported files; no backend

**Testing**: Focused tests for behavioral changes using existing tooling; approval required before adding a test framework

**Target Platform**: Recent WebGL 2-capable desktop browsers

**Project Type**: Single React browser application

**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]

**Constraints**: Browser-local, minimal moving parts, no new runtime without justification

**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Uses the existing TypeScript/React application and dependencies.
- Preserves existing architecture and adds no framework unless explicitly requested.
- Limits the diff to the smallest practical set of existing files.
- Follows neighboring naming, style, component, and hook conventions.
- Relies on typed internal invariants; validates only real external boundaries.
- Implements the supported user path with the fewest practical states and branches.
- Adds or updates focused tests for each behavioral change.
- Requests approval first if satisfying the test requirement needs a new test framework.
- Preserves public APIs and formats, or identifies the exact change requiring user approval.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/        # React and TypeScript application code
public/     # Static LAMMPS scripts, data, and browser assets
specs/      # Feature specifications and plans
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
