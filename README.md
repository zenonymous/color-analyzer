# Color Analyzer · Spray Can Calculator

A single-file browser tool for mapping any image to a real spray paint catalogue. Drop in a photo or piece of artwork, and the tool clusters the colors using k-means, finds the closest can in your chosen paint line, and gives you a full plan: render preview, shopping list, stencil files, layer order, and wall coverage estimates.

No install. No server. No account. Open the `.html` file in any modern browser and go.

---

## Supported Paint Lines

Nine catalogues are built in:

| Brand | Line | Colors |
|---|---|---|
| Montana Cans | Montana BLACK | 188 |
| Montana Cans | Montana GOLD | 199 |
| MTN Colors | MTN 94 | 217 |
| MTN Colors | MTN Hardcore | 141 |
| MTN Colors | MTN Water Based | 91 |
| MTN Colors | MTN Nitro 2G | 10 |
| MTN Colors | MTN Vice | 50 |
| Molotow | Molotow Premium | 231 |
| Loop Colors | Loop Colors | 209 |

Colors are matched using **CIE76 ΔE** — perceptual color distance in Lab space — so matches are based on how human eyes perceive color difference, not raw RGB math.

---

## Getting Started

1. Open `color-analyzer.html` in any modern browser (Chrome, Firefox, Safari, Edge)
2. Drop an image onto the upload zone or click **CHOOSE FILE**
3. The tool runs color clustering and palette matching automatically
4. Adjust any slider and results update in real time

To restore previous work, click **LOAD SAVED SESSION** on the upload screen and open a `.json` session file.

---

## Analysis Controls

These four controls sit in the bar below the header and determine how the analysis runs.

**Paint Line** — the primary catalogue to match against. All nine lines are available. Switching lines immediately remaps all clusters without re-running k-means. Locks and exclusions survive line changes.

**Color Depth** (4–128) — the number of k-means clusters to find. Higher values capture subtle color variation; lower values give a simpler, more graphic result. Requires clicking **ANALYZE** to re-run clustering.

**Min Coverage** (0–5%) — filters out any color that appears in less than this percentage of the image. Useful for eliminating noise or irrelevant background tones. Requires **ANALYZE** to take effect.

**Match Quality** (50–100%) — sets the ΔE threshold for fallback matching. When the best match in the primary line falls below this quality level, the tool searches any active fallback lines for a closer match. Updates instantly without re-clustering.

### Fallback Lines

The **Fallback Lines** bar sits directly below the controls. Toggle any additional paint line to include it as a fallback. When a cluster's best primary match falls below the Match Quality threshold, the tool searches all active fallback lines and uses whichever gives the lowest ΔE. Colors sourced from a fallback line are flagged on their card with the line name in amber.

---

## Render Preview

After analysis, the right panel shows the image remapped to the matched palette. Four render modes are available via the toolbar buttons above the render:

**PIXEL** — flat hard-edged mosaic. Each block in the image is filled with a solid color from the matched palette. The Block Size slider controls how large each block is.

**VECTOR** — same layout as pixel mode but rendered as SVG instead of canvas. Fully scalable — suitable for exporting to plotters or large-format print.

**SPRAY** — simulated aerosol render. Each block is painted with multiple overlapping radial gradient blobs with randomised jitter, radius variation, opacity variation, and slight hue drift. Blobs are composited dark-to-light to mimic real spray layering technique. The Block Size slider controls the spray blob radius.

**COMPARE** — split-screen reveal. A slider appears and lets you drag a vertical divider across the panel: left of the line shows the original image, right shows the render. Useful for checking how faithfully colors are being matched and how much the abstraction changes the image.

### Zoom and Pan

The zoom toolbar (−, %, +, **FIT**) lets you inspect detail at any scale. Steps run from 25% to 800%.

- **Mouse:** Ctrl/Cmd + scroll wheel to zoom, click and drag to pan
- **Trackpad:** pinch to zoom, two-finger drag to pan
- **Touch:** pinch two fingers to zoom, one finger to pan

**FIT** snaps the render back to fill the viewport.

---

## Color Cards

