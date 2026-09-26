# Color Analyzer · Spray Can Calculator

A single-file browser tool for mapping any image to a real spray paint catalogue. Drop in a photo or piece of artwork. The tool groups the image's colours with k-means clustering, finds the closest can in your chosen paint line, and gives you a full plan: render preview, shopping list, stencil files, layer order, and wall coverage estimates.

No install. No server. No account. Open the `.html` file in any modern browser and go.

---

## Supported Paint Lines

Nine catalogues are built in (1,335 colours in total):

| Brand | Line | Colors |
|---|---|---|
| Montana Cans | Montana BLACK | 187 |
| Montana Cans | Montana GOLD | 199 |
| MTN Colors | MTN 94 | 217 |
| MTN Colors | MTN Hardcore | 141 |
| MTN Colors | MTN Water Based | 91 |
| MTN Colors | MTN Nitro 2G | 10 |
| MTN Colors | MTN Vice | 50 |
| Molotow | Molotow Premium | 231 |
| Loop Colors | Loop Colors | 209 |

Colours are matched with **CIEDE2000 ΔE**, the industry-standard measure of how different two colours look to the human eye. It is more accurate than plain RGB distance and older ΔE formulas, especially for blues, greys and saturated colours. The image is also clustered in the perceptual Lab colour space, so the colours it picks out are the ones you actually see.

Screen colours are approximations of physical paint. Always check against a real colour chart before buying a large order.

---

## Getting Started

1. Open `color-analyzer.html` in any modern browser (Chrome, Firefox, Safari, Edge), or use the hosted GitHub Pages version.
2. Drop an image onto the upload zone or click **CHOOSE FILE**.
3. The tool runs colour clustering and palette matching automatically.
4. Adjust any slider and the results update.

To restore previous work, click **LOAD SAVED SESSION** on the upload screen (or drop a session `.json` onto the upload zone).

Large photos are scaled down so their longest side is 1600 px before analysis. This keeps things fast, and the size shown in the source panel tells you when it happened. The same image with the same settings always produces the same result.

---

## Analysis Controls

These four controls sit in the bar below the header and determine how the analysis runs.

**Paint Line**: the primary catalogue to match against. Switching lines immediately remaps all colours without re-clustering. Locks and exclusions survive line changes.

**Color Depth** (4–128): the number of colours (k-means clusters) to find. Higher values capture subtle variation; lower values give a simpler, more graphic result. Requires clicking **ANALYZE**. If the image has fewer distinct colours than this (a logo or flat artwork, for example), you get one card per colour and a notice.

**Min Coverage** (0–5%): drops any colour that covers less than this percentage of the image. Useful for removing noise. Requires **ANALYZE**.

**Match Quality** (50–100%): when the best match in the primary line scores below this, the tool also searches the active fallback lines. Match % is `100 − 4 × ΔE`, so the default 70% means "look further if ΔE is above 7.5". Updates instantly.

### Fallback Lines

The **Fallback Lines** bar sits directly below the controls. Toggle any other paint line to use it as a fallback. When a colour's best primary match is below the Match Quality threshold, the tool searches all active fallback lines and uses whichever match is closest. Colours sourced from a fallback line are flagged on their card with the line name in amber.

---

## Render Preview

After analysis, the right panel shows the image repainted with the matched paints. Four render modes are available:

**PIXEL**: flat, hard-edged mosaic. The Block Size slider controls how large each block is (in pixels of the analysed image).

**VECTOR**: the same layout rendered as SVG. Neighbouring blocks of the same paint are merged into larger rectangles, which keeps it light and scalable.

**SPRAY**: simulated aerosol render. Each block is painted with overlapping soft blobs, composited dark to light to mimic real spray layering. The look stays stable while you tweak other settings.

**COMPARE**: split-screen reveal. Drag the slider to move the divider between the render and the original image.

### Zoom and Pan

