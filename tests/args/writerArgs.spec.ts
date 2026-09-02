import {
  HIGHLIGHT_NONE,
  ascii,
  bibliography,
  citeproc,
  columns,
  commandLines,
  csl,
  css,
  dpi,
  emailObfuscation,
  embedResources,
  eol,
  epubCoverImage,
  epubEmbedFont,
  epubSubdirectory,
  epubTitlePage,
  extractMedia,
  highlightStyle,
  idPrefix,
  incremental,
  markdownHeadings,
  includeAfterBody,
  includeBeforeBody,
  includeInHeader,
  listOfFigures,
  listOfTables,
  legacyMathFlags,
  mathMethod,
  mathUrl,
  metadata,
  numberOffset,
  numberSections,
  pairsFromText,
  pdfEngine,
  referenceDoc,
  referenceLinks,
  referenceLocation,
  renameHighlightFlags,
  sectionDivs,
  setAscii,
  setBibliography,
  setCiteproc,
  setColumns,
  setCsl,
  setCss,
  setDpi,
  setEmailObfuscation,
  setEmbedResources,
  setEol,
  setEpubCoverImage,
  setEpubSubdirectory,
  setEpubTitlePage,
  setHighlightStyle,
  setIdPrefix,
  setIncremental,
  setMarkdownHeadings,
  setIncludeAfterBody,
  setIncludeBeforeBody,
  setIncludeInHeader,
  setListOfFigures,
  setListOfTables,
  renameMathFlags,
  setMathMethod,
  setMathUrl,
  setMetadata,
  setNumberOffset,
  setNumberSections,
  setPdfEngine,
  setReferenceDoc,
  setReferenceLinks,
  setReferenceLocation,
  setSectionDivs,
  setShiftHeadingLevelBy,
  setSlideLevel,
  setSplitLevel,
  setStripComments,
  setSyntaxDefinition,
  setTabStop,
  setTemplateFile,
  setTopLevelDivision,
  setVariable,
  setVariables,
  shiftHeadingLevelBy,
  slideLevel,
  splitLevel,
  stripComments,
  syntaxDefinition,
  tabStop,
  setTextDirection,
  takesMathUrl,
  textDirection,
  templateFile,
  textFromPairs,
  topLevelDivision,
  variable,
  variables,
  wrap,
} from '../../src/args/writer_args';

/*
 * Every row in the template editor reads its answer out of a line of arguments
 * and writes it back into the same line, so what matters throughout is that the
 * two agree, that a line typed by hand is understood however it was spelled, and
 * that nothing else in the line is disturbed on the way past.
 */

const FILTER = '--lua-filter="${luaDir}/markdown.lua"';
const TOC = '--toc --toc-depth=3';

describe('numbered headings', () => {
  test('either spelling is numbering', () => {
    expect(numberSections('--number-sections')).toBe(true);
    expect(numberSections('-N')).toBe(true);
    expect(numberSections(`${FILTER} -N ${TOC}`)).toBe(true);
  });

  test('nothing that merely starts the same way is', () => {
    expect(numberSections(undefined)).toBe(false);
    expect(numberSections('--number-offset=5')).toBe(false);
    expect(numberSections('-Nx')).toBe(false);
  });

  test('the long form is what gets written, whichever was there', () => {
    expect(setNumberSections(undefined, true)).toBe('--number-sections');
    expect(setNumberSections('-N', true)).toBe('--number-sections');
    expect(setNumberSections(FILTER, true)).toBe(`${FILTER} --number-sections`);
  });

  test('switching it off takes the offset with it', () => {
    // Pandoc reads an offset as asking for numbering, so one left behind would
    // switch the numbering straight back on.
    expect(setNumberSections('--number-sections --number-offset=5', false)).toBe('');
    expect(setNumberSections(`${FILTER} -N --number-offset 1,4`, false)).toBe(FILTER);
  });

  test('an offset is read whichever way it was written', () => {
    expect(numberOffset('--number-sections --number-offset=5')).toBe('5');
    expect(numberOffset('--number-sections --number-offset 1,4')).toBe('1,4');
    expect(numberOffset(FILTER)).toBeUndefined();
  });

  test('an offset is written as digits and the commas between them, or not at all', () => {
    expect(setNumberOffset('', '5')).toBe('--number-offset=5');
    expect(setNumberOffset('', '1, 4')).toBe('--number-offset=1,4');
    expect(setNumberOffset('', 'six')).toBe('');
    expect(setNumberOffset('--number-offset=5', '')).toBe('');
  });

  test('changing an offset replaces it rather than adding a second one', () => {
    expect(setNumberOffset('--number-sections --number-offset=5', '2')).toBe('--number-sections --number-offset=2');
  });
});

