'use strict';

/* ===================== Constants ===================== */

const STORAGE_KEYS = {
  events: 'orbit_events',
  tasks: 'orbit_tasks',
  contacts: 'orbit_contacts',
  settings: 'orbit_settings',
  categories: 'orbit_categories',
  circles: 'orbit_circles',
  sync: 'orbit_sync_meta',
  seeded: 'orbit_seeded',
};

const THEME_COLORS = { dark: '#0a0a0f', light: '#eef0f6' };
const DEFAULT_ACCENT = '#00f5ff';

const SCOPE_DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file';
const SCOPE_CALENDAR_EVENTS = 'https://www.googleapis.com/auth/calendar.events';
const SCOPE_CALENDAR_READONLY = 'https://www.googleapis.com/auth/calendar.readonly';
const DRIVE_CONFIG = {
  clientId: '595768927312-t59vj1f3ajbdbvd5ftge23l79elrdcd0.apps.googleusercontent.com',
  scope: [SCOPE_DRIVE_FILE, SCOPE_CALENDAR_EVENTS, SCOPE_CALENDAR_READONLY].join(' '),
  fileName: 'orbit-data.json',
};
const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const ORBIT_CALENDAR_NAME = 'Orbit';
const IMPORT_CATEGORY_ID = 'gcal-imported';
const IMPORT_WINDOW_MONTHS_BACK = 1;
const IMPORT_WINDOW_MONTHS_AHEAD = 6;

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

const DENSITY_HOUR_HEIGHTS = { compact: 40, comfortable: 56, spacious: 76 };
function getHourHeight() { return DENSITY_HOUR_HEIGHTS[state.settings.bubbleDensity] || DENSITY_HOUR_HEIGHTS.comfortable; }

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
  bubbleDensity: 'comfortable',
  bubbleRadius: 'rounded',
  bubbleStyle: 'solid',
  reminderPresets: DEFAULT_REMINDER_PRESETS.map(p => Object.assign({}, p)),
  followUpPresets: DEFAULT_FOLLOWUP_PRESETS.map(p => Object.assign({}, p)),
  peopleView: 'list',
}, loadJSON(STORAGE_KEYS.settings, {}));

const state = {
  events: loadJSON(STORAGE_KEYS.events, []),
  tasks: loadJSON(STORAGE_KEYS.tasks, []),
  contacts: loadJSON(STORAGE_KEYS.contacts, []),
  categories: loadJSON(STORAGE_KEYS.categories, null) || DEFAULT_CATEGORIES.map(c => Object.assign({}, c)),
  circles: loadJSON(STORAGE_KEYS.circles, null) || DEFAULT_CIRCLES.map(c => Object.assign({}, c)),
  settings: initialSettings,
  sync: Object.assign({ connected: false, driveFileId: null, lastSyncedAt: null, lastLocalChangeAt: Date.now(), calendarSync: false, googleCalendarId: null, pendingCalendarDeletes: [], calendarImport: false, lastImportAt: null }, loadJSON(STORAGE_KEYS.sync, {})),
  view: initialSettings.defaultView === 'month' ? 'month' : 'week',
  peopleView: initialSettings.peopleView === 'bubbles' ? 'bubbles' : 'list',
  currentDate: new Date(),
  screen: 'calendar',
  activeContactId: null,
  editingEventId: null,
  editingTaskId: null,
  editingContactId: null,
  editingCategoryId: null,
  editingCircleId: null,
  pendingConfirmAction: null,
  selectedEventContactId: null,
  selectedCategory: 'work',
  selectedTaskCategory: 'work',
  selectedEmoji: '🙂',
  selectedCategoryIcon: '💼',
  selectedCircleIcon: '🎉',
  selectedContactCircleId: null,
  contactTags: [],
};

function persistEvents() { saveJSON(STORAGE_KEYS.events, state.events); markLocalChange(); }
function persistTasks() { saveJSON(STORAGE_KEYS.tasks, state.tasks); markLocalChange(); }
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

const driveSession = { status: 'signed-out', tokenClient: null, accessToken: null, tokenExpiresAt: 0, grantedScope: '', busy: false, queuedRetry: false, importBusy: false };
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
    tasks: state.tasks,
    contacts: state.contacts,
    categories: state.categories,
    circles: state.circles,
    settings: state.settings,
  };
}

function isEmptyDoc(doc) {
  return !doc || (
    (!doc.events || !doc.events.length) &&
    (!doc.tasks || !doc.tasks.length) &&
    (!doc.contacts || !doc.contacts.length)
  );
}

function applyRemoteDoc(remote) {
  state.events = Array.isArray(remote.events) ? remote.events : [];
  state.tasks = Array.isArray(remote.tasks) ? remote.tasks : [];
  state.contacts = Array.isArray(remote.contacts) ? remote.contacts : [];
  state.categories = Array.isArray(remote.categories) && remote.categories.length ? remote.categories : state.categories;
  state.circles = Array.isArray(remote.circles) && remote.circles.length ? remote.circles : state.circles;
  state.settings = Object.assign({}, state.settings, remote.settings || {});
  saveJSON(STORAGE_KEYS.events, state.events);
  saveJSON(STORAGE_KEYS.tasks, state.tasks);
  saveJSON(STORAGE_KEYS.contacts, state.contacts);
  saveJSON(STORAGE_KEYS.categories, state.categories);
  saveJSON(STORAGE_KEYS.circles, state.circles);
  saveJSON(STORAGE_KEYS.settings, state.settings);
  state.sync.lastLocalChangeAt = remote.updatedAt;

  applyTheme();
  applyAccentColor();
  applyBubbleSettings();
  buildCategoryPicker();
  buildTaskCategoryPicker();
  buildCirclePicker();
  buildReminderOptions();
  buildFollowUpOptions();
  refreshCurrentScreen();
  if (state.screen === 'settings') renderSettings();
}

async function gFetch(token, url, options) {
  const res = await fetch(url, Object.assign({}, options, {
    headers: Object.assign({ Authorization: `Bearer ${token}` }, (options && options.headers) || {}),
  }));
  if (!res.ok) {
    const err = new Error('Google API request failed: ' + res.status);
    err.status = res.status;
    err.authError = res.status === 401 || res.status === 403;
    throw err;
  }
  return res;
}

async function findOrCreateDriveFile(token) {
  const q = encodeURIComponent(`name='${DRIVE_CONFIG.fileName}' and trashed=false`);
  const listRes = await gFetch(token, `${DRIVE_FILES_API}?q=${q}&spaces=drive&fields=files(id)`);
  const listData = await listRes.json();
  if (listData.files && listData.files.length) return listData.files[0].id;
  const createRes = await gFetch(token, DRIVE_FILES_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_CONFIG.fileName }),
  });
  const created = await createRes.json();
  return created.id;
}

