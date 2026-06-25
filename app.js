'use strict';

/* ===================== Constants ===================== */

const STORAGE_KEYS = {
  events: 'orbit_events',
  contacts: 'orbit_contacts',
  settings: 'orbit_settings',
  seeded: 'orbit_seeded',
};

const CATEGORIES = {
  work:     { label: 'Work / Focus',       color: '#00f5ff', icon: '💼' },
  social:   { label: 'Social / Friends',   color: '#bf5af2', icon: '🎉' },
  health:   { label: 'Health / Exercise',  color: '#39ff14', icon: '🏃' },
  personal: { label: 'Personal / Errands', color: '#f5a623', icon: '🧾' },
  meal:     { label: 'Meal / Food',        color: '#ff6ec7', icon: '🍽️' },
};

const FOLLOWUP_LABELS = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Every 3 months', none: 'No reminder' };
const FOLLOWUP_DAYS = { weekly: 7, monthly: 30, quarterly: 90, none: null };

const EMOJI_CHOICES = ['🙂','😀','😎','🤓','🥳','😇','🤠','🧑','👩','👨','🧔','👱','👩‍🦱','👨‍🦱','👩‍🦰','🧑‍🦳','👩‍🦳','🧑‍🦲','🧑‍💼','👩‍💻','👨‍💻','🧑‍🎨','🧑‍🏫','🧑‍⚕️','🧑‍🍳','🧑‍🚀','🧑‍🎤','👵','👴','🐱','🐶','💼'];

const TAG_SUGGESTIONS = ['close friend', 'friend', 'family', 'colleague', 'acquaintance'];

const HOUR_HEIGHT = 56; // px — keep in sync with style.css .hour-line/.hour-label
const WEEK_START_HOUR = 0;
const WEEK_END_HOUR = 24;

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

const state = {
  events: loadJSON(STORAGE_KEYS.events, []),
  contacts: loadJSON(STORAGE_KEYS.contacts, []),
  settings: Object.assign({ dailyDigest: true, lastDigestDate: null }, loadJSON(STORAGE_KEYS.settings, {})),
  view: 'week',
  currentDate: new Date(),
  screen: 'calendar',
  activeContactId: null,
  editingEventId: null,
  editingContactId: null,
  pendingConfirmAction: null,
  selectedEventContactId: null,
  selectedCategory: 'work',
  selectedEmoji: '🙂',
  contactTags: [],
};

function persistEvents() { saveJSON(STORAGE_KEYS.events, state.events); }
function persistContacts() { saveJSON(STORAGE_KEYS.contacts, state.contacts); }
function persistSettings() { saveJSON(STORAGE_KEYS.settings, state.settings); }

