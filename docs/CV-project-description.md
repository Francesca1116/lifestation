# LifeStation · CV 项目描述

> 两套可直接粘贴的项目描述：**申研版**（偏设计思维与问题定义）与**求职版**（偏工程与可量化成果）。
> 每套含「一段式描述」与「bullet 版」两种格式，中英对照。所有数字均可在仓库中验证。

---

## ① 申研版 · For Graduate Applications

侧重：问题定义能力、产品思维、把模糊需求变成可运行系统的执行力。

### 段落版（English）

> **LifeStation — Personal Growth Workspace** *(Solo project, 2026)*
> Built a single-file web workspace that turns daily execution — tasks, habit check-ins, courses, projects — into a lifelong growth database. Designed a six-stage evidence model (Explore → Learn → Synthesize → Apply → Output → Reuse) with an explainable contribution formula, so progress is measured by applied knowledge and concrete output rather than task counts. Shipped it as a zero-dependency app used daily, supported by 13 automated test suites (400+ assertions) that caught real defects including a daylight-saving-time timing bug and a data-type regression.

### 段落版（中文对照）

> **LifeStation · 生活站 — 个人成长工作台**（独立项目，2026）
> 从自己的真实需求出发：待办工具只能记录「做完了」，回答不了「我在成长吗」。独立设计并实现了一个单文件 Web 工作台，把任务、习惯打卡、课程、项目等日常执行持续沉淀为个人成长数据库；设计了六阶段证据模型（探索→学习→综合→应用→产出→复用）与可解释的贡献公式，让进步以「被应用的知识」和「看得见的产出」来度量，而非任务数量。以零依赖单文件形态日常使用，配套 13 套自动化测试（400+ 断言），曾捕获夏令时时序 bug 与数据类型回归等真实缺陷。

### Bullet 版（English）

- Designed and built **LifeStation**, a single-file personal workspace (21 data tables across life / learning / work / review) that converts daily execution into a contribution-weighted growth database
- Invented a **six-stage evidence model** (Explore → … → Reuse) with an explainable scoring formula; defined anti-pollution rules so machine-generated topics require human confirmation
- Dogfooded daily; hardening it with **13 test suites / 400+ assertions** (Node `vm` + jsdom) that surfaced real bugs — a DST heatmap timing defect and a seed-data type regression

---

## ② 求职版 · For Job Applications

侧重：技术栈、工程实践、可量化指标、测试驱动的真实证据。

### 段落版（English）

> **LifeStation — Single-file productivity & growth analytics app** *(Vanilla JavaScript, 2026)*
> Designed and built a zero-dependency personal workspace (~1.2 MB, one HTML file, no build step) covering 21 data tables: todos, calendar, habit heatmaps, multi-currency finance, fitness analytics, projects, and course notes. Implemented a topic-based growth engine — every finished record maps to topics via a weighted contribution model with six evidence stages — plus dashboard analytics (domain investment trends, knowledge-conversion funnel, output evidence). Enforced quality with 13 regression suites / 400+ assertions that extract app logic from the HTML into Node `vm` + jsdom sandboxes; the harness caught real defects, including a DST date-arithmetic bug and a seed-data type regression that silently broke dashboard rendering.

### 段落版（中文对照）

> **LifeStation · 生活站 — 单文件效率与成长分析应用**（原生 JavaScript，2026）
> 独立设计并实现零依赖个人工作台（约 1.2 MB 单 HTML 文件、无构建步骤），覆盖 21 张数据表：待办、日程、习惯热力图、多币种记账、健身分析、项目、课程笔记。实现主题成长引擎——每条已完成记录经加权贡献模型（六个证据阶段）映射到主题——并提供看板分析（领域投入趋势、知识转化漏斗、成果证据）。以 13 套回归测试 / 400+ 断言保障质量：测试从 HTML 中抽取应用逻辑，在 Node `vm` + jsdom 沙箱中回归；曾捕获夏令时日期运算 bug、以及会静默破坏看板渲染的种子数据类型回归。

### Bullet 版（English）

- Built a **zero-dependency single-file app** (~1.2 MB, vanilla JS, no build step): 21 data tables, responsive down to mobile, offline-capable, with an optional cloud-sync storage layer behind a localStorage-first interface
- Engineered a **topic growth engine**: weighted contribution model (record-type × role × six-stage evidence), structured record linking with automatic topic inheritance, and idempotent data migrations guarded by flags
- Practiced **test-driven maintenance on a single-file codebase**: 13 suites / 400+ assertions extract logic from the HTML into Node `vm` + jsdom sandboxes; caught a DST timing bug, a data-type regression that silently blanked dashboard boards, and migration edge cases

---

## ③ 技术关键词 · Skills 栏可用

```
Vanilla JavaScript (ES5, IIFE architecture) · Single-file architecture · Zero-dependency / no-build
localStorage-first design with pluggable cloud sync · Responsive UI (mobile Safari)
Node vm sandbox testing · jsdom integration testing · Regression test design (13 suites, 400+ assertions)
Data modeling (21 tables) · Idempotent data migration · Explainable scoring/metrics design
```

## ④ 可量化亮点 · Quantified Highlights（面试可展开）

| 数字 | 事实 | 出处 |
|---|---|---|
| **1 个文件** | 整个应用约 1.2 MB 单 HTML，无构建、无框架、离线可用 | `src/生活站.html` |
| **21 张数据表** | 生活/学习/工作/复盘四群组，含习惯热力图、多币种记账、健身均线 | `docs/架构设计.md` |
| **6 阶段证据模型** | E1 Explore → E6 Reuse，贡献分 = 类型权重 × 角色权重 × 阶段权重 | `docs/架构设计.md` §4 |
| **13 套测试 / 400+ 断言** | 从 HTML 抽取逻辑在 Node `vm` + jsdom 中回归，全部可通过 | `scripts/v2*_test.js` |
| **真实缺陷捕获** | 夏令时切换日热力图时序漂移；seed 日期类型（Date 对象）静默打空三看板 | git history / 测试注释 |
| **可解释指标** | 知识转化漏斗只统计真实转化（学到→应用→产出），拒绝虚荣指标 | 主页 Knowledge Conversion 看板 |

## ⑤ 使用建议

- **投学术/研究岗**：用申研版，面试话题引向「如何度量学习与成长」这一设计问题
- **投工程岗**：用求职版，面试话题引向「单文件架构如何做测试」——这是这个项目最有区分度的工程故事
- **一句话版**（放项目列表一行时用）：
  - EN: *LifeStation — a zero-dependency single-file workspace that turns daily execution into a measurable growth database (vanilla JS, 21 tables, 13 test suites / 400+ assertions).*
  - 中：*生活站 — 零依赖单文件个人成长工作台：把日常执行沉淀为可度量的成长数据库（原生 JS · 21 张表 · 13 套测试 400+ 断言）。*
