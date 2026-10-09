## ADDED Requirements

### Requirement: Unrestricted large-screen recommendation

The system SHALL accept any otherwise valid safely representable dimensions without a fixed module or receiver count rejection. Large configurations SHALL receive feasible, constraint-compliant recommendations through four workers using compact layouts. A recommendation MUST NOT be represented as a globally proven optimum merely because candidate evaluation finishes.

#### Scenario: Million receivers

- **WHEN** a valid screen requires 1000000 one-module receivers
- **THEN** both directions recommend a complete layout, counts and load constraints remain accurate, and no million-object Worker message is required

#### Scenario: Irregular edges

- **WHEN** screen module rows or columns are not divisible by repeated sender, cable or receiver dimensions
- **THEN** edge rectangles shrink to cover every complete module exactly once without violating limits

### Requirement: Scalable cabinet visualization

The system SHALL proportionally render large recommendations in the structure view and wiring diagrams. Overview rendering SHALL cover the whole screen using adaptive detail. Zooming SHALL reveal real visible receivers, wiring and labels. Every logical receiver SHALL retain its identity and be accessible by position without a total-count drawing cutoff.

#### Scenario: Browse one million receivers

- **WHEN** a million-receiver plan is displayed, zoomed and panned
- **THEN** the viewport stays responsive, backing canvas dimensions depend on the viewport, and detailed work depends on visible content

#### Scenario: Inspect a distant receiver

- **WHEN** the user views or selects a receiver near any edge or distant corner
- **THEN** the correct sender, cable, local port, dimensions and load are shown

### Requirement: Complete large-plan device details

All senders in a recommended plan SHALL be accessible through paginated details without allocating all sender or receiver objects.

#### Scenario: Last page

- **WHEN** the user opens the final page of a million-receiver plan
- **THEN** the displayed senders correspond to the actual final regions and their counts and loads agree with the summary
