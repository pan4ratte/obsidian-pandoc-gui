/* A Word document as the zip of parts it is: their bytes, their relationships, and their content types. */

import { readZip, writeZip } from '../system/zip';
import { CONTENT_TYPES, PACKAGE_RELS, parseXml, serializeXml } from './xml';

export const REL_BASE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';

export const CT_BASE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.';

const CONTENT_TYPES_PART = '[Content_Types].xml';

export interface Relationship {
  id: string;
  type: string;
  target: string;
  external: boolean;
}

/** The last segment of a relationship type, which transitional and strict documents share. */
export const relKind = (type: string): string => type.slice(type.lastIndexOf('/') + 1);

const dirOf = (path: string): string => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

const extOf = (path: string): string => (/\.([^./]+)$/.exec(path)?.[1] ?? '').toLowerCase();

const decode = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

/** Where a part keeps its relationships; the package's own are `_rels/.rels`. */
const relsPathOf = (part: string): string => {
  const dir = dirOf(part);
  return `${dir ? `${dir}/` : ''}_rels/${part.slice(dir ? dir.length + 1 : 0)}.rels`;
};

/** The part a relationship of `from` points at, as a path inside the package. */
export const resolveTarget = (from: string, target: string): string => {
  const segments = target.startsWith('/') ? [] : dirOf(from).split('/').filter(Boolean);
  for (const segment of target.split('/')) {
    if (segment === '..') {
      segments.pop();
    } else if (segment && segment !== '.') {
      segments.push(decode(segment));
    }
  }
  return segments.join('/');
};

const relativeTarget = (from: string, to: string): string => {
  const fromDir = dirOf(from).split('/').filter(Boolean);
  const toParts = to.split('/');
  let common = 0;
  while (common < fromDir.length && common < toParts.length - 1 && fromDir[common] === toParts[common]) {
    common += 1;
  }
  return [...fromDir.slice(common).map(() => '..'), ...toParts.slice(common).map(encodeURIComponent)].join('/');
};

export class DocxPackage {
  readonly #files: Map<string, Uint8Array>;
  readonly #docs = new Map<string, Document>();

  private constructor(
    files: Map<string, Uint8Array>,
    readonly label: string
  ) {
    this.#files = files;
  }

  static async open(bytes: Uint8Array, label: string): Promise<DocxPackage> {
    let files: Map<string, Uint8Array>;
    try {
      files = await readZip(bytes);
    } catch {
      throw new Error(`"${label}" is not a Word document`);
    }
    if (!files.has(CONTENT_TYPES_PART)) {
      throw new Error(`"${label}" is not a Word document`);
    }
    return new DocxPackage(files, label);
  }

  /** The name the package stores `path` under: part names are case-insensitive. */
  #key(path: string): string | undefined {
    if (this.#files.has(path) || this.#docs.has(path)) {
      return path;
    }
    const lower = path.toLowerCase();
    return [...this.#files.keys(), ...this.#docs.keys()].find(key => key.toLowerCase() === lower);
  }

  has(path: string): boolean {
    return this.#key(path) !== undefined;
  }

  bytes(path: string): Uint8Array | undefined {
    const key = this.#key(path);
    if (key === undefined) {
      return undefined;
    }
    const doc = this.#docs.get(key);
    return doc ? new TextEncoder().encode(serializeXml(doc)) : this.#files.get(key);
  }

  xml(path: string): Document | undefined {
    const key = this.#key(path);
    if (key === undefined) {
      return undefined;
    }
    let doc = this.#docs.get(key);
    if (!doc) {
      doc = parseXml(new TextDecoder().decode(this.#files.get(key)), `${this.label}: ${key}`);
      this.#docs.set(key, doc);
    }
    return doc;
  }

  setXml(path: string, doc: Document): void {
    this.#files.delete(path);
    this.#docs.set(path, doc);
  }

  setBytes(path: string, data: Uint8Array): void {
    this.#docs.delete(path);
    this.#files.set(path, data);
  }

  /** `desired`, or the nearest name to it no part has yet. */
  uniquePath(desired: string): string {
    if (!this.has(desired)) {
      return desired;
    }
    const dot = desired.lastIndexOf('.');
    const [stem, ext] = dot > desired.lastIndexOf('/') ? [desired.slice(0, dot), desired.slice(dot)] : [desired, ''];
    for (let n = 2; ; n += 1) {
      const candidate = `${stem}_${n}${ext}`;
      if (!this.has(candidate)) {
        return candidate;
      }
    }
  }

  async save(): Promise<Uint8Array> {
    for (const [path, doc] of this.#docs) {
      this.#files.set(path, new TextEncoder().encode(serializeXml(doc)));
    }
    this.#docs.clear();
    const parts = [...this.#files].sort(([a], [b]) => Number(b === CONTENT_TYPES_PART) - Number(a === CONTENT_TYPES_PART));
    return await writeZip(parts);
  }

  // ─── Content types ──────────────────────────────────────────────────────────

  #types(): Element {
    return this.xml(CONTENT_TYPES_PART).documentElement;
  }

  #override(path: string): Element | undefined {
    const name = `/${path}`.toLowerCase();
    return Array.from(this.#types().getElementsByTagNameNS(CONTENT_TYPES, 'Override')).find(
      el => el.getAttribute('PartName')?.toLowerCase() === name
    );
  }

  #default(ext: string): Element | undefined {
    return Array.from(this.#types().getElementsByTagNameNS(CONTENT_TYPES, 'Default')).find(
      el => el.getAttribute('Extension')?.toLowerCase() === ext
    );
  }

