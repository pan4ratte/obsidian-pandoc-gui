# Pandoc GUI

<img alt="Pandoc GUI for Obsidian" src="https://shieldcn.dev/header/graph.svg?title=Pandoc+GUI+for+Obsidian&subtitle=Obsidian+%2B+Pandoc+%2B+GUI+%3D+%E2%9D%A4%EF%B8%8F&logo=pandoc&size=wide&mode=dark">

<div align="center">
  <a href="https://pay.cloudtips.ru/p/c0e8eac4"><img alt="badge" src="https://shieldcn.dev/badge/Поддержать%20разработку-(RU%20карты).svg?size=lg&amp;logo=ri%3AFaHeart&amp;logoColor=ef4444&amp;color=09090b&amp;labelTextColor=ef4444"></a>
</div>

<p align="center">
  English | <a href="https://github.com/pan4ratte/obsidian-pandoc-gui/blob/main/docs/README_RU.md">Русский</a>
</p>

<p align="center">
Export and import notes with Pandoc without touching the command line: every option Pandoc offers is available right in the Obsidian interface. Build export templates for Word, PDF, LaTeX, HTML, EPUB and many other formats, and install extra lua filters straight from the store inside the plugin.
</p>

## Features

### 1. Every Pandoc feature in a graphical interface

A flexible template editor lets you set up how notes are exported without using the command line. Everything is configurable: the table of contents and its depth, section numbering, the PDF engine, syntax highlighting, maths rendering, paper and font size, text direction, footnote placement and much more.

### 2. Dozens of export formats

Word, OpenOffice, PDF, LaTeX (a whole document or a fragment to paste into an existing project), HTML, EPUB, Beamer and reveal.js slides, PowerPoint, Markdown in CommonMark, GFM or Hugo flavours, Typst, TextBundle, RTF, MediaWiki, reStructuredText, Textile, OPML, plain text and a BibTeX bibliography of everything a note cites.

### 3. Exports that respect Obsidian's syntax

The plugin works around many of the problems of Pandoc itself and of other export plugins for Obsidian. Embedding `![[notes]]` and `![[notes#sections]]`, for one, works in full. Excalidraw drawings reach the document as pictures rather than as the JSON they are stored as. Dataview queries are exported the way they look in the note — as tables and lists rather than as code. Highlights survive, `$$…$$` blocks are put back together, and every `$today` in the note becomes today's date. Advanced settings and tweaks switch on the rest of the syntax — callouts, emoji shortcodes, bare URLs, hard line breaks and more.

### 4. Mobile support

With Pandoc WASM supported, you can install it into the plugin if you like: the process is automatic and asks nothing of you. Pandoc WASM runs inside Obsidian itself and takes next to no room on disk. Exporting and importing on a phone work as they do on a computer, except that they happen in the vault, and some of the features are limited by the platform itself.

### 5. Import files to the vault

The “Import a file and convert it to a note” command calls the import dialog and asks for the flavour of Markdown to format it in and the folder to put it in, and lets the reading and the writing be set more finely: Word's tracked changes, images extracted into a folder of the vault, the document's details kept as the note's properties, shifted headings, line wrapping and heading style.

### 6. A store of lua filters

A lua filter is a small script Pandoc applies to the document on export, which lets you tune the document more finely still: page breaks in Word, diagrams from Mermaid code blocks, embedded notes, chemical formulas or sheet music. The filter store offers more than three dozen of them, grouped by the problem they solve, each naming what it requires. A filter of your own can be added too — pasted into the store, or chosen as a file on the computer — and edited afterwards.

### 7. Pandoc, watched over

The plugin tracks Pandoc releases and offers to install them: the installed Pandoc is updated by hand, while Pandoc WASM updates itself. Pandoc's manual can be opened straight from the plugin too, and the update button leads to the new version's changelog.


## Installation

### First of all, install Pandoc

