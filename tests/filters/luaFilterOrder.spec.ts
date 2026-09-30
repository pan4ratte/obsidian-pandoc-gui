import { EMBEDS_FILTER, luaFilterArg, orderLuaFilters, withEmbedsFilter } from '../../src/filters/lua_filters';

/*
 * Pandoc runs filters in the order they are written. The embeds filter parses the transcluded notes into the
 * document, so anything running before it works on a broken image where a page of writing should be — measured:
 * `figures.lua` ahead of it leaves an embedded image unstyled.
 */

const EMBEDS = luaFilterArg(EMBEDS_FILTER);
const FIGURES = luaFilterArg('figures.lua');
const TABLES = luaFilterArg('table-styles.lua');

test('a filter toggled on after the others is still run after them', () => {
  expect(orderLuaFilters(`pandoc ${EMBEDS} ${FIGURES}`)).toBe(`pandoc ${EMBEDS} ${FIGURES}`);
});

test('the embeds filter is moved in front of the filters it has to precede', () => {
  expect(orderLuaFilters(`pandoc ${FIGURES} ${EMBEDS}`)).toBe(`pandoc ${EMBEDS} ${FIGURES}`);
  expect(orderLuaFilters(`pandoc ${FIGURES} ${TABLES} ${EMBEDS} --toc`)).toBe(`pandoc ${EMBEDS} ${FIGURES} ${TABLES} --toc`);
});

test('it passes the preset filters written on the line before the rows', () => {
  const mathBlock = luaFilterArg('math_block.lua');
  const command = `pandoc "\${currentPath}" -f markdown ${mathBlock} -o "out.pdf" ${EMBEDS} ${FIGURES}`;
  expect(orderLuaFilters(command)).toBe(`pandoc "\${currentPath}" -f markdown ${EMBEDS} ${mathBlock} -o "out.pdf" ${FIGURES}`);
});

test('everything else keeps the order it was given', () => {
  // Store filters answer to each other — one catalogue entry says to add another first — so only the one rule moves.
  const first = luaFilterArg('scholarly-metadata.lua');
  const then = luaFilterArg('author-info-blocks.lua');
  expect(orderLuaFilters(`pandoc ${first} ${then} ${EMBEDS}`)).toBe(`pandoc ${EMBEDS} ${first} ${then}`);
});

test('a command with nothing to reorder is handed back as it stands', () => {
  expect(orderLuaFilters('pandoc --toc -o "out.docx"')).toBe('pandoc --toc -o "out.docx"');
  expect(orderLuaFilters(`pandoc ${FIGURES} --toc`)).toBe(`pandoc ${FIGURES} --toc`);
  expect(orderLuaFilters(`pandoc ${EMBEDS}`)).toBe(`pandoc ${EMBEDS}`);
  expect(orderLuaFilters('')).toBe('');
});

test('the other spellings of the flag are filters too', () => {
  expect(orderLuaFilters(`pandoc --lua-filter figures.lua -L ${EMBEDS_FILTER}`)).toBe(
    `pandoc -L ${EMBEDS_FILTER} --lua-filter figures.lua`
  );
});

test('a filter merely ending in the same name is left where it is', () => {
  const other = luaFilterArg('my-embeds.lua');
  expect(orderLuaFilters(`pandoc ${FIGURES} ${other}`)).toBe(`pandoc ${FIGURES} ${other}`);
});

test('the template variables around it come through untouched', () => {
  const command = `pandoc "\${currentPath}" --resource-path="\${currentDir}" ${FIGURES} ${EMBEDS} -o "\${outputPath}"`;
  expect(orderLuaFilters(command)).toBe(
    `pandoc "\${currentPath}" --resource-path="\${currentDir}" ${EMBEDS} ${FIGURES} -o "\${outputPath}"`
  );
});

describe('withEmbedsFilter', () => {
  const MARKDOWN = 'pandoc "a.md" --lua-filter="/p/lua/markdown.lua" -o "a.out.md"';

  test('adds the filter in front of the others', () => {
    expect(withEmbedsFilter(MARKDOWN, '/p/lua')).toBe(
      'pandoc "a.md" --lua-filter="/p/lua/embeds.lua" --lua-filter="/p/lua/markdown.lua" -o "a.out.md"'
    );
  });

  test('at the end where there are none, and not twice', () => {
    expect(withEmbedsFilter('pandoc "a.md" -o "b.docx"', '/p/lua')).toBe('pandoc "a.md" -o "b.docx" --lua-filter="/p/lua/embeds.lua"');
    expect(withEmbedsFilter(`pandoc ${EMBEDS} ${FIGURES}`, '/p/lua')).toBe(`pandoc ${EMBEDS} ${FIGURES}`);
  });
});
