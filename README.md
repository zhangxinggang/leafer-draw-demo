# Leafer Draw Demo - 重构项目

## 优化

https://ask.csdn.net/questions/8923667

## 项目概述

这是一个基于 Leafer UI 构建的可视化编辑器项目，支持拖拽添加元素、多选批量操作、对齐功能、标尺和辅助线等功能。

## 算法应用

`apps/momoAlgorithm` 是独立的交互算法应用。运行 `pnpm dev:algorithm`，打开 `http://localhost:5174`，点击“防逃逸”卡片进入实验。生产构建使用 `pnpm build:algorithm`。

- 设置大矩形宽高作为面积上限（宽 × 高），设置极限宽高作为边长上限，点击“应用参数”。
- 点击“新增小矩形”输入宽高。外框自动紧贴所有小矩形；小矩形允许重叠。
- 拖动小矩形触及限制时会停止。拖动空白平移、滚轮缩放，“居中适应”显示整个包围框。
- 选中画布中的矩形后，方向键移动 1 px，Shift + 方向键移动 10 px。
- 当前真实面积、包围框宽高和约束占用比例实时更新；删除最后一个矩形后恢复初始宽高框。

核心算法位于 `packages/momoUtils/src/rectangleEscape`，可通过 `@momo/utils/rectangleEscape` 在无浏览器环境下使用。运行 `pnpm --filter @momo/utils test:rectangle` 验证包围框、新增和连续移动约束。

### 极限箱体

算法目录的第二张卡片为“极限箱体”，详情地址 `/#/algorithms/extreme-cabinet`。

- 输入显示屏/模组宽高、接收卡最大模组列数/行数、发送卡极限宽高/带载/网口数量和网口带载（默认 650000）。接收卡允许在配置上限内缩小，页面实时换算尺寸。
- 显示屏宽高无需整除模组尺寸：模组列数、行数分别向下取整并从左上角铺设，右侧或底部不足一个完整模组的余量保留为灰色显示屏。真实发送卡带载为 `min(极限带载, 网口数 × 网口带载)`；每个网口的模组容量单独向下取整。
- 按“发送卡数量 → 接收卡数量 → 网线数量”求精确全局最优。行、列同优时显示两份接线图：灰色屏幕、模组网格、接收卡、透明发送卡外框、彩色中心箭头及起止标记。
- 发送卡名称默认 `V6`，修改后即时更新两份图和设备明细。卡内显示 `V6-1`、实际宽高和 `2宽6高` 等模组数量，底部显示全局网线编号及本卡网口编号。
- 连线从接收卡中心开始，圆形起点显示“发送卡序号-本卡网口序号”，接收卡边界上的三角箭头表示方向，方块为终点。同一发送卡使用同一色系，不同网线使用不同色调；其他发送卡使用不同颜色。单接收卡网线的起终点重合，以方框包围圆形标识。
- 点击接收卡可高亮整根网线，悬停查看完整编号及连接顺序；支持展开查看、缩放和平移。
- 两个 Worker 同时计算两种方向，先显示可行结果，再依次证明发送卡、接收卡、网线最少。复杂分区最坏可能需要较长搜索；停止搜索保留当前方案，未完成证明的方案不会标为最优。

无 UI 依赖的核心入口为 `@momo/utils/extremeCabinet`，`optimizeCabinet(configuration, 'row' | 'column')` 是逐步返回结果的生成器，矩形坐标使用模组单位。`provedPrefix` 为已证明的目标数（0–3），全部完成时 `isOptimal` 为真。运行 `pnpm --filter @momo/utils test:cabinet` 验证独立穷举与全部约束，运行 `pnpm --filter @momo/utils bench:cabinet` 测量计算时间；设置 `CABINET_BENCH_STRESS=1` 可加入 90×90 模组的受限几何案例。辅助构造与证明加速器可以跳过或返回未知，但不限制生产完整搜索。

`pnpm --filter @momo/utils bench:cabinet:profile` 使用固定种子的 40 组混合参数诊断证明耗时（单例默认诊断预算 300 ms，可设置 `CABINET_PROFILE_MS` 和 `CABINET_PROFILE_CASES`，或用 `CABINET_PROFILE_IDS=15,39` 选择原序号案例）。超出诊断预算仅记为未完成，不宣称最优，也不改变生产 Worker 的完整搜索。

