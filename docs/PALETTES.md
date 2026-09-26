# Paint catalogues

All catalogue data is in the `<script id="palette-data">` block of `color-analyzer.html`: one `const` array per line, each with a `// ─── <Line name> … ───` banner, followed by the `PALETTES` and `LINE_NAMES` registry at the end of the block.

The data was scraped from the manufacturers and verified by the owner. Don't change hex values or invent product codes without the owner's say-so.

## Format

```js
const MONTANA_BLACK = [
  // optional grouping comments
  {code:"BLK 1010", name:"Easter Yellow", hex:"#FFED52"},
  ...
];
```

At startup the app adds `line`, uppercases `hex`, and defines non-enumerable `id` (`line|code`, or `line|name` when `code` is empty) and `lab`. See `DATA_MODEL.md`.

## Current lines

| Key | Const | Entries | Entries without `code` |
|---|---|---|---|
| `BLACK` | `MONTANA_BLACK` | 187 | 0 |
| `GOLD` | `MONTANA_GOLD` | 199 | 0 |
| `MTN94` | `MTN_94` | 217 | 20 |
| `HARDCORE` | `MTN_HARDCORE` | 141 | 7 |
| `WATERBASED` | `MTN_WATERBASED` | 91 | 91 |
| `NITRO2G` | `MTN_NITRO2G` | 10 | 1 |
| `VICE` | `MTN_VICE` | 50 | 50 |
| `MOLOTOW` | `MOLOTOW_PREMIUM` | 231 | 0 |
| `LOOP` | `LOOP_COLORS` | 209 | 0 |
| | **Total** | **1,335** | 169 |

Empty codes are fine: paints are identified by `id`, and the UI shows the line name where a code would go. A handful of lines have two different paints with the same hex. That is expected (e.g. different finishes) and harmless.

The unit test `palette data integrity` enforces: valid 6-digit hex, a non-empty name, a string `code`, a unique `code || name` within each line, matching `PALETTES`/`LINE_NAMES` keys, and the total count. **Update the expected total in `tests/core.test.mjs` when you add or remove colours.**

## Adding a new paint line

1. Add `const NEW_LINE = [ … ];` with a banner inside `<script id="palette-data">`, before the registry.
2. Add it to `PALETTES` under a new short uppercase key.
3. Add the display name to `LINE_NAMES` under the same key.
4. Add `<option value="KEY">Display Name (N)</option>` to `<select id="paint-line">` in the markup. The count is hard-coded in the label.
5. Update the "Supported Paint Lines" table and total in `README.md`, the table above, the total in `AGENTS.md`, and the expected total in `tests/core.test.mjs`. The e2e test asserting 1,335 lock-picker swatches also needs the new total.
6. `npm test`.

Fallback chips, the lock picker and the normalisation pick the new line up automatically.

Rules:
- Use a real product code when the brand has one; otherwise `""` (the name becomes the identity, so keep names unique within the line).
- `#RRGGBB` hex only.
- Never rename or remove an existing key or change an existing paint's `code`/`name` casually. Both are part of the paint id stored in users' session files. If you must, `resolvePaint()` falls back to matching on hex + name, so change one at a time.
