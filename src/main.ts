import { App, Menu, Plugin, PluginManifest, TFile, Notice, debounce } from 'obsidian';
import { PandocGuiSettings, ExportSetting, DEFAULT_SETTINGS, DEFAULT_ENV, restoreTemplates } from './settings';
import { ExportSettingTab, ExportDialog, ImportDialog, UserGuideModal, ChangelogModal } from './ui';
import { exportNote } from './convert/export';
import { getPlatformValue, PlatformKey, clone } from './system/utils';
import { t } from './lang/helpers';
import resources, { BUNDLED_LUA_FILES } from './resources';
import { PandocWasmManager } from './wasm/install';
import { TypstWasmManager } from './wasm/typst';
import { ExtensionManager } from './wasm/extensions';
// `styles.css` is not imported: Obsidian loads the plugin folder's stylesheet itself.

export default class PandocGuiPlugin extends Plugin {
  settings: PandocGuiSettings;
  /** Pandoc's wasm build: the copy on disk, and the one running. */
  readonly wasm = new PandocWasmManager(this);
  /** Typst's, which turns what pandoc writes into a PDF. */
  readonly typst = new TypstWasmManager(this);
  /** The files the wasm build has no way to fetch for itself — styles, templates, the rest. */
  readonly extensions = new ExtensionManager(this);

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.saveSettings = debounce(this.saveSettings.bind(this), 1000, true) as unknown as typeof this.saveSettings;
  }

  async onload() {
    await this.releaseResources();
    await this.loadSettings();

    this.addSettingTab(new ExportSettingTab(this));

    this.addCommand({
      // Obsidian prefixes command ids with the plugin's own.
      id: 'export',
      name: t.CMD_EXPORT,
      icon: 'document',
      callback: () => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          ExportDialog.show(this, file);
        } else {
          new Notice(t.NOTICE_NO_FILE, 2000);
        }
      },
    });
    this.addCommand({
      id: 'export-with-previous',
      name: t.CMD_EXPORT_WITH_PREVIOUS,
      icon: 'document',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (file) {
          // This device's own folder, not merely some device's: a vault that has exported on the computer carries a
          // folder for it, and a phone reading the same settings has none of its own until it has exported once.
          const directory = getPlatformValue(this.settings.lastExportDirectory);
          if (this.settings.lastExportType && directory) {
            const setting = this.settings.items.find(s => s.name === this.settings.lastExportType);
            if (setting) {
              await exportNote(this, file, directory, undefined, setting);
              return;
            }
          }
          ExportDialog.show(this, file);
        } else {
          new Notice(t.NOTICE_NO_FILE, 2000);
        }
      },
    });
    this.addCommand({
      id: 'import',
      name: t.CMD_IMPORT,
      icon: 'file-input',
      callback: () => {
        ImportDialog.show(this);
      },
    });
    this.addCommand({
      id: 'user-guide',
      name: t.CMD_USER_GUIDE,
      icon: 'book-open',
      callback: () => {
        new UserGuideModal(this.app).open();
      },
    });
    this.addCommand({
      id: 'changelog',
      name: t.CMD_CHANGELOG,
      icon: 'scroll-text',
      callback: () => this.openChangelog(),
    });

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu: Menu, file) => {
        if (file instanceof TFile) {
          menu
            .addItem(item => {
              item
                .setTitle(t.CMD_EXPORT)
                .setIcon('document')
                .onClick((): void => {
                  ExportDialog.show(this, file);
                });
            })
            .addSeparator();
        }
      })
    );
    this.app.workspace.onLayoutReady(() => void this.announceWasmUpdate());

    if (import.meta.env.DEV) {
      window.hmr?.(this);
    }
  }

  /**
   * Say once that there is a newer wasm build to install. The install itself stays a deliberate act — it is a 56 MB
   * download that then travels to every synced device — so this only points at the settings, and only for a version
   * it has not pointed at before.
   */
  private async announceWasmUpdate(): Promise<void> {
    const release = await this.wasm.update();
    if (!release || release.version === this.settings.wasmUpdateSeen) {
      return;
    }
    this.settings.wasmUpdateSeen = release.version;
    await this.saveSettings();
    new Notice(t.WASM_UPDATE_AVAILABLE(release.version));
  }

  /** Opens the changelog and marks this release's as read, so the settings' changelog button stops announcing it. */
  openChangelog(): void {
    new ChangelogModal(this.app).open();
    if (this.settings.dismissedChangelogVersion !== this.manifest.version) {
      this.settings.dismissedChangelogVersion = this.manifest.version;
      void this.saveSettings();
    }
  }

  public async resetSettings(): Promise<void> {
    this.settings = {
      ...clone(DEFAULT_SETTINGS),
      lastExportDirectory: this.settings.lastExportDirectory,
    };
    await this.saveSettings();
  }

  public async loadSettings(): Promise<void> {
    // `loadData` reads whatever the vault has on disk, which is `any` as far as the type system is concerned.
    const saved = (await this.loadData()) as Partial<PandocGuiSettings> | null;
    const settings: PandocGuiSettings = Object.assign({}, DEFAULT_SETTINGS, saved, restoreTemplates(saved));
    // A filter that used to come from the store and now ships with the plugin: drop the claim that the user installed
    // it, which would list it as theirs to uninstall.
    if (settings.installedLuaFilters?.some(f => BUNDLED_LUA_FILES.includes(f.fileName))) {
      settings.installedLuaFilters = settings.installedLuaFilters.filter(f => !BUNDLED_LUA_FILES.includes(f.fileName));
    }
    // The last-exported template is remembered by name; drop a name nothing answers to.
    if (settings.lastExportType && settings.items.every(o => o.name !== settings.lastExportType)) {
      delete settings.lastExportType;
    }
    this.settings = settings;
    // A vault that has never written the list needs it on disk now: without it the next release cannot tell a
    // template the user deleted from one it has just added.
    if (!saved?.seededTemplates) {
      await this.saveSettings();
    }
  }

  public async saveSettings(): Promise<void> {
    const settings = clone(this.settings);
    settings.items.forEach(v => {
      const def = DEFAULT_SETTINGS.items.find(o => o.name === v.name);
      if (def) {
        Object.keys(v).forEach((k: keyof ExportSetting) => {
          if (k !== 'name' && JSON.stringify(v[k]) === JSON.stringify(def[k])) {
            delete v[k];
          }
        });
      }
    });
    if (settings.env) {
      for (const platform of Object.keys(settings.env) as PlatformKey[]) {
        const env = settings.env[platform];
        if (JSON.stringify(env) === JSON.stringify(DEFAULT_ENV[platform])) {
          delete settings.env[platform];
          continue;
        }
        const refEnv = getPlatformValue(DEFAULT_ENV, platform);
        for (const [name, value] of Object.entries(env)) {
          if (value === refEnv[name]) {
            delete env[name];
          }
        }
        if (Object.keys(env).length === 0) {
          delete settings.env[platform];
        }
      }
    }
    await this.saveData(settings);
  }

  async releaseResources(): Promise<void> {
    const { adapter } = this.app.vault;
    for (const [dir, res] of resources) {
      const resDir = `${this.manifest.dir}/${dir}`;
      await adapter.mkdir(resDir);
      for (const [fileName, text] of res) {
        const filePath = `${resDir}/${fileName}`;
        await adapter.write(filePath, text);
      }
    }
    resources.length = 0;
  }
}
