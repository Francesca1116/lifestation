#!/usr/bin/env bash
# =============================================================================
# 02_create_lifestation_dbs.sh
# -----------------------------------------------------------------------------
# 修通 token 后跑一次：在「我的文档」下连续调用 create_database.py 建 9 张表，
# 把每张表的 (key, database_id, space_id) 写到 .workbuddy/scripts/manifest.json
# 供 03_attach_database_ids.py 替换 HTML 占位符。
#
# 使用：
#   bash 02_create_lifestation_dbs.sh
# 可调环境变量：
#   WB_SKILL_DIR   资料库 skill 根（默认当前用户路径）
#   TOKEN_FILE     token 文件路径（默认 /tmp/wb_token）
#   MANIFEST       manifest 输出路径
# =============================================================================

set -euo pipefail

WB_SKILL_DIR="${WB_SKILL_DIR:-/Users/hujiayun/.workbuddy/plugins/cache/workbuddy-builtin/skill-library/0.5.9}"
TOKEN_FILE="${TOKEN_FILE:-/tmp/wb_token}"
MANIFEST="${MANIFEST:-$(dirname "$0")/manifest.json}"

if [ ! -s "$TOKEN_FILE" ]; then
  echo "ERROR: token file '$TOKEN_FILE' empty or missing." >&2
  echo "       请先在 IDE 对话中让 agent 把 token 写到该路径（见 01_get_token_credential.sh）。" >&2
  exit 1
fi

TOKEN="$(cat "$TOKEN_FILE")"

python3 - "$WB_SKILL_DIR" "$MANIFEST" "$TOKEN" <<'PYEOF'
import json, subprocess, sys, time

skill_dir, manifest_path, token = sys.argv[1], sys.argv[2], sys.argv[3]

