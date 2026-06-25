'use strict';

/* ===================== Constants ===================== */

const STORAGE_KEYS = {
  events: 'orbit_events',
  contacts: 'orbit_contacts',
  settings: 'orbit_settings',
  categories: 'orbit_categories',
  circles: 'orbit_circles',
  sync: 'orbit_sync_meta',
  seeded: 'orbit_seeded',
};

const THEME_COLORS = { dark: '#0a0a0f', light: '#eef0f6' };
const DEFAULT_ACCENT = '#00f5ff';

const DRIVE_CONFIG = {
  clientId: '34287822417-m8v2kvrrmigra9e0c1o0mph63sggnsf5.apps.googleusercontent.com',
  scope: 'https://www.googleapis.com/auth/drive.file',
  fileName: 'orbit-data.json',
};
const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

const DEFAULT_CATEGORIES = [
  { id: 'work',     label: 'Work / Focus',       color: '#00f5ff', icon: '💼' },
  { id: 'social',   label: 'Social / Friends',   color: '#bf5af2', icon: '🎉' },
  { id: 'health',   label: 'Health / Exercise',  color: '#39ff14', icon: '🏃' },
  { id: 'personal', label: 'Personal / Errands', color: '#f5a623', icon: '🧾' },
  { id: 'meal',     label: 'Meal / Food',        color: '#ff6ec7', icon: '🍽️' },
];

const DEFAULT_CIRCLES = [
  { id: 'family',       label: 'Family',          color: '#ff6ec7', icon: '👪' },
  { id: 'close',        label: 'Close Friends',   color: '#bf5af2', icon: '💜' },
  { id: 'friends',      label: 'Friends',         color: '#00f5ff', icon: '🎉' },
  { id: 'work',         label: 'Work',            color: '#f5a623', icon: '💼' },
  { id: 'acquaintance', label: 'Acquaintances',   color: '#39ff14', icon: '👋' },
];

const DEFAULT_REMINDER_PRESETS = [
  { minutes: 10, label: '10 minutes before' },
  { minutes: 30, label: '30 minutes before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
];
const DEFAULT_FOLLOWUP_PRESETS = [
  { id: 'weekly', label: 'Weekly', days: 7 },
  { id: 'monthly', label: 'Monthly', days: 30 },
  { id: 'quarterly', label: 'Every 3 months', days: 90 },
  { id: 'none', label: 'No reminder', days: null },
];

const EMOJI_CHOICES = ['🙂','😀','😎','🤓','🥳','😇','🤠','🧑','👩','👨','🧔','👱','👩‍🦱','👨‍🦱','👩‍🦰','🧑‍🦳','👩‍🦳','🧑‍🦲','🧑‍💼','👩‍💻','👨‍💻','🧑‍🎨','🧑‍🏫','🧑‍⚕️','🧑‍🍳','🧑‍🚀','🧑‍🎤','👵','👴','🐱','🐶','💼'];
const CATEGORY_ICON_CHOICES = ['💼','🎉','🏃','🧾','🍽️','📚','💪','🎨','🛒','✈️','🏠','💰','🎮','🧘','🐾','📞','🎵','⚽','🚗','💻','📅','❤️','🎓','🛠️'];

const TAG_SUGGESTIONS = ['close friend', 'friend', 'family', 'colleague', 'acquaintance'];

const HOUR_HEIGHT = 56; // px — keep in sync with style.css .hour-line/.hour-label

const REMINDER_GRACE_MS = 2 * 60 * 60 * 1000; // ignore reminders more than 2h stale
const DIGEST_HOUR = 8;

/* ===================== Storage ===================== */

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

/* ===================== State ===================== */

const initialSettings = Object.assign({
  dailyDigest: true,
  lastDigestDate: null,
  theme: 'dark',
  accentColor: DEFAULT_ACCENT,
  weekStartsOn: 'monday',
  defaultView: 'week',
  dayStartHour: 0,
  dayEndHour: 24,
  reminderPresets: DEFAULT_REMINDER_PRESETS.map(p => Object.assign({}, p)),
  followUpPresets: DEFAULT_FOLLOWUP_PRESETS.map(p => Object.assign({}, p)),
  peopleView: 'list',
}, loadJSON(STORAGE_KEYS.settings, {}));

const state = {
  events: loadJSON(STORAGE_KEYS.events, []),
  contacts: loadJSON(STORAGE_KEYS.contacts, []),
  categories: loadJSON(STORAGE_KEYS.categories, null) || DEFAULT_CATEGORIES.map(c => Object.assign({}, c)),
  circles: loadJSON(STORAGE_KEYS.circles, null) || DEFAULT_CIRCLES.map(c => Object.assign({}, c)),
  settings: initialSettings,
  sync: Object.assign({ connected: false, driveFileId: null, lastSyncedAt: null, lastLocalChangeAt: Date.now() }, loadJSON(STORAGE_KEYS.sync, {})),
  view: initialSettings.defaultView === 'month' ? 'month' : 'week',
  peopleView: initialSettings.peopleView === 'bubbles' ? 'bubbles' : 'list',
  currentDate: new Date(),
  screen: 'calendar',
  activeContactId: null,
  editingEventId: null,
  editingContactId: null,
  editingCategoryId: null,
  editingCircleId: null,
  pendingConfirmAction: null,
  selectedEventContactId: null,
  selectedCategory: 'work',
  selectedEmoji: '🙂',
  selectedCategoryIcon: '💼',
  selectedCircleIcon: '🎉',
  selectedContactCircleId: null,
  contactTags: [],
};

function persistEvents() { saveJSON(STORAGE_KEYS.events, state.events); markLocalChange(); }
function persistContacts() { saveJSON(STORAGE_KEYS.contacts, state.contacts); markLocalChange(); }
function persistSettings() { saveJSON(STORAGE_KEYS.settings, state.settings); markLocalChange(); }
function persistCategories() { saveJSON(STORAGE_KEYS.categories, state.categories); markLocalChange(); }
function persistCircles() { saveJSON(STORAGE_KEYS.circles, state.circles); markLocalChange(); }
function persistSync() { saveJSON(STORAGE_KEYS.sync, state.sync); }

function getCategoryMap() {
  const m = {};
  state.categories.forEach(c => { m[c.id] = c; });
  return m;
}
function getCategory(id) {
  return getCategoryMap()[id] || state.categories[0];
}
function getCircleMap() {
  const m = {};
  state.circles.forEach(c => { m[c.id] = c; });
  return m;
}
function getCircle(id) {
  return getCircleMap()[id] || state.circles[0];
}
function defaultCircleId() {
  return state.circles[0] ? state.circles[0].id : null;
}
function getFollowUpPresetMap() {
  const m = {};
  state.settings.followUpPresets.forEach(p => { m[p.id] = p; });
  return m;
}
function getFollowUpDays(id) {
  const p = getFollowUpPresetMap()[id];
  return p ? p.days : null;
}
function getFollowUpLabel(id) {
  const p = getFollowUpPresetMap()[id];
  return p ? p.label : 'No reminder';
}
function getDayStartHour() { return state.settings.dayStartHour; }
function getDayEndHour() { return state.settings.dayEndHour; }

/* ===================== Drive sync ===================== */

const driveSession = { status: 'signed-out', tokenClient: null, accessToken: null, tokenExpiresAt: 0, busy: false, queuedRetry: false };
let syncDebounceTimer = null;
let tokenResolve = null;
let tokenReject = null;

function isGisLoaded() {
  return !!(window.google && window.google.accounts && window.google.accounts.oauth2);
}

function markLocalChange() {
  state.sync.lastLocalChangeAt = Date.now();
  persistSync();
  scheduleSync('local-change');
}

function scheduleSync(reason) {
  if (!state.sync.connected) return;
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => { syncDebounceTimer = null; triggerSync(reason || 'debounced'); }, 2500);
}

function buildSyncDoc() {
  return {
    updatedAt: state.sync.lastLocalChangeAt,
    events: state.events,
    contacts: state.contacts,
    categories: state.categories,
    circles: state.circles,
    settings: state.settings,
  };
}

function applyRemoteDoc(remote) {
  state.events = Array.isArray(remote.events) ? remote.events : [];
  state.contacts = Array.isArray(remote.contacts) ? remote.contacts : [];
  state.categories = Array.isArray(remote.categories) && remote.categories.length ? remote.categories : state.categories;
  state.circles = Array.isArray(remote.circles) && remote.circles.length ? remote.circles : state.circles;
  state.settings = Object.assign({}, state.settings, remote.settings || {});
  saveJSON(STORAGE_KEYS.events, state.events);
  saveJSON(STORAGE_KEYS.contacts, state.contacts);
  saveJSON(STORAGE_KEYS.categories, state.categories);
  saveJSON(STORAGE_KEYS.circles, state.circles);
  saveJSON(STORAGE_KEYS.settings, state.settings);
  state.sync.lastLocalChangeAt = remote.updatedAt;

  applyTheme();
  applyAccentColor();
  buildCategoryPicker();
  buildCirclePicker();
  buildReminderOptions();
  buildFollowUpOptions();
  refreshCurrentScreen();
  if (state.screen === 'settings') renderSettings();
}

async function driveFetch(token, url, options) {
  const res = await fetch(url, Object.assign({}, options, {
    headers: Object.assign({ Authorization: `Bearer ${token}` }, (options && options.headers) || {}),
  }));
  if (!res.ok) {
    const err = new Error('Drive request failed: ' + res.status);
    err.status = res.status;
    err.authError = res.status === 401 || res.status === 403;
    throw err;
  }
  return res;
}