describe('lists of figures and tables', () => {
  test('the short form pandoc also takes is understood', () => {
    expect(listOfFigures('--lof')).toBe(true);
    expect(listOfFigures('--list-of-figures')).toBe(true);
    expect(listOfTables('--lot')).toBe(true);
    expect(listOfTables('--list-of-tables')).toBe(true);
  });

  test('one is not the other', () => {
    expect(listOfTables('--lof')).toBe(false);
    expect(listOfFigures('--lot')).toBe(false);
  });

  test('both can be asked for at once, and taken back out one at a time', () => {
    const both = setListOfTables(setListOfFigures(TOC, true), true);
    expect(both).toBe(`${TOC} --list-of-figures --list-of-tables`);
    expect(setListOfFigures(both, false)).toBe(`${TOC} --list-of-tables`);
    expect(setListOfTables(setListOfFigures(both, false), false)).toBe(TOC);
  });
});

describe('top-level division', () => {
  test('what pandoc names is read, and nothing else is', () => {
    expect(topLevelDivision('--top-level-division=chapter')).toBe('chapter');
    expect(topLevelDivision('--top-level-division part')).toBe('part');
    // `default` is pandoc's own answer, which this row shows as no answer.
    expect(topLevelDivision('--top-level-division=default')).toBeUndefined();
    expect(topLevelDivision('--top-level-division=volume')).toBeUndefined();
  });

  test('choosing the default takes the option back out', () => {
    expect(setTopLevelDivision(`${FILTER} --top-level-division=chapter`, '')).toBe(FILTER);
    expect(setTopLevelDivision('--top-level-division=chapter', 'part')).toBe('--top-level-division=part');
  });
});

describe('code highlighting', () => {
  test('a style is read from either spelling of the option', () => {
    expect(highlightStyle('--highlight-style=kate')).toBe('kate');
    expect(highlightStyle('--highlight-style tango')).toBe('tango');
    expect(highlightStyle('--syntax-highlighting=zenburn')).toBe('zenburn');
  });

  test('both ways of saying no highlighting say the same thing', () => {
    expect(highlightStyle('--no-highlight')).toBe(HIGHLIGHT_NONE);
    expect(highlightStyle('--syntax-highlighting=none')).toBe(HIGHLIGHT_NONE);
  });

  test('a theme file of the user’s own is given back as it stands', () => {
    // The picker offers it back as its own entry rather than dropping it.
    expect(highlightStyle('--highlight-style="C:/My Themes/dracula.theme"')).toBe('C:/My Themes/dracula.theme');
  });

  test('what is written is what every version of pandoc takes', () => {
    expect(setHighlightStyle('', 'kate')).toBe('--highlight-style=kate');
    expect(setHighlightStyle('', HIGHLIGHT_NONE)).toBe('--no-highlight');
    // A value with a space in it has to come back the way it went in.
    expect(highlightStyle(setHighlightStyle('', 'C:/My Themes/dracula.theme'))).toBe('C:/My Themes/dracula.theme');
  });

  test('changing the answer replaces whichever spelling was there', () => {
    expect(setHighlightStyle('--no-highlight', 'kate')).toBe('--highlight-style=kate');
    expect(setHighlightStyle('--syntax-highlighting=zenburn', HIGHLIGHT_NONE)).toBe('--no-highlight');
    expect(setHighlightStyle(`${FILTER} --highlight-style kate`, '')).toBe(FILTER);
  });

  test('a pandoc that renamed the options is given the new names', () => {
    expect(renameHighlightFlags('pandoc a.md -o a.docx --no-highlight')).toBe('pandoc a.md -o a.docx --syntax-highlighting=none');
    expect(renameHighlightFlags('pandoc --highlight-style=kate a.md')).toBe('pandoc --syntax-highlighting=kate a.md');
    expect(renameHighlightFlags('pandoc --highlight-style tango a.md')).toBe('pandoc --syntax-highlighting=tango a.md');
    expect(renameHighlightFlags('pandoc --highlight-style="C:/My Themes/dracula.theme"')).toBe(
      'pandoc --syntax-highlighting="C:/My Themes/dracula.theme"'
    );
  });

  test('nothing else on the command line is touched', () => {
    const cmd = `pandoc a.md -o a.docx --syntax-highlighting=none --syntax-definition=obsidian.xml ${FILTER}`;
    expect(renameHighlightFlags(cmd)).toBe(cmd);
    // A word that merely ends in the old name is not the old name.
    expect(renameHighlightFlags('pandoc --my-no-highlight')).toBe('pandoc --my-no-highlight');
  });
});

