import { exec as execCallback, execSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { promisify } from 'util';
import { DEFAULT_SYNTAX, findQueries, queryKey } from '../../src/convert/dataview';
import { escapeForEnv } from '../../src/convert/export';

const run = promisify(execCallback);

const filter = resolve(import.meta.dirname, '..', '..', 'lua-filters', 'bundled', 'embeds.lua');

const pandocInstalled = (() => {
  try {
    execSync('pandoc --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('findQueries', () => {
  test('finds both kinds of block and inline queries', () => {
    const note = ['```dataview', 'LIST', '```', '', '```dataviewjs', 'dv.list([1])', '```', '', 'Named `= this.file.name` here.'].join(
      '\n'
    );
    expect(findQueries(note).map(({ kind, source }) => [kind, source])).toEqual([
      ['dql', 'LIST'],
      ['js', 'dv.list([1])'],
      ['inline', 'this.file.name'],
    ]);
  });

  test('reads a block inside a callout without its quote markers', () => {
    const note = ['> [!note]', '> ```dataview', '> TABLE file.ctime', '> FROM "x"', '> ```'].join('\n');
    expect(findQueries(note)).toEqual([
      { kind: 'dql', language: 'dataview', code: ' TABLE file.ctime\n FROM "x"', source: ' TABLE file.ctime\n FROM "x"' },
    ]);
  });

  test('leaves a query shown inside another code block alone', () => {
    const note = ['````markdown', '```dataview', 'LIST', '```', '`= 1 + 1`', '````'].join('\n');
    expect(findQueries(note)).toEqual([]);
  });

  test('follows Dataview’s own settings', () => {
    const note = ['```js-dv', 'dv.list([])', '```', '```dataviewjs', 'dv.list([])', '```', '`= 1` and `$= 2`'].join('\n');
    expect(findQueries(note, { ...DEFAULT_SYNTAX, jsKeyword: 'js-dv' }).map(q => q.kind)).toEqual(['js', 'inline']);
    expect(findQueries(note, { ...DEFAULT_SYNTAX, js: false, inline: false })).toEqual([]);
  });

  test('takes tilde fences, and an unclosed fence to the end', () => {
    expect(findQueries('~~~dataview\nLIST\n~~~').map(q => q.source)).toEqual(['LIST']);
    expect(findQueries('```dataview\nLIST').map(q => q.source)).toEqual(['LIST']);
  });
});

describe.skipIf(!pandocInstalled)('embeds.lua, given the rendered queries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pandoc-gui-dataview-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('puts each note’s results where its queries stood', async () => {
    const host = join(dir, 'host.md');
    const embedded = join(dir, 'embedded.md');
    const hostText = [
      '```dataviewjs',
      'if (true) {',
      '\tdv.table(["File"], [[1]])',
      '}',
      '```',
      '',
      'Named `= this.file.name` inline.',
      '',
      '![[embedded]]',
      '',
      '```js',
      'if (true) {',
      '\tdv.table(["File"], [[1]])',
      '}',
      '```',
    ].join('\n');
    const embeddedText = '```dataview\nLIST\n```\n';
    writeFileSync(host, hostText);
    writeFileSync(embedded, embeddedText);

    const results: Array<[note: string, text: string, format: string, body: string]> = [
      ['', hostText, 'html', '<table><tr><th>File</th></tr><tr><td><a class="wikilink" href="Notes/a">A</a></td></tr></table>'],
      ['', hostText, 'markdown', 'HostName'],
      [embedded, embeddedText, 'markdown', '| File |\n| --- |\n| [[Notes/b\\|B]] |\n'],
    ];
    const lines: string[] = [];
    let index = 0;
    for (const [note, text, format, body] of results) {
      const query = findQueries(text)[note === '' && format === 'markdown' ? 1 : 0];
      const path = join(dir, `result-${index++}`);
      writeFileSync(path, body);
      lines.push(`${escapeForEnv(note)}\t${await queryKey(query.language, query.code)}\t${format}\t${escapeForEnv(path)}`);
    }

    const { stdout } = await run(`pandoc -L "${filter}" -t native -f markdown+wikilinks_title_after_pipe "${host}"`, {
      env: { ...process.env, OBSIDIAN_EMBEDS: `embedded\t${escapeForEnv(embedded)}`, OBSIDIAN_DATAVIEW: lines.join('\n') },
    });

    expect({
      table: (stdout.match(/\bTable\b/g) ?? []).length,
      jsLink: stdout.includes('"Notes/a"'),
      inline: stdout.includes('"HostName"'),
      embeddedLink: stdout.includes('"Notes/b"'),
      // The identical `js` block is not a query.
      plainCodeKept: /CodeBlock\s*\(\s*""\s*,\s*\[\s*"js"/.test(stdout),
      queriesLeft: stdout.includes('"dataview'),
    }).toEqual({ table: 2, jsLink: true, inline: true, embeddedLink: true, plainCodeKept: true, queriesLeft: false });
  }, 60_000);
});
