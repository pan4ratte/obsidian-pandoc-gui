import { Notice, Platform, apiVersion } from 'obsidian';
import type PandocGuiPlugin from '../main';
import { t } from '../lang/helpers';
import pandoc from '../pandoc/pandoc';
import { resolveEngine } from '../pandoc/engine';
import { createEnv } from '../settings';
import { getPlatformValue } from './utils';
import { isEmulatingMobile, isMobile } from './platform';

export interface ReportLine {
  label: string;
  value: string;
}

export interface ReportBlock {
  label: string;
  text?: string;
  lang?: string;
}

const systemName = (): string => {
  // Checked before macOS, which an iPhone also claims to be.
  if (Platform.isIosApp) return 'iOS';
  if (Platform.isAndroidApp) return 'Android';
  if (Platform.isWin) return 'Windows';
  if (Platform.isMacOS) return 'macOS';
  if (Platform.isLinux) return 'Linux';
  return 'unknown';
};

const installedPandocVersion = async (plugin: PandocGuiPlugin): Promise<string> => {
  const { settings } = plugin;
  try {
    const version = await pandoc.getCachedVersion(getPlatformValue(settings.pandocPath), createEnv(getPlatformValue(settings.env) ?? {}));
    return version ? `${version.version} (${t.REPORT_INSTALLED})` : t.REPORT_NOT_FOUND;
  } catch {
    return t.REPORT_NOT_FOUND;
  }
};

/** The versions a bug report is useless without. */
export async function environmentLines(plugin: PandocGuiPlugin): Promise<ReportLine[]> {
  const { settings, manifest } = plugin;
  const engine = resolveEngine(settings.engineMode, isMobile());
  const pandocVersion =
    engine === 'wasm' ? `${settings.wasmVersion ?? t.REPORT_NOT_INSTALLED} (wasm)` : await installedPandocVersion(plugin);
  const lines: ReportLine[] = [
    { label: manifest.name, value: manifest.version },
    { label: 'Obsidian', value: apiVersion },
    { label: t.REPORT_SYSTEM, value: isEmulatingMobile() ? `${systemName()} (mobile emulation)` : systemName() },
    { label: 'Pandoc', value: pandocVersion },
  ];
  if (settings.typstVersion) {
    lines.push({ label: 'Typst', value: `${settings.typstVersion} (wasm)` });
  }
  return lines;
}

/** Long enough that no run of backticks inside can close it. */
const fence = (text: string): string => '`'.repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map(([run]) => run.length + 1)));

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The user's name is in every path, and none of the report's readers need it. */
const hideHome = (text: string): string => {
  const env: Record<string, string | undefined> = typeof process === 'undefined' ? {} : process.env;
  const home = env['USERPROFILE'] ?? env['HOME'];
  if (!home || home.length < 3) {
    return text;
  }
  const spellings = [...new Set([home, home.replaceAll('\\', '/')])].map(escapeRegExp).join('|');
  return text.replace(new RegExp(spellings, Platform.isWin ? 'gi' : 'g'), '~');
};

/** Markdown, as a GitHub issue shows it. */
export function formatReport(title: string, lines: ReportLine[], blocks: ReportBlock[]): string {
  const parts = [`### ${title}`, lines.map(({ label, value }) => `* **${label}:** ${value}`).join('\n')];
  for (const { label, text, lang = '' } of blocks) {
    if (text) {
      const marks = fence(text);
      parts.push(`**${label}**\n\n${marks}${lang}\n${text}\n${marks}`);
    }
  }
  return hideHome(parts.join('\n\n'));
}

/** The window the user is in: a popout's clipboard call fails from the main window's navigator. */
export async function copyText(text: string, copied: string): Promise<void> {
  try {
    await activeWindow.navigator.clipboard.writeText(text);
    new Notice(copied, 2500);
  } catch (e) {
    console.error(e);
    new Notice(t.COPY_FAILED);
  }
}