/* ===================== Date utils ===================== */

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function isSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function startOfWeek(d) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // Monday = 0
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

  const sam = makeContact({ name: 'Sam Rivera', emoji: '🧑‍🎤', tags: ['close friend'], lastSeen: dateKey(addDays(now, -10)), followUpFrequency: 'weekly', notes: 'Met at the climbing gym. Always up for tacos.' });
  const priya = makeContact({ name: 'Priya Desai', emoji: '👩‍👧', tags: ['family'], lastSeen: dateKey(addDays(now, -50)), followUpFrequency: 'monthly', notes: 'Sister — call more often!' });
  const jess = makeContact({ name: 'Jess Patel', emoji: '🧑‍💻', tags: ['colleague'], lastSeen: dateKey(addDays(now, -5)), followUpFrequency: 'quarterly', notes: 'Work friend from the design team.' });

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
  const thresholdDays = FOLLOWUP_DAYS[contact.followUpFrequency];
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
  else if (screen === 'people') renderPeople();
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
  const cat = CATEGORIES[p.ev.category] || CATEGORIES.work;
  const pill = document.createElement('div');
  pill.className = 'event-pill';
  const top = ((p.startMin - WEEK_START_HOUR * 60) / 60) * HOUR_HEIGHT;
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

  const hoursCol = document.getElementById('hours-col');
  hoursCol.innerHTML = '';
  for (let h = WEEK_START_HOUR; h < WEEK_END_HOUR; h++) {
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
    col.style.height = `${(WEEK_END_HOUR - WEEK_START_HOUR) * HOUR_HEIGHT}px`;
    for (let h = WEEK_START_HOUR; h < WEEK_END_HOUR; h++) {
      const line = document.createElement('div');
      line.className = 'hour-line';
      col.appendChild(line);
    }

    col.addEventListener('click', (e) => {
      if (e.target.closest('.event-pill')) return;
      const rect = col.getBoundingClientRect();
      const offsetY = e.clientY - rect.top;
      const minutesFromStart = (offsetY / HOUR_HEIGHT) * 60;
      const snapped = Math.round((WEEK_START_HOUR * 60 + minutesFromStart) / 30) * 30;
      const startD = new Date(d);
      startD.setHours(0, snapped, 0, 0);
      openEventModal(null, { date: startD });
    });

    const dayItems = state.events
      .filter(ev => isSameDay(new Date(ev.start), d))
      .map(ev => {
        const startD = new Date(ev.start), endD = new Date(ev.end);
        const startMin = minutesOf(startD);
        const endMin = isSameDay(startD, endD) ? Math.max(startMin + 15, minutesOf(endD)) : WEEK_END_HOUR * 60;
        return { ev, startMin, endMin };
      });
    layoutDayEvents(dayItems).forEach(p => col.appendChild(renderEventPill(p)));

    if (isSameDay(d, today)) {
      const nowMin = minutesOf(today);
      const line = document.createElement('div');
      line.className = 'now-line';
      line.style.top = `${((nowMin - WEEK_START_HOUR * 60) / 60) * HOUR_HEIGHT}px`;
      col.appendChild(line);
    }

    daysGrid.appendChild(col);
  }

  const scrollEl = document.getElementById('week-scroll');
  if (!scrollEl.dataset.scrolled) {
    scrollEl.scrollTop = Math.max(0, (7 - WEEK_START_HOUR) * HOUR_HEIGHT - 40);
    scrollEl.dataset.scrolled = '1';
  }
}

