#!/usr/bin/env bash
# =============================================================================
# 01_get_token_credential.sh
# -----------------------------------------------------------------------------
# 这一步不能纯 shell 自动化：资料库 token 通过 deferred MCP 工具
# (connect_open_platform) 签发，不在 shell 生态里。需要回 IDE 会话里让 agent
# 用 Skill tool + DeferExecuteTool 序列把 token 喂到 /tmp/wb_token。
#
# 修通 token 后的两条路径：
#   A) 告诉 agent "接上" / "续上之前的工作" / "运行续用脚本" —— agent 自动跑完 02-05
#   B) 自己跑：在 IDE 对话里让他先写 token 到 /tmp/wb_token，然后按顺序执行 02-05
#
# 如果 connect_open_platform 仍报 Maximum number of redirects exceeded：
#   - 检查 IDE 是否登录 WorkBuddy 账号（账号头像）
#   - 在 IDE 连接器设置里重新 trust "library" MCP
#   - 清浏览器 cookie 后重登一次
#   - 换网络（手机热点）重试一次
# =============================================================================

set -euo pipefail

cat <<'TXT'

  ┌──────────────────────────────────────────────────────────────────┐
  │  01: 在 IDE 对话里执行一次取 token 动作                           │
  └──────────────────────────────────────────────────────────────────┘

  简单做法（推荐）：

    > 回到当前 IDE 对话，对我（agent）说：

      "接上 / 续上之前的工作 / 把工作台迁上资料库"

    > 我会自动：
      1. 用 Skill tool 重新探测 connect_open_platform 是否可用
      2. 如可用，调用拿到 token，写到 /tmp/wb_token
      3. 顺序执行 02_create_lifestation_dbs.sh → 04 → 05
      4. 把公开 URL 交付给你

  若 token 拿不到：按最上方"如果 connect_open_platform 仍报..."排查。

TXT
