# Leafer 2.3 业务回归记录

验证日期：2026-10-10。浏览器使用独立本地端口 5193（momoEditor）和 5194（momoAlgorithm）。

## 修复与复用

- 绘制模式显式关闭 `move.drag` 和 `move.dragEmpty`，仅“移动”工具开启拖动画布；编辑框只在选择和发送卡框选时启用，退出发送卡模式恢复移动、缩放和旋转权限。
- App 事件读取最新 React 配置；变换结束使用公开的 `editor.list` 同步模型；平移和缩放统一保存到 `tree.zoomLayer`，取消旧的延迟回调。
- RectLine 标签不拦截矩形命中；绘制使用当前尺寸和带载限制。连线预览及警示节点不写入正式关系；容量检查包含下一张卡。
- 删除中间卡同时清理两侧连线，保留其他连接；导入、撤销恢复先创建矩形再创建连接。完整矩形检查处理断链、空洞、重叠及独立宽高/面积限制。
- extreme-cabinet 使用 momoDraw 的 App、RectLine、Connector；共享 `wiringData` 产生原生 Path/Rect/Ellipse/Text。momoEditor 使用同样的颜色、圆形起点编号、边界箭头和方形终点。
- 箱体双方向图和弹窗显式传入独立 App，不占用编辑器全局引用。弹窗在 DOM 挂载后初始化；卸载清理 App、标尺和吸附插件。Worker 同步预览的 `noRecord`，移除每次绘制无用途的 JPG 导出。

## 浏览器逐项检查

| 业务 | 操作与结果 |
| --- | --- |
| 矩形连线 | 拖动生成 5 张接收卡、4 段连线；画布偏移保持 `(0,0)` |
| 连线矩形 | 拖过两张已有卡建立连线，标签区域可命中；画布偏移不变 |
| 基础绘图 | 矩形、圆形、线条、箭头、画笔均生成对应原生节点，绘制前后平移位置不变 |
| 选择与移动 | 拖动接收卡后模型坐标同步，连接跟随；工具栏撤销/重做恢复坐标 |
| 缩放接收卡 | 编辑框拖拽同步宽高、位置及连线；撤销恢复原宽高和路径 |
| 旋转 | 调用原生 `editor.rotateOf('center',30)` 并派发抬起事件，模型与节点角度/位置一致；撤销回到 0 度（此项为 API 事件回归） |
| 发送卡 | 框选四张接收卡并新增发送卡，子卡关系和边框正确；切回选择时三个变换权限均恢复 |
| 视图平移 | “移动”工具拖拽得到 `(50,50)`，刷新后原生视图和持久化 zoomLayer 均恢复该位置 |
| 删除与撤销 | 删除中间卡同时移除两侧连线，其他连线保留；撤销恢复所有 7 个模型节点 |
| JSON/PNG | JSON 序列化后通过 `replaceCmps` 回载，包括连线排在矩形之前的输入；原生 `tree.export('png')` 成功（验证模型和导出 API） |
| 箱体原生渲染 | 行、列图及展开弹窗各有 3 个 Canvas，图内无 SVG；默认方案各为 1 发送卡 / 36 接收卡 / 4 网线 |
| 箱体交互 | 放大至 140%、适应、拖动平移、模组和文案开关、点击接收卡高亮及取消高亮正常；弹窗关闭后可重新展开另一方向 |
| 单卡及余量 | 321×181 屏幕、160×90 模组产生 2×2 完整模组及一张接收卡；起点圆形编号外围有方形终点，屏幕保留余量；检查后恢复默认参数 |

## 自动检查

```sh
node --test packages/momoDraw/tests/wiring.test.mjs packages/momoUtils/src/extremeCabinet/index.test.mjs packages/momoUtils/src/rectangleEscape/index.test.mjs
pnpm exec tsc --noEmit -p apps/momoEditor/tsconfig.json
pnpm --filter @momo/algorithm build
pnpm --filter @momo/leafer-editor exec vite build
```

- 54 项测试全部通过，其中 7 项新增测试覆盖连线几何、起终点、配色、矩形覆盖、容量限制和删除关系。
- 两应用类型检查及生产构建通过；仅有 Vite 大包体积提示。
- 改动 TS/TSX 文件通过 ESLint。当前 pnpm 布局需使用 `--resolve-plugins-relative-to node_modules/.pnpm/@umijs+fabric@4.0.1_postcss@8.5.8/node_modules` 加载仓库已有插件。
- `git diff --check` 通过。当前环境无 OpenSpec CLI；本次规范文本未执行 CLI 校验。
