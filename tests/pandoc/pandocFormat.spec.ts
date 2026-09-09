import {
  familiesOf,
  isEpubOutput,
  isPdfOutput,
  isSlideOutput,
  outputFormat,
  runsInFormat,
  supportsCss,
  supportsDpi,
  supportsEmbedResources,
  supportsHeaderInclude,
  supportsHighlighting,
  supportsHtmlOptions,
  supportsIncludes,
  supportsMarkdownHeadings,
  supportsMathMethod,
  supportsNumberOffset,
  supportsNumberSections,
  supportsReferenceDoc,
  supportsReferenceLinks,
  supportsReferenceLocation,
  supportsSectionLists,
  supportsSplitLevel,
  supportsToc,
  supportsTopLevelDivision,
  supportsVariable,
  supportsWrap,
  writesLatex,
  templateExtension,
} from '../../src/pandoc/pandoc_format';
import { CURATED_VARIABLES } from '../../src/args/writer_args';

/*
 * What a template writes decides which rows the editor shows, so reading the
 * writer back out of the arguments has to survive the shapes the shipped
 * templates actually use.
 */

const DOCX = '-f ${fromFormat} --resource-path="${currentDir}" -o "${outputPath}" -t docx';
const MARKDOWN = '-f ${fromFormat} --lua-filter="${luaDir}/markdown.lua" -s -o "${outputPath}" -t commonmark_x-attributes';
const BIB = '-f ${fromFormat} -o "${outputPath}" --to=bibtex "${currentPath}"';

describe('reading the writer', () => {
  test('it is the `-t` of a shipped template', () => {
    expect(outputFormat(DOCX)).toBe('docx');
    expect(outputFormat('-s -o "x.tex" -t latex')).toBe('latex');
  });

  test('`--to=` is read as well as `-t`', () => {
    expect(outputFormat(BIB)).toBe('bibtex');
    expect(outputFormat('--to html5')).toBe('html5');
  });

  test('the extensions on a writer are not part of its name', () => {
    expect(outputFormat(MARKDOWN)).toBe('commonmark_x');
    expect(outputFormat('-t markdown+hard_line_breaks')).toBe('markdown');
  });

  test('the last one wins, extra arguments included — as pandoc reads them', () => {
    expect(outputFormat('-t docx', '-t html')).toBe('html');
    expect(outputFormat('-t docx -t odt')).toBe('odt');
  });

  test('`--toc` is not mistaken for a `--to`', () => {
    // The two rows share a field, so this is a line that really occurs.
    expect(outputFormat('-t docx --toc --toc-depth=3')).toBe('docx');
    expect(outputFormat('--toc --toc-depth=3')).toBeUndefined();
  });

  test('nothing to read is nobody‘s writer', () => {
    expect(outputFormat(undefined, '')).toBeUndefined();
    // `-f` says what is read, not what is written.
    expect(outputFormat('-f markdown -o out.pdf')).toBeUndefined();
  });
});

describe('what a writer supports', () => {
  test('the shipped templates that produce contents', () => {
    for (const writer of ['docx', 'odt', 'html', 'latex', 'pdf', 'epub', 'rtf', 'rst', 'mediawiki', 'typst', 'pptx', 'commonmark_x']) {
      expect(supportsToc(writer)).toBe(true);
    }
  });

  test('the ones that ignore `--toc`, measured against pandoc', () => {
    for (const writer of ['textile', 'opml', 'bibtex', 'man', 'org', 'json', 'docbook5', 'jats']) {
      expect(supportsToc(writer)).toBe(false);
    }
  });

  test('a writer that cannot be made out asks for no row at all', () => {
    expect(supportsToc(undefined)).toBe(false);
  });
});

/*
 * The rest of the rows are gated the other way round from `--toc`: the manual
 * names a few formats for each, and a writer it does not name is not offered
 * the row rather than being left to ignore it.
 */
