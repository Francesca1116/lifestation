// v2i_dashboard_boards_test.js — 第五期「主页三看板（领域投入/知识转化/成果证据）」测试
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

// 1. 主页板块入口卡已移除（入口在左侧 sidebar）
const shellIdx = html.indexOf('<section class="dashboard-shell active" id="dashShell">');
const shellEnd = html.indexOf('<!-- === Group shell', shellIdx);
const shellBody = html.slice(shellIdx, shellEnd);
check(1, 'dashShell 无 boardsGrid', shellBody.indexOf('boardsGrid') < 0);
check(1.1, 'dashShell 无 板块入口 标题', shellBody.indexOf('板块入口') < 0);
check(1.2, 'renderDashboard 无 board-card 渲染', html.slice(html.indexOf('function renderDashboard'), html.indexOf('function renderSubBar')).indexOf('board-card') < 0);

// 2. 三看板容器存在
check(2, 'dashDomainOverview 容器', shellBody.indexOf('id="dashDomainOverview"') >= 0);
check(2.1, 'dashKnowledge 容器', shellBody.indexOf('id="dashKnowledge"') >= 0);
check(2.2, 'dashEvidence 容器', shellBody.indexOf('id="dashEvidence"') >= 0);
check(2.3, '7/30/90 周期切换', shellBody.indexOf('data-domain-days="7"') >= 0 && shellBody.indexOf('data-domain-days="30"') >= 0 && shellBody.indexOf('data-domain-days="90"') >= 0);

// 3. 新函数存在
['v2h_domainOverview', 'v2h_knowledgeConversion', 'v2h_progressEvidence', 'v2h_linkedProjectNames',
 'renderDashDomainOverview', 'renderDashKnowledge', 'renderDashEvidence', 'renderDashBoards'].forEach(function(fn, i) {
  check(3 + i * 0.1, fn + ' 存在', html.indexOf('function ' + fn) >= 0);
});

// 4. renderDashboard 集成：调用 renderDashBoards + 周期切换绑定
const rdBody = html.slice(html.indexOf('function renderDashboard'), html.indexOf('function renderSubBar'));
check(4, 'renderDashboard 调用 renderDashBoards', rdBody.indexOf('renderDashBoards()') >= 0);
check(4.1, '周期切换按钮绑定', rdBody.indexOf("data-domain-days") >= 0 && rdBody.indexOf('renderDashBoards();') >= 0);

// 5. boards CSS 保留（renderLifeOverview/年计划仍在用 board-card）
check(5, 'board-card CSS 保留', html.indexOf('.board-card {') >= 0);

// ============ 二、纯函数测试 ============

// 切片：v2h 三看板函数块 + v2h_parseLinks（依赖）
const dashStart = html.indexOf('/* ===== v2h 主页三看板');
const dashEnd = html.indexOf('function renderDashboard', dashStart);
const dashCode = html.slice(dashStart, dashEnd);
const linkStart = html.indexOf('var V2H_LINK_TABLES');
const linkEnd = html.indexOf('function v2a_handleLinkAction', linkStart);
const linkCode = html.slice(linkStart, linkEnd);

function dstr(y, m, dd) { return y + '-' + String(m).padStart(2,'0') + '-' + String(dd).padStart(2,'0'); }
function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return dstr(d.getFullYear(), d.getMonth()+1, d.getDate()); }

function makeSb(cfg) {
  const sb = {
    console: { log: function(){}, warn: function(){}, error: function(){} },
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    parseFloat, parseInt, isNaN, isFinite,
    escapeHTML: function(s){ return s == null ? '' : String(s); },
    storeState: { tableRecords: cfg.tables || {} },
    topicEvents: function(){ return cfg.events || []; },
    ageInDays: function(dateStr){
      if (!dateStr) return 9999;
      var d = new Date(); var p = String(dateStr).split('-');
      var past = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
      return Math.floor((d - past) / 86400000);
    },
    obsFindSourceRecord: function(e){ return (cfg.records || {})[e['来源表'] + '|' + e['来源记录 ID']] || null; },
    obsEventIsRealized: function(e, rec){ return cfg.realized ? cfg.realized(e, rec) : true; },
    topicById: function(id){ return (cfg.topics || {})[id] || null; },
    obsRecordTitle: function(table, r){ return r ? (r['标题'] || r['项目名'] || '记录') : '记录'; },
    obsSourceLabel: function(){ return '来源'; },
    aggregateTopicContributions: function(days){ return cfg.contrib || []; }
  };
  sb.window = sb;
  return sb;
}

