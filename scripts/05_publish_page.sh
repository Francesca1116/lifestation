#!/usr/bin/env bash
# =============================================================================
# 05_publish_page.sh
# -----------------------------------------------------------------------------
# 读 manifest.json 里的 page_node_id，调 publish_page.py 把 page 发成公开 URL，
# 写回 manifest.json 的 publish_url 字段。
# =============================================================================

set -euo pipefail

WB_SKILL_DIR="${WB_SKILL_DIR:-/Users/hujiayun/.workbuddy/plugins/cache/workbuddy-builtin/skill-library/0.5.9}"
TOKEN_FILE="${TOKEN_FILE:-/tmp/wb_token}"
MANIFEST="${MANIFEST:-$(dirname "$0")/manifest.json}"

if [ ! -s "$TOKEN_FILE" ]; then echo "ERROR: token file '$TOKEN_FILE' empty or missing." >&2; exit 1; fi
if [ ! -s "$MANIFEST" ]; then echo "ERROR: manifest $MANIFEST not found. Run 04 first." >&2; exit 1; fi

python3 - <<PYEOF
import json, subprocess, sys

manifest_path = "${MANIFEST}"
skill_dir = "${WB_SKILL_DIR}"
token = open("${TOKEN_FILE}", encoding='utf-8').read().strip()

manifest = json.loads(open(manifest_path, encoding='utf-8').read())
page_id = manifest.get("page_node_id")
if not page_id:
    print("ERROR: manifest 缺少 page_node_id，请先跑 04_import_page.sh", file=sys.stderr)
    sys.exit(2)

# 已发布过：提示但仍继续（重发一般返回新 URL，旧的会失效）
existing_publish = manifest.get("publish_url", "")
if existing_publish:
    print(f"  [note] 之前已发布到：{existing_publish}")
    print(f"  [note] 重新发布会生成新 URL，旧的将失效")
    print()

proc = subprocess.run(
    ["python3", f"{skill_dir}/page/publish_page.py",
     "--token-stdin", "--node-id", page_id],
    input=token, text=True, capture_output=True
)

out = proc.stdout.strip()
if proc.returncode != 0 or not out or "KS_PAGE_PUBLISH" not in out:
    print(f"FAIL: publish_page.py returncode={proc.returncode}", file=sys.stderr)
    print(f"STDOUT: {out[:600]}", file=sys.stderr)
    print(f"STDERR: {proc.stderr[:600]}", file=sys.stderr)
    sys.exit(2)

ks_line = next(l for l in out.splitlines() if l.startswith("KS_PAGE_PUBLISH"))
publish_url = ks_line[len("KS_PAGE_PUBLISH"):].strip().lstrip("\t ")
if not publish_url.startswith("http"):
    # 兜底：可能 stdout 里直接输出 url 不带 tab
    publish_url = publish_url.strip()

manifest["publish_url"] = publish_url
manifest["published_at"] = subprocess.run(["date", "+%Y-%m-%dT%H:%M:%S%z"], capture_output=True, text=True).stdout.strip()

with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print()
print("====================================================================")
print("  🎉 工作台已上线！公开 URL：")
print()
print(f"     {publish_url}")
print()
print(f"  manifest.json 写回：page_node_id + publish_url")
print("====================================================================")
PYEOF
