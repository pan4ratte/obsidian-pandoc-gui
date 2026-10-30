import { describeExportFailure } from '../../src/convert/export_error';
import { TemplateError } from '../../src/system/utils';
import { t } from '../../src/lang/helpers';

// Two things are tested: that the command line never reaches the box, and that the errors people actually hit are
// recognised as themselves.

const hint = t.ERROR_HINTS;

const CMD = 'pandoc "/vault/Note.md" -s -o "/out/Note.pdf" --pdf-engine=xelatex --lua-filter="/plugin/lua/wordcount.lua"';

/** What `child_process.exec` rejects with: the command line, then the output. */
const execError = (stderr: string) => Object.assign(new Error(`Command failed: ${CMD}\n${stderr}`), { code: 1 });

const describe_ = (err: unknown) => describeExportFailure(err, CMD);

describe('what the box is given to show', () => {
  test('the command line is left out, however it came back', () => {
    const { detail } = describe_(execError('pandoc: cannot produce output'));
    expect(detail).toBe('pandoc: cannot produce output');
    expect(detail).not.toContain('pandoc "/vault/Note.md"');
    expect(detail).not.toContain('Command failed');
  });

  test('a shell echoing the line back does not put it back in', () => {
    const { detail } = describe_(new Error(`${CMD}\nsh: 1: pandoc: not found`));
    expect(detail).toBe('sh: 1: pandoc: not found');
  });

  test('what the program wrote on stderr wins over the wrapped message', () => {
    const err = Object.assign(new Error(`Command failed: ${CMD}`), { stderr: 'Error at "input" (line 3, column 1)' });
    expect(describe_(err).detail).toBe('Error at "input" (line 3, column 1)');
  });

  test('several lines are kept as they were written', () => {
    const { detail } = describe_(execError('! LaTeX Error: File `tcolorbox.sty` not found.\n\nl.5 \\usepackage'));
    expect(detail.split('\n').length).toBe(3);
  });

  test('a failure with nothing to say still says something', () => {
    expect(describe_(execError('')).detail).toBe(t.ERROR_NO_OUTPUT);
    expect(describe_(undefined).detail).toBe(t.ERROR_NO_OUTPUT);
  });

  test('a thrown string, or something that is neither, is still readable', () => {
    expect(describe_('spawn EACCES').detail).toBe('spawn EACCES');
    expect(describe_({ reason: 'no' }).detail).toBe('{"reason":"no"}');
  });
});

describe('what to try', () => {
  test('a locked output file is the one people hit most', () => {
    // Windows, an open PDF viewer, and pdflatex saying it in its own words.
    expect(describe_(execError("EBUSY: resource busy or locked, open '/out/Note.pdf'")).recommendation).toBe(hint.fileInUse);
    expect(describe_(execError('The process cannot access the file because it is being used by another process.')).recommendation).toBe(
      hint.fileInUse
    );
    expect(describe_(execError("! I can't write on file `Note.pdf'.")).recommendation).toBe(hint.fileInUse);
    expect(describe_(execError("EACCES: permission denied, open '/out/Note.pdf'")).recommendation).toBe(hint.fileInUse);
  });

  test('a missing PDF engine is read as that rather than as a missing pandoc', () => {
    expect(describe_(execError('pdflatex not found. Please select a different --pdf-engine or install pdflatex')).recommendation).toBe(
      hint.pdfEngine
    );
    expect(describe_(execError("'xelatex' is not recognized as an internal or external command")).recommendation).toBe(hint.pdfEngine);
  });

  test('a missing typst is its own answer: the plugin has one, and it is not the one pandoc runs', () => {
    expect(describe_(execError('pandoc: typst not found. Please select a different --pdf-engine or install typst')).recommendation).toBe(
      hint.typstEngine
    );
    expect(describe_(execError("'typst' is not recognized as an internal or external command")).recommendation).toBe(hint.typstEngine);
    expect(describe_(execError('/bin/sh: typst: command not found')).recommendation).toBe(hint.typstEngine);
    // What typst itself says about a document it could not set is not this.
    expect(describe_(execError('error: unknown variable\n  ┌─ Note.typ:3:1')).recommendation).not.toBe(hint.typstEngine);
  });

  test('nothing ran at all', () => {
    expect(
      describe_(execError("'pandoc' is not recognized as an internal or external command,\noperable program or batch file.")).recommendation
    ).toBe(hint.pandocNotFound);
    expect(describe_(execError('/bin/sh: pandoc: command not found')).recommendation).toBe(hint.pandocNotFound);
    expect(describe_(execError('The system cannot find the path specified.')).recommendation).toBe(hint.pandocNotFound);
  });

  test('the LaTeX errors that have an answer', () => {
    expect(
      describe_(execError('! Package inputenc Error: Unicode character 中 (U+4E2D) not set up for use with LaTeX.')).recommendation
    ).toBe(hint.latexUnicode);
    expect(describe_(execError("! LaTeX Error: File `tcolorbox.sty' not found.")).recommendation).toBe(hint.latexPackage);
  });

  test('a filter, an option, and a file the template names', () => {
    expect(describe_(execError('Error running filter /plugin/lua/wordcount.lua:\nattempt to index a nil value')).recommendation).toBe(
      hint.luaFilter
    );
    expect(
      describe_(
        execError(
          "Error running filter 'lua/zotero.lua':\nCould not fetch http://127.0.0.1:23119/better-bibtex/json-rpc?%7B%7D\n (ConnectionFailure Network.Socket.connect: <socket: 792>: failed (Connection refused (WSAECONNREFUSED)))"
        )
      ).recommendation
    ).toBe(hint.zoteroNotRunning);
    expect(describe_(execError('Unknown option --shift-heading-level.')).recommendation).toBe(hint.unknownOption);
    expect(describe_(execError('pandoc: Could not find data file reference.docx')).recommendation).toBe(hint.missingDataFile);
    expect(describe_(execError("Could not fetch resource 'diagram.png'")).recommendation).toBe(hint.missingResource);
  });

  test('an error nobody has an answer for is left without one', () => {
    expect(describe_(execError('pandoc: internal error: something went wrong')).recommendation).toBeUndefined();
  });

  test('a template the evaluator refused is recognised by its type', () => {
    expect(describe_(new TemplateError('calls are not allowed in a template')).recommendation).toBe(hint.template);
  });

  test('pandoc cannot claim the template hint by writing the same words', () => {
    expect(describe_(execError('calls are not allowed in a template')).recommendation).not.toBe(hint.template);
  });
});
