# Change: 补齐显示屏模组并按像素设置接收卡

## Why

显示屏尺寸不是模组尺寸的整数倍时，当前接线图会留下右侧和底部空白；接收卡设置也要求用户换算模组数量，导入时没有采用接收卡的实际带载尺寸。

## What Changes

- 在模组设置中加入智能补全，将宽高余量分配给最右列、最下一行及右下角。
- 接收卡改为直接配置像素宽高，导入 JSON 时读取 `receiveCardInventory.bear.width/height`，并保证接收卡至少容纳一个模组。
- 根据补全状态显示精简的接收卡标签，并在导入模组宽度为 0 时默认开启智能补全。
- JSON 自动勾选智能补全时执行与手动勾选相同的接收卡尺寸联动。
- 屏幕信息只展示显示屏和单元板，并按所有单元板规格分色显示。
- 屏幕信息近看时在真实点间距的灯珠孔径中显示 `apps/momoAlgorithm/src/assets/screenbg.ts`，孔径外为黑色；缩小远看时按投影间距逐渐淡化黑色间隙，最终融合成连续图像。
- 在单元板规格图例旁添加默认开启的开关，可隐藏屏幕信息中的单元板边框。
- 添加默认值为 1 的 LED 点间距；从 JSON 读取 `schemeUserConfigInfo.pointRatio`，仅用于屏幕信息的点阵绘制。
- 对 LED 与网格绘制设置视口范围和单帧预算，并支持屏幕信息拖动平移、滚轮缩放。

## Impact

Point-pitch rendering keeps the display size fixed: zero shows the image continuously, and smaller positive values reduce black gaps.

- Affected specs: extreme-cabinet
- Affected code: momoAlgorithm cabinet settings/import and momoDraw cabinet geometry/renderers
