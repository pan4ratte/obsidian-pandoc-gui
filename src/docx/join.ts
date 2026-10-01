/* Word documents joined to an exported one at the level of their XML, so each keeps what Word laid out in it. */

import { CT_BASE, DocxPackage, REL_BASE, relKind, resolveTarget } from './package';
import { type StyleMerge, type StyleMode, mergeStyles, readTheme, resolveTheme } from './styles';
import {
  CUSTOM_PROPERTIES,
  MC,
  NOTEPR_ORDER,
  O,
  PPR_ORDER,
  R,
  SECTPR_ORDER,
  STRICT_W,
  TBLPR_ORDER,
  W,
  W14,
  WP,
  XMLNS,
  createW,
  descendants,
  elements,
  firstChild,
  insertOrdered,
  isW,
  parseXml,
  setWAttr,
  wAttr,
} from './xml';

export interface JoinedDocument {
  /** What the document is called, which a style renamed for it is suffixed with. */
  name: string;
  bytes: Uint8Array;
}

export interface JoinRequest {
  before: readonly JoinedDocument[];
  after: readonly JoinedDocument[];
  styles: StyleMode;
  /** Custom document properties to drop: the note's own keys that named the joined documents. */
  dropProperties?: readonly string[];
}

/** Parts that are merged into the export's own rather than copied beside them, or that a .docx cannot carry. */
const MERGED_RELS = new Set([
  'styles',
  'stylesWithEffects',
  'numbering',
  'footnotes',
  'endnotes',
  'comments',
  'commentsExtended',
  'commentsIds',
  'commentsExtensible',
  'people',
  'settings',
  'webSettings',
  'fontTable',
  'theme',
  'glossaryDocument',
  'customXml',
  'vbaProject',
  'keyMapCustomizations',
]);

const STORY_KINDS = new Set(['header', 'footer', 'footnotes', 'endnotes', 'comments']);

const STORY_TYPES = new Set([`${CT_BASE}header+xml`, `${CT_BASE}footer+xml`]);

const NOTES = [
  { kind: 'footnotes', item: 'footnote' },
  { kind: 'endnotes', item: 'endnote' },
  { kind: 'comments', item: 'comment' },
] as const;

type NoteKind = (typeof NOTES)[number]['kind'];

const SEPARATORS = new Set(['separator', 'continuationSeparator', 'continuationNotice']);

/** What may stand at the end of a body after its last paragraph without being content. */
const MARKERS = new Set([
  'bookmarkStart',
  'bookmarkEnd',
  'commentRangeStart',
  'commentRangeEnd',
  'permStart',
  'permEnd',
  'proofErr',
  'moveFromRangeStart',
  'moveFromRangeEnd',
  'moveToRangeStart',
  'moveToRangeEnd',
]);

const all = (root: Element): Element[] => [root, ...Array.from(root.getElementsByTagName('*'))];

/** The section a body paragraph closes, where it closes one. */
const innerSection = (node: Element): Element | undefined =>
  isW(node, 'p') ? firstChild(firstChild(node, 'pPr') ?? node, 'sectPr') : undefined;

const storyParts = (pkg: DocxPackage, main: string): string[] => [
  main,
  ...pkg
    .relationships(main)
    .filter(rel => !rel.external && STORY_KINDS.has(relKind(rel.type)))
    .map(rel => resolveTarget(main, rel.target))
    .filter(path => pkg.has(path)),
];

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every prefix `source` declares that `target` lacks, and its ignorable ones, so moved markup keeps its meaning. */
const adoptNamespaces = (target: Element, source: Element) => {
  for (const attr of Array.from(source.attributes)) {
    if (attr.namespaceURI === XMLNS && attr.prefix === 'xmlns' && target.lookupNamespaceURI(attr.localName) === null) {
      target.setAttributeNS(XMLNS, attr.name, attr.value);
    }
  }
  const ignorable = source.getAttributeNS(MC, 'Ignorable');
  if (!ignorable) {
    return;
  }
  if (target.lookupNamespaceURI('mc') === null) {
    target.setAttributeNS(XMLNS, 'xmlns:mc', MC);
  }
  const prefixes = new Set((target.getAttributeNS(MC, 'Ignorable') ?? '').split(/\s+/).filter(Boolean));
  for (const prefix of ignorable.split(/\s+/)) {
    if (prefix && target.lookupNamespaceURI(prefix) !== null) {
      prefixes.add(prefix);
    }
  }
  target.setAttributeNS(MC, 'mc:Ignorable', [...prefixes].join(' '));
};

