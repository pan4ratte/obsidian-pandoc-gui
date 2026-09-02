import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default tseslint.config(
  // `main.js` is built output.
  { ignores: ['main.js', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Obsidian's own ruleset, which checks what a plugin is reviewed against
  // rather than what TypeScript can see.
  ...obsidianmd.configs.recommended,
  {
    // Both rulesets above include rules that ask the type checker rather than
    // just the syntax tree, and those need the project wired up.
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Everything, `.tsx` included. The components were excluded for as long as
    // the config had a `--ext .ts,.js` flag behind it, which is how they came to
    // be the half of the source nothing checked.
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.commonjs,
      },
    },
    rules: {
      // Formatting belongs to prettier (see .prettierrc), which is the only one
      // of the two that can also fix it. The core rules that used to say this —
      // indent, quotes, semi, linebreak-style — are deprecated in ESLint 10.
      'no-prototype-builtins': 'off',
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // TypeScript resolves names itself, and does it properly — it knows about
      // `declare global`, which this rule does not. Turning it off for typed
      // files is typescript-eslint's own advice.
      'no-undef': 'off',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      // `let el!: HTMLDivElement` is assigned by solid through `ref={el}`, which
      // compiles to an assignment the rule cannot see. Every report of it in the
      // components is that pattern.
      'no-unassigned-vars': 'off',
    },
  },
  {
    // The build config, which pulls methods off objects on purpose: vite's own
    // logger is called back through `warn.call(logger, …)`, which supplies the
    // receiver the rule cannot see, and node's `path` methods never read `this`.
    files: ['vite.config.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
  {
    // vitest leaves `describe`/`test`/`expect` global, and the specs read fixtures off disk.
    files: ['tests/**/*.ts'],
    languageOptions: { globals: { ...globals.vitest, ...globals.node } },
  },
  {
    // The build and lint config are plain JS, outside the TypeScript project,
    // so the rules that need a type checker have nothing to ask.
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Node is what these are for. The rule against importing it is about what a
    // phone loads: the build config runs under node while the bundle is made,
    // and the specs under vitest, so neither is ever in one.
    //
    // Written here rather than in the files because a reviewer's own eslint run
    // does not read this config — anything that has to be said to that run is
    // said in the file itself, as `tools/text-loader.ts` does.
    files: ['vite.config.ts', 'vitest.config.ts', 'version.mjs', 'scripts/**', 'tools/**', 'tests/**'],
    rules: { 'obsidianmd/no-nodejs-modules': 'off' },
  },
  {
    // Repository tooling, run from a terminal by a maintainer and never shipped.
    // Obsidian's guideline against logging is about a plugin filling a user's
    // console; a command-line script reporting what it rewrote is the opposite.
    files: ['scripts/**/*.{js,mjs,cjs}', 'version.mjs'],
    languageOptions: { globals: globals.node },
    rules: { 'obsidianmd/rule-custom-message': 'off' },
  }
);
