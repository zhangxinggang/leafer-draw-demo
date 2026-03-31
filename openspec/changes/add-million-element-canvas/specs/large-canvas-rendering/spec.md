## ADDED Requirements

### Requirement: Million-box test dataset

The system SHALL provide a “100 万个箱体” preset under “连接矩形 -> 数据测试” that creates one logical scene containing exactly 1,000,000 `RectLine`-compatible boxes arranged as a 1000 × 1000 grid.

The generated dataset SHALL preserve the current box business text semantics, SHALL support an optional shared or per-box SVG/PNG background reference, and SHALL be generated outside the main thread with visible progress and cancellation.

The generator SHALL NOT materialize duplicate full-scene object arrays in Zustand, the Leafer tree, undo history, worker messages, and persistent storage.

#### Scenario: Generate one million boxes

- **WHEN** the user selects “100 万个箱体” and starts data generation
- **THEN** the system creates exactly 1,000,000 logical boxes in a 1000 × 1000 grid
- **AND** each box exposes the same four business text lines as the current `RectLine`
- **AND** progress is displayed while the main UI remains responsive
- **AND** the user can cancel generation without leaving partial resources or corrupt scene state

#### Scenario: Generate boxes with shared image resources

- **WHEN** the million-box fixture references the same PNG or SVG from multiple boxes
- **THEN** the underlying image resource is decoded and cached once per required resolution
- **AND** boxes retain independent background references without duplicating the original image bytes

### Requirement: Level-of-detail rendering for million-box scenes

The system SHALL render the complete spatial distribution of 1,000,000 boxes in one overview viewport without creating one persistent Leafer display object per box or text line.

The system SHALL select visual detail from the projected screen size of each box. It SHALL render full text, background imagery, and connection details only when those details have enough screen pixels to be meaningful, and SHALL progressively restore them as the user zooms in.

LOD transitions SHALL use hysteresis or an equivalent stability rule and SHALL preserve geometry, colors, IDs, z-order semantics, and selection state across levels.

#### Scenario: View all boxes at overview scale

- **WHEN** the user fits a 1,000,000-box scene into the viewport
- **THEN** the spatial distribution and box boundaries or equivalent pixel-accurate aggregate representation are visible
- **AND** unreadable text glyphs, image details, and arrow heads are omitted or aggregated
- **AND** omitting those details does not remove their logical data

#### Scenario: Zoom from overview to readable detail

- **WHEN** the user zooms until a box has sufficient screen-space size for its text and background
- **THEN** the visible box is progressively rendered with all business text lines at readable resolution
- **AND** its SVG or PNG background is rendered at the appropriate resolution
- **AND** repeated zooming near a LOD boundary does not cause visible oscillation or stale selection state

#### Scenario: Pan across a detailed scene

- **WHEN** the user pans at a detailed zoom level
- **THEN** the renderer requests and draws only visible and prefetched chunks
- **AND** off-screen glyph and image resources remain within a bounded cache
- **AND** resources evicted from the cache can be restored without changing scene data

### Requirement: Million-scale connection rendering

The system SHALL support up to 1,000,000 explicitly stored connection edges in the million-box acceptance dataset.

Connections SHALL use compact endpoint/style data and batched rendering rather than one Leafer connector object plus endpoint listeners per edge. Node changes SHALL recompute only affected edges.

At overview scales the system MAY aggregate or hide individual edges and arrow heads; at detailed scales it SHALL render the original visible connections and arrow direction.

The acceptance scope SHALL NOT include the complete all-pairs graph of 1,000,000 nodes.

#### Scenario: View one million explicit connections at overview scale

- **WHEN** the scene contains up to 1,000,000 explicit edges and is shown at overview scale
- **THEN** the renderer uses aggregation, sampling, or visibility rules that keep interaction within the performance budget
- **AND** the UI indicates when connection detail is aggregated or hidden
- **AND** the original endpoints and direction remain available in logical data