async function findOrCreateDriveFile(token) {
  const q = encodeURIComponent(`name='${DRIVE_CONFIG.fileName}' and trashed=false`);
  const listRes = await driveFetch(token, `${DRIVE_FILES_API}?q=${q}&spaces=drive&fields=files(id)`);
  const listData = await listRes.json();
  if (listData.files && listData.files.length) return listData.files[0].id;
  const createRes = await driveFetch(token, DRIVE_FILES_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_CONFIG.fileName }),
  });
  const created = await createRes.json();
  return created.id;
}

async function pullFromDrive(token, fileId) {
  const res = await driveFetch(token, `${DRIVE_FILES_API}/${fileId}?alt=media`);
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

async function pushToDrive(token, fileId, doc) {
  await driveFetch(token, `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
}

function getTokenClient() {
  if (!driveSession.tokenClient) {
    driveSession.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_CONFIG.clientId,
      scope: DRIVE_CONFIG.scope,
      callback: (resp) => {
        const resolve = tokenResolve, reject = tokenReject;
        tokenResolve = null; tokenReject = null;
        if (resp && resp.access_token) {
          driveSession.accessToken = resp.access_token;
          driveSession.tokenExpiresAt = Date.now() + Number(resp.expires_in || 3600) * 1000;
          if (resolve) resolve(resp.access_token);
        } else if (reject) {
          reject(new Error('No access token in response'));
        }
      },
      error_callback: (err) => {
        const reject = tokenReject;
        tokenResolve = null; tokenReject = null;
        if (reject) reject(err || new Error('Token request failed'));
      },
    });
  }
  return driveSession.tokenClient;
}

function requestAccessToken(promptMode) {
  return new Promise((resolve, reject) => {
    tokenResolve = resolve;
    tokenReject = reject;
    getTokenClient().requestAccessToken(promptMode === undefined ? {} : { prompt: promptMode });
  });
}

async function ensureAccessToken() {
  if (driveSession.accessToken && Date.now() < driveSession.tokenExpiresAt - 60000) return driveSession.accessToken;
  if (!isGisLoaded()) return null;
  try { return await requestAccessToken(''); } catch (e) { return null; }
}

async function connectDrive() {
  if (!isGisLoaded()) { showToast('Google sign-in is still loading — try again in a moment'); return; }
  driveSession.status = 'connecting';
  updateSyncUI();
  try {
    const token = await requestAccessToken();
    if (!token) throw new Error('no token');
    state.sync.connected = true;
    persistSync();
    driveSession.status = 'idle';
    updateSyncUI();
    showToast('Connected to Google Drive');
    triggerSync('connect');
  } catch (e) {
    driveSession.status = state.sync.connected ? 'needs-reauth' : 'signed-out';
    updateSyncUI();
    showToast('Could not connect to Google Drive');
  }
}

function disconnectDrive() {
  state.sync.connected = false;
  persistSync();
  driveSession.status = 'signed-out';
  driveSession.accessToken = null;
  driveSession.tokenExpiresAt = 0;
  if (syncDebounceTimer) { clearTimeout(syncDebounceTimer); syncDebounceTimer = null; }
  updateSyncUI();
  showToast('Disconnected from Google Drive');
}

async function triggerSync(reason) {
  if (!state.sync.connected) return;
  if (driveSession.busy) { driveSession.queuedRetry = true; return; }
  driveSession.busy = true;
  driveSession.status = 'syncing';
  updateSyncUI();
  try {
    const token = await ensureAccessToken();
    if (!token) { driveSession.status = 'needs-reauth'; return; }
    if (!state.sync.driveFileId) {
      state.sync.driveFileId = await findOrCreateDriveFile(token);
      persistSync();
    }
    const remote = await pullFromDrive(token, state.sync.driveFileId);
    if (remote && typeof remote.updatedAt === 'number' && remote.updatedAt > state.sync.lastLocalChangeAt) {
      applyRemoteDoc(remote);
    } else {
      await pushToDrive(token, state.sync.driveFileId, buildSyncDoc());
    }
    state.sync.lastSyncedAt = Date.now();
    persistSync();
    driveSession.status = 'idle';
  } catch (e) {
    driveSession.status = e && e.authError ? 'needs-reauth' : 'offline';
  } finally {
    driveSession.busy = false;
    updateSyncUI();
    if (driveSession.queuedRetry) { driveSession.queuedRetry = false; scheduleSync('retry'); }
  }
}

function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 30000) return 'just now';
  if (diff < 3600000) return Math.round(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.round(diff / 3600000) + 'h ago';
  return Math.round(diff / 86400000) + 'd ago';
}

function updateSyncUI() {
  const accountStatusEl = document.getElementById('sync-account-status');
  if (!accountStatusEl) return;
  const connectBtn = document.getElementById('btn-sync-connect');
  const statusRow = document.getElementById('row-sync-status');
  const statusText = document.getElementById('sync-status-text');
  const disconnectRow = document.getElementById('row-sync-disconnect');
  const syncNowBtn = document.getElementById('btn-sync-now');

  const connected = driveSession.status !== 'signed-out';
  connectBtn.classList.toggle('hidden', connected);
  statusRow.classList.toggle('hidden', !connected);
  disconnectRow.classList.toggle('hidden', !connected);
  accountStatusEl.textContent = connected ? 'Connected' : 'Not connected';

  switch (driveSession.status) {
    case 'connecting': statusText.textContent = 'Connecting…'; break;
    case 'syncing': statusText.textContent = 'Syncing…'; break;
    case 'offline': statusText.textContent = 'Offline — will sync when back online'; break;
    case 'needs-reauth': statusText.textContent = 'Sign-in expired — tap Sync now to reconnect'; break;
    default: statusText.textContent = state.sync.lastSyncedAt ? `Synced ${formatRelativeTime(state.sync.lastSyncedAt)}` : 'Connected — syncing soon';
  }
  connectBtn.disabled = driveSession.status === 'connecting';
  syncNowBtn.disabled = driveSession.status === 'connecting' || driveSession.status === 'syncing';
}

function waitForGis(attempt) {
  if (isGisLoaded()) { silentReconnect(); return; }
  if (attempt >= 15) { driveSession.status = 'needs-reauth'; updateSyncUI(); return; }
  setTimeout(() => waitForGis(attempt + 1), 300);
}

async function silentReconnect() {
  const token = await ensureAccessToken();
  if (token) {
    driveSession.status = 'idle';
    updateSyncUI();
    triggerSync('startup');
  } else {
    driveSession.status = 'needs-reauth';
    updateSyncUI();
  }
}

function initDriveSync() {
  if (!state.sync.connected) { driveSession.status = 'signed-out'; updateSyncUI(); return; }
  if (!navigator.onLine) { driveSession.status = 'offline'; updateSyncUI(); return; }
  driveSession.status = 'connecting';
  updateSyncUI();
  waitForGis(0);
}

function wireSyncLifecycleEvents() {
  window.addEventListener('online', () => { if (state.sync.connected) triggerSync('online'); });
  window.addEventListener('focus', () => { if (state.sync.connected) triggerSync('focus'); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.sync.connected) triggerSync('visible');
  });
}

function wireSyncSettings() {
  document.getElementById('btn-sync-connect').addEventListener('click', connectDrive);
  document.getElementById('btn-sync-now').addEventListener('click', () => {
    if (driveSession.status === 'needs-reauth') connectDrive();
    else triggerSync('manual');
  });
  document.getElementById('btn-sync-disconnect').addEventListener('click', () => {
    confirmDialog('Stop syncing this device with Google Drive? Your data stays on this device and in Drive.', () => {
      disconnectDrive();
    }, { title: 'Disconnect Google Drive', okLabel: 'Disconnect' });
  });
}

/* ===================== Theme ===================== */

function resolveTheme(theme) {
  if (theme === 'auto') return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  return theme === 'light' ? 'light' : 'dark';
}
function applyTheme() {
  const resolved = resolveTheme(state.settings.theme);
  document.documentElement.setAttribute('data-theme', resolved);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);
}
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (state.settings.theme === 'auto') applyTheme();
});

function hexToRgbTriplet(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
function applyAccentColor() {
  const color = state.settings.accentColor || DEFAULT_ACCENT;
  document.documentElement.style.setProperty('--cyan', color);
  document.documentElement.style.setProperty('--cyan-rgb', hexToRgbTriplet(color));
}

/* ===================== Date utils ===================== */

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function startOfWeek(d) {
  const x = startOfDay(d);
  const startDow = state.settings.weekStartsOn === 'sunday' ? 0 : 1;
  const dow = (x.getDay() - startDow + 7) % 7;
  return addDays(x, -dow);
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function pad2(n) { return String(n).padStart(2, '0'); }
function dateKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function timeKey(d) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function minutesOf(d) { return d.getHours() * 60 + d.getMinutes(); }
function combineDateTime(dateStr, timeStr) { return new Date(`${dateStr}T${timeStr}:00`); }
function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / 86400000); }

function formatDayHeader(d) { return d.toLocaleDateString(undefined, { weekday: 'short' }); }
function formatMonthYear(d) { return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
function formatTimeShort(d) { return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
function formatDateShort(d) { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function formatDateFull(d) { return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); }
function formatHourLabel(h) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}
function snapToHalfHour(d) {
  const x = new Date(d);
  const m = x.getMinutes();
  x.setSeconds(0, 0);
  if (m < 30) x.setMinutes(30);
  else { x.setMinutes(0); x.setHours(x.getHours() + 1); }
  return x;
}

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

/* ===================== Seed demo data ===================== */

function setTime(d, h, m) { const x = new Date(d); x.setHours(h, m, 0, 0); return x; }
function makeEvent(partial) {
  return Object.assign({ id: uid(), createdAt: new Date().toISOString(), reminderFired: false }, partial, {
    start: partial.start.toISOString(),
    end: partial.end.toISOString(),
  });
}
function makeContact(partial) {
  return Object.assign({ id: uid(), createdAt: new Date().toISOString() }, partial);
}

function seedDemoData() {
  if (localStorage.getItem(STORAGE_KEYS.seeded)) return;
  const now = new Date();

  const sam = makeContact({ name: 'Sam Rivera', emoji: '🧑‍🎤', tags: ['close friend'], lastSeen: dateKey(addDays(now, -10)), followUpFrequency: 'weekly', notes: 'Always up for tacos.', circleId: 'close', howMet: 'Climbing gym, 2019', introducedBy: null });
  const priya = makeContact({ name: 'Priya Desai', emoji: '👩‍👧', tags: ['family'], lastSeen: dateKey(addDays(now, -50)), followUpFrequency: 'monthly', notes: 'Sister — call more often!', circleId: 'family', howMet: 'Sister', introducedBy: null });
  const jess = makeContact({ name: 'Jess Patel', emoji: '🧑‍💻', tags: ['colleague'], lastSeen: dateKey(addDays(now, -5)), followUpFrequency: 'quarterly', notes: 'Work friend from the design team.', circleId: 'work', howMet: 'Design team at work', introducedBy: sam.id });

  const events = [
    makeEvent({ title: 'Q3 planning session', category: 'work', start: setTime(now, 9, 0), end: setTime(now, 10, 30), notes: '', reminderMinutes: 30, contactId: null }),
    makeEvent({ title: 'Dinner with Sam', category: 'meal', start: setTime(addDays(now, 1), 19, 0), end: setTime(addDays(now, 1), 20, 30), notes: 'That new ramen place downtown.', reminderMinutes: 60, contactId: sam.id }),
    makeEvent({ title: 'Morning run', category: 'health', start: setTime(addDays(now, 2), 7, 0), end: setTime(addDays(now, 2), 7, 45), notes: '', reminderMinutes: null, contactId: null }),
    makeEvent({ title: 'Dentist appointment', category: 'personal', start: setTime(addDays(now, 4), 14, 0), end: setTime(addDays(now, 4), 14, 30), notes: '', reminderMinutes: 1440, contactId: null }),
  ];

  state.contacts = [sam, priya, jess];
  state.events = events;
  persistContacts();
  persistEvents();
  localStorage.setItem(STORAGE_KEYS.seeded, '1');
}

/* ===================== Contact computed helpers ===================== */

function getContactPastEvents(contactId) {
  const now = new Date();
  return state.events
    .filter(e => e.contactId === contactId && new Date(e.end) <= now)
    .sort((a, b) => new Date(b.start) - new Date(a.start));
}
function getContactFutureEvents(contactId) {
  const now = new Date();
  return state.events
    .filter(e => e.contactId === contactId && new Date(e.start) > now)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
}
function getEffectiveLastSeen(contact) {
  let latest = contact.lastSeen ? new Date(contact.lastSeen) : null;
  const past = getContactPastEvents(contact.id);
  if (past.length) {
    const evDate = new Date(past[0].start);
    if (!latest || evDate > latest) latest = evDate;
  }
  return latest;
}
function getContactStatus(contact) {
  const lastSeen = getEffectiveLastSeen(contact);
  const future = getContactFutureEvents(contact.id);
  const nextPlanned = future.length ? new Date(future[0].start) : null;
  const thresholdDays = getFollowUpDays(contact.followUpFrequency);
  const daysSince = lastSeen ? daysBetween(lastSeen, new Date()) : null;

  let isOverdue = false, daysOverdue = null;
  if (thresholdDays != null) {
    if (lastSeen == null) { isOverdue = true; daysOverdue = Infinity; }
    else if (daysSince > thresholdDays) { isOverdue = true; daysOverdue = daysSince - thresholdDays; }
  }

  let bucket = 'good';
  if (nextPlanned) bucket = 'upcoming';
  else if (isOverdue) bucket = 'overdue';

  return { lastSeen, daysSince, nextPlanned, isOverdue, daysOverdue, bucket };
}
function updateContactLastSeenFromEvent(contactId, eventEnd) {
  const c = state.contacts.find(x => x.id === contactId);
  if (!c) return;
  const cur = c.lastSeen ? new Date(c.lastSeen) : null;
  if (!cur || eventEnd > cur) {
    c.lastSeen = dateKey(eventEnd);
    persistContacts();
  }
}

/* ===================== Generic UI helpers ===================== */

function showToast(msg) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function confirmDialog(message, onConfirm, { title = 'Are you sure?', okLabel = 'Confirm' } = {}) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-ok').textContent = okLabel;
  state.pendingConfirmAction = onConfirm;
  openModal('modal-confirm');
}

function wireGenericModalClosers() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
  });
  document.getElementById('confirm-ok').addEventListener('click', () => {
    closeModal('modal-confirm');
    const fn = state.pendingConfirmAction;
    state.pendingConfirmAction = null;
    if (fn) fn();
  });
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    state.pendingConfirmAction = null;
    closeModal('modal-confirm');
  });
}

/* ===================== Navigation ===================== */

function switchScreen(screen) {
  state.screen = screen;
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('screen-' + screen).classList.remove('hidden');

  document.querySelectorAll('.nav-btn[data-screen]').forEach(b => {
    b.classList.toggle('active', b.dataset.screen === screen || (screen === 'contact-profile' && b.dataset.screen === 'people'));
  });

  ['calendar-controls', 'people-controls', 'profile-controls', 'settings-controls'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  const controlsMap = { calendar: 'calendar-controls', people: 'people-controls', 'contact-profile': 'profile-controls', settings: 'settings-controls' };
  document.getElementById(controlsMap[screen]).classList.remove('hidden');

  if (screen === 'calendar') renderCalendar();
  else if (screen === 'people') { setActivePeopleViewToggle(state.peopleView); renderPeople(); }
  else if (screen === 'contact-profile') renderContactProfile(state.activeContactId);
  else if (screen === 'settings') renderSettings();
}

function refreshCurrentScreen() {
  if (state.screen === 'calendar') renderCalendar();
  else if (state.screen === 'people') renderPeople();
  else if (state.screen === 'contact-profile') renderContactProfile(state.activeContactId);
}

function wireBottomNav() {
  document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  });
  document.getElementById('btn-quick-add').addEventListener('click', () => openEventModal());
  document.getElementById('btn-back-people').addEventListener('click', () => switchScreen('people'));
}

/* ===================== Calendar rendering ===================== */

function renderCalendar() {
  updateCalendarLabel();
  if (state.view === 'week') {
    document.getElementById('week-view').classList.remove('hidden');
    document.getElementById('month-view').classList.add('hidden');
    renderWeek();
  } else {
    document.getElementById('week-view').classList.add('hidden');
    document.getElementById('month-view').classList.remove('hidden');
    renderMonth();
  }
}

function updateCalendarLabel() {
  const label = document.getElementById('calendar-label');
  if (state.view === 'week') {
    const start = startOfWeek(state.currentDate);
    const end = addDays(start, 6);
    if (start.getMonth() === end.getMonth()) {
      label.textContent = `${start.toLocaleDateString(undefined, { month: 'short' })} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
    } else {
      label.textContent = `${formatDateShort(start)} – ${formatDateShort(end)}, ${end.getFullYear()}`;
    }
  } else {
    label.textContent = formatMonthYear(state.currentDate);
  }
}

