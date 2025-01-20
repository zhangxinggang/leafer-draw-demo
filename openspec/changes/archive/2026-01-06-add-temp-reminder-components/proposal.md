# Change: 添加临时提醒组件功能

## Why

当用户在画布上添加矩形连线（RectLine）时，如果累计面积超过最大限制（`isOverMaxArea`），系统会阻止添加新元素，但用户无法直观地看到哪些元素导致了限制。需要提供视觉反馈，在超过面积限制时显示临时提醒组件，帮助用户识别问题元素。

## What Changes

- 在 `CanvasStore` 中添加 `tempReminderCmps: Cmp[]` 字段，用于存储临时提醒组件
- 添加 `addTempReminderCmps: (cmps: Cmp[]) => void` 方法用于更新临时提醒组件数组
- 在 `useLineRect.ts` 中，当 `isOverMaxArea` 返回 `true` 时：
  - 创建 `connComp` 和 `target` 的临时副本
  - 通过 `getCmpByIds` 获取 `target` 的原始数据
  - 为临时组件设置新 ID（`target.id + '_temp'`）
  - 使用 `tempReminderColor`（来自 `businessStyle.tempReminderColor`）作为填充颜色
  - 将这两个临时组件添加到 `tempReminderCmps` 并渲染到画布
- 在 `useEventHandler.ts` 的 `onPointUp` 方法中：
  - 检测 `tempReminderCmps` 数组
  - 删除所有临时提醒组件（通过 `removeCmpByIds`）
  - 清空 `tempReminderCmps` 数组

## Impact

- **Affected specs**: `canvas-state` (新增能力)
- **Affected code**:
  - `src/components/SuperEditor/store/canvas.ts` - 添加 `tempReminderCmps` 和 `addTempReminderCmps`
  - `src/components/SuperEditor/editor/canvas/items/useLineRect.ts` - 在 `isOverMaxArea` 后添加临时提醒组件逻辑
  - `src/components/SuperEditor/editor/canvas/useEventHandler.ts` - 在 `onPointUp` 中清理临时提醒组件
  - `src/components/SuperEditor/store/business.ts` - 使用 `tempReminderColor` 配置
