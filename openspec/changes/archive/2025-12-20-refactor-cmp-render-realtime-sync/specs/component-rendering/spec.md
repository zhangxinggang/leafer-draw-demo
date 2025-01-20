## ADDED Requirements

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

- **WHEN** a component is updated in the store via `updateCmps`s
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
