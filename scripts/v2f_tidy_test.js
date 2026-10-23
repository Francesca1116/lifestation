// v2f_tidy_test.js — 第二轮优化第二期：待整理主题（识别/保留/移除/合并）集成测试
// 覆盖：obsListTidyTopics（_auto 候选识别）+ obsTidyKeep/Remove/Merge（数据层）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', '生活站.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

// ===== 抽取 v25 模块（v25_loadStore / v25_saveStore）=====
const v25Start = html.indexOf('var TOPIC_ANALYTICS_V25_SCHEMA_VERSION');
const v2aCommentPos = html.indexOf('Phase 2A: v2a UI', v25Start);
const v25End = html.lastIndexOf('}', v2aCommentPos) + 1;
const v25Code = html.slice(v25Start, v25End);

// ===== 抽取「第二轮优化 第二期」代码段 =====
const tidyStart = html.indexOf('function obsListTidyTopics');
const tidyEndMarker = html.indexOf('V5.5 Observatory UI: 4 Tab', tidyStart);
const tidyEnd = html.lastIndexOf('/*', tidyEndMarker); // 切到 V5.5 注释块 /* 之前
const tidyCode = html.slice(tidyStart, tidyEnd);
if (!tidyCode || tidyCode.length < 200) {
  console.error('FAIL: 未抽取到第二期待整理主题代码段');
  process.exit(2);
}

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
  saveLocal: function () { /* no-op */ },
  supaSilentWrite: function () { /* no-op */ },
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

sandbox.localStorage.clear();
const V25_KEY = 'wb_topic_analytics_v25';
sandbox.localStorage.setItem(V25_KEY, JSON.stringify({
  schema_version: 1, created_at: null, topics: [], topic_links: [], topic_events: [],
  backfill_meta: { topics_added: 0, links_added: 0, events_added: 0, last_run: null }
}));

for (const [name, code] of [['v25', v25Code], ['tidy', tidyCode]]) {
  try { vm.runInContext(code, sandbox, { filename: name + '.js' }); }
  catch (e) { console.error('FAIL: 注入 ' + name + ' 模块抛错:', e.message, e.stack); process.exit(2); }
}

for (const fn of ['obsListTidyTopics', 'obsTidyKeep', 'obsTidyRemove', 'obsTidyMerge']) {
  if (typeof sandbox[fn] !== 'function') { console.error('FAIL: ' + fn + ' 未注入'); process.exit(2); }
}

const report = [];
function check(id, name, cond, detail) {
  report.push({ id, name, passed: !!cond, detail: detail || '' });
  console.log('  #' + id + ' ' + (cond ? '✓' : '✗') + ' ' + name + (detail && !cond ? '  [' + detail + ']' : ''));
}
const TR = sandbox.storeState.tableRecords;

// ===== 准备数据 =====
// 主表 topics：A/B 为 _auto 标题型主题，C/D 为正式主题
TR.topics.push({ _id: 'A', '主题名': '深度学习实战', '类型': '聚焦', '治理状态': 'active', '分析状态': 'Emerging', '_auto': true });
TR.topics.push({ _id: 'B', '主题名': 'Agent 评估实验室', '类型': '领域', '治理状态': 'active', '分析状态': 'Emerging', '_auto': true });
TR.topics.push({ _id: 'C', '主题名': '机器学习', '类型': '领域', '别名': '', '治理状态': 'active', '分析状态': 'Developing' });
TR.topics.push({ _id: 'D', '主题名': '写作', '类型': '方法', '治理状态': 'active', '分析状态': 'Developing' });
// 原始记录
TR.courses.push({ _id: 'c1', '课程名': '深度学习实战', '开始': '2026-09-01' });
TR.study_notes.push({ _id: 'n1', '标题': 'Transformer 笔记', '日期': '2026-10-10' });
TR.projects.push({ _id: 'p1', '项目名': 'Agent 评估实验室', '状态': '进行中' });
TR.media.push({ _id: 'm1', '标题': '《置身事内》', '类型': '书' });
// 主表事件
TR.topic_events.push({ _id: 'eA1', '来源表': 'courses', '来源记录 ID': 'c1', '主题 ID': 'A', '主题角色': 'primary', '阶段': 'E2 Learn', '分类来源': 'rule' });
TR.topic_events.push({ _id: 'eA2', '来源表': 'study_notes', '来源记录 ID': 'n1', '主题 ID': 'A', '主题角色': 'primary', '阶段': 'E2 Learn', '分类来源': 'rule' });
TR.topic_events.push({ _id: 'eB1', '来源表': 'projects', '来源记录 ID': 'p1', '主题 ID': 'B', '主题角色': 'primary', '阶段': 'E4 Apply', '分类来源': 'rule' });
TR.topic_events.push({ _id: 'eC1', '来源表': 'courses', '来源记录 ID': 'c1', '主题 ID': 'C', '主题角色': 'primary', '阶段': 'E2 Learn', '分类来源': 'user' });
TR.topic_events.push({ _id: 'eD1', '来源表': 'media', '来源记录 ID': 'm1', '主题 ID': 'D', '主题角色': 'primary', '阶段': 'E1 Explore', '分类来源': 'rule' });
// 影子存储：A/B 有 topic + link + event
let v25 = sandbox.v25_loadStore();
v25.topics.push({ _id: 'A', name: '深度学习实战', type: '聚焦' });
v25.topics.push({ _id: 'B', name: 'Agent 评估实验室', type: '领域' });
v25.topic_links.push({ _id: 'lA', record_type: 'courses', record_id: 'c1', topic_id: 'A', topic_role: 'core', review_status: 'confirmed' });
v25.topic_links.push({ _id: 'lB', record_type: 'projects', record_id: 'p1', topic_id: 'B', topic_role: 'core', review_status: 'confirmed' });
v25.topic_events.push({ _id: 'veA', topic_id: 'A', stage: 'E2 Learn' });
v25.topic_events.push({ _id: 'veB', topic_id: 'B', stage: 'E4 Apply' });
sandbox.v25_saveStore(v25);

