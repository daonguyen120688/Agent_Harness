/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VALIDATE = path.join(ROOT, '.claude', 'skills', 'add-language', 'validate.js');
const DATA = path.join(ROOT, 'data.js');
const DEVICON = (n) => `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${n}/${n}-original.svg`;

const valid = (over = {}) => ({
  id: 'haskell',
  name: 'Haskell',
  icon: DEVICON('haskell'),
  tagline: 'Niche, pure functional programming',
  salary: { range: '$120K–$150K', note: 'Fintech roles higher' },
  difficulty: { level: 'Hard', note: 'Monads and laziness' },
  useCases: 'Compilers and fintech.',
  jobMarket: 'Small but steady.',
  trend: 'Flat.',
  fact: 'Named after Haskell Curry.',
  sources: [{ label: 'Haskell', url: 'https://www.haskell.org/' }],
  ...over,
});

const flush = () => new Promise((r) => setImmediate(r));
const savedArgv = process.argv;
const savedFetch = global.fetch;

/**
 * Loads validate.js once.
 * - langs: fixture for window.LANGUAGES (omit to use the real data.js)
 * - localIcons: file names to pretend exist in icons/ (omit to use the real icons/ folder)
 */
async function run(opts = {}) {
  const { langs, argv = [], localIcons, fetchImpl } = opts;
  const exit = jest.spyOn(process, 'exit').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  if (localIcons) {
    const realExists = fs.existsSync;
    jest.spyOn(fs, 'existsSync').mockImplementation((p) =>
      path.dirname(String(p)) === path.join(ROOT, 'icons') ? localIcons.includes(path.basename(p)) : realExists(p));
  }
  process.argv = ['node', VALIDATE, ...argv];
  global.fetch = jest.fn(fetchImpl);

  let thrown;
  jest.isolateModules(() => {
    if ('langs' in opts) {
      jest.doMock(DATA, () => {
        if (langs !== undefined) global.window.LANGUAGES = langs;
        return {};
      });
    }
    try { require(VALIDATE); } catch (e) { thrown = e; }
  });
  await flush();
  await flush();

  return { exit, log, thrown, fetch: global.fetch, errors: error.mock.calls.flat().join('\n') };
}

afterEach(() => {
  jest.restoreAllMocks();
  process.argv = savedArgv;
  global.fetch = savedFetch;
  delete global.window;
});

test('the real data.js passes', async () => {
  const { exit, log } = await run();
  expect(exit).not.toHaveBeenCalled();
  expect(log.mock.calls[0][0]).toMatch(/^✓ data\.js OK — \d+ languages$/);
});

test('a valid entry passes without checking icons by default', async () => {
  const { exit, log, fetch } = await run({ langs: [valid()] });
  expect(exit).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith('✓ data.js OK — 1 languages');
});

test('exits when window.LANGUAGES is missing', async () => {
  const { exit, thrown } = await run({ langs: undefined });
  expect(exit).toHaveBeenCalledWith(1);
  expect(thrown).toBeInstanceOf(TypeError); // process.exit is mocked, so execution continues
});

test('exits when window.LANGUAGES is empty', async () => {
  const { exit } = await run({ langs: [] });
  expect(exit).toHaveBeenCalledWith(1);
});

test('reports every rule violation', async () => {
  const langs = [
    {},
    valid(),
    valid(),
    valid({ id: 'a1', icon: 'icons/other.svg' }),
    valid({ id: 'b1', icon: 'icons/b1.svg' }),
    valid({ id: 'c1', icon: 'icons/c1.svg' }),
    valid({ id: 'd1', icon: 'https://example.com/d1.svg' }),
    valid({ id: 'e1', tagline: 'Rising, ' + 'x'.repeat(40) + '.' }),
    valid({ id: 'f1', salary: { range: '$150K–$120K', note: 'x'.repeat(46) } }),
    valid({ id: 'g1', salary: { range: '$120K-$150K', note: 'ok' } }),
    valid({ id: 'h1', difficulty: { level: 'Medium', note: 'x'.repeat(46) } }),
    valid({ id: 'i1', useCases: 'x'.repeat(301) + '.', fact: 'No full stop' }),
    valid({ id: 'j1', sources: [] }),
    valid({ id: 'k1', sources: [{ label: '', url: 'https://x.org' }, { label: 'x', url: 'http://x.org' }, { label: 'y' }] }),
  ];
  const { exit, errors } = await run({ langs, localIcons: ['c1.svg'] });

  expect(exit).toHaveBeenCalledWith(1);
  const expected = [
    '(no id): id must be lowercase letters/digits only',
    '(no id): name is required',
    '(no id): icon is required',
    '(no id): tagline must start with one of Rising/Stable/Declining/Niche/Emerging',
    '(no id): salary.range must look like',
    '(no id): salary.note is required',
    '(no id): difficulty.level must be one of Easy/Moderate/Hard',
    '(no id): difficulty.note is required',
    '(no id): useCases is required',
    '(no id): sources must be a non-empty array',
    'haskell: duplicate id',
    'a1: local icon must be "icons/a1.svg"',
    'b1: missing file icons/b1.svg',
    'd1: icon must use ICON(...) (devicon) or "icons/<id>.svg"',
    'e1: tagline is 49 chars (max 40)',
    'e1: tagline must not end with a period',
    'f1: salary.range low must be below high',
    'f1: salary.note is required, max 45 chars',
    'g1: salary.range must look like "$110K–$140K" (en dash)',
    'h1: difficulty.level must be one of',
    'h1: difficulty.note is required, max 45 chars',
    'i1: useCases is 302 chars (max 300)',
    'i1: fact must end with a full stop',
    'j1: sources must be a non-empty array',
    'k1: bad source {"label":"","url":"https://x.org"}',
    'k1: bad source {"label":"x","url":"http://x.org"}',
    'k1: bad source {"label":"y"}',
  ];
  for (const line of expected) expect(errors).toContain(line);
  expect(errors).not.toMatch(/^ {2}- c1:/m); // existing local icon is fine
});

test('--check-icons reports broken and unreachable devicon URLs', async () => {
  const langs = [
    valid({ id: 'ok' }),
    valid({ id: 'missing', icon: DEVICON('missing') }),
    valid({ id: 'offline', icon: DEVICON('offline') }),
    valid({ id: 'local', icon: 'icons/local.svg' }),
    valid({ id: 'noicon', icon: undefined }),
  ];
  const fetchImpl = async (url) => {
    if (url.includes('/missing/')) return { ok: false, status: 404 };
    if (url.includes('/offline/')) throw new Error('getaddrinfo ENOTFOUND');
    return { ok: true, status: 200 };
  };
  const { exit, errors, fetch } = await run({ langs, argv: ['--check-icons'], localIcons: ['local.svg'], fetchImpl });

  expect(fetch).toHaveBeenCalledTimes(3); // local and missing icons are not fetched
  expect(fetch).toHaveBeenCalledWith(DEVICON('haskell'), { method: 'HEAD' });
  expect(errors).toContain(`missing: icon URL returned HTTP 404: ${DEVICON('missing')}`);
  expect(errors).toContain('offline: icon URL unreachable: getaddrinfo ENOTFOUND');
  expect(errors).toContain('noicon: icon is required');
  expect(exit).toHaveBeenCalledWith(1);
});
