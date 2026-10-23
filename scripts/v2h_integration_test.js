// v2h_integration_test.js — 第四期「通用关联选择器 + 主题继承 + 主题chip过滤 + 主页重排」测试
// 覆盖：_auto 过滤 / 词表统一 / record-link 存储+渲染+迁移 / 主题继承 / collectTodayCross / dashboard 重排
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

// 1. SCHEMAS：三张子记录表含「关联项 record-link」
['study_tasks', 'study_habits', 'study_notes'].forEach(function(t, i) {
  const idx = html.indexOf('    ' + t + ': [');
  const end = html.indexOf('],', idx);
  const body = html.slice(idx, end);
  check(1 + i * 0.1, t + ' SCHEMAS 含 关联项 record-link', body.indexOf("{name:'关联项', type:'record-link'}") >= 0);
  check(1.2 + i * 0.1, t + ' 旧字段 关联计划 保留', body.indexOf("name:'关联计划'") >= 0);
});
check(1.31, 'study_notes 旧字段 关联课程 保留', html.slice(html.indexOf('    study_notes: ['), html.indexOf('],', html.indexOf('    study_notes: ['))).indexOf("name:'关联课程'") >= 0);

// 2. openModal record-link 渲染分支 + advancedNames
check(2, 'openModal 有 record-link 分支', /f\.type === 'record-link'/.test(html));
check(2.1, 'record-link 渲染隐藏 input', html.indexOf("data-record-link-input") >= 0);
const advIdx = html.indexOf('var advancedNames =');
const advBody = html.slice(advIdx, html.indexOf('];', advIdx));
check(2.2, 'advancedNames 含 关联计划', advBody.indexOf("'关联计划'") >= 0);
check(2.3, 'advancedNames 含 关联课程', advBody.indexOf("'关联课程'") >= 0);

// 3. _auto 过滤（v2a_collectAllTopics 两处）
const catIdx = html.indexOf('function v2a_collectAllTopics');
const catEnd = html.indexOf('function v2a_listAllTopics', catIdx);
const catBody = html.slice(catIdx, catEnd);
check(3, 'v2a_collectAllTopics 主表遍历过滤 _auto', catBody.indexOf('if (lt._auto === true) continue;') >= 0);
check(3.1, 'v2a_collectAllTopics v25 遍历过滤 _auto', catBody.indexOf('if (t._auto === true) continue;') >= 0);

// 4. 词表统一：两处均引用 SCHEMAS.topics options，不再硬编码
const inlineIdx = html.indexOf("'<div class=\"form-row\"><label>类型</label><select name=\"类型\">'", 0);
check(4, 'v2a_openNewTopicInlineModal 词表引用 SCHEMAS', html.indexOf("(SCHEMAS.topics.find(function(f){return f.name==='类型';}).options)") >= 0);
check(4.1, '不再硬编码 领域/聚焦/方法/工具/其他 五值', html.indexOf("['领域','聚焦','方法','工具','其他']") < 0);
check(4.2, '不再硬编码 学习/工作/生活/兴趣/技能/健康', html.indexOf("['学习','工作','生活','兴趣','技能','健康']") < 0);
check(4.3, 'SCHEMAS.topics 类型词表为四值', html.indexOf("{name:'类型', type:'select', options:['领域','聚焦','方法','工具']}") >= 0);

// 5. 新函数存在
['v2h_parseLinks', 'v2h_listLinkTargets', 'v2h_renderRecordLinkPicker', 'v2h_syncLinkState',
 'v2h_bindRecordLinkEvents', 'v2h_inheritTopicFromLinks', 'v2h_migrateRecordLinks',
 'openRecordEditor', 'collectTodayCross'].forEach(function(fn, i) {
  check(5 + i * 0.1, fn + ' 存在', html.indexOf('function ' + fn) >= 0 || html.indexOf('var ' + fn) >= 0);
});

