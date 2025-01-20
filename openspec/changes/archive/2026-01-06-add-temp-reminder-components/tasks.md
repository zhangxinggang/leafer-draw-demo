## 1. 实现 CanvasStore 状态管理

- [x] 1.1 在 `CanvasStore` 接口中添加 `tempReminderCmps: Cmp[]` 字段
- [x] 1.2 在 `CanvasStore` 接口中添加 `addTempReminderCmps: (cmps: Cmp[]) => void` 方法
- [x] 1.3 在 `useCanvasStore` 的初始状态中初始化 `tempReminderCmps` 为空数组
- [x] 1.4 实现 `addTempReminderCmps` 方法

## 2. 实现临时提醒组件创建逻辑

- [x] 2.1 在 `useLineRect.ts` 中导入 `useCanvasStore` 和 `getCmpByIds`
- [x] 2.2 在 `useLineRect.ts` 中导入 `useBusinessStore` 以获取 `tempReminderColor`
- [x] 2.3 在 `addLineRect` 函数中，当 `isOverMaxArea` 返回 `true` 时：
  - [x] 2.3.1 通过 `getCmpByIds([target.id])` 获取 `target` 的原始数据
  - [x] 2.3.2 创建 `target` 的临时副本，设置新 ID 为 `target.id + '_temp'`，填充颜色为 `tempReminderColor`
  - [x] 2.3.3 创建 `connComp` 的临时副本（如果需要，也设置临时 ID 和颜色）
  - [x] 2.3.4 调用 `addTempReminderCmps` 将两个临时组件添加到数组
  - [x] 2.3.5 调用 `addCmps` 将临时组件添加到画布并渲染

## 3. 实现临时提醒组件清理逻辑

- [x] 3.1 在 `useEventHandler.ts` 中导入 `useCanvasStore` 和 `useModelStore`
- [x] 3.2 在 `onPointUp` 方法中：
  - [x] 3.2.1 获取 `tempReminderCmps` 数组
  - [x] 3.2.2 如果数组不为空，提取所有临时组件的 ID
  - [x] 3.2.3 调用 `removeCmpByIds` 删除所有临时组件
  - [x] 3.2.4 调用 `addTempReminderCmps([])` 清空数组

## 4. 验证和测试

- [x] 4.1 验证当 `isOverMaxArea` 为 `true` 时，临时提醒组件正确显示
- [x] 4.2 验证临时提醒组件使用正确的颜色（`tempReminderColor`）
- [x] 4.3 验证临时提醒组件的 ID 格式正确（`originalId + '_temp'`）
- [x] 4.4 验证鼠标抬起时，所有临时提醒组件被正确删除
- [x] 4.5 验证 `tempReminderCmps` 数组在清理后被正确清空
