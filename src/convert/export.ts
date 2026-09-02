import { Variables, ExportSetting, extractDefaultExtension as extractExtension, createEnv, today } from '../settings';
import { MessageBox, confirm } from '../ui/message_box';
import { Platform, TFile, getLinkpath, moment } from 'obsidian';
import type { SemVer } from 'semver';
import { exec, renderTemplate, getPlatformValue, trimQuotes } from '../system/utils';
import { t } from '../lang/helpers';
import { PandocProgress } from '../ui/progress';
import { describeExportFailure } from './export_error';
import type PandocGuiPlugin from '../main';
import pandoc from '../pandoc/pandoc';
import { orderLuaFilters } from '../filters/lua_filters';
import { legacyMathFlags, renameHighlightFlags, renameMathFlags } from '../args/writer_args';
import { outputArg } from '../args/output_arg';
import { resolveEngine, unsupportedBy, writesTypstPdf } from '../pandoc/engine';
import { convertWithWasm } from '../wasm/convert';
import { typesetTypstPdf } from './typst_pdf';
import { FileStore } from '../system/file_store';
import { download } from '../system/download';
import { basename, dirname, normalize, resolve, stem } from '../system/paths';
import { PATH_SEPARATOR, chooseSavePath, isDesktop, isMobile, openFile, showInFolder, vaultRoot } from '../system/platform';

const encoder = new TextEncoder();

/**
 * One field of the embed map, as plain ASCII, percent-escaped byte by byte.
 *
 * Windows hands a program its environment in the machine's own code page, and a variable that cannot be written in it
 * arrives with a `?` where every such character was: a note called `Тест.md` reached `embeds.lua` as `????.md`, matched
 * nothing, and was written into the document as the broken image pandoc had read it to be. Nothing but ASCII survives
 * that trip for certain, so nothing but ASCII is sent — `embeds.lua` reads it back with the percent-decoding it already
 * had for links.
 *
 * The tab and the newline the map is laid out with are escaped along with the rest, so a link with either in it can no
 * longer break the line it is written on.
 */
