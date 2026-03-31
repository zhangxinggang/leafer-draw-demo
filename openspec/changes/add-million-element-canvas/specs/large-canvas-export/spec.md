## ADDED Requirements

### Requirement: Multi-resolution ultra-clear image package

The system SHALL export a large scene as a multi-resolution tiled image package when a single raster image would exceed the safe canvas or memory budget.

The package SHALL contain a versioned manifest, a self-contained offline zoom viewer, and lossless PNG tiles for every required pyramid level. The highest-resolution level SHALL be rendered from logical scene data at the requested native scale and SHALL NOT be produced by enlarging the overview image.

The default tile size SHALL be 512 × 512 pixels. Tile boundaries SHALL use clipping, overlap, or equivalent rules so text, strokes, backgrounds, and arrows do not show visible seams.

#### Scenario: Export the full million-box scene

- **WHEN** the user chooses “超清图片包” for the 1000 × 1000 million-box dataset
- **THEN** the exporter renders the full logical bounds as a multi-resolution PNG tile pyramid
- **AND** the ZIP contains `manifest.json`, `viewer.html`, and level/coordinate-addressed tile files
- **AND** opening the viewer initially shows the complete scene overview
- **AND** zooming to the highest level shows text rendered at native readable size rather than an enlarged overview bitmap

#### Scenario: Inspect content crossing tile boundaries

- **WHEN** a box, text glyph, background image, stroke, or arrow crosses a tile boundary
- **THEN** adjacent tiles compose without missing pixels, duplicate dark seams, or coordinate shifts
- **AND** the result matches the same region rendered directly at the requested scale within the visual tolerance

### Requirement: Streaming and cancellable large export

The system SHALL render, encode, and write tiles incrementally with a bounded queue and SHALL NOT allocate a full-scene raster in memory.

Before export, the system SHALL show estimated dimensions, level count, tile count, and output size range. During export it SHALL show monotonic progress and allow cancellation. Cancellation or failure SHALL release temporary canvases, workers, streams, object URLs, and incomplete artifacts where the platform permits.

On the acceptance profile, the export pipeline SHALL target no more than 512 MiB of additional working-set memory. Total duration and output size SHALL be reported because they scale with scene content and compression.

#### Scenario: Monitor and cancel export

- **WHEN** a user starts an ultra-clear export
- **THEN** estimated output information and progress are displayed
- **AND** the editor remains responsive to cancellation and basic navigation
- **WHEN** the user cancels
- **THEN** no further tiles are scheduled
- **AND** temporary resources and incomplete output are cleaned up or explicitly reported if the platform cannot remove them

#### Scenario: Export without full-file buffering

- **WHEN** the image package is larger than available JavaScript heap
- **THEN** the exporter streams completed tiles to the selected destination or bounded archive writer
- **AND** completed tiles are released from memory after writing
- **AND** no full-scene bitmap or full ZIP byte array is retained in memory

### Requirement: Deterministic fonts and image assets in export

The exporter SHALL wait for required fonts and SVG/PNG assets or fail with an actionable error. It SHALL apply the same text content, layout metrics, colors, backgrounds, and arrow semantics used by the detailed interactive renderer.

Cross-origin, decode, unsupported SVG feature, font timeout, and missing asset failures SHALL identify the affected resource and SHALL NOT silently produce an apparently successful but incomplete package.

#### Scenario: Export after all resources load

- **WHEN** all required fonts and image assets are available
- **THEN** every highest-level tile uses the fixed font metrics and appropriate image resolution
- **AND** repeated exports of unchanged data produce equivalent geometry and text layout

#### Scenario: Export with an unavailable asset

- **WHEN** a required PNG, SVG, or font cannot be fetched, decoded, or used because of cross-origin restrictions
- **THEN** export pauses or fails according to the selected policy
- **AND** the UI names the resource and reason
- **AND** the system does not report a complete successful export unless the user explicitly accepts a documented placeholder policy

### Requirement: Existing image export compatibility

The system SHALL preserve the current PNG/JPG export flow, background selection, and 1x/2x/3x pixel-ratio choices for ordinary scenes and bounded region exports.

When a requested single-image export exceeds a detected browser dimension or memory safety limit, the system SHALL prevent an unsafe allocation and SHALL offer the ultra-clear tiled package instead.

#### Scenario: Export an ordinary canvas

- **WHEN** an ordinary scene fits within the safe single-image budget
- **THEN** PNG and JPG export behave as before the large-scene change
- **AND** the selected background and pixel ratio are preserved

#### Scenario: Request an unsafe single image

- **WHEN** the calculated raster dimensions or memory exceed the safe browser budget
- **THEN** the system does not attempt to allocate the oversized canvas
- **AND** the UI explains the limit and offers “超清图片包”
