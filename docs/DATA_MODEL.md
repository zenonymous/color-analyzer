# Data model

## Paint (catalogue entry)

Source form in `palette-data`:
```js
{ code: "BLK 1010", name: "Easter Yellow", hex: "#FFED52" }
```
After startup normalisation (app block):
```js
{ code, name, hex /* uppercased */, line: "BLACK" /* palette key */ }
// + non-enumerable: id = "BLACK|BLK 1010" (line|code, or line|name when code is ""), lab = [L, a, b]
```
Only the enumerable fields end up in JSON. `resolvePaint()` turns a JSON paint back into the catalogue object.

## Cluster (`rawClusters[i]`)

```js
{ rgb: [r, g, b],        // mean RGB of member pixels (integers)
  hex: "#RRGGBB",        // uppercase, from rgb
  lab: [L, a, b],        // Lab centroid (2 decimals); v1 sessions lack it → derived from rgb
  pct: "12.3" }          // STRING, % of sampled opaque pixels after min-coverage filter + renormalise
```
Sorted by coverage. **The array index is the identity** used by locks and exclusions.

## Result (`analysisResult[i]`)

```js
{ ...cluster,
  index: i,
  montana: Paint,       // matched or locked paint ("montana" = legacy name, any brand)
  delta: 3.4,           // CIEDE2000, 1 decimal
  matchPct: 86,         // max(0, round(100 − 4·ΔE))
  lineName: "MTN 94",   // display name of the paint's line
  lineKey: "MTN94",
  isFallback: false,    // matched from a fallback line (false when locked)
  isLocked: false,
  isExcluded: false }
```

## Paint aggregate (`activePaints()[i]`, from `CA.aggregateByPaint`)

```js
{ id, paint, lineName, pct /* number, summed */, bestDelta, imageHexes: [], indices: [clusterIdx…], isFallback, isLocked }
```
Excluded clusters are not included. This is the unit for shopping lists, cans, layer order, stencils and the diff.

## Palette keys

`BLACK, GOLD, MTN94, HARDCORE, WATERBASED, NITRO2G, VICE, MOLOTOW, LOOP`. Used in `PALETTES`, `LINE_NAMES`, `<select id="paint-line">`, fallback state, paint ids and sessions. Persisted: never rename.

## Session file

Written by `doSaveSession()` as `color-analyzer_session_<name>.json`. Read by `loadSessionFromJSON()` (via `sanitizeSession()`) and `loadCompareFromJSON()`.

### v2 (current)

```jsonc
{
  "_version": 2,
  "_type": "montana-session",          // required, never change
  "name": "Montana BLACK — 26 Sept 2026",
  "savedAt": "2026-09-26T12:00:00.000Z",
  "paintLine": "BLACK",
  "colorCount": "12", "minPct": "1", "matchQuality": "70", "blockSize": "12",   // strings (input values)
  "renderMode": "pixel",               // pixel | vector | spray | compare
  "wall": { "width": "5", "height": "3", "coverage": "1.5" },
  "fallbackKeys": ["MOLOTOW"],
  "rawClusters": [ /* Cluster[] */ ],
  "excludedIndices": [3],
  "lockedOverrides": [ { "idx": 2, "color": { "code": "...", "name": "...", "hex": "#...", "line": "LOOP" } } ],
  "analysisResult": [ /* Result[]: kept for "compare from file" and older tools; recomputed on load */ ],
  "image": {                           // or null when "Include image" is unticked
    "dataUrl": "data:image/jpeg;base64,…",   // PNG when the image has transparency
    "width": 1600, "height": 1200,           // analysed (downscaled) size
    "origWidth": 4000, "origHeight": 3000
  }
}
```

### v1 (legacy, still loadable)

The same fields without `renderMode`, `wall`, `image` and cluster `lab`. `delta` values in v1 files are CIE76 integers. They are ignored because `rematch()` recomputes everything with CIEDE2000 on load. Lock colours have no `line` and are resolved by hex + name.

### Loading rules (`sanitizeSession`)

- Rejects files without `_type: 'montana-session'` or with no usable `rawClusters`.
- Clamps all numbers to their slider ranges and recomputes cluster `hex` from `rgb`.
- Drops lock and exclusion indices that are out of range, and locks whose paint can't be resolved or has an invalid hex.
- Accepts only `data:image/(png|jpeg|webp);base64,` images.
- Everything displayed from the file is escaped. Treat session files as untrusted input.

Compatibility rule: any change to the format must keep v1 and v2 files loading. Bump `_version` and handle the difference in `sanitizeSession()`.

## Compare snapshot (in memory)

```js
compareSnapshot = { label, paintLine, savedAt, results: [ { id, hex, code, name, pct /* number */, delta } ] }
```
One row per paint (aggregated). Built by `saveForCompare()` or `loadCompareFromJSON()`, joined on `id`.

## Render block (`lastBlocks[i]`)

```js
{ bx, by, bw, bh, key /* paint id */, hex }   // analysis-canvas pixel coordinates
```
