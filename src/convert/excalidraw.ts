/* Excalidraw drawings, drawn into the document as the pictures they are.
 *
 * A drawing is a note. `Drawing.excalidraw.md` is markdown with the scene buried in it as compressed JSON, and
 * Obsidian resolves `![[Drawing]]` to that file the way it resolves any other embed — so, left alone, the export
 * writes pages of that JSON into the document, an embed naming a `.md` file being a note to write in as far as
 * anything downstream can tell. What the line means is the picture.
 *
 * Drawing one is Excalidraw's own work and nobody else's: a scene names images, fonts and other drawings, and only the
 * plugin holding it can resolve those. `ExcalidrawAutomate` is its API for exactly this, and `getAPI()` hands out an
 * instance of its own rather than the one the user's open drawings are being edited through.
 */

import type { App, TFile } from 'obsidian';

const EXCALIDRAW_PLUGIN = 'obsidian-excalidraw-plugin';

/** The frontmatter key Excalidraw marks its own notes with. */
const EXCALIDRAW_KEY = 'excalidraw-plugin';

/** How many image pixels to a drawing pixel: two, so a drawing set into a printed page is not visibly soft. */
const PNG_SCALE = 2;

/** What a document reads a picture at where the file says nothing about its own resolution. */
const CSS_DPI = 96;

/** What a drawing is handed to pandoc as. */
export type DrawingFormat = 'svg' | 'png';

/** A drawing, drawn — and what it was drawn into, which is not always what was asked for. */
export interface Drawing {
  format: DrawingFormat;
  bytes: Uint8Array;
}

/**
 * As much of another plugin's API as this file asks for. Every method is optional: the shape is whatever the version
 * the user happens to have installed offers, and a missing one means the drawing is left as it stands.
 */
interface ExcalidrawApi {
  createSVG?(path: string, embedFont?: boolean): Promise<SVGSVGElement | undefined>;
  createPNG?(path: string, scale?: number): Promise<Blob | undefined>;
  destroy?(): void;
}

interface ExcalidrawPlugin {
  ea?: { getAPI?(): ExcalidrawApi | undefined };
  isExcalidrawFile?(file: TFile): boolean;
}

const excalidraw = (app: App): ExcalidrawPlugin | undefined =>
  (app.plugins?.plugins as Record<string, ExcalidrawPlugin> | undefined)?.[EXCALIDRAW_PLUGIN];

/**
 * Whether the file is a drawing rather than a note.
 *
 * Excalidraw's own answer where it is running, and the two things that answer looks at where it is not: a
 * `.excalidraw` file is one by its name, and every drawing made since is markdown carrying `excalidraw-plugin` in its
 * frontmatter. Worth being able to answer without the plugin, because a vault that has switched it off still has the
 * drawings in it, and leaving an embed alone is much better than writing its JSON into the document.
 */
export const isDrawing = (app: App, file: TFile): boolean => {
  const plugin = excalidraw(app);
  if (plugin?.isExcalidrawFile) {
    try {
      return plugin.isExcalidrawFile(file);
    } catch (e) {
      console.warn(e);
    }
  }
  return file.extension === 'excalidraw' || !!app.metadataCache.getFileCache(file)?.frontmatter?.[EXCALIDRAW_KEY];
};

/**
 * The element as a file rather than a node: what Excalidraw hands back belongs to this document, where the namespace
 * is understood and need not be written down. A file has nothing to understand it, so it says what it is.
 */
const standalone = (svg: SVGSVGElement): string => {
  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  return svg.outerHTML;
};

/** The table CRC-32 is read off, built once: a PNG chunk carries one and a wrong one makes the file unreadable. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let bit = 0; bit < 8; bit++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

/**
 * The PNG with the resolution it was drawn at written into it, so a drawing lands the size it was drawn.
 *
 * Excalidraw draws `PNG_SCALE` pixels to each of the drawing's own, and a PNG that says nothing about its resolution
 * is read at `CSS_DPI` — the drawing would arrive in the document twice the size it is. `pHYs` says what one of its
 * pixels measures, and pandoc reads it: the picture stays as sharp as it was drawn and is set at its own size.
 */
export const withResolution = (png: Uint8Array, dpi: number): Uint8Array => {
  const perMetre = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // pHYs
  view.setUint32(8, perMetre);
  view.setUint32(12, perMetre);
  chunk[16] = 1; // the unit is the metre
  view.setUint32(17, crc32(chunk.subarray(4, 17)));

  // Straight after IHDR, which is where the format has it, and without the one the encoder may have written itself.
  const out: Uint8Array[] = [png.subarray(0, 8)];
  const chunks = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let at = 8; at + 8 <= png.length;) {
    const end = at + 12 + chunks.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    if (type !== 'pHYs') {
      out.push(png.subarray(at, end));
    }
    if (type === 'IHDR') {
      out.push(chunk);
    }
    at = end;
  }

  const written = new Uint8Array(out.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of out) {
    written.set(part, at);
    at += part.length;
  }
  return written;
};

/**
 * A drawing, drawn — or nothing, where there is no Excalidraw to draw it and the embed is left as it was written.
 *
 * `link` is the embed exactly as the note writes it, not the file's path: Excalidraw reads the `#frame=…` and
 * `#^group=…` an embed can carry off the end of it, and hands back that part of the scene rather than the whole of it.
 *
 * No theme is named, so the drawing comes out the way Excalidraw's own export settings say it should — including the
 * `excalidraw-export-dark` a single drawing can carry to answer for itself.
 *
 * `inlinedFontsRead` says whether whatever opens the document reads the fonts an SVG carries in it. Where it does not,
 * a drawing with words in it is drawn as a picture instead.
 */
export const renderDrawing = async (
  app: App,
  link: string,
  format: DrawingFormat,
  inlinedFontsRead = true
): Promise<Drawing | undefined> => {
  const api = excalidraw(app)?.ea?.getAPI?.();
  if (!api) {
    return undefined;
  }
  try {
    // Kept where the PNG is asked for instead, so a drawing that will not draw as one is still the drawing it drew.
    let svg: SVGSVGElement | undefined;
    if (format === 'svg') {
      svg = await api.createSVG?.(link, true);
      // Excalidraw writes its handwritten fonts into the SVG as `@font-face`, which a browser reads and next to
      // nothing else does: librsvg — what pandoc rasterises SVGs with — and Word's and LibreOffice's own renderers all
      // put a system font in their place and say so, one Pango warning per line of text. So where the SVG is not
      // headed for a browser, a drawing with words in it is handed over as the picture Excalidraw itself draws, which
      // is drawn in the browser this is running in and has the right fonts in it by the time it is a picture.
      if (svg && (inlinedFontsRead || !svg.querySelector('text'))) {
        return { format: 'svg', bytes: new TextEncoder().encode(standalone(svg)) };
      }
    }
    const png = await api.createPNG?.(link, PNG_SCALE);
    if (png) {
      return { format: 'png', bytes: withResolution(new Uint8Array(await png.arrayBuffer()), CSS_DPI * PNG_SCALE) };
    }
    return svg ? { format: 'svg', bytes: new TextEncoder().encode(standalone(svg)) } : undefined;
  } catch (e) {
    // One drawing that will not draw is not a reason to fail the export: it is left as the embed it was.
    console.warn(`Could not render the Excalidraw drawing "${link}"`, e);
    return undefined;
  } finally {
    api.destroy?.();
  }
};