# 13 张业务表的 schema（与生活站.html 里的 SCHEMAS 对象一一对应）
#   9 张原有：today_tasks / calendar_events / finance_records / finance_budgets /
#            habits / habit_logs / body / body_goals / media
#   4 张 v3-P1 新增：projects(工作) / courses(学习) / inbox(横跨暂存) / weekly_reviews(横跨复盘)
#   5 张 v4-P1 新增：year_plan(年度) / study_tasks / study_habits / study_checkins / study_notes
TABLES = [
    {
        "key": "today_tasks",
        "title": "生活站 · 今日任务",
        "properties": [
            {"name": "日期", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "标题", "config": {"text": ""}},
            {"name": "来源模块", "config": {"select": {"options": [
                {"id": "sm0", "text": "今日"}, {"id": "sm1", "text": "日程"},
                {"id": "sm2", "text": "习惯"}, {"id": "sm3", "text": "健身"},
                {"id": "sm4", "text": "记账"}, {"id": "sm5", "text": "书影音"},
                {"id": "sm6", "text": "其他"}
            ]}}},
            {"name": "优先级", "config": {"select": {"options": [
                {"id": "pr0", "text": "高"}, {"id": "pr1", "text": "中"}, {"id": "pr2", "text": "低"}
            ]}}},
            {"name": "状态", "config": {"select": {"options": [
                {"id": "st0", "text": "待办"}, {"id": "st1", "text": "已完成"}
            ]}}},
            {"name": "备注", "config": {"text": ""}}
        ]
    },
    {
        "key": "calendar_events",
        "title": "生活站 · 日程事件",
        "properties": [
            {"name": "日期", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "时间", "config": {"text": ""}},
            {"name": "标题", "config": {"text": ""}},
            {"name": "类型", "config": {"select": {"options": [
                {"id": "ck0", "text": "事件"}, {"id": "ck1", "text": "待办"}
            ]}}},
            {"name": "重复", "config": {"select": {"options": [
                {"id": "rp0", "text": "不重复"}, {"id": "rp1", "text": "每天"}, {"id": "rp2", "text": "每周"}
            ]}}},
            {"name": "颜色", "config": {"select": {"options": [
                {"id": "cl0", "text": "紫"}, {"id": "cl1", "text": "粉"},
                {"id": "cl2", "text": "蓝"}, {"id": "cl3", "text": "绿"},
                {"id": "cl4", "text": "橙"}
            ]}}},
            {"name": "备注", "config": {"text": ""}},
            {"name": "来源模块", "config": {"text": ""}}
        ]
    },
    {
        "key": "finance_records",
        "title": "生活站 · 收支记录",
        "properties": [
            {"name": "日期", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "类型", "config": {"select": {"options": [
                {"id": "io0", "text": "支出"}, {"id": "io1", "text": "收入"}
            ]}}},
            {"name": "分类", "config": {"select": {"options": [
                {"id": "fc0", "text": "餐饮"}, {"id": "fc1", "text": "交通"},
                {"id": "fc2", "text": "居家"}, {"id": "fc3", "text": "医疗"},
                {"id": "fc4", "text": "教育"}, {"id": "fc5", "text": "娱乐"},
                {"id": "fc6", "text": "购物"}, {"id": "fc7", "text": "工资"},
                {"id": "fc8", "text": "其它"}
            ]}}},
            {"name": "金额", "config": {"number": 0}},
            {"name": "币种", "config": {"select": {"options": [
                {"id": "cu0", "text": "CNY"}, {"id": "cu1", "text": "GBP"}
            ]}}},
            {"name": "备注", "config": {"text": ""}}
        ]
    },
    {
        "key": "finance_budgets",
        "title": "生活站 · 月度预算",
        "properties": [
            {"name": "月份", "config": {"text": ""}},
            {"name": "分类", "config": {"select": {"options": [
                {"id": "bc0", "text": "餐饮"}, {"id": "bc1", "text": "交通"},
                {"id": "bc2", "text": "居家"}, {"id": "bc3", "text": "医疗"},
                {"id": "bc4", "text": "教育"}, {"id": "bc5", "text": "娱乐"},
                {"id": "bc6", "text": "购物"}, {"id": "bc7", "text": "其它"}
            ]}}},
            {"name": "币种", "config": {"select": {"options": [
                {"id": "bcu0", "text": "CNY"}, {"id": "bcu1", "text": "GBP"}
            ]}}},
            {"name": "金额", "config": {"number": 0}}
        ]
    },
    {
        "key": "habits",
        "title": "生活站 · 习惯",
        "properties": [
            {"name": "习惯名", "config": {"text": ""}},
            {"name": "打卡方式", "config": {"select": {"options": [
                {"id": "ht0", "text": "勾选"}, {"id": "ht1", "text": "计数"},
                {"id": "ht2", "text": "数值"}
            ]}}},
            {"name": "单位", "config": {"text": ""}},
            {"name": "目标", "config": {"number": 0}},
            {"name": "颜色", "config": {"select": {"options": [
                {"id": "hc0", "text": "紫"}, {"id": "hc1", "text": "粉"},
                {"id": "hc2", "text": "蓝"}, {"id": "hc3", "text": "绿"},
                {"id": "hc4", "text": "橙"}
            ]}}},
            {"name": "启用", "config": {"checkbox": True}}
        ]
    },
    {
        "key": "habit_logs",
        "title": "生活站 · 习惯打卡",
        "properties": [
            {"name": "日期", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "习惯 ID", "config": {"text": ""}},
            {"name": "数值", "config": {"number": 0}},
            {"name": "备注", "config": {"text": ""}}
        ]
    },
    {
        "key": "body",
        "title": "生活站 · 体重记录",
        "properties": [
            {"name": "日期", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "体重 kg", "config": {"number": 0}},
            {"name": "体脂 %", "config": {"number": 0}},
            {"name": "摄入 kcal", "config": {"number": 0}},
            {"name": "消耗 kcal", "config": {"number": 0}},
            {"name": "备注", "config": {"text": ""}}
        ]
    },
    {
        "key": "body_goals",
        "title": "生活站 · 健身目标",
        "properties": [
            {"name": "指标", "config": {"select": {"options": [
                {"id": "bm0", "text": "体重"}, {"id": "bm1", "text": "体脂"},
                {"id": "bm2", "text": "摄入"}, {"id": "bm3", "text": "消耗"},
                {"id": "bm4", "text": "天数"}
            ]}}},
            {"name": "目标值", "config": {"number": 0}},
            {"name": "周期", "config": {"select": {"options": [
                {"id": "bp0", "text": "周"}, {"id": "bp1", "text": "月"}
            ]}}},
            {"name": "开始", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "结束", "config": {"date": "2026-08-31T00:00:00Z"}},
            {"name": "备注", "config": {"text": ""}}
        ]
    },
    {
        "key": "media",
        "title": "生活站 · 书影音收藏",
        "properties": [
            {"name": "标题", "config": {"text": ""}},
            {"name": "类型", "config": {"select": {"options": [
                {"id": "mt0", "text": "书"}, {"id": "mt1", "text": "影"},
                {"id": "mt2", "text": "音"}
            ]}}},
            {"name": "状态", "config": {"select": {"options": [
                {"id": "ms0", "text": "想看/读"}, {"id": "ms1", "text": "进行中"},
                {"id": "ms2", "text": "已完结"}
            ]}}},
            {"name": "评分", "config": {"number": 0}},
            {"name": "封面", "config": {"text": ""}},
            {"name": "短评", "config": {"text": ""}},
            {"name": "年份", "config": {"number": 0}},
            {"name": "添加", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "完结", "config": {"date": "2026-08-01T00:00:00Z"}}
        ]
    },
    {
        "key": "projects",
        "title": "生活站 · 项目任务",
        "properties": [
            {"name": "项目名", "config": {"text": ""}},
            {"name": "状态", "config": {"select": {"options": [
                {"id": "pj0", "text": "待启动"}, {"id": "pj1", "text": "进行中"},
                {"id": "pj2", "text": "阻塞"}, {"id": "pj3", "text": "已完成"},
                {"id": "pj4", "text": "已搁置"}
            ]}}},
            {"name": "优先级", "config": {"select": {"options": [
                {"id": "pp0", "text": "P0"}, {"id": "pp1", "text": "P1"}, {"id": "pp2", "text": "P2"}
            ]}}},
            {"name": "负责人", "config": {"text": ""}},
            {"name": "截止", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "备注", "config": {"text": ""}},
            {"name": "任务", "config": {"text": ""}}
        ]
    },
    {
        "key": "courses",
        "title": "生活站 · 课程笔记",
        "properties": [
            {"name": "课程名", "config": {"text": ""}},
            {"name": "平台", "config": {"text": ""}},
            {"name": "章节", "config": {"text": ""}},
            {"name": "笔记", "config": {"text": ""}},
            {"name": "状态", "config": {"select": {"options": [
                {"id": "cs0", "text": "想学"}, {"id": "cs1", "text": "进行中"},
                {"id": "cs2", "text": "已学完"}
            ]}}},
            {"name": "开始", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "完结", "config": {"date": "2026-08-01T00:00:00Z"}}
        ]
    },
    {
        "key": "inbox",
        "title": "生活站 · Inbox 暂存",
        "properties": [
            {"name": "内容", "config": {"text": ""}},
            {"name": "标签", "config": {"text": ""}},
            {"name": "状态", "config": {"select": {"options": [
                {"id": "ia0", "text": "待处理"}, {"id": "ia1", "text": "已处理"},
                {"id": "ia2", "text": "已归档"}
            ]}}},
            {"name": "日期", "config": {"date": "2026-08-01T00:00:00Z"}}
        ]
    },
    {
        "key": "weekly_reviews",
        "title": "生活站 · 每周复盘",
        "properties": [
            {"name": "周", "config": {"text": ""}},
            {"name": "完成项数", "config": {"number": 0}},
            {"name": "打卡天数", "config": {"number": 0}},
            {"name": "专注时长 h", "config": {"number": 0}},
            {"name": "运动次数", "config": {"number": 0}},
            {"name": "支出 CNY", "config": {"currency": {"currencySymbol": "¥", "decimalPlaces": 2, "useSeparate": True}}},
            {"name": "高光", "config": {"text": ""}},
            {"name": "改进", "config": {"text": ""}},
            {"name": "生成时间", "config": {"date": "2026-08-01T00:00:00Z"}}
        ]
    },
    {
        "key": "year_plan",
        "title": "生活站 · 年度计划",
        "properties": [
            {"name": "标题", "config": {"text": ""}},
            {"name": "类型", "config": {"select": {"options": [
                {"id": "yp0", "text": "年度大目标"}, {"id": "yp1", "text": "OKR"},
                {"id": "yp2", "text": "习惯养成"}, {"id": "yp3", "text": "读书"},
                {"id": "yp4", "text": "职业"}
            ]}}},
            {"name": "关键节点", "config": {"text": ""}},
            {"name": "当前完成", "config": {"number": 0}},
            {"name": "状态", "config": {"select": {"options": [
                {"id": "ys0", "text": "进行中"}, {"id": "ys1", "text": "已完成"},
                {"id": "ys2", "text": "已搁置"}
            ]}}},
            {"name": "开始", "config": {"date": "2026-01-01T00:00:00Z"}},
            {"name": "截止", "config": {"date": "2026-12-31T00:00:00Z"}},
            {"name": "颜色", "config": {"select": {"options": [
                {"id": "yc0", "text": "紫"}, {"id": "yc1", "text": "粉"},
                {"id": "yc2", "text": "蓝"}, {"id": "yc3", "text": "绿"},
                {"id": "yc4", "text": "橙"}
            ]}}}
        ]
    },
    {
        "key": "study_tasks",
        "title": "生活站 · 每日学习任务",
        "properties": [
            {"name": "日期", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "标题", "config": {"text": ""}},
            {"name": "状态", "config": {"select": {"options": [
                {"id": "st0", "text": "待办"}, {"id": "st1", "text": "已完成"},
                {"id": "st2", "text": "已搁置"}
            ]}}},
            {"name": "优先级", "config": {"select": {"options": [
                {"id": "sp0", "text": "P0"}, {"id": "sp1", "text": "P1"}, {"id": "sp2", "text": "P2"}
            ]}}},
            {"name": "关联计划", "config": {"text": ""}},
            {"name": "关联课程", "config": {"text": ""}},
            {"name": "备注", "config": {"text": ""}}
        ]
    },
    {
        "key": "study_habits",
        "title": "生活站 · 学习打卡习惯",
        "properties": [
            {"name": "标题", "config": {"text": ""}},
            {"name": "频次", "config": {"select": {"options": [
                {"id": "sh0", "text": "每日"}, {"id": "sh1", "text": "每周3次"},
                {"id": "sh2", "text": "每周5次"}, {"id": "sh3", "text": "自定义"}
            ]}}},
            {"name": "时段", "config": {"select": {"options": [
                {"id": "stt0", "text": "早"}, {"id": "stt1", "text": "中"},
                {"id": "stt2", "text": "晚"}, {"id": "stt3", "text": "自定义"}
            ]}}},
            {"name": "单位", "config": {"text": ""}},
            {"name": "目标/天", "config": {"number": 0}},
            {"name": "关联计划", "config": {"text": ""}},
            {"name": "颜色", "config": {"select": {"options": [
                {"id": "shc0", "text": "紫"}, {"id": "shc1", "text": "粉"},
                {"id": "shc2", "text": "蓝"}, {"id": "shc3", "text": "绿"},
                {"id": "shc4", "text": "橙"}
            ]}}},
            {"name": "启用", "config": {"checkbox": True}}
        ]
    },
    {
        "key": "study_checkins",
        "title": "生活站 · 学习打卡记录",
        "properties": [
            {"name": "日期", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "习惯 ID", "config": {"text": ""}},
            {"name": "数值", "config": {"number": 0}},
            {"name": "备注", "config": {"text": ""}}
        ]
    },
    {
        "key": "study_notes",
        "title": "生活站 · 学习复盘笔记",
        "properties": [
            {"name": "日期", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "标题", "config": {"text": ""}},
            {"name": "内容", "config": {"text": ""}},
            {"name": "标签", "config": {"text": ""}},
            {"name": "关联计划", "config": {"text": ""}},
            {"name": "关联课程", "config": {"text": ""}}
        ]
    },
    {
        "key": "topics",
        "title": "生活站 · 观测主题",
        "properties": [
            {"name": "主题名", "config": {"text": ""}},
            {"name": "别名", "config": {"text": ""}},
            {"name": "类型", "config": {"select": {"options": [
                {"id": "tt0", "text": "领域"}, {"id": "tt1", "text": "聚焦"},
                {"id": "tt2", "text": "方法"}, {"id": "tt3", "text": "工具"}
            ]}}},
            {"name": "父主题 ID", "config": {"text": ""}},
            {"name": "说明", "config": {"text": ""}},
            {"name": "创建时间", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "治理状态", "config": {"select": {"options": [
                {"id": "tg0", "text": "candidate"}, {"id": "tg1", "text": "active"},
                {"id": "tg2", "text": "merged"}, {"id": "tg3", "text": "archived"}
            ]}}},
            {"name": "分析状态", "config": {"select": {"options": [
                {"id": "ta0", "text": "Emerging"}, {"id": "ta1", "text": "Accelerating"},
                {"id": "ta2", "text": "Developing"}, {"id": "ta3", "text": "Mature"},
                {"id": "ta4", "text": "Dormant"}, {"id": "ta5", "text": "Reviving"}
            ]}}}
        ]
    },
    {
        "key": "topic_events",
        "title": "生活站 · 主题事件",
        "properties": [
            {"name": "日期", "config": {"date": "2026-08-01T00:00:00Z"}},
            {"name": "来源表", "config": {"text": ""}},
            {"name": "来源记录 ID", "config": {"text": ""}},
            {"name": "主题 ID", "config": {"text": ""}},
            {"name": "主题角色", "config": {"select": {"options": [
                {"id": "te0", "text": "primary"}, {"id": "te1", "text": "secondary"}
            ]}}},
            {"name": "主题权重", "config": {"number": 1}},
            {"name": "阶段", "config": {"select": {"options": [
                {"id": "ts0", "text": "E1 Explore"}, {"id": "ts1", "text": "E2 Learn"},
                {"id": "ts2", "text": "E3 Synthesize"}, {"id": "ts3", "text": "E4 Apply"},
                {"id": "ts4", "text": "E5 Output"}, {"id": "ts5", "text": "E6 Reuse"}
            ]}}},
            {"name": "分类来源", "config": {"select": {"options": [
                {"id": "tcs0", "text": "user"}, {"id": "tcs1", "text": "rule"}, {"id": "tcs2", "text": "AI"}
            ]}}},
            {"name": "置信度", "config": {"number": 0.7}},
            {"name": "已确认", "config": {"checkbox": False}}
        ]
    },
    {
        "key": "knowledge_links",
        "title": "生活站 · 知识链接",
        "properties": [
            {"name": "源项 (record_id)", "config": {"text": ""}},
            {"name": "目标项 (record_id)", "config": {"text": ""}},
            {"name": "关系", "config": {"select": {"options": [
                {"id": "kl0", "text": "derived_from"}, {"id": "kl1", "text": "inspires"},
                {"id": "kl2", "text": "applies"}, {"id": "kl3", "text": "extends"},
                {"id": "kl4", "text": "tests"}, {"id": "kl5", "text": "contributes_to"},
                {"id": "kl6", "text": "contradicts"}, {"id": "kl7", "text": "reuses"}
            ]}}},
            {"name": "置信度", "config": {"number": 0.7}},
            {"name": "已确认", "config": {"checkbox": False}},
            {"name": "创建时间", "config": {"date": "2026-08-01T00:00:00Z"}}
        ]
    }
]

