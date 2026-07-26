/**
 * Resolve a media `src` for the current deployment.
 *
 * The app is served from a sub-path on GitHub Pages (`base: '/ml2-master-game/'`
 * in vite.config.ts), so a bare '/media/x.jpg' resolves to the domain root and
 * 404s — but only in the production build, never in `npm run dev`. Everything
 * that renders a bundled asset must go through here.
 *
 * Absolute URLs (https://, //, data:, blob:) are passed through untouched, so a
 * professor can paste a public image URL into the session editor.
 */
export function resolveMediaSrc(src: string): string {
  if (!src) return '';
  if (/^(https?:)?\/\//i.test(src) || /^(data|blob):/i.test(src)) return src;
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/${src.replace(/^\//, '')}`;
}