async function pullFromDrive(token, fileId) {
  const res = await gFetch(token, `${DRIVE_FILES_API}/${fileId}?alt=media`);
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

async function pushToDrive(token, fileId, doc) {
  await gFetch(token, `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
}

async function findOrCreateOrbitCalendar(token) {
  const listRes = await gFetch(token, `${CALENDAR_API}/users/me/calendarList?minAccessRole=owner&maxResults=250`);
  const listData = await listRes.json();
  const existing = (listData.items || []).find((c) => c.summary === ORBIT_CALENDAR_NAME);
  if (existing) return existing.id;
  const createRes = await gFetch(token, `${CALENDAR_API}/calendars`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: ORBIT_CALENDAR_NAME, description: 'Events synced from the Orbit app' }),
  });
  const created = await createRes.json();
  return created.id;
}

function eventToCalendarResource(ev) {
  return {
    summary: ev.title,
    description: ev.notes || undefined,
    start: { dateTime: ev.start },
    end: { dateTime: ev.end },
  };
}

async function syncEventsToCalendar(token) {
  if (!state.sync.googleCalendarId) {
    state.sync.googleCalendarId = await findOrCreateOrbitCalendar(token);
    persistSync();
  }
  const calId = state.sync.googleCalendarId;

  if (state.sync.pendingCalendarDeletes && state.sync.pendingCalendarDeletes.length) {
    const remaining = [];
    for (const gcalId of state.sync.pendingCalendarDeletes) {
      try {
        await gFetch(token, `${CALENDAR_API}/calendars/${calId}/events/${gcalId}`, { method: 'DELETE' });
      } catch (e) {
        if (e.status !== 404 && e.status !== 410) remaining.push(gcalId);
      }
    }
    state.sync.pendingCalendarDeletes = remaining;
    persistSync();
  }

  let changed = false;
  for (const ev of state.events) {
    if (ev.gcalImported) continue;
    if (ev.gcalEventId && !ev.gcalDirty) continue;
    const body = JSON.stringify(eventToCalendarResource(ev));
    if (ev.gcalEventId) {
      await gFetch(token, `${CALENDAR_API}/calendars/${calId}/events/${ev.gcalEventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } else {
      const res = await gFetch(token, `${CALENDAR_API}/calendars/${calId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const created = await res.json();
      ev.gcalEventId = created.id;
    }
    ev.gcalDirty = false;
    changed = true;
  }
  if (changed) saveJSON(STORAGE_KEYS.events, state.events);
}

function ensureImportCategory() {
  if (state.categories.some((c) => c.id === IMPORT_CATEGORY_ID)) return;
  state.categories.push({ id: IMPORT_CATEGORY_ID, label: 'Google Calendar', color: '#8e8e93', icon: '📅' });
  persistCategories();
  buildCategoryPicker();
  buildTaskCategoryPicker();
}

function getImportWindow() {
  const now = new Date();
  const timeMin = new Date(now.getFullYear(), now.getMonth() - IMPORT_WINDOW_MONTHS_BACK, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
  const timeMax = new Date(now.getFullYear(), now.getMonth() + IMPORT_WINDOW_MONTHS_AHEAD, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
  return { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString() };
}

async function listImportableCalendars(token) {
  const res = await gFetch(token, `${CALENDAR_API}/users/me/calendarList?maxResults=250&fields=items(id,summary)`);
  const data = await res.json();
  return (data.items || []).filter((c) => c.id !== state.sync.googleCalendarId && c.summary !== ORBIT_CALENDAR_NAME);
}

async function listEventsPage(token, calendarId, importWindow, pageToken) {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: importWindow.timeMin,
    timeMax: importWindow.timeMax,
    maxResults: '250',
  });
  if (pageToken) params.set('pageToken', pageToken);
  const res = await gFetch(token, `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`);
  return res.json();
}

function parseGoogleDateOnly(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function googleEventToOrbitEvent(gEv, calendarId) {
  const allDay = !!(gEv.start && gEv.start.date);
  const start = allDay ? parseGoogleDateOnly(gEv.start.date) : new Date(gEv.start.dateTime);
  const end = allDay ? parseGoogleDateOnly(gEv.end.date) : new Date(gEv.end.dateTime);
  return {
    id: 'gcal-' + gEv.id,
    title: gEv.summary || '(untitled)',
    start: start.toISOString(),
    end: end.toISOString(),
    category: IMPORT_CATEGORY_ID,
    notes: gEv.description || '',
    reminderMinutes: null,
    reminderFired: false,
    contactId: null,
    createdAt: new Date().toISOString(),
    gcalImported: true,
    gcalSourceCalendarId: calendarId,
    gcalSourceEventId: gEv.id,
    gcalAllDay: allDay,
  };
}

async function pullEventsFromCalendar(token, calendarId, importWindow) {
  const events = [];
  let pageToken;
  do {
    const page = await listEventsPage(token, calendarId, importWindow, pageToken);
    for (const gEv of page.items || []) {
      if (gEv.status === 'cancelled') continue;
      events.push(googleEventToOrbitEvent(gEv, calendarId));
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return events;
}

async function importGoogleCalendarEvents(token) {
  ensureImportCategory();
  const importWindow = getImportWindow();
  const calendars = await listImportableCalendars(token);
  const imported = [];
  for (const cal of calendars) {
    const events = await pullEventsFromCalendar(token, cal.id, importWindow);
    imported.push(...events);
  }
  state.events = state.events.filter((ev) => !ev.gcalImported).concat(imported);
  saveJSON(STORAGE_KEYS.events, state.events);
  state.sync.lastImportAt = Date.now();
  persistSync();
  refreshCurrentScreen();
  if (state.screen === 'settings') renderSettings();
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
          driveSession.grantedScope = resp.scope || '';
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

function requiredScopes() {
  const scopes = [SCOPE_DRIVE_FILE];
  if (state.sync.calendarSync) scopes.push(SCOPE_CALENDAR_EVENTS);
  if (state.sync.calendarImport) scopes.push(SCOPE_CALENDAR_READONLY);
  return scopes;
}

function hasAllScopes(scopes) {
  const granted = (driveSession.grantedScope || '').split(' ');
  return scopes.every((s) => granted.includes(s));
}

async function acquireToken(scopes, interactive) {
  if (driveSession.accessToken && Date.now() < driveSession.tokenExpiresAt - 60000 && hasAllScopes(scopes)) {
    return driveSession.accessToken;
  }
  if (!isGisLoaded()) return null;
  try {
    const token = await requestAccessToken('');
    if (hasAllScopes(scopes)) return token;
    if (!interactive) return null;
  } catch (e) {
    if (!interactive) return null;
  }
  try {
    return await requestAccessToken('consent');
  } catch (e) {
    return null;
  }
}

async function ensureAccessToken(interactive) {
  return acquireToken(requiredScopes(), !!interactive);
}

async function connectDrive() {
  if (!isGisLoaded()) { showToast('Google sign-in is still loading — try again in a moment'); return; }
  driveSession.status = 'connecting';
  updateSyncUI();
  try {
    const token = await acquireToken(requiredScopes(), true);
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

async function triggerSync(reason, interactive) {
  if (!state.sync.connected) return;
  if (driveSession.busy) { driveSession.queuedRetry = true; return; }
  driveSession.busy = true;
  driveSession.status = 'syncing';
  updateSyncUI();
  try {
    const token = await ensureAccessToken(interactive);
    if (!token) { driveSession.status = 'needs-reauth'; if (interactive) showToast('Could not reconnect to Google Drive — try again'); return; }
    if (!state.sync.driveFileId) {
      state.sync.driveFileId = await findOrCreateDriveFile(token);
      persistSync();
    }
    const remote = await pullFromDrive(token, state.sync.driveFileId);
    const localDoc = buildSyncDoc();
    const remoteEmpty = isEmptyDoc(remote);
    const localEmpty = isEmptyDoc(localDoc);
    if (remoteEmpty && !localEmpty) {
      await pushToDrive(token, state.sync.driveFileId, localDoc);
    } else if (localEmpty && !remoteEmpty) {
      applyRemoteDoc(remote);
    } else if (remote && typeof remote.updatedAt === 'number' && remote.updatedAt > state.sync.lastLocalChangeAt) {
      applyRemoteDoc(remote);
    } else {
      await pushToDrive(token, state.sync.driveFileId, localDoc);
    }
    if (state.sync.calendarSync) {
      try {
        await syncEventsToCalendar(token);
      } catch (e) {
        if (e && e.authError) throw e;
      }
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

async function triggerCalendarImport(reason, interactive) {
  if (!state.sync.calendarImport) return;
  if (driveSession.importBusy) return;
  driveSession.importBusy = true;
  try {
    const token = await ensureAccessToken(interactive);
    if (!token) { if (interactive) showToast('Could not get permission to import — try again'); return; }
    await importGoogleCalendarEvents(token);
  } catch (e) {
    // best-effort background refresh outside the interactive path; failures are silent and retried on the next lifecycle event
    if (interactive) showToast('Could not import Google Calendar events — try again');
  } finally {
    driveSession.importBusy = false;
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

  const calendarRow = document.getElementById('row-calendar-sync');
  const calendarNote = document.getElementById('calendar-sync-note');
  const calendarToggle = document.getElementById('toggle-calendar-sync');
  calendarRow.classList.toggle('hidden', !connected);
  calendarNote.classList.toggle('hidden', !connected);
  calendarToggle.checked = state.sync.calendarSync;

  const importRow = document.getElementById('row-calendar-import');
  const importNote = document.getElementById('calendar-import-note');
  const importToggle = document.getElementById('toggle-calendar-import');
  importRow.classList.toggle('hidden', !connected);
  importNote.classList.toggle('hidden', !connected);
  importToggle.checked = state.sync.calendarImport;
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
  window.addEventListener('online', () => {
    if (state.sync.connected) triggerSync('online');
    if (state.sync.calendarImport) triggerCalendarImport('online');
  });
  window.addEventListener('focus', () => {
    if (state.sync.connected) triggerSync('focus');
    if (state.sync.calendarImport) triggerCalendarImport('focus');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (state.sync.connected) triggerSync('visible');
    if (state.sync.calendarImport) triggerCalendarImport('visible');
  });
}

function wireSyncSettings() {
  document.getElementById('btn-sync-connect').addEventListener('click', connectDrive);
  document.getElementById('btn-sync-now').addEventListener('click', () => {
    if (driveSession.status === 'needs-reauth') connectDrive();
    else triggerSync('manual', true);
  });
  document.getElementById('btn-sync-disconnect').addEventListener('click', () => {
    confirmDialog('Stop syncing this device with Google Drive? Your data stays on this device and in Drive.', () => {
      disconnectDrive();
    }, { title: 'Disconnect Google Drive', okLabel: 'Disconnect' });
  });
  document.getElementById('toggle-calendar-sync').addEventListener('change', (e) => {
    state.sync.calendarSync = e.target.checked;
    persistSync();
    if (state.sync.calendarSync) {
      showToast('Syncing events to Google Calendar…');
      triggerSync('calendar-enable', true);
    } else {
      showToast('Stopped syncing to Google Calendar');
    }
  });
  document.getElementById('toggle-calendar-import').addEventListener('change', (e) => {
    state.sync.calendarImport = e.target.checked;
    persistSync();
    if (state.sync.calendarImport) {
      showToast('Importing events from Google Calendar…');
      triggerCalendarImport('import-enable', true);
    } else {
      showToast('Stopped importing from Google Calendar');
    }
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

const BUBBLE_RADIUS_PX = { sharp: 2, rounded: 6, pill: 14 };
function applyBubbleSettings() {
  const radius = BUBBLE_RADIUS_PX[state.settings.bubbleRadius] ?? BUBBLE_RADIUS_PX.rounded;
  document.documentElement.style.setProperty('--bubble-radius', `${radius}px`);
  document.documentElement.setAttribute('data-bubble-style', state.settings.bubbleStyle || 'solid');
}

/* ===================== Date utils ===================== */

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function addYears(d, n) { return new Date(d.getFullYear() + n, d.getMonth(), d.getDate()); }
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

  ['calendar-controls', 'people-controls', 'profile-controls', 'settings-controls', 'tasks-controls'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  const controlsMap = { calendar: 'calendar-controls', people: 'people-controls', 'contact-profile': 'profile-controls', settings: 'settings-controls', tasks: 'tasks-controls' };
  document.getElementById(controlsMap[screen]).classList.remove('hidden');

  if (screen === 'calendar') renderCalendar();
  else if (screen === 'people') { setActivePeopleViewToggle(state.peopleView); renderPeople(); }
  else if (screen === 'contact-profile') renderContactProfile(state.activeContactId);
  else if (screen === 'settings') renderSettings();
  else if (screen === 'tasks') renderTasks();
}

function refreshCurrentScreen() {
  if (state.screen === 'calendar') renderCalendar();
  else if (state.screen === 'people') renderPeople();
  else if (state.screen === 'contact-profile') renderContactProfile(state.activeContactId);
  else if (state.screen === 'tasks') renderTasks();
}

function wireBottomNav() {
  document.querySelectorAll('.nav-btn[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => switchScreen(btn.dataset.screen));
  });
  document.getElementById('btn-quick-add').addEventListener('click', () => {
    if (state.screen === 'tasks') openTaskModal();
    else openEventModal();
  });
  document.getElementById('btn-add-task').addEventListener('click', () => openTaskModal());
  document.getElementById('btn-back-people').addEventListener('click', () => switchScreen('people'));
}

/* ===================== Calendar rendering ===================== */

function renderCalendar() {
  updateCalendarLabel();
  document.getElementById('week-view').classList.toggle('hidden', state.view !== 'week');
  document.getElementById('month-view').classList.toggle('hidden', state.view !== 'month');
  document.getElementById('year-view').classList.toggle('hidden', state.view !== 'year');
  if (state.view === 'week') renderWeek();
  else if (state.view === 'month') renderMonth();
  else renderYear();
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
  } else if (state.view === 'year') {
    label.textContent = String(state.currentDate.getFullYear());
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

const DRAG_STEP_MIN = 15;
function getDragStepPx() { return (getHourHeight() * DRAG_STEP_MIN) / 60; }

function dateAtMinutes(day, minutes) {
  const d = new Date(day);
  d.setHours(0, minutes, 0, 0);
  return d;
}

function renderEventPill(p) {
  if (p.kind === 'task') return renderTaskPill(p);
  const cat = getCategory(p.ev.category);
  const pill = document.createElement('div');
  pill.className = 'event-pill' + (p.ev.gcalImported ? ' is-imported' : '');
  pill.dataset.eventId = p.ev.id;
  const top = ((p.startMin - getDayStartHour() * 60) / 60) * getHourHeight();
  const height = Math.max(((p.endMin - p.startMin) / 60) * getHourHeight(), 26);
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
    <div class="event-pill-resize-handle" aria-hidden="true"></div>
  `;

  attachPillMoveDrag(pill, p);
  attachPillResizeDrag(pill, p);
  return pill;
}

function renderTaskPill(p) {
  const task = p.task;
  const cat = getCategory(task.category);
  const pill = document.createElement('div');
  pill.className = 'event-pill task-pill' + (task.done ? ' is-done' : '');
  pill.dataset.taskId = task.id;
  const top = ((p.startMin - getDayStartHour() * 60) / 60) * getHourHeight();
  const height = Math.max(((p.endMin - p.startMin) / 60) * getHourHeight(), 26);
  pill.style.top = `${top}px`;
  pill.style.height = `${height}px`;
  pill.style.left = `${(p.col / p.totalCols) * 100}%`;
  pill.style.width = `calc(${(1 / p.totalCols) * 100}% - 3px)`;
  pill.style.setProperty('--cat-color', cat.color);
  pill.style.setProperty('--cat-glow', hexToRgba(cat.color, 0.35));
  if (height < 38) pill.classList.add('is-short');

  const start = combineDateTime(task.dueDate, task.dueTime);
  pill.innerHTML = `
    <span class="event-pill-title"><span class="event-pill-icon">${task.done ? '✓' : '○'}</span>${escapeHtml(task.title)}</span>
    <span class="event-pill-time">${formatTimeShort(start)}</span>
  `;

  attachTaskPillDrag(pill, task);
  return pill;
}

function attachTaskPillDrag(pill, task) {
  let dragging = false, moved = false;
  let startX = 0, startY = 0, initialTop = 0;

  pill.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    dragging = true; moved = false;
    startX = e.clientX; startY = e.clientY;
    initialTop = parseFloat(pill.style.top);
    pill.setPointerCapture(e.pointerId);
  });

  pill.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 4) return;
    if (!moved) {
      moved = true;
      pill.classList.add('is-dragging');
      document.body.classList.add('is-dragging-event');
    }
    const dayStartHour = getDayStartHour(), dayEndHour = getDayEndHour();
    const maxTop = (dayEndHour - dayStartHour) * getHourHeight() - pill.offsetHeight;
    let newTop = Math.min(Math.max(initialTop + dy, 0), Math.max(maxTop, 0));
    newTop = Math.round(newTop / getDragStepPx()) * getDragStepPx();

    const daysGrid = document.getElementById('days-grid');
    const cols = Array.from(daysGrid.children);
    const targetCol = document.elementFromPoint(e.clientX, e.clientY)?.closest('.day-col');
    cols.forEach(c => c.classList.toggle('is-drop-target', c === targetCol));
    if (targetCol && targetCol !== pill.parentElement) targetCol.appendChild(pill);

    pill.style.top = `${newTop}px`;
    const newStartMin = dayStartHour * 60 + (newTop / getHourHeight()) * 60;
    pill.querySelector('.event-pill-time').textContent = formatTimeShort(dateAtMinutes(new Date(), newStartMin));
  });

  const finishDrag = () => {
    if (!dragging) return;
    dragging = false;
    document.querySelectorAll('.day-col.is-drop-target').forEach(c => c.classList.remove('is-drop-target'));
    if (!moved) return;
    pill.classList.remove('is-dragging');
    document.body.classList.remove('is-dragging-event');

    const daysGrid = document.getElementById('days-grid');
    const cols = Array.from(daysGrid.children);
    const colIndex = cols.indexOf(pill.parentElement);
    const weekStart = startOfWeek(state.currentDate);
    const targetDay = colIndex >= 0 ? addDays(weekStart, colIndex) : combineDateTime(task.dueDate, task.dueTime);

    const dayStartHour = getDayStartHour();
    const newTop = parseFloat(pill.style.top);
    const newStartMin = dayStartHour * 60 + (newTop / getHourHeight()) * 60;
    const newStart = dateAtMinutes(targetDay, newStartMin);
    task.dueDate = dateKey(newStart);
    task.dueTime = timeKey(newStart);
    persistTasks();
    refreshCurrentScreen();
  };

  pill.addEventListener('pointerup', finishDrag);
  pill.addEventListener('pointercancel', finishDrag);

  pill.addEventListener('click', (e) => {
    if (moved) { e.stopPropagation(); moved = false; return; }
    e.stopPropagation();
    openTaskModal(task.id);
  });
}

