## ADDED Requirements

### Requirement: Algorithm Catalog

The application SHALL provide an extensible algorithm card catalog and a detail route for the first algorithm named 防逃逸.

#### Scenario: Open the algorithm

- **WHEN** the user clicks the 防逃逸 card
- **THEN** the application opens its detail page and supports returning to the catalog and browser history navigation

### Requirement: Rectangle Configuration and Addition

The application SHALL accept positive finite base width, base height, maximum width and maximum height. It SHALL display current area beside the base dimensions and add rectangles through a width/height dialog only when the resulting bounds satisfy all limits.

#### Scenario: Empty scene

- **WHEN** no small rectangles exist
- **THEN** the large rectangle displays the configured base width and height

#### Scenario: Add a rectangle

- **WHEN** the user confirms valid dimensions in the addition dialog
- **THEN** the application places the small rectangle in a legal bounding rectangle and updates the actual area

#### Scenario: Reject invalid configuration

- **WHEN** inputs are non-positive, non-finite, initial dimensions exceed edge limits, or new limits cannot contain existing rectangles
- **THEN** the application explains the invalid constraint and preserves the last valid scene

### Requirement: Tight Bounding Rectangle and Continuous Constraints

For a non-empty scene, the large rectangle SHALL exactly equal the minimum bounding rectangle of all small rectangles. Its area MUST NOT exceed base width multiplied by base height, and its edges MUST NOT exceed maximum width and maximum height. Dragging SHALL stop at the first invalid boundary along the movement segment while preserving containment.

#### Scenario: Update bounding rectangle

- **WHEN** a small rectangle moves, is added, or is removed
- **THEN** the large rectangle updates to min x/y and max x plus width/y plus height without outer padding

#### Scenario: Reach a constraint

- **WHEN** a movement would exceed area, maximum width, or maximum height
- **THEN** the rectangle stops at the last legal position and the page identifies the limiting constraint

#### Scenario: Cross an invalid intermediate region

- **WHEN** a diagonal movement has valid endpoints but an invalid intermediate bounding area
- **THEN** the movement stops at the first area boundary instead of jumping across the invalid region

### Requirement: Large Interactive Canvas

The application SHALL display a spacious canvas with distinct outer and inner rectangle colors, edge and dimension annotations, live area and edge usage, zoom and pan controls, keyboard movement, and an accessible addition dialog.

#### Scenario: Navigate the canvas

- **WHEN** the user zooms, pans, resizes the viewport, or centers the view
- **THEN** the view updates without changing algorithm coordinates or constraint results

### Requirement: Reusable Geometry Core

The rectangle bounding, validation, placement and constrained movement algorithms SHALL reside in momoUtils without UI dependencies.

#### Scenario: Test independently

- **WHEN** the algorithm module is imported in Node
- **THEN** bounding and movement constraints can be verified without browser globals
