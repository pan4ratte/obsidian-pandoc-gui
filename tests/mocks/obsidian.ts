/** The `obsidian` package ships types only, so anything importing it has no module to resolve in a test run. */
export const requestUrl = async () => {
  throw new Error('requestUrl is not available outside of Obsidian');
};

export const moment = { locale: () => 'en-us' };

export const apiVersion = '1.13.1';

/** A desktop, which is what a test run is; the per-platform settings then key off node's own name for it. */
export const Platform = {
  isDesktop: true,
  isMobile: false,
  isPhone: false,
  isTablet: false,
  isMobileApp: false,
  isDesktopApp: true,
  isIosApp: false,
  isAndroidApp: false,
  isWin: process.platform === 'win32',
  isMacOS: process.platform === 'darwin',
};

/** Enough of what the UI builds on for a module that imports it to load. */
export class Modal {
  constructor(public app: unknown) {}
  open() {}
  onClose() {}
}

export class Notice {
  constructor(public message: string) {}
}

/** As Obsidian's own: forward slashes, no doubles, and no slash at either end. */
export const normalizePath = (path: string): string =>
  path
    .replaceAll('\\', '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '');
