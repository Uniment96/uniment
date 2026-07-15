# Pass B Report — Runtime Feel (Findings 5, 6, 7)

Branch: `perf/pass-b` (contains `perf/pass-a`'s commits; local `main` did not yet
carry the Pass A merge, so the branch was cut from the `perf/pass-a` tip).
Scope: `index.html` only. `blog/` untouched (verified below). Pass A's loading
strategy was not revisited.

**Principle held:** nothing looks different. No blur value, layer count, point
count, resolution, speed, easing, or lerp constant changed. The only deltas are
work stopping when it cannot be seen or is not needed, plus the one explicitly
approved config addition in D6.

---

## Per-decision changes

### D1 — Pointer-follow loops become idle-stopping (F5a, F5e)
Commit `751f5b7`. Cursor glow (`index.html:2147`) and cursor ring/dot
(`index.html:2732`) each keep a single in-flight rAF handle (`glowRaf` /
`ringRaf`, `null` = idle). Each tick applies the same 0.12 / 0.13 lerp as
before; when `|target − current| < 0.1px` on both axes, the position snaps to
the target and no next frame is scheduled. `mousemove` restarts the loop only
when the handle is `null` (double-start guard: a new rAF is requested only from
the idle state, so there is never more than one in flight and nothing to
cancel). Initial paint happens once via a direct `tick()` call, then idle.

### D2 — Section canvases viewport-gated (F5c, F5d)
Commits `a433230` (data-flow) and `64fa14e` (KPI). Both canvases now run only
while intersecting:
- **Data-flow canvas** (`index.html:2379`): previously an unconditional rAF
  loop from page load. An IntersectionObserver sets `flowVisible`; the frame
  loop reschedules only while `flowVisible`, and the observer cancels the
  pending rAF on exit / restarts on entry (guarded by `flowRaf === null`).
- **KPI chart** (`index.html:2558`): the intro animation starts on first
  intersection (threshold 0.3, as before), pauses via `cancelAnimationFrame`
  if the section leaves the viewport mid-intro, and resumes from the same
  `progress` on re-entry — never replayed from zero.

### D3 — KPI chart: no free-running loop after intro (F5d)
Commit `64fa14e`. Production ran an unconditional `drawFrame` loop forever
after the intro (it existed to service hover tooltips). Now the intro's last
frame sets `kpiRaf = null` and paints the final state. All later repaints are
event-driven through a coalescing `requestRedraw()` (one one-shot rAF at a
time, no-op while the intro loop is active or a redraw is already pending):
- `mousemove` / `mouseleave` / `touchmove` / `touchend` on the canvas
  (tooltips work exactly as before — same hit radius, same drawing),
- `resize` while visible (a resize clears the canvas bitmap, so this repaint
  restores what the free-running loop used to restore),
- viewport re-entry (covers a resize that happened off-screen). Re-entry after
  the intro repaints once from `progress = 1`; the intro is not replayed.

### D4 — Background O(N²) canvas → spatial hash grid + hidden-tab stop (F5b)
Commit `1fc0f17` (`index.html:2186`). Kept: N = 120 points, DPR clamp
`min(2, devicePixelRatio)`, per-rAF frame rate, all speeds/colors/sizes, and
the touch-device skip (byte-identical, first line of the IIFE). Replaced: the
all-pairs `j = i+1..N` distance scan (7,140 pair checks/frame) with a spatial
hash of `linkDist`-sized cells queried over the 3×3 neighborhood (~360
candidate visits/frame, ~20× less math).

Exactness: the original loop compared point *i*'s **this-frame** position
against partner *j*'s **last-frame** position (partners `j > i` are updated
later in the same pass). The grid is therefore built from start-of-frame
positions, points are updated in index order, and partners are restricted to
`j > i` — same pair set, same gate order (`dz ≤ 280`, then `dist ≤ 170`), same
alpha math. **Verified bit-exact in Node**: 300 seeded frames, 18,458 links,
every endpoint and alpha identical to the nested-loop implementation, point
state identical every frame (`scratchpad/grid-equiv.js`). Link draw order
within a frame can differ, but all links share one RGB, and same-color
source-over strokes commute — final pixels identical.

