# Design: 自定义撤销/重做系统

## Context

当前系统使用 zundo 的 temporal 中间件实现撤销/重做，但存在性能问题和功能缺陷。需要设计一个轻量级的、精准的撤销/重做系统，只记录变更的元素信息，而不是全量状态。

## Goals / Non-Goals

### Goals

- 只记录变更的 cmps 信息，最小化内存占用
- 结合 `cmpRender` 的 `RenderType`（ADD/UPDATE/DELETE）实现精准的撤销/重做
- 支持所有元素操作（新增、删除、更新、移动、对齐、复制、层级调整等）
- 撤销/重做操作能够正确恢复画布状态和渲染

### Non-Goals

- 不记录未变更的元素信息
- 不支持跨会话的撤销/重做（刷新后清空）
- 不实现撤销/重做的持久化存储

## Decisions

### Decision 1: 数据结构设计

**Rationale**:

使用最小化数据结构，只记录变更的元素和操作类型：

```typescript
interface UndoRedoState {
  // 操作类型：ADD, UPDATE, DELETE
  type: RenderType;
  // 变更的元素列表
  // ADD: 新增的元素完整数据
  // UPDATE: 更新前的元素数据（用于撤销）或更新后的元素数据（用于重做）
  // DELETE: 被删除的元素完整数据
  cmps: Cmp[];
  // 操作时间戳（可选，用于调试）
  timestamp?: number;
}
```

**Alternatives considered**:

- 记录所有 cmps：内存占用过大，不符合需求
- 只记录元素 ID 和变更字段：需要额外逻辑恢复完整状态，复杂度高
- 使用命令模式：过度设计，当前场景不需要

### Decision 2: 撤销/重做逻辑

**Rationale**:

- **撤销 ADD**：执行 DELETE 操作，删除新增的元素
- **撤销 UPDATE**：恢复到更新前的状态（从 pastStates 中获取原始数据）
- **撤销 DELETE**：执行 ADD 操作，恢复被删除的元素
- **重做**：执行相反的操作（ADD → ADD, UPDATE → UPDATE, DELETE → DELETE）

**实现方式**：

1. 每次操作时，记录操作类型和变更的元素数据
2. 对于 UPDATE 操作，需要记录更新前的完整元素数据（用于撤销时恢复）
3. 撤销时，根据操作类型调用 `cmpRender` 执行相反操作
4. 重做时，根据操作类型调用 `cmpRender` 执行原操作

**Alternatives considered**:

- 使用快照模式：需要记录完整状态，内存占用大
- 使用命令模式：增加复杂度，当前场景不需要

### Decision 3: 操作记录时机

**Rationale**:

在所有会改变 `cmps` 状态的方法中记录操作：

- `addCmps`: 记录 ADD 操作，包含新增的元素
- `removeCmpByIds`: 记录 DELETE 操作，包含被删除的元素完整数据
- `updateCmps`: 记录 UPDATE 操作，包含所有更新前的元素数据
- `alignCmps`: 记录 UPDATE 操作，包含对齐前的元素数据
- `copyCmpByIds`: 记录 ADD 操作，包含复制的元素

**注意事项**：

- 对于 UPDATE 操作，需要在更新前保存元素的完整数据
- 对于 DELETE 操作，需要在删除前保存元素的完整数据
- 对于 ADD 操作，直接保存新增的元素数据

**Alternatives considered**:

- 在 set 方法中统一拦截：无法区分操作类型，难以精准控制
- 使用代理模式：增加复杂度，性能开销

### Decision 4: 状态管理

**Rationale**:

在 `ModelStore` 中直接管理 `pastStates` 和 `futureStates`：

```typescript
interface ModelStore {
  // ... 其他状态
  pastStates: UndoRedoState[]; // 撤销栈
  futureStates: UndoRedoState[]; // 重做栈
  undo: () => void;
  redo: () => void;
}
```

**限制**：

- `pastStates` 最大长度：50（与 zundo 的 limit 保持一致）
- 执行新操作时，清空 `futureStates`
- 撤销/重做时，不触发操作记录（避免循环记录）

**Alternatives considered**:

- 使用独立的 store：增加复杂度，当前场景不需要
- 使用中间件模式：与 zundo 类似，但需要自定义实现

## Risks / Trade-offs

### Risk 1: 更新前数据获取

**问题**：对于 UPDATE 操作，需要在更新前获取元素的完整数据，但某些操作（如 `updateCmps`）可能已经修改了部分数据。

**Mitigation**：

- 在更新前，从当前 `cmps` 数组中查找并复制完整元素数据
- 使用深拷贝确保数据独立性
- 对于批量更新，确保在更新前收集所有需要记录的元素数据

### Risk 2: 撤销/重做时的渲染同步

**问题**：撤销/重做时需要调用 `cmpRender` 更新画布，但需要确保不会触发新的操作记录。

**Mitigation**：

- 在 `undo`/`redo` 方法中设置标志位，跳过操作记录

### Risk 3: 内存占用

**问题**：虽然只记录变更的元素，但如果操作频繁，`pastStates` 仍可能占用较多内存。

**Mitigation**：

- 限制 `pastStates` 最大长度为 50
- 使用队列数据结构，超出限制时自动移除最旧的操作
- 定期清理（可选）

### Risk 4: 复杂操作的记录

**问题**：某些操作（如 `alignCmps`）可能涉及多个元素的更新，需要确保所有变更都被正确记录。

**Mitigation**：

- 在操作前收集所有受影响元素的完整数据
- 使用数组记录所有变更的元素
- 确保 `cmpRender` 能够正确处理批量更新

## Migration Plan

1. **阶段 1：数据结构定义**
   - 定义 `UndoRedoState` 接口
   - 在 `ModelStore` 中添加 `pastStates`、`futureStates`、`undo`、`redo` 字段

2. **阶段 2：实现操作记录**
   - 在所有元素操作方法中添加操作记录逻辑

3. **阶段 3：实现撤销/重做**
   - 实现 `undo` 方法
   - 实现 `redo` 方法
   - 确保撤销/重做时不会触发新的操作记录

4. **阶段 4：移除 zundo**
   - 移除 `temporal` 中间件
   - 移除 `useTemporalStore` hook
   - 更新 `TopBar` 组件使用新的 API

5. **阶段 5：测试和优化**
   - 测试所有操作的撤销/重做
   - 优化内存占用
   - 确保性能符合要求

## Open Questions

- 是否需要支持撤销/重做的持久化存储？
- 是否需要支持撤销/重做的快捷键？
- 是否需要显示撤销/重做历史记录？
