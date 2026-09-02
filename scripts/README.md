# 工作台搭建师 - 方案 B 兜底续用脚本

> 当资料库 `connect_open_platform` 鉴权恢复正常后，按下面五步把本地版的 `生活站.html` 升格为「资料库在线 page」并把 9 张表全部建好、数据绑清。

## 流程一览

```
01_get_token_credential.sh       取 token 写到 /tmp/wb_token（必须在 IDE 对话里跑）
        ↓
02_create_lifestation_dbs.sh     client 模式调 create_database.py × 9，输出 manifest.json
        ↓
03_attach_database_ids.py        把生活站.html 里 __DB_xxx__ 占位换成 manifest 真实 ID → 生活站.ready.html
        ↓
04_import_page.sh                client 模式调 import_html.py --databases → 拿到 page nodeId
        ↓
05_publish_page.sh               client 模式调 publish_page.py → 拿到公开 URL
```

每一步都是独立可执行；如果失败，从失败步骤重跑即可，无需从头再来。

## 环境变量

复制 `env.example` 到 `/tmp/lifestation_env.sh` 并按需修改，然后 `source` 后再跑各步骤：

```bash
export WB_SKILL_DIR=/Users/hujiayun/.workbuddy/plugins/cache/workbuddy-builtin/skill-library/0.5.9
export TOKEN_FILE=/tmp/wb_token
export HTML_FILE=/Users/hujiayun/WorkBuddy/2026-08-31-14-03-28/生活站.html
export READY_HTML=/Users/hujiayun/WorkBuddy/2026-08-31-14-03-28/生活站.ready.html
export MANIFEST=/Users/hujiayun/WorkBuddy/2026-08-31-14-03-28/.workbuddy/scripts/manifest.json
```

## 等价方式：直接告诉我"接上"

如果你只是想尽快让工作台上线（不一定要自己跑脚本），告诉 **agent** "接上" / "续上之前的工作" / "运行续用脚本"。agent 会自己按顺序跑完 02 → 05，并把最终发布链接交付给你。

## 数据迁移（本地版 → 资料库）

当本地版数据要迁到资料库：

1. 在本地版顶栏点「导出」，把得到的 JSON 备份保存
2. token 修通跑完续用脚本后
3. 在最终 page 里点「导入」(顶栏)，上传刚才的 JSON —— 因为 `db_today_tasks` 等字段名与本地 schema 对齐，数据可直接写入

## 字段差异约束

- 资料库 database 是 schema 强制的：字段名以中文为准，与本地 schema 同名同顺序
- select 选项初始值由建表 schema 决定；如果本地版新增了未在 schema 里的分类，请在 02_create_lifestation_dbs.sh 的 SCHEMAS 里同步加上

## 出错时如何排查

| 现象 | 排查 |
|---|---|
| `Maximum number of redirects exceeded` | OAuth 链接断开，回到 01_get_token_credential.sh 重试 |
| `AUTH_REQUIRED` | 本步缺 token；重跑 01 / 检查 `cat $TOKEN_FILE` |
| 数据库表 9 张少 1+ 张 | `02_create_lifestation_dbs.sh` 内 `failed` 列表指明哪张失败；按 stderr 排查 |
| `lint_database_sdk_usage.py` 报错 | 当前 HTML 是方案 B 兜底版（无 SDK 调用），不需要跑 lint；上线后访问页面 SDK 自动接管 |
| 用户报告点不动 / 显示错误 | 在 IDE 里打开 life-station.ready.html 看 console；或回到 agent 让他重写 |
