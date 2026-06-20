# Sharing Salah with testers

Two ways to let someone try the app who isn't on your Wi-Fi.

## A. Tunnel (fastest; your PC must stay running)

```powershell
cd apps/mobile
npx expo start --tunnel        # say yes if it offers to install @expo/ngrok
```
Send the tester the QR (screenshot) or the `exp://…` link. They install **Expo
Go** and scan it (iPhone: Camera app; Android: inside Expo Go). Works over
cellular / any network. Your machine has to keep the server running.

## B. Shareable build with EAS (PC can be off; no Expo Go)

One-time:
```powershell
npm i -g eas-cli
eas login                      # free Expo account
cd apps/mobile
eas init                       # creates the EAS project + projectId
```

Make the app's Supabase keys available to the build (so testers see shared data).
The anon key is safe to ship; set them as EAS env vars:
```powershell
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://<ref>.supabase.co" --environment preview
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon-key>" --environment preview
```

### Android tester (easiest — an installable APK link)
```powershell
eas build -p android --profile preview
```
When it finishes, EAS prints a URL. Send it to the tester; they tap it on an
Android phone and install the APK (they may need to allow "install from this
source"). No Apple account, no Expo Go.

### iPhone tester (needs Apple)
iOS can't sideload, so you need the **Apple Developer Program ($99/yr)**:
```powershell
eas build -p ios --profile preview      # EAS walks you through signing
```
Best distribution is **TestFlight**:
```powershell
eas submit -p ios --latest              # uploads to App Store Connect / TestFlight
```
Invite the tester by email in TestFlight. (Without a paid Apple account you can
only run on your own device via a dev build, not share to others.)

## Notes
- `preview` = a release-like internal build with no dev tools — ideal for testers.
- Free EAS tier has limited monthly build minutes but is enough for occasional builds.
- Rebuild only when native code/deps change; JS-only changes can later be pushed
  with `eas update` to existing preview builds.
