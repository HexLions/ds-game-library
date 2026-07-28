const SUPPORTS_FS_API = 'showOpenFilePicker' in window;

// DS_LIBRARY comes from data.js — read-only reference list of all DS games.
// `collection` holds only the user's personal overrides, keyed by game id.
let collection = {};
let fileHandle = null;
let selectedId = null;
let activeRegion = '';
let ownedOnlyFilter = false;

const gridEl = document.getElementById('grid');
const fileStatus = document.getElementById('fileStatus');
const search = document.getElementById('search');
const sortBy = document.getElementById('sortBy');
const genreList = document.getElementById('genreList');
const badgeTotal = document.getElementById('badgeTotal');
const badgeOwned = document.getElementById('badgeOwned');
const badgeRated = document.getElementById('badgeRated');
const statusInfo = document.getElementById('statusInfo');
const regionPills = [...document.querySelectorAll('#regionPills .pill[data-region]')];
const ownedPill = document.getElementById('ownedPill');

const modal = document.getElementById('gameModal');
const form = document.getElementById('gameForm');

const CATALOG_INDEX = new Map(DS_LIBRARY.map((g, i) => [g.id, i + 1]));

function catalogNum(id) {
  return String(CATALOG_INDEX.get(id) || 0).padStart(4, '0');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function loadLocalBackup() {
  const raw = localStorage.getItem('dsCollection');
  if (raw) {
    try { collection = JSON.parse(raw); } catch { collection = {}; }
  }
}
function saveLocalBackup() {
  localStorage.setItem('dsCollection', JSON.stringify(collection));
}
function getOverride(id) { return collection[id] || null; }
function isOwned(id) { const o = getOverride(id); return !!(o && o.owned); }

let renderTimer = null;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 120);
}

function computeFilteredList() {
  const q = search.value.trim().toLowerCase();
  const sort = sortBy.value;

  let list = DS_LIBRARY.filter(g => {
    if (q && !g.t.toLowerCase().includes(q)) return false;
    if (ownedOnlyFilter && !isOwned(g.id)) return false;
    if (activeRegion && !g[activeRegion]) return false;
    return true;
  });

  if (sort === 'year') {
    list = list.slice().sort((a, b) => (a.y || '9999').localeCompare(b.y || '9999'));
  } else if (sort === 'rating') {
    list = list.slice().sort((a, b) => (getOverride(b.id)?.rating || 0) - (getOverride(a.id)?.rating || 0));
  } else if (sort === 'owned') {
    list = list.slice().sort((a, b) => (isOwned(b.id) ? 1 : 0) - (isOwned(a.id) ? 1 : 0) || a.t.localeCompare(b.t));
  } else {
    list = list.slice().sort((a, b) => a.t.localeCompare(b.t));
  }
  return list;
}

function tileCoverInner(game) {
  const ov = getOverride(game.id);
  const initial = escapeHtml(game.t.charAt(0).toUpperCase());
  const coverUrl = (ov && ov.cover) || game.c;
  return `<img src="${escapeHtml(coverUrl)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=\\'initial\\'>${initial}</span>'">`;
}

function render() {
  const list = computeFilteredList();

  gridEl.innerHTML = list.length
    ? list.map(g => {
        const owned = isOwned(g.id);
        return `<div class="tile${g.id === selectedId ? ' selected' : ''}" data-id="${g.id}">
          <div class="tile-cover">
            ${tileCoverInner(g)}
            <span class="ds-tag">DS</span>
            <span class="own-tag${owned ? ' owned' : ''}" data-toggle-own="${g.id}">${owned ? '✓' : ''}</span>
          </div>
          <div class="tile-caption"><span class="num mono">${catalogNum(g.id)} -</span>${escapeHtml(g.t)}</div>
        </div>`;
      }).join('')
    : '<p class="empty-msg">No games match these filters.</p>';

  badgeTotal.textContent = list.length.toLocaleString();
  updateOwnedRatedBadges();
  updateGenreOptions();
}

function updateOwnedRatedBadges() {
  const values = Object.values(collection);
  badgeOwned.textContent = values.filter(o => o.owned).length.toLocaleString();
  badgeRated.textContent = values.filter(o => o.rating > 0).length.toLocaleString();
}

function updateGenreOptions() {
  const genres = [...new Set(Object.values(collection).map(o => o.genre).filter(Boolean))].sort();
  genreList.innerHTML = genres.map(g => `<option value="${escapeHtml(g)}">`).join('');
}

function updateStatusBar() {
  if (!selectedId) {
    statusInfo.innerHTML = '<span class="status-empty">Select a game to see details</span>';
    return;
  }
  const game = DS_LIBRARY.find(g => g.id === selectedId);
  if (!game) return;
  const ov = getOverride(selectedId) || {};
  const rating = ov.rating ? '★'.repeat(ov.rating) : '';
  const parts = [
    `${game.d || 'Unknown dev'}${game.y ? ' · ' + game.y : ''}`,
    ov.owned ? 'Owned' : 'Not owned',
  ];
  if (rating) parts.push(rating);
  if (ov.playtime) parts.push(`${ov.playtime}h`);
  statusInfo.innerHTML = `<span class="status-title">${escapeHtml(game.t)}</span><span class="status-meta">${parts.map(escapeHtml).join(' · ')}</span>`;
}