describe('which rows a writer is offered', () => {
  test('numbering, where headings are numbered at all', () => {
    for (const writer of ['latex', 'pdf', 'context', 'html', 'html5', 'docx', 'ms', 'epub3']) {
      expect(supportsNumberSections(writer)).toBe(true);
    }
    for (const writer of ['odt', 'typst', 'commonmark_x', 'rtf', 'pptx', undefined]) {
      expect(supportsNumberSections(writer)).toBe(false);
    }
  });

  test('an offset, only where pandoc says it reaches', () => {
    expect(supportsNumberOffset('html')).toBe(true);
    expect(supportsNumberOffset('docx')).toBe(true);
    // Numbered, but the offset is ignored — so the field is not shown.
    expect(supportsNumberOffset('latex')).toBe(false);
    expect(supportsNumberOffset('epub3')).toBe(false);
  });

  test('lists of figures and tables, in the three writers that build them', () => {
    for (const writer of ['latex', 'pdf', 'context', 'docx']) {
      expect(supportsSectionLists(writer)).toBe(true);
    }
    for (const writer of ['html', 'epub3', 'odt', 'typst']) {
      expect(supportsSectionLists(writer)).toBe(false);
    }
  });

  test('a top-level division, where a document has divisions to name', () => {
    expect(supportsTopLevelDivision('latex')).toBe(true);
    expect(supportsTopLevelDivision('pdf')).toBe(true);
    expect(supportsTopLevelDivision('docbook5')).toBe(true);
    expect(supportsTopLevelDivision('docx')).toBe(false);
    expect(supportsTopLevelDivision('html')).toBe(false);
  });

  test('highlighting, wherever code is coloured', () => {
    for (const writer of ['html', 'latex', 'pdf', 'docx', 'odt', 'revealjs', 'typst', 'epub3']) {
      expect(supportsHighlighting(writer)).toBe(true);
    }
    for (const writer of ['commonmark_x', 'rst', 'textile', 'json']) {
      expect(supportsHighlighting(writer)).toBe(false);
    }
  });

  test('a math method, where the math is going into HTML', () => {
    for (const writer of ['html', 'html5', 'epub3', 'revealjs']) {
      expect(supportsMathMethod(writer)).toBe(true);
    }
    // These write their own math; there is no script to choose between.
    for (const writer of ['latex', 'pdf', 'typst', 'docx']) {
      expect(supportsMathMethod(writer)).toBe(false);
    }
  });

  test('a PDF engine, only when a PDF is what comes out', () => {
    expect(isPdfOutput('pdf')).toBe(true);
    expect(isPdfOutput('latex')).toBe(false);
    expect(isPdfOutput(undefined)).toBe(false);
  });

  test('a reference document, for the three formats that take styles from one', () => {
    for (const writer of ['docx', 'odt', 'pptx']) {
      expect(supportsReferenceDoc(writer)).toBe(true);
    }
    for (const writer of ['latex', 'html', 'epub3', 'rtf', undefined]) {
      expect(supportsReferenceDoc(writer)).toBe(false);
    }
  });

  test('a stylesheet, in HTML — slide shows included — and EPUB', () => {
    for (const writer of ['html', 'html4', 'html5', 'chunkedhtml', 'epub', 'epub3', 'revealjs', 's5']) {
      expect(supportsCss(writer)).toBe(true);
    }
    // These have no stylesheet to link, whatever else they can be told.
    for (const writer of ['latex', 'pdf', 'docx', 'odt', 'typst', undefined]) {
      expect(supportsCss(writer)).toBe(false);
    }
  });

  test('include files, which nearly every writer takes', () => {
    for (const writer of ['latex', 'pdf', 'html', 'epub3', 'docx', 'odt', 'typst', 'commonmark_x', 'ms']) {
      expect(supportsIncludes(writer)).toBe(true);
    }
    // Measured against pandoc: the file reaches none of these.
    for (const writer of ['pptx', 'opml', 'jats', 'icml', 'json', 'ipynb', undefined]) {
      expect(supportsIncludes(writer)).toBe(false);
    }
  });

  test('a header to include into, which fewer of them have', () => {
    for (const writer of ['latex', 'html', 'epub3', 'odt', 'typst', 'ms']) {
      expect(supportsHeaderInclude(writer)).toBe(true);
    }
    // A body to wrap, but nowhere a header file could go.
    for (const writer of ['docx', 'docbook5', 'mediawiki', 'textile', 'tei']) {
      expect(supportsIncludes(writer)).toBe(true);
      expect(supportsHeaderInclude(writer)).toBe(false);
    }
  });

  test('wrapping, in the writers that lay out what they write', () => {
    for (const writer of ['markdown', 'commonmark_x', 'html', 'latex', 'rst', 'org', 'typst', 'chunkedhtml']) {
      expect(supportsWrap(writer)).toBe(true);
    }
    // EPUB writes XHTML but lays it out itself; the rest are not text at all.
    for (const writer of ['epub3', 'docx', 'odt', 'pptx', 'rtf', 'json', undefined]) {
      expect(supportsWrap(writer)).toBe(false);
    }
  });

  test('the two rows that are markdown’s alone', () => {
    for (const writer of ['markdown', 'commonmark_x', 'gfm', 'markua']) {
      expect(supportsMarkdownHeadings(writer)).toBe(true);
      expect(supportsReferenceLinks(writer)).toBe(true);
    }
    // rst has reference links of its own, but only one way to write a heading.
    expect(supportsReferenceLinks('rst')).toBe(true);
    expect(supportsMarkdownHeadings('rst')).toBe(false);
    expect(supportsMarkdownHeadings('html')).toBe(false);
    expect(supportsReferenceLinks('html')).toBe(false);
  });

  test('where the footnotes can be moved, which reaches past markdown', () => {
    for (const writer of ['markdown', 'html', 'epub3', 'revealjs', 'chunkedhtml', 'muse']) {
      expect(supportsReferenceLocation(writer)).toBe(true);
    }
    for (const writer of ['latex', 'docx', 'typst', 'rst', undefined]) {
      expect(supportsReferenceLocation(writer)).toBe(false);
    }
  });

  test('slides, in every writer that makes them — beamer and PowerPoint too', () => {
    for (const writer of ['revealjs', 'slidy', 'slideous', 'dzslides', 's5', 'beamer', 'pptx']) {
      expect(isSlideOutput(writer)).toBe(true);
    }
    for (const writer of ['html', 'latex', 'pdf', undefined]) {
      expect(isSlideOutput(writer)).toBe(false);
    }
  });

  test('the EPUB rows, and the split level chunked HTML shares', () => {
    for (const writer of ['epub', 'epub2', 'epub3']) {
      expect(isEpubOutput(writer)).toBe(true);
      expect(supportsSplitLevel(writer)).toBe(true);
    }
    expect(isEpubOutput('chunkedhtml')).toBe(false);
    expect(supportsSplitLevel('chunkedhtml')).toBe(true);
    expect(supportsSplitLevel('html')).toBe(false);
  });

  test('the page rows, and the embedding that chunked HTML cannot do', () => {
    for (const writer of ['html', 'html4', 'html5', 'revealjs', 's5']) {
      expect(supportsHtmlOptions(writer)).toBe(true);
      expect(supportsEmbedResources(writer)).toBe(true);
    }
    // Chunked HTML is a folder of files, so there is nothing to embed into.
    expect(supportsHtmlOptions('chunkedhtml')).toBe(true);
    expect(supportsEmbedResources('chunkedhtml')).toBe(false);
    // EPUB carries its own resources already, and takes neither row.
    expect(supportsHtmlOptions('epub3')).toBe(false);
    expect(supportsEmbedResources('epub3')).toBe(false);
  });

  test('a resolution, where the writer has to put a real size on an image', () => {
    for (const writer of ['latex', 'pdf', 'docx', 'odt', 'context', 'typst', 'ms', 'rtf', 'icml']) {
      expect(supportsDpi(writer)).toBe(true);
    }
    // These keep the pixels they were given.
    for (const writer of ['html', 'markdown', 'epub3', 'revealjs', undefined]) {
      expect(supportsDpi(writer)).toBe(false);
    }
  });

  test('each curated variable, only where the writer reads it', () => {
    // Every one of them has a gate, so no row can be offered by accident.
    for (const name of CURATED_VARIABLES) {
      expect(typeof supportsVariable[name]).toBe('function');
      expect(supportsVariable[name](undefined)).toBe(false);
    }

    expect(supportsVariable.geometry('latex')).toBe(true);
    // The geometry package is LaTeX's; these lay a page out their own way.
    expect(supportsVariable.geometry('context')).toBe(false);
    expect(supportsVariable.geometry('typst')).toBe(false);

    expect(supportsVariable.papersize('ms')).toBe(true);
    expect(supportsVariable.papersize('html')).toBe(false);

    expect(supportsVariable.fontsize('odt')).toBe(true);
    expect(supportsVariable.mainfont('epub3')).toBe(true);
    expect(supportsVariable.mainfont('odt')).toBe(false);

    expect(supportsVariable.linkcolor('html5')).toBe(true);
    expect(supportsVariable.linkcolor('docx')).toBe(false);

    // The one nearly everything with a template says something about.
    for (const writer of ['latex', 'pdf', 'html', 'epub3', 'docx', 'odt', 'revealjs', 'tei']) {
      expect(supportsVariable.lang(writer)).toBe(true);
    }
    expect(supportsVariable.lang('ms')).toBe(false);
  });
});

