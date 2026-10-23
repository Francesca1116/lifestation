/* Phase 1.5: Production Shadow Integration 端到端测试
   - 从 src/生活站.html 提取 v2 + v25 模块
   - 构造真实 storeState fixture（1 Course + 1 Project + 1 Goal + 8 Tasks + 4 Reading/Notes）
   - 跑 v25_shadowBackfill
   - 对每个 topic 跑 v25_observatoryReport
   - 跑 6 项 sanity check
   - 输出：完整 Raw Record → Context → Topic Links → Events → Familiarity → Co-topic 链路
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = process.argv[2] || path.join(__dirname, '..', 'src', '生活站.html');
const REPORT_PATH = process.argv[3] || path.join(__dirname, '..', '.workbuddy', 'output', 'v25-test-report.json');

const html = fs.readFileSync(HTML_PATH, 'utf8');

// 提取 v2 + v25 模块：从 Phase 1 注释到 v25 window.__v25 块结束
const startMarker = 'Phase 1: Topic Analytics v2（测试 namespace';
const endMarker = 'window.__v25 = {';
const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker);

if (startIdx < 0 || endIdx < 0) {
  console.error('FAIL: cannot find v2/v25 module markers');
  process.exit(2);
}

let moduleEnd = endIdx;
let depth = 0;
for (let i = endIdx; i < html.length; i++) {
  if (html[i] === '{') depth++;
  else if (html[i] === '}') { depth--; if (depth < 0) { moduleEnd = i + 1; break; } }
}
let codeStart = startIdx;
const commentEnd = html.indexOf('*/', startIdx);
if (commentEnd > 0 && commentEnd < endIdx) {
  const nl = html.indexOf('\n', commentEnd);
  if (nl > 0) codeStart = nl + 1;
}
const moduleCode = html.slice(codeStart, moduleEnd);

