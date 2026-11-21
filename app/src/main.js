// Neon Coast Cover Studio — editor UI.
// Multi-photo upload (local files only), per-panel photo pick with
// zoom/pan, click-preview to select a panel, undo/redo, and PNG export in
// the three common post sizes. A `?shot=` query sets up a fixed scene for
// a screenshot instead (see ./shots.js).
import { drawCover, renderCover, panelCount, layoutRects, GRADES, LAYOUTS, SIZES, TITLE_STYLES } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');

const SIZES_LIST = Object.keys(SIZES);

function freshPanels(layout) {
  return Array.from({ length: panelCount(layout) }, (_, i) => ({
    photo: i === 0 ? 0 : null, zoom: 1, panX: 0, panY: 0,
  }));
}

const state = {
  layout: 'quad',
  grade: 'neon',
  titleStyle: 'sunset',
  title: 'NEON SHORE',
  subtitle: 'a vice city story',
  badge: 'NEON COAST',
  size: '1080x1080',
  photos: [], // HTMLImageElement[]
  photoNames: [],
  panels: freshPanels('quad'),
  selected: 0,
};

// --- history (undo / redo) -----------------------------------------------
// Snapshots hold the plain state only; the photo images live outside them
// and are referenced by index, so history stays cheap.
const undoStack = [];
const redoStack = [];
function snapshot() {
  return JSON.parse(JSON.stringify({
    layout: state.layout, grade: state.grade, titleStyle: state.titleStyle,
    title: state.title, subtitle: state.subtitle, badge: state.badge,
    size: state.size, panels: state.panels, selected: state.selected,
    photoNames: state.photoNames,
  }));
}
function restore(snap) {
  Object.assign(state, {
    layout: snap.layout, grade: snap.grade, titleStyle: snap.titleStyle,
    title: snap.title, subtitle: snap.subtitle, badge: snap.badge,
    size: snap.size, panels: snap.panels, selected: snap.selected,
    photoNames: snap.photoNames,
  });
}
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
  syncUndoButtons();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  syncControls();
  redraw();
  syncUndoButtons();
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  syncControls();
  redraw();
  syncUndoButtons();
}
function syncUndoButtons() {
  $('undo').disabled = undoStack.length === 0;
  $('redo').disabled = redoStack.length === 0;
}

// --- rendering ------------------------------------------------------------
let lastRects = [];
function redraw() {
  const [w, h] = SIZES[state.size];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  lastRects = drawCover(ctx, w, h, state) || [];
  renderLibrary();
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${state.panels.length}`;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function addPhotos(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) { status('Pick an image file to add it.'); return; }
  pushHistory();
  for (const file of list) {
    const img = await loadImage(URL.createObjectURL(file));
    state.photos.push(img);
    state.photoNames.push(file.name);
  }
  // First photo fills every empty panel.
  state.panels.forEach((p) => { if (p.photo === null && state.photos.length) p.photo = 0; });
  syncControls();
  redraw();
  status(`Added ${list.length} photo${list.length > 1 ? 's' : ''} — ${state.photos.length} in the library.`);
}

async function loadSample(name) {
  const img = await loadImage(`samples/${name}.jpg`);
  state.photos = [img];
  state.photoNames = [`${name}.jpg (sample)`];
  state.panels = freshPanels(state.layout);
  return img;
}

// --- library + panel picking ----------------------------------------------
function renderLibrary() {
  const lib = $('library');
  lib.innerHTML = '';
  state.photos.forEach((img, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = state.photoNames[i] || `Photo ${i + 1}`;
    const t = document.createElement('img');
    t.src = img.src;
    t.alt = b.title;
    b.appendChild(t);
    const used = state.panels.some((p) => p.photo === i);
    if (used) b.classList.add('in-use');
    b.addEventListener('click', () => {
      pushHistory();
      state.panels[state.selected].photo = i;
      redraw();
      status(`Panel ${state.selected + 1} now shows ${b.title}.`);
    });
    lib.appendChild(b);
  });
  $('photoCount').textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'}`;
}

canvas.addEventListener('click', (e) => {
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * canvas.width;
  const y = ((e.clientY - r.top) / r.height) * canvas.height;
  const hit = lastRects.findIndex((rc) => x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h);
  if (hit >= 0) {
    state.selected = hit;
    syncPanelControls();
    redraw();
    status(`Selected panel ${hit + 1} — pick a photo or drag the sliders.`);
  }
});

function syncPanelControls() {
  const p = state.panels[state.selected];
  $('zoom').value = p?.zoom ?? 1;
  $('panX').value = p?.panX ?? 0;
  $('panY').value = p?.panY ?? 0;
  $('zoomVal').textContent = `${Math.round((p?.zoom ?? 1) * 100)}%`;
  $('panXVal').textContent = `${Math.round((p?.panX ?? 0) * 100)}`;
  $('panYVal').textContent = `${Math.round((p?.panY ?? 0) * 100)}`;
}

