## 1. Implementation

- [x] 1.1 Add smart completion and actual pixel-size validation to cabinet configuration and compact recommendations.
- [x] 1.2 Change receiver settings and JSON mapping to physical width/height, including zero-width import default.
- [x] 1.3 Render completed screen edges and state-dependent receiver labels in native and viewport diagrams.
- [x] 1.4 Run the algorithm package production build and resolve compilation errors.
- [x] 1.5 Reuse smart-completion normalization for imported settings and manual checkbox changes.
- [x] 1.6 Replace the four-layer overview with a screen-and-module view and show every module size.
- [x] 1.7 Add point-pitch setting/import and render sampled LED positions in the screen information.
- [x] 1.8 Bound LED sampling and module-grid rendering to the visible viewport.
- [x] 1.9 Enable pointer dragging and mouse-wheel zooming for the screen information.
- [x] 1.10 Place `screenbg.ts` in the display area and render transparent, type-colored module borders.
- [x] 1.11 Show the background image only through sampled LED apertures; keep remaining screen areas black and omit separate LED dots.
- [x] 1.12 Add an enabled-by-default switch beside the module-size legend to show or hide module borders in screen information.
- [x] 1.13 Preserve source opacity and enlarge sampled LED apertures so the image does not appear dim.
- [x] 1.14 Keep display geometry independent from point pitch, allow zero for continuous image display, and reduce black gaps as positive pitch decreases.

- [x] 1.15 Replace stride-sized LED samples with a reusable true-pitch mask, fade gaps by projected CSS pitch, and allow large pitches to reach distant viewing scales.
- [x] 1.16 Verify zoom continuity, DPR consistency, panning, extreme pitches and bounded work with renderer regression tests; check near/far views in the browser and run the algorithm production build.
