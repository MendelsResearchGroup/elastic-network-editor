<!--
Sync Impact Report
Version change: 2.0.0 -> 2.1.0
Modified principles:
- One Browser Application -> Architecture and Framework Stability
- TypeScript and React, Simply -> Minimal, Conventional Changes
- Proportionate Verification -> Tested Behavioral Changes
Added sections:
- Public API Stability
Removed sections:
- None
Templates requiring updates:
- .specify/templates/plan-template.md: updated
- .specify/templates/spec-template.md: compatible; no update required
- .specify/templates/tasks-template.md: updated
- AGENTS.md: updated
Follow-up TODOs: none
-->

# Elastic Network Editor Constitution

## Core Principles

### I. Architecture and Framework Stability
The product MUST remain a single browser application built with TypeScript and
React. Features MUST use the existing Vite, three.js, Tailwind, and `lammps.js`
architecture and preserve existing module boundaries unless a concrete feature
requirement cannot be met within them. A backend, service layer, database, state
framework, additional runtime, or new framework MUST NOT be introduced unless the
user explicitly requests it.

### II. Trust Internal Invariants
Code MUST assume that values produced by typed internal code satisfy their types
and documented invariants. It MUST NOT add repeated null checks, fallback branches,
validation layers, retries, or defensive wrappers for states the application does
not intentionally support. Validation belongs at real external boundaries such as
file import, user-entered values, and LAMMPS output.

### III. Direct, Obvious Interaction
The editor MUST favor direct manipulation and visible controls. A feature SHOULD
use the shortest understandable interaction path and MUST avoid extra modes,
dialogs, configuration, and confirmation steps unless they prevent a likely and
costly mistake. The editor remains the first screen.

### IV. Minimal, Conventional Changes
Implementation MUST use straightforward TypeScript types, React state, props, and
small functions. Changes MUST follow the naming, formatting, component, hook, and
file-organization conventions already present in neighboring code. Diffs MUST be
limited to files and lines needed for the requested behavior. New abstractions
MUST remove concrete duplication or clarify a real domain concept; speculative
helpers, generic machinery, unrelated cleanup, and one-use indirection are
prohibited.

### V. Tested Behavioral Changes
Every behavioral change MUST add or update a focused automated test that proves the
changed behavior, using the project's existing test approach. Parser, export, and
simulation-data changes MUST also include a representative input/output case
because silent scientific-data corruption is costly. Verification MUST remain
proportionate: broad test matrices and new testing infrastructure require a
demonstrated risk or an explicit request. If no test approach exists for the
changed behavior, implementation MUST pause and obtain approval before introducing
a test framework.

## Simplicity Rules

- Prefer one data path over synchronized alternatives.
- Prefer existing dependencies and browser APIs over new packages.
- Prefer explicit code over configurable or generic machinery.
- Assume supported inputs and normal browser operation inside the application.
- Handle unsupported external input once, at the boundary, with a clear message.
- Do not add conditions for hypothetical states that cannot arise through the
  supported user flow.
- Remove obsolete code when replacing behavior; do not keep parallel legacy paths.

## Public API Stability

Public APIs, exported types, persisted data formats, imported file formats, and
user-visible workflow contracts MUST remain compatible. A plan that requires an
incompatible change MUST identify the exact contract and obtain explicit user
approval before implementation. Internal refactoring MUST NOT be used as an
implicit reason to change a public contract.

## Development Workflow

Specifications MUST describe the primary user outcome and supported path first.
Plans MUST identify the smallest set of existing files that can implement it and
state why any architecture change, dependency, abstraction, or persistent state is
necessary. Plans MUST identify affected public contracts and confirm compatibility
or record that user approval is required. Tasks SHOULD be few, concrete, ordered
around a working vertical change, and include focused test work for behavioral
changes.

Implementation MUST preserve existing naming and style conventions and avoid
unrelated refactoring. Verification MUST be reported, but the process MUST NOT
create work unrelated to the feature merely to satisfy a generic checklist.

## Governance

This constitution governs feature specifications, plans, tasks, implementation,
and review. When two approaches satisfy the feature, the approach with fewer
moving parts, fewer states, and fewer dependencies MUST be selected unless the
more complex approach has a concrete, documented benefit.

Amendments require updating this file, recording the impact above, and checking
the Spec Kit templates and repository guidance for contradictions.

Versioning follows semantic versioning:
- MAJOR for removing or redefining project obligations.
- MINOR for adding principles or materially stronger requirements.
- PATCH for clarifications that do not change obligations.

Plans MUST record justified violations in the Complexity Tracking section. Review
MUST reject complexity justified only by hypothetical future needs.

**Version**: 2.1.0 | **Ratified**: 2026-06-25 | **Last Amended**: 2026-06-25
