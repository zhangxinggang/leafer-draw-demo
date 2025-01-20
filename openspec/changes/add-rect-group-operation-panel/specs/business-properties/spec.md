## ADDED Requirements

### Requirement: Business Properties Operation Panel

The system SHALL provide an operation panel in the Business Properties component that allows users to perform business operations related to rect groups (发送卡).

The operation panel SHALL:

- Be displayed as a collapsible section using Ant Design Collapse component
- Be expanded by default
- Contain an "Add Rect Group" (新增发送卡) button
- Display a tooltip "Please select receiving cards" (请框选接收卡) when hovering over the button

#### Scenario: Operation panel default state

- **WHEN** the Business Properties component is rendered
- **THEN** the operation panel is displayed in a Collapse component
- **AND** the operation panel is expanded by default
- **AND** the "Add Rect Group" button is visible

#### Scenario: Add Rect Group button tooltip

- **WHEN** user hovers over the "Add Rect Group" button
- **THEN** a tooltip is displayed with text "请框选接收卡"

### Requirement: Rect Group Style Properties Configuration

The system SHALL provide configuration options for rect group style properties in the Business Properties component.

The style properties SHALL include:

- Overload color (超载颜色) - `overloadColor`
- Fill color (填充颜色) - `fill`
- Stroke width (边框宽度) - `strokeWidth`
- Stroke color (边框颜色) - `strokeColor`

These properties SHALL:

- Be displayed after the "Rect Group Colors" (发送卡颜色组) section
- Be arranged in two columns (two settings per row)
- Use appropriate input components (ColorPicker for colors, InputNumber for stroke width)
- Save changes to the business store when modified

#### Scenario: Display rect group style properties

- **WHEN** the Business Properties component is rendered
- **THEN** four style property configuration items are displayed after the "Rect Group Colors" section
- **AND** the properties are arranged in two columns (two settings per row)
- **AND** overload color and fill color use ColorPicker components
- **AND** stroke width uses InputNumber component
- **AND** stroke color uses ColorPicker component

#### Scenario: Update rect group style properties

- **WHEN** user modifies any of the rect group style properties
- **THEN** the changes are saved to the business store via `updateBusinessStyle`
- **AND** the updated values are persisted

### Requirement: Business Properties Collapse Organization

The system SHALL organize the Business Properties component using Ant Design Collapse panels.

The component SHALL have three collapsible sections:

- Operation (操作) - expanded by default
- Device Settings (设备设置)
- Style Settings (样式设置)

#### Scenario: Collapse panel organization

- **WHEN** the Business Properties component is rendered
- **THEN** three Collapse panels are displayed
- **AND** the Operation panel is expanded by default
- **AND** Device Settings and Style Settings panels can be expanded/collapsed independently

### Requirement: Rect Group Addition Validation

The system SHALL validate selected rectangles before allowing rect group addition.

The validation function `beforeAddRectGroupCheck` SHALL:

- Accept selected component IDs as input
- Check if any selected components exist
- Verify that selected components are receiving cards (RectLine type, backendData.type === CmpType.RectLine)
- Calculate the bounding box of selected rectangles (minX, minY, maxX, maxY, total area)
- Verify that the bounding box area does not exceed `rectGroupLimitArea`
- Verify that the bounding box width does not exceed `rectGroupLimitWidth`
- Verify that the bounding box height does not exceed `rectGroupLimitHeight`
- Display appropriate error messages using Ant Design message component

#### Scenario: No selected receiving cards

- **WHEN** user clicks "Add Rect Group" button
- **AND** no components are selected
- **THEN** `beforeAddRectGroupCheck` is called
- **AND** a message is displayed: "请选择接收卡"
- **AND** the rect group addition is prevented

#### Scenario: Selected components are not receiving cards

- **WHEN** user clicks "Add Rect Group" button
- **AND** components are selected
- **AND** none of the selected components have `backendData.type === CmpType.RectLine`
- **THEN** `beforeAddRectGroupCheck` is called
- **AND** a message is displayed: "请选择接收卡"
- **AND** the rect group addition is prevented

#### Scenario: Selected receiving cards exceed area limit

- **WHEN** user clicks "Add Rect Group" button
- **AND** receiving cards (RectLine type) are selected
- **AND** the total area of the bounding box exceeds `rectGroupLimitArea`
- **THEN** `beforeAddRectGroupCheck` is called
- **AND** a message is displayed: "发送卡已超带载"
- **AND** the rect group addition is prevented

#### Scenario: Selected receiving cards exceed width limit

- **WHEN** user clicks "Add Rect Group" button
- **AND** receiving cards (RectLine type) are selected
- **AND** the width of the bounding box exceeds `rectGroupLimitWidth`
- **THEN** `beforeAddRectGroupCheck` is called
- **AND** a message is displayed: "发送卡已超带载"
- **AND** the rect group addition is prevented

#### Scenario: Selected receiving cards exceed height limit

- **WHEN** user clicks "Add Rect Group" button
- **AND** receiving cards (RectLine type) are selected
- **AND** the height of the bounding box exceeds `rectGroupLimitHeight`
- **THEN** `beforeAddRectGroupCheck` is called
- **AND** a message is displayed: "发送卡已超带载"
- **AND** the rect group addition is prevented

#### Scenario: Selected receiving cards pass validation

- **WHEN** user clicks "Add Rect Group" button
- **AND** receiving cards (RectLine type) are selected
- **AND** the bounding box area is within `rectGroupLimitArea`
- **AND** the bounding box width is within `rectGroupLimitWidth`
- **AND** the bounding box height is within `rectGroupLimitHeight`
- **THEN** `beforeAddRectGroupCheck` is called
- **AND** validation passes (returns true or no error)
- **AND** the rect group addition can proceed (implementation of actual addition is out of scope for this requirement)
