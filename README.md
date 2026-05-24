# Location Majdi Ben Aissa

## Deploying updates

Every push to `main` triggers the GitHub Actions pipeline automatically. You don't run anything manually anymore.

### JS-only change (UI, logic, bug fix)
Just push normally:
```
git add .
git commit -m "fix: whatever you changed"
git push
```
The pipeline runs `eas update` → everyone gets it silently on next app open. Done.

### Native change (new package, permissions, app.json config)
Add `[native]` anywhere in your commit message:
```
git add .
git commit -m "[native] add expo-camera"
git push
```
The pipeline will:
1. Build a new APK via EAS (takes ~10 min)
2. Publish it as a GitHub Release (latest release always has the download link)
3. Bump `minimum_build_version` in Supabase

Users will see a blocking "update required" screen next time they open the app, with a button that opens the download link. They reinstall once, then they're back on OTA updates.

---

## How to tell if a change is native

Native = you ran `npx expo install <package>` or changed `app.json` plugins/permissions.  
JS-only = everything else.

When in doubt, use `[native]` — it's safer to rebuild than to ship a broken OTA.