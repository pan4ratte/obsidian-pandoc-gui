import export_templates from './templates/export_templates';
import { setPlatformValue, PlatformValue, renderTemplate, getPlatformValue, clone } from './system/utils';
import type { PropertyGridMeta } from './ui/components/PropertyGrid';
import type { InstalledLuaFilter } from './filters/lua_filters';
import type { TodayFormat } from './filters/filter_args';
import type { EngineMode } from './pandoc/engine';
import type { StyleMode } from './docx/styles';

// What a template's `${...}` are filled in with. For `/User/aaa/Documents/test.pdf`:
// `outputDir` is the folder, `outputPath` the whole path, `outputFileName` is `test`,
// `outputFileFullName` is `test.pdf`. The `current*` set says the same of the exported note.
export interface Variables extends Record<string, unknown> {
  attachmentFolderPath: string;
  pluginDir: string;
  luaDir: string;
  outputDir: string;
  outputPath: string;
  outputFileName: string;
  outputFileFullName: string;
  currentDir: string;
  currentPath: string;
  currentFileName: string;
  currentFileFullName: string;
  vaultDir: string;
  metadata?: unknown;
  embedDirs: string;
  options?: unknown;
  env?: Record<string, string>;
  /** Today's date, written out in the language Obsidian is set to. */
  today: Record<TodayFormat, string>;
}

/**
 * Today's date in each of the forms a template can ask for, in the language Obsidian is set to — which is the point
 * of writing it here rather than in a filter, where every language has to be spelled out by hand.
 */
export function today(locale: string, now = new Date()): Record<TodayFormat, string> {
  const write = (dateStyle: 'long' | 'medium' | 'short') => {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle }).format(now);
    } catch {
      // A locale the runtime does not know is not worth failing an export over.
      return new Intl.DateTimeFormat(undefined, { dateStyle }).format(now);
    }
  };
  return {
    long: write('long'),
    medium: write('medium'),
    short: write('short'),
    // Not a locale's business: the one form that means the same everywhere.
    iso: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  };
}

export interface PandocGuiSettings {
  pandocPath?: PlatformValue<string>;

  /** Which pandoc runs an export — see `src/pandoc/engine.ts`. Unset is `auto`. */
  engineMode?: EngineMode;
  /** The version of the wasm build that is installed, or nothing where none is. */
  wasmVersion?: string;
  /** The newer version already announced, so the same release is not brought up at every start. */
  wasmUpdateSeen?: string;
  /** The version of typst's build that is installed — what makes a PDF possible without a program to start. */
  typstVersion?: string;
  /** A folder in the vault whose fonts a typst export is also set in, for a script the bundled ones do not cover. */
  typstFontsDir?: string;

  showOverwriteConfirmation?: boolean;
  defaultExportDirectoryMode: 'Same' | 'Custom';
  customDefaultExportDirectory?: PlatformValue<string>;
  env: PlatformValue<Record<string, string>>;
  items: ExportSetting[];

  openExportedFile?: boolean; // open exported file after export
  openExportedFileLocation?: boolean; // open exported file location after export

  lastEditName?: string;

  lastExportDirectory?: PlatformValue<string>;
  lastExportType?: string;

  /** What the last import was written as, and the vault folder it was written into. */
  lastImportFlavour?: string;
  lastImportFolder?: string;

  /** The version whose changelog was opened, so a release is only announced once. Named after the old notice. */
  dismissedChangelogVersion?: string;

  /** How the templates table was last ordered. */
  lastTemplateSort?: { column: 'name' | 'output'; ascending: boolean };

  /**
   * Names of the default templates this vault has already been given. One missing from `items` but named here was
   * deleted and is not seeded again; one named nowhere is new in this release and is.
   */
  seededTemplates?: string[];

  /** Lua filters downloaded through the store, in `lua/` beside the bundled ones. */
  installedLuaFilters?: InstalledLuaFilter[];
  /** Base URL of the lua-filter catalogue. Unset means the default repo. */
  luaFilterRepoUrl?: string;
}

export type OptionsMeta = {
  [optionsName: string]: PropertyGridMeta[string] | `preset:${keyof typeof PRESET_OPTIONS_META}`;
};

interface CommonExportSetting {
  name: string;
  /**
   * Key in `export_templates` the format fields were taken from — what the template writes, kept as a choice rather
   * than guessed back out of the arguments.
   */
  preset?: string;

  openExportedFileLocation?: boolean; // open exported file location after export
  openExportedFile?: boolean; // open exported file after export
  optionsMeta?: OptionsMeta;
}

export interface PandocExportSetting extends CommonExportSetting {
  type: 'pandoc';
  /** The preset's own plumbing: the reader, the resource paths, `-o` and `-t`. */
  arguments: string;
  /** What the template editor's rows write. Theirs alone — nothing types here. */
  customArguments?: string;
  /** Options typed by hand, kept apart from the rows' own line. */
  userArguments?: string;
  extension: string;
  /** Word documents joined before and after a docx export, kept off the command line: pandoc would write them into it. */
  joinBefore?: string;
  joinAfter?: string;
  joinStyles?: StyleMode;
}

export interface CustomExportSetting extends CommonExportSetting {
  type: 'custom';
  command: string;
  targetFileExtensions?: string;

  showCommandOutput?: boolean; // show command output in console after export
}

export type ExportSetting = PandocExportSetting | CustomExportSetting;

