/**
 * @jest-environment jsdom
 */
const path = require('path');
const React = require('react');
const ReactDOMClient = require('react-dom/client');
const htm = require('htm');

const { act } = React;
const ROOT = path.join(__dirname, '..');
const STORAGE_KEY = 'lang-tier-list-2026';

global.IS_REACT_ACT_ENVIRONMENT = true;

let root;

// app.js is a browser script: it reads React/ReactDOM/htm/html2canvas/window.LANGUAGES
// from globals and renders into #root as soon as it is loaded.
function mount() {
  document.body.innerHTML = '<div id="root"></div>';
  global.React = React;
  global.htm = htm;
  global.ReactDOM = { createRoot: (el) => (root = ReactDOMClient.createRoot(el)) };
  jest.isolateModules(() => require(path.join(ROOT, 'data.js')));
  act(() => {
    jest.isolateModules(() => require(path.join(ROOT, 'app.js')));
  });
}

/* ---------- DOM helpers ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const names = (el) => $$('.chip:not(.chip-ghost)', el).map((c) => c.textContent.trim());
const chip = (name) => $$('.chip:not(.chip-ghost)').find((c) => c.textContent.trim() === name);
const tierRow = (id) => $$('.tier-row').find((r) => $('.tier-label', r).textContent === id);
const pool = () => $('.tray-pool');
const panel = () => $('.detail-panel');
const button = (text, el = document) => $$('button', el).find((b) => b.textContent.trim() === text);

function dataTransfer(data = {}) {
  return {
    data: { ...data },
    effectAllowed: 'none',
    setData(k, v) { this.data[k] = v; },
    getData(k) { return this.data[k] ?? ''; },
  };
}

// jsdom has no DragEvent/DataTransfer, so build a MouseEvent and attach one.
function fire(el, type, { dt, ...init } = {}) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  if (dt) Object.defineProperty(ev, 'dataTransfer', { value: dt });
  act(() => { el.dispatchEvent(ev); });
  return ev;
}

function key(el, k) {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  act(() => { el.dispatchEvent(ev); });
  return ev;
}

const click = (el) => fire(el, 'click');
const dropOn = (el, id) => fire(el, 'drop', { dt: dataTransfer({ 'text/plain': id }) });

beforeEach(() => {
  localStorage.clear();
  global.html2canvas = jest.fn();
});

afterEach(() => {
  act(() => root.unmount());
  jest.restoreAllMocks();
});

describe('initial render', () => {
  test('renders header, hero, five tiers and every language in the unranked tray', () => {
    mount();
    expect($('.wordmark-text').textContent).toBe('2026 language tier list');
    expect($('.hero-title').textContent).toMatch(/Rank the 2026\s*programming languages/);
    expect($$('.tier-label').map((t) => t.textContent)).toEqual(['S', 'A', 'B', 'C', 'D']);
    expect(names(pool())).toEqual(window.LANGUAGES.map((l) => l.name));
    expect($('.app-shell').className).toBe('app-shell');
    expect(panel()).toBeNull();
  });

  test('chips use the language icon with CORS enabled for PNG export', () => {
    mount();
    const img = $('img', chip('Python'));
    expect(img.getAttribute('src')).toBe(window.LANGUAGES[0].icon);
    expect(img.getAttribute('crossorigin')).toBe('anonymous');
  });
});

describe('saved board (localStorage)', () => {
  test('restores saved placements, drops unknown/duplicate ids, adds new languages to the pool', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ S: ['python', 'python', 'cobol'], A: ['go'] }));
    mount();
    expect(names(tierRow('S'))).toEqual(['Python']);
    expect(names(tierRow('A'))).toEqual(['Go']);
    expect(names(pool())).toHaveLength(window.LANGUAGES.length - 2);
    expect(names(pool())).not.toContain('Python');
  });

  test('falls back to an empty board for invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    mount();
    expect(names(pool())).toHaveLength(window.LANGUAGES.length);
  });

  test('falls back to an empty board when the saved value is not an object', () => {
    localStorage.setItem(STORAGE_KEY, '5');
    mount();
    expect(names(pool())).toHaveLength(window.LANGUAGES.length);
  });

  test('saves the board after every change', () => {
    mount();
    dropOn(tierRow('S'), 'rust');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).S).toEqual(['rust']);
  });

  test('ignores storage write errors', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    mount();
    dropOn(tierRow('B'), 'php');
    expect(names(tierRow('B'))).toEqual(['PHP']);
  });
});

describe('drag and drop', () => {
  test('dragstart puts the language id on the dataTransfer', () => {
    mount();
    const dt = dataTransfer();
    fire(chip('Java'), 'dragstart', { dt });
    expect(dt.getData('text/plain')).toBe('java');
    expect(dt.effectAllowed).toBe('move');
  });

  test('dragover highlights a zone and dropping moves the chip into it', () => {
    mount();
    const row = tierRow('S');
    const over = fire(row, 'dragover');
    expect(over.defaultPrevented).toBe(true);
    expect(row.classList.contains('is-over')).toBe(true);

    dropOn(row, 'python');
    expect(row.classList.contains('is-over')).toBe(false);
    expect(names(tierRow('S'))).toEqual(['Python']);
    expect(names(pool())).not.toContain('Python');
  });

  test('dragleave keeps the highlight when moving onto a child, clears it when leaving', () => {
    mount();
    const row = tierRow('A');
    fire(row, 'dragover');
    fire(row, 'dragleave', { relatedTarget: $('.tier-label', row) });
    expect(row.classList.contains('is-over')).toBe(true);
    fire(row, 'dragleave', { relatedTarget: document.body });
    expect(row.classList.contains('is-over')).toBe(false);
  });

  test('dropping on a chip inserts before it, in the pool and in a tier', () => {
    mount();
    expect(fire(chip('Python'), 'dragover').defaultPrevented).toBe(true);
    dropOn(chip('Python'), 'go');
    expect(names(pool()).slice(0, 2)).toEqual(['Go', 'Python']);

    dropOn(tierRow('C'), 'java');
    dropOn(chip('Java'), 'rust');
    expect(names(tierRow('C'))).toEqual(['Rust', 'Java']);
  });

  test('dropping a ranked chip on the tray un-ranks it (appended at the end)', () => {
    mount();
    dropOn(tierRow('S'), 'python');
    dropOn(pool(), 'python');
    expect(names(tierRow('S'))).toEqual([]);
    expect(names(pool()).at(-1)).toBe('Python');
  });

  test('ignores drops without a valid language id', () => {
    mount();
    const before = names(pool());
    dropOn(tierRow('D'), '');
    dropOn(tierRow('D'), 'cobol');
    expect(names(tierRow('D'))).toEqual([]);
    expect(names(pool())).toEqual(before);
  });

  test('shows a message when every language is ranked, and Reset brings them back', () => {
    mount();
    for (const l of window.LANGUAGES) dropOn(tierRow('B'), l.id);
    expect(names(pool())).toEqual([]);
    expect(pool().textContent).toMatch(/All ranked/);

    click(button('Reset'));
    expect(names(tierRow('B'))).toEqual([]);
    expect(names(pool())).toHaveLength(window.LANGUAGES.length);
  });
});

describe('detail panel', () => {
  test('clicking a chip opens the panel with every section', () => {
    mount();
    click(chip('Rust'));
    const lang = window.LANGUAGES.find((l) => l.id === 'rust');
    const p = panel();
    expect(p.getAttribute('aria-label')).toBe('Rust details');
    expect($('.app-shell').classList.contains('panel-open')).toBe(true);
    expect($('.panel-title', p).textContent).toBe('Rust');
    expect($('.panel-tagline', p).textContent.trim()).toBe(lang.tagline);
    expect($('.tier-badge', p)).toBeNull();
    expect($$('.stat-tile .v', p).map((v) => v.textContent)).toEqual([lang.salary.range, lang.difficulty.level]);
    expect($$('.panel-heading', p).map((k) => k.textContent)).toEqual([
      'Primary use cases', 'Job market', 'Trend direction', 'Interesting fact', 'Sources', 'Rank it',
    ]);
    expect(p.textContent).toContain(lang.fact);
    expect($$('.panel-sources a', p).map((a) => a.getAttribute('href'))).toEqual(lang.sources.map((s) => s.url));
  });

  test('Enter and Space open the panel from the keyboard; other keys do not', () => {
    mount();
    const other = key(chip('Go'), 'x');
    expect(other.defaultPrevented).toBe(false);
    expect(panel()).toBeNull();

    expect(key(chip('Go'), 'Enter').defaultPrevented).toBe(true);
    expect($('.panel-title').textContent).toBe('Go');

    key(chip('Swift'), ' ');
    expect($('.panel-title').textContent).toBe('Swift');
  });

  test('switching languages resets the panel scroll position', () => {
    mount();
    click(chip('Python'));
    panel().scrollTop = 120;
    click(chip('Ruby'));
    expect($('.panel-title').textContent).toBe('Ruby');
    expect(panel().scrollTop).toBe(0);
  });

  test('tier buttons move the language and mark the current tier; Unrank returns it', () => {
    mount();
    click(chip('Kotlin'));
    expect($$('.tier-pick.is-current')).toHaveLength(0);

    click(button('A', panel()));
    expect(names(tierRow('A'))).toEqual(['Kotlin']);
    expect($('.tier-pick.is-current').textContent).toBe('A');
    expect($('.tier-badge', panel()).textContent).toBe('A');

    click(button('Unrank', panel()));
    expect(names(pool())).toContain('Kotlin');
    expect(names(tierRow('A'))).toEqual([]);
    expect(panel()).not.toBeNull();
  });

  test('closes with the × button', () => {
    mount();
    click(chip('Dart'));
    click($('.panel-close'));
    expect(panel()).toBeNull();
    expect($('.app-shell').classList.contains('panel-open')).toBe(false);
  });

  test('closes with Escape but not with other keys', () => {
    mount();
    click(chip('Scala'));
    key(window, 'Enter');
    expect(panel()).not.toBeNull();
    key(window, 'Escape');
    expect(panel()).toBeNull();
  });
});

describe('keyboard and landing animation', () => {
  test('S/A/B/C/D rank the focused chip and U sends it back, keeping focus on it', () => {
    mount();
    key(chip('Go'), 's');
    expect(names(tierRow('S'))).toEqual(['Go']);
    expect(document.activeElement).toBe(chip('Go'));

    key(chip('Go'), 'D');
    expect(names(tierRow('D'))).toEqual(['Go']);
    expect(names(tierRow('S'))).toEqual([]);

    key(chip('Go'), 'u');
    expect(names(pool())).toContain('Go');
    expect(document.activeElement).toBe(chip('Go'));
  });

  test('shortcuts with a modifier key or unrelated keys are left alone', () => {
    mount();
    for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
      const ev = new KeyboardEvent('keydown', { key: 'd', bubbles: true, cancelable: true, [mod]: true });
      act(() => { chip('Go').dispatchEvent(ev); });
      expect(ev.defaultPrevented).toBe(false);
    }
    expect(names(tierRow('D'))).toEqual([]);
    expect(key(chip('Go'), 'Tab').defaultPrevented).toBe(false);
  });

  test('only the chip that was just moved plays the landing animation; Reset clears it', () => {
    mount();
    expect($$('.chip.is-landed')).toHaveLength(0);
    dropOn(tierRow('A'), 'rust');
    expect($$('.chip.is-landed').map((c) => c.textContent.trim())).toEqual(['Rust']);
    click(button('Reset'));
    expect($$('.chip.is-landed')).toHaveLength(0);
  });
});

describe('drag preview', () => {
  const ghost = (el) => $('.chip-ghost', el);
  const start = (name) => fire(chip(name), 'dragstart', { dt: dataTransfer() });

  test('dragging over a tier shows a faded copy of the chip at the end and dims the original', () => {
    mount();
    dropOn(tierRow('A'), 'go');
    start('Python');
    fire(tierRow('A'), 'dragover');
    expect(ghost(tierRow('A')).textContent.trim()).toBe('Python');
    expect(names(tierRow('A'))).toEqual(['Go']);
    expect($('.chip.is-dragging').textContent.trim()).toBe('Python');
    expect(ghost(tierRow('S'))).toBeNull();
  });

  test('the preview also shows in the unranked tray', () => {
    mount();
    dropOn(tierRow('S'), 'python');
    start('Python');
    fire(pool(), 'dragover');
    expect(ghost(pool()).textContent.trim()).toBe('Python');
  });

  test('hovering a chip previews the drop before it, and dropping on empty space honours that spot', () => {
    mount();
    dropOn(tierRow('B'), 'java');
    dropOn(tierRow('B'), 'rust');
    start('Python');
    fire(chip('Rust'), 'dragover');
    expect(names(tierRow('B'))).toEqual(['Java', 'Rust']);
    expect(ghost(tierRow('B')).nextElementSibling.textContent.trim()).toBe('Rust');

    // The ghost shifts chips around; hovering the gap must not move the preview.
    fire(tierRow('B'), 'dragover');
    expect(ghost(tierRow('B')).nextElementSibling.textContent.trim()).toBe('Rust');

    dropOn(tierRow('B'), 'python');
    expect(names(tierRow('B'))).toEqual(['Java', 'Python', 'Rust']);
    expect(ghost(tierRow('B'))).toBeNull();
  });

  test('moving past the last chip puts the preview at the end; staying on its row keeps it', () => {
    mount();
    dropOn(tierRow('C'), 'java');
    dropOn(tierRow('C'), 'rust');
    start('Python');
    fire(chip('Java'), 'dragover');
    const rust = chip('Rust');
    rust.getBoundingClientRect = () => ({ right: 100, top: 0, bottom: 50 });

    fire(tierRow('C'), 'dragover', { clientX: 90, clientY: 25 });
    expect(ghost(tierRow('C')).nextElementSibling.textContent.trim()).toBe('Java');
    fire(tierRow('C'), 'dragover', { clientX: 200, clientY: 90 });
    expect(ghost(tierRow('C')).nextElementSibling.textContent.trim()).toBe('Java');
    fire(tierRow('C'), 'dragover', { clientX: 200, clientY: -5 });
    expect(ghost(tierRow('C')).nextElementSibling.textContent.trim()).toBe('Java');
    fire(tierRow('C'), 'dragover', { clientX: 200, clientY: 25 });
    expect(ghost(tierRow('C')).nextElementSibling).toBeNull();

    dropOn(tierRow('C'), 'python');
    expect(names(tierRow('C'))).toEqual(['Java', 'Rust', 'Python']);
  });

  test('an empty row has no last chip to measure, so the preview stays put', () => {
    mount();
    start('Python');
    fire(tierRow('D'), 'dragover');
    fire(tierRow('D'), 'dragover', { clientX: 300, clientY: 20 });
    expect(ghost(tierRow('D')).textContent.trim()).toBe('Python');
  });

  test('leaving the tier, ending the drag, or dropping removes the preview', () => {
    mount();
    start('Python');
    fire(tierRow('S'), 'dragover');
    fire(tierRow('S'), 'dragleave', { relatedTarget: $('.tier-label', tierRow('S')) });
    expect(ghost(tierRow('S'))).not.toBeNull();
    fire(tierRow('S'), 'dragleave', { relatedTarget: document.body });
    expect(ghost(tierRow('S'))).toBeNull();

    fire(tierRow('S'), 'dragover');
    fire(chip('Python'), 'dragend');
    expect(ghost(tierRow('S'))).toBeNull();
    expect($('.is-dragging')).toBeNull();

    start('Python');
    fire(tierRow('S'), 'dragover');
    dropOn(tierRow('S'), 'python');
    expect($('.chip-ghost')).toBeNull();
  });

  test('moving to another tier moves the preview; hovering the dragged chip previews nothing', () => {
    mount();
    start('Python');
    fire(tierRow('S'), 'dragover');
    fire(tierRow('A'), 'dragover');
    expect(ghost(tierRow('S'))).toBeNull();
    expect(ghost(tierRow('A'))).not.toBeNull();

    fire(chip('Python'), 'dragover');
    expect($('.chip-ghost')).toBeNull();
  });

  test('dropping a chip on itself leaves it where it is, and a stale preview from another tier is ignored', () => {
    mount();
    dropOn(tierRow('S'), 'python');
    dropOn(tierRow('S'), 'go');
    start('Python');
    dropOn(chip('Python'), 'python');
    expect(names(tierRow('S'))).toEqual(['Python', 'Go']);

    start('Go');
    fire(chip('Python'), 'dragover');
    dropOn(tierRow('B'), 'go');
    expect(names(tierRow('B'))).toEqual(['Go']);
  });

  test('without a dragstart there is nothing to preview', () => {
    mount();
    fire(tierRow('S'), 'dragover');
    expect($('.chip-ghost')).toBeNull();
    fire(chip('Python'), 'dragover');
    expect($('.chip-ghost')).toBeNull();
  });
});

describe('Download PNG', () => {
  const PNG = 'data:image/png;base64,AAAA';
  const modal = () => $('.export-dialog');

  // Opens the preview: rank a language, press Download PNG, let html2canvas resolve.
  async function openPreview() {
    mount();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: jest.fn() });
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,ICON');
    dropOn(tierRow('S'), 'python');
    global.html2canvas.mockResolvedValue({ toDataURL: (type) => `data:${type};base64,AAAA` });
    await act(async () => { click(button('Download PNG')); });
  }

  test('renders the board with html2canvas, swapping icons for PNGs, and shows a busy state', async () => {
    mount();
    const drawImage = jest.fn();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage });
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,ICON');
    dropOn(tierRow('S'), 'python');
    let finish;
    global.html2canvas.mockReturnValue(new Promise((r) => { finish = r; }));

    click(button('Download PNG'));
    expect(button('Exporting…').disabled).toBe(true);
    expect(modal()).toBeNull();
    const [target, opts] = global.html2canvas.mock.calls[0];
    expect(target.contains(tierRow('S'))).toBe(true);
    expect(opts).toMatchObject({ backgroundColor: '#0d1a2c', scale: 2, useCORS: true });

    // Icons are rasterized to PNGs and swapped into html2canvas's cloned DOM only.
    const clone = document.implementation.createHTMLDocument('');
    clone.body.innerHTML = '<div class="share-card"><img src="a.svg"></div>';
    opts.onclone(clone);
    expect([...clone.querySelectorAll('img')].map((i) => i.src)).toEqual(['data:image/png;base64,ICON']);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage.mock.calls[0][0].getAttribute('src')).toBe(window.LANGUAGES[0].icon);
    expect(drawImage.mock.calls[0].slice(1)).toEqual([0, 0, 96, 96]);

    await act(async () => { finish({ toDataURL: (type) => `data:${type};base64,AAAA` }); });
    expect(button('Download PNG').disabled).toBe(false);
  });

  test('shows a preview dialog instead of downloading straight away', async () => {
    const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await openPreview();
    expect(modal().getAttribute('aria-modal')).toBe('true');
    expect($('.export-title').textContent).toBe('Preview your ranking');
    expect($('.export-preview').getAttribute('src')).toBe(PNG);
    expect(button('Cancel', modal())).toBeDefined();
    expect(document.activeElement).toBe(button('Download', modal()));
    expect(anchorClick).not.toHaveBeenCalled();
  });

  test('Download in the dialog saves the previewed image and closes the dialog', async () => {
    const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      expect(this.download).toBe('my-2026-language-tier-list.png');
      expect(this.href).toBe(PNG);
    });
    await openPreview();
    click(button('Download', modal()));
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(modal()).toBeNull();
  });

  test('Cancel closes the dialog without downloading', async () => {
    const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await openPreview();
    click(button('Cancel', modal()));
    expect(modal()).toBeNull();
    expect(anchorClick).not.toHaveBeenCalled();
  });

  test('Escape closes only the dialog, not the detail panel behind it; other keys do nothing', async () => {
    await openPreview();
    click(chip('Python'));
    expect(panel()).not.toBeNull();
    key(window, 'Enter');
    expect(modal()).not.toBeNull();
    key(window, 'Escape');
    expect(modal()).toBeNull();
    expect(panel()).not.toBeNull();
  });

  test('clicking the backdrop closes the dialog, clicking inside it does not', async () => {
    await openPreview();
    click($('.export-preview'));
    expect(modal()).not.toBeNull();
    click($('.export-overlay'));
    expect(modal()).toBeNull();
  });

  test('Tab keeps focus inside the dialog by swapping between its two buttons', async () => {
    await openPreview();
    const cancel = button('Cancel', modal());
    const download = button('Download', modal());
    expect(key(download, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cancel);
    key(cancel, 'Tab');
    expect(document.activeElement).toBe(download);
    expect(key(download, 'a').defaultPrevented).toBe(false);
  });

  test('shows an alert when export fails and does not open the dialog', async () => {
    mount();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: jest.fn() });
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,ICON');
    global.html2canvas.mockRejectedValue(new Error('tainted canvas'));
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    await act(async () => { $('.btn-brand').click(); });
    expect(alert).toHaveBeenCalledWith('Could not export PNG: tainted canvas');
    expect(button('Download PNG').disabled).toBe(false);
    expect(modal()).toBeNull();
  });
});
