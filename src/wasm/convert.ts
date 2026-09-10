/* Running a rendered pandoc command line through the wasm build.
 *
 * The command is the same one the installed pandoc would have been given: this reads it, gathers every file it names
 * into the wasm build's file system, converts, and writes what came out back where the command said it goes.
 */

import type { FileStore } from '../system/file_store';
import { commandToDefaults, readablePaths, rewritePaths } from './defaults';
import { VirtualPaths } from './paths';
import { dirname, resolve } from '../system/paths';
import type { PandocWasm, WasmFiles } from './runtime';
import type { TypstWasm } from './typst';
import { fetchRemote, withRemoteFilter, type Download } from './remote';

export interface WasmConversion {
  /** The command as `exportNote` rendered it. */
  command: string;
  /** Typst, where the export is one that ends in it — a PDF. */
  typst?: TypstWasm;
  /** How to reach the network, which the wasm build cannot: what an image named by URL is fetched with. */
  download?: Download;
  /** The vault's own folder on the machine, which the virtual file system is laid out around. */
  vaultDir: string;
  /** The folder the command would have run in, which any path it writes relatively is read against. */
  cwd?: string;
  /** Files to put in reach that the command does not name — the note's images, and the notes it embeds. */
  resources?: readonly string[];
  /**
   * The embedded notes, as the link written against the file it resolves to. `embeds.lua` is handed this list in the
   * environment when pandoc is a program; here it is written into a file, with each path moved to where the file
   * actually ended up.
   */
  embeds?: Iterable<readonly [string, string]>;
  /** The Excalidraw drawings, as the link written against the image it was drawn into. Passed as the embeds are. */
  drawings?: Iterable<readonly [string, string]>;
}

/** Where `embeds.lua` looks for the two lists when there is no environment to read them from. */
const EMBED_LIST = '.obsidian-embeds';
const DRAWING_LIST = '.obsidian-drawings';

export interface WasmConversionResult {
  /** Everything pandoc wrote, by the path on the machine it belongs at. */
  written: string[];
  /** What pandoc said on the side, in the shape the native run reports it. */
  stderr: string;
  /** Options this build has no answer for, which the caller reports rather than fails on. */
  unsupported: string[];
}

const decoder = new TextDecoder('utf-8');
const encoder = new TextEncoder();

/** The files a run was handed, as bytes — the embed list is written as text, and typst is handed the same map. */
const asBytes = (files: WasmFiles): Record<string, Uint8Array> =>
  Object.fromEntries(Object.entries(files).map(([path, data]) => [path, typeof data === 'string' ? encoder.encode(data) : data]));

/** Warnings pandoc reports as data, put back into the one line of text the rest of the plugin reads. */
const asText = (warnings: unknown[]): string =>
  warnings
    .map(warning => {
      const { pretty, message, type } = (warning ?? {}) as { pretty?: string; message?: string; type?: string };
      return pretty ?? message ?? type;
    })
    .filter(Boolean)
    .join('\n');

/** Only what a reader would want to know: the notes pandoc logs about resources it did find are not warnings. */
const worthReporting = (warnings: unknown[]): unknown[] =>
  warnings.filter(warning => (warning as { verbosity?: string })?.verbosity !== 'INFO');

export async function convertWithWasm(pandoc: PandocWasm, store: FileStore, request: WasmConversion): Promise<WasmConversionResult> {
  const { defaults, inputFiles, unsupported } = commandToDefaults(request.command);
  const paths = new VirtualPaths(request.vaultDir);
  // A command runs somewhere, and anything it names relatively is named against that somewhere.
  const cwd = request.cwd ?? request.vaultDir;
  const file = (path: string) => paths.file(resolve(cwd, path));
  const directory = (path: string) => paths.directory(resolve(cwd, path));

  const output = typeof defaults['output-file'] === 'string' ? defaults['output-file'] : undefined;
  if (output) {
    // The folder is mapped before the file so what pandoc writes beside the output can be traced back to it.
    directory(dirname(resolve(cwd, output)));
  }
  rewritePaths(defaults, { file, directory });

  // The note being read is named on its own, ahead of the options.
  const inputs = inputFiles.map(input => file(input));
  if (inputs.length > 0) {
    defaults['input-files'] = inputs;
  }

  const files: WasmFiles = {};
  const load = async (real: string, virtual: string) => {
    const bytes = await store.read(real);
    if (bytes) {
      files[virtual] = bytes;
    }
  };

  await Promise.all([
    ...inputFiles.map(input => load(resolve(cwd, input), file(input))),
    ...readablePaths(defaults).map(async virtual => {
      const real = paths.toReal(virtual);
      if (real) {
        await load(real, virtual);
      }
    }),
    ...(request.resources ?? []).map(resource => load(resource, file(resource))),
  ]);

  const embeds = [...(request.embeds ?? [])];
  if (embeds.length > 0) {
    files[EMBED_LIST] = embeds.map(([link, note]) => `${link}\t${file(note)}\n`).join('');
  }

  const drawings = [...(request.drawings ?? [])];
  if (drawings.length > 0) {
    files[DRAWING_LIST] = drawings.map(([link, image]) => `${link}\t${file(image)}\n`).join('');
  }

  // What the note names by URL, fetched here because nothing inside the run can fetch anything.
  const remote = request.download ? await fetchRemote(files, request.download) : { files: {}, warnings: [] };
  if (Object.keys(remote.files).length > 0) {
    Object.assign(files, remote.files);
    withRemoteFilter(defaults);
  }

  /**
   * A PDF is made in two steps: pandoc writes typst source, typst sets it. Only the PDF reaches the disk — the source
   * is written where the PDF will stand, so that an `image("a.png")` in it still finds the note's own image.
   */
  const target = typeof defaults['output-file'] === 'string' ? defaults['output-file'] : undefined;
  const source = target && defaults.to === 'typst' && target.toLowerCase().endsWith('.pdf') ? `${target.slice(0, -4)}.typ` : undefined;
  if (source) {
    defaults['output-file'] = source;
  }

  const result = pandoc.run(defaults, inputs.length === 0 ? '' : undefined, files);

  const produced: Record<string, Uint8Array> = { ...result.files };
  let typeset = '';
  if (source && target) {
    const written = produced[source];
    delete produced[source];
    if (!request.typst) {
      throw new Error('A PDF was asked for, and typst was not handed over to make it with');
    }
    // Typst sees what pandoc saw: the note's images, and anything the run itself produced beside them.
    const { pdf, diagnostics } = await request.typst.compile(source, decoder.decode(written ?? new Uint8Array()), {
      ...asBytes(files),
      ...produced,
    });
    typeset = diagnostics;
    if (!pdf) {
      throw new Error([result.stderr.trim(), diagnostics].filter(Boolean).join('\n') || 'Typst wrote no PDF, and said nothing about why');
    }
    produced[target] = pdf;
  }

  const written: string[] = [];
  await Promise.all(
    Object.entries(produced).map(async ([virtual, bytes]) => {
      const real = paths.toReal(virtual);
      if (real) {
        await store.write(real, bytes);
        written.push(real);
      }
    })
  );

  // Nothing written and something said about it is the shape of a failure; pandoc reports those on stderr.
  const complaint = result.stderr.trim();
  if (written.length === 0 && output && complaint) {
    throw new Error(complaint);
  }

  return {
    written,
    stderr: [complaint, typeset, ...remote.warnings, asText(worthReporting(result.warnings))].filter(Boolean).join('\n'),
    unsupported,
  };
}
