import { Notice, Platform, PluginSettingTab, moment } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import type { SemVer } from 'semver';
import type PandocGuiPlugin from '../../main';
import { CustomExportSetting, ExportSetting, PandocExportSetting, createEnv, today, DEFAULT_ENV } from '../../settings';
import { setPlatformValue, getPlatformValue, clone } from '../../system/utils';

import { createSignal, createRoot, onCleanup, createMemo, createEffect, For, Index, Show, batch, Match, Switch, JSX } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import { insert, Dynamic } from 'solid-js/web';
import { t } from '../../lang/helpers';

import pandoc from '../../pandoc/pandoc';
import { resolveEngine } from '../../pandoc/engine';
import { bundledReferenceDoc, isReferenceFormat, referenceDocFromNative } from '../../pandoc/reference_doc';
import { chooseFile, documentsFolder, isMobileUi, showInFolder, vaultRoot } from '../../system/platform';
import { FileStore } from '../../system/file_store';
import ChangelogNotice from './ChangelogNotice';
import PandocDashboard from './PandocDashboard';
import PandocLinks from './PandocLinks';
import PandocNotices, { type PanelNotice } from './PandocNotices';
import WasmPanel from './WasmPanel';
import WasmExtensions from '../dialogs/WasmExtensions';
import TemplateActions from './TemplateActions';
import TemplateTable from './TemplateTable';
import LuaFilterStore from '../dialogs/LuaFilterStore';
import EnvVars, { addEnvFolder } from './EnvVars';
import {
  LuaFilterManager,
  addLuaFilterArg,
  hasLuaFilterArg,
  orderLuaFilters,
  removeLuaFilterArg,
  type InstalledLuaFilter,
} from '../../filters/lua_filters';
import TemplateLuaFilters from './TemplateLuaFilters';
import CheckGrid from '../components/CheckGrid';
import StepSlider from '../components/StepSlider';
import { TOC_MAX_DEPTH, TOC_NONE, setTocDepth, tocDepth } from '../../args/toc_args';
import {
  FIGURE_DEFAULT_STYLE,
  TABLE_DEFAULT_STYLE,
  TODAY_FORMATS,
  type TodayFormat,
  embedNotes,
  figureStyle,
  flattenOrdered,
  keywords,
  keywordsTitle,
  listStyles,
  setEmbedNotes,
  setFigureStyle,
  setFlattenOrdered,
  setKeywords,
  setKeywordsTitle,
  setListStyles,
  setTableHeadStyle,
  setTableStyle,
  setTodayFormat,
  tableHeadStyle,
  tableStyle,
  todayFormat,
} from '../../filters/filter_args';
import { PANDOC_EXTENSIONS, enabledExtensions, setExtensions } from '../../pandoc/pandoc_extensions';
import {
  CURATED_VARIABLES,
  EMAIL_OBFUSCATIONS,
  EOL_MODES,
  FONT_SIZES,
  HIGHLIGHT_NONE,
  HIGHLIGHT_STYLES,
  MATH_METHODS,
  PAPER_SIZES,
  PDF_ENGINES,
  REFERENCE_LOCATIONS,
  SHIFT_HEADING_LEVELS,
  SLIDE_LEVELS,
  SPLIT_LEVELS,
  TEXT_DIRECTIONS,
  TOP_LEVEL_DIVISIONS,
  WRAP_MODES,
  ascii,
  bibliography,
  citeproc,
  columns,
  commandLines,
  csl,
  css,
  dpi,
  emailObfuscation,
  embedResources,
  eol,
  epubCoverImage,
  epubEmbedFont,
  epubSubdirectory,
  epubTitlePage,
  extractMedia,
  highlightStyle,
  idPrefix,
  includeAfterBody,
  includeBeforeBody,
  includeInHeader,
  incremental,
  listOfFigures,
  listOfTables,
  markdownHeadings,
  mathMethod,
  mathUrl,
  numberOffset,
  numberSections,
  pairsFromText,
  pdfEngine,
  referenceDoc,
  referenceLinks,
  referenceLocation,
  sectionDivs,
  setAscii,
  setBibliography,
  setCiteproc,
  setColumns,
  setCsl,
  setCss,
  setDpi,
  setEmailObfuscation,
  setEmbedResources,
  setEol,
  setEpubCoverImage,
  setEpubEmbedFont,
  setEpubSubdirectory,
  setEpubTitlePage,
  setExtractMedia,
  setHighlightStyle,
  setIdPrefix,
  setIncludeAfterBody,
  setIncludeBeforeBody,
  setIncludeInHeader,
  setIncremental,
  setListOfFigures,
  setListOfTables,
  setMarkdownHeadings,
  setMathMethod,
  setMathUrl,
  setNumberOffset,
  setNumberSections,
  setPdfEngine,
  setReferenceDoc,
  setReferenceLinks,
  setReferenceLocation,
  setSectionDivs,
  setShiftHeadingLevelBy,
  setSlideLevel,
  setSplitLevel,
  setStripComments,
  setSyntaxDefinition,
  setTabStop,
  setTemplateFile,
  setTextDirection,
  setTopLevelDivision,
  setVariable,
  setVariables,
  setWrap,
  shiftHeadingLevelBy,
  slideLevel,
  splitLevel,
  stripComments,
  syntaxDefinition,
  tabStop,
  takesMathUrl,
  templateFile,
  textDirection,
  textFromPairs,
  topLevelDivision,
  variable,
  variables,
  wrap,
  type CuratedVariable,
} from '../../args/writer_args';
import {
  isEpubOutput,
  isPdfOutput,
  isSlideOutput,
  outputFormat,
  supportsAscii,
  supportsCss,
  supportsDpi,
  supportsEmbedResources,
  supportsEol,
  supportsHeaderInclude,
  supportsHighlighting,
  supportsHtmlOptions,
  supportsIncludes,
  supportsMarkdownHeadings,
  supportsMathMethod,
  supportsNumberOffset,
  supportsNumberSections,
  supportsCustomStyle,
  supportsReferenceDoc,
  supportsReferenceLinks,
  supportsReferenceLocation,
  supportsSectionLists,
  supportsSplitLevel,
  supportsTemplate,
  templateExtension,
  supportsTextDirection,
  supportsToc,
  supportsTopLevelDivision,
  supportsVariable,
  supportsWrap,
} from '../../pandoc/pandoc_format';
import { MessageBox, confirm } from '../message_box';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Icon from '../components/Icon';
import Collapsible from '../components/Collapsible';
import Section from '../components/Section';
import Setting, { Text, Toggle, ExtraButton, DropDown, TextArea } from '../components/Setting';
import FileInput from '../components/FileInput';
import FolderInput from '../components/FolderInput';
import export_templates from '../../templates/export_templates';
import { BUNDLED_LUA_FILES } from '../../resources';

// Whether the template editor's panels stand open. Module scope, so a modal rebuilt on
// every open reopens where it was; not written to `data.json` — a scroll position is not a setting.
const [advancedOpen, setAdvancedOpen] = createSignal(false);
const [commandOpen, setCommandOpen] = createSignal(false);

// What the file dialogs offer. Each ends in everything: a path a template names is as
// often a file under a name of the user's own.
const ANY_FILE = { name: 'All files', extensions: ['*'] };
const BIBLIOGRAPHY_FILES = [{ name: 'Bibliography', extensions: ['bib', 'bibtex', 'json', 'yaml', 'yml', 'ris', 'enl', 'xml'] }, ANY_FILE];
const CSL_FILES = [{ name: 'Citation style', extensions: ['csl'] }, ANY_FILE];
const CSS_FILES = [{ name: 'Stylesheet', extensions: ['css'] }, ANY_FILE];
const SYNTAX_FILES = [{ name: 'Syntax definition', extensions: ['xml'] }, ANY_FILE];
const IMAGE_FILES = [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }, ANY_FILE];
const FONT_FILES = [{ name: 'Font', extensions: ['otf', 'ttf', 'woff', 'woff2'] }, ANY_FILE];

/** The curated variables with an answer short enough to pick from a list; the rest are typed. */
const VARIABLE_CHOICES: Partial<Record<CuratedVariable, readonly string[]>> = {
  papersize: PAPER_SIZES,
  fontsize: FONT_SIZES,
};

