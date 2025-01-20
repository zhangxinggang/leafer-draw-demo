## ADDED Requirements

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