function toggleOwned(id) {
  const ov = collection[id] || {};
  ov.owned = !ov.owned;
  const isEmpty = !ov.owned && !ov.cover && !ov.genre && !ov.rating && !ov.playtime && !ov.notes && (!ov.status || ov.status === 'notstarted');
  if (isEmpty) delete collection[id];
  else collection[id] = ov;
}

gridEl.addEventListener('click', async (e) => {
  const ownTag = e.target.closest('[data-toggle-own]');
  if (ownTag) {
    e.stopPropagation();
    const id = ownTag.dataset.toggleOwn;
    toggleOwned(id);
    await persist();
    if (id === selectedId) updateStatusBar();
    render();
    return;
  }
  const tile = e.target.closest('.tile');
  if (!tile) return;
  const id = tile.dataset.id;
  if (id === selectedId) {
    openModal(id);
  } else {
    selectedId = id;
    updateStatusBar();
    render();
  }
});

function openModal(id) {
  const game = DS_LIBRARY.find(g => g.id === id);
  if (!game) return;
  const ov = collection[id] || {};

  document.getElementById('modalTitle').textContent = game.t;
  document.getElementById('modalMeta').textContent =
    `${game.d || 'Unknown dev'} · ${game.p || 'Unknown publisher'}${game.y ? ' · ' + game.y : ''}`;
  document.getElementById('gameId').value = id;
  document.getElementById('fOwned').checked = !!ov.owned;
  document.getElementById('fCover').value = ov.cover || '';
  document.getElementById('fGenre').value = ov.genre || '';
  document.getElementById('fRating').value = ov.rating || 0;
  document.getElementById('fStatus').value = ov.status || 'notstarted';
  document.getElementById('fPlaytime').value = ov.playtime || 0;
  document.getElementById('fNotes').value = ov.notes || '';

  modal.showModal();
}

form.addEventListener('submit', async () => {
  const id = document.getElementById('gameId').value;
  const data = {
    owned: document.getElementById('fOwned').checked,
    cover: document.getElementById('fCover').value.trim(),
    genre: document.getElementById('fGenre').value.trim(),
    rating: Number(document.getElementById('fRating').value),
    status: document.getElementById('fStatus').value,
    playtime: Number(document.getElementById('fPlaytime').value) || 0,
    notes: document.getElementById('fNotes').value.trim(),
  };

  const isEmpty = !data.owned && !data.cover && !data.genre && !data.rating && !data.playtime && !data.notes && data.status === 'notstarted';
  if (isEmpty) delete collection[id];
  else collection[id] = data;

  await persist();
  if (id === selectedId) updateStatusBar();
  render();
});

document.getElementById('btnCancel').addEventListener('click', () => modal.close());

regionPills.forEach(pill => {
  pill.addEventListener('click', () => {
    regionPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeRegion = pill.dataset.region;
    render();
  });
});

ownedPill.addEventListener('click', () => {
  ownedOnlyFilter = !ownedOnlyFilter;
  ownedPill.classList.toggle('active', ownedOnlyFilter);
  render();
});

search.addEventListener('input', scheduleRender);
sortBy.addEventListener('change', render);

async function persist() {
  saveLocalBackup();
  if (SUPPORTS_FS_API && fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(collection, null, 2));
      await writable.close();
    } catch (e) {
      console.error('Auto-save failed', e);
    }
  }
}

async function openFile() {
  if (!SUPPORTS_FS_API) {
    document.getElementById('importInput').click();
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
    fileHandle = handle;
    const file = await handle.getFile();
    const text = await file.text();
    collection = JSON.parse(text || '{}');
    fileStatus.textContent = `Open: ${file.name}`;
    saveLocalBackup();
    render();
  } catch (e) {
    if (e.name !== 'AbortError') console.error(e);
  }
}

async function saveFile(forcePicker = false) {
  if (!SUPPORTS_FS_API) {
    exportJson();
    return;
  }
  try {
    if (!fileHandle || forcePicker) {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: 'ds-collection.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      fileStatus.textContent = `Open: ${fileHandle.name}`;
    }
    await persist();
  } catch (e) {
    if (e.name !== 'AbortError') console.error(e);
  }
}

function exportJson() {
  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ds-collection.json';
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('btnOpen').addEventListener('click', openFile);
document.getElementById('btnSave').addEventListener('click', () => saveFile(false));
document.getElementById('btnSaveAs').addEventListener('click', () => saveFile(true));
document.getElementById('btnExport').addEventListener('click', exportJson);
document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importInput').click());

document.getElementById('importInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    collection = JSON.parse(text);
    saveLocalBackup();
    render();
  } catch {
    alert('Invalid JSON file.');
  }
  e.target.value = '';
});

if (!SUPPORTS_FS_API) {
  document.getElementById('btnSaveAs').hidden = true;
  fileStatus.textContent = 'Browser storage mode (use Export/Import to save a file)';
}

// --- Theme toggle ---
const themeToggle = document.getElementById('themeToggle');
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'light' ? '🌙 Dark' : '☀ Light';
  localStorage.setItem('dsTheme', theme);
}
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});
applyTheme(localStorage.getItem('dsTheme') || 'dark');

// --- Clock ---
function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('clockIcon').textContent = time;
  document.getElementById('statusClock').textContent = time;
}
updateClock();
setInterval(updateClock, 30000);

loadLocalBackup();
render();
