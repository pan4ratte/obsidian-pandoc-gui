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
    'is the %s `--print-default-data-file` prints, byte for byte',
    async format => {
      const written = await referenceDocFromNative(format);
      const expected = printed(format);
      // Said as three answers rather than one, so a mismatch says whether it is the wrong file or the wrong bytes.
      expect({
        zip: new TextDecoder().decode(written.slice(0, 2)),
        length: written.byteLength,
        same: Buffer.from(written).equals(expected),
      }).toEqual({ zip: 'PK', length: expected.byteLength, same: true });
    },
    60_000
  );

  test('and leaves nothing of its own behind', async () => {
    const left = () => readdirSync(tmpdir()).filter(name => name.startsWith('pandoc-gui-reference-'));
    await referenceDocFromNative('docx');
    expect(left()).toEqual([]);
  }, 60_000);
});
