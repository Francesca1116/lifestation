// sky_test.js — SKYLINE 学习足迹（2D↔3D 贡献图）纯函数测试
// 覆盖：levelOf 百分比分级、barHeight 固定映射、日期本地化（跨月/跨年）、
//       buildGrid 含今天 + 本地日期、buildAnalytics 完成率（综合/单项目/勾选式/未启用排除）、
//       habitPaletteKey 颜色映射、computeStats 连续达标

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'src', '生活站.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

const skyStart = html.indexOf('var SKYLINE = {};');
if (skyStart < 0) { console.error('FAIL: SKYLINE 未找到'); process.exit(2); }
const renderHabit = html.indexOf('function renderHabitMod() {', skyStart);
const skyCode = html.slice(skyStart, renderHabit);
console.log('[extract] skyline code:', skyCode.length, 'chars');

const sandbox = { console, Date, Math, JSON, Object, Array, String, Number, Boolean, parseFloat, parseInt, isNaN, isFinite, RegExp, Error, setTimeout, clearTimeout, setInterval, clearInterval };
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

try { vm.runInContext(skyCode, sandbox, { filename: 'skyline.js' }); }
catch (e) { console.error('FAIL: 注入 SKYLINE 抛错:', e.message); process.exit(2); }

const SKY = sandbox.SKYLINE;
if (!SKY || !SKY.buildAnalytics) { console.error('FAIL: SKYLINE.buildAnalytics 未定义'); process.exit(2); }

const report = [];
function check(id, name, cond, detail) { report.push({ id, name, passed: !!cond, detail: detail || '' }); }

// ===== 1. levelOf 六档百分比分级 =====
check(1, 'levelOf(0)=0', SKY.levelOf(0) === 0);
check(1.1, 'levelOf(1)=1', SKY.levelOf(1) === 1);
check(1.2, 'levelOf(25)=1', SKY.levelOf(25) === 1);
check(1.3, 'levelOf(26)=2', SKY.levelOf(26) === 2);
check(1.4, 'levelOf(51)=3', SKY.levelOf(51) === 3);
check(1.5, 'levelOf(76)=4', SKY.levelOf(76) === 4);
check(1.6, 'levelOf(99)=4', SKY.levelOf(99) === 4);
check(1.7, 'levelOf(100)=5', SKY.levelOf(100) === 5);

// ===== 2. barHeight 固定百分比映射 =====
check(2, 'barHeight(0)=0.2', Math.abs(SKY.barHeight(0) - 0.2) < 1e-9);
check(2.1, 'barHeight(100)>7', SKY.barHeight(100) > 7);
check(2.2, 'barHeight(50) 介于 0.2 与 100 之间', SKY.barHeight(50) > SKY.barHeight(0) && SKY.barHeight(50) < SKY.barHeight(100));

// ===== 3. 日期本地化（跨月/跨年）=====
check(3, 'parseKey 正确', (function(){ var p = SKY.parseKey('2026-10-13'); return p.y === 2026 && p.m === 9 && p.d === 13; })());
check(3.1, 'nextKey 跨月', SKY.nextKey('2026-10-31') === '2026-11-01');
check(3.2, 'nextKey 跨年', SKY.nextKey('2026-12-31') === '2027-01-01');
check(3.3, 'nextKey 平年2月', SKY.nextKey('2026-02-28') === '2026-03-01');
check(3.4, 'toKey 是本地日期格式', /^\d{4}-\d{2}-\d{2}$/.test(SKY.toKey(Date.now())));

// ===== 4. buildGrid 含今天 + 本地日期 =====
const grid = SKY.buildGrid([{ date: '2026-10-13', count: 100 }], '2026-10-13', 0);
check(4, 'grid 有 cells', grid.cells && grid.cells.length > 0);
check(4.1, 'grid 覆盖约一年（>=360 天）', grid.cells.length >= 360);
check(4.2, '最后一天 = 今天（2026-10-13）', grid.cells[grid.cells.length - 1].date === '2026-10-13');
check(4.3, '今天的 count=100、level=5', grid.cells[grid.cells.length - 1].count === 100 && grid.cells[grid.cells.length - 1].level === 5);
check(4.4, '无数据日期 level=0', grid.cells[0].count === 0 && grid.cells[0].level === 0);

