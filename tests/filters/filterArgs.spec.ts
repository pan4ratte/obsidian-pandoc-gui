import {
  FIGURE_DEFAULT_STYLE,
  FILTERS,
  TABLE_DEFAULT_STYLE,
  TODAY_DEFAULT_FORMAT,
  embedNotes,
  embedShiftHeadings,
  figureStyle,
  flattenOrdered,
  keywords,
  keywordsTitle,
  listStyles,
  setEmbedNotes,
  setEmbedShiftHeadings,
  setFigureStyle,
  setFlattenOrdered,
  setKeywords,
  setKeywordsTitle,
  setListStyles,
  setTableHeadStyle,
  setTableStyle,
  setTodayFormat,
  tableHeadStyle,
  tableStyle,
  todayFormat,
} from '../../src/filters/filter_args';
import { luaFilterArg } from '../../src/filters/lua_filters';

/*
 * Each row reads a filter flag and the fields configuring it back as one
 * answer, and writes them back as one. What matters is that the two agree, that
 * the filter is what decides whether a row is on at all, and that a template
 * written by the store's old install button still reads as on — that is the
 * migration.
 */

const FILTER = luaFilterArg(FILTERS.figures);
const OTHER = '--lua-filter="${luaDir}/pagebreak.lua"';

describe('reading a style', () => {
  test('no arguments, or none running the filter, styles nothing', () => {
    expect(figureStyle(undefined)).toBeUndefined();
    expect(figureStyle('')).toBeUndefined();
    expect(figureStyle(OTHER)).toBeUndefined();
  });

  test('the filter on its own means the style it defaults to', () => {
    expect(figureStyle(FILTER)).toBe(FIGURE_DEFAULT_STYLE);
    expect(figureStyle(`${OTHER} ${FILTER}`)).toBe(FIGURE_DEFAULT_STYLE);
  });

  test('a style is read whichever way it was written', () => {
    expect(figureStyle(`${FILTER} -M figure-style=Picture`)).toBe('Picture');
    expect(figureStyle(`${FILTER} -M figure-style=Рисунок`)).toBe('Рисунок');
    expect(figureStyle(`${FILTER} --metadata=figure-style:Picture`)).toBe('Picture');
    expect(figureStyle(`${FILTER} --metadata figure-style=Picture`)).toBe('Picture');
    expect(figureStyle(`${FILTER} -M figure-style="Figure body"`)).toBe('Figure body');
  });

  test('a key with no value of its own is not a style', () => {
    // `-M figure-style` sets the field to true, and the name after it would be
    // an input file rather than a value — so the row falls back to the default.
    expect(figureStyle(`${FILTER} -M figure-style`)).toBe(FIGURE_DEFAULT_STYLE);
  });

  test('a style named without the filter is a field nothing reads', () => {
    // Metadata on its own styles nothing: the filter is what wraps the image.
    expect(figureStyle('-M figure-style=Picture')).toBeUndefined();
  });

  test('the last style wins, as pandoc reads it', () => {
    expect(figureStyle(`${FILTER} -M figure-style=First -M figure-style=Second`)).toBe('Second');
  });
});

