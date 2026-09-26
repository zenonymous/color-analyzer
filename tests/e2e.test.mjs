// End-to-end tests: drive the real page in headless Chromium.
// Run: npm test  (or npm run test:e2e). Serves the repo over HTTP like GitHub Pages.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { HTML_PATH } from './load-core.mjs';

let chromium;
try { ({ chromium } = await import('playwright')); } catch { /* not installed */ }
const skip = chromium ? false : 'playwright not installed (npm install)';

let server, baseUrl, browser;

before(async () => {
  if (skip) return;
  server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(HTML_PATH));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  baseUrl = `http://127.0.0.1:${server.address().port}/color-analyzer.html`;
  const opts = {};
  const local = '/opt/pw-browsers/chromium';
  if (process.env.PW_CHROMIUM_PATH) opts.executablePath = process.env.PW_CHROMIUM_PATH;
  else if (!process.env.CI && existsSync(local) && !existsSync(local + '-1194')) opts.executablePath = local;
  browser = await chromium.launch(opts);
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function openPage(t, { viewport, url = baseUrl } = {}) {
  const context = await browser.newContext({ acceptDownloads: true, viewport: viewport || { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // Fonts are an external request; don't let CI network flakiness matter
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto(url);
  t.after(() => context.close());
  return { page, errors };
}

// Draw a test image in the page and return it as a PNG buffer.
async function makeImage(page, kind, w = 300, h = 100) {
  const dataUrl = await page.evaluate(({ kind, w, h }) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (kind === 'flat') {
      ['#ff0000', '#00ff00', '#0000ff'].forEach((col, i) => { x.fillStyle = col; x.fillRect(i * w / 3, 0, w / 3, h); });
    } else if (kind === 'noise') {
      const img = x.createImageData(w, h);
      let s = 7;
      for (let i = 0; i < img.data.length; i += 4) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        const px = (i / 4) % w, py = Math.floor(i / 4 / w);
        img.data[i] = (px * 255 / w + (s & 31)) & 255; img.data[i + 1] = (py * 255 / h) & 255;
        img.data[i + 2] = (s >> 8) & 255; img.data[i + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    } else {
      const g = x.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#ff3300'); g.addColorStop(0.33, '#ffee00'); g.addColorStop(0.66, '#0066cc'); g.addColorStop(1, '#111111');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const v = x.createLinearGradient(0, 0, 0, h);
      v.addColorStop(0, 'rgba(255,255,255,0.5)'); v.addColorStop(1, 'rgba(0,0,0,0.3)');
      x.fillStyle = v; x.fillRect(0, 0, w, h);
    }
    return c.toDataURL('image/png');
  }, { kind, w, h });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

async function upload(page, buffer, name = 'test.png') {
  await page.setInputFiles('#file-input', { name, mimeType: 'image/png', buffer });
  await waitForResults(page);
}

async function waitForResults(page, timeout = 20000) {
  await page.waitForSelector('#results-section.visible', { timeout });
  await page.waitForFunction(() => !document.getElementById('loading').classList.contains('visible'), null, { timeout });
}

async function download(page, action) {
  const [dl] = await Promise.all([page.waitForEvent('download'), action()]);
  return { name: dl.suggestedFilename(), text: readFileSync(await dl.path(), 'utf8') };
}

const paintCount = page => page.evaluate(() => activePaints().length);

test('photo: analyse, render all modes, no errors', { skip }, async t => {
  const { page, errors } = await openPage(t);
  await upload(page, await makeImage(page, 'gradient'));
  assert.equal(await page.locator('.color-card').count(), 12);
  assert.ok(await page.locator('#montana-render-canvas').isVisible());
  assert.ok(await page.evaluate(() => analysisWorker !== null), 'clustering should run in the worker');

  await page.click('#mode-vector-btn');
  assert.ok(await page.locator('#montana-render-svg').isVisible());
  const rects = await page.locator('#montana-render-svg rect').count();
  const blocks = await page.evaluate(() => lastBlocks.length);
  assert.ok(rects > 0 && rects < blocks, `merged rects (${rects}) should be fewer than blocks (${blocks})`);

  await page.click('#mode-spray-btn');
  assert.ok(await page.locator('#montana-render-canvas.spray-mode').isVisible());
  await page.click('#mode-compare-btn');
  assert.ok(await page.locator('#compare-slider-row.visible').isVisible());
  await page.click('#mode-pixel-btn');
  assert.ok(!(await page.locator('#compare-slider-row.visible').count()));
  assert.deepEqual(errors, []);
});

test('flat-colour image no longer hangs', { skip }, async t => {
  const { page, errors } = await openPage(t);
  await upload(page, await makeImage(page, 'flat'));
  assert.equal(await page.locator('.color-card').count(), 3);
  assert.match(await page.textContent('#toast'), /only 3 distinct colors/);
  assert.deepEqual(errors, []);
});

test('analysis is reproducible', { skip }, async t => {
  const { page } = await openPage(t);
  await upload(page, await makeImage(page, 'gradient'));
  const first = await page.evaluate(() => JSON.stringify(rawClusters));
  await page.click('#analyze-btn');
  await waitForResults(page);
  assert.equal(await page.evaluate(() => JSON.stringify(rawClusters)), first);
});

test('excluded colours leave wall calc, layer order, render and CSV', { skip }, async t => {
  const { page } = await openPage(t);
  await upload(page, await makeImage(page, 'flat'));
  assert.equal(await page.locator('.layer-step').count(), 3);
  await page.click('.btn-exclude[data-idx="0"]');
  assert.equal(await page.locator('.layer-step').count(), 2);
  const excludedName = await page.evaluate(() => analysisResult[0].montana.name);
  assert.ok(!(await page.textContent('#wall-cans-list')).includes(excludedName));
  assert.equal(await page.evaluate(() => new Set(lastBlocks.map(b => b.key)).size), 2);
  const csv = await download(page, () => page.click('#export-btn-bottom'));
  assert.ok(!csv.text.includes(excludedName));
});

test('lock picker lists every paint and locks keep their source line', { skip }, async t => {
  const { page } = await openPage(t);
  await upload(page, await makeImage(page, 'gradient'));
  await page.click('.btn-lock[data-idx="0"]');
  assert.equal(await page.locator('.lock-swatch').count(), 1335);
  await page.fill('#lock-picker-search', 'mtn vice');
  assert.equal(await page.locator('.lock-swatch').count(), 50);
  await page.fill('#lock-picker-search', 'molotow');
  await page.locator('.lock-swatch').first().click();
  const r = await page.evaluate(() => ({ line: analysisResult[0].lineName, locked: analysisResult[0].isLocked }));
  assert.deepEqual(r, { line: 'Molotow Premium', locked: true });
  const csv = await download(page, () => page.click('#export-btn-bottom'));
  assert.match(csv.text, /Molotow Premium/);
});

test('shopping list aggregates paints and uses one can formula', { skip }, async t => {
  const { page } = await openPage(t);
  await upload(page, await makeImage(page, 'gradient'));
  // Lock two clusters to the same paint → one shopping-list line
  await page.evaluate(() => { const p = MONTANA_BLACK[0]; lockedOverrides.set(0, p); lockedOverrides.set(1, p); rematch(); });
  const paints = await paintCount(page);
  const csv = await download(page, () => page.click('#export-btn-bottom'));
  assert.ok(csv.text.startsWith('﻿'), 'BOM for Excel');
  const lines = csv.text.trim().split('\r\n');
  assert.equal(lines.length, 1 + paints + 2, 'header + one row per paint + blank + total');
  const total = await page.evaluate(() => totalCans());
  assert.equal(await page.textContent('#wall-cans-val'), String(total));
  assert.match(await page.textContent('#summary-pills'), new RegExp(`~${total} cans`));
  assert.match(await page.textContent('.cans-hint[data-idx="0"]'), /same can as #2/);
  await page.click('#wall-calc-toggle');
  await page.fill('#wall-w', '20');
  const bigger = await page.evaluate(() => totalCans());
  assert.ok(bigger > total);
  assert.match(await page.textContent('#summary-pills'), new RegExp(`~${bigger} cans`));
});

test('session round trip restores image, locks, settings', { skip }, async t => {
  const { page, errors } = await openPage(t);
  await upload(page, await makeImage(page, 'gradient'));
  await page.selectOption('#paint-line', 'MOLOTOW');
  await page.click('#wall-calc-toggle');
  await page.fill('#wall-w', '8');
  await page.click('#mode-vector-btn');
  await page.click('.btn-exclude[data-idx="2"]');
  await page.evaluate(() => { lockedOverrides.set(1, LOOP_COLORS[5]); rematch(); });
  const before = await page.evaluate(() => JSON.stringify(analysisResult));

  await page.click('#save-session-btn');
  const file = await download(page, () => page.click('#session-save-confirm'));
  const json = JSON.parse(file.text);
  assert.equal(json._version, 2);
  assert.ok(json.image && json.image.dataUrl.startsWith('data:image/'));

  await page.click('#reset-btn');
  await page.setInputFiles('#session-load-input', { name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.text) });
  await waitForResults(page);
  await page.waitForSelector('#montana-render-svg', { state: 'visible' });
  const after = await page.evaluate(() => ({
    result: JSON.stringify(analysisResult), line: paintLineEl.value, wall: wallW.value, mode: renderMode,
    lock: analysisResult[1].montana.name, excluded: analysisResult[2].isExcluded,
  }));
  assert.equal(after.result, before);
  const lockName = await page.evaluate(() => LOOP_COLORS[5].name);
  assert.deepEqual({ ...after, result: undefined }, { result: undefined, line: 'MOLOTOW', wall: '8', mode: 'vector', lock: lockName, excluded: true });
  assert.deepEqual(errors, []);
});

test('legacy v1 session loads and can attach an image', { skip }, async t => {
  const { page, errors } = await openPage(t);
  const v1 = {
    _version: 1, _type: 'montana-session', name: 'old', savedAt: '2026-02-26T17:00:00.000Z',
    paintLine: 'BLACK', colorCount: '12', minPct: '1', matchQuality: '70', blockSize: '12', fallbackKeys: [],
    rawClusters: [{ rgb: [250, 30, 20], hex: '#FA1E14', pct: '60.0' }, { rgb: [20, 40, 200], hex: '#1428C8', pct: '40.0' }],
    excludedIndices: [], lockedOverrides: [{ idx: 1, color: { code: 'G1000', name: 'Vanilla', hex: '#FFF17D' } }],
    analysisResult: [],
  };
  await page.setInputFiles('#session-load-input', { name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v1)) });
  await waitForResults(page);
  assert.equal(await page.locator('.color-card').count(), 2);
  assert.ok(await page.locator('#attach-image-btn').isVisible());
  assert.equal(await page.evaluate(() => analysisResult[1].lineName), 'Montana GOLD');

  await page.setInputFiles('#attach-image-input', { name: 'img.png', mimeType: 'image/png', buffer: await makeImage(page, 'flat') });
  await page.waitForSelector('#montana-render-canvas', { state: 'visible' });
  assert.ok(await page.evaluate(() => analysisResult[1].isLocked), 'lock kept after attaching image');
  assert.deepEqual(errors, []);
});

test('hostile session file cannot inject HTML', { skip }, async t => {
  const { page } = await openPage(t);
  const evil = '<img src=x onerror="window.__xss=1">';
  const s = {
    _version: 2, _type: 'montana-session', name: evil, paintLine: 'BLACK" onmouseover="x',
    rawClusters: [{ rgb: [1, 2, 3], hex: 'red;}</style><script>window.__xss=1</script>', pct: '100' }],
    lockedOverrides: [{ idx: 0, color: { code: evil, name: evil, hex: '#123456' } }],
    analysisResult: [{ montana: { code: evil, name: evil, hex: '#123456' }, pct: '100', delta: 1 }],
  };
  const buf = Buffer.from(JSON.stringify(s));
  await page.setInputFiles('#session-load-input', { name: 'evil.json', mimeType: 'application/json', buffer: buf });
  await waitForResults(page);
  await page.click('#layer-order-toggle');
  await page.setInputFiles('#compare-load-input', { name: 'evil.json', mimeType: 'application/json', buffer: buf });
  await page.waitForSelector('#diff-panel.has-data');
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('#color-grid img, #layer-order-steps img, #diff-table-wrap img').count(), 0);
  assert.equal(await page.evaluate(() => paintLineEl.value), 'BLACK');
});

test('stencils: one merged SVG per paint in spray order', { skip }, async t => {
  const { page } = await openPage(t);
  await upload(page, await makeImage(page, 'flat'));
  const names = [];
  page.on('download', d => names.push(d.suggestedFilename()));
  const first = await download(page, () => page.click('#stencil-btn'));
  await page.waitForTimeout(1000);
  assert.equal(names.length, 3);
  assert.match(first.name, /^stencil_01_.+\.svg$/);
  // A flat vertical band merges into a single rectangle
  assert.equal((first.text.match(/<rect x=/g) || []).length, 1);
});

test('large photo stays responsive', { skip }, async t => {
  const { page, errors } = await openPage(t);
  const start = Date.now();
  await upload(page, await makeImage(page, 'noise', 4000, 3000), 'big.png');
  const ms = Date.now() - start;
  assert.ok(ms < 20000, `took ${ms} ms`);
  assert.match(await page.textContent('#image-meta'), /4000 × 3000 · analysed at 1600 × 1200/);
  await page.fill('#block-size', '4');
  await page.dispatchEvent('#block-size', 'input');
  await page.waitForTimeout(500);
  assert.deepEqual(errors, []);
});

test('mobile: drawer has load session, no horizontal scroll', { skip }, async t => {
  const { page } = await openPage(t, { viewport: { width: 375, height: 800 } });
  await page.click('#mobile-menu-btn');
  assert.ok(await page.locator('#mob-load-session-btn').isVisible());
  await page.click('#mobile-drawer-overlay', { force: true });
  await upload(page, await makeImage(page, 'gradient'));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `horizontal overflow ${overflow}px`);
});

test('works from file:// (worker or main-thread fallback)', { skip }, async t => {
  const { page, errors } = await openPage(t, { url: 'file://' + HTML_PATH });
  await upload(page, await makeImage(page, 'gradient'));
  assert.equal(await page.locator('.color-card').count(), 12);
  assert.deepEqual(errors, []);
});
