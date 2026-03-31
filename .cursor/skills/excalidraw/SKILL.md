---
name: excalidraw
description: 生成手绘风格的图表（架构图、流程图、系统设计图）并保存为 .excalidraw.json 文件。当用户需要图表、提到 Excalidraw，或需要将 Mermaid 转换为可视化图形时使用。
---

# Excalidraw 图表生成

以 Excalidraw JSON 格式生成专业的手绘风格图表。

## 关键规则

1. **箭头绑定 (必须遵循)**: 箭头必须双向绑定到组件：
   - 箭头需要 `startBinding` 和 `endBinding` 指向组件ID
   - 矩形需要 `boundElements` 数组列出绑定的箭头ID
   - 缺少任一项，箭头将无法与组件对齐

2. **文本需要宽度/高度**: 文本元素必须有 `width` 和 `height` 字段，否则不会渲染

3. **箭头标签**: 放置在箭头下方 (y + 30) 或上方 (y - 30)，绝不能重叠组件

4. **背景区域尺寸 (必须遵循)**: 背景区域（子图/阶段）必须完全覆盖所有包含的元素：
   - 计算边界框：找到区域内所有元素的最小/最大 x/y 坐标
   - 添加填充：四边各40px
   - 公式: `width = (maxX + maxWidth) - minX + 80`, `height = (maxY + maxHeight) - minY + 80`
   - 验证: 每个子元素的右下角必须在区域内

5. **无重叠 (必须遵循)**: 箭头不得穿过无关组件；标签不得与组件重叠。参见“布局优化”部分获取策略。

6. **容器绑定 (必须遵循)**: 连接到分组/嵌套结构时，箭头必须绑定到外层容器（背景区域），而不是内部元素：
   - 如果一个阶段/子图包含多个内部步骤，外部的箭头应连接到容器框
   - 内部元素的连接保持内部；外部连接通向容器
   - 示例: `dag → main-bg` (容器), 不是 `dag → read-main` (内部元素)
   - 这样可以保持图表的语义正确性和视觉清晰度

7. **同级布局 (必须遵循)**: 相同层次级别的元素必须水平放置（同一行），而不是垂直：
   - 同级表示并行/替代路径（例如，TCP和HTTP处理程序）
   - 垂直堆叠意味着顺序执行，这在语义上对同级来说是错误的
   - 使用从父节点出发的分支箭头指向水平排列的子节点

8. **嵌套结构清晰性 (必须遵循)**: 当容器包含内部元素时，确保清晰的层级关系和无重叠：
   - 内部元素之间必须有足够的垂直间距，并通过箭头显示调用序列
   - 文本标签必须完全位于其矩形内（计算: `rect.height >= text.height + 20`）
   - 引用注释（文件路径、行号）放在盒子外侧（下方或右侧）
   - 父容器内的子容器应在视觉上有所区别（不同的透明度或颜色深浅）

9. **箭头路径空间预留 (必须遵循)**: 当箭头连接嵌套容器时，确保有足够的空间用于箭头路由：
   - 问题: 如果容器太近，箭头可能会穿过目标容器而不是连接到边缘
   - 解决方案: 主动扩大父容器以使子容器与其下一个目标之间留出40-60px的间隙
   - 当多个子容器需要合并箭头到下面的共享目标时，计算: `target.y >= max(child.y + child.height) + 60`
   - 如果生成后出现箭头交叉的情况，则增加容器的高度而不是使用复杂的绕路路径

10. **SVG导出请求 (必须遵循)**: 如果用户请求SVG输出/转换，始终通过 `https://kroki.io/excalidraw/svg` 使用 `curl` 将生成的 `.excalidraw.json` 文件进行转换。

## 强制工作流程（编写 JSON 前必须遵循）

**步骤 1：箭头路径分析** 在放置任何组件之前，列出所有箭头及其源→目标对：

```
Arrow 1: A → B (horizontal)
Arrow 2: B → C (horizontal)
Arrow 3: C → A (return arrow - DANGER: will cross B if horizontal layout)
```

**步骤 2：识别交叉风险** 针对每个箭头，检查：“从源到目标的直线是否会穿过其他组件？”

- 如果是 → 标记为“需要布局调整”或“需要绕行路径”
- 导致交叉的常见模式：
  - 水平布局中的返回箭头（例如，当 B 位于 A 和 C 之间时，C → A）
  - 非相邻组件之间的双向流
  - 以中心组件为核心的星型（hub-and-spoke）模式

**步骤 3：选择布局策略** 根据交叉风险，选择合适的布局：

- **无交叉**: 使用简单的水平/垂直布局
- **1-2 处交叉**: 使用绕行路径（多点箭头）
- **3 处以上交叉或复杂流**: 重构为 2D 布局（网格、三角形、菱形）

**步骤 4：最终确认** 生成 JSON 后，在脑海中追踪每条箭头路径并确认：

- [ ] 无箭头穿过其未连接的任何组件
- [ ] 无标签与任何组件重叠
- [ ] 所有背景区域完全包含其内部元素

## 核心元素

