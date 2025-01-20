## ADDED Requirements

### Requirement: Connection Square Detection

The system SHALL detect whether a connection chain forms a complete square (rectangle) when `freeRouting` is `false`.

The `BusinessStore` SHALL:

- Include a `freeRouting: boolean` field with default value `false`
- Allow reading and updating the `freeRouting` value through the store

The system SHALL provide a `checkConnIsSquare` function in `src/core/utils/business.ts` that:

- Accepts `preLineRect.current` (type `Cmp[] | null`) as input parameter
- Returns an empty array (`[]`) if the connection forms a complete square (4 nodes forming a closed loop)
- Returns the last two nodes (`Cmp[]`) if the connection does not form a complete square
- Handles `null` or empty array inputs appropriately

When `onPointUp` event fires:

- The system SHALL check if `freeRouting` is `false`
- If `freeRouting` is `false` and `preLineRect.current` exists, the system SHALL call `checkConnIsSquare` with `preLineRect.current`
- The system SHALL process the returned result (either empty array or last two nodes)

#### Scenario: Detect incomplete connection when freeRouting is false

- **WHEN** user releases the mouse button (`onPointUp` event fires)
- **AND** `freeRouting` is `false`
- **AND** `preLineRect.current` contains a connection chain that does not form a complete square
- **THEN** the system calls `checkConnIsSquare(preLineRect.current)`
- **AND** the function returns the last two nodes from the connection chain
- **AND** the system processes the returned nodes

#### Scenario: Detect complete square connection when freeRouting is false

- **WHEN** user releases the mouse button (`onPointUp` event fires)
- **AND** `freeRouting` is `false`
- **AND** `preLineRect.current` contains a connection chain that forms a complete square (4 nodes forming a closed loop)
- **THEN** the system calls `checkConnIsSquare(preLineRect.current)`
- **AND** the function returns an empty array
- **AND** the system processes the empty array result

#### Scenario: Skip detection when freeRouting is true

- **WHEN** user releases the mouse button (`onPointUp` event fires)
- **AND** `freeRouting` is `true`
- **THEN** the system does not call `checkConnIsSquare`
- **AND** the connection detection logic is skipped

#### Scenario: Handle null or empty preLineRect

- **WHEN** `checkConnIsSquare` is called with `null` or empty array
- **THEN** the function handles the input appropriately
- **AND** returns an appropriate result (empty array or handles gracefully)