// --- controls ---------------------------------------------------------------
function buildButtonGroups() {
  const layoutBox = $('layouts');
  Object.entries(LAYOUTS).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.value = key;
    b.textContent = def.label;
    b.addEventListener('click', () => {
      if (state.layout === key) return;
      pushHistory();
      const old = state.panels;
      state.layout = key;
      state.panels = freshPanels(key);
      old.forEach((p, i) => { if (i < state.panels.length) state.panels[i] = { ...state.panels[i], ...p }; });
      state.selected = 0;
      syncControls();
      redraw();
    });
    layoutBox.appendChild(b);
  });
  const gradeBox = $('grades');
  Object.entries(GRADES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.value = key;
    b.textContent = def.label;
    b.addEventListener('click', () => {
      if (state.grade === key) return;
      pushHistory();
      state.grade = key;
      syncControls();
      redraw();
    });
    gradeBox.appendChild(b);
  });
  const styleBox = $('titleStyles');
  Object.entries(TITLE_STYLES).forEach(([key, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.value = key;
    b.textContent = label;
    b.addEventListener('click', () => {
      if (state.titleStyle === key) return;
      pushHistory();
      state.titleStyle = key;
      syncControls();
      redraw();
    });
    styleBox.appendChild(b);
  });
  const sizeBox = $('sizes');
  SIZES_LIST.forEach((key) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.value = key;
    b.textContent = key.replace('x', ' × ');
    b.addEventListener('click', () => {
      if (state.size === key) return;
      pushHistory();
      state.size = key;
      syncControls();
      redraw();
    });
    sizeBox.appendChild(b);
  });
}

function markActive(boxId, value) {
  document.querySelectorAll(`#${boxId} button`).forEach((b) => {
    b.classList.toggle('active', b.dataset.value === value);
  });
}

function syncControls() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('badge').value = state.badge;
  markActive('layouts', state.layout);
  markActive('grades', state.grade);
  markActive('titleStyles', state.titleStyle);
  markActive('sizes', state.size);
  syncPanelControls();
}

function status(msg) {
  statusEl.textContent = msg;
}

// --- export -----------------------------------------------------------------
function download(canvasEl, name) {
  canvasEl.toBlob((blob) => {
    if (!blob) { status('Export failed — nothing to save.'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status(`Saved ${name}`);
  }, 'image/png');
}

$('export').addEventListener('click', () => {
  download(renderCover(state, state.size), `neon-coast-${state.size}.png`);
});
$('exportAll').addEventListener('click', () => {
  SIZES_LIST.forEach((key, i) => {
    setTimeout(() => download(renderCover(state, key), `neon-coast-${key}.png`), i * 300);
  });
  status('Exporting all three sizes…');
});

// --- wiring -----------------------------------------------------------------
$('photo').addEventListener('change', (e) => addPhotos(e.target.files));
$('sampleBoulevard').addEventListener('click', async () => {
  pushHistory();
  await loadSample('boulevard');
  syncControls(); redraw();
  status('Loaded the Boulevard sample photo.');
});
$('samplePier').addEventListener('click', async () => {
  pushHistory();
  await loadSample('pier');
  syncControls(); redraw();
  status('Loaded the Pier sample photo.');
});
$('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
$('title').addEventListener('change', pushHistory);
$('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
$('subtitle').addEventListener('change', pushHistory);
$('badge').addEventListener('input', (e) => { state.badge = e.target.value; redraw(); });
$('badge').addEventListener('change', pushHistory);

function bindSlider(id, valId, key, fmt) {
  $(id).addEventListener('input', (e) => {
    const p = state.panels[state.selected];
    if (!p) return;
    p[key] = Number(e.target.value);
    $(valId).textContent = fmt(p[key]);
    redraw();
  });
  $(id).addEventListener('change', pushHistory);
}
bindSlider('zoom', 'zoomVal', 'zoom', (v) => `${Math.round(v * 100)}%`);
bindSlider('panX', 'panXVal', 'panX', (v) => `${Math.round(v * 100)}`);
bindSlider('panY', 'panYVal', 'panY', (v) => `${Math.round(v * 100)}`);

$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  }
});

buildButtonGroups();
syncControls();
syncUndoButtons();

// Screenshot scenes: ?shot=cover shows the cover alone, ?shot=editor the
// editor with a sample photo loaded. The default view is the live editor.
const query = new URLSearchParams(location.search);
const shot = query.get('shot');
if (shot) {
  runShot(shot, query, {
    loadSample,
    applyShot(patch) {
      pushHistory();
      if (patch.layout && patch.layout !== state.layout) {
        state.layout = patch.layout;
        state.panels = freshPanels(patch.layout);
      }
      Object.assign(state, {
        grade: patch.grade ?? state.grade,
        titleStyle: patch.titleStyle ?? state.titleStyle,
        title: patch.title ?? state.title,
        subtitle: patch.subtitle ?? state.subtitle,
        badge: patch.badge ?? state.badge,
        size: patch.size ?? state.size,
      });
      state.panels.forEach((p) => { if (p.photo === null && state.photos.length) p.photo = 0; });
      state.selected = 0;
      syncControls();
      redraw();
    },
  });
} else {
  redraw();
}