// ===== 5. buildAnalytics 综合完成率 =====
const ts = new Date(2026, 8, 1).getTime(); // 2026-09-01 本地
const habits = [
  { _id: 'h1', '标题': '日语', '目标/天': 60, '单位': '分钟', '启用': true, '颜色': '紫', _ts: ts },
  { _id: 'h2', '标题': '西班牙语', '目标/天': 60, '单位': '分钟', '启用': true, '颜色': '绿', _ts: ts },
  { _id: 'h3', '标题': '阅读', '启用': true, '颜色': '蓝', _ts: ts }
];
const checkins = [
  { '日期': '2026-10-13', '习惯 ID': 'h1', '数值': 45 },
  { '日期': '2026-10-13', '习惯 ID': 'h2', '数值': 60 },
  { '日期': '2026-10-13', '习惯 ID': 'h3', '数值': 1 },
  { '日期': '2026-10-12', '习惯 ID': 'h1', '数值': 60 }
];
const ana = SKY.buildAnalytics(habits, checkins, 'all', '2026-10-13');
check(5, '综合完成率 10-13 = 92%（(75+100+100)/3）', ana.days['2026-10-13'] && ana.days['2026-10-13'].count === 92);
check(5.1, '10-13 planned=true', ana.days['2026-10-13'] && ana.days['2026-10-13'].planned === true);
check(5.2, '10-13 有 3 个习惯明细', ana.days['2026-10-13'] && ana.days['2026-10-13'].items.length === 3);
check(5.3, '10-12 综合=33%（仅日语达标，西语/阅读未打卡）', ana.days['2026-10-12'] && ana.days['2026-10-12'].count === 33);
check('5.3b', '10-12 h1 明细 rate=1.0', ana.days['2026-10-12'] && ana.days['2026-10-12'].items.some(function(it){ return it.id === 'h1' && it.rate === 1; }));

// ===== 6. 单项目完成率 =====
const anaSingle = SKY.buildAnalytics(habits, checkins, 'h1', '2026-10-13');
check(6, '单项目日语 10-13 = 75%（45/60）', anaSingle.days['2026-10-13'] && anaSingle.days['2026-10-13'].count === 75);
check(6.1, '单项目不含西班牙语明细', anaSingle.days['2026-10-13'] && anaSingle.days['2026-10-13'].items.length === 1);

// ===== 7. 勾选式习惯（无目标）=====
const habitsOnlyCheck = [
  { _id: 'h3', '标题': '阅读', '启用': true, _ts: ts }
];
const anaCheck = SKY.buildAnalytics(habitsOnlyCheck, [
  { '日期': '2026-10-13', '习惯 ID': 'h3', '数值': 1 }
], 'all', '2026-10-13');
check(7, '勾选式有打卡 = 100%', anaCheck.days['2026-10-13'] && anaCheck.days['2026-10-13'].count === 100);
check(7.1, '勾选式无打卡 = 0%（计划但未完成）', anaCheck.days['2026-10-12'] && anaCheck.days['2026-10-12'].count === 0);

// ===== 8. 未启用排除 =====
const habitsDisabled = [
  { _id: 'h1', '标题': '日语', '目标/天': 60, '启用': true, _ts: ts },
  { _id: 'h2', '标题': '西语', '目标/天': 60, '启用': false, _ts: ts }
];
const anaDisabled = SKY.buildAnalytics(habitsDisabled, checkins, 'all', '2026-10-13');
check(8, '停用习惯不参与（10-13 只含日语）', anaDisabled.days['2026-10-13'] && anaDisabled.days['2026-10-13'].count === 75 && anaDisabled.days['2026-10-13'].items.length === 1);

// ===== 9. habitPaletteKey 颜色映射 =====
check(9, '绿 → sage', SKY.habitPaletteKey('绿') === 'sage');
check(9.1, '粉 → pink', SKY.habitPaletteKey('粉') === 'pink');
check(9.2, '蓝 → blue', SKY.habitPaletteKey('蓝') === 'blue');
check(9.3, '橙 → orange', SKY.habitPaletteKey('橙') === 'orange');
check(9.4, '紫/未知 → lavender', SKY.habitPaletteKey('紫') === 'lavender' && SKY.habitPaletteKey('') === 'lavender');

// ===== 10. computeStats 连续达标 =====
const statsCells = [
  { count: 100 }, { count: 100 }, { count: 100 }, { count: 50 }, { count: 100 }
];
const st = SKY.computeStats(statsCells);
check(10, '达标天数=4', st.hit === 4);
check(10.1, '最长连续=3', st.longest === 3);
check(10.2, '当前连续=1（今天100%，昨天50%断开）', st.current === 1);

// ===== 输出 =====
const allPassed = report.every(r => r.passed);
const passedCount = report.filter(r => r.passed).length;
console.log('\n===== skyline 纯函数测试报告 =====');
report.forEach(r => {
  console.log('  #' + r.id + ' ' + (r.passed ? '✓' : '✗') + ' ' + r.name + (r.detail && !r.passed ? '  [' + r.detail + ']' : ''));
});
console.log('---');
console.log('Total: ' + report.length + ' | Passed: ' + passedCount + ' | Failed: ' + (report.length - passedCount));
console.log('Overall: ' + (allPassed ? '✓ ALL PASS' : '✗ FAIL'));

const outDir = path.join(ROOT, '.workbuddy', 'output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'sky-test-report.json'), JSON.stringify({
  schema_version: 1, test_mode: 'skyline', timestamp: new Date().toISOString(),
  total: report.length, passed: passedCount, failed: report.length - passedCount, all_passed: allPassed, report
}, null, 2));

process.exit(allPassed ? 0 : 1);
