# Elementra

Elementra is a free, interactive periodic table built for students — explore all 118 elements, see the periodic trends, and actually remember them with mnemonics, flashcards and quizzes. Built with React, TypeScript, Tailwind CSS and Vite.

Live site: https://elementra.subirhazra.com

## Features

**Explore**
- Periodic table with group and period labels, a large live preview of the hovered element, and arrow-key navigation
- Three colour modes: categories, trend heatmaps (electronegativity, atomic radius, ionization energy, mass, melting and boiling point, density) and a states-of-matter temperature slider
- Table or list layout, search by name, symbol, number, family or Latin name (press `/` or `Ctrl/⌘ K`)
- Element profiles with photos, memory hooks, an animated Bohr model, electron configuration, key properties and a property fingerprint; swipe or use the arrow keys to move between elements
- Side-by-side comparison of up to three elements

**Learn**
- Study sets (elements 1–20, alkali metals, halogens, noble gases, first-row transition metals, Latin symbols, all 118) with mnemonics whose letters spell each symbol
- Flip-card sessions with swipe gestures that put unlearned cards first and repeat missed ones
- The stories behind symbols such as Fe, Au and Pb, a periodic-trends cheat sheet and a "how to read a tile" guide
- Progress, learned elements and a daily streak saved on the device

**Quiz and tools**
- Quizzes per study set with explained answers, look-alike distractors, streaks, personal bests and a review of every miss
- Offline molar mass calculator (brackets, hydrates like `CuSO4·5H2O`, Unicode subscripts) with mass composition
- Temperature converter

**Experience**
- Light and dark themes (follows the system, remembered per device)
- Mobile-first layout with a bottom navigation bar, bottom sheets and swipe gestures; the Back button closes open sheets
- Works offline after the first visit (service worker) and can be installed to the home screen
- Reduced-motion support, keyboard access and screen-reader labels throughout

## Quick start

Requirements: Node.js 20.19 or newer.

```bash
npm ci
npm run dev
```

Run the full project check before opening a pull request:

```bash
npm run check
```

> On Windows, run commands from a path with an upper-case drive letter (`G:\elementra`, not `g:\elementra`). With a lower-case drive letter Vitest loads two copies of itself and every suite fails with `Cannot read properties of undefined (reading 'config')`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run data` | Regenerate `src/data/elements.data.json` from the source datasets |
| `npm run typecheck` | Run strict TypeScript checks |
| `npm test` | Run the Vitest regression suite |
| `npm run build` | Create the production build in `dist/` |
| `npm run preview` | Preview the production build |
| `npm run check` | Type-check, test, and build |

## Ads (Adsterra)

Ads are off by default and designed to stay out of the way: at most a couple of small, fixed-size slots per page, never inside the periodic table, element sheets, flashcards or quiz questions. Space is reserved before an ad loads so nothing jumps, and ads only load when scrolled near.

Each ad runs inside `ad-frame.html`, a separate page generated at build time and embedded in a sandboxed iframe. Ad code can open a new tab when clicked, but it can never redirect the site or touch the main page.

To turn ads on:

1. In Adsterra, create **Banner** units in the sizes you want: 728×90, 468×60, 320×50 (mobile) and/or 300×250.
2. From each unit's code, copy the 32-character `key` value from `atOptions`.
3. Paste the keys into the matching units in [`src/config/ads.json`](src/config/ads.json) and set `"enabled": true`.
4. If Adsterra's code uses a different script domain than `www.highperformanceformat.com`, set `bannerHost` to it (or add a full `src` to the unit).
5. Optional: for a **Native Banner**, paste its script URL into `units.native.script` and its container id (`container-…`) into `units.native.containerId`.
6. Rebuild and deploy.

Each placement (`explore`, `learn`, `tools`, `footer`) lists units in order of preference, and the first configured one that fits the screen is shown, so phones automatically get the 320×50 banner. Units left empty are skipped, and a placement with no configured units renders nothing. During `npm run dev`, dashed placeholders show where ads will appear (set `showPlaceholdersInDev` to `false` to hide them).

If a network's ads ever render blank, check the browser console first. `"strictIsolation": true` removes `allow-same-origin` from the sandbox for maximum isolation, but some ad scripts do not work without it.

Social bar and popunder formats are deliberately not supported, because they interrupt studying.

## Deployment

`npm run build` creates `dist/index.html` as a self-contained application bundle, plus the icon, web manifest, service worker and (when ads are enabled) `ad-frame.html`. Publish the whole `dist/` folder to GitHub Pages, Vercel, Netlify, Cloudflare Pages or any static host.

For GitHub Pages, use the workflow in `.github/workflows/deploy-pages.yml` and set the Pages source to `GitHub Actions`. `vercel.json` sets the security headers when deploying to Vercel; same-origin framing is allowed so the ad frame can load.

## Data and network use

Core element data is bundled from:

- [`node-periodic-table`](https://www.npmjs.com/package/node-periodic-table)
- [`periodic-table-data-complete`](https://github.com/sweaver2112/periodic-table-data-complete)

Both datasets are MIT licensed. `npm run data` trims them to the fields the app uses (`src/data/elements.data.json`), which keeps the bundle small. Element profiles optionally request supplemental text from [PeriodicTableOfElements.org](https://periodictableofelements.org/) and a photo from Wikipedia; the app remains fully usable when either is unavailable. Remote responses are read-only, bounded and validated before they reach the UI.

The UI uses Sora, IBM Plex Sans and IBM Plex Mono via Google Fonts.

The states-of-matter view is a simplified model based on melting and boiling points at about one atmosphere. It does not model pressure-dependent phase diagrams or sublimation, and elements with incomplete data are shown as unknown.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports should follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
