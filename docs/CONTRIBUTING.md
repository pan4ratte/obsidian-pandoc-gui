# Contributing to Pandoc GUI

Thank you for wanting to work on this plugin. Bug reports, export templates,
lua filters for the catalogue and pull requests are all welcome, and this file
says what you need to know before opening one.

The shortest useful contributions are usually not code: a failing export with
the *Resulting command* from the template editor and the text of the error box
pasted into an issue tells us almost everything.

## Getting set up

1. **Node.js** — version 24 or newer, as in CI.
   [https://nodejs.org/en/download](https://nodejs.org/en/download)

2. **Pandoc** — the plugin drives it and part of the test suite runs it, so it
   has to be on your `PATH`. Version 3.1.9 or newer.
   [https://pandoc.org/installing.html](https://pandoc.org/installing.html)

3. **The repository**

   ```shell
   git clone https://github.com/pan4ratte/obsidian-pandoc-gui.git
   cd obsidian-pandoc-gui
   npm ci
   ```

## A note on `package-lock.json`

It used to have to be regenerated on Linux: `npm install` on Windows resolved
two fewer entries, dropping top-level `@emnapi/core` and `@emnapi/runtime` —
optional transitive deps of the native `@unrs/resolver` binding — and `npm ci`
then failed on Linux with "package.json and package-lock.json are not in sync".

`@unrs/resolver` came in through jest, and left with it. Windows and Linux now
resolve the same 467 packages at the same versions, so regenerating the lockfile
on either produces the same file. The CI step that checked for the two entries
has been removed along with them; it could only ever have failed.

## Running it in a vault

The repository folder is itself a loadable plugin folder: `manifest.json` and
`styles.css` are committed at the root, and the build writes `main.js` beside
them. So the quickest setup is to clone into a test vault's
`.obsidian/plugins/` and build in place.

```shell
npm run dev      # rebuild on every change
npm run build    # one production build
```

To keep the sources elsewhere and build into a vault instead, add `.env.local`
at the project root:

```shell
# build straight into an obsidian plugin folder
OUT_DIR="path/to/.obsidian/plugins/pandoc-gui"
```

When `OUT_DIR` points somewhere else, `manifest.json` and `styles.css` are
copied along with `main.js`. When it does not — the default — only `main.js` is
written, because copying those two onto themselves would fail.

**`styles.css` is a source file, not build output.** It is edited by hand and
committed; nothing generates it, and a build never overwrites it.

Obsidian reloads a plugin when its folder changes if you have the
[Hot Reload](https://github.com/pjeby/hot-reload) plugin installed, which is
worth having for `npm run dev`.

To see the plugin's own debug output — and to keep a plugin that throws while
loading from failing quietly on each reload — open DevTools with `Ctrl+Shift+I`
(or `F12`) and run this once in the Console tab:

```shell
localStorage.setItem('debug-plugin', '1')
```

More debugging tips:
[How to debug TypeScript in Chrome](https://blog.logrocket.com/how-to-debug-typescript-chrome/)

## The checks

Everything below runs in CI on every pull request, and all of it is quick:

```shell
npm run typecheck             # tsc --noEmit
npm run lint                  # eslint, including the obsidianmd plugin rules
npm run format-check          # prettier over src/ and tests/
npm run docs:catalogue:check  # the lua-filter catalogue is generated, not hand-edited
npm test                      # vitest
```

`npm run lint-fix` and `npm run format-fix` apply what the first two can fix on
their own. Anything else `package.json`'s `scripts` offers is fair game too.

## What lives where

| Path | What is in it |
| --- | --- |
| `src/` | The plugin. `main.ts` is the entry point; `settings.ts` is the data model the rest of it reads. |
| `src/convert/` | An export and an import from end to end, and the error text a failed one comes to. |
| `src/pandoc/` | Which Pandoc runs and what it can be asked to do: `engine.ts` chooses between the installed one and the wasm build, `pandoc.ts` finds and questions the installed one, and the format files say which rows a writer or a reader can answer. |
| `src/args/` | The template editor's rows, read out of and written back into a template's arguments. |
| `src/filters/` | The store: reading the catalogue, installing, uninstalling, and the `--lua-filter` argument a template runs one through — plus the rows for the filters the plugin ships. |
| `src/templates/` | The templates the plugin ships with, and the expression language behind `${...}` in them. |
| `src/system/` | Paths, platform and file access. Everything that must also work where there is no node — a phone — is reached through here. |
| `src/wasm/` | Pandoc's wasm build: installing it, running it, and the defaults file it is driven by. |
| `src/ui/` | Solid components: `settings/` is the settings tab, `dialogs/` the export, import and store modals, `components/` the widgets they share. |
| `src/lang/` | Every string the user sees. `en.ts` is the type every other locale satisfies; `ru.ts` is the Russian one. |
| `lua-filters/` | The filters: `bundled/` is what the plugin ships, the rest is the store's catalogue. See its [readme](../lua-filters/README.md). |
| `textemplate/` | LaTeX templates embedded into the build alongside the bundled filters. |
| `reference-docs/` | Pandoc's own `reference.docx`, `.odt` and `.pptx`, embedded into the build as base64. See below. |
| `docs/` | This file, the changelog, the user guide and the Russian readme. |
| `scripts/` | `gen-catalogue.js`, which writes the catalogue table in the readme, and `version.mjs`, which bumps the version across `package.json`, `manifest.json` and `versions.json`. |
| `tools/` | Build helpers the vite and vitest configs load. |
| `tests/` | Vitest specs, laid out to mirror `src/`. Some shell out to the real Pandoc. |
| `styles.css` | The stylesheet, edited by hand. |

## Adding an export template

Add an entry to `src/templates/export_templates.ts`. A template is a name, a `type`, the
arguments Pandoc is given and the extension the file is written with; the
comments at the top of that file explain the variables the arguments may use and
why the shared fragments exist. Templates the plugin ships are merged into a
vault's saved settings on load — a user's edits to one are stored as the
difference from the default, so renaming a shipped template retires it rather
than updating it.

Please export something real with a new template before proposing it.

## Adding a row to the template editor

A row is three things: the argument it reads and writes (in `src/args/writer_args.ts`,
or `src/filters/filter_args.ts` for the rows that run a bundled filter), the formats it
is shown for (`src/pandoc/pandoc_format.ts`), and its strings (`src/lang/en.ts`). Rows are
offered only to the writers that would do something with them, so a row with no
format restriction should genuinely apply everywhere.

Two rules the editor depends on: a row never writes into *Extra commands*,
which belongs to the user, and a row's argument must survive a round trip —
written into a template, read back out, and shown as the same value.

## Adding a lua filter to the catalogue

The catalogue lives in `lua-filters/`, and its [readme](../lua-filters/README.md)
is the reference: what an entry carries, which folder the file goes in, and why
every filter offered is vendored in this repository rather than fetched from
wherever it was published.

In short: commit the `.lua` file unmodified under the folder for where it came
from, add its entry to `lua-filters/index.json` — leaving `fileName` out, since
it is derived from `path` — then run

```shell
npm run docs:catalogue
npm test
```

The first normalises your entry and rewrites the catalogue table in the
project's readme; that table is generated between two fixed prose lines and
should never be edited by hand. Include both changed files in the pull request,
or CI's `docs:catalogue:check` will fail.

Only add filters whose licence permits redistribution, and keep the original
licence header in the file. Every entry has to name its author and licence.

## Refreshing the reference documents

`reference-docs/` holds the three documents a word processor's export takes its
styles from — the files `--print-default-data-file` prints. They are in the
repository because the wasm build has no way to reach them: its `convert`
refuses the option and its `query` answers only for versions and formats, and
Pandoc's own repository keeps no copy of them either, assembling that folder at
build time. So a phone gets them from the bundle. A computer prints its own from
the Pandoc it has, which is the one its exports are styled by.

Pandoc changes them between releases, so print them again whenever a new release
is looked at, with that release's Pandoc:

```bash
for f in docx odt pptx; do
  pandoc -o "reference-docs/reference.$f" --print-default-data-file "reference.$f"
done
```

Then move `BUNDLED_REFERENCE_VERSION` in `src/pandoc/reference_doc.ts` to the
version they were printed from. `tests/pandoc/referenceDoc.spec.ts` checks the
bundle against the files, so a stale build fails rather than ships.

Pandoc assembles these zips as it prints them and stamps every entry with the
clock, so reprinting always changes the bytes — a diff in `reference-docs/` is
not by itself a sign that Pandoc changed anything. What the entries hold is what
to compare; the spec does exactly that where it checks a printed document.

## Translations

`src/lang/en.ts` is the shape every other locale must satisfy — `ru.ts` is one,
and a new one is a file beside them, exporting the same keys, registered in the
`localeMap` of `src/lang/helpers.ts`. Nothing user-visible should be written as
a literal outside that folder.

## Pull requests

- One subject per pull request; a rename, a refactor and a fix are three.
- Run the checks above before pushing.
- Say what you exported to test it — the format, and the platform you are on.
  Word, PDF and LaTeX exports depend on things (a reference document, a TeX
  distribution) that CI does not have.
- Keep the existing style: comments explain *why* something is the way it is,
  not what the next line does. Prettier settles everything else.
- New behaviour that can be tested without Pandoc should come with a spec.

## Reporting a bug

Include the plugin version, your platform, the Pandoc version shown in the
settings, the template you exported with, the *Resulting command* copied from
the foot of the template editor, and what the error box said. An export that
fails only for one note is worth attaching that note to, reduced to the part
that still fails.
