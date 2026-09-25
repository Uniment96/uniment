# Pass A Report — uniment.ae arrival fixes (Findings 1, 2, 3, 4, 8, 9)

Branch: `perf/pass-a` — 5 commits, one per fix, plus this report.
Findings 5, 6, 7 (animation loops, compositing) were **not touched** — they are Pass B.

> Note: `PERF-AUDIT.md` was not present in the repo; the finding numbers below follow
> the audit delivered in conversation (2026-07-14), which this pass implements.

## What changed, per finding

### Finding 1 — Loader hold removed (commit `613ba35`)
- Deleted the `window.load` + 1,350–1,450 ms artificial hold. The loader now hides on
  **DOMContentLoaded**, with a **1,000 ms absolute fallback** `setTimeout` registered at
  parse time (kept outside the DOMContentLoaded wrapper added in Fix 4, so it fires even
  if the event is missed). `hide()` is idempotent.
- Fade cut from 700 ms → **300 ms**; the `loader.remove()` cleanup timer cut 800 ms → 400 ms.
- Hero/entrance animations (`.w-reveal`, scroll reveals) were never keyed to loader
  removal — they fire ~150 ms after script execution — so no rewiring was needed. Same
  animations, now actually visible as the loader fades instead of finishing behind it.

### Finding 2 — Tailwind Play CDN → committed build-time CSS (commit `cf6b06b`)
- `cdn.tailwindcss.com` (123 KB compressed / 407 KB parsed, render-blocking runtime
  compiler) replaced by `css/tailwind.css`: **18,091 B raw / 4,207 B gzip** — well under
  the 30 KB gzip budget.
- Built with the **Tailwind v3.4.17 standalone CLI** (v3 to match Play CDN utility
  behavior). No `package.json`, no `node_modules`; the binary is not committed.
- Build inputs are committed so regeneration is reproducible: `tailwind.config.js`
  (content: `index.html`; safelist: `hidden` — the only Tailwind utility applied from
  inline JS) and `tailwind.input.css`. README section "Regenerating tailwind.css" added
  with the exact command.
- The `<link>` sits at the exact position the CDN `<script>` occupied, preserving
  cascade order ahead of the page's own `<style>` block.
- **Parity proof:** all 263 unique class tokens in `index.html` resolve — each exists in
  the built CSS or in the page's inline `<style>` (0 missing). JS-toggled classes
  (`reveal`, `in`, `preserve-3d`, `out`, `hovered`, `clicked`, `go`, `hidden`) audited;
  only `hidden` is a Tailwind utility and it is both safelisted and present in markup.

### Finding 3 — Lucide icons inlined (commit `c873604`)
- All **34 placeholder instances (22 unique icons)** replaced with inline SVG sourced
  from **lucide-static@1.24.0** — the exact version the live `unpkg.com/lucide@latest`
  302 redirect resolves to.
- Each SVG carries the identical attribute set `createIcons()` produced: default lucide
  attributes (`width/height=24`, `viewBox`, `fill=none`, `stroke=currentColor`,
  `stroke-width=2`, round caps/joins), class `lucide lucide-{name}` plus the
  placeholder's own classes, the placeholder's `style` attribute where present
  (the five 11 px badge icons), and `aria-hidden="true"` (all 34 are decorative — every
  icon sits beside visible text).
- unpkg `<script>` tag and `lucide.createIcons()` call removed. Nothing in any
  stylesheet targeted `.lucide-*` classes, so class fidelity is cosmetic-safe.

### Findings 4 + 8 — tsparticles slim + lenis self-hosted, pinned, deferred (commit `9d0901c`)
- `cdn.jsdelivr.net/npm/lenis@latest` → `/js/vendor/lenis-1.3.25.min.js` (pinned to the
  version `@latest` resolves to today).
- `cdn.jsdelivr.net/npm/tsparticles@3` (full bundle) → `/js/vendor/tsparticles.slim-3.9.1.bundle.min.js`
  (pinned to the same 3.9.1 the `@3` tag resolves to today). **Slim coverage verified
  before swapping:** the bundle contains the circle shape, links plugin, hover-repulse
  and click-push interactors — everything the config at the tsParticles init uses — and
  it sets `window.tsParticles` exactly like the full bundle (grep-verified in both
  bundles), so the existing `tsParticles.load()` call is unchanged.
- Both load with `defer`. The inline init code is wrapped in a `DOMContentLoaded`
  listener (deferred scripts are guaranteed to execute before it fires). The script was
  **not** extracted to a new file. Two consequences handled:
  - the loader block stays outside the wrapper (see Finding 1);
  - `closeMobileMenu` is exported to `window` because ten mobile-drawer `onclick`
    attributes call it and it now lives inside the wrapper scope.
- Inline script re-verified with `node --check`: syntax OK.

### Finding 9 — Font weights trimmed (commit `fcbad1f`)
- Measured usage: **400** (body default), **600** (37× `font-semibold` + 1 CSS decl),
  **700** (46× `font-bold` + 18 CSS decls + 4 `<strong>/<b>` resolving `bolder`→700),
  **800** (29× `font-extrabold` + 9 CSS decls). Canvas `ctx.font` uses `system-ui`, not
  Space Grotesk. **300 and 500 are referenced nowhere** → dropped; no synthesized-bold
  risk. `display=swap` and both preconnects unchanged. New URL returns 200.

