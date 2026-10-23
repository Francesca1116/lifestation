// v2c_yearplan_test.js — 学习目标（year_plan）主题关联 DOM 集成测试
// 用 vm + jsdom document 复现：openYearPlanModal 注入 Picker → 勾选 → collect → apply
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', '生活站.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

// ===== 抽取 v25 / v2a / v2 模块 =====
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

// ===== jsdom =====
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="modalRoot"></div></body></html>', { url: 'http://localhost/' });
const jdWindow = dom.window;
const jdDocument = jdWindow.document;

// ===== sandbox（vm 方式，复用 v2b_test 已验证的策略）=====
const sandbox = {
  console,
  Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
  Promise, parseFloat, parseInt, isNaN, isFinite,
  setTimeout, clearTimeout, setInterval, clearInterval,
  // DOM 相关指向 jsdom
  document: jdDocument,
  localStorage: jdWindow.localStorage,
  $modalRoot: jdDocument.getElementById('modalRoot'),
  escapeHTML: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); },
  toast: function () {},
  uid: function () { return 'id_' + Math.random().toString(36).slice(2, 10); },
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

// 注入模块
for (const [name, code] of [['v2', v2Code], ['v25', v25Code], ['v2a', v2aCode]]) {
  try { vm.runInContext(code, sandbox, { filename: name + '.js' }); }
  catch (e) { console.error('FAIL: 注入 ' + name + ' 模块抛错:', e.message, e.stack); process.exit(2); }
}

const v2a = sandbox.window.__v2a;
if (!v2a || !v2a.renderTopicContextPicker || !v2a.injectIntoModal) {
  console.error('FAIL: window.__v2a 关键方法未暴露');
  process.exit(2);
}

const report = [];
function check(id, name, cond, detail) {
  report.push({ id, name, passed: !!cond, detail: detail || '' });
  console.log('  #' + id + ' ' + (cond ? '✓' : '✗') + ' ' + name + (detail && !cond ? '  [' + detail + ']' : ''));
}

// 种子：两个主题 + 一条 year_plan 记录
sandbox.storeState.tableRecords.topics.push(
  { _id: 'T1', '主题名': 'IELTS', '类型': '领域' },
  { _id: 'T2', '主题名': '日语', '类型': '领域' }
);
sandbox.storeState.tableRecords.year_plan.push({ _id: 'yp1', '标题': '雅思 7.0', '开始': '2026-01-01', '类型': '年度大目标' });

// 预置 override：yp1 已关联 T1 为核心主题
v2a.setOverride('year_plan', 'yp1', { topic_roles: { core: ['T1'], supporting: [] } });

// ===== 测试 1：renderTopicContextPicker 对 year_plan 正常渲染 =====
let pickerHtml = '';
try { pickerHtml = v2a.renderTopicContextPicker('year_plan', 'yp1'); }
catch (e) { check(1, 'renderTopicContextPicker 抛错', false, e.message); }
check(1, 'Picker HTML 非空', pickerHtml && pickerHtml.length > 0);
check(1.1, '含核心主题 checkbox', pickerHtml.indexOf('data-v2a-role="core"') >= 0);
check(1.2, 'T1 预勾选（core checked）', /data-v2a-role="core" data-v2a-role-ids="T1"[^>]*checked/.test(pickerHtml));
check(1.3, '含 + 新建主题按钮', pickerHtml.indexOf('data-v2a-act="new-topic"') >= 0);

// ===== 测试 2：injectIntoModal 注入到 __ypForm =====
sandbox.$modalRoot.innerHTML = '<div class="modal-bg"><div class="modal"><form id="__ypForm" onsubmit="return false"></form></div></div>';
try { v2a.injectIntoModal('year_plan', 'yp1'); }
catch (e) { check(2, 'injectIntoModal 抛错', false, e.message); }
const $form = jdDocument.getElementById('__ypForm');
const $container = $form ? $form.querySelector('.v2a-container') : null;
check(2, '__ypForm 里有 .v2a-container', !!$container);
check(2.1, 'container data-v2a-record-type=year_plan', $container && $container.getAttribute('data-v2a-record-type') === 'year_plan');
check(2.2, 'container 里 core checkbox 数 = 2', $container && $container.querySelectorAll('input[data-v2a-role="core"]').length === 2);