describe('math', () => {
  test('a method is read past whatever script it pins', () => {
    // The shipped HTML template pins a MathJax build exactly like this.
    expect(mathMethod('--mathjax="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg-full.js"')).toBe('mathjax');
    expect(mathMethod('--katex')).toBe('katex');
    expect(mathMethod('--webtex=https://latex.codecogs.com/svg?')).toBe('webtex');
    expect(mathMethod(FILTER)).toBeUndefined();
  });

  test('the last one is the one pandoc takes', () => {
    expect(mathMethod('--mathjax --katex')).toBe('katex');
  });

  test('choosing a method replaces the one that was there, pinned URL and all', () => {
    expect(setMathMethod('--mathjax="https://example.com/mathjax.js"', 'katex')).toBe('--katex');
    expect(setMathMethod(`${FILTER} --katex`, '')).toBe(FILTER);
    expect(setMathMethod('--katex', 'mathml')).toBe('--mathml');
  });

  test('the pinned build is read back as a field of its own', () => {
    const url = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg-full.js';
    expect(mathUrl(`--mathjax="${url}"`)).toBe(url);
    expect(mathUrl('--webtex=https://latex.codecogs.com/svg?')).toBe('https://latex.codecogs.com/svg?');
    // Nothing pinned, and nothing that could be.
    expect(mathUrl('--katex')).toBeUndefined();
    expect(mathUrl('--mathml')).toBeUndefined();
    expect(mathUrl(FILTER)).toBeUndefined();
  });

  test('a URL is written onto whichever method is already chosen', () => {
    expect(setMathUrl('--katex', 'https://example.com/katex/')).toBe('--katex=https://example.com/katex/');
    expect(setMathUrl(`${FILTER} --mathjax`, 'https://example.com/a b.js')).toBe(`${FILTER} --mathjax="https://example.com/a b.js"`);
    // Emptying the field leaves the method behind, on pandoc's own script.
    expect(setMathUrl('--mathjax="https://example.com/mathjax.js"', '  ')).toBe('--mathjax');
  });

  test('there is no URL to set without a method to hang it on, or on a method that reads none', () => {
    expect(setMathUrl(FILTER, 'https://example.com/mathjax.js')).toBe(FILTER);
    expect(setMathUrl('--mathml', 'https://example.com/mathjax.js')).toBe('--mathml');
    expect(takesMathUrl('mathjax')).toBe(true);
    expect(takesMathUrl('gladtex')).toBe(false);
    expect(takesMathUrl(undefined)).toBe(false);
  });

  test('the spelling pandoc 3.11 asks for is read as readily as the five it replaced', () => {
    expect(mathMethod('--math-method=katex')).toBe('katex');
    expect(mathMethod('--math-method mathml')).toBe('mathml');
    expect(mathUrl('--math-method=mathjax:https://example.com/tex.js')).toBe('https://example.com/tex.js');
    expect(mathUrl('--math-method="mathjax:https://example.com/a b.js"')).toBe('https://example.com/a b.js');
    expect(mathMethod('--math-method=nonsense')).toBeUndefined();
    // Last one wins, whichever spelling it came in.
    expect(mathMethod('--math-method=katex --mathml')).toBe('mathml');
    expect(mathMethod('--mathml --math-method=katex')).toBe('katex');
  });

  test('plain has only the new spelling; the other five keep the old one', () => {
    expect(setMathMethod('', 'plain')).toBe('--math-method=plain');
    expect(setMathMethod('--math-method=plain', 'mathml')).toBe('--mathml');
    expect(setMathMethod('--katex', 'plain')).toBe('--math-method=plain');
    expect(mathMethod('--math-method=plain')).toBe('plain');
    expect(setMathMethod('--math-method=plain', '')).toBe('');
  });

  test('a pandoc that renamed the options is given the new name', () => {
    expect(renameMathFlags('pandoc a.md -o a.html --mathml')).toBe('pandoc a.md -o a.html --math-method=mathml');
    expect(renameMathFlags('pandoc --mathjax=https://example.com/tex.js a.md')).toBe(
      'pandoc --math-method=mathjax:https://example.com/tex.js a.md'
    );
    expect(renameMathFlags('pandoc --mathjax="https://example.com/a b.js"')).toBe(
      'pandoc --math-method="mathjax:https://example.com/a b.js"'
    );
    expect(renameMathFlags(`pandoc a.md ${FILTER}`)).toBe(`pandoc a.md ${FILTER}`);
  });

  test('a pandoc older than the rename is given the five flags back, and no flag at all for plain', () => {
    expect(legacyMathFlags('pandoc a.md --math-method=mathml')).toBe('pandoc a.md --mathml');
    expect(legacyMathFlags('pandoc --math-method=mathjax:https://example.com/tex.js a.md')).toBe(
      'pandoc --mathjax=https://example.com/tex.js a.md'
    );
    expect(legacyMathFlags('pandoc --math-method mathml a.md')).toBe('pandoc --mathml a.md');
    // Plain is what that pandoc does with no method named.
    expect(legacyMathFlags('pandoc a.md --math-method=plain -o a.html')).toBe('pandoc a.md -o a.html');
    // Not a method pandoc names: left for pandoc to complain about.
    expect(legacyMathFlags('pandoc --math-method=nonsense')).toBe('pandoc --math-method=nonsense');
    expect(legacyMathFlags('pandoc --mathml')).toBe('pandoc --mathml');
  });

  test('either rename leaves a line already in its own spelling alone', () => {
    expect(renameMathFlags('pandoc --math-method=mathml')).toBe('pandoc --math-method=mathml');
    // A word that merely ends in a method's name is not that method.
    expect(renameMathFlags('pandoc --my-mathml')).toBe('pandoc --my-mathml');
  });
});

