# Design: Store数据与Leafer元素实时关联

## Context

当前架构中，组件数据存储在 Zustand store（`model.ts`）中，而可视化渲染由 Leafer UI 引擎负责。两者之间的同步机制不完善：

1. **初始化渲染**：通过 `useRender` hook 在组件挂载时一次性渲染所有组件
2. **数据更新**：Store 中的数据更新后，leeafer 元素不会自动更新
3. **参数传递**：`cmpRender` 函数需要显式传递 `app` 参数，增加了调用复杂度

## Goals

1. 实现 store 数据与 leafer 元素的实时同步
2. 支持批量增删改操作，提高性能
3. 简化 API，使用全局 app 引用减少参数传递
4. 保持向后兼容，不影响现有功能

## Non-Goals

- 不改变 store 的数据结构
- 不改变组件的渲染逻辑（只增加更新和删除支持）
- 不改变撤销/重做机制

## Decisions

### Decision 1: 使用全局 `window.spuEditorApp` 存储 app 实例

**Rationale**:

- 简化函数签名，避免在每个调用点传递 `app`
- 全局访问便于在 store 方法中直接调用渲染函数
- 使用 `window` 对象是常见的全局状态管理方式

**Alternatives considered**:

- 通过 Context API：需要重构大量代码，增加复杂度
- 通过参数传递：保持现状，但调用链复杂

### Decision 2: 支持批量操作（数组参数）

**Rationale**:

- 批量更新可以提高性能，减少多次 DOM 操作
- 对齐、多选等操作本身就是批量操作
- 统一接口，单个组件也作为数组处理

**Alternatives considered**:

- 保持单个组件参数：需要多次调用，性能较差

### Decision 3: 使用枚举类型区分操作类型

**Rationale**:

- 类型安全，避免字符串拼写错误
- 清晰的语义表达
- 便于扩展（未来可能添加更多操作类型）

**Alternatives considered**:

- 使用字符串字面量：类型安全性较差
- 使用多个函数（`updateCmp`, `deleteCmp`）：增加 API 复杂度

### Decision 4: 在组件函数中通过 `app.tree.findId()` 查找元素

**Rationale**:

- Leafer UI 提供了 `findId` 方法，性能可靠
- 组件函数内部处理查找逻辑，封装更好
- 统一错误处理（元素不存在时的处理）

**Alternatives considered**:

- 在调用方查找并传递元素：增加调用方复杂度
- 维护元素映射表：增加内存开销和维护成本

## Implementation Details

### 类型定义

```typescript
export enum RenderType {
  ADD = 'ADD',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export interface RenderParams {
  cmps: Partial<Cmp>[];
  type?: RenderType; // 默认 ADD
}
```

### cmpRender 函数逻辑

```typescript
function cmpRender({ cmps, type = RenderType.ADD }: RenderParams) {
  const app = window.spuEditorApp;
  if (!app) return;

  cmps.forEach((cmp) => {
    const renderFn = cmpRenderMap[cmp.type];
    if (!renderFn) return;

    renderFn({ cmp, type });
  });
}
```

### 组件函数更新模式

每个组件函数需要支持三种操作：

1. **ADD**: 创建新元素并添加到 tree
2. **UPDATE**: 查找现有元素，使用 `setAttr` 更新属性
3. **DELETE**: 查找现有元素，调用 `destroy()` 并移除

### Store 集成点

在以下方法中添加 `cmpRender` 调用：

- `updateCmps`: 批量更新
- `removeCmpByIds`: 删除
- `alignCmps`: 对齐后更新

## Risks / Trade-offs

### Risk 1: 全局变量污染

**Mitigation**:

- 使用命名空间 `window.spuEditorApp`，避免与其他全局变量冲突
- 在 app 销毁时清理：`window.spuEditorApp = null`

### Risk 2: 性能问题（频繁更新）

**Mitigation**:

- 批量操作减少更新次数
- 只在必要时调用 `cmpRender`（元素已存在时）
- 考虑未来添加防抖/节流机制

### Risk 3: 元素查找失败

**Mitigation**:

- 在组件函数中添加空值检查
- 如果元素不存在，ADD 操作创建新元素，UPDATE/DELETE 操作静默失败

### Risk 4: 与现有代码冲突

**Mitigation**:

- 保持 `useRender` 的初始化逻辑不变
- 新增的更新逻辑只在元素已存在时执行
- 充分测试确保向后兼容

## Migration Plan

1. **阶段 1**: 添加类型定义和全局 app 设置（不破坏现有功能）
2. **阶段 2**: 更新 `cmpRender` 函数和组件函数（保持 ADD 行为不变）
3. **阶段 3**: 在 store 方法中集成更新逻辑
4. **阶段 4**: 测试和验证所有场景

## Open Questions

1. 是否需要支持部分更新（只更新部分属性）？
   - **Answer**: 是，通过 `setAttr` 支持部分更新

2. 删除操作是否需要确认？
   - **Answer**: 不需要，删除操作已经在 store 层面处理了确认逻辑

3. 如何处理元素类型变更（如从 Rect 改为 Ellipse）？
   - **Answer**: 先删除旧元素，再创建新元素（两个操作）
