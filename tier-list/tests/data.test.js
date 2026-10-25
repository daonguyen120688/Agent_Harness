/**
 * @jest-environment node
 */
const path = require('path');

let LANGUAGES;

beforeAll(() => {
  global.window = {};
  jest.isolateModules(() => require(path.join(__dirname, '..', 'data.js')));
  LANGUAGES = global.window.LANGUAGES;
});

afterAll(() => { delete global.window; });

test('defines a non-empty list with unique ids', () => {
  expect(Array.isArray(LANGUAGES)).toBe(true);
  expect(LANGUAGES.length).toBeGreaterThan(0);
  const ids = LANGUAGES.map((l) => l.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test.each([
  ['python', 'python/python-original.svg'],
  ['cpp', 'cplusplus/cplusplus-original.svg'],
  ['csharp', 'csharp/csharp-original.svg'],
])('ICON() builds the devicon URL for %s', (id, file) => {
  const lang = LANGUAGES.find((l) => l.id === id);
  expect(lang.icon).toBe(`https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${file}`);
});

test('sources() adds the standard sources plus the official site', () => {
  const cs = LANGUAGES.find((l) => l.id === 'csharp');
  expect(cs.sources.map((s) => s.label)).toEqual([
    'Stack Overflow Developer Survey 2025',
    'GitHub Octoverse',
    'Indeed: C# developer jobs',
    'BLS: Software Developers outlook',
    'C# official site',
  ]);
  expect(cs.sources[2].url).toBe('https://www.indeed.com/jobs?q=C%23%20developer');
  expect(cs.sources[4].url).toBe('https://learn.microsoft.com/dotnet/csharp/');
});

test('sources() accepts a custom label for languages without an official site', () => {
  const sql = LANGUAGES.find((l) => l.id === 'sql');
  expect(sql.sources).toHaveLength(5);
  expect(sql.sources[4]).toEqual({
    label: 'PostgreSQL docs: The SQL Language',
    url: 'https://www.postgresql.org/docs/current/sql.html',
  });
});

test('languages missing from devicon use a local icon that exists', () => {
  const fs = require('fs');
  const sql = LANGUAGES.find((l) => l.id === 'sql');
  expect(sql.icon).toBe('icons/sql.svg');
  expect(fs.existsSync(path.join(__dirname, '..', sql.icon))).toBe(true);
});

test('every entry has the fields the detail panel renders', () => {
  for (const l of LANGUAGES) {
    expect(l).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: expect.any(String),
      icon: expect.any(String),
      tagline: expect.any(String),
      salary: { range: expect.any(String), note: expect.any(String) },
      difficulty: { level: expect.any(String), note: expect.any(String) },
      useCases: expect.any(String),
      jobMarket: expect.any(String),
      trend: expect.any(String),
      fact: expect.any(String),
      sources: expect.any(Array),
    }));
  }
});
