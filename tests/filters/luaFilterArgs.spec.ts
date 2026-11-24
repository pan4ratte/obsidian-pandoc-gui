import { addLuaFilterArg, hasLuaFilterArg, luaFilterArg, removeLuaFilterArg, withFilterPaths } from '../../src/filters/lua_filters';

/*
 * The flag carries `${luaDir}` as literal text — the export fills it in later.
 * Every character of `${...}` means something to a regular expression, so
 * taking a filter back out is the case most worth pinning down.
 */

const ARG = '--lua-filter="${luaDir}/wordcount.lua"';

test('the argument is the literal template variable, not an interpolation', () => {
  expect(luaFilterArg('wordcount.lua')).toBe(ARG);
});

test('adding to empty arguments yields just the flag', () => {
  expect(addLuaFilterArg(undefined, 'wordcount.lua')).toBe(ARG);
  expect(addLuaFilterArg('', 'wordcount.lua')).toBe(ARG);
  expect(addLuaFilterArg('   ', 'wordcount.lua')).toBe(ARG);
});

test('adding appends to arguments already there', () => {
  expect(addLuaFilterArg('--toc', 'wordcount.lua')).toBe(`--toc ${ARG}`);
});

test('adding the same filter twice changes nothing', () => {
  expect(addLuaFilterArg(ARG, 'wordcount.lua')).toBe(ARG);
  expect(addLuaFilterArg(`--toc ${ARG}`, 'wordcount.lua')).toBe(`--toc ${ARG}`);
});

test('removing takes the flag out and closes the gap', () => {
  expect(removeLuaFilterArg(`--toc ${ARG} --number-sections`, 'wordcount.lua')).toBe('--toc --number-sections');
  expect(removeLuaFilterArg(ARG, 'wordcount.lua')).toBe('');
  expect(removeLuaFilterArg(`--toc ${ARG}`, 'wordcount.lua')).toBe('--toc');
});

test('removing leaves other filters alone', () => {
  const other = luaFilterArg('spellcheck.lua');
  expect(removeLuaFilterArg(`${ARG} ${other}`, 'wordcount.lua')).toBe(other);
  expect(removeLuaFilterArg(`${ARG} ${other}`, 'spellcheck.lua')).toBe(ARG);
});

test('removing a filter that is not there changes nothing', () => {
  expect(removeLuaFilterArg('--toc', 'wordcount.lua')).toBe('--toc');
  expect(removeLuaFilterArg(undefined, 'wordcount.lua')).toBe('');
});

test('a file name is not read as a pattern', () => {
  // `+` and `.` are the characters a bundled filter's name actually contains.
  const tricky = luaFilterArg('markdown+hugo.lua');
  expect(hasLuaFilterArg(tricky, 'markdown+hugo.lua')).toBe(true);
  // Would match if `+` and `.` were left as regex operators.
  expect(hasLuaFilterArg(tricky, 'markdownXhugoXlua')).toBe(false);
  expect(removeLuaFilterArg(`--toc ${tricky}`, 'markdown+hugo.lua')).toBe('--toc');
  expect(removeLuaFilterArg(`--toc ${tricky}`, 'markdown-hugo.lua')).toBe(`--toc ${tricky}`);
});

test('hasLuaFilterArg reports what is and is not there', () => {
  expect(hasLuaFilterArg(undefined, 'wordcount.lua')).toBe(false);
  expect(hasLuaFilterArg('--toc', 'wordcount.lua')).toBe(false);
  expect(hasLuaFilterArg(`--toc ${ARG}`, 'wordcount.lua')).toBe(true);
  // A different filter whose name merely ends the same way.
  expect(hasLuaFilterArg(luaFilterArg('my-wordcount.lua'), 'wordcount.lua')).toBe(false);
});

// Pandoc 3.14 finds a filter in the plugin's data folder by its name alone.
test('a filter named by its file alone counts as running', () => {
  expect(hasLuaFilterArg('--lua-filter=wordcount.lua', 'wordcount.lua')).toBe(true);
  expect(hasLuaFilterArg('-L "wordcount.lua" --toc', 'wordcount.lua')).toBe(true);
  expect(hasLuaFilterArg('--lua-filter=my-wordcount.lua', 'wordcount.lua')).toBe(false);
  expect(addLuaFilterArg('--lua-filter=wordcount.lua', 'wordcount.lua')).toBe('--lua-filter=wordcount.lua');
});

test('removing takes out a filter named by its file alone', () => {
  expect(removeLuaFilterArg('--toc -L wordcount.lua -s', 'wordcount.lua')).toBe('--toc -s');
});

test('a Pandoc that cannot look filters up gets the path to the plugin’s own', () => {
  const ours = ['embeds.lua', 'wordcount.lua'];
  expect(withFilterPaths('pandoc a.md -L embeds.lua --lua-filter="wordcount.lua" -o b.docx', ours)).toBe(
    'pandoc a.md --lua-filter="${luaDir}/embeds.lua" --lua-filter="${luaDir}/wordcount.lua" -o b.docx'
  );
  expect(withFilterPaths('pandoc a.md -L mine.lua -L /x/embeds.lua', ours)).toBe('pandoc a.md -L mine.lua -L /x/embeds.lua');
});