function attachPillMoveDrag(pill, p) {
  let dragging = false, moved = false;
  let startX = 0, startY = 0, initialTop = 0, initialHeight = 0;
  let duration = p.endMin - p.startMin;

  pill.addEventListener('pointerdown', (e) => {
    if (p.ev.gcalImported) return;
    if (e.target.closest('.event-pill-resize-handle')) return;
    e.stopPropagation();
    dragging = true; moved = false;
    startX = e.clientX; startY = e.clientY;
    initialTop = parseFloat(pill.style.top);
    initialHeight = pill.offsetHeight;
    pill.setPointerCapture(e.pointerId);
  });

  pill.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 4) return;
    if (!moved) {
      moved = true;
      pill.classList.add('is-dragging');
      document.body.classList.add('is-dragging-event');
    }
    const dayStartHour = getDayStartHour(), dayEndHour = getDayEndHour();
    const maxTop = (dayEndHour - dayStartHour) * getHourHeight() - initialHeight;
    let newTop = Math.min(Math.max(initialTop + dy, 0), Math.max(maxTop, 0));
    newTop = Math.round(newTop / getDragStepPx()) * getDragStepPx();

    const daysGrid = document.getElementById('days-grid');
    const cols = Array.from(daysGrid.children);
    const targetCol = document.elementFromPoint(e.clientX, e.clientY)?.closest('.day-col');
    cols.forEach(c => c.classList.toggle('is-drop-target', c === targetCol));
    if (targetCol && targetCol !== pill.parentElement) targetCol.appendChild(pill);

    pill.style.top = `${newTop}px`;
    const newStartMin = dayStartHour * 60 + (newTop / getHourHeight()) * 60;
    const startLbl = formatTimeShort(dateAtMinutes(new Date(), newStartMin));
    const endLbl = formatTimeShort(dateAtMinutes(new Date(), newStartMin + duration));
    pill.querySelector('.event-pill-time').textContent = `${startLbl} – ${endLbl}`;
  });

  const finishDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    document.querySelectorAll('.day-col.is-drop-target').forEach(c => c.classList.remove('is-drop-target'));
    if (!moved) return;
    pill.classList.remove('is-dragging');
    document.body.classList.remove('is-dragging-event');

    const daysGrid = document.getElementById('days-grid');
    const cols = Array.from(daysGrid.children);
    const colIndex = cols.indexOf(pill.parentElement);
    const weekStart = startOfWeek(state.currentDate);
    const targetDay = colIndex >= 0 ? addDays(weekStart, colIndex) : new Date(p.ev.start);

    const dayStartHour = getDayStartHour();
    const newTop = parseFloat(pill.style.top);
    const newStartMin = dayStartHour * 60 + (newTop / getHourHeight()) * 60;
    const newStart = dateAtMinutes(targetDay, newStartMin);
    const newEnd = dateAtMinutes(targetDay, newStartMin + duration);
    p.ev.start = newStart.toISOString();
    p.ev.end = newEnd.toISOString();
    persistEvents();
    renderCalendar();
  };

  pill.addEventListener('pointerup', finishDrag);
  pill.addEventListener('pointercancel', finishDrag);

  pill.addEventListener('click', (e) => {
    if (moved) { e.stopPropagation(); moved = false; return; }
    e.stopPropagation();
    openEventModal(p.ev.id);
  });
}

