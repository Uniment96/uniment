# Lenis Removal Report — Native Scroll

Branch: `ux/native-scroll`, cut from `perf/fonts` at `4f59019` (verified tip +
clean tree before branching). Two commits: `7c2c615` (removal + rewiring),
plus the anchor-CSS/README/report commit. This supersedes Pass B's D8
(Lenis exemption) by owner decision. Only the scroll feel changed — reveals,
parallax, progress bar, drawer lock, and anchor landing positions are
preserved and verified. `blog/` untouched (it never loaded Lenis).

---

## Per-decision changes

### D1 — Fully native input, no replacement smoothing
The vendor file (`js/vendor/lenis-1.3.25.min.js`), its `<script defer>` tag,
and the init + permanent rAF driver loop are deleted. No library, no JS
interpolation, nothing added in their place. Wheel, trackpad, keyboard,
and scrollbar-drag all hit the browser's own scroller now. (Touch always
did — the old config was `smoothWheel: true, smoothTouch: false`.)

### D2 — CSS-only anchor glide + disclosures
`html { scroll-behavior: smooth }` is now wrapped in
`@media (prefers-reduced-motion: no-preference)`; reduced-motion users get
instant jumps (verified: computed `scroll-behavior` = `auto` under
reduced-motion emulation).

**Disclosure 1 (supersedes the expected touch disclosure):** today's touch
anchors do NOT hard-jump. The rule already existed *unconditionally* in
production, and Lenis was never wired to anchors (no `anchors: true`, zero
`lenis.scrollTo()` call sites — see table). Anchors on every device already
glided via CSS, so D2 changes nothing for default-motion users on any device.

**Disclosure 2:** because the old rule was unconditional, reduced-motion
users *today* get CSS glides on anchor clicks. After this pass they get
instant jumps. That is the one deliberate behavior change of D2, per its own
spec ("Reduced-motion users get instant jumps"), and it is strictly more
reduced-motion-correct than production.

### D3 — Anchor landing parity
`lenis.scrollTo()` call-site inventory: **zero call sites exist.** All
anchors are plain `href="#…"` links resolved by the browser; no offsets, no
fixed-header compensation, no `scroll-padding`/`scroll-margin` anywhere in
production CSS — so there is nothing to replicate and landing math is
untouched. Verified per target (instant-jump mode, landed scrollY minus
element top): `#features` 0, `#products` 0, `#testimonials` 0, `#how` 0,
`#team` 0, `#faq` 0, `#notify` 0. Same DOM, same CSS ⇒ same offsets as
production. (The header is not `position: fixed` over content at landing —
targets land at element top exactly as they do today.)