// --- v2h_knowledgeConversion ---
var KC_EVENTS = [
  { '主题 ID': 'T1', '阶段': 'E2 Learn', '日期': daysAgo(5), '来源表': 'study_tasks', '来源记录 ID': 'r1' },
  { '主题 ID': 'T1', '阶段': 'E3 Synthesize', '日期': daysAgo(4), '来源表': 'study_tasks', '来源记录 ID': 'r2' },
  { '主题 ID': 'T1', '阶段': 'E4 Apply', '日期': daysAgo(2), '来源表': 'study_tasks', '来源记录 ID': 'r3' },
  { '主题 ID': 'T1', '阶段': 'E5 Output', '日期': daysAgo(1), '来源表': 'media', '来源记录 ID': 'r4' },
  { '主题 ID': 'T2', '阶段': 'E1 Explore', '日期': daysAgo(3), '来源表': 'media', '来源记录 ID': 'r5' },
  { '主题 ID': 'T3', '阶段': 'E6 Reuse', '日期': daysAgo(2), '来源表': 'study_notes', '来源记录 ID': 'r6' },
  { '主题 ID': 'T4', '阶段': 'E2 Learn', '日期': daysAgo(120), '来源表': 'study_tasks', '来源记录 ID': 'r7' } // 周期外
];
var sbKC = makeSb({
  events: KC_EVENTS,
  records: { 'study_tasks|r1': { _id: 'r1', '标题': '读论文' }, 'study_tasks|r2': { _id: 'r2', '标题': '写综述' },
    'study_tasks|r3': { _id: 'r3', '标题': '做实验' }, 'media|r4': { _id: 'r4', '标题': '完成项目' },
    'media|r5': { _id: 'r5', '标题': '泛读新书' }, 'study_notes|r6': { _id: 'r6', '标题': '方法论笔记' } },
  topics: { T1: { _id: 'T1', '主题名': 'Speech Tech' }, T2: { _id: 'T2', '主题名': '阅读' }, T3: { _id: 'T3', '主题名': '方法论' } }
});
vm.createContext(sbKC);
vm.runInContext(linkCode + '\n' + dashCode + '\nthis.__api = { kc: v2h_knowledgeConversion };', sbKC);
var kc = sbKC.__api.kc(30);
check(6, 'KC：学到知识 = E1-E3（2 条 T1 + 1 条 T2）', kc.learned.length === 3);
check(6.1, 'KC：实际应用 = E4（1 条）', kc.applied.length === 1);
check(6.2, 'KC：成果产出 = E5+E6（2 条）', kc.produced.length === 2);
check(6.3, 'KC：周期外事件不计入', !kc.learned.some(function(x){ return x.recordId === 'r7'; }));
check(6.4, 'KC：T1 已转化（学习+应用+产出）', kc.topics.some(function(x){ return x.topicId === 'T1' && x.converted && x.learned === 2 && x.applied === 1 && x.produced === 1; }));
check(6.5, 'KC：T2 仅学习未转化', kc.topics.some(function(x){ return x.topicId === 'T2' && !x.converted; }));
check(6.6, 'KC：T3 只有产出也计入已转化', kc.topics.some(function(x){ return x.topicId === 'T3' && x.converted && x.learned === 0; }));
check(6.7, 'KC：转化率 = 2/3', kc.convertedCount === 2 && kc.learningTopicCount === 3);
check(6.8, 'KC：空数据不抛错', (function(){
  var sb = makeSb({ events: [] });
  vm.createContext(sb);
  vm.runInContext(linkCode + '\n' + dashCode + '\nthis.__kc = v2h_knowledgeConversion(30);', sb);
  return sb.__kc.learned.length === 0 && sb.__kc.topics.length === 0;
})());

