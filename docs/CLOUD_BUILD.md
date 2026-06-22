# Cloud build & test loop (drive from your iPhone, no PC)

Goal: edit with Claude Code (web/iPhone) → push → GitHub Actions → **EAS** builds
in the cloud → install/refresh on your iPhone. No local Metro server.

## One-time setup (do this once; a terminal is needed — your PC is fine)

1. **Expo account + token**
   ```
   npm i -g eas-cli
   eas login
   cd apps/mobile && eas init        # creates the EAS project + projectId
   npx expo whoami                   # confirm
   ```
   Create an **access token**: expo.dev → Account → Settings → Access Tokens →
   create one.

2. **Add it to GitHub** (so the cloud workflows can build):
   GitHub repo → Settings → Secrets and variables → Actions → New secret →
   name `EXPO_TOKEN`, paste the token.

3. **Backend keys for the build** (so testers see shared data):
   ```
   eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://<ref>.supabase.co" --environment preview
   eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon-key>" --environment preview
   ```

4. **For OTA updates (optional but recommended):**
   ```
   cd apps/mobile && eas update:configure   # adds expo-updates + runtime config
   git add -A && git commit -m "chore: configure eas update" && git push
   ```

5. **iOS only:** an **Apple Developer account ($99/yr)**. The first iOS build sets
   up signing — run `eas build -p ios --profile preview` once and let EAS manage
   credentials (it logs into Apple for you), then TestFlight via `eas submit`.
   Android needs none of this.

## The day-to-day loop (iPhone only)

- **JS/UI change:** ask Claude Code to make it and push. The **EAS Update (OTA)**
  workflow runs automatically; reopen the installed preview app to get it.
- **Native change (new dependency, permissions, icon):** trigger a rebuild —
  on github.com or the GitHub mobile app: **Actions → EAS Build → Run workflow**
  → choose platform/profile. EAS emails a link / posts it in the run logs.
- **Install on your iPhone:**
  - Easiest: **TestFlight** (after `eas submit -p ios`). Re-installs aren't needed
    for OTA updates.
  - Or an **ad-hoc** preview build link (your device must be registered).

## "Emulate in a browser" (optional)

Upload an EAS build artifact to **Appetize.io** and run it in Safari on your
iPhone — a cloud device emulator. Slower than a real install; re-upload per build.

## Quick Android path (no Apple, fastest to a shareable app)

`Actions → EAS Build → platform: android, profile: preview` → install the APK
link on any Android phone. Great for testers even if you're iPhone-only.

## Notes
- The workflows live in `.github/workflows/` (`eas-build.yml`, `eas-update.yml`).
- This Claude Code sandbox can't run EAS itself (Expo's API isn't reachable here
  and it isn't logged into your accounts) — that's why the build runs on EAS via
  GitHub Actions with your `EXPO_TOKEN`.
- Expo Go + `expo start --tunnel` still works for a quick look, but it needs a
  machine running the dev server; the EAS loop above is the PC-free option.
