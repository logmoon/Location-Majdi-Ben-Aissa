# Location Majdi Ben Aissa

Mobile app for managing 5 rental houses in Tunisia. Built with React Native / Expo.

## Features

**Browsing & Availability**
- Home screen lists all houses with name, price, and live availability status (green/red badge)
- Filter houses by date range or specific property
- House detail page with image gallery, lightbox, description, and quick-link to calendar

**Calendar & Bookings**
- Scrollable monthly calendar spanning 37 months
- Half-day booking support — each day cell can split AM/PM with color coding
- Add, edit, delete rentals with renter name, notes, and half-day start/end toggles
- Overlap detection prevents double-booking

**Admin Authentication**
- Password-based login verified server-side via bcrypt + JWT
- Session stored securely, auto-logout if password is changed remotely
- Push token registration on login for notifications

**House Management (Admin)**
- Full CRUD for houses (name, description, code, price)
- Image upload from gallery or camera, stored in Supabase Storage
- Inline flow: add a house, then immediately add images

**Task Management (Admin)**
- Four task categories: Cleaning, Purchase, Repair, Replacement — each with color + icon
- Full CRUD with urgent flag, sorted by urgency then newest first
- Auto-creates cleaning tasks when a rental ends
- Collapsible section for completed tasks

**Offline-First**
- Works without internet — data cached in AsyncStorage
- Red offline banner with last-connected time and retry button
- Pending operations (adds/updates/deletes) queued and synced when online
- Optimistic UI updates, async backend sync

**Push Notifications**
- Real-time notifications when rentals or tasks change (via Supabase webhooks)
- Three daily reminders: check-in morning, noon checkout, evening checkout
- Sent to all registered admin devices

**Force Updates**
- On launch, checks minimum build version from Supabase
- If outdated, blocks usage with a modal and directs to the latest APK download

**Sharing**
- QR code modal linking to the latest APK download
- Copy-link button

## Architecture

```
React Native App  ──HTTP──►  Supabase
  │                            ├── PostgreSQL (houses, rentals, tasks, ...)
  ├── Expo Router              ├── Edge Functions (auth, notifications)
  ├── Context API              ├── Storage (house images)
  ├── Service Layer            └── Realtime subscriptions
  ├── Pure Logic (lib/)
  └── AsyncStorage (offline)
```

App entry: `app/_layout.tsx` — sets up navigation and global providers.

**Contexts:** `RentalContext` (houses + rentals + admin state), `TaskContext` (house tasks), `NetworkContext` (connectivity).

**Services** in `app/services/` — Supabase CRUD with retry, offline queue.

**Pure logic** in `lib/` — no React imports, fully testable (overlap detection, calendar math, task sorting).

---

## Deploying updates

Every push to `main` triggers the GitHub Actions pipeline automatically.

### JS-only change (UI, logic, bug fix)

```
git add .
git commit -m "fix: whatever you changed"
git push
```

The pipeline runs `eas update` → everyone gets it silently on next app open.

### Native change (new package, permissions, app.json config)

Add `[native]` anywhere in your commit message:

```
git add .
git commit -m "[native] add expo-camera"
git push
```

The pipeline will:
1. Build a new APK via EAS
2. Publish it as a GitHub Release
3. Bump `minimum_build_version` in Supabase

Users see a blocking "update required" screen with a download button.

### How to tell if a change is native

Native = you ran `npx expo install <package>` or changed `app.json` plugins/permissions. JS-only = everything else. When in doubt, use `[native]`.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.79 + Expo SDK 53 |
| Language | TypeScript (strict) |
| Navigation | Expo Router 5 (file-based) |
| State | React Context API |
| Backend | Supabase (PostgreSQL, Storage, Edge Functions) |
| Auth | Custom JWT via Edge Function |
| Notifications | Expo Push Notifications |
| Offline | AsyncStorage |
| CI/CD | GitHub Actions, EAS Build/Update |
| Testing | Jest + ts-jest |