const newNsid = () =>
  Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .toUpperCase()
    .padStart(8, '0');

/** The export being joined to, and the ids already spent in it. */
class Target {
  readonly main: string;
  readonly doc: Document;
  #docPr = 0;
  #bookmark = 0;
  readonly bookmarkNames = new Set<string>();

  constructor(readonly pkg: DocxPackage) {
    this.main = pkg.mainDocument();
    this.doc = pkg.xml(this.main)!;
    for (const story of storyParts(pkg, this.main)) {
      const doc = pkg.xml(story);
      for (const docPr of Array.from(doc.getElementsByTagNameNS(WP, 'docPr'))) {
        this.#docPr = Math.max(this.#docPr, Number(docPr.getAttribute('id')) || 0);
      }
      for (const mark of descendants(doc, 'bookmarkStart')) {
        this.#bookmark = Math.max(this.#bookmark, Number(wAttr(mark, 'id')) || 0);
        this.bookmarkNames.add(wAttr(mark, 'name') ?? '');
      }
    }
  }

  nextDocPr = () => String(++this.#docPr);
  nextBookmark = () => String(++this.#bookmark);

  /** The part `kind` names from the document, made empty where the export has none. */
  part(kind: string, root: string, type: string): string {
    const existing = this.pkg.related(this.main, kind);
    if (existing && this.pkg.has(existing)) {
      return existing;
    }
    const path = this.pkg.uniquePath(`word/${kind}.xml`);
    this.pkg.setXml(path, parseXml(`<w:${root} xmlns:w="${W}" xmlns:r="${R}"/>`, path));
    this.pkg.setOverride(path, type);
    this.pkg.addRelationship(this.main, REL_BASE + kind, path);
    return path;
  }
}

/** One document's content, ready to be laid into the body: its blocks, and the section properties that close them. */
interface Segment {
  nodes: Element[];
  sectPr: Element;
}

/** Everything that has to happen to one joined document, in the order its ids depend on each other. */
class Join {
  readonly #source: DocxPackage;
  readonly #target: Target;
  readonly #main: string;
  readonly #copied = new Map<string, string>();
  #styles: StyleMerge = { ids: new Map(), defaults: {}, inserted: [] };
  #numbering = new Map<string, string>();
  readonly #notes: Record<NoteKind, Map<string, string>> = { footnotes: new Map(), endnotes: new Map(), comments: new Map() };
  readonly #bookmarkNames = new Map<string, string>();

  constructor(source: DocxPackage, target: Target) {
    this.#source = source;
    this.#target = target;
    this.#main = source.mainDocument();
    if (source.xml(this.#main).documentElement.namespaceURI === STRICT_W) {
      throw new Error(`"${source.label}" is saved as Strict Open XML; save it in Word as an ordinary Word document`);
    }
  }

  run(mode: StyleMode): Segment {
    const source = this.#source;
    const stories = storyParts(source, this.#main);

    this.#mergeStyles(mode, stories);
    this.#mergeNumbering();
    this.#nameBookmarks(stories);
    const notes = this.#planNotes();

    const rels = this.#copyRelationships(this.#main, this.#target.main, MERGED_RELS);
    const doc = source.xml(this.#main);
    const body = firstChild(doc.documentElement, 'body');
    const children = body ? elements(body) : [];
    const last = children[children.length - 1];
    // A document with no section properties of its own is laid out as the export is.
    const sectPr = last && isW(last, 'sectPr') ? children.pop() : createW(doc, 'sectPr');
    this.#remap([...children, sectPr], rels);
    this.#carryNoteSettings([...children.map(innerSection).filter((s): s is Element => s !== undefined), sectPr]);

    for (const note of notes) {
      note();
    }
    this.#mergeFonts();
    adoptNamespaces(this.#target.doc.documentElement, doc.documentElement);

    const into = this.#target.doc;
    return {
      nodes: children.map(node => into.importNode(node, true)),
      sectPr: into.importNode(sectPr, true),
    };
  }

  /** How the document numbers its notes, which it says once for itself and the export's settings would overrule. */
  #carryNoteSettings(sections: Element[]) {
    const part = this.#source.related(this.#main, 'settings');
    const settings = part && this.#source.has(part) ? this.#source.xml(part).documentElement : undefined;
    for (const local of ['footnotePr', 'endnotePr']) {
      const documentWide = settings && firstChild(settings, local);
      const props = documentWide ? elements(documentWide, W).filter(el => !['footnote', 'endnote'].includes(el.localName)) : [];
      for (const sectPr of props.length > 0 ? sections : []) {
        const own = firstChild(sectPr, local) ?? insertOrdered(sectPr, createW(sectPr.ownerDocument, local), SECTPR_ORDER);
        for (const prop of props) {
          if (!firstChild(own, prop.localName)) {
            insertOrdered(own, sectPr.ownerDocument.importNode(prop, true), NOTEPR_ORDER);
          }
        }
      }
    }
  }

  #mergeStyles(mode: StyleMode, stories: string[]) {
    const source = this.#source;
    const target = this.#target.pkg;
    const sourceStyles = source.related(this.#main, 'styles');
    const targetStyles = target.related(this.#target.main, 'styles');
    if (!sourceStyles || !targetStyles || !source.has(sourceStyles) || !target.has(targetStyles)) {
      return;
    }
    const used = new Set<string>();
    const numbering = source.related(this.#main, 'numbering');
    for (const part of [...stories, ...(numbering && source.has(numbering) ? [numbering] : [])]) {
      for (const local of ['pStyle', 'rStyle', 'tblStyle', 'numStyleLink', 'styleLink']) {
        for (const el of descendants(source.xml(part), local)) {
          used.add(wAttr(el, 'val') ?? '');
        }
      }
    }
    const theme = (pkg: DocxPackage, main: string) => {
      const part = pkg.related(main, 'theme');
      return readTheme(part && pkg.has(part) ? pkg.xml(part) : undefined);
    };
    const into = target.xml(targetStyles);
    const from = source.xml(sourceStyles);
    this.#styles = mergeStyles(into, from, {
      mode,
      label: source.label,
      used,
      sourceTheme: theme(source, this.#main),
      targetTheme: theme(target, this.#target.main),
    });
    adoptNamespaces(into.documentElement, from.documentElement);
  }

  #mergeNumbering() {
    const source = this.#source;
    const sourcePart = source.related(this.#main, 'numbering');
    if (!sourcePart || !source.has(sourcePart)) {
      return;
    }
    const from = source.xml(sourcePart).documentElement;
    const nums = elements(from, W, 'num');
    if (nums.length === 0) {
      return;
    }
    const targetPart = this.#target.part('numbering', 'numbering', `${CT_BASE}numbering+xml`);
    const into = this.#target.pkg.xml(targetPart).documentElement;
    const doc = into.ownerDocument;
    const next = (local: string, attr: string) => Math.max(0, ...elements(into, W, local).map(el => Number(wAttr(el, attr)) || 0)) + 1;
    const before = (...locals: string[]) => elements(into, W).find(el => locals.includes(el.localName)) ?? null;
    const styles = this.#styles.ids;

    const pictures = new Map<string, string>();
    const bullets = elements(from, W, 'numPicBullet');
    if (bullets.length > 0) {
      const rels = this.#copyRelationships(sourcePart, targetPart, new Set());
      let id = next('numPicBullet', 'numPicBulletId');
      for (const bullet of bullets) {
        pictures.set(wAttr(bullet, 'numPicBulletId') ?? '', String(id));
        setWAttr(bullet, 'numPicBulletId', String(id++));
        this.#remapRelationships(bullet, rels);
        into.insertBefore(doc.importNode(bullet, true), before('abstractNum', 'num', 'numIdMacAtCleanup'));
      }
    }

    const abstracts = new Map<string, string>();
    let abstractId = next('abstractNum', 'abstractNumId');
    for (const abstract of elements(from, W, 'abstractNum')) {
      abstracts.set(wAttr(abstract, 'abstractNumId') ?? '', String(abstractId));
      setWAttr(abstract, 'abstractNumId', String(abstractId++));
      // Word tells lists apart by this, and two lists sharing one run on as one.
      const nsid = firstChild(abstract, 'nsid');
      if (nsid) {
        setWAttr(nsid, 'val', newNsid());
      }
      for (const local of ['pStyle', 'styleLink', 'numStyleLink']) {
        for (const el of descendants(abstract, local)) {
          const to = styles.get(wAttr(el, 'val') ?? '');
          if (to) {
            setWAttr(el, 'val', to);
          }
        }
      }
      for (const el of descendants(abstract, 'lvlPicBulletId')) {
        setWAttr(el, 'val', pictures.get(wAttr(el, 'val') ?? '') ?? wAttr(el, 'val') ?? '');
      }
      resolveTheme(abstract, this.#styles.themeFix);
      into.insertBefore(doc.importNode(abstract, true), before('num', 'numIdMacAtCleanup'));
    }

    let numId = next('num', 'numId');
    for (const num of nums) {
      this.#numbering.set(wAttr(num, 'numId') ?? '', String(numId));
      setWAttr(num, 'numId', String(numId++));
      const abstract = firstChild(num, 'abstractNumId');
      if (abstract) {
        setWAttr(abstract, 'val', abstracts.get(wAttr(abstract, 'val') ?? '') ?? wAttr(abstract, 'val') ?? '');
      }
      into.insertBefore(doc.importNode(num, true), before('numIdMacAtCleanup'));
    }

    for (const style of this.#styles.inserted) {
      for (const el of descendants(style, 'numId')) {
        const to = this.#numbering.get(wAttr(el, 'val') ?? '');
        if (to) {
          setWAttr(el, 'val', to);
        }
      }
    }
    adoptNamespaces(into, from);
  }

  /** Bookmark names the export already uses, renamed — a TOC or a cross-reference finds a bookmark by its name. */
  #nameBookmarks(stories: string[]) {
    const taken = this.#target.bookmarkNames;
    for (const story of stories) {
      for (const mark of descendants(this.#source.xml(story), 'bookmarkStart')) {
        const name = wAttr(mark, 'name') ?? '';
        if (!name || this.#bookmarkNames.has(name)) {
          continue;
        }
        let to = name;
        for (let n = 2; taken.has(to); n += 1) {
          to = `${name.slice(0, 36)}_${n}`;
        }
        taken.add(to);
        this.#bookmarkNames.set(name, to);
      }
    }
  }

  /** Footnotes, endnotes and comments get their new ids now, and are moved once every id the content names is known. */
  #planNotes(): Array<() => void> {
    const source = this.#source;
    const pending: Array<() => void> = [];
    for (const { kind, item } of NOTES) {
      const sourcePart = source.related(this.#main, kind);
      if (!sourcePart || !source.has(sourcePart)) {
        continue;
      }
      const from = source.xml(sourcePart).documentElement;
      const items = elements(from, W, item).filter(note => !SEPARATORS.has(wAttr(note, 'type') ?? ''));
      if (items.length === 0) {
        continue;
      }
      const created = !this.#target.pkg.related(this.#target.main, kind);
      const targetPart = this.#target.part(kind, from.localName, `${CT_BASE}${kind}+xml`);
      const into = this.#target.pkg.xml(targetPart).documentElement;
      if (created) {
        // Word draws the line above the notes with these, and expects them where notes are.
        for (const separator of elements(from, W, item).filter(note => SEPARATORS.has(wAttr(note, 'type') ?? ''))) {
          into.appendChild(into.ownerDocument.importNode(separator, true));
        }
      }
      let id = Math.max(0, ...elements(into, W, item).map(note => Number(wAttr(note, 'id')) || 0)) + 1;
      const ids = this.#notes[kind];
      for (const note of items) {
        ids.set(wAttr(note, 'id') ?? '', String(id++));
      }
      pending.push(() => {
        const rels = this.#copyRelationships(sourcePart, targetPart, new Set());
        this.#remap(items, rels);
        for (const note of items) {
          setWAttr(note, 'id', ids.get(wAttr(note, 'id') ?? ''));
          into.appendChild(into.ownerDocument.importNode(note, true));
        }
        adoptNamespaces(into, from);
      });
    }
    return pending;
  }

  #mergeFonts() {
    const sourcePart = this.#source.related(this.#main, 'fontTable');
    const targetPart = this.#target.pkg.related(this.#target.main, 'fontTable');
    if (!sourcePart || !targetPart || !this.#source.has(sourcePart) || !this.#target.pkg.has(targetPart)) {
      return;
    }
    const into = this.#target.pkg.xml(targetPart).documentElement;
    const names = new Set(elements(into, W, 'font').map(font => wAttr(font, 'name')));
    for (const font of elements(this.#source.xml(sourcePart).documentElement, W, 'font')) {
      if (names.has(wAttr(font, 'name'))) {
        continue;
      }
      // An embedded font is keyed to the document it came from, so only its description travels.
      for (const embed of elements(font, W).filter(el => el.localName.startsWith('embed'))) {
        embed.remove();
      }
      into.appendChild(into.ownerDocument.importNode(font, true));
    }
  }

  /** `from`'s relationships made again from `to`, with every part they reach copied over; old id → new id. */
  #copyRelationships(from: string, to: string, skip: ReadonlySet<string>): Map<string, string> {
    const ids = new Map<string, string>();
    for (const rel of this.#source.relationships(from)) {
      if (skip.has(relKind(rel.type))) {
        continue;
      }
      if (rel.external) {
        ids.set(rel.id, this.#target.pkg.addRelationship(to, rel.type, rel.target, true));
        continue;
      }
      const path = resolveTarget(from, rel.target);
      if (this.#source.has(path)) {
        ids.set(rel.id, this.#target.pkg.addRelationship(to, rel.type, this.#copyPart(path)));
      }
    }
    return ids;
  }

  #copyPart(path: string): string {
    const known = this.#copied.get(path);
    if (known) {
      return known;
    }
    const source = this.#source;
    const target = this.#target.pkg;
    const to = target.uniquePath(path);
    this.#copied.set(path, to);
    target.adoptType(source, path, to);

    const rels = this.#copyRelationships(path, to, new Set());
    const type = source.contentType(path) ?? '';
    if (STORY_TYPES.has(type)) {
      const doc = source.xml(path);
      this.#remap([doc.documentElement], rels);
      target.setXml(to, doc);
    } else if (rels.size > 0 && /xml$/.test(type)) {
      const doc = source.xml(path);
      this.#remapRelationships(doc.documentElement, rels);
      target.setXml(to, doc);
    } else {
      target.setBytes(to, source.bytes(path));
    }
    return to;
  }

  #remapRelationships(root: Element, rels: ReadonlyMap<string, string>) {
    for (const el of all(root)) {
      for (const attr of Array.from(el.attributes)) {
        if ((attr.namespaceURI === R || (attr.namespaceURI === O && attr.localName === 'relid')) && rels.has(attr.value)) {
          attr.value = rels.get(attr.value)!;
        }
      }
    }
  }

  #renameInFields(text: string): string {
    let out = text;
    for (const [from, to] of this.#bookmarkNames) {
      if (from !== to) {
        out = out.replace(new RegExp(`(^|[\\s"])${escapeRegExp(from)}(?=$|[\\s"\\\\])`, 'g'), `$1${to}`);
      }
    }
    return out;
  }

  /** Every id `roots` name, moved to the one it has in the export. */
  #remap(roots: Element[], rels: ReadonlyMap<string, string>) {
    const bookmarks = new Map<string, string>();
    const bookmark = (id: string) => {
      let to = bookmarks.get(id);
      if (!to) {
        to = this.#target.nextBookmark();
        bookmarks.set(id, to);
      }
      return to;
    };
    const mapVal = (el: Element, attr: string, ids: ReadonlyMap<string, string>) => {
      const to = ids.get(wAttr(el, attr) ?? '');
      if (to) {
        setWAttr(el, attr, to);
      }
    };
    const { ids: styles, defaults, themeFix } = this.#styles;

    for (const root of roots) {
      this.#remapRelationships(root, rels);
      for (const el of all(root)) {
        el.removeAttributeNS(W14, 'paraId');
        el.removeAttributeNS(W14, 'textId');
        if (el.namespaceURI === WP && el.localName === 'docPr') {
          el.setAttribute('id', this.#target.nextDocPr());
        }
        if (el.namespaceURI !== W) {
          continue;
        }
        switch (el.localName) {
          case 'pStyle':
          case 'rStyle':
          case 'tblStyle':
            mapVal(el, 'val', styles);
            break;
          case 'numId':
            mapVal(el, 'val', this.#numbering);
            break;
          case 'footnoteReference':
            mapVal(el, 'id', this.#notes.footnotes);
            break;
          case 'endnoteReference':
            mapVal(el, 'id', this.#notes.endnotes);
            break;
          case 'commentRangeStart':
          case 'commentRangeEnd':
          case 'commentReference':
            mapVal(el, 'id', this.#notes.comments);
            break;
          case 'bookmarkStart':
            mapVal(el, 'name', this.#bookmarkNames);
            setWAttr(el, 'id', bookmark(wAttr(el, 'id') ?? ''));
            break;
          case 'bookmarkEnd':
            setWAttr(el, 'id', bookmark(wAttr(el, 'id') ?? ''));
            break;
          case 'hyperlink':
            mapVal(el, 'anchor', this.#bookmarkNames);
            break;
          case 'instrText':
            el.textContent = this.#renameInFields(el.textContent ?? '');
            break;
          case 'fldSimple':
            setWAttr(el, 'instr', this.#renameInFields(wAttr(el, 'instr') ?? ''));
            break;
          case 'p':
            if (defaults.paragraph) {
              const pPr = firstChild(el, 'pPr') ?? el.insertBefore(createW(el.ownerDocument, 'pPr'), el.firstChild);
              if (!firstChild(pPr, 'pStyle')) {
                insertOrdered(pPr, createW(el.ownerDocument, 'pStyle', { val: defaults.paragraph }), PPR_ORDER);
              }
            }
            break;
          case 'tbl':
            if (defaults.table) {
              const tblPr = firstChild(el, 'tblPr') ?? el.insertBefore(createW(el.ownerDocument, 'tblPr'), el.firstChild);
              if (!firstChild(tblPr, 'tblStyle')) {
                insertOrdered(tblPr, createW(el.ownerDocument, 'tblStyle', { val: defaults.table }), TBLPR_ORDER);
              }
            }
            break;
        }
      }
      resolveTheme(root, themeFix);
    }
  }
}

/** The paragraph a segment's section properties go on: its last, or a new one where it ends in something else. */
const closeSegment = (nodes: Element[], sectPr: Element): Element[] => {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i];
    if (node.namespaceURI === W && MARKERS.has(node.localName)) {
      continue;
    }
    if (isW(node, 'p')) {
      const pPr = firstChild(node, 'pPr') ?? node.insertBefore(createW(node.ownerDocument, 'pPr'), node.firstChild);
      if (!firstChild(pPr, 'sectPr')) {
        insertOrdered(pPr, sectPr, PPR_ORDER);
        return [];
      }
    }
    break;
  }
  const paragraph = createW(sectPr.ownerDocument, 'p');
  paragraph.appendChild(createW(sectPr.ownerDocument, 'pPr')).appendChild(sectPr);
  return [paragraph];
};

const HEADER_KINDS = ['headerReference', 'footerReference'];

/**
 * A section with no header of its own shows the one before it. Where a joined document meets another, that would hand
 * a title page's footer to every page after it, so the first section of each document is given an empty one instead.
 */
const stopInheritance = (target: Target, sections: { sectPr: Element; segment: number }[]) => {
  const shown = new Set<string>();
  let previous = -1;
  for (const { sectPr, segment } of sections) {
    const own = new Set(
      elements(sectPr, W)
        .filter(el => HEADER_KINDS.includes(el.localName))
        .map(el => `${el.localName}|${wAttr(el, 'type') ?? 'default'}`)
    );
    if (previous !== -1 && segment !== previous) {
      for (const key of shown) {
        if (!own.has(key)) {
          const [local, type] = key.split('|');
          const kind = local === 'headerReference' ? 'header' : 'footer';
          const path = target.pkg.uniquePath(`word/${kind}.xml`);
          const root = kind === 'header' ? 'hdr' : 'ftr';
          target.pkg.setXml(path, parseXml(`<w:${root} xmlns:w="${W}"><w:p/></w:${root}>`, path));
          target.pkg.setOverride(path, `${CT_BASE}${kind}+xml`);
          const ref = createW(sectPr.ownerDocument, local, { type });
          ref.setAttributeNS(R, 'r:id', target.pkg.addRelationship(target.main, REL_BASE + kind, path));
          insertOrdered(sectPr, ref, SECTPR_ORDER);
          own.add(key);
        }
      }
    }
    own.forEach(key => shown.add(key));
    previous = segment;
  }
};

const assemble = (target: Target, segments: Segment[]) => {
  const body = firstChild(target.doc.documentElement, 'body');
  while (body.firstChild) {
    body.removeChild(body.firstChild);
  }
  const owner = new Map<Element, number>();
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    for (const node of [...segment.nodes, ...(last ? [] : closeSegment(segment.nodes, segment.sectPr))]) {
      body.appendChild(node);
      owner.set(node, index);
    }
  });
  body.appendChild(segments[segments.length - 1].sectPr);

  const sections: { sectPr: Element; segment: number }[] = [];
  for (const child of elements(body)) {
    if (isW(child, 'sectPr')) {
      sections.push({ sectPr: child, segment: segments.length - 1 });
    } else {
      const sectPr = innerSection(child);
      if (sectPr) {
        sections.push({ sectPr, segment: owner.get(child) });
      }
    }
  }
  stopInheritance(target, sections);
  sections.filter(({ segment }, i) => i > 0 && segment !== sections[i - 1].segment).forEach(({ sectPr }) => restartFootnotes(sectPr));
};

/** Each document's footnotes count from 1 again, as they did on their own. */
const restartFootnotes = (sectPr: Element) => {
  const doc = sectPr.ownerDocument;
  const props = firstChild(sectPr, 'footnotePr') ?? insertOrdered(sectPr, createW(doc, 'footnotePr'), SECTPR_ORDER);
  const restart = firstChild(props, 'numRestart');
  if (!restart) {
    insertOrdered(props, createW(doc, 'numRestart', { val: 'eachSect' }), NOTEPR_ORDER);
  } else if (wAttr(restart, 'val') === 'continuous') {
    setWAttr(restart, 'val', 'eachSect');
  }
};

const dropProperties = (pkg: DocxPackage, names: readonly string[]) => {
  const part = pkg.related('', 'custom-properties');
  const doc = part && pkg.has(part) ? pkg.xml(part) : undefined;
  if (!doc || names.length === 0) {
    return;
  }
  for (const property of Array.from(doc.getElementsByTagNameNS(CUSTOM_PROPERTIES, 'property'))) {
    if (names.includes(property.getAttribute('name') ?? '')) {
      property.remove();
    }
  }
};

/** `output` with the documents of `request` joined before and after its content. */
export async function joinDocx(output: Uint8Array, request: JoinRequest): Promise<Uint8Array> {
  const target = new Target(await DocxPackage.open(output, 'export'));
  const segment = async (doc: JoinedDocument) => new Join(await DocxPackage.open(doc.bytes, doc.name), target).run(request.styles);

  const before: Segment[] = [];
  for (const doc of request.before) {
    before.push(await segment(doc));
  }
  const after: Segment[] = [];
  for (const doc of request.after) {
    after.push(await segment(doc));
  }

  const body = firstChild(target.doc.documentElement, 'body');
  if (!body) {
    throw new Error('The exported document has no body');
  }
  const own = elements(body);
  const last = own[own.length - 1];
  const sectPr = last && isW(last, 'sectPr') ? own.pop() : createW(target.doc, 'sectPr');
  assemble(target, [...before, { nodes: own, sectPr }, ...after]);

  dropProperties(target.pkg, request.dropProperties ?? []);
  return await target.pkg.save();
}
