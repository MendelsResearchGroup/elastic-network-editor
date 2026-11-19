# Implementation plan

Extend the existing graph model with optional imported data so existing saved drawings remain readable. Adapt the parser, generator and React state together. Capture reference dimensions in the LAMMPS script, and keep the engine suspended at a step callback during a pause. Use the existing lammps.js library for simulation, React for controls, and Node's test runner for regression tests.
