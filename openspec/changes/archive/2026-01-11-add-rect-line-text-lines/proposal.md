# Change: 实现 RectLine 组件并支持文本行显示

## Why

当前 `src/core/renderer/components/rectLine.ts` 文件为空，但系统中已经存在对 `RectLine` 组件的引用和使用。需要实现一个继承自 Leafer Rect 的自定义组件，支持在矩形内垂直均匀分布显示多行文本，当文本超出矩形宽度时自动省略。这将完善 RectLine 组件的功能，使其能够显示文本内容。

## What Changes

- 在 `src/core/renderer/components/rectLine.ts` 中实现 `RectLine` 组件，继承自 Leafer UI 的 `Rect` 类
- 新增 `textLines` 属性，类型为 `string[]`，支持动态文本数组
- 实现文本垂直均匀分布逻辑：当 `textLines` 数组有内容时，文本在 Rect 内垂直均匀分布
- 实现文本省略逻辑：当文本超出 Rect 宽度时，使用省略号（`...`）显示
- 在 `src/core/types/cmp.ts` 中为 `RectLineCmp` 接口添加 `textLines` 属性定义
- 更新组件渲染逻辑以支持 `textLines` 属性的渲染

## Impact

- **Affected specs**: `component-rendering` (新增 RectLine 组件渲染能力)
- **Affected code**:
  - `src/core/renderer/components/rectLine.ts` - 实现 RectLine 组件
  - `src/core/types/cmp.ts` - 添加 RectLineCmp 接口定义
  - `src/core/renderer/index.ts` - 确保 RectLine 正确导出（已存在）
  - `src/core/render.tsx` - 确保 RectLine 在渲染映射中（已存在）
