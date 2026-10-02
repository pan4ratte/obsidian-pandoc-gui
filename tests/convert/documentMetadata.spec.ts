import { exec as execCallback, execSync } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { hasDocumentMetadata, metadataFileArg, metadataFileContents, setDocumentField } from '../../src/convert/document_metadata';
import { renderTemplate } from '../../src/templates/template';

const run = promisify(execCallback);

const asIs = (value: string) => value;

describe('the metadata file', () => {
  test('authors and keywords are written as lists, the rest as text', () => {
    const meta = JSON.parse(
      metadataFileContents({ title: 'Report', author: ['Ann Lee', 'Bo Chan'], keywords: ['finance', ' '], subject: 'Results' }, asIs)
    ) as unknown;
    expect(meta).toEqual({ title: 'Report', author: ['Ann Lee', 'Bo Chan'], keywords: ['finance'], subject: 'Results' });
  });

  test('a single keyword is still a list, which is what Word reads', () => {
    expect(JSON.parse(metadataFileContents({ keywords: ['finance'] }, asIs))).toEqual({ keywords: ['finance'] });
  });

  test('empty fields are left out', () => {
    expect(JSON.parse(metadataFileContents({ title: '  ', subtitle: '', author: [] }, asIs))).toEqual({});
  });

  test('quotes, dollars and paragraphs survive', () => {
    const abstract = 'He said "hi" for $5.\n\nSecond paragraph.';
    expect(JSON.parse(metadataFileContents({ abstract }, asIs))).toEqual({ abstract });
  });

  test('a field can hold a template variable', () => {
    const render = (value: string) => renderTemplate(value, { currentFileName: 'Note', today: { long: '2 October 2026' } });
    expect(JSON.parse(metadataFileContents({ title: '${currentFileName}', date: '${today.long}' }, render))).toEqual({
      title: 'Note',
      date: '2 October 2026',
    });
  });
});

describe('the template field', () => {
  test('an emptied field is dropped, and the last one takes the whole object with it', () => {
    const one = setDocumentField(undefined, 'title', 'Report');
    expect(one).toEqual({ title: 'Report' });
    expect(setDocumentField({ title: 'Report', subject: 'x' }, 'subject', ' ')).toEqual({ title: 'Report' });
    expect(setDocumentField(one, 'title', '')).toBeUndefined();
    expect(setDocumentField({ author: ['Ann Lee'] }, 'author', [])).toBeUndefined();
  });

  test('the command names the file only when there is something in it', () => {
    expect(hasDocumentMetadata({ documentMetadata: { title: ' ' } })).toBe(false);
    expect(metadataFileArg({ documentMetadata: { title: ' ' } })).toBeUndefined();
    expect(metadataFileArg({ documentMetadata: { title: 'Report' } })).toBe('--metadata-file="${metadataFile}"');
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

describe.skipIf(!pandocInstalled)('what pandoc makes of it', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pandoc-gui-metadata-'));
    await writeFile(join(dir, 'meta.json'), metadataFileContents({ title: 'From template', subject: 'Template subject' }, asIs));
    await writeFile(join(dir, 'note.md'), '---\ntitle: From note\n---\n\nText.\n');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("the note's own property wins, and the template fills in the rest", async () => {
    const { stdout } = await run(`pandoc "${join(dir, 'note.md')}" --metadata-file="${join(dir, 'meta.json')}" -s -t html`);
    expect(stdout).toContain('<title>From note</title>');
    expect(stdout).not.toContain('From template');
  }, 60_000);

  test('a -M on the command line wins over the file too', async () => {
    const { stdout } = await run(
      `pandoc "${join(dir, 'note.md')}" --metadata-file="${join(dir, 'meta.json')}" -M subject=Typed -s -t native`
    );
    expect(stdout).toContain('"Typed"');
    expect(stdout).not.toContain('Template');
  }, 60_000);
});