Every matched cluster gets a card in the results grid. Each card shows:

- **Swatch pair** — the original sampled image color (top) and the matched paint color (bottom), side by side
- **Paint name and code** — e.g. *Easter Yellow · BLK 1010*
- **Hex values** — tap/click either chip to copy to clipboard
- **ΔE badge** — the perceptual color distance with a quality rating: ✓ CLOSE (ΔE < 10), ~ FAIR (ΔE 10–20), ✗ ROUGH (ΔE > 20)
- **Coverage bar** — the percentage of the image this cluster represents
- **Can estimate** — approximate number of 400 ml cans for typical mural coverage
- **Fallback tag** — if the match came from a fallback line, shown in amber with the line name

### Exclude Color

Click **✕ EXCLUDE** on any card to remove that color from the render, the layer order, the wall calculator, and any stencil exports. The card is visually dimmed with a strikethrough name. Click **↩ RESTORE** to bring it back.

Useful for surfaces where you want to represent bare concrete, primer, or an existing background color without spraying it.

### Lock Color

Click **🔒 LOCK COLOR** to override the algorithm's choice for that cluster and pin it to any specific color in any catalogue.

A full-palette picker opens showing all colors across all nine lines. Type in the search box to filter by color name or code. Click any swatch to apply the lock. The render, layer order, and exports all update immediately.

Locks survive paint line changes, match quality changes, and fallback changes. They are only cleared when you click **ANALYZE** to re-run the full analysis. Click **🔓 UNLOCK** to release a lock.

---

## Wall Size Calculator

A collapsible panel in the results section. Enter the wall width and height in metres and an optional coverage rate (default 1.5 m² per 400 ml can). The calculator outputs:

- Total wall area
- Total estimated can count
- Per-color breakdown showing how many cans of each paint you need based on its coverage percentage

Adjust the Coverage/Can value to match your technique — thin coats on smooth concrete may reach 2 m², heavy opaque fill on rough brick closer to 0.8 m².

---

## Layer Order / Spray Sequence

A collapsible panel showing the recommended spray order for your palette. Colors are sorted by Lab lightness (L value) from lightest to darkest, with higher-coverage colors prioritised within each band. This matches standard spray mural technique: establish broad light areas first, build through mid-tones, finish with dark shadows and fine details.

Each step shows: step number, color swatch, paint name, code, coverage percentage, L value, and a role badge.

| Badge | Meaning |
|---|---|
| Background | Lightest and/or widest color — spray first |
| Light layer | Pale colors that establish the base tone |
| Mid layer | Mid-tone fill colors |
| Dark layer | Shadows and deep tones |
| Detail | Low-coverage accent colors — spray last |

---

## Analysis Comparison / Diff

Useful for comparing two analyses — different images, different settings, or different paint lines — and seeing exactly what changed.

### Saving a snapshot

After running an analysis, click **SAVE FOR COMPARE** in the header. This snapshots the current active palette in memory. Run a new analysis (change settings, upload a different image, switch paint lines) and a **Analysis Comparison** panel automatically appears at the bottom of the results.

### Loading a snapshot from file

Click **COMPARE FROM FILE** in the export bar to load any previously saved `.json` session file as the comparison target. Useful for comparing work across sessions, or sharing a reference palette with a collaborator.

### Reading the diff

The comparison panel shows a table of every color from both analyses, sorted by status:

| Row color | Meaning |
|---|---|
| 🟢 Green | Color is new in the current analysis |
| 🟡 Amber | Color exists in both but coverage changed by > 0.4% |
| Normal | Color is present in both with similar coverage |
| 🔴 Red / dimmed | Color was in the snapshot but is not in the current analysis |

Columns show the snapshot percentage, current percentage, and the Δ coverage change. Click the panel header to collapse it, or the **CLEAR ✕** button to dismiss it.

---

## Save Session / Load Session

Sessions let you save the full state of your work to a `.json` file and reload it later — without re-uploading the image or re-running the analysis.

### What gets saved

