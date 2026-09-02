# 生活站 · Life Station

> 一体化工作学习生活工作台 · 莫奈水彩主题 · 玻璃卡片 · 双栈数据

把生活、学习、工作、复盘、Personal Observatory（主题/动量/星图/漏斗/连接）放进一个工作台，双击 HTML 就能用，也能升格到资料库在线版。

![banner](docs/assets/banner-placeholder.svg)

---

## ✨ 特性

- **5 个一级群组**：生活 / 学习 / 工作 / 复盘 / Personal Observatory
- **21 张业务表**：今日任务 / 日程 / 习惯 / 健身 / 记账 / 书影音 / 项目 / 课程 / Inbox / 周复盘 / 年计划 / 学习任务 / 学习习惯 / 学习打卡 / 学习笔记 / Topic / TopicEvent / KnowledgeLink ...
- **5 张莫奈真迹**（1908/1906/1899 + 印象日出 + 睡莲池，公共领域）：群组色调由 CSS filter 派生
- **玻璃卡片 UI**：`rgba(255,255,255,0.4~0.55) + backdrop-filter: blur(20~28px)`
- **双栈数据层**：优先 WorkBuddy 资料库 SDK，缺失降级 localStorage（key 前缀 `dc_lifestation_`）
- **Personal Observatory**：Topic 深度 / 动量（21 天半衰期）/ Stage（E1-E6）/ Canvas 2D 星图 / 转化漏斗 / 知识连接
- **Data Governance**：5-tab 弹模态 + AI Recommend Lineage + True Conversion Funnel

---

## 🚀 快速开始

### 方式 A：本地打开（最简单，零依赖）

```bash
# 双击打开
open src/生活站.html
```

适用：Safari / Chrome / Firefox；移动端 Safari 可"分享 → 添加到主屏幕"当 App 用。

### 方式 B：升格到资料库在线版（多设备同步）

需要 WorkBuddy IDE + 已登录账号。

```bash
# 1. 准备环境变量
cp scripts/env.example /tmp/lifestation_env.sh
# 编辑 /tmp/lifestation_env.sh 填你的路径
source /tmp/lifestation_env.sh

# 2. 在 IDE 对话里让 agent 换 token（写到 /tmp/wb_token）
#    → 触发词：「接上 / 续上之前的工作 / 把工作台迁上资料库」

# 3. 顺序跑 02-05
bash scripts/02_create_lifestation_dbs.sh
python3 scripts/03_attach_database_ids.py \
  --manifest "$MANIFEST" \
  --html "$HTML_FILE" \
  --out "$READY_HTML"
bash scripts/04_import_page.sh
bash scripts/05_publish_page.sh
```

输出示例：

```
🎉 工作台已上线！公开 URL：
https://workbuddy.link/p/<page_node_id>
```

---

## 📁 仓库结构

```
lifestation/
├── README.md                       # 你正在看
├── LICENSE                         # MIT
├── .gitignore                      # 隐私保护
├── docs/                           # 文档
│   ├── 用户使用说明.md             # 功能说明（按群组）
│   ├── 本地兜底版使用说明.md       # localStorage 双栈说明
│   ├── 架构设计.md                 # 5 群组 / O1-O10 / Stage / Observatory
│   └── 续用流程.md                 # 升格到资料库详细步骤
├── src/
│   └── 生活站.html                 # 8.3MB 主文件（含 base64 莫奈图）
└── scripts/                        # 升格脚本
    ├── 01_get_token_credential.sh
    ├── 02_create_lifestation_dbs.sh
    ├── 03_attach_database_ids.py
    ├── 04_import_page.sh
    ├── 05_publish_page.sh
    └── env.example
```

> ⚠️ `src/生活站.ready.html` 和 `scripts/manifest.json` 在 `.gitignore` 里——它们含敏感 ID，升格产物不提交。

---

## 🎨 设计哲学

- **水彩底色，莫奈为魂**：4 张群组主色由 1908 睡莲 / 1906 睡莲 / 1899 水莲池 / 1872 印象日出的真实色调 + CSS filter 派生
- **玻璃卡片**：`backdrop-filter: blur(20~28px)`，让背景画作透过来
- **深紫标题**：致敬莫奈晚期睡莲系列的紫调，夜晚氛围
- **零外部依赖**：单文件 HTML，离线可用

---

## 🔬 核心机制

### 数据双栈

```js
// 优先 SDK，降级 localStorage
const ds = window.__SMART_PAGE__?.database ?? {
  list: (key) => JSON.parse(localStorage.getItem(`dc_lifestation_${key}`) || '[]'),
  insert: (key, row) => { /* ... */ },
  // ...
};
```

### Stage 系统（Observatory）

| Stage | 含义 | Weight |
|-------|------|--------|
| E1 Explore | 浏览、收集 | 1 |
| E2 Learn | 入门理解 | 2 |
| E3 Synthesize | 综合 | 4 |
| E4 Apply | 应用 | 6 |
| E5 Output | 产出 | 9 |
| E6 Reuse | 复用 | 8 |

### 动量计算（half-life 21 天）

```js
topicMomentum = Σ(event.weight × 0.5^(daysSince/21))
```

---

## 🛠️ 修改与迭代

| 你要做什么 | 怎么做 |
|-----------|--------|
| 改 UI / 文案 / 样式 | 直接编辑 `src/生活站.html` → 重跑 03-05 升格 |
| 改业务数据 | 线上版直接编辑 records（21 张表都在资料库） |
| 导出/迁移数据 | 顶栏「导出」按钮 → JSON 备份 |
| 加新功能 | 提 Issue 或直接 PR |

详细见 `docs/续用流程.md`。

---

## 📜 License

MIT（莫奈作品在公共领域，无版权问题）

---

## 🙏 致谢

- **莫奈**（1840-1926）：四幅水彩底图
- **WorkBuddy**：本地 IDE + 资料库能力
- **本仓库作者**：Francesca Hu
