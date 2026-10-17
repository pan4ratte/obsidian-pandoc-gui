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

  const exported = async (note: string, args = '-t commonmark_x-attributes'): Promise<string> => {
    copyFileSync(image, join(dir, 'pic.png'));
    writeFileSync(join(dir, 'note.md'), note);
    await run(
      `pandoc -f markdown+wikilinks_title_after_pipe --resource-path="${dir}" -L "${filter}" -s -o "${join(dir, 'out.md')}" ${args} "${join(dir, 'note.md')}"`
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

  // https://github.com/pan4ratte/obsidian-pandoc-gui/issues/11
  test('lists a heading holding a wikilink in the table of contents as the one link', async () => {
    const out = await exported(
      '# [[Story Bible/Character|Character]]\n\nSee [[Notes/a|A note]].\n\n## [[Notes/b|Two words]] here\n',
      '--toc -t commonmark_x-attributes+wikilinks_title_after_pipe'
    );
    expect(out).toBe(
      [
        '- [Character](#character)',
        '  - [Two words here](#two-words-here)',
        '',
        '# [[Story Bible/Character|Character]]',
        '',
        'See [[Notes/a|A note]].',
        '',
        '## [[Notes/b|Two words]] here',
        '',
      ].join('\n')
    );
  });
});
