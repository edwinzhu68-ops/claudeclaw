<p align="center">
  <img src="images/claudeclaw-banner.svg" alt="ClaudeClaw Banner" />
</p>
<p align="center">
  <img src="images/claudeclaw-wordmark.png" alt="ClaudeClaw Wordmark" />
</p>

<p align="center">
  <a href="https://github.com/edwinzhu68-ops/claudeclaw/stargazers">
    <img src="https://img.shields.io/github/stars/edwinzhu68-ops/claudeclaw?style=flat-square&color=f59e0b" alt="GitHub Stars" />
  </a>
  <a href="https://github.com/edwinzhu68-ops/claudeclaw/commits/master">
    <img src="https://img.shields.io/github/last-commit/edwinzhu68-ops/claudeclaw?style=flat-square&color=0ea5e9" alt="Last Commit" />
  </a>
</p>

<p align="center"><b>ClaudeClaw 增强版 — 自主学习、持久记忆、纠错进化的 Claude Code 插件</b></p>

基于 [ClaudeClaw by moazbuilds](https://github.com/moazbuilds/claudeclaw) 二次开发，新增 **13 个核心功能**，让 Claude Code 变成一个能自我进化、记住一切、从错误中学习的个人 AI 助手。

> 原始项目: https://github.com/moazbuilds/claudeclaw | 原作者: [@moazbuilds](https://github.com/moazbuilds)

---

## 新增功能一览

### 自主学习与进化

| 功能 | 说明 |
|------|------|
| **纠错学习系统** | 检测用户纠正（"不对"/"错了"/"改成"）→ 保存为教训 → 下次避免重犯。置信度 1-5 递增，4+ 变铁律 |
| **模式学习** | 追踪使用模式，关键词对出现 3+ 次自动生成可复用技能 |
| **自动记忆提取** | 对话后自动识别偏好、决策、事实、技术选择并存储 |
| **智能记忆裁剪** | 按相关性评分注入 top-10 记忆，30 天自动过期，不浪费 context |

### 持久记忆

| 功能 | 说明 |
|------|------|
| **文件记忆库** | `memory/*.md` 持久存储 + 关键词搜索 + `[remember:]` 指令 |
| **工具发现** | 自动扫描已安装插件和 MCP 服务器，注入系统提示让 Claude 知道可用工具 |

### 安全与通信

| 功能 | 说明 |
|------|------|
| **DM 配对安全** | 陌生人发 Telegram 消息 → 6 位配对码 → CLI 验证 → 自动加白名单（10 分钟过期）|
| **消息状态 emoji** | Telegram 收到消息 👀 → 完成 ✅ / 出错 ❌ |
| **Cron 失败告警** | 定时任务连续 3 次失败通过 Telegram 通知 |
| **Webhook 触发器** | `POST /api/webhook/:name` 外部触发 Claude 执行，支持密钥验证和 `{{body}}` 模板 |

### Web 界面

| 功能 | 说明 |
|------|------|
| **全中文 UI** | Web 面板所有文字翻译为中文 |
| **多对话聊天记录** | 侧边栏历史对话列表 + 服务端持久化 + localStorage 自动迁移 |
| **分析面板** | 新增「分析」标签页：7 天活跃图、来源分布、记忆/日志统计 |

### API 端点总览

```
# 记忆
GET    /api/memory                  # 列出所有记忆
GET    /api/memory/search?q=关键词   # 搜索记忆
POST   /api/memory/:key             # 保存记忆
DELETE /api/memory/:key             # 删除记忆

# 教训（纠错学习）
GET    /api/lessons                 # 列出所有教训
POST   /api/lessons                 # 手动添加教训
POST   /api/lessons/:id/reinforce  # 增强置信度
DELETE /api/lessons/:id             # 删除教训
GET    /api/lessons/stats           # 学习统计

# 对话
GET    /api/conversations           # 列出所有对话
POST   /api/conversations           # 创建新对话
GET    /api/conversations/:id       # 获取对话详情
DELETE /api/conversations/:id       # 删除对话

# Webhook
GET    /api/webhooks                # 列出 webhook
POST   /api/webhooks                # 创建 webhook
DELETE /api/webhooks/:name          # 删除 webhook
POST   /api/webhook/:name          # 触发 webhook

# 分析与模式
GET    /api/analytics               # 使用分析数据
GET    /api/patterns                # 检测的模式
GET    /api/patterns/stats          # 使用统计
GET    /api/patterns/skills         # 已学习的技能
POST   /api/patterns/generate       # 从模式生成技能

# 其他
GET    /api/tools                   # 已发现的工具/插件
GET    /api/job-health              # 任务健康状态
GET    /api/pairing/pending         # 待配对列表
POST   /api/pairing/verify          # 验证配对码
```

---

## 原始功能

> 以下为 ClaudeClaw 原有功能，详见 [原始项目](https://github.com/moazbuilds/claudeclaw)

> Note: Please don't use ClaudeClaw for hacking any bank system or doing any illegal activities. Thank you.

## Why ClaudeClaw?

| Category | ClaudeClaw | OpenClaw |
| --- | --- | --- |
| Anthropic Will Come After You | No | Yes |
| API Overhead | Directly uses your Claude Code subscription | Nightmare |
| Setup & Installation | ~5 minutes | Nightmare |
| Deployment | Install Claude Code on any device or VPS and run | Nightmare |
| Isolation Model | Folder-based and isolated as needed | Global by default (security nightmare) |
| Reliability | Simple reliable system for agents | Bugs nightmare |
| Feature Scope | Lightweight features you actually use | 600k+ LOC nightmare |
| Security | Average Claude Code usage | Nightmare |
| Cost Efficiency | Efficient usage | Nightmare |
| Memory | Uses Claude internal memory system + `CLAUDE.md` | Nightmare |

## Getting Started in 5 Minutes

```bash
claude plugin marketplace add moazbuilds/claudeclaw
claude plugin install claudeclaw
```
Then open a Claude Code session and run:
```
/claudeclaw:start
```
The setup wizard walks you through model, heartbeat, Telegram, Discord, and security, then your daemon is live with a web dashboard.

## What Would Be Built Next?

> **Mega Post:** Help shape the next ClaudeClaw features.
> Vote, suggest ideas, and discuss priorities in **[this post](https://github.com/moazbuilds/claudeclaw/issues/14)**.

<p align="center">
  <a href="https://github.com/moazbuilds/claudeclaw/issues/14">
    <img src="https://img.shields.io/badge/Roadmap-Mega%20Post-blue?style=for-the-badge&logo=github" alt="Roadmap Mega Post" />
  </a>
</p>

## Features

### Automation
- **Heartbeat:** Periodic check-ins with configurable intervals, quiet hours, and editable prompts.
- **Cron Jobs:** Timezone-aware schedules for repeating or one-time tasks with reliable execution.

### Communication
- **Telegram:** Text, image, and voice support.
- **Discord:** DMs, server mentions/replies, slash commands, voice messages, and image attachments.
- **Time Awareness:** Message time prefixes help the agent understand delays and daily patterns.

### Reliability and Control
- **GLM Fallback:** Automatically continue with GLM models if your primary limit is reached.
- **Web Dashboard:** Manage jobs, monitor runs, and inspect logs in real time.
- **Security Levels:** Four access levels from read-only to full system access.
- **Model Selection:** Switch models based on your workload.

## FAQ

<details open>
  <summary><strong>Can ClaudeClaw do &lt;something&gt;?</strong></summary>
  <p>
    If Claude Code can do it, ClaudeClaw can do it too. ClaudeClaw adds cron jobs,
    heartbeats, and Telegram/Discord bridges on top. You can also give your ClaudeClaw new
    skills and teach it custom workflows.
  </p>
</details>

<details open>
  <summary><strong>Is this project breaking Anthropic ToS?</strong></summary>
  <p>
    No. ClaudeClaw is local usage inside the Claude Code ecosystem. It wraps Claude Code
    directly and does not require third-party OAuth outside that flow.
    If you build your own scripts to do the same thing, it would be the same.
  </p>
</details>

<details open>
  <summary><strong>Will Anthropic sue you for building ClaudeClaw?</strong></summary>
  <p>
    I hope not.
  </p>
</details>

<details open>
  <summary><strong>Are you ready to change this project name?</strong></summary>
  <p>
    If it bothers Anthropic, I might rename it to OpenClawd. Not sure yet.
  </p>
</details>

## Screenshots

### Claude Code Folder-Based Status Bar
![Claude Code folder-based status bar](images/bar.png)

### Cool UI to Manage and Check Your ClaudeClaw
![Cool UI to manage and check your ClaudeClaw](images/dashboard.png)

## Contributors

Thanks for helping make ClaudeClaw better.

<a href="https://github.com/moazbuilds/claudeclaw/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=moazbuilds/claudeclaw" />
</a>