function attachPillResizeDrag(pill, p) {
  const handle = pill.querySelector('.event-pill-resize-handle');
  let resizing = false, startY = 0, initialHeight = 0;

  handle.addEventListener('pointerdown', (e) => {
    if (p.ev.gcalImported) return;
    e.stopPropagation();
    resizing = true;
    startY = e.clientY;
    initialHeight = pill.offsetHeight;
    handle.setPointerCapture(e.pointerId);
    pill.classList.add('is-resizing');
  });

  handle.addEventListener('pointermove', (e) => {
    if (!resizing) return;
    e.stopPropagation();
    const dayStartHour = getDayStartHour(), dayEndHour = getDayEndHour();
    const top = parseFloat(pill.style.top);
    const maxHeight = (dayEndHour - dayStartHour) * getHourHeight() - top;
    let newHeight = Math.min(Math.max(initialHeight + (e.clientY - startY), getDragStepPx()), Math.max(maxHeight, getDragStepPx()));
    newHeight = Math.round(newHeight / getDragStepPx()) * getDragStepPx();
    pill.style.height = `${newHeight}px`;
    pill.classList.toggle('is-short', newHeight < 38);

    const startMin = dayStartHour * 60 + (top / getHourHeight()) * 60;
    const endMin = startMin + (newHeight / getHourHeight()) * 60;
    const startLbl = formatTimeShort(dateAtMinutes(new Date(), startMin));
    const endLbl = formatTimeShort(dateAtMinutes(new Date(), endMin));
    pill.querySelector('.event-pill-time').textContent = `${startLbl} – ${endLbl}`;
  });

  const finishResize = (e) => {
    if (!resizing) return;
    resizing = false;
    pill.classList.remove('is-resizing');
    const dayStartHour = getDayStartHour();
    const top = parseFloat(pill.style.top);
    const height = pill.offsetHeight;
    const startMin = dayStartHour * 60 + (top / getHourHeight()) * 60;
    const endMin = startMin + (height / getHourHeight()) * 60;
    const startD = new Date(p.ev.start);
    p.ev.end = dateAtMinutes(startD, endMin).toISOString();
    persistEvents();
    renderCalendar();
  };

  handle.addEventListener('pointerup', finishResize);
  handle.addEventListener('pointercancel', finishResize);
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

    const allDayTasks = state.tasks.filter(t => !t.done && t.dueDate === dateKey(d) && !t.dueTime);
    if (allDayTasks.length) {
      const chipsWrap = document.createElement('div');
      chipsWrap.className = 'day-head-task-chips';
      allDayTasks.forEach(t => {
        const cat = getCategory(t.category);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'day-head-task-chip';
        chip.style.setProperty('--cat-color', cat.color);
        chip.textContent = `${cat.icon} ${t.title}`;
        chip.addEventListener('click', (e) => { e.stopPropagation(); openTaskModal(t.id); });
        chipsWrap.appendChild(chip);
      });
      head.appendChild(chipsWrap);
    }

    header.appendChild(head);
  }

  const dayStartHour = getDayStartHour(), dayEndHour = getDayEndHour();

  const hourHeight = getHourHeight();

  const hoursCol = document.getElementById('hours-col');
  hoursCol.innerHTML = '';
  for (let h = dayStartHour; h < dayEndHour; h++) {
    const lbl = document.createElement('div');
    lbl.className = 'hour-label';
    lbl.style.height = `${hourHeight}px`;
    lbl.textContent = formatHourLabel(h);
    hoursCol.appendChild(lbl);
  }

  const daysGrid = document.getElementById('days-grid');
  daysGrid.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const d = days[i];
    const col = document.createElement('div');
    col.className = 'day-col';
    col.style.height = `${(dayEndHour - dayStartHour) * hourHeight}px`;
    for (let h = dayStartHour; h < dayEndHour; h++) {
      const line = document.createElement('div');
      line.className = 'hour-line';
      line.style.height = `${hourHeight}px`;
      col.appendChild(line);
    }

    col.addEventListener('click', (e) => {
      if (e.target.closest('.event-pill')) return;
      const rect = col.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const minutesFromStart = (offsetY / getHourHeight()) * 60;
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
        return { kind: 'event', ev, startMin, endMin };
      });
    const dayTaskItems = state.tasks
      .filter(t => !t.done && t.dueDate === dateKey(d) && t.dueTime)
      .map(t => {
        const startMin = minutesOf(combineDateTime(t.dueDate, t.dueTime));
        return { kind: 'task', task: t, startMin, endMin: startMin + 30 };
      });
    layoutDayEvents(dayItems.concat(dayTaskItems)).forEach(p => col.appendChild(renderEventPill(p)));

    if (isSameDay(d, today)) {
      const nowMin = minutesOf(today);
      const line = document.createElement('div');
      line.className = 'now-line';
      line.style.top = `${((nowMin - dayStartHour * 60) / 60) * getHourHeight()}px`;
      col.appendChild(line);
    }

    daysGrid.appendChild(col);
  }

  const scrollEl = document.getElementById('week-scroll');
  if (!scrollEl.dataset.scrolled) {
    scrollEl.scrollTop = Math.max(0, (7 - dayStartHour) * getHourHeight() - 40);
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

function renderYear() {
  const grid = document.getElementById('year-grid');
  grid.innerHTML = '';
  const year = state.currentDate.getFullYear();
  const today = new Date();
  const dowLabels = state.settings.weekStartsOn === 'sunday'
    ? ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  for (let m = 0; m < 12; m++) {
    const monthStart = new Date(year, m, 1);
    const gridStart = startOfWeek(monthStart);
    const monthEl = document.createElement('div');
    monthEl.className = 'year-month';
    if (today.getFullYear() === year && today.getMonth() === m) monthEl.classList.add('is-current-month');
    monthEl.innerHTML = `
      <div class="year-month-label">${monthStart.toLocaleDateString(undefined, { month: 'long' })}</div>
      <div class="year-month-dow">${dowLabels.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="year-month-grid"></div>
    `;

    const cellsWrap = monthEl.querySelector('.year-month-grid');
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      const cell = document.createElement('div');
      cell.className = 'year-month-cell';
      if (d.getMonth() !== m) cell.classList.add('is-other-month');
      if (isSameDay(d, today)) cell.classList.add('is-today');
      if (state.events.some(ev => isSameDay(new Date(ev.start), d))) cell.classList.add('has-events');
      cell.textContent = d.getDate();
      cell.addEventListener('click', () => {
        state.currentDate = d;
        state.view = 'week';
        setActiveViewToggle('week');
        document.getElementById('week-scroll').removeAttribute('data-scrolled');
        renderCalendar();
        resetWeekScrollLeft();
      });
      cellsWrap.appendChild(cell);
    }

    monthEl.querySelector('.year-month-label').addEventListener('click', () => {
      state.currentDate = monthStart;
      state.view = 'month';
      setActiveViewToggle('month');
      renderCalendar();
    });

    grid.appendChild(monthEl);
  }
}

