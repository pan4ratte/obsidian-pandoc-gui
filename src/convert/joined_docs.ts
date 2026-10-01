/* The Word documents a docx export is joined with: named by the template, or by the note for itself. */

import { TFile, getLinkpath, type App } from 'obsidian';
import { joinDocx, type JoinedDocument } from '../docx/join';
import type { StyleMode } from '../docx/styles';
import type { PandocExportSetting } from '../settings';
import type { FileStore } from '../system/file_store';
import { isAbsolute, normalize, stem } from '../system/paths';
import { renderTemplate } from '../system/utils';
import { t } from '../lang/helpers';

/** The note's properties that overrule the template's documents. */
export const JOIN_PROPERTIES = { before: 'docx-before', after: 'docx-after' } as const;

type Side = keyof typeof JOIN_PROPERTIES;

export interface Joins {
  before: JoinedDocument[];
  after: JoinedDocument[];
  styles: StyleMode;
}

const decode = (text: string) => {
  try {
    return decodeURI(text);
  } catch {
    return text;
  }
};

/** `[[x]]`, `[a](x)` or `x`, as the `x` it names. */
export const linkTarget = (value: string): string => {
  const text = value.trim();
  const wiki = /^!?\[\[([^\]|#]+)[^\]]*\]\]$/.exec(text);
  if (wiki) {
    return wiki[1].trim();
  }
  const markdown = /^!?\[[^\]]*\]\(<?([^)>]+?)>?\)$/.exec(text);
  return markdown ? decode(markdown[1].trim()) : text;
};

/** One link or a list of them; an empty property names nothing, and so joins nothing. */
export const propertyLinks = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).filter((v): v is string => typeof v === 'string' && v.trim() !== '').map(linkTarget);

/** What the note's property names on a side, or nothing where the note has no such property. */
const noteLinks = (frontMatter: unknown, side: Side): string[] | undefined => {
  const properties = (frontMatter ?? {}) as Record<string, unknown>;
  const key = JOIN_PROPERTIES[side];
  return Object.prototype.hasOwnProperty.call(properties, key) ? propertyLinks(properties[key]) : undefined;
};

/** The template's documents on a side. `flat`: a template saved before the lists held a single path. */
export const templatePaths = (setting: Pick<PandocExportSetting, 'joinBefore' | 'joinAfter'> | undefined, side: Side): string[] =>
  [side === 'before' ? setting?.joinBefore : setting?.joinAfter]
    .flat()
    .filter((path): path is string => typeof path === 'string' && path.trim() !== '')
    .map(path => path.trim());

/** The documents each side names: the export dialog's pick, then the note's property, then the template's. */
export const namedDocuments = (
  setting: Pick<PandocExportSetting, 'joinBefore' | 'joinAfter' | 'joinChosen'>,
  frontMatter: unknown,
  variables: Record<string, unknown>
): Record<Side, string[]> => {
  const named = (side: Side) => {
    const chosen = setting.joinChosen?.[side];
    if (chosen) {
      return chosen.map(path => linkTarget(renderTemplate(path, variables)));
    }
    return noteLinks(frontMatter, side) ?? templatePaths(setting, side).map(path => renderTemplate(path, variables));
  };
  return { before: named('before'), after: named('after') };
};

/** What each side names as written, for the export dialog to show before anything is picked. */
export const shownDocuments = (
  setting: Pick<PandocExportSetting, 'joinBefore' | 'joinAfter'>,
  frontMatter: unknown
): Record<Side, string[]> => {
  const shown = (side: Side) => noteLinks(frontMatter, side) ?? templatePaths(setting, side);
  return { before: shown('before'), after: shown('after') };
};

/** A path on the machine, or a link resolved the way the note's own links are. */
const resolveLink = (app: App, note: TFile, link: string): string | undefined => {
  if (isAbsolute(link)) {
    return normalize(link);
  }
  const file = app.metadataCache.getFirstLinkpathDest(getLinkpath(link), note.path);
  return file instanceof TFile ? normalize(app.vault.adapter.getFullPath(file.path)) : undefined;
};

/** The documents to join, read — or nothing, where neither the template nor the note names any. */
export async function collectJoins(options: {
  app: App;
  note: TFile;
  setting: PandocExportSetting;
  frontMatter: unknown;
  variables: Record<string, unknown>;
  files: FileStore;
}): Promise<Joins | undefined> {
  const { app, note, setting, files } = options;
  const named = namedDocuments(setting, options.frontMatter, options.variables);
  if (named.before.length === 0 && named.after.length === 0) {
    return undefined;
  }
  const read = async (link: string): Promise<JoinedDocument> => {
    const path = resolveLink(app, note, link);
    const bytes = path ? await files.read(path) : undefined;
    if (!path || !bytes) {
      throw new Error(t.JOIN_NOT_FOUND(link));
    }
    return { name: stem(path), bytes };
  };
  return {
    before: await Promise.all(named.before.map(read)),
    after: await Promise.all(named.after.map(read)),
    styles: setting.joinStyles ?? 'own',
  };
}

/** The exported file at `path`, rewritten with `joins` around it. */
export async function joinExport(files: FileStore, path: string, joins: Joins): Promise<void> {
  const exported = await files.read(path);
  if (!exported) {
    throw new Error(t.JOIN_FAILED(t.JOIN_NO_OUTPUT));
  }
  const joined = await joinDocx(exported, { ...joins, dropProperties: Object.values(JOIN_PROPERTIES) }).catch((e: unknown) =>
    e instanceof Error ? e : new Error(typeof e === 'string' ? e : 'unknown error')
  );
  if (joined instanceof Error) {
    // The file pandoc wrote is left as it was: the note itself, without the documents.
    throw new Error(t.JOIN_FAILED(joined.message));
  }
  await files.write(path, joined);
}