### 基础模板

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [],
  "appState": { "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```

### 元素模板

**矩形（组件框）**

```json
{
  "id": "unique-id",
  "type": "rectangle",
  "x": 100,
  "y": 100,
  "width": 140,
  "height": 60,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "#a5d8ff",
  "roundness": { "type": 3 },
  "boundElements": [{ "id": "arrow-id", "type": "arrow" }]
}
```

**文本** （需指定 width/height，fontFamily 必须为 4）

```json
{
  "id": "unique-id",
  "type": "text",
  "x": 120,
  "y": 120,
  "width": 80,
  "height": 24,
  "text": "Label",
  "fontSize": 16,
  "fontFamily": 4,
  "textAlign": "center"
}
```

文本居中公式（使文本在矩形内居中）：

- `text.x = rect.x + (rect.width - text.width) / 2`
- `text.y = rect.y + (rect.height - text.height) / 2`

**箭头**

```json
{
  "id": "unique-id",
  "type": "arrow",
  "x": 240,
  "y": 130,
  "points": [
    [0, 0],
    [100, 0]
  ],
  "startBinding": { "elementId": "source-id", "focus": 0, "gap": 5 },
  "endBinding": { "elementId": "target-id", "focus": 0, "gap": 5 },
  "endArrowhead": "arrow"
}
```

箭头坐标系：

- `x`, `y`: 箭头起点的绝对位置
- `points`: 相对于 (x, y) 的偏移量。第一个点始终为 [0, 0]
- Example: `x: 100, y: 200, points: [[0,0], [50, 0], [50, 100]]` 会绘制一条从 (100, 200) 开始的 L 形箭头

**背景区域** - 使用矩形并设置 `"opacity": 30`

### 默认值（可省略）

```json
"fillStyle": "solid", "strokeWidth": 2, "roughness": 1,
"opacity": 100, "angle": 0, "seed": 1, "version": 1
```

## 颜色系统

| 用途          | 背景色    | 描边色    |
| ------------- | --------- | --------- |
| 主要 / 阶段 1 | `#a5d8ff` | `#1971c2` |
| 次要 / 阶段 2 | `#b2f2bb` | `#2f9e44` |
| 强调 / 共享   | `#fff3bf` | `#e67700` |
| 存储 / 状态   | `#d0bfff` | `#7048e8` |

## 布局规则

- 坐标对齐到 20 的倍数
- 组件间距：100-150px
- 标准组件尺寸：`140×60`
- 背景区域: `opacity: 30`
- 渲染顺序：数组中靠前的元素显示在后方

## 常见图表模式

### 顺序图布局

对于顺序图（多个参与者及消息流）：

- 将参与者水平放置在顶部（y = 100）
- 每个阶段/步骤在其下方拥有独立的垂直区域
- 使用背景区域分隔各阶段
- 垂直生命线是隐式的（不作为元素绘制）
- 消息在参与者之间从左到右或从右到左流动

布局策略：

```
Phase 1 (y: 80-300):   [A] -----> [B] -----> [C]
                            msg1       msg2
                       [A] <----- [B]
                            response

Phase 2 (y: 320-500):  [A'] ----> [B'] ----> [C']
                       (duplicate participants at new y)
```

关键见解：对于多阶段顺序图，应在每个阶段中重复绘制参与者框，而非绘制长的垂直生命线。这样可避免箭头交叉问题。

## 布局优化（避免重叠）

### 防止箭头重叠

当多个箭头连接到同一组件时：

- 使用 `focus` 参数在组件边缘偏移箭头位置
- `focus: -0.5` = 上半部分, `focus: 0.5` = 下半部分, `focus: 0` = 中心
- 示例：两条水平箭头可分别使用 `focus: -0.5` 和 `focus: 0.5` 在垂直方向上分开

### 防止箭头穿过无关组件

当箭头会穿过不相关的组件时，请重构布局：

**3 个组件带返回箭头（A→B→C，C→A）：**:

- 三角形布局：A 在顶部，B 在左下，C 在右下
- 所有箭头沿三角形边缘流动，无交叉

**4 个组件带返回箭头（A→B→C→D，D→A）**:

- 菱形布局：A 在顶部，B 在左侧，C 在底部，D 在右侧
- 或使用 2×2 网格，并用对角线表示返回箭头
- 或为返回箭头使用绕行路径（从整行上方或下方绕过）

**4个及以上组件顺序排列并带返回箭头**:

- 分成多行：正向流程放在顶行，返回流程放在底行
- 或使用垂直绕行：返回箭头从所有组件的上方或下方绕过
  ```json
  "points": [[0, 0], [0, -80], [-400, -80], [-400, 0]]
  ```

**星型结构（中心组件连接多个组件）**:

- 将中心组件置于中央，其他组件呈放射状围绕
- 避免将外围组件排成一条直线且中心组件位于中间

**默认假设**: 如果存在返回箭头，水平布局很可能失败——应提前规划绕行路径或二维布局。

## 完整示例

**带返回箭头的流程（使用绕行路径）** A → B → C，然后 C → A（返回箭头从上方绕行以避免穿过 B）

箭头分析：

- 箭头 1: A → B (水平) ✓
- 箭头 2: B → C (水平) ✓
- 箭头 3: C → A (返回) ⚠️ 会穿过 B → 使用上方绕行路径

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [
    {
      "id": "a",
      "type": "rectangle",
      "x": 100,
      "y": 150,
      "width": 140,
      "height": 60,
      "backgroundColor": "#a5d8ff",
      "strokeColor": "#1971c2",
      "roundness": { "type": 3 },
      "boundElements": [
        { "id": "arr1", "type": "arrow" },
        { "id": "arr3", "type": "arrow" }
      ]
    },
    {
      "id": "a-label",
      "type": "text",
      "x": 155,
      "y": 168,
      "width": 30,
      "height": 24,
      "text": "A",
      "fontSize": 16,
      "fontFamily": 4,
      "textAlign": "center"
    },
    {
      "id": "b",
      "type": "rectangle",
      "x": 340,
      "y": 150,
      "width": 140,
      "height": 60,
      "backgroundColor": "#b2f2bb",
      "strokeColor": "#2f9e44",
      "roundness": { "type": 3 },
      "boundElements": [
        { "id": "arr1", "type": "arrow" },
        { "id": "arr2", "type": "arrow" }
      ]
    },
    {
      "id": "b-label",
      "type": "text",
      "x": 395,
      "y": 168,
      "width": 30,
      "height": 24,
      "text": "B",
      "fontSize": 16,
      "fontFamily": 4,
      "textAlign": "center"
    },
    {
      "id": "c",
      "type": "rectangle",
      "x": 580,
      "y": 150,
      "width": 140,
      "height": 60,
      "backgroundColor": "#d0bfff",
      "strokeColor": "#7048e8",
      "roundness": { "type": 3 },
      "boundElements": [
        { "id": "arr2", "type": "arrow" },
        { "id": "arr3", "type": "arrow" }
      ]
    },
    {
      "id": "c-label",
      "type": "text",
      "x": 635,
      "y": 168,
      "width": 30,
      "height": 24,
      "text": "C",
      "fontSize": 16,
      "fontFamily": 4,
      "textAlign": "center"
    },
    {
      "id": "arr1",
      "type": "arrow",
      "x": 245,
      "y": 180,
      "points": [
        [0, 0],
        [90, 0]
      ],
      "endArrowhead": "arrow",
      "startBinding": { "elementId": "a", "focus": 0, "gap": 5 },
      "endBinding": { "elementId": "b", "focus": 0, "gap": 5 }
    },
    {
      "id": "arr2",
      "type": "arrow",
      "x": 485,
      "y": 180,
      "points": [
        [0, 0],
        [90, 0]
      ],
      "endArrowhead": "arrow",
      "startBinding": { "elementId": "b", "focus": 0, "gap": 5 },
      "endBinding": { "elementId": "c", "focus": 0, "gap": 5 }
    },
    {
      "id": "arr3",
      "type": "arrow",
      "x": 650,
      "y": 145,
      "points": [
        [0, 0],
        [0, -60],
        [-480, -60],
        [-480, 0]
      ],
      "endArrowhead": "arrow",
      "strokeStyle": "dashed",
      "startBinding": { "elementId": "c", "focus": 0, "gap": 5 },
      "endBinding": { "elementId": "a", "focus": 0, "gap": 5 }
    },
    {
      "id": "arr3-label",
      "type": "text",
      "x": 380,
      "y": 60,
      "width": 60,
      "height": 20,
      "text": "return",
      "fontSize": 12,
      "fontFamily": 4,
      "textAlign": "center"
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```

## 输出

- 文件名: `{描述性名称}.excalidraw.json`
- 位置: 项目根目录或 `docs/` 文件夹
- 告知用户: 拖拽至 https://excalidraw.com 或使用 VS Code 的 Excalidraw 插件打开

### 通过 Kroki 转换为 SVG（当用户要求 SVG 时）

如果用户明确要求 SVG（例如，“转换为 svg”、“需要 svg 导出”），请使用以下命令进行转换：

```bash
curl -sS https://kroki.io/excalidraw/svg \
  -H 'Content-Type: application/json' \
  --data-binary @diagram.excalidraw.json \
  -o diagram.svg
```

注意事项：

- 输入必须是有效的 Excalidraw JSON 文件 (`*.excalidraw.json`)
- 同时保留两个输出：源 JSON + 导出的 SVG
- 如果用户要求 SVG，则不得跳过此转换步骤

## Notes注意事项

- ID 在整个文件中必须唯一
- `fontFamily`: 1=Virgil, 2=Helvetica, 3=Cascadia, 4=Comic Shanns (手绘风格必须使用此项)
- `strokeWidth` 在软件图中用法:
  - `1`（细线）：背景区域、容器边框、次要连接
  - `2`（常规/默认）：主要组件、主流程箭头
  - `4`（粗线）：强调、关键路径、高亮元素
- 虚线箭头：添加 `"strokeStyle": "dashed"`
