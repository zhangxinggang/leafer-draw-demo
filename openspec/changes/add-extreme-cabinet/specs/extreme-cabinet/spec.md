## ADDED Requirements

### Requirement: Cabinet configuration

The system SHALL provide the second algorithm card named 极限箱体 and configurable screen/module width and height, receiver maximum module columns and rows, sender name defaulting to V6, sender width/height/load/port limits, and port load defaulting to 650000. It SHALL display receiver dimensions and min(sender load, ports \* port load).

#### Scenario: Valid configuration

- **WHEN** the user enters positive safe integer values and the screen can contain at least one complete module
- **THEN** the system computes dimensions, limits and a complete layout

#### Scenario: Nondivisible screen dimensions

- **WHEN** the screen width or height is not divisible by its corresponding module dimension
- **THEN** the system floors the module column and row counts, lays complete modules from the screen's top-left, and leaves the right or bottom remainder visible as gray screen without requiring manual input changes

#### Scenario: Invalid grid

- **WHEN** the screen cannot contain one complete module or one module exceeds a sender or port limit
- **THEN** the system explains the invalid input and does not show it as a valid solution

#### Scenario: Rename sender model

- **WHEN** the user changes the sender name
- **THEN** both diagrams and device details update immediately without rerunning optimization; an empty name falls back to 发送卡

### Requirement: Exact hierarchical optimization

The system MUST lexicographically minimize sender count, then receiver count, then cable count over all module-aligned rectangular partitions. Receiver dimensions SHALL vary within configured maxima. Each cable SHALL cover a rectangle of receivers, and each sender SHALL cover a rectangle of cables. Port area, sender width/height/load and port count limits MUST hold.

#### Scenario: Multiple feasible layouts

- **WHEN** several layouts satisfy all constraints
- **THEN** fewer senders takes priority over any receiver/cable saving, and fewer receivers takes priority over fewer cables

#### Scenario: Expensive exact search

- **WHEN** initial construction does not match proven lower bounds
- **THEN** a Worker publishes a fully validated feasible incumbent before exact state enumeration, continues complete exact search in the background, and marks global optimality only after proof

#### Scenario: Both directions are optimal

- **WHEN** the row-priority and column-priority searches each prove the same lexicographic optimum
- **THEN** the system displays two separate wiring diagrams with their counts and marks both globally optimal

#### Scenario: Partial proof

- **WHEN** sender optimality or sender and receiver optimality have been proved but a later objective is still searching
- **THEN** the system reports the proved objectives and the current objective without claiming global optimality

#### Scenario: A completed exclusion raises a count bound

- **WHEN** a completed feasibility proof excludes the current receiver or cable count
- **THEN** the solver publishes the increased bound with its current feasible layout before searching the next count

### Requirement: Layered wiring diagram

The system SHALL draw a gray screen, a complete nonoverlapping module grid from its top-left, pale sender-colored receivers and transparent sender outlines in distinct colors. Cables of one sender SHALL use distinct shades of that sender's color. Counts of modules, receivers, senders and cables SHALL be visible.

The diagram SHALL use native Leafer nodes through the existing momoDraw App, RectLine and Connector renderers instead of SVG. momoEditor SHALL share the same connection geometry, endpoint marks and colors. Each diagram and expanded view SHALL maintain an independent App and viewport.

#### Scenario: Shared native rendering

- **WHEN** the editor or an extreme-cabinet diagram renders connected receivers
- **THEN** both use the shared native connection renderer; cabinet diagrams do not register themselves as the editor's global App or mutate its business relationships

#### Scenario: Draw without moving the viewport

- **WHEN** the user selects 矩形连线 or 连线矩形 in momoEditor and drags on the canvas
- **THEN** the intended rectangles or connections are created while the viewport remains fixed; selecting 移动 restores deliberate panning

#### Scenario: Inspect wiring

- **WHEN** a layout is rendered
- **THEN** all underlying modules/receivers remain visible, cable coverage is rectangular and each arrow order and endpoint can be inspected

### Requirement: Wiring labels and endpoints

Each receiver SHALL show sender name and index, actual width and height, module columns and rows, global cable index and local port index. Arrows SHALL join receiver centers, with triangles at receiver boundaries, a circular start badge showing sender-port indices and a square end marker. The system SHALL provide expanded diagram viewing with independent zoom and pan.

#### Scenario: Reference wiring style

- **WHEN** a V6 sender covers receivers of two modules wide and six modules high
- **THEN** its receivers show V6-1, actual width and height, and 2宽6高; circular start badges show 1-1, 1-2 and subsequent ports, and other senders use different colors

#### Scenario: Single receiver cable

- **WHEN** a cable contains only one receiver
- **THEN** its start and end coincide at the receiver center and a square outline surrounds its circular numbered badge

#### Scenario: Expand wiring diagram

- **WHEN** the user expands either direction's diagram
- **THEN** the system shows a larger dialog with counts and the same labels and wiring, with independent zoom and pan controls
