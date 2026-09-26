# Paint catalogues

All catalogue data is hard-coded near the top of the `<script>` in `color-analyzer.html`, one `const` array per line, each preceded by a `// ─── <Line name> … ───` banner.

## Format

```js
const MONTANA_BLACK = [
  // optional grouping comments
  {code:"BLK 1010", name:"Easter Yellow", hex:"#FFED52"},
  ...
];
```

## Current lines and data quality

Measured from the file (Sept 2026):

| Key | Const | Entries | Empty `code` | Duplicate codes | Duplicate hex |
|---|---|---|---|---|---|
| `BLACK` | `MONTANA_BLACK` | 188 | 0 | 1 | 3 |
| `GOLD` | `MONTANA_GOLD` | 199 | 0 | 0 | 1 |
| `MTN94` | `MTN_94` | 217 | 20 | — | 3 |
| `HARDCORE` | `MTN_HARDCORE` | 141 | 7 | — | 4 |
| `WATERBASED` | `MTN_WATERBASED` | 91 | **91** | — | 2 |
| `NITRO2G` | `MTN_NITRO2G` | 10 | 1 | 0 | 0 |
| `VICE` | `MTN_VICE` | 50 | **50** | — | 0 |
| `MOLOTOW` | `MOLOTOW_PREMIUM` | 231 | 0 | 0 | 0 |
| `LOOP` | `LOOP_COLORS` | 209 | 0 | 0 | 4 |
| | **Total** | **1,336** | 169 | | |

Several features use `code` as a unique key: the lock picker's de-duplication, the diff panel join, and stencil file names. Empty codes break all three (see `KNOWN_ISSUES.md`). Fix either the data or those features (for example key on `lineKey + code || name`) before relying on `code` elsewhere.

The source of the hex values is not documented in the repo. They are screen approximations of physical paint and should be treated as such.

To re-measure, run the palette validation snippet in `DEVELOPMENT.md`.

## Adding a new paint line

Touch **all** of these:

1. Add the `const NEW_LINE = [ … ];` array with a `// ─── Brand Line ─ N colors ───` banner, alongside the other palettes.
2. Add it to `PALETTES` with a new short uppercase key.
3. Add the display name to `LINE_NAMES` under the same key.
4. Add `<option value="KEY">Display Name (N)</option>` to `<select id="paint-line">` in the markup. The count is hard-coded in the label.
5. Update the tables in `README.md` ("Supported Paint Lines") and in this file.

Fallback chips and the lock picker read `LINE_NAMES`/`PALETTES` automatically.

Rules:
- Give every entry a non-empty, unique `code`. If the brand has none, synthesise a stable one (e.g. `WB-001`).
- Use `#RRGGBB` hex. Don't use shorthand or `rgb()`, because `hexToRgb` only handles 6-digit hex.
- Never rename or remove an existing key. Saved sessions reference it.
