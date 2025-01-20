## 1. Implementation

- [x] 1.1 在 `src/core/types/cmp.ts` 中添加 `RectLineCmp` 接口定义
  - [x] 1.1.1 定义 `RectLineCmp` 接口，继承自 `Cmp`
  - [x] 1.1.2 添加 `textLines?: string[]` 属性
  - [x] 1.1.3 设置 `type: CmpType.RectLine`

- [x] 1.2 实现 RectLine 自定义组件类
  - [x] 1.2.1 导入必要的 Leafer UI 模块（`Rect`, `Text`, `PropertyEvent` 等）
  - [x] 1.2.2 创建自定义渲染函数，处理 `textLines` 数据
  - [x] 1.2.3 实现 RectLine 组件渲染器，支持 ADD/UPDATE/DELETE 操作
  - [x] 1.2.4 实现文本子元素管理逻辑
  - [x] 1.2.5 处理 `textLines` 属性的创建和更新

- [x] 1.3 实现文本渲染逻辑
  - [x] 1.3.1 在组件初始化或属性更新时，根据 `textLines` 创建/更新 Text 子元素
  - [x] 1.3.2 实现垂直均匀分布算法：计算每行文本的 y 坐标
  - [x] 1.3.3 为每个 Text 子元素设置正确的 x, y, width 属性
  - [x] 1.3.4 实现文本省略：设置 Text 的 `textOverflow: 'ellipsis'`

- [x] 1.4 实现响应式更新
  - [x] 1.4.1 监听 `textLines` 属性变化，更新文本子元素（在 UPDATE 操作中处理）
  - [x] 1.4.2 监听 Rect 尺寸变化（width, height），重新计算文本布局
  - [x] 1.4.3 清理旧的 Text 子元素，避免内存泄漏（在 updateTextLinesLayout 和 destroy 中处理）

- [x] 1.5 更新组件渲染器
  - [x] 1.5.1 在 `src/core/renderer/components/rectLine.ts` 中导出 RectLine 组件渲染函数
  - [x] 1.5.2 确保组件渲染器能够正确处理 RectLine 组件（已集成到现有渲染系统）

## 2. Testing

- [ ] 2.1 测试 RectLine 组件基本创建和渲染
- [ ] 2.2 测试 `textLines` 为空数组时的行为
- [ ] 2.3 测试 `textLines` 有内容时的垂直均匀分布
- [ ] 2.4 测试文本超出宽度时的省略显示
- [ ] 2.5 测试 `textLines` 属性更新时的响应式更新
- [ ] 2.6 测试 Rect 尺寸变化时文本布局的重新计算
- [ ] 2.7 测试多行文本（2行、3行、5行等）的分布效果

## 3. Integration

- [ ] 3.1 验证 RectLine 组件在现有渲染系统中的集成
- [ ] 3.2 验证 RectLine 组件在 `cmpRender` 中的 ADD/UPDATE/DELETE 操作
- [ ] 3.3 验证类型定义在 TypeScript 中的正确性
