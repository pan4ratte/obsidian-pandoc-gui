/*
 * An embedded note written into the document, and the two things that stopped one whose name is not ASCII.
 *
 * Both were Windows taking a byte string as the machine's own code page rather than as the text it is: the map arrived
 * in the environment with a `?` where every Cyrillic letter had been, and the path in it could not be opened by lua
 * even when it survived. Neither shows on a Linux runner, so what is checked here is what makes them impossible — the
 * map the plugin builds is ASCII, and the filter reads a note back out of it.
 */

import { exec as execCallback, execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { promisify } from 'util';
import { escapeForEnv } from '../../src/convert/export';

const run = promisify(execCallback);

const here = import.meta.dirname;
const markdowns = join(here, '..', 'markdowns');
const filter = resolve(here, '..', '..', 'lua-filters', 'bundled', 'embeds.lua');

/** The note the host embeds, named as a Russian vault names one. */
const LINK = 'Вложенная заметка';
const embedded = resolve(markdowns, `${LINK}.md`);

const pandocInstalled = (() => {
  try {
    execSync('pandoc --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('the map the plugin puts in the environment', () => {
  test('carries nothing but ASCII, whatever the note is called', () => {
    const line = `${escapeForEnv(LINK)}\t${escapeForEnv(embedded)}`;
    // The tab is the map's own; everything a field holds is printable ASCII.
    expect(/^[\x20-\x7e]*\t[\x20-\x7e]*$/.test(line)).toBe(true);
  });

  test('and escapes the percent sign too, so a link carrying one still reads back whole', () => {
    expect(escapeForEnv('100% сложно')).toBe('100%25 %D1%81%D0%BB%D0%BE%D0%B6%D0%BD%D0%BE');
  });

  test('and a tab or a newline in a link can no longer break the line it is written on', () => {
    expect(escapeForEnv('a\tb\nc')).toBe('a%09b%0Ac');
  });
});

/** The map as the plugin writes it: one embed to a line, the link against the file it means. */
const mapOf = (links: Record<string, string>): string =>
  Object.entries(links)
    .map(([link, file]) => `${escapeForEnv(link)}\t${escapeForEnv(file)}`)
    .join('\n');

const convertWith = async (host: string, map: string, meta = ''): Promise<string> => {
  const { stdout } = await run(`pandoc -s -L "${filter}" ${meta} -t native -f markdown+wikilinks_title_after_pipe "${host}" -o -`, {
    env: { ...process.env, OBSIDIAN_EMBEDS: map },
  });
  return stdout;
};

describe.skipIf(!pandocInstalled)('the filter, given that map', () => {
  const convert = (): Promise<string> => convertWith(join(markdowns, 'embeds-host.md'), mapOf({ [LINK]: embedded }));

  // Read as the native AST, where a word is a `Str` of its own — so the words are what is looked for, not the sentence.
  test('writes the note in, rather than leaving the image pandoc read', async () => {
    expect(existsSync(embedded)).toBe(true);
    const native = await convert();
    expect({
      embedded: native.includes('"speaks."') && native.includes('Strong'),
      // What a broken embed leaves behind: the link as an image, with its own text as the caption.
      image: native.includes('Image'),
      around: native.includes('"before"') && native.includes('"after"'),
    }).toEqual({ embedded: true, image: false, around: true });
  }, 60_000);
});

/*
 * Heading levels: the one thing an embed cannot get right on its own, since a chapter written as `# Title` lands in
 * the document as another `#` however deep it stands. Asked for, the note is fitted under the heading above it.
 */
describe.skipIf(!pandocInstalled)('heading levels', () => {
  const host = join(markdowns, 'embeds-headings-host.md');
  const map = mapOf({
    'embeds-chapter': join(markdowns, 'embeds-chapter.md'),
    'embeds-nested': join(markdowns, 'embeds-nested.md'),
  });

  /** Every heading the document ends up with, in the order it is written, as its level. The whitespace is loose
      because the native writer breaks a long node over lines, leaving the level on one of its own. */
  const levels = (native: string): number[] => [...native.matchAll(/Header\s+(\d)/g)].map(match => Number(match[1]));

  test('are left exactly as the note wrote them unless the template asks', async () => {
    expect(levels(await convertWith(host, map))).toEqual([1, 2, 1, 1, 2, 1, 2, 2, 2, 1, 1, 1, 2]);
  }, 60_000);

  test('are fitted under the heading the embed stands under when it does', async () => {
    expect(levels(await convertWith(host, map, '-M embed-shift-headings=true'))).toEqual([
      // Nothing above the leading embed to be a child of, so it is left as it stands.
      1, 2,
      // "# Part one", and two embeds under it: siblings, not a staircase.
      1, 2, 3, 2, 3,
      // "## Details", and a section embed, which moves by its own top heading.
      2, 3,
      // "# Part two", and a note that embeds another: both move, keeping their distance.
      1, 2, 3, 4,
    ]);
  }, 60_000);
});

/*
 * `rebase_relative_paths`, which writes the note's own folder in front of every path pandoc takes for a relative one.
 *
 * Pandoc takes two kinds of thing for one that are not: an embed, which this filter has to find again by what the
 * note wrote, and a link whose scheme pandoc has never heard of — `zotero:`, `obsidian:` — which is a link to an app
 * and belongs to no folder at all. Both are put back; a path that really is a file's is left rebased.
 */
describe.skipIf(!pandocInstalled)('paths rebased onto the note’s folder', () => {
  const host = join(markdowns, 'embeds-rebased-host.md');
  const map = mapOf({ 'embeds-chapter.md': join(markdowns, 'embeds-chapter.md') });

  const rebased = async (extensions: string): Promise<string> => {
    const { stdout } = await run(`pandoc -s -L "${filter}" -t native -f markdown${extensions} "${host}" -o -`, {
      env: { ...process.env, OBSIDIAN_EMBEDS: map },
    });
    return stdout;
  };

  test('leave the embed still written in, rather than the image pandoc read', async () => {
    const native = await rebased('+rebase_relative_paths');
    expect({
      embedded: native.includes('"Chapter"') && native.includes('"Section"'),
      image: native.includes('embeds-chapter.md'),
    }).toEqual({ embedded: true, image: false });
  }, 60_000);

  test('leave a link to an app as the note wrote it', async () => {
    const native = await rebased('+rebase_relative_paths');
    for (const target of [
      'zotero://select/library/items/ABCD1234',
      'zotero://open-pdf/library/items/XYZ?page=3&annotation=Q1',
      'obsidian://open?vault=V&file=note',
      'https://example.com/a',
    ]) {
      expect(native).toContain(`"${target}"`);
    }
  }, 60_000);

  // The folder keeps whatever separators the path pandoc was handed was written with, and the name is joined onto it
  // with a `/` either way — so what is checked is the joining, not the spelling of the folder above it.
  test('but still rebase a path that really is a file’s', async () => {
    const native = await rebased('+rebase_relative_paths');
    expect({
      rebased: native.includes('markdowns/picture.png'),
      bare: native.includes('"picture.png"'),
    }).toEqual({ rebased: true, bare: false });
  }, 60_000);

  test('and leave every one of them alone where the extension is off', async () => {
    const native = await rebased('');
    expect({
      embedded: native.includes('"Chapter"'),
      zotero: native.includes('"zotero://select/library/items/ABCD1234"'),
      picture: native.includes('"picture.png"'),
    }).toEqual({ embedded: true, zotero: true, picture: true });
  }, 60_000);
});
