# Feature Specification: Simulation Options and Box Analysis

**Feature Branch**: `main` (existing-project enhancement)

**Created**: 2026-06-25

**Status**: Implemented

**Input**: User description: "Users choose between simulations such as horizontal
auxetic compression and thermal expansion, view and copy the generated LAMMPS
network, and see the simulation box Poisson ratio."

## Clarifications

### Session 2026-06-25

- Q: How should Poisson ratio be presented? → A: Show both the selected-frame value and a graph across all valid frames.
- Q: What should the Poisson-ratio graph use for its horizontal axis? → A: Simulation frame number.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose a Simulation Scenario (Priority: P1)

A user chooses the physical experiment to run on the currently edited network.
Available scenarios include horizontal compression for observing auxetic behavior
and heating for observing thermal expansion.

**Why this priority**: The same network may have different useful properties under
different experiments. The selected scenario determines what behavior the user
observes.

**Independent Test**: Select horizontal compression, start a run, then select
thermal expansion and start another run. Each run must identify and apply the
scenario selected immediately before it starts.

**Acceptance Scenarios**:

1. **Given** an editable network, **When** the user opens the simulation choices,
   **Then** each available scenario has a distinct, understandable name.
2. **Given** horizontal compression is selected, **When** the user starts the
   simulation, **Then** the run compresses the box along the horizontal direction.
3. **Given** thermal expansion is selected, **When** the user starts the
   simulation, **Then** the run heats the network and allows the box dimensions to
   respond.
4. **Given** a simulation is already complete, **When** the user chooses another
   scenario and starts it, **Then** the new run replaces the previous run's
   results without changing the edited network.

---

### User Story 2 - Inspect and Copy the Generated Network (Priority: P2)

A user can inspect the complete simulation-ready LAMMPS network generated from the
current visual design and copy it for use in another LAMMPS workflow.

**Why this priority**: Creating a network with a special mechanical property is
the product's main output. Users must be able to see and reuse the exact network
they created.

**Independent Test**: Edit a small network, copy the displayed LAMMPS network,
paste it into a plain-text destination, and compare it with the displayed content.
The two texts must be identical and represent the current edited network.

**Acceptance Scenarios**:

1. **Given** a valid edited network, **When** the user views the LAMMPS network,
   **Then** the full generated text is visible in a readable fixed-width format.
2. **Given** the LAMMPS network is visible, **When** the user copies it, **Then**
   the complete text is placed on the clipboard in one action.
3. **Given** the user changes a node, spring, position, or spring property,
   **When** the edit is committed, **Then** the visible LAMMPS network updates to
   represent the new design.
4. **Given** a simulation has started, **When** the user inspects its input,
   **Then** it matches the network snapshot used for that run.

---

### User Story 3 - Review Box Response and Poisson Ratio (Priority: P3)

A user can review the simulation box dimensions for the selected frame and, for a
scenario with a defined loading direction, see the Poisson ratio calculated from
the box's axial and transverse strain relative to the first frame. The user can
also see how Poisson ratio changes across all valid frames in the run.

**Why this priority**: The measurement helps users determine whether the designed
network has the intended mechanical property instead of relying only on visual
inspection.

**Independent Test**: Run horizontal compression until the box dimensions change,
select several saved frames, and independently calculate axial strain, transverse
strain, and Poisson ratio from the displayed dimensions. The displayed values must
match within the stated precision, and the graph must contain the corresponding
valid-frame measurements.

**Acceptance Scenarios**:

1. **Given** a simulation with saved frames, **When** the user selects a frame,
   **Then** the current horizontal and vertical box dimensions are visible.
2. **Given** a horizontal-compression run, **When** the selected frame has nonzero
   horizontal strain, **Then** the displayed Poisson ratio equals negative
   transverse strain divided by axial strain.
3. **Given** the first frame or another frame with effectively zero axial strain,
   **When** the user inspects the metric, **Then** Poisson ratio is shown as
   unavailable rather than infinite or misleading.
4. **Given** a thermal-expansion run, **When** the selected frame has nonzero
   horizontal strain, **Then** the displayed box-level Poisson ratio uses
   horizontal strain as axial and vertical strain as transverse.
5. **Given** the user changes the selected frame, **When** the frame display
   updates, **Then** the box measurements and Poisson ratio update for that same
   frame.
6. **Given** a run with multiple valid Poisson-ratio measurements, **When** the
   user views the results, **Then** a graph shows the measurements across the run
   by simulation frame number and identifies the point corresponding to the
   selected frame.

### Edge Cases

- A scenario cannot run until the network contains enough information to produce a
  valid simulation input.
