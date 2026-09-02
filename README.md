# Pandoc GUI

<img alt="Pandoc GUI for Obsidian" src="https://shieldcn.dev/header/graph.svg?title=Pandoc+GUI+for+Obsidian&subtitle=Obsidian+%2B+Pandoc+%2B+GUI+%3D+%E2%9D%A4%EF%B8%8F&logo=pandoc&size=wide&mode=dark">

<p align="center">
  English | <a href="https://github.com/pan4ratte/obsidian-pandoc-gui/blob/main/docs/README_RU.md">Русский</a>
</p>

Export and import notes with Pandoc without touching the command line: every option Pandoc offers is available right in the Obsidian interface. Build export templates for Word, PDF, LaTeX, HTML, EPUB and many other formats, and install extra lua filters straight from the store inside the plugin.


## Features

### 1. Every Pandoc feature in a graphical interface

A flexible template editor lets you set up how notes are exported without using the command line. Everything is configurable: the table of contents and its depth, section numbering, the PDF engine, syntax highlighting, maths rendering, paper and font size, text direction, footnote placement and much more.

### 2. Dozens of export formats

Word, OpenOffice, PDF, LaTeX (a whole document or a fragment to paste into an existing project), HTML, EPUB, Beamer and reveal.js slides, PowerPoint, Markdown in CommonMark, GFM or Hugo flavours, Typst, TextBundle, RTF, MediaWiki, reStructuredText, Textile, OPML, plain text and a BibTeX bibliography of everything a note cites.

### 3. Exports that respect Obsidian's syntax

The plugin works around many of the problems of Pandoc itself and of other export plugins for Obsidian. Embedding `![[notes]]` and `![[notes#sections]]`, for one, works in full. `==Highlights==` survive, `$$…$$` blocks are put back together, and every `$today` in the note becomes today's date. Advanced settings and tweaks switch on the rest of the syntax — callouts, emoji shortcodes, bare URLs, hard line breaks and more.

### 4. Mobile support

With Pandoc WASM supported, you can install it into the plugin if you like: the process is automatic and asks nothing of you. Pandoc WASM runs inside Obsidian itself and takes next to no room on disk. Exporting and importing on a phone work as they do on a computer, except that they happen in the vault, and some of the features are limited by the platform itself.

### 5. Import files to the vault

The “Import a file and convert it to a note” command calls the import dialog and asks for the flavour of Markdown to format it in and the folder to put it in, and lets the reading and the writing be set more finely: Word's tracked changes, images extracted into a folder of the vault, the document's details kept as the note's properties, shifted headings, line wrapping and heading style.

### 6. A store of lua filters

A lua filter is a small script Pandoc applies to the document on export, which lets you tune the document more finely still: page breaks in Word, diagrams from Mermaid code blocks, embedded notes, chemical formulas or sheet music. The filter store offers more than three dozen of them, grouped by the problem they solve, each naming what it requires. A filter of your own can be added too — pasted into the store, or chosen as a file on the computer — and edited afterwards.

### 7. Pandoc, watched over

The plugin tracks Pandoc releases and offers to install them: the installed Pandoc is updated by hand, while Pandoc WASM updates itself. Pandoc's manual and its changelog can be opened straight from the plugin too.


## Installation

### First of all, install Pandoc

This is what you want if you are going to use the full Pandoc on a computer. For Pandoc WASM, see below.

