# Design: RectLine 组件实现

## Context

需要实现一个自定义的 Leafer 组件 `RectLine`，继承自 `Rect`，并支持在矩形内显示多行文本。文本需要垂直均匀分布，超出宽度时省略。

## Goals / Non-Goals

### Goals

- 实现继承自 Leafer Rect 的自定义组件
- 文本在矩形内垂直均匀分布
- 文本超出矩形宽度时自动省略

### Non-Goals

- 不支持文本编辑功能（仅显示）
- 不支持文本样式自定义（使用默认样式）
- 不支持水平对齐方式配置（默认左对齐）

## Decisions

### Decision: 使用 Leafer 自定义组件扩展机制

**What**: 使用 Leafer UI 的 `@registerUI()` 装饰器和数据处理器来扩展 Rect 组件。

**Why**:

- 符合 Leafer 官方推荐的自定义组件扩展方式
- 可以保持与现有组件系统的一致性
- 支持类型安全和数据绑定

**Alternatives considered**:

- 使用组合模式（在 Rect 内添加 Text 子元素）：需要手动管理子元素位置，代码复杂度较高
- 使用 Canvas 绘制：失去了 Leafer 的响应式更新能力

### Decision: 使用 Text 子元素渲染文本行

**What**: 在 RectLine 组件内部创建多个 Text 子元素来渲染 `textLines` 数组中的每一行文本。

**Why**:

- 利用 Leafer Text 组件的文本省略能力
- 自动处理文本测量和布局
- 支持响应式更新

**Alternatives considered**:

- 使用单个 Text 元素配合换行：难以实现垂直均匀分布
- 使用自定义绘制：失去 Leafer 的文本渲染优化

### Decision: 文本省略使用 Leafer Text 的内置能力

**What**: 使用 Leafer Text 组件的文本省略功能（通过设置 `textOverflow: 'ellipsis'` 或类似属性）。

**Why**:

- 利用 Leafer 的原生能力，性能更好
- 代码更简洁，维护成本低

**Alternatives considered**:

- 手动截断文本：需要计算字符宽度，跨字体/语言支持复杂

### Decision: 文本垂直分布计算

**What**: 根据 `textLines.length` 和 Rect 的 `height` 计算每行文本的垂直位置，实现均匀分布。

**Why**:

- 简单直接，易于理解和维护
- 性能开销小

**Implementation**:

- 计算每行间距：`spacing = (height - totalTextHeight) / (textLines.length + 1)`
- 或者使用固定行高，计算起始位置和间距

## Risks / Trade-offs

### Risk: 文本测量性能

- **Risk**: 频繁的文本测量可能影响性能
- **Mitigation**: 仅在 `textLines` 或尺寸变化时重新计算布局

### Risk: 文本省略在不同字体下的表现

- **Risk**: 不同字体可能导致省略位置不准确
- **Mitigation**: 使用 Leafer Text 的内置省略功能，确保一致性

### Trade-off: 文本样式限制

- **Trade-off**: 当前设计不支持自定义文本样式
- **Future**: 后续可以通过扩展 `textLines` 为对象数组来支持样式配置

## Migration Plan

1. 实现 RectLine 组件，保持向后兼容（`textLines` 为可选属性）
2. 现有使用 RectLine 的代码无需修改即可继续工作
3. 新功能通过设置 `textLines` 属性启用

## Open Questions

- 文本字体大小是否需要可配置？当前设计使用默认字体大小
- 文本颜色是否需要可配置？当前设计使用默认文本颜色
- 文本行高是否需要可配置？当前设计使用自动计算
