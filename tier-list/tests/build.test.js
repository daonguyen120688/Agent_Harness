/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Runs build.js with the filesystem mocked so the real dist/ is untouched.
function runBuild({ hasIcons, cwd }) {
  const rm = jest.spyOn(fs, 'rmSync').mockImplementation(() => {});
  const mkdir = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
  const copy = jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
  const cp = jest.spyOn(fs, 'cpSync').mockImplementation(() => {});
  const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(hasIcons);
  jest.spyOn(process, 'cwd').mockReturnValue(cwd);
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.isolateModules(() => require(path.join(ROOT, 'build.js')));
  return { rm, mkdir, copy, cp, exists, log };
}

afterEach(() => jest.restoreAllMocks());

test('recreates dist/ and copies every source file', () => {
  const { rm, mkdir, copy } = runBuild({ hasIcons: false, cwd: ROOT });
  expect(rm).toHaveBeenCalledWith(DIST, { recursive: true, force: true });
  expect(mkdir).toHaveBeenCalledWith(DIST, { recursive: true });
  expect(copy.mock.calls).toEqual(
    ['index.html', 'styles.css', 'data.js', 'app.js'].map((f) => [path.join(ROOT, f), path.join(DIST, f)]),
  );
});

test('skips icons/ when the folder does not exist', () => {
  const { cp, exists, log } = runBuild({ hasIcons: false, cwd: ROOT });
  expect(exists).toHaveBeenCalledWith(path.join(ROOT, 'icons'));
  expect(cp).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith('Built 4 files -> dist');
});

test('copies icons/ into dist/ when it exists', () => {
  const { cp } = runBuild({ hasIcons: true, cwd: ROOT });
  expect(cp).toHaveBeenCalledWith(path.join(ROOT, 'icons'), path.join(DIST, 'icons'), { recursive: true });
});

test('prints "dist" when run from inside dist/', () => {
  const { log } = runBuild({ hasIcons: false, cwd: DIST });
  expect(log).toHaveBeenCalledWith('Built 4 files -> dist');
});
