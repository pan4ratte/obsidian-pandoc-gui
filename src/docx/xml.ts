/* The XML side of WordprocessingML: namespaces, parsing, and the element orders the schema insists on. */

export const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
export const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
export const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
export const O = 'urn:schemas-microsoft-com:office:office';
export const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
export const XMLNS = 'http://www.w3.org/2000/xmlns/';
export const PACKAGE_RELS = 'http://schemas.openxmlformats.org/package/2006/relationships';
export const CONTENT_TYPES = 'http://schemas.openxmlformats.org/package/2006/content-types';
export const CUSTOM_PROPERTIES = 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties';

/** The namespace a document saved as "Strict Open XML" uses instead of `W`. */
export const STRICT_W = 'http://purl.oclc.org/ooxml/wordprocessingml/main';

const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

export const parseXml = (text: string, name: string): Document => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`"${name}" is not well-formed XML`);
  }
  return doc;
};

export const serializeXml = (doc: Document): string => DECLARATION + new XMLSerializer().serializeToString(doc.documentElement);

export const elements = (parent: Element, ns?: string, local?: string): Element[] =>
  Array.from(parent.children).filter(
    child => (ns === undefined || child.namespaceURI === ns) && (local === undefined || child.localName === local)
  );

export const firstChild = (parent: Element, local: string, ns = W): Element | undefined => elements(parent, ns, local)[0];

export const descendants = (root: Element | Document, local: string, ns = W): Element[] =>
  Array.from(root.getElementsByTagNameNS(ns, local));

export const isW = (el: Element, local: string): boolean => el.namespaceURI === W && el.localName === local;

export const wAttr = (el: Element, name: string): string | null => el.getAttributeNS(W, name);

export const setWAttr = (el: Element, name: string, value: string): void => el.setAttributeNS(W, `w:${name}`, value);

export const createW = (doc: Document, local: string, attrs: Record<string, string> = {}): Element => {
  const el = doc.createElementNS(W, `w:${local}`);
  for (const [name, value] of Object.entries(attrs)) {
    setWAttr(el, name, value);
  }
  return el;
};

/** `child` put among `parent`'s children where the schema's `order` wants it; unknown names go last. */
export const insertOrdered = (parent: Element, child: Element, order: readonly string[]): Element => {
  const rank = order.indexOf(child.localName);
  const before = rank < 0 ? undefined : elements(parent).find(sibling => order.indexOf(sibling.localName) > rank);
  parent.insertBefore(child, before ?? null);
  return child;
};

/** The child named `local`, made in its place if there is none. */
export const ensureChild = (parent: Element, local: string, order: readonly string[]): Element =>
  firstChild(parent, local) ?? insertOrdered(parent, createW(parent.ownerDocument, local), order);

/** A form of `el` that two equal definitions share: attributes sorted, the fields named in `skip` left out. */
export const canonical = (el: Element, skip: ReadonlySet<string> = new Set()): string => {
  const attrs = Array.from(el.attributes)
    .filter(a => a.namespaceURI !== XMLNS && a.name !== 'xmlns')
    .map(a => `${a.namespaceURI}|${a.localName}=${a.value}`)
    .sort()
    .join(' ');
  const kids = elements(el)
    .filter(child => !skip.has(child.localName))
    .map(child => canonical(child, skip))
    .join('');
  return `<${el.namespaceURI}|${el.localName} ${attrs}>${kids}</>`;
};

export const STYLE_ORDER = [
  'name',
  'aliases',
  'basedOn',
  'next',
  'link',
  'autoRedefine',
  'hidden',
  'uiPriority',
  'semiHidden',
  'unhideWhenUsed',
  'qFormat',
  'locked',
  'personal',
  'personalCompose',
  'personalReply',
  'rsid',
  'pPr',
  'rPr',
  'tblPr',
  'trPr',
  'tcPr',
  'tblStylePr',
] as const;

export const PPR_ORDER = [
  'pStyle',
  'keepNext',
  'keepLines',
  'pageBreakBefore',
  'framePr',
  'widowControl',
  'numPr',
  'suppressLineNumbers',
  'pBdr',
  'shd',
  'tabs',
  'suppressAutoHyphens',
  'kinsoku',
  'wordWrap',
  'overflowPunct',
  'topLinePunct',
  'autoSpaceDE',
  'autoSpaceDN',
  'bidi',
  'adjustRightInd',
  'snapToGrid',
  'spacing',
  'ind',
  'contextualSpacing',
  'mirrorIndents',
  'suppressOverlap',
  'jc',
  'textDirection',
  'textAlignment',
  'textboxTightWrap',
  'outlineLvl',
  'divId',
  'cnfStyle',
  'rPr',
  'sectPr',
  'pPrChange',
] as const;

export const RPR_ORDER = [
  'rStyle',
  'rFonts',
  'b',
  'bCs',
  'i',
  'iCs',
  'caps',
  'smallCaps',
  'strike',
  'dstrike',
  'outline',
  'shadow',
  'emboss',
  'imprint',
  'noProof',
  'snapToGrid',
  'vanish',
  'webHidden',
  'color',
  'spacing',
  'w',
  'kern',
  'position',
  'sz',
  'szCs',
  'highlight',
  'u',
  'effect',
  'bdr',
  'shd',
  'fitText',
  'vertAlign',
  'rtl',
  'cs',
  'em',
  'lang',
  'eastAsianLayout',
  'specVanish',
  'oMath',
  'rPrChange',
] as const;

export const TBLPR_ORDER = [
  'tblStyle',
  'tblpPr',
  'tblOverlap',
  'bidiVisual',
  'tblStyleRowBandSize',
  'tblStyleColBandSize',
  'tblW',
  'jc',
  'tblCellSpacing',
  'tblInd',
  'tblBorders',
  'shd',
  'tblLayout',
  'tblCellMar',
  'tblLook',
  'tblCaption',
  'tblDescription',
  'tblPrChange',
] as const;

/** Header and footer references open a section's properties, ahead of everything else. */
export const SECTPR_ORDER = [
  'headerReference',
  'footerReference',
  'footnotePr',
  'endnotePr',
  'type',
  'pgSz',
  'pgMar',
  'paperSrc',
  'pgBorders',
  'lnNumType',
  'pgNumType',
  'cols',
  'formProt',
  'vAlign',
  'noEndnote',
  'titlePg',
  'textDirection',
  'bidi',
  'rtlGutter',
  'docGrid',
  'printerSettings',
  'sectPrChange',
] as const;

export const NOTEPR_ORDER = ['pos', 'numFmt', 'numStart', 'numRestart'] as const;
