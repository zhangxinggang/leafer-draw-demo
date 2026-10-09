# Change: 新增算法应用与防逃逸交互演示

## Why

需要独立的算法卡片入口，以及可以直观验证矩形包围框面积和边长约束的交互页面。用户已明确要求实现应用、交互规则与公共算法，本变更按该授权实施。

## What Changes

- 新增 `apps/momoAlgorithm`，支持算法卡片列表和防逃逸详情页。
- 支持配置面积基准宽高、极限宽高，通过弹框新增可拖动的小矩形。
- 大矩形实时取所有小矩形的最小包围框，拖动全程满足面积和极限边长限制。
- 提供大画布、缩放、平移、尺寸标注、面积监测、选中与删除操作。
- 将包围框、参数校验、新增位置与连续拖动约束提取到 `packages/momoUtils`。

## Impact

- Affected specs: `algorithm-playground`（新增）
- Affected code: `apps/momoAlgorithm/`、`packages/momoUtils/`、根目录启动脚本、锁文件和 README。
- 既有编辑器及其渲染规范不受影响。