The loop also now fully stops on `document.hidden` (rAF cancelled, handle
nulled) and resumes on visibility. Restart is guarded by `bgLoop` (set true
only when the loop legitimately started, i.e. never under reduced motion) and
`bgRaf === null`.

### D5 — Scanlines: compositor-only transform animation (F7)
Commit `b75502f` (`index.html:484`). The 6px repeating gradient moved from the
`.scanlines` element's animated `background-position` (a per-frame paint of a
full-viewport `mix-blend-mode: overlay` layer, forcing continuous re-blending
against the backdrop-filter substrate) to an oversized `::before`
(`top: -240px; height: max(200%, calc(100% + 240px))`) animated with
`transform: translateY(0 → 240px)`, same `12s linear infinite`. No HTML
change was needed (the wrapper allowance went unused). `opacity: .14` and
`mix-blend-mode: overlay` remain on the container, so the group still blends
with the page backdrop with identical compositing math (the container's
opacity already created the isolating stacking context before and after).
The −240px offset is a multiple of the 6px period, so the phase matches the
old animation at every point of the cycle. The reduced-motion rule now also
targets `.scanlines::before` (`index.html:642`), preserving the freeze
behavior.

**Side-by-side verification** (headless Chromium 149, old CSS vs new CSS,
paused at cycle offsets 0s / 3s / 5.05s / 11.5s, two backdrops including a
black→white ramp; `scratchpad/scan-diff.js`, `scan-truth.js`, `scan-final.js`):
- At production opacity values: **byte-identical screenshots at every
  offset** (0 differing bytes of 4,096,000).
- At 36× amplified opacity (test-only, to defeat 8-bit quantization): pixels
  identical everywhere except inside a band that is production's own
  rendering artifact — `background-position` wraps its gradient tile at the
  element's height, which is not a multiple of the 6px period, so production
  shows a phase slip of `height mod 6` px above a seam that moves down the
  screen each cycle. The seamless texture doesn't reproduce that glitch. At
  production amplitude the entire effect is < 1/255 per channel, hence the
  byte-identical captures. Disclosed here rather than improvised around.

### D6 — tsParticles: explicit `pauseOnOutsideViewport`, fpsLimit (F5f)
Commit `0d8147a` (`index.html:2333`). `pauseOnOutsideViewport: true` added at
the root of the options. The slim 3.9.1 bundle honors it — verified by
inspection of the vendor file: the option has a loader
(`this.pauseOnOutsideViewport = t.pauseOnOutsideViewport`), a default of
`true`, and an IntersectionObserver handler that calls `this.play()` /
`this.pause()` on the container — so no manual IO-gating fallback was needed.
`fpsLimit` was **already explicit** in production (`isTouchDevice ? 30 : 60`);
desktop is 60 as the decision requires, and the touch value was left at 30 to
preserve the touch branch exactly. Hover-repulse and click-push configs
untouched.

### D7 — Cursor + ring via `transform: translate3d()` (F6)
Commit `fb4928a`. `ring.style.left/top` and `dot.style.left/top` mutations
(per-frame layout invalidation) replaced with
`transform: translate3d(x, y, 0) translate(-50%, -50%)` — the trailing
translate preserves the original centering exactly. Same lerp constant (0.13),
same event flow, same touch/`hover: hover` removal branches.

### D8 — Lenis rAF loop untouched
As locked: the Lenis driver loop (`index.html:2093-2097`) still runs
unconditionally. Its idle cost is negligible and gating it risks breaking
smooth scroll. No change made.

### F7 blur surfaces — untouched
No change to any of the 26 `backdrop-filter` surfaces or the blurred orbs: no
blur radii, no layer count, no z-order. With the loops above idling and the
scanlines compositor-only, the substrate beneath them goes static, so blur
re-evaluation stops on its own. Nothing in profiling required escalation.

---

## Loop inventory