const SettingTab = (props: { plugin: PandocGuiPlugin }) => {
  const { plugin } = props;
  // The app the plugin was handed, not the one on `window` — see the plugin guidelines.
  const { app } = plugin;
  const [settings, setSettings0] = createStore(plugin.settings);
  const [pandocVersion, setPandocVersion] = createSignal<SemVer>();
  // Read far more often than written, so the rows stay out of the way until asked for.
  const [editingEnvVars, setEditingEnvVars] = createSignal(false);
  // The pickers answer for the folders a variable lists, which is all three of the defaults are. The text is the way
  // in to what they cannot say: a variable of one's own, or a value that is not a path at all.
  const [envVarsAsText, setEnvVarsAsText] = createSignal(false);
  const envVars = createMemo(() => Object.assign({}, getPlatformValue(DEFAULT_ENV), getPlatformValue(settings.env) ?? {}));
  const envVarsText = createMemo(() =>
    Object.entries(envVars())
      .map(([n, v]) => `${n}="${v}"`)
      .join('\n')
  );
  const setSettings: typeof setSettings0 = (...args: unknown[]) => {
    (setSettings0 as (...args: unknown[]) => void)(...args);
    void plugin.saveSettings();
  };
  const setEnvVars = (env: Record<string, string>) => setSettings('env', setPlatformValue(settings.env ?? {}, env));
  const setEnvVarsText = (envItems: string) => {
    try {
      const env: Record<string, string> = {};
      for (let line of envItems.split('\n')) {
        line = line.trim();
        const sepIdx = line.indexOf('=');
        if (sepIdx > 0) {
          const name = line.substring(0, sepIdx);
          let value = line.substring(sepIdx + 1).trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          }
          env[name] = value;
        }
      }
      setEnvVars(env);
    } catch (e) {
      new Notice(String(e));
    }
  };

  const currentCommandTemplate = createMemo(() => settings.items.find(v => v.name === settings.lastEditName) ?? settings.items.first());
  const currentEditCommandTemplate = <T extends 'custom' | 'pandoc'>(type?: T) => {
    const template = currentCommandTemplate();
    return (type === undefined || type === template?.type ? template : undefined) as T extends 'custom'
      ? CustomExportSetting
      : T extends 'pandoc'
        ? PandocExportSetting
        : ExportSetting;
  };
  const customDefaultExportDirectory = createMemo(() => getPlatformValue(settings.customDefaultExportDirectory));

  const updateCurrentEditCommandTemplate = (update: (prev: Partial<ExportSetting>) => void) => {
    const idx = settings.items.findIndex(v => v.name === settings.lastEditName);
    setSettings(
      'items',
      idx === -1 ? 0 : idx,
      produce(item => {
        update(item);
        return item;
      })
    );
  };

  // Two settings remember a template by name — the editor's row and the last export type.
  // Both follow a rename and are let go of on delete, so neither points at nothing.
  const followTemplateRename = (previous: string | undefined, name: string) => {
    setSettings('lastEditName', name);
    if (settings.lastExportType === previous) {
      setSettings('lastExportType', name);
    }
  };

  const forgetTemplate = (name: string) => {
    if (settings.lastEditName === name) {
      setSettings('lastEditName', settings.items.first()?.name);
    }
    if (settings.lastExportType === name) {
      setSettings('lastExportType', undefined);
    }
  };

  /** `name`, or the first `name 2`, `name 3`… no other template answers to. */
  const uniqueTemplateName = (name: string, except?: string) => {
    const taken = new Set(settings.items.filter(v => v.name !== except).map(v => v.name));
    if (!taken.has(name)) {
      return name;
    }
    let n = 2;
    while (taken.has(`${name} ${n}`)) {
      n++;
    }
    return `${name} ${n}`;
  };

  /** Whether the plugin gave the template this name, rather than the user typing it. */
  const isGeneratedName = (name: string, preset: string) =>
    name === preset || (name.startsWith(`${preset} `) && /^\d+$/.test(name.substring(preset.length + 1)));

  const outputOptions = Object.keys(export_templates)
    .map(k => ({ name: k, value: k }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const [modal, setModal] = createSignal<() => JSX.Element>();

  /** Which preset the template being edited writes with. */
  const currentOutput = createMemo(() => currentEditCommandTemplate()?.preset);

  const setCurrentOutput = (key: string) => {
    const preset = export_templates[key];
    const template = currentEditCommandTemplate();
    if (!preset || !template || currentOutput() === key) {
      return;
    }
    // The format's decisions come from the preset; the user's — name, post-export actions,
    // hand-typed options — are carried across. Row-written arguments belong to the old format.
    const previous = currentOutput();
    const name = previous && isGeneratedName(template.name, previous) ? uniqueTemplateName(preset.name, template.name) : template.name;
    const carried = template.type === 'pandoc' && preset.type === 'pandoc' ? { userArguments: template.userArguments } : {};
    const idx = settings.items.findIndex(v => v.name === template.name);
    batch(() => {
      setSettings('items', idx === -1 ? 0 : idx, {
        ...clone(preset),
        ...carried,
        openExportedFile: template.openExportedFile,
        openExportedFileLocation: template.openExportedFileLocation,
        preset: key,
        name,
      });
      followTemplateRename(template.name, name);
    });
  };

  const addCommandTemplate = () => {
    const key = Object.keys(export_templates)[0];
    const template = clone(export_templates[key]);
    template.preset = key;
    template.name = uniqueTemplateName(template.name);
    batch(() => {
      setSettings('items', items => [...items, template]);
      setSettings('lastEditName', template.name);
    });
    setModal(() => EditCommandTemplateModal);
  };

  const renameCurrentCommandTemplate = (value: string) => {
    const previous = currentEditCommandTemplate().name;
    const name = uniqueTemplateName(value.trim() || previous, previous);
    if (name === previous) {
      return;
    }
    // Both at once: the item is found again by the name the settings remember.
    batch(() => {
      updateCurrentEditCommandTemplate(v => (v.name = name));
      followTemplateRename(previous, name);
    });
  };

  /** The whole of one template. Every field writes straight through, so there is nothing to save. */
  const EditCommandTemplateModal = () => (
    <>
      <Modal app={app} title={t.TEMPLATE_EDITOR_TITLE} classList={{ 'ex-template-modal': true }} onClose={() => setModal(undefined)}>
        {/* Name and output format share a row: they are one answer. */}
        <Setting name={t.TEMPLATE_NAME} class="ex-template-modal-name">
          <Text value={currentEditCommandTemplate()?.name ?? ''} onChange={renameCurrentCommandTemplate} />
          <DropDown
            options={outputOptions}
            selected={currentOutput()}
            tooltip={t.TEMPLATE_OUTPUT}
            autofocus={false}
            onChange={setCurrentOutput}
          />
        </Setting>

        <Switch>
          <Match when={currentEditCommandTemplate('pandoc')}>
            <PandocCommandTempateEditBlock />
          </Match>
          <Match when={currentEditCommandTemplate('custom')}>
            <CustomCommandTempateEditBlock />
          </Match>
        </Switch>

        {/* Nothing left to save — but the button is the way out, and a form this long expects one. */}
        <div class="modal-button-container">
          <Button cta={true} onClick={() => setModal(undefined)}>
            {t.ACTION_SAVE}
          </Button>
        </div>
      </Modal>
    </>
  );

  const editCommandTemplate = (name: string) => {
    setSettings('lastEditName', name);
    setModal(() => EditCommandTemplateModal);
  };

  /** The template again under a name of its own. It lands in the table; nothing is opened. */
  const duplicateCommandTemplate = (name: string) => {
    const template = settings.items.find(v => v.name === name);
    if (!template) {
      return;
    }
    const copy = clone(template);
    copy.name = uniqueTemplateName(name);
    setSettings('items', items => [...items, copy]);
  };

  const removeCommandTemplate = (name: string) => {
    new MessageBox(app, {
      title: t.ACTION_REMOVE,
      message: t.TEMPLATE_REMOVE_CONFIRM(name),
      buttons: 'OkCancel',
      buttonsLabel: { ok: t.ACTION_REMOVE },
      destructive: true,
      callback: {
        ok: () =>
          batch(() => {
            setSettings('items', items => items.filter(v => v.name !== name));
            forgetTemplate(name);
          }),
      },
    }).open();
  };

  // The manager owns the files in `lua/`; what is installed is settings, written here and
  // handed back to the store as a prop, so store, table and `data.json` agree.
  const luaFilters = new LuaFilterManager(plugin, BUNDLED_LUA_FILES);

  const setInstalledLuaFilters = (update: (prev: InstalledLuaFilter[]) => InstalledLuaFilter[]) => {
    setSettings('installedLuaFilters', update(settings.installedLuaFilters ?? []));
  };

  /** Add or replace a filter's record — an update reinstalls under the same id. */
  const recordLuaFilter = (filter: InstalledLuaFilter) => setInstalledLuaFilters(prev => [...prev.filter(f => f.id !== filter.id), filter]);

  /** Run a filter in a template, or stop. The flag goes in the extra arguments: the
      preset's own are rewritten whole on every format change, which would take it with them. */
  const updateTemplateArguments = (templateName: string, update: (args?: string) => string) => {
    const idx = settings.items.findIndex(v => v.name === templateName);
    if (idx === -1) {
      return;
    }
    setSettings(
      'items',
      idx,
      produce(item => {
        if (item.type === 'pandoc') {
          item.customArguments = update(item.customArguments);
        }
      })
    );
  };

  /** Which filter the template being edited is having switched on or off. */
  const setLuaFilterOnCurrentTemplate = (fileName: string, running: boolean) => {
    const template = currentEditCommandTemplate('pandoc');
    if (!template) {
      return;
    }
    updateTemplateArguments(template.name, args => (running ? addLuaFilterArg(args, fileName) : removeLuaFilterArg(args, fileName)));
  };

  /** Forget an uninstalled filter and stop every template running it — the file is gone. */
  const forgetLuaFilter = (filter: InstalledLuaFilter) => {
    batch(() => {
      for (const template of settings.items) {
        if (template.type === 'pandoc' && hasLuaFilterArg(template.customArguments, filter.fileName)) {
          updateTemplateArguments(template.name, args => removeLuaFilterArg(args, filter.fileName));
        }
      }
      setInstalledLuaFilters(prev => prev.filter(f => f.id !== filter.id));
    });
  };

  const WasmExtensionsModal = () => (
    <WasmExtensions
      app={app}
      manager={plugin.typst}
      extensions={plugin.extensions}
      version={settings.typstVersion}
      fontsDir={settings.typstFontsDir}
      onInstalled={version => setSettings('typstVersion', version)}
      onFontsDir={folder => setSettings('typstFontsDir', folder)}
      onClose={() => setModal(undefined)}
    />
  );

  const LuaFilterStoreModal = () => (
    <LuaFilterStore
      app={app}
      manager={luaFilters}
      installed={settings.installedLuaFilters ?? []}
      onInstalled={recordLuaFilter}
      onUninstalled={forgetLuaFilter}
      onClose={() => setModal(undefined)}
    />
  );

  // Both blocks read through `?.`: the output dropdown can swap a pandoc template for a
  // custom one, so a block briefly outlives its own type.
  const PandocCommandTempateEditBlock = () => {
    const template = () => currentEditCommandTemplate('pandoc');
    const updateTemplate = (update: (prev: Partial<PandocExportSetting>) => void) => {
      updateCurrentEditCommandTemplate(prev => (prev.type === 'pandoc' ? update(prev) : undefined));
    };
    /** What this template writes, read from the arguments in pandoc's own order, so a
        hand-edited `-t` is what the rows below answer to. */
    const format = createMemo(() => outputFormat(template()?.arguments, template()?.customArguments, template()?.userArguments));

    /** None, then one heading level at a time. Depth is a single number, hence a slider. */
    const tocLabels = [t.TOC_NONE, ...Array.from({ length: TOC_MAX_DEPTH }, (_, i) => String(i + 1))];

    /** The reader extensions, ticked where the arguments switch them on. */
    const extensions = createMemo(() => {
      const on = enabledExtensions(template()?.customArguments);
      return PANDOC_EXTENSIONS.map(id => ({
        value: id,
        label: t.EXTENSION_LABELS[id],
        // What the flag carries, as the filters' boxes do.
        tooltip: id,
        checked: on.includes(id),
      }));
    });

    const toggleExtension = (id: string, on: boolean) =>
      updateTemplate(v => {
        const current = enabledExtensions(v.customArguments).filter(e => e !== id);
        v.customArguments = setExtensions(v.customArguments, on ? [...current, id] : current);
      });

    /** The extra arguments, which every writer option below is read back out of. */
    const args = () => template()?.customArguments;

    /** Setting one is always the same move: that field, rewritten. */
    const writeArgs = (write: (args?: string) => string) => updateTemplate(v => (v.customArguments = write(v.customArguments)));

    /** Three flags with nothing to say for themselves, so they share a card. */
    const numbering = createMemo(() => {
      const items: { value: string; label: string; tooltip: string; checked: boolean }[] = [];
      if (supportsNumberSections(format())) {
        items.push({
          value: 'sections',
          label: t.NUMBER_SECTIONS,
          tooltip: '--number-sections',
          checked: numberSections(args()),
        });
      }
      if (supportsSectionLists(format())) {
        items.push({ value: 'figures', label: t.LIST_OF_FIGURES, tooltip: '--list-of-figures', checked: listOfFigures(args()) });
        items.push({ value: 'tables', label: t.LIST_OF_TABLES, tooltip: '--list-of-tables', checked: listOfTables(args()) });
      }
      return items;
    });

    const toggleNumbering = (value: string, on: boolean) =>
      writeArgs(a =>
        value === 'sections' ? setNumberSections(a, on) : value === 'figures' ? setListOfFigures(a, on) : setListOfTables(a, on)
      );

    /** Pandoc's own answer first (no flag), then the ones it names. A hand-written value
        already in the arguments is added rather than dropped by a picker that cannot show it. */
    const withCurrent = (options: { name: string; value: string }[], current?: string) =>
      current && !options.some(o => o.value === current) ? [...options, { name: current, value: current }] : options;

    const divisionOptions = [
      { name: t.DIVISION_LABELS.default, value: '' },
      ...TOP_LEVEL_DIVISIONS.map(d => ({ name: t.DIVISION_LABELS[d], value: d })),
    ];

    const highlightOptions = createMemo(() =>
      withCurrent(
        [
          { name: t.HIGHLIGHT_DEFAULT, value: '' },
          { name: t.HIGHLIGHT_NONE, value: HIGHLIGHT_NONE },
          ...HIGHLIGHT_STYLES.map(s => ({ name: t.HIGHLIGHT_STYLE_LABELS[s], value: s })),
        ],
        highlightStyle(args())
      )
    );

    const mathOptions = [{ name: t.MATH_DEFAULT, value: '' }, ...MATH_METHODS.map(m => ({ name: t.MATH_METHOD_LABELS[m], value: m }))];

    const directionOptions = [
      { name: t.TEXT_DIRECTION_DEFAULT, value: '' },
      ...TEXT_DIRECTIONS.map(d => ({ name: t.TEXT_DIRECTION_LABELS[d], value: d })),
    ];

    const engineOptions = createMemo(() =>
      withCurrent([{ name: t.PDF_ENGINE_DEFAULT, value: '' }, ...PDF_ENGINES.map(e => ({ name: e, value: e }))], pdfEngine(args()))
    );

    /** The curated variables this writer was measured to read, and no others. */
    const curatedVariables = createMemo(() => CURATED_VARIABLES.filter(name => supportsVariable[name](format())));

    const variableOptions = (name: CuratedVariable) =>
      withCurrent(
        [{ name: t.VARIABLE_DEFAULT, value: '' }, ...(VARIABLE_CHOICES[name] ?? []).map(value => ({ name: value, value }))],
        variable(args(), name)
      );

    /** Everything the rows above do not ask for, one `key=value` a line. A variable with a
        row of its own is left out here, and put back when the format loses that row. */
    const otherVariables = createMemo(() =>
      textFromPairs(variables(args()).filter(v => !curatedVariables().includes(v.key as CuratedVariable)))
    );

    // The format-specific pickers, pandoc's own answer first; `withCurrent` keeps a
    // hand-written value none of them names, such as `--wrap=auto`.
    const wrapOptions = createMemo(() =>
      withCurrent(
        [{ name: t.WRAP_DEFAULT, value: '' }, ...WRAP_MODES.map(mode => ({ name: t.WRAP_MODE_LABELS[mode], value: mode }))],
        wrap(args())
      )
    );

    // ATX is pandoc's own answer, written as no option at all.
    const headingStyleOptions = createMemo(() =>
      withCurrent(
        [
          { name: t.MARKDOWN_HEADINGS_DEFAULT, value: '' },
          { name: t.MARKDOWN_HEADINGS_SETEXT, value: 'setext' },
        ],
        markdownHeadings(args())
      )
    );

    const referenceLocationOptions = createMemo(() =>
      withCurrent(
        [
          { name: t.REFERENCE_LOCATION_DEFAULT, value: '' },
          ...REFERENCE_LOCATIONS.filter(where => where !== 'block').map(where => ({
            name: t.REFERENCE_LOCATION_LABELS[where],
            value: where,
          })),
        ],
        referenceLocation(args())
      )
    );

    // Pandoc works the slide level out from the document unless told; `0` is its own answer.
    const slideLevelOptions = createMemo(() =>
      withCurrent(
        [
          { name: t.SLIDE_LEVEL_DEFAULT, value: '' },
          ...SLIDE_LEVELS.map(level => ({
            name: level === '0' ? t.SLIDE_LEVEL_NONE : t.TOC_LEVEL(Number(level)),
            value: level,
          })),
        ],
        slideLevel(args())
      )
    );

    const splitLevelOptions = createMemo(() =>
      withCurrent(
        [{ name: t.SPLIT_LEVEL_DEFAULT, value: '' }, ...SPLIT_LEVELS.map(level => ({ name: t.TOC_LEVEL(Number(level)), value: level }))],
        splitLevel(args())
      )
    );

    // Named by what they do, not the number they write: `-1` is a promotion.
    const shiftHeadingOptions = createMemo(() =>
      withCurrent(
        [
          { name: t.SHIFT_HEADINGS_NONE, value: '' },
          ...SHIFT_HEADING_LEVELS.map(shift => ({
            name: shift < 0 ? t.SHIFT_HEADINGS_UP(-shift) : t.SHIFT_HEADINGS_DOWN(shift),
            value: String(shift),
          })),
        ],
        shiftHeadingLevelBy(args())
      )
    );

    // Each form is shown as today's date written in it — clearer than the format's name.
    const todayOptions = createMemo(() => {
      const written = today(moment.locale());
      return [{ name: t.TODAY_NONE, value: '' }, ...TODAY_FORMATS.map(format => ({ name: written[format], value: format }))];
    });

    const eolOptions = createMemo(() =>
      withCurrent(
        [{ name: t.LINE_ENDINGS_DEFAULT, value: '' }, ...EOL_MODES.map(mode => ({ name: t.LINE_ENDING_LABELS[mode], value: mode }))],
        eol(args())
      )
    );

    const obfuscationOptions = createMemo(() =>
      withCurrent(
        [
          { name: t.EMAIL_OBFUSCATION_DEFAULT, value: '' },
          ...EMAIL_OBFUSCATIONS.map(method => ({ name: t.EMAIL_OBFUSCATION_LABELS[method], value: method })),
        ],
        emailObfuscation(args())
      )
    );

    /** The document a docx, odt or pptx export takes its styles from. */
    const referenceDocFiles = createMemo(() => [
      { name: t.REFERENCE_DOC, extensions: [format() === 'pptx' ? 'pptx' : format() === 'odt' ? 'odt' : 'docx'] },
      ANY_FILE,
    ]);

    /**
     * The list styles come and go with the document that defines them. They hand the bullets over to List Bullet, and
     * pandoc's own reference document carries that style without any numbering in it — switched on with no document
     * of the user's to take the numbering from, a bullet list comes out with no bullets at all. So the row follows
     * the one answer that decides whether it can work, and only as the document arrives or goes: turned off by hand
     * with a document set, it stays off.
     */
    const setReferenceDocument = (value: string) => {
      const file = value.trim();
      const had = !!referenceDoc(args());
      writeArgs(a => {
        const next = setReferenceDoc(a, file);
        return format() === 'docx' && !!file !== had ? setListStyles(next, !!file) : next;
      });
    };

    const [makingReference, setMakingReference] = createSignal(false);

    /**
     * Where a generated reference document goes, and how the template names it.
     *
     * On a computer it goes where exports go, which is where someone would look for a document the plugin made them.
     * A phone has no such folder outside the vault, so there it goes into the plugin's own — named with `${pluginDir}`,
     * which travels with the vault. The name is not one of the three the extensions store owns, so removing those
     * leaves an edited document alone.
     */
    const referenceDocPath = (writer: string): { path: string; named: string } => {
      const name = `custom-reference.${writer}`;
      const vaultDir = vaultRoot(app.vault.adapter);
      if (isMobileUi()) {
        const path = `${vaultDir}/${plugin.manifest.dir.replaceAll('\\', '/')}/reference/${name}`;
        return { path, named: `\${pluginDir}/reference/${name}` };
      }
      // `Same` is the note's own folder, and there is no note here — the last export's folder is the nearest thing.
      const custom = settings.defaultExportDirectoryMode === 'Custom' ? getPlatformValue(settings.customDefaultExportDirectory) : undefined;
      const path = `${custom ?? getPlatformValue(settings.lastExportDirectory) ?? vaultDir}/${name}`;
      return { path, named: path };
    };

    /**
     * Ask whichever pandoc this vault exports with for its own reference document, and point the template at it.
     *
     * Both engines write it the same way — see `src/pandoc/reference_doc.ts` — so the file is the same one wherever
     * the template is edited, and the styles someone changes in it are the styles they will see on either.
     */
    const generateReferenceDoc = async (): Promise<void> => {
      const writer = format();
      // A button of this size has nothing to show for being busy, so a second press is turned away rather than drawn
      // against: two runs at once would race each other to the same file.
      if (!isReferenceFormat(writer) || makingReference()) {
        return;
      }
      const { path, named } = referenceDocPath(writer);
      // The folder can be outside the vault, which only this reaches.
      const files = new FileStore(app.vault, vaultRoot(app.vault.adapter));

      // Written over rather than added to, so the one thing worth asking is whether anything is being lost.
      if (
        (await files.exists(path)) &&
        !(await confirm(app, {
          title: t.REFERENCE_DOC_GENERATE(`.${writer}`),
          message: t.REFERENCE_DOC_OVERWRITE(named),
          accept: t.ACTION_GENERATE,
          destructive: true,
        }))
      ) {
        return;
      }

      setMakingReference(true);
      try {
        // The installed pandoc's own, where there is one: the bundle carries whatever release it was built against,
        // and an export on this machine is styled by the pandoc on it.
        const bytes =
          engine() === 'native'
            ? await referenceDocFromNative(writer, {
                path: getPlatformValue(settings.pandocPath),
                env: createEnv(getPlatformValue(settings.env) ?? {}, {
                  pluginDir: `${vaultRoot(app.vault.adapter)}/${plugin.manifest.dir}`,
                }),
              })
            : bundledReferenceDoc(writer);

        await files.write(path, bytes);
        setReferenceDocument(named);
        new Notice(t.REFERENCE_DOC_MADE(named));
        // Shown rather than opened: launching a word processor is not what the button was pressed for.
        await showInFolder(path);
      } catch (e) {
        console.error(e);
        new Notice(t.REFERENCE_DOC_FAILED(e instanceof Error ? e.message : String(e)));
      } finally {
        setMakingReference(false);
      }
    };

    /** The line pandoc is given, assembled as `exportNote` assembles it. The `${...}` are
        left standing: they are filled in at export from a note that does not exist yet. */
    const resultingCommand = createMemo(() =>
      // Assembled as `exportNote` assembles it, filters put in their running order and all.
      orderLuaFilters(
        [
          pandoc.normalizePath(getPlatformValue(settings.pandocPath)),
          '"${currentPath}"',
          template()?.arguments,
          template()?.customArguments,
          template()?.userArguments,
        ]
          .map(part => part?.trim())
          .filter(part => part)
          .join(' ')
      )
    );

    /** The same command, one option a line — for reading only; the single line gets copied. */
    const commandForReading = createMemo(() => commandLines(resultingCommand()).join('\n'));

    const copyCommand = async () => {
      try {
        await navigator.clipboard.writeText(resultingCommand());
        new Notice(t.COMMAND_COPIED, 1500);
      } catch (e) {
        console.error(e);
        new Notice(t.COMMAND_COPY_FAILED);
      }
    };

    // The rows a template is usually opened for come first; the rest folds into one panel.
    return (
      <>
        {/* A word processor is laid out by a reference document, everything else by a
            template — the same question two ways, so exactly one row stands here. */}
        <Show when={supportsReferenceDoc(format())}>
          {/* Naming a document and making one share a card: the second is where the first comes from. */}
          <div class="ex-card ex-template-modal-reference">
            <Setting name={t.REFERENCE_DOC} description={t.REFERENCE_DOC_DESC} class="ex-template-modal-reference-doc">
              <FileInput
                value={referenceDoc(args())}
                filters={referenceDocFiles()}
                tooltip={t.CHOOSE_FILE}
                onChange={setReferenceDocument}
              />
            </Setting>

            {/* Nobody has a reference document until pandoc has written one, and only pandoc can. The row is the
                environment variables' row: a question, and the one small button that answers it. */}
            <Setting name={t.REFERENCE_DOC_GENERATE(`.${format()}`)} class="ex-template-modal-generate-reference-doc ex-inline-setting">
              <ExtraButton
                icon="file-plus-2"
                tooltip={makingReference() ? t.REFERENCE_DOC_GENERATING : t.ACTION_GENERATE}
                onClick={() => void generateReferenceDoc()}
              />
            </Setting>
          </div>
        </Show>

        <Show when={supportsTemplate(format())}>
          {/* Named without one, a template is looked for under the extension the writer expects — so the row says which. */}
          <Setting
            name={t.OUTPUT_TEMPLATE}
            description={t.OUTPUT_TEMPLATE_DESC(templateExtension(format(), pdfEngine(args())))}
            class="ex-template-modal-output-template"
          >
            <FileInput
              value={templateFile(args())}
              filters={[ANY_FILE]}
              tooltip={t.CHOOSE_FILE}
              onChange={value => writeArgs(a => setTemplateFile(a, value.trim()))}
            />
          </Setting>
        </Show>

        {/* Only for the writers that would do something with it. */}
        <Show when={supportsToc(format())}>
          <Setting name={t.TOC} description={t.TOC_DESC} class="ex-template-modal-toc">
            <StepSlider
              labels={tocLabels}
              min={TOC_NONE}
              value={tocDepth(template()?.customArguments)}
              // The step is the depth; `setTocDepth` removes the flags at `TOC_NONE`.
              onChange={depth => updateTemplate(v => (v.customArguments = setTocDepth(v.customArguments, depth)))}
            />
          </Setting>
        </Show>

        {/* Adding a filter appends its `--lua-filter` flag to the extra arguments. */}
        <Setting name={t.LUA_FILTERS} class="ex-template-modal-filters">
          <TemplateLuaFilters
            installed={settings.installedLuaFilters ?? []}
            format={format()}
            args={template()?.customArguments}
            onAdd={fileName => setLuaFilterOnCurrentTemplate(fileName, true)}
            onRemove={fileName => setLuaFilterOnCurrentTemplate(fileName, false)}
          />
        </Setting>

        {/* Every style named here has to exist in that document. Each row runs a bundled
            filter — pandoc has no option for any of this. */}
        <Show when={supportsCustomStyle(format())}>
          <div class="ex-card ex-template-modal-word-styles">
            <Setting name={t.WORD_STYLES} description={t.WORD_STYLES_DESC} heading={true} />
            <Setting name={t.FIGURE_STYLE} description={t.FIGURE_STYLE_DESC} class="mod-toggle">
              <Toggle
                checked={figureStyle(args()) !== undefined}
                onChange={on => writeArgs(a => setFigureStyle(a, on ? FIGURE_DEFAULT_STYLE : undefined))}
              />
            </Setting>
            <Show when={figureStyle(args()) !== undefined}>
              <Setting name={t.FIGURE_STYLE_NAME} description={t.STYLE_NAME_DESC}>
                <Text
                  value={figureStyle(args()) ?? FIGURE_DEFAULT_STYLE}
                  placeholder={FIGURE_DEFAULT_STYLE}
                  // Emptied falls back to the filter's default; the row above switches it off.
                  onChange={value => writeArgs(a => setFigureStyle(a, value.trim() || FIGURE_DEFAULT_STYLE))}
                />
              </Setting>
            </Show>

            <Setting name={t.TABLE_STYLE} description={t.TABLE_STYLE_DESC} class="mod-toggle">
              <Toggle
                checked={tableStyle(args()) !== undefined}
                onChange={on => writeArgs(a => setTableStyle(a, on ? TABLE_DEFAULT_STYLE : undefined))}
              />
            </Setting>
            <Show when={tableStyle(args()) !== undefined}>
              <Setting name={t.TABLE_STYLE_NAME} description={t.STYLE_NAME_DESC}>
                <Text
                  value={tableStyle(args()) ?? TABLE_DEFAULT_STYLE}
                  placeholder={TABLE_DEFAULT_STYLE}
                  onChange={value => writeArgs(a => setTableStyle(a, value.trim() || TABLE_DEFAULT_STYLE))}
                />
              </Setting>
              {/* Empty is the filter's own behaviour: header cells match the rest. */}
              <Setting name={t.TABLE_HEAD_STYLE_NAME} description={t.TABLE_HEAD_STYLE_DESC}>
                <Text
                  value={tableHeadStyle(args()) ?? ''}
                  placeholder={t.TABLE_HEAD_STYLE_PLACEHOLDER}
                  onChange={value => writeArgs(a => setTableHeadStyle(a, value))}
                />
              </Setting>
            </Show>

            {/* Word's List Bullet and List Number, which pandoc's numbering paints over.
                docx only — the odt writer has no such thing. */}
            <Show when={format() === 'docx'}>
              <Setting name={t.LIST_STYLES} description={t.LIST_STYLES_DESC} class="mod-toggle">
                <Toggle checked={listStyles(args())} onChange={on => writeArgs(a => setListStyles(a, on))} />
              </Setting>
              <Show when={listStyles(args())}>
                <Setting name={t.FLATTEN_ORDERED} description={t.FLATTEN_ORDERED_DESC} class="mod-toggle">
                  <Toggle checked={flattenOrdered(args())} onChange={on => writeArgs(a => setFlattenOrdered(a, on))} />
                </Setting>
              </Show>
            </Show>
          </div>
        </Show>

        {/* Ticking a box writes the extension into `-f`. Every one offered is a
            pandoc default-off, so a cleared box is the reader's own behaviour. */}
        <Setting name={t.EXTENSIONS} description={t.EXTENSIONS_DESC} class="ex-template-modal-extensions">
          {/* One to a line where the width is a phone's: an extension is named the way pandoc names it, and two
              columns of that is two columns of cut-off names. */}
          <CheckGrid items={extensions()} onToggle={toggleExtension} single={isMobileUi()} />
        </Setting>

        {/* Not gated on the format: citations and variables are asked of every writer. */}
        <Section name={t.SECTION_ADVANCED} class="ex-template-modal-advanced" open={advancedOpen()} onToggle={setAdvancedOpen}>
          <Show when={numbering().length > 0}>
            <Setting name={t.NUMBERING} description={t.NUMBERING_DESC} class="ex-template-modal-numbering">
              <CheckGrid items={numbering()} onToggle={toggleNumbering} />
            </Setting>
          </Show>

          {/* Only once there is numbering to offset, and only where pandoc reaches. */}
          <Collapsible when={supportsNumberOffset(format()) && numberSections(args())} class="ex-template-modal-offset-panel">
            <Setting name={t.NUMBER_OFFSET} description={t.NUMBER_OFFSET_DESC} class="ex-template-modal-number-offset">
              <Text value={numberOffset(args()) ?? ''} placeholder="0" onChange={value => writeArgs(a => setNumberOffset(a, value))} />
            </Setting>
          </Collapsible>

          {/* Done to the note on the way in, before any writer sees it — so no format gate. */}
          <div class="ex-card ex-template-modal-reading">
            <Setting name={t.READING} description={t.READING_DESC} heading={true} />

            {/* Demoting makes room for a title; promoting turns a lone top heading into one. */}
            <Setting name={t.SHIFT_HEADINGS} description={t.SHIFT_HEADINGS_DESC} class="ex-template-modal-shift">
              <DropDown
                options={shiftHeadingOptions()}
                selected={shiftHeadingLevelBy(args()) ?? ''}
                autofocus={false}
                onChange={value => writeArgs(a => setShiftHeadingLevelBy(a, value))}
              />
            </Setting>

            <Setting name={t.TAB_STOP} description={t.TAB_STOP_DESC} class="ex-template-modal-tab-stop">
              <Text value={tabStop(args()) ?? ''} placeholder="4" onChange={value => writeArgs(a => setTabStop(a, value))} />
            </Setting>

            <Setting name={t.STRIP_COMMENTS} description={t.STRIP_COMMENTS_DESC} class="ex-template-modal-strip-comments">
              <Toggle checked={stripComments(args())} onChange={checked => writeArgs(a => setStripComments(a, checked))} />
            </Setting>

            {/* The three the plugin ships a filter for, all applied on the way in. */}
            <Setting name={t.EMBED_NOTES} description={t.EMBED_NOTES_DESC} class="mod-toggle">
              <Toggle checked={embedNotes(args())} onChange={on => writeArgs(a => setEmbedNotes(a, on))} />
            </Setting>

            <Setting name={t.TODAY} description={t.TODAY_DESC}>
              <DropDown
                options={todayOptions()}
                selected={todayFormat(args()) ?? ''}
                autofocus={false}
                onChange={value => writeArgs(a => setTodayFormat(a, value ? (value as TodayFormat) : undefined))}
              />
            </Setting>

            <Setting name={t.KEYWORDS} description={t.KEYWORDS_DESC} class="mod-toggle">
              <Toggle checked={keywords(args())} onChange={on => writeArgs(a => setKeywords(a, on))} />
            </Setting>
            <Show when={keywords(args())}>
              <Setting name={t.KEYWORDS_LABEL} description={t.KEYWORDS_LABEL_DESC}>
                <Text
                  value={keywordsTitle(args()) ?? ''}
                  placeholder={t.KEYWORDS_LABEL_PLACEHOLDER}
                  onChange={value => writeArgs(a => setKeywordsTitle(a, value))}
                />
              </Setting>
            </Show>
          </div>

          <Show when={supportsTopLevelDivision(format())}>
            <Setting name={t.TOP_LEVEL_DIVISION} description={t.TOP_LEVEL_DIVISION_DESC} class="ex-template-modal-division">
              <DropDown
                options={divisionOptions}
                selected={topLevelDivision(args()) ?? ''}
                autofocus={false}
                onChange={value => writeArgs(a => setTopLevelDivision(a, value))}
              />
            </Setting>
          </Show>

          {/* Colours and language definition share a card: both need a writer that highlights. */}
          <Show when={supportsHighlighting(format())}>
            <div class="ex-card ex-template-modal-highlight">
              <Setting name={t.HIGHLIGHT} description={t.HIGHLIGHT_DESC} class="ex-template-modal-highlight-style">
                <DropDown
                  options={highlightOptions()}
                  selected={highlightStyle(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setHighlightStyle(a, value))}
                />
              </Setting>
              <Setting name={t.SYNTAX_DEFINITION} description={t.SYNTAX_DEFINITION_DESC} class="ex-template-modal-syntax-definition">
                <FileInput
                  value={syntaxDefinition(args())}
                  filters={SYNTAX_FILES}
                  tooltip={t.CHOOSE_FILE}
                  onChange={value => writeArgs(a => setSyntaxDefinition(a, value.trim()))}
                />
              </Setting>
            </div>
          </Show>

          {/* Method and the build it loads share a card; `--mathml` fetches nothing. */}
          <Show when={supportsMathMethod(format())}>
            <div class="ex-card ex-template-modal-math">
              <Setting name={t.MATH} description={t.MATH_DESC} class="ex-template-modal-math-method">
                <DropDown
                  options={mathOptions}
                  selected={mathMethod(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setMathMethod(a, value))}
                />
              </Setting>
              <Collapsible when={takesMathUrl(mathMethod(args()))} class="ex-template-modal-math-url-panel">
                <Setting name={t.MATH_URL} description={t.MATH_URL_DESC} class="ex-template-modal-math-url">
                  <Text
                    value={mathUrl(args()) ?? ''}
                    placeholder={t.MATH_URL_PLACEHOLDER}
                    onChange={value => writeArgs(a => setMathUrl(a, value))}
                  />
                </Setting>
              </Collapsible>
            </div>
          </Show>

          {/* No engine to choose between where none can be run. */}
          <Show when={isPdfOutput(format()) && engine() === 'native'}>
            <Setting name={t.PDF_ENGINE} description={t.PDF_ENGINE_DESC} class="ex-template-modal-pdf-engine">
              <DropDown
                options={engineOptions()}
                selected={pdfEngine(args()) ?? ''}
                autofocus={false}
                onChange={value => writeArgs(a => setPdfEngine(a, value))}
              />
            </Setting>
          </Show>

          {/* Citeproc reads the document rather than writing it, so no format gate. */}
          <div class="ex-card ex-template-modal-citations">
            <Setting name={t.CITATIONS} description={t.CITATIONS_DESC} class="ex-template-modal-citations-toggle">
              <Toggle checked={citeproc(args())} onChange={checked => writeArgs(a => setCiteproc(a, checked))} />
            </Setting>
            <Collapsible when={citeproc(args())} class="ex-template-modal-citations-panel">
              <Setting name={t.BIBLIOGRAPHY} description={t.BIBLIOGRAPHY_DESC}>
                <FileInput
                  value={bibliography(args())}
                  filters={BIBLIOGRAPHY_FILES}
                  tooltip={t.CHOOSE_FILE}
                  onChange={value => writeArgs(a => setBibliography(a, value.trim()))}
                />
              </Setting>
              <Setting name={t.CSL} description={t.CSL_DESC}>
                <FileInput
                  value={csl(args())}
                  filters={CSL_FILES}
                  tooltip={t.CHOOSE_FILE}
                  onChange={value => writeArgs(a => setCsl(a, value.trim()))}
                />
              </Setting>
            </Collapsible>
          </div>

          {/* The page as template variables, each row shown only where the writer reads it. Direction stands with
              them though it is metadata: it is one more thing the page is set up with. */}
          <Show when={curatedVariables().length > 0 || supportsTextDirection(format())}>
            <div class="ex-card ex-template-modal-page-setup">
              <Setting name={t.PAGE_SETUP} description={t.PAGE_SETUP_DESC} heading={true} />
              <For each={curatedVariables()}>
                {name => (
                  <Setting name={t.VARIABLE_LABELS[name]} class={`ex-template-modal-variable ex-template-modal-${name}`}>
                    <Show
                      when={VARIABLE_CHOICES[name]}
                      fallback={
                        <Text
                          value={variable(args(), name) ?? ''}
                          placeholder={t.VARIABLE_PLACEHOLDERS[name]}
                          onChange={value => writeArgs(a => setVariable(a, name, value.trim()))}
                        />
                      }
                    >
                      <DropDown
                        options={variableOptions(name)}
                        selected={variable(args(), name) ?? ''}
                        autofocus={false}
                        onChange={value => writeArgs(a => setVariable(a, name, value))}
                      />
                    </Show>
                  </Setting>
                )}
              </For>
              <Show when={supportsTextDirection(format())}>
                <Setting name={t.TEXT_DIRECTION} description={t.TEXT_DIRECTION_DESC} class="ex-template-modal-direction">
                  <DropDown
                    options={directionOptions}
                    selected={textDirection(args()) ?? ''}
                    autofocus={false}
                    onChange={value => writeArgs(a => setTextDirection(a, value))}
                  />
                </Setting>
              </Show>
            </div>
          </Show>

          <Show when={supportsCss(format())}>
            <Setting name={t.STYLESHEET} description={t.STYLESHEET_DESC} class="ex-template-modal-css">
              <FileInput
                value={css(args())}
                filters={CSS_FILES}
                tooltip={t.CHOOSE_FILE}
                onChange={value => writeArgs(a => setCss(a, value.trim()))}
              />
            </Setting>
          </Show>

          {/* Three files around one document. Writers with no header lose that row. */}
          <Show when={supportsIncludes(format())}>
            <div class="ex-card ex-template-modal-includes">
              <Setting name={t.INCLUDES} description={t.INCLUDES_DESC} heading={true} />
              <Show when={supportsHeaderInclude(format())}>
                <Setting name={t.INCLUDE_IN_HEADER}>
                  <FileInput
                    value={includeInHeader(args())}
                    filters={[ANY_FILE]}
                    tooltip={t.CHOOSE_FILE}
                    onChange={value => writeArgs(a => setIncludeInHeader(a, value.trim()))}
                  />
                </Setting>
              </Show>
              <Setting name={t.INCLUDE_BEFORE_BODY}>
                <FileInput
                  value={includeBeforeBody(args())}
                  filters={[ANY_FILE]}
                  tooltip={t.CHOOSE_FILE}
                  onChange={value => writeArgs(a => setIncludeBeforeBody(a, value.trim()))}
                />
              </Setting>
              <Setting name={t.INCLUDE_AFTER_BODY}>
                <FileInput
                  value={includeAfterBody(args())}
                  filters={[ANY_FILE]}
                  tooltip={t.CHOOSE_FILE}
                  onChange={value => writeArgs(a => setIncludeAfterBody(a, value.trim()))}
                />
              </Setting>
            </div>
          </Show>

          {/* How the file itself is laid out, for writers producing text a person reads. */}
          <Show when={supportsWrap(format())}>
            <div class="ex-card ex-template-modal-source">
              <Setting name={t.WRITTEN_SOURCE} description={t.WRITTEN_SOURCE_DESC} heading={true} />

              <Setting name={t.WRAP} class="ex-template-modal-wrap">
                <DropDown
                  options={wrapOptions()}
                  selected={wrap(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setWrap(a, value))}
                />
              </Setting>

              {/* A column to wrap at is only a question while something wraps. */}
              <Collapsible when={wrap(args()) !== 'none'} class="ex-template-modal-columns-panel">
                <Setting name={t.COLUMNS} class="ex-template-modal-columns">
                  <Text value={columns(args()) ?? ''} placeholder="72" onChange={value => writeArgs(a => setColumns(a, value))} />
                </Setting>
              </Collapsible>

              <Show when={supportsMarkdownHeadings(format())}>
                <Setting name={t.MARKDOWN_HEADINGS} class="ex-template-modal-headings">
                  <DropDown
                    options={headingStyleOptions()}
                    selected={markdownHeadings(args()) ?? ''}
                    autofocus={false}
                    onChange={value => writeArgs(a => setMarkdownHeadings(a, value))}
                  />
                </Setting>
              </Show>

              <Show when={supportsReferenceLinks(format())}>
                <Setting name={t.REFERENCE_LINKS} class="ex-template-modal-reference-links">
                  <Toggle checked={referenceLinks(args())} onChange={checked => writeArgs(a => setReferenceLinks(a, checked))} />
                </Setting>
              </Show>
            </div>
          </Show>

          {/* The bytes rather than the layout, each on its own gate. */}
          <Show when={supportsEol(format())}>
            <Setting name={t.LINE_ENDINGS} class="ex-template-modal-eol">
              <DropDown
                options={eolOptions()}
                selected={eol(args()) ?? ''}
                autofocus={false}
                onChange={value => writeArgs(a => setEol(a, value))}
              />
            </Setting>
          </Show>

          <Show when={supportsAscii(format())}>
            <Setting name={t.ASCII_ONLY} description={t.ASCII_ONLY_DESC} class="ex-template-modal-ascii">
              <Toggle checked={ascii(args())} onChange={checked => writeArgs(a => setAscii(a, checked))} />
            </Setting>
          </Show>

          {/* Its own row: an EPUB collects footnotes but writes no source anybody reads. */}
          <Show when={supportsReferenceLocation(format())}>
            <Setting name={t.REFERENCE_LOCATION} description={t.REFERENCE_LOCATION_DESC} class="ex-template-modal-reference-location">
              <DropDown
                options={referenceLocationOptions()}
                selected={referenceLocation(args()) ?? ''}
                autofocus={false}
                onChange={value => writeArgs(a => setReferenceLocation(a, value))}
              />
            </Setting>
          </Show>

          <Show when={isSlideOutput(format())}>
            <div class="ex-card ex-template-modal-slides">
              <Setting name={t.SLIDES} description={t.SLIDES_DESC} heading={true} />
              <Setting name={t.INCREMENTAL} class="ex-template-modal-incremental">
                <Toggle checked={incremental(args())} onChange={checked => writeArgs(a => setIncremental(a, checked))} />
              </Setting>
              <Setting name={t.SLIDE_LEVEL} class="ex-template-modal-slide-level">
                <DropDown
                  options={slideLevelOptions()}
                  selected={slideLevel(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setSlideLevel(a, value))}
                />
              </Setting>
            </div>
          </Show>

          <Show when={isEpubOutput(format())}>
            <div class="ex-card ex-template-modal-epub">
              <Setting name={t.EPUB} description={t.EPUB_DESC} heading={true} />
              <Setting name={t.EPUB_COVER_IMAGE}>
                <FileInput
                  value={epubCoverImage(args())}
                  filters={IMAGE_FILES}
                  tooltip={t.CHOOSE_FILE}
                  onChange={value => writeArgs(a => setEpubCoverImage(a, value.trim()))}
                />
              </Setting>
              <Setting name={t.EPUB_EMBED_FONT}>
                <FileInput
                  value={epubEmbedFont(args())}
                  filters={FONT_FILES}
                  tooltip={t.CHOOSE_FILE}
                  onChange={value => writeArgs(a => setEpubEmbedFont(a, value.trim()))}
                />
              </Setting>
              <Setting name={t.EPUB_TITLE_PAGE}>
                <Toggle checked={epubTitlePage(args())} onChange={checked => writeArgs(a => setEpubTitlePage(a, checked))} />
              </Setting>
              <Setting name={t.EPUB_SUBDIRECTORY} description={t.EPUB_SUBDIRECTORY_DESC}>
                <Text
                  value={epubSubdirectory(args()) ?? ''}
                  placeholder="EPUB"
                  onChange={value => writeArgs(a => setEpubSubdirectory(a, value))}
                />
              </Setting>
            </div>
          </Show>

          {/* Outside the EPUB card: chunked HTML splits on the same option. */}
          <Show when={supportsSplitLevel(format())}>
            <Setting name={t.SPLIT_LEVEL} description={t.SPLIT_LEVEL_DESC} class="ex-template-modal-split-level">
              <DropDown
                options={splitLevelOptions()}
                selected={splitLevel(args()) ?? ''}
                autofocus={false}
                onChange={value => writeArgs(a => setSplitLevel(a, value))}
              />
            </Setting>
          </Show>

          <Show when={supportsHtmlOptions(format())}>
            <div class="ex-card ex-template-modal-page">
              <Setting name={t.HTML_PAGE} description={t.HTML_PAGE_DESC} heading={true} />

              {/* The shipped HTML template already asks for this, so only a difference is written. */}
              <Show when={supportsEmbedResources(format())}>
                <Setting name={t.EMBED_RESOURCES} class="ex-template-modal-embed">
                  <Toggle
                    checked={embedResources(template()?.arguments, args())}
                    onChange={checked => writeArgs(a => setEmbedResources(a, checked, embedResources(template()?.arguments)))}
                  />
                </Setting>
              </Show>

              <Setting name={t.SECTION_DIVS} class="ex-template-modal-section-divs">
                <Toggle checked={sectionDivs(args())} onChange={checked => writeArgs(a => setSectionDivs(a, checked))} />
              </Setting>

              <Setting name={t.EMAIL_OBFUSCATION} class="ex-template-modal-obfuscation">
                <DropDown
                  options={obfuscationOptions()}
                  selected={emailObfuscation(args()) ?? ''}
                  autofocus={false}
                  onChange={value => writeArgs(a => setEmailObfuscation(a, value))}
                />
              </Setting>

              <Setting name={t.ID_PREFIX} class="ex-template-modal-id-prefix">
                <Text value={idPrefix(args()) ?? ''} onChange={value => writeArgs(a => setIdPrefix(a, value.trim()))} />
              </Setting>
            </div>
          </Show>

          {/* Extraction is asked of every writer; the resolution only where sizes are written. */}
          <div class="ex-card ex-template-modal-media">
            <Setting name={t.MEDIA} description={t.MEDIA_DESC} heading={true} />
            <Setting name={t.EXTRACT_MEDIA} class="ex-template-modal-extract-media">
              <FileInput
                value={extractMedia(template()?.arguments, args())}
                folder={true}
                tooltip={t.CHOOSE_FOLDER}
                onChange={value => writeArgs(a => setExtractMedia(a, value.trim()))}
              />
            </Setting>
            <Show when={supportsDpi(format())}>
              <Setting name={t.DPI} class="ex-template-modal-dpi">
                <Text value={dpi(args()) ?? ''} placeholder="96" onChange={value => writeArgs(a => setDpi(a, value))} />
              </Setting>
            </Show>
          </div>

          {/* Everything else. Title, author and date come from the note's frontmatter, so they
              get no field. `visible` is the panel: an unrendered textarea has no height. */}
          <Setting name={t.OTHER_VARIABLES} description={t.OTHER_VARIABLES_DESC} class="ex-template-modal-variables">
            <TextArea
              class="ex-template-modal-pairs"
              autoSize={true}
              visible={advancedOpen()}
              value={otherVariables()}
              placeholder="fontfamily=libertinus"
              onChange={text => writeArgs(a => setVariables(a, pairsFromText(text), curatedVariables()))}
            />
          </Setting>
        </Section>

        {/* The command is shown, not typed into: an edit here could not be told apart from
            what the rows and the preset wrote. `userArguments` below is the field no row
            can reach, written last so it has the final word. */}
        <Section
          name={t.COMMAND_RESULT}
          description={t.COMMAND_RESULT_DESC}
          class="ex-template-modal-command-section"
          open={commandOpen()}
          onToggle={setCommandOpen}
        >
          {/* The command and the one field that adds to it share a card. */}
          <div class="ex-card ex-template-modal-command-card">
            <Setting class="ex-template-modal-resulting-command ex-template-modal-nameless">
              {/* Copy sits over the field, not the heading: it copies what is on screen. */}
              <div class="ex-template-modal-command-preview">
                <TextArea
                  class="ex-template-modal-command-line"
                  autoSize={true}
                  visible={commandOpen()}
                  readOnly={true}
                  value={commandForReading()}
                />
                <ExtraButton icon="copy" tooltip={t.COMMAND_COPY} onClick={() => void copyCommand()} />
              </div>
            </Setting>

            <Setting name={t.USER_ARGS} description={t.USER_ARGS_DESC} class="ex-template-modal-user-arguments">
              <Text
                style="width: 100%"
                value={template()?.userArguments ?? ''}
                tooltip={template()?.userArguments}
                placeholder="--defaults=my.yaml"
                onChange={value => updateTemplate(v => (v.userArguments = value.trim() || undefined))}
              />
            </Setting>
          </div>
        </Section>
      </>
    );
  };

  const CustomCommandTempateEditBlock = () => {
    const template = () => currentEditCommandTemplate('custom');
    const updateTemplate = (update: (prev: Partial<CustomExportSetting>) => void) => {
      updateCurrentEditCommandTemplate(prev => (prev.type === 'custom' ? update(prev) : undefined));
    };
    return (
      <>
        <Setting name={t.TEMPLATE_COMMAND} class="ex-template-modal-custom-command">
          <Text style="width: 100%" value={template()?.command ?? ''} onChange={value => updateTemplate(v => (v.command = value))} />
        </Setting>
        <Setting name={t.TEMPLATE_TARGET_EXTENSIONS} class="ex-template-modal-target-extensions">
          <Text value={template()?.targetFileExtensions ?? ''} onChange={value => updateTemplate(v => (v.targetFileExtensions = value))} />
        </Setting>

        {/* A custom template is a command, and this is the only word it says back. */}
        <Setting name={t.TEMPLATE_SHOW_OUTPUT} class="ex-template-modal-show-output">
          <Toggle
            checked={template()?.showCommandOutput ?? false}
            onChange={checked => updateTemplate(v => (v.showCommandOutput = checked))}
          />
        </Setting>
      </>
    );
  };

  const chooseCustomDefaultExportDirectory = async () => {
    const chosen = await chooseFile({ folder: true, defaultPath: customDefaultExportDirectory() ?? (await documentsFolder()) });
    if (chosen) {
      setSettings('customDefaultExportDirectory', v => setPlatformValue(v, chosen));
    }
  };

  const choosePandocPath = async () => {
    const chosen = await chooseFile({ filters: Platform.isWin ? [{ extensions: ['exe'], name: 'pandoc' }] : undefined });
    if (chosen) {
      setSettings('pandocPath', v => setPlatformValue(v, chosen));
    }
  };

  // Which pandoc this vault exports with, and so which of the rows below are worth showing at all. Read from the UI
  // Obsidian is drawing rather than from the device, so a desktop emulating a phone is shown the phone's settings.
  const engine = createMemo(() => resolveEngine(settings.engineMode, isMobileUi()));

  // Asked on every open, answered from the session cache after the first success. Still an
  // effect, so a changed path or environment re-asks the binary it now points at — and asks
  // nothing at all where no installed pandoc runs the exports, a phone above all.
  createEffect(async () => {
    if (engine() !== 'native') {
      setPandocVersion(undefined);
      return;
    }
    try {
      const env = createEnv(getPlatformValue(settings.env) ?? {});
      setPandocVersion(await pandoc.getCachedVersion(getPlatformValue(settings.pandocPath), env));
    } catch {
      setPandocVersion(undefined);
    }
  });

  // What the two halves say at length, kept by the card rather than by either of them: the installed pandoc's
  // notices come first, as its half does.
  const [nativeNotices, setNativeNotices] = createSignal<PanelNotice[]>([]);
  const [wasmNotices, setWasmNotices] = createSignal<PanelNotice[]>([]);
  const panelNotices = createMemo(() => [...nativeNotices(), ...wasmNotices()]);

  // On a phone a folder is one of the vault's, and is stored as the path on the device all the same.
  const vaultDir = vaultRoot(app.vault.adapter);
  const vaultFolderOf = (path?: string) => (path?.startsWith(`${vaultDir}/`) ? path.substring(vaultDir.length + 1) : '');
  const fullPathOf = (folder: string) => (folder ? `${vaultDir}/${folder}` : vaultDir);

  return (
    <>
      {/* One card: a pandoc to each half of it, and a row to each thing it is read for. */}
      <div class="ex-pandoc-panel">
        {/* What this release brought, at the head of the card until it is read or dismissed. */}
        <ChangelogNotice
          app={app}
          version={plugin.manifest.version}
          dismissed={settings.dismissedChangelogVersion}
          onDismiss={() => setSettings('dismissedChangelogVersion', plugin.manifest.version)}
        />

        <div class="ex-pandoc-panel-row ex-pandoc-engines">
          {/* The installed program has nothing to say where it is not the one running. */}
          <Show when={engine() === 'native'}>
            <PandocDashboard version={pandocVersion()} markdownLinks={app.vault.config.useMarkdownLinks} onNotices={setNativeNotices} />
          </Show>

          <WasmPanel
            app={app}
            manager={plugin.wasm}
            version={settings.wasmVersion}
            onInstalled={version => setSettings('wasmVersion', version)}
            onNotices={setWasmNotices}
            onExtensions={() => setModal(() => WasmExtensionsModal)}
          />
        </div>

        {/* Between the two pandocs and the pages to read: what neither half has the width to say. */}
        <PandocNotices notices={panelNotices()} />

        <PandocLinks app={app} />
      </div>

      <Setting name={t.SECTION_DEFAULTS} heading={true} />

      <div class="ex-settings-card">
        {/* Which pandoc converts, and where the installed one is: what every row below is answered under.
            A phone has no installed program to point at, so that row belongs to the desktop. */}
        <Show when={engine() === 'native'}>
          {/* Nothing here means the export runs a bare `pandoc`, which is the system's PATH answering rather than a
              search of the plugin's own — so the row claims it was found only once the binary has actually answered. */}
          <Setting
            name={t.PANDOC_FOLDER}
            description={getPlatformValue(settings.pandocPath) || (pandocVersion() ? t.PANDOC_PATH_PLACEHOLDER : t.PANDOC_PATH_NOT_FOUND)}
          >
            <ExtraButton icon="folder" tooltip={t.CHOOSE_FILE} onClick={() => void choosePandocPath()} />
            {/* The dialog cannot pick "nothing", so clearing needs its own control. */}
            <Show when={getPlatformValue(settings.pandocPath)}>
              <ExtraButton
                icon="rotate-ccw"
                tooltip={t.PANDOC_PATH_RESET}
                onClick={() => setSettings('pandocPath', v => setPlatformValue(v, ''))}
              />
            </Show>
          </Setting>
        </Show>

        {/* Asked whether or not the build is installed: it is the answer that says what to install for. The question
            is only ever about this computer — a phone runs the wasm build whichever way it is set, and is not asked
            at all, an answer there being a claim that there is an installed pandoc to choose instead. */}
        <Show when={!isMobileUi()}>
          <Setting name={t.WASM_ENGINE} description={t.WASM_ENGINE_DESC}>
            <Toggle checked={settings.engineMode === 'wasm'} onChange={on => setSettings('engineMode', on ? 'wasm' : 'auto')} />
          </Setting>
        </Show>

        <Setting name={t.SETTING_EXPORT_DESTINATION}>
          <DropDown
            options={[
              { name: t.EXPORT_DESTINATION_SAME, value: 'Same' },
              { name: t.EXPORT_DESTINATION_CUSTOM, value: 'Custom' },
            ]}
            selected={settings.defaultExportDirectoryMode}
            onChange={(v: 'Same' | 'Custom') => setSettings('defaultExportDirectoryMode', v)}
          />
        </Setting>

        <Collapsible when={settings.defaultExportDirectoryMode === 'Custom'}>
          <Setting class="ex-export-destination-path">
            {/* A folder of the vault on a phone, where nothing outside it can be written to anyway. */}
            <Show
              when={isMobileUi()}
              fallback={
                <>
                  <Text style="width: 100%" value={customDefaultExportDirectory() ?? ''} tooltip={customDefaultExportDirectory()} />
                  <ExtraButton icon="folder" onClick={() => void chooseCustomDefaultExportDirectory()} />
                </>
              }
            >
              <FolderInput
                app={app}
                value={vaultFolderOf(customDefaultExportDirectory())}
                placeholder={t.IMPORT_DIALOG_FOLDER_PLACEHOLDER}
                onChange={folder => setSettings('customDefaultExportDirectory', v => setPlatformValue(v, fullPathOf(folder)))}
              />
            </Show>
          </Setting>
        </Collapsible>

        {/* Both hand the file to the system, and a phone has none of that to hand it to. */}
        <Show when={!isMobileUi()}>
          <Setting name={t.SETTING_OPEN_LOCATION}>
            <Toggle checked={settings.openExportedFileLocation} onChange={v => setSettings('openExportedFileLocation', v)} />
          </Setting>

          <Setting name={t.SETTING_OPEN_FILE}>
            <Toggle checked={settings.openExportedFile} onChange={v => setSettings('openExportedFile', v)} />
          </Setting>
        </Show>

        {/* The environment is what a program is started with, and the wasm build is not started. */}
        <Show when={engine() === 'native'}>
          <Setting name={t.SETTING_ENV_VARS} description={t.SETTING_ENV_VARS_DESC}>
            <ExtraButton icon="pencil" tooltip={t.ACTION_EDIT} onClick={() => setEditingEnvVars(v => !v)} />
          </Setting>
        </Show>

        <Collapsible when={editingEnvVars() && engine() === 'native'}>
          <Setting class="ex-nameless-setting ex-env-panel">
            <Show when={envVarsAsText()} fallback={<EnvVars env={envVars()} onChange={setEnvVars} />}>
              <TextArea
                class="ex-env-vars"
                autoSize={true}
                visible={editingEnvVars() && envVarsAsText()}
                value={envVarsText()}
                onChange={setEnvVarsText}
              />
            </Show>

            {/* Everything the panel does that is not editing what is already in it: a folder for each variable,
                and the way over to the text. Nothing to add to while the text is showing — it adds by being typed. */}
            <div class="ex-env-actions">
              <Show when={!envVarsAsText()}>
                <Index each={Object.keys(envVars())}>
                  {name => (
                    // A plus and the variable's name: what the button does is the icon's to say, and the row is
                    // several of these side by side, where the word "add" three times over is three times nothing.
                    <Button
                      class="ex-env-action"
                      tooltip={t.ENV_ADD_FOLDER(name())}
                      onClick={() => void addEnvFolder(envVars(), name(), setEnvVars)}
                    >
                      <Icon name="plus" />
                      {name()}
                    </Button>
                  )}
                </Index>
              </Show>
              <Button class="ex-env-action" onClick={() => setEnvVarsAsText(v => !v)}>
                <Icon name="pencil" />
                {envVarsAsText() ? t.ENV_EDIT_AS_FOLDERS : t.ENV_EDIT_AS_TEXT}
              </Button>
            </div>
          </Setting>
        </Collapsible>
      </div>

      <Setting name={t.SECTION_TEMPLATES} heading={true} />

      <TemplateActions onAdd={addCommandTemplate} onBrowseLuaFilters={() => setModal(() => LuaFilterStoreModal)} />

      <TemplateTable
        templates={settings.items}
        engine={engine()}
        sort={settings.lastTemplateSort}
        onSort={sort => setSettings('lastTemplateSort', sort)}
        onEdit={editCommandTemplate}
        onDuplicate={duplicateCommandTemplate}
        onRemove={removeCommandTemplate}
      />

      <Show when={modal()}>
        <Dynamic component={modal()} ref={(el: Node) => document.body.appendChild(el)} />
      </Show>
    </>
  );
};

/** Group element hosting the single row the whole tab is rendered into. */
const GROUP_CLASS = 'ex-settings-group';
/** The row itself — stripped of its stock chrome, see styles.css. */
const ANCHOR_CLASS = 'ex-settings-anchor';
/** Container the solid-js tree is mounted into. */
const ROOT_CLASS = 'ex-settings-root';

export default class extends PluginSettingTab {
  plugin: PandocGuiPlugin;
  #dispose?: () => void;
  #root?: HTMLElement;

  constructor(plugin: PandocGuiPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
    // The sidebar entry is the plugin's own name, so the manifest is the one place it is set.
    this.name = plugin.manifest.name;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: 'group',
        cls: GROUP_CLASS,
        items: [
          {
            // The whole tab is one custom-rendered row: name, description and aliases exist
            // so the settings search can find it; the visible labels are drawn by solid-js.
            name: this.plugin.manifest.name,
            desc: this.plugin.manifest.description,
            aliases: [
              t.PANDOC_DASHBOARD,
              // The rows a phone does not have. Searching them there would answer with a tab that says nothing
              // about the installed pandoc, because there is none to say anything about.
              ...(isMobileUi() ? [] : [t.PANDOC_PATH, t.PANDOC_FOLDER, t.WASM_ENGINE, t.SETTING_ENV_VARS]),
              t.WASM_TITLE,
              t.EXT_TITLE,
              t.TYPST_TITLE,
              t.SECTION_DEFAULTS,
              t.SETTING_EXPORT_DESTINATION,
              t.SETTING_OPEN_LOCATION,
              t.SETTING_OPEN_FILE,
              t.SECTION_TEMPLATES,
              t.ACTION_NEW_TEMPLATE,
              t.ACTION_BROWSE_FILTERS,
              t.LUA_FILTERS,
              t.STORE_TITLE,
              t.TEMPLATE_EDITOR_TITLE,
              t.TEMPLATE_COMMAND,
              t.COMMAND_RESULT,
              t.EXTENSIONS,
              t.TOC,
              t.READING,
              t.SHIFT_HEADINGS,
              t.TAB_STOP,
              t.STRIP_COMMENTS,
              t.EMBED_NOTES,
              t.TODAY,
              t.KEYWORDS,
              t.WORD_STYLES,
              t.FIGURE_STYLE,
              t.TABLE_STYLE,
              t.LIST_STYLES,
              t.MATH,
              t.MATH_URL,
              t.SYNTAX_DEFINITION,
              t.LINE_ENDINGS,
              t.ASCII_ONLY,
              t.CITATIONS,
              t.BIBLIOGRAPHY,
              t.CSL,
              t.REFERENCE_DOC,
              t.OUTPUT_TEMPLATE,
              t.STYLESHEET,
              t.INCLUDES,
              t.PAGE_SETUP,
              t.WRITTEN_SOURCE,
              t.WRAP,
              t.REFERENCE_LOCATION,
              t.SLIDES,
              t.EPUB,
              t.HTML_PAGE,
              t.EMBED_RESOURCES,
              t.MEDIA,
              t.EXTRACT_MEDIA,
              t.TEXT_DIRECTION,
              t.OTHER_VARIABLES,
              t.USER_ARGS,
              t.TEMPLATE_TARGET_EXTENSIONS,
              t.TEMPLATE_SHOW_OUTPUT,
              t.TEMPLATE_OUTPUT,
              'pandoc',
            ],
            render: setting => {
              setting.settingEl.addClass(ANCHOR_CLASS);
              // Must be built into settingEl — the reconciler prunes anything appended to the
              // group's listEl. Reuse the existing root so a re-render cannot duplicate the UI.
              const root =
                setting.settingEl.querySelector<HTMLElement>(`:scope > .${ROOT_CLASS}`) ?? setting.settingEl.createDiv(ROOT_CLASS);
              this.#mount(root);
              return () => this.#unmount();
            },
          },
        ],
      },
    ];
  }

  hide() {
    this.#unmount();
  }

  #mount(root: HTMLElement) {
    if (this.#dispose && this.#root === root && root.isConnected) {
      return;
    }
    this.#unmount();
    this.#root = root;
    this.#dispose = createRoot(dispose => {
      insert(root, <SettingTab plugin={this.plugin} />);
      onCleanup(() => {
        root.empty();
      });
      return dispose;
    });
  }

  #unmount() {
    const dispose = this.#dispose;
    this.#dispose = undefined;
    this.#root = undefined;
    dispose?.();
  }
}
