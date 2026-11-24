/*
 * Pandoc 3.14 repeats a long table's caption on every page for a table with the `repeat-caption` class. A Markdown
 * table cannot carry one, so the filter gives it to every captioned table in LaTeX, and to nothing else. Read off the
 * tree rather than the LaTeX: an older pandoc writes the same LaTeX either way.
 */

import { exec as execCallback, execSync } from 'child_process';
import { join, resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execCallback);

const here = import.meta.dirname;
const filter = resolve(here, '..', '..', 'lua-filters', 'bundled', 'repeat_captions.lua');
const dump = join(here, 'dump-native.lua');
const note = join(here, '..', 'markdowns', 'repeat-captions.md');

const pandocInstalled = (() => {
  try {
    execSync('pandoc --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!pandocInstalled)('repeating a table caption', () => {
  const tables = async (to: string): Promise<string[]> => {
    const { stdout } = await run(`pandoc -L "${filter}" -L "${dump}" -t ${to} "${note}" -o -`);
    return stdout.split(/\bTable\b/).slice(1);
  };

  test('a captioned table is marked in LaTeX, one without a caption is not', async () => {
    const [captioned, plain] = await tables('latex');
    expect(captioned).toContain('"repeat-caption"');
    expect(plain).not.toContain('"repeat-caption"');
  }, 60_000);

  test('nothing is marked for a writer with no pages to repeat it on', async () => {
    for (const table of await tables('html')) {
      expect(table).not.toContain('"repeat-caption"');
    }
  }, 60_000);
});
