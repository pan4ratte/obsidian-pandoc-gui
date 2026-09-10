import { App, Notice, Platform, TFile, normalizePath } from 'obsidian';
import { createEnv } from '../settings';
import { exec, getPlatformValue } from '../system/utils';
import { t } from '../lang/helpers';
import { MessageBox, confirm } from '../ui/message_box';
import { reportRun } from '../ui/report_box';
import { IMPORT_MESSAGES, PandocProgress } from '../ui/progress';
import { describeExportFailure } from './export_error';
import type PandocGuiPlugin from '../main';
import pandoc from '../pandoc/pandoc';
import { readerFor } from '../pandoc/import_format';
import { importCommand, type ImportOptions } from '../args/import_args';
import { resolveEngine } from '../pandoc/engine';
import { convertWithWasm } from '../wasm/convert';
import { FileStore } from '../system/file_store';
import { basename, dirname, relativeTo, stem } from '../system/paths';
import { isMobile, vaultRoot } from '../system/platform';

export interface ImportRequest {
  /** The file on disk, as the dialog was given it. */
  source: string;
  /** Where the note goes, as a vault path — empty for the root. */
  folder: string;
  /** Where the extracted images go, as a vault path. Unset leaves the document's images where they are. */
  mediaFolder?: string;
  options: ImportOptions;
}

/** The note a source file becomes: its own name, written as markdown, in the chosen folder. */
export const importedNotePath = (source: string, folder: string): string => normalizePath(`${folder}/${stem(source)}.md`);

/**
 * The note as Obsidian sees it, once it does.
 *
 * Pandoc writes the file itself, so the vault learns of it from the watcher rather than from this plugin — which
 * takes a moment on a folder it is only now looking at.
 */
const openImported = async (app: App, notePath: string): Promise<void> => {
  for (let attempt = 0; attempt < 25; attempt++) {
    const note = app.vault.getFileByPath(notePath);
    if (note instanceof TFile) {
      await app.workspace.getLeaf(false).openFile(note);
      return;
    }
    await new Promise(resolve => window.setTimeout(resolve, 200));
  }
};

/** Convert a file on disk into a note in the vault. Answers whether one was written. */
export async function importFile(plugin: PandocGuiPlugin, request: ImportRequest): Promise<boolean> {
  const {
    app,
    manifest,
    settings: globalSetting,
    app: {
      vault: { adapter },
    },
  } = plugin;

  const reader = readerFor(request.source);
  if (!reader) {
    new Notice(t.IMPORT_DIALOG_SOURCE_UNKNOWN, 2000);
    return false;
  }

  const engine = resolveEngine(globalSetting.engineMode, isMobile());
  if (engine === 'wasm' && !(await plugin.wasm.isInstalled())) {
    new MessageBox(app, { title: t.IMPORT_ERROR_TITLE, message: t.WASM_NOT_INSTALLED, buttons: 'Ok' }).open();
    return false;
  }

  const notePath = importedNotePath(request.source, request.folder);
  const noteName = basename(notePath);
  const outputPath = adapter.getFullPath(notePath);
  const outputDir = dirname(outputPath);
  const files = new FileStore(app.vault, vaultRoot(adapter));

  if (
    (await files.exists(outputPath)) &&
    !(await confirm(app, {
      title: t.IMPORT_DIALOG_TITLE,
      message: t.OVERWRITE_TITLE(noteName),
      accept: t.BUTTON_REPLACE,
    }))
  ) {
    return false;
  }

  // The images are asked for as a vault folder and given to pandoc as a path from the note, which is how the note
  // will be linking to them.
  const options: ImportOptions = { ...request.options };
  if (request.mediaFolder !== undefined) {
    options.extractMedia = relativeTo(outputDir, adapter.getFullPath(normalizePath(request.mediaFolder)));
  }

  const pluginDir = `${vaultRoot(adapter)}/${manifest.dir}`;
  const env = createEnv(getPlatformValue(globalSetting.env) ?? {}, { pluginDir });

  let pandocPath = pandoc.normalizePath(getPlatformValue(globalSetting.pandocPath));
  let source = request.source;
  if (Platform.isWin) {
    // https://github.com/mokeyish/obsidian-enhancing-export/issues/153
    pandocPath = pandocPath.replaceAll('\\', '/');
    source = source.replaceAll('\\', '/');
  }

  // Run from the folder the note is written in, so `-o` and the extracted images are both said as the note says them.
  const cmd = importCommand(pandocPath, source, reader, options, noteName);

  const progress = new PandocProgress(IMPORT_MESSAGES);
  try {
    await files.mkdir(outputDir);
    let warnings: string;
    if (engine === 'wasm') {
      progress.starting();
      const wasm = await plugin.wasm.load();
      progress.running(noteName);
      // The command names the note relatively, as it is run from the folder the note goes in.
      const result = await convertWithWasm(wasm, files, {
        command: cmd,
        vaultDir: vaultRoot(adapter),
        cwd: outputDir,
      });
      // Named in a notice of their own: the progress one says only that there were warnings — see `exportNote`.
      const dropped = result.unsupported.length > 0 ? t.WASM_DROPPED(result.unsupported.join(' ')) : '';
      if (dropped) {
        new Notice(dropped, 10000);
      }
      warnings = [dropped, result.stderr.trim()].filter(Boolean).join('\n\n');
    } else {
      const { stderr } = await exec(cmd, { cwd: outputDir, env });
      warnings = stderr.trim();
    }

    // Pandoc warns here and writes the note all the same, so a warning is reported rather than thrown — and reported
    // where it will be read, the notice saying only that there were some. See `exportNote`.
    if (warnings) {
      console.warn(cmd, warnings);
      progress.warn(noteName);
      reportRun(app, {
        title: t.WARNINGS_TITLE,
        facts: [
          { label: t.IMPORT_ERROR_SOURCE, value: basename(request.source), title: request.source },
          { label: t.ERROR_FILE, value: noteName, title: outputPath },
        ],
        output: warnings,
        tone: 'warning',
      });
    } else {
      progress.succeed(noteName);
    }
    await openImported(app, notePath);
    return true;
  } catch (err) {
    progress.stop();
    const { detail, recommendation } = describeExportFailure(err, cmd);
    console.error(cmd, err);
    reportRun(app, {
      title: t.IMPORT_ERROR_TITLE,
      facts: [
        { label: t.IMPORT_ERROR_SOURCE, value: basename(request.source), title: request.source },
        { label: t.ERROR_FILE, value: noteName, title: outputPath },
      ],
      output: detail,
      hint: recommendation,
      tone: 'error',
    });
    return false;
  }
}
