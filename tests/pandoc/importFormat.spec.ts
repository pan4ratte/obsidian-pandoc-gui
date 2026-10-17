import {
  DEFAULT_MARKDOWN_FLAVOUR,
  IMPORT_EXTENSIONS,
  MARKDOWN_FLAVOURS,
  readerFor,
  supportsExtractMedia,
  supportsMetadata,
  supportsStripComments,
  supportsTabStop,
  supportsTrackChanges,
  writerFor,
} from '../../src/pandoc/import_format';

/*
 * The import dialog asks its questions of the reader the chosen file names, so what matters is that a file is read as
 * the right thing and that a reader is asked only what it can answer.
 */

describe('the reader a file names', () => {
  test('by its extension, whatever case it is written in', () => {
    expect(readerFor('/home/mark/Thesis.docx')).toBe('docx');
    expect(readerFor('C:\\Docs\\Thesis.DOCX')).toBe('docx');
  });

  test('the several spellings of a format come to the one reader', () => {
    expect(readerFor('page.html')).toBe('html');
    expect(readerFor('page.htm')).toBe('html');
    expect(readerFor('page.xhtml')).toBe('html');
    expect(readerFor('paper.tex')).toBe('latex');
    expect(readerFor('paper.latex')).toBe('latex');
  });

  test('flat ODT has a reader of its own', () => {
    expect(readerFor('Thesis.fodt')).toBe('fodt');
  });

  test('a format pandoc writes but cannot read is not offered', () => {
    expect(readerFor('slides.pptx')).toBeUndefined();
    expect(readerFor('notes.pdf')).toBeUndefined();
    expect(readerFor('page.adoc')).toBeUndefined();
  });

  test('a file with no extension, or none at all, names nothing', () => {
    expect(readerFor('Makefile')).toBeUndefined();
    expect(readerFor('')).toBeUndefined();
    expect(readerFor(undefined)).toBeUndefined();
  });

  test('a folder in the path is not mistaken for the file’s own extension', () => {
    expect(readerFor('/home/mark/v1.2/notes')).toBeUndefined();
  });

  test('every extension the dialog offers is one the reader lookup answers', () => {
    for (const extension of IMPORT_EXTENSIONS) {
      expect(readerFor(`file.${extension}`)).toBeTruthy();
    }
  });
});

describe('the markdown a note is written in', () => {
  test('the one Obsidian’s own is built on stands first', () => {
    expect(DEFAULT_MARKDOWN_FLAVOUR).toBe('gfm');
  });

  test('gfm is written without GitHub’s maths, which Obsidian does not render', () => {
    expect(writerFor('gfm')).toBe('gfm-tex_math_gfm');
  });

  test('every other flavour is asked for by its own name', () => {
    for (const flavour of MARKDOWN_FLAVOURS.filter(f => f !== 'gfm')) {
      expect(writerFor(flavour)).toBe(flavour);
    }
  });
});

describe('what a reader can be asked', () => {
  test('tracked changes are Word’s alone', () => {
    expect(supportsTrackChanges('docx')).toBe(true);
    expect(supportsTrackChanges('odt')).toBe(false);
    expect(supportsTrackChanges(undefined)).toBe(false);
  });

  test('images come out of documents that carry them, not out of a bibliography', () => {
    expect(supportsExtractMedia('docx')).toBe(true);
    expect(supportsExtractMedia('html')).toBe(true);
    expect(supportsExtractMedia('biblatex')).toBe(false);
    expect(supportsExtractMedia('csv')).toBe(false);
  });

  test('a tab stop only means something where the source was typed', () => {
    expect(supportsTabStop('markdown')).toBe(true);
    expect(supportsTabStop('latex')).toBe(true);
    expect(supportsTabStop('docx')).toBe(false);
    expect(supportsTabStop('fodt')).toBe(false);
    expect(supportsTabStop('epub')).toBe(false);
  });

  test('comments are stripped out of the three formats that write them', () => {
    expect(supportsStripComments('markdown')).toBe(true);
    expect(supportsStripComments('html')).toBe(true);
    expect(supportsStripComments('textile')).toBe(true);
    expect(supportsStripComments('docx')).toBe(false);
  });

  test('a table has no title, author or date to keep', () => {
    expect(supportsMetadata('docx')).toBe(true);
    expect(supportsMetadata('csv')).toBe(false);
    expect(supportsMetadata('native')).toBe(false);
  });
});
