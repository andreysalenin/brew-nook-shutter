// node vessels/vshot.mjs <id> [view[:zoom][@x,y,z] ...]   (run from /home/claude/build)
// Default views: front threeq back top low. Writes vessels/shots/<id>_<view>.png and prints stats.
// No web server needed: requests to http://vessel.local/ are served from /home/claude/build.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/home/claude/build';
const [, , id, ...vs] = process.argv;
if (!id) { console.error('usage: node vessels/vshot.mjs <id> [views]'); process.exit(1); }
const views = vs.length ? vs : ['front', 'threeq', 'back', 'top', 'low'];
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 900 });
await page.setRequestInterception(true);
const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
page.on('request', (req) => {
  const u = new URL(req.url());
  if (u.host !== 'vessel.local') return req.abort();
  const f = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!fs.existsSync(f)) return req.respond({ status: 404, body: 'nf' });
  req.respond({ status: 200, contentType: types[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
});
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(`http://vessel.local/vessels/harness.html?v=${id}`, { waitUntil: 'load' });
try { await page.waitForFunction('window.ready === true', { timeout: 60000 }); } catch { console.log(logs.join('\n')); console.log('harness did not become ready'); await browser.close(); process.exit(1); }
console.log(JSON.stringify(await page.evaluate(() => window.stats)));
for (const v of views) {
  const [nameZoom, tgt] = v.split('@');
  const [name, zoom] = nameZoom.split(':');
  await page.evaluate((n, z, t) => window.setView(n, z ? +z : 1, t ? t.split(',').map(Number) : undefined), name, zoom, tgt);
  const file = `${ROOT}/vessels/shots/${id}_${v.replace(/[^a-z0-9]+/gi, '_')}.png`;
  await page.screenshot({ path: file });
  console.log('wrote', file);
}
if (logs.length) console.log(logs.join('\n'));
await browser.close();