| Loop | Start trigger | Stop trigger | Idle behavior |
|---|---|---|---|
| Lenis driver (`:2093`) | page load | never (D8, locked) | n/a — always runs |
| Cursor glow (`:2153`) | `mousemove` when `glowRaf === null` (+ one initial `tick()`) | converged: both axes < 0.1px → snap, no reschedule | no rAF scheduled; `glowRaf === null` |
| bg3d network (`:2186`) | page load if `!prefersReduced` (skipped entirely on touch) | `document.hidden` → in-frame gate + `cancelAnimationFrame`; resumes on visible | no rAF scheduled; `bgRaf === null` |
| tsParticles (`:2333`) | library init | library-internal IO pauses container when hero fully off-screen (`pauseOnOutsideViewport: true`) | container paused by bundle |
| Data-flow canvas (`:2379`) | IO enter when `flowRaf === null` | IO exit → `cancelAnimationFrame`; in-frame `flowVisible` gate | no rAF scheduled; `flowRaf === null` |
| KPI intro (`:2558`) | first IO enter (`started` flag); IO re-enter resumes if `progress < 1` | `progress ≥ 1` → final frame, `kpiRaf = null`; IO exit → `cancelAnimationFrame` | no rAF scheduled; `kpiRaf === null` |
| KPI redraw (one-shot) | canvas mouse/touch events, resize-while-visible, viewport re-entry | self-terminating after one frame | no rAF scheduled; `kpiRedraw === null` |
| Cursor ring/dot (`:2732`) | `mousemove` when `ringRaf === null` (+ one initial `cTick()`) | converged: both axes < 0.1px → snap, no reschedule | no rAF scheduled; `ringRaf === null` |
| Counter intro (`:2779`) | IO enter (once per element, pre-existing) | `p ≥ 1` after 1.7s (self-terminating, pre-existing) | no rAF scheduled |
| Word/char reveals, scanner, orbs | CSS animations (pre-existing, not in Findings 5–7) | — | compositor-managed |

## Grep proof — every rAF call site paired with a stop path

`grep -n "requestAnimationFrame\|cancelAnimationFrame" index.html` (post-change):

```
2095/2097   Lenis driver                        — exempt (D8)
2159/2165   glow tick/start                     — stop: convergence (no reschedule); start guarded by glowRaf === null
2318        bg3d in-frame reschedule            — gated on !document.hidden, else null
2324        bg3d cancelAnimationFrame           — on visibilitychange → hidden
2326/2330   bg3d resume/initial start           — resume guarded by bgLoop && bgRaf === null
2540/2548   data-flow in-frame/IO-resume        — in-frame gated on flowVisible; resume guarded by flowRaf === null
2550        data-flow cancelAnimationFrame      — on IO exit
2593        KPI one-shot redraw                 — self-terminating (nulls kpiRedraw in its own callback)
2695        KPI intro reschedule                — stops at progress ≥ 1 (kpiRaf = null)
2709        KPI intro cancelAnimationFrame      — on IO exit
2746/2754   ring tick/start                     — stop: convergence; start guarded by ringRaf === null
2794/2796   counter intro (pre-existing)        — self-terminating at p ≥ 1
```

tsParticles' internal rAF lives in the vendor bundle (exempt; gated by its own
`pauseOnOutsideViewport` observer).

## Parity disclosure — constants touched

| Constant | Before | After |
|---|---|---|
| bg3d point count N | 120 | 120 |
| bg3d linkDist / dz gate / alpha factor | 170 / 280 / 0.16 | 170 / 280 / 0.16 |
| bg3d baseSpeed / velocity kick / DPR clamp | 0.55 / 0.02·min 1.2 / min(2, dpr) | same |
| Glow lerp / ring lerp | 0.12 / 0.13 | 0.12 / 0.13 |
| Idle-stop epsilon | n/a (loops never stopped) | 0.1px (below sub-pixel rendering; snap lands exactly on target, no drift) |
| Cursor offsets/centering | translate(-50%,-50%) via left/top | translate(-50%,-50%) via translate3d |
| KPI intro step / IO threshold | +0.02/frame / 0.3 | +0.02/frame / 0.3 |
| Scanline opacity / alpha / period / travel / duration / blend | .14 / .04 / 6px / 240px / 12s linear / overlay | identical |
| Blur radii, backdrop-filter surfaces, orbs | — | untouched |
| tsParticles fpsLimit | 60 desktop / 30 touch (already explicit) | unchanged |
| tsParticles pauseOnOutsideViewport | absent (bundle default `true`) | `true` explicit — **approved D6 delta** |

