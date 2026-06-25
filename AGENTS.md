# Repository Guidelines

This project uses GitHub Spec Kit skills in `.agents/skills/`.

Read `.specify/memory/constitution.md` before planning or implementing features.
For non-trivial feature work, create a spec under `specs/`, then a plan and task
list before editing app code.

## Project Context

- App stack: React 19, TypeScript, Vite, Tailwind utilities, three.js, `lammps.js`.
- Source code lives in `src/`; static LAMMPS scripts and sample data live in
  `public/`.
- Keep the app browser-local unless a feature plan explicitly justifies changing
  that model.
- Preserve simulation data integrity for atom, bond, angle, export, script, and
  frame-parsing changes.
- Prefer fewer moving parts, direct TypeScript/React code, and existing dependencies.
- Preserve the existing architecture unless a concrete requirement cannot fit it.
- Keep diffs minimal and follow neighboring naming and style conventions.
- Do not change public APIs, exported types, or data formats without user approval.
- Never introduce a new framework unless explicitly requested.
- Trust typed internal invariants. Validate only actual external boundaries.
- Do not add speculative conditions, wrappers, abstractions, or fallback paths.

## Verification

- Add or update focused tests for behavioral changes using the existing test approach.
- Ask before introducing a test framework when the repository has no suitable one.
- Run `npm run build` for production-impacting changes.
- Use a representative input/output check for parser, export, or simulation-data
  changes.
- Report checks that could not run; do not add unrelated test infrastructure.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
