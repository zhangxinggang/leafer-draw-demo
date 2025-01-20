# component-rendering Specification

## Purpose

定义组件渲染系统，确保 store 数据与 Leafer UI 画布元素之间的实时同步。系统支持通过 `cmpRender` 函数进行批量增删改操作，实现数据驱动的可视化渲染。

## Requirements

### Requirement: Component Rendering

The system SHALL render components to the Leafer UI canvas based on store data, and SHALL keep the rendered elements synchronized with store updates in real-time.

The `cmpRender` function SHALL:

- Accept an array of components (`cmps: Cmp[]`) instead of a single component
- Support operation types: `ADD` (default), `UPDATE`, and `DELETE` via a `type` parameter
- Use the global `window.spuEditorApp` reference instead of requiring an `app` parameter
- Process multiple components in a single call for batch operations

Each component renderer function SHALL:

- Support `ADD` operation: Create a new Leafer element and add it to the app tree
- Support `UPDATE` operation: Find existing element by id using `app.tree.findId()`, then update its attributes using `setAttr()`
- Support `DELETE` operation: Find existing element by id, call `destroy()` method, and remove it from the app tree

The store update methods SHALL:

- Call `cmpRender` with `type: 'UPDATE'` when updating existing components that have corresponding Leafer elements
- Call `cmpRender` with `type: 'DELETE'` when removing components that have corresponding Leafer elements
- Only call `cmpRender` if the Leafer element exists (checked via `app.tree.findId()`)

#### Scenario: Add new component

- **WHEN** a new component is added to the store via `addCmps`
- **THEN** `cmpRender` is called with `{ cmps: [newCmp], type: 'ADD' }`
- **AND** a new Leafer element is created and added to the canvas

#### Scenario: Update existing component

- **WHEN** a component is updated in the store via `updateCmps`
- **AND** the component has a corresponding Leafer element (found via `app.tree.findId()`)
- **THEN** `cmpRender` is called with `{ cmps: [updatedCmp], type: 'UPDATE' }`
- **AND** the Leafer element's attributes are updated using `setAttr()`

#### Scenario: Delete component

- **WHEN** a component is removed from the store via `removeCmpByIds`
- **AND** the component has a corresponding Leafer element
- **THEN** `cmpRender` is called with `{ cmps: [{ id }], type: 'DELETE' }`
- **AND** the Leafer element is destroyed and removed from the canvas

#### Scenario: Batch update multiple components

- **WHEN** multiple components are updated simultaneously (e.g., via `alignCmps`)
- **AND** the components have corresponding Leafer elements
- **THEN** `cmpRender` is called with `{ cmps: [updatedCmp1, updatedCmp2, ...], type: 'UPDATE' }`
- **AND** all Leafer elements are updated in a single batch operation

#### Scenario: Global app reference initialization

- **WHEN** the Leafer app is initialized in `src/core/renderer/app/index.tsx`
- **THEN** `window.spuEditorApp` is set to the app instance
- **AND** `cmpRender` can access the app without requiring it as a parameter

#### Scenario: Component renderer supports all operation types

- **WHEN** a component renderer function (e.g., `Rect`, `Text`, `Ellipse`) is called with `type: 'ADD'`
- **THEN** it creates a new Leafer element and adds it to the tree
- **WHEN** the same function is called with `type: 'UPDATE'` and a component with existing id
- **THEN** it finds the existing element and updates its attributes
- **WHEN** the same function is called with `type: 'DELETE'` and a component with existing id
- **THEN** it finds the existing element, destroys it, and removes it from the tree

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