function setActiveViewToggle(view) {
  document.getElementById('btn-view-week').classList.toggle('active', view === 'week');
  document.getElementById('btn-view-month').classList.toggle('active', view === 'month');
  document.getElementById('btn-view-year').classList.toggle('active', view === 'year');
}

function resetWeekScrollLeft() {
  const el = document.getElementById('week-scroll');
  if (el) el.scrollLeft = 0;
  const headerEl = document.getElementById('week-header-scroll');
  if (headerEl) headerEl.scrollLeft = 0;
}

function wireWeekHeaderScrollSync() {
  const scrollEl = document.getElementById('week-scroll');
  const headerScrollEl = document.getElementById('week-header-scroll');
  scrollEl.addEventListener('scroll', () => { headerScrollEl.scrollLeft = scrollEl.scrollLeft; });
}

function scrollWeekToCurrentTime() {
  const scrollEl = document.getElementById('week-scroll');
  if (!scrollEl) return;
  const dayStartHour = getDayStartHour(), dayEndHour = getDayEndHour();
  const nowMin = Math.min(Math.max(minutesOf(new Date()), dayStartHour * 60), dayEndHour * 60);
  const offsetPx = ((nowMin - dayStartHour * 60) / 60) * getHourHeight();
  scrollEl.scrollTop = Math.max(0, offsetPx - scrollEl.clientHeight / 2);
  scrollEl.dataset.scrolled = '1';
}

