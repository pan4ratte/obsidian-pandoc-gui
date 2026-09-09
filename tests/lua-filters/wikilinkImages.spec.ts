/*
 * Obsidian's `![[image.png|описание|500]]`, which pandoc's wikilink reader takes differently: everything after the
 * first `|` is the description to it, and an embed describing nothing is captioned with the target itself. Reported
 * as https://github.com/pan4ratte/obsidian-pandoc-gui/issues/5 — the width printed as part of the caption.
 *
 * Checked as HTML rather than the native AST: what matters is what reaches the document, and `width=` and
 * `<figcaption>` say it in one line each.
 */

import { exec as execCallback, execSync } from 'child_process';
import { join, resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execCallback);

const here = import.meta.dirname;
const filter = resolve(here, '..', '..', 'lua-filters', 'bundled', 'wikilink_images.lua');
const note = join(here, '..', 'markdowns', 'wikilink-images.md');

const pandocInstalled = (() => {
  try {
    execSync('pandoc --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!pandocInstalled)('the sizes and captions Obsidian writes', () => {
  /** The document as one line per element, since the html writer wraps a long tag over two. */
  const convert = async (): Promise<string[]> => {
    const { stdout } = await run(`pandoc -L "${filter}" -f markdown+wikilinks_title_after_pipe -t html "${note}" -o -`);
    return stdout
      .replace(/\s+/g, ' ')
      .split(/(?=<figure>|<p>)/)
      .map(line => line.trim())
      .filter(Boolean);
  };

  test('a described image keeps the description and is drawn at the width', async () => {
    const [described] = await convert();
    expect(described).toContain('width="600"');
    expect(described).toContain('alt="Robot stopping distances"');
    // The width was the end of the caption before the filter was written.
    expect(described).toContain('<figcaption aria-hidden="true">Robot stopping distances</figcaption>');
  }, 60_000);

  test('an image described by nothing is an image, not one captioned with its own file name', async () => {
    const [, bare] = await convert();
    expect(bare).toBe('<p><img src="picture.png" class="wikilink" /></p>');
  }, 60_000);

  test('a size on its own is a size, in both of the ways it is written', async () => {
    const [, , both, wide] = await convert();
    expect(both).toContain('width="500" height="300"');
    expect(wide).toContain('width="500"');
    // Neither is a figure any more: there is nothing left to caption it with.
    expect([both, wide].every(line => line.startsWith('<p>'))).toBe(true);
  }, 60_000);

  test('a caption that is not a size is left exactly as it was', async () => {
    const [, , , , caption] = await convert();
    expect(caption).toContain('<figcaption aria-hidden="true">Just a caption</figcaption>');
    expect(caption).not.toContain('width=');
  }, 60_000);

  test('a markdown link is not touched: a size written there is a description that reads as one', async () => {
    const [, , , , , markdown] = await convert();
    expect(markdown).toContain('alt="a markdown caption|500"');
    expect(markdown).not.toContain('width=');
  }, 60_000);

  test('an image standing in a line of text is sized too', async () => {
    const [, , , , , , inline] = await convert();
    expect(inline).toContain('width="200"');
    expect(inline).toContain('alt="inline"');
  }, 60_000);
});