describe('text direction', () => {
  test('a direction is metadata, since that is where the word processors read it', () => {
    expect(setTextDirection('', 'rtl')).toBe('-M dir=rtl');
    expect(textDirection('-M dir=rtl')).toBe('rtl');
    expect(textDirection('--metadata dir=ltr')).toBe('ltr');
    // A variable of the same name is not metadata, and the word processors do not read it.
    expect(textDirection('-V dir=rtl')).toBeUndefined();
  });

  test('anything that is not one of the two directions is nothing at all', () => {
    expect(textDirection('-M dir=sideways')).toBeUndefined();
    expect(textDirection(FILTER)).toBeUndefined();
    expect(setTextDirection('-M dir=rtl', '')).toBe('');
    expect(setTextDirection('-M dir=rtl', 'sideways')).toBe('');
  });

  test('it is set beside the other metadata rather than over it', () => {
    expect(setTextDirection('-M author=Ada', 'rtl')).toBe('-M author=Ada -M dir=rtl');
    expect(setTextDirection('-M dir=ltr -M author=Ada', 'rtl')).toBe('-M author=Ada -M dir=rtl');
  });
});

describe('reading the note', () => {
  test('a tab width is a count, and nothing else', () => {
    expect(tabStop('--tab-stop=2')).toBe('2');
    expect(tabStop('--tab-stop 8')).toBe('8');
    expect(tabStop(FILTER)).toBeUndefined();
    expect(setTabStop('', '2')).toBe('--tab-stop=2');
    expect(setTabStop('--tab-stop=2', 'wide')).toBe('');
    expect(setTabStop(`${FILTER} --tab-stop=2`, '')).toBe(FILTER);
  });

  test('dropping comments is off unless the line says so', () => {
    expect(stripComments(FILTER)).toBe(false);
    expect(stripComments('--strip-comments')).toBe(true);
    // A later `=false` undoes an earlier flag, as pandoc reads it.
    expect(stripComments('--strip-comments=false')).toBe(false);
    expect(setStripComments(FILTER, true)).toBe(`${FILTER} --strip-comments`);
    // Agreeing with the default is written as nothing at all.
    expect(setStripComments('--strip-comments', false)).toBe('');
  });
});

describe('the output template', () => {
  test('a template of the user’s own is read and written as a path', () => {
    expect(templateFile('--template=eisvogel.latex')).toBe('eisvogel.latex');
    expect(templateFile('--template "C:/My Templates/thesis.latex"')).toBe('C:/My Templates/thesis.latex');
    expect(templateFile(FILTER)).toBeUndefined();
    expect(setTemplateFile('', 'C:/My Templates/thesis.latex')).toBe('--template="C:/My Templates/thesis.latex"');
    expect(setTemplateFile(`${FILTER} --template=old.latex`, '')).toBe(FILTER);
  });
});

describe('the syntax definition', () => {
  test('the file is read and written under its own option', () => {
    expect(syntaxDefinition('--syntax-definition=obsidian.xml')).toBe('obsidian.xml');
    expect(setSyntaxDefinition('--syntax-definition=old.xml', 'new.xml')).toBe('--syntax-definition=new.xml');
    // `--syntax-highlighting` is the new name of `--highlight-style`, not of this one.
    expect(syntaxDefinition('--syntax-highlighting=kate')).toBeUndefined();
  });
});

describe('the bytes written', () => {
  test('line endings are read as they stand', () => {
    expect(eol('--eol=crlf')).toBe('crlf');
    expect(eol('--eol lf')).toBe('lf');
    expect(eol(FILTER)).toBeUndefined();
    expect(setEol('--eol=crlf', '')).toBe('');
    expect(setEol(FILTER, 'native')).toBe(`${FILTER} --eol=native`);
  });

  test('escaping to ASCII is off unless the line says so', () => {
    expect(ascii(FILTER)).toBe(false);
    expect(ascii('--ascii')).toBe(true);
    expect(ascii('--ascii=false')).toBe(false);
    expect(setAscii(FILTER, true)).toBe(`${FILTER} --ascii`);
    expect(setAscii('--ascii', false)).toBe('');
  });
});

describe('the EPUB contents folder', () => {
  test('a folder is read back, and an empty field is pandoc’s own', () => {
    expect(epubSubdirectory('--epub-subdirectory=OEBPS')).toBe('OEBPS');
    expect(epubSubdirectory(FILTER)).toBeUndefined();
    expect(setEpubSubdirectory('', 'OEBPS')).toBe('--epub-subdirectory=OEBPS');
    expect(setEpubSubdirectory('--epub-subdirectory=OEBPS', '  ')).toBe('');
  });
});

