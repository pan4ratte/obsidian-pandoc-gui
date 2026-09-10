
import  'obsidian';
import type { EventRef } from 'obsidian';
import type { BrowserWindow } from 'electron';


declare global {
  interface Window {
    /** Set by Obsidian on every window it owns, main and popout alike. */
    electronWindow?: BrowserWindow;
  }
}


declare module 'obsidian' {

  export interface DataAdapter {
    /** The desktop adapter's alone — a phone's has no such thing. Reach it through `vaultRoot` in src/platform.ts. */
    getBasePath?(): string;
    getFullPath(path: string): string;
    startWatchPath(path: string): void;
    stopWatchPath(path: string): void;
  }

  export interface PluginSettingTab {
    name: string;
  }

  export interface App {
    readonly loadProgress: { show(): void; hide(): void; setMessage(msg: string): void; };
    plugins: {
      enablePlugin(id: string): Promise<void>;
      disablePlugin(id: string): Promise<void>;
      /** Every plugin running in this vault, by its id. Another plugin's API is its own shape — see excalidraw.ts. */
      plugins: Record<string, unknown>;
    }
  }
  
  export interface Vault {
    config: {
      attachmentFolderPath: string,
      useMarkdownLinks: boolean,
    }
    on(name: 'raw', callback: (file: string) => void, ctx?: unknown): EventRef;
  }
}