The two approved D6 deltas are the only config-level changes; `fpsLimit: 60`
(desktop) was already present, so no numeric value changed anywhere.

## Verification

- `node --check` on the extracted inline script: **passes** (only one real
  inline JS script in the page; the other five `<script>` blocks are JSON-LD).
- Grep counts: `prefersReduced` **15** (= before), `isTouchDevice` **5**
  (= before). Reduced-motion and touch branches byte-preserved; the one CSS
  reduced-motion rule gained `.scanlines::before` so the freeze still applies
  to the element that now carries the animation.
- `git diff 4029f64..HEAD --stat` (Pass B only):
  `index.html | 208 ++++++---- (161 insertions, 47 deletions)` — one file.
  `blog/` untouched (zero blog paths in the full branch diff vs `main`).
- Runtime smoke (headless Chromium against the served site): **zero console
  errors**; rAF schedule rate rises during synthetic mouse movement and
  returns to baseline after convergence; KPI re-entry shows no intro ramp.
  (Headless caveats: rAF ran ~20Hz, and tsParticles never creates its canvas
  in headless_shell — verified identical on unmodified `main`, so it is an
  environment artifact, not a regression.)
- D4 equivalence: bit-exact against the O(N²) loop over 300 seeded frames.
- D5 equivalence: byte-identical screenshots at production values across four
  cycle offsets and two backdrops (see D5 section for the amplified-opacity
  seam disclosure).

---

## HUMAN QA CHECKLIST

- [ ] **a. Idle hero, mouse still 10s** — Performance monitor: CPU near-idle;
  Performance panel: no continuous Style/Layout/Paint from the page's own
  loops. (Lenis's rAF and the bg3d canvas still tick by design — D8/D4; bg3d
  stops only when the tab is hidden.)
- [ ] **b. Move mouse, then stop** — glow and ring glide in with the same feel,
  settle within ~1s, CPU drops back; zoom in on the ring: it sits exactly
  centered on the last cursor position, no sub-pixel drift or oscillation.
- [ ] **c. Scroll to data-flow and KPI sections** — animations run while
  visible; scroll well past and confirm in the Performance monitor that the
  extra rAF work stops (both loops cancel on viewport exit).
- [ ] **d. KPI hover** — tooltips appear/disappear on the same points with the
  same styling; leave the section and return: chart is intact at its final
  state and the draw-in intro does **not** replay. Resize the window while
  the chart is visible and while it's off-screen; it must never stay blank.
- [ ] **e. Scanlines vs production** — same speed (240px per 12s downward),
  same faint opacity, same overlay blending over light and dark sections, at
  rest and mid-scroll. Check DevTools Performance: scanline movement should
  now show as compositor-only (no paint records).
- [ ] **f. Cursor + ring feel** — identical trailing behavior after the
  translate3d switch; hover states (`.hovered`, `.clicked`) unchanged.
- [ ] **g. Hero particles** — scroll until the hero is fully off-screen:
  particle animation pauses (check via Performance monitor or the canvas
  freezing); returns on scroll-up; hover-repulse and click-push unchanged.
- [ ] **h. Touch emulation** — no cursor ring/dot/glow, bg3d canvas still
  skipped entirely (display:none), tsParticles still 20 particles / 30fps.
- [ ] **i. prefers-reduced-motion** — scanlines and scanner frozen, no KPI
  intro, no bg3d, no tsParticles, no cursor glow; and no new console errors
  anywhere in any mode.
- [ ] **Tab visibility** — switch tabs for ~10s and return: bg3d resumes
  cleanly (single loop, no speed-up, which would indicate a double rAF).