describe('shifting the heading level', () => {
  test('a shift is read in either direction', () => {
    expect(shiftHeadingLevelBy('--shift-heading-level-by=1')).toBe('1');
    expect(shiftHeadingLevelBy('--shift-heading-level-by -2')).toBe('-2');
    expect(shiftHeadingLevelBy(FILTER)).toBeUndefined();
  });

  test('a shift of nothing is written as no option at all', () => {
    expect(setShiftHeadingLevelBy('', '1')).toBe('--shift-heading-level-by=1');
    expect(setShiftHeadingLevelBy('', '-1')).toBe('--shift-heading-level-by=-1');
    expect(setShiftHeadingLevelBy('--shift-heading-level-by=2', '0')).toBe('');
    expect(setShiftHeadingLevelBy(`${FILTER} --shift-heading-level-by=2`, '')).toBe(FILTER);
  });

  test('nothing pandoc would refuse gets written', () => {
    expect(setShiftHeadingLevelBy('', '7')).toBe('');
    expect(setShiftHeadingLevelBy('', '1.5')).toBe('');
    expect(setShiftHeadingLevelBy('', 'up')).toBe('');
  });

  test('changing the shift replaces the one that was there', () => {
    expect(setShiftHeadingLevelBy(`${FILTER} --shift-heading-level-by=1 ${TOC}`, '-1')).toBe(
      `${FILTER} ${TOC} --shift-heading-level-by=-1`
    );
  });
});

describe('pdf engine', () => {
  test('the engine a shipped template names is read back', () => {
    expect(pdfEngine('--pdf-engine=pdflatex')).toBe('pdflatex');
    expect(pdfEngine('--pdf-engine xelatex')).toBe('xelatex');
    expect(pdfEngine(FILTER)).toBeUndefined();
  });

  test('an engine of the user’s own survives the round trip', () => {
    const own = 'C:/Program Files/MiKTeX/miktex/bin/xelatex.exe';
    expect(pdfEngine(setPdfEngine('', own))).toBe(own);
  });

  test('choosing the default takes the option back out', () => {
    expect(setPdfEngine('--pdf-engine=pdflatex', '')).toBe('');
    expect(setPdfEngine(`${FILTER} --pdf-engine=pdflatex`, 'lualatex')).toBe(`${FILTER} --pdf-engine=lualatex`);
  });
});

describe('citations', () => {
  test('either spelling asks for citeproc', () => {
    expect(citeproc('--citeproc')).toBe(true);
    expect(citeproc('-C')).toBe(true);
    expect(citeproc(`${FILTER} -C ${TOC}`)).toBe(true);
    expect(citeproc(FILTER)).toBe(false);
    // The long form is what gets written, whichever was there.
    expect(setCiteproc('-C', true)).toBe('--citeproc');
  });

  test('the two files are read however they were written', () => {
    expect(bibliography('--bibliography=refs.bib')).toBe('refs.bib');
    expect(bibliography('--bibliography "C:/My Notes/refs.bib"')).toBe('C:/My Notes/refs.bib');
    expect(csl('--csl=chicago.csl')).toBe('chicago.csl');
    expect(csl(FILTER)).toBeUndefined();
  });

  test('a path with a space in it survives the round trip', () => {
    const own = 'C:/My Notes/references.bib';
    expect(bibliography(setBibliography('', own))).toBe(own);
  });

  test('switching citations off takes the files it was reading with it', () => {
    // Neither does anything on its own, and the rows they are typed into are
    // hidden with the toggle — left behind they would be invisible answers.
    const on = setCsl(setBibliography(setCiteproc(FILTER, true), 'refs.bib'), 'chicago.csl');
    expect(on).toBe(`${FILTER} --citeproc --bibliography=refs.bib --csl=chicago.csl`);
    expect(setCiteproc(on, false)).toBe(FILTER);
  });

  test('clearing a field takes only that option out', () => {
    expect(setBibliography('--citeproc --bibliography=refs.bib', '')).toBe('--citeproc');
  });
});

describe('reference document and stylesheet', () => {
  test('a reference document is read and replaced, never doubled', () => {
    expect(referenceDoc('--reference-doc=house.docx')).toBe('house.docx');
    expect(setReferenceDoc('--reference-doc=house.docx', 'other.docx')).toBe('--reference-doc=other.docx');
    expect(setReferenceDoc('--reference-doc=house.docx', '')).toBe('');
  });

  test('a stylesheet is read from either spelling of the option', () => {
    expect(css('--css=print.css')).toBe('print.css');
    expect(css('-c print.css')).toBe('print.css');
    expect(setCss('-c print.css', 'screen.css')).toBe('--css=screen.css');
  });

  test('a path written with the plugin’s own variables is left as it stands', () => {
    // These are resolved when the export runs, not here.
    const path = '${currentDir}/style.css';
    expect(css(setCss('', path))).toBe(path);
  });
});

