// v2j_growth_stage_test.js — 第六期「计入成长开关 + resolveGrowthStage 统一入口 + study_habits 排除 + 习惯 ID 只读」测试
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

// 1. 「习惯 ID」从可编辑 SCHEMAS 移除（数据模型仍保留该字段，见 02_create_lifestation_dbs.sh）
const checkinIdx = html.indexOf('study_checkins: [');
const checkinEnd = html.indexOf('],', checkinIdx);
const checkinSchema = html.slice(checkinIdx, checkinEnd);
check(1, 'study_checkins SCHEMAS 移除「习惯 ID」', checkinSchema.indexOf("name:'习惯 ID'") < 0);

const logIdx = html.indexOf('habit_logs: [');
const logEnd = html.indexOf('],', logIdx);
const logSchema = html.slice(logIdx, logEnd);
check(1.1, 'habit_logs SCHEMAS 移除「习惯 ID」', logSchema.indexOf("name:'习惯 ID'") < 0);

// 2. 成长相关表新增「计入成长」checkbox
const GROWTH_TABLES = ['study_tasks','study_habits','study_checkins','projects','courses','media','study_notes','year_plan','today_tasks','weekly_reviews','inbox'];
GROWTH_TABLES.forEach(function(t, i){
  const sIdx = html.indexOf(t + ': [');
  const sEnd = html.indexOf('],', sIdx);
  const sBody = html.slice(sIdx, sEnd);
  check(2 + i * 0.01, t + ' 含「计入成长」checkbox', sBody.indexOf("name:'计入成长', type:'checkbox'") >= 0);
});

// 3. obsEventIsRealized：排除 study_habits + 校验「计入成长」
const realizedIdx = html.indexOf('function obsEventIsRealized');
const realizedBody = html.slice(realizedIdx, html.indexOf('var OBS_TYPE_WEIGHT', realizedIdx));
check(3, 'obsEventIsRealized 排除 study_habits 本体', realizedBody.indexOf("table === 'study_habits') return false") >= 0);
check(3.1, 'obsEventIsRealized 校验「计入成长」', realizedBody.indexOf("rec['计入成长'] === false) return false") >= 0);

// 4. OBS_TYPE_WEIGHT 明确 study_habits: 0
check(4, 'OBS_TYPE_WEIGHT 含 study_habits: 0', /study_habits:\s*0\.0/.test(html));

// 5. resolveGrowthStage / normalizeGrowthStage 存在
check(5, 'resolveGrowthStage 存在', html.indexOf('function resolveGrowthStage') >= 0);
check(5.1, 'normalizeGrowthStage 存在', html.indexOf('function normalizeGrowthStage') >= 0);

// 6. 三处主表投影/推断点全部走 resolveGrowthStage（不再独立 inferStageFromRecord / v2_inferStage）
const obsFnIdx = html.indexOf('function observeChange');
const obsFnBody = html.slice(obsFnIdx, html.indexOf('function seedTopics', obsFnIdx));
check(6, 'observeChange 走 resolveGrowthStage', obsFnBody.indexOf('resolveGrowthStage(tableKey, record, { action: action })') >= 0);

const syncFnIdx = html.indexOf('function v2a_syncLinkToMainEvents');
const syncFnBody = html.slice(syncFnIdx, html.indexOf('function v2a_backfillMainFromV25', syncFnIdx));
check(6.1, 'v2a_syncLinkToMainEvents 走 resolveGrowthStage', syncFnBody.indexOf('resolveGrowthStage(record_type, rec') >= 0);
check(6.2, 'v2a_syncLinkToMainEvents 不再用 v2_inferStage', syncFnBody.indexOf('v2_inferStage(rec)') < 0);

const bfFnIdx = html.indexOf('function v2a_backfillMainFromV25');
const bfFnBody = html.slice(bfFnIdx, html.indexOf('第二轮优化 第二期', bfFnIdx));
check(6.3, 'v2a_backfillMainFromV25 走 resolveGrowthStage', bfFnBody.indexOf('resolveGrowthStage(l.record_type, rec') >= 0);
check(6.4, 'v2a_backfillMainFromV25 不再用 v2_inferStage', bfFnBody.indexOf('v2_inferStage(rec)') < 0);

