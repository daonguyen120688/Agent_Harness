---
name: add-language
description: Add one or more programming languages to the 2026 language tier list (tier-list/data.js), following the project's data format, icon, stylesheet and font-size conventions. Use when the user asks to add, insert, include or register a new language/chip in the tier list, or to fix a language entry's data or icon.
---

# Add a language to the tier list

A language is **data only**. Adding one means appending an entry to `window.LANGUAGES` in `data.js`. `app.js` renders chips, tiers and the detail panel from that array, so do not touch `app.js` or add per-language CSS.

All paths below are relative to `tier-list/`.

## Steps

1. **Check it isn't already there.** Search `data.js` for the `id` and `name`.
2. **Pick the icon** (see *Icons*) and verify it loads.
3. **Append the entry** to the end of `window.LANGUAGES` in `data.js`, using the template below. New languages start in the Unranked pool. The order in the array is their order in the tray.
4. **Validate:** `node .claude/skills/add-language/validate.js --check-icons` must print `✓`.
5. **Syntax check:** `node --check data.js`.
6. **Add a test row** if the devicon name differs from the `id` (see *Tests*).
7. **Run the tests:** `npm run test:coverage` must pass with 100% on every file (see *Tests*).
8. **Look at it:** with `npm start` running (live reload on :3000), confirm the chip shows in the tray with a clearly visible, uncropped icon and that clicking it opens the right panel with every section filled.
9. If you added a local icon, run `npm run build` and confirm `dist/icons/<id>.svg` exists.

Users' saved rankings survive this. `initialBoard()` in `app.js` keeps saved placements and puts new ids into the pool. Never change `STORAGE_KEY` just because a language was added.

## Data formatting

Template. Copy it exactly and keep the key order:

```js
{
  id: 'haskell', name: 'Haskell', icon: ICON('haskell'),
  tagline: 'Niche, pure functional programming',
  salary: { range: '$120K–$150K', note: 'Fintech & compiler roles higher' },
  difficulty: { level: 'Hard', note: 'Monads, laziness, strong types' },
  useCases: 'One to three sentences on where the language is used in practice.',
  jobMarket: 'One to two sentences on who hires for it and how much demand there is.',
  trend: 'One to two sentences on whether usage is growing, flat or shrinking, and why.',
  fact: 'One memorable, verifiable sentence.',
  sources: sources('Haskell', 'https://www.haskell.org/'),
},
```