describe('include files', () => {
  test('each is read under both of its names', () => {
    expect(includeInHeader('--include-in-header=preamble.tex')).toBe('preamble.tex');
    expect(includeInHeader('-H preamble.tex')).toBe('preamble.tex');
    expect(includeBeforeBody('-B header.html')).toBe('header.html');
    expect(includeAfterBody('-A footer.html')).toBe('footer.html');
  });

  test('one is not another', () => {
    expect(includeInHeader('-B header.html')).toBeUndefined();
    expect(includeAfterBody('-B header.html')).toBeUndefined();
  });

  test('all three can be given at once, and cleared one at a time', () => {
    let written = setIncludeInHeader(FILTER, 'preamble.tex');
    written = setIncludeBeforeBody(written, 'header.html');
    written = setIncludeAfterBody(written, 'footer.html');
    expect(written).toBe(`${FILTER} --include-in-header=preamble.tex --include-before-body=header.html --include-after-body=footer.html`);
    expect(includeInHeader(setIncludeBeforeBody(written, ''))).toBe('preamble.tex');
    expect(includeBeforeBody(setIncludeBeforeBody(written, ''))).toBeUndefined();
  });
});

describe('variables and metadata', () => {
  test('a variable is read under either spelling, and past the quotes', () => {
    expect(variable('-V fontsize=12pt', 'fontsize')).toBe('12pt');
    expect(variable('--variable=fontsize=12pt', 'fontsize')).toBe('12pt');
    expect(variable('--variable fontsize=12pt', 'fontsize')).toBe('12pt');
    // Quoted whole, or quoted around the part that needs it.
    expect(variable('-V "mainfont=PT Serif"', 'mainfont')).toBe('PT Serif');
    expect(variable('-V mainfont="PT Serif"', 'mainfont')).toBe('PT Serif');
  });

  test('a value carrying its own `=` is split where pandoc splits it', () => {
    expect(variable('-V geometry=margin=1in', 'geometry')).toBe('margin=1in');
    expect(variable(setVariable('', 'geometry', 'margin=1in'), 'geometry')).toBe('margin=1in');
  });

  test('the shipped TextBundle template is understood as it stands', () => {
    const args = '-V media_dir="${outputDir}/${outputFileName}.textbundle/assets"';
    expect(variable(args, 'media_dir')).toBe('${outputDir}/${outputFileName}.textbundle/assets');
  });

  test('setting one replaces it rather than adding a second', () => {
    expect(setVariable('-V fontsize=10pt', 'fontsize', '12pt')).toBe('-V fontsize=12pt');
    expect(setVariable('-V fontsize=12pt -V lang=fr', 'fontsize', '')).toBe('-V lang=fr');
    // A value with a space in it is written so that it comes back the same way.
    expect(setVariable('', 'mainfont', 'PT Serif')).toBe('-V "mainfont=PT Serif"');
  });

  test('the last one given is the one pandoc takes', () => {
    expect(variable('-V lang=en -V lang=fr', 'lang')).toBe('fr');
  });

  test('metadata is the same option under another name', () => {
    expect(metadata('-M author=Ada -M date=today')).toEqual([
      { key: 'author', value: 'Ada' },
      { key: 'date', value: 'today' },
    ]);
    expect(setMetadata('', [{ key: 'author', value: 'Ada Lovelace' }])).toBe('-M "author=Ada Lovelace"');
    // A variable is not metadata, and neither reads the other.
    expect(metadata('-V lang=fr')).toEqual([]);
    expect(variables('-M lang=fr')).toEqual([]);
  });

  test('a bare key is pandoc’s own way of saying true, and survives the trip', () => {
    expect(variables('-V draft')).toEqual([{ key: 'draft', value: '' }]);
    expect(textFromPairs(variables(setVariables('', pairsFromText('draft'))))).toBe('draft');
  });

  test('the typed list is read a line at a time, and blank lines are passed over', () => {
    expect(pairsFromText('fontfamily=libertinus\n\n  colorlinks = true  \n')).toEqual([
      { key: 'fontfamily', value: 'libertinus' },
      { key: 'colorlinks', value: 'true' },
    ]);
  });

  test('rewriting the list leaves the variables with rows of their own alone', () => {
    // `fontsize` is asked for by a row above the list, so the list neither
    // shows it nor writes over it.
    const args = '-V fontsize=12pt -V fontfamily=libertinus';
    expect(setVariables(args, pairsFromText('fontfamily=erewhon'), ['fontsize'])).toBe('-V fontsize=12pt -V fontfamily=erewhon');
    // And a variable the format has no row for is the list's to keep.
    expect(setVariables(args, pairsFromText('fontsize=11pt'), [])).toBe('-V fontsize=11pt');
  });

  test('emptying the list takes every variable out but the kept ones', () => {
    expect(setVariables(`${FILTER} -V fontsize=12pt -V lang=fr`, [], ['lang'])).toBe(`${FILTER} -V lang=fr`);
  });
});

