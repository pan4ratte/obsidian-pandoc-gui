import { readFile } from 'fs/promises';
import path from 'path';
import { convert, testConversion } from '../common';

test('test math-block parsing', async () => {
  await testConversion('math-block', 'math_block');
});

test('test math-block-01 parsing', async () => {
  await testConversion('math-block-01', 'math_block');
});

test('test math-block-01-no-empty-lines parsing', async () => {
  await testConversion('math-block-01-no-empty-lines', 'math_block');
});

/** Display math as pandoc 3.12 reads it: older versions kept the newlines just inside `$$`. */
const trimmedMath = (native: string) => native.replace(/(DisplayMath\s+")(?:\\n| )*([^"]*?)(?:\\n| )*"/g, '$1$2"');

test('test math-block-01-no-empty-lines parsing filter off', async () => {
  const expected = await readFile(path.join(import.meta.dirname, '..', 'markdowns', 'math-block-01-no-empty-lines.out'), 'utf-8');
  expect(trimmedMath(await convert('math-block-01-no-empty-lines'))).toBe(expected);
});
