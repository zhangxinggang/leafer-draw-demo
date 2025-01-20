# Change: 自定义撤销/重做系统替换 Zundo

## Why

当前系统使用 zundo 的 temporal 中间件实现撤销/重做功能，存在以下问题：

1. **性能问题**：zundo 的 `pastStates` 和 `futureStates` 记录每一步的所有 `cmps` 组件完整状态，当组件数量较多时会导致内存占用过大和性能问题
2. **功能缺陷**：移动元素、删除、新增等元素操作后，redo/undo 没有效果，无法正确恢复状态
3. **业务不匹配**：当前业务中并不是监听每一个 cmps 变化进行渲染，而是通过 `cmpRender` 函数精准控制哪些元素需要渲染（ADD/UPDATE/DELETE），zundo 的全量状态记录方式与业务逻辑不匹配
4. **精准控制需求**：需要精准实现某一步操作包含的元素支持撤销和重做，而不是全量状态恢复

## What Changes

- **BREAKING**: 移除 `zundo` 依赖和 `temporal` 中间件
- **BREAKING**: 移除 `useTemporalStore` hook，改为在 `ModelStore` 中直接提供 `undo` 和 `redo` 方法
- **BREAKING**: 实现自定义的 `pastStates` 和 `futureStates` 数据结构，只记录变更的 cmps 信息
- 设计最小化数据结构，结合 `cmpRender` 的 `RenderType`（ADD/UPDATE/DELETE）记录操作
- 在所有元素操作方法（`addCmps`、`removeCmpByIds`、`updateCmps`、`alignCmps`、`copyCmpByIds`）中记录操作历史
- 实现 `undo` 和 `redo` 方法，通过 `cmpRender` 恢复/重做操作
- 更新 `TopBar` 组件，使用新的 `undo`/`redo` 方法和状态检查

## Impact

- **Affected specs**: `undo-redo` (新增)
- **Affected code**:
  - `src/components/SuperEditor/store/model.ts` - 移除 zundo，实现自定义撤销/重做
  - `src/components/SuperEditor/layout/TopBar/index.tsx` - 更新撤销/重做按钮实现
  - `package.json` - 移除 `zundo` 依赖
  - `src/core/render.tsx` - 可能需要调整以支持撤销/重做的渲染逻辑