describe('the command, laid out to be read', () => {
  test('a line starts at each flag, and the binary keeps the note company', () => {
    expect(commandLines('pandoc "${currentPath}" -s -o "${outputPath}" -t docx')).toEqual([
      'pandoc "${currentPath}"',
      '-s',
      '-o "${outputPath}"',
      '-t docx',
    ]);
  });

  test('a value stays with the flag that asked for it, however it was written', () => {
    expect(commandLines('--toc --toc-depth=3 --pdf-engine xelatex')).toEqual(['--toc', '--toc-depth=3', '--pdf-engine xelatex']);
  });

  test('a quoted value is one token, spaces and all', () => {
    expect(commandLines('-V "mainfont=PT Serif" --css "C:/My Notes/print.css"')).toEqual([
      '-V "mainfont=PT Serif"',
      '--css "C:/My Notes/print.css"',
    ]);
  });

  test('a brace inside a quoted path is not the end of a substitution', () => {
    expect(commandLines('--resource-path="${currentDir}/a}b" -t html')).toEqual(['--resource-path="${currentDir}/a}b"', '-t html']);
  });

  /*
   * The PDF and Latex presets carry a conditional in one substitution. It holds
   * spaces, quotes, flags and substitutions of its own, and none of that is the
   * layout's to take apart.
   */
  test('a substitution is left whole, and stands on a line of its own', () => {
    const options = '${ options.textemplate ? `--template="${options.textemplate}"` : ` ` }';
    expect(commandLines(`--lua-filter="\${luaDir}/pdf.lua" ${options} -o "\${outputPath}"`)).toEqual([
      '--lua-filter="${luaDir}/pdf.lua"',
      options,
      '-o "${outputPath}"',
    ]);
  });

  test('the whole of an empty command is no lines at all', () => {
    expect(commandLines('')).toEqual([]);
    expect(commandLines('   ')).toEqual([]);
  });
});

describe('the written source', () => {
  test('a wrapping mode is read as it stands, pandoc’s own included', () => {
    expect(wrap('--wrap=none')).toBe('none');
    expect(wrap('--wrap preserve')).toBe('preserve');
    // `auto` is what pandoc does anyway; said out loud, it is still an answer.
    expect(wrap('--wrap=auto')).toBe('auto');
    expect(wrap(FILTER)).toBeUndefined();
  });

  test('a column count is digits or nothing at all', () => {
    expect(setColumns('', '80')).toBe('--columns=80');
    expect(setColumns('', 'eighty')).toBe('');
    expect(setColumns('--columns=80', '')).toBe('');
    expect(columns('--columns 100')).toBe('100');
  });

  test('a heading style pandoc does not know is not written', () => {
    expect(setMarkdownHeadings('', 'setext')).toBe('--markdown-headings=setext');
    expect(setMarkdownHeadings('', 'underlined')).toBe('');
    expect(markdownHeadings('--markdown-headings=atx')).toBe('atx');
  });

  test('reference links are a switch, in all three spellings pandoc takes', () => {
    expect(referenceLinks('--reference-links')).toBe(true);
    expect(referenceLinks('--reference-links=true')).toBe(true);
    // The spelling that undoes an option given earlier in the same line.
    expect(referenceLinks('--reference-links=false')).toBe(false);
    expect(referenceLinks(FILTER)).toBe(false);
    expect(setReferenceLinks('--reference-links=false', true)).toBe('--reference-links');
    expect(setReferenceLinks('--reference-links', false)).toBe('');
  });

  test('a footnote location pandoc names is written, and no other', () => {
    expect(setReferenceLocation('', 'section')).toBe('--reference-location=section');
    expect(setReferenceLocation('--reference-location=section', 'end')).toBe('');
    expect(referenceLocation('--reference-location document')).toBe('document');
  });
});

describe('slides', () => {
  test('the short form pandoc also takes is understood', () => {
    expect(incremental('-i')).toBe(true);
    expect(incremental('--incremental')).toBe(true);
    expect(incremental('--incremental=false')).toBe(false);
    // The long form is what gets written.
    expect(setIncremental('-i', true)).toBe('--incremental');
  });

  test('a slide level is a digit, and zero is an answer of its own', () => {
    expect(setSlideLevel('', '2')).toBe('--slide-level=2');
    expect(setSlideLevel('', '0')).toBe('--slide-level=0');
    expect(setSlideLevel('--slide-level=2', '')).toBe('');
    expect(slideLevel('--slide-level 3')).toBe('3');
  });
});

describe('epub', () => {
  test('the cover and the font are read and replaced like any other file', () => {
    expect(epubCoverImage('--epub-cover-image=cover.png')).toBe('cover.png');
    expect(epubEmbedFont('--epub-embed-font="C:/My Fonts/serif.otf"')).toBe('C:/My Fonts/serif.otf');
    expect(setEpubCoverImage('--epub-cover-image=cover.png', 'other.png')).toBe('--epub-cover-image=other.png');
  });

  test('a title page is what pandoc writes unless it is told otherwise', () => {
    // So the switch is off that is written, and on that is written as nothing.
    expect(epubTitlePage(FILTER)).toBe(true);
    expect(setEpubTitlePage(FILTER, true)).toBe(FILTER);
    expect(setEpubTitlePage(FILTER, false)).toBe(`${FILTER} --epub-title-page=false`);
    expect(epubTitlePage('--epub-title-page=false')).toBe(false);
    expect(setEpubTitlePage('--epub-title-page=false', true)).toBe('');
  });

  test('the level a new file starts at is read under the older name as well', () => {
    expect(splitLevel('--split-level=2')).toBe('2');
    expect(splitLevel('--epub-chapter-level=2')).toBe('2');
    // Whichever was there, the name pandoc uses now is what gets written.
    expect(setSplitLevel('--epub-chapter-level=2', '3')).toBe('--split-level=3');
  });
});