// sandbox
const sandbox = {
  console: console,
  Date: Date, Math: Math, JSON: JSON, Object: Object, Array: Array,
  Number: Number, String: String, RegExp: RegExp, isNaN: isNaN,
  setTimeout: setTimeout,
  localStorage: {
    _data: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  },
  location: { search: '?topicTest=1' }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

try {
  vm.createContext(sandbox);
  vm.runInContext(moduleCode, sandbox, { timeout: 10000 });
} catch (e) {
  console.error('FAIL: module load error:', e.message);
  process.exit(2);
}

if (!sandbox.__v2 || !sandbox.__v25) {
  console.error('FAIL: __v2 or __v25 not exposed');
  process.exit(2);
}

const v2 = sandbox.__v2;
const v25 = sandbox.__v25;

// 真实数据 fixture：1 Course + 1 Project + 1 Goal + 8 Tasks + 4 Reading/Notes
function buildRealisticStoreState() {
  const id = (k) => 'rec_' + k;
  const today = '2026-09-07';
  const lastWeek = '2026-08-30';
  const lastMonth = '2026-08-01';

  return {
    tableRecords: {
      topics: [
        { _id: 't_py',  '主题名': 'PyTorch',           '别名': 'torch, pytorch',                '类型': '工具', '创建时间': '2024-01-01', '治理状态': 'active' },
        { _id: 't_hu',  '主题名': 'HuBERT',            '别名': 'hubert, wavlm, speech rep',     '类型': '工具', '创建时间': '2024-02-01', '治理状态': 'active' },
        { _id: 't_sr',  '主题名': 'Speech Representation', '别名': 'speech rep, 表征学习',      '类型': '聚焦', '创建时间': '2024-02-15', '治理状态': 'active' },
        { _id: 't_pr',  '主题名': 'Probing',           '别名': '探针, probing, 探查',            '类型': '方法', '创建时间': '2024-03-01', '治理状态': 'active' },
        { _id: 't_sp',  '主题名': 'Speech Technology', '别名': 'speech tech, 语音',              '类型': '领域', '创建时间': '2024-01-15', '治理状态': 'active' },
        { _id: 't_ap',  '主题名': 'AI Product',        '别名': 'AI PM, Agent 产品',              '类型': '领域', '创建时间': '2024-04-01', '治理状态': 'active' },
        { _id: 't_ae',  '主题名': 'Agent Evaluation',  '别名': 'agent eval, Eval',               '类型': '方法', '创建时间': '2024-05-01', '治理状态': 'active' }
      ],
      projects: [
        { _id: id('proj1'), '项目名': 'Speech Rep 毕业论文', '状态': '进行中', '优先级': 'P0', '负责人': '我', '开始': lastMonth, '截止': '2026-12-31', '说明': '毕业论文，使用 HuBERT 做 Probing 探查' }
      ],
      year_plan: [
        { _id: id('goal1'), '名称': '完成 Speech Rep 毕业论文', '说明': 'Q3-Q4 主线', '开始': '2026-07-01' }
      ],
      courses: [
        { _id: id('course1'), '课程名': '深度学习与 PyTorch 实战', '开始': '2026-03-01', '说明': '巩固 PyTorch 基础' }
      ],
      study_notes: [
        { _id: id('note1'), '标题': 'HuBERT Probing 笔记',     '内容': '通过 Probing 探查 HuBERT 各层学到的 Speech Representation', '日期': '2026-08-20' },
        { _id: id('note2'), '标题': 'PyTorch DataLoader 总结', '内容': 'PyTorch DataLoader 整理 + 多 worker 笔记', '日期': '2026-08-15' },
        { _id: id('note3'), '标题': 'Agent Evaluation 调研',    '内容': '调研 AI Product 的 Agent 评估方法', '日期': '2026-08-25' },
        { _id: id('note4'), '标题': '发邮件给导师',             '内容': '汇报 Probing 实验进展', '日期': '2026-09-01' }
      ],
      media: [
        { _id: id('m1'), '标题': 'Speech and Language Processing', '类型': '书', '状态': '已完结', '短评': '经典 Speech Technology 教材', '添加': '2026-05-01', '完结': '2026-07-15' }
      ],
      today_tasks: [
        { _id: id('t1'), '日期': today, '标题': '学 HuBERT Probing 框架笔记', '来源模块': '学习', '优先级': '高', '状态': '已完成', '备注': 'Speech Rep 论文' },
        { _id: id('t2'), '日期': today, '标题': '整理 PyTorch 实验代码',         '来源模块': '工作', '优先级': '中', '状态': '进行中' },
        { _id: id('t3'), '日期': today, '标题': '回邮件给导师',                  '来源模块': '其他', '优先级': '高', '状态': '已完成' },
        { _id: id('t4'), '日期': today, '标题': '复盘本周 Agent 评估',           '来源模块': '复盘', '优先级': '低', '状态': '待办' }
      ],
      study_tasks: [
        { _id: id('s1'), '标题': '实现 HuBERT Probing 第一版', '关联课程': '深度学习与 PyTorch 实战' },
        { _id: id('s2'), '标题': '总结 Speech Representation 文献', '关联课程': '深度学习与 PyTorch 实战' },
        { _id: id('s3'), '标题': '整理归档旧论文', '关联课程': '' },
        { _id: id('s4'), '标题': '做 Agent Evaluation baseline', '关联课程': '深度学习与 PyTorch 实战' }
      ],
      calendar_events: [
        { _id: id('c1'), '日期': lastWeek, '标题': '跟导师 meeting', '类型': '事件' }
      ]
    }
  };
}

const storeBefore = buildRealisticStoreState();
const storeBeforeClone = JSON.parse(JSON.stringify(storeBefore));  // snapshot for "no regression" check

// 跑 Shadow Backfill
const backfill = v25.shadowBackfill(storeBefore, { snapshotFirst: true, purgeBefore: true });

// 对每个 topic 跑 Observatory Report
const topics = v25.loadStore().topics;
const reports = topics.map(function(t) { return v25.observatoryReport(t._id); });

// Sanity check
const sanity = v25.sanityCheck(storeBeforeClone, storeBefore);

// 整体报告
const report = {
  timestamp: new Date().toISOString(),
  schema_version_v2: v2.SCHEMA_VERSION,
  schema_version_v25: v25.SCHEMA_VERSION,
  backfill: {
    canonical_count: backfill.canonical_count,
    topics_added: backfill.stats.topics_added,
    links_added: backfill.stats.links_added,
    events_added: backfill.stats.events_added,
    errors: backfill.stats.errors
  },
  topics: topics.map(function(t) { return { id: t._id, name: t.name, type: t.type, source_topic_id: t.source_topic_id }; }),
  observatory_reports: reports,
  sanity_check: sanity,
  passed: sanity.allPassed
};

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

// stdout
console.log('===== Phase 1.5 Shadow Backfill Report =====');
console.log('schema_version_v25:', v25.SCHEMA_VERSION);
console.log('canonical records:', backfill.canonical_count);
console.log('topics v2:', backfill.stats.topics_added);
console.log('links v2:', backfill.stats.links_added);
console.log('events v2:', backfill.stats.events_added);
if (backfill.stats.errors.length) console.log('errors:', backfill.stats.errors);

console.log('--- 真实数据：每 Topic 的 Familiarity ---');
reports.forEach(function(r) {
  if (r.error) { console.log(`  [${r.topic ? r.topic.name : '?'}] ${r.error}`); return; }
  const f = r.familiarity || {};
  console.log(`  ${r.topic.name} (${r.topic.type})`);
  console.log(`     total_events=${r.total_events}, valid_events=${r.valid_events}`);
  console.log(`     familiarity=${f.level || '?'}, stability=${f.stability || '-'}, byStage=${JSON.stringify(f.byStage || {})}`);
  if (r.coTopics && r.coTopics.length) {
    console.log(`     co-topics (top 5 by weighted):`);
    r.coTopics.forEach(function(c) { console.log(`        - ${c.topic_name}: raw=${c.raw}, weighted=${c.weighted}, candidate=${c.candidate}`); });
  } else {
    console.log(`     co-topics: (none)`);
  }
});

console.log('--- 6 项 sanity check ---');
sanity.report.forEach(function(r) {
  console.log(`  #${r.id} [${r.passed ? '✓' : '✗'}] ${r.name}${r.mutated && r.mutated.length ? ' mutated=' + r.mutated.join(',') : ''}`);
});
console.log('  allPassed:', sanity.allPassed);
console.log('---');
console.log('OVERALL:', report.passed ? '✓ ALL PASS' : '✗ FAILED');
console.log('Report:', REPORT_PATH);

process.exit(report.passed ? 0 : 1);
