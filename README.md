# uniment.ae

Static marketing site for Uniment, deployed via GitHub Pages (see `CNAME`).
No build system, no `package.json` — the only generated asset is `css/tailwind.css`.

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
