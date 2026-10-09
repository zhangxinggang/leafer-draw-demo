## ADDED Requirements

### Requirement: Cabinet configuration

The system SHALL provide configurable screen/module dimensions, receiver pixel width and height limits, sender name, and sender/port limits. Receiver width and height MUST each be greater than or equal to the module width and height. If the module size is increased past either receiver limit, the corresponding receiver limit SHALL increase automatically. The system SHALL display the receiver pixel limits directly in their inputs.

#### Scenario: Resize module beyond receiver limit

- **WHEN** the user increases a module dimension beyond the corresponding receiver dimension
- **THEN** that receiver dimension automatically increases to contain the module

#### Scenario: Import receiver dimensions

- **WHEN** the user pastes a supported scheme JSON
- **THEN** receiver width and height are read from `receiveCardInventory.bear.width` and `receiveCardInventory.bear.height`

### Requirement: Nondivisible screen dimensions

The system SHALL leave screen remainders unused when smart completion is disabled. When enabled, it SHALL extend the last module column and row to the screen's right and bottom edges, with their intersection receiving both extensions. Receiver, cable and sender dimensions and loads MUST be checked against the resulting pixel rectangles.

#### Scenario: Complete a nondivisible screen

- **WHEN** a 10480 × 1720 screen uses 120 × 120 modules and smart completion is enabled
- **THEN** the final column is 160 pixels wide, the final row is 160 pixels high, and the lower-right module is 160 × 160

#### Scenario: Respect device limits on completed edges

- **WHEN** a proposed receiver, cable or sender includes an enlarged edge module
- **THEN** the system validates its actual pixel width, height and area before presenting the layout

### Requirement: Wiring labels and endpoints

Receiver labels SHALL show the sender name and actual receiver width and height without displaying `px`, receiver-card captions, cable names or port names. With smart completion enabled, labels SHALL omit module-count text; with smart completion disabled, labels SHALL include receiver module columns and rows. Imported configurations whose `receiveCardInventory.module.width` is zero SHALL enable smart completion by default.

#### Scenario: Smart-completion label

- **WHEN** smart completion is enabled
- **THEN** each receiver shows the sender name and actual width and height only

#### Scenario: Regular label

- **WHEN** smart completion is disabled
- **THEN** each receiver shows the sender name, actual width and height, and its module column and row counts

#### Scenario: Zero receiver module width on import

- **WHEN** imported JSON has `receiveCardInventory.module.width` equal to zero
- **THEN** smart completion is selected

### Requirement: Screen information and LED pitch

The system SHALL support imported LED point pitch and render screen information with type-colored module borders, a zoom-dependent LED gap mask and viewport-bounded work. Point pitch SHALL affect only screen-information appearance, never display geometry. The rest of the canvas SHALL retain its plain background; receiver and sender layers SHALL be omitted.

#### Scenario: Import point pitch

- **WHEN** the user pastes scheme JSON containing `schemeUserConfigInfo.pointRatio`
- **THEN** the point-pitch input adopts that value, defaulting to 1 when absent

#### Scenario: Show all module sizes

- **WHEN** smart completion creates standard modules, an enlarged right edge, an enlarged bottom edge, or an enlarged lower-right corner
- **THEN** each distinct module size appears in the screen-information legend with its own color and count
- **AND** module tiles have transparent backgrounds and borders colored by dimensions, controlled by an enabled-by-default switch beside the legend

#### Scenario: Draw the screen information

- **WHEN** a screen layout is available
- **THEN** the screen-information view displays only the screen and modules, with image-colored LED apertures and black gaps when viewed closely

#### Scenario: Inspect a large screen

- **WHEN** a screen contains more LED beads or module boundaries than fit in the viewport
- **THEN** rendering work stays bounded through a repeating LED mask or sparse visible apertures, and visible module boundaries
- **AND** mask storage is bounded and reusable; sampling never introduces enlarged fake dots

#### Scenario: Pan and zoom the screen information

- **WHEN** the user drags or scrolls over the screen-information view
- **THEN** the view pans or zooms around the pointer while keeping part of the screen visible
- **AND** the minimum zoom allows any positive finite point pitch to enter the visually merged range

#### Scenario: Show image through LED apertures

- **WHEN** the screen-information canvas is viewed closely
- **THEN** the `screenbg.ts` image is visible through true-pitch LED apertures, with black gaps and no separate LED dots

#### Scenario: Hide module borders

- **WHEN** the user turns off the module switch beside the module-size legend
- **THEN** the screen information hides module borders while retaining the display image and distance-dependent LED appearance

#### Scenario: Preserve source image brightness

- **WHEN** the screen-information view renders LED apertures
- **THEN** the image inside each aperture retains full source opacity, while only the gaps fade with distance

#### Scenario: Change point pitch

- **WHEN** the user reduces the positive point-pitch value
- **THEN** LED apertures become denser relative to the fixed display geometry and black gaps shrink

#### Scenario: Set point pitch to zero

- **WHEN** the user sets point pitch to zero
- **THEN** the background image fills the display continuously without black LED gaps or an aperture mask

#### Scenario: Simulate increasing viewing distance

- **WHEN** the user zooms out with any positive point pitch
- **THEN** black gaps fade smoothly as projected pitch shrinks and become invisible at or below 1.5 CSS pixels
- **AND** zooming back in restores the original lattice without changing screen geometry or introducing sampling-stride jumps

#### Scenario: Pan and use a high-density display

- **WHEN** the user pans or changes device pixel ratio at the same CSS zoom
- **THEN** the lattice follows the screen origin and its perceived gap contrast remains unchanged
