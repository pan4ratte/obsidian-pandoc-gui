/* The files the wasm build cannot fetch for itself.
 *
 * Everything here is something an installed pandoc would have had on hand — its own templates, its reference
 * documents, a citation style from wherever the user keeps them, a maths library off a CDN. The wasm build reaches no
 * network while it converts and a phone has no folder to put any of it in by hand, so the plugin fetches them on
 * request and keeps them in its own folder, where a template can name them with `${pluginDir}`.
 */

import { requestUrl } from 'obsidian';
import type PandocGuiPlugin from '../main';
import { bundledReferenceDoc, REFERENCE_FORMATS, type ReferenceFormat } from '../pandoc/reference_doc';

export type ExtensionId = 'csl' | 'templates' | 'reference' | 'mathjax';

/**
 * Where a file comes from, and what it is called once it is here — fetched from somewhere, or carried in the bundle,
 * which is the only way to have the documents pandoc styles a word processor's output after: they are not one file in
 * its repository but a folder it assembles at build time.
 */
export interface ExtensionFile {
  name: string;
  url?: string;
  /** The format whose bundled document it is, for a file there is nothing to download. */
  bundled?: ReferenceFormat;
}

export interface Extension {
  id: ExtensionId;
  /** The folder inside the plugin folder — and so the `${pluginDir}/…` a template names. */
  dir: string;
  /** Roughly what the whole of it comes to, for the card that offers it. */
  size: number;
  /**
   * The files to fetch. Read against the pandoc build that is installed, because two of these are pandoc's own data
   * files and a template from another version is a template for another pandoc.
   */
  files: (pandoc: string) => readonly ExtensionFile[];
}

const CSL = 'https://raw.githubusercontent.com/citation-style-language/styles/master';
const PANDOC = 'https://raw.githubusercontent.com/jgm/pandoc';

/** The styles a bibliography is asked for often enough to be worth having without going to look for one. */
const STYLES = [
  'apa',
  'chicago-author-date',
  'chicago-notes-bibliography',
  'modern-language-association',
  'ieee',
  'american-medical-association',
  'nature',
  'harvard-cite-them-right',
  'gost-r-7-0-5-2008',
];

/** Pandoc's own layouts for the formats a template here is most likely to want to change. */
const TEMPLATES = ['default.html5', 'default.latex', 'default.typst', 'default.epub3'];

/** The documents pandoc styles a word processor's output after — the ones `--reference-doc` is given a copy of. */
const REFERENCES = REFERENCE_FORMATS.map(format => ({ name: `reference.${format}`, bundled: format }));

/** What a version has to be for pandoc's repository to have a tag by that name. */
const asTag = (pandoc: string): string => (/^\d+\.\d+/.test(pandoc) ? pandoc : 'main');

export const EXTENSIONS: Record<ExtensionId, Extension> = {
  csl: {
    id: 'csl',
    dir: 'csl',
    size: 0.6 * 1024 * 1024,
    files: () => STYLES.map(name => ({ name: `${name}.csl`, url: `${CSL}/${name}.csl` })),
  },
  templates: {
    id: 'templates',
    dir: 'templates',
    size: 0.2 * 1024 * 1024,
    files: pandoc => TEMPLATES.map(name => ({ name, url: `${PANDOC}/${asTag(pandoc)}/data/templates/${name}` })),
  },
  reference: {
    id: 'reference',
    dir: 'reference',
    size: 0,
    files: () => REFERENCES,
  },
  mathjax: {
    id: 'mathjax',
    dir: 'mathjax',
    size: 1.2 * 1024 * 1024,
    files: () => [{ name: 'tex-svg-full.js', url: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg-full.js' }],
  },
};

/** How far through the files an install is. */
export type ExtensionProgress = (done: number, total: number) => void;

const asBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export class ExtensionManager {
  constructor(private plugin: PandocGuiPlugin) {}

  /** The folder an extension's files live in, as a vault path. */
  directory(id: ExtensionId): string {
    return `${this.plugin.manifest.dir.replaceAll('\\', '/')}/${EXTENSIONS[id].dir}`;
  }

  /** The same folder as a template writes it, which is the one thing the card has to tell anyone. */
  templatePath(id: ExtensionId): string {
    return `\${pluginDir}/${EXTENSIONS[id].dir}`;
  }

  #files(id: ExtensionId): readonly ExtensionFile[] {
    return EXTENSIONS[id].files(this.plugin.settings.wasmVersion ?? '');
  }

  /** Whether it is here — the first file answers for the rest, as it does for a font pack. */
  async isInstalled(id: ExtensionId): Promise<boolean> {
    return await this.plugin.app.vault.adapter.exists(`${this.directory(id)}/${this.#files(id)[0].name}`);
  }

  /** Put an extension in place: every file fetched, or taken out of the bundle where there is nothing to fetch. */
  async install(id: ExtensionId, onProgress?: ExtensionProgress): Promise<void> {
    const { adapter } = this.plugin.app.vault;
    const files = this.#files(id);
    await adapter.mkdir(this.directory(id));

    let done = 0;
    onProgress?.(0, files.length);
    for (const file of files) {
      const bytes = file.url ? await this.#fetch(file) : asBuffer(bundledReferenceDoc(file.bundled));
      await adapter.writeBinary(`${this.directory(id)}/${file.name}`, bytes);
      onProgress?.((done += 1), files.length);
    }
  }

  async #fetch(file: ExtensionFile): Promise<ArrayBuffer> {
    const { status, arrayBuffer } = await requestUrl({ url: file.url, throw: false });
    if (status < 200 || status >= 300) {
      throw new Error(`${file.name}: ${status}`);
    }
    return arrayBuffer;
  }

  async remove(id: ExtensionId): Promise<void> {
    const { adapter } = this.plugin.app.vault;
    for (const file of this.#files(id)) {
      const path = `${this.directory(id)}/${file.name}`;
      if (await adapter.exists(path)) {
        await adapter.remove(path);
      }
    }
  }
}
