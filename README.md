# Global Hub

> Connect to the world's best information.

Global Hub is a clean, fast, ad-free, bilingual (English / 中文) web directory
that curates 100+ high-quality websites across AI, tech, learning, design,
news, tools, music, and more. Built for information equality — no tracking,
no clutter, just a beautiful launcher for the curious mind.

**Live site:** https://shikunshan.github.io/global-hub

## Features

- **100+ curated sites** across 10 categories, with a featured "AI Frontier" section
- **Bilingual** interface (EN / 中文) with instant switching, remembered per visitor
- **Dark / light theme** with system-preference detection and no flash on load
- **Instant search** with `!bang` shortcuts (`!g`, `!gh`, `!yt`, `!wiki`, and more)
- **Fast & lightweight** — a purged, minified Tailwind build (~24 KB CSS) and
  locally cached, compressed favicons (~90 KB total for all icons)
- **Zero backend** — pure static files, deployable anywhere

## Tech stack

- Vanilla HTML / CSS / JavaScript (no framework)
- [Tailwind CSS](https://tailwindcss.com/) v3, compiled to a static purged stylesheet
- Static JSON data (`data/sites.json`, `data/i18n.json`)
- Node scripts (dev only) for caching & optimizing favicons

## Project structure

```
global-hub/
├── index.html               # Page markup
├── css/
│   ├── tailwind.css         # Tailwind source + custom styles (edit this)
│   └── tailwind.build.css   # Purged, minified build output (committed, served)
├── js/
│   └── app.js               # App logic: data load, render, search, theme, i18n
├── data/
│   ├── sites.json           # Sites + categories
│   └── i18n.json            # EN / ZH UI strings
├── assets/icons/            # Locally cached, optimized favicons
├── public/icon.png          # Site favicon
├── scripts/
│   ├── fetch-icons.mjs      # Download missing favicons (dev)
│   └── optimize-icons.mjs   # Resize/compress favicons to 64x64 PNG (dev)
├── tailwind.config.js
└── package.json
```

## Development

Requires **Node.js 18+**.

```bash
npm install          # install dev tooling (Tailwind, sharp)

npm run build        # build the purged, minified CSS -> css/tailwind.build.css
npm run watch:css    # rebuild CSS on change during development
npm run serve        # serve the site locally (http://localhost:3000)
```

Open `index.html` (via `npm run serve`, not `file://`, so `fetch()` of the
JSON data works).

> **Important:** after editing `css/tailwind.css`, `index.html`, or the class
> strings in `js/app.js`, re-run `npm run build` and commit the updated
> `css/tailwind.build.css`. GitHub Pages serves the committed file directly —
> there is no build step on deploy.

### Managing favicons

Icons are cached locally for speed. The app falls back to online favicon APIs
(Google → DuckDuckGo) for any site without a local icon, so missing icons still
render.

```bash
npm run fetch-icons        # download only the missing icons
npm run fetch-icons -- --force   # re-download every icon
npm run optimize-icons     # resize/compress all icons to 64x64 PNG
```

## Adding a site

Edit `data/sites.json` and add an entry to the `sites` array:

```json
{
  "id": "example",
  "name": "Example",
  "url": "https://example.com",
  "desc": { "en": "English description.", "zh": "中文描述。" },
  "category": "tech-dev",
  "subcategory": null,
  "isNew": true
}
```

`id` must be unique (it also names the cached icon file). Then run
`npm run fetch-icons && npm run optimize-icons` to cache its favicon.

## Deployment

Any static host works (GitHub Pages, Vercel, Cloudflare Pages, Netlify).
For GitHub Pages, the repo includes a `.nojekyll` file and the committed
`css/tailwind.build.css`, so it works with no build configuration.

## License

[MIT](./LICENSE)
