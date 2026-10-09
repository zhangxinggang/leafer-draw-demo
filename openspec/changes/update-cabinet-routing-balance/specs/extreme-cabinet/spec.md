## MODIFIED Requirements

### Requirement: Exact hierarchical optimization

The system MUST lexicographically minimize sender count, receiver count, the sum of squared receiver counts per sender, then cable count. Receivers SHALL cover module-aligned rectangles with independently bounded width and height. Senders SHALL cover rectangles. Regular-mode cables SHALL cover rectangles; free-mode cables MAY cover nonrectangular regions but MUST form paths through shared-edge adjacent receivers. Port load, sender width/height/load and port count limits MUST hold.

#### Scenario: Multiple feasible layouts

- **WHEN** several layouts satisfy all constraints
- **THEN** fewer senders takes priority over any other saving, fewer receivers takes priority over balance, and better receiver balance takes priority over fewer cables

#### Scenario: Expensive exact search

- **WHEN** initial construction does not match proven lower bounds
- **THEN** a Worker publishes a fully validated feasible incumbent before exact state enumeration, continues complete exact search in the background, and marks global optimality only after proof of all four objectives

#### Scenario: Both directions are optimal

- **WHEN** the row-priority and column-priority searches prove the same optimum for the same configuration and mode
- **THEN** the system displays two separate wiring diagrams and marks both globally optimal

#### Scenario: Partial proof

- **WHEN** sender optimality or sender and receiver optimality have been proved but a later objective is still searching
- **THEN** the system reports the proved objectives and the current objective without claiming global optimality

#### Scenario: A completed exclusion raises a count bound

- **WHEN** a completed feasibility proof excludes the current receiver or cable count
- **THEN** the solver publishes the increased bound with its current feasible layout before searching the next count

### Requirement: Layered wiring diagram

The system SHALL draw a gray screen, a complete nonoverlapping module grid from its top-left, receivers colored consistently by actual module width and height, and transparent sender outlines in distinct colors. Cables of one sender SHALL use distinct shades of that sender's color. Counts of modules, receivers, senders and cables SHALL be visible.

The diagram SHALL use native Leafer nodes through the existing momoDraw App, RectLine and Connector renderers instead of SVG. momoEditor SHALL share the same connection geometry, endpoint marks and colors. Each diagram and expanded view SHALL maintain an independent App and viewport.

#### Scenario: Shared native rendering

- **WHEN** the editor or an extreme-cabinet diagram renders connected receivers
- **THEN** both use the shared native connection renderer; cabinet diagrams do not register themselves as the editor's global App or mutate its business relationships

#### Scenario: Draw without moving the viewport

- **WHEN** the user selects 矩形连线 or 连线矩形 in momoEditor and drags on the canvas
- **THEN** the intended rectangles or connections are created while the viewport remains fixed; selecting 移动 restores deliberate panning

#### Scenario: Inspect wiring

- **WHEN** a layout is rendered
- **THEN** underlying modules and receivers remain visible, regular-mode cable coverage is rectangular, free-mode cables show their actual receiver sequence, and every arrow and endpoint can be inspected

## ADDED Requirements

### Requirement: Bounded integer receivers

Each receiver MUST cover a positive integer number of complete modules. Its columns and rows SHALL be independently bounded by the user configuration and MAY be smaller to improve the global device counts.

#### Scenario: Shrink a receiver

- **WHEN** the configured maximum is 2 columns by 4 rows
- **THEN** a 1 by 3 receiver is permitted, while a 3 by 2 or 1 by 5 receiver is rejected

### Requirement: Balanced optimal device allocation

The system MUST minimize sender count, receiver count, the sum of squared receiver counts per sender, then cable count, in that order. A feasible result SHALL be published before the complete search; global optimality SHALL only be claimed after every objective has been proved.

#### Scenario: Balanced counts are feasible

- **WHEN** the least sender and receiver counts admit counts differing by at most one
- **THEN** the system selects such a distribution without increasing either device count

#### Scenario: Limits prevent perfect equality

- **WHEN** geometry or load limits prevent equal distribution
- **THEN** the system minimizes count variance over the feasible layouts and shows the actual distribution

### Requirement: Regular and free routing

The input area's right-hand results area SHALL provide 常规 and 自由 tabs. Regular routing SHALL preserve rectangular cable coverage. Free routing SHALL enumerate complete receiver partitions and adjacent receiver paths without requiring rectangular cable coverage; sender rectangles, independent width/height limits, total load and per-port load/count constraints MUST still hold. Every consecutive pair MUST share an edge of positive length; corner-only contact and skipping receivers SHALL be rejected. Lines SHALL pass through the shared edge and stay within the two receivers.

#### Scenario: Select free routing

- **WHEN** the user selects 自由
- **THEN** results are computed for free routing, each receiver belongs to exactly one sender and cable, and each cable connects its receivers in a deterministic shared-edge adjacent sequence

#### Scenario: Same loads with different geometry

- **WHEN** receiver partitions have identical areas but different adjacency graphs
- **THEN** the solver evaluates their adjacency independently instead of discarding a feasible partition through an area-only cache

#### Scenario: Regular seed already has optimal device counts

- **WHEN** a regular-mode initial layout already attains the count lower bounds in free mode
- **THEN** the solver still regroups adjacent receivers across old cable boundaries when a continuous nonrectangular path preserves or improves the objective, and never requires a cable's combined coverage to be rectangular

### Requirement: Layered module illustration

The illustration SHALL sit to the right of the screen inputs and above the routing tabs. It SHALL show a flat front elevation with coincident screen, module, receiver and sender layers in that drawing order, without skew, rotation or exploded-plane offsets. The diagram SHALL show a colored module grid, screen dimensions and module row/column counts, with the numeric color legend on its right. Different receiver load sizes SHALL use different colors consistently in the illustration and wiring diagrams. Rendering MUST reuse momoDraw and native Leafer nodes.

#### Scenario: Inspect the current layout

- **WHEN** a solution is available
- **THEN** the illustration and legend describe that solution and identify actual receiver sizes including reduced receivers

#### Scenario: Narrow viewport

- **WHEN** the illustration panel becomes too narrow to fit the diagram and legend
- **THEN** the legend remains to the diagram's right on the same row, with horizontal scrolling confined to the illustration panel rather than moving the legend below the diagram
