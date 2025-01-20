# Change: Store数据与Leafer元素实时关联

## Why

当前系统中，store 数据（`model.ts`）与 leafer 渲染元素之间的同步是单向的，只在初始化时通过 `useRender` 进行渲染。当 store 中的数据更新时（如 `alignCmps` 等），leeafer 元素不会自动更新，导致数据与视图不同步。

需要实现 store 数据与 leafer 元素的实时双向同步，确保：

1. Store 数据变更时，leeafer 元素能够实时更新
2. 支持批量操作（增删改）
3. 简化渲染函数的参数传递，使用全局 app 引用

## What Changes

- **BREAKING**: 修改 `cmpRender` 函数签名：
  - 参数从单个 `cmp` 改为数组 `cmps: Cmp[]`
  - 新增 `type` 字段，枚举值：`ADD`、`UPDATE`、`DELETE`，默认 `ADD`
  - 移除 `app` 参数，改为使用全局 `window.spuEditorApp`
- **BREAKING**: 更新所有渲染组件（`src/core/renderer/components/*`）以支持增删改操作
- 修改 `useRender.ts` 以使用新的 `cmpRender` 函数签名
- 在 `model.ts` 中所有更新 leafer 组件的地方，如果 leafer 元素已存在，使用 `cmpRender` 进行更新
- 在 app 初始化时设置 `window.spuEditorApp`

## Impact

- **Affected specs**: `component-rendering`
- **Affected code**:
  - `src/core/render.tsx` - `cmpRender` 函数重构
  - `src/core/renderer/components/*` - 所有组件函数需要支持 UPDATE 和 DELETE 操作
  - `src/core/types/cmp.ts` - 可能需要添加 `RenderType` 枚举
  - `src/components/SuperEditor/editor/canvas/useRender.ts` - 使用新的函数签名
  - `src/components/SuperEditor/store/model.ts` - 在更新方法中调用 `cmpRender`
  - `src/core/renderer/app/index.tsx` - 设置 `window.spuEditorApp`
  - `src/components/SuperEditor/store/canvas.ts` - 可能需要更新 `setApp` 方法