// ===== 测试 1：候选识别 =====
const cands = sandbox.obsListTidyTopics();
check(1, 'obsListTidyTopics 识别 2 个 _auto 主题', cands.length === 2, 'got ' + cands.length);
check(1.1, '候选包含 A', cands.some(t => t._id === 'A'));
check(1.2, '候选包含 B', cands.some(t => t._id === 'B'));
check(1.3, '候选不含正式主题 C/D', !cands.some(t => t._id === 'C' || t._id === 'D'));

// ===== 测试 2：保留 A =====
const rKeep = sandbox.obsTidyKeep('A');
check(2, 'obsTidyKeep 返回 ok', rKeep.ok === true);
const A_after_keep = TR.topics.find(t => t._id === 'A');
check(2.1, '保留后 A 的 _auto 被移除', A_after_keep && A_after_keep._auto === undefined);
check(2.2, '保留后 A 治理状态 = active', A_after_keep && A_after_keep['治理状态'] === 'active');
check(2.3, '保留后候选只剩 B', sandbox.obsListTidyTopics().length === 1 && sandbox.obsListTidyTopics()[0]._id === 'B');

// ===== 测试 3：移除 B =====
const projectsBefore = TR.projects.length;
const rRemove = sandbox.obsTidyRemove('B');
check(3, 'obsTidyRemove 返回 ok', rRemove.ok === true);
check(3.1, 'B 主题从主表删除', !TR.topics.some(t => t._id === 'B'));
check(3.2, 'B 的事件从主表删除', !TR.topic_events.some(e => e['主题 ID'] === 'B'));
check(3.3, '原始记录 projects 保留', TR.projects.length === projectsBefore && TR.projects.some(p => p._id === 'p1'));
let v25AfterRemove = sandbox.v25_loadStore();
check(3.4, '影子存储 B 主题被清理', !v25AfterRemove.topics.some(t => t._id === 'B'));
check(3.5, '影子存储 B 关联被清理', !v25AfterRemove.topic_links.some(l => l.topic_id === 'B'));
check(3.6, '影子存储 B 事件被清理', !v25AfterRemove.topic_events.some(e => e.topic_id === 'B'));

// ===== 测试 4：合并（A 合并到 C，含三元组去重 + 别名合并）=====
// A 有 courses+c1 和 study_notes+n1 两个事件；C 已有 courses+c1 事件 → 迁移时 courses+c1 应去重丢弃，study_notes+n1 迁移
const rMerge = sandbox.obsTidyMerge('A', 'C');
check(4, 'obsTidyMerge 返回 ok', rMerge.ok === true);
check(4.1, '迁移 1 条事件（study_notes+n1；courses+c1 因三元组去重丢弃）', rMerge.migrated === 1, 'got ' + rMerge.migrated);
check(4.2, '源主题 A 已删除', !TR.topics.some(t => t._id === 'A'));
check(4.3, '目标主题 C 仍在', TR.topics.some(t => t._id === 'C'));
const cEvents = TR.topic_events.filter(e => e['主题 ID'] === 'C');
check(4.4, 'C 现有 2 条事件（原 courses+c1 + 迁移 study_notes+n1）', cEvents.length === 2, 'got ' + cEvents.length);
check(4.5, '迁移事件 study_notes+n1 归入 C', cEvents.some(e => e['来源表'] === 'study_notes' && e['来源记录 ID'] === 'n1'));
check(4.6, '无重复的 courses+c1 事件（去重生效）', cEvents.filter(e => e['来源表'] === 'courses' && e['来源记录 ID'] === 'c1').length === 1);
const C_after = TR.topics.find(t => t._id === 'C');
check(4.7, 'C 别名合并了源主题名「深度学习实战」', C_after && String(C_after['别名']).indexOf('深度学习实战') >= 0);
// 影子存储 topic_id 迁移
let v25AfterMerge = sandbox.v25_loadStore();
check(4.8, '影子 topic_links 中 A 已迁移为 C', v25AfterMerge.topic_links.some(l => l.topic_id === 'C' && l._id === 'lA'));
check(4.9, '影子 topic_events 中 A 已迁移为 C', v25AfterMerge.topic_events.some(e => e.topic_id === 'C' && e._id === 'veA'));
check('4.10', '影子 topics 中 A 已删除', !v25AfterMerge.topics.some(t => t._id === 'A'));

// ===== 测试 5：非法合并（同 ID / 不存在）=====
check(5, '合并同 ID 返回 error', sandbox.obsTidyMerge('C', 'C').ok === false);
check(5.1, '合并不存在的源主题返回 error', sandbox.obsTidyMerge('X', 'C').ok === false);

console.log('\n===== v2f 待整理主题 集成测试 =====');
const passed = report.filter(r => r.passed).length;
console.log('Total: ' + report.length + ' | Passed: ' + passed + ' | Failed: ' + (report.length - passed));
process.exit(report.every(r => r.passed) ? 0 : 1);