| Field | Rule |
|---|---|
| `id` | Lowercase letters/digits only, unique, stable (it's the localStorage key). Spell symbols out: `csharp`, `cpp`, `fsharp`, `objectivec`. |
| `name` | Display name as the language styles it: `C#`, `TypeScript`, `Objective-C`. |
| `icon` | `ICON('<devicon-name>')` or `ICON('<devicon-name>', '<variant>')`; fallback `'icons/<id>.svg'`. |
| `tagline` | `"<Status>, <short phrase>"`. Status is one of **Rising, Stable, Declining, Niche, Emerging**. Sentence case, max 40 chars, no trailing period. Shown under the language name in the detail panel, so keep it short. |
| `salary.range` | `$NNK–$NNNK` with an **en dash** (–), low < high, US annual. |
| `salary.note` | Max 45 chars, e.g. `Senior iOS $160K+`. |
| `difficulty.level` | Exactly `Easy`, `Moderate` or `Hard`. |
| `difficulty.note` | Max 45 chars, a short reason. |
| `useCases`, `jobMarket`, `trend` | Full sentences ending with a period, max 300 chars each. |
| `fact` | One sentence, max 160 chars. |
| `sources` | Always `sources(name, officialSiteUrl)`. It adds Stack Overflow, Octoverse, an Indeed search and BLS automatically. Append extra `{ label, url }` objects only for real, specific pages you have verified. For a language with no official site (a standard like SQL), pass a reference page plus its own label as a third argument: `sources('SQL', url, 'PostgreSQL docs: The SQL Language')`. |

Escape apostrophes in single-quoted strings (`'Android\'s first choice'`). Use 2-space indentation and single quotes, like the existing entries.

**Accuracy:** salary ranges and difficulty notes are sample estimates (see the header comment in `data.js`). Don't invent precise statistics such as "22,398 jobs" or "grew 24.79%". Prefer qualitative statements unless the user supplies numbers with a source, and then add that source to `sources`. Facts must be well known and checkable.

## Icons

Icons render in two places, plus the PNG export, all from the single `icon` URL:

| Where | Container | Image | Shape |
|---|---|---|---|
| Chip (tray and tiers) | `.chip-icon` 30×30 | 28×28, `object-fit: contain` | none; sits on the light paper-colored chip |
| Detail panel | `.panel-icon` 56×56 | 38×38 | rounded square (12px) on a paper background |

Icons sit on a light background, so avoid white-only logos. The PNG export redraws each icon onto a 96×96 canvas (`iconToPng`), so use a square viewBox.

1. **Default: devicon CDN.** Use `ICON(name, variant)` (defined at the top of `data.js`). It builds `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/<name>/<name>-<variant>.svg`. Variant defaults to `original`. Use `plain` when `original` is missing or has a wordmark. Devicon names don't always match the id (C++ is `cplusplus`, C# is `csharp`). Check that the URL exists before using it:
   `curl -s -o /dev/null -w "%{http_code}" <url>` must return `200`.
2. **Fallback: local icon folder `tier-list/icons/`.** Only when devicon has no usable icon:
   - Save as `icons/<id>.svg` (file name = `id`). Use a square viewBox, no fixed `width`/`height` attributes, no embedded raster images, and a transparent background. Keep the logo centered with a little padding.
   - Set `icon: 'icons/<id>.svg'`.
   - `build.js` already copies `icons/` into `dist/`. Don't add icons to the `files` list.
   - Only use logos the project is allowed to use. Never hotlink from random sites.
3. Never point `icon` at another CDN. The PNG export uses html2canvas with `useCORS: true`, so remote icons must send CORS headers (jsdelivr does). Local icons are same-origin and fine.

## Stylesheet conventions

- **No per-language CSS.** Every chip and panel shares `styles.css`. If a logo looks off, fix the SVG (or choose a different devicon variant). Don't add a class.
- All styles live in `styles.css`. Don't use inline `style=` except for data-driven colors (tier colors already do this).
- Use the CSS variables on `:root`: `--ground`, `--surface`, `--surface-2`, `--line`, `--paper`, `--paper-ink`, `--text`, `--muted`, `--tier-s` … `--tier-d`, `--tray-h`, `--panel-w`, `--display`. Don't hardcode new colors.
- Bootstrap 5 handles layout and buttons. Tailwind utilities **must** use the `tw-` prefix (`tw-gap-3`), and Tailwind preflight is disabled. Never add unprefixed Tailwind classes.
- Section comments use the format `/* ---------- Name ---------- */`.

## Font sizes

Fonts are **Instrument Sans** (UI and body, default) and **Big Shoulders Display** (`var(--display)`: tier letters, titles, stat values). Reuse these sizes and don't introduce new ones:

| Element | Class | Size / weight |
|---|---|---|
| Hero title | `.hero-title` | `clamp(2.6rem, 7vw, 4.6rem)` / 900, display |
| Tier letter | `.tier-label` | `--letter` per tier (96px S down to 52px D; 0.6× at ≤576px) / 900, display |
| Panel title (language name) | `.panel-title` | 40px / 900, display |
| Stat value (salary, difficulty) | `.stat-tile .v` | 28px / 800, display |
| Lead paragraph | `.hero-lead` | 17px |
| Chip name | `.chip` | 15px / 600 |
| Panel body text, sources | `.panel-section p`, `.panel-sources li` | 15px, line-height 1.6 |
| Panel tagline | `.panel-tagline` | 14px |
| Panel headings | `.panel-heading` | 15px / 700 |
| Stat label and note | `.stat-tile .k`, `.stat-tile .n` | 13px |

Long `name` values must fit a 15px chip on one line (`white-space: nowrap`). Keep names short; use the common short name (`Objective-C`, not `Objective-C Programming Language`).

## Tests

Jest tests live in `tests/`. `npm run test:coverage` enforces **100%** statements, branches, functions and lines for `app.js`, `data.js`, `build.js` and `validate.js`, and fails otherwise.

**Tests that run over every language automatically.** A new entry is checked with no test changes needed:
- `tests/data.test.js` checks for unique ids and that every entry has all the panel fields with the right types.
- `tests/validate.test.js` ("the real data.js passes") runs the validator against the real `data.js`. A new entry that breaks a data rule fails here as well as in step 4.
- `tests/app.test.js` checks that the tray renders every language in `LANGUAGES` order.

**Fixtures the existing tests depend on. Don't break them:**

| Rule | Why |
|---|---|
| **Python stays the first entry** in `LANGUAGES` | `app.test.js` compares the first chip's icon to `LANGUAGES[0].icon` and expects `Go, Python` at the start of the tray after dropping Go on Python |
| Keep the entries for Python, Go, Rust, Java, PHP, Kotlin, Dart, Scala, Ruby and Swift | `app.test.js` finds these chips by display name |
| Keep the ids `python`, `go`, `rust`, `java`, `php`, `csharp`, `cpp`, and C#'s official-site URL | Used by `app.test.js` and `data.test.js` (devicon URL and `sources()` checks) |
| **Never add a language with id `cobol`** | Tests use `cobol` as an id that doesn't exist. If COBOL is ever requested, change those tests to a different unknown id (e.g. `nope`) in the same change |
| Names must be unique | Chips are looked up by their visible text |

New languages go at the **end** of the array, so none of these are affected.

**When to add or update tests:**

- **Devicon name ≠ id** (like id `cpp` → devicon `cplusplus`) or a non-default variant (`plain`, etc.): add a row to the `test.each` table in `tests/data.test.js`, so a wrong icon mapping is caught:
  ```js
  ['<id>', '<devicon-name>/<devicon-name>-<variant>.svg'],
  ```
- **Local icon** (`icons/<id>.svg`): no test change. The validator test already covers local icons, and `build.test.js` covers copying `icons/`.
- **Changing a rule in `validate.js`** (a new status word, a length limit, a new field): update `tests/validate.test.js` in the same change. Add a passing case to `valid()` and a failing case to the "reports every rule violation" fixture, then add its expected message to the `expected` list. Coverage stays at 100% only if both sides of every new check are tested.
- **Adding a new field to the schema:** add it to the template above, to `valid()` in `validate.test.js`, to the `objectContaining` shape in `data.test.js`, and, if the panel renders it, add an assertion to the "clicking a chip opens the panel with every section" test in `app.test.js`.
- **Touching `app.js` or `styles.css`** is outside this skill. If unavoidable, every new branch needs a test in `tests/app.test.js`. Remove unreachable guards instead of leaving them uncovered.

**If the coverage run fails:**
1. Make sure you are in `tier-list/`. From the parent folder, npm can't find `package.json`.
2. Read the `Uncovered Line #s` column. Each listed line is code no test reaches. Add a test through the DOM (for `app.js`) or with mocks (for `build.js` and `validate.js`). Never lower `coverageThreshold` in `package.json`.
3. A failing assertion that names a language usually means one of the fixtures above was renamed, removed or reordered.

## Done checklist

- [ ] One new object at the **end** of `data.js`, all fields present, key order matches the template
- [ ] `validate.js --check-icons` passes and `node --check data.js` is clean
- [ ] `npm run test:coverage` passes with 100% on every file
- [ ] Test row added in `data.test.js` if the devicon name differs from the id; validator tests updated if a rule changed
- [ ] The icon renders fully visible on the chip (tray and tiers) and in the panel
- [ ] No changes to `app.js`, `styles.css` or `STORAGE_KEY` were needed
- [ ] Tell the user which figures are estimates and need verifying
