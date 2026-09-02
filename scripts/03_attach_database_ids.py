#!/usr/bin/env python3
"""
03_attach_database_ids.py
-------------------------
读 manifest.json，把生活站.html 里 9 个 __DB_xxx__ 占位符替换为真实 database_id，
输出生活站.ready.html。

用法：
  python3 03_attach_database_ids.py \
      --manifest /path/to/manifest.json \
      --html    /path/to/生活站.html \
      --out     /path/to/生活站.ready.html
"""

import argparse, json, re, sys
from pathlib import Path

PLACEHOLDER_RE = re.compile(r'__DB_[A-Z_]+__')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', required=True)
    ap.add_argument('--html', required=True)
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    manifest = json.loads(Path(args.manifest).read_text(encoding='utf-8'))
    tables = {t['key']: t['database_id'] for t in manifest.get('tables', [])}

    html = Path(args.html).read_text(encoding='utf-8')

    # 占位符名 → key 的反向映射（13 张业务表 + 4 张群组占位）
    ph2key = {
        '__DB_TODAY_TASKS__':     'today_tasks',
        '__DB_CALENDAR_EVENTS__': 'calendar_events',
        '__DB_FINANCE_RECORDS__': 'finance_records',
        '__DB_FINANCE_BUDGETS__': 'finance_budgets',
        '__DB_HABITS__':          'habits',
        '__DB_HABIT_LOGS__':      'habit_logs',
        '__DB_BODY__':            'body',
        '__DB_BODY_GOALS__':      'body_goals',
        '__DB_MEDIA__':           'media',
        '__DB_PROJECTS__':        'projects',
        '__DB_COURSES__':         'courses',
        '__DB_INBOX__':           'inbox',
        '__DB_WEEKLY_REVIEWS__':  'weekly_reviews',
        '__DB_YEAR_PLAN__':        'year_plan',
        '__DB_STUDY_TASKS__':      'study_tasks',
        '__DB_STUDY_HABITS__':     'study_habits',
        '__DB_STUDY_CHECKINS__':   'study_checkins',
        '__DB_STUDY_NOTES__':      'study_notes',
        '__DB_TOPICS__':            'topics',
        '__DB_TOPIC_EVENTS__':      'topic_events',
        '__DB_KNOWLEDGE_LINKS__':   'knowledge_links',
    }

    missing = []
    def repl(m):
        ph = m.group(0)
        key = ph2key.get(ph)
        if not key:
            return ph
        if key not in tables:
            missing.append(key)
            return ph
        return tables[key]

    new_html = PLACEHOLDER_RE.sub(repl, html)

    # 同时替换顶部 HTML 注释，把"方案 B 兜底版"提示替换为"已绑定资料库"
    new_html = new_html.replace(
        "<title>生活站 · 兜底版</title>",
        "<title>生活站</title>"
    )

    Path(args.out).write_text(new_html, encoding='utf-8')

    if missing:
        print(f"WARNING: 未在 manifest 中找到的 key: {missing}", file=sys.stderr)
        print("请确认 02_create_lifestation_dbs.sh 全部 9 张表都建成功了。", file=sys.stderr)
        sys.exit(2)

    print(f"OK   wrote: {args.out}")
    print(f"     source: {args.html}")
    print(f"     manifest: {args.manifest} ({len(tables)} tables bound)")

if __name__ == '__main__':
    main()