1. The plugin drives Pandoc, but Pandoc has to be installed first, from the official site: [https://pandoc.org/installing.html](https://pandoc.org/installing.html).

2. Then either add it to your system `PATH`, or point the plugin at the installed program in its settings.

3. Exporting straight to PDF additionally needs a LaTeX distribution — MiKTeX, TeX Live, the [TinyTeX](https://github.com/rstudio/tinytex-releases) I recommend, or any other engine Pandoc supports.

### Option 1: Obsidian plugin store

1. In Obsidian settings open the tab "Community plugins" and click "Browse" button.

2. In the search bar type `Pandoc GUI`, click on the result, then "Install" and "Enable" buttons.

Alternatively, you can install the plugin by following the link to the community website: [https://community.obsidian.md/plugins/pandoc-gui](https://community.obsidian.md/plugins/pandoc-gui)

### Option 2: BRAT plugin

If you want to test beta-versions of the plugin or use previous versions, you can do that with `BRAT` plugin:

1. Install `BRAT` plugin from the official Obsidian plugin store.

2. In the `BRAT` settings, find the “Beta plugin list” section and click on the “Add beta plugin” button.

3. In the window that appears, paste the link to the `Pandoc GUI` plugin repository: [https://github.com/pan4ratte/obsidian-pandoc-gui](https://github.com/pan4ratte/obsidian-pandoc-gui)

4. Under “Select a version” choose the desired version and click the “Add plugin” button. The plugin will be automatically installed and will be ready to use.

### Mobile support: Pandoc WASM

The full Pandoc runs on a computer only, so to use it on a phone or a tablet you can install Pandoc WASM into the plugin itself: the process is fully automatic and asks nothing of you.

1. In the plugin settings find the “Pandoc WASM” card and press the install icon. The plugin downloads Pandoc's own official build, unpacks it and puts it in the plugin folder — there is nothing else to do.

2. Turn on “Use Pandoc WASM on this computer” to have Pandoc WASM convert instead of the installed Pandoc. It is off by default, and the installed Pandoc does the work. A phone and a tablet are not asked: WASM is the only thing that converts there, so everything about an installed Pandoc is left out of the settings.

So you need never install Pandoc on your computer at all, and can use Pandoc WASM instead. Pandoc WASM does have limits the ordinary version does not — they are built into the program itself. The user guide has the details.


## The lua-filter catalogue

The filters listed below can be found in the filter store in the plugin settings, or in the [`lua-filters/`](lua-filters/README.md) folder of this repository.

The catalogue currently offers:

**Structure**

| Filter | What it does | Needs |
| :--- | :---------- | :--- |
| [Abstract as a section](https://github.com/pandoc-ext/abstract-section) | Lets you write the abstract as an ordinary "# Abstract" heading instead of putting it in the note's properties. The filter moves that section into the metadata the templates read. | — |
| [Include other notes](https://github.com/pandoc-ext/include-files) | Splices whole notes into the document where you name them, so a thesis or a manual can stay a folder of small notes and still export as one file. | — |
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

## 1. Pandoc WASM specifics

Pandoc WASM works somewhat differently from the ordinary version because of how it is built. Before exporting with it, mind these limits:

* **PDF through Typst only.** Typst is a typesetting program that exports documents to PDF inside the WASM environment and works on a mobile device: Pandoc writes Typst source, and Typst sets the PDF from it through the “PDF (Typst)” template. It installs separately — in the plugin settings, on the Pandoc WASM card, press the extensions icon, where the fonts and emoji live too. The ordinary “PDF” template is set with LaTeX, which Pandoc WASM cannot start: templates like it are left out of the export dialog, as are Beamer slides.
* **LaTeX (.tex) templates do not work with Typst.** Typst is a different typesetting program with a language of its own: `--template=neurips.tex`, `-V geometry` and raw LaTeX (`\newpage`, `tikzpicture`) do not reach a Typst PDF. Maths, tables, images, the table of contents and citations work as they always did.
* **Typst has to be handed its fonts.** It cannot see the system's and works with what it was handed: Libertinus, New Computer Modern and DejaVu come in the package — Latin, Cyrillic and maths. Emoji are one button away in the extensions; for CJK, or a font of your own named in `-V mainfont`, point the same place at a folder of fonts in the vault.
* **No templates that run a command of your own.**
* **Lua filters only.** Ordinary Pandoc takes filters of other kinds, Python among them; WASM does not. The good news: every filter in the plugin's store is a lua filter.

### Pandoc WASM extensions

Pandoc WASM has limits built into how it works, and these extensions are what gets around them. The ordinary local Pandoc has no such limits, so the extensions matter above all on a mobile device. They install from the extensions icon on the Pandoc WASM card and live in the plugin folder, so a template can name them with `${pluginDir}`:

* **Typst** and **fonts** — typesetting a PDF, as above.
* **Emoji font** — Noto Color Emoji; without it the emoji in a note never reach the PDF.
* **Citation styles** — nine styles asked for often: APA, Chicago (both schemes), MLA, IEEE, AMA, Nature, Harvard and GOST R 7.0.5-2008. Name the one you want under “Citation style” in a template.
* **Pandoc layout templates** — its own HTML, LaTeX, Typst and EPUB templates, from the version you have: copy one, change it, name it under “Template”.
* **Reference documents** — reference.docx, .odt and .pptx, generated by Pandoc: set their styles the way you want them and name the file under “Reference document”.
* **MathJax, offline** — the library as a file, so an HTML export shows its maths without a connection.

What else to keep in mind:

* The file takes about 56 MB in the plugin folder. If you sync your vault between devices, the WASM file is synced along with it. Typst and its fonts are about 36 MB more, and only if you install it.
* Images named by URL are fetched by the plugin before the conversion starts and put into the document: Pandoc WASM itself never reaches the network. Up to 64 of them per export, and only what is written as an image — an ordinary link stays a link.
* WASM needs a recent phone: iOS 18.4 or newer, or an up-to-date Android WebView.
* Templates Pandoc WASM cannot run are left out of the export dialog.

### Options Pandoc WASM does not support

A supported template can still hold options Pandoc WASM does not support: they are left out of the export, and the export dialog says so beforehand.

Options you will be warned about:

* `--filter` — filters that are programs, which there is nothing to run. Lua filters (`--lua-filter`) work, and every filter in the plugin's store is one.
* `--defaults` — a Pandoc defaults file.
* `--sandbox`, `--fail-if-warnings`.
* Any option the plugin does not know, including deprecated ones such as `--atx-headers` and `--epub-chapter-level`.

Options that simply do nothing, and are not warned about because they change no result:

* `--pdf-engine`, `--pdf-engine-opt` — a PDF is always set with the Typst build that comes with the plugin.
* `--request-header`, `--no-check-certificate` — the plugin reaches the network, not Pandoc.
* `--data-dir`, `--log`, `--verbose`, `--quiet`, `--trace`, `--dump-args` — there are no system folders and no console to send them to.

## 2. Custom export commands

Choose `Custom` when creating an export template, and write whatever command you like — a Pandoc invocation the setting rows do not cover, or another program entirely. The variables below are filled in before it runs.

### Variables

You can use `${variables}` in your export command, their values are:

| Key                       | Value                                                        |
| ------------------------- | ------------------------------------------------------------ |
| `${outputPath}`           | Full path of the exported file. Exporting to `/User/aaa/Documents/test.pdf`, that is the whole of it. |
| `${outputDir}`            | Directory the exported file is saved in — `/User/aaa/Documents` in the case above. |
| `${outputFileName}`       | File name of the exported file without its extension — `test` above. |
| `${outputFileFullName}`   | File name of the exported file with its extension — `test.pdf` above. |
| `${currentPath}`          | Path of the note being exported. Editing `/User/aaa/Documents/readme.md`, that is the whole of it. |
| `${currentDir}`           | Directory of the note being exported — `/User/aaa/Documents` above. |
| `${currentFileName}`      | File name of the note without its extension — `readme` above. |
| `${currentFileFullName}`  | File name of the note with its extension — `readme.md` above. |
| `${vaultDir}`             | The vault's own directory. |
| `${attachmentFolderPath}` | Obsidian's `attachmentFolderPath`. |
| `${pluginDir}`            | This plugin's folder, for the resources it ships. |
| `${luaDir}`               | The plugin's `lua/` folder, where installed filters are written — what `--lua-filter` names. |
| `${embedDirs}`            | The folders of the files the note embeds, for `--resource-path`. |
| Other variables           | Write `keyword: value` in the note's [YAML front matter](https://jekyllrb.com/docs/front-matter/) and use it as `${metadata.keyword}`. |

### What can go inside `${...}`

Besides a variable name, `${...}` takes a small set of expressions — enough to let an option appear in the command only when it is wanted:

| Written | What it does |
| ------- | ------------ |
| `${metadata.keyword}`, `${today.iso}` | Field access; `${options["key"]}` is the same thing in brackets. |
| `` ${ x ? `--opt="${x}"` : `` } `` | A condition. Nested template literals work inside the branches. |
| `${x ?? "default"}`, `${x \|\| "fallback"}`, `${x && "…"}`, `${!x}` | Defaults and logic. |
| `${fmt === "pdf" ? "…" : "…"}` | Comparison: `===`, `!==`, `==`, `!=`. |

A name that is not among the variables stays in the command as written: `${user}` prints as `${user}`, so a typo shows up in the *Resulting command* line.


# About the Author

My name is Mark Ingrem and I am a Religious Studies scholar. Apart from my main area of study (Protestant Political Theology in Russia), I teach a university course called "Information Technologies in Scientific Research", which is based on my own unique program. This plugin helps me in my research and I use it in my teaching, along with the other plugins I develop, which you can find on [my GitHub profile](https://github.com/pan4ratte/).

Hello to every student who came across this page!


## Credits

This plugin began as a fork of [Enhancing Export](https://github.com/mokeyish/obsidian-enhancing-export) by **YISH ([@mokeyish](https://github.com/mokeyish))** — the quick start of this project was possible thanks to him.

Thanks are also owed to:

- **[John MacFarlane](https://johnmacfarlane.net/) and the other Pandoc contributors** for the best document converter in the world.
- **The [pandoc-ext](https://github.com/pandoc-ext) organisation** and the retired **[pandoc/lua-filters](https://github.com/pandoc/lua-filters)** collection.
- **[Better BibTeX](https://retorque.re/zotero-better-bibtex/)** for the Zotero filter the catalogue also offers.

---

In compliance with the Obsidian community guidelines, all external network calls should be disclosed in the plugin README and only made with user knowledge. This plugin makes network calls to [api.github.com](https://api.github.com) — to look up the latest Pandoc release for the version check in the settings — and to [raw.githubusercontent.com](https://raw.githubusercontent.com), to read the lua-filter catalogue when you open the store and to download a filter when you install one. Installing Typst — from the button in the settings — fetches the Typst build, its fonts and the MathJax library from [cdn.jsdelivr.net](https://cdn.jsdelivr.net), and the citation styles and Pandoc's own data files from GitHub. Exporting with Pandoc WASM downloads the images a note names by URL: those addresses are the ones you wrote in the note, and nothing else is requested.