function layoutDayEvents(items) {
  items.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const clusters = [];
  let current = [], clusterEnd = -Infinity;
  for (const item of items) {
    if (current.length && item.startMin >= clusterEnd) { clusters.push(current); current = []; clusterEnd = -Infinity; }
    current.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  if (current.length) clusters.push(current);

  const result = [];
  for (const cluster of clusters) {
    const columnEnds = [];
    const colOf = new Map();
    for (const item of cluster) {
      let placed = false;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= item.startMin) { columnEnds[c] = item.endMin; colOf.set(item, c); placed = true; break; }
      }
      if (!placed) { columnEnds.push(item.endMin); colOf.set(item, columnEnds.length - 1); }
    }
    const totalCols = columnEnds.length;
    for (const item of cluster) result.push(Object.assign({}, item, { col: colOf.get(item), totalCols }));
  }
  return result;
}

function renderEventPill(p) {
  const cat = getCategory(p.ev.category);
  const pill = document.createElement('div');
  pill.className = 'event-pill';
  const top = ((p.startMin - getDayStartHour() * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(((p.endMin - p.startMin) / 60) * HOUR_HEIGHT, 26);
  pill.style.top = `${top}px`;
  pill.style.height = `${height}px`;
  pill.style.left = `${(p.col / p.totalCols) * 100}%`;
  pill.style.width = `calc(${(1 / p.totalCols) * 100}% - 3px)`;
  pill.style.setProperty('--cat-color', cat.color);
  pill.style.setProperty('--cat-glow', hexToRgba(cat.color, 0.35));
  if (height < 38) pill.classList.add('is-short');

  const start = new Date(p.ev.start), end = new Date(p.ev.end);
  pill.innerHTML = `
    <span class="event-pill-title"><span class="event-pill-icon">${cat.icon}</span>${escapeHtml(p.ev.title)}</span>
    <span class="event-pill-time">${formatTimeShort(start)} – ${formatTimeShort(end)}</span>
  `;
  pill.addEventListener('click', (e) => { e.stopPropagation(); openEventModal(p.ev.id); });
  return pill;
}

function renderWeek() {
  const weekStart = startOfWeek(state.currentDate);
  const today = new Date();

  const header = document.getElementById('week-header');
  header.innerHTML = '';
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    days.push(d);
    const head = document.createElement('div');
    head.className = 'day-head' + (isSameDay(d, today) ? ' is-today' : '');
    head.innerHTML = `<span class="day-head-dow">${formatDayHeader(d)}</span><span class="day-head-num">${d.getDate()}</span>`;
    head.addEventListener('click', () => { state.currentDate = d; renderCalendar(); });
    header.appendChild(head);
  }

  const dayStartHour = getDayStartHour(), dayEndHour = getDayEndHour();

  const hoursCol = document.getElementById('hours-col');
  hoursCol.innerHTML = '';
  for (let h = dayStartHour; h < dayEndHour; h++) {
    const lbl = document.createElement('div');
    lbl.className = 'hour-label';
    lbl.textContent = formatHourLabel(h);
    hoursCol.appendChild(lbl);
  }

  const daysGrid = document.getElementById('days-grid');
  daysGrid.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const d = days[i];
    const col = document.createElement('div');
    col.className = 'day-col';
    col.style.height = `${(dayEndHour - dayStartHour) * HOUR_HEIGHT}px`;
    for (let h = dayStartHour; h < dayEndHour; h++) {
      const line = document.createElement('div');
      line.className = 'hour-line';
      col.appendChild(line);
    }

    col.addEventListener('click', (e) => {
      if (e.target.closest('.event-pill')) return;
      const rect = col.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const minutesFromStart = (offsetY / HOUR_HEIGHT) * 60;
      const snapped = Math.round((dayStartHour * 60 + minutesFromStart) / 30) * 30;
      const startD = new Date(d);
      startD.setHours(0, snapped, 0, 0);
      openEventModal(null, { date: startD });
    });

    const dayItems = state.events
      .filter(ev => isSameDay(new Date(ev.start), d))
      .map(ev => {
        const startD = new Date(ev.start), endD = new Date(ev.end);
        const startMin = minutesOf(startD);
        const endMin = isSameDay(startD, endD) ? Math.max(startMin + 15, minutesOf(endD)) : dayEndHour * 60;
        return { ev, startMin, endMin };
      });
    layoutDayEvents(dayItems).forEach(p => col.appendChild(renderEventPill(p)));

    if (isSameDay(d, today)) {
      const nowMin = minutesOf(today);
      const line = document.createElement('div');
      line.className = 'now-line';
      line.style.top = `${((nowMin - dayStartHour * 60) / 60) * HOUR_HEIGHT}px`;
      col.appendChild(line);
    }

    daysGrid.appendChild(col);
  }

  const scrollEl = document.getElementById('week-scroll');
  if (!scrollEl.dataset.scrolled) {
    scrollEl.scrollTop = Math.max(0, (7 - dayStartHour) * HOUR_HEIGHT - 40);
    scrollEl.dataset.scrolled = '1';
  }
}

