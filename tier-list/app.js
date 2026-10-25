/* Programming language tier list — React 18 + htm (no build step). */
const { useState, useRef, useEffect } = React;
const html = htm.bind(React.createElement);

const LANGUAGES = window.LANGUAGES; // defined in data.js

const TIERS = [
  { id: 'S', color: 'var(--tier-s)' },
  { id: 'A', color: 'var(--tier-a)' },
  { id: 'B', color: 'var(--tier-b)' },
  { id: 'C', color: 'var(--tier-c)' },
  { id: 'D', color: 'var(--tier-d)' },
];

// Keys that move a focused chip: S/A/B/C/D rank it, U returns it to the unranked tray.
const KEY_ZONE = { s: 'S', a: 'A', b: 'B', c: 'C', d: 'D', u: 'pool' };

const STORAGE_KEY = 'lang-tier-list-2026';
const byId = Object.fromEntries(LANGUAGES.map((l) => [l.id, l]));

// html2canvas draws SVG <img>s at their intrinsic size, so the icons come out clipped or blank.
// Redraw each loaded icon onto a canvas to get a plain PNG data URL it can render reliably.
const ICON_PX = 96;
function iconToPng(img) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ICON_PX;
  canvas.getContext('2d').drawImage(img, 0, 0, ICON_PX, ICON_PX);
  return canvas.toDataURL('image/png');
}

function initialBoard() {
  const empty = { pool: LANGUAGES.map((l) => l.id), S: [], A: [], B: [], C: [], D: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return empty;
    // Keep saved placements, drop removed languages, and put newly added ones in the pool.
    const board = { pool: [], S: [], A: [], B: [], C: [], D: [] };
    const seen = new Set();
    for (const zone of Object.keys(board)) {
      for (const id of saved[zone] || []) {
        if (byId[id] && !seen.has(id)) { board[zone].push(id); seen.add(id); }
      }
    }
    for (const l of LANGUAGES) if (!seen.has(l.id)) board.pool.push(l.id);
    return board;
  } catch (e) { /* ignore */ }
  return empty;
}


/* ---------- Components ---------- */

function Header({ onReset, onDownload, exporting }) {
  return html`
    <header className="site-header">
      <div className="container-xl d-flex align-items-center justify-content-between py-3 px-4">
        <a href="#" className="wordmark">
          <span className="wordmark-bars" aria-hidden="true">
            ${TIERS.map((t, i) => html`<i key=${t.id} style=${{ background: t.color, width: 26 - i * 4 }}></i>`)}
          </span>
          <span className="wordmark-text">2026 language tier list</span>
        </a>
        <div className="d-flex tw-gap-2">
          <button className="btn-ghost" onClick=${onReset}>Reset</button>
          <button className="btn-brand" onClick=${onDownload} disabled=${exporting}>
            ${exporting ? 'Exporting…' : 'Download PNG'}
          </button>
        </div>
      </div>
    </header>
  `;
}

function Hero() {
  return html`
    <section className="container-xl px-4 tw-pt-12 tw-pb-8">
      <h1 className="hero-title">Rank the 2026 programming languages</h1>
      <p className="hero-lead">
        Drag each language into a tier, or tap one to rank it and see its 2026 salary, job
        market and sources. When you're done, download your ranking as an image.
      </p>
    </section>
  `;
}

function Chip({ id, zone, landed, dragging, onOpen, onKeyMove, onDropBefore, onDragStart, onDragEnd, onHover }) {
  const lang = byId[id];
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(id); return; }
    const zone = KEY_ZONE[e.key.toLowerCase()];
    if (zone && !(e.ctrlKey || e.metaKey || e.altKey)) { e.preventDefault(); onKeyMove(id, zone); }
  };
  return html`
    <div
      className=${'chip' + (landed ? ' is-landed' : '') + (dragging ? ' is-dragging' : '')}
      data-id=${id}
      draggable="true"
      role="button"
      tabIndex="0"
      onDragStart=${(e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; onDragStart(id); }}
      onDragEnd=${onDragEnd}
      onDragOver=${(e) => { e.preventDefault(); onHover(zone, id); }}
      onDrop=${(e) => { e.preventDefault(); e.stopPropagation(); onDropBefore(e.dataTransfer.getData('text/plain'), id); }}
      onClick=${() => onOpen(id)}
      onKeyDown=${onKeyDown}
    >
      <span className="chip-icon">
        <img src=${lang.icon} alt="" crossOrigin="anonymous" />
      </span>
      <span>${lang.name}</span>
    </div>
  `;
}

