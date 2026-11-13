import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://localhost:8765/test.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  const c = JSON.parse(JSON.stringify(window.__nook.cfg()));
  c.v = 1; c.door.step = true; delete c.door.window;
  c.items = c.items.filter(i => i.kind !== 'g40');
  c.items.splice(4, 0, { id: 'glycol', kind: 'glycol', show: true, on: 'green:g1', along: 300 }, { id: 'icemaster', kind: 'icemaster', show: true, on: 'green:g2', along: 300 });
  const g = c.racks.green.levels; g[1].deck = 'mdf'; g[1].to = 1500; g[2].from = 0; c.nook.width = 1700;
  localStorage.setItem('brew-nook-shutter-v1', JSON.stringify(c));
});
await page.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 1500));
console.log(JSON.stringify(await page.evaluate(() => { const c = window.__nook.cfg(); return { v: c.v, width: c.nook.width, door: c.door, kinds: c.items.map(i => i.kind), g1: c.racks.green.levels[1], g2: c.racks.green.levels[2] }; })), errs);
await page.evaluate(() => localStorage.clear());
await browser.close();