function renderMonth() {
  const monthStart = startOfMonth(state.currentDate);
  const gridStart = startOfWeek(monthStart);
  const today = new Date();

  const weekdayRow = document.getElementById('month-weekday-row');
  if (!weekdayRow.dataset.built) {
    weekdayRow.innerHTML = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span>${d}</span>`).join('');
    weekdayRow.dataset.built = '1';
  }

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
        const cat = CATEGORIES[ev.category] || CATEGORIES.work;
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
  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-pill';
    btn.dataset.category = key;
    btn.style.setProperty('--cat-color', cat.color);
    btn.style.setProperty('--cat-glow', hexToRgba(cat.color, 0.3));
    btn.innerHTML = `${cat.icon} ${cat.label.split(' / ')[0]}`;
    btn.addEventListener('click', () => { state.selectedCategory = key; updateCategoryPickerUI(); });
    picker.appendChild(btn);
  });
}
function updateCategoryPickerUI() {
  document.querySelectorAll('.category-pill').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.category === state.selectedCategory);
  });
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

  if (eventId) {
    const ev = state.events.find(e => e.id === eventId);
    document.getElementById('event-modal-title').textContent = 'Edit event';
    document.getElementById('event-title').value = ev.title;
    const start = new Date(ev.start), end = new Date(ev.end);
    document.getElementById('event-date').value = dateKey(start);
    document.getElementById('event-start').value = timeKey(start);
    document.getElementById('event-end').value = timeKey(end);
    document.getElementById('event-notes').value = ev.notes || '';
    document.getElementById('event-reminder').value = ev.reminderMinutes != null ? String(ev.reminderMinutes) : '';
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
    document.getElementById('event-reminder').value = '';
    state.selectedCategory = 'work';
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

  document.getElementById('people-empty').classList.toggle('hidden', state.contacts.length > 0);

  renderContactList('list-overdue', overdue, 'overdue');
  renderContactList('list-upcoming', upcoming, 'upcoming');
  renderContactList('list-good', good, 'good');
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
  const cat = CATEGORIES[ev.category] || CATEGORIES.work;
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

  content.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">${c.emoji}</div>
      <div class="profile-name">${escapeHtml(c.name)}</div>
      <div class="profile-tags">${tagsHtml}</div>
    </div>
    <div class="profile-stats">
      <div class="profile-stat"><div class="profile-stat-label">Last seen</div><div class="profile-stat-value">${lastSeenText}</div></div>
      <div class="profile-stat"><div class="profile-stat-label">Next planned</div><div class="profile-stat-value">${nextText}</div></div>
      <div class="profile-stat"><div class="profile-stat-label">Follow-up</div><div class="profile-stat-value">${FOLLOWUP_LABELS[c.followUpFrequency]}</div></div>
      <div class="profile-stat"><div class="profile-stat-label">Status</div><div class="profile-stat-value">${statusLabel}</div></div>
    </div>
    <div class="profile-actions">
      <button type="button" class="pill-btn pill-btn-primary" id="btn-plan-something">Plan something</button>
      <button type="button" class="pill-btn" id="btn-edit-contact">Edit</button>
    </div>
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
}

/* ===================== CRM — Contact modal ===================== */

function buildEmojiGrid() {
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = '';
  EMOJI_CHOICES.forEach(em => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-option';
    btn.textContent = em;
    btn.addEventListener('click', () => {
      state.selectedEmoji = em;
      document.getElementById('contact-emoji-btn').textContent = em;
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

  if (contactId) {
    const c = state.contacts.find(x => x.id === contactId);
    document.getElementById('contact-modal-title').textContent = 'Edit person';
    document.getElementById('contact-name').value = c.name;
    state.selectedEmoji = c.emoji;
    document.getElementById('contact-emoji-btn').textContent = c.emoji;
    state.contactTags = (c.tags || []).slice();
    document.getElementById('contact-lastseen').value = c.lastSeen || '';
    document.getElementById('contact-frequency').value = c.followUpFrequency;
    document.getElementById('contact-notes').value = c.notes || '';
  } else {
    document.getElementById('contact-modal-title').textContent = 'New person';
    state.selectedEmoji = '🙂';
    document.getElementById('contact-emoji-btn').textContent = '🙂';
    state.contactTags = [];
    document.getElementById('contact-lastseen').value = '';
    document.getElementById('contact-frequency').value = 'monthly';
    document.getElementById('contact-notes').value = '';
  }
  renderTagChips();
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

    if (state.editingContactId) {
      const c = state.contacts.find(x => x.id === state.editingContactId);
      c.name = name; c.emoji = state.selectedEmoji; c.tags = state.contactTags.slice();
      c.lastSeen = lastSeen; c.followUpFrequency = followUpFrequency; c.notes = notes;
    } else {
      state.contacts.push({ id: uid(), name, emoji: state.selectedEmoji, tags: state.contactTags.slice(), lastSeen, followUpFrequency, notes, createdAt: new Date().toISOString() });
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
      persistContacts();
      persistEvents();
      closeModal('modal-contact');
      if (state.screen === 'contact-profile') switchScreen('people');
      else refreshCurrentScreen();
      showToast('Person deleted');
    }, { title: 'Delete person', okLabel: 'Delete' });
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
  updateNotifPermissionUI();
  updateInstallUI();
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
  document.getElementById('btn-enable-notif').addEventListener('click', async () => {
    await requestNotificationPermission();
    updateNotifPermissionUI();
  });
  document.getElementById('btn-clear-data').addEventListener('click', () => {
    confirmDialog("This will permanently delete all events and contacts. This can't be undone.", () => {
      localStorage.removeItem(STORAGE_KEYS.events);
      localStorage.removeItem(STORAGE_KEYS.contacts);
      localStorage.removeItem(STORAGE_KEYS.settings);
      localStorage.removeItem(STORAGE_KEYS.seeded);
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
      const cat = CATEGORIES[ev.category];
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
  seedDemoData();

  buildCategoryPicker();
  buildEmojiGrid();
  buildTagSuggestions();

  wireGenericModalClosers();
  wireBottomNav();
  wireCalendarControls();
  wireContactCombobox();
  wireEventForm();
  wireContactModalWidgets();
  wireContactForm();
  wireSettings();

  switchScreen('calendar');
  registerServiceWorker();
  requestNotificationPermission().finally(updateNotifPermissionUI);
  startReminderLoop();
}

init();