#### Scenario: Inspect connections at detailed scale

- **WHEN** the user zooms into boxes with explicit connections
- **THEN** all connections intersecting the detailed visible region are drawn with their original endpoints and arrow direction
- **AND** moving one endpoint updates only its adjacent visible edges

### Requirement: Large-scene interaction compatibility

The system SHALL keep Leafer UI 2.3.0 behavior unchanged for ordinary scenes and SHALL expose large-scene elements through a compatibility adapter for existing editor commands.

Selection, hover, move, scale, rotate, copy, delete, align, snap, ruler, property editing, undo/redo, business validation, and connection updates SHALL preserve their current externally observable semantics. Only active or visible detailed elements MAY be materialized in the Leafer interaction overlay.

#### Scenario: Edit one box in a million-box scene

- **WHEN** the user selects and edits a box rendered by the large-scene backend
- **THEN** the box is represented by the Leafer interaction overlay with the same handles and property behavior as an ordinary `RectLine`
- **AND** committed changes update the logical large-scene data and batched renderer
- **AND** undo and redo restore the before and after values without copying the full dataset

#### Scenario: Use an existing ordinary canvas

- **WHEN** a scene remains below the large-scene threshold or the large-scene feature flag is disabled
- **THEN** existing elements continue through the Leafer UI 2.3.0 `cmpRender` path
- **AND** all existing editor and PNG/JPG export behavior remains unchanged

#### Scenario: Large renderer cannot initialize

- **WHEN** WebGL2 is unavailable, initialization fails, or the context cannot be restored
- **THEN** scene data remains intact
- **AND** the system falls back to the ordinary renderer where possible
- **AND** the user is informed that million-scale performance is no longer guaranteed

### Requirement: Million-scene performance budget

The system SHALL provide a reproducible benchmark for a 1000 × 1000 grid of 100 × 100 scene-unit boxes with four text lines per box, plus variants for shared PNG, shared SVG, and up to 1,000,000 explicit O(N) connections.

On the recorded acceptance profile (Windows 11, current stable Chrome, 1920 × 1080 at DPR 1, at least 8 logical CPU cores, 16 GiB memory, and a WebGL2-capable integrated GPU), the benchmark SHALL meet all of the following:

- Time from generation start to interactive overview has p95 no greater than 10 seconds.
- After warm-up, a 30-second pan/zoom trace has frame-time p95 no greater than 16.7 ms and p99 no greater than 33.3 ms.
- Input-to-first-response-frame latency has p95 no greater than 50 ms.
- Settled million-box scene memory is no greater than 1.5 GiB.
- Visible detailed text/image/connection refinement completes within 200 ms without blocking navigation.

#### Scenario: Run the acceptance benchmark

- **WHEN** the fixed million-scene benchmark is executed on the acceptance profile
- **THEN** the report records build, browser, driver, CPU, memory, GPU, dataset variant, frame-time percentiles, input latency, long tasks, JS heap, and process/GPU memory
- **AND** every required threshold is evaluated independently
- **AND** a regression in any required threshold fails performance acceptance

#### Scenario: Run on hardware below the acceptance profile

- **WHEN** the benchmark runs on a device below the recorded acceptance profile
- **THEN** functional correctness is still evaluated
- **AND** performance measurements are reported as diagnostic rather than treated as guaranteed SLA results

### Requirement: Large-scene resource lifecycle

The system SHALL use bounded caches and SHALL release Worker, buffer, texture, decoded image, font atlas, event listener, and export resources when a large scene is replaced, destroyed, cancelled, or falls back.

#### Scenario: Leave a million-box scene

- **WHEN** the user opens another scene or destroys the editor after viewing a million-box scene
- **THEN** all scene-specific GPU buffers, textures, workers, object URLs, and listeners are released
- **AND** reopening an ordinary scene does not retain the million-scene working set
