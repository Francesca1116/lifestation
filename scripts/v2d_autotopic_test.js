// v2d_autotopic_test.js — 自动生成主题（主表）+ 影子存储→主表打通 集成测试
// 覆盖：autoGenerateTopicsFromData（去重/类型推断/幂等）+ v2a_syncLinkToMainEvents（手动关联投影到主表）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', '生活站.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

// ===== 抽取 v25 / v2a / v2 模块（同 v2c 策略）=====
const v25Start = html.indexOf('var TOPIC_ANALYTICS_V25_SCHEMA_VERSION');
const v2aCommentPos = html.indexOf('Phase 2A: v2a UI', v25Start);
const v25End = html.lastIndexOf('}', v2aCommentPos) + 1;
const v25Code = html.slice(v25Start, v25End);

const v2aStart = html.indexOf('var TOPIC_V2A_SCHEMA_VERSION');
const v2aEndStart = html.indexOf('window.__v2a = {', v2aStart);
let v2aEnd = v2aEndStart, depth = 0, exposeEndIdx = -1;
for (let i = v2aEndStart; i < Math.min(html.length, v2aEndStart + 3000); i++) {
  if (html[i] === '{') depth++;
  else if (html[i] === '}') { depth--; if (depth < 0) { exposeEndIdx = i + 1; break; } }
}
v2aEnd = exposeEndIdx;
while (v2aEnd < html.length && (html[v2aEnd] === ' ' || html[v2aEnd] === '\n')) v2aEnd++;
if (html[v2aEnd] === '}') v2aEnd++;
const v2aCode = html.slice(v2aStart, v2aEnd);

const v2Start = html.indexOf('var TOPIC_ANALYTICS_SCHEMA_VERSION = 1;');
const v2ExposeStart = html.indexOf('window.__v2 = {', v2Start);
let v2End = v2ExposeStart, v2d = 0, v2ExposeEnd = -1;
for (let i = v2ExposeStart; i < Math.min(html.length, v2ExposeStart + 2000); i++) {
  if (html[i] === '{') v2d++;
  else if (html[i] === '}') { v2d--; if (v2ExposeEnd < 0 && v2d < 0) { v2ExposeEnd = i + 1; break; } }
}
v2End = v2ExposeEnd;
while (v2End < html.length && (html[v2End] === ' ' || html[v2End] === '\n')) v2End++;
if (html[v2End] === '}') v2End++;
const v2Code = html.slice(v2Start, v2End);

// ===== 抽取「自动生成主题 + 同步」新代码段 =====
const autoStart = html.indexOf('var MAIN_STAGE_MAP');
const autoEndMarker = html.indexOf('V5.5 Observatory UI: 4 Tab', autoStart);
const autoEnd = html.lastIndexOf('/*', autoEndMarker); // 切到 V5.5 注释块 /* 之前
const autoCode = html.slice(autoStart, autoEnd);
if (!autoCode || autoCode.length < 200) {
  console.error('FAIL: 未抽取到自动生成主题代码段');
  process.exit(2);
}

// 第六期：resolveGrowthStage（在 autoCode 内）依赖 inferStageFromRecord / STAGE_ORDER，
// 二者定义在 autoCode 切片之前，这里单独抽取/补齐。
const inferStageCode = html.slice(html.indexOf('function inferStageFromRecord'), html.indexOf('function detectTopicsFromRecord'));

// ===== jsdom =====
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="modalRoot"></div></body></html>', { url: 'http://localhost/' });
const jdWindow = dom.window;
const jdDocument = jdWindow.document;

// ===== sandbox =====
const sandbox = {
  console,
  Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
  Promise, parseFloat, parseInt, isNaN, isFinite,
  setTimeout, clearTimeout, setInterval, clearInterval,
  document: jdDocument,
  localStorage: jdWindow.localStorage,
  $modalRoot: jdDocument.getElementById('modalRoot'),
  escapeHTML: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
  toast: function () {},
  uid: function () { return 'id_' + Math.random().toString(36).slice(2, 10); },
  todayStr: function () { return '2026-10-19'; },
  STAGE_ORDER: ['E1 Explore','E2 Learn','E3 Synthesize','E4 Apply','E5 Output','E6 Reuse'],
  saveLocal: function (k) { /* no-op：测试直接读内存 storeState.tableRecords */ },
  storeState: {
    tableRecords: {
      projects: [], courses: [], year_plan: [], today_tasks: [], study_tasks: [],
      study_notes: [], study_habits: [], study_checkins: [], media: [], topics: [], topic_events: []
    }
  }
};
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

