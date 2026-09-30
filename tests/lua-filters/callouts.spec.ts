/*
 * Obsidian's callouts read as pandoc's alerts. The `alerts` extension alone takes only `> [!NOTE]`, and before 3.12
 * only in capitals.
 */

import { exec as execCallback, execSync } from 'child_process';
import { join, resolve } from 'path';
import { promisify } from 'util';

const run = promisify(execCallback);

const here = import.meta.dirname;
const filter = resolve(here, '..', '..', 'lua-filters', 'bundled', 'callouts.lua');
const note = join(here, '..', 'markdowns', 'callouts.md');

const pandocInstalled = (() => {
  try {
    execSync('pandoc --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

type Node = { t: string; c?: unknown };
type Attr = [string, string[], [string, string][]];

const stringify = (inlines: Node[]): string =>
  inlines.map(i => (i.t === 'Str' ? (i.c as string) : i.t === 'Space' ? ' ' : stringify((i.c as Node[]) ?? []))).join('');

/** Each callout as its classes, its title and the text of its first body block. */
const callouts = (blocks: Node[]): { classes: string[]; title: string; body: string }[] =>
  blocks.flatMap(block => {
    if (block.t !== 'Div') {
      return [];
    }
    const [[, classes], content] = block.c as [Attr, Node[]];
    const [heading, first, ...rest] = content;
    const [, [para]] = heading.c as [Attr, Node[]];
    return [
      { classes, title: stringify(para.c as Node[]), body: first ? stringify(first.c as Node[]) : '' },
      ...callouts(rest),
    ];
  });

describe.skipIf(!pandocInstalled)('callouts', () => {
  const convert = async (to: string) =>
    (await run(`pandoc -f markdown+alerts -L "${filter}" -t ${to} "${note}"`)).stdout.replace(/\r\n/g, '\n');

  test('every callout becomes an alert, with the type first and the title kept', async () => {
    const doc = JSON.parse(await convert('json')) as { blocks: Node[] };
    expect(callouts(doc.blocks)).toEqual([
      { classes: ['note', 'alert'], title: 'My own title', body: 'Body line.Second line.' },
      { classes: ['note', 'alert'], title: 'Note', body: 'Upper.' },
      { classes: ['tip', 'alert'], title: 'Folded', body: 'Body.' },
      { classes: ['faq', 'alert'], title: 'Faq', body: 'Custom type.' },
      { classes: ['warning', 'alert'], title: 'Nested', body: 'Inner.' },
      { classes: ['заметка', 'alert'], title: 'Заметка', body: 'Кириллица.' },
    ]);
  }, 60_000);

  test('a plain block quote is left alone', async () => {
    const doc = JSON.parse(await convert('json')) as { blocks: Node[] };
    expect(doc.blocks.filter(b => b.t === 'BlockQuote')).toHaveLength(1);
  }, 60_000);

  test('a writer that knows alerts writes them back', async () => {
    const gfm = await convert('gfm');
    expect(gfm).toContain('> [!NOTE]\n> Body line.');
    expect(gfm).toContain('> [!TIP]\n> Body.');
    expect(gfm).toContain('> [!WARNING]\n> Inner.');
  }, 60_000);
});
