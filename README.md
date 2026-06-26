# Orbit — Your time. Your people.

A personal calendar with a lightweight CRM, built as a installable Progressive Web App. No backend, no accounts, no database — everything lives in your browser's `localStorage`.

## Features

- **Calendar** — week and month views, color-coded categories (Work, Social, Health, Personal, Meal), tap-to-create events, swipe-free navigation via Prev/Next/Today.
- **People (CRM)** — track who you've seen and when. Contacts are sorted into *Overdue — reach out*, *Coming up*, and *All good* based on a per-person follow-up frequency (weekly / monthly / quarterly / none). Switch to the **Bubbles** view to see your people grouped into relationship circles (Family, Close Friends, Friends, Work, Acquaintances, or your own custom circles) as a cluster of avatar bubbles. Each contact can also record *how you met* and *who introduced you* — shown on their profile as a clickable link to the connecting person.
- **Reminders** — set a reminder (10 min / 30 min / 1 hr / 1 day before) on any event and get a browser notification while Orbit is open or backgrounded. An optional daily 8am digest summarizes the day's events.
- **Installable PWA** — add Orbit to your iPhone or Android home screen for a full-screen, app-like experience with offline support.
- **Cross-device sync (optional)** — connect your own Google Drive to sync events, contacts, categories, circles, and settings across devices. Optionally also push your events to a dedicated **Orbit** calendar in Google Calendar, so they show up alongside your other calendars. See [Cross-device sync](#cross-device-sync-optional) below.
- **Customizable** — light/dark/auto theme, your own accent color, editable event categories, editable relationship circles, configurable week-start/default view/day hours, and editable reminder & follow-up presets.

## Tech

Vanilla HTML/CSS/JS, no build step, no frameworks, no dependencies. Data is stored as JSON in `localStorage`. A service worker (`sw.js`) caches the app shell for offline use.

| File | Purpose |
|---|---|
| `index.html` | App shell and markup |
| `style.css` | Dark neon theme |
| `app.js` | All application logic |
| `sw.js` | Service worker (offline cache, notification clicks) |
| `manifest.json` | PWA manifest |
| `icons/` | App icons |

## Running locally

Any static file server works. For example:

```bash
npx http-server . -p 8899
```

Then open `http://localhost:8899` in a browser. Service worker registration and most PWA features work fine over plain `http://localhost`.

## Deploying (for real install on iPhone)

iOS only allows "Add to Home Screen" installs and notification permissions over **HTTPS**, so for real-world use you'll want to host this somewhere with TLS. The easiest free option is **GitHub Pages**:

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`, pick the branch you want to publish (e.g. `main`), and folder `/ (root)`.
4. Save. GitHub will publish the site at `https://<your-username>.github.io/<repo-name>/`.
5. On your iPhone, open that URL in **Safari**, tap the **Share** icon, then **Add to Home Screen**.

Once installed, Orbit runs full-screen and offline, with browser-native notifications for reminders and the daily digest while the app is open or running in the background. Since there's no server, it can't wake your phone while Orbit is fully closed — keep it on your home screen and check in periodically for the most reliable reminders.

## Cross-device sync (optional)

Orbit is local-first by default — nothing leaves your device unless you turn this on. If you want your calendar and contacts to follow you between your phone and computer, you can connect your own Google Drive. Orbit stores one file, `orbit-data.json`, in your Drive and keeps it in sync (last-write-wins — fine for one person on a couple of personal devices).

Setting it up requires a few minutes in the Google Cloud Console, under your own Google account:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project (e.g. "Orbit Personal Calendar").
2. **APIs & Services → Library** → enable the **Google Drive API** and the **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** → User type **External** → app name "Orbit" → leave **Publishing status: Testing** (this skips Google's app-review process, which isn't needed for a personal app) → add your own Gmail address under **Test users** → add the scopes `https://www.googleapis.com/auth/drive.file` and `https://www.googleapis.com/auth/calendar.events`.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → type **Web application** → under **Authorized JavaScript origins**, add `http://localhost:8899` (for local testing) and `https://<your-github-username>.github.io` (once deployed to Pages) → create, and copy the **Client ID**.
5. Paste that Client ID into the `DRIVE_CONFIG.clientId` constant near the top of `app.js`.
6. Open Orbit → **Settings → Sync** → **Connect**, and sign in with the same Google account you added as a test user.

Trade-off: staying in "Testing" mode (recommended) means your sign-in expires after about a week, so you'll occasionally need to tap **Connect** again on each device — a small price for skipping Google's full app-verification process, which isn't worth it for an app only you use.

**Troubleshooting "Error 400: origin_mismatch"**: Google checks the exact origin (scheme + host, no path) the page is served from against the **Authorized JavaScript origins** list on your OAuth Client. Every place you open Orbit from — `http://localhost:8899` while developing, `https://<your-github-username>.github.io` once on Pages, or any custom domain you add later — needs to be added there individually (**APIs & Services → Credentials → your Client ID → Authorized JavaScript origins → + Add URI**). Forgetting to add a new origin after deploying somewhere new is the most common cause of this error.

### Also syncing to Google Calendar

Once Drive sync is connected, **Settings → Sync** shows a second toggle, **Google Calendar**. Turning it on creates a calendar named **Orbit** in your Google account (separate from your primary calendar, so it doesn't mix with anything else) and pushes every event you create or edit in Orbit there — creates, edits, and deletes all follow. It's one-way (Orbit → Google Calendar); editing an event directly in Google Calendar won't sync back into Orbit.

This reuses the same sign-in as Drive sync, just with the extra `calendar.events` scope from step 3 above — if you connected before that scope existed, tap **Connect** (or **Sync now** once it shows "Sign-in expired") to re-consent. If the toggle does nothing and the status shows "Offline" or an error, double check the **Google Calendar API** is enabled in your Cloud Console project (step 2) — a freshly-created project usually only has the Drive API enabled.

## Data & privacy

All events and contacts are stored in your browser's `localStorage` on your device. Nothing is sent to a server unless you explicitly connect Google Drive sync (see above), in which case your data is written only to a single file in *your own* Drive — never to any server we operate, because there is none. If you also turn on Google Calendar sync, your event titles, times, and notes are written to the "Orbit" calendar in *your own* Google Calendar — same trust boundary, still nothing touches a server we control. Clearing your browser data (or using "Clear all data" in Settings) removes everything locally; disconnecting sync in Settings stops syncing but leaves the Drive file, the Orbit calendar, and your local data intact.
