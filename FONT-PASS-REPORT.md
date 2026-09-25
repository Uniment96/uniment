# Font Pass Report — Self-hosted Space Grotesk

Branch: `perf/fonts` (from the `perf/pass-b` tip). Two commits:
`6471e64` (assets + `css/fonts.css`), `dca4d78` (HTML wiring + README + this
report). No JS was touched anywhere in this pass.

---

## ⚠️ D7 DISCLOSURE — there is no weight-800 face, and there never was

The production URL requests `wght@400;600;700;800` and returns HTTP 200, but
the returned CSS **declares only weights 400, 600, and 700** (9 `@font-face`
blocks = 3 weights × 3 subsets). Google silently drops the 800 variant —
Space Grotesk's weight range tops out at 700.

That means every `font-weight: 800` rule on this site (hero headline
`.hero-h1`, `.brand`, blog `800` rules) **already renders via the 700 face in
production today** via CSS font-matching (no 800 face → closest below is
700; browsers do not synthesize bold when a heavier real face isn't
declared… synthesis only kicks in with no bold face at all — 700 satisfies
it). The mirror reproduces this reality exactly: no 800 `@font-face` was
invented, no `font-weight` style was edited. QA item (b) follows: the hero
must look identical to production **because production is the same 700
face**.

A second discovery in the same response: Google serves **one woff2 file per
subset, shared by all three weight declarations** (the per-subset variable
file), not one file per weight × subset. So there are 3 files, not 12 — and
production's homepage downloads exactly one font file (latin) for the entire
page. The mirror preserves that: the same local file is referenced by all
three weights of its subset. Because no per-weight file exists, D2's
`space-grotesk-{weight}-{subset}.woff2` naming template collapses to
`space-grotesk-{subset}.woff2` — the only truthful naming; anything else
would either duplicate bytes 3× or imply weight-specific files that Google
never served (and per-weight copies would have tripled font downloads on
multi-weight pages, a behavioral regression).

---

## Per-decision changes

### D1 — Fetched the exact production CSS URL with a Chrome desktop UA
`https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&display=swap`
fetched 2026-07-15 with UA `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)
AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36`.
Response: HTTP 200, `text/css`, 9 `@font-face` blocks, per-subset
`unicode-range` splits, woff2 sources — the subset behavior real users get
(a UA-less fetch returns unsplit TTFs; documented in README).

### D2 — Mirrored every referenced woff2 under /fonts/
All 3 referenced files downloaded from `fonts.gstatic.com/s/spacegrotesk/v22/`
and committed byte-for-byte (`wOF2` magic verified). No re-subsetting, no
font tools, no version substitution — v22 bytes as served. Naming per the
disclosure above.

### D3 — css/fonts.css: verbatim mirror
The 9 blocks are byte-identical to Google's response except the `src` URLs
(machine-diff proof below). Same `unicode-range` values, `font-display:
swap` in all 9 blocks, same block order, same subset comments. Linked at the
exact position the Google CSS `<link>` occupied — after the JSON-LD script
block, ahead of `/css/tailwind.css`.

### D4 — Google link + both preconnects removed
`fonts.googleapis.com` and `fonts.gstatic.com` preconnects deleted on all
three pages; nothing added in their place (same-origin needs no preconnect).

### D5 — Exactly one preload, with crossorigin
Hero headline verified from source, not assumed: `.hero-h1 { font-weight:
800; … }` applied to the single `<h1>`. Weight 800 resolves to the
700-declared latin face (D7), whose file is the shared
`/fonts/space-grotesk-latin.woff2` — so the one preload is:

```html
<link rel="preload" href="/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
```

`crossorigin` is present because font fetches are always anonymous-CORS-mode;
without it the preload wouldn't match and the file would be fetched twice.
**Single-fetch verified** (below): exactly 1 request for the file on a full
homepage load.

### D6 — Blog inventory and migration
Repo-wide `*.html` inventory found Google Fonts in exactly two blog pages
(`blog/index.html`, `blog/restaurant-kpi-dashboard-weekly-numbers/index.html`),
each with the two preconnects + a CSS link requesting `wght@300;400;500;600;700;800`.
Both migrated to the single absolute `/css/fonts.css` line — the only blog
edit (diff proof below); content, body markup, and `blog.css` untouched.

Weights 300/500 note: the blog URL requested them, but **no blog rule uses
them** — `blog.css` uses only 600/700/800 explicitly (plus default 400 body
text and `<strong>`→700); zero `font-weight` styles in the blog HTML. The
300/500 faces were dead weight in production (declared, never downloaded,
never rendered), so the 4-weight mirror renders identically.

### Guardrails
No JS edits (the pass diff touches only `<head>` link lines, README, docs,
and new binary/CSS assets), no build step, no package.json, no libraries.
README gained the required "Fonts" section: source URL, the UA-header
requirement, mirror date 2026-07-15, and the version-pinning policy
(`spacegrotesk/v22` frozen by commit; Google-side updates intentionally no
longer flow in — same policy as the `@latest` elimination).

