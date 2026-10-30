import { readFile } from 'fs/promises';
import { join } from 'path';
import { convert, exec, testConversion } from '../common';

const markdowns = join(import.meta.dirname, '..', 'markdowns');
const luaFilters = join(import.meta.dirname, '..', '..', 'lua-filters');

const stripWikilinks = { dir: 'pan4ratte', from: 'markdown+wikilinks_title_after_pipe' };

test('wikilinks go with the text inside them, outside links stay', async () => {
  await testConversion('strip-wikilinks', 'strip-wikilinks', stripWikilinks);
});

test('a vault writing markdown links has its .md and heading links stripped too', async () => {
  await testConversion('strip-wikilinks-markdown-links', 'strip-wikilinks', { ...stripWikilinks, from: 'markdown' });
});

// Not a fixture: newer pandoc marks an embed with a class and older pandoc with a title, so its native form is not the
// same text on every version. What must hold on all of them is that it is still there and still an image.
test('an embed survives, links do not', async () => {
  const out = await convert('strip-wikilinks-embeds', 'strip-wikilinks', stripWikilinks);
  expect(out.match(/Image/g)).toHaveLength(2);
  expect(out).not.toMatch(/Link/);
  expect(out).toMatch(/Str "beside"/);
});

// `embeds.lua` runs first and leaves a link to a note outside the export as a Span of its text, which goes all the same.
test('links embeds.lua has already left as text go too', async () => {
  const filters = ['bundled/embeds.lua', 'pan4ratte/strip-wikilinks.lua'].map(name => `-L "${join(luaFilters, name)}"`).join(' ');
  const out = await exec(`pandoc -s ${filters} -t native -f ${stripWikilinks.from} "${join(markdowns, 'strip-wikilinks.md')}" -o -`, {
    lineSeparator: '\n',
  });
  expect(out).toBe(await readFile(join(markdowns, 'strip-wikilinks.out'), 'utf-8'));
});
