import { FILTERS_DIR, TEMPLATES_DIR } from './pandoc/data_dir';

// The loader in <root>/vite.config.ts inlines each file as a string literal — they are all UTF-8 text.
type Resource = { default: string };

/**
 * `dir` is where the files are written inside the plugin folder, which is not where they are kept in the repository:
 * the bundled filters are sources, and live with the rest of the catalogue in `lua-filters/`, while `pandoc/filters/`
 * in a plugin folder is written to at runtime — by `releaseResources` and by the store.
 */
const embed = (dir: string, res: Record<string, Resource>) =>
  [dir, Object.entries(res).map(([k, m]) => [k.substring(k.lastIndexOf('/') + 1), m.default] as const)] as const;

/** The lua filters the plugin ships with, by file name. */
export const BUNDLED_LUA_FILES: readonly string[] = Object.keys(
  import.meta.glob<Resource>('../lua-filters/bundled/*.lua', { eager: true })
).map(k => k.substring(k.lastIndexOf('/') + 1));

// The embedded resource
export default [
  // For other file types, the Loader must be configured in the <root>/vite.config.ts.
  embed(FILTERS_DIR, import.meta.glob<Resource>('../lua-filters/bundled/*.lua', { eager: true })),
  embed(TEMPLATES_DIR, import.meta.glob<Resource>('../textemplate/*.{tex,sty}', { eager: true })),
];