---

## Verification

### 1. Grep proof — zero functional references

```
$ grep -rn "fonts.googleapis.com\|fonts.gstatic.com" --include="*.html" --include="*.css" --include="*.js" .
(zero hits)
```

Full-repo grep matches only documentation: `README.md` (the required
re-mirroring instructions) and `PASS-A-REPORT.md` (pre-existing historical
record). No HTML, CSS, or JS references remain.

### 2. File table

| File | Bytes |
|---|---|
| `fonts/space-grotesk-latin.woff2` | 22,320 |
| `fonts/space-grotesk-latin-ext.woff2` | 18,924 |
| `fonts/space-grotesk-vietnamese.woff2` | 6,772 |
| `css/fonts.css` | 3,438 raw / 465 gzip |

(woff2 is pre-compressed; raw sizes only, per spec.)

### 3. @font-face parity

```
$ diff <(sed 's|url([^)]*)|url(X)|' css/fonts.css) \
       <(sed 's|url([^)]*)|url(X)|' google-response.css)
(empty — identical)
```

With `src` URLs normalized out, the mirror is byte-identical to Google's
response. `font-display: swap` count: **9 of 9 blocks**.

### 4. Head before/after

Before (homepage):
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&display=swap" rel="stylesheet">
```
After (same position, still ahead of `/css/tailwind.css`):
```html
<link rel="preload" href="/fonts/space-grotesk-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/fonts.css">
```
Blog pages: the three Google lines → one `<link rel="stylesheet" href="/css/fonts.css">`.

Headless-Chromium load of the homepage confirms the **only cross-origin
request is deferred Plausible** (`plausible.io`); the blog pages likewise.

### 5. Subset behavior preserved + single-fetch preload

Runtime (headless Chromium, homepage): woff2 requests =
`{"space-grotesk-latin.woff2": 1}` — the latin file downloaded **exactly
once** (preload consumed by the stylesheet's request — no double fetch), and
the latin-ext/vietnamese files were **not** fetched on this latin-only page,
exactly as production behaves (their faces sit "unloaded" in
`document.fonts`). `unicode-range` values are verbatim (see parity diff), so
this holds for any content: browsers fetch only the subsets a page's
characters require. `document.fonts.check('800 …')` → true via the loaded
700 face. Zero console errors. Same results on `blog/index.html`.

Related detail preserved automatically: the hero's "→" (U+2192) is **not**
in the latin `unicode-range` (Google includes U+2191/U+2193 but not U+2192),
so that glyph renders from the fallback font in production — and continues
to, since the ranges are unchanged (QA item c).

### 6. Diff stat — blog touched only on the font lines

```
README.md                              | 24 +++++
blog/index.html                        |  4 +-
blog/restaurant-…-numbers/index.html   |  4 +-
css/fonts.css                          | 81 ++++++++++
fonts/space-grotesk-latin-ext.woff2    | Bin 0 -> 18924 bytes
fonts/space-grotesk-latin.woff2        | Bin 0 -> 22320 bytes
fonts/space-grotesk-vietnamese.woff2   | Bin 0 -> 6772 bytes
index.html                             |  7 +-
```

Each blog file's entire diff: −3 Google lines, +1 `/css/fonts.css` line.
`blog.css` and all blog content: zero changes. `index.html`'s 7-line delta is
the head swap only.

---

## HUMAN QA CHECKLIST

- [ ] **a. Hard reload, Fast 3G, cache disabled** — text paints in the
  fallback stack then swaps (`font-display: swap` unchanged); the flash is no
  worse than production (same-origin should make it shorter). In the Network
  panel each woff2 appears **once** — if `space-grotesk-latin.woff2` shows
  twice, the preload/crossorigin pairing has been broken.
- [ ] **b. Weight sweep vs production** — hero (`font-weight: 800`), section
  headings (700), buttons/chips (600), body (400). No synthesized bold, no
  weight shifts. Per the D7 disclosure the hero must look **identical** to
  production: both render the 700 face.
- [ ] **c. Hero "Get early access →"** — the arrow glyph renders exactly as
  production (fallback-font glyph; U+2192 is outside the mirrored
  unicode-ranges, same as before). Letterforms and spacing of the button text
  unchanged.
- [ ] **d. Blog pages** — typography unchanged on `/blog/` and the article
  page; Network panel shows zero requests to fonts.googleapis.com /
  fonts.gstatic.com anywhere.
- [ ] **e. Subset downloads** — DevTools Network on the homepage: only
  `space-grotesk-latin.woff2` downloads (production downloads only the latin
  file today, one file for all weights). latin-ext/vietnamese fetch only if
  matching characters appear.
- [ ] **f. Serve config** — confirm the production host serves `.woff2` with
  a long-cache header (immutable is safe: filenames are content-stable by
  commit) and that `/fonts/` + `/css/fonts.css` deploy with GitHub Pages as
  expected.