// localStorage 初始化
sandbox.localStorage.clear();
sandbox.localStorage.setItem('wb_topic_analytics_v25', JSON.stringify({
  schema_version: 1, created_at: null, topics: [], topic_links: [], topic_events: [],
  backfill_meta: { topics_added: 0, links_added: 0, events_added: 0, last_run: null }
}));

// 注入模块（顺序：v2 → v25 → v2a → inferStage → 自动生成段）
for (const [name, code] of [['v2', v2Code], ['v25', v25Code], ['v2a', v2aCode], ['inferStage', inferStageCode], ['auto', autoCode]]) {
  try { vm.runInContext(code, sandbox, { filename: name + '.js' }); }
  catch (e) { console.error('FAIL: 注入 ' + name + ' 模块抛错:', e.message, e.stack); process.exit(2); }
}

if (typeof sandbox.autoGenerateTopicsFromData !== 'function') {
  console.error('FAIL: autoGenerateTopicsFromData 未注入');
  process.exit(2);
}
if (typeof sandbox.v2a_syncLinkToMainEvents !== 'function') {
  console.error('FAIL: v2a_syncLinkToMainEvents 未注入');
  process.exit(2);
}

const report = [];
function check(id, name, cond, detail) {
  report.push({ id, name, passed: !!cond, detail: detail || '' });
  console.log('  #' + id + ' ' + (cond ? '✓' : '✗') + ' ' + name + (detail && !cond ? '  [' + detail + ']' : ''));
}
const TR = sandbox.storeState.tableRecords;
const topicName = (id) => { const t = TR.topics.find(x => x._id === id); return t ? t['主题名'] : null; };

// ===== 准备真实数据 =====
TR.courses.push({ _id: 'c1', '课程名': '深度学习实战', '平台': '自学', '开始': '2026-09-01' });
TR.projects.push({ _id: 'p1', '项目名': 'Agent 评估实验室', '状态': '进行中', '开始': '2026-08-15' });
TR.media.push({ _id: 'm1', '标题': '《置身事内》', '类型': '书', '状态': '进行中', '添加': '2026-10-01' });
TR.year_plan.push({ _id: 'y1', '标题': '雅思 7.0', '开始': '2026-01-01' });
TR.study_notes.push({ _id: 'n1', '标题': 'Transformer 注意力机制笔记', '日期': '2026-10-10' });

// ===== 测试 1：autoGenerateTopicsFromData 已软停用（停止标题自动建主题）=====
const r1 = sandbox.autoGenerateTopicsFromData();
check(1, '软停用后 topics_added = 0', r1.topics_added === 0, 'got ' + r1.topics_added);
check(1.1, '软停用后 events_added = 0', r1.events_added === 0, 'got ' + r1.events_added);
check(1.2, '软停用后主表 topics 仍为空', TR.topics.length === 0, 'got ' + TR.topics.length);
check(1.3, '软停用后主表 topic_events 仍为空', TR.topic_events.length === 0, 'got ' + TR.topic_events.length);

// ===== 测试 2：二次调用仍不产生主题（软停用幂等）=====
const r2 = sandbox.autoGenerateTopicsFromData();
check(2, '二次调用仍 topics_added = 0', r2.topics_added === 0);
check(2.1, '二次调用仍不新增主表主题', TR.topics.length === 0, 'got ' + TR.topics.length);
check(2.2, '二次调用仍不新增主表事件', TR.topic_events.length === 0, 'got ' + TR.topic_events.length);

// ===== 测试 7：手动关联 → 影子存储 → 主表投影 =====
// 给课程 c1 手动关联一个已有主题（core）
const v2a = sandbox.window.__v2a;
TR.topics.push({ _id: 'T_X', '主题名': '机器学习', '类型': '领域' });
const r7 = v2a.applyRoleOverridesToStore('courses', 'c1', { core: ['T_X'], supporting: [] });
check(7, 'applyRoleOverridesToStore 返回 ok', r7 && r7.ok === true);
const synced = TR.topic_events.filter(e => e['来源表'] === 'courses' && e['来源记录 ID'] === 'c1' && e['主题 ID'] === 'T_X' && e.__v2a_synced);
check(7.1, '主表 topic_events 出现 __v2a_synced 投影事件', synced.length === 1);
check(7.2, '投影事件阶段已映射为全名', synced[0] && /^E\d/.test(synced[0]['阶段']) && synced[0]['阶段'].indexOf(' ') > 0);

