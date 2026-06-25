---
description: "Small, concrete task list for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`

**Organization**: Use the fewest tasks that still make ownership and order clear.
Group work by user story when there is more than one independently useful story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel because it changes different files.
- **[Story]**: Include only when multiple user stories need traceability.
- Every task MUST name the exact file or directory it changes.

## Implementation

- [ ] T001 Implement the primary supported path in [existing source file paths]
- [ ] T002 Update directly affected types, UI, or data conversion in [file paths]
- [ ] T003 Remove behavior made obsolete by the change in [file paths]

## Verification

- [ ] T004 Add or update focused tests for each behavioral change in [test file paths]
- [ ] T005 For parser, export, or simulation-data changes, compare one representative input and expected output
- [ ] T006 Run the affected tests and `npm run build` when production behavior changes

## Rules

- Do not create setup, infrastructure, logging, validation, or abstraction tasks
  unless the feature specifically requires them.
- Add or update focused automated tests for behavioral changes using the existing
  test approach. If none exists, obtain explicit approval before introducing a
  test framework.
- Validate external input at its entry point. Do not repeat checks downstream.
- Prefer changing an existing component, hook, or utility over adding a new layer.
- Preserve public APIs and persisted/imported formats unless the user has approved
  the exact incompatible change.
- Follow naming and style conventions in neighboring files.
- Keep each user story usable after its tasks are complete.
