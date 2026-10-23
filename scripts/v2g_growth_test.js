// v2g_growth_test.js — 第三期「退役演化/转化 + 12 周柱状图 + 成长路径」测试
// 覆盖：导航退役 / 死代码删除 / obsWeeklySeries 周聚合 / obsGrowthPath 四步映射
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', '生活站.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

const report = [];
function check(id, name, cond, detail) {
  report.push({ id, name, passed: !!cond, detail: detail || '' });
  console.log('  #' + id + ' ' + (cond ? '✓' : '✗') + ' ' + name + (detail && !cond ? '  [' + detail + ']' : ''));
}

// ============ 一、静态断言 ============

// 1. 导航 GROUPS 已删 obs_evolution / obs_conversion 两个子项
const obsGroupIdx = html.indexOf("key: 'obs', label: '主题发展'");
const obsGroupEnd = html.indexOf(']', obsGroupIdx);
const obsGroup = html.slice(obsGroupIdx, obsGroupEnd);
check(1, '导航已删 obs_evolution', obsGroup.indexOf('obs_evolution') < 0);
check(1.1, '导航已删 obs_conversion', obsGroup.indexOf('obs_conversion') < 0);
check(1.2, '导航保留 obs_universe + obs_connections', obsGroup.indexOf('obs_universe') >= 0 && obsGroup.indexOf('obs_connections') >= 0);

// 2. 退役页面渲染函数已删除
check(2, 'renderObsEvolution 已删除', html.indexOf('function renderObsEvolution') < 0);
check(2.1, 'renderObsConversion 已删除', html.indexOf('function renderObsConversion') < 0);
check(2.2, 'renderV6EvolutionChart 已删除', html.indexOf('function renderV6EvolutionChart') < 0);
check(2.3, 'renderV6Funnel 已删除', html.indexOf('function renderV6Funnel') < 0);
check(2.4, 'renderTrueConversionFunnel 已删除', html.indexOf('function renderTrueConversionFunnel') < 0);
check(2.5, 'renderLineageSection 已删除', html.indexOf('function renderLineageSection') < 0);
check(2.6, 'renderGovEntry 已删除', html.indexOf('function renderGovEntry') < 0);
check(2.7, '旧主题画像 renderTopicProfile 已删除', html.indexOf('function renderTopicProfile') < 0);

// 3. 治理台保留（独立功能，被 window.__v5 暴露）
check(3, 'openGovernanceModal 保留', html.indexOf('function openGovernanceModal') >= 0);
check(3.1, 'renderGovContent 保留', html.indexOf('function renderGovContent') >= 0);

// 4. 新增函数存在
check(4, 'obsWeeklySeries 存在', html.indexOf('function obsWeeklySeries') >= 0);
check(4.1, 'obsGrowthPath 存在', html.indexOf('function obsGrowthPath') >= 0);
check(4.2, 'renderGrowthWeeklyChart 存在', html.indexOf('function renderGrowthWeeklyChart') >= 0);
check(4.3, 'renderGrowthPath 存在', html.indexOf('function renderGrowthPath') >= 0);

// 5. renderGrowthDetail 集成新图表与路径
const gdIdx = html.indexOf('function renderGrowthDetail');
const gdEnd = html.indexOf('function renderObsUniverse', gdIdx);
const gdBody = html.slice(gdIdx, gdEnd);
check(5, 'renderGrowthDetail 调用 obsWeeklySeries', gdBody.indexOf('obsWeeklySeries(item.topicId') >= 0);
check(5.1, 'renderGrowthDetail 调用 obsGrowthPath', gdBody.indexOf('obsGrowthPath(item.topicId') >= 0);
check(5.2, 'renderGrowthDetail 渲染 12 周图', gdBody.indexOf('renderGrowthWeeklyChart(series)') >= 0);
check(5.3, 'renderGrowthDetail 渲染成长路径', gdBody.indexOf('renderGrowthPath(path)') >= 0);

// 6. renderObservatoryShell 只分发两个页面
const shellIdx = html.indexOf('function renderObservatoryShell');
const shellEnd = html.indexOf('function openGovernanceModal', shellIdx);
const shellBody = html.slice(shellIdx, shellEnd);
check(6, 'shell 不再分发 obs_evolution', shellBody.indexOf("'obs_evolution'") < 0);
check(6.1, 'shell 不再分发 obs_conversion', shellBody.indexOf("'obs_conversion'") < 0);
check(6.2, 'shell 保留 obs_universe + obs_connections 分发', shellBody.indexOf("'obs_universe'") >= 0 && shellBody.indexOf("'obs_connections'") >= 0);