  contentType(path: string): string | undefined {
    return (this.#override(path) ?? this.#default(extOf(path)))?.getAttribute('ContentType') ?? undefined;
  }

  /** Whether `path` is typed by its own entry rather than by its extension. */
  hasOverride(path: string): boolean {
    return this.#override(path) !== undefined;
  }

  setOverride(path: string, type: string): void {
    const existing = this.#override(path);
    if (existing) {
      existing.setAttribute('ContentType', type);
      return;
    }
    const el = this.#types().ownerDocument.createElementNS(CONTENT_TYPES, 'Override');
    el.setAttribute('PartName', `/${path}`);
    el.setAttribute('ContentType', type);
    this.#types().appendChild(el);
  }

  ensureDefault(ext: string, type: string): void {
    if (!ext || this.#default(ext.toLowerCase())) {
      return;
    }
    const el = this.#types().ownerDocument.createElementNS(CONTENT_TYPES, 'Default');
    el.setAttribute('Extension', ext);
    el.setAttribute('ContentType', type);
    const first = this.#types().getElementsByTagNameNS(CONTENT_TYPES, 'Override')[0];
    this.#types().insertBefore(el, first ?? null);
  }

  /** Gives a copied part the type it had in `from`. */
  adoptType(from: DocxPackage, fromPath: string, path: string): void {
    const type = from.contentType(fromPath);
    if (!type) {
      return;
    }
    if (from.hasOverride(fromPath)) {
      this.setOverride(path, type);
    } else {
      this.ensureDefault(extOf(path), type);
    }
  }

  // ─── Relationships ──────────────────────────────────────────────────────────

  #rels(part: string, create: boolean): Document | undefined {
    const path = relsPathOf(part);
    const existing = this.xml(path);
    if (existing || !create) {
      return existing;
    }
    const doc = parseXml(`<Relationships xmlns="${PACKAGE_RELS}"/>`, path);
    this.setXml(path, doc);
    return doc;
  }

  relationships(part: string): Relationship[] {
    const doc = this.#rels(part, false);
    return Array.from(doc?.getElementsByTagNameNS(PACKAGE_RELS, 'Relationship') ?? []).map(el => ({
      id: el.getAttribute('Id') ?? '',
      type: el.getAttribute('Type') ?? '',
      target: el.getAttribute('Target') ?? '',
      external: el.getAttribute('TargetMode') === 'External',
    }));
  }

  /** A new relationship from `part`; an internal `target` is a path inside the package. */
  addRelationship(part: string, type: string, target: string, external = false): string {
    const doc = this.#rels(part, true);
    const taken = new Set(this.relationships(part).map(r => r.id));
    let n = taken.size + 1;
    while (taken.has(`rId${n}`)) {
      n += 1;
    }
    const id = `rId${n}`;
    const el = doc.createElementNS(PACKAGE_RELS, 'Relationship');
    el.setAttribute('Id', id);
    el.setAttribute('Type', type);
    el.setAttribute('Target', external ? target : relativeTarget(part, target));
    if (external) {
      el.setAttribute('TargetMode', 'External');
    }
    doc.documentElement.appendChild(el);
    return id;
  }

  /** The part `part` reaches by its first relationship of `kind`. */
  related(part: string, kind: string): string | undefined {
    const rel = this.relationships(part).find(r => !r.external && relKind(r.type) === kind);
    return rel ? resolveTarget(part, rel.target) : undefined;
  }

  mainDocument(): string {
    const main = this.related('', 'officeDocument');
    if (!main || !this.has(main)) {
      throw new Error(`"${this.label}" has no document in it`);
    }
    return main;
  }
}
