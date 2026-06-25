# Orbit — Your time. Your people.

A personal calendar with a lightweight CRM, built as a installable Progressive Web App. No backend, no accounts, no database — everything lives in your browser's `localStorage`.

## Features

- **Calendar** — week and month views, color-coded categories (Work, Social, Health, Personal, Meal), tap-to-create events, swipe-free navigation via Prev/Next/Today.
- **People (CRM)** — track who you've seen and when. Contacts are sorted into *Overdue — reach out*, *Coming up*, and *All good* based on a per-person follow-up frequency (weekly / monthly / quarterly / none).
- **Reminders** — set a reminder (10 min / 30 min / 1 hr / 1 day before) on any event and get a browser notification while Orbit is open or backgrounded. An optional daily 8am digest summarizes the day's events.
- **Installable PWA** — add Orbit to your iPhone or Android home screen for a full-screen, app-like experience with offline support.

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

## Data & privacy

All events and contacts are stored only in your browser's `localStorage` on your device. Nothing is sent to a server. Clearing your browser data (or using "Clear all data" in Settings) removes it permanently.