export const PRESET_OPTIONS_META: PropertyGridMeta = {
  'textemplate': {
    title: 'Latex Template',
    type: 'dropdown',
    options: [
      { name: 'None', value: null },
      { name: 'Dissertation', value: 'dissertation.tex' },
      { name: 'Academic Paper', value: 'neurips.tex' },
    ],
  },
};

export const DEFAULT_ENV = (() => {
  let env: PlatformValue<Record<string, string>> = {};
  env = setPlatformValue(
    env,
    {
      'HOME': '${HOME}',
      'PATH': '${PATH}',
      'TEXINPUTS': '${pluginDir}/textemplate/:', // It is necessary to **append** to the current TEXINPUTS wtih ":" - NOT REPLACE. TEXINPUTS contains the basic latex classes.
    },
    '*' // available for all platforms.
  );

  env = setPlatformValue(
    env,
    {
      'TEXINPUTS': '${pluginDir}/textemplate/;', // Windows uses ; rather than : for appending
      'PATH': '${HOME}\\AppData\\Local\\Pandoc;${PATH}',
    },
    'win32' // available for windows only.
  );

  env = setPlatformValue(
    env,
    {
      'PATH': '/opt/homebrew/bin:/usr/local/bin:/Library/TeX/texbin:${PATH}', // Add HomebrewBin and TexBin. see: https://docs.brew.sh/Installation
    },
    'darwin' // for MacOS only.
  );

  return env;
})();

/**
 * The templates a vault starts with — the formats a note is actually exported to, rather than every format pandoc can
 * write.
 */
export const DEFAULT_TEMPLATE_PRESETS: readonly string[] = [
  'Markdown',
  'Markdown (Hugo)',
  'Html',
  'Typst',
  'PDF',
  'PDF (Typst)',
  'Word (.docx)',
  'OpenOffice',
  'Epub',
  'Latex',
  'Bibliography (.bib)',
  'PowerPoint (.pptx)',
];

// Each default is an instance of the preset it is named for, so it carries the key it came from.
const DEFAULT_ITEMS: ExportSetting[] = DEFAULT_TEMPLATE_PRESETS.filter(preset => export_templates[preset]).map(preset => ({
  ...export_templates[preset],
  preset,
}));

export const DEFAULT_SETTINGS: PandocGuiSettings = {
  items: DEFAULT_ITEMS,
  seededTemplates: DEFAULT_ITEMS.map(o => o.name),
  pandocPath: undefined,
  defaultExportDirectoryMode: 'Same',
  openExportedFile: true,
  env: DEFAULT_ENV,
};

/**
 * The templates a load starts from: the saved ones filled back out from the defaults they are stored as a diff from,
 * plus every default this vault has never been given. A default missing from the saved items but named in
 * `seededTemplates` was deleted, and deleting is final — that is what keeps it from coming back on the next start.
 */
export function restoreTemplates(saved: Partial<PandocGuiSettings> | null): Pick<PandocGuiSettings, 'items' | 'seededTemplates'> {
  const items = clone(saved?.items ?? DEFAULT_SETTINGS.items);
  items.forEach(v => {
    Object.assign(v, Object.assign({}, DEFAULT_SETTINGS.items.find(o => o.name === v.name) ?? {}, v));
  });
  // A bundled template is stored as only its diff from the default, so one no longer seeded leaves a husk with
  // nothing to run.
  const restored = items.filter(v => v.type);
  // A vault from before the list was written has been given everything this release has: only a later release's
  // additions are new to it.
  const seeded = new Set(saved?.seededTemplates ?? DEFAULT_SETTINGS.seededTemplates);
  for (const item of DEFAULT_SETTINGS.items) {
    if (!seeded.has(item.name)) {
      seeded.add(item.name);
      if (restored.every(o => o.name !== item.name)) {
        restored.push(clone(item));
      }
    }
  }
  return { items: restored, seededTemplates: [...seeded] };
}

export function extractDefaultExtension(s: ExportSetting): string {
  if (s.type === 'pandoc') {
    return s.extension;
  } else if (s.type === 'custom') {
    return s.targetFileExtensions?.split(',')[0];
  }
  return '';
}

export function createEnv(env: Record<string, string>, envVars?: Record<string, unknown>) {
  env = Object.assign({}, getPlatformValue(DEFAULT_ENV), env);
  // A phone has no process to take an environment from, and nothing that reads one — the wasm build is handed its
  // files rather than started with variables. So the defaults are rendered against whatever the caller passes alone.
  const system: Record<string, string | undefined> = typeof process === 'undefined' ? {} : process.env;
  envVars = Object.assign({ HOME: system['HOME'] ?? system['USERPROFILE'] }, system, envVars ?? {});
  return Object.fromEntries(Object.entries(env).map(([n, v]) => [n, renderTemplate(v, envVars)]));
}

export function finalizeOptionsMeta(meta?: OptionsMeta): PropertyGridMeta {
  if (meta) {
    return Object.fromEntries(
      Object.entries(meta).map(([optionsName, optionsMetaOrPresetName]) => [
        optionsName,
        typeof optionsMetaOrPresetName === 'string'
          ? PRESET_OPTIONS_META[optionsMetaOrPresetName.startsWith('preset:') ? optionsMetaOrPresetName.substring(7) : '']
          : optionsMetaOrPresetName,
      ])
    );
  }
  return {};
}
