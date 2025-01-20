## ADDED Requirements

### Requirement: RectLine Component with Text Lines

The system SHALL provide a `RectLine` component that extends Leafer UI's `Rect` component and supports displaying multiple text lines within the rectangle.

The `RectLine` component SHALL:

- Extend Leafer UI's `Rect` class using the custom component extension mechanism
- Support a `textLines` property of type `string[]` (optional)
- Display text lines vertically and evenly distributed within the rectangle when `textLines` array contains text
- Automatically truncate text with ellipsis (`...`) when text exceeds the rectangle's width
- Update text layout when `textLines` property changes
- Update text layout when rectangle dimensions (width, height) change

The component renderer for `RectLine` SHALL:

- Support `ADD` operation: Create a new `RectLine` element with optional `textLines` property
- Support `UPDATE` operation: Update existing `RectLine` element, including `textLines` property changes
- Support `DELETE` operation: Remove `RectLine` element from canvas

#### Scenario: Create RectLine with text lines

- **WHEN** a new `RectLine` component is created with `textLines: ['Line 1', 'Line 2', 'Line 3']`
- **THEN** the component creates a rectangle with the specified dimensions
- **AND** three text lines are displayed vertically and evenly distributed within the rectangle
- **AND** each text line is left-aligned and respects the rectangle's width

#### Scenario: Text lines vertical distribution

- **WHEN** a `RectLine` component has `textLines: ['Text A', 'Text B', 'Text C']` and `height: 300`
- **THEN** the three text lines are distributed evenly along the vertical axis
- **AND** the spacing between lines is calculated to achieve uniform distribution
- **AND** the first line starts at an appropriate top margin
- **AND** the last line ends at an appropriate bottom margin

#### Scenario: Text overflow with ellipsis

- **WHEN** a text line in `textLines` exceeds the rectangle's width
- **THEN** the text is truncated
- **AND** an ellipsis (`...`) is displayed at the end of the visible text
- **AND** the truncated text fits within the rectangle's width

#### Scenario: Update textLines property

- **WHEN** an existing `RectLine` component's `textLines` property is updated via `cmpRender` with `type: 'UPDATE'`
- **THEN** the component removes old text line elements
- **AND** creates new text line elements based on the updated `textLines` array
- **AND** recalculates and applies the vertical distribution

#### Scenario: Update rectangle dimensions

- **WHEN** an existing `RectLine` component's `width` or `height` is updated
- **THEN** the component recalculates the vertical distribution of text lines
- **AND** repositions all text lines to maintain even distribution
- **AND** re-evaluates text overflow and applies ellipsis if needed

#### Scenario: RectLine without textLines

- **WHEN** a `RectLine` component is created without `textLines` property or with empty `textLines: []`
- **THEN** the component renders as a standard rectangle
- **AND** no text elements are created
- **AND** the component behaves like a regular `Rect` component

#### Scenario: Delete RectLine component

- **WHEN** a `RectLine` component is deleted via `cmpRender` with `type: 'DELETE'`
- **THEN** the component and all its text line child elements are removed from the canvas
- **AND** all associated resources are cleaned up
