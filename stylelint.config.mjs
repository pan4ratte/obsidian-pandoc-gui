/** Flags CSS that Obsidian's plugin review warns about: features the Chromium inside Obsidian supports only partly or not at all. */
export default {
  plugins: ['stylelint-no-unsupported-browser-features'],
  rules: {
    'plugin/no-unsupported-browser-features': [
      true,
      {
        // The review checks against the Chromium of recent Obsidian releases, whatever the manifest's minAppVersion.
        browsers: ['chrome >= 144'],
        severity: 'warning',
      },
    ],
  },
};