function stepCurrentDate(dir) {
  if (state.view === 'week') return addDays(state.currentDate, 7 * dir);
  if (state.view === 'year') return addYears(state.currentDate, dir);
  return addMonths(state.currentDate, dir);
}

function wireCalendarControls() {
  document.getElementById('btn-prev').addEventListener('click', () => {
    state.currentDate = stepCurrentDate(-1);
    renderCalendar();
    resetWeekScrollLeft();
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    state.currentDate = stepCurrentDate(1);
    renderCalendar();
    resetWeekScrollLeft();
  });
  document.getElementById('btn-today').addEventListener('click', () => {
    state.currentDate = new Date();
    renderCalendar();
    resetWeekScrollLeft();
    if (state.view === 'week') scrollWeekToCurrentTime();
  });
  document.getElementById('btn-view-week').addEventListener('click', () => { state.view = 'week'; setActiveViewToggle('week'); renderCalendar(); });
  document.getElementById('btn-view-month').addEventListener('click', () => { state.view = 'month'; setActiveViewToggle('month'); renderCalendar(); });
  document.getElementById('btn-view-year').addEventListener('click', () => { state.view = 'year'; setActiveViewToggle('year'); renderCalendar(); });
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
  document.querySelectorAll('#category-picker .category-pill').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.category === state.selectedCategory);
  });
}

function buildTaskCategoryPicker() {
  const picker = document.getElementById('task-category-picker');
  if (!picker) return;
  picker.innerHTML = '';
  state.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-pill';
    btn.dataset.category = cat.id;
    btn.style.setProperty('--cat-color', cat.color);
    btn.style.setProperty('--cat-glow', hexToRgba(cat.color, 0.3));
    btn.innerHTML = `${cat.icon} ${cat.label.split(' / ')[0]}`;
    btn.addEventListener('click', () => { state.selectedTaskCategory = cat.id; updateTaskCategoryPickerUI(); });
    picker.appendChild(btn);
  });
  if (!state.categories.some(c => c.id === state.selectedTaskCategory)) {
    state.selectedTaskCategory = state.categories[0] ? state.categories[0].id : null;
  }
}
function updateTaskCategoryPickerUI() {
  document.querySelectorAll('#task-category-picker .category-pill').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.category === state.selectedTaskCategory);
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