// ===== 测试 8：取消关联（清空 roles）→ 主表投影事件被移除 =====
v2a.applyRoleOverridesToStore('courses', 'c1', { core: [], supporting: [] });
const syncedAfter = TR.topic_events.filter(e => e['来源表'] === 'courses' && e['来源记录 ID'] === 'c1' && e['主题 ID'] === 'T_X' && e.__v2a_synced);
check(8, '取消关联后主表投影事件被移除', syncedAfter.length === 0);

// ===== 测试 9-13：v2a_backfillMainFromV25 历史关联迁移 =====
// 准备：主表加一条学习任务 + v25 影子存储预置 confirmed link
TR.study_tasks.push({ _id: 'st1', '标题': '复习机器学习', '日期': '2026-10-15' });
const mlTopic = TR.topics.find(t => t['主题名'] === '机器学习');
const v25s = sandbox.v25_loadStore();
v25s.topics.push({ _id: 'v_t_ml', name: '机器学习', type: '领域', aliases: '', source_topic_id: mlTopic._id });
v25s.topic_links.push({
  _id: 'l9', record_type: 'study_tasks', record_id: 'st1', topic_id: 'v_t_ml',
  link_type: 'direct', relevance: 1, confidence: 1, relation_source: 'manual',
  topic_role: 'core', review_status: 'confirmed', context_key: '_default', created_at: '2026-10-15T00:00:00.000Z'
});
sandbox.v25_saveStore(v25s);

const r9 = sandbox.v2a_backfillMainFromV25();
check(9, 'backfill 迁移 1 条 confirmed 关联事件', r9.events_added === 1, 'got ' + r9.events_added);
const backEv = TR.topic_events.find(e => e['来源表'] === 'study_tasks' && e['来源记录 ID'] === 'st1' && e['主题 ID'] === mlTopic._id);
check(9.1, '主表出现历史关联投影事件', !!backEv);
check(9.2, '投影事件主题角色 = primary', backEv && backEv['主题角色'] === 'primary');
check(9.3, '投影事件分类来源 = user（manual）', backEv && backEv['分类来源'] === 'user');

const r10 = sandbox.v2a_backfillMainFromV25();
check(10, 'backfill 二次调用 events_added = 0（幂等）', r10.events_added === 0);
check(10.1, 'backfill 二次调用 topics_added = 0', r10.topics_added === 0);

// pending link（自动推断，未确认）不迁移
const v25s11 = sandbox.v25_loadStore();
v25s11.topic_links.push({ _id: 'l11', record_type: 'study_tasks', record_id: 'st1', topic_id: 'v_t_ml', link_type: 'contextual', relevance: 0.5, confidence: 0.4, relation_source: 'migrated_inference', topic_role: 'core', review_status: 'pending', context_key: '_default', created_at: '2026-10-15T00:00:00.000Z' });
sandbox.v25_saveStore(v25s11);
const r11 = sandbox.v2a_backfillMainFromV25();
check(11, 'pending link 不迁移', r11.events_added === 0);

// ambient link 不迁移
const v25s12 = sandbox.v25_loadStore();
v25s12.topic_links.push({ _id: 'l12', record_type: 'study_tasks', record_id: 'st1', topic_id: 'v_t_ml', link_type: 'direct', relevance: 1, confidence: 1, relation_source: 'manual', topic_role: 'ambient', review_status: 'confirmed', context_key: '_default', created_at: '2026-10-15T00:00:00.000Z' });
sandbox.v25_saveStore(v25s12);
const r12 = sandbox.v2a_backfillMainFromV25();
check(12, 'ambient link 不迁移', r12.events_added === 0);

// 空名主题 + 其关联不迁移
const v25s13 = sandbox.v25_loadStore();
v25s13.topics.push({ _id: 'v_t_empty', name: '', type: '领域' });
v25s13.topic_links.push({ _id: 'l13', record_type: 'study_tasks', record_id: 'st1', topic_id: 'v_t_empty', link_type: 'direct', relevance: 1, confidence: 1, relation_source: 'manual', topic_role: 'core', review_status: 'confirmed', context_key: '_default', created_at: '2026-10-15T00:00:00.000Z' });
sandbox.v25_saveStore(v25s13);
const r13 = sandbox.v2a_backfillMainFromV25();
check(13, '空名主题 + 其关联不迁移', r13.topics_added === 0 && r13.events_added === 0);

console.log('\n===== v2d 自动生成主题 + 影子→主表打通 集成测试 =====');
const passed = report.filter(r => r.passed).length;
console.log('Total: ' + report.length + ' | Passed: ' + passed + ' | Failed: ' + (report.length - passed));
process.exit(report.every(r => r.passed) ? 0 : 1);
