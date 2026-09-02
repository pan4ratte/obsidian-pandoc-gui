/*
 * The reference documents: the three the bundle carries, and the three the installed pandoc prints.
 *
 * Both have the same thing to answer for — being pandoc's own data file rather than something like it — so both are
 * checked against the file itself. The bundled ones are checked against what is in the repository; the printed ones
 * need a pandoc on the machine, and are skipped where there is none.
 */

import { execSync } from 'child_process';
import { readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { vi } from 'vitest';
import {
  BUNDLED_REFERENCE_VERSION,
  bundledReferenceDoc,
  isReferenceFormat,
  REFERENCE_FORMATS,
  referenceDocFromNative,
} from '../../src/pandoc/reference_doc';

// Electron is not there to be asked for the system's temporary folder outside Obsidian; node knows the same answer.
vi.mock('../../src/system/platform', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/system/platform')>()),
  tempFolder: () => Promise.resolve(tmpdir()),
}));

describe('the formats that take one', () => {
  test('are the three a word processor reads', () => {
    expect([...REFERENCE_FORMATS]).toEqual(['docx', 'odt', 'pptx']);
  });

  test('and nothing else answers to the name', () => {
    expect(['docx', 'odt', 'pptx'].every(isReferenceFormat)).toBe(true);
    expect(['latex', 'html', '', undefined].some(isReferenceFormat)).toBe(false);
  });
});

describe('the documents the bundle carries', () => {
  test.each([...REFERENCE_FORMATS])('the %s is the file in the repository, byte for byte', format => {
    const onDisk = readFileSync(join(import.meta.dirname, '..', '..', 'reference-docs', `reference.${format}`));
    const bundled = bundledReferenceDoc(format);
    // Said as three answers rather than one, so a mismatch says whether it is the wrong file or the wrong bytes.
    expect({
      zip: new TextDecoder().decode(bundled.slice(0, 2)),
      length: bundled.byteLength,
      same: Buffer.from(bundled).equals(onDisk),
    }).toEqual({ zip: 'PK', length: onDisk.byteLength, same: true });
  });

  test('and the pandoc they were printed from is named', () => {
    expect(BUNDLED_REFERENCE_VERSION).toMatch(/^\d+\.\d+/);
  });
});

const pandocInstalled = (() => {
  try {
    execSync('pandoc --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/**
 * What a zip holds, by entry name, as the bytes each is stored as.
 *
 * Compared this way rather than whole because pandoc assembles these documents when it is asked for one rather than
 * keeping them ready-made, and stamps every entry with the clock as it does: two prints a second apart are the same
 * length and the same content, and differ in the headers alone. What the entries hold is the document; when they were
 * written is not. Read the way `src/wasm/zip.ts` reads one, which is the same format for the same reason.
 */
const entriesOf = (archive: Buffer): Record<string, string> => {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  // The end record is 22 bytes plus a comment of up to 64 KB, and is found by walking back from the end.
  let eocd = view.byteLength - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) {
    eocd -= 1;
  }
  expect(eocd).toBeGreaterThanOrEqual(0);

  const found: Record<string, string> = {};
  let at = view.getUint32(eocd + 16, true);
  for (let i = view.getUint16(eocd + 10, true); i > 0; i -= 1) {
    const compressed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localAt = view.getUint32(at + 42, true);
    const name = archive.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    // The local header repeats the name and can carry different extra fields, so its own lengths are the ones to use.
    const start = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
    found[name] = archive.subarray(start, start + compressed).toString('base64');
    at += 46 + nameLength + extraLength + commentLength;
  }
  return found;
};

describe.skipIf(!pandocInstalled)('the document the installed pandoc writes', () => {
  /** The same file asked for at the command line, which is the whole of what this has to match. */
  const printed = (format: string): Buffer => {
    const path = join(tmpdir(), `pandoc-gui-expected-${Date.now()}.${format}`);
    try {
      execSync(`pandoc -o "${path}" --print-default-data-file reference.${format}`, { stdio: 'ignore' });
      return readFileSync(path);
    } finally {
      rmSync(path, { force: true });
    }
  };

  test.each([...REFERENCE_FORMATS])(
    'is the %s `--print-default-data-file` prints, entry for entry',
    async format => {
      const written = await referenceDocFromNative(format);
      const expected = printed(format);
      expect({ zip: new TextDecoder().decode(written.slice(0, 2)), entries: entriesOf(Buffer.from(written)) }).toEqual({
        zip: 'PK',
        entries: entriesOf(expected),
      });
    },
    60_000
  );

  test('and leaves nothing of its own behind', async () => {
    const left = () => readdirSync(tmpdir()).filter(name => name.startsWith('pandoc-gui-reference-'));
    await referenceDocFromNative('docx');
    expect(left()).toEqual([]);
  }, 60_000);
});