describe('which filters a writer can use', () => {
  test('a writer belongs to its own name and to its family', () => {
    expect(familiesOf('pdf')).toEqual(expect.arrayContaining(['pdf', 'latex']));
    expect(familiesOf('epub')).toEqual(expect.arrayContaining(['epub', 'html']));
    expect(familiesOf('beamer')).toEqual(expect.arrayContaining(['latex', 'slides']));
    // A family's own name is not repeated when the writer *is* the family.
    expect(familiesOf('docx')).toEqual(['docx']);
  });

  test('a filter with no formats is offered whatever is being written', () => {
    expect(runsInFormat(undefined, 'docx')).toBe(true);
    expect(runsInFormat([], 'docx')).toBe(true);
  });

  test('a filter is offered to its own family and to no other', () => {
    expect(runsInFormat(['latex'], 'pdf')).toBe(true);
    expect(runsInFormat(['latex'], 'latex')).toBe(true);
    expect(runsInFormat(['latex'], 'docx')).toBe(false);
    expect(runsInFormat(['docx', 'odt'], 'odt')).toBe(true);
    expect(runsInFormat(['html'], 'epub3')).toBe(true);
    expect(runsInFormat(['slides'], 'revealjs')).toBe(true);
    expect(runsInFormat(['slides'], 'html')).toBe(false);
  });

  test('a template whose writer cannot be made out is not narrowed down', () => {
    expect(runsInFormat(['latex'], undefined)).toBe(true);
  });
});

