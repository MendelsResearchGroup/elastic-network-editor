# Feature Specification: Edit and Simulate Elastic Networks

**Feature Branch**: `main` (existing-project baseline)

**Created**: 2026-06-25

**Status**: Draft

**Input**: User description: "Users edit nodes and spring edges with the mouse,
build a LAMMPS-compatible network, simulate it, and play or pause the saved
simulation to inspect what happens."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit an Elastic Network (Priority: P1)

A user creates and changes an elastic network directly on the canvas. The user can
add nodes, connect nodes with springs, move nodes with the mouse, select network
elements, and remove elements that are no longer needed.

**Why this priority**: The editable network is the source of every later export
and simulation. Without this journey, the product has no useful input.

**Independent Test**: Start with the default network, add a node and spring, drag
the node to a new position, then remove the new elements. The canvas must reflect
each action immediately and leave the original network intact.

**Acceptance Scenarios**:

1. **Given** an open network, **When** the user adds a node, **Then** a new node
   appears on the canvas and can be selected and moved.
2. **Given** two nodes, **When** the user connects them, **Then** one spring edge
   appears between those nodes.
3. **Given** a selected node, **When** the user drags it, **Then** the node and its
   connected springs follow the pointer while preserving the connections.
4. **Given** selected nodes or springs, **When** the user deletes them, **Then**
   they disappear and no spring remains connected to a deleted node.
5. **Given** a completed edit, **When** the user chooses undo and then redo,
   **Then** the network returns to the state before and after that edit.

---

### User Story 2 - Produce a Simulation-Ready Network (Priority: P2)

A user sees that the current visual network has a corresponding
simulation-compatible representation containing the same nodes, spring
connections, positions, and spring properties.

**Why this priority**: The visual design must accurately become the scientific
network that will be simulated.

**Independent Test**: Create a small network with three nodes and two springs,
assign distinct spring properties, and inspect the generated representation. It
must contain exactly those nodes, connections, positions, and properties.

**Acceptance Scenarios**:

1. **Given** a valid edited network, **When** the network changes, **Then** its
   simulation-ready representation updates to match the current design.
2. **Given** nodes with defined positions, **When** the representation is
   generated, **Then** each node appears once at its current position.
3. **Given** springs with defined endpoints and properties, **When** the
   representation is generated, **Then** each spring appears once with the correct
   endpoints and properties.
4. **Given** a network loaded from a supported file, **When** loading completes,
   **Then** the canvas and generated representation describe the same network.

---

### User Story 3 - Simulate and Review Network Motion (Priority: P3)

A user runs a simulation for the network currently shown in the editor. As results
become available, the application saves a sequence of frames. The user can play,
pause, and move directly to any saved frame to inspect how the network changes.

**Why this priority**: Simulation playback turns the edited structure into an
observable mechanical result and completes the main product workflow.

**Independent Test**: Run a simulation for a visible network, wait for multiple
frames, pause playback, select an earlier frame, and resume playback. The displayed
network must match the selected frame and continue in sequence when resumed.

**Acceptance Scenarios**:

1. **Given** a simulation-ready network, **When** the user starts a simulation,
   **Then** the simulation uses a snapshot of the network visible at that moment.
2. **Given** a running simulation, **When** result frames arrive, **Then** they are
   saved in order and the current frame is displayed.
3. **Given** multiple saved frames, **When** the user presses pause, **Then**
   automatic frame progression stops on the current frame.
4. **Given** paused playback, **When** the user selects a saved frame, **Then** the
   viewer displays that frame and identifies its position in the sequence.
5. **Given** paused playback before the last frame, **When** the user presses play,
   **Then** frames advance in order until paused or the final frame is reached.
6. **Given** results from an earlier simulation, **When** the user starts a new
   simulation, **Then** the previous frame sequence is replaced by the new result.

### Edge Cases

- An empty network cannot be simulated, and the simulation action remains
  unavailable until the network contains nodes.
- A failed simulation displays a clear failure state without changing the edited
  network.
- A result containing only one frame can be inspected, but playback remains
  stopped because there is no next frame.
- Loading an unsupported or malformed network file reports that the file cannot
  be used and preserves the current network.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to add, select, move, and remove network nodes
  through direct interaction with the editor.
- **FR-002**: Users MUST be able to create and remove spring connections between
  nodes.
- **FR-003**: The system MUST preserve each spring connection when either endpoint
  is moved.
- **FR-004**: Removing a node MUST also remove every spring connected to it.
- **FR-005**: Users MUST be able to undo and redo network edits.
- **FR-006**: The system MUST maintain a simulation-ready representation matching
  the current nodes, positions, spring connections, and spring properties.
- **FR-007**: Users MUST be able to load a supported network file into the editor.
- **FR-008**: Starting a simulation MUST use a snapshot of the current network so
  later editor changes cannot alter that run's saved frames.
- **FR-009**: The system MUST save simulation frames in the order they are
  produced.
- **FR-010**: Users MUST be able to play and pause progression through saved
  simulation frames.
- **FR-011**: Users MUST be able to select any available saved frame directly.
- **FR-012**: The viewer MUST display the selected frame's node positions and
  spring connections.
- **FR-013**: The viewer MUST show the selected frame's position within the saved
  sequence.
- **FR-014**: Starting a new simulation MUST replace the previous saved frame
  sequence.
- **FR-015**: Simulation or file-loading failures MUST leave the current edited
  network available for continued work.

### Key Entities

- **Network**: The current editable design, containing nodes and springs.
- **Node**: A positioned point in the network with a stable identifier.
- **Spring**: A connection between two nodes with mechanical properties used by
  the simulation.
- **Simulation Run**: One execution based on a snapshot of a network.
- **Simulation Frame**: One ordered state of node positions and spring connections
  produced during a simulation run.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can add a node, connect it, move it, and remove it
  in under two minutes without leaving the editor.
- **SC-002**: For a representative network, 100% of visible nodes and springs
  appear exactly once with matching values in the simulation-ready representation.
- **SC-003**: A user can start a simulation from the editor in no more than two
  deliberate actions.
- **SC-004**: Once frames are available, play, pause, and direct frame selection
  update the displayed result within 200 milliseconds of user input.
- **SC-005**: Every saved frame in a completed run is directly selectable and
  displays its correct sequence position.
- **SC-006**: A user can complete the full edit, simulate, pause, inspect, and
  resume workflow without reloading the application or losing the edited network.

## Assumptions

- The product is intended for one user editing one network at a time.
- Internal network values satisfy their declared types and invariants.
- The supported workflow uses a recent desktop browser with mouse or equivalent
  pointer input.
- Simulation playback is based on frames saved during the current application
  session; long-term storage of simulation results is outside this feature.
- Starting a new simulation intentionally replaces the previous simulation result.
- Advanced simulation-script authoring and modification are outside this feature.
