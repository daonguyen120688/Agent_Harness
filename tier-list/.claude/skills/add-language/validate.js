#!/usr/bin/env node
// Validates tier-list/data.js against the add-language conventions.
// Usage (from tier-list/): node .claude/skills/add-language/validate.js [--check-icons]
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../..');
global.window = {};
require(path.join(root, 'data.js'));
const langs = window.LANGUAGES;

const STATUSES = ['Rising', 'Stable', 'Declining', 'Niche', 'Emerging'];
const LEVELS = ['Easy', 'Moderate', 'Hard'];
const DEVICON = /^https:\/\/cdn\.jsdelivr\.net\/gh\/devicons\/devicon@latest\/icons\/[a-z0-9]+\/[a-z0-9]+-[a-z-]+\.svg$/;
const RANGE = /^\$(\d{2,3})K–\$(\d{2,3})K$/; // en dash (–), not hyphen
const PROSE = { useCases: 300, jobMarket: 300, trend: 300, fact: 160 };

const errors = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);

if (!Array.isArray(langs) || !langs.length) {
  console.error('window.LANGUAGES is missing or empty');
  process.exit(1);
}

const ids = new Set();
for (const l of langs) {
  const id = l.id || '(no id)';
  if (!/^[a-z0-9]+$/.test(l.id || '')) err(id, 'id must be lowercase letters/digits only (e.g. "csharp", "cpp")');
  if (ids.has(l.id)) err(id, 'duplicate id');
  ids.add(l.id);

  if (!l.name) err(id, 'name is required');

  if (typeof l.icon !== 'string') err(id, 'icon is required');
  else if (l.icon.startsWith('icons/')) {
    if (l.icon !== `icons/${l.id}.svg`) err(id, `local icon must be "icons/${l.id}.svg"`);
    else if (!fs.existsSync(path.join(root, l.icon))) err(id, `missing file ${l.icon}`);
  } else if (!DEVICON.test(l.icon)) err(id, 'icon must use ICON(...) (devicon) or "icons/<id>.svg"');

  const [status] = (l.tagline || '').split(',');
  if (!STATUSES.includes(status)) err(id, `tagline must start with one of ${STATUSES.join('/')} followed by a comma`);
  if ((l.tagline || '').length > 40) err(id, `tagline is ${l.tagline.length} chars (max 40)`);
  if (/\.$/.test(l.tagline || '')) err(id, 'tagline must not end with a period');

  const m = RANGE.exec(l.salary?.range || '');
  if (!m) err(id, 'salary.range must look like "$110K–$140K" (en dash)');
  else if (+m[1] >= +m[2]) err(id, 'salary.range low must be below high');
  if (!l.salary?.note || l.salary.note.length > 45) err(id, 'salary.note is required, max 45 chars');

  if (!LEVELS.includes(l.difficulty?.level)) err(id, `difficulty.level must be one of ${LEVELS.join('/')}`);
  if (!l.difficulty?.note || l.difficulty.note.length > 45) err(id, 'difficulty.note is required, max 45 chars');

  for (const [k, max] of Object.entries(PROSE)) {
    const v = l[k];
    if (typeof v !== 'string' || !v) err(id, `${k} is required`);
    else {
      if (v.length > max) err(id, `${k} is ${v.length} chars (max ${max})`);
      if (!/[.!?"')]$/.test(v)) err(id, `${k} must end with a full stop`);
    }
  }

  if (!Array.isArray(l.sources) || !l.sources.length) err(id, 'sources must be a non-empty array (use sources(name, officialSite))');
  else for (const s of l.sources) {
    if (!s.label || !/^https:\/\//.test(s.url || '')) err(id, `bad source ${JSON.stringify(s)}`);
  }
}

async function checkIcons() {
  const remote = langs.filter((l) => DEVICON.test(l.icon || ''));
  await Promise.all(remote.map(async (l) => {
    try {
      const res = await fetch(l.icon, { method: 'HEAD' });
      if (!res.ok) err(l.id, `icon URL returned HTTP ${res.status}: ${l.icon}`);
    } catch (e) { err(l.id, `icon URL unreachable: ${e.message}`); }
  }));
}

(async () => {
  if (process.argv.includes('--check-icons')) await checkIcons();
  if (errors.length) {
    console.error(`✗ ${errors.length} problem(s) in data.js:\n  - ` + errors.join('\n  - '));
    process.exit(1);
  }
  console.log(`✓ data.js OK — ${langs.length} languages`);
})();
