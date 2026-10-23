// v2b_test.js — 2026-10-10 修复冒烟测试
// 覆盖：
//   1. v2a_applyRoleOverridesToStore：Picker 勾选 → 真实 link + event（修复「勾了白勾」）
//   2. 未选中 link 降级 ambient + event 移除（用户显式控制）
//   3. 显式清空（空 roles）→ 全部降级
//   4. v2a_inheritHabitLinks：打卡继承习惯主题 → Practice/E4 事件
//   5. stashPendingNew / applyPendingNew：新建记录主题落到真实 _id
//   6. '__new__' 防呆：applyRoleOverridesToStore 拒绝占位 id
// 复用 v2a_test.js 的模块抽取 + vm 沙箱模式

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', '生活站.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

// ===== 模块抽取（与 v2a_test.js 相同策略） =====
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

console.log('[extract] v2:', v2Code.length, 'v25:', v25Code.length, 'v2a:', v2aCode.length);

// ===== mocks =====
const localStorageMock = (() => {
  const store = {};
  return {
    getItem: (k) => k in store ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
  };
})();
const escapeHTML = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sandbox = {
  console, localStorage: localStorageMock, Date, Math, JSON, Object, Array, String,
  Number, Boolean, RegExp, Error, Promise, parseFloat, parseInt, isNaN, isFinite,
  setTimeout, clearTimeout, setInterval, clearInterval,
  escapeHTML, toast: function() {},
  $modalRoot: { innerHTML: '' },
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

// 注入：v2 → v25 → v2a（顺序依赖）
for (const [name, code] of [['v2', v2Code], ['v25', v25Code], ['v2a', v2aCode]]) {
  try { vm.runInContext(code, sandbox, { filename: name + '.js' }); }
  catch (e) { console.error('FAIL: 注入 ' + name + ' 模块时抛错:', e.message); process.exit(2); }
}

const v2a = sandbox.window.__v2a;
const v2 = sandbox.window.__v2;
if (!v2a || !v2a.applyRoleOverridesToStore) { console.error('FAIL: window.__v2a.applyRoleOverridesToStore 未暴露'); process.exit(2); }

// ===== 测试辅助 =====
const report = [];
function check(id, name, cond, detail) {
  report.push({ id, name, passed: !!cond, detail: detail || '' });
}
function loadStore() { return JSON.parse(localStorageMock.getItem('wb_topic_analytics_v25')); }
function seedTopic(id, name) {
  const s = loadStore();
  if (!s.topics.some(t => t._id === id)) s.topics.push({ _id: id, name: name, type: '领域' });
  localStorageMock.setItem('wb_topic_analytics_v25', JSON.stringify(s));
}
function resetAll() {
  localStorageMock.clear();
  localStorageMock.setItem('wb_topic_analytics_v25', JSON.stringify({
    schema_version: 1, created_at: null, topics: [], topic_links: [], topic_events: [],
    backfill_meta: { topics_added: 0, links_added: 0, events_added: 0, last_run: null }
  }));
  sandbox.storeState.tableRecords.courses = [];
  sandbox.storeState.tableRecords.study_habits = [];
  sandbox.storeState.tableRecords.study_checkins = [];
}

// ===== 测试 1：Picker 勾选 → 真实 link + event =====
resetAll();
seedTopic('T1', 'IELTS');
sandbox.storeState.tableRecords.courses.push({ _id: 'c1', '课程名': '雅思冲刺', '标题': '雅思冲刺' });
const r1 = v2a.applyRoleOverridesToStore('courses', 'c1', { core: ['T1'], supporting: [] });
check(1, 'apply 返回 ok', r1 && r1.ok === true);
let s1 = loadStore();
const link1 = s1.topic_links.find(l => l.record_type === 'courses' && l.record_id === 'c1' && l.topic_id === 'T1');
check(1.1, 'link 已创建', !!link1);
check(1.2, 'link 字段正确（manual/confirmed/core/relevance=1）', link1 && link1.relation_source === 'manual' && link1.review_status === 'confirmed' && link1.topic_role === 'core' && Number(link1.relevance) === 1.0);
const ev1 = s1.topic_events.find(e => e.source_link_id === (link1 && link1._id));
check(1.3, 'event 已生成（event_key = link._id）', !!ev1 && ev1.topic_id === 'T1');
check(1.4, 'event effective_weight = 1.0', ev1 && Number(ev1.effective_weight) === 1.0);

// ===== 测试 2：未选中的推断 link 降级 ambient + event 移除 =====
// 预置一条 migrated_inference link（T2）+ 其 event
s1 = loadStore();
const infLink = {
  _id: 'link_inf_1', record_type: 'courses', record_id: 'c1', topic_id: 'T2',
  link_type: 'contextual', relevance: 0.6, confidence: 0.85,
  relation_source: 'migrated_inference', topic_role: 'core',
  review_status: 'pending', context_key: '_default', created_at: new Date().toISOString()
};
s1.topic_links.push(infLink);
s1.topic_events.push({ _id: 'ev_inf_1', event_key: 'link_inf_1', topic_id: 'T2', source_link_id: 'link_inf_1', source_record_id: 'c1', record_type: 'courses', date: '2026-10-10', stage: 'E2 Learn', nature: 'Knowledge', context_key: '_default', effective_weight: 0.51, evidence_type: 'read', created_at: new Date().toISOString() });
localStorageMock.setItem('wb_topic_analytics_v25', JSON.stringify(s1));
seedTopic('T2', 'Redis');
const r2 = v2a.applyRoleOverridesToStore('courses', 'c1', { core: ['T1'], supporting: [] });
check(2, 'apply 再次执行 ok', r2 && r2.ok);
let s2 = loadStore();
const infAfter = s2.topic_links.find(l => l._id === 'link_inf_1');
check(2.1, '未选中推断 link 降级 ambient', infAfter && infAfter.topic_role === 'ambient');
check(2.2, '其 event 已移除', !s2.topic_events.some(e => e.source_link_id === 'link_inf_1'));
const link1After = s2.topic_links.find(l => l.topic_id === 'T1' && l.record_id === 'c1');
check(2.3, '选中 link 保持 core + event 仍在', link1After && link1After.topic_role === 'core' && s2.topic_events.some(e => e.source_link_id === link1After._id));

// ===== 测试 3：显式清空（空 roles）→ 全部降级 =====
const r3 = v2a.applyRoleOverridesToStore('courses', 'c1', { core: [], supporting: [] });
check(3, '显式清空返回 ok', r3 && r3.ok);
let s3 = loadStore();
const allLinks = s3.topic_links.filter(l => l.record_type === 'courses' && l.record_id === 'c1');
check(3.1, '该记录所有非 rejected link 均 ambient', allLinks.every(l => l.topic_role === 'ambient' || l.review_status === 'rejected'));
check(3.2, '该记录 event 全部移除', !s3.topic_events.some(e => e.record_type === 'courses' && e.source_record_id === 'c1'));

// ===== 测试 4：打卡继承习惯主题 =====
resetAll();
seedTopic('T1', 'IELTS');
v2a.setOverride('study_habits', 'h1', { topic_roles: { core: ['T1'], supporting: [] }, nature: 'Knowledge' });
const ck = { _id: 'ck1', '日期': '2026-10-10', '数值': 1, '习惯 ID': 'h1' };
sandbox.storeState.tableRecords.study_checkins.push(ck);
const inherited = v2a.inheritHabitLinks('h1', ck);
check(4, '继承返回主题名列表', Array.isArray(inherited) && inherited.length === 1 && inherited[0] === 'IELTS');
let s4 = loadStore();
const ckLink = s4.topic_links.find(l => l.record_type === 'study_checkins' && l.record_id === 'ck1');
check(4.1, '打卡 link 已创建（inherited/confirmed/core）', ckLink && ckLink.relation_source === 'inherited' && ckLink.review_status === 'confirmed' && ckLink.topic_role === 'core');
const ckEv = s4.topic_events.find(e => e.source_link_id === (ckLink && ckLink._id));
check(4.2, '打卡 event 生成', !!ckEv && ckEv.topic_id === 'T1');
check(4.3, '打卡 event stage = E4 Apply', ckEv && ckEv.stage === 'E4 Apply');
check(4.4, '打卡 event nature 继承习惯覆盖（Knowledge）', ckEv && ckEv.nature === 'Knowledge');
check(4.5, '打卡 event effective = 1.0×0.9 = 0.9（≥0.40 计入 Familiarity）', ckEv && Math.abs(Number(ckEv.effective_weight) - 0.9) < 1e-6);
check(4.6, '打卡 event 日期 = 打卡日期', ckEv && ckEv.date === '2026-10-10');
// 幂等：重复继承不重复建 link
v2a.inheritHabitLinks('h1', ck);
s4 = loadStore();
check(4.7, '重复继承幂等（不重复建 link）', s4.topic_links.filter(l => l.record_type === 'study_checkins' && l.record_id === 'ck1').length === 1);

// ===== 测试 5：新建记录 pending 机制 =====
resetAll();
seedTopic('T1', 'IELTS');
v2a.setOverride('courses', '__new__', { topic_roles: { core: ['T1'], supporting: [] } });
v2a.stashPendingNew('courses');
check(5, 'stash 后 __new__ override 已清除', v2a.getOverride('courses', '__new__') === null);
// 真实流程：Store.addRecord 先把记录落表，再触发 applyPendingNew
sandbox.storeState.tableRecords.courses.push({ _id: 'c_new_1', '课程名': '新课程', '标题': '新课程' });
v2a.applyPendingNew('courses', { _id: 'c_new_1' });
const pendOv = v2a.getOverride('courses', 'c_new_1');
check(5.1, 'override 落到真实 _id', pendOv && pendOv.topic_roles && pendOv.topic_roles.core.indexOf('T1') >= 0);
let s5 = loadStore();
check(5.2, '真实 _id 的 link 已创建', s5.topic_links.some(l => l.record_type === 'courses' && l.record_id === 'c_new_1' && l.topic_id === 'T1'));
check(5.3, '真实 _id 的 event 已生成', s5.topic_events.some(e => e.record_type === 'courses' && e.source_record_id === 'c_new_1'));

// ===== 测试 6：__new__ 防呆 =====
const r6 = v2a.applyRoleOverridesToStore('courses', '__new__', { core: ['T1'], supporting: [] });
check(6, 'apply 对 __new__ 占位 id 拒绝', r6 && r6.ok === false && r6.error === 'invalid_record');

// ===== 测试 7：v2a_shouldUsePicker（新建态走 Picker，实现「新建即关联主题」）=====
check(7, '任务新建态 → Picker', v2a.shouldUsePicker('study_tasks', '__new__') === true);
check(7.1, '任务编辑态 → Chips', v2a.shouldUsePicker('study_tasks', 'real_id') === false);
check(7.2, '笔记新建态 → Picker', v2a.shouldUsePicker('study_notes', '__new__') === true);
check(7.3, '学习习惯新建态 → Picker', v2a.shouldUsePicker('study_habits', '__new__') === true);
check(7.4, '书影音新建态 → Picker', v2a.shouldUsePicker('media', '__new__') === true);
check(7.5, '项目编辑态 → 始终 Picker', v2a.shouldUsePicker('projects', 'real_id') === true);
check(7.6, '书影音编辑态 → Chips', v2a.shouldUsePicker('media', 'real_id') === false);
check(7.7, '未知类型 → 不 Picker', v2a.shouldUsePicker('topics', '__new__') === false);

// ===== 测试 8：buildHeatmapHTML（GitHub 贡献图）=====
const hmFnStart = html.indexOf('function buildHeatmapHTML(logs, title) {');
if (hmFnStart < 0) { console.error('FAIL: buildHeatmapHTML 未找到'); process.exit(2); }
const hmBodyStart = html.indexOf('{', hmFnStart) + 1;
let hmDepth = 1, hmEndPos = -1;
for (let i = hmBodyStart; i < html.length; i++) {
  if (html[i] === '{') hmDepth++;
  else if (html[i] === '}') { hmDepth--; if (hmDepth === 0) { hmEndPos = i + 1; break; } }
}
const hmCode = html.slice(hmFnStart, hmEndPos);
sandbox.todayStr = function() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
};
try { vm.runInContext(hmCode, sandbox, { filename: 'buildHeatmapHTML.js' }); }
catch (e) { console.error('FAIL: 注入 buildHeatmapHTML 抛错:', e.message); process.exit(2); }
const todayDs = sandbox.todayStr();
const hmHtml = sandbox.buildHeatmapHTML([{ '日期': todayDs }, { '日期': '2026-10-12' }], '测试热力图');
const hmCellCount = (hmHtml.match(/class="cell/g) || []).length;
check(8, '含月份标签', hmHtml.indexOf('hm-month') >= 0);
check(8.1, '含星期标签', hmHtml.indexOf('hm-week') >= 0);
check(8.2, '含今天高亮', hmHtml.indexOf(' today') >= 0);
check(8.3, 'cell 数 ≈ 30 周（210~217）', hmCellCount >= 210 && hmCellCount <= 217);
check(8.4, '含星期中文标记 一/三/五', hmHtml.indexOf('>一<') >= 0 && hmHtml.indexOf('>三<') >= 0 && hmHtml.indexOf('>五<') >= 0);
check(8.5, '今天 cell 有填色（今天有打卡）', hmHtml.indexOf('today" title="' + todayDs) >= 0);
check(8.6, '标题正确', hmHtml.indexOf('<h4>测试热力图</h4>') >= 0);

// ===== 输出 =====
const allPassed = report.every(r => r.passed);
const passedCount = report.filter(r => r.passed).length;
console.log('\n===== v2b 修复冒烟测试报告 =====');
report.forEach(r => {
  console.log('  #' + r.id + ' ' + (r.passed ? '✓' : '✗') + ' ' + r.name + (r.detail && !r.passed ? '  [' + r.detail + ']' : ''));
});
console.log('---');
console.log('Total: ' + report.length + ' | Passed: ' + passedCount + ' | Failed: ' + (report.length - passedCount));
console.log('Overall: ' + (allPassed ? '✓ ALL PASS' : '✗ FAIL'));

const outDir = path.join(ROOT, '.workbuddy', 'output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'v2b-test-report.json'), JSON.stringify({
  schema_version: 1, test_mode: 'v2b', timestamp: new Date().toISOString(),
  total: report.length, passed: passedCount, failed: report.length - passedCount, all_passed: allPassed, report
}, null, 2));

process.exit(allPassed ? 0 : 1);
