/* Reading and writing files by their path on the device, wherever the plugin happens to be running.
 *
 * Inside the vault Obsidian's own adapter does it, on every platform. Outside it there is only a desktop's file
 * system, and node is loaded when a path actually calls for it — importing it at the top of the file would stop the
 * plugin loading on a phone, where there is no node at all.
 */

import { Platform, type Vault } from 'obsidian';
import { VirtualPaths } from '../wasm/paths';
import { isDesktop } from './platform';
import { dirname } from './paths';

/**
 * Node's own file system. Every caller has already established that this is a platform with one; the guard here is
 * the stricter question of whether node can be reached at all — see `isDesktop` — and the two only part where a
 * phone is being emulated, which every caller either catches or was going to fail in anyway.
 */
export const nodeFs = async () => {
  if (!Platform.isDesktop) {
    throw new Error('There is no file system outside the vault to reach on this device');
  }
  return await import('fs/promises');
};

const asBytes = (buffer: ArrayBuffer): Uint8Array => new Uint8Array(buffer);

const asBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export class FileStore {
  #paths: VirtualPaths;

  constructor(
    private vault: Vault,
    vaultDir: string
  ) {
    this.#paths = new VirtualPaths(vaultDir);
  }

  /** The bytes of a file, or nothing when it is not there — a missing resource is pandoc's to complain about. */
  async read(path: string): Promise<Uint8Array | undefined> {
    const inside = this.#paths.inVault(path);
    try {
      if (inside !== undefined) {
        return asBytes(await this.vault.adapter.readBinary(inside));
      }
      // Nothing outside the vault is reachable from a phone, so there is no file here to fail to read.
      return isDesktop() ? new Uint8Array(await (await nodeFs()).readFile(path)) : undefined;
    } catch {
      return undefined;
    }
  }

  /** Whether there is already a file there — what the overwrite warning is asked before it is shown. */
  async exists(path: string): Promise<boolean> {
    const inside = this.#paths.inVault(path);
    if (inside !== undefined) {
      return await this.vault.adapter.exists(inside);
    }
    if (!isDesktop()) {
      return false;
    }
    try {
      await (await nodeFs()).stat(path);
      return true;
    } catch {
      return false;
    }
  }

  /** The folder, made if it is not there — pandoc writes into one, it does not create one. */
  async mkdir(path: string): Promise<void> {
    const inside = this.#paths.inVault(path);
    if (inside !== undefined) {
      await this.vault.adapter.mkdir(inside);
      return;
    }
    if (isDesktop()) {
      await (await nodeFs()).mkdir(path, { recursive: true });
    }
  }

  async write(path: string, data: Uint8Array): Promise<void> {
    const inside = this.#paths.inVault(path);
    if (inside !== undefined) {
      const folder = dirname(inside);
      if (folder) {
        await this.vault.adapter.mkdir(folder);
      }
      await this.vault.adapter.writeBinary(inside, asBuffer(data));
      return;
    }
    if (!isDesktop()) {
      throw new Error(`"${path}" is outside the vault, and there is nowhere else to write to on this device`);
    }
    const fs = await nodeFs();
    const folder = dirname(path);
    if (folder) {
      await fs.mkdir(folder, { recursive: true });
    }
    await fs.writeFile(path, data);
  }
}
