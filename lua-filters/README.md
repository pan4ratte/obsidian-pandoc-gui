# The lua filters

Every lua filter in this repository is kept here: the ones the plugin ships with,
in `bundled/`, and the ones its store offers, in the folders they came from.

`index.json` is the catalogue the plugin's **Browse lua-filters** store reads, and
every filter it lists is kept **in this folder**. Browsing the store is one
request — this file — and installing one is one more, for a file committed here.

Nothing is read from the GitHub API, from the [pandoc-ext] organisation, or from
anyone else's repository while the store is open. That is deliberate:

- a filter that is renamed, moved or withdrawn cannot empty the store;
- the GitHub API's per-address rate limit cannot empty it either;
- what a card says is written for this store, not inherited from whatever a
  repository description happened to say — several upstream filters had none at
  all;
- and what is installed is the file that was reviewed when it was vendored, not
  whatever the branch holds today.

It also fixes something the live listing got silently wrong: most pandoc-ext
repositories keep the real filter in `_extensions/<name>/<name>.lua` and leave a
**symlink** at the root. Fetching the raw root path returned the *link's text* —
a 25-byte file naming a path — which pandoc would then fail on.

The vendored copies are unmodified, licence headers included. Every entry names
its author and licence; all of them are MIT.

[pandoc-ext]: https://github.com/pandoc-ext

## Where the files came from

| Folder | Origin |
| --- | --- |
| `bundled/` | This plugin's own — see below. Not catalogue entries: they are embedded in `main.js`, written to the plugin's `lua/` folder on load, and run by name. |
| `pandoc-ext/` | The [pandoc-ext] organisation — the filters the pandoc project maintains today. |
| `pandoc/` | The retired [pandoc/lua-filters] collection, for the filters pandoc-ext has not re-published. |
| `pan4ratte/` | `Obsidian/Pandoc/filters` in [pan4ratte/course-it-in-science], written for exporting Obsidian notes to Word. `zotero.lua` there is [Better BibTeX]'s, vendored with it. Several of these have since moved to `bundled/`, and `strip-wikilinks.lua` was written for this plugin. |

[pandoc/lua-filters]: https://github.com/pandoc/lua-filters
[pan4ratte/course-it-in-science]: https://github.com/pan4ratte/course-it-in-science
[Better BibTeX]: https://retorque.re/zotero-better-bibtex/exporting/

## What is bundled, and why it is not in the store

A filter whose whole job is one row in the template editor belongs to the
plugin, not to a shelf the user has to go shopping on first. Each of these fixes
something that happens to *every* vault exporting to that format, needs no
external program, and has one obvious answer — so it ships, and the row writes
its `--lua-filter` and its `-M` fields together.

| Filter | The row | What it fixes |
| --- | --- | --- |
| `embeds.lua` | Write in embedded notes | `![[a note]]` is a transclusion; pandoc reads it as an image that is not there. The plugin resolves the link (only Obsidian can) and hands the map over in `OBSIDIAN_EMBEDS`. |
| `today.lua` | Write today's date for `$today` | The date arrives already written, as `-M today=…`, because the plugin can write it in any language the machine has. This used to be two filters, English and Russian. |
| `keywords.lua` | Print the keywords property | The note's `keywords` property stays in the file's properties instead of appearing in the document. |
| `figures.lua` | Style images as figures | A captionless image is a paragraph to pandoc, so it lands in body text. |
| `table-styles.lua` | Style text in table cells | The docx writer stamps "Compact" on every cell, which outranks the table style in Word. |
| `list-styles.lua` | Use Word's list styles | Pandoc's own numbering carries its own indent and bullet, and direct formatting beats a style. |
| `float_placement.lua` | Keep images where they stand | LaTeX carries a captioned image off to wherever it fits best, so two pictures with a paragraph between them come out as one picture, all of the text, and the other picture alone on the next page. |
| `wikilink_images.lua` | — | Pandoc's wikilink reader takes everything after the first `\|` as the image's description, so Obsidian's `![[image.png\|описание\|500]]` prints the width as part of the caption, and `![[image.png]]` is captioned with the file's own name. Runs in every preset that carries images. |
| `markdown.lua`, `markdown+hugo.lua`, `math_block.lua`, `pdf.lua`, `citefilter.lua` | — | Named by the presets themselves rather than by a row. |
| `polyfill.lua`, `url.lua` | — | Libraries `markdown.lua` requires. |

Everything else stays in the catalogue: a filter needing a program installed, a
network, or a judgement only the author of the document can make is a filter
someone should choose deliberately.

The folders are provenance only. What the **store** shows is the `category` —
the shelves below — because a reader is looking for the thing that fixes their
export, not for the organisation that published it. A filter's origin is still
one click away, on the card's *Open readme* button.

## The shelves

| `category` | Shown as | What is on it |
| --- | --- | --- |
| `structure` | Structure | Assembling the document: includes, page breaks, abstracts, format-only content, the kind of document it is. |
| `citations` | Citations | Bibliographies, citekeys, DOIs, author metadata. |
| `figures` | Figures & math | Diagrams, maths, music, captions. |
| `prose` | Text & typography | How the text is set: quotes, indents, fonts, highlighted code, table spacing. |
| `other` | Tools & other | Filters that report on a document instead of exporting it, and anything with a category this plugin does not know. |

## Entry schema

