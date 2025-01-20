## 1. 数据结构定义

- [x] 1.1 在 `src/core/types/cmp.ts` 或新建类型文件定义 `UndoRedoState` 接口
- [x] 1.2 在 `ModelStore` 接口中添加 `pastStates: UndoRedoState[]`、`futureStates: UndoRedoState[]`、`undo: () => void`、`redo: () => void` 字段

## 2. 实现操作记录

- [x] 2.1 在 `addCmps` 方法中添加操作记录（记录 ADD 操作）
- [x] 2.2 在 `removeCmpByIds` 方法中添加操作记录（记录 DELETE 操作，保存删除前的元素数据）
- [x] 2.3 在 `updateCmps` 方法中添加操作记录（记录 UPDATE 操作，保存所有更新前的元素数据）
- [x] 2.4 在 `alignCmps` 方法中添加操作记录（记录 UPDATE 操作，保存对齐前的元素数据）
- [x] 2.5 在 `copyCmpByIds` 方法中添加操作记录（记录 ADD 操作）

## 3. 实现撤销/重做

s

- [x] 3.1 实现 `undo` 方法：
  - 从 `pastStates` 弹出最后一个操作
  - 根据操作类型执行相反操作（ADD → DELETE, UPDATE → UPDATE with old data, DELETE → ADD）
  - 调用 `cmpRender` 更新画布
  - 将操作推入 `futureStates`
  - 确保不触发新的操作记录
- [x] 3.2 实现 `redo` 方法：
  - 从 `futureStates` 弹出最后一个操作
  - 根据操作类型执行原操作（ADD → ADD, UPDATE → UPDATE with new data, DELETE → DELETE）
  - 调用 `cmpRender` 更新画布
  - 将操作推入 `pastStates`
  - 确保不触发新的操作记录

## 4. 移除 Zundo

- [x] 4.1 从 `model.ts` 中移除 `temporal` 中间件导入和使用
- [x] 4.2 移除 `useTemporalStore` hook 导出
- [x] 4.3 更新 `TopBar/index.tsx`：
  - 移除 `useTemporalStore` 导入
  - 使用 `useModelStore` 获取 `undo`、`redo`、`pastStates`、`futureStates`
  - 更新撤销/重做按钮的 `disabled` 状态检查

## 5. 测试和验证

- [ ] 5.1 测试新增元素的撤销/重做
- [ ] 5.2 测试删除元素的撤销/重做
- [ ] 5.3 测试更新元素的撤销/重做
- [ ] 5.4 测试批量更新元素的撤销/重做
- [ ] 5.5 测试对齐操作的撤销/重做
- [ ] 5.6 测试复制操作的撤销/重做
- [ ] 5.7 测试层级调整操作的撤销/重做
- [ ] 5.8 测试连续撤销/重做
- [ ] 5.9 测试执行新操作后清空重做栈
- [ ] 5.10 验证内存占用和性能

## 6. 清理和优化

- [x] 6.1 从 `package.json` 中移除 `zundo` 依赖
- [ ] 6.2 运行 `npm install` 更新依赖
- [x] 6.3 检查并移除所有未使用的 zundo 相关代码
- [ ] 6.4 代码审查和优化
