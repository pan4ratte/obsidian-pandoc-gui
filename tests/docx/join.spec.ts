import { JSDOM } from 'jsdom';
import { vi } from 'vitest';
import { joinDocx, type JoinRequest } from '../../src/docx/join';
import { readZip, writeZip } from '../../src/system/zip';

// Obsidian has both natively; node has neither.
const dom = new JSDOM('');
vi.stubGlobal('DOMParser', dom.window.DOMParser);
vi.stubGlobal('XMLSerializer', dom.window.XMLSerializer);

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const W14 = 'http://schemas.microsoft.com/office/word/2010/wordml';
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const CT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.';

const NS = `xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="${WP}"`;
const enc = (s: string) => new TextEncoder().encode(s);

interface Spec {
  body: string;
  rootAttrs?: string;
  styles?: string;
  docDefaults?: string;
  numbering?: string;
  footnotes?: string;
  settings?: string;
  custom?: Record<string, string>;
  /** Extra parts, by path, with their relationship from the document and their content type. */
  parts?: { path: string; type: string; rel: string; content: string | Uint8Array; id: string }[];
  links?: { id: string; target: string }[];
  /** Content types by extension, as Word declares them for its media. */
  defaults?: Record<string, string>;
  strict?: boolean;
}

/** A Word package with only the parts a test names. */
const docx = async (spec: Spec): Promise<Uint8Array> => {
  const overrides: string[] = [`<Override PartName="/word/document.xml" ContentType="${CT}document.main+xml"/>`];
  const rels: string[] = [];
  const files: [string, Uint8Array][] = [];
  const part = (path: string, type: string, rel: string, content: string | Uint8Array, id: string) => {
    files.push([path, typeof content === 'string' ? enc(content) : content]);
    if (type) {
      overrides.push(`<Override PartName="/${path}" ContentType="${type}"/>`);
    }
    rels.push(`<Relationship Id="${id}" Type="${REL}${rel}" Target="${path.replace(/^word\//, '')}"/>`);
  };
  if (spec.styles !== undefined) {
    part('word/styles.xml', `${CT}styles+xml`, 'styles', `<w:styles ${NS}>${spec.docDefaults ?? ''}${spec.styles}</w:styles>`, 'rIdStyles');
  }
  if (spec.numbering) {
    part('word/numbering.xml', `${CT}numbering+xml`, 'numbering', `<w:numbering ${NS}>${spec.numbering}</w:numbering>`, 'rIdNum');
  }
  if (spec.footnotes) {
    part('word/footnotes.xml', `${CT}footnotes+xml`, 'footnotes', `<w:footnotes ${NS}>${spec.footnotes}</w:footnotes>`, 'rIdNotes');
  }
  if (spec.settings) {
    part('word/settings.xml', `${CT}settings+xml`, 'settings', `<w:settings ${NS}>${spec.settings}</w:settings>`, 'rIdSettings');
  }
  for (const extra of spec.parts ?? []) {
    part(extra.path, extra.type, extra.rel, extra.content, extra.id);
  }
  for (const link of spec.links ?? []) {
    rels.push(`<Relationship Id="${link.id}" Type="${REL}hyperlink" Target="${link.target}" TargetMode="External"/>`);
  }
  const root = spec.strict ? 'http://purl.oclc.org/ooxml/wordprocessingml/main' : W;
  files.push([
    'word/document.xml',
    enc(`<w:document xmlns:w="${root}" xmlns:r="${R}" xmlns:wp="${WP}" ${spec.rootAttrs ?? ''}><w:body>${spec.body}</w:body></w:document>`),
  ]);
  files.push([
    'word/_rels/document.xml.rels',
    enc(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`),
  ]);

  const packageRels = [`<Relationship Id="rId1" Type="${REL}officeDocument" Target="word/document.xml"/>`];
  if (spec.custom) {
    const props = Object.entries(spec.custom)
      .map(
        ([name, value], i) =>
          `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${i + 2}" name="${name}"><vt:lpwstr>${value}</vt:lpwstr></property>`
      )
      .join('');
    files.push([
      'docProps/custom.xml',
      enc(
        `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">${props}</Properties>`
      ),
    ]);
    overrides.push(
      `<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>`
    );
    packageRels.push(`<Relationship Id="rId2" Type="${REL}custom-properties" Target="docProps/custom.xml"/>`);
  }
  files.push([
    '_rels/.rels',
    enc(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${packageRels.join('')}</Relationships>`),
  ]);
  files.unshift([
    '[Content_Types].xml',
    enc(
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${Object.entries(
        spec.defaults ?? {}
      )
        .map(([ext, type]) => `<Default Extension="${ext}" ContentType="${type}"/>`)
        .join('')}${overrides.join('')}</Types>`
    ),
  ]);
  return await writeZip(files);
};

const para = (text: string, pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
const style = (id: string, name: string, inner = '', attrs = '') =>
  `<w:style w:type="paragraph" w:styleId="${id}" ${attrs}><w:name w:val="${name}"/>${inner}</w:style>`;
const NORMAL = (font: string) => style('Normal', 'Normal', `<w:rPr><w:rFonts w:ascii="${font}"/></w:rPr>`, 'w:default="1"');
const SECT = (margin: number) => `<w:sectPr><w:pgMar w:left="${margin}"/></w:sectPr>`;

/** The export a test joins to: pandoc's own shape, one section and a Normal style. */
const exported = (extra: Partial<Spec> = {}) => docx({ body: `${para('Exported')}${SECT(1440)}`, styles: NORMAL('Aptos'), ...extra });

const join = async (target: Uint8Array, request: Partial<JoinRequest>) => {
  const out = await joinDocx(target, { before: [], after: [], styles: 'own', ...request });
  const files = await readZip(out);
  const xml = (path: string) => new DOMParser().parseFromString(new TextDecoder().decode(files.get(path)), 'application/xml');
  return { files, xml, document: xml('word/document.xml') };
};

const byTag = (doc: Document | Element, local: string, ns = W) => Array.from(doc.getElementsByTagNameNS(ns, local));
const val = (el: Element, attr = 'val') => el.getAttributeNS(W, attr);
const texts = (doc: Document) => byTag(doc, 'p').map(p => p.textContent);
const bodyChildren = (doc: Document) => Array.from(byTag(doc, 'body')[0].children).map(el => el.localName);

describe('joining documents to an export', () => {
  test('puts the content before and after the export, each closed by its own section', async () => {
    const title = await docx({ body: `${para('Title')}${SECT(1700)}`, styles: NORMAL('Aptos') });
    const appendix = await docx({ body: `${para('Appendix')}${SECT(1000)}`, styles: NORMAL('Aptos') });
    const { document } = await join(await exported(), {
      before: [{ name: 'Title', bytes: title }],
      after: [{ name: 'Appendix', bytes: appendix }],
    });

    expect(texts(document)).toEqual(['Title', 'Exported', 'Appendix']);
    // The break sits on each part's last paragraph: no empty paragraph to spill onto a page of its own.
    expect(bodyChildren(document)).toEqual(['p', 'p', 'p', 'sectPr']);
    const sections = byTag(document, 'sectPr').map(s => val(byTag(s, 'pgMar')[0], 'left'));
    expect(sections).toEqual(['1700', '1440', '1000']);
  });

  test('closes a document ending in a table with a paragraph of its own', async () => {
    const table = await docx({ body: `<w:tbl><w:tr><w:tc>${para('cell')}</w:tc></w:tr></w:tbl>${SECT(1700)}` });
    const { document } = await join(await exported(), { before: [{ name: 'T', bytes: table }] });
    expect(bodyChildren(document)).toEqual(['tbl', 'p', 'p', 'sectPr']);
  });

  test('refuses what is not a Word document, and a Strict one by name', async () => {
    await expect(join(await exported(), { before: [{ name: 'notes', bytes: enc('plain text') }] })).rejects.toThrow(
      /"notes" is not a Word document/
    );
    const strict = await docx({ body: para('x'), strict: true });
    await expect(join(await exported(), { before: [{ name: 'Old', bytes: strict }] })).rejects.toThrow(/Strict Open XML/);
  });

  test('drops the properties that named the documents', async () => {
    const target = await exported({ custom: { 'docx-before': '[[Title.docx]]', 'keep-me': 'yes' } });
    const title = await docx({ body: para('Title') });
    const { xml } = await join(target, { before: [{ name: 'Title', bytes: title }], dropProperties: ['docx-before'] });
    const names = Array.from(xml('docProps/custom.xml').getElementsByTagName('property')).map(p => p.getAttribute('name'));
    expect(names).toEqual(['keep-me']);
  });
});

describe('styles', () => {
  const title = () =>
    docx({
      body: `${para('Plain')}${para('Big', '<w:pStyle w:val="Big"/>')}${SECT(1700)}`,
      docDefaults: '<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="28"/></w:rPr></w:rPrDefault></w:docDefaults>',
      styles: `${NORMAL('Times New Roman')}${style('Big', 'Big', '<w:basedOn w:val="Normal"/><w:rPr><w:b/></w:rPr>')}`,
    });

  test('own: a clashing style is renamed, and unstyled paragraphs are pointed at it', async () => {
    const { document, xml } = await join(await exported(), { before: [{ name: 'Title page', bytes: await title() }] });
    const styles = byTag(xml('word/styles.xml'), 'style');
    const renamed = styles.find(s => val(byTag(s, 'name')[0]) === 'Normal (Title page)');
    expect(renamed).toBeDefined();
    expect(renamed.hasAttributeNS(W, 'default')).toBe(false);
    // The export's own Normal is untouched, and stays the default.
    const normal = styles.find(s => val(s, 'styleId') === 'Normal');
    expect(val(byTag(normal, 'rFonts')[0], 'ascii')).toBe('Aptos');

    const [plain, big, own] = byTag(document, 'p');
    expect(val(byTag(plain, 'pStyle')[0])).toBe(val(renamed, 'styleId'));
    expect(byTag(own, 'pStyle')).toHaveLength(0);
    // A style based on the renamed one follows it.
    const bigStyle = styles.find(s => val(s, 'styleId') === val(byTag(big, 'pStyle')[0]));
    expect(val(byTag(bigStyle, 'basedOn')[0])).toBe(val(renamed, 'styleId'));
  });

  test('own: the document defaults the export does not share are laid under the root style', async () => {
    const { xml } = await join(await exported(), { before: [{ name: 'Title page', bytes: await title() }] });
    const renamed = byTag(xml('word/styles.xml'), 'style').find(s => val(byTag(s, 'name')[0]) === 'Normal (Title page)');
    const rPr = byTag(renamed, 'rPr')[0];
    expect(val(byTag(rPr, 'sz')[0])).toBe('28');
    // In the schema's order: fonts before size.
    expect(Array.from(rPr.children).map(c => c.localName)).toEqual(['rFonts', 'sz']);
  });

  test('own: a style the export already has, equal in every way, is shared rather than copied', async () => {
    const same = await docx({ body: `${para('x')}${SECT(1700)}`, styles: NORMAL('Aptos') });
    const { xml, document } = await join(await exported(), { after: [{ name: 'Same', bytes: same }] });
    expect(byTag(xml('word/styles.xml'), 'style')).toHaveLength(1);
    expect(byTag(document, 'pStyle')).toHaveLength(0);
  });

  test("template: styles are matched by name, so Word's localised ids find the export's", async () => {
    const russian = await docx({
      body: `${para('Обычный текст')}${para('Глава', '<w:pStyle w:val="1"/>')}${SECT(1700)}`,
      styles: `${style('a', 'Normal', '<w:rPr><w:rFonts w:ascii="Times New Roman"/></w:rPr>', 'w:default="1"')}${style('1', 'heading 1', '<w:basedOn w:val="a"/>')}`,
    });
    const target = await exported({ styles: `${NORMAL('Aptos')}${style('Heading1', 'Heading 1', '<w:basedOn w:val="Normal"/>')}` });
    const { document, xml } = await join(target, { before: [{ name: 'Ru', bytes: russian }], styles: 'template' });
    expect(byTag(xml('word/styles.xml'), 'style').map(s => val(s, 'styleId'))).toEqual(['Normal', 'Heading1']);
    const [plain, heading] = byTag(document, 'p');
    expect(byTag(plain, 'pStyle')).toHaveLength(0);
    expect(val(byTag(heading, 'pStyle')[0])).toBe('Heading1');
  });

  test('own: theme fonts are written out as the joined document’s theme names them', async () => {
    const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
    const theme = (font: string) =>
      `<a:theme xmlns:a="${A}"><a:themeElements><a:clrScheme name="x"/><a:fontScheme name="x"><a:majorFont><a:latin typeface="${font}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${font}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`;
    const themePart = (font: string) => ({
      path: 'word/theme/theme1.xml',
      type: 'application/vnd.openxmlformats-officedocument.theme+xml',
      rel: 'theme',
      content: theme(font),
      id: 'rIdTheme',
    });
    const source = await docx({
      body: `<w:p><w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/></w:rPr><w:t>x</w:t></w:r></w:p>${SECT(1700)}`,
      styles: NORMAL('Aptos'),
      parts: [themePart('Inter')],
    });
    const { document } = await join(await exported({ parts: [themePart('Aptos')] }), { before: [{ name: 'S', bytes: source }] });
    const fonts = byTag(document, 'rFonts')[0];
    expect(val(fonts, 'ascii')).toBe('Inter');
    expect(fonts.hasAttributeNS(W, 'asciiTheme')).toBe(false);
  });
});

describe('ids', () => {
  test('lists get numbers of their own, and a fresh nsid', async () => {
    const numbering = (nsid: string) =>
      `<w:abstractNum w:abstractNumId="0"><w:nsid w:val="${nsid}"/><w:lvl w:ilvl="0"/></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>`;
    const source = await docx({
      body: `${para('item', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>')}${SECT(1700)}`,
      numbering: numbering('AAAAAAAA'),
    });
    const { document, xml } = await join(await exported({ numbering: numbering('AAAAAAAA') }), { before: [{ name: 'S', bytes: source }] });

    const numberingDoc = xml('word/numbering.xml');
    const nums = byTag(numberingDoc, 'num');
    expect(nums.map(n => val(n, 'numId'))).toEqual(['1', '2']);
    expect(val(byTag(nums[1], 'abstractNumId')[0])).toBe('1');
    // Every abstractNum stands ahead of every num, as the schema wants.
    expect(Array.from(numberingDoc.documentElement.children).map(c => c.localName)).toEqual(['abstractNum', 'abstractNum', 'num', 'num']);
    expect(val(byTag(byTag(numberingDoc, 'abstractNum')[1], 'nsid')[0])).not.toBe('AAAAAAAA');
    expect(val(byTag(document, 'numId')[0])).toBe('2');
  });

  test('footnotes are renumbered, and each document counts them from 1 again', async () => {
    const notes = (text: string) =>
      `<w:footnote w:type="separator" w:id="-1"><w:p/></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p/></w:footnote><w:footnote w:id="1">${para(text)}</w:footnote>`;
    const body = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r></w:p>`;
    const source = await docx({ body: `${body('appendix')}${SECT(1700)}`, footnotes: notes('appendix note') });
    const target = await exported({ body: `${body('export')}${SECT(1440)}`, footnotes: notes('export note') });
    const { document, xml } = await join(target, { after: [{ name: 'A', bytes: source }] });

    const items = byTag(xml('word/footnotes.xml'), 'footnote').filter(n => !n.hasAttributeNS(W, 'type'));
    expect(items.map(n => [val(n, 'id'), n.textContent])).toEqual([
      ['1', 'export note'],
      ['2', 'appendix note'],
    ]);
    expect(byTag(document, 'footnoteReference').map(r => val(r, 'id'))).toEqual(['1', '2']);
    const appendixSection = byTag(document, 'sectPr')[1];
    expect(val(byTag(appendixSection, 'numRestart')[0])).toBe('eachSect');
  });

  test("the document's own footnote settings travel with its sections", async () => {
    const source = await docx({
      body: `${para('x')}${SECT(1700)}`,
      settings: '<w:footnotePr><w:numFmt w:val="lowerRoman"/><w:footnote w:id="-1"/></w:footnotePr>',
    });
    const { document } = await join(await exported(), { after: [{ name: 'A', bytes: source }] });
    const props = byTag(byTag(document, 'sectPr')[1], 'footnotePr')[0];
    expect(Array.from(props.children).map(c => `${c.localName}=${val(c)}`)).toEqual(['numFmt=lowerRoman', 'numRestart=eachSect']);
  });

  test('a bookmark name the export uses is renamed, and the links to it follow', async () => {
    const mark = (name: string) => `<w:bookmarkStart w:id="0" w:name="${name}"/>${para('heading')}<w:bookmarkEnd w:id="0"/>`;
    const link = `<w:p><w:hyperlink w:anchor="_Toc1"><w:r><w:t>see</w:t></w:r></w:hyperlink><w:r><w:instrText> PAGEREF _Toc1 \\h </w:instrText></w:r></w:p>`;
    const source = await docx({ body: `${link}${mark('_Toc1')}${SECT(1700)}` });
    const target = await exported({ body: `${mark('_Toc1')}${SECT(1440)}` });
    const { document } = await join(target, { after: [{ name: 'A', bytes: source }] });

    const starts = byTag(document, 'bookmarkStart');
    expect(starts.map(s => val(s, 'name'))).toEqual(['_Toc1', '_Toc1_2']);
    expect(new Set(starts.map(s => val(s, 'id'))).size).toBe(2);
    expect(val(byTag(document, 'hyperlink')[0], 'anchor')).toBe('_Toc1_2');
    expect(byTag(document, 'instrText')[0].textContent).toBe(' PAGEREF _Toc1_2 \\h ');
  });

  test('pictures are copied under a name of their own, with drawing ids no other drawing has', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const drawing = (rId: string) =>
      `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Picture"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><a:blip r:embed="${rId}"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    const image = (id: string) => ({ path: 'word/media/image1.png', type: '', rel: 'image', content: png, id });
    const gif = { path: 'word/media/image2.gif', type: '', rel: 'image', content: png, id: 'rIdGif' };
    const source = await docx({
      body: `${drawing('rIdImg')}${drawing('rIdGif')}${SECT(1700)}`,
      parts: [image('rIdImg'), gif],
      defaults: { png: 'image/png', gif: 'image/gif' },
    });
    const target = await exported({
      body: `${drawing('rIdMine')}${SECT(1440)}`,
      parts: [image('rIdMine')],
      defaults: { png: 'image/png' },
    });
    const { document, files, xml } = await join(target, { before: [{ name: 'S', bytes: source }] });

    expect([...files.keys()].filter(k => k.startsWith('word/media/')).sort()).toEqual([
      'word/media/image1.png',
      'word/media/image1_2.png',
      'word/media/image2.gif',
    ]);
    expect(byTag(document, 'docPr', WP).map(d => d.getAttribute('id'))).toEqual(['2', '3', '1']);
    const embed = byTag(document, 'blip', 'http://schemas.openxmlformats.org/drawingml/2006/main')[0].getAttributeNS(R, 'embed');
    const rel = Array.from(xml('word/_rels/document.xml.rels').getElementsByTagName('Relationship')).find(
      r => r.getAttribute('Id') === embed
    );
    expect(rel.getAttribute('Target')).toBe('media/image1_2.png');
    const types = xml('[Content_Types].xml');
    // The export had no GIF in it, so it learns the type from the document that brought one.
    expect(
      Array.from(types.getElementsByTagName('Default'))
        .find(d => d.getAttribute('Extension') === 'gif')
        ?.getAttribute('ContentType')
    ).toBe('image/gif');
  });

  test('an external link keeps its address', async () => {
    const source = await docx({
      body: `<w:p><w:hyperlink r:id="rIdLink"><w:r><w:t>site</w:t></w:r></w:hyperlink></w:p>${SECT(1700)}`,
      links: [{ id: 'rIdLink', target: 'https://example.org' }],
    });
    const { document, xml } = await join(await exported(), { after: [{ name: 'A', bytes: source }] });
    const id = byTag(document, 'hyperlink')[0].getAttributeNS(R, 'id');
    const rel = Array.from(xml('word/_rels/document.xml.rels').getElementsByTagName('Relationship')).find(r => r.getAttribute('Id') === id);
    expect(rel.getAttribute('Target')).toBe('https://example.org');
    expect(rel.getAttribute('TargetMode')).toBe('External');
  });
});

describe('headers and footers', () => {
  const footer = (text: string, id: string) => ({
    path: 'word/footer1.xml',
    type: `${CT}footer+xml`,
    rel: 'footer',
    content: `<w:ftr ${NS}>${para(text)}</w:ftr>`,
    id,
  });

  test("a title page's footer is not handed on to the pages after it", async () => {
    const title = await docx({
      body: `${para('Title')}<w:sectPr><w:footerReference w:type="default" r:id="rIdF"/></w:sectPr>`,
      parts: [footer('Moscow 2026', 'rIdF')],
    });
    const { document, xml, files } = await join(await exported(), { before: [{ name: 'Title', bytes: title }] });

    const [titleSection, ownSection] = byTag(document, 'sectPr');
    const ref = (s: Element) => byTag(s, 'footerReference')[0]?.getAttributeNS(R, 'id');
    const target = (id: string | null | undefined) =>
      Array.from(xml('word/_rels/document.xml.rels').getElementsByTagName('Relationship'))
        .find(r => r.getAttribute('Id') === id)
        ?.getAttribute('Target');
    expect(new TextDecoder().decode(files.get(`word/${target(ref(titleSection))}`))).toContain('Moscow 2026');
    // The export's section is given an empty footer of its own rather than inheriting the title page's.
    const empty = new TextDecoder().decode(files.get(`word/${target(ref(ownSection))}`));
    expect(empty).not.toContain('Moscow');
    expect(byTag(ownSection, 'footerReference')[0].getAttributeNS(W, 'type')).toBe('default');
  });
});

describe('namespaces', () => {
  test('the prefixes moved markup uses, ignorable ones included, are declared on the root', async () => {
    const source = await docx({
      rootAttrs: `xmlns:mc="${MC}" xmlns:w14="${W14}" mc:Ignorable="w14"`,
      body: `<w:p w14:paraId="1234ABCD"><w:r><w:t>x</w:t></w:r></w:p>${SECT(1700)}`,
    });
    const { document } = await join(await exported(), { before: [{ name: 'S', bytes: source }] });
    const root = document.documentElement;
    expect(root.lookupNamespaceURI('w14')).toBe(W14);
    expect(root.getAttributeNS(MC, 'Ignorable')).toBe('w14');
    // Word renumbers these itself; two documents' copies would collide.
    expect(byTag(document, 'p')[0].hasAttributeNS(W14, 'paraId')).toBe(false);
  });
});