```jsonc
{
  "filters": [
    {
      // Required. Unique within the catalogue, and what the installed record is
      // keyed by — changing it makes the entry a different filter.
      "id": "wordcount",

      // Required: one of "path" or "url".
      // "path" is resolved against this folder's URL — use it for anything
      // vendored here. "url" may point anywhere and wins if both are given.
      "path": "pandoc/wordcount.lua",

      // Shown on the card. "storeName" defaults to the id; write the name for
      // what the filter *does*, not the file it lives in.
      "storeName": "Word count",
      "description": "Counts the words pandoc reads, not the characters the file holds.",

      // Whose work this is, and on what terms. Shown together: "by X · MIT".
      "author": "John MacFarlane",
      "license": "MIT",

      // One of the shelves above. An unknown or missing one becomes "other".
      "category": "other",

      // Optional. The output formats the filter is written for, as families:
      // "latex" (latex, beamer, pdf), "docx", "odt", "html" (html*, epub*),
      // "slides" (revealjs, beamer, pptx, …), "markdown" (markdown*,
      // commonmark*, gfm, …) or "typst".
      //
      // A template only offers the filters that can do something for what it
      // writes, so a filter setting Word styles is not offered to a LaTeX
      // export. Leave it out for a filter that works on the document rather
      // than on the output — most do — and it is offered everywhere.
      "formats": ["latex"],

      // Optional. What has to exist before the filter can work — an external
      // program, a style in the reference document, another filter ahead of it.
      // Shown on the card *before* the Install button, so a missing dependency
      // is not discovered as a failed export.
      "requires": "The aspell program on the PATH.",

      // ISO date, compared as a string against the installed copy's to offer an
      // update. Bump it whenever the vendored file changes; omit it and the
      // filter simply never reports one.
      "updated": "2026-08-07",

      // What the filter is called in the plugin's lua/ folder. A catalogue of
      // someone else's may leave it out, and it then defaults to "<id>.lua"; in
      // this one it is written by the generator from the last segment of `path`,
      // since that is the file being served. It is also the name the
      // --lua-filter argument uses, so it must be unique across everything
      // installed.
      "fileName": "wordcount.lua",

      // Optional. Adds the card's "Open readme" button — point it upstream.
      "homepage": "https://github.com/pandoc/lua-filters/tree/master/wordcount",

      // The card in the other languages the plugin is read in, keyed by the
      // language Obsidian is set to ("ru" answers for "ru-RU"). Only the three
      // fields a card *reads* can be translated — a name, what it does and what
      // it needs; what is fetched and where it lands are the same everywhere.
      //
      // Field by field, and the English wherever a translation stops. In this
      // catalogue it is not optional: an entry must carry every language, and
      // must translate `requires` exactly when it has one, or a reader would be
      // the only one not told about a dependency.
      "i18n": {
        "ru": {
          "storeName": "Подсчёт слов",
          "description": "Считает слова, которые читает pandoc, а не символы в файле.",
          "requires": "Программа aspell в PATH."
        }
      }
    }
  ]
}
```

An entry with no `id`, or with neither `path` nor `url`, is skipped rather than
treated as an error — one malformed row cannot take the catalogue down with it.
A file name is only offered once: the first row to claim it keeps it, and a name
the plugin already ships is never offered at all.

`tests/luaFilterCatalogue.spec.ts` holds this file to the schema — every `path`
must exist, ids and file names must be unique, and every entry must carry a name,
a description, an author, a licence, a known category and its translations.
`scripts/gen-catalogue.js` refuses the same things when it rewrites the file, and
CI runs it in `--check` mode, so neither a malformed entry nor a stale table
survives a pull request.

## Adding a filter

1. Commit the `.lua` file under the folder for where it came from, unmodified.
   Not `bundled/` — that folder is what the plugin ships, and a name in it is a
   name the store will never offer.
2. Add its entry, filling in `requires` if it needs anything the user has to
   provide, and `i18n` with the card in every language. Leave `fileName` out; it
   is derived from `path`.
3. Run `npm run docs:catalogue`, which normalises the entry and rewrites the
   catalogue tables in the project's [readme](../README.md) and its
   [Russian one](../docs/README_RU.md).
4. Run `npm test`.

The tables in those readmes are generated, never hand-written: each sits between
two fixed prose lines in its own language — “The catalogue currently offers:” and
“Want to add a filter of your own?” — and everything between them is replaced on
every run. Each is built from the entries the store reads, in the language that
readme is written in, so a table and a card can never disagree.

The base URL is overridable per vault through the `luaFilterRepoUrl` setting, so
a vault can point the store at a catalogue of its own instead.

## What installing does

The file is downloaded into the plugin's `lua/` folder — the one in an installed
plugin folder, written on load from `bundled/` and never committed here — and
recorded in `data.json`. Two names are refused: one that
belongs to a bundled filter (it would be overwritten on the next start) and one
already taken by a different installed filter.

Installing does not run anything. A filter runs only once a template asks for it,
which is settled in the **template editor**: each Pandoc template has a *Lua
filters* row listing what it runs, with a dropdown offering the rest of what is
installed. Adding one appends

```
--lua-filter="${luaDir}/<fileName>"
```

to that template's *Extra arguments*. Extra arguments, not the arguments proper:
those are rewritten wholesale whenever the template's output format changes, and
would take the filter with them.

Uninstalling a filter also takes it back out of every template that ran it — the
file is gone, and a template still naming it would fail the whole export.
