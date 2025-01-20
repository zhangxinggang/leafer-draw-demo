---
name: pnpm-monorepo-bootstrap
description: 创建新项目，或者使用脚手架搭建项目，或者改造当前项目为pnpm，或者使用Monorepo管理项目。
---

# pnpm Monorepo 脚手架

## 目标

在空目录或新仓库根，或者需要修改的项目目录生成 **pnpm workspace**，包含 `apps/`、`packages/`、根级 TS/ESLint/Prettier、Husky + lint-staged、`.vscode`。不绑定具体 UI 框架；若用户指定 React/Vue 等，再在 `apps/*` 内追加对应脚手架。

## 前置条件

- 已安装 Node（建议 LTS）与 **pnpm**（`corepack enable` 后 `corepack prepare pnpm@latest --activate`）。
- 若使用 Husky：**先 `git init`**，否则 `prepare` / hook 行为不完整。

## 目录结构（必须）

```text
.
├── apps/                 # 应用（子包放于此，如 apps/web）
├── packages/             # 共享库、配置包等
├── .husky/
├── .vscode/
├── eslint.config.js
├── prettier.config.js
├── .lintstagedrc.yaml
├── commitlint.config.js
├── package.json          # private: true，workspace 根
├── pnpm-workspace.yaml
└── tsconfig.json         # 根 base，子包 extends
```

## 执行步骤（按顺序）

1. **初始化 git**（若尚未）：`git init`。
2. **写入 `pnpm-workspace.yaml`**：

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

3. **根 `package.json`**：参考文件 assets/package.json。

4. **TypeScript**：根 `tsconfig.json` 作为 base（`compilerOptions` 含 `strict`、`moduleResolution: "bundler"` 或 `"node16"` 按子应用需要统一）；`apps/*`、`packages/*` 各自 `tsconfig.json` 使用 `"extends": "../../tsconfig.json"` 并设置 `rootDir`/`outDir`/`composite` 视包类型而定。
5. **安装开发依赖**（版本用当前生态稳定版，与用户对齐时可查 npm）：参考文件 assets/package.json。

6. **`eslint.config.js`**：参考文件 assets/eslint.config.js。

7. **`prettier.config.js`**：参考文件 assets/prettier.config.js。

8. **`.lintstagedrc.yaml`**：参考文件 assets/.lintstagedrc.yaml。

9. **Husky + lint-staged**：参考夹 assets/.husky。

10. **`.vscode/extensions.json`**：参考文件 assets/.vscode/extensions.json。

11. **`.vscode/settings.json`**：参考文件 assets/.vscode/settings.json。

12. **占位**：在 `apps/`、`packages/` 下按需添加 `.gitkeep` 或一个最小 `packages/tsconfig` 共享配置包，避免空目录未跟踪；**不要**未经用户要求生成完整业务应用。

13. **验证**：`pnpm install`、`pnpm lint`、`pnpm format`（若已配置）；提交一次以确认 pre-commit 运行 lint-staged。

## 与用户偏好对齐时的调整

- **React/Vue**：仅在 `apps/<name>` 内加对应 ESLint 插件与 Vite/框架 CLI，根配置保持通用。
- **CommonJS 根项目**：若不能使用 `"type": "module"`，改用 `eslint.config.mjs` 或 `prettier.config.cjs`，并在技能执行时说明与 `eslint.config.js` 的取舍。

## 自检清单

- [ ] `pnpm-workspace.yaml` 包含 `apps/*`、`packages/*`
- [ ] 根 `package.json` 含 `prepare` 与 `packageManager`
- [ ] `eslint.config.js` + `prettier.config.js` + `.lintstagedrc` 存在且可运行
- [ ] `.husky/pre-commit` 调用 `lint-staged`
- [ ] `.vscode` 已配置 flat ESLint 与默认格式化
