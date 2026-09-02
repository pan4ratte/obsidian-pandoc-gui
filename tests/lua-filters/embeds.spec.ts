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

describe.skipIf(!pandocInstalled)('the filter, given that map', () => {
  const convert = async (): Promise<string> => {
    const host = join(markdowns, 'embeds-host.md');
    const { stdout } = await run(`pandoc -s -L "${filter}" -t native -f markdown+wikilinks_title_after_pipe "${host}" -o -`, {
      env: { ...process.env, OBSIDIAN_EMBEDS: `${escapeForEnv(LINK)}\t${escapeForEnv(embedded)}\n` },
    });
    return stdout;
  };

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
