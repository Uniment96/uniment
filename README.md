# uniment.ae

Static marketing site for Uniment, deployed via GitHub Pages (see `CNAME`).
No build system, no `package.json` — the only generated asset is `css/tailwind.css`.

Scrolling is native (no smooth-scroll library); anchor links glide via CSS
`scroll-behavior: smooth`, which reduced-motion users get as instant jumps.

## Regenerating tailwind.css

`css/tailwind.css` is committed to the repo and must be regenerated whenever
Tailwind utility classes in `index.html` are added, removed, or renamed
(including classes referenced from inline JS — add those to the `safelist`
in `tailwind.config.js`, since the CLI cannot see classes built at runtime).

Uses the Tailwind **v3.4.x standalone CLI** (v3, not v4 — the site was authored
against v3 utility behavior). The binary is not committed; download it once:

```sh
# macOS arm64 — for other platforms see:
# https://github.com/tailwindlabs/tailwindcss/releases/tag/v3.4.17
curl -sLO https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-macos-arm64
chmod +x tailwindcss-macos-arm64
```

Then, from the repo root:

```sh
./tailwindcss-macos-arm64 -c tailwind.config.js -i tailwind.input.css -o css/tailwind.css --minify
```

Commit the updated `css/tailwind.css` together with the HTML change that
required it.

## Fonts

Space Grotesk is self-hosted: `css/fonts.css` + `fonts/*.woff2` are a
byte-for-byte mirror of what Google Fonts serves (mirrored 2026-07-15), with
only the `src` URLs rewritten to local paths. Source CSS:

```
https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&display=swap
```

**If you ever re-mirror, fetch that URL with a current Chrome desktop
`User-Agent` header.** Without a modern UA, Google serves full-size TTFs with
no `unicode-range` splits instead of the per-subset woff2 files real users
get. Download every woff2 the returned CSS references, and keep the
`@font-face` blocks verbatim (same `unicode-range`, same
`font-display: swap`) so subset-download behavior stays identical.

The files are version-pinned by commit (currently `spacegrotesk/v22`).
Google-side font updates no longer flow in automatically — that is
intentional, the same policy as the `@latest` CDN elimination. Note: Google
declares no weight-800 face for this family (the response covers 400/600/700,
one shared file per subset), so `font-weight: 800` styles intentionally render
via the 700 face — do not "fix" this by adding an 800 face or editing weights.