下界加速包含发送卡内部可实现的网口矩形面积、网口面积/资源 DP、较短边上的内外层搜索、经过 BigInt 核验的周期染色系数，以及使用 BigInt 有理数的一维切片组合证明。接收卡数量达到采样下界且一边整除时，利用被迫形成的完整列判断网口能否合并接收卡。发送卡数量达到采样下界时，可证明最小边长；接收卡数量也达到相应下界时，进一步排除不能实现该数量的发送卡尺寸。混合切割与五矩形交错构造只提供可行上界。基准额外包含 18×11 模组的高度不整除案例、16×4 的长条发送卡内部案例及两种 34×19 的几何约束案例；辅助步骤跳过或预算不足时，继续完整几何搜索。

小面积余量的加速也保留精确发送卡数量，利用边长组合可达性、固定切片张数的边长总和和周期条纹进行资源判定。不能出现在同一切片上的发送卡必须容纳在彼此投影之外；余量只允许两张不整除边长的卡时，利用它们必须形成一致的垂直投影进一步筛选。23×10、15×14、22×13 模组案例分别由独立形状多重集、投影面积及逐格染色/奇偶投影证书核对 `(12,89,24)`、`(8,28,16)`、`(18,146,18)` 全局最优，最后一例无贯穿整个屏幕的切割线。每次完成判定提升数量下界后立即发布更新的证明状态。

完整搜索的每个剩余区域也使用固定发送卡数量的面积/资源 DP 和已完成的有理数切片证书。水平切片被已覆盖区隔开时分别计算；矩形放置与撤销会增量维护切片价格，数值安全预算不足时回退完整重算，最终用 BigInt 向上取整。近满容量案例另用列/行投影的整数余量 DP 收紧初始接收卡下界；小面积余量时还会在两个投影轴上枚举例外矩形的位置，并检查其余矩形是否能以连续区间覆盖每个切片，从而证明某个接收卡预算无解。辅助规模超限则跳过。先尝试已证明的资源下界，再尝试比当前方案少一个资源单位，仍有较大差距时二分；跨预算复用已完整证明无解的子区域，缓存最多 50000 项。独立 occupied-cell 穷举检查部分区域的接收卡、网线下界；未完成、找到可行解或停止的搜索不会产生无解缓存。扩展基准可设置 `CABINET_BENCH_MS=5000` 检查较慢的混合分区案例，该值只限制诊断脚本。

局部交错构造能在贯穿切割的一侧生成非切割式分区；父布局保存子布局引用，数量与实际几何保持一致。发送卡上界不超过 20 时，构造至多尝试 2000000 种组合；整屏交错组合数不超过 100000 时也固定完成该层枚举，避免并发或机器负载使时间窗提前丢弃有用候选，其余局部改进仍使用短时间窗。搜索先检查面积和资源表，再扫描几何；剩余一或两张发送卡时直接核对矩形后缀。诊断可设置 `CABINET_PROFILE_IDS=22` 选择固定种子的 31×16 慢例，设置 `CABINET_PROFILE_TRACE=1` 记录方案、下界和证明阶段，设置 `CABINET_PROFILE_LAYOUT=1` 查看发送卡坐标。本机该例约 0.12–0.15 秒给出 `(13,161,38)` 布局，数次运行约 4.2–5.6 秒完成全局最优证明；这是样本测量，复杂输入仍可能耗时较长。

## 项目架构

### 核心模块（src/core/）

核心模块独立于UI，提供渲染逻辑和类型定义，支持无界面渲染API。