export const escapeForEnv = (text: string): string =>
  text.replace(/[^\x20-\x24\x26-\x7e]/g, character =>
    [...encoder.encode(character)].map(byte => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`).join('')
  );

export async function exportNote(
  plugin: PandocGuiPlugin,
  currentFile: TFile,
  candidateOutputDirectory: string,
  candidateOutputFileName: string | undefined,
  setting: ExportSetting,
  showOverwriteConfirmation?: boolean,
  options?: unknown,
  onSuccess?: () => void,
  onFailure?: () => void,
  beforeExport?: () => void
) {
  const {
    settings: globalSetting,
    manifest,
    app: {
      vault: { adapter, config: obsidianConfig },
      metadataCache,
    },
  } = plugin;

  if (!candidateOutputFileName) {
    const extension = extractExtension(setting);
    candidateOutputFileName = `${currentFile.basename}${extension}`;
  }
  if (showOverwriteConfirmation == undefined) {
    showOverwriteConfirmation = globalSetting.showOverwriteConfirmation;
  }

  // Which pandoc is doing this, and whether it is one that can.
  const engine = resolveEngine(globalSetting.engineMode, isMobile());
  const refuse = (message: string) => {
    new MessageBox(plugin.app, { title: t.ERROR_TITLE, message, buttons: 'Ok' }).open();
    onFailure?.();
  };
  const blocked = unsupportedBy(setting, engine);
  if (blocked) {
    // The other pandoc is only worth pointing at on a machine that can have one.
    const why = blocked === 'pdf' ? t.WASM_NO_PDF : t.WASM_NO_COMMAND;
    refuse(isMobile() ? why : `${why} ${t.WASM_USE_NATIVE}`);
    return;
  }
  if (engine === 'wasm' && !(await plugin.wasm.isInstalled())) {
    refuse(t.WASM_NOT_INSTALLED);
    return;
  }
  // The PDF is typst's half of the work, and it is installed on its own — a vault that exports no PDF never fetches it.
  const needsTypst = engine === 'wasm' && writesTypstPdf(setting);
  if (needsTypst && !(await plugin.typst.isInstalled())) {
    refuse(t.TYPST_NOT_INSTALLED);
    return;
  }

  // The `${...}` a template can use — see the `Variables` interface in settings.ts.
  const vaultDir = vaultRoot(adapter);
  const pluginDir = `${vaultDir}/${manifest.dir}`;
  const luaDir = `${pluginDir}/lua`;
  const outputDir = candidateOutputDirectory;
  const outputPath = `${outputDir}/${candidateOutputFileName}`;
  const outputFileName = candidateOutputFileName.substring(0, candidateOutputFileName.lastIndexOf('.'));
  const outputFileFullName = candidateOutputFileName;

  const currentPath = adapter.getFullPath(currentFile.path);
  const currentDir = dirname(currentPath);
  const currentFileName = currentFile.basename;
  const currentFileFullName = currentFile.name;

  let attachmentFolderPath = obsidianConfig.attachmentFolderPath ?? '/';
  if (attachmentFolderPath === '/') {
    attachmentFolderPath = vaultDir;
  } else if (attachmentFolderPath.startsWith('.')) {
    attachmentFolderPath = resolve(currentDir, attachmentFolderPath.substring(1));
  } else {
    attachmentFolderPath = resolve(vaultDir, attachmentFolderPath);
  }

  let frontMatter: unknown = null;
  try {
    frontMatter = metadataCache.getCache(currentFile.path).frontmatter;
  } catch (e) {
    console.error(e);
  }

  // Every embedded note, transitively, as the written link against the file it means.
  const noteEmbeds = new Map<string, string>();
  // Every file the note reaches, notes and images alike — what a wasm run has to be handed, having no vault to look in.
  const embeddedFiles = new Set<string>();
  // The folders those files sit in, which is where pandoc is told to look for what a note names by filename alone. An
  // embedded note is written in where it stands but its images are still its own: they sit beside *it*, wherever that
  // is, so the walk has to reach as far as the writing does.
  const embedFolders = new Set<string>();
  const walkedForEmbeds = new Set<string>([currentFile.path]);
  const collectNoteEmbeds = (file: TFile, depth: number) => {
    if (depth > 8) {
      return;
    }
    for (const embed of metadataCache.getCache(file.path)?.embeds ?? []) {
      const target = metadataCache.getFirstLinkpathDest(getLinkpath(embed.link), file.path);
      if (!(target instanceof TFile)) {
        console.warn(`Could not resolve embedded file: ${embed.link}`);
        continue;
      }
      const path = adapter.getFullPath(target.path);
      embeddedFiles.add(path);
      embedFolders.add(dirname(path));
      if (target.extension !== 'md') {
        continue;
      }
      // Keyed by the link as written, `#section` and all — that is what the filter reads.
      noteEmbeds.set(embed.link, path);
      if (!walkedForEmbeds.has(target.path)) {
        walkedForEmbeds.add(target.path);
        collectNoteEmbeds(target, depth + 1);
      }
    }
  };
  try {
    collectNoteEmbeds(currentFile, 1);
  } catch (e) {
    console.error(e);
  }
  // One folder per `--resource-path`, so the separator is never a question: see the presets in export_templates.ts.
  const embedDirs = [...embedFolders].join(PATH_SEPARATOR());

  const variables: Variables = {
    pluginDir,
    luaDir,
    outputDir,
    outputPath,
    outputFileName,
    outputFileFullName,
    currentDir,
    currentPath,
    currentFileName,
    currentFileFullName,
    attachmentFolderPath,
    vaultDir,
    metadata: frontMatter,
    embedDirs,
    // In Obsidian's language rather than the machine's.
    today: today(moment.locale()),
    // Always an object: reading `${options.x}` off nothing would throw while building the command.
    options: options ?? {},
    fromFormat: obsidianConfig.useMarkdownLinks ? 'markdown' : 'markdown+wikilinks_title_after_pipe',
  };

  const showCommandLineOutput = setting.type === 'custom' && setting.showCommandOutput;
  const openExportedFileLocation = setting.openExportedFileLocation ?? globalSetting.openExportedFileLocation;
  const openExportedFile = setting.openExportedFile ?? globalSetting.openExportedFile;

  const files = new FileStore(plugin.app.vault, vaultDir);

  if (showOverwriteConfirmation && (await files.exists(outputPath))) {
    // The desktop asks with the system's own save dialog, which can be answered with another name; a phone has none,
    // so there the question is put plainly and the answer is yes or no.
    const chosen = isDesktop()
      ? await chooseSavePath({ title: t.OVERWRITE_TITLE(outputFileFullName), defaultPath: outputPath })
      : (await confirm(plugin.app, {
            title: t.EXPORT_DIALOG_TITLE,
            message: t.OVERWRITE_TITLE(outputFileFullName),
            accept: t.BUTTON_REPLACE,
          }))
        ? outputPath
        : undefined;

    if (!chosen) {
      return;
    }

    variables.outputPath = chosen;
    variables.outputDir = dirname(chosen);
    variables.outputFileFullName = basename(chosen);
    variables.outputFileName = stem(chosen);
  }

  // Shown for every export: a PDF engine on a long note takes long enough to look stuck.
  beforeExport?.();
  const progress = new PandocProgress();

  // Rendering a `${...}` can fail on a template the editor let through, and the notice is already up by here — so
  // everything from the environment onwards reports through the one handler rather than escaping past it.
  let cmd = '';

  try {
    const env = (variables.env = createEnv(getPlatformValue(globalSetting.env) ?? {}, variables));

    // The embed map goes to `embeds.lua` in the environment, not on the command line: a link is whatever someone
    // typed. Escaped on the way in, and read back escaped by the filter — see `escapeForEnv`.
    const EMBED_ENV_LIMIT = 30000;
    let embedLines = '';
    for (const [link, file] of noteEmbeds) {
      const line = `${escapeForEnv(link)}\t${escapeForEnv(file)}\n`;
      if (embedLines.length + line.length > EMBED_ENV_LIMIT) {
        console.warn(`Too many embedded notes to pass to pandoc; ${link} and any after it are left as they are.`);
        break;
      }
      embedLines += line;
    }
    env['OBSIDIAN_EMBEDS'] = embedLines;

    let pandocPath = pandoc.normalizePath(getPlatformValue(globalSetting.pandocPath));

    if (Platform.isWin) {
      // https://github.com/mokeyish/obsidian-enhancing-export/issues/153
      pandocPath = pandocPath.replaceAll('\\', '/');
      const pathKeys: Array<keyof Variables> = [
        'pluginDir',
        'luaDir',
        'outputDir',
        'outputPath',
        'currentDir',
        'currentPath',
        'attachmentFolderPath',
        'vaultDir',
        'embedDirs',
      ];

      for (const pathKey of pathKeys) {
        variables[pathKey] = (variables[pathKey] as string).replaceAll('\\', '/');
      }
    }

    // Later options win, so least specific first: preset, editor rows, then hand-typed. Filters are the exception —
    // they run where they stand, so `orderLuaFilters` has the last word on the one whose place is not negotiable.
    let cmdTpl =
      setting.type === 'pandoc'
        ? orderLuaFilters(
            [pandocPath, '"${currentPath}"', setting.arguments, setting.customArguments, setting.userArguments]
              .map(part => part?.trim())
              .filter(Boolean)
              .join(' ')
          )
        : setting.command;

    if (setting.type === 'pandoc') {
      let installed: SemVer;
      if (engine !== 'wasm') {
        try {
          installed = await pandoc.getCachedVersion(getPlatformValue(globalSetting.pandocPath), env);
        } catch (e) {
          // Not knowing the version is no reason to stop: the old spelling is the one every version takes.
          console.warn(e);
        }
      }

      // A pandoc that has renamed the highlighting options warns about the old names on every single run. The wasm
      // build is newer than the rename, so there it is the new spelling either way.
      if (engine === 'wasm' || pandoc.takesSyntaxHighlighting(installed)) {
        cmdTpl = renameHighlightFlags(cmdTpl);
      }

      // The math methods are the same story one release on, and this one runs both ways: a template may name `plain`,
      // which only 3.11 can be told about. The wasm build is left out of it — its version is whichever one was
      // downloaded, and the flags never reach it as flags anyway, the translator having turned them into a defaults
      // file that spells the method the one way every build reads.
      if (engine !== 'wasm') {
        cmdTpl = pandoc.takesMathMethod(installed) ? renameMathFlags(cmdTpl) : legacyMathFlags(cmdTpl);
      }
    }

    cmd = renderTemplate(cmdTpl, variables);
    const output = outputArg(cmd);
    if (output === undefined) {
      throw new Error('The command names no output file — check -o in the template.');
    }
    const actualOutputPath = normalize(trimQuotes(output));

    // Pandoc writes into a folder, it does not make one.
    await files.mkdir(dirname(actualOutputPath));

    let warnings: string;
    if (engine === 'wasm') {
      // Bringing the binary up is seconds on the first export of a session, and nothing on every one after it.
      progress.starting();
      const wasm = await plugin.wasm.load();
      const typst = needsTypst ? await plugin.typst.load() : undefined;
      progress.running(variables.outputFileFullName);

      // Everything the run needs has to be put in front of it: the note, what the note reaches, and the embed list
      // that would have gone in the environment.
      const result = await convertWithWasm(wasm, files, {
        command: cmd,
        vaultDir,
        resources: [...embeddedFiles],
        embeds: noteEmbeds,
        typst,
        download,
      });
      // Counted as a warning so the notice finishes orange and the console keeps the detail, but not said again: the
      // export dialog names these before it runs, and the quick export repeats a template that was agreed to there.
      const dropped = result.unsupported.length > 0 ? t.WASM_DROPPED(result.unsupported.join(' ')) : '';
      warnings = [dropped, result.stderr.trim()].filter(Boolean).join('\n\n');
    } else {
      progress.running(variables.outputFileFullName);
      const run = (command: string) => exec(command, { cwd: variables.currentDir, env });
      try {
        const { stderr } = await run(cmd);
        warnings = stderr.trim();
      } catch (err) {
        // The machine has no typst to set the PDF with, and the plugin has one. Pandoc has already done its half of
        // the work — it is asked for the source instead, and the wasm build sets it. Anything else fails as it did.
        if (!(writesTypstPdf(setting) && describeExportFailure(err, cmd).hint === 'typstEngine' && (await plugin.typst.isInstalled()))) {
          throw err;
        }
        progress.starting();
        const typst = await plugin.typst.load();
        progress.running(variables.outputFileFullName);
        warnings = await typesetTypstPdf({
          command: cmd,
          run,
          // Where the export told pandoc to look for what the note names, in the order it told it.
          searchPaths: [variables.currentDir, variables.attachmentFolderPath, ...variables.embedDirs.split(PATH_SEPARATOR())].filter(
            Boolean
          ),
          outputPath: actualOutputPath,
          typst,
          files,
        });
      }
    }

    // Pandoc writes its warnings here and exports the file all the same, so they are reported rather than thrown.
    if (warnings) {
      console.warn(cmd, warnings);
    }

    const next = async () => {
      // Both are the system's to do, and a phone has no system to ask — see `platform.ts`.
      if (openExportedFileLocation) {
        window.setTimeout(() => {
          void showInFolder(actualOutputPath);
        }, 1000);
      }
      if (openExportedFile) {
        await openFile(actualOutputPath);
      }
      onSuccess?.();
    };

    if (showCommandLineOutput) {
      // The box says everything the notice would, and says it until it is closed.
      progress.stop();
      const message = [t.EXPORT_COMMAND_OUTPUT(cmd), warnings].filter(Boolean).join('\n\n');
      const box = new MessageBox(plugin.app, message);
      box.onClose = () => void next();
      box.open();
    } else if (warnings) {
      progress.warn(variables.outputFileFullName);
      await next();
    } else {
      progress.succeed(variables.outputFileFullName);
      await next();
    }
  } catch (err) {
    progress.stop();
    const { detail, recommendation } = describeExportFailure(err, cmd);
    // Only what the reader can act on. The command line stays in the console.
    console.error(cmd, err);
    new MessageBox(plugin.app, {
      title: t.ERROR_TITLE,
      buttons: 'Ok',
      render: contentEl => {
        const root = contentEl.createDiv({ cls: 'ex-export-error' });
        const fact = (label: string, value: string, title?: string) =>
          root.createDiv({ cls: 'ex-export-error-fact' }, el => {
            el.createSpan({ cls: 'ex-export-error-label', text: label });
            el.createSpan({ cls: 'ex-export-error-value', text: value, title: title ?? value });
          });
        fact(t.ERROR_TEMPLATE, setting.name);
        fact(t.ERROR_FILE, variables.outputFileFullName, variables.outputPath);
        root.createDiv({ cls: 'ex-export-error-detail', text: detail });
        if (recommendation) {
          root.createDiv({ cls: 'ex-export-error-hint', text: recommendation });
        }
      },
    }).open();
    onFailure?.();
  }
}