function renderMonth() {
  const monthStart = startOfMonth(state.currentDate);
  const gridStart = startOfWeek(monthStart);
  const today = new Date();

  const weekdayRow = document.getElementById('month-weekday-row');
  const dowLabels = state.settings.weekStartsOn === 'sunday'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  weekdayRow.innerHTML = dowLabels.map(d => `<span>${d}</span>`).join('');

  const grid = document.getElementById('month-grid');
  grid.innerHTML = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    const cell = document.createElement('div');
    cell.className = 'month-cell';
    if (d.getMonth() !== monthStart.getMonth()) cell.classList.add('is-other-month');
    if (isSameDay(d, today)) cell.classList.add('is-today');

    const dayEvents = state.events.filter(ev => isSameDay(new Date(ev.start), d)).sort((a, b) => new Date(a.start) - new Date(b.start));
    let dotsHtml = '';
    if (dayEvents.length) {
      dotsHtml += '<div class="month-cell-dots">' + dayEvents.slice(0, 3).map(ev => {
        const cat = getCategory(ev.category);
        return `<span class="month-dot" style="--dot-color:${cat.color}"></span>`;
      }).join('') + '</div>';
    }
    if (dayEvents.length > 3) dotsHtml += `<span class="month-cell-more">+${dayEvents.length - 3} more</span>`;

    cell.innerHTML = `<span class="month-cell-num">${d.getDate()}</span>${dotsHtml}`;
    cell.addEventListener('click', () => {
      state.currentDate = d;
      state.view = 'week';
      setActiveViewToggle('week');
      document.getElementById('week-scroll').removeAttribute('data-scrolled');
      renderCalendar();
      resetWeekScrollLeft();
    });
    grid.appendChild(cell);
  }
}

function setActiveViewToggle(view) {
  document.getElementById('btn-view-week').classList.toggle('active', view === 'week');
  document.getElementById('btn-view-month').classList.toggle('active', view === 'month');
}

function resetWeekScrollLeft() {
  const el = document.getElementById('week-scroll');
  if (el) el.scrollLeft = 0;
}

function wireCalendarControls() {
  document.getElementById('btn-prev').addEventListener('click', () => {
    state.currentDate = state.view === 'week' ? addDays(state.currentDate, -7) : addMonths(state.currentDate, -1);
    renderCalendar();
    resetWeekScrollLeft();
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    state.currentDate = state.view === 'week' ? addDays(state.currentDate, 7) : addMonths(state.currentDate, 1);
    renderCalendar();
    resetWeekScrollLeft();
  });
  document.getElementById('btn-today').addEventListener('click', () => {
    state.currentDate = new Date();
    document.getElementById('week-scroll').removeAttribute('data-scrolled');
    renderCalendar();
    resetWeekScrollLeft();
  });
  document.getElementById('btn-view-week').addEventListener('click', () => { state.view = 'week'; setActiveViewToggle('week'); renderCalendar(); });
  document.getElementById('btn-view-month').addEventListener('click', () => { state.view = 'month'; setActiveViewToggle('month'); renderCalendar(); });
}

/* ===================== Event modal ===================== */

function buildCategoryPicker() {
  const picker = document.getElementById('category-picker');
  picker.innerHTML = '';
  state.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-pill';
    btn.dataset.category = cat.id;
    btn.style.setProperty('--cat-color', cat.color);
    btn.style.setProperty('--cat-glow', hexToRgba(cat.color, 0.3));
    btn.innerHTML = `${cat.icon} ${cat.label.split(' / ')[0]}`;
    btn.addEventListener('click', () => { state.selectedCategory = cat.id; updateCategoryPickerUI(); });
    picker.appendChild(btn);
  });
  if (!state.categories.some(c => c.id === state.selectedCategory)) {
    state.selectedCategory = state.categories[0] ? state.categories[0].id : null;
  }
}
function updateCategoryPickerUI() {
  document.querySelectorAll('.category-pill').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.category === state.selectedCategory);
  });
}

function buildCirclePicker() {
  const picker = document.getElementById('circle-picker');
  if (!picker) return;
  picker.innerHTML = '';
  state.circles.forEach(circle => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'circle-pill';
    btn.dataset.circle = circle.id;
    btn.style.setProperty('--circle-color', circle.color);
    btn.style.setProperty('--circle-glow', hexToRgba(circle.color, 0.3));
    btn.innerHTML = `${circle.icon} ${circle.label}`;
    btn.addEventListener('click', () => { state.selectedContactCircleId = circle.id; updateCirclePickerUI(); });
    picker.appendChild(btn);
  });
  if (!state.circles.some(c => c.id === state.selectedContactCircleId)) {
    state.selectedContactCircleId = defaultCircleId();
  }
}
function updateCirclePickerUI() {
  document.querySelectorAll('.circle-pill').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.circle === state.selectedContactCircleId);
  });
}

function buildIntroducedByOptions(excludeId) {
  const sel = document.getElementById('contact-introduced-by');
  if (!sel) return;
  const options = state.contacts
    .filter(c => c.id !== excludeId)
    .sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = '<option value="">No one / not sure</option>' +
    options.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

function setEventContact(contactId) {
  state.selectedEventContactId = contactId || null;
  const chip = document.getElementById('event-contact-chip');
  const search = document.getElementById('event-contact-search');
  if (state.selectedEventContactId) {
    const c = state.contacts.find(x => x.id === state.selectedEventContactId);
    document.getElementById('event-contact-chip-label').textContent = c ? `${c.emoji} ${c.name}` : '';
    chip.classList.remove('hidden');
    search.classList.add('hidden');
  } else {
    chip.classList.add('hidden');
    search.classList.remove('hidden');
    search.value = '';
  }
  document.getElementById('event-contact-results').classList.add('hidden');
}

function renderContactResults(query) {
  const results = document.getElementById('event-contact-results');
  const q = query.trim().toLowerCase();
  const matches = q ? state.contacts.filter(c => c.name.toLowerCase().includes(q)) : state.contacts;
  results.innerHTML = '';
  if (!matches.length) {
    results.innerHTML = '<div class="combobox-empty">No contacts found</div>';
  } else {
    matches.forEach(c => {
      const row = document.createElement('div');
      row.className = 'combobox-result';
      row.innerHTML = `<span>${c.emoji}</span><span>${escapeHtml(c.name)}</span>`;
      row.addEventListener('click', () => setEventContact(c.id));
      results.appendChild(row);
    });
  }
  results.classList.remove('hidden');
}

function wireContactCombobox() {
  const search = document.getElementById('event-contact-search');
  search.addEventListener('input', (e) => renderContactResults(e.target.value));
  search.addEventListener('focus', (e) => renderContactResults(e.target.value));
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = document.querySelector('#event-contact-results .combobox-result');
      if (first) first.click();
    }
  });
  document.getElementById('event-contact-chip-remove').addEventListener('click', () => setEventContact(null));
  document.addEventListener('click', (e) => {
    const combo = document.getElementById('event-contact-combobox');
    if (!combo.contains(e.target)) document.getElementById('event-contact-results').classList.add('hidden');
  });
}

