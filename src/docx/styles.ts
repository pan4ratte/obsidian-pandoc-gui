/* Bringing a joined document's styles into the export's, under one of two rules — see `StyleMode`. */

import {
  A,
  PPR_ORDER,
  RPR_ORDER,
  STYLE_ORDER,
  W,
  canonical,
  descendants,
  elements,
  firstChild,
  insertOrdered,
  setWAttr,
  wAttr,
} from './xml';

/** `own`: a joined document looks as it does in Word. `template`: it takes the export's styles wherever they share a name. */
export type StyleMode = 'own' | 'template';

export const STYLE_MODES: readonly StyleMode[] = ['own', 'template'];

type Slot = 'latin' | 'ea' | 'cs';

export interface Theme {
  fonts: Record<'major' | 'minor', Record<Slot, string>>;
  /** The colour scheme, in a form two equal schemes share. */
  colors: string;
}

export const readTheme = (doc?: Document): Theme | undefined => {
  if (!doc) {
    return undefined;
  }
  const font = (scheme: string, slot: Slot) =>
    doc.getElementsByTagNameNS(A, scheme)[0]?.getElementsByTagNameNS(A, slot)[0]?.getAttribute('typeface') ?? '';
  const scheme = (name: string) => ({ latin: font(name, 'latin'), ea: font(name, 'ea'), cs: font(name, 'cs') });
  const colors = doc.getElementsByTagNameNS(A, 'clrScheme')[0];
  return {
    fonts: { major: scheme('majorFont'), minor: scheme('minorFont') },
    colors: colors ? canonical(colors) : '',
  };
};

const sameFonts = (a?: Theme, b?: Theme) => JSON.stringify(a?.fonts) === JSON.stringify(b?.fonts);

/** A theme reference on `w:rFonts`, by the attribute that names the font outright. */
const THEME_FONT_SLOTS: Record<string, string> = { asciiTheme: 'ascii', hAnsiTheme: 'hAnsi', eastAsiaTheme: 'eastAsia', cstheme: 'cs' };

const THEME_COLOR_ATTRS = ['themeColor', 'themeTint', 'themeShade', 'themeFill', 'themeFillTint', 'themeFillShade'];

const themeFont = (theme: Theme, value: string): string => {
  const match = /^(major|minor)(Ascii|HAnsi|EastAsia|Bidi)$/.exec(value);
  if (!match) {
    return '';
  }
  const slot: Slot = match[2] === 'EastAsia' ? 'ea' : match[2] === 'Bidi' ? 'cs' : 'latin';
  return theme.fonts[match[1] as 'major' | 'minor'][slot];
};

export interface ThemeFix {
  theme: Theme;
  fonts: boolean;
  colors: boolean;
}

/** Theme fonts and colours under `root` written out as what `theme` makes them, so another theme cannot change them. */
export const resolveTheme = (root: Element, fix?: ThemeFix): void => {
  if (!fix) {
    return;
  }
  if (fix.fonts) {
    for (const fonts of [root, ...descendants(root, 'rFonts')].filter(el => el.namespaceURI === W && el.localName === 'rFonts')) {
      for (const [attr, slot] of Object.entries(THEME_FONT_SLOTS)) {
        const value = wAttr(fonts, attr);
        const font = value && themeFont(fix.theme, value);
        if (font) {
          setWAttr(fonts, slot, font);
          fonts.removeAttributeNS(W, attr);
        }
      }
    }
  }
  if (fix.colors) {
    for (const el of [root, ...Array.from(root.getElementsByTagNameNS(W, '*'))]) {
      for (const attr of THEME_COLOR_ATTRS) {
        el.removeAttributeNS(W, attr);
      }
    }
  }
};

/** Attributes that say the same thing, so a default fills none of them where the style gives one. */
const ATTRIBUTE_GROUPS: Record<string, string[][]> = {
  rFonts: [
    ['ascii', 'asciiTheme'],
    ['hAnsi', 'hAnsiTheme'],
    ['eastAsia', 'eastAsiaTheme'],
    ['cs', 'cstheme'],
  ],
  ind: [
    ['left', 'start', 'leftChars', 'startChars'],
    ['right', 'end', 'rightChars', 'endChars'],
    ['firstLine', 'hanging', 'firstLineChars', 'hangingChars'],
  ],
  spacing: [
    ['before', 'beforeLines', 'beforeAutospacing'],
    ['after', 'afterLines', 'afterAutospacing'],
    ['line', 'lineRule'],
  ],
};

