import { readFileSync } from 'fs';
import path from 'path';
import en from '../../src/lang/en';
import ru from '../../src/lang/ru';

/*
 * The two locales are read side by side, so a key sits on the same line in both. Prettier is told to keep every string
 * on one line however long the translation (see `.prettierrc`); this is what notices a key added to one file only.
 */

const read = (locale: string) =>
  readFileSync(path.join(import.meta.dirname, '..', '..', 'src', 'lang', `${locale}.ts`), 'utf8').split(/\r?\n/);

/** What a line holds, ignoring the value: an indented key, a comment, or nothing — a blank line trims to nothing. */
const shape = (line: string) => {
  const key = /^(\s*)'?([A-Za-z0-9_-]+)'?:/.exec(line);
  return key ? `${key[1].length}:${key[2]}` : line.trim().replace(/^\/\/.*/, '//');
};

const keys = (o: Record<string, unknown>): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? [k, ...keys(v as Record<string, unknown>).map(n => `${k}.${n}`)] : [k]
  );

describe('locales', () => {
  test('every key is on the same line in both files', () => {
    const [enLines, ruLines] = [read('en'), read('ru')];
    expect(ruLines.map(shape)).toEqual(enLines.map(shape));
  });

  test('neither locale has a key the other does not, in the same order', () => {
    expect(keys(ru)).toEqual(keys(en));
  });
});
