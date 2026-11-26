'use strict';

const STORAGE_KEY = 'scent-archive.collection.v1';
const LAYOUT_KEY = 'scent-archive.layout.v1';
const PAGE_SIZE = 24;
const KINDS = { decant: 'Decant', full_bottle: 'Full bottle', wishlist: 'Wishlist' };
const STATUSES = { owned: 'Owned', incoming: 'Incoming', gone: 'Gone' };
const TEXT_FIELDS = ['name', 'house', 'kind', 'status', 'seasons', 'occasions', 'longevity', 'photo_url', 'notes', 'gone_reason', 'gone_date'];
const NUMBER_FIELDS = ['size_ml', 'price_paid', 'sold_price'];
const CATALOGUE_FIELDS = [...TEXT_FIELDS, ...NUMBER_FIELDS, 'want_full_bottle'];
const MONEY = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const NUMBER = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 3 });
const NAME_ORDER = new Intl.Collator('en-CA', { sensitivity: 'base', numeric: true });

const ICONS = {
  archive: '<path d="M4 8h16v11H4zM3 4h18v4H3zM10 12h4"/>',
  bottle: '<path d="M9 3h6v4H9zM9 7v2l-3 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8l-3-2V7M6 14h12"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 4v12m-4-4 4 4 4-4M5 17v3h14v-3"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  heart: '<path d="M20.7 5.9a4.8 4.8 0 0 0-6.8 0L12 7.8l-1.9-1.9a4.8 4.8 0 0 0-6.8 6.8L12 21l8.7-8.3a4.8 4.8 0 0 0 0-6.8Z"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4 4"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4M5 17v3h14v-3"/>',
  vial: '<path d="M9 3h6v4H9zM9 7v12a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7M9 12h6"/>',
  wallet: '<path d="M20 8V6H6a2 2 0 0 1 0-4h12M4 4v14a2 2 0 0 0 2 2h14v-4M15 8h6v8h-6a4 4 0 0 1 0-8Zm1 4h.01"/>'
};

const byId = (id) => document.getElementById(id);
const catalogue = byId('collection');
const search = byId('search');
const kindFilter = byId('filter-kind');
const houseFilter = byId('filter-house');
const sort = byId('sort');
const statusButtons = [...document.querySelectorAll('[data-status]')];
const viewButtons = [...document.querySelectorAll('[data-view]')];
const detailDialog = byId('detail-dialog');
const editDialog = byId('edit-dialog');
const backupDialog = byId('backup-dialog');
const confirmDialog = byId('confirm-dialog');
const editor = byId('editor');
const importFile = byId('import-file');
const unlockForm = byId('unlock-form');

let records = null;
let activeStatus = 'all';
let visibleLimit = PAGE_SIZE;
let editingId = null;
let initialFields = {};
let toastTimer;

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content != null) node.textContent = content;
  return node;
}

function drawIcon(node, name) {
  node.setAttribute('aria-hidden', 'true');
  node.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" focusable="false">' + ICONS[name] + '</svg>';
}

function showMessage(id, message) {
  const node = byId(id);
  node.textContent = message;
  node.hidden = !message;
}

function notify(message, error = false) {
  clearTimeout(toastTimer);
  byId('toast').classList.toggle('is-error', error);
  showMessage('toast', message);
  toastTimer = setTimeout(() => showMessage('toast', ''), 4600);
}

function readCollection(text) {
  const data = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!Array.isArray(data)) throw new Error('Choose a JSON collection exported by Scent Archive or the original fragrance file.');

  const ids = new Set();
  for (const record of data) {
    const validId = typeof record?.id === 'string' || Number.isSafeInteger(record?.id);
    if (!validId || !String(record.id).trim() || ids.has(String(record.id)) || typeof record.name !== 'string' || !record.name.trim()) {
      throw new Error('Each record needs a fragrance name and a unique ID.');
    }
    if (!Object.hasOwn(KINDS, record.kind) || !Object.hasOwn(STATUSES, record.status)) {
      throw new Error('The file contains a fragrance kind or status this tracker doesn’t recognize.');
    }
    ids.add(String(record.id));
  }
  return data;
}

function loadCollection() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === null ? null : readCollection(saved);
}

function getLatestCollection() {
  try { return loadCollection() ?? records ?? []; }
  catch { return records ?? []; }
}

function saveCollection(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error('This browser couldn’t save the collection. Check that site storage is available and try again.');
  }
  openCollection(next);
}