// Faded stand-in for the chip being dragged, shown where it will land.
function Ghost({ id }) {
  const lang = byId[id];
  return html`
    <div className="chip chip-ghost" aria-hidden="true">
      <span className="chip-icon"><img src=${lang.icon} alt="" crossOrigin="anonymous" /></span>
      <span>${lang.name}</span>
    </div>
  `;
}

function DropZone({ zone, className, children, onDrop, onOver, onLeave }) {
  const [over, setOver] = useState(false);
  return html`
    <div
      className=${className + (over ? ' is-over' : '')}
      onDragOver=${(e) => { e.preventDefault(); setOver(true); onOver(e, zone); }}
      onDragLeave=${(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { setOver(false); onLeave(); } }}
      onDrop=${(e) => { e.preventDefault(); setOver(false); onDrop(e.dataTransfer.getData('text/plain'), zone); }}
    >
      ${children}
    </div>
  `;
}

// Preview of the exported image, with Cancel and Download.
function PreviewModal({ src, onCancel, onDownload }) {
  const cancelRef = useRef(null);
  const downloadRef = useRef(null);

  useEffect(() => { downloadRef.current.focus(); }, []);

  // Capture phase, so Escape closes only this dialog and not the detail panel behind it.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onCancel(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  // Two buttons are the only focusable things, so Tab and Shift+Tab just swap between them.
  const trapTab = (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    (document.activeElement === cancelRef.current ? downloadRef : cancelRef).current.focus();
  };

  return html`
    <div className="export-overlay" onClick=${(e) => e.target === e.currentTarget && onCancel()}>
      <div className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title" onKeyDown=${trapTab}>
        <h2 id="export-title" className="export-title">Preview your ranking</h2>
        <div className="export-scroll">
          <img className="export-preview" src=${src} alt="Your tier list as it will be downloaded" />
        </div>
        <div className="export-actions">
          <button className="btn-ghost" ref=${cancelRef} onClick=${onCancel}>Cancel</button>
          <button className="btn-brand" ref=${downloadRef} onClick=${onDownload}>Download</button>
        </div>
      </div>
    </div>
  `;
}

function PanelSection({ title, children }) {
  return html`
    <section className="panel-section">
      <h3 className="panel-heading">${title}</h3>
      ${children}
    </section>
  `;
}

function DetailPanel({ id, currentZone, onClose, onMove }) {
  const bodyRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Scroll back to the top when switching languages.
  useEffect(() => { bodyRef.current.scrollTop = 0; }, [id]);

  const lang = byId[id];
  const tier = TIERS.find((t) => t.id === currentZone);
  return html`
    <aside className="detail-panel" ref=${bodyRef} aria-label=${lang.name + ' details'}>
      <button type="button" className="panel-close" aria-label="Close" onClick=${onClose}>×</button>

      <div className="d-flex align-items-center tw-gap-4 mb-4 pe-5">
        <span className="panel-icon"><img src=${lang.icon} alt="" /></span>
        <div>
          <h2 className="panel-title mb-1">${lang.name}</h2>
          <div className="panel-tagline">
            ${tier && html`<span className="tier-badge" style=${{ background: tier.color }}>${tier.id}</span>`}
            ${lang.tagline}
          </div>
        </div>
      </div>

      <div className="row g-2 mb-4">
        <div className="col-6">
          <div className="stat-tile h-100">
            <div className="k">2026 US salary</div>
            <div className="v">${lang.salary.range}</div>
            <div className="n">${lang.salary.note}</div>
          </div>
        </div>
        <div className="col-6">
          <div className="stat-tile h-100">
            <div className="k">Difficulty</div>
            <div className="v">${lang.difficulty.level}</div>
            <div className="n">${lang.difficulty.note}</div>
          </div>
        </div>
      </div>

      <${PanelSection} title="Primary use cases"><p>${lang.useCases}</p><//>
      <${PanelSection} title="Job market"><p>${lang.jobMarket}</p><//>
      <${PanelSection} title="Trend direction"><p>${lang.trend}</p><//>
      <${PanelSection} title="Interesting fact"><p>${lang.fact}</p><//>

      <${PanelSection} title="Sources">
        <ul className="panel-sources">
          ${lang.sources.map((s) => html`
            <li key=${s.url}><a href=${s.url} target="_blank" rel="noopener">${s.label}</a> <span className="ext" aria-hidden="true">↗</span></li>
          `)}
        </ul>
        <p className="panel-note">Salary ranges are sample estimates. Check them against the sources above.</p>
      <//>

      <${PanelSection} title="Rank it">
        <div className="d-flex tw-gap-2 flex-wrap align-items-center">
          ${TIERS.map((t) => html`
            <button key=${t.id}
              className=${'tier-pick' + (currentZone === t.id ? ' is-current' : '')}
              style=${{ background: t.color }}
              onClick=${() => onMove(id, t.id)}>${t.id}</button>
          `)}
          <button className="btn-ghost ms-1" onClick=${() => onMove(id, 'pool')}>Unrank</button>
        </div>
      <//>
    </aside>
  `;
}

