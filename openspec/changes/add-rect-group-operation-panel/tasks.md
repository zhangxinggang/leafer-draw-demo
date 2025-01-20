## 1. Implementation

- [x] 1.1 在 BusinessProperties 组件中添加 Ant Design Collapse 组件，将操作、设备设置、样式设置三个区域组织为折叠面板，默认展开操作区域
- [x] 1.2 在操作区域添加"新增发送卡"按钮，设置 tooltip 为"请框选接收卡"
- [x] 1.3 在发送卡颜色组后面添加四个样式属性配置项：
  - 超载颜色（overloadColor）
  - 填充颜色（fill）
  - 边框宽度（strokeWidth）
  - 边框颜色（strokeColor）
  - 两个设置一行（使用 Row/Col 布局）
- [x] 1.4 在 `src/core/utils/business.ts` 中实现 `beforeAddRectGroupCheck` 函数：
  - 获取当前选中的元素（通过 selectCmpIds 和 getCmpByIds）
  - 验证是否有选中的矩形且类型为 RectLine（type === 8）
  - 如果没有，使用 message 提示"请选择接收卡"
  - 计算框选矩形的边界框（使用 getBoundingMaxMinTotal）
  - 验证面积、宽度、高度是否超过限制
  - 如果超过，使用 message 提示"发送卡已超带载"
- [x] 1.5 在"新增发送卡"按钮的点击事件中调用 `beforeAddRectGroupCheck` 函数
- [x] 1.6 更新样式文件，确保折叠面板和新增按钮的样式正确

## 2. Testing

- [ ] 2.1 验证折叠面板默认展开操作区域
- [ ] 2.2 验证"新增发送卡"按钮的 tooltip 显示正确
- [ ] 2.3 验证四个样式属性配置项正确显示和保存
- [ ] 2.4 验证未选中接收卡时点击按钮提示"请选择接收卡"
- [ ] 2.5 验证选中接收卡但超过限制时提示"发送卡已超带载"
- [ ] 2.6 验证选中接收卡且未超过限制时验证通过（后续功能待实现）
