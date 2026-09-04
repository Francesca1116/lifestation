#!/usr/bin/env bash
# =============================================================================
# 06_redeploy.sh · 一键再升格
# -----------------------------------------------------------------------------
# 仅在已建过 21 张表（manifest.json 存在）时使用。
# 自动跑 03 → 04 → 05，把本地改完的 src/生活站.html 推到同一个 page_node_id，
# 拿到新的 publish_url。
#
# 使用：
#   bash 06_redeploy.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOKEN_FILE="${TOKEN_FILE:-/tmp/wb_token}"

# 加载环境变量（如果存在）
if [ -f /tmp/lifestation_env.sh ]; then
  source /tmp/lifestation_env.sh
fi

WB_SKILL_DIR="${WB_SKILL_DIR:-/Users/hujiayun/.workbuddy/plugins/cache/workbuddy-builtin/skill-library/0.5.9}"
HTML_FILE="${HTML_FILE:-$SCRIPT_DIR/../src/生活站.html}"
READY_HTML="${READY_HTML:-$SCRIPT_DIR/../src/生活站.ready.html}"
MANIFEST="${MANIFEST:-$SCRIPT_DIR/manifest.json}"

# 前置检查
echo "=================================================="
echo "  06_redeploy · 一键再升格"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================="
echo

if [ ! -s "$TOKEN_FILE" ]; then
  echo "ERROR: token 文件 '$TOKEN_FILE' 不存在或为空" >&2
  echo "       请在 IDE 对话里让 agent 重新换票：触发词 '升格'" >&2
  exit 1
fi
if [ ! -s "$HTML_FILE" ]; then
  echo "ERROR: HTML 源文件 '$HTML_FILE' 不存在" >&2
  exit 1
fi
if [ ! -s "$MANIFEST" ]; then
  echo "ERROR: manifest '$MANIFEST' 不存在" >&2
  echo "       首次升格请跑 02 → 03 → 04 → 05，不要用本脚本" >&2
  exit 1
fi

# 检查 manifest 是否有 page_node_id（决定是 UPDATE 还是 CREATE）
PAGE_ID=$(python3 -c "import json; print(json.load(open('$MANIFEST', encoding='utf-8')).get('page_node_id', ''))")
if [ -n "$PAGE_ID" ]; then
  echo "[1/3] 模式: UPDATE  (page_node_id = $PAGE_ID)"
else
  echo "[1/3] 模式: CREATE  (manifest 无 page_node_id，将创建新 page)"
fi
echo

# Step 1: 替换占位符
echo "[2/3] 替换占位符（03_attach_database_ids.py）"
python3 "$SCRIPT_DIR/03_attach_database_ids.py" \
  --manifest "$MANIFEST" \
  --html "$HTML_FILE" \
  --out "$READY_HTML"
echo

# Step 2: 导入 / 更新
echo "[3/3] 导入/更新到资料库 + 发布（04 + 05）"
echo "----------------------------------------"
bash "$SCRIPT_DIR/04_import_page.sh"
echo
bash "$SCRIPT_DIR/05_publish_page.sh"

echo
echo "=================================================="
echo "  ✅ 升格完成"
echo "  公开 URL: $(python3 -c "import json; print(json.load(open('$MANIFEST', encoding='utf-8')).get('publish_url', '未发布'))")"
echo "=================================================="