The zoom toolbar (−, %, +, **FIT**) runs from 25% to 800%. Your zoom level is kept when you change block size, exclude colours or switch modes.

- **Mouse:** Ctrl/Cmd + scroll wheel to zoom, click and drag to pan
- **Trackpad:** pinch to zoom, two-finger drag to pan
- **Touch:** pinch two fingers to zoom, one finger to pan

---

## Color Cards

Every colour found in the image gets a numbered card. Each card shows:

- **Swatch pair**: the sampled image colour (top) and the matched paint (bottom)
- **Paint name and code**: e.g. *Easter Yellow · BLK 1010*. Lines without product codes (MTN Water Based, MTN Vice, some MTN 94/Hardcore colours) show the line name instead
- **Hex values**: tap or click either chip to copy
- **ΔE badge**: CIEDE2000 distance and match %: ✓ CLOSE (ΔE < 5), ~ FAIR (ΔE 5–10), ✗ ROUGH (ΔE ≥ 10)
- **Coverage bar**: the share of the image this colour covers
- **Wall estimate**: the area it covers on your wall, and how many cans of that paint you need (see Wall Size Calculator)
- **Same can as #n**: shown when several image colours map to the same paint. They share one shopping-list line
- **Fallback tag**: shown in amber with the line name when the match came from a fallback line

### Exclude Color

Click **✕ EXCLUDE** to remove a colour from the render, layer order, wall calculator, shopping list, palette PDF and stencils. The card is dimmed and shows how much wall is left unpainted. Useful for bare concrete, primer or an existing background. Click **↩ RESTORE** to bring it back.

### Lock Color

Click **🔒 LOCK COLOR** to override the automatic choice and pin a colour to any paint in any catalogue.

The picker shows all 1,335 paints, primary line first. Search by name, code, line name (e.g. "vice") or hex. Click a swatch to apply the lock. The card shows the line the locked paint comes from.

Locks survive paint line, match quality and fallback changes, and are saved in sessions. They are cleared when you click **ANALYZE** to re-run the analysis. Click **🔓 UNLOCK** to release a lock.

---

## Wall Size Calculator

Enter the wall width and height in metres and a coverage rate (default 1.5 m² per 400 ml can). The calculator shows the total area, the total can count and a per-paint breakdown.

**All can counts in the app come from this calculator**: the summary pill, the cards, the CSV and the palette PDF. Every paint you use counts as at least one can. Change the wall size and every estimate updates.

Adjust Coverage/Can to your technique: thin coats on smooth concrete may reach 2 m², heavy opaque fill on rough brick closer to 0.8 m².

---

## Layer Order / Spray Sequence

A collapsible panel showing the recommended spray order, one step per paint. Paints are sorted by lightness, lightest first. Paints with similar lightness are ordered by coverage, largest first. This matches standard mural technique: establish broad light areas first, build through mid-tones, and finish with dark shadows and details.

| Badge | Meaning |
|---|---|
| Background | First and lightest/widest paint |
| Light layer | Pale colours that establish the base tone |
| Mid layer | Mid-tone fill colours |
| Dark layer | Shadows and deep tones |
| Detail | Low-coverage dark accents, spray last |

---

## Analysis Comparison / Diff

Compare two analyses (different images, settings or paint lines) and see exactly which paints changed.

- **SAVE FOR COMPARE** (header) snapshots the current palette. Run another analysis and the **Analysis Comparison** panel appears.
- **COMPARE FROM FILE** (export bar) uses a saved session `.json` as the comparison target.

| Row | Meaning |
|---|---|
| 🟢 Green | Paint is new in the current analysis |
| 🟡 Amber | Paint in both, coverage changed by > 0.4% |
| Normal | Paint in both with similar coverage |
| 🔴 Red / dimmed | Paint was in the snapshot but not now |

---

## Save Session / Load Session

Save the full state of your work to a `.json` file and pick it up later, or share it with another artist.

### What gets saved

