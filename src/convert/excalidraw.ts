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

/** What a drawing is handed to pandoc as. */
export type DrawingFormat = 'svg' | 'png';

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

/**
 * A drawing, drawn — or nothing, where there is no Excalidraw to draw it and the embed is left as it was written.
 *
 * `link` is the embed exactly as the note writes it, not the file's path: Excalidraw reads the `#frame=…` and
 * `#^group=…` an embed can carry off the end of it, and hands back that part of the scene rather than the whole of it.
 *
 * No theme is named, so the drawing comes out the way Excalidraw's own export settings say it should — including the
 * `excalidraw-export-dark` a single drawing can carry to answer for itself.
 */
export const renderDrawing = async (app: App, link: string, format: DrawingFormat): Promise<Uint8Array | undefined> => {
  const api = excalidraw(app)?.ea?.getAPI?.();
  if (!api) {
    return undefined;
  }
  try {
    if (format === 'svg') {
      const svg = await api.createSVG?.(link, true);
      return svg ? new TextEncoder().encode(standalone(svg)) : undefined;
    }
    const png = await api.createPNG?.(link, PNG_SCALE);
    return png ? new Uint8Array(await png.arrayBuffer()) : undefined;
  } catch (e) {
    // One drawing that will not draw is not a reason to fail the export: it is left as the embed it was.
    console.warn(`Could not render the Excalidraw drawing "${link}"`, e);
    return undefined;
  } finally {
    api.destroy?.();
  }
};
