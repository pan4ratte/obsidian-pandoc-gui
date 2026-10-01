import { linkTarget, namedDocuments, propertyLinks, shownDocuments, templatePaths } from '../../src/convert/joined_docs';
import type { PandocExportSetting } from '../../src/settings';

describe('a link in a property', () => {
  test.each([
    ['[[Title page.docx]]', 'Title page.docx'],
    ['[[Templates/Title page.docx|title]]', 'Templates/Title page.docx'],
    ['![[Title page.docx]]', 'Title page.docx'],
    ['[title](Templates/Title%20page.docx)', 'Templates/Title page.docx'],
    ['[title](<Templates/Title page.docx>)', 'Templates/Title page.docx'],
    ['Templates/Title page.docx', 'Templates/Title page.docx'],
    ['  C:/Documents/title.docx ', 'C:/Documents/title.docx'],
  ])('%s names %s', (written, path) => {
    expect(linkTarget(written)).toBe(path);
  });

  test('a list names each of its documents, and an empty value names none', () => {
    expect(propertyLinks(['[[A.docx]]', '[[B.docx]]'])).toEqual(['A.docx', 'B.docx']);
    expect(propertyLinks('')).toEqual([]);
    expect(propertyLinks(null)).toEqual([]);
    expect(propertyLinks([' ', 42])).toEqual([]);
  });
});

describe('which documents an export joins', () => {
  const template = { joinBefore: ['${vaultDir}/Templates/Title.docx'], joinAfter: ['Appendix A.docx', 'Appendix B.docx'] };
  const variables = { vaultDir: '/vault' };

  test("the template's, in order, with their variables filled in", () => {
    expect(namedDocuments(template, { title: 'Paper' }, variables)).toEqual({
      before: ['/vault/Templates/Title.docx'],
      after: ['Appendix A.docx', 'Appendix B.docx'],
    });
  });

  test("the note's own property wins on its side, and the other side stays the template's", () => {
    expect(namedDocuments(template, { 'docx-before': '[[My title.docx]]' }, variables)).toEqual({
      before: ['My title.docx'],
      after: ['Appendix A.docx', 'Appendix B.docx'],
    });
  });

  test('an empty property turns the template’s documents off for that note', () => {
    expect(namedDocuments(template, { 'docx-after': null }, variables)).toEqual({
      before: ['/vault/Templates/Title.docx'],
      after: [],
    });
  });

  test("the export dialog's list wins over the note and the template, and an empty one joins nothing", () => {
    const chosen = { ...template, joinChosen: { before: ['${vaultDir}/Other.docx', 'Cover.docx'], after: [] as string[] } };
    expect(namedDocuments(chosen, { 'docx-before': '[[My title.docx]]' }, variables)).toEqual({
      before: ['/vault/Other.docx', 'Cover.docx'],
      after: [],
    });
  });

  test('the dialog starts from what the note names, or else the template', () => {
    expect(shownDocuments(template, { 'docx-after': ['[[A.docx]]', '[[B.docx]]'] })).toEqual({
      before: ['${vaultDir}/Templates/Title.docx'],
      after: ['A.docx', 'B.docx'],
    });
    expect(shownDocuments({}, { 'docx-before': null })).toEqual({ before: [], after: [] });
  });

  test('a template saved with a single path reads as a list of one', () => {
    const old = { joinBefore: ' Title.docx ' } as unknown as PandocExportSetting;
    expect(templatePaths(old, 'before')).toEqual(['Title.docx']);
    expect(templatePaths(old, 'after')).toEqual([]);
  });

  test('nothing named anywhere joins nothing', () => {
    expect(namedDocuments({}, undefined, variables)).toEqual({ before: [], after: [] });
  });
});
