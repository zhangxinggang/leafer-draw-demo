## 1. Implementation

- [x] 1.1 在 `BusinessStore` 接口中添加 `freeRouting: boolean` 字段
- [x] 1.2 在 `useBusinessStore` 的初始状态中设置 `freeRouting: false`
- [x] 1.3 在 `src/core/utils/business.ts` 中实现 `checkConnIsSquare` 函数
  - [x] 1.3.1 处理 `null` 或空数组的情况
  - [x] 1.3.2 检测连接是否形成完整的矩形（4个节点形成闭环）
  - [x] 1.3.3 如果未形成完整矩形，返回最后两个节点
  - [x] 1.3.4 如果形成完整矩形，返回空数组
- [x] 1.4 在 `useEventHandler.ts` 的 `onPointUp` 方法中集成检测逻辑
  - [x] 1.4.1 从 `useBusinessStore` 获取 `freeRouting` 值
  - [x] 1.4.2 当 `freeRouting` 为 `false` 且 `preLineRect.current` 存在时，调用 `checkConnIsSquare`
  - [x] 1.4.3 处理检测结果（返回的节点数组）

## 2. Testing

- [ ] 2.1 测试 `checkConnIsSquare` 函数处理 `null` 输入
- [ ] 2.2 测试 `checkConnIsSquare` 函数处理空数组输入
- [ ] 2.3 测试 `checkConnIsSquare` 函数检测完整矩形（返回空数组）
- [ ] 2.4 测试 `checkConnIsSquare` 函数检测未完整矩形（返回最后两个节点）
- [ ] 2.5 测试 `onPointUp` 中 `freeRouting` 为 `false` 时的检测调用
- [ ] 2.6 测试 `onPointUp` 中 `freeRouting` 为 `true` 时不调用检测
