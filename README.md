# Elementra

Elementra is an interactive periodic table and chemistry reference dashboard built with React, TypeScript, Tailwind CSS, and Vite.

## Features

- Search and filter all 118 elements
- Category, property heatmap, and temperature phase views
- Detailed element profiles with keyboard navigation
- Side-by-side comparison for up to three elements
- Quiz mode with a local high score
- Offline molar mass calculator with nested formula groups
- Dark-only interface with reduced-motion support
- Single-file production build suitable for static hosting
- GitHub Actions CI and GitHub Pages deployment workflow

## Quick Start

Requirements: Node.js 20.19 or newer.

```bash
npm ci
npm run dev
```

Run the full project check before opening a pull request:

```bash
npm run check
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run typecheck` | Run strict TypeScript checks |
| `npm test` | Run the Vitest regression suite |
| `npm run build` | Create the production build in `dist/` |
| `npm run preview` | Preview the production build |
| `npm run check` | Type-check, test, and build |

## Deployment

`npm run build` creates `dist/index.html` as a self-contained application bundle. It can be published to GitHub Pages, Netlify, Cloudflare Pages, or any static file host.

For GitHub Pages, use the workflow in `.github/workflows/deploy-pages.yml` and set the Pages source to `GitHub Actions`. The Vite base path is relative, so project pages work without a repository-name-specific configuration.

## Data and Network Use

Core element data is bundled from:

- [`node-periodic-table`](https://www.npmjs.com/package/node-periodic-table)
- [`periodic-table-data-complete`](https://github.com/sweaver2112/periodic-table-data-complete)

Both datasets are MIT licensed. Element profiles optionally request supplemental text from [PeriodicTableOfElements.org](https://periodictableofelements.org/). The application remains usable when that service is unavailable.
The UI uses Sora, IBM Plex Sans, and IBM Plex Mono via Google Fonts.

The remote profile fetches are read-only, bounded, and validated before being shown in the UI. GitHub Actions runs `npm audit`, type-checking, tests, and a production build before deployment.

The phase simulator is a simplified educational model based on melting and boiling points at approximately one atmosphere. It does not model pressure-dependent phase diagrams or sublimation.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports should follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