function setEventFormReadOnly(readonly) {
  document.querySelector('#modal-event .modal-sheet').classList.toggle('is-readonly', readonly);
  document.querySelectorAll('#event-form input, #event-form select, #event-form textarea').forEach((el) => { el.disabled = readonly; });
  document.querySelector('#modal-event button[type="submit"]').classList.toggle('hidden', readonly);
  document.getElementById('event-readonly-note').classList.toggle('hidden', !readonly);
}

function openEventModal(eventId, options) {
  options = options || {};
  state.editingEventId = eventId || null;
  document.getElementById('event-form').reset();
  const ev = eventId ? state.events.find(e => e.id === eventId) : null;
  const readonly = !!(ev && ev.gcalImported);
  document.getElementById('event-delete').classList.toggle('hidden', !eventId || readonly);
  setEventFormReadOnly(readonly);

  const reminderSelect = document.getElementById('event-reminder');
  if (eventId) {
    document.getElementById('event-modal-title').textContent = readonly ? 'View event' : 'Edit event';
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
      if (ev.gcalImported) return;
      ev.title = title; ev.start = start.toISOString(); ev.end = end.toISOString();
      ev.category = state.selectedCategory; ev.notes = notes;
      if (ev.reminderMinutes !== reminderMinutes) ev.reminderFired = false;
      ev.reminderMinutes = reminderMinutes;
      ev.contactId = contactId;
      if (ev.gcalEventId) ev.gcalDirty = true;
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
      const ev = state.events.find(e => e.id === id);
      if (ev && ev.gcalImported) return;
      if (ev && ev.gcalEventId) {
        state.sync.pendingCalendarDeletes.push(ev.gcalEventId);
        persistSync();
      }
      state.events = state.events.filter(e => e.id !== id);
      persistEvents();
      closeModal('modal-event');
      refreshCurrentScreen();
      showToast('Event deleted');
    }, { title: 'Delete event', okLabel: 'Delete' });
  });
}

/* ===================== Tasks ===================== */

function openTaskModal(taskId, options) {
  options = options || {};
  state.editingTaskId = taskId || null;
  document.getElementById('task-form').reset();
  document.getElementById('task-delete').classList.toggle('hidden', !taskId);

  if (taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    document.getElementById('task-modal-title').textContent = 'Edit task';
    document.getElementById('task-title').value = task.title;
    document.getElementById('task-date').value = task.dueDate || '';
    document.getElementById('task-time').value = task.dueTime || '';
    document.getElementById('task-notes').value = task.notes || '';
    state.selectedTaskCategory = task.category;
  } else {
    document.getElementById('task-modal-title').textContent = 'New task';
    document.getElementById('task-date').value = options.date ? dateKey(options.date) : '';
    document.getElementById('task-time').value = '';
    document.getElementById('task-notes').value = '';
    state.selectedTaskCategory = state.categories[0] ? state.categories[0].id : null;
  }
  updateTaskCategoryPickerUI();
  openModal('modal-task');
}

function wireTaskForm() {
  document.getElementById('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title').value.trim();
    if (!title) return;
    const dueDate = document.getElementById('task-date').value || null;
    const dueTime = dueDate ? (document.getElementById('task-time').value || null) : null;
    const notes = document.getElementById('task-notes').value.trim();

    if (state.editingTaskId) {
      const task = state.tasks.find(t => t.id === state.editingTaskId);
      task.title = title; task.dueDate = dueDate; task.dueTime = dueTime;
      task.category = state.selectedTaskCategory; task.notes = notes;
    } else {
      state.tasks.push({
        id: uid(), title, dueDate, dueTime,
        category: state.selectedTaskCategory, notes, done: false,
        createdAt: new Date().toISOString(),
      });
    }

    persistTasks();
    closeModal('modal-task');
    refreshCurrentScreen();
    showToast('Task saved');
  });

  document.getElementById('task-delete').addEventListener('click', () => {
    const id = state.editingTaskId;
    confirmDialog("Delete this task? This can't be undone.", () => {
      state.tasks = state.tasks.filter(t => t.id !== id);
      persistTasks();
      closeModal('modal-task');
      refreshCurrentScreen();
      showToast('Task deleted');
    }, { title: 'Delete task', okLabel: 'Delete' });
  });
}

function toggleTaskDone(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.done = !task.done;
  persistTasks();
  refreshCurrentScreen();
}

function taskRowHtml(task) {
  const cat = getCategory(task.category);
  const dueLabel = task.dueDate
    ? `${formatDateFull(combineDateTime(task.dueDate, task.dueTime || '00:00'))}${task.dueTime ? ' · ' + formatTimeShort(combineDateTime(task.dueDate, task.dueTime)) : ''}`
    : 'No due date';
  return `<div class="contact-row task-row${task.done ? ' is-done' : ''}" data-task-id="${task.id}">
    <button type="button" class="task-checkbox" data-task-checkbox="${task.id}" aria-label="Mark done">${task.done ? '✓' : ''}</button>
    <div class="contact-row-main">
      <div class="contact-row-name">${cat.icon} ${escapeHtml(task.title)}</div>
      <div class="contact-row-tags"><span class="tag-pill">${dueLabel}</span></div>
    </div>
  </div>`;
}

function renderTaskList(containerId, tasks) {
  const container = document.getElementById(containerId);
  container.innerHTML = tasks.map(taskRowHtml).join('');
  container.querySelectorAll('[data-task-checkbox]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleTaskDone(btn.dataset.taskCheckbox); });
  });
  container.querySelectorAll('.task-row').forEach(row => {
    row.addEventListener('click', () => openTaskModal(row.dataset.taskId));
  });
}

