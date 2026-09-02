/* The document a word processor's export takes its styles from, which is pandoc's own.
 *
 * Pandoc keeps no such file in its repository — it assembles that folder at build time — so it can only be had from a
 * pandoc, and the two engines cannot both be asked.
 *
 * The installed program has `--print-default-data-file`, which hands back the very file it would have used, sample
 * content and all. The wasm build has no way to reach it: it is driven by a defaults file rather than a command line,
 * its `convert` refuses the option as unknown, and its `query` answers for versions and formats and nothing else. So
 * the three files are shipped in the bundle instead, printed from the pandoc named in `BUNDLED_REFERENCE_VERSION` —
 * which is what makes them the same documents on a phone as on a computer, rather than something merely like them.
 */

import { docx, odt, pptx } from './reference_data';
import { exec } from '../system/utils';
import { nodeFs } from '../system/file_store';
import { tempFolder } from '../system/platform';
import { normalizePandocPath } from './pandoc';

/** The writers that read one — `supportsReferenceDoc` in `pandoc_format.ts` says the same thing to the UI. */
export const REFERENCE_FORMATS = ['docx', 'odt', 'pptx'] as const;

export type ReferenceFormat = (typeof REFERENCE_FORMATS)[number];

export const isReferenceFormat = (format?: string): format is ReferenceFormat => REFERENCE_FORMATS.includes(format as ReferenceFormat);

/**
 * The pandoc the bundled documents were printed from.
 *
 * Pandoc changes them between releases, so they are printed again whenever a release is looked at and this is moved to
 * match — see `docs/CONTRIBUTING.md`. It is here rather than in a file beside them so that anything reporting on the
 * bundle can read it.
 */
export const BUNDLED_REFERENCE_VERSION = '3.11';

/** Carried as base64 in a generated module — see `reference_data.ts`; a release ships no file to read. */
const BUNDLED: Record<ReferenceFormat, string> = { docx, odt, pptx };

/** Pandoc's own reference document for `format`, as the plugin carries it. */
export const bundledReferenceDoc = (format: ReferenceFormat): Uint8Array => Uint8Array.from(atob(BUNDLED[format]), c => c.charCodeAt(0));

/**
 * The same document from the pandoc installed on the machine, which is the one its own exports will be styled by —
 * the bundle carries whatever release it was built against, and this carries theirs.
 *
 * It is asked for by the name pandoc keeps it under rather than converted into being, so what comes out is the data
 * file itself. Written to the system's temporary folder first, because the option prints to somewhere and the caller
 * has not been told yet whether it wants what it gets.
 */
export async function referenceDocFromNative(
  format: ReferenceFormat,
  options?: { path?: string; env?: Record<string, string> }
): Promise<Uint8Array> {
  const fs = await nodeFs();
  const folder = await tempFolder();
  if (!folder) {
    throw new Error('There is no Pandoc to run on this device — see the engine setting.');
  }
  // Named for this run alone, so two of them at once cannot write over each other.
  const output = `${folder}/pandoc-gui-reference-${Date.now()}.${format}`;

  try {
    await exec(`${normalizePandocPath(options?.path)} -o "${output}" --print-default-data-file reference.${format}`, {
      env: options?.env,
    });
    return new Uint8Array(await fs.readFile(output));
  } finally {
    // Not wanted once the bytes are read, and its failing to go is not a reason to have no document.
    await fs.rm(output, { force: true }).catch(() => {});
  }
}
