/*
 * A captioned image is a float in LaTeX, and the page breaking carries it off to wherever it fits — measured against
 * pandoc: two pictures with a paragraph between them come out as one picture, all of the text, and then the other
 * picture alone on the next page. The filter pins them where they were written.
 *
 * What is checked here is the preamble, not the pages: the placement is LaTeX's to honour, and the one thing that can
 * go wrong on this side is writing it where it does not belong, or writing over a preamble the note already had.
 */

import { exec as execCallback, execSync } from 'child_process';
import { join, resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execCallback);

const here = import.meta.dirname;
const filter = resolve(here, '..', '..', 'lua-filters', 'bundled', 'float_placement.lua');
const note = join(here, '..', 'markdowns', 'float-placement.md');

const pandocInstalled = (() => {
  try {
    execSync('pandoc --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!pandocInstalled)('pinning a figure to where it was written', () => {
  const convert = async (to: string): Promise<string> => {
    const { stdout } = await run(`pandoc -s -L "${filter}" -t ${to} "${note}" -o -`);
    return stdout;
  };

  test('the placement reaches the preamble of what LaTeX sets', async () => {
    const latex = await convert('latex');
    expect(latex).toContain('\\usepackage{float}');
    expect(latex).toContain('\\floatplacement{figure}{H}');
  }, 60_000);

  test('and the note keeps the preamble it wrote for itself', async () => {
    const latex = await convert('latex');
    expect(latex).toContain('\\usepackage{lipsum}');
    // Ours is added to the list rather than written over it.
    expect(latex.indexOf('\\usepackage{lipsum}')).toBeLessThan(latex.indexOf('\\usepackage{float}'));
  }, 60_000);

  test('a writer with no floats to place is given nothing at all', async () => {
    for (const to of ['html', 'typst', 'markdown']) {
      expect(await convert(to)).not.toContain('floatplacement');
    }
  }, 60_000);
});
