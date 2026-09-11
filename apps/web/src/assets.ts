/**
 * Asset URLs.
 *
 * Kinetrace is served from the site root on Vercel and from a subdirectory on
 * GitHub Pages (`/kinetrace/`). Vite exposes whichever it was built for as
 * `import.meta.env.BASE_URL`, always with a trailing slash, so every runtime
 * path — the pose models, the MediaPipe runtime — has to be resolved through
 * here rather than hard-coded as an absolute path.
 */

/** Resolve a path inside `public/` against the base the app was built for. */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base}${path.replace(/^\/+/, '')}`;
}

/** The base path itself, for the router and for anything that needs the prefix. */
export const BASE_PATH = import.meta.env.BASE_URL;
