/* The plugin's own Pandoc data folder, laid out as Pandoc's is, so Pandoc 3.14 and newer find what is in it by name. */

export const DATA_DIR = 'pandoc';
export const FILTERS_DIR = `${DATA_DIR}/filters`;
export const TEMPLATES_DIR = `${DATA_DIR}/templates`;

/** Where the filters and the LaTeX templates were kept before 3.1.3. */
export const LEGACY_FILTERS_DIR = 'lua';
export const LEGACY_TEMPLATES_DIR = 'textemplate';