- **types/**: 类型定义
  - `cmp.ts`: 组件类型定义（Cmp、TextCmp、RectCmp等）
- **utils/**: 工具函数
  - `utils.ts`: 通用工具函数（uuid、swap等）
  - `types.ts`: 类型工具
  - `leafer.ts`: Leafer相关工具函数
- **renderer/**: 渲染器（React组件）
  - `app/`: Leafer App组件
  - `components/`: 各种图形组件（Rect、Text、Ellipse等）
  - `hooks/`: React Hooks
  - `context/`: React Context
- **generator.ts**: 组件生成器
- **render.tsx**: 渲染函数
- **index.ts**: 核心模块统一导出

### 编辑器组件（src/components/SuperEditor/）

- **layout/**: 布局组件
  - `index.tsx`: 主布局容器（四区域布局）
  - `TopBar.tsx`: 顶部快捷菜单
  - `LeftSidebar.tsx`: 左侧元素选择菜单
  - `CanvasArea.tsx`: 中间画布渲染区域
  - `RightPanel.tsx`: 右侧属性面板
- **store/**: 状态管理
  - `canvas.ts`: 画布状态（名称、背景色、尺寸、标尺、辅助线、暗色主题等）
  - `model.ts`: 模型状态（元素列表、选中状态、批量操作、对齐方法等）
  - `image.ts`: 图片管理状态
  - `toolbar.ts`: 工具栏状态
- **editor/**: 编辑器核心
  - `canvas/`: 画布相关
  - `menu/`: 菜单
  - `settings/`: 设置
  - `toolbar/`: 工具栏
  - `undo-redo/`: 撤销重做
  - `zoom/`: 缩放

## 重构进度

### ✅ 已完成

1. **核心渲染模块独立化**
   - 创建了 `src/core/` 目录结构
   - 将 `driver/` 移动到 `src/core/renderer/`
   - 将 `render.tsx` 和 `generator.ts` 移动到 `src/core/`
   - 将 `interface/cmp.ts` 移动到 `src/core/types/`
   - 创建了核心模块的统一导出 `src/core/index.ts`
   - 更新了所有引用路径

2. **Store扩展**
   - 扩展了 `canvas.ts`，添加了画布名称、背景色、尺寸、标尺设置、辅助线数据、菜单宽度、暗色主题等状态
   - 扩展了 `model.ts`，添加对齐方法 `alignCmps`（支持左、右、上、下、水平居中、垂直居中）
   - 创建了 `image.ts`，用于管理图片列表数据（支持分类、搜索、上传）

3. **基础布局结构**
   - 创建了 `layout/` 目录和主布局容器
   - 实现了四区域布局（顶部、左侧、中间、右侧）
   - 支持暗色主题切换
   - 更新了主编辑器组件使用新布局

### ✅ 已完成（全部完成）

1. **顶部快捷菜单（TopBar）** ✅
   - 选中、移动、撤销重做按钮
   - 放大缩小自适应按钮
   - 对齐方式按钮（左、中、右、上、中、下）- 多选时启用，单选时置灰
   - 导出（图片/JSON）、导入JSON、保存按钮

2. **左侧元素选择菜单（LeftSidebar）** ✅
   - 一级菜单（文本、元素、图片），默认选中"元素"，宽度60px，可拖动调整
   - 二级菜单面板（文本面板、元素面板、图片面板），默认宽度310px，可拖动调整
   - 支持双击添加到画布中心（预设尺寸）
   - 支持拖拽添加（元素中心点在释放位置）

3. **右侧属性面板（RightPanel）** ✅
   - 画布属性（名称、背景色持久化、尺寸、标尺设置、辅助线管理）
   - 单选元素属性面板（填充、描边、透明度、图层、操作）
   - 多选批量操作面板（批量修改属性，不支持则隐藏）

4. **中间画布区域增强（CanvasArea）** ✅
   - 标尺功能（顶部和左侧显示标尺，跟随缩放更新，刻度间隔可配置）
   - 辅助线功能（从标尺拖拽创建、移动、锁定/解锁、拖出删除）

5. **导出/导入功能** ✅
   - 导出JSON（包含所有配置项：画布设置、所有元素、辅助线、缩放状态等）
   - 导入JSON（完全替换store状态，导入失败提示错误）
   - 导出图片（原有功能，支持PNG/JPG，可配置背景和像素比）

## 使用方法

### 开发

```bash
npm install
npm run dev
```

### 构建

```bash
npm run build
```

## 技术栈

- **React 18**: UI框架
- **TypeScript**: 类型系统
- **Leafer UI**: 图形渲染引擎
- **Zustand**: 状态管理
- **Zundo**: 撤销/重做功能
- **Ant Design**: UI组件库
- **Less**: CSS预处理器

## 核心功能

### 元素类型

- 文本（Text）
- 矩形（Rect）
- 圆形（Ellipse）
- 线条（Line）
- 箭头（Arrow）
- 图片（Image）
- 路径（Path）
- 画笔（Pen）

### 操作功能

- 拖拽添加元素
- 多选批量操作
- 对齐功能（左、右、上、下、水平居中、垂直居中）
- 撤销/重做
- 缩放和平移
- 标尺和辅助线
- 导出/导入

## 注意事项

1. 核心模块（core）不依赖UI组件，可以独立作为npm包使用，支持无界面渲染API
2. 画布名称、背景色、暗色主题使用localStorage持久化
3. 对齐操作支持撤销/重做，对齐到参考边界（最左/最右/最上/最下元素）
4. 批量操作支持撤销/重做，不支持某个属性时自动隐藏该选项
5. 辅助线支持锁定/解锁、拖出画布自动删除
6. 左侧第一级菜单固定60px宽度，不可拖动调整
7. 二级菜单使用grid布局，默认宽度360px，支持拖动调整（最小105px，最大360px），根据宽度自动切换列数（3列->2列->1列）
8. 双击添加元素时，元素中心点在画布可视区正中间，使用预设尺寸
9. 拖拽添加元素时，元素中心点在释放位置（几何中心：x + width/2, y + height/2）
10. 支持暗黑模式和非暗黑模式切换，所有区域（顶部菜单栏、左侧菜单栏、中间画布区域、右侧属性栏）都支持暗黑模式

## 重构计划

详细的重构计划请参考 `.cursor/plan/重构计划.md`

## 知识点总结

### 架构设计

1. **核心模块独立化**: 将渲染逻辑从UI组件中分离，使核心模块可以独立使用，支持无界面渲染
2. **状态管理**: 使用Zustand进行状态管理，配合Zundo实现撤销/重做功能
3. **类型安全**: 使用TypeScript确保类型安全，定义清晰的类型接口

### 实现细节

1. **对齐算法**: 通过计算选中元素的边界框，实现左、右、上、下、水平居中、垂直居中对齐
2. **批量操作**: 通过批量更新方法，支持对多个元素同时进行属性修改
3. **持久化**: 使用Zustand的persist中间件，将关键状态持久化到localStorage

### 改进方向

1. 性能优化：多选批量操作时使用防抖/节流
2. 功能扩展：支持更多元素类型和操作功能
3. 用户体验：优化交互流程，提供更好的视觉反馈

## 代码规范整改

### ✅ 已完成（2024年整改）

根据 `.cursor/rules/common.mdc` 和 `.cursor/rules/react.mdc` 规范，已完成以下整改：

#### 1. 代码风格统一

- ✅ 统一使用单引号（`'`）而非双引号
- ✅ 统一省略分号（除非需要消除歧义）
- ✅ 统一使用制表符（Tab）进行缩进
- ✅ JSX属性必须换行书写，提高可读性
- ✅ 统一使用严格相等（`===`）而非宽松相等（`==`）

#### 2. 代码复用优化

- ✅ 提取公共函数 `getCanvasCenter` 到 `src/components/SuperEditor/utils/leafer.ts`
  - 原在 `TextPanel`、`ElementPanel`、`ImagePanel` 中重复实现
  - 现统一使用公共函数，减少代码重复率（符合重复率<10%的要求）
- ✅ 优化工具函数，添加JSDoc注释说明

#### 3. 命名规范

- ✅ 事件处理函数统一使用 `handle` 前缀（如 `handleDoubleClick`、`handleDragStart`）
- ✅ 布尔变量使用 `is/has/can` 前缀（如 `isLeftResizing`、`hasFill`）
- ✅ 组件使用 `function` 关键字定义（符合React规范）

#### 4. JSX规范

- ✅ 列表渲染必须绑定 `key` 属性
- ✅ JSX属性必须换行书写，提高可读性
- ✅ 避免内联函数定义（使用 `useCallback` 优化）

#### 5. TypeScript规范

- ✅ 接口定义使用 `interface` 而非 `type`（扩展时优先使用interface）
- ✅ 添加必要的类型注释和JSDoc文档

#### 整改文件清单

**布局组件**：

- `src/components/SuperEditor/layout/index.tsx`
- `src/components/SuperEditor/layout/TopBar.tsx`（部分）
- `src/components/SuperEditor/layout/LeftSidebar.tsx`
- `src/components/SuperEditor/layout/CanvasArea.tsx`
- `src/components/SuperEditor/layout/RightPanel.tsx`

**左侧面板组件**：

- `src/components/SuperEditor/layout/LeftSidebar/TextPanel.tsx`
- `src/components/SuperEditor/layout/LeftSidebar/ElementPanel.tsx`
- `src/components/SuperEditor/layout/LeftSidebar/ImagePanel.tsx`

**右侧面板组件**：

- `src/components/SuperEditor/layout/RightPanel/ElementProperties.tsx`
- `src/components/SuperEditor/layout/RightPanel/BatchProperties.tsx`

**工具函数**：

- `src/components/SuperEditor/utils/leafer.ts`（新增公共函数）

**根组件**：

- `src/App.tsx`

### 整改效果

1. **代码可维护性提升**：统一代码风格，提高代码可读性
2. **代码复用率提升**：提取公共函数，减少重复代码（重复率<10%）
3. **类型安全增强**：完善TypeScript类型定义
4. **规范一致性**：所有组件遵循统一的开发规范

### 知识点总结

1. **代码复用原则**：通过提取公共函数，减少代码重复，提高可维护性
2. **代码风格统一**：统一的代码风格有助于团队协作和代码审查
3. **TypeScript最佳实践**：使用interface定义对象结构，便于扩展
4. **React最佳实践**：使用function关键字定义组件，使用useCallback优化回调函数

## 样式引用优化

### ✅ 已完成（2024年优化）

根据 `.cursor/rules/react.mdc` 规范，已完成样式引用优化：

#### 1. CSS Module 统一使用

- ✅ 所有组件统一使用 CSS Module 方式引用样式（`import styles from './index.module.less'`）
- ✅ 所有字符串 className 改为使用 `styles` 对象引用（如 `className={styles['class-name']}`）
- ✅ 避免全局样式污染，确保样式隔离

#### 2. classnames 库使用

- ✅ 对于需要多个 className 的情况，统一使用 `classnames` 库
- ✅ 条件 className 使用 `classNames(styles.class1, { [styles.active]: isActive })` 方式

#### 3. 全局样式优化

- ✅ 删除重复的 `App.css` 文件，统一使用 `index.css` 作为全局样式入口
- ✅ 保留必要的全局样式（如 `html`、`body`、`#root` 等基础样式）

#### 优化文件清单

**布局组件**：

- `src/components/SuperEditor/layout/index.tsx`
- `src/components/SuperEditor/layout/TopBar/index.tsx`
- `src/components/SuperEditor/layout/LeftSidebar/index.tsx`
- `src/components/SuperEditor/layout/LeftSidebar/TextPanel/index.tsx`
- `src/components/SuperEditor/layout/LeftSidebar/ElementPanel/index.tsx`
- `src/components/SuperEditor/layout/LeftSidebar/ImagePanel/index.tsx`
- `src/components/SuperEditor/layout/CanvasArea/index.tsx`
- `src/components/SuperEditor/layout/CanvasArea/Ruler/index.tsx`
- `src/components/SuperEditor/layout/CanvasArea/GuideLine/index.tsx`
- `src/components/SuperEditor/layout/RightPanel/index.tsx`
- `src/components/SuperEditor/layout/RightPanel/ElementProperties/index.tsx`
- `src/components/SuperEditor/layout/RightPanel/CanvasProperties/index.tsx`
- `src/components/SuperEditor/layout/RightPanel/BatchProperties/index.tsx`

**根组件**：

- `src/App.tsx`（移除 App.css 引用）

#### 优化效果

1. **样式隔离**：所有组件样式使用 CSS Module，避免全局样式污染
2. **代码规范**：统一使用 `styles` 对象引用，符合 React 最佳实践
3. **可维护性**：使用 classnames 库处理复杂 className 逻辑，提高代码可读性
4. **文件精简**：删除重复的全局样式文件，统一管理

#### 知识点总结

1. **CSS Module 最佳实践**：使用 CSS Module 进行样式隔离，避免类名冲突
2. **classnames 库使用**：使用 classnames 库处理条件 className，提高代码可读性
3. **全局样式管理**：合理使用全局样式，仅用于基础样式设置

# 其他

## SKILL

地址：https://modelscope.cn/skills/@cyangzhou/ppt/files
