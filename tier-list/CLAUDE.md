# CLAUDE.md

This file guides Claude Code when working in this project.

## Project

"Rank the 2026 programming languages": a single-page tier-list tool. Users drag language chips from the bottom tray into S/A/B/C/D tiers (or focus a chip and press S/A/B/C/D, U to unrank), click a chip to open a right-side detail panel (salary, difficulty, use cases, job market, trend, fact, sources), clear the board with the header's Reset button, and export the board as a PNG (a preview dialog with Cancel and Download opens first).

## Repo layout

The workspace root (not a git repo) holds `skills-lock.json`, `.agents/` and `.claude/` (the installed `improve-codebase-architecture` skill). The app lives entirely in `tier-list/`; `dist/` (build output) and `coverage/` (generated report) are not source.

## Commands

Run from `tier-list/`:

| Command | What it does |
|---|---|
| `npm start` (or `npm run run`) | browser-sync on http://localhost:3000, serving the **source** files with live reload on save |
| `npm run build` | `build.js` copies `index.html`, `styles.css`, `data.js` and `app.js` into `dist/` |
| `npm run preview` | Builds, then serves `dist/` on http://localhost:4173 |
| `npm test` | Jest unit tests in `tests/` |
| `npm run test:coverage` | Tests plus coverage report (`coverage/`). Fails below **100%** statements/branches/functions/lines |

### Tests

- `tests/app.test.js` (jsdom) sets `React`, `ReactDOM`, `htm` and `html2canvas` as globals, loads `data.js` and `app.js` with `jest.isolateModules`, and drives the UI through DOM events. Components aren't exported, so test behaviour through the rendered DOM. jsdom has no `DataTransfer`, so the `fire()` helper attaches a fake one to a `MouseEvent`.
- `tests/build.test.js` and `tests/validate.test.js` mock `fs`, `process.exit`, `console` and `fetch`, so they never touch the real `dist/` or the network.
- `testEnvironmentOptions.customExportConditions` forces the CommonJS build of `htm` under jsdom. Don't remove it.
- Any new code must keep coverage at 100%. Remove unreachable guards instead of leaving them uncovered.

## Architecture

No bundler and no JSX compile step. Everything runs in the browser:

- `index.html` loads React 18, ReactDOM, `htm`, `html2canvas`, Bootstrap 5 and the Tailwind Play CDN from jsdelivr/Tailwind CDN, then `data.js`, then `app.js`. Order matters: `app.js` reads `window.LANGUAGES` set by `data.js`.
- The npm `dependencies` in `package.json` only record versions; the page does **not** load anything from `node_modules`. Keep the CDN versions in `index.html` in sync with `package.json` when upgrading.
- `data.js` is an IIFE that sets `window.LANGUAGES` (20 languages, Python first). It defines two helpers: `ICON(name, variant = 'original')` builds the devicon URL, and `sources(name, site, siteLabel?)` builds the standard source list (Stack Overflow survey, Octoverse, Indeed, BLS, plus the official site). Each entry: `id, name, icon, tagline, salary{range,note}, difficulty{level,note}, useCases, jobMarket, trend, fact, sources[]`. Icons come from devicon on jsdelivr. Salary ranges and difficulty notes are sample estimates, not verified figures; don't present them as sourced data.
- `app.js` uses `htm` tagged templates (`html\`...\``) instead of JSX. Use `className`, `${expr}` for props, `<${Component} />` for components, and `<//>` to close a component.
  - Board state: `{ pool, S, A, B, C, D }`, each an array of language ids, persisted to `localStorage` under `lang-tier-list-2026`. `move(id, zone, beforeId)` is the only mutation.
  - Drag and drop uses native HTML5 DnD (`dataTransfer` carries the id). `DropZone` wraps tier rows and the tray; dropping on a chip inserts before it.
  - Drag preview: `dragRef` holds the dragged id (`dataTransfer` can't be read during dragover) and `preview` is `{ zone, beforeId }`. `renderChips` inserts a `Ghost` chip there and the source chip gets `is-dragging`. Hovering a chip previews before it; hovering empty row space keeps the preview unless the pointer is past the last chip (end). `dropInto` drops where the preview was shown, so preview and drop always agree.
  - `DetailPanel` is a fixed right `<aside>`. When open, `.app-shell.panel-open` adds right padding and shifts the fixed `.tray` left (≥992px only; on smaller screens it overlays).
  - PNG export is two steps: the header's Download PNG renders the image (`previewPng`) and opens `PreviewModal`; only its Download button saves the file (`downloadPng`). Cancel, Escape (captured so it doesn't also close the detail panel) and a backdrop click close it. Export runs `html2canvas` on the tier board ref with `useCORS: true`, so icon `<img>` tags need `crossOrigin="anonymous"`. `html2canvas` also draws SVG `<img>`s at their intrinsic size (icons come out blank or clipped), so `downloadPng` first redraws each icon onto a canvas (`iconToPng`) and swaps the PNG data URLs in via `onclone`.
- `build.js` has a hardcoded file list. Add any new source file to it. It also copies the optional `icons/` folder.
- To add a language, follow the `add-language` skill (`.claude/skills/add-language/SKILL.md`). It covers data format, icons, styles and font sizes, and includes `validate.js` to check `data.js`.

## Styling conventions

- Bootstrap 5 provides grid, buttons and utilities. Tailwind is configured with `prefix: 'tw-'` and `preflight: false` so it doesn't reset Bootstrap. Always use the `tw-` prefix for Tailwind classes.
- Custom styles live in `styles.css`. Colors are CSS variables on `:root` (`--brand`, `--ink`, `--tier-s` … `--tier-d`, `--panel-w`).
- Look: dark navy "scoreboard" theme. Tokens are `--ground`, `--surface`, `--paper`, `--text`, `--muted` and the tier ramp `--tier-s` … `--tier-d` (tier letters are navy on every tier). Tier rows shrink from S to D via `--h` and `--letter` on `.tier-S` … `.tier-D`.
- Fonts: Big Shoulders Display (`--display`, tier letters and headings) and Instrument Sans (UI and body).
- The board is wrapped in `.share-card`, which is what `html2canvas` exports (title, date and credit line included). Keep it free of CSS html2canvas can't parse (e.g. `color-mix`).

## Gotchas


- `dist/` is a copy, so editing files there is pointless. Edit the source files at the project root.
- The header wordmark ("2026 language tier list") is plain text in `Header` in `app.js`; change it there if the product is renamed.