function App() {
  const [board, setBoard] = useState(initialBoard);
  const [openId, setOpenId] = useState(null);
  const [landed, setLanded] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState(null);
  const boardRef = useRef(null);
  const focusId = useRef(null);
  // Drag preview: which chip is being dragged and where it would land ({ zone, beforeId }).
  const [preview, setPreview] = useState(null);
  const previewRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)); } catch (e) { /* ignore */ }
  }, [board]);

  // After a keyboard move the chip is re-created in its new zone, so put focus back on it.
  useEffect(() => {
    if (focusId.current) {
      document.querySelector('.chip[data-id="' + focusId.current + '"]').focus();
      focusId.current = null;
    }
  });

  const zoneOf = (id) => Object.keys(board).find((z) => board[z].includes(id));

  // Move `id` into `zone`, optionally before `beforeId`.
  const move = (id, zone, beforeId = null) => {
    if (!id || !byId[id] || id === beforeId) return;
    setLanded(id);
    setBoard((prev) => {
      const next = Object.fromEntries(Object.entries(prev).map(([z, ids]) => [z, ids.filter((x) => x !== id)]));
      const list = next[zone];
      const idx = beforeId ? list.indexOf(beforeId) : -1;
      idx >= 0 ? list.splice(idx, 0, id) : list.push(id);
      return next;
    });
  };

  const showPreview = (zone, beforeId = null) => {
    const next = zone ? { zone, beforeId } : null;
    if (JSON.stringify(next) === JSON.stringify(previewRef.current)) return;
    previewRef.current = next;
    setPreview(next);
  };
  const endPreview = () => showPreview(null);
  const endDrag = () => { dragRef.current = null; endPreview(); };
  // Hovering the chip being dragged previews nothing: dropping there leaves it in place.
  const hoverChip = (zone, id) => showPreview(id === dragRef.current ? null : zone, id);
  // Hovering empty space keeps the preview where it is (the ghost itself shifts chips around),
  // unless the pointer is past the last chip, which means "put it at the end".
  const hoverZone = (e, zone) => {
    if (e.target.closest('.chip')) return;
    if (!previewRef.current || previewRef.current.zone !== zone) return showPreview(zone);
    const chips = e.currentTarget.querySelectorAll('.chip:not(.chip-ghost)');
    const last = chips[chips.length - 1] && chips[chips.length - 1].getBoundingClientRect();
    if (last && e.clientX > last.right && e.clientY >= last.top && e.clientY <= last.bottom) showPreview(zone);
  };
  const dropInto = (id, zone) => {
    const p = previewRef.current;
    const before = p && p.zone === zone ? p.beforeId : null;
    endDrag();
    move(id, zone, before);
  };

  const dropBefore = (dragId, targetId) => { endDrag(); move(dragId, zoneOf(targetId), targetId); };
  const keyMove = (id, zone) => { focusId.current = id; move(id, zone); };

  const reset = () => {
    setLanded(null);
    setBoard({ pool: LANGUAGES.map((l) => l.id), S: [], A: [], B: [], C: [], D: [] });
  };

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Renders the board to an image and opens the preview; nothing downloads until the user confirms.
  const previewPng = async () => {
    setExporting(true);
    try {
      const pngs = [...boardRef.current.querySelectorAll('img')].map(iconToPng);
      const canvas = await html2canvas(boardRef.current, {
        backgroundColor: '#0d1a2c', scale: 2, useCORS: true,
        // Swap the PNGs into html2canvas's copy of the page; the live icons stay untouched.
        onclone: (doc) => doc.querySelectorAll('.share-card img').forEach((img, i) => { img.src = pngs[i]; }),
      });
      setExportUrl(canvas.toDataURL('image/png'));
    } catch (err) {
      alert('Could not export PNG: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const closePreview = () => setExportUrl(null);
  const downloadPng = () => {
    const a = document.createElement('a');
    a.download = 'my-2026-language-tier-list.png';
    a.href = exportUrl;
    a.click();
    closePreview();
  };

  const renderChips = (ids, zone) => {
    const here = preview && preview.zone === zone;
    const ghost = here && dragRef.current ? html`<${Ghost} key="ghost" id=${dragRef.current} />` : null;
    const items = ids.map((id) => html`
      ${ghost && preview.beforeId === id && ghost}
      <${Chip} key=${id} id=${id} zone=${zone} landed=${landed === id} dragging=${dragRef.current === id}
        onOpen=${setOpenId} onKeyMove=${keyMove} onDropBefore=${dropBefore}
        onDragStart=${(dragId) => { dragRef.current = dragId; }} onDragEnd=${endDrag} onHover=${hoverChip} />
    `);
    return ghost && preview.beforeId === null ? [...items, ghost] : items;
  };

  return html`
    <div className=${"app-shell" + (openId ? " panel-open" : "")}>
      <${Header} onReset=${reset} onDownload=${previewPng} exporting=${exporting} />
      <${Hero} />

      <main className="container-xl px-4 tw-pb-10">
        <div ref=${boardRef} className="share-card">
          <div className="share-head">
            <h2 className="share-title">My 2026 language ranking</h2>
            <span className="share-date">${today}</span>
          </div>
          <div className="tiers">
            ${TIERS.map((t) => html`
              <${DropZone} key=${t.id} zone=${t.id} className=${'tier-row tier-' + t.id}
                onDrop=${dropInto} onOver=${hoverZone} onLeave=${endPreview}>
                <div className="tier-label">${t.id}</div>
                <div className="tier-drop">${renderChips(board[t.id], t.id)}</div>
              <//>
            `)}
          </div>
          <div className="share-foot">Made with the 2026 programming language tier list</div>
        </div>
      </main>

      <footer className="tray">
        <div className="container-xl px-4 py-3">
          <div className="d-flex align-items-baseline tw-gap-3 mb-2">
            <div className="tray-title">Unranked: ${board.pool.length}</div>
            <div className="tray-sub">
              Drag a language into a tier, or tap it to rank it.
              <span className="kbd-hint"> With a language focused, press S, A, B, C or D (U to unrank).</span>
            </div>
          </div>
          <${DropZone} zone="pool" className="tray-pool"
            onDrop=${dropInto} onOver=${hoverZone} onLeave=${endPreview}>
            ${board.pool.length
              ? renderChips(board.pool, 'pool')
              : html`<div className="tray-empty">All ranked. Download your PNG.</div>`}
          <//>
        </div>
      </footer>

      ${exportUrl && html`<${PreviewModal} src=${exportUrl} onCancel=${closePreview} onDownload=${downloadPng} />`}

      ${openId && html`
        <${DetailPanel} id=${openId} currentZone=${zoneOf(openId)}
          onClose=${() => setOpenId(null)} onMove=${(id, z) => move(id, z)} />
      `}
    </div>
  `;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
