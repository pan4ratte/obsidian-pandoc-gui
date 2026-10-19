import type { DataAdapter } from 'obsidian';
import { fullPath, mobilePath, vaultRoot } from '../../src/system/platform';
import { resolve } from '../../src/system/paths';
import { VirtualPaths } from '../../src/wasm/paths';

/** Obsidian's mobile adapter: `base + "/" + path`, with no `getBasePath`. */
const mobileAdapter = (base: string) => ({ getFullPath: (path: string) => `${base}/${path}` }) as unknown as DataAdapter;

const desktopAdapter = (base: string) =>
  ({ getBasePath: () => base, getFullPath: (path: string) => `${base}\\${path}` }) as unknown as DataAdapter;

describe('full paths on a phone', () => {
  // iOS keeps the base relative to the app's Documents folder (issue #12).
  const ios = mobileAdapter('Ipad_Testing');

  test('an iOS vault is given an absolute root', () => {
    expect(vaultRoot(ios)).toBe('/Ipad_Testing');
    expect(fullPath(ios, 'test.md')).toBe('/Ipad_Testing/test.md');
  });

  test("the vault's own folder loses the slash its path doubles", () => {
    expect(fullPath(ios, '/')).toBe('/Ipad_Testing');
  });

  test('a note resolved against the vault is found in it, not in a folder named after it', () => {
    const root = vaultRoot(ios);
    const paths = new VirtualPaths(root);
    expect(paths.file(resolve(root, fullPath(ios, 'test.md')))).toBe('test.md');
    expect(paths.file(resolve(root, `${fullPath(ios, '/')}/test.pdf`))).toBe('test.pdf');
  });

  test('an Android path is already absolute and stays as it is', () => {
    const android = mobileAdapter('/storage/emulated/0/Documents/Vault');
    expect(vaultRoot(android)).toBe('/storage/emulated/0/Documents/Vault');
    expect(fullPath(android, 'a/b.md')).toBe('/storage/emulated/0/Documents/Vault/a/b.md');
  });

  test('a desktop path is left to the desktop adapter', () => {
    const desktop = desktopAdapter('C:\\Vault');
    expect(vaultRoot(desktop)).toBe('C:/Vault');
    expect(fullPath(desktop, 'a.md')).toBe('C:\\Vault\\a.md');
  });

  test('a folder saved in the old relative form is read as the absolute one', () => {
    expect(mobilePath('Ipad_Testing//')).toBe('/Ipad_Testing');
    expect(mobilePath('Ipad_Testing/Exports')).toBe('/Ipad_Testing/Exports');
  });
});
