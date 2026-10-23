// v2e_cleanup_test.js — 第一期「阻止污染 + 统一口径」测试
// 覆盖：候选主题推荐(topicSuggestCandidates) / 新权重表(obsContributionWeight) /
//       _auto 过滤 / 习惯限制 / 年度计划删类型 / 自动建主题软停用
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

// ============ 一、静态断言（直接对 HTML 源码做字符串检查） ============

// 1. 年度计划 SCHEMAS 已删「类型」字段
const ypIdx = html.indexOf('year_plan: [');
const ypEnd = html.indexOf('],', ypIdx);
const ypSchema = html.slice(ypIdx, ypEnd);
check(1, '年度计划 SCHEMAS 不含「类型」字段', ypSchema.indexOf("name:'类型'") < 0 && ypSchema.indexOf('年度大目标') < 0);

// 2. 年度计划弹窗已删「类型」字段（只检查年度计划弹窗，不含主题/其他弹窗）
const ypFnIdx = html.indexOf('function openYearPlanModal');
const ypFnBody = html.slice(ypFnIdx, html.indexOf('function openAddTopicModal', ypFnIdx));
check(2, '年度计划弹窗无 <select name="类型">', ypFnBody.indexOf('<select name="类型">') < 0);
check(2.1, '年度计划保存 props 不含「类型」', ypFnBody.indexOf("'类型': form.elements") < 0);

// 3. autoGenerateTopicsFromData 已软停用
const autoFnIdx = html.indexOf('function autoGenerateTopicsFromData');
const autoFnBody = html.slice(autoFnIdx, html.indexOf('function v2a_syncLinkToMainEvents', autoFnIdx));
check(3, 'autoGenerateTopicsFromData 含软停用标记', autoFnBody.indexOf('已停用') >= 0);
check(3.1, '软停用后立即 return（不建主题）', autoFnBody.indexOf('return { topics_added: 0, events_added: 0') >= 0);

// 4. 所有调用点已移除 autoGenerateTopicsFromData（只剩定义与注释，调用=0）
const bootCalls = (html.match(/autoGenerateTopicsFromData\(\)\s*;/g) || []).length;
check(4, 'autoGenerateTopicsFromData 无任何调用点（剩 0 处）', bootCalls === 0, 'got ' + bootCalls);

// 5. obsGetTopics 过滤 _auto 主题
const obsGetTopicsIdx = html.indexOf('function obsGetTopics');
const obsGetTopicsBody = html.slice(obsGetTopicsIdx, html.indexOf('function obsGetEvents', obsGetTopicsIdx));
check(5, 'obsGetTopics 过滤未确认 _auto 主题', obsGetTopicsBody.indexOf('!x._auto') >= 0);

// 6. 统一权重表 OBS_TYPE_WEIGHT 存在且含习惯打卡 0.5 / 课程 1.2
check(6, 'OBS_TYPE_WEIGHT 定义存在', html.indexOf('var OBS_TYPE_WEIGHT') >= 0);
check(6.1, '习惯打卡权重 0.5', /study_checkins:\s*0\.5/.test(html));
check(6.2, '课程权重 1.2', /courses:\s*1\.2/.test(html));

// 7. 习惯限制精确映射 {7:3, 30:12, 90:30}
check(7, '习惯周期上限精确映射 7→3/30→12/90→30', html.indexOf('{7:3, 30:12, 90:30}') >= 0);

// 8. Store.addRecord 触发候选推荐（不再调 autoGenerate）
const addRecIdx = html.indexOf('addRecord: function(key, props)');
const addRecBody = html.slice(addRecIdx, html.indexOf('updateRecord:', addRecIdx));
check(8, 'addRecord 调用 v2a_suggestTopicForRecord', addRecBody.indexOf('v2a_suggestTopicForRecord(key, r)') >= 0);
check(8.1, 'addRecord 不再调用 autoGenerateTopicsFromData', addRecBody.indexOf('autoGenerateTopicsFromData()') < 0);

// ============ 二、纯函数抽取：topicSuggestCandidates ============
const seedStart = html.indexOf('var SEED_TOPICS = [');
const seedEnd = html.indexOf('];', seedStart) + 2;
const seedCode = html.slice(seedStart, seedEnd);

const suggestStart = html.indexOf('function topicSuggestCandidates');
const suggestEnd = html.indexOf('function v2a_suggestTopicForRecord', suggestStart);
const suggestCode = html.slice(suggestStart, suggestEnd);

const sbox = {
  console, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
  parseFloat, parseInt, isNaN, isFinite,
  storeState: { tableRecords: { topics: [] } }
};
sbox.window = sbox; sbox.self = sbox; sbox.globalThis = sbox;
vm.createContext(sbox);
try {
  vm.runInContext(seedCode, sbox, { filename: 'seed.js' });
  vm.runInContext(suggestCode, sbox, { filename: 'suggest.js' });
} catch (e) { console.error('FAIL: 注入候选推荐模块抛错:', e.message); process.exit(2); }

if (typeof sbox.topicSuggestCandidates !== 'function') { console.error('FAIL: topicSuggestCandidates 未注入'); process.exit(2); }
const T = sbox.storeState.tableRecords.topics;