// ============ 二、纯函数抽取：obsParseLocalDate / obsWeekStartOf / obsWeeklySeries / obsGrowthPath ============
const pureStart = html.indexOf('function obsParseLocalDate');
const pureEnd = html.indexOf('function renderGrowthWeeklyChart', pureStart);
const pureCode = html.slice(pureStart, pureEnd);

const sandbox = {
  console, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
  parseFloat, parseInt, isNaN, isFinite,
  escapeHTML: function(s){ return s == null ? '' : String(s); }
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;

// stub 依赖：topicEvents / obsFindSourceRecord / obsEventIsRealized / obsContributionWeight / obsRecordTitle
let TEST_EVENTS = [];
let TEST_RECORDS = {};   // table|id -> record
let realizedFn = function(e, rec){ return true; };
let weightFn = function(e, rec){ return 1.0; };
sandbox.topicEvents = function(){ return TEST_EVENTS.filter(function(e){ return e && e['主题 ID']; }); };
sandbox.obsFindSourceRecord = function(e){ return TEST_RECORDS[e['来源表'] + '|' + e['来源记录 ID']] || null; };
sandbox.obsEventIsRealized = function(e, rec){ return realizedFn(e, rec); };
sandbox.obsContributionWeight = function(e, rec){ return weightFn(e, rec); };
sandbox.obsRecordTitle = function(table, r){ return r ? (r['标题'] || r['项目名'] || r['课程名'] || '记录') : '记录'; };

vm.createContext(sandbox);
try {
  vm.runInContext(pureCode, sandbox, { filename: 'growth-pure.js' });
} catch (e) { console.error('FAIL: 注入成长路径纯函数抛错:', e.message); process.exit(2); }

// 工具：本地日期字符串（避免 UTC 偏移）
function dstr(y, m, dd) { return y + '-' + String(m).padStart(2,'0') + '-' + String(dd).padStart(2,'0'); }
function thisMonday() {
  var t = new Date();
  var d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function fmt(d) { return dstr(d.getFullYear(), d.getMonth()+1, d.getDate()); }
function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }

// 测试 7：obsWeekStartOf 周一映射
(function(){
  var wed = new Date(2026, 9, 21); // 2026-10-21 是周三
  var ws = sandbox.obsWeekStartOf(wed);
  check(7, 'obsWeekStartOf 把周三归到本周一', ws.getDay() === 1 && fmt(ws) === '2026-10-19', 'got ' + fmt(ws));
  var sun = new Date(2026, 9, 25); // 周日
  var ws2 = sandbox.obsWeekStartOf(sun);
  check(7.1, 'obsWeekStartOf 把周日归到本周一', ws2.getDay() === 1 && fmt(ws2) === '2026-10-19', 'got ' + fmt(ws2));
})();

// 测试 8：obsParseLocalDate 本地解析（无 UTC 偏移）
(function(){
  var d = sandbox.obsParseLocalDate('2026-10-19');
  check(8, 'obsParseLocalDate 解析为本地日期', d && d.getFullYear() === 2026 && d.getMonth() === 9 && d.getDate() === 19);
  check(8.1, 'obsParseLocalDate 空值返回 null', sandbox.obsParseLocalDate('') === null);
  check(8.2, 'obsParseLocalDate 非法值返回 null', sandbox.obsParseLocalDate('abc') === null);
})();

// 测试 9：obsWeeklySeries 周聚合 + primary/secondary 拆分
(function(){
  var monday = thisMonday();
  var thisWeekDate = fmt(addDays(monday, 1));       // 本周二
  var lastWeekDate = fmt(addDays(monday, -6));       // 上周二
  var olderDate = fmt(addDays(monday, -20));         // 三周前（在 12 周窗口内）
  TEST_RECORDS = {
    'courses|r1': { '课程名': '深度学习' },
    'courses|r2': { '课程名': '语音识别' },
    'projects|p1': { '项目名': 'Agent 评估' }
  };
  TEST_EVENTS = [
    { '主题 ID': 'T1', '来源表': 'courses', '来源记录 ID': 'r1', '日期': thisWeekDate, '阶段': 'E2 Learn', '主题角色': 'primary' },
    { '主题 ID': 'T1', '来源表': 'courses', '来源记录 ID': 'r2', '日期': thisWeekDate, '阶段': 'E2 Learn', '主题角色': 'secondary' },
    { '主题 ID': 'T1', '来源表': 'projects', '来源记录 ID': 'p1', '日期': lastWeekDate, '阶段': 'E4 Apply', '主题角色': 'primary' },
    { '主题 ID': 'T1', '来源表': 'courses', '来源记录 ID': 'r1', '日期': olderDate, '阶段': 'E2 Learn', '主题角色': 'primary' },
    { '主题 ID': 'T2', '来源表': 'courses', '来源记录 ID': 'r1', '日期': thisWeekDate, '阶段': 'E2 Learn', '主题角色': 'primary' }
  ];
  weightFn = function(){ return 1.0; };
  var series = sandbox.obsWeeklySeries('T1', 12);
  check(9, 'obsWeeklySeries 返回 12 周', series.length === 12, 'got ' + series.length);
  // 本周桶（最后一个）应有 2 条（1 primary + 1 secondary），但 T2 事件被过滤
  var last = series[11];
  check(9.1, '本周桶 primary=1（T2 事件被主题过滤）', last.primary === 1, 'got ' + last.primary);
  check(9.2, '本周桶 secondary=1', last.secondary === 1, 'got ' + last.secondary);
  check(9.3, '本周桶 total=2', last.total === 2, 'got ' + last.total);
  check(9.4, '本周桶 records 2 条', last.records.length === 2, 'got ' + last.records.length);
  // 上周桶（倒数第二个）
  var prev = series[10];
  check(9.5, '上周桶 primary=1', prev.primary === 1, 'got ' + prev.primary);
  check(9.6, '上周桶 secondary=0', prev.secondary === 0, 'got ' + prev.secondary);
  // 更早桶（olderDate 在 12 周窗口内，落在对应桶）
  var totalAll = series.reduce(function(s,w){ return s + w.total; }, 0);
  check(9.7, '12 周总贡献 = 4（含 olderDate 那条）', totalAll === 4, 'got ' + totalAll);
})();

// 测试 10：obsWeeklySeries 只统计已完成事件（未完成被过滤）
(function(){
  var monday = thisMonday();
  var d = fmt(addDays(monday, 1));
  TEST_RECORDS = { 'projects|p1': { '项目名': '未完成项目', '状态': '进行中' } };
  TEST_EVENTS = [
    { '主题 ID': 'T1', '来源表': 'projects', '来源记录 ID': 'p1', '日期': d, '阶段': 'E4 Apply', '主题角色': 'primary' }
  ];
  realizedFn = function(e, rec){ return false; }; // 全部未完成
  var series = sandbox.obsWeeklySeries('T1', 12);
  var total = series.reduce(function(s,w){ return s + w.total; }, 0);
  check(10, '未完成事件不进周聚合（total=0）', total === 0, 'got ' + total);
  realizedFn = function(e, rec){ return true; };
})();

// 测试 11：obsWeeklySeries 空数据返回 12 个全 0 桶（不崩）
(function(){
  TEST_EVENTS = [];
  var series = sandbox.obsWeeklySeries('T1', 12);
  var total = series.reduce(function(s,w){ return s + w.total; }, 0);
  check(11, '空数据返回 12 桶全 0', series.length === 12 && total === 0);
})();

// 测试 12：obsGrowthPath 四步映射
(function(){
  TEST_RECORDS = {
    'media|m1': { '标题': '论文' },
    'courses|c1': { '课程名': '课程章节' },
    'projects|p1': { '项目名': '实验' },
    'projects|p2': { '项目名': '报告' }
  };
  TEST_EVENTS = [
    { '主题 ID': 'T1', '来源表': 'media', '来源记录 ID': 'm1', '日期': '2026-10-01', '阶段': 'E1 Explore', '主题角色': 'primary' },
    { '主题 ID': 'T1', '来源表': 'courses', '来源记录 ID': 'c1', '日期': '2026-10-05', '阶段': 'E2 Learn', '主题角色': 'primary' },
    { '主题 ID': 'T1', '来源表': 'projects', '来源记录 ID': 'p1', '日期': '2026-10-10', '阶段': 'E4 Apply', '主题角色': 'primary' },
    { '主题 ID': 'T1', '来源表': 'projects', '来源记录 ID': 'p2', '日期': '2026-10-15', '阶段': 'E5 Output', '主题角色': 'primary' }
  ];
  realizedFn = function(){ return true; };
  var path = sandbox.obsGrowthPath('T1');
  check(12, 'obsGrowthPath 返回 4 步', path.steps.length === 4, 'got ' + path.steps.length);
  check(12.1, '四步顺序：接触→学习→实践→产出', path.steps[0].label === '接触' && path.steps[1].label === '学习' && path.steps[2].label === '实践' && path.steps[3].label === '产出');
  check(12.2, '接触(E1) 1 条证据', path.steps[0].count === 1 && path.steps[0].evidence[0].title === '论文', JSON.stringify(path.steps[0].evidence));
  check(12.3, '学习(E2) 1 条证据', path.steps[1].count === 1 && path.steps[1].evidence[0].title === '课程章节');
  check(12.4, '实践(E4) 1 条证据', path.steps[2].count === 1 && path.steps[2].evidence[0].title === '实验');
  check(12.5, '产出(E5) 1 条证据', path.steps[3].count === 1 && path.steps[3].evidence[0].title === '报告');
  check(12.6, '四阶段都有证据 → activeCount=4', path.activeCount === 4, 'got ' + path.activeCount);
})();

// 测试 13：E3 并入「学习」、E6 并入「产出」
(function(){
  TEST_RECORDS = {
    'courses|c1': { '课程名': 'E3 笔记' },
    'projects|p1': { '项目名': 'E6 复用' }
  };
  TEST_EVENTS = [
    { '主题 ID': 'T1', '来源表': 'courses', '来源记录 ID': 'c1', '日期': '2026-10-05', '阶段': 'E3 Synthesize', '主题角色': 'primary' },
    { '主题 ID': 'T1', '来源表': 'projects', '来源记录 ID': 'p1', '日期': '2026-10-10', '阶段': 'E6 Reuse', '主题角色': 'primary' }
  ];
  var path = sandbox.obsGrowthPath('T1');
  check(13, 'E3 Synthesize 计入「学习」', path.steps[1].count === 1, 'got ' + path.steps[1].count);
  check(13.1, 'E6 Reuse 计入「产出」', path.steps[3].count === 1, 'got ' + path.steps[3].count);
  check(13.2, '两阶段有证据 → activeCount=2', path.activeCount === 2, 'got ' + path.activeCount);
})();

// 测试 14：单一阶段 → activeCount=1（渲染层会显示提示而非路径）
(function(){
  TEST_RECORDS = { 'courses|c1': { '课程名': '只学了一门课' } };
  TEST_EVENTS = [
    { '主题 ID': 'T1', '来源表': 'courses', '来源记录 ID': 'c1', '日期': '2026-10-05', '阶段': 'E2 Learn', '主题角色': 'primary' }
  ];
  var path = sandbox.obsGrowthPath('T1');
  check(14, '单一阶段 activeCount=1', path.activeCount === 1, 'got ' + path.activeCount);
  check(14.1, 'firstActive = 学习', path.firstActive && path.firstActive.label === '学习');
})();

// 测试 15：证据去重（同标题+同日期只计一次）
(function(){
  TEST_RECORDS = { 'courses|c1': { '课程名': '重复课程' } };
  TEST_EVENTS = [
    { '主题 ID': 'T1', '来源表': 'courses', '来源记录 ID': 'c1', '日期': '2026-10-05', '阶段': 'E2 Learn', '主题角色': 'primary' },
    { '主题 ID': 'T1', '来源表': 'courses', '来源记录 ID': 'c1', '日期': '2026-10-05', '阶段': 'E3 Synthesize', '主题角色': 'primary' }
  ];
  var path = sandbox.obsGrowthPath('T1');
  check(15, '同标题同日期证据去重', path.steps[1].evidence.length === 1, 'got ' + path.steps[1].evidence.length);
})();

console.log('\n===== v2g 退役演化/转化 + 成长路径 测试 =====');
const passed = report.filter(r => r.passed).length;
console.log('Total: ' + report.length + ' | Passed: ' + passed + ' | Failed: ' + (report.length - passed));
process.exit(report.every(r => r.passed) ? 0 : 1);