// --- v2h_progressEvidence ---
var PE_EVENTS = [
  { '主题 ID': 'T1', '阶段': 'E5 Output', '日期': daysAgo(1), '来源表': 'media', '来源记录 ID': 'r4' },
  { '主题 ID': 'T1', '阶段': 'E5 Output', '日期': daysAgo(1), '来源表': 'media', '来源记录 ID': 'r4' }, // 重复
  { '主题 ID': 'T2', '阶段': 'E6 Reuse', '日期': daysAgo(3), '来源表': 'study_notes', '来源记录 ID': 'r6' },
  { '主题 ID': 'T2', '阶段': 'E4 Apply', '日期': daysAgo(2), '来源表': 'study_tasks', '来源记录 ID': 'r3' }, // 非成果
  { '主题 ID': 'T2', '阶段': 'E5 Output', '日期': daysAgo(90), '来源表': 'courses', '来源记录 ID': 'r8' } // 周期外
];
var sbPE = makeSb({
  events: PE_EVENTS,
  records: {
    'media|r4': { _id: 'r4', '标题': '完成项目', '关联项': '[{"t":"projects","id":"p1"}]' },
    'study_notes|r6': { _id: 'r6', '标题': '方法论笔记' },
    'study_tasks|r3': { _id: 'r3', '标题': '做实验' }
  },
  topics: { T1: { _id: 'T1', '主题名': 'Speech Tech' }, T2: { _id: 'T2', '主题名': '方法论' } },
  tables: { projects: [{ _id: 'p1', '项目名': 'Redbird 项目' }] }
});
vm.createContext(sbPE);
vm.runInContext(linkCode + '\n' + dashCode + '\nthis.__api = { pe: v2h_progressEvidence, lp: v2h_linkedProjectNames };', sbPE);
var pe = sbPE.__api.pe(30);
check(7, 'PE：仅收集 E5/E6（2 条，重复去重）', pe.length === 2);
check(7.1, 'PE：周期外/非成果不计入', !pe.some(function(x){ return x.title === '做实验'; }) && !pe.some(function(x){ return x.recordId === 'r8'; }));
check(7.2, 'PE：按日期倒序', pe[0].date >= pe[1].date);
check(7.3, 'PE：关联项目反查（关联项 → 项目名）', pe.some(function(x){ return x.title === '完成项目' && x.linkedProjects.indexOf('Redbird 项目') >= 0; }));
check(7.4, 'PE：linkedProjectNames 非法 JSON 安全', JSON.stringify(sbPE.__api.lp({ '关联项': 'broken' })) === '[]');
check(7.5, 'PE：linkedProjectNames 无记录安全', JSON.stringify(sbPE.__api.lp(null)) === '[]');

// --- v2h_domainOverview ---
var sbDO = makeSb({ contrib: [{ score: 12.5, changeRate: 30, activeDays: 5, completedRecordCount: 8, topic: { '主题名': 'A' } }, { score: 3, changeRate: -10, activeDays: 2, completedRecordCount: 3, topic: { '主题名': 'B' } }] });
vm.createContext(sbDO);
vm.runInContext(linkCode + '\n' + dashCode + '\nthis.__api = { dom: v2h_domainOverview };', sbDO);
check(8, 'DO：透传聚合结果', sbDO.__api.dom(30).length === 2);
check(8.1, 'DO：异常时返回空数组', (function(){
  var sb = makeSb({ contrib: null });
  sb.aggregateTopicContributions = function(){ throw new Error('x'); };
  vm.createContext(sb);
  vm.runInContext(linkCode + '\n' + dashCode + '\nthis.__d = v2h_domainOverview(7);', sb);
  return JSON.stringify(sb.__d) === '[]';
})());

// ============ 汇总 ============
const total = report.length;
const passed = report.filter(function(r){ return r.passed; }).length;
console.log('\n===== v2i 主页三看板 测试 =====');
console.log('Total: ' + total + ' | Passed: ' + passed + ' | Failed: ' + (total - passed));
process.exit(total === passed ? 0 : 1);
