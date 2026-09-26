// Loads the pure <script> blocks (core-lib + palette-data) out of the single
// HTML file into a sandbox, so the tests exercise exactly what ships.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const HTML_PATH = fileURLToPath(new URL('../color-analyzer.html', import.meta.url));

function scriptById(html, id) {
  const m = html.match(new RegExp(`<script id="${id}">([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`<script id="${id}"> not found`);
  return m[1];
}

export function loadCore() {
  const html = readFileSync(HTML_PATH, 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext(scriptById(html, 'core-lib') + scriptById(html, 'palette-data') +
    ';globalThis.__out = { CA, PALETTES, LINE_NAMES };', ctx);
  return ctx.__out;
}
