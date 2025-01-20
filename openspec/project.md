# Project Context

## Purpose
Leafer Draw Demo 是一个基于 Leafer UI 构建的可视化编辑器项目，支持拖拽添加元素、多选批量操作、对齐功能、标尺和辅助线等功能。项目采用核心模块独立化的架构设计，核心渲染模块（`src/core/`）独立于UI，提供渲染逻辑和类型定义，支持无界面渲染API。

## Tech Stack
- **React 18**: UI框架，使用函数组件和Hooks
- **TypeScript**: 类型系统，启用严格模式
- **Leafer UI**: 图形渲染引擎，用于绘制各种图形元素
- **Zustand**: 轻量级状态管理库
- **Zundo**: 基于Zustand的撤销/重做功能
- **Ant Design**: UI组件库，提供一致的界面组件
- **Less**: CSS预处理器，使用CSS Module进行样式隔离
- **Vite**: 构建工具和开发服务器
- **React Use**: React Hooks工具库

## Project Conventions

### Code Style
- 使用制表符（Tab）进行缩进
- 使用单引号（`'`）表示字符串
- 省略分号（除非需要消除歧义）
- 使用严格相等（`===`）而非宽松相等（`==`）
- JSX属性必须换行书写
- 事件处理函数使用 `handle` 前缀（如 `handleClick`）
- 布尔变量使用 `is/has/can` 前缀（如 `isLoading`）
- 组件使用 `function` 关键字定义
- 数组命名：`userList` 或 `users`
- 常量使用全大写下划线分隔：`API_ENDPOINT`
- 严禁使用拼音与英文混合命名，杜绝不规范缩写

### Architecture Patterns
- **核心模块独立化**: `src/core/` 目录包含渲染逻辑和类型定义，不依赖UI组件，可独立作为npm包使用
- **组件驱动开发**: 使用函数组件和React Hooks管理状态
- **状态管理**: 使用Zustand进行状态管理，配合Zundo实现撤销/重做
- **样式隔离**: 使用CSS Module进行样式隔离，避免全局样式污染
- **类型安全**: 使用TypeScript确保类型安全，接口定义优先使用 `interface`
- **代码复用**: 提取公共函数，重复率不得大于10%

### Testing Strategy
- 当前项目暂未配置测试框架
- 建议后续添加单元测试和集成测试

### Git Workflow
- 使用Git进行版本控制
- 建议使用语义化提交信息（如 `feat:`, `fix:`, `refactor:` 等）

## Domain Context
- **画布编辑器**: 支持多种图形元素（文本、矩形、圆形、线条、箭头、图片、路径、画笔）
- **元素操作**: 支持拖拽添加、多选批量操作、对齐功能（左、右、上、下、水平居中、垂直居中）
- **画布功能**: 支持标尺、辅助线、缩放、平移、撤销/重做
- **数据持久化**: 画布名称、背景色、暗色主题使用localStorage持久化
- **导入导出**: 支持导出JSON（包含所有配置项）和图片（PNG/JPG）

## Important Constraints
- 核心模块（`src/core/`）不依赖UI组件，必须保持独立
- 左侧第一级菜单固定60px宽度，不可拖动调整
- 二级菜单使用grid布局，默认宽度360px，支持拖动调整（最小105px，最大360px）
- 双击添加元素时，元素中心点在画布可视区正中间，使用预设尺寸
- 拖拽添加元素时，元素中心点在释放位置（几何中心：x + width/2, y + height/2）
- 所有区域（顶部菜单栏、左侧菜单栏、中间画布区域、右侧属性栏）都支持暗黑模式

## External Dependencies
- **Leafer UI**: 图形渲染引擎，提供基础图形绘制能力
- **@leafer-in/***: Leafer相关插件（arrow、editor、export、find、resize、text-editor、view、viewport）
- **leafer-x-connector**: 连接器插件
- **leafer-x-easy-snap**: 对齐吸附插件
- **leafer-x-ruler**: 标尺插件
- **localforage**: 本地存储库（用于持久化）
- **hotkeys-js**: 快捷键处理库
- **@simonwep/pickr**: 颜色选择器
