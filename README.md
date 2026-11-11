# uniment.ae

Static marketing site for Uniment, deployed via GitHub Pages (see `CNAME`).
No build system, no `package.json`. The only generated assets are the raster images listed under "Social image and icons" below.

Scrolling is native (no smooth-scroll library); anchor links glide via CSS
`scroll-behavior: smooth`, which reduced-motion users get as instant jumps.

## Homepage design system

Pages: `/` (custom software for any business), `/restaurants/` (restaurant tools and
restaurant software), `/blog/` and `404.html`.

`/` and `/restaurants/` share `css/site.css` (plain CSS, tokens on `:root`). The blog
and 404 use `blog/blog.css`, which repeats the same tokens. Use only those tokens.

| Token group | Values |
|---|---|
| Fonts | Bricolage Grotesque (headings), Geist (text). Self-hosted in `/fonts`, declared in `css/fonts.css` |
| Colour | `--paper #F6F3EE`, `--ink #17150F`, `--accent #C2410C` (main button and one key moment per section), neutrals `--ink-2`, `--ink-3`, `--line`, `--paper-2` |
| Spacing | 8, 16, 24, 32, 48, 64, 96, 128 px (`--s-1` to `--s-8`) |
| Grid | 12 columns, 1280px max, 24px gutter |
| Shape | 6px radius on buttons, inputs and the product shot. Everything else is square, separated by 1px lines |
| Motion | Colour changes on hover (180ms) and a 3px arrow nudge. Nothing else moves. Off under `prefers-reduced-motion` |

The dashboard in the hero is HTML with sample data and says so in its caption.
Keep each page's FAQ JSON-LD in `<head>` in sync with its visible FAQ.
Brand: the name is a text wordmark (`.brand-word`, a dotless i with an orange square dot,
styled in `css/site.css` and `blog/blog.css`). The square icon (a plain lowercase u from Bricolage
Grotesque, ink on a paper tile) is `logo.svg`, used for the favicon, the iPhone icon
and the founder note.
Share images: `og-image.jpg` (home) and `og-restaurants.jpg`, rendered from
`brand/og-home.html` and `brand/og-restaurants.html`.

## Fonts

Bricolage Grotesque (headings) and Geist (text) are self-hosted variable fonts:
`css/fonts.css` + `fonts/*.woff2`, mirrored from Google Fonts (latin and
latin-ext subsets only) with the `src` URLs rewritten to local paths. Source CSS:

```
https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..700&family=Geist:wght@400..600&display=swap
```

If you re-mirror, fetch that URL with a current Chrome desktop `User-Agent`
header, or Google serves full TTFs without `unicode-range` splits.

## Social image and icons

WhatsApp, LinkedIn, X and Facebook do not render an SVG `og:image`, so the rasters
are what the pages actually reference. They are derived from the SVGs, which stay
the editable sources:

| File | Size | Source |
|---|---|---|
| `og-image.jpg`, `og-restaurants.jpg` | 1200×630 JPEG | `brand/og-home.html`, `brand/og-restaurants.html` |
| `apple-touch-icon.png` | 180×180, full-bleed square (iOS applies its own mask) | `logo.svg` |
| `favicon.ico` | 32×32 + 48×48 (PNG-in-ICO) | `logo.svg` |

If you change the `brand/og-*.html` files or `logo.svg`, re-export the rasters. Any headless
Chromium works: load the SVG in an `<img>` at the target size and screenshot it
(the SVG uses the site fonts, so render it inline in a page that loads `css/fonts.css`). Also update the `og:image:alt` text if the
headline changes.

`404.html` is served by GitHub Pages for every missing URL, so it uses absolute
asset paths (`/css/…`, `/blog/blog.css`) — keep it that way.
