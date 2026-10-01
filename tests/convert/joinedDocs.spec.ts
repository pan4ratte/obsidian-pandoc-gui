import { linkTarget, namedDocuments, propertyLinks } from '../../src/convert/joined_docs';

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
  const template = { joinBefore: '${vaultDir}/Templates/Title.docx', joinAfter: 'Appendix.docx' };
  const variables = { vaultDir: '/vault' };

  test("the template's, with its variables filled in", () => {
    expect(namedDocuments(template, { title: 'Paper' }, variables)).toEqual({
      before: ['/vault/Templates/Title.docx'],
      after: ['Appendix.docx'],
    });
  });

  test("the note's own property wins on its side, and the other side stays the template's", () => {
    expect(namedDocuments(template, { 'docx-before': '[[My title.docx]]' }, variables)).toEqual({
      before: ['My title.docx'],
      after: ['Appendix.docx'],
    });
  });

  test('an empty property turns the template’s document off for that note', () => {
    expect(namedDocuments(template, { 'docx-after': null }, variables)).toEqual({
      before: ['/vault/Templates/Title.docx'],
      after: [],
    });
  });

  test('nothing named anywhere joins nothing', () => {
    expect(namedDocuments({}, undefined, variables)).toEqual({ before: [], after: [] });
  });
});