// 7. study_checkins 阶段 = E4 Apply（与影子存储对齐）
check(7, 'inferStageFromRecord study_checkins → E4 Apply', /study_checkins'\) return 'E4 Apply'/.test(html));

// 8. openModal：「计入成长」默认勾选 + readonly 类型支持
const omIdx = html.indexOf('function openModal(title, fields');
const omBody = html.slice(omIdx, html.indexOf('function closeModal', omIdx));
check(8, 'openModal 「计入成长」默认勾选逻辑', omBody.indexOf("f.name === '计入成长'") >= 0);
check(8.1, 'openModal 支持 readonly 类型', omBody.indexOf("f.type === 'readonly'") >= 0);

// 9. openRecordEditor：打卡/日志编辑只读回显习惯名
const oreIdx = html.indexOf('function openRecordEditor');
const oreBody = html.slice(oreIdx, html.indexOf('/* ===== v2h 主页三看板', oreIdx));
check(9, 'openRecordEditor 注入只读「习惯」字段', oreBody.indexOf("table === 'study_checkins' || table === 'habit_logs'") >= 0);
check(9.1, 'resolveHabitName 存在', html.indexOf('function resolveHabitName') >= 0);

// ============ 二、纯函数：inferStageFromRecord + resolveGrowthStage ============
const inferCode = html.slice(html.indexOf('function inferStageFromRecord'), html.indexOf('function detectTopicsFromRecord'));
const resolveCode = html.slice(html.indexOf('var MAIN_STAGE_MAP = {'), html.indexOf('var AUTO_TOPIC_SOURCE_TABLES'));

const sandbox = {
  console, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
  parseFloat, parseInt, isNaN, isFinite,
  STAGE_ORDER: ['E1 Explore','E2 Learn','E3 Synthesize','E4 Apply','E5 Output','E6 Reuse'],
  v2_inferStage: function(record){ return 'Unknown'; }
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
try {
  vm.runInContext(inferCode, sandbox, { filename: 'infer-stage.js' });
  vm.runInContext(resolveCode, sandbox, { filename: 'resolve-stage.js' });
} catch (e) { console.error('FAIL: 注入阶段推断模块抛错:', e.message); process.exit(2); }
if (typeof sandbox.resolveGrowthStage !== 'function') { console.error('FAIL: resolveGrowthStage 未注入'); process.exit(2); }

const RGS = sandbox.resolveGrowthStage;
const NGS = sandbox.normalizeGrowthStage;

// 10. 优先级 1：用户明确选择
check(10, '显式阶段(explicitStage) 最高优先', RGS('study_tasks', { 标题:'阅读', 状态:'已完成' }, { explicitStage:'E5 Output' }) === 'E5 Output');
check(10.1, 'record 自带「成长阶段」字段优先', RGS('study_tasks', { 标题:'阅读', 状态:'已完成', '成长阶段':'E6 Reuse' }, {}) === 'E6 Reuse');

// 11. 优先级 2：记录类型与状态规则（关键词不覆盖）
check(11, 'study_tasks → E4 Apply（类型规则）', RGS('study_tasks', { 标题:'阅读某文档', 状态:'已完成' }, {}) === 'E4 Apply');
sandbox.v2_inferStage = function(){ return 'E2 Learn'; }; // 模拟关键词命中「学习」
check(11.1, '关键词不覆盖类型规则（study_tasks 仍 E4）', RGS('study_tasks', { 标题:'阅读某文档', 状态:'已完成' }, {}) === 'E4 Apply');
check(11.2, 'study_checkins → E4 Apply', RGS('study_checkins', { 日期:'2026-10-10', 数值:1 }, {}) === 'E4 Apply');
check(11.3, 'projects 已完成 → E5 Output', RGS('projects', { 状态:'已完成' }, {}) === 'E5 Output');
check(11.4, 'projects 进行中 → E4 Apply', RGS('projects', { 状态:'进行中' }, {}) === 'E4 Apply');
check(11.5, 'courses 已学完 → E5 Output', RGS('courses', { 状态:'已学完' }, {}) === 'E5 Output');
check(11.6, 'courses 进行中 → E2 Learn', RGS('courses', { 状态:'进行中' }, {}) === 'E2 Learn');

// 12. 优先级 3：已关联结果/项目上下文
check(12, 'linkedStage 上下文（无类型规则表时）', RGS('some_future_table', { 标题:'x' }, { linkedStage:'E3 Synthesize' }) === 'E3 Synthesize');

// 13. 优先级 4：内容关键词辅助（仅类型规则未命中时）
sandbox.v2_inferStage = function(record){ return 'E2 Learn'; };
check(13, '未知表 + 关键词命中 → 关键词辅助 E2', RGS('some_future_table', { 标题:'学习 X' }, {}) === 'E2 Learn');
sandbox.v2_inferStage = function(record){ return 'Unknown'; };
check(13.1, '未知表 + 关键词 Unknown → 保守默认 E1', RGS('some_future_table', { 标题:'x' }, {}) === 'E1 Explore');
check(13.2, '关键词 ReuseCandidate → E6 Reuse', (function(){ sandbox.v2_inferStage = function(){ return 'ReuseCandidate'; }; var r = RGS('some_future_table', { 标题:'复用' }, {}); sandbox.v2_inferStage = function(){ return 'Unknown'; }; return r; })() === 'E6 Reuse');

// 14. normalizeGrowthStage
check(14, 'normalize 短名 E4 → E4 Apply', NGS('E4') === 'E4 Apply');
check(14.1, 'normalize ReuseCandidate → E6 Reuse', NGS('ReuseCandidate') === 'E6 Reuse');
check(14.2, 'normalize 全名不变', NGS('E1 Explore') === 'E1 Explore');
check(14.3, 'normalize 空/非法 → null', NGS('') === null && NGS('abc') === null);

// ============ 三、纯函数：obsEventIsRealized ============
const realizedCode = html.slice(html.indexOf('function obsEventIsRealized'), html.indexOf('var OBS_TYPE_WEIGHT'));
const rbox = { console, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, parseFloat, parseInt, isNaN, isFinite };
rbox.window = rbox; rbox.self = rbox; rbox.globalThis = rbox;
vm.createContext(rbox);
try { vm.runInContext(realizedCode, rbox, { filename: 'realized.js' }); }
catch (e) { console.error('FAIL: 注入 obsEventIsRealized 抛错:', e.message); process.exit(2); }
const RZ = rbox.obsEventIsRealized;

check(15, 'study_habits 本体不计成长', RZ({ '来源表':'study_habits', '阶段':'E1 Explore' }, { '标题':'每日阅读' }) === false);
check(15.1, '计入成长=false → 不计', RZ({ '来源表':'study_tasks', '阶段':'E4 Apply' }, { '状态':'已完成', '计入成长':false }) === false);
check(15.2, '计入成长=true（或未设置）→ 计入', RZ({ '来源表':'study_tasks', '阶段':'E4 Apply' }, { '状态':'已完成', '计入成长':true }) === true);
check(15.3, '无计入成长字段的旧记录默认计入', RZ({ '来源表':'study_tasks', '阶段':'E4 Apply' }, { '状态':'已完成' }) === true);
check(15.4, 'study_checkins 计为已发生', RZ({ '来源表':'study_checkins', '阶段':'E4 Apply' }, {}) === true);
check(15.5, 'projects 进行中未完成不计', RZ({ '来源表':'projects', '阶段':'E4 Apply' }, { '状态':'进行中' }) === false);

console.log('\n===== v2j 计入成长 + resolveGrowthStage + 习惯 ID 只读 测试 =====');
const passed = report.filter(r => r.passed).length;
console.log('Total: ' + report.length + ' | Passed: ' + passed + ' | Failed: ' + (report.length - passed));
process.exit(report.every(r => r.passed) ? 0 : 1);
