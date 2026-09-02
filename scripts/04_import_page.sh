#!/usr/bin/env bash
# =============================================================================
# 04_import_page.sh
# -----------------------------------------------------------------------------
# 读 manifest.json，调 import_html.py 上传"生活站.ready.html"到资料库 page 节点，
# 同时绑定 9 张 database；输出 PAGE_NODE_ID 到 manifest.json 的 page_node_id 字段。
#
# 使用：
#   bash 04_import_page.sh
# =============================================================================

set -euo pipefail

WB_SKILL_DIR="${WB_SKILL_DIR:-/Users/hujiayun/.workbuddy/plugins/cache/workbuddy-builtin/skill-library/0.5.9}"
TOKEN_FILE="${TOKEN_FILE:-/tmp/wb_token}"
MANIFEST="${MANIFEST:-$(dirname "$0")/manifest.json}"
HTML_FILE="${HTML_FILE:-/Users/hujiayun/WorkBuddy/2026-08-31-14-03-28/生活站.ready.html}"

if [ ! -s "$TOKEN_FILE" ]; then
  echo "ERROR: token file '$TOKEN_FILE' empty or missing." >&2
  exit 1
fi
if [ ! -s "$HTML_FILE" ]; then
  echo "ERROR: $HTML_FILE not found. Run 03_attach_database_ids.py first." >&2
  exit 1
fi
if [ ! -s "$MANIFEST" ]; then
  echo "ERROR: $MANIFEST not found. Run 02_create_lifestation_dbs.sh first." >&2
  exit 1
fi

TOKEN="$(cat "$TOKEN_FILE")"

python3 - "$WB_SKILL_DIR" "$MANIFEST" "$HTML_FILE" "$TOKEN" <<'PYEOF'
import json, subprocess, sys

skill_dir, manifest_path, html_path, token = sys.argv[1:5]
manifest = json.loads(open(manifest_path, encoding='utf-8').read())

databases = [{"id": t["database_id"]} for t in manifest["tables"]]
databases_json = json.dumps(databases, ensure_ascii=False)

proc = subprocess.run(
    ["python3", f"{skill_dir}/page/import_html.py",
     html_path,
     "--file-name", "生活站.html",
     "--databases", databases_json,
     "--token-stdin"],
    input=token, text=True, capture_output=True
)

out = proc.stdout.strip()
if proc.returncode != 0 or not out or "KS_IMPORT_OK" not in out:
    print(f"FAIL: import_html.py returncode={proc.returncode}", file=sys.stderr)
    print(f"STDOUT: {out[:600]}", file=sys.stderr)
    print(f"STDERR: {proc.stderr[:600]}", file=sys.stderr)
    sys.exit(2)

ks_line = next(l for l in out.splitlines() if l.startswith("KS_IMPORT_OK"))
import json as _json
import_obj = _json.loads(ks_line[len("KS_IMPORT_OK"):].strip())

manifest["page_node_id"]  = import_obj.get("node_block_id")
manifest["page_url"]      = import_obj.get("url")
manifest["publish_url"]   = import_obj.get("publish_url", "")  # 可能为空，未发布

with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print(f"OK   page_node_id:  {manifest['page_node_id']}")
print(f"     url:          {manifest.get('page_url', 'N/A')}")
print(f"     publish_url:  {manifest.get('publish_url', '未发布，跑 05 发布')}")
PYEOF
