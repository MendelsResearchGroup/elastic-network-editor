# Implementation Plan: Simulation Options and Box Analysis

**Branch**: `main` | **Date**: 2026-06-25 | **Spec**: [spec.md](spec.md)

## Summary

Preserve the existing scenario selector and simulation pipeline. Add one-action
copying beside the existing LAMMPS preview. Store each frame's box lengths in the
existing simulation frame list, derive box strain and Poisson ratio with a small
pure TypeScript helper, and render the selected-frame values plus a lightweight
frame-number graph without adding dependencies.

## Technical Context

**Language/Version**: TypeScript 5.9

**Primary Dependencies**: React 19, Vite, three.js, Tailwind, `lammps.js`

**Storage**: Existing browser memory and simulation frame refs

**Testing**: Node 22 built-in test runner for the pure analysis helper; existing build

**Target Platform**: Recent WebGL 2-capable desktop browsers

**Project Type**: Single React browser application

**Performance Goals**: Selected-frame metrics update immediately; chart remains
responsive for the existing in-memory frame sequence.

**Constraints**: Minimal diff, no new dependency or framework, preserve existing
simulation scripts and public data formats.

**Scale/Scope**: Two existing simulation scenarios and one active simulation run.

## Constitution Check

- Uses the existing TypeScript/React application and dependencies: PASS
- Preserves existing architecture and introduces no framework: PASS
- Limits changes to existing UI/simulation files plus one pure helper and test: PASS
- Follows existing naming and style conventions: PASS
- Relies on typed frame data and validates only unavailable box measurements: PASS
- Adds focused automated tests using built-in tooling: PASS
- Preserves public APIs and LAMMPS formats: PASS

## Project Structure

```text
src/
├── App.tsx
├── Simulation.tsx
└── poisson.ts

tests/
└── poisson.test.ts
```

**Structure Decision**: Keep scenario selection and copy controls in `App.tsx`,
simulation-frame analysis in `Simulation.tsx`, and isolate the scientific formula
in `poisson.ts` so it is directly testable without a UI framework.

## Complexity Tracking

No constitution violations.
