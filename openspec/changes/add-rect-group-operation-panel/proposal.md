# Change: 添加发送卡操作面板和验证功能

## Why

用户需要在业务属性面板中：

1. 能够配置发送卡相关的样式属性（超载颜色、填充颜色、边框宽度、边框颜色）
2. 能够通过操作面板快速新增发送卡
3. 在新增发送卡前需要验证选中的接收卡是否符合限制条件

当前业务属性面板缺少操作功能区域，且发送卡样式配置不完整，需要增强用户体验和业务逻辑验证。

## What Changes

- **UI 增强**：
  - 在业务属性面板中添加"操作"区域，包含"新增发送卡"按钮
  - 在发送卡颜色组后添加四个样式属性配置项（超载颜色、填充颜色、边框宽度、边框颜色），两个设置一行
  - 使用 Ant Design 的折叠面板（Collapse）组织操作、设备设置、样式设置三个区域，默认展开操作区域

- **业务逻辑**：
  - 在 `src/core/utils/business.ts` 中新增 `beforeAddRectGroupCheck` 函数
  - 验证选中的矩形是否为接收卡（backendData.type === CmpType.RectLine，即类型8）
  - 验证框选矩形的面积、宽度、高度是否超过限制（rectGroupLimitArea、rectGroupLimitWidth、rectGroupLimitHeight）
  - 提供相应的错误提示信息

## Impact

- **Affected specs**:
  - `business-properties` (新增能力)
  - `canvas-state` (可能需要修改，如果涉及选中状态验证)

- **Affected code**:
  - `src/components/SuperEditor/layout/RightPanel/BusinessProperties/index.tsx` - UI 组件修改
  - `src/components/SuperEditor/layout/RightPanel/BusinessProperties/index.module.less` - 样式文件
  - `src/core/utils/business.ts` - 新增验证函数
  - `src/components/SuperEditor/store/business.ts` - 可能不需要修改（属性已存在）