- The analysed colours, matches, exclusions and locks
- Paint line, fallback lines and all slider values
- Wall calculator dimensions and coverage rate
- Block size and render mode
- **The image itself** (optional, on by default), so the render comes back on load. Untick "Include image" for a much smaller file.

### Saving

Click **SAVE SESSION** in the header (on mobile: **☰ → SAVE SESSION**), name it, and click **DOWNLOAD .JSON**.

### Loading

Click **LOAD SAVED SESSION** on the upload screen, drop the file on the upload zone, or use **☰ → LOAD SESSION** on mobile. Everything is restored, including the render if the image was saved.

If the session has no image (including files saved by older versions of this tool), the render panel shows **ATTACH IMAGE**. Choose the original image and the render appears, with your locks and exclusions kept.

---

## Export Options

All export buttons are in the **Export & Share** bar at the bottom of the results.

### CSV shopping list

**EXPORT CSV** downloads one row per paint, in spray order, without excluded colours:

`Step · Line · Code · Name · Paint Hex · Image Hex · Coverage % · Wall Area m² · Cans (400ml) · Best ΔE2000 · Match % · Fallback · Locked`

plus a total row for the wall. Opens cleanly in Excel, Numbers and Google Sheets.

### Palette PDF

**PALETTE PDF** opens a print-formatted page in a new tab and starts the print dialog. It shows the paint line, date, paint count and can total for your wall, followed by one card per paint in spray order. Save as PDF from the print dialog or print it.

> **Note:** Allow pop-ups for this page if your browser blocks them.

### SVG Stencils

**EXPORT STENCILS** generates one SVG mask per paint, numbered in spray order (`stencil_01_BLK_1025.svg`, …). Black marks where that paint goes, white is masked off. Adjacent blocks are merged into larger shapes, so files are small and cut cleanly.

The SVGs import directly into vinyl cutter software (Cricut Design Space, Roland CutStudio, Silhouette Studio), laser cutter software (LightBurn, RDWorks), print-and-cut workflows, and Illustrator or Inkscape.

Files download 300 ms apart; some browsers ask once for permission to download multiple files.

---

## Mobile Use

The tool is fully functional on phones and tablets.

On narrow screens:
- Header actions move into the **☰ menu**: Save for Compare, Save Session, Load Session, Export CSV and New Image
- Controls stack vertically with full-width sliders
- Colour cards display in a single column
- The Save Session dialog and lock picker slide up as bottom sheets
- One-finger pan and two-finger pinch zoom work on the render
- Interactive elements are at least 44 px tall

---

## Keyboard Shortcuts

| Action | Shortcut |
|---|---|
| Zoom in / out on render | Ctrl / Cmd + scroll |
| Fit render to viewport | **FIT** button |
| Copy hex value | Click the hex chip on any card |
| Close lock picker or save dialog | Esc |
| Confirm session name | Enter |

---

## Browser Compatibility

Works in all modern browsers with Canvas 2D, File API and Web Workers.

| Browser | Status |
|---|---|
| Chrome / Edge 90+ | ✓ Full support |
| Firefox 90+ | ✓ Full support |
| Safari 15+ | ✓ Full support |
| iOS Safari 15+ | ✓ Full support |
| Chrome for Android | ✓ Full support |

Analysis runs in a background worker so the page stays responsive. If a browser blocks that (some do when opening the file straight from disk), it falls back to running on the page.

---

## File Structure

The whole tool is the single file `color-analyzer.html`, with no dependencies except the Google Fonts import for Bebas Neue and Space Mono. It can be opened from disk, hosted on any static server (such as GitHub Pages), or emailed.

Session files (`.json`) are plain text. Only load session files from people you trust. The tool treats their contents as data and never runs them as code.

---

## For Developers

See [`AGENTS.md`](AGENTS.md) for a codebase orientation, and the [`docs/`](docs/) folder for architecture, data formats, palette maintenance, development/QA, and known issues. Run the tests with `npm install && npm test`.