function openCollection(next) {
  records = next;
  byId('welcome').hidden = records !== null;
  byId('workspace').hidden = records === null;
  byId('header-actions').hidden = records === null;
  if (records === null) return;

  refreshOverview();
  updateHouses();
  renderCollection();
}

function decodeBase64(text) {
  return Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
}

async function unlockCollection(code) {
  const seed = window.scentArchiveSeed;
  if (seed?.version !== 1 || !window.crypto?.subtle) {
    throw new Error('Unlock is available on the HTTPS site. You can also import your collection file.');
  }

  let plaintext;
  try {
    const key = await crypto.subtle.importKey('raw', decodeBase64(code), 'AES-GCM', false, ['decrypt']);
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decodeBase64(seed.iv) }, key, decodeBase64(seed.data));
  } catch {
    throw new Error('That code didn’t unlock the collection. Paste the full collection unlock code and try again.');
  }
  return readCollection(new TextDecoder().decode(plaintext));
}

function numeric(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function money(value, currency = 'CAD') {
  const amount = numeric(value);
  if (amount === null) return '';
  if (!currency || currency === 'CAD') return MONEY.format(amount);
  return NUMBER.format(amount) + ' ' + currency;
}

function size(value) {
  const amount = numeric(value);
  return amount === null ? '' : NUMBER.format(amount) + ' mL';
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
}

function countLabel(count, singular, plural = singular + 's') {
  return NUMBER.format(count) + ' ' + (count === 1 ? singular : plural);
}

function getHouses() {
  return [...new Set(records.map((record) => record.house).filter(Boolean))].sort(NAME_ORDER.compare);
}

function refreshOverview() {
  byId('stat-bottles').textContent = NUMBER.format(records.filter((record) => record.kind === 'full_bottle').length);
  byId('stat-decants').textContent = NUMBER.format(records.filter((record) => record.kind === 'decant').length);
  byId('stat-wishlist').textContent = NUMBER.format(records.filter((record) => record.kind === 'wishlist').length);
  const paidCents = records.reduce((cents, record) => {
    if (record.currency && record.currency !== 'CAD') return cents;
    return cents + Math.round((numeric(record.price_paid) ?? 0) * 100);
  }, 0);
  byId('stat-paid').textContent = money(paidCents / 100);
  byId('hero-description').textContent = countLabel(records.length, 'fragrance') + ' across ' + countLabel(getHouses().length, 'house');
  byId('count-all').textContent = NUMBER.format(records.length);
  for (const status of Object.keys(STATUSES)) {
    byId('count-' + status).textContent = NUMBER.format(records.filter((record) => record.status === status).length);
  }
}

function updateHouses() {
  const selectedHouse = houseFilter.value;
  houseFilter.replaceChildren(new Option('All houses', ''), ...getHouses().map((house) => new Option(house, house)));
  if ([...houseFilter.options].some((choice) => choice.value === selectedHouse)) houseFilter.value = selectedHouse;
}

function searchable(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function compareNumbers(a, b, descending) {
  const first = numeric(a);
  const second = numeric(b);
  if (first === null) return second === null ? 0 : 1;
  if (second === null) return -1;
  return descending ? second - first : first - second;
}

function sortRecords(data) {
  return data.sort((a, b) => {
    const byName = NAME_ORDER.compare(a.name, b.name) || NAME_ORDER.compare(a.house ?? '', b.house ?? '');
    switch (sort.value) {
      case 'house': return NAME_ORDER.compare(a.house || '\uFFFF', b.house || '\uFFFF') || byName;
      case 'recent': return compareNumbers(a.added_at, b.added_at, true) || compareNumbers(a.id, b.id, true) || byName;
      case 'price-high': return compareNumbers(a.price_paid, b.price_paid, true) || byName;
      case 'price-low': return compareNumbers(a.price_paid, b.price_paid, false) || byName;
      case 'size': return compareNumbers(a.size_ml, b.size_ml, true) || byName;
      default: return byName;
    }
  });
}

function getMatches() {
  const terms = searchable(search.value).trim().split(/\s+/).filter(Boolean);
  const kind = kindFilter.value;
  const house = houseFilter.value;
  const matches = records.filter((record) => {
    if (activeStatus !== 'all' && activeStatus !== record.status) return false;
    if (kind && kind !== record.kind) return false;
    if (house && house !== record.house) return false;
    if (!terms.length) return true;
    const haystack = searchable([record.name, record.house, record.notes, record.seasons, record.occasions, record.longevity].join(' '));
    return terms.every((term) => haystack.includes(term));
  });
  return sortRecords(matches);
}

function safePhotoUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' && !url.username && !url.password) ? url.href : '';
  } catch {
    return '';
  }
}