This is what you want if you are going to use the full Pandoc on a computer. For Pandoc WASM, see below.

1. The plugin drives Pandoc, but Pandoc has to be installed first, from the official site: [https://pandoc.org/installing.html](https://pandoc.org/installing.html).

2. Then either add it to your system `PATH`, or point the plugin at the installed program in its settings.

3. Exporting straight to PDF additionally needs a LaTeX distribution — MiKTeX, TeX Live, the [TinyTeX](https://github.com/rstudio/tinytex-releases) I recommend, or any other engine Pandoc supports.

### Install plugin, option 1: Obsidian plugin store

1. In Obsidian settings open the tab "Community plugins" and click "Browse" button.

2. In the search bar type `Pandoc GUI`, click on the result, then "Install" and "Enable" buttons.

Alternatively, you can install the plugin by following the link to the community website: [https://community.obsidian.md/plugins/pandoc-gui](https://community.obsidian.md/plugins/pandoc-gui)

### Install plugin, option 2: BRAT plugin

If you want to test beta-versions of the plugin or use previous versions, you can do that with `BRAT` plugin:

1. Install `BRAT` plugin from the official Obsidian plugin store.

2. In the `BRAT` settings, find the “Beta plugin list” section and click on the “Add beta plugin” button.

3. In the window that appears, paste the link to the `Pandoc GUI` plugin repository: [https://github.com/pan4ratte/obsidian-pandoc-gui](https://github.com/pan4ratte/obsidian-pandoc-gui)

4. Under “Select a version” choose the desired version and click the “Add plugin” button. The plugin will be automatically installed and will be ready to use.

### Download Pandoc WASM for mobile support

The full Pandoc runs on a computer only, so to use it on mobile devices you can install Pandoc WASM into the plugin itself: the process is fully automatic and asks nothing of you.

1. In the plugin settings find the “Pandoc WASM” card and press the install icon. The plugin downloads Pandoc's own official build, unpacks it and puts it in the plugin folder — there is nothing else to do.

2. If you want that, turn on “Use Pandoc WASM on this computer” to have Pandoc WASM convert instead of the installed Pandoc. It is off by default, and the installed Pandoc does the work. The option is not available on mobile devices because WASM is the only thing that converts there, so everything about an installed Pandoc is left out of the settings.

That means you don't have to install full Pandoc on your computer at all, and can use Pandoc WASM instead. Pandoc WASM does have its own limitation and the "full" version does not — refer to the user guide to know more about the differences.


## The lua-filter catalogue

The filters listed below can be found in the filter store in the plugin settings, or in the [`lua-filters/`](lua-filters/README.md) folder of this repository.

The catalogue currently offers:

**Structure**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Abstract as a section](https://github.com/pandoc-ext/abstract-section) | Lets you write the abstract as an ordinary "# Abstract" heading instead of putting it in the note's properties. The filter moves that section into the metadata the templates read. | — |
| [Include files by path](https://github.com/pandoc-ext/include-files) | Assembles the document from file paths listed in a code block with the class .include — not from ![[…]] links, which the “Write in embedded notes” setting already handles. It is for what a link cannot name: files outside the vault, and files that are not Markdown (LaTeX, HTML, reStructuredText). | — |
| [Include code from files](https://github.com/pandoc/lua-filters/tree/master/include-code-files) | Fills an empty code block from a file on disk — all of it, or just a range of lines. Code samples in the note can never drift from the code they came from. | — |
| [Manual page breaks](https://github.com/pandoc-ext/pagebreak) | Turns a \\newpage or \\pagebreak line in the note into a real page break — in Word, ODT, LaTeX/PDF, EPUB and HTML. | — |
| [Format-only content](https://github.com/pandoc/lua-filters/tree/master/not-in-format) | Keeps a block or a span out of the formats it was not written for, so one note can carry both the printed wording and the web wording. | — |
| [Tables written as lists](https://github.com/pandoc-ext/list-table) | Write a table as a nested list and have it come out as a table. Cells that hold a paragraph, a list or a code block stay editable in the note instead of becoming an unreadable pipe table. | — |
| [reveal.js code blocks](https://github.com/pandoc/lua-filters/tree/master/revealjs-codeblock) | Passes code-block attributes through to reveal.js, so a slide can highlight lines and step through them. | — |
| [Word tracked changes](https://github.com/pandoc/lua-filters/tree/master/track-changes) | Decides what to do with the tracked changes in a .docx you are reading in: accept them, reject them, or keep both readings. | — |
| [Letter (KOMA-Script)](https://github.com/pandoc/lua-filters/tree/master/scrlttr2) | Sets the note as a letter through KOMA-Script's scrlttr2 class, addressee and closing included. No longer maintained upstream. | A LaTeX installation with KOMA-Script. |

**Citations**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Citations as live Zotero links](https://retorque.re/zotero-better-bibtex/exporting/) | Resolves Better BibTeX citekeys against a running Zotero, so citations and the bibliography come out right without exporting a .bib file first. | Zotero running, with the Better BibTeX plugin installed. |
| [DOI to citation](https://github.com/pandoc/lua-filters/tree/master/doi2cite) | Looks up every DOI you cite and writes the matching bibliography entry for you, so a reference needs nothing but its DOI. | An internet connection at export time. |
| [Several bibliographies](https://github.com/pandoc-ext/multibib) | Splits the references into separate lists — sources and software, primary and secondary — from one library, each printed where you put it. | — |
| [References per chapter](https://github.com/pandoc-ext/section-bibliographies) | Gives every chapter or section its own reference list instead of one long list at the end. | — |
| [Export the cited entries](https://github.com/pandoc/lua-filters/tree/master/bibexport) | Writes out a .bib file holding only the entries the document actually cites — what you hand in with a manuscript instead of your whole library. | The bibexport program, part of TeX Live. |
| [Citation intent (CiTO)](https://github.com/pandoc-ext/cito) | Lets a citation record why it is there — agrees with, extends, uses a method from — and can list the sources by that relation. | — |
| [Scholarly metadata](https://github.com/pandoc/lua-filters/tree/master/scholarly-metadata) | Rewrites authors and affiliations into the shape journal templates expect, so a list of names in the note's properties comes out as a proper author list. | — |
| [Author and affiliation block](https://github.com/pandoc/lua-filters/tree/master/author-info-blocks) | Prints the authors, their affiliations and the corresponding address as a formatted block under the title. | Runs after "Scholarly metadata" — add that filter first. |

**Figures & math**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Diagrams from code blocks](https://github.com/pandoc-ext/diagram) | Draws the diagram a code block describes and puts the picture in the document: Mermaid, GraphViz/Dot, PlantUML, TikZ, Asymptote and more. | The tool for the diagrams you use (mermaid-cli, dot, plantuml, …) on the PATH. |
| [Math as SVG](https://github.com/pandoc/lua-filters/tree/master/math2svg) | Renders TeX formulas to SVG with MathJax, so the maths shows up wherever the file is opened — no MathJax, no fonts, no internet needed by the reader. | Node.js with mathjax-node-cli installed. |
| [Short table captions](https://github.com/pandoc/lua-filters/tree/master/table-short-captions) | The same for tables: a short caption for the list of tables, and a way to keep a table out of that list altogether. | LaTeX/PDF output. |
| [Chemical formulas (mhchem)](https://github.com/pandoc/lua-filters/tree/master/mhchem) | Sets \\ce{} chemical equations and isotopes written in mhchem notation. | — |
| [Sheet music (LilyPond)](https://github.com/pandoc/lua-filters/tree/master/lilypond) | Engraves LilyPond notation written in the note and puts the score in the document as an image. | The lilypond program on the PATH. |

**Text & typography**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Quotation marks by language](https://github.com/pandoc/lua-filters/tree/master/pandoc-quotes.lua) | Replaces plain " and ' with the marks the document's language actually uses — « » in French, „ “ in German, “ ” in English. | — |
| [First-line indent](https://github.com/pandoc/lua-filters/tree/master/first-line-indent) | Indents the first line of every paragraph the way books do, and leaves the paragraph that opens a section flush, as typographers set it. | — |
| [Fonts and alignment](https://github.com/pandoc-ext/fonts-and-alignment) | Sets the font, size, colour and alignment of a marked span or section, for the passages a template has no style for. | — |
| [Tidier URLs](https://github.com/pandoc-ext/pretty-urls) | Drops the https:// and the trailing slash from a bare link, so an address printed in the text reads as text. | — |
| [Remove wikilinks](https://github.com/pan4ratte/obsidian-pandoc-gui/blob/main/lua-filters/pan4ratte/strip-wikilinks.lua) | Removes wikilinks along with the text inside them from the exported file. Embeds, images, attachments and external links are not affected; in a vault writing markdown links, links to a `.md` file or to a heading go the same way. | — |
| [Code inside tables](https://github.com/pan4ratte/course-it-in-science/blob/main/Obsidian/Pandoc/filters/table-verbatim.lua) | Lets inline code in a table cell take its own character style, so it can be sized for the table instead of the body text. Pandoc hardcodes VerbatimChar there and ignores anything else. | A character style named "Table Verbatim" in the reference document. |
| [Space before and after tables](https://github.com/pan4ratte/course-it-in-science/blob/main/Obsidian/Pandoc/filters/table-spacing.lua) | Adds a thin spacer paragraph before and after every table, so tables do not sit flush against the text in Word. | — |
| [Highlighted code in PDF](https://github.com/pandoc/lua-filters/tree/master/minted) | Sets code blocks with LaTeX's minted package, which highlights far more languages, and better, than the plain verbatim pandoc falls back to. | Pygments installed, and LaTeX run with --shell-escape. |
| [Keep hyphenated words whole](https://github.com/pandoc/lua-filters/tree/master/latex-hyphen) | Stops LaTeX breaking a hyphenated word at its hyphen when it justifies a line — the fix for names and compounds split across lines. | — |

**Tools & other**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Word count](https://github.com/pandoc/lua-filters/tree/master/wordcount) | Counts the words pandoc reads, not the characters the file holds — markup, properties and link targets left out. Prints the count instead of exporting. | — |
| [Spellcheck](https://github.com/pandoc/lua-filters/tree/master/spellcheck) | Lists the misspelled words of a note, reading the prose and skipping code, links and maths. Prints the list instead of exporting. | The aspell program on the PATH. |

Want to add a filter of your own? The folder's [readme](lua-filters/README.md) says what an entry carries and where the file goes; `npm run docs:catalogue` writes the tables above from it.


# User guide

This guide is available inside the plugin too: the “Pandoc GUI: Open user guide” command in the command palette, or the “User guide” button in the settings.

## 1. Export templates

Templates hold the settings for exporting to a particular format, and the template editor lets you set up, in a graphical interface, the commands that will be sent to Pandoc on export: every Pandoc option is available in the interface, so there is no need to use the command line. The table of saved templates in the plugin settings lets you edit them, create new ones or make copies of existing ones.

Once an export format is chosen, the editor shows every Pandoc setting available for that kind of document, along with the plugin's own additional options that improve the export.

### 1.1. The “Resulting command” section

The “Resulting command” section shows the command Pandoc will be given; for easier reading, each parameter has a line of its own. The `${...}` variables in it are not filled in: their values are only known at export (see section 2). The copy button copies the whole command.

The “Extra commands” field takes Pandoc parameters the editor has no option for because they are rarely used — `--defaults=my.yaml`, for example. Note that an output template variable (`-V`) with no option of its own is easier to set in the “Other variables” field of the “Document formatting” group: one `key=value` a line, such as `fontfamily=libertinus`.

### 1.2. The “Document metadata” section

In the “Document metadata” group you can fill in the title, subtitle, author, date, abstract and other document fields, which apply to every note exported with this template.

* If the note's properties hold metadata (`title`, `author`, `date` and the rest), it takes priority over the template's settings.
* Values are read as Markdown, and `${...}` in them is filled in at export: `${today.long}` in the “Date” field gives today's date, for example.
* Authors and keywords are added one at a time: type a value first, then press Enter to add it to the list.

## 2. `${...}` variables

Variables are filled in at export in everything a template writes: the command, the “Extra commands” and the “Document metadata” fields.

### 2.1. Variables

In the examples, the note `/Users/aaa/Documents/readme.md` is exported to `/Users/aaa/Documents/test.pdf`:

| Variable | Value |
| -------- | ----- |
| `${outputPath}` | Full path of the exported file: `/Users/aaa/Documents/test.pdf`. |
| `${outputDir}` | Folder of the exported file: `/Users/aaa/Documents`. |
| `${outputFileName}` | Name of the exported file without its extension: `test`. |
| `${outputFileFullName}` | Name of the exported file with its extension: `test.pdf`. |
| `${currentPath}` | Full path of the note: `/Users/aaa/Documents/readme.md`. |
| `${currentDir}` | Folder of the note: `/Users/aaa/Documents`. |
| `${currentFileName}` | Name of the note without its extension: `readme`. |
| `${currentFileFullName}` | Name of the note with its extension: `readme.md`. |
| `${vaultDir}` | The vault's folder. |
| `${attachmentFolderPath}` | The attachment folder from Obsidian's settings. |
| `${pluginDir}` | The plugin's folder: its resources and the Pandoc WASM extensions. |
| `${luaDir}` | The plugin's `lua/` folder, with the installed lua filters. |
| `${embedDirs}` | The folders of the files embedded in the note — for `--resource-path`. |
| `${fromFormat}` | The format Pandoc reads the note in: `markdown+wikilinks_title_after_pipe`, or `markdown` in a vault that uses Markdown links. |
| `${today.long}`, `${today.medium}`, `${today.short}`, `${today.iso}` | Today's date in Obsidian's language: long, medium and short, and `2026-10-02`. |
| `${metadata.key}` | A note property: `keyword: value` in the properties is `${metadata.keyword}`. |
| `${metadataFile}` | The file holding the template's document metadata. The plugin fills it in itself. |

### 2.2. Expressions

Besides a variable name, `${...}` takes a simple expression — to let a parameter into the command only when it is wanted, for example:

| Written | What it does |
| ------- | ------------ |
| `${metadata.keyword}`, `${metadata["key"]}` | Field access. |
| `` ${ x ? `--opt="${x}"` : `` } `` | A condition. Nested template literals work inside the branches. |
| `${x ?? "default"}`, `${x \|\| "fallback"}`, `${x && "…"}`, `${!x}` | Defaults and logic. |
| `${fmt === "pdf" ? "…" : "…"}` | Comparison: `x === y`, `x !== y`, `x == y`, `x != y`. |

Functions cannot be called: write `${outputFileName}` rather than `${outputFileName.toUpperCase()}`. A name that is not among the variables is not filled in: `${user}` reaches the command as it is.

### 2.3. Custom export commands

To run a Pandoc command the editor's options do not cover, or another program altogether, choose `Custom` in the format list beside the template's name. Write the command, with variables, in the “Command” field, and the extension of the file it will make in “Target file extensions”. “Show command output” shows what the program printed. Pandoc WASM cannot run these templates.

## 3. Obsidian syntax

The options of the “Reading the note” group under “Advanced” handle the Obsidian syntax Pandoc does not have by default.

### 3.1. Embedded notes

With “Write in embedded notes” on, `![[note]]` is replaced with the note's text, and `![[note#heading]]` with the section it names. Embeds inside embedded notes are written in too. “Fit the headings of embedded notes” moves their headings one level below the heading the embed stands under. The Markdown templates have the option off, and embeds stay links.

### 3.2. Other options

* “Insert today’s date instead of $today on export” — every `$today` in the note and its properties becomes today's date in the chosen format.
* “Print the keywords property” — the keywords from the note's or the template's properties are printed in the document's text, under the label from the “Keywords label” field.
* The plugin supports Excalidraw: Excalidraw drawings are exported into the document as images. For PDF and LaTeX, “Excalidraw drawing format” lets you choose PNG or SVG (SVG needs the svg package and Inkscape), and “Keep images in place” stops LaTeX from moving captioned images elsewhere.
* “Extensions” (beside “Lua filters”) handle syntax Pandoc does not read by default: callouts, highlights, emoji codes, bare URLs, single line breaks and more.

### 3.3. Dataview queries

Important: DataviewJS scripts are switched off by default in Dataview itself. To have them exported, turn on “Enable JavaScript queries” in its settings. The plugin waits for a script's result no longer than 10 seconds. A script that has not finished by then is exported as far as it got, and the warnings window says so. The same window names any query that could not run.

Dataview queries reach the document the way they look in reading view:

* **`dataview` blocks** — the tables, lists and tasks the query returns.
* **`dataviewjs` blocks** — what the script shows: `dv.table`, `dv.list`, `dv.paragraph` and so on.
* **Inline queries** (inline code starting with “=”, such as “= this.file.name”) — their value.

A query runs in the note it is written in, so `this.file` in an embedded note means that note. Links in the results behave like ordinary wikilinks: the `strip-wikilinks.lua` filter, for one, removes them too. Dataview's own settings are followed — the DataviewJS keyword, the inline query prefix, and inline queries being switched off. With “Write in embedded notes” off, only the note's own queries are run.

Inline DataviewJS queries (inline code starting with “$=”) and `CALENDAR` queries stay as code: a calendar can be written neither as a table nor as a list.

## 4. Word documents

### 4.1. Reference documents

On export, Word, OpenOffice and PowerPoint documents take their styles from the reference document named in the “Reference document” field. The “Generate reference document” button makes one with Pandoc's own tooling. The document is made in the export folder and named in the template.

### 4.2. Styles tweaks

The “Styles tweaks” group fixes how Pandoc assigns styles in Word and OpenOffice:

* “Apply figures style to images” — an image without a caption gets the figure style.
* “Style text in table cells” — cells get the style you name instead of “Compact”, and header cells one of their own.
* “Use Word’s list styles” (Word only) — bulleted lists get the List Bullet style, and numbered ones List Number. “Flatten numbered lists” decides whether every list starts from 1.

A style of the name you give must exist in the reference document.

### 4.3. Joining documents

When exporting to Word, other Word documents can be joined to the export: a title page at the start and appendices at the end, for example. They are carried over whole, with their page margins, headers and footers, images, lists, footnotes and comments, and look as they do in Word.

The documents are set in the template editor under “Joining documents”: press “+” in the “Document at the start” or “Document at the end” row and pick one or more documents. They are joined in the order of the list, and their order can be changed. A document in the vault is remembered by its path inside the vault, so the template works on every device if you sync your vault.

A note can have documents of its own in the `docx-before` and `docx-after` properties: a link to a file in the vault, a path, or a list of several documents. A note's properties take priority over the documents named in the template, and an empty property turns them off for that note. An example of naming documents in the properties:

```yaml
docx-before: "[[Title page.docx]]"
docx-after:
  - "[[Appendix A.docx]]"
  - "[[Appendix B.docx]]"
```

Note that the documents to join can also be picked in the export dialog. Joining works with Pandoc WASM too, mobile devices included.

#### Styles of joined documents

* **Keep original styles** — the document keeps its original look. Styles the exported note also has are renamed with the document's name in brackets, such as “Normal (Title page)”.
* **Use template styles** — where the document has styles with the same names as the reference document, the reference document's styles are used, and the joined file is restyled. Direct formatting (a font or alignment set by hand) is kept all the same.

#### Sections, headers and footers

Each joined document becomes a section of its own, with its own margins, page size, headers and footers, and starts on a new page unless it says otherwise. One document's headers and footers do not carry over to the next one's pages, and footnote numbering starts again in each document. Page numbering runs through the whole document, so a title page counts as page one.

Note: settings Word makes for the whole document rather than for a section — different headers on even and odd pages, for example — come from the exported note. Fonts embedded in a document and macros are not carried over. Documents saved as “Strict Open XML” are not supported: save them again in Word as an ordinary Word document.

## 5. Lua filters

A lua filter is a small script Pandoc applies to the document on export. Filters are installed from the store, which opens from the plugin settings. There a filter can be found by the task it does, its requirements and readme read, and it can be installed, updated and removed. You can also add a filter of your own by choosing “Add my own lua-filter” in the store: paste its code or pick a file.

An installed filter is added to each template separately, in the editor's “Lua filters” option. The list shows only the filters compatible with the template's format. A filter that needs a program (mermaid-cli or lilypond, for example) needs Pandoc to be able to find it — see section 7.

## 6. Export and import

### 6.1. Export dialog

The “Export note” command opens the export dialog, where the template, file name and folder are chosen. For formats with a table of contents, its depth can be changed here, and for Word the joined documents: both changes apply to that export alone.

The “Export with previous settings” command exports the note with the last template into the last folder, without opening the export dialog. The folder is remembered for each device separately.

When an export fails, the error window gives a hint and a “Copy report” button — paste the report into your bug report.

### 6.2. Import

The “Import a file and convert it to a note” command turns a document of any format Pandoc reads into a note: Word, OpenOffice, EPUB, HTML, LaTeX and more.

## 7. Environment variables

The installed Pandoc runs with the variables from the “Environment variables” setting (the “Edit” button). They are needed when Pandoc or a filter cannot find a program — LaTeX, Typst, mermaid-cli, lilypond. It happens most on macOS: Obsidian started other than from a terminal does not get the shell's PATH. On macOS, the Homebrew and TeX folders are already in PATH by default.

## 8. Pandoc WASM

Pandoc WASM is a build of Pandoc that runs inside Obsidian itself, mobile devices included. This version of the program has some limits that come from how it is built:

* **PDF through Typst only.** The ordinary “PDF” template is set with LaTeX, which Pandoc WASM cannot start. Templates like it and Beamer slides are left out of the export dialog: for a PDF, use the “PDF (Typst)” template.
* **No templates with a command of their own:** Pandoc WASM cannot start programs, so these templates are left out too.
* **Lua filters only.** Filters that are programs, in Python for example, will not run. The good news: every filter in the plugin's store is a lua filter.

### 8.1. PDF through Typst

Typst is a typesetting program that runs in WASM: Pandoc writes Typst source, and Typst sets the PDF from it. Typst installs separately in the plugin settings: press the extensions icon on the Pandoc WASM card and choose the option you need.

* Typst is a different program with a language of its own, so LaTeX templates (`--template=neurips.tex`), `-V geometry` and raw LaTeX (`\newpage`, `tikzpicture`) do not reach the PDF. Math, tables, images, the table of contents and citations work as they always do.
* Typst cannot see the system's fonts. Libertinus, New Computer Modern and DejaVu come with it — Latin, Cyrillic and math. To add fonts of your own (for CJK, or `-V mainfont`), point the “Fonts” row of the extensions at a folder in the vault.
* Without the emoji font, the emoji in a note never reach the PDF: it installs in the same place.
* Typst earns its place on a computer too: where the installed Pandoc finds no Typst on the system, this build sets the “PDF (Typst)” template's PDF.

### 8.2. Pandoc WASM extensions

The extensions get around some of WASM's limits and matter above all on a phone. They install from the extensions icon on the Pandoc WASM card and live in the plugin folder, so a template can name them with `${pluginDir}`:

* **Typst**, **fonts** and the **emoji font** — typesetting a PDF, as above.
* **Citation styles** — nine common CSL styles, APA, Chicago and GOST R 7.0.5-2008 among them. Name the one you want under “Citation style”.
* **Pandoc layout templates** — Pandoc's own HTML, LaTeX, Typst and EPUB templates: copy one, change it and name it under “Layout template”.
* **Reference documents** — reference.docx, .odt and .pptx: set their styles and name the file under “Reference document”.
* **MathJax, offline** — so the math in an HTML export shows without a connection.

### 8.3. What else to keep in mind

* Pandoc WASM takes about 56 MB in the plugin folder and syncs along with the vault. Typst and its fonts are about 36 MB more, if you install it. Installing is automatic: there is nothing for you to do by hand.
* Images named by URL are fetched by the plugin before the conversion, up to 64 per export: Pandoc WASM cannot reach the network. An ordinary link stays a link.
* WASM needs a recent phone: iOS 18.4 or newer, or Android with an up-to-date WebView.

### 8.4. Unsupported options

A template can hold options Pandoc WASM does not support. They are left out of the export, and the export dialog warns about them beforehand. You are warned about:

* `--filter` — filters that are programs;
* `--defaults` — a Pandoc defaults file;
* `--sandbox` and `--fail-if-warnings`;
* any option the plugin does not know, including the deprecated `--atx-headers` and `--epub-chapter-level`.

These options are left out without a warning — they change no result:

* `--pdf-engine`, `--pdf-engine-opt` — a PDF is always set with the plugin's Typst.
* `--request-header`, `--no-check-certificate` — the plugin reaches the network, not Pandoc.
* `--data-dir`, `--log`, `--verbose`, `--quiet`, `--trace`, `--dump-args` — there are no system folders and no console to send them to.


# About the Author

My name is Mark Ingrem and I am a Religious Studies scholar. Apart from my main area of study (Protestant Political Theology in Russia), I teach a university course called "Information Technologies in Scientific Research", which is based on my own program. This plugin helps me in my research and I use it in my teaching, along with the other plugins I develop, which you can find on [my GitHub profile](https://github.com/pan4ratte/).

Hello to every student who came across this page!


## Credits

This plugin began as a fork of [Enhancing Export](https://github.com/mokeyish/obsidian-enhancing-export) by **YISH ([@mokeyish](https://github.com/mokeyish))** — the quick start of this project was possible thanks to him.

Thanks are also owed to:

- **[John MacFarlane](https://johnmacfarlane.net/) and the other Pandoc contributors** for the best document converter in the world.
- **The [pandoc-ext](https://github.com/pandoc-ext) organisation** and the retired **[pandoc/lua-filters](https://github.com/pandoc/lua-filters)** collection.
- **[Better BibTeX](https://retorque.re/zotero-better-bibtex/)** for the Zotero filter the catalogue also offers.

---

In compliance with the Obsidian community guidelines, all external network calls should be disclosed in the plugin README and only made with user knowledge. This plugin makes network calls to [api.github.com](https://api.github.com) — to look up the latest Pandoc release for the version check in the settings — and to [raw.githubusercontent.com](https://raw.githubusercontent.com), to read the lua-filter catalogue when you open the store and to download a filter when you install one. Installing Typst — from the button in the settings — fetches the Typst build, its fonts and the MathJax library from [cdn.jsdelivr.net](https://cdn.jsdelivr.net), and the citation styles and Pandoc's own data files from GitHub. Exporting with Pandoc WASM downloads the images a note names by URL: those addresses are the ones you wrote in the note, and nothing else is requested.