describe('writing a style', () => {
  test('switching it on runs the filter and says nothing more', () => {
    // The filter's own default written out would be a line saying what the
    // filter does anyway.
    expect(setFigureStyle(undefined, FIGURE_DEFAULT_STYLE)).toBe(FILTER);
    expect(setFigureStyle('', FIGURE_DEFAULT_STYLE)).toBe(FILTER);
  });

  test('a style of the user’s own is written beside the filter', () => {
    expect(setFigureStyle(undefined, 'Picture')).toBe(`${FILTER} -M figure-style=Picture`);
    expect(setFigureStyle(undefined, 'Figure body')).toBe(`${FILTER} -M figure-style="Figure body"`);
  });

  test('switching it off takes both back out, and closes the gap', () => {
    expect(setFigureStyle(`${FILTER} -M figure-style=Picture`, undefined)).toBe('');
    expect(setFigureStyle(`${OTHER} ${FILTER} -M figure-style=Picture`, undefined)).toBe(OTHER);
    expect(setFigureStyle(OTHER, undefined)).toBe(OTHER);
  });

  test('changing the style replaces it rather than adding a second one', () => {
    expect(setFigureStyle(`${FILTER} -M figure-style=Picture`, 'Plate')).toBe(`${FILTER} -M figure-style=Plate`);
    expect(setFigureStyle(`${FILTER} -M figure-style=Picture`, FIGURE_DEFAULT_STYLE)).toBe(FILTER);
  });

  test('nothing else in the line is disturbed', () => {
    const args = `--reference-doc="C:/styles.docx" ${OTHER} --toc --toc-depth=2`;
    expect(setFigureStyle(args, 'Picture')).toBe(`${args} ${FILTER} -M figure-style=Picture`);
    expect(setFigureStyle(setFigureStyle(args, 'Picture'), undefined)).toBe(args);
  });

  test('what is written is what is read back', () => {
    for (const style of [FIGURE_DEFAULT_STYLE, 'Picture', 'Figure body', 'Рисунок']) {
      expect(figureStyle(setFigureStyle(OTHER, style))).toBe(style);
    }
    expect(figureStyle(setFigureStyle(OTHER, undefined))).toBeUndefined();
  });

  test('a template the store had already set up reads as on, and is not doubled', () => {
    // The migration: the flag is exactly what the store's install button wrote.
    const installed = `--reference-doc="C:/styles.docx" ${FILTER}`;
    expect(figureStyle(installed)).toBe(FIGURE_DEFAULT_STYLE);
    expect(setFigureStyle(installed, 'Picture')).toBe(`${installed} -M figure-style=Picture`);
  });
});

describe('table cell styles', () => {
  const TABLE = luaFilterArg(FILTERS.tableStyles);

  test('off until the filter runs, and then the style it defaults to', () => {
    expect(tableStyle(undefined)).toBeUndefined();
    expect(tableStyle(TABLE)).toBe(TABLE_DEFAULT_STYLE);
    expect(tableStyle(`${TABLE} -M table-text-style="Cell text"`)).toBe('Cell text');
  });

  test('header cells are their own answer, and empty means the same as the rest', () => {
    expect(tableHeadStyle(TABLE)).toBeUndefined();
    const withHead = setTableHeadStyle(TABLE, 'Table Header');
    expect(withHead).toBe(`${TABLE} -M table-head-style="Table Header"`);
    expect(tableHeadStyle(withHead)).toBe('Table Header');
    expect(tableHeadStyle(setTableHeadStyle(withHead, ''))).toBeUndefined();
  });

  test('switching the row off clears both fields, not just the filter', () => {
    // A style named for a filter that is not running is an answer to a question
    // nobody can see.
    const on = setTableHeadStyle(setTableStyle(undefined, 'Cell text'), 'Table Header');
    expect(setTableStyle(on, undefined)).toBe('');
  });

  test('a head style set without the filter is not reported', () => {
    expect(tableHeadStyle('-M table-head-style="Table Header"')).toBeUndefined();
  });
});

describe('word list styles', () => {
  const LISTS = luaFilterArg(FILTERS.listStyles);

  test('the filter is the switch', () => {
    expect(listStyles(undefined)).toBe(false);
    expect(setListStyles(undefined, true)).toBe(LISTS);
    expect(listStyles(LISTS)).toBe(true);
    expect(setListStyles(LISTS, false)).toBe('');
  });

  test('numbered lists are a second answer, written only when it is yes', () => {
    expect(flattenOrdered(LISTS)).toBe(false);
    const flat = setFlattenOrdered(LISTS, true);
    expect(flat).toBe(`${LISTS} -M list-flatten-ordered=true`);
    expect(flattenOrdered(flat)).toBe(true);
    expect(setFlattenOrdered(flat, false)).toBe(LISTS);
  });

  test('it goes when the row does, and is not read without it', () => {
    expect(setListStyles(setFlattenOrdered(LISTS, true), false)).toBe('');
    expect(flattenOrdered('-M list-flatten-ordered=true')).toBe(false);
  });
});

