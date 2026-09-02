import { readFile } from 'fs/promises';
import type { Plugin } from 'vite';
// Spelled with its extension, as the text loader beside it is: vite's native config loader reads these files.
import { extname } from '../src/system/paths.ts';

/**
 * The resources that are not text go in as base64.
 *
 * A release ships `main.js`, `manifest.json` and `styles.css` and nothing else — see `.github/workflows/main.yml` — so
 * a file the plugin has to carry has to be inside the bundle. Base64 costs a third of its size again, which for the
 * three reference documents is the price of a phone having them at all.
 *
 * Read here rather than in `transform`: rollup hands `transform` what it read as UTF-8, and a zip put through that is
 * not a zip any more.
 */
export const binaryLoader = (config: { [extension: string]: 'binary' }): Plugin => ({
  name: 'binary-loader',
  enforce: 'pre',
  async load(id) {
    // Vite appends its own query to an id; the file is the part in front of it.
    const path = id.split('?')[0];
    if (config[extname(path)] === 'binary') {
      return { code: `export default ${JSON.stringify((await readFile(path)).toString('base64'))};`, map: null };
    }
  },
});

/** What the plugin carries that is not text: pandoc's reference documents, for the engine that cannot write them. */
export const BINARY_FILES: Record<string, 'binary'> = {
  '.docx': 'binary',
  '.odt': 'binary',
  '.pptx': 'binary',
};
