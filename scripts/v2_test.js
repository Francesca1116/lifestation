/* v2 Phase 1 测试（纯 eval 模式，无 jsdom）
   - 从 src/生活站.html 提取 Phase 1 模块
   - 用 vm 沙箱执行（最小 DOM 桩）
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = process.argv[2] || path.join(__dirname, '..', 'src', '生活站.html');
const REPORT_PATH = process.argv[3] || path.join(__dirname, '..', '.workbuddy', 'output', 'v2-test-report.json');

const html = fs.readFileSync(HTML_PATH, 'utf8');
const startMarker = 'Phase 1: Topic Analytics v2（测试 namespace';
const endMarker = 'window.__v2 = {';
const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker);

if (startIdx < 0 || endIdx < 0) {
  console.error('FAIL: cannot find v2 module markers');
  process.exit(2);
}

// 找到 v2 模块结束（endMarker 后的 } 闭合）
let moduleEnd = endIdx;
let depth = 0;
for (let i = endIdx; i < html.length; i++) {
  if (html[i] === '{') depth++;
  else if (html[i] === '}') { depth--; if (depth < 0) { moduleEnd = i + 1; break; } }
}
// 跳过 startIdx 起始的 /* ... */ 注释块
let codeStart = startIdx;
const commentEnd = html.indexOf('*/', startIdx);
if (commentEnd > 0 && commentEnd < endIdx) {
  const nl = html.indexOf('\n', commentEnd);
  if (nl > 0) codeStart = nl + 1;
}
const v2Code = html.slice(codeStart, moduleEnd);

// 最小桩：localStorage / Date / Math.random / console
const store = {};
const sandbox = {
  console: console,
  Date: Date,
  Math: Math,
  JSON: JSON,
  Object: Object,
  Array: Array,
  Number: Number,
  String: String,
  RegExp: RegExp,
  isNaN: isNaN,
  setTimeout: setTimeout,
  localStorage: {
    _data: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  },
  location: { search: '?topicTest=1' }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

try {
  vm.createContext(sandbox);
  vm.runInContext(v2Code, sandbox, { timeout: 10000 });
} catch (e) {
  console.error('FAIL: v2 module load error:', e.message);
  process.exit(2);
}

if (!sandbox.__v2) {
  console.error('FAIL: window.__v2 not exposed');
  process.exit(2);
}

const v2 = sandbox.__v2;

// 跑测试
const cases = v2.runAllCases();
const acceptance = v2.runAcceptanceSuite();

const report = {
  timestamp: new Date().toISOString(),
  schema_version: v2.SCHEMA_VERSION,
  test_mode: v2.TEST_MODE,
  cases: cases,
  acceptance: acceptance,
  passed: cases.allPassed && acceptance.allPassed
};

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

console.log('===== Topic Analytics v2 Phase 1 Test Report =====');
console.log('schema_version:', report.schema_version);
console.log('test_mode:', report.test_mode);
console.log('--- 4 Cases ---');
cases.results.forEach(r => {
  const flag = r.passed ? '✓' : '✗';
  console.log(`  Case ${r.case} [${flag}] ${r.topic}`);
  console.log(`     familiarity=${r.familiarity}, evidence=${r.evidence_count}, stability=${r.stability || '-'}`);
  console.log(`     expectation: ${r.expectation}`);
  if (r.cotopic_raw != null) {
    console.log(`     cotopic: raw=${r.cotopic_raw}, weighted=${r.cotopic_weighted}, candidate=${r.cotopic_candidate}`);
  }
});
console.log('  cases allPassed:', cases.allPassed);
console.log('--- 8 Acceptance ---');
acceptance.report.forEach(r => {
  console.log(`  #${r.id} [${r.passed ? '✓' : '✗'}] ${r.name}`);
});
console.log('  acceptance allPassed:', acceptance.allPassed);
console.log('---');
console.log('OVERALL:', report.passed ? '✓ ALL PASS' : '✗ FAILED');
console.log('Report written to:', REPORT_PATH);

process.exit(report.passed ? 0 : 1);