### D4 — Mobile drawer: untouched
It never used `lenis.stop()/start()`. It already locks with
`document.body.style.overflow = open ? "hidden" : ""` and restores scroll
position natively on unlock. Per the decision ("If it already uses overflow
locking, touch nothing"): zero changes.

### D5 — Scroll-hook rewiring (call-site table)

| Former Lenis reference | Replacement |
|---|---|
| `<script defer src="/js/vendor/lenis-1.3.25.min.js">` + comment | deleted; feature (smooth wheel) intentionally removed (D1) |
| `let lenis = null; if (!prefersReduced && window.Lenis) { new Lenis({duration 1.08, easing, smoothWheel, smoothTouch:false}) }` | deleted (D1) |
| `function raf(time){ lenis.raf(time); requestAnimationFrame(raf) }` — the permanent driver loop | deleted; no rAF replacement of any kind |
| `getScroll = () => (lenis ? lenis.scroll : window.scrollY)` (parallax) | `getScroll = () => window.scrollY` |
| `if (lenis) lenis.on("scroll", applyBg)` (parallax hook) | deleted; the pre-existing native `window.addEventListener("scroll", applyBg, {passive:true})` on the next line takes over alone |
| `lenis.velocity` read in the bg3d canvas z-speed kick | per-frame native delta: `Math.abs(scrollY − lastFrameScrollY)`, same `* 0.02` factor, same `1.2` cap — identical semantics (`lenis.velocity` was also a per-frame px delta) |
| Scroll progress bar | no change needed — already native (`window.scrollY` + passive scroll listener) |
| Reveals / counters / word reveal | no change needed — IntersectionObserver, never Lenis-coupled |
| Lenis CSS (`html.lenis`, `.lenis-smooth`, `scroll-behavior: auto !important`) | none existed in the stylesheet — grep-verified before and after; nothing orphaned, D2's rule is unopposed |

---

## Verification

### 1. Grep proof
`grep -rni lenis` across `*.html`, `*.css`, `*.js`: **0 hits** (vendor file
deleted, all 11 inline references removed). Repo-wide, the string survives
only in historical documentation (`PASS-B-REPORT.md`, `FONT-PASS-REPORT.md`,
`README.md`'s new "no smooth-scroll library" note, and this report).

### 2. Payload delta

| Asset | Before | After | Δ |
|---|---|---|---|
| Deferred JS (`lenis-1.3.25.min.js`) | 18,429 raw / 5,343 gzip | 0 | **−18,429 raw / −5,343 gzip** (matches expected exactly) |
| `index.html` | 157,716 raw / 32,109 gzip | 157,428 raw / 32,071 gzip | −288 raw / −38 gzip |

### 3. rAF inventory — ZERO permanent loops remain
This supersedes the inventory in `PASS-B-REPORT.md`, which listed the Lenis
driver as the one exempt always-on loop. That exemption is gone. Every
surviving `requestAnimationFrame` site:

| Site | Class | Stops when |
|---|---|---|
| Cursor glow `tick` | idle-stopping | converged < 0.1px (restarts on mousemove) |
| Cursor ring `cTick` | idle-stopping | converged < 0.1px (restarts on mousemove) |
| bg3d canvas `frame` | visibility-gated | `document.hidden` (cancel + in-frame gate) |
| Data-flow canvas `frame` | IO-gated | section leaves viewport |
| KPI intro `animate` | IO-gated + terminating | off-screen (pause) / `progress ≥ 1` (done) |
| KPI `requestRedraw` | one-shot | self-terminates after one frame |
| Counter `run` | one-shot | `p ≥ 1` after 1.7s |

At idle with the tab hidden, **no rAF is scheduled anywhere**. At idle with
the hero visible, only bg3d (by design, until hidden) and tsParticles'
internal loop run. tsParticles remains the one vendor-internal loop
(viewport-paused per the Pass B D6 setting).

### 4. Call-site table
See D5 above — every former reference mapped to its replacement or deletion.

### 5. Anchor parity
Per-target landing deltas all 0 (table in D3). Mechanism unchanged
(native anchor + CSS smooth), so positions are geometry-identical to
production by construction as well as by measurement.

### Runtime smoke (headless Chromium, served site)
Zero console errors on load, scroll, all 7 anchor clicks, and drawer-less
navigation — specifically no `lenis is not defined`. Progress bar and
parallax tracked a native programmatic scroll (bar 0% → 5.87%, bg
translateY 0 → 18.68px at the same position). Reduced-motion emulation:
instant jumps, all targets exact. Note: anchor *glide smoothness* itself
can't be judged in headless (no compositor vsync) — that's QA item (b).

### Grep-count attribution
- `prefersReduced`: 15 → **14**. The one lost reference was the deleted init
  guard `if (!prefersReduced && window.Lenis)` — Lenis-internal, per
  guardrail. All 14 surviving branches intact.
- `isTouchDevice`: 5 → **5** (no Lenis code referenced it).

---

## HUMAN QA CHECKLIST

- [ ] **a. Native input** — wheel scroll has zero easing lag; PgDn / space /
  arrows / Home / End and scrollbar drag all behave like a plain page.
- [ ] **b. Anchors** — every nav link (Features, Products, Testimonials,
  How it works, Team, FAQ, both "notify" CTAs, and the logo's `href="#"`
  back-to-top): smooth glide, landing position identical to production
  against the header. Compare a couple of targets side-by-side with prod.
- [ ] **c. Reduced-motion emulation** — anchor clicks jump instantly
  (intentional change, see D2 disclosure 2); everything else unchanged.
- [ ] **d. Scroll-driven features** — progress bar tracks accurately during
  fast wheel AND scrollbar drag; parallax unchanged; reveals fire at the
  same scroll positions; bg3d points still get their speed kick during fast
  scrolling (now from native scroll deltas).
- [ ] **e. Mobile drawer** — body locks while open, unlocks without a scroll
  jump, nav links still close it and then glide to their target.
- [ ] **f. Idle test (stricter than Pass B)** — mouse still 10s, any scroll
  position, then check the Performance panel: with the hero off-screen and
  tab visible, the only rAF should be bg3d; hide the tab: ZERO rAF anywhere.
  Lenis's permanent-loop exemption no longer exists.
- [ ] **g. Console** — zero errors anywhere, especially on nav clicks and
  drawer toggles (no `lenis is not defined`).
