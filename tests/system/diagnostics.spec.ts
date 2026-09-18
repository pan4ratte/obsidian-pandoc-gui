import { formatReport } from '../../src/system/diagnostics';

describe('formatReport', () => {
  test('writes the lines and fences the blocks', () => {
    const text = formatReport(
      'Export failed',
      [{ label: 'Template', value: 'PDF' }],
      [
        { label: 'Command', text: 'pandoc a.md -o a.pdf', lang: 'sh' },
        { label: 'Output', text: undefined },
      ]
    );
    expect(text).toBe('### Export failed\n\n* **Template:** PDF\n\n**Command**\n\n```sh\npandoc a.md -o a.pdf\n```');
  });

  test('outlasts backticks in the text', () => {
    const text = formatReport('Warnings', [], [{ label: 'Output', text: 'a ```` b' }]);
    expect(text).toContain('`````\na ```` b\n`````');
  });

  test('hides the home folder in either slash', () => {
    const home = process.env['USERPROFILE'] ?? process.env['HOME'];
    if (!home) {
      return;
    }
    const text = formatReport(
      'Report',
      [{ label: 'File', value: `${home}/note.pdf` }],
      [{ label: 'Command', text: `pandoc "${home.replaceAll('\\', '/')}/a.md"` }]
    );
    expect(text).not.toContain(home);
    expect(text).not.toContain(home.replaceAll('\\', '/'));
    expect(text).toContain('~/note.pdf');
  });
});