function renderTasks() {
  document.getElementById('tasks-empty').classList.toggle('hidden', state.tasks.length > 0);
  document.getElementById('tasks-list-view').classList.toggle('hidden', state.tasks.length === 0);

  const today = dateKey(new Date());
  const overdue = [], todayList = [], upcoming = [], noDate = [], done = [];
  state.tasks.forEach(t => {
    if (t.done) { done.push(t); return; }
    if (!t.dueDate) { noDate.push(t); return; }
    if (t.dueDate < today) overdue.push(t);
    else if (t.dueDate === today) todayList.push(t);
    else upcoming.push(t);
  });
  const byDue = (a, b) => (a.dueDate || '').localeCompare(b.dueDate || '') || (a.dueTime || '').localeCompare(b.dueTime || '');
  overdue.sort(byDue); todayList.sort(byDue); upcoming.sort(byDue);
  done.sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''));

  renderTaskList('list-tasks-overdue', overdue);
  renderTaskList('list-tasks-today', todayList);
  renderTaskList('list-tasks-upcoming', upcoming);
  renderTaskList('list-tasks-nodate', noDate);
  renderTaskList('list-tasks-done', done);

  document.getElementById('section-tasks-overdue').classList.toggle('hidden', !overdue.length);
  document.getElementById('section-tasks-today').classList.toggle('hidden', !todayList.length);
  document.getElementById('section-tasks-upcoming').classList.toggle('hidden', !upcoming.length);
  document.getElementById('section-tasks-nodate').classList.toggle('hidden', !noDate.length);
  document.getElementById('section-tasks-done').classList.toggle('hidden', !done.length);
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
  const detailParts = [];
  if (c.company) detailParts.push(`🏢 ${escapeHtml(c.company)}`);
  if (c.phone) detailParts.push(`<a class="profile-link" href="tel:${escapeHtml(c.phone)}">📞 ${escapeHtml(c.phone)}</a>`);
  if (c.email) detailParts.push(`<a class="profile-link" href="mailto:${escapeHtml(c.email)}">✉️ ${escapeHtml(c.email)}</a>`);
  if (c.address) detailParts.push(`📍 ${escapeHtml(c.address)}`);
  const detailsHtml = detailParts.length ? detailParts.join('<br>') : '';
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
    ${detailsHtml ? `<div class="profile-section-title">Details</div><div class="profile-notes">${detailsHtml}</div>` : ''}
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

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

function openContactModal(contactId) {
  state.editingContactId = contactId || null;
  document.getElementById('contact-form').reset();
  document.getElementById('emoji-grid').classList.add('hidden');
  document.getElementById('contact-delete').classList.toggle('hidden', !contactId);

  buildIntroducedByOptions(contactId);

  if (contactId) {
    const c = state.contacts.find(x => x.id === contactId);
    const { firstName, lastName } = (c.firstName != null || c.lastName != null)
      ? { firstName: c.firstName || '', lastName: c.lastName || '' }
      : splitName(c.name);
    document.getElementById('contact-modal-title').textContent = 'Edit person';
    document.getElementById('contact-firstname').value = firstName;
    document.getElementById('contact-lastname').value = lastName;
    document.getElementById('contact-company').value = c.company || '';
    document.getElementById('contact-phone').value = c.phone || '';
    document.getElementById('contact-email').value = c.email || '';
    document.getElementById('contact-address').value = c.address || '';
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
    document.getElementById('contact-firstname').value = '';
    document.getElementById('contact-lastname').value = '';
    document.getElementById('contact-company').value = '';
    document.getElementById('contact-phone').value = '';
    document.getElementById('contact-email').value = '';
    document.getElementById('contact-address').value = '';
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
    const firstName = document.getElementById('contact-firstname').value.trim();
    const lastName = document.getElementById('contact-lastname').value.trim();
    const name = [firstName, lastName].filter(Boolean).join(' ');
    if (!name) return;
    const company = document.getElementById('contact-company').value.trim();
    const phone = document.getElementById('contact-phone').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const address = document.getElementById('contact-address').value.trim();
    const lastSeen = document.getElementById('contact-lastseen').value || null;
    const followUpFrequency = document.getElementById('contact-frequency').value;
    const notes = document.getElementById('contact-notes').value.trim();
    const circleId = state.selectedContactCircleId || defaultCircleId();
    const howMet = document.getElementById('contact-howmet').value.trim();
    const introducedBy = document.getElementById('contact-introduced-by').value || null;

    if (state.editingContactId) {
      const c = state.contacts.find(x => x.id === state.editingContactId);
      c.name = name; c.firstName = firstName; c.lastName = lastName;
      c.company = company; c.phone = phone; c.email = email; c.address = address;
      c.emoji = state.selectedEmoji; c.tags = state.contactTags.slice();
      c.lastSeen = lastSeen; c.followUpFrequency = followUpFrequency; c.notes = notes;
      c.circleId = circleId; c.howMet = howMet; c.introducedBy = introducedBy;
    } else {
      state.contacts.push({ id: uid(), name, firstName, lastName, company, phone, email, address, emoji: state.selectedEmoji, tags: state.contactTags.slice(), lastSeen, followUpFrequency, notes, circleId, howMet, introducedBy, createdAt: new Date().toISOString() });
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
    buildTaskCategoryPicker();
    refreshCurrentScreen();
    showToast('Category saved');
  });

  document.getElementById('category-delete').addEventListener('click', () => {
    const id = state.editingCategoryId;
    if (state.categories.length <= 1) { showToast("Can't delete the last category"); return; }
    if (state.events.some(ev => ev.category === id) || state.tasks.some(t => t.category === id)) {
      showToast('This category is used by an event or task — recategorize or delete those first');
      return;
    }
    confirmDialog('Delete this category?', () => {
      state.categories = state.categories.filter(c => c.id !== id);
      persistCategories();
      closeModal('modal-category');
      renderCategoryManager();
      buildCategoryPicker();
      buildTaskCategoryPicker();
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
  setActiveToggle('bubbledensity-toggle', 'densityOption', state.settings.bubbleDensity);
  setActiveToggle('bubbleradius-toggle', 'radiusOption', state.settings.bubbleRadius);
  setActiveToggle('bubblestyle-toggle', 'bubblestyleOption', state.settings.bubbleStyle);
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
function setActiveToggle(groupId, datasetKey, value) {
  document.querySelectorAll(`#${groupId} .view-toggle-btn`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset[datasetKey] === value);
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
  document.getElementById('bubbledensity-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-density-option]');
    if (!btn) return;
    state.settings.bubbleDensity = btn.dataset.densityOption;
    persistSettings();
    setActiveToggle('bubbledensity-toggle', 'densityOption', state.settings.bubbleDensity);
    document.getElementById('week-scroll').removeAttribute('data-scrolled');
    refreshCurrentScreen();
  });
  document.getElementById('bubbleradius-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-radius-option]');
    if (!btn) return;
    state.settings.bubbleRadius = btn.dataset.radiusOption;
    persistSettings();
    applyBubbleSettings();
    setActiveToggle('bubbleradius-toggle', 'radiusOption', state.settings.bubbleRadius);
  });
  document.getElementById('bubblestyle-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-bubblestyle-option]');
    if (!btn) return;
    state.settings.bubbleStyle = btn.dataset.bubblestyleOption;
    persistSettings();
    applyBubbleSettings();
    setActiveToggle('bubblestyle-toggle', 'bubblestyleOption', state.settings.bubbleStyle);
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
      localStorage.removeItem(STORAGE_KEYS.tasks);
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
  applyBubbleSettings();
  seedDemoData();

  buildCategoryPicker();
  buildTaskCategoryPicker();
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
  wireWeekHeaderScrollSync();
  wireContactCombobox();
  wireEventForm();
  wireTaskForm();
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
