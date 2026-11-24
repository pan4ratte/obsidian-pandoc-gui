import { createEnv } from '../../src/settings';

// Pandoc 3.14 looks in the folders `PANDOC_DATA_DIRS` lists, and the plugin's own comes first.
const separator = process.platform === 'win32' ? ';' : ':';

describe('the data folders pandoc is pointed at', () => {
  const saved = process.env.PANDOC_DATA_DIRS;
  afterEach(() => {
    if (saved === undefined) {
      delete process.env.PANDOC_DATA_DIRS;
    } else {
      process.env.PANDOC_DATA_DIRS = saved;
    }
  });

  test('the plugin’s, and nothing that reads as a folder where the system lists none', () => {
    delete process.env.PANDOC_DATA_DIRS;
    expect(createEnv({}, { pluginDir: '/p' }).PANDOC_DATA_DIRS).toBe(`/p/pandoc${separator}`);
  });

  test('the plugin’s ahead of the ones the system already lists', () => {
    process.env.PANDOC_DATA_DIRS = '/mine';
    expect(createEnv({}, { pluginDir: '/p' }).PANDOC_DATA_DIRS).toBe(`/p/pandoc${separator}/mine`);
  });
});