- A scenario that fails to produce box dimensions reports that measurements are
  unavailable while preserving any viewable simulation frames.
- Poisson ratio is unavailable when the reference box dimensions are missing,
  zero, or invalid.
- Copying an empty or unavailable network is disabled.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST present all available simulation scenarios as a
  single selectable set.
- **FR-002**: Each scenario MUST have a user-facing name that describes the
  physical experiment.
- **FR-003**: Starting a simulation MUST use the scenario selected at that moment.
- **FR-004**: The available scenarios MUST include horizontal compression and
  thermal expansion.
- **FR-005**: The current simulation-ready LAMMPS network MUST remain visible while
  the user edits the network.
- **FR-006**: The visible LAMMPS network MUST update after every committed change
  to nodes, springs, positions, or spring properties.
- **FR-007**: Users MUST be able to copy the complete visible LAMMPS network in one
  action without modifying it.
- **FR-008**: Each simulation run MUST retain the exact network snapshot and
  scenario used to start that run.
- **FR-009**: Every simulation frame that provides valid box information MUST
  expose its horizontal and vertical box dimensions.
- **FR-010**: Poisson-ratio analysis MUST use the horizontal box direction as axial
  and the vertical box direction as transverse for every simulation scenario.
- **FR-011**: Axial strain MUST be calculated as the selected frame's axial
  dimension change divided by the initial axial dimension.
- **FR-012**: Transverse strain MUST be calculated as the selected frame's
  transverse dimension change divided by the initial transverse dimension.
- **FR-013**: Poisson ratio MUST be calculated as negative transverse strain
  divided by axial strain.
- **FR-014**: For horizontal compression, the horizontal box direction MUST be
  axial and the vertical box direction MUST be transverse.
- **FR-015**: Poisson ratio MUST be shown as unavailable when axial strain is
  below `0.000001` in magnitude or when required box information is invalid.
- **FR-016**: Poisson ratio MUST be available for both horizontal compression and
  thermal expansion when the horizontal strain is large enough to calculate it.
- **FR-017**: Box measurements and derived values MUST correspond to the currently
  selected simulation frame.
- **FR-018**: Displayed box dimensions, strains, and Poisson ratio MUST provide at
  least four significant digits when valid.
- **FR-019**: Applicable simulation results MUST include a graph of Poisson ratio
  across all frames with valid measurements.
- **FR-020**: The graph's horizontal axis MUST use simulation frame number.
- **FR-021**: The graph MUST identify which plotted point corresponds to the
  currently selected simulation frame.
- **FR-022**: Frames without a valid Poisson-ratio measurement MUST NOT be plotted
  as numeric values.

### Key Entities

- **Simulation Scenario**: A named physical experiment with a defined deformation
  or temperature change.
- **Network Snapshot**: The complete LAMMPS network text captured when a simulation
  starts.
- **Box State**: The horizontal and vertical dimensions associated with one
  simulation frame.
- **Strain Measurement**: The relative dimensional change between the initial box
  and a selected frame.
- **Poisson Ratio Measurement**: The negative ratio of transverse strain to axial
  strain for a scenario with a defined loading direction.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can identify and choose either horizontal compression or
  thermal expansion in no more than two deliberate actions.
- **SC-002**: The network used by a run matches the visible LAMMPS network at the
  moment the run starts for 100% of representative edit cases.
- **SC-003**: A user can copy the complete LAMMPS network in one action, and pasted
  content matches the visible text exactly.
- **SC-004**: Box dimensions and derived measurements update within 200
  milliseconds after the user selects an available frame.
- **SC-005**: For representative horizontal-compression frames, displayed axial
  strain, transverse strain, and Poisson ratio agree with independent calculations
  to at least four significant digits.
- **SC-006**: No completed run displays an infinite or undefined numeric value as a
  valid Poisson ratio.
- **SC-007**: A user can edit a network, choose a scenario, run it, inspect the
  Poisson ratio when applicable, and copy the network without reloading the
  application.
- **SC-008**: For a representative run, every frame with a valid independently
  calculated Poisson ratio appears once in the graph, and selecting a plotted
  frame identifies the same value shown in the selected-frame measurement.

## Assumptions

- Horizontal compression is the auxetic-analysis scenario: horizontal strain is
  axial and vertical strain is transverse.
- The first valid frame in a run provides the reference box dimensions.
- Thermal expansion uses horizontal box strain as axial and vertical box strain as
  transverse for the displayed box-level ratio.
- Box-level Poisson ratio characterizes the simulated periodic box and does not
  claim to measure local strain variations inside the network.
- The visible and copied output is the LAMMPS network data, not the selected
  deformation scenario's full command script.
- Adding user-authored simulation scenarios is outside this feature.
