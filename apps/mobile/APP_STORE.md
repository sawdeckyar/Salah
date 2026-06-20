# App Store release checklist (iOS)

Status legend: ✅ done · 🛠️ partial · ⬜ to do

## Accounts & build
- ⬜ Apple Developer Program enrollment ($99/yr)
- ✅ `bundleIdentifier` set (`com.sawdeckyar.salah`)
- ✅ EAS build profiles (`eas.json`); cloud build works from Windows
- ⬜ `eas build -p ios --profile production` + `eas submit -p ios --latest`
- 🛠️ App icon — replace the Expo default with a real 1024×1024 (no alpha)
- ⬜ iOS privacy manifest (`PrivacyInfo.xcprivacy`) if flagged by the build

## App Store Connect listing
- ⬜ Name, subtitle, description, keywords, category (Lifestyle/Reference)
- ⬜ Screenshots (iPhone 6.7" + 6.5" required)
- ⬜ Support URL + marketing URL
- ⬜ App Privacy labels: precise Location (app functionality), User Content;
      not linked to identity (anonymous)

## Legal / privacy (mandatory)
- ⬜ Privacy Policy URL (hosted page)
- ✅ Location usage string ("When In Use")
- ✅ OpenStreetMap attribution shown on maps

## ⚠️ User-Generated Content — App Review Guideline 1.2 (blocking)
The app has community posts, crowdsourced times, parking, RSVPs. Apple requires
ALL of these before approval:
- ⬜ EULA / terms with a no-tolerance policy for objectionable content
      (shown on first run; recorded acceptance)
- ⬜ Report / flag content
- ⬜ Block abusive users
- ⬜ Moderation: remove content / eject users (see Supabase README hardening)
- ⬜ Filtering of objectionable content (e.g. basic profanity/spam checks)

## Other likely review items
- ⬜ "Delete my contributions" (account-deletion-equivalent for anonymous users)
- ⬜ Seed a few real Community entries so reviewers don't see empty tabs
- N/A Sign in with Apple (no third-party login offered)

## Recommended order
1. Build UGC moderation (report/block/terms/remove) — the actual blocker.
2. Privacy policy page + App Privacy labels.
3. Real icon + screenshots + listing copy.
4. Enroll, build, TestFlight, submit.