describe('keywords', () => {
  const KEYWORDS = luaFilterArg(FILTERS.keywords);

  test('a switch and a label, the label only while the switch is on', () => {
    expect(keywords(undefined)).toBe(false);
    expect(setKeywords(undefined, true)).toBe(KEYWORDS);
    expect(keywordsTitle(KEYWORDS)).toBeUndefined();
    const labelled = setKeywordsTitle(KEYWORDS, 'Ключевые слова:');
    expect(keywordsTitle(labelled)).toBe('Ключевые слова:');
    expect(setKeywords(labelled, false)).toBe('');
  });
});

describe("today's date", () => {
  const TODAY = luaFilterArg(FILTERS.today);

  test('the form chosen is the variable written, and it is always quoted', () => {
    // Quoted because what it stands for is a date, and dates have spaces.
    expect(setTodayFormat(undefined, 'long')).toBe(`${TODAY} -M today="\${today.long}"`);
    expect(setTodayFormat(undefined, 'iso')).toBe(`${TODAY} -M today="\${today.iso}"`);
  });

  test('what is written is what is read back', () => {
    for (const format of ['long', 'medium', 'short', 'iso'] as const) {
      expect(todayFormat(setTodayFormat(undefined, format))).toBe(format);
    }
  });

  test('no filter means no date, and a filter alone means the default form', () => {
    expect(todayFormat(undefined)).toBeUndefined();
    expect(todayFormat('-M today="${today.iso}"')).toBeUndefined();
    expect(todayFormat(TODAY)).toBe(TODAY_DEFAULT_FORMAT);
  });

  test('choosing none takes the filter and the field back out', () => {
    expect(setTodayFormat(setTodayFormat(undefined, 'medium'), undefined)).toBe('');
  });
});

describe('embedded notes', () => {
  const EMBEDS = luaFilterArg(FILTERS.embeds);

  test('one filter, and a field under it', () => {
    expect(embedNotes(undefined)).toBe(false);
    expect(setEmbedNotes(undefined, true)).toBe(EMBEDS);
    expect(embedNotes(EMBEDS)).toBe(true);
    expect(setEmbedNotes(EMBEDS, false)).toBe('');
  });

  test('heading levels are a second answer, written only when it is yes', () => {
    expect(embedShiftHeadings(EMBEDS)).toBe(false);
    const fitted = setEmbedShiftHeadings(EMBEDS, true);
    expect(fitted).toBe(`${EMBEDS} -M embed-shift-headings=true`);
    expect(embedShiftHeadings(fitted)).toBe(true);
    expect(setEmbedShiftHeadings(fitted, false)).toBe(EMBEDS);
  });

  test('it goes when the row does, and is not read without it', () => {
    expect(setEmbedNotes(setEmbedShiftHeadings(EMBEDS, true), false)).toBe('');
    expect(embedShiftHeadings('-M embed-shift-headings=true')).toBe(false);
  });

  test('the rows keep out of each other’s way', () => {
    let args = setEmbedNotes(undefined, true);
    args = setFigureStyle(args, 'Picture');
    args = setTodayFormat(args, 'iso');
    expect(embedNotes(args)).toBe(true);
    expect(figureStyle(args)).toBe('Picture');
    expect(todayFormat(args)).toBe('iso');
    // And switching one off leaves the others exactly as they were.
    const withoutToday = setTodayFormat(args, undefined);
    expect(embedNotes(withoutToday)).toBe(true);
    expect(figureStyle(withoutToday)).toBe('Picture');
    expect(todayFormat(withoutToday)).toBeUndefined();
  });
});
