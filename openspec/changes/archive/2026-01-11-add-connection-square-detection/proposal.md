# Change: 添加连接矩形检测功能

## Why

当用户在画布上创建矩形连线（RectLine）时，系统需要检测连接是否形成完整的矩形。当 `freeRouting` 为 `false` 时，如果连接未形成完整的矩形，系统应返回最后两个节点以便后续处理；如果形成完整的矩形，则返回空数组。这有助于确保连接的正确性和完整性。

## What Changes

- 在 `BusinessStore` 中添加 `freeRouting: boolean` 字段，默认值为 `false`
- 在 `src/core/utils/business.ts` 中新增 `checkConnIsSquare` 函数，用于检测连接是否形成完整的矩形
- 在 `useEventHandler.ts` 的 `onPointUp` 方法中，当 `freeRouting` 为 `false` 时，调用 `checkConnIsSquare` 检测 `preLineRect.current`
- `checkConnIsSquare` 函数：
  - 接收 `preLineRect.current`（`Cmp[] | null`）作为参数
  - 如果连接未形成完整的矩形，返回最后两个节点（`Cmp[]`）
  - 如果形成完整的矩形，返回空数组（`[]`）

## Impact

- **Affected specs**: `canvas-state` (新增能力)
- **Affected code**:
  - `src/components/SuperEditor/store/business.ts` - 添加 `freeRouting` 字段
  - `src/core/utils/business.ts` - 添加 `checkConnIsSquare` 函数
  - `src/components/SuperEditor/editor/canvas/useEventHandler.ts` - 在 `onPointUp` 中调用检测函数
