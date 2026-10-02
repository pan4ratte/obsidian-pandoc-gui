import type { PandocExportSetting } from '../settings';

/* The document's own fields a template can fill in, handed to pandoc as a metadata file. */

export const DOCUMENT_FIELDS = [
  'title',
  'subtitle',
  'author',
  'date',
  'abstract',
  'abstract-title',
  'keywords',
  'subject',
  'description',
  'category',
  'toc-title',
] as const;

export type DocumentField = (typeof DOCUMENT_FIELDS)[number];

/** Kept as one pill an item, and written as a list, which Word needs to show keywords at all. */
export const LIST_FIELDS = ['author', 'keywords'] as const satisfies readonly DocumentField[];

export type ListField = (typeof LIST_FIELDS)[number];

export const isListField = (field: DocumentField): field is ListField => (LIST_FIELDS as readonly DocumentField[]).includes(field);

export type DocumentMetadata = { [F in DocumentField]?: F extends ListField ? string[] : string };

/** Fields that take paragraphs rather than a line. */
export const MULTILINE_FIELDS: readonly DocumentField[] = ['abstract', 'description'];

/** The variable naming the file, filled in at export. */
const METADATA_FILE = '${metadataFile}';

const isEmpty = (value?: string | string[]) => (Array.isArray(value) ? value.length === 0 : !value?.trim());

export const hasDocumentMetadata = (setting?: Pick<PandocExportSetting, 'documentMetadata'>): boolean =>
  Object.values(setting?.documentMetadata ?? {}).some(value => !isEmpty(value));

/** Goes before the rows' arguments: the note's properties and any `-M` outrank a metadata file wherever it stands. */
export const metadataFileArg = (setting?: Pick<PandocExportSetting, 'documentMetadata'>): string | undefined =>
  hasDocumentMetadata(setting) ? `--metadata-file="${METADATA_FILE}"` : undefined;

/** The file's contents, each value passed through `render` first so a field can hold `${...}`. */
export const metadataFileContents = (fields: DocumentMetadata | undefined, render: (value: string) => string): string => {
  const meta: Record<string, string | string[]> = {};
  for (const field of DOCUMENT_FIELDS) {
    if (isListField(field)) {
      const items = [fields?.[field] ?? []]
        .flat()
        .map(item => render(item.trim()).trim())
        .filter(Boolean);
      if (items.length > 0) {
        meta[field] = items;
      }
      continue;
    }
    const value = render(fields?.[field]?.trim() ?? '').trim();
    if (value) {
      meta[field] = value;
    }
  }
  // JSON is YAML, and pandoc reads its strings as Markdown just the same.
  return JSON.stringify(meta, null, 2);
};

/** `fields` with `field` set, or dropped at an empty value; nothing at all once every field is empty. */
export const setDocumentField = <F extends DocumentField>(
  fields: DocumentMetadata | undefined,
  field: F,
  value: DocumentMetadata[F]
): DocumentMetadata | undefined => {
  const next: DocumentMetadata = { ...fields };
  if (isEmpty(value)) {
    delete next[field];
  } else {
    next[field] = value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
};
