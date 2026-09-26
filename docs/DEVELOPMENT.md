# Development

## Run

- Double-click `color-analyzer.html`, or
- `python3 -m http.server 8000` → http://localhost:8000/color-analyzer.html

No install, build, or lint step exists. Fonts load from Google Fonts. Offline, the app still works but falls back to system fonts.

## Headless smoke test (Playwright)

There are no automated tests yet. This script loads the page, feeds it a synthetic gradient image, and checks that the results render without page errors. Chromium must be available; set `PLAYWRIGHT_BROWSERS_PATH` if needed.

```js
// smoke.js — run with: node smoke.js  (needs `playwright` resolvable)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve('color-analyzer.html'));
  const png = await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 100;
    const x = c.getContext('2d');
    for (let i = 0; i < 300; i++) for (let j = 0; j < 100; j++) {
      x.fillStyle = `rgb(${i*255/300|0},${j*2},${(300-i)*255/300|0})`; x.fillRect(i, j, 1, 1);
    }
    return c.toDataURL('image/png');
  });
  await p.setInputFiles('#file-input', { name: 't.png', mimeType: 'image/png',
    buffer: Buffer.from(png.split(',')[1], 'base64') });
  await p.waitForSelector('#results-section.visible', { timeout: 15000 });
  console.log({ cards: await p.$$eval('.color-card', e => e.length), errs });
  await b.close();
})();
```

To reproduce the flat-colour hang from `KNOWN_ISSUES.md`, replace the gradient with three solid rectangles. The page throws `Cannot read properties of undefined (reading '0')` and the spinner never goes away.

## Palette validation snippet

```bash
node -e '
const s=require("fs").readFileSync("color-analyzer.html","utf8");
const js=s.slice(s.indexOf("<script>")+8, s.indexOf("const PALETTES"));
const P=new Function(js+";return {MONTANA_BLACK,MONTANA_GOLD,MTN_94,MTN_HARDCORE,MTN_WATERBASED,MTN_NITRO2G,MTN_VICE,MOLOTOW_PREMIUM,LOOP_COLORS}")();
for (const [k,v] of Object.entries(P)) console.log(k, v.length, "emptyCode", v.filter(c=>!c.code).length,
  "uniqueCodes", new Set(v.map(c=>c.code)).size, "uniqueHex", new Set(v.map(c=>c.hex.toUpperCase())).size,
  "badHex", v.filter(c=>!/^#[0-9a-f]{6}$/i.test(c.hex)).length);'
```

## Manual QA checklist

Run this after any change. Test at desktop width and at ~375 px (DevTools device mode).

- [ ] Drop a photo → spinner → cards, render, layer order, and wall calculator all appear.
- [ ] Change Paint Line → cards remap without re-clustering; render label updates.
- [ ] Match Quality slider + a fallback chip → some cards show an amber fallback tag.
- [ ] Color Depth / Min Coverage → nothing happens until ANALYZE.
- [ ] Exclude a card → dimmed, removed from render; Restore brings it back.
- [ ] Lock a card → picker opens, search works, Esc closes, choosing a swatch applies it; Unlock reverts.
- [ ] PIXEL / VECTOR / SPRAY / COMPARE all render; compare slider moves the split; block size slider re-renders.
- [ ] Zoom +/−/FIT, ctrl+wheel, drag-pan; pinch and one-finger pan on touch.
- [ ] Export CSV, Palette PDF (allow pop-ups), Stencils (multiple downloads).
- [ ] Save Session → Load Saved Session on a fresh page restores cards/locks/excludes.
- [ ] Save for Compare → change line → diff panel shows added/removed/changed.
- [ ] Mobile: hamburger drawer items work; bottom-sheet modal/picker; no horizontal scroll.
- [ ] Browser console has no errors.

## Commit style

Existing history uses short imperative-ish subjects ("Mobile UI improvements"). Keep commits focused. Update `README.md` when user-visible behaviour changes, and the `docs/` files when structure or data formats change.
