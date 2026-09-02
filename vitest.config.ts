import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { TEXT_FILES, textLoader } from './tools/text-loader.ts';

export default defineConfig({
  // The same inlining the build does: a test reaching a localised string reaches the user guide with it.
  plugins: [textLoader(TEXT_FILES)],
  test: {
    // `describe`/`test`/`expect` stay global, as they were under jest. `vi` is imported where it is used.
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
  resolve: {
    // The `obsidian` package ships types only, so anything importing it has no module to resolve outside Obsidian.
    alias: { obsidian: path.resolve(import.meta.dirname, 'tests/mocks/obsidian.ts') },
  },
});
