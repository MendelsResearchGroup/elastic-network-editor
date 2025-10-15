# Elastic Network Editor

Elastic Network Editor is a browser-based playground for sketching elastic spring networks, exporting them as LAMMPS data files, and running quick simulations to explore metamaterial behaviors such as auxetic responses or negative thermal expansion (NTE). Everything happens locally thanks to LAMMPS compiled to WebAssembly, so iterations are fast and reproducible.

## Highlights

- **Interactive graph editor** – Add or remove atoms and bonds, drag selections with optional grid snapping, and edit spring constants directly on the canvas or in the data tables.
- **Undo-friendly workflow** – Full undo/redo history, plus copy/paste and delete shortcuts for rapidly iterating on lattice layouts.
- **LAMMPS export on the fly** – The side panel always shows the current `.lmp` data file, including inferred angle terms and bond coefficients.
- **Built-in simulations** – Launch LAMMPS scripts in a three.js viewer without leaving the page; switch between scenarios like thermal expansion or auxetic compression.
- **Script extensibility** – Drop additional deformation scripts or support files in `public/` to prototype new load cases or potentials.

## Quick Start

Prerequisites:

- Node.js 18+ (Node 20 recommended)
- npm 9+

Install dependencies and start the dev server:

```sh
npm install
npm run dev
```

Visit the printed local address (normally `http://localhost:5173`). The app also supports `npm run build` for production bundles and `npm run preview` to serve the built site locally.

## Using the Editor

1. **Build a network**
   - Use _Add Atom_ and _Add Bond_ to seed the lattice.
   - Shift+click to add or remove items from the selection; drag a selected atom to move the whole group.
   - Toggle the grid and snapping controls at the bottom of the canvas and adjust spacing to keep geometries tidy.
   - Double-click a `k=` label or edit the tables on the right to tweak individual spring constants.

2. **Import existing geometries**
   - Choose _Load .lmp_ and pick a LAMMPS data file (see `public/minimal_network.lmp` for the expected format).
   - The parser keeps atom IDs and bond stiffness values, so you can continue editing immediately.

3. **Export to LAMMPS**
   - The current network is always mirrored in the _LAMMPS data preview_. Copy the text into your own workflow or save it to disk.
   - Bonds automatically generate angle definitions and reference bond lengths; z positions remain flat so you can simulate 2D sheets with out-of-plane perturbations.

4. **Run a simulation**
   - Pick a scenario from the _Script_ dropdown and hit _Simulate_.
   - The WebAssembly LAMMPS engine (`lammps.js`) runs in the background; you can pause, resume, scrub through frames, or follow the live stream of timesteps.
   - Additional script assets (e.g., potentials, macros) are loaded from `public/` and mirrored into the LAMMPS virtual filesystem before each run.

## Extending Simulations

- Scripts live alongside the app in `public/*.deformation` (see `public/thermal-expand.deformation`).
- Scenario-specific assets belong in subdirectories (e.g., `public/auxetic/`) and are listed in `SIMULATION_SCRIPTS` inside `src/App.tsx`.
- Each script is wrapped in an auto-generated `in.lmp` that disables default logging for cleaner output. Modify `src/useLammps.ts` if you need different bootstrapping behavior.

## Tech Stack

- React 19 + Vite + TypeScript for the UI and state management.
- Tailwind utilities for layout and styling.
- three.js for the real-time 3D simulation viewer.
- `lammps.js` (WebAssembly build) to execute LAMMPS entirely in-browser.

## Useful npm Scripts

- `npm run dev` – start the Vite dev server with hot module reload.
- `npm run build` – type-check with `tsc --build` and create a production bundle.
- `npm run preview` – serve the production build locally.
- `npm run lint` – run ESLint across the project.

## Notes

- WebAssembly memory is finite; extremely dense networks may exhaust the default allocation. If that happens, raise the `-s TOTAL_MEMORY` flag in your LAMMPS build or trim the structure.
- Simulations run entirely in the browser. No data leaves your machine unless you export it manually.
- Tested in recent Chromium- and Firefox-based browsers; WebGL 2 support is required for rendering.

Happy exploring; let us know what exotic mechanical responses you uncover!
