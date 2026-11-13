import puppeteer from 'puppeteer-core';
const shots = JSON.parse(process.argv[2]);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) logs.push(`[error] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:8765/test.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2000));
for (const [name, spec] of Object.entries(shots)) {
  await page.evaluate((spec) => {
    const n = window.__nook;
    if (spec.view) n.goView(spec.view, true);
    if (spec.pos) { n.camera.position.set(...spec.pos); n.controls.target.set(...spec.tgt); n.controls.update(); }
    if (spec.cfg) { spec.cfg(n); }
  }, spec);
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: `${name}.png` });
}
logs.push('[issues] ' + JSON.stringify(await page.evaluate(() => window.__nook.issues.filter(i => i.sev !== 'info').map(i => i.sev + ': ' + i.html.replace(/<[^>]+>/g, '')))));
console.log(logs.join('\n'));
await browser.close();