function createPhoto(record, lazy) {
  const photo = element('span', 'photo');
  photo.setAttribute('aria-hidden', 'true');
  photo.append(element('span', 'photo-fallback'));
  const url = safePhotoUrl(record.photo_url);
  if (url) {
    const image = element('img');
    image.alt = '';
    image.loading = lazy ? 'lazy' : 'eager';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('load', () => photo.classList.add('has-photo'), { once: true });
    image.addEventListener('error', () => image.remove(), { once: true });
    image.src = url;
    photo.append(image);
  }
  return photo;
}

function createStatusTag(record) {
  return element('span', 'status-tag status-' + record.status, STATUSES[record.status]);
}

function createCard(record) {
  const card = element('button', 'fragrance-card');
  card.type = 'button';
  card.dataset.fragrance = String(record.id);
  const media = element('span', 'card-media');
  media.append(createPhoto(record, true), createStatusTag(record));

  const info = element('span', 'card-info');
  const meta = element('span', 'card-meta');
  const volume = size(record.size_ml);
  const kindAndSize = [KINDS[record.kind], volume].filter(Boolean).join(' · ');
  meta.append(element('span', '', kindAndSize), element('span', 'card-price', money(record.price_paid, record.currency)));
  info.append(
    element('span', 'card-house', record.house || 'House unspecified'),
    element('span', 'card-title', record.name),
    meta
  );
  card.append(media, info);
  return card;
}

function hasFilters() {
  return Boolean(search.value.trim() || kindFilter.value || houseFilter.value || activeStatus !== 'all');
}

function renderCollection() {
  if (records === null) return;
  const matches = getMatches();
  const shown = matches.slice(0, visibleLimit);
  const filtered = hasFilters();
  const hasResults = matches.length > 0;

  catalogue.replaceChildren(...shown.map(createCard));
  catalogue.hidden = !hasResults;
  byId('clear-filters').hidden = !filtered;
  byId('empty-state').hidden = hasResults;
  byId('more-row').hidden = shown.length >= matches.length;
  byId('results-label').textContent = shown.length < matches.length
    ? 'Showing ' + NUMBER.format(shown.length) + ' of ' + countLabel(matches.length, 'fragrance')
    : countLabel(matches.length, 'fragrance');

  if (!hasResults) {
    byId('empty-title').textContent = filtered ? 'No matches' : 'Your collection is empty';
    byId('empty-copy').textContent = filtered ? 'Try a different search or clear your filters.' : 'Add a fragrance to start filling your archive.';
    byId('empty-action').textContent = filtered ? 'Clear filters' : 'Add fragrance';
  }
}

function onFilterChange() {
  visibleLimit = PAGE_SIZE;
  renderCollection();
}

function selectStatus(status) {
  activeStatus = status;
  for (const button of statusButtons) button.setAttribute('aria-pressed', String(button.dataset.status === status));
  onFilterChange();
}

function clearFilters() {
  search.value = '';
  kindFilter.value = '';
  houseFilter.value = '';
  selectStatus('all');
}

function setLayout(view) {
  const chosen = view === 'list' ? 'list' : 'grid';
  catalogue.classList.toggle('is-list', chosen === 'list');
  for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === chosen));
}

function appendFacts(parent, facts) {
  for (const [label, value] of facts) {
    if (!value) continue;
    const fact = element('div');
    fact.append(element('dt', '', label), element('dd', '', value));
    parent.append(fact);
  }
}