function openEventModal(eventId, options) {
  options = options || {};
  state.editingEventId = eventId || null;
  document.getElementById('event-form').reset();
  document.getElementById('event-delete').classList.toggle('hidden', !eventId);

  const reminderSelect = document.getElementById('event-reminder');
  if (eventId) {
    const ev = state.events.find(e => e.id === eventId);
    document.getElementById('event-modal-title').textContent = 'Edit event';
    document.getElementById('event-title').value = ev.title;
    const start = new Date(ev.start), end = new Date(ev.end);
    document.getElementById('event-date').value = dateKey(start);
    document.getElementById('event-start').value = timeKey(start);
    document.getElementById('event-end').value = timeKey(end);
    document.getElementById('event-notes').value = ev.notes || '';
    ensureReminderOption(reminderSelect, ev.reminderMinutes);
    reminderSelect.value = ev.reminderMinutes != null ? String(ev.reminderMinutes) : '';
    state.selectedCategory = ev.category;
    setEventContact(ev.contactId || null);
  } else {
    document.getElementById('event-modal-title').textContent = 'New event';
    const base = options.date || new Date();
    const start = snapToHalfHour(base);
    const end = new Date(start.getTime() + 60 * 60000);
    document.getElementById('event-date').value = dateKey(start);
    document.getElementById('event-start').value = timeKey(start);
    document.getElementById('event-end').value = timeKey(end);
    document.getElementById('event-notes').value = '';
    reminderSelect.value = '';
    state.selectedCategory = state.categories[0] ? state.categories[0].id : null;
    setEventContact(options.contactId || null);
  }
  updateCategoryPickerUI();
  openModal('modal-event');
}

function wireEventForm() {
  document.getElementById('event-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('event-title').value.trim();
    if (!title) return;
    const dateStr = document.getElementById('event-date').value;
    const start = combineDateTime(dateStr, document.getElementById('event-start').value);
    let end = combineDateTime(dateStr, document.getElementById('event-end').value);
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60000);

    const reminderVal = document.getElementById('event-reminder').value;
    const reminderMinutes = reminderVal ? parseInt(reminderVal, 10) : null;
    const notes = document.getElementById('event-notes').value.trim();
    const contactId = state.selectedEventContactId || null;

    if (state.editingEventId) {
      const ev = state.events.find(x => x.id === state.editingEventId);
      ev.title = title; ev.start = start.toISOString(); ev.end = end.toISOString();
      ev.category = state.selectedCategory; ev.notes = notes;
      if (ev.reminderMinutes !== reminderMinutes) ev.reminderFired = false;
      ev.reminderMinutes = reminderMinutes;
      ev.contactId = contactId;
    } else {
      state.events.push({
        id: uid(), title, start: start.toISOString(), end: end.toISOString(),
        category: state.selectedCategory, notes, reminderMinutes, reminderFired: false,
        contactId, createdAt: new Date().toISOString(),
      });
    }

    if (contactId && end <= new Date()) updateContactLastSeenFromEvent(contactId, end);

    persistEvents();
    closeModal('modal-event');
    refreshCurrentScreen();
    showToast('Event saved');
  });

  document.getElementById('event-delete').addEventListener('click', () => {
    const id = state.editingEventId;
    confirmDialog("Delete this event? This can't be undone.", () => {
      state.events = state.events.filter(e => e.id !== id);
      persistEvents();
      closeModal('modal-event');
      refreshCurrentScreen();
      showToast('Event deleted');
    }, { title: 'Delete event', okLabel: 'Delete' });
  });
}

/* ===================== CRM — People list ===================== */

function renderPeople() {
  document.getElementById('people-empty').classList.toggle('hidden', state.contacts.length > 0);
  document.getElementById('people-list-view').classList.toggle('hidden', state.peopleView === 'bubbles');
  document.getElementById('people-bubbles-view').classList.toggle('hidden', state.peopleView !== 'bubbles');

  if (state.peopleView === 'bubbles') {
    renderPeopleBubbles();
    return;
  }

  const overdue = [], upcoming = [], good = [];
  state.contacts.forEach(c => {
    const status = getContactStatus(c);
    if (status.bucket === 'upcoming') upcoming.push({ c, status });
    else if (status.bucket === 'overdue') overdue.push({ c, status });
    else good.push({ c, status });
  });
  overdue.sort((a, b) => (b.status.daysOverdue === Infinity ? 1e9 : b.status.daysOverdue) - (a.status.daysOverdue === Infinity ? 1e9 : a.status.daysOverdue));
  upcoming.sort((a, b) => a.status.nextPlanned - b.status.nextPlanned);
  good.sort((a, b) => (b.status.lastSeen || 0) - (a.status.lastSeen || 0));

  renderContactList('list-overdue', overdue, 'overdue');
  renderContactList('list-upcoming', upcoming, 'upcoming');
  renderContactList('list-good', good, 'good');
}

function renderPeopleBubbles() {
  const container = document.getElementById('people-bubbles-view');
  container.innerHTML = '';
  state.circles.forEach(circle => {
    const members = state.contacts.filter(c => (c.circleId || defaultCircleId()) === circle.id);
    if (!members.length) return;

    const cluster = document.createElement('div');
    cluster.className = 'bubble-cluster';
    cluster.style.setProperty('--circle-color', circle.color);
    cluster.innerHTML = `
      <div class="bubble-cluster-header">
        <span class="bubble-cluster-icon">${circle.icon}</span>
        <span class="bubble-cluster-label">${escapeHtml(circle.label)}</span>
        <span class="bubble-cluster-count">${members.length}</span>
      </div>
      <div class="bubble-cluster-bubbles"></div>
    `;
    const bubbles = cluster.querySelector('.bubble-cluster-bubbles');
    members.forEach(c => {
      const status = getContactStatus(c);
      const bubble = document.createElement('div');
      bubble.className = 'contact-bubble';
      bubble.innerHTML = `
        <div class="contact-bubble-avatar">${c.emoji}<span class="contact-bubble-dot status-dot-${status.bucket}"></span></div>
        <div class="contact-bubble-name">${escapeHtml(c.name)}</div>
      `;
      bubble.addEventListener('click', () => openContactProfile(c.id));
      bubbles.appendChild(bubble);
    });
    container.appendChild(cluster);
  });
}

function setActivePeopleViewToggle(view) {
  document.getElementById('btn-peopleview-list').classList.toggle('active', view !== 'bubbles');
  document.getElementById('btn-peopleview-bubbles').classList.toggle('active', view === 'bubbles');
}

function wirePeopleViewToggle() {
  document.getElementById('people-view-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-peopleview]');
    if (!btn) return;
    state.peopleView = btn.dataset.peopleview;
    state.settings.peopleView = state.peopleView;
    persistSettings();
    setActivePeopleViewToggle(state.peopleView);
    renderPeople();
  });
}

function renderContactList(containerId, items, bucket) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  items.forEach(({ c, status }) => {
    const row = document.createElement('div');
    row.className = 'contact-row';
    const tagsHtml = (c.tags || []).slice(0, 2).map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('');

    let statusHtml;
    if (bucket === 'overdue') {
      const txt = status.daysOverdue === Infinity ? 'Never logged' : `${status.daysOverdue}d overdue`;
      const critical = status.daysOverdue === Infinity || status.daysOverdue > 14;
      statusHtml = `<span class="status-overdue${critical ? ' is-critical' : ''}">${txt}</span>`;
    } else if (bucket === 'upcoming') {
      statusHtml = `<span class="status-upcoming">Next: ${formatDateShort(status.nextPlanned)}</span>`;
    } else {
      statusHtml = `<span class="status-good">${status.lastSeen ? `Seen ${status.daysSince}d ago` : 'Not logged'}</span>`;
    }

    row.innerHTML = `
      <div class="contact-avatar">${c.emoji}</div>
      <div class="contact-row-main">
        <div class="contact-row-name">${escapeHtml(c.name)}</div>
        <div class="contact-row-tags">${tagsHtml}</div>
      </div>
      <div class="contact-row-status">${statusHtml}</div>
    `;
    row.addEventListener('click', () => openContactProfile(c.id));
    container.appendChild(row);
  });
}

function openContactProfile(contactId) {
  state.activeContactId = contactId;
  switchScreen('contact-profile');
}

function eventRowHtml(ev) {
  const cat = getCategory(ev.category);
  const start = new Date(ev.start);
  return `<div class="event-row" data-event-id="${ev.id}">
    <span class="event-row-dot" style="--dot-color:${cat.color}"></span>
    <div class="event-row-main">
      <div class="event-row-title">${cat.icon} ${escapeHtml(ev.title)}</div>
      <div class="event-row-time">${formatDateFull(start)} · ${formatTimeShort(start)}</div>
    </div>
  </div>`;
}