const fillAttributes = (into: Element, from: Element) => {
  const groups = ATTRIBUTE_GROUPS[from.localName] ?? [];
  const groupOf = (name: string) => groups.find(group => group.includes(name)) ?? [name];
  for (const attr of Array.from(from.attributes)) {
    if (attr.namespaceURI !== W) {
      continue;
    }
    if (!groupOf(attr.localName).some(name => into.hasAttributeNS(W, name))) {
      into.setAttributeNS(W, attr.name, attr.value);
    }
  }
};

/** `defaults` laid under `props`: what `props` says stands, what it leaves unsaid is taken from `defaults`. */
const underlay = (props: Element, defaults: Element, order: readonly string[]) => {
  for (const prop of elements(defaults)) {
    const existing = firstChild(props, prop.localName, prop.namespaceURI ?? W);
    if (existing) {
      fillAttributes(existing, prop);
    } else {
      insertOrdered(props, props.ownerDocument.importNode(prop, true), order);
    }
  }
};

const docDefaults = (styles: Document, kind: 'pPr' | 'rPr'): Element | undefined => {
  const defaults = descendants(styles, 'docDefaults')[0];
  const holder = defaults && firstChild(defaults, kind === 'pPr' ? 'pPrDefault' : 'rPrDefault');
  return holder && firstChild(holder, kind);
};

export interface StyleMerge {
  /** Each source style the content names, by the id it has in the result. */
  ids: Map<string, string>;
  /** What a source paragraph or table that names no style is to be given, where the export's default would differ. */
  defaults: { paragraph?: string; table?: string };
  /** The styles copied in, for the numbering ids in them to be renumbered once the lists are merged. */
  inserted: Element[];
  /** Whether the joined content carries its own look and its theme references have to be resolved. */
  themeFix?: ThemeFix;
}

export interface StyleMergeOptions {
  mode: StyleMode;
  /** What a renamed style's name is suffixed with: the joined document's name. */
  label: string;
  /** The style ids the joined content names. */
  used: ReadonlySet<string>;
  sourceTheme?: Theme;
  targetTheme?: Theme;
}

/** What a style says beyond its identity and its place in the gallery. */
const LOOK_SKIP = new Set([
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
  'rsid',
  'personal',
  'personalCompose',
  'personalReply',
]);

const styleId = (style: Element) => wAttr(style, 'styleId') ?? '';
const styleType = (style: Element) => wAttr(style, 'type') ?? 'paragraph';
const styleName = (style: Element) => (firstChild(style, 'name') && wAttr(firstChild(style, 'name'), 'val')) || styleId(style);
const isDefault = (style: Element) => ['1', 'true', 'on'].includes(wAttr(style, 'default') ?? '');
const pointer = (style: Element, local: string) => {
  const el = firstChild(style, local);
  return el ? (wAttr(el, 'val') ?? undefined) : undefined;
};
const hasNumbering = (style: Element) => descendants(style, 'numPr').length > 0;

/** A style's look, minus the ids it points at, so two documents' copies of one style compare equal. */
const look = (style: Element) => {
  const clone = style.cloneNode(true) as Element;
  clone.removeAttributeNS(W, 'styleId');
  clone.removeAttributeNS(W, 'default');
  clone.removeAttributeNS(W, 'customStyle');
  return canonical(clone, LOOK_SKIP);
};

