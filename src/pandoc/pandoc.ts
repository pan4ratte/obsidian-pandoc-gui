import { requestUrl } from 'obsidian';
import { exec } from '../system/utils';
// `parse` is the only entry point used — it returns a SemVer, whose `compare` covers the rest. The package root
// re-exports ranges, comparators and coercion too, none of which this plugin needs.
import semverParse from 'semver/functions/parse';
import type { SemVer } from 'semver';

export const normalizePandocPath = (path?: string) => (path?.includes(' ') ? `"${path}"` : `${path ?? 'pandoc'}`);

/** Pandoc versions are not semver: they carry two components (`2.9`) or four (`3.1.11.1`). */
export function parsePandocVersion(version: string) {
  version = version.trim().replace(/^v/i, '');
  let dotCount = [...version].filter(c => c === '.').length;
  if (dotCount === 1) {
    version = `${version}.0`;
  } else {
    while (dotCount > 2) {
      version = version.substring(0, version.lastIndexOf('.'));
      dotCount -= 1;
    }
  }
  return semverParse(version, true);
}

export async function getPandocVersion(path?: string, env?: Record<string, string>) {
  path = normalizePandocPath(path);
  let { stdout: version } = await exec(`${path} --version`, { env });
  version = version.substring(0, version.indexOf('\n')).replace('pandoc.exe', '').replace('pandoc', '').trim();
  return parsePandocVersion(version);
}

/**
 * What the last lookup was made with, so pointing the setting at a different binary asks that one rather than
 * reporting the previous one's version.
 */
let versionCache: { key: string; version: SemVer } | undefined;

const versionCacheKey = (path?: string, env?: Record<string, string>) => JSON.stringify([path ?? '', env ?? {}]);

/** Installed pandoc's version, looked up once per session for any given binary. */
export async function getCachedPandocVersion(path?: string, env?: Record<string, string>) {
  const key = versionCacheKey(path, env);
  if (versionCache?.key === key) {
    return versionCache.version;
  }
  const version = await getPandocVersion(path, env);
  if (version) {
    versionCache = { key, version };
  }
  return version;
}

export const PANDOC_REQUIRED_VERSION = '3.1.7';

/** Where `--syntax-highlighting` arrived, and `--no-highlight` and `--highlight-style` began to warn. */
export const PANDOC_SYNTAX_HIGHLIGHTING_VERSION = '3.7.0';

export const takesSyntaxHighlighting = (version?: SemVer | null): boolean =>
  !!version && version.compare(PANDOC_SYNTAX_HIGHLIGHTING_VERSION) >= 0;

/** Where `--math-method` arrived, and `--mathjax` and its four siblings began to warn. */
export const PANDOC_MATH_METHOD_VERSION = '3.11.0';

export const takesMathMethod = (version?: SemVer | null): boolean => !!version && version.compare(PANDOC_MATH_METHOD_VERSION) >= 0;

export const PANDOC_MANUAL_URL = 'https://pandoc.org/MANUAL.html';

/** Landing page for the newest release, used when the API lookup gives no URL. */
export const PANDOC_LATEST_RELEASE_URL = 'https://github.com/jgm/pandoc/releases/latest';

const PANDOC_LATEST_RELEASE_API = 'https://api.github.com/repos/jgm/pandoc/releases/latest';

export interface PandocRelease {
  version: SemVer;
  url: string;
}

/**
 * Pandoc ships a few times a year, so one lookup per plugin session is plenty and leaves GitHub's unauthenticated
 * rate limit alone.
 */
export const RELEASE_CACHE_TTL = 6 * 60 * 60 * 1000;

let releaseCache: { fetchedAt: number; release: PandocRelease } | undefined;

/**
 * Newest release published on the official repository, or `undefined` when it cannot be determined (offline, rate
 * limited, unparsable tag).
 */
export async function getLatestPandocRelease(): Promise<PandocRelease | undefined> {
  if (releaseCache && Date.now() - releaseCache.fetchedAt < RELEASE_CACHE_TTL) {
    return releaseCache.release;
  }

  // `requestUrl` goes through Obsidian rather than the renderer, so no CORS.
  const response = await requestUrl({
    url: PANDOC_LATEST_RELEASE_API,
    headers: { Accept: 'application/vnd.github+json' },
    throw: false,
  });

  if (response.status !== 200) {
    return undefined;
  }

  const { tag_name, html_url } = (response.json ?? {}) as { tag_name?: string; html_url?: string };
  const version = tag_name ? parsePandocVersion(tag_name) : undefined;
  if (!version) {
    return undefined;
  }

  const release: PandocRelease = { version, url: html_url ?? PANDOC_LATEST_RELEASE_URL };
  releaseCache = { fetchedAt: Date.now(), release };
  return release;
}

export default {
  normalizePath: normalizePandocPath,
  getVersion: getPandocVersion,
  getCachedVersion: getCachedPandocVersion,
  parseVersion: parsePandocVersion,
  getLatestRelease: getLatestPandocRelease,
  takesSyntaxHighlighting,
  takesMathMethod,
  requiredVersion: PANDOC_REQUIRED_VERSION,
  manualUrl: PANDOC_MANUAL_URL,
  latestReleaseUrl: PANDOC_LATEST_RELEASE_URL,
};