function renderContactProfile(contactId) {
  const c = state.contacts.find(x => x.id === contactId);
  const content = document.getElementById('profile-content');
  if (!c) { content.innerHTML = ''; return; }
  document.getElementById('profile-title').textContent = c.name;

  const status = getContactStatus(c);
  const past = getContactPastEvents(c.id);
  const future = getContactFutureEvents(c.id);
  const tagsHtml = (c.tags || []).map(t => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('');
  const lastSeenText = status.lastSeen ? `${formatDateShort(status.lastSeen)} · ${status.daysSince}d ago` : 'Never logged';
  const nextText = status.nextPlanned ? formatDateShort(status.nextPlanned) : '—';
  const pastHtml = past.length ? past.map(eventRowHtml).join('') : '<p class="profile-notes profile-notes-empty">No past events linked yet.</p>';
  const futureHtml = future.length ? future.map(eventRowHtml).join('') : '<p class="profile-notes profile-notes-empty">Nothing planned yet.</p>';
  const statusLabel = status.bucket === 'overdue' ? 'Reach out' : status.bucket === 'upcoming' ? 'Upcoming' : 'All good';
  const circle = getCircle(c.circleId);
  const introducedByContact = c.introducedBy ? state.contacts.find(x => x.id === c.introducedBy) : null;
  const connectionParts = [];
  if (c.howMet) connectionParts.push(escapeHtml(c.howMet));
  if (introducedByContact) connectionParts.push(`Introduced by <a href="#" class="profile-link" data-introduced-by="${introducedByContact.id}">${escapeHtml(introducedByContact.name)}</a>`);
  const connectionHtml = connectionParts.length ? connectionParts.join('<br>') : 'No connection info yet.';

  content.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${c.emoji}</div>
      <div class="profile-name">${escapeHtml(c.name)}</div>
      <div class="profile-tags">${tagsHtml}</div>
      <div class="profile-circle-badge" style="--circle-color:${circle.color}">${circle.icon} ${escapeHtml(circle.label)}</div>
    </div>
    <div class="profile-stats">
      <div class="profile-stat"><div class="profile-stat-label">Last seen</div><div class="profile-stat-value">${lastSeenText}</div></div>
      <div class="profile-stat"><div class="profile-stat-label">Next planned</div><div class="profile-stat-value">${nextText}</div></div>
      <div class="profile-stat"><div class="profile-stat-label">Follow-up</div><div class="profile-stat-value">${getFollowUpLabel(c.followUpFrequency)}</div></div>
      <div class="profile-stat"><div class="profile-stat-label">Status</div><div class="profile-stat-value">${statusLabel}</div></div>
    </div>
    <div class="profile-actions">
      <button type="button" class="pill-btn pill-btn-primary" id="btn-plan-something">Plan something</button>
      <button type="button" class="pill-btn" id="btn-edit-contact">Edit</button>
    </div>
    <div class="profile-section-title">Connection</div>
    <div class="profile-notes${connectionParts.length ? '' : ' profile-notes-empty'}">${connectionHtml}</div>
    <div class="profile-section-title">Notes</div>
    <div class="profile-notes${c.notes ? '' : ' profile-notes-empty'}">${c.notes ? escapeHtml(c.notes) : 'No notes yet.'}</div>
    <div class="profile-section-title">Upcoming</div>
    <div>${futureHtml}</div>
    <div class="profile-section-title">History</div>
    <div>${pastHtml}</div>
  `;

  document.getElementById('btn-plan-something').addEventListener('click', () => openEventModal(null, { date: new Date(), contactId: c.id }));
  document.getElementById('btn-edit-contact').addEventListener('click', () => openContactModal(c.id));
  content.querySelectorAll('.event-row').forEach(row => {
    row.addEventListener('click', () => openEventModal(row.dataset.eventId));
  });
  const introLink = content.querySelector('.profile-link[data-introduced-by]');
  if (introLink) introLink.addEventListener('click', (e) => { e.preventDefault(); openContactProfile(introLink.dataset.introducedBy); });
}

/* ===================== CRM — Contact modal ===================== */

function buildEmojiGrid(gridElId, choices, onSelect) {
  const grid = document.getElementById(gridElId);
  grid.innerHTML = '';
  choices.forEach(em => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-option';
    btn.textContent = em;
    btn.addEventListener('click', () => {
      onSelect(em);
      grid.classList.add('hidden');
    });
    grid.appendChild(btn);
  });
}
function buildTagSuggestions() {
  const wrap = document.getElementById('tag-suggestions');
  wrap.innerHTML = '';
  TAG_SUGGESTIONS.forEach(tag => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-suggestion';
    btn.textContent = '+ ' + tag;
    btn.addEventListener('click', () => addTag(tag));
    wrap.appendChild(btn);
  });
}
function renderTagChips() {
  const wrap = document.getElementById('contact-tag-chips');
  wrap.innerHTML = '';
  state.contactTags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${escapeHtml(tag)} <button type="button">×</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      state.contactTags = state.contactTags.filter(t => t !== tag);
      renderTagChips();
    });
    wrap.appendChild(chip);
  });
}
function addTag(tag) {
  tag = tag.trim();
  if (!tag || state.contactTags.includes(tag)) return;
  state.contactTags.push(tag);
  renderTagChips();
}

function buildReminderOptions() {
  const sel = document.getElementById('event-reminder');
  sel.innerHTML = '<option value="">No reminder</option>' +
    state.settings.reminderPresets.map(p => `<option value="${p.minutes}">${escapeHtml(p.label)}</option>`).join('');
}
function ensureReminderOption(select, minutes) {
  if (minutes == null) return;
  const exists = Array.from(select.options).some(o => o.value === String(minutes));
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = String(minutes);
    opt.textContent = `${minutes} minutes before`;
    select.appendChild(opt);
  }
}
function buildFollowUpOptions() {
  const sel = document.getElementById('contact-frequency');
  sel.innerHTML = state.settings.followUpPresets.map(p => `<option value="${p.id}">${escapeHtml(p.label)}</option>`).join('');
}
function defaultFollowUpPresetId() {
  const presets = state.settings.followUpPresets;
  const monthly = presets.find(p => p.id === 'monthly');
  return monthly ? monthly.id : (presets[0] ? presets[0].id : '');
}

function wireContactModalWidgets() {
  document.getElementById('contact-emoji-btn').addEventListener('click', () => {
    document.getElementById('emoji-grid').classList.toggle('hidden');
  });
  const tagInput = document.getElementById('contact-tag-input');
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(e.target.value);
      e.target.value = '';
    }
  });
  tagInput.addEventListener('blur', (e) => {
    if (e.target.value.trim()) { addTag(e.target.value); e.target.value = ''; }
  });
}

function openContactModal(contactId) {
  state.editingContactId = contactId || null;
  document.getElementById('contact-form').reset();
  document.getElementById('emoji-grid').classList.add('hidden');
  document.getElementById('contact-delete').classList.toggle('hidden', !contactId);

  buildIntroducedByOptions(contactId);

  if (contactId) {
    const c = state.contacts.find(x => x.id === contactId);
    document.getElementById('contact-modal-title').textContent = 'Edit person';
    document.getElementById('contact-name').value = c.name;
    state.selectedEmoji = c.emoji;
    document.getElementById('contact-emoji-btn').textContent = c.emoji;
    state.contactTags = (c.tags || []).slice();
    state.selectedContactCircleId = c.circleId || defaultCircleId();
    document.getElementById('contact-howmet').value = c.howMet || '';
    document.getElementById('contact-introduced-by').value = c.introducedBy || '';
    document.getElementById('contact-lastseen').value = c.lastSeen || '';
    document.getElementById('contact-frequency').value = c.followUpFrequency;
    document.getElementById('contact-notes').value = c.notes || '';
  } else {
    document.getElementById('contact-modal-title').textContent = 'New person';
    state.selectedEmoji = '🙂';
    document.getElementById('contact-emoji-btn').textContent = '🙂';
    state.contactTags = [];
    state.selectedContactCircleId = defaultCircleId();
    document.getElementById('contact-howmet').value = '';
    document.getElementById('contact-introduced-by').value = '';
    document.getElementById('contact-lastseen').value = '';
    document.getElementById('contact-frequency').value = defaultFollowUpPresetId();
    document.getElementById('contact-notes').value = '';
  }
  renderTagChips();
  updateCirclePickerUI();
  openModal('modal-contact');
}

function wireContactForm() {
  document.getElementById('btn-add-contact').addEventListener('click', () => openContactModal(null));

  document.getElementById('contact-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('contact-name').value.trim();
    if (!name) return;
    const lastSeen = document.getElementById('contact-lastseen').value || null;
    const followUpFrequency = document.getElementById('contact-frequency').value;
    const notes = document.getElementById('contact-notes').value.trim();
    const circleId = state.selectedContactCircleId || defaultCircleId();
    const howMet = document.getElementById('contact-howmet').value.trim();
    const introducedBy = document.getElementById('contact-introduced-by').value || null;

    if (state.editingContactId) {
      const c = state.contacts.find(x => x.id === state.editingContactId);
      c.name = name; c.emoji = state.selectedEmoji; c.tags = state.contactTags.slice();
      c.lastSeen = lastSeen; c.followUpFrequency = followUpFrequency; c.notes = notes;
      c.circleId = circleId; c.howMet = howMet; c.introducedBy = introducedBy;
    } else {
      state.contacts.push({ id: uid(), name, emoji: state.selectedEmoji, tags: state.contactTags.slice(), lastSeen, followUpFrequency, notes, circleId, howMet, introducedBy, createdAt: new Date().toISOString() });
    }
    persistContacts();
    closeModal('modal-contact');
    refreshCurrentScreen();
    showToast('Person saved');
  });

  document.getElementById('contact-delete').addEventListener('click', () => {
    const id = state.editingContactId;
    confirmDialog('Delete this person? Linked events will be kept but unlinked.', () => {
      state.contacts = state.contacts.filter(c => c.id !== id);
      state.events.forEach(ev => { if (ev.contactId === id) ev.contactId = null; });
      state.contacts.forEach(c => { if (c.introducedBy === id) c.introducedBy = null; });
      persistContacts();
      persistEvents();
      closeModal('modal-contact');
      if (state.screen === 'contact-profile') switchScreen('people');
      else refreshCurrentScreen();
      showToast('Person deleted');
    }, { title: 'Delete person', okLabel: 'Delete' });
  });
}

/* ===================== Category manager ===================== */

function renderCategoryManager() {
  const list = document.getElementById('category-manager-list');
  list.innerHTML = '';
  state.categories.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'category-manager-row';
    row.innerHTML = `
      <span class="category-manager-swatch" style="--cat-color:${cat.color}"></span>
      <span class="category-manager-icon">${cat.icon}</span>
      <span class="category-manager-label">${escapeHtml(cat.label)}</span>
    `;
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'text-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openCategoryModal(cat.id));
    row.appendChild(editBtn);
    list.appendChild(row);
  });
}

function openCategoryModal(categoryId) {
  state.editingCategoryId = categoryId || null;
  document.getElementById('category-form').reset();
  document.getElementById('category-icon-grid').classList.add('hidden');
  document.getElementById('category-delete').classList.toggle('hidden', !categoryId);

  if (categoryId) {
    const cat = getCategoryMap()[categoryId];
    document.getElementById('category-modal-title').textContent = 'Edit category';
    document.getElementById('category-label').value = cat.label;
    document.getElementById('category-color').value = cat.color;
    state.selectedCategoryIcon = cat.icon;
    document.getElementById('category-icon-btn').textContent = cat.icon;
  } else {
    document.getElementById('category-modal-title').textContent = 'New category';
    document.getElementById('category-color').value = DEFAULT_ACCENT;
    state.selectedCategoryIcon = '💼';
    document.getElementById('category-icon-btn').textContent = '💼';
  }
  openModal('modal-category');
}

function wireCategoryModalWidgets() {
  document.getElementById('category-icon-btn').addEventListener('click', () => {
    document.getElementById('category-icon-grid').classList.toggle('hidden');
  });
}

function wireCategoryForm() {
  document.getElementById('btn-add-category').addEventListener('click', () => openCategoryModal(null));

  document.getElementById('category-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const label = document.getElementById('category-label').value.trim();
    if (!label) return;
    const color = document.getElementById('category-color').value;
    const icon = state.selectedCategoryIcon;

    if (state.editingCategoryId) {
      const cat = state.categories.find(c => c.id === state.editingCategoryId);
      cat.label = label; cat.color = color; cat.icon = icon;
    } else {
      state.categories.push({ id: uid(), label, color, icon });
    }
    persistCategories();
    closeModal('modal-category');
    renderCategoryManager();
    buildCategoryPicker();
    refreshCurrentScreen();
    showToast('Category saved');
  });

  document.getElementById('category-delete').addEventListener('click', () => {
    const id = state.editingCategoryId;
    if (state.categories.length <= 1) { showToast("Can't delete the last category"); return; }
    if (state.events.some(ev => ev.category === id)) {
      showToast('This category is used by an event — recategorize or delete those events first');
      return;
    }
    confirmDialog('Delete this category?', () => {
      state.categories = state.categories.filter(c => c.id !== id);
      persistCategories();
      closeModal('modal-category');
      renderCategoryManager();
      buildCategoryPicker();
      showToast('Category deleted');
    }, { title: 'Delete category', okLabel: 'Delete' });
  });
}

/* ===================== Circle manager ===================== */

function renderCircleManager() {
  const list = document.getElementById('circle-manager-list');
  list.innerHTML = '';
  state.circles.forEach(circle => {
    const row = document.createElement('div');
    row.className = 'category-manager-row';
    row.innerHTML = `
      <span class="category-manager-swatch" style="--cat-color:${circle.color}"></span>
      <span class="category-manager-icon">${circle.icon}</span>
      <span class="category-manager-label">${escapeHtml(circle.label)}</span>
    `;
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'text-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openCircleModal(circle.id));
    row.appendChild(editBtn);
    list.appendChild(row);
  });
}

function openCircleModal(circleId) {
  state.editingCircleId = circleId || null;
  document.getElementById('circle-form').reset();
  document.getElementById('circle-icon-grid').classList.add('hidden');
  document.getElementById('circle-delete').classList.toggle('hidden', !circleId);

  if (circleId) {
    const circle = getCircleMap()[circleId];
    document.getElementById('circle-modal-title').textContent = 'Edit circle';
    document.getElementById('circle-label').value = circle.label;
    document.getElementById('circle-color').value = circle.color;
    state.selectedCircleIcon = circle.icon;
    document.getElementById('circle-icon-btn').textContent = circle.icon;
  } else {
    document.getElementById('circle-modal-title').textContent = 'New circle';
    document.getElementById('circle-color').value = DEFAULT_ACCENT;
    state.selectedCircleIcon = '🎉';
    document.getElementById('circle-icon-btn').textContent = '🎉';
  }
  openModal('modal-circle');
}

function wireCircleModalWidgets() {
  document.getElementById('circle-icon-btn').addEventListener('click', () => {
    document.getElementById('circle-icon-grid').classList.toggle('hidden');
  });
}

function wireCircleForm() {
  document.getElementById('btn-add-circle').addEventListener('click', () => openCircleModal(null));

  document.getElementById('circle-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const label = document.getElementById('circle-label').value.trim();
    if (!label) return;
    const color = document.getElementById('circle-color').value;
    const icon = state.selectedCircleIcon;

    if (state.editingCircleId) {
      const circle = state.circles.find(c => c.id === state.editingCircleId);
      circle.label = label; circle.color = color; circle.icon = icon;
    } else {
      state.circles.push({ id: uid(), label, color, icon });
    }
    persistCircles();
    closeModal('modal-circle');
    renderCircleManager();
    buildCirclePicker();
    refreshCurrentScreen();
    showToast('Circle saved');
  });

  document.getElementById('circle-delete').addEventListener('click', () => {
    const id = state.editingCircleId;
    if (state.circles.length <= 1) { showToast("Can't delete the last circle"); return; }
    if (state.contacts.some(c => c.circleId === id)) {
      showToast('This circle has people in it — move them to another circle first');
      return;
    }
    confirmDialog('Delete this circle?', () => {
      state.circles = state.circles.filter(c => c.id !== id);
      persistCircles();
      closeModal('modal-circle');
      renderCircleManager();
      buildCirclePicker();
      showToast('Circle deleted');
    }, { title: 'Delete circle', okLabel: 'Delete' });
  });
}

/* ===================== Settings ===================== */

let deferredInstallPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function updateNotifPermissionUI() {
  const statusEl = document.getElementById('notif-permission-status');
  const btn = document.getElementById('btn-enable-notif');
  if (!('Notification' in window)) { statusEl.textContent = 'Not supported in this browser'; btn.classList.add('hidden'); return; }
  const perm = Notification.permission;
  if (perm === 'granted') { statusEl.textContent = 'Enabled'; btn.classList.add('hidden'); }
  else if (perm === 'denied') { statusEl.textContent = 'Blocked — enable in browser settings'; btn.classList.add('hidden'); }
  else { statusEl.textContent = 'Not enabled yet'; btn.classList.remove('hidden'); }
}

function updateInstallUI() {
  const el = document.getElementById('install-content');
  if (isStandalone()) { el.innerHTML = `<div class="install-ok">✓ Orbit is installed</div>`; return; }
  if (deferredInstallPrompt) {
    el.innerHTML = `<button type="button" class="pill-btn pill-btn-primary" id="btn-install-now">Install Orbit</button>`;
    document.getElementById('btn-install-now').addEventListener('click', async () => {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      updateInstallUI();
    });
    return;
  }
  if (isIOS()) {
    el.innerHTML = `<div class="install-instructions">On iPhone: tap the <b>Share</b> icon in Safari, then choose <b>Add to Home Screen</b>. Orbit will open full-screen, just like a native app.</div>`;
  } else {
    el.innerHTML = `<div class="install-instructions">Open this page in Chrome or Edge and use the browser menu → <b>Install app</b> (or <b>Add to Home Screen</b>).</div>`;
  }
}

function renderSettings() {
  document.getElementById('toggle-digest').checked = !!state.settings.dailyDigest;
  setActiveThemeToggle(state.settings.theme);
  document.getElementById('accent-color-input').value = state.settings.accentColor;
  renderCategoryManager();
  renderCircleManager();
  setActiveWeekStartToggle(state.settings.weekStartsOn);
  setActiveDefaultViewToggle(state.settings.defaultView);
  document.getElementById('select-day-start-hour').value = String(state.settings.dayStartHour);
  document.getElementById('select-day-end-hour').value = String(state.settings.dayEndHour);
  renderReminderPresetsEditor();
  renderFollowUpPresetsEditor();
  updateNotifPermissionUI();
  updateInstallUI();
  updateSyncUI();
}

function setActiveThemeToggle(theme) {
  document.querySelectorAll('#theme-toggle .view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeOption === theme);
  });
}
function setActiveWeekStartToggle(value) {
  document.querySelectorAll('#weekstart-toggle .view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.weekstartOption === value);
  });
}
function setActiveDefaultViewToggle(value) {
  document.querySelectorAll('#defaultview-toggle .view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.defaultviewOption === value);
  });
}

function buildHourSelects() {
  const startSel = document.getElementById('select-day-start-hour');
  const endSel = document.getElementById('select-day-end-hour');
  startSel.innerHTML = '';
  endSel.innerHTML = '';
  for (let h = 0; h < 24; h++) {
    const opt = document.createElement('option');
    opt.value = String(h);
    opt.textContent = formatHourLabel(h);
    startSel.appendChild(opt);
  }
  for (let h = 1; h <= 24; h++) {
    const opt = document.createElement('option');
    opt.value = String(h);
    opt.textContent = h === 24 ? '12 AM (next day)' : formatHourLabel(h);
    endSel.appendChild(opt);
  }
}

function renderReminderPresetsEditor() {
  const list = document.getElementById('reminder-preset-list');
  list.innerHTML = '';
  state.settings.reminderPresets.forEach(preset => {
    const row = document.createElement('div');
    row.className = 'preset-row';
    row.innerHTML = `<span class="preset-row-label">${escapeHtml(preset.label)}</span><span class="preset-row-value">${preset.minutes} min</span>`;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'preset-row-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      state.settings.reminderPresets = state.settings.reminderPresets.filter(p => p !== preset);
      persistSettings();
      renderReminderPresetsEditor();
      buildReminderOptions();
    });
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
}

function renderFollowUpPresetsEditor() {
  const list = document.getElementById('followup-preset-list');
  list.innerHTML = '';
  state.settings.followUpPresets.forEach(preset => {
    const row = document.createElement('div');
    row.className = 'preset-row';
    row.innerHTML = `<span class="preset-row-label">${escapeHtml(preset.label)}</span><span class="preset-row-value">${preset.days != null ? preset.days + 'd' : '—'}</span>`;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'preset-row-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      if (state.settings.followUpPresets.length <= 1) { showToast("Can't delete the last follow-up preset"); return; }
      const fallback = state.settings.followUpPresets.find(p => p !== preset);
      state.contacts.forEach(c => { if (c.followUpFrequency === preset.id) c.followUpFrequency = fallback.id; });
      state.settings.followUpPresets = state.settings.followUpPresets.filter(p => p !== preset);
      persistContacts();
      persistSettings();
      renderFollowUpPresetsEditor();
      buildFollowUpOptions();
      if (state.screen === 'people' || state.screen === 'contact-profile') refreshCurrentScreen();
    });
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') {
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') showToast('Notifications enabled');
      return result;
    } catch (e) { return 'denied'; }
  }
  return Notification.permission;
}

function wireSettings() {
  document.getElementById('toggle-digest').addEventListener('change', (e) => {
    state.settings.dailyDigest = e.target.checked;
    persistSettings();
  });
  document.getElementById('theme-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme-option]');
    if (!btn) return;
    state.settings.theme = btn.dataset.themeOption;
    persistSettings();
    applyTheme();
    setActiveThemeToggle(state.settings.theme);
  });
  document.getElementById('accent-color-input').addEventListener('input', (e) => {
    state.settings.accentColor = e.target.value;
    applyAccentColor();
    persistSettings();
  });
  document.getElementById('btn-reset-accent').addEventListener('click', () => {
    state.settings.accentColor = DEFAULT_ACCENT;
    document.getElementById('accent-color-input').value = DEFAULT_ACCENT;
    applyAccentColor();
    persistSettings();
  });
  document.getElementById('weekstart-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-weekstart-option]');
    if (!btn) return;
    state.settings.weekStartsOn = btn.dataset.weekstartOption;
    persistSettings();
    setActiveWeekStartToggle(state.settings.weekStartsOn);
    document.getElementById('week-scroll').removeAttribute('data-scrolled');
    refreshCurrentScreen();
  });
  document.getElementById('defaultview-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-defaultview-option]');
    if (!btn) return;
    state.settings.defaultView = btn.dataset.defaultviewOption;
    persistSettings();
    setActiveDefaultViewToggle(state.settings.defaultView);
  });
  document.getElementById('select-day-start-hour').addEventListener('change', (e) => {
    const v = parseInt(e.target.value, 10);
    if (v >= state.settings.dayEndHour) { showToast('Start hour must be before end hour'); e.target.value = String(state.settings.dayStartHour); return; }
    state.settings.dayStartHour = v;
    persistSettings();
    document.getElementById('week-scroll').removeAttribute('data-scrolled');
    refreshCurrentScreen();
  });
  document.getElementById('select-day-end-hour').addEventListener('change', (e) => {
    const v = parseInt(e.target.value, 10);
    if (v <= state.settings.dayStartHour) { showToast('End hour must be after start hour'); e.target.value = String(state.settings.dayEndHour); return; }
    state.settings.dayEndHour = v;
    persistSettings();
    document.getElementById('week-scroll').removeAttribute('data-scrolled');
    refreshCurrentScreen();
  });
  document.getElementById('btn-add-reminder-preset').addEventListener('click', () => {
    const label = document.getElementById('new-reminder-label').value.trim();
    const minutes = parseInt(document.getElementById('new-reminder-minutes').value, 10);
    if (!label || !minutes || minutes <= 0) { showToast('Enter a label and minutes'); return; }
    state.settings.reminderPresets.push({ minutes, label });
    persistSettings();
    document.getElementById('new-reminder-label').value = '';
    document.getElementById('new-reminder-minutes').value = '';
    renderReminderPresetsEditor();
    buildReminderOptions();
  });
  document.getElementById('btn-add-followup-preset').addEventListener('click', () => {
    const label = document.getElementById('new-followup-label').value.trim();
    const days = parseInt(document.getElementById('new-followup-days').value, 10);
    if (!label || !days || days <= 0) { showToast('Enter a label and days'); return; }
    state.settings.followUpPresets.push({ id: uid(), label, days });
    persistSettings();
    document.getElementById('new-followup-label').value = '';
    document.getElementById('new-followup-days').value = '';
    renderFollowUpPresetsEditor();
    buildFollowUpOptions();
  });
  document.getElementById('btn-enable-notif').addEventListener('click', async () => {
    await requestNotificationPermission();
    updateNotifPermissionUI();
  });
  document.getElementById('btn-clear-data').addEventListener('click', () => {
    confirmDialog("This will permanently delete all events and contacts. This can't be undone.", () => {
      localStorage.removeItem(STORAGE_KEYS.events);
      localStorage.removeItem(STORAGE_KEYS.contacts);
      localStorage.removeItem(STORAGE_KEYS.settings);
      localStorage.removeItem(STORAGE_KEYS.categories);
      localStorage.removeItem(STORAGE_KEYS.circles);
      localStorage.removeItem(STORAGE_KEYS.seeded);
      localStorage.removeItem(STORAGE_KEYS.sync);
      location.reload();
    }, { title: 'Clear all data', okLabel: 'Clear data' });
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallUI();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallUI();
    showToast('Orbit installed');
  });
}

/* ===================== Notifications engine ===================== */

async function showNotification(title, options) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, options);
      return;
    }
  } catch (e) { /* fall through to page notification */ }
  try { new Notification(title, options); } catch (e) { /* ignore */ }
}

function checkReminders() {
  const now = Date.now();
  let changed = false;
  state.events.forEach(ev => {
    if (!ev.reminderMinutes || ev.reminderFired) return;
    const fireAt = new Date(ev.start).getTime() - ev.reminderMinutes * 60000;
    if (fireAt > now) return;
    if (now - fireAt < REMINDER_GRACE_MS) {
      const start = new Date(ev.start);
      const cat = getCategoryMap()[ev.category];
      showNotification(ev.title, {
        body: `${formatTimeShort(start)}${cat ? ' · ' + cat.label : ''}`,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'orbit-event-' + ev.id,
      });
    }
    ev.reminderFired = true;
    changed = true;
  });
  if (changed) persistEvents();
  checkDailyDigest();
}

function checkDailyDigest() {
  if (!state.settings.dailyDigest) return;
  const now = new Date();
  if (now.getHours() < DIGEST_HOUR) return;
  const todayKey = dateKey(now);
  if (state.settings.lastDigestDate === todayKey) return;

  const todays = state.events.filter(ev => isSameDay(new Date(ev.start), now)).sort((a, b) => new Date(a.start) - new Date(b.start));
  state.settings.lastDigestDate = todayKey;
  persistSettings();
  if (!todays.length) return;

  const body = todays.slice(0, 3).map(ev => `${formatTimeShort(new Date(ev.start))} ${ev.title}`).join('  ·  ') + (todays.length > 3 ? `  +${todays.length - 3} more` : '');
  showNotification(`Today: ${todays.length} event${todays.length > 1 ? 's' : ''}`, {
    body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'orbit-digest-' + todayKey,
  });
}

function startReminderLoop() {
  checkReminders();
  setInterval(checkReminders, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
}

/* ===================== Service worker ===================== */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker registration failed:', err));
  });
}

/* ===================== Init ===================== */

function init() {
  applyTheme();
  applyAccentColor();
  seedDemoData();

  buildCategoryPicker();
  buildCirclePicker();
  buildEmojiGrid('emoji-grid', EMOJI_CHOICES, (em) => {
    state.selectedEmoji = em;
    document.getElementById('contact-emoji-btn').textContent = em;
  });
  buildEmojiGrid('category-icon-grid', CATEGORY_ICON_CHOICES, (em) => {
    state.selectedCategoryIcon = em;
    document.getElementById('category-icon-btn').textContent = em;
  });
  buildEmojiGrid('circle-icon-grid', CATEGORY_ICON_CHOICES, (em) => {
    state.selectedCircleIcon = em;
    document.getElementById('circle-icon-btn').textContent = em;
  });
  buildTagSuggestions();
  buildReminderOptions();
  buildFollowUpOptions();
  buildHourSelects();

  wireGenericModalClosers();
  wireBottomNav();
  wireCalendarControls();
  wireContactCombobox();
  wireEventForm();
  wireContactModalWidgets();
  wireContactForm();
  wireCategoryModalWidgets();
  wireCategoryForm();
  wireCircleModalWidgets();
  wireCircleForm();
  wirePeopleViewToggle();
  wireSettings();
  wireSyncSettings();
  wireSyncLifecycleEvents();

  setActiveViewToggle(state.view);
  switchScreen('calendar');
  registerServiceWorker();
  requestNotificationPermission().finally(updateNotifPermissionUI);
  startReminderLoop();
  initDriveSync();
}

init();
