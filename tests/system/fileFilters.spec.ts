/*
 * What a row that names its kinds will take.
 *
 * The file dialogs have always named them, but a path is as often typed as chosen and a phone has no dialog at all —
 * so a reference document arrived as a PDF, a bibliography as a note, and the export failed with whatever pandoc made
 * of a file it could not read. `FileInput` asks this before it writes the path into the template.
 */

import { acceptedExtensions, acceptsFile } from '../../src/system/platform';

const REFERENCE_DOCS = [{ name: 'Reference document', extensions: ['docx', 'dotx'] }];
const ANY_FILE = [{ name: 'All files', extensions: ['*'] }];

describe('the extensions a set of filters names', () => {
  test('are the ones it names', () => {
    expect(acceptedExtensions(REFERENCE_DOCS)).toEqual(['docx', 'dotx']);
  });

  test('are nothing at all where the row takes anything', () => {
    expect(acceptedExtensions(ANY_FILE)).toBeUndefined();
    expect(acceptedExtensions([...REFERENCE_DOCS, ...ANY_FILE])).toBeUndefined();
    expect(acceptedExtensions([])).toBeUndefined();
    expect(acceptedExtensions(undefined)).toBeUndefined();
  });
});

describe('a path against them', () => {
  test('is taken where it names one of the kinds', () => {
    expect(acceptsFile('C:/Users/me/reference.docx', REFERENCE_DOCS)).toBe(true);
    // A word processor's own template is a document as far as pandoc is concerned — it reads the container, not the name.
    expect(acceptsFile('/home/me/house-style.dotx', REFERENCE_DOCS)).toBe(true);
  });

  test('is turned away where it names another', () => {
    expect(acceptsFile('C:/Users/me/report.pdf', REFERENCE_DOCS)).toBe(false);
    expect(acceptsFile('/home/me/notes.md', REFERENCE_DOCS)).toBe(false);
    // The extension Word writes its old documents with, which pandoc cannot read at all.
    expect(acceptsFile('/home/me/template.doc', REFERENCE_DOCS)).toBe(false);
  });

  test('is judged by the extension however it is written', () => {
    expect(acceptsFile('C:/Users/me/REFERENCE.DOCX', REFERENCE_DOCS)).toBe(true);
    expect(acceptsFile('  ~/styles.docx  ', REFERENCE_DOCS)).toBe(true);
    // The path the generate button writes, which is resolved at export and has to pass here first.
    expect(acceptsFile('${pluginDir}/reference/custom-reference.docx', REFERENCE_DOCS)).toBe(true);
    // What the dialog hands back on Windows, which is where most of this is typed.
    expect(acceptsFile('C:\\Users\\me\\Мой шаблон.docx', REFERENCE_DOCS)).toBe(true);
    expect(acceptsFile('C:\\Users\\me\\Мой шаблон.pdf', REFERENCE_DOCS)).toBe(false);
  });

  test('with no extension at all is turned away too', () => {
    expect(acceptsFile('/home/me/reference', REFERENCE_DOCS)).toBe(false);
    // A folder in a dotted path is not the file's own extension.
    expect(acceptsFile('/home/me/2.5/reference', REFERENCE_DOCS)).toBe(false);
  });

  test('is taken where the row names no kind, whatever it is', () => {
    expect(acceptsFile('/home/me/anything.zzz', ANY_FILE)).toBe(true);
    expect(acceptsFile('/home/me/anything.zzz', [])).toBe(true);
    expect(acceptsFile('/home/me/anything.zzz', undefined)).toBe(true);
  });

  test('is taken where there is none: an empty field is a row being cleared', () => {
    expect(acceptsFile('', REFERENCE_DOCS)).toBe(true);
    expect(acceptsFile('   ', REFERENCE_DOCS)).toBe(true);
  });
});
