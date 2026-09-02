/* What kind of device this is, and how to reach the parts of it that only a desktop has.
 *
 * On a phone there is no node and no electron: importing either at the top of a file stops the plugin loading at all.
 * So everything that needs one is reached through this file, which loads it when it is asked for and answers for the
 * platform when there is nothing to load.
 */

import { Platform, type DataAdapter } from 'obsidian';
import { normalize } from './paths';
import type { PlatformKey } from './utils';

/**
 * Whether this runs as a phone does — what the plugin can actually do, and nothing about how it is drawn.
 *
 * A desktop emulating a phone counts, because Obsidian withholds every node package from a plugin while it does: no
 * pandoc to run, no file system outside the vault, no electron. Asking `isMobileApp` instead gets a desktop under
 * emulation as far as a command it cannot start, which is how an export used to end in a node error rather than in
 * the wasm build the phone it was pretending to be would have used.
 */
export const isMobile = (): boolean => !Platform.isDesktop;

/**
 * Whether Obsidian is drawing its mobile UI, which a desktop emulating a phone is doing too.
 *
 * What the plugin shows follows this, so that emulation is worth something: a desktop set to emulate a phone gets the
 * settings a phone gets, the installed pandoc and all of its rows left out. What the plugin can do follows `isMobile`,
 * which under emulation says the same — a phone's UI over a phone's abilities is the whole point of the pretence.
 */
export const isMobileUi = (): boolean => Platform.isMobile;

/** What separates one path from the next in a list of them, as this platform writes it. */
export const PATH_SEPARATOR = (): string => (Platform.isWin ? ';' : ':');

/**
 * Whether that mobile UI is the narrow one. A tablet has the room a desktop has and only wants for a pointer; a phone
 * wants for the width too, so a row of icons at the end of a table row is one thing too many there.
 */
export const isPhoneUi = (): boolean => Platform.isPhone;

/**
 * Whether Obsidian is emulating a phone rather than running on one.
 *
 * It is the class Obsidian's own plugin loader reads: while it is set, a plugin's `require` answers nothing for every
 * node package, with a notice on screen and an error in the console for the asking. That is the emulation doing its
 * job — a phone has no node either — so anything reaching for node asks this first and takes the answer quietly.
 */
export const isEmulatingMobile = (): boolean => typeof document !== 'undefined' && document.body.hasClass('emulate-mobile');

/**
 * Whether node and electron are there to be reached — the one question worth asking before reaching for either.
 *
 * `Platform.isDesktop` is what answers it, being the flag that turns over under emulation as well as on a phone; it is
 * also the guard Obsidian's own lint rule reads. Every `import()` of a node package in this plugin stands behind this.
 */
export const isDesktop = (): boolean => Platform.isDesktop;

/**
 * Which platform a per-platform setting belongs to.
 *
 * The desktop keys are node's own spelling, which is what vaults have been storing since before this file — a Mac's
 * pandoc path stays where it was. The two phones are named rather than folded into a desktop key, so a synced vault
 * does not have an iPhone reading the export folder of the Mac it syncs with.
 */
export const currentPlatform = (): PlatformKey => {
  if (Platform.isIosApp) {
    return 'ios';
  }
  if (Platform.isAndroidApp) {
    return 'android';
  }
  // A desktop pretending to be a phone answers as a phone: an export folder picked there is one of the vault's, chosen
  // because nothing outside it can be written to. Kept in a slot of its own, so a session spent testing the phone's
  // side of a synced vault does not write over the folder the computer itself exports to.
  if (isEmulatingMobile()) {
    return 'emulated';
  }
  return Platform.isWin ? 'win32' : Platform.isMacOS ? 'darwin' : 'linux';
};

/** The vault's own folder on the device. `getBasePath` is the desktop adapter's; the other one answers the same way. */
export const vaultRoot = (adapter: DataAdapter): string => normalize(adapter.getBasePath?.() ?? adapter.getFullPath(''));

/** Electron, likewise — see `typings/electron.d.ts` for the part of it this plugin uses. */
export const electron = async () => await import('electron');

/**
 * The window a file dialog should hang from: the one whose UI asked for it.
 *
 * Obsidian opens a modal in whichever window has focus, so the settings tab and every dialog can be sitting in a
 * popout. `getCurrentWindow` only ever names the main window, and on macOS a sheet parented to that opens on a
 * window the user is not looking at — nothing shows that the button did anything.
 */
const dialogWindow = async () => {
  const ct = await electron();
  return activeWindow?.electronWindow ?? ct.remote.getCurrentWindow();
};

/** A page opened outside Obsidian, however this platform opens one. */
export const openExternal = (url: string): void => {
  if (!isDesktop()) {
    window.open(url, '_blank');
    return;
  }
  void electron().then(ct => ct.remote.shell.openExternal(url));
};

/** The exported file, opened in whatever the system opens it with. Nothing to do so on a phone. */
export const openFile = async (path: string): Promise<void> => {
  if (isDesktop()) {
    const ct = await electron();
    await ct.remote.shell.openPath(path);
  }
};

/** The exported file, shown where it was written. */
export const showInFolder = async (path: string): Promise<void> => {
  if (isDesktop()) {
    const ct = await electron();
    ct.remote.shell.showItemInFolder(path);
  }
};

export interface FileFilter {
  name: string;
  extensions: string[];
}

/** A file or folder chosen from the system, or nothing where there is no such dialog to open. */
export const chooseFile = async (options: {
  filters?: FileFilter[];
  folder?: boolean;
  defaultPath?: string;
}): Promise<string | undefined> => {
  if (!isDesktop()) {
    return undefined;
  }
  const ct = await electron();
  const chosen = await ct.remote.dialog.showOpenDialog(await dialogWindow(), {
    defaultPath: options.defaultPath,
    filters: options.folder ? undefined : options.filters,
    properties: options.folder ? ['createDirectory', 'openDirectory'] : ['openFile'],
  });
  return chosen.canceled ? undefined : chosen.filePaths[0];
};

/** Where to save a file, asked of the system with the overwrite warning it puts up itself. */
export const chooseSavePath = async (options: { title?: string; defaultPath?: string }): Promise<string | undefined> => {
  if (!isDesktop()) {
    return options.defaultPath;
  }
  const ct = await electron();
  const chosen = await ct.remote.dialog.showSaveDialog(await dialogWindow(), {
    title: options.title,
    defaultPath: options.defaultPath,
    properties: ['showOverwriteConfirmation', 'createDirectory'],
  });
  return chosen.canceled ? undefined : chosen.filePath;
};

/** The folder the system keeps for files nothing is meant to keep — where a run's scratch input goes. */
export const tempFolder = async (): Promise<string | undefined> => {
  if (!isDesktop()) {
    return undefined;
  }
  const ct = await electron();
  return ct.remote.app.getPath('temp');
};

/** The folder a file dialog starts in when nothing better is known. */
export const documentsFolder = async (): Promise<string | undefined> => {
  if (!isDesktop()) {
    return undefined;
  }
  const ct = await electron();
  return ct.remote.app.getPath('documents');
};
