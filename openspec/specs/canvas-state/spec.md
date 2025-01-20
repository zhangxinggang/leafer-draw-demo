# canvas-state Specification

## Purpose

定义画布状态管理规范，包括临时提醒组件的创建、显示和清理机制。当用户操作触发面积限制时，系统应提供视觉反馈，帮助用户识别问题元素。
## Requirements
### Requirement: Temporary Reminder Components Management

The system SHALL manage temporary reminder components in the canvas store to provide visual feedback when area limits are exceeded.

The `CanvasStore` SHALL:

- Include a `tempReminderCmps: Cmp[]` field to store temporary reminder components
- Provide a `addTempReminderCmps: (cmps: Cmp[]) => void` method to update the temporary reminder components array
- Initialize `tempReminderCmps` as an empty array by default

When the area limit is exceeded (`isOverMaxArea` returns `true`):

- The system SHALL create temporary copies of the `connComp` and `target` components
- The system SHALL retrieve the original `target` component data using `getCmpByIds([target.id])`
- The system SHALL assign new IDs to temporary components using the format `originalId + '_temp'`
- The system SHALL apply `tempReminderColor` (from `businessStyle.tempReminderColor`) as the fill color for temporary components
- The system SHALL add both temporary components to `tempReminderCmps` array
- The system SHALL render the temporary components to the canvas using `addCmps`

When the mouse is released (`onPointUp` event):

- The system SHALL detect if `tempReminderCmps` array contains any components
- The system SHALL remove all temporary reminder components from the canvas using `removeCmpByIds`
- The system SHALL clear the `tempReminderCmps` array by calling `addTempReminderCmps([])`

#### Scenario: Create temporary reminder components when area limit exceeded

- **WHEN** user attempts to add a RectLine component via `addLineRect`
- **AND** `isOverMaxArea` returns `true` for the current selection
- **THEN** the system retrieves the original `target` component data using `getCmpByIds([target.id])`
- **AND** creates a temporary copy of `target` with ID `target.id + '_temp'` and fill color `tempReminderColor`
- **AND** creates a temporary copy of `connComp` (if applicable) with appropriate temporary ID and color
- **AND** adds both temporary components to `tempReminderCmps` array
- **AND** renders both temporary components to the canvas using `addCmps`

#### Scenario: Clean up temporary reminder components on mouse release

- **WHEN** user releases the mouse button (`onPointUp` event fires)
- **AND** `tempReminderCmps` array contains one or more components
- **THEN** the system extracts all IDs from `tempReminderCmps` array
- **AND** calls `removeCmpByIds` with the extracted IDs to delete all temporary components
- **AND** calls `addTempReminderCmps([])` to clear the array
- **AND** all temporary reminder components are removed from the canvas

#### Scenario: Temporary reminder components use correct styling

- **WHEN** temporary reminder components are created
- **THEN** the fill color SHALL be set to `tempReminderColor` from `businessStyle.tempReminderColor`
- **AND** the component ID SHALL follow the format `originalId + '_temp'`
- **AND** all other properties SHALL be copied from the original component data retrieved via `getCmpByIds`

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