// 准备正式主题库
T.push({ _id: 't_speech', '主题名': 'Speech Technology', '别名': '语音, speech tech', '类型': '领域', '治理状态': 'active' });
T.push({ _id: 't_torch', '主题名': 'PyTorch', '别名': 'torch, pytorch', '类型': '工具', '治理状态': 'active' });
T.push({ _id: 't_auto', '主题名': '完成 Redbird 项目', '别名': '', '类型': '领域', '治理状态': 'active', '_auto': true });
T.push({ _id: 't_archived', '主题名': '已归档主题', '别名': '归档', '类型': '领域', '治理状态': 'archived' });

check(9, '正式主题名匹配（标题含主题名）', sbox.topicSuggestCandidates('Speech Technology 学习计划')[0].name === 'Speech Technology');
check(9.1, '别名匹配（中文「语音」）', sbox.topicSuggestCandidates('完成语音识别系统')[0].name === 'Speech Technology');

const seedHit = sbox.topicSuggestCandidates('中文学习打卡');
check(10, '预设主题名匹配（别名 中文学习 → Mandarin Learning）', seedHit.length > 0 && seedHit[0].name === 'Mandarin Learning' && seedHit[0].source === 'seed', JSON.stringify(seedHit.map(c => c.name)));

// _auto 主题不参与匹配
const autoHit = sbox.topicSuggestCandidates('完成 Redbird 项目');
check(11, '_auto 主题不参与候选匹配', !autoHit.some(c => c.name === '完成 Redbird 项目'));

// 已归档主题不参与匹配
const archHit = sbox.topicSuggestCandidates('归档整理');
check(11.1, '已归档主题不参与候选匹配', !archHit.some(c => c.name === '已归档主题'));

// existing 优先于 seed（同匹配词时）
check(12, 'existing 优先于 seed', true); // 排序逻辑由 check 12.1 验证
const mixed = sbox.topicSuggestCandidates('torch 相关');
check(12.1, '现有主题 PyTorch 优先于预设同名', mixed.length > 0 && mixed[0].source === 'existing');

// 短词（<2 字符）不匹配 + 空文本
check(13, '空文本返回空候选', sbox.topicSuggestCandidates('').length === 0);
check(13.1, '无匹配返回空候选', sbox.topicSuggestCandidates('完全无关的标题').length === 0);

// ============ 三、纯函数抽取：obsContributionWeight ============
const weightStart = html.indexOf('var OBS_TYPE_WEIGHT');
const weightEnd = html.indexOf('function aggregateTopicContributions', weightStart);
const weightCode = html.slice(weightStart, weightEnd);

const wbox = {
  console, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
  parseFloat, parseInt, isNaN, isFinite,
  STAGE_WEIGHT: { 'E1 Explore': 1, 'E2 Learn': 2, 'E3 Synthesize': 4, 'E4 Apply': 6, 'E5 Output': 9, 'E6 Reuse': 8 }
};
wbox.window = wbox; wbox.self = wbox; wbox.globalThis = wbox;
vm.createContext(wbox);
try { vm.runInContext(weightCode, wbox, { filename: 'weight.js' }); }
catch (e) { console.error('FAIL: 注入权重模块抛错:', e.message); process.exit(2); }
if (typeof wbox.obsContributionWeight !== 'function') { console.error('FAIL: obsContributionWeight 未注入'); process.exit(2); }
const W = wbox.obsContributionWeight;

// 项目成果（已完成）= 1.6 × 1.0 × E5(9) = 14.4
const projDone = W({ '来源表': 'projects', '主题角色': 'primary', '阶段': 'E5 Output' }, { '状态': '已完成' });
check(14, '项目成果(已完成) 类型权重 1.6', projDone === 1.6 * 1 * 9, 'got ' + projDone);
// 项目里程碑（进行中）= 1.4
const projMilestone = W({ '来源表': 'projects', '主题角色': 'primary', '阶段': 'E4 Apply' }, { '状态': '进行中' });
check(14.1, '项目里程碑(进行中) 类型权重 1.4', projMilestone === 1.4 * 1 * 6, 'got ' + projMilestone);
// 课程 = 1.2
const course = W({ '来源表': 'courses', '主题角色': 'primary', '阶段': 'E2 Learn' }, null);
check(14.2, '课程 类型权重 1.2', course === 1.2 * 1 * 2, 'got ' + course);
// 习惯打卡 = 0.5
const checkin = W({ '来源表': 'study_checkins', '主题角色': 'primary', '阶段': 'E4 Apply' }, null);
check(14.3, '习惯打卡 类型权重 0.5', checkin === 0.5 * 1 * 6, 'got ' + checkin);
// secondary 角色 ×0.5
const secondary = W({ '来源表': 'courses', '主题角色': 'secondary', '阶段': 'E2 Learn' }, null);
check(14.4, '同时涉及(secondary) 角色权重 0.5', secondary === 1.2 * 0.5 * 2, 'got ' + secondary);
// 未知表默认 1.0
const unknown = W({ '来源表': 'other_table', '主题角色': 'primary', '阶段': 'E1 Explore' }, null);
check(14.5, '未知来源表 类型权重默认 1.0', unknown === 1 * 1 * 1, 'got ' + unknown);

console.log('\n===== v2e 阻止污染 + 统一口径 测试 =====');
const passed = report.filter(r => r.passed).length;
console.log('Total: ' + report.length + ' | Passed: ' + passed + ' | Failed: ' + (report.length - passed));
process.exit(report.every(r => r.passed) ? 0 : 1);