## Verification

### Baseline table, recomputed (raw / gzip)

| File | Before | After |
|---|---|---|
| `index.html` | 138,368 / 27,778 B | 151,632 / 30,210 B (+34 inline SVGs) |
| `css/tailwind.css` | — | 18,091 / 4,207 B |
| `js/vendor/lenis-1.3.25.min.js` | — | 18,429 / 5,343 B |
| `js/vendor/tsparticles.slim-3.9.1.bundle.min.js` | — | 152,671 / 42,279 B |
| `blog/index.html` | 5,755 / 1,915 B | unchanged |
| `blog/restaurant-kpi-dashboard-weekly-numbers/index.html` | 11,159 / 3,862 B | unchanged |
| `blog/blog.css` | 6,594 / 1,910 B | unchanged |

### Critical path (compressed, homepage)

| | Before | After |
|---|---|---|
| Render-blocking JS | 274.1 KB (4 scripts, 3 origins) | **0 B** |
| Render-blocking CSS | Google Fonts CSS (0.6 KB) | tailwind.css 4.2 KB (same-origin) + Google Fonts CSS 0.6 KB |
| Artificial delay after load | 1,350–1,450 ms + 700 ms fade | **0 ms** (reveal at DOMContentLoaded, 300 ms fade) |
| Deferred JS | 1.3 KB (Plausible) | 48.9 KB (lenis 5.3 + tsparticles slim 42.3 + Plausible 1.3) |
| JS parse weight (all scripts) | ~1,020 KB | ~171 KB, all deferred |

### `<head>` resources, before → after

Before: fonts preconnect ×2 → fonts CSS (6 weights) → **blocking** `cdn.tailwindcss.com` →
**blocking** `unpkg.com/lucide@latest` → deferred Plausible → **blocking**
`jsdelivr lenis@latest` → **blocking** `jsdelivr tsparticles@3` → inline `<style>`.

After: fonts preconnect ×2 → fonts CSS (4 weights) → `<link /css/tailwind.css>` →
deferred Plausible → deferred `/js/vendor/lenis-1.3.25.min.js` → deferred
`/js/vendor/tsparticles.slim-3.9.1.bundle.min.js` → inline `<style>`.

**Zero render-blocking `<script>` tags remain anywhere in the document** (the only
`<script src>` tags are the three deferred ones above; the sole inline script sits at
the end of `<body>`).

### Remaining external origins, and why they stay
- `fonts.googleapis.com` / `fonts.gstatic.com` — Space Grotesk (D3 visual parity;
  self-hosting fonts was not in scope for this pass). Preconnected, `display=swap`.
- `plausible.io` — analytics, business requirement, already `defer`, 1.3 KB.

### Grep proofs (repo-wide, zero hits)
- `cdn.tailwindcss.com` → 0
- `unpkg` → 0
- `@latest` → 0
- `cdn.jsdelivr` → 0

### Guardrail checks
- Blog pages byte-identical (`git diff main` touches no `blog/` file).
- Formspree handler unchanged (diff-verified).
- `prefersReduced` references: 15 → 15; `isTouchDevice`: 5 → 5 (all branches intact).
- No `package.json` / `node_modules` / bundler added; no major-version upgrades
  (lenis and tsparticles pinned to today's live-resolved versions; Tailwind output
  generated by v3.4.x matching the v3 Play CDN).

## HUMAN QA CHECKLIST

Serve locally from the repo root (paths are absolute, e.g. `python3 -m http.server`)
or use a preview deploy — `file://` will not resolve `/css/...` and `/js/...`.

1. **Hard reload with DevTools → Network → "Fast 3G" + Disable cache.** The loader
   should fade at DOMContentLoaded — hero headline readable **well under 1.5 s**; no
   flash of unstyled (Tailwind-less) content at any throttle.
2. **Icons pixel-identical**: hero "Get early access →" arrow; the three w-3.5 chips
   (Secure/Actionable/Real-time); all icon badges; the five tiny 11 px "Verified Use
   Case" shields; footer mail/message/phone. Check color inheritance (indigo/emerald/
   orange tints) and hover states.
3. **Particles**: hero canvas shows drifting linked particles; hover repulses; click
   adds particles. Console shows no tsParticles version/plugin errors.
4. **Smooth scroll**: Lenis easing feels identical on wheel; scroll progress bar and
   background parallax still track.
5. **Mobile layout** (responsive mode, coarse pointer): hamburger opens/closes the
   drawer, nav links close it (this exercises the new `window.closeMobileMenu`), body
   scroll locks while open; custom cursor absent; hero particles reduced count.
6. **Form submit** (Formspree): success and error paths still toggle the
   hidden/visible messages — exercises the safelisted `hidden` utility.
7. **Typography sweep**: compare hero (800), section headings (700/800), buttons and
   chips (600), body text (400) against production — no synthesized/faux bold anywhere.
8. **prefers-reduced-motion**: with "Emulate CSS prefers-reduced-motion", loader still
   clears, content reveals without animation, no particles/canvas motion.
9. **Blog pages**: `/blog/` and the KPI post render exactly as before (they were not
   touched).
