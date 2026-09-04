# 生活站 · 升格脚本

把本地 `src/生活站.html` 推到 WorkBuddy 资料库的「在线 page」。

## 流程

### 首次升格（建表 + 升格 + 发布）

```
01  → 02 → 03 → 04 → 05
      ↑ 21 张 database 一次建好，输出 manifest.json
```

### 后续再升格（改完 HTML 后更新同一 page）

```
06（自动跑 03 + 04 + 05）
```

**关键**：04 脚本会检测 manifest.json 里的 `page_node_id`：
- 已有 → 走 **UPDATE** 模式（覆盖 HTML + 重绑 databases，不创建新 page）
- 没有 → 走 **CREATE** 模式（创建新 page）

05 在已发布过的情况下会提示，会生成**新 publish_url**（旧 URL 失效）。

## 脚本清单

| 编号 | 脚本 | 用途 | 何时跑 |
|------|------|------|--------|
| 01 | `01_get_token_credential.sh` | 提示用文档，token 必须在 IDE 对话里取 | 修通后首次 |
| 02 | `02_create_lifestation_dbs.sh` | 建 21 张 database，输出 manifest.json | 首次 |
| 03 | `03_attach_database_ids.py` | 把 HTML 里的 `__DB_xxx__` 占位换成真实 ID | 每次升格 |
| 04 | `04_import_page.sh` | 导入/更新到资料库，输出 page_node_id | 每次升格 |
| 05 | `05_publish_page.sh` | 发布拿公开 URL | 每次升格 |
| **06** | `06_redeploy.sh` | **一键再升格**（跑 03+04+05） | 改完 HTML 后 |

## 一句话用法

### 首次
1. token 修通（在 IDE 对话里说「接上 / 续上之前的工作」）
2. agent 跑 02 → 03 → 04 → 05
3. 拿到公开 URL

### 后续
1. 改本地 `src/生活站.html`
2. 跟我说「**升格**」或「**重新升格**」
3. agent 跑 06 → 给你新公开 URL

## 环境变量

```bash
export WB_SKILL_DIR=/Users/hujiayun/.workbuddy/plugins/cache/workbuddy-builtin/skill-library/0.5.9
export TOKEN_FILE=/tmp/wb_token
export HTML_FILE=/Users/hujiayun/WorkBuddy/2026-08-31-14-03-28/src/生活站.html
export READY_HTML=/Users/hujiayun/WorkBuddy/2026-08-31-14-03-28/src/生活站.ready.html
export MANIFEST=/Users/hujiayun/WorkBuddy/2026-08-31-14-03-28/scripts/manifest.json
```

## 数据迁移

1. 本地版顶栏「导出」→ JSON 备份
2. 升格完成后
3. 公开 page 里「导入」→ 上传 JSON

## 故障排查

| 现象 | 排查 |
|------|------|
| `Maximum number of redirects exceeded` | 代理 TUN 劫持，参考 `~/.workbuddy/skills/workbuddy-token-redirect-diagnosis/` |
| `AUTH_REQUIRED` | token 失效，重跑 01 取 |
| 数据库表 21 张少 1+ 张 | 02 脚本 `failed` 列表，按 stderr 排查 |
| 跑 04 报 "Page not found" | manifest 里的 page_node_id 失效，跑 02 重置（会建新 page） |
| 跑 05 拿到新 URL 但旧 URL 也通 | 旧 page 没删除，访问 404 时再清理 |

## 06 vs 04+05 手动跑

- **06_redeploy.sh**：推荐。检测 manifest，自动 UPDATE 模式，一键完成
- **04+05 分开跑**：调试时用，能看清哪一步失败
