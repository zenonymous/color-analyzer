# Development

## Run

- Double-click `color-analyzer.html`, or
- `python3 -m http.server 8000` → http://localhost:8000/color-analyzer.html (closest to GitHub Pages)

There's no build step. Fonts load from Google Fonts; offline, the app falls back to system fonts.

## Tests

```bash
npm install                        # dev-only: installs Playwright
npx playwright install chromium    # once, if you don't already have a Chromium for Playwright
npm test                           # unit + e2e (node --test)
npm run test:unit                  # fast, no browser
npm run test:e2e
```

Node 22+ required. The e2e tests serve the HTML on a local HTTP server (like GitHub Pages) and also run it once from `file://`. If Playwright isn't installed, the e2e tests are skipped. Set `PW_CHROMIUM_PATH=/path/to/chrome` to use a specific browser.

| File | What it covers |
|---|---|
| `tests/load-core.mjs` | Pulls `<script id="core-lib">` and `<script id="palette-data">` out of the HTML into a `vm` sandbox, so tests run the shipped code. |
| `tests/core.test.mjs` | Lab conversion, CIEDE2000 vs Sharma reference data, match-% scale, sampling and transparency, k-means (flat images, determinism, min coverage), block merging, can estimates, aggregation, escaping, CSV, palette integrity. |
| `tests/e2e.test.mjs` | Real page in Chromium: full photo flow and all render modes; flat-image regression; reproducibility; exclusions leaving every output; lock picker completeness and line names; aggregated shopping list and unified can counts; session v2 round trip; legacy v1 session plus attach image; hostile session files; stencils; a 12 MP image; mobile drawer and overflow; `file://`. |

Values that come out of the vm sandbox have foreign prototypes. Normalise them with `plain()` (a JSON round trip) before `deepEqual`.

## CI

`.github/workflows/ci.yml` runs `npm ci`, installs Chromium, and runs `npm test` on every push and pull request. GitHub Pages serves `color-analyzer.html` as-is. CI doesn't deploy anything.

## Manual QA checklist

The e2e tests cover most flows, but check these by eye after UI changes, at desktop width and at ~375 px:

- [ ] Layout of cards, pills, controls, fallback bar; no horizontal scroll on mobile.
- [ ] Render modes look right; spray looks like spray; compare slider tracks the handle while zoomed and scrolled.
- [ ] Zoom +/−/FIT, ctrl+wheel, drag-pan; pinch and one-finger pan on a real touch device.
- [ ] Lock picker and save dialog as bottom sheets on mobile; Esc closes them on desktop.
- [ ] Palette PDF prints nicely (colours printed, cards not split across pages).
- [ ] Stencil SVGs open in Inkscape or a cutter app.
- [ ] Browser console is clean.

## Commit style

Short imperative subjects ("Fix flat-image hang in k-means"). Keep commits focused. Update `README.md` for user-visible changes and `docs/` for structure or format changes.
