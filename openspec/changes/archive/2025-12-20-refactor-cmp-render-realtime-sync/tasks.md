## 1. 核心类型和函数重构

- [x] 1.1 在 `src/core/types/cmp.ts` 中添加 `RenderType` 枚举（ADD、UPDATE、DELETE）
- [x] 1.2 修改 `RenderParams` 接口，移除 `app` 字段，添加 `type?: RenderType` 字段
- [x] 1.3 修改 `cmpRender` 函数签名：
  - 参数从 `{ cmp, app }` 改为 `{ cmps: Cmp[], type?: RenderType }`
  - 使用 `window.spuEditorApp` 替代 `app` 参数
  - 支持批量处理数组中的多个组件
- [x] 1.4 在 `src/core/renderer/app/index.tsx` 中设置 `window.spuEditorApp = app`（在 app 创建后）

## 2. 渲染组件更新

- [x] 2.1 更新 `src/core/renderer/components/rect.ts` 支持 UPDATE 和 DELETE
- [x] 2.2 更新 `src/core/renderer/components/text.ts` 支持 UPDATE 和 DELETE
- [x] 2.3 更新 `src/core/renderer/components/ellipse.ts` 支持 UPDATE 和 DELETE
- [x] 2.4 更新 `src/core/renderer/components/image.ts` 支持 UPDATE 和 DELETE
- [x] 2.5 更新 `src/core/renderer/components/path.ts` 支持 UPDATE 和 DELETE
- [x] 2.6 更新 `src/core/renderer/components/line.ts` 支持 UPDATE 和 DELETE
- [x] 2.7 更新 `src/core/renderer/components/arrow.ts` 支持 UPDATE 和 DELETE
- [x] 2.8 更新 `src/core/renderer/components/connector.ts` 支持 UPDATE 和 DELETE

每个组件函数需要：

- ADD: 创建新元素并添加到 tree（现有行为）
- UPDATE: 通过 `app.tree.findId(cmp.id)` 查找元素，使用 `setAttr` 更新属性
- DELETE: 通过 `app.tree.findId(cmp.id)` 查找元素，调用 `destroy()` 并从 tree 移除

## 3. useRender 更新

- [x] 3.1 修改 `src/components/SuperEditor/editor/canvas/useRender.ts`：
  - 移除 `app` 的依赖
  - 使用新的 `cmpRender({ cmps: [cmp], type: 'ADD' })` 格式

## 4. Model Store 集成

- [x] 4.1 在 `src/components/SuperEditor/store/model.ts` 中：
  - 导入 `cmpRender` 函数
  - 在 `updateCmps` 方法中，批量调用 `cmpRender({ cmps, type: 'UPDATE' })`
  - 在 `removeCmpByIds` 方法中，调用 `cmpRender({ cmps: ids.map(id => ({ id })), type: 'DELETE' })`
  - 在 `alignCmps` 方法中，对齐后调用 `cmpRender({ cmps: updates, type: 'UPDATE' })`

## 5. 验证和测试

- [ ] 5.1 验证新增组件时 leafer 元素正确创建
- [ ] 5.2 验证更新组件时 leafer 元素正确更新（位置、大小、样式等）
- [ ] 5.3 验证删除组件时 leafer 元素正确移除
- [ ] 5.4 验证批量操作（多选、对齐等）正常工作
- [ ] 5.5 验证撤销/重做功能不受影响
- [ ] 5.6 验证 `window.spuEditorApp` 在 app 初始化时正确设置