- All color matches and their ΔE scores
- Raw k-means cluster data
- Which colors are excluded
- Which colors are locked and to which specific paint
- Paint line, active fallback lines, and all slider values
- Wall calculator dimensions and coverage rate
- Block size and render mode

### Saving

Click **SAVE SESSION** in the header. A modal opens where you can give the session a name (pre-filled with the paint line and current date). Click **DOWNLOAD .JSON** to save the file.

On mobile, tap the **☰** menu button in the top-right corner to access Save Session.

### Loading

Click **LOAD SAVED SESSION** on the upload screen to open a session file and restore your work. All color cards, the layer order, wall calculator, locks, and exclusions restore instantly. To get the render preview back, re-upload the original image and click **ANALYZE** — all your locks and exclusions will still be in place.

---

## Export Options

All export buttons are in the **Export & Share** bar at the bottom of the results section.

### CSV

**EXPORT CSV** downloads a spreadsheet with one row per color:

`Montana Code · Montana Name · Montana Hex · Image Hex · Coverage % · ΔE · Match % · Source Line · Est. Cans`

Also available from the header bar (desktop).

### Palette PDF

**PALETTE PDF** opens a print-formatted page in a new browser tab and triggers the print dialog automatically. The page contains:

- A branded header with paint line name, date, total color count, and total can estimate
- A summary row with at-a-glance stats
- A grid of color cards — each showing both swatches, paint name and code, hex values, a coverage bar, ΔE badge, and can estimate

Save as PDF from your browser's print dialog, or send to a physical printer. Uses only web-safe fonts and no external dependencies.

> **Note:** Allow pop-ups for this page if your browser blocks them.

### SVG Stencils

**EXPORT STENCILS** generates one SVG mask file per active (non-excluded) color. Each file is a black-on-white mask: black rectangles mark exactly where that color appears in the render at the current block size, white is the masked-off area.

Files download sequentially at 300 ms intervals to avoid browser blocking. They are named `stencil_01_BLK_1025.svg`, `stencil_02_BLK_9001.svg` etc. in layer order.

The SVGs are ready to import directly into:
- Vinyl cutter software (Cricut Design Space, Roland CutStudio, Silhouette Studio)
- Laser cutter software (LightBurn, RDWorks)
- Print-and-cut workflows
- Illustrator or Inkscape for further editing

---

## Mobile Use

The tool is fully functional on phones and tablets.

On screens narrower than 540 px:
- The header actions collapse into a **☰ menu** (top-right). Tap it to access Save Session, Export CSV, Save for Compare, Load Session, and New Image
- The controls bar stacks into a vertical list with full-width sliders
- The render mode buttons (PIXEL / VECTOR / SPRAY / COMPARE) span the full panel width
- Color cards display in a single column
- The Save Session modal and lock color picker slide up as bottom sheets
- Touch pan (one finger) and pinch-to-zoom (two fingers) work on the render viewport
- All interactive elements are at least 44 px tall for comfortable tapping

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Zoom in on render | Ctrl / Cmd + scroll up |
| Zoom out on render | Ctrl / Cmd + scroll down |
| Fit render to viewport | Click **FIT** button |
| Copy hex value | Click the hex chip on any card |
| Close lock color picker | Esc |
| Confirm session name | Enter |
| Close session modal | Esc or click outside |
| Close mobile menu | Tap outside the drawer |

---

## Browser Compatibility

Works in all modern browsers. Requires Canvas 2D and File API support.

| Browser | Status |
|---|---|
| Chrome / Edge 88+ | ✓ Full support |
| Firefox 85+ | ✓ Full support |
| Safari 14+ | ✓ Full support |
| iOS Safari 14+ | ✓ Full support |
| Chrome for Android | ✓ Full support |

The Palette PDF export requires pop-ups to be allowed for the page. The SVG Stencil export triggers multiple sequential downloads — some browsers may show a one-time permission prompt.

---

## File Structure

The entire tool ships as a single `.html` file with no external dependencies except the Google Fonts import for Bebas Neue and Space Mono. It can be opened directly from a local filesystem, hosted on any static server, or shared as an email attachment.

Session files (`.json`) are plain text and can be opened and inspected in any text editor.
