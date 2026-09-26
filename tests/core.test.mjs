import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore } from './load-core.mjs';

const { CA, PALETTES, LINE_NAMES } = loadCore();
// Values from the sandbox have foreign prototypes; normalise before deepEqual.
const plain = v => JSON.parse(JSON.stringify(v));
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} expected ${b}, got ${a}`);

test('hex <-> rgb round trip', () => {
  assert.deepEqual(plain(CA.hexToRgb('#FF8000')), [255, 128, 0]);
  assert.equal(CA.rgbToHex(255, 128, 0), '#FF8000');
  assert.ok(CA.isHex('#abcdef'));
  assert.ok(!CA.isHex('#abc'));
  assert.ok(!CA.isHex('red;background:url(x)'));
});

test('rgbToLab reference values (D65)', () => {
  const white = CA.rgbToLab(255, 255, 255);
  close(white[0], 100, 0.02); close(white[1], 0, 0.02); close(white[2], 0, 0.02);
  const black = CA.rgbToLab(0, 0, 0);
  close(black[0], 0, 0.01);
  const red = CA.rgbToLab(255, 0, 0);
  close(red[0], 53.24, 0.05); close(red[1], 80.09, 0.1); close(red[2], 67.20, 0.1);
});

// Sharma, Wu & Dalal (2005) CIEDE2000 test data
const SHARMA = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
  [[50, -0.001, 2.49], [50, 0.0009, -2.49], 4.8045],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
  [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0000],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[22.7233, 20.0904, -46.6940], [23.0331, 14.9730, -42.5619], 2.0373],
  [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
  [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
  [[2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082],
];

test('deltaE2000 matches Sharma reference data', () => {
  for (const [a, b, expected] of SHARMA) {
    close(CA.deltaE2000(a, b), expected, 1e-4, `${a} vs ${b}`);
    close(CA.deltaE2000(b, a), expected, 1e-4, 'symmetry');
  }
  assert.equal(CA.deltaE2000([50, 10, 10], [50, 10, 10]), 0);
});

test('match % scale and ratings', () => {
  assert.equal(CA.deltaToMatchPct(0), 100);
  assert.equal(CA.deltaToMatchPct(7.5), 70);
  assert.equal(CA.deltaToMatchPct(100), 0);
  assert.equal(CA.matchPctToDelta(70), 7.5);
  assert.equal(CA.deltaRating(2), 'good');
  assert.equal(CA.deltaRating(7), 'ok');
  assert.equal(CA.deltaRating(15), 'poor');
});

function imageData(pixels) { // pixels: [[r,g,b,a], ...]
  const d = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach((p, i) => d.set(p, i * 4));
  return d;
}

test('kMeans returns fewer clusters for flat images instead of failing', () => {
  const px = [];
  for (let i = 0; i < 3000; i++) px.push(i % 3 === 0 ? [255, 0, 0, 255] : i % 3 === 1 ? [0, 255, 0, 255] : [0, 0, 255, 255]);
  const s = CA.samplePixels(imageData(px));
  const clusters = CA.clusterSamples({ ...s, k: 12, minPct: 0 });
  assert.equal(clusters.length, 3);
  const hexes = plain(clusters.map(c => c.hex)).sort();
  assert.deepEqual(hexes, ['#0000FF', '#00FF00', '#FF0000']);
  const sum = clusters.reduce((a, c) => a + parseFloat(c.pct), 0);
  close(sum, 100, 0.2);
});

test('single-colour image gives one cluster', () => {
  const s = CA.samplePixels(imageData(Array(500).fill([10, 20, 30, 255])));
  const clusters = CA.clusterSamples({ ...s, k: 8, minPct: 1 });
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].hex, '#0A141E');
  assert.equal(clusters[0].pct, '100.0');
});

test('transparent pixels are ignored and flagged', () => {
  const s = CA.samplePixels(imageData([[255, 0, 0, 0], [255, 0, 0, 100], [0, 0, 0, 255]]));
  assert.equal(s.n, 1);
  assert.ok(s.hasAlpha);
});

test('clustering is deterministic for a fixed seed', () => {
  const px = [];
  for (let i = 0; i < 5000; i++) px.push([(i * 37) % 256, (i * 91) % 256, (i * 13) % 256, 255]);
  const s = CA.samplePixels(imageData(px), 60000, 1);
  const a = CA.clusterSamples({ ...s, k: 10, seed: 1 });
  const b = CA.clusterSamples({ ...s, k: 10, seed: 1 });
  assert.deepEqual(plain(a), plain(b));
  assert.equal(a.length, 10);
});

test('minPct filter drops small clusters and renormalises', () => {
  const px = [...Array(990).fill([200, 200, 200, 255]), ...Array(10).fill([0, 0, 0, 255])];
  const s = CA.samplePixels(imageData(px));
  const clusters = CA.clusterSamples({ ...s, k: 2, minPct: 5 });
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].pct, '100.0');
});

test('mergeBlocks merges runs horizontally and vertically', () => {
  const blocks = [];
  for (let by = 0; by < 30; by += 10)
    for (let bx = 0; bx < 40; bx += 10) blocks.push({ bx, by, bw: 10, bh: 10, key: bx < 20 ? 'A' : 'B' });
  const rects = CA.mergeBlocks(blocks);
  assert.equal(rects.length, 2);
  const a = rects.find(r => r.key === 'A');
  assert.deepEqual(plain(a), { x: 0, y: 0, w: 20, h: 30, key: 'A' });
  // total area preserved
  assert.equal(rects.reduce((s, r) => s + r.w * r.h, 0), 40 * 30);
});

test('mergeBlocks does not bridge gaps from transparent blocks', () => {
  const rects = CA.mergeBlocks([{ bx: 0, by: 0, bw: 4, bh: 4, key: 'A' }, { bx: 8, by: 0, bw: 4, bh: 4, key: 'A' }]);
  assert.equal(rects.length, 2);
});

test('estimateCans', () => {
  assert.equal(CA.estimateCans(15, 10, 1.5), 1);
  assert.equal(CA.estimateCans(15, 50, 1.5), 5);
  assert.equal(CA.estimateCans(15, 0.1, 1.5), 1); // at least one can per used paint
  assert.equal(CA.estimateCans(0, 50, 1.5), 0);
});

test('aggregateByPaint merges clusters that use the same can', () => {
  const paint = { id: 'X|1', name: 'X' }, other = { id: 'Y|1', name: 'Y' };
  const agg = CA.aggregateByPaint([
    { montana: paint, pct: '30.0', delta: 4, hex: '#111111', index: 0 },
    { montana: other, pct: '50.0', delta: 2, hex: '#222222', index: 1 },
    { montana: paint, pct: '20.0', delta: 1.5, hex: '#333333', index: 2, isLocked: true },
  ], p => p.id);
  assert.equal(agg.length, 2);
  assert.equal(agg[0].id, 'X|1');
  close(agg[0].pct, 50, 1e-9);
  assert.equal(agg[0].bestDelta, 1.5);
  assert.deepEqual(plain(agg[0].indices), [0, 2]);
  assert.ok(agg[0].isLocked);
});

test('escapeHtml and CSV quoting', () => {
  assert.equal(CA.escapeHtml('<img src=x onerror="a()">&\''), '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;');
  const csv = CA.toCSV([['a', 'b,c'], ['say "hi"', 'x\ny']]);
  assert.equal(csv, '﻿a,"b,c"\r\n"say ""hi""","x\ny"');
});

test('palette data integrity', () => {
  assert.deepEqual(Object.keys(PALETTES).sort(), Object.keys(LINE_NAMES).sort());
  let total = 0;
  for (const [key, colors] of Object.entries(PALETTES)) {
    assert.ok(colors.length > 0, key);
    const ids = new Set();
    for (const c of colors) {
      assert.ok(CA.isHex(c.hex), `${key} ${c.name} bad hex ${c.hex}`);
      assert.ok(typeof c.name === 'string' && c.name.length > 0, `${key} missing name`);
      assert.equal(typeof c.code, 'string');
      const id = c.code || c.name;
      assert.ok(!ids.has(id), `${key}: duplicate paint identity "${id}"`);
      ids.add(id);
    }
    total += colors.length;
  }
  assert.equal(total, 1335);
});