/*
 * A `--template` named without an extension is looked for with one, and the template editor says which. Every value
 * below was read back from pandoc 3.10 itself: asked for a template that is not there, it names the file it looked for.
 */
describe('the extension a template is expected to carry', () => {
  test('is the name of the writer itself, which is not always the language it writes', () => {
    expect(templateExtension('html')).toBe('.html');
    expect(templateExtension('html5')).toBe('.html5');
    expect(templateExtension('latex')).toBe('.latex');
    expect(templateExtension('beamer')).toBe('.beamer');
    expect(templateExtension('typst')).toBe('.typst');
    expect(templateExtension('revealjs')).toBe('.revealjs');
    expect(templateExtension('epub3')).toBe('.epub3');
    expect(templateExtension('markdown')).toBe('.markdown');
    expect(templateExtension('ms')).toBe('.ms');
  });

  test('for a PDF it is the writer the engine sets from, LaTeX unless another is named', () => {
    expect(templateExtension('pdf')).toBe('.latex');
    expect(templateExtension('pdf', 'xelatex')).toBe('.latex');
    expect(templateExtension('pdf', 'lualatex')).toBe('.latex');
    expect(templateExtension('pdf', 'tectonic')).toBe('.latex');
    expect(templateExtension('pdf', 'latexmk')).toBe('.latex');
    expect(templateExtension('pdf', 'typst')).toBe('.typst');
    expect(templateExtension('pdf', 'context')).toBe('.context');
    expect(templateExtension('pdf', 'wkhtmltopdf')).toBe('.html');
    expect(templateExtension('pdf', 'weasyprint')).toBe('.html');
    expect(templateExtension('pdf', 'pagedjs-cli')).toBe('.html');
    expect(templateExtension('pdf', 'prince')).toBe('.html');
    expect(templateExtension('pdf', 'groff')).toBe('.ms');
  });

  test('there is none where a template lays nothing out', () => {
    expect(templateExtension('docx')).toBeUndefined();
    expect(templateExtension('odt')).toBeUndefined();
    expect(templateExtension('pptx')).toBeUndefined();
    expect(templateExtension(undefined)).toBeUndefined();
  });
});

describe('which templates write through LaTeX', () => {
  test('the two writers that are LaTeX, and the PDFs an engine of its own sets', () => {
    expect(writesLatex('latex')).toBe(true);
    expect(writesLatex('beamer')).toBe(true);
    // No engine named is pandoc's own default, which is LaTeX.
    expect(writesLatex('pdf')).toBe(true);
    expect(writesLatex('pdf', 'xelatex')).toBe(true);
    expect(writesLatex('pdf', 'lualatex')).toBe(true);
    expect(writesLatex('pdf', 'tectonic')).toBe(true);
  });

  test('and nothing else, a PDF set by another engine included', () => {
    expect(writesLatex('pdf', 'typst')).toBe(false);
    expect(writesLatex('pdf', 'context')).toBe(false);
    expect(writesLatex('pdf', 'weasyprint')).toBe(false);
    expect(writesLatex('docx')).toBe(false);
    expect(writesLatex('html')).toBe(false);
    expect(writesLatex('typst')).toBe(false);
    expect(writesLatex(undefined)).toBe(false);
  });
});
