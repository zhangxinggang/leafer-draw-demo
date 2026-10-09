## 1. Implementation

- [x] 1.1 新增独立 React/Vite 应用、工作区依赖、启动脚本和文档
- [x] 1.2 实现可扩展算法卡片列表和详情导航
- [x] 1.3 提取无 UI 依赖的包围框、限制检查、新增位置和连续拖动算法
- [x] 1.4 实现参数输入、新增弹框、画布拖动、缩放平移和实时指标
- [x] 1.5 完成不同颜色、尺寸标注、约束反馈和响应式样式

## 2. Validation

- [x] 2.1 验证空画布、紧贴包围框、负坐标、单矩形和新增校验
- [x] 2.2 验证宽高边界、面积边界、对角拖动、跨越不可行区和回退拖动
- [x] 2.3 通过类型检查、应用构建和适用 lint 检查
- [x] 2.4 验证浏览器交互与布局，执行 OpenSpec 严格校验

## Validation Results

- `pnpm --filter @momo/utils test:rectangle`：12 项通过，包含 250 组固定种子的连续移动不变量检查。
- `pnpm build:algorithm`：严格 TypeScript 检查与 Vite 构建通过。
- 新增 TS/TSX 文件及算法核心的 ESLint 检查通过，0 错误、0 警告。
- `pnpm dlx @fission-ai/openspec validate add-algorithm-playground --strict`：通过。
- 浏览器验证：卡片导航/历史返回、超限尺寸提示、三个矩形紧贴包围框、宽度拖动停止、向内键盘微调、面积拖动停止、拒绝不兼容的新参数、删除最后一个矩形恢复初始宽高。
- 1440 px 桌面和 390 px 手机断点检查通过，手机页面无横向溢出。
