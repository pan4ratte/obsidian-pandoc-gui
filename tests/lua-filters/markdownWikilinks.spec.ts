/*
 * Wikilinks through the Markdown templates, which write without `attributes` or `implicit_figures`: a link carrying
 * the `wikilink` class, or a lone image read as a figure, was written as raw HTML with its spaces lost.
 */

import { exec as execCallback, execSync } from 'child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execCallback);

const filter = resolve(import.meta.dirname, '..', '..', 'lua-filters', 'bundled', 'markdown.lua');
const image = resolve(import.meta.dirname, '..', 'markdowns', 'drawing.png');

const pandocInstalled = (() => {
  try {
    execSync('pandoc --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!pandocInstalled)('markdown.lua, given wikilinks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pandoc-gui-markdown-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const exported = async (note: string): Promise<string> => {
    copyFileSync(image, join(dir, 'pic.png'));
    writeFileSync(join(dir, 'note.md'), note);
    await run(
      `pandoc -f markdown+wikilinks_title_after_pipe --resource-path="${dir}" -L "${filter}" -s -o "${join(dir, 'out.md')}" -t commonmark_x-attributes "${join(dir, 'note.md')}"`
    );
    return readFileSync(join(dir, 'out.md'), 'utf-8').replaceAll('\r\n', '\n');
  };

  test('writes links back as they were typed, and section links as anchors', async () => {
    expect(await exported('See [[Notes/a|A note]], [[Plain note]] and [[#Some heading|this one]].\n')).toBe(
      'See [[Notes/a|A note]], [[Plain note]] and [this one](#some-heading).\n'
    );
  });

  test('keeps a table a table', async () => {
    const out = await exported('| File | x |\n|---|---|\n| [[Notes/a\\|A note]] | ![[pic.png\\|50]] |\n');
    expect(out).toMatch(/\| \[\[Notes\/a\\\|A note\]\] \| !\[\]\(out-media\/\w+\.png\) \|/);
  });

  test('writes images as Markdown images and leaves note embeds as they were', async () => {
    const out = await exported('![[pic.png]]\n\n![[Other note]]\n\nInline ![[pic.png|A pic|200]] here.\n');
    expect(out).toMatch(/^!\[\]\(out-media\/\w+\.png\)\n\n!\[\[Other note\]\]\n\nInline !\[A pic\]\(out-media\/\w+\.png\) here\.\n$/);
  });
});
