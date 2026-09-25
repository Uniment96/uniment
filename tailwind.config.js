/**
 * Build config for css/tailwind.css — mirrors the Tailwind v3 Play CDN defaults
 * this site previously used (no theme customization).
 * Regenerate with the standalone CLI; see README.md. Run from the repo root.
 */
module.exports = {
  content: ["index.html"],
  // Classes only ever applied from inline JS (classList.*) — keep them from being purged.
  // Of these, only `hidden` is a Tailwind utility; the rest (reveal, in, preserve-3d,
  // out, hovered, clicked, go) are defined in index.html's own <style> block.
  safelist: ["hidden"],
  theme: { extend: {} },
  plugins: [],
};