// 6. Store 挂钩：addRecord / updateRecord 成功回调调用继承
check(6, 'Store.addRecord 调用 v2h_inheritTopicFromLinks', /v2a_applyPendingNew\(key, r\)[\s\S]{0,200}v2h_inheritTopicFromLinks\(key, r\)/.test(html));
check(6.1, 'Store.updateRecord 调用 v2h_inheritTopicFromLinks', /supaSilentWrite\('update', key, arr\[i\]\); try \{ if \(typeof v2h_inheritTopicFromLinks === 'function'\) v2h_inheritTopicFromLinks\(key, arr\[i\]\);/.test(html));

// 7. init 挂迁移 + seed 后重跑迁移
check(7, 'init 调用 v2h_migrateRecordLinks', /v2a_backfillMainFromV25\(\); \} catch\(e\)\{ console\.error\('backfill main err', e\); \}\s*\/\/ v2h/.test(html));
check(7.1, 'seed 后清 FLAG 重跑迁移', html.indexOf("localStorage.removeItem(V2H_MIGRATE_FLAG)") >= 0);

// 8. dashboard 重排
check(8, 'dashShell 有 dash-insights 区块', html.indexOf('class="dash-insights"') >= 0);
check(8.1, 'dashShell 有 dashTimeline', html.indexOf('id="dashTimeline"') >= 0);
check(8.2, 'dashShell 有 dashTopTopics', html.indexOf('id="dashTopTopics"') >= 0);
check(8.3, 'KPI 精简（无 kWeekDone/kHabits/kP0 壳）', html.indexOf('id="kWeekDone"') < 0 && html.indexOf('id="kHabits"') < 0 && html.indexOf('id="kP0"') < 0);
const rdIdx = html.indexOf('function renderDashboard');
const rdEnd = html.indexOf('/* ============================================================\n     Subbar', rdIdx);
const rdBody = html.slice(rdIdx, rdEnd);
check(8.4, 'renderDashboard 今日条目带 data-table', rdBody.indexOf('data-table="') >= 0);
check(8.5, 'renderDashboard 调用 collectTodayCross', rdBody.indexOf('collectTodayCross()') >= 0);
check(8.6, 'renderDashboard 调用 obsContributionTimeline', rdBody.indexOf('obsContributionTimeline(') >= 0);
check(8.7, 'renderDashboard 调用 aggregateTopicContributions(30, 0)', rdBody.indexOf('aggregateTopicContributions(30, 0)') >= 0);
check(8.8, 'renderDashboard 绑定 openRecordEditor', rdBody.indexOf('openRecordEditor(') >= 0);

// 9. 关联 picker 注入到 v2a_injectIntoModal（主题区之前）
const injIdx = html.indexOf('function v2a_injectIntoModal');
const injEnd = html.indexOf('function v2a_handleLinkAction', injIdx);
const injBody = html.slice(injIdx, injEnd);
check(9, 'injectIntoModal 渲染关联区', injBody.indexOf('v2h_renderRecordLinkPicker') >= 0);
check(9.1, '关联区分隔条在主题分隔条之前', injBody.indexOf('关联到（可选）') >= 0 && injBody.indexOf('关联到（可选）') < injBody.indexOf('主题（可选）'));
check(9.2, '绑定 v2h_bindRecordLinkEvents', injBody.indexOf('v2h_bindRecordLinkEvents') >= 0);

// ============ 二、纯函数抽取测试 ============

// --- 切片 1：v2h 函数块 ---
const v2hStart = html.indexOf('var V2H_LINK_TABLES');
const v2hEnd = html.indexOf('function v2a_handleLinkAction', v2hStart);
const v2hCode = html.slice(v2hStart, v2hEnd);

