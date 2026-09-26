# Data model

## PaintColor (catalogue entry)

```js
{ code: "BLK 1010", name: "Easter Yellow", hex: "#FFED52" }
```
- `code` may be an **empty string** for some lines (see `PALETTES.md`).
- `hex` is `#RRGGBB`; case is inconsistent between lines (upper in Montana, lower in Molotow/Loop/Vice). Compare hex values case-insensitively if you add new logic.
- Code references `locked._lineName`, but no catalogue entry sets it, so it is always `undefined`.

## Cluster (`rawClusters[i]`)

Produced by `kMeans`, then filtered and renormalised in `runFullAnalysis`:

```js
{ rgb: [r, g, b],     // integer centroid
  hex: "#RRGGBB",     // uppercase
  pct: "12.3" }       // STRING, percent of sampled opaque pixels, renormalised after min-coverage filter
```

Sorted by `pct` descending. **The array index is the identity** used by locks and exclusions.

## Result (`analysisResult[i]`)

Cluster fields plus:

```js
{ ...cluster,
  montana: PaintColor,   // matched (or locked) paint — "montana" is a legacy name, any brand
  delta: 7,              // CIE76 ΔE, rounded integer
  matchPct: 86,          // max(0, round(100 − 2·ΔE))
  lineName: "MTN 94",    // display name of the line the paint came from
  lineKey: "MTN94",      // PALETTES key
  isFallback: false,     // true if matched from a fallback line (never true when locked)
  isLocked: false,
  isExcluded: false }
```

`analysisResult[i]` always corresponds to `rawClusters[i]`.

## Palette keys

`BLACK, GOLD, MTN94, HARDCORE, WATERBASED, NITRO2G, VICE, MOLOTOW, LOOP` — used in `PALETTES`, `LINE_NAMES`, the `<select id="paint-line">` option values, `activeFallbackKeys`, and saved sessions. Treat them as a stable, persisted enum.

## Session file (`montana_session_<name>.json`)

Written by `doSaveSession()`, read by `loadSessionFromJSON()` and (for comparison) `loadCompareFromJSON()`.

```jsonc
{
  "_version": 1,
  "_type": "montana-session",        // required; loaders reject anything else
  "name": "Montana BLACK — 26 Feb 2026",
  "savedAt": "2026-02-26T17:00:00.000Z",
  "paintLine": "BLACK",              // palette key
  "colorCount": "12",                // slider values are saved as strings
  "minPct": "1",
  "matchQuality": "70",
  "blockSize": "12",
  "fallbackKeys": ["MOLOTOW"],
  "rawClusters": [ /* Cluster[] */ ],
  "excludedIndices": [3],
  "lockedOverrides": [ { "idx": 2, "color": { "code": "...", "name": "...", "hex": "#..." } } ],
  "analysisResult": [ /* Result[] */ ]
}
```

Not saved, although `README.md` says otherwise: wall calculator dimensions / coverage, render mode. The source image is never saved, so a loaded session has no render preview.

Restoring only rehydrates UI state; it does **not** call `rematch()`, so `analysisResult` is shown exactly as saved.

Compatibility rule: anything that changes these field names, the `_type` string, or the palette keys must keep loading older files (bump `_version` and migrate in `loadSessionFromJSON`).

## Compare snapshot (in memory only)

```js
compareSnapshot = {
  label: "Montana BLACK · 11 colors",
  paintLine: "BLACK",
  savedAt: "18:42",                 // display string
  results: [ { hex, code, name, imgHex, pct /* number */, delta } ]   // non-excluded only
}
```

Built by `saveForCompare()` from the live analysis or by `loadCompareFromJSON()` from a session file. The diff joins on `code`.

## Render block (`lastBlocks[i]`)

```js
{ bx, by, bw, bh, hex }   // source-pixel coordinates, snapped paint hex
```
