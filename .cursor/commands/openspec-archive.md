---
name: /openspec-archive
id: openspec-archive
category: OpenSpec
description: 归档已部署的 OpenSpec 变更并更新规范。
---

<!-- OPENSPEC:START -->

**约束原则**

- 优先采用简单、最小化的实现，仅在明确要求或明显需要时才添加复杂性。
- 将变更范围严格限制在请求的结果内。
- 如需额外的 OpenSpec 约定或说明，请参考 `openspec/AGENTS.md`（位于 `openspec/` 目录内——如果看不到，请运行 `ls openspec` 或 `openspec update`）。

**步骤**

1. 确定要归档的变更 ID：
   - 如果此提示已包含特定的变更 ID（例如在由斜杠命令参数填充的 `<ChangeId>` 块中），请在去除空白后使用该值。
   - 如果对话中模糊地引用了某个变更（例如通过标题或摘要），运行 `openspec list` 以显示可能的 ID，分享相关候选项，并确认用户意图使用哪一个。
   - 否则，查看对话内容，运行 `openspec list`，并询问用户要归档哪个变更；在继续之前等待确认的变更 ID。
   - 如果仍然无法确定单个变更 ID，请停止并告知用户目前无法归档任何内容。
2. 通过运行 `openspec list`（或 `openspec show <id>`）验证变更 ID，如果变更缺失、已归档或尚未准备好归档，请停止。
3. 运行 `openspec archive <id> --yes`，以便 CLI 移动变更并应用规范更新，无需提示（仅在仅工具类工作时使用 `--skip-specs`）。
4. 查看命令输出以确认目标规范已更新，且变更已放置在 `changes/archive/` 中。
5. 使用 `openspec validate --strict` 进行验证，如果发现任何问题，使用 `openspec show <id>` 进行检查。

**参考**

- 在归档前使用 `openspec list` 确认变更 ID。
- 使用 `openspec list --specs` 检查刷新后的规范，并在移交前解决任何验证问题。
<!-- OPENSPEC:END -->
