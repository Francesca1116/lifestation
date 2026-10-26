/**
 * 生活站 README 截图脚本
 * 用法：NODE_PATH=/Users/hujiayun/.workbuddy/binaries/node/workspace/node_modules \
 *       node scripts/screenshot.js
 * 产出：docs/assets/{dashboard,boards,learn,work,analysis,mobile}.png
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const DEPLOY = path.join(ROOT, 'deploy');
const OUT = path.join(ROOT, 'docs', 'assets');
const PORT = 8123;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.css': 'text/css', '.js': 'application/javascript'
};

function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const file = path.join(DEPLOY, urlPath);
    if (!file.startsWith(DEPLOY)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function seed(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#dashShell.active', { timeout: 15000 });
  await page.waitForTimeout(1000);
  // 首次进入会弹 onboarding：直接点「加载示例数据」（走最完整的 seed 路径，含关联迁移）
  const onb = await page.$('#__onbSeed');
  if (onb) {
    await page.click('#__onbSeed');
  } else {
    // 否则走顶栏更多菜单 → 加载示例数据 → 确认
    await page.click('#moreBtn');
    await page.waitForTimeout(200);
    await page.click('#__moreMenu button[data-act="seed"]');
    await page.waitForTimeout(300);
    await page.click('#__confirmOk');
  }
  await page.waitForTimeout(3800); // seed + 主题生成 + renderAll，并等「已加载示例数据」toast 消失
  // 确保停在 dashboard
  await page.evaluate(() => { try { document.body.setAttribute('data-view', 'dashboard'); } catch(e){} });
  await page.waitForTimeout(400);
  return page;
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await seed(browser);

  // 1) dashboard 顶部
  await page.screenshot({ path: path.join(OUT, 'dashboard.png') });

  // 2) 三看板区（滚动到领域洞察标题）
  await page.evaluate(() => {
    const el = document.querySelector('.dash-domains') || document.querySelector('.boards-head');
    if (el) el.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -10);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'boards.png') });

  // 3) 学习群组
  await page.click('.side-item[data-nav="group"][data-gnav="learn"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'learn.png') });

  // 4) 工作群组
  await page.click('.side-item[data-nav="group"][data-gnav="work"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'work.png') });

  // 5) 主题发展（obs 群组 → 主题发展）
  await page.click('.side-item[data-nav="group"][data-gnav="obs"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'analysis.png') });

  // 6) 移动端（同 context 改 viewport，回 dashboard）
  await page.evaluate(() => {
    const btn = document.querySelector('.side-item[data-nav="dashboard"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'mobile.png') });

  await browser.close();
  server.close();
  console.log('screenshots done ->', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