export function mergeStyles(target: Document, source: Document, options: StyleMergeOptions): StyleMerge {
  const root = target.documentElement;
  const targetStyles = elements(root, W, 'style');
  const sourceStyles = elements(source.documentElement, W, 'style');
  const sourceById = new Map(sourceStyles.map(s => [styleId(s), s]));
  const targetById = new Map(targetStyles.map(s => [styleId(s), s]));
  const targetByName = new Map(targetStyles.map(s => [`${styleType(s)}|${styleName(s).toLowerCase()}`, s]));
  const targetDefault = (type: string) => targetStyles.find(s => styleType(s) === type && isDefault(s));
  const sourceDefault = (type: string) => sourceStyles.find(s => styleType(s) === type && isDefault(s));

  const takenIds = new Set(targetById.keys());
  const takenNames = new Set(targetStyles.map(s => styleName(s).toLowerCase()));

  const defaultsOf = (doc: Document) => {
    const el = descendants(doc, 'docDefaults')[0];
    return el ? canonical(el) : '';
  };
  const sameDefaults = defaultsOf(source) === defaultsOf(target);
  const independent = options.mode === 'own' && !(sameDefaults && sameFonts(options.sourceTheme, options.targetTheme));
  const themeFix: ThemeFix | undefined =
    options.mode === 'own' && options.sourceTheme
      ? {
          theme: options.sourceTheme,
          fonts: independent,
          colors: options.sourceTheme.colors !== (options.targetTheme?.colors ?? ''),
        }
      : undefined;

  const counterpart = (style: Element): Element | undefined =>
    isDefault(style) ? targetDefault(styleType(style)) : targetByName.get(`${styleType(style)}|${styleName(style).toLowerCase()}`);

  // The styles the content reaches, with everything they are based on.
  const needed = new Set<string>();
  const reach = (id: string | undefined) => {
    if (!id || needed.has(id) || !sourceById.has(id)) {
      return;
    }
    needed.add(id);
    reach(pointer(sourceById.get(id), 'basedOn'));
  };
  for (const id of options.used) {
    reach(id);
  }
  for (const type of ['paragraph', 'table']) {
    const fallback = sourceDefault(type);
    if (fallback) {
      reach(styleId(fallback));
    }
  }

  const ids = new Map<string, string>();
  const copies = new Map<string, Element>();

  const uniqueId = (base: string) => {
    let id = base;
    for (let n = 1; takenIds.has(id); n += 1) {
      id = `${base}-${n}`;
    }
    takenIds.add(id);
    return id;
  };

  const uniqueName = (base: string, renamed: boolean) => {
    let name = renamed ? `${base} (${options.label})` : base;
    for (let n = 2; takenNames.has(name.toLowerCase()); n += 1) {
      name = `${base} (${options.label} ${n})`;
    }
    takenNames.add(name.toLowerCase());
    return name;
  };

  const decide = (id: string): string => {
    const known = ids.get(id);
    if (known !== undefined) {
      return known;
    }
    const style = sourceById.get(id);
    const based = pointer(style, 'basedOn');
    const basedTo = based && sourceById.has(based) ? decide(based) : based;
    const match = counterpart(style);

    if (match && options.mode === 'template') {
      ids.set(id, styleId(match));
      return styleId(match);
    }
    if (match && !independent && !hasNumbering(style) && basedTo === pointer(match, 'basedOn') && look(style) === look(match)) {
      ids.set(id, styleId(match));
      return styleId(match);
    }

    const newId = uniqueId(match || targetById.has(id) ? `${id}-${options.label.replace(/[^A-Za-z0-9]+/g, '') || 'joined'}` : id);
    ids.set(id, newId);
    const copy = target.importNode(style, true);
    setWAttr(copy, 'styleId', newId);
    copy.removeAttributeNS(W, 'default');
    const nameEl = firstChild(copy, 'name') ?? insertOrdered(copy, target.createElementNS(W, 'w:name'), STYLE_ORDER);
    setWAttr(nameEl, 'val', uniqueName(styleName(style), match !== undefined));
    copies.set(id, copy);
    return newId;
  };

  for (const id of needed) {
    decide(id);
  }

  const sourcePPr = docDefaults(source, 'pPr');
  const sourceRPr = docDefaults(source, 'rPr');
  for (const [id, copy] of copies) {
    for (const local of ['basedOn', 'next', 'link']) {
      const el = firstChild(copy, local);
      const to = el && ids.get(wAttr(el, 'val') ?? '');
      if (el && to) {
        setWAttr(el, 'val', to);
      } else if (el && local !== 'basedOn') {
        el.remove();
      }
    }
    // A root paragraph style stands on the document defaults, which in the export are someone else's.
    if (independent && styleType(copy) === 'paragraph' && !firstChild(copy, 'basedOn')) {
      if (sourcePPr) {
        underlay(firstChild(copy, 'pPr') ?? insertOrdered(copy, target.createElementNS(W, 'w:pPr'), STYLE_ORDER), sourcePPr, PPR_ORDER);
      }
      if (sourceRPr) {
        underlay(firstChild(copy, 'rPr') ?? insertOrdered(copy, target.createElementNS(W, 'w:rPr'), STYLE_ORDER), sourceRPr, RPR_ORDER);
      }
    }
    resolveTheme(copy, themeFix);
    root.appendChild(copy);
    ids.set(id, styleId(copy));
  }

  const defaults: StyleMerge['defaults'] = {};
  if (options.mode === 'own') {
    for (const type of ['paragraph', 'table'] as const) {
      const fallback = sourceDefault(type);
      const to = fallback && ids.get(styleId(fallback));
      if (to && to !== (targetDefault(type) && styleId(targetDefault(type)))) {
        defaults[type] = to;
      }
    }
  }

  return { ids, defaults, inserted: [...copies.values()], themeFix };
}