function makeSandbox(extra) {
  const sb = {
    console: { log: function(){}, warn: function(){}, error: function(){} },
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error,
    parseFloat, parseInt, isNaN, isFinite,
    escapeHTML: function(s){ if (s == null) return ''; return String(s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  Object.keys(extra || {}).forEach(function(k){ sb[k] = extra[k]; });
  return sb;
}

// 工具：本地日期字符串（避免 UTC 偏移）
function dstr(y, m, dd) { return y + '-' + String(m).padStart(2,'0') + '-' + String(dd).padStart(2,'0'); }
function todayLocal() { var t = new Date(); return dstr(t.getFullYear(), t.getMonth()+1, t.getDate()); }

// --- 2.1 v2h_parseLinks ---
const sbPL = makeSandbox();
vm.createContext(sbPL);
vm.runInContext(v2hCode + '\nthis.__api = { parseLinks: v2h_parseLinks };', sbPL);
const parseLinks = sbPL.__api.parseLinks;
check(10, 'parseLinks 正常解析', JSON.stringify(parseLinks('[{"t":"year_plan","id":"a1"}]')) === '[{"t":"year_plan","id":"a1"}]');
check(10.1, 'parseLinks 非法 JSON → 空数组', JSON.stringify(parseLinks('not-json')) === '[]');
check(10.2, 'parseLinks 过滤缺字段项', parseLinks('[{"t":"x"},{"t":"projects","id":"p1"},{"id":"only"}]').length === 1);
check(10.3, 'parseLinks 空值 → 空数组', JSON.stringify(parseLinks('')) === '[]' && JSON.stringify(parseLinks(null)) === '[]');
check(10.4, 'parseLinks 非数组 JSON → 空数组', JSON.stringify(parseLinks('{"t":"x"}')) === '[]');

// --- 2.2 v2h_migrateRecordLinks ---
function runMigrate(tables, lsStore) {
  const saved = [];
  const sb = makeSandbox({
    storeState: { tableRecords: tables },
    saveLocal: function(k){ saved.push(k); },
    localStorage: {
      _s: lsStore || {},
      getItem: function(k){ return this._s[k] != null ? this._s[k] : null; },
      setItem: function(k,v){ this._s[k] = String(v); },
      removeItem: function(k){ delete this._s[k]; }
    }
  });
  vm.createContext(sb);
  vm.runInContext(v2hCode + '\nthis.__api = { migrate: v2h_migrateRecordLinks, FLAG: V2H_MIGRATE_FLAG };', sb);
  const n = sb.__api.migrate();
  return { n: n, tables: tables, saved: saved, ls: sb.__api._lsFlag || sb, flag: (sb.localStorage._s['dc_lifestation_v2h_links_migrated'] || null) };
}
// 精确命中
let m1 = runMigrate({
  year_plan: [{ _id: 'yp1', '标题': '雅思冲刺' }],
  courses: [{ _id: 'c1', '课程名': 'Managing People' }],
  study_tasks: [{ _id: 't1', '关联计划': '雅思冲刺', '关联课程': 'Managing People' }],
  study_habits: [], study_notes: []
});
check(11, '迁移：精确命中生成关联项', m1.tables.study_tasks[0]['关联项'] === JSON.stringify([{t:'year_plan',id:'yp1'},{t:'courses',id:'c1'}]));
check(11.1, '迁移：旧文本保留', m1.tables.study_tasks[0]['关联计划'] === '雅思冲刺');
check(11.2, '迁移：saveLocal 被调用', m1.saved.indexOf('study_tasks') >= 0);
// 子串唯一命中（seed 陷阱：「雅思 7.0」⊂ 完整标题）
let m2 = runMigrate({
  year_plan: [{ _id: 'yp1', '标题': '雅思 7.0 + 读完 12 本专业书' }],
  courses: [],
  study_tasks: [{ _id: 't1', '关联计划': '雅思 7.0' }],
  study_habits: [], study_notes: []
});
check(11.3, '迁移：子串唯一命中（seed「雅思 7.0」）', m2.tables.study_tasks[0]['关联项'] === JSON.stringify([{t:'year_plan',id:'yp1'}]));
// 多命中不迁
let m3 = runMigrate({
  year_plan: [{ _id: 'yp1', '标题': '读完 12 本书' }, { _id: 'yp2', '标题': '读完 24 本书' }],
  courses: [],
  study_tasks: [{ _id: 't1', '关联计划': '读完' }],
  study_habits: [], study_notes: []
});
check(11.4, '迁移：多命中保留文本不生成引用', m3.tables.study_tasks[0]['关联项'] === undefined);
// 零命中
let m4 = runMigrate({
  year_plan: [{ _id: 'yp1', '标题': '完全无关的计划' }],
  courses: [],
  study_tasks: [{ _id: 't1', '关联计划': '雅思 7.0' }],
  study_habits: [], study_notes: []
});
check(11.5, '迁移：零命中保留文本', m4.tables.study_tasks[0]['关联项'] === undefined);
// 幂等：已有关联项跳过 + FLAG 防重跑
let m5 = runMigrate({
  year_plan: [{ _id: 'yp1', '标题': 'X' }],
  courses: [],
  study_tasks: [{ _id: 't1', '关联项': '[{"t":"year_plan","id":"yp1"}]', '关联计划': 'X' }],
  study_habits: [], study_notes: []
}, { 'dc_lifestation_v2h_links_migrated': '1' });
check(11.6, '迁移：FLAG 存在直接跳过（幂等）', m5.n === 0);

// --- 2.3 v2h_inheritTopicFromLinks ---
function runInherit(cfg) {
  let savedStore = null;
  let synced = [];
  const store = {
    topic_links: cfg.existingLinks || [],
    topic_events: cfg.shadowEvents || []
  };
  const sb = makeSandbox({
    storeState: { tableRecords: { topic_events: cfg.mainEvents || [] } },
    v25_loadStore: function(){ return JSON.parse(JSON.stringify(store)); },
    v25_saveStore: function(s){ savedStore = s; },
    v2a_getOverride: function(k, id){ return (cfg.overrides || {})[k + '|' + id] || {}; },
    v2_buildEvent: function(link, rec, opts){ return { _id: 'ev_' + link.topic_id, '主题 ID': link.topic_id, '来源表': link.record_type, '来源记录 ID': link.record_id, '日期': rec['日期'] || '' }; },
    v2_upsertEvent: function(s, ev){ s.topic_events.push(ev); },
    v2a_syncLinkToMainEvents: function(k, id){ synced.push(k + '|' + id); },
    uid: function(){ return 'uid_' + Math.random().toString(36).slice(2, 8); }
  });
  vm.createContext(sb);
  vm.runInContext(v2hCode + '\nthis.__api = { inherit: v2h_inheritTopicFromLinks };', sb);
  const created = sb.__api.inherit(cfg.key, cfg.rec);
  return { created: created, savedStore: savedStore, synced: synced };
}
// 基本继承：父（year_plan）有主表 topic_events → 子继承 supporting
let h1 = runInherit({
  key: 'study_tasks',
  rec: { _id: 'task1', '关联项': '[{"t":"year_plan","id":"yp1"},{"t":"study_tasks","id":"task2"}]' },
  mainEvents: [
    { '来源表': 'year_plan', '来源记录 ID': 'yp1', '主题 ID': 'T1' },
    { '来源表': 'year_plan', '来源记录 ID': 'yp1', '主题 ID': 'T2' }
  ]
});
check(12, '继承：父主题被继承为 supporting', h1.created.indexOf('T1') >= 0 && h1.created.indexOf('T2') >= 0);
check(12.1, '继承：link 落影子 store 且 role=supporting', h1.savedStore && h1.savedStore.topic_links.length === 2 && h1.savedStore.topic_links.every(function(l){ return l.topic_role === 'supporting' && l.relation_source === 'inherited'; }));
check(12.2, '继承：投影主表 syncLinkToMainEvents', h1.synced.indexOf('study_tasks|task1') >= 0);
// 环保护：任务关联不继承
let h2 = runInherit({
  key: 'study_tasks',
  rec: { _id: 'task1', '关联项': '[{"t":"study_tasks","id":"task2"},{"t":"today_tasks","id":"tt1"}]' },
  mainEvents: [{ '来源表': 'study_tasks', '来源记录 ID': 'task2', '主题 ID': 'T9' }]
});
check(12.3, '继承：任务类型关联被跳过（环保护）', h2.created.length === 0);
// 手动勾选优先
let h3 = runInherit({
  key: 'study_tasks',
  rec: { _id: 'task1', '关联项': '[{"t":"projects","id":"p1"}]' },
  mainEvents: [{ '来源表': 'projects', '来源记录 ID': 'p1', '主题 ID': 'T1' }],
  overrides: { 'study_tasks|task1': { topic_roles: { core: ['T1'], supporting: [] } } }
});
check(12.4, '继承：手动勾选的主题不覆盖', h3.created.length === 0);
// 已有非 ambient link 不重复
let h4 = runInherit({
  key: 'study_tasks',
  rec: { _id: 'task1', '关联项': '[{"t":"projects","id":"p1"}]' },
  mainEvents: [{ '来源表': 'projects', '来源记录 ID': 'p1', '主题 ID': 'T1' }],
  existingLinks: [{ record_type: 'study_tasks', record_id: 'task1', topic_id: 'T1', topic_role: 'supporting', review_status: 'confirmed' }]
});
check(12.5, '继承：已有非 ambient link 不重复创建', h4.created.length === 0);
// ambient link 可以被升级继承
let h5 = runInherit({
  key: 'study_tasks',
  rec: { _id: 'task1', '关联项': '[{"t":"projects","id":"p1"}]' },
  mainEvents: [{ '来源表': 'projects', '来源记录 ID': 'p1', '主题 ID': 'T1' }],
  existingLinks: [{ record_type: 'study_tasks', record_id: 'task1', topic_id: 'T1', topic_role: 'ambient', review_status: 'confirmed' }]
});
check(12.6, '继承：ambient link 可升级为 supporting', h5.created.length === 1);
// 非法 JSON 不抛错
let h6 = runInherit({ key: 'study_tasks', rec: { _id: 'task1', '关联项': 'broken-json' }, mainEvents: [] });
check(12.7, '继承：非法 JSON 不抛错且为空', h6.created.length === 0);
// 影子 store 父 links 兜底
let h7 = runInherit({
  key: 'study_notes',
  rec: { _id: 'n1', '关联项': '[{"t":"courses","id":"c1"}]' },
  mainEvents: [],
  shadowEvents: [],
  existingLinks: [{ record_type: 'courses', record_id: 'c1', topic_id: 'T3', topic_role: 'core', review_status: 'confirmed' }]
});
check(12.8, '继承：影子 store 父 links 兜底', h7.created.indexOf('T3') >= 0);
// 非三表调用直接返回空
let h8 = runInherit({ key: 'projects', rec: { _id: 'p1', '关联项': '[{"t":"year_plan","id":"yp1"}]' }, mainEvents: [{ '来源表': 'year_plan', '来源记录 ID': 'yp1', '主题 ID': 'T1' }] });
check(12.9, '继承：非子记录表直接返回空', h8.created.length === 0);

// --- 2.4 collectTodayCross ---
const ctIdx = html.indexOf('function collectTodayCross');
const ctEnd = html.indexOf('/* v2h: 通用记录编辑入口', ctIdx);
const ctCode = html.slice(ctIdx, ctEnd);
let CT_TODAY = todayLocal();
function runCross(tables) {
  const sb = makeSandbox({ storeState: { tableRecords: tables }, todayStr: function(){ return CT_TODAY; } });
  vm.createContext(sb);
  vm.runInContext(ctCode + '\nthis.__api = { collect: collectTodayCross };', sb);
  return sb.__api.collect();
}
let c1 = runCross({
  today_tasks: [{ _id: 'a1', '日期': CT_TODAY, '状态': '待办', '标题': '今日任务', '来源模块': '工作' }],
  calendar_events: [{ _id: 'a2', '日期': CT_TODAY, '类型': '待办', '标题': '例会' }],
  habits: [{ _id: 'a3', '习惯名': '跑步', '启用': true }], habit_logs: [],
  study_tasks: [{ _id: 'a4', '日期': '2020-01-01', '状态': '待办', '标题': '逾期学习任务' }],
  projects: [{ _id: 'a5', '项目名': '逾期项目', '状态': '进行中', '截止': '2020-01-01' }, { _id: 'a5b', '项目名': '未来项目', '状态': '进行中', '截止': '2030-01-01' }],
  inbox: [{ _id: 'a6', '状态': '待处理', '内容': '想法' }]
});
check(13, '今日待办：今日任务入列', c1.some(function(x){ return x.recordId === 'a1'; }));
check(13.1, '今日待办：日历待办入列', c1.some(function(x){ return x.recordId === 'a2'; }));
check(13.2, '今日待办：未打卡习惯入列', c1.some(function(x){ return x.recordId === 'a3'; }));
check(13.3, '今日待办：逾期学习任务入列且标记逾期', c1.some(function(x){ return x.recordId === 'a4' && x.overdue; }));
check(13.4, '今日待办：逾期项目入列、未来项目不入列', c1.some(function(x){ return x.recordId === 'a5'; }) && !c1.some(function(x){ return x.recordId === 'a5b'; }));
check(13.5, '今日待办：inbox 待处理入列', c1.some(function(x){ return x.recordId === 'a6'; }));
check(13.6, '今日待办：每条都带 tableKey + recordId', c1.every(function(x){ return x.tableKey && x.recordId; }));
let c2 = runCross({
  today_tasks: [{ _id: 'b1', '日期': CT_TODAY, '状态': '已完成', '标题': '已完成' }],
  calendar_events: [], habits: [{ _id: 'b2', '习惯名': '已打卡', '启用': true }], habit_logs: [{ '日期': CT_TODAY, '习惯 ID': 'b2' }],
  study_tasks: [], projects: [], inbox: []
});
check(13.7, '今日待办：已完成任务与已打卡习惯不入列', c2.length === 0);

// --- 2.5 openRecordEditor（静态结构：分发 year_plan / rows 覆盖） ---
const oreIdx = html.indexOf('function openRecordEditor');
const oreEnd = html.indexOf('function renderDashboard', oreIdx);
const oreBody = html.slice(oreIdx, oreEnd);
check(14, 'openRecordEditor 分发 year_plan → openYearPlanModal', oreBody.indexOf('openYearPlanModal(rec)') >= 0);
check(14.1, 'openRecordEditor 有 textarea rows 覆盖', oreBody.indexOf('rowOverrides') >= 0);
check(14.2, 'openRecordEditor 走 Store.updateRecord + renderAll', oreBody.indexOf('Store.updateRecord(table, recordId, props)') >= 0 && oreBody.indexOf('renderAll()') >= 0);

// --- 2.6 v2a_collectAllTopics 过滤 _auto（vm 实测） ---
function runCollect(mainTopics, v25Topics) {
  const sb = makeSandbox({
    storeState: { tableRecords: { topics: mainTopics } },
    v25_loadStore: function(){ return { topics: v25Topics || [] }; }
  });
  vm.createContext(sb);
  vm.runInContext(catBody + '\nthis.__api = { collect: v2a_collectAllTopics };', sb);
  return sb.__api.collect();
}
let cl1 = runCollect([
  { _id: 't1', '主题名': 'SPEECH TECHNOLOGY', '类型': '学习' },
  { _id: 't2', '主题名': '完成Probing的学习', '类型': '领域', _auto: true },
  { _id: 't3', '主题名': '语言', '类型': '领域' }
], [{ _id: 'v1', name: '影子主题', type: '聚焦' }, { _id: 'v2', name: '影子自动', type: '领域', _auto: true }]);
check(15, 'collectAllTopics 过滤主表 _auto', cl1.some(function(x){ return x.id === 't1'; }) && !cl1.some(function(x){ return x.id === 't2'; }));
check(15.1, 'collectAllTopics 过滤影子 _auto', cl1.some(function(x){ return x.id === 'v1'; }) && !cl1.some(function(x){ return x.id === 'v2'; }));
check(15.2, 'collectAllTopics 保留正式主题', cl1.filter(function(x){ return x.id === 't1' || x.id === 't3'; }).length === 2);

// --- 2.7 resolveParents（读关联项 JSON + 旧文本兜底） ---
const rpIdx = html.indexOf('function resolveParents');
const rpEnd = html.indexOf('var parents = resolveParents', rpIdx);
const rpCode = html.slice(rpIdx, rpEnd);
function runParents(rec, tables) {
  const sb = makeSandbox({
    storeState: { tableRecords: tables || { year_plan: [], courses: [], projects: [] } },
    v2a_fetchRecord: function(){ return rec; }
  });
  vm.createContext(sb);
  vm.runInContext(rpCode + '\nthis.__api = { resolveParents: resolveParents };', sb);
  return sb.__api.resolveParents('study_tasks', 'r1');
}
let p1 = runParents({ _id: 'r1', '关联项': '[{"t":"year_plan","id":"yp1"},{"t":"study_tasks","id":"x"},{"t":"courses","id":"c1"}]' });
check(16, 'resolveParents 读关联项 JSON（过滤任务类型）', p1.length === 2 && p1[0].type === 'year_plan' && p1[1].type === 'courses');
let p2 = runParents({ _id: 'r1', '关联计划': '雅思 7.0' }, { year_plan: [{ _id: 'yp9', '标题': '雅思 7.0' }], courses: [], projects: [] });
check(16.1, 'resolveParents 旧文本精确匹配兜底', p2.length === 1 && p2[0].id === 'yp9');
let p3 = runParents({ _id: 'r1' });
check(16.2, 'resolveParents 无数据返回空', p3.length === 0);

// ============ 汇总 ============
const total = report.length;
const passed = report.filter(function(r){ return r.passed; }).length;
console.log('\n===== v2h 关联选择器/主题继承/主页重排 测试 =====');
console.log('Total: ' + total + ' | Passed: ' + passed + ' | Failed: ' + (total - passed));
process.exit(total === passed ? 0 : 1);