describe('the written page', () => {
  test('embedding is read across both lines, since the preset asks for it', () => {
    const preset = '-f ${fromFormat} --embed-resources --standalone -t html';
    expect(embedResources(preset, undefined)).toBe(true);
    expect(embedResources(preset, '--embed-resources=false')).toBe(false);
    expect(embedResources(undefined, FILTER)).toBe(false);
  });

  test('what is written is only what differs from the preset', () => {
    // The preset already embeds, so agreeing with it writes nothing at all…
    expect(setEmbedResources(FILTER, true, true)).toBe(FILTER);
    // …and disagreeing is said the way pandoc undoes an earlier option.
    expect(setEmbedResources(FILTER, false, true)).toBe(`${FILTER} --embed-resources=false`);
    // Where the preset says nothing, it is the other way round.
    expect(setEmbedResources('', true, false)).toBe('--embed-resources');
    expect(setEmbedResources('--embed-resources', false, false)).toBe('');
  });

  test('section divs, obfuscation and the identifier prefix', () => {
    expect(sectionDivs('--section-divs')).toBe(true);
    expect(setSectionDivs('', true)).toBe('--section-divs');
    expect(setEmailObfuscation('', 'references')).toBe('--email-obfuscation=references');
    expect(setEmailObfuscation('--email-obfuscation=references', 'rot13')).toBe('');
    expect(emailObfuscation('--email-obfuscation javascript')).toBe('javascript');
    expect(idPrefix('--id-prefix=intro-')).toBe('intro-');
    expect(setIdPrefix('--id-prefix=intro-', '')).toBe('');
  });
});

describe('media', () => {
  test('the folder is read across both lines, as the Latex preset writes it there', () => {
    const preset = '-f ${fromFormat} --extract-media="${outputDir}" -s -o "${outputPath}" -t latex';
    expect(extractMedia(preset, undefined)).toBe('${outputDir}');
    // The extra arguments come last, so what they say is what pandoc does.
    expect(extractMedia(preset, '--extract-media=media')).toBe('media');
    expect(extractMedia(undefined, FILTER)).toBeUndefined();
  });

  test('a resolution is digits or nothing at all', () => {
    expect(setDpi('', '300')).toBe('--dpi=300');
    expect(setDpi('', '300dpi')).toBe('--dpi=300');
    expect(setDpi('--dpi=300', '')).toBe('');
    expect(dpi('--dpi 150')).toBe('150');
  });
});

describe('the rest of the line', () => {
  const args = `-f \${fromFormat}+mark ${FILTER} ${TOC}`;

  test('every option leaves what it found alone', () => {
    let written = args;
    written = setNumberSections(written, true);
    written = setListOfFigures(written, true);
    written = setTopLevelDivision(written, 'chapter');
    written = setHighlightStyle(written, 'kate');
    written = setPdfEngine(written, 'xelatex');
    written = setCiteproc(written, true);
    written = setBibliography(written, 'refs.bib');
    written = setReferenceDoc(written, 'house.docx');
    written = setCss(written, 'print.css');
    written = setIncludeInHeader(written, 'preamble.tex');
    written = setVariable(written, 'fontsize', '12pt');
    written = setMetadata(written, [{ key: 'author', value: 'Ada' }]);
    expect(written.startsWith(args)).toBe(true);

    // And taking them all back out leaves the line as it was found.
    written = setMetadata(written, []);
    written = setVariable(written, 'fontsize', '');
    written = setIncludeInHeader(written, '');
    written = setCss(written, '');
    written = setReferenceDoc(written, '');
    written = setCiteproc(written, false);
    written = setPdfEngine(written, '');
    written = setHighlightStyle(written, '');
    written = setTopLevelDivision(written, '');
    written = setListOfFigures(written, false);
    written = setNumberSections(written, false);
    expect(written).toBe(args);
  });

  test('an option asked for twice is written once', () => {
    expect(setPdfEngine(setPdfEngine('', 'xelatex'), 'lualatex')).toBe('--pdf-engine=lualatex');
    expect(setNumberSections(setNumberSections('', true), true)).toBe('--number-sections');
    expect(setCss(setCss('', 'a.css'), 'b.css')).toBe('--css=b.css');
    expect(setVariable(setVariable('', 'lang', 'en'), 'lang', 'fr')).toBe('-V lang=fr');
  });

  test('the lua filter’s own flag is not mistaken for anything here', () => {
    // `-A`, `-B`, `-C`, `-H` and `-V` are short flags in a line full of paths.
    expect(includeAfterBody(FILTER)).toBeUndefined();
    expect(citeproc(FILTER)).toBe(false);
    expect(variables(FILTER)).toEqual([]);
  });
});
