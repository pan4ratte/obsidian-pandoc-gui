/* A filter of the user's own: named, given a file name nothing else has taken, and written into `lua/`. */

import { LOCAL_FILTER_PREFIX, LuaFilterManager, luaFileSlug, type InstalledLuaFilter } from '../../src/filters/lua_filters';
import type PandocGuiPlugin from '../../src/main';

/** What the adapter was asked to write, by path. */
const written = new Map<string, string>();

const plugin = {
  settings: {},
  manifest: { dir: 'plugins/x' },
  app: {
    vault: {
      adapter: {
        write: (path: string, data: string) => {
          written.set(path, data);
          return Promise.resolve();
        },
        read: (path: string) => Promise.resolve(written.get(path) ?? ''),
      },
    },
  },
} as unknown as PandocGuiPlugin;

const manager = (bundled: string[] = []) => new LuaFilterManager(plugin, bundled);

const installed = (...fileNames: string[]): InstalledLuaFilter[] =>
  fileNames.map(fileName => ({ id: `local:${fileName}`, fileName, storeName: fileName, category: 'other' }));

beforeEach(() => written.clear());

describe('naming the file', () => {
  test('a name becomes the file name a file system takes of it', () => {
    expect(luaFileSlug('Page breaks')).toBe('page-breaks');
    expect(luaFileSlug('  My Filter (v2)!  ')).toBe('my-filter-v2');
    expect(luaFileSlug('a'.repeat(60))).toHaveLength(40);
  });

  test('a name with no letters to keep still names a file', () => {
    // Written in another script, there is nothing for an ASCII file name to take from it.
    expect(luaFileSlug('Мой фильтр')).toBe('filter');
    expect(luaFileSlug('...')).toBe('filter');
  });
});

describe('writing a filter of one’s own', () => {
  const draft = { name: 'Page breaks', code: 'function Para(el) return el end' };

  test('it is written into the plugin folder and recorded as installed', async () => {
    const filter = await manager().create({ ...draft, description: ' Breaks pages. ' }, []);
    expect(filter).toEqual({
      id: 'local:page-breaks',
      fileName: 'page-breaks.lua',
      storeName: 'Page breaks',
      description: 'Breaks pages.',
      category: 'other',
    });
    expect(filter.id.startsWith(LOCAL_FILTER_PREFIX)).toBe(true);
    // No formats, which is what says it runs in all of them.
    expect(filter.formats).toBeUndefined();
    expect(written.get('plugins/x/lua/page-breaks.lua')).toBe(`${draft.code}\n`);
  });

  test('the code is written with the line endings lua reads, and ends in a newline', async () => {
    await manager().create({ name: 'a', code: 'one\r\ntwo\r\n\n\n' }, []);
    expect(written.get('plugins/x/lua/a.lua')).toBe('one\ntwo\n');
  });

  test('a file name already taken is stepped past, whether by an installed filter or a bundled one', async () => {
    const first = await manager().create(draft, installed('page-breaks.lua'));
    expect(first.fileName).toBe('page-breaks-2.lua');
    expect(first.id).toBe('local:page-breaks-2');

    const second = await manager(['page-breaks.lua']).create(draft, installed('page-breaks-2.lua'));
    expect(second.fileName).toBe('page-breaks-3.lua');
  });

  test('a filter with no name or nothing in it is not a filter', async () => {
    await expect(manager().create({ name: '   ', code: 'x' }, [])).rejects.toThrow(/name/);
    await expect(manager().create({ name: 'a', code: ' \n ' }, [])).rejects.toThrow(/empty/);
    expect(written.size).toBe(0);
  });
});

describe('rewriting one', () => {
  test('the file keeps its name, whatever the filter is renamed to', async () => {
    const filter = await manager().create({ name: 'Page breaks', code: 'one' }, []);
    const renamed = await manager().update(filter, { name: 'Pagination', description: 'Breaks pages.', code: 'two' });

    // A template runs a filter by naming its file, so neither the file nor the id it is known by moves.
    expect(renamed).toEqual({ ...filter, storeName: 'Pagination', description: 'Breaks pages.' });
    expect(written.get('plugins/x/lua/page-breaks.lua')).toBe('two\n');
    expect([...written.keys()]).toEqual(['plugins/x/lua/page-breaks.lua']);
  });

  test('a description taken back out is taken out of the record too', async () => {
    const filter = await manager().create({ name: 'a', description: 'Says something.', code: 'one' }, []);
    const rewritten = await manager().update(filter, { name: 'a', description: '  ', code: 'one' });
    expect(rewritten.description).toBeUndefined();
  });

  test('what is on disk is what the field is filled from', async () => {
    const filter = await manager().create({ name: 'a', code: 'one\ntwo' }, []);
    expect(await manager().readFilter(filter)).toBe('one\ntwo\n');
  });

  test('a rewrite is held to the same reading as a first writing', async () => {
    const filter = await manager().create({ name: 'a', code: 'one' }, []);
    await expect(manager().update(filter, { name: ' ', code: 'one' })).rejects.toThrow(/name/);
    await expect(manager().update(filter, { name: 'a', code: '' })).rejects.toThrow(/empty/);
  });
});