results = []
failed = []
for t in TABLES:
    schema = {"title": t["title"], "properties": t["properties"]}
    proc = subprocess.run(
        ["python3", f"{skill_dir}/database/create_database.py",
         "--token-stdin", "--schema", json.dumps(schema, ensure_ascii=False)],
        input=token, text=True, capture_output=True
    )
    out = proc.stdout.strip()
    if proc.returncode != 0 or not out or out.startswith('{"error"'):
        print(f"FAIL  {t['key']:<18} → {out[:200]}", file=sys.stderr)
        failed.append((t["key"], out))
        continue
    obj = json.loads(out)
    results.append({
        "key": t["key"],
        "title": t["title"],
        "database_id": obj["database_id"],
        "space_id": obj["space_id"],
        "property_count": obj["property_count"]
    })
    print(f"OK    {t['key']:<18} → {obj['database_id']}")

manifest = {
    "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    "space_id": results[0]["space_id"] if results else None,
    "tables": results,
    "failed": [{"key": k, "raw": raw} for k, raw in failed]
}
with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

print()
print(f"SUCCEEDED: {len(results)}/{len(TABLES)}")
print(f"MANIFEST:  {manifest_path}")
if failed:
    print(f"FAILED:    {[k for k,_ in failed]}", file=sys.stderr)
    sys.exit(2)
PYEOF