// ===== 测试 3：模拟「改变主题」——取消 T1，勾选 T2（含 change 事件触发）=====
const t1cb = $container.querySelector('input[data-v2a-role="core"][data-v2a-role-ids="T1"]');
const t2cb = $container.querySelector('input[data-v2a-role="core"][data-v2a-role-ids="T2"]');
check(3, 'T1 checkbox 初始 checked', t1cb && t1cb.checked === true);
check(3.1, 'T1 chip 初始有 on class（静态渲染）', t1cb.closest('.v2a-chip').classList.contains('on'));
// 模拟用户点击：取消 T1
t1cb.checked = false;
t1cb.dispatchEvent(new jdWindow.Event('change', { bubbles: true }));
check(3.2, '取消 T1 后 chip 移除 on class（change 同步）', !t1cb.closest('.v2a-chip').classList.contains('on'));
// 模拟用户点击：勾选 T2
t2cb.checked = true;
t2cb.dispatchEvent(new jdWindow.Event('change', { bubbles: true }));
check(3.3, '勾选 T2 后 chip 添加 on class（change 同步）', t2cb.closest('.v2a-chip').classList.contains('on'));

// 复现 collectOverridesFromModal 的核心查询逻辑（同款选择器）
const checks = jdDocument.querySelectorAll('.v2a-container input[data-v2a-role]:checked');
const coreIds = [], suppIds = [];
Array.prototype.slice.call(checks).forEach(function (el) {
  const role = el.getAttribute('data-v2a-role');
  const tid = el.getAttribute('data-v2a-role-ids');
  if (role === 'core') coreIds.push(tid);
  else if (role === 'supporting') suppIds.push(tid);
});
check(3.1, '改变后收集到 T2（core）', coreIds.length === 1 && coreIds[0] === 'T2');
check(3.2, 'T1 不再被收集', coreIds.indexOf('T1') < 0);

// ===== 测试 4：applyRoleOverridesToStore 改变主题（T1→T2）=====
const r4 = v2a.applyRoleOverridesToStore('year_plan', 'yp1', { core: ['T2'], supporting: [] });
check(4, 'apply 改变返回 ok', r4 && r4.ok === true);
const s4 = JSON.parse(sandbox.localStorage.getItem('wb_topic_analytics_v25'));
const linkT2 = s4.topic_links.find(l => l.record_type === 'year_plan' && l.record_id === 'yp1' && l.topic_id === 'T2');
check(4.1, 'T2 的 link 已创建（core）', !!linkT2 && linkT2.topic_role === 'core');
const evT2 = s4.topic_events.find(e => e.source_link_id === (linkT2 && linkT2._id));
check(4.2, 'T2 的 event 已生成', !!evT2 && evT2.topic_id === 'T2');

// ===== 测试 5：旧 T1 不残留 core link =====
const t1Link = s4.topic_links.find(l => l.record_type === 'year_plan' && l.record_id === 'yp1' && l.topic_id === 'T1');
check(5, 'T1 不残留 core link（未在 selected 中）', !t1Link || t1Link.topic_role !== 'core');

// ===== 测试 7：Picker 注入到 form 顶部 =====
check(7, 'Picker 是 form 的第一个元素（顶部，不被节点任务压到底下）', $form.firstElementChild === $container);

console.log('\n===== v2c 学习目标主题关联集成测试 =====');
const passed = report.filter(r => r.passed).length;
console.log('Total: ' + report.length + ' | Passed: ' + passed + ' | Failed: ' + (report.length - passed));
process.exit(report.every(r => r.passed) ? 0 : 1);
