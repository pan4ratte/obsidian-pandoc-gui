/*
 * What the manager owns, and what it does not.
 *
 * It owns the file. What is installed is recorded in the settings by whoever holds them — the settings tab keeps them
 * in a solid store, and a second writer reaching past that store leaves the panel showing what was true a moment ago,
 * which is how "Not installed" survived an install.
 */

import { assetOf, isNewerRelease, PandocWasmManager, WASM_FILE } from '../../src/wasm/install';

/** What this vault happens to call its config folder — a fixture, not a lookup. */
const CONFIG = '.config';

/** A vault that is a map, and settings nobody but the test writes. */
const plugin = () => {
  const files = new Map<string, ArrayBuffer>();
  const settings: { wasmVersion?: string } = {};
  const made: string[] = [];
  const saves: number[] = [];
  return {
    files,
    settings,
    made,
    saves,
    manifest: { dir: `${CONFIG}/plugins/pandoc-gui` },
    app: {
      vault: {
        adapter: {
          exists: (path: string) => Promise.resolve(files.has(path)),
          mkdir: (path: string) => {
            made.push(path);
            return Promise.resolve();
          },
          writeBinary: (path: string, data: ArrayBuffer) => {
            files.set(path, data);
            return Promise.resolve();
          },
          remove: (path: string) => {
            files.delete(path);
            return Promise.resolve();
          },
        },
      },
    },
    saveSettings: () => {
      saves.push(1);
      return Promise.resolve();
    },
  };
};

describe('PandocWasmManager', () => {
  test('puts the binary where the plugin folder keeps it', () => {
    const host = plugin();
    const manager = new PandocWasmManager(host as never);
    expect(manager.filePath).toBe(`${CONFIG}/plugins/pandoc-gui/wasm/${WASM_FILE}`);
  });

  test('a windows plugin folder is still written with forward slashes, as the adapter takes them', () => {
    const host = plugin();
    host.manifest.dir = `${CONFIG}\\plugins\\pandoc-gui`;
    const manager = new PandocWasmManager(host as never);
    expect(manager.filePath).toBe(`${CONFIG}/plugins/pandoc-gui/wasm/pandoc.wasm`);
  });

  test('answers whether the file is there, rather than what the settings claim', async () => {
    const host = plugin();
    const manager = new PandocWasmManager(host as never);
    host.settings.wasmVersion = '3.10.2';
    // A version recorded for a file that is gone is not an installation.
    expect(await manager.isInstalled()).toBe(false);
    host.files.set(manager.filePath, new ArrayBuffer(1));
    expect(await manager.isInstalled()).toBe(true);
  });

  test('removing takes the file and leaves the settings to their owner', async () => {
    const host = plugin();
    const manager = new PandocWasmManager(host as never);
    host.files.set(manager.filePath, new ArrayBuffer(1));
    host.settings.wasmVersion = '3.10.2';

    await manager.remove();

    expect(await manager.isInstalled()).toBe(false);
    // Untouched: the panel writes this through its store, and two writers is the bug this guards.
    expect(host.settings.wasmVersion).toBe('3.10.2');
    expect(host.saves).toEqual([]);
  });
});

describe('assetOf', () => {
  const release = (tag: string, name: string) => ({
    tag_name: tag,
    assets: [
      { name: `pandoc-${tag}-windows-x86_64.zip`, size: 1, browser_download_url: 'w' },
      { name, size: 16, browser_download_url: 'u' },
    ],
  });

  // Pandoc has renamed this asset twice; the version comes from the tag so none of the spellings has to carry it.
  test.each([
    ['3.10.1', 'pandoc-wasm.zip'],
    ['3.10.2', 'pandoc-wasm-3.10.2.zip'],
    ['3.11', 'pandoc-3.11.wasm.zip'],
  ])('finds the archive in %s, named %s', (tag, name) => {
    expect(assetOf(release(tag, name))).toEqual({ version: tag, url: 'u', size: 16 });
  });

  test('a release without one is not one to offer', () => {
    expect(
      assetOf({ tag_name: '3.10', assets: [{ name: 'pandoc-3.10-1-amd64.deb', size: 1, browser_download_url: 'd' }] })
    ).toBeUndefined();
  });

  test('3.11 is newer than the 3.10.2 on disk', () => {
    expect(isNewerRelease({ version: '3.11', url: 'u', size: 16 }, '3.10.2')).toBe(true);
  });
});
