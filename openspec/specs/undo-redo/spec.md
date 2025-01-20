# undo-redo Specification

## Purpose

定义撤销/重做系统，支持精准的元素操作撤销和重做，只记录变更的元素信息，最小化内存占用，并与 `cmpRender` 系统集成实现画布状态的正确恢复。

## Requirements

### Requirement: Undo/Redo System

The system SHALL provide undo and redo functionality for all element operations (add, delete, update, move, align, copy, layer adjustment) with minimal memory footprint by only recording changed elements instead of full state snapshots.

The system SHALL:

- Record only changed elements and their operation types (ADD, UPDATE, DELETE) in `pastStates` and `futureStates`
- Support undo operation that reverses the last operation and restores canvas state via `cmpRender`
- Support redo operation that re-applies the last undone operation and updates canvas state via `cmpRender`
- Clear `futureStates` when a new operation is performed after undo
- Limit `pastStates` to a maximum of 50 operations to prevent excessive memory usage
- Not trigger new operation records when performing undo/redo operations

#### Scenario: Undo add operation

- **WHEN** user adds a new element via `addCmps`
- **AND** the operation is recorded in `pastStates` with type `ADD` and the new element data
- **AND** user clicks undo button
- **THEN** the system removes the added element from `cmps` array
- **AND** calls `cmpRender` with `{ cmps: [addedElement], type: 'DELETE' }` to remove it from canvas
- **AND** moves the operation from `pastStates` to `futureStates`

#### Scenario: Undo delete operation

- **WHEN** user deletes an element via `removeCmpByIds`
- **AND** the operation is recorded in `pastStates` with type `DELETE` and the deleted element's full data
- **AND** user clicks undo button
- **THEN** the system restores the deleted element to `cmps` array
- **AND** calls `cmpRender` with `{ cmps: [deletedElement], type: 'ADD' }` to restore it on canvas
- **AND** moves the operation from `pastStates` to `futureStates`

#### Scenario: Undo update operation

- **WHEN** user updates an element via `updateCmps` or `alignCmps`
- **AND** the operation is recorded in `pastStates` with type `UPDATE` and the element's data before update
- **AND** user clicks undo button
- **THEN** the system restores the element to its previous state in `cmps` array
- **AND** calls `cmpRender` with `{ cmps: [elementWithOldData], type: 'UPDATE' }` to restore it on canvas
- **AND** moves the operation from `pastStates` to `futureStates`

#### Scenario: Redo operation

- **WHEN** user has undone one or more operations
- **AND** `futureStates` contains undone operations
- **AND** user clicks redo button
- **THEN** the system retrieves the last operation from `futureStates`
- **AND** applies the operation (ADD → ADD, UPDATE → UPDATE with new data, DELETE → DELETE)
- **AND** calls `cmpRender` with appropriate type to update canvas
- **AND** moves the operation from `futureStates` to `pastStates`

#### Scenario: Clear future states on new operation

- **WHEN** user has undone one or more operations
- **AND** `futureStates` contains undone operations
- **AND** user performs a new operation (add, delete, update, etc.)
- **THEN** `futureStates` is cleared
- **AND** the new operation is recorded in `pastStates`

#### Scenario: Operation recording for all element operations

- **WHEN** user performs any element operation:
  - `addCmps`: records ADD operation with new elements
  - `removeCmpByIds`: records DELETE operation with deleted elements' full data
  - `updateCmps`: records UPDATE operation with all updated elements' data before update
  - `alignCmps`: records UPDATE operation with all aligned elements' data before alignment
  - `copyCmpByIds`: records ADD operation with copied element
- **THEN** the operation is recorded in `pastStates` with operation type and changed elements
- **AND** `futureStates` is cleared if it contains any operations

#### Scenario: Maximum history limit

- **WHEN** `pastStates` reaches the maximum limit of 50 operations
- **AND** a new operation is performed
- **THEN** the oldest operation is removed from `pastStates`
- **AND** the new operation is added to `pastStates`

#### Scenario: Undo/redo button state

- **WHEN** `pastStates` is empty
- **THEN** undo button is disabled
- **WHEN** `futureStates` is empty
- **THEN** redo button is disabled
- **WHEN** `pastStates` contains operations
- **THEN** undo button is enabled
- **WHEN** `futureStates` contains operations
- **THEN** redo button is enabled