function showDetails(record) {
  const top = element('div', 'detail-top');
  const identity = element('div', 'detail-identity');
  const title = element('h2', '', record.name);
  title.id = 'detail-name';
  identity.append(element('p', 'detail-house', record.house || 'House unspecified'), title);
  const subtitle = [KINDS[record.kind], size(record.size_ml)].filter(Boolean).join(' · ');
  identity.append(element('p', 'detail-subtitle', subtitle), createStatusTag(record));
  top.append(createPhoto(record, false), identity);

  const main = element('div', 'detail-main');
  const facts = element('dl', 'detail-facts');
  const currency = record.currency || 'CAD';
  appendFacts(facts, [
    ['Price paid (' + currency + ')', money(record.price_paid, currency) || '—'],
    ['Seasons', record.seasons],
    ['Occasions', record.occasions],
    ['Longevity', record.longevity]
  ]);
  if (record.status === 'gone') {
    appendFacts(facts, [
      ['Reason', record.gone_reason],
      ['Date gone', formatDate(record.gone_date)],
      ['Sale price (' + currency + ')', money(record.sold_price, currency)]
    ]);
  }
  main.append(facts);

  if (record.want_full_bottle) {
    const shortlist = element('p', 'detail-shortlist');
    const icon = element('span');
    drawIcon(icon, 'heart');
    shortlist.append(icon, 'Want a full bottle');
    main.append(shortlist);
  }
  if (record.notes) {
    const notes = element('section', 'detail-notes');
    notes.append(element('h3', '', 'My notes'), element('p', '', record.notes));
    main.append(notes);
  }

  const actions = element('div', 'dialog-actions');
  const edit = element('button', 'button button-primary', 'Edit fragrance');
  edit.type = 'button';
  edit.addEventListener('click', () => {
    detailDialog.close();
    showEditor(record);
  });
  actions.append(edit);
  main.append(actions);
  byId('detail-content').replaceChildren(top, main);
  detailDialog.showModal();
  detailDialog.querySelector('[data-close]').focus();
}

function editorField(name) {
  return editor.elements.namedItem(name);
}

function readField(name) {
  const field = editorField(name);
  return field.type === 'checkbox' ? field.checked : field.value;
}

function syncDepartureFields() {
  const show = editorField('status').value === 'gone';
  const fields = byId('gone-fields');
  fields.hidden = !show;
  fields.disabled = !show;
}

function showEditor(record = null) {
  editingId = record ? String(record.id) : null;
  editor.reset();
  editorField('kind').value = 'decant';
  if (record) {
    for (const field of [...TEXT_FIELDS, ...NUMBER_FIELDS]) editorField(field).value = record[field] ?? '';
    editorField('gone_date').value = String(record.gone_date ?? '').slice(0, 10);
    editorField('want_full_bottle').checked = Boolean(record.want_full_bottle);
  }
  initialFields = Object.fromEntries(CATALOGUE_FIELDS.map((name) => [name, readField(name)]));
  const currency = record?.currency || 'CAD';
  byId('price-label').textContent = 'Price paid (' + currency + ')';
  byId('sale-label').textContent = 'Sale price (' + currency + ')';
  byId('editor-title').textContent = record ? 'Edit fragrance' : 'Add fragrance';
  byId('delete-fragrance').hidden = !record;
  showMessage('edit-error', '');
  syncDepartureFields();
  editDialog.showModal();
}

function collectChanges() {
  const changes = {};
  for (const name of CATALOGUE_FIELDS) {
    const value = readField(name);
    if (editingId !== null && value === initialFields[name]) continue;
    if (name === 'want_full_bottle') changes[name] = value;
    else if (NUMBER_FIELDS.includes(name)) changes[name] = numeric(value);
    else if (name === 'notes') changes[name] = value.trim() ? value : null;
    else changes[name] = value.trim() || null;
  }
  return changes;
}

function askForConfirmation(title, message, label, danger = false) {
  byId('confirm-title').textContent = title;
  byId('confirm-message').textContent = message;
  const action = byId('confirm-action');
  action.textContent = label;
  action.classList.toggle('danger-button', danger);
  confirmDialog.returnValue = '';
  confirmDialog.showModal();
  return new Promise((resolve) => {
    confirmDialog.addEventListener('close', () => resolve(confirmDialog.returnValue === 'confirm'), { once: true });
  });
}

function makeBackup() {
  const data = new Blob([JSON.stringify(getLatestCollection(), null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(data);
  const download = element('a');
  const today = new Date();
  const stamp = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  download.href = url;
  download.download = 'scent-archive-' + stamp + '.json';
  document.body.append(download);
  download.click();
  download.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

document.querySelectorAll('[data-icon]').forEach((node) => drawIcon(node, node.dataset.icon));
document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog').close('cancel'));
});
byId('confirm-action').addEventListener('click', () => confirmDialog.close('confirm'));

unlockForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = byId('unlock-code');
  const button = byId('unlock-button');
  button.disabled = true;
  showMessage('unlock-error', '');
  try {
    const unlocked = await unlockCollection(code.value.replace(/\s+/g, ''));
    if (records === null) saveCollection(unlocked);
    code.value = '';
    byId('add-button').focus();
  } catch (error) {
    showMessage('unlock-error', error.message);
  } finally {
    button.disabled = false;
  }
});

