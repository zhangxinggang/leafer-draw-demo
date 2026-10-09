## ADDED Requirements

### Requirement: Four worker partitioned computation

The system SHALL use packages/momoUtils/src/worker with four concurrent workers, two disjoint root-search shards per direction, preserving the existing objective and modes.

#### Scenario: Shard completion

- **WHEN** one shard completes without attaining a global lower bound
- **THEN** the system retains its candidate but MUST NOT claim global optimality until all shards for that direction complete

#### Scenario: Cancel or replace calculation

- **WHEN** a run is stopped, replaced, timed out or the page unmounts
- **THEN** active workers and queued jobs are released and late messages cannot overwrite current results

### Requirement: Bounded cabinet resources

The system MUST validate grid size before allocation, bound worker lifetimes and avoid rendering excessive geometry.

#### Scenario: Oversized screen

- **WHEN** a configuration exceeds 16384 modules or 512 modules on either axis
- **THEN** calculation is rejected with a readable limit message before workers start

#### Scenario: Large feasible output or long search

- **WHEN** a result exceeds 512 receivers or a worker exceeds 30 seconds or 250000 search states
- **THEN** the system retains available counts and feasible results, avoids excessive diagram creation and does not label an interrupted search optimal

### Requirement: Scheme JSON recognition

The left sidebar SHALL automatically recognize pasted scheme JSON and atomically populate screen dimensions from more.realPixWidth/realPixHeight, module dimensions from moduleRatio, receiver counts from receiveCardInventory.module (minimum 1), sender name/limits/load/ports from sendCardInventory and port load from receiveCardInventory.cableMaxHeight.

#### Scenario: Supplied example

- **WHEN** the example contains numeric strings, zero receiver dimensions and a trailing comma
- **THEN** all parameters are recognized, zero counts become 1, and incompatible load constraints are explained when calculating

#### Scenario: Invalid JSON or missing fields

- **WHEN** parsing or required-field validation fails
- **THEN** an actionable error is shown and previous parameters remain unchanged