search.addEventListener('input', onFilterChange);
for (const control of [kindFilter, houseFilter, sort]) control.addEventListener('change', onFilterChange);
for (const button of statusButtons) button.addEventListener('click', () => selectStatus(button.dataset.status));
for (const button of viewButtons) {
  button.addEventListener('click', () => {
    setLayout(button.dataset.view);
    try { localStorage.setItem(LAYOUT_KEY, button.dataset.view); } catch { }
  });
}
byId('clear-filters').addEventListener('click', () => { clearFilters(); search.focus(); });
byId('empty-action').addEventListener('click', () => {
  if (hasFilters()) { clearFilters(); search.focus(); } else showEditor();
});
byId('show-more').addEventListener('click', () => {
  const position = visibleLimit;
  visibleLimit += PAGE_SIZE;
  renderCollection();
  catalogue.children[position]?.focus();
});
catalogue.addEventListener('click', (event) => {
  const card = event.target.closest('[data-fragrance]');
  if (!card) return;
  const record = records.find((item) => String(item.id) === card.dataset.fragrance);
  if (record) showDetails(record);
});

byId('add-button').addEventListener('click', () => showEditor());
editorField('status').addEventListener('change', syncDepartureFields);
editor.addEventListener('submit', (event) => {
  event.preventDefault();
  showMessage('edit-error', '');
  const name = editorField('name').value.trim();
  if (!name) {
    showMessage('edit-error', 'Enter a fragrance name.');
    editorField('name').focus();
    return;
  }

  const changes = collectChanges();
  if (changes.photo_url && !safePhotoUrl(changes.photo_url)) {
    showMessage('edit-error', 'Enter an HTTPS photo URL.');
    editorField('photo_url').focus();
    return;
  }

  try {
    const current = getLatestCollection();
    const id = editingId;
    if (id !== null && !current.some((record) => String(record.id) === id)) {
      throw new Error('This record was removed in another tab.');
    }
    const next = id === null
      ? [{ id: crypto.randomUUID(), currency: 'CAD', added_at: Date.now(), ...changes }, ...current]
      : current.map((record) => String(record.id) === id ? { ...record, ...changes } : record);
    saveCollection(next);
    editDialog.close();
    const card = [...catalogue.children].find((node) => node.dataset.fragrance === (id ?? next[0].id));
    (card || byId('add-button')).focus({ preventScroll: true });
    notify(id === null ? 'Fragrance added.' : 'Fragrance saved.');
  } catch (error) {
    showMessage('edit-error', error.message);
  }
});

byId('delete-fragrance').addEventListener('click', async () => {
  const id = editingId;
  const confirmed = await askForConfirmation('Delete this fragrance?', '“' + editorField('name').value + '” will be removed from this collection.', 'Delete fragrance', true);
  if (!confirmed) return;
  try {
    saveCollection(getLatestCollection().filter((record) => String(record.id) !== id));
    editDialog.close();
    search.focus({ preventScroll: true });
    notify('Fragrance deleted.');
  } catch (error) {
    showMessage('edit-error', error.message);
  }
});

byId('backup-button').addEventListener('click', () => backupDialog.showModal());
byId('welcome-import').addEventListener('click', () => importFile.click());
byId('import-button').addEventListener('click', () => {
  backupDialog.close();
  importFile.click();
});
byId('export-button').addEventListener('click', () => {
  backupDialog.close();
  try {
    makeBackup();
    notify('Collection backup downloaded.');
  } catch {
    notify('The browser couldn’t download the backup. Try again.', true);
  }
});

importFile.addEventListener('change', async () => {
  const selected = importFile.files[0];
  importFile.value = '';
  if (!selected) return;

  try {
    const incoming = readCollection(await selected.text());
    if (getLatestCollection().length) {
      const text = 'This file contains ' + countLabel(incoming.length, 'fragrance') + '. Importing it will replace the collection on this device.';
      if (!await askForConfirmation('Replace your collection?', text, 'Import collection')) return;
    }
    saveCollection(incoming);
    clearFilters();
    notify('Imported ' + countLabel(incoming.length, 'fragrance') + '.');
  } catch (error) {
    notify(error instanceof SyntaxError ? 'This file isn’t valid JSON. Choose the original collection file or a backup.' : error.message, true);
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    try { openCollection(loadCollection()); } catch { notify('The collection changed in another tab. Refresh to try again.', true); }
  }
});

try {
  setLayout(localStorage.getItem(LAYOUT_KEY));
  openCollection(loadCollection());
} catch {
  openCollection(null);
  showMessage('unlock-error', 'The saved collection couldn’t open. Try your unlock code or import a backup.');
}
