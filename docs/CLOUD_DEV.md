# Develop & emulate from your iPhone using a cloud box

No PC needed. You run a terminal in the cloud, start the Expo dev server with a
public **tunnel**, and connect from **Expo Go** on your iPhone. Claude Code keeps
pushing changes; you pull + reload.

```
 iPhone ── Expo Go (scan QR) ──▶  cloud box runs: npx expo start --tunnel
   ▲                                         ▲
   └────────── live reload ──────────────────┘   (Claude Code pushes; you `git pull`)
```

This tests the app on your real iPhone, key-free and Apple-account-free. (A real
installable TestFlight build still needs the $99 Apple account — see
CLOUD_BUILD.md — but you don't need it just to run/emulate.)

---

## Option A — GitHub Codespaces (simplest; nothing to manage)

The repo includes a devcontainer, so a Codespace comes ready (Node + eas-cli +
ngrok + deps installed).

1. On your iPhone, open **github.com → sawdeckyar/Salah → Code ▸ Codespaces ▸
   Create codespace** on branch `claude/prayer-times-location-xqxowf`.
   (Opens a full VS Code with a terminal in Safari.)
2. In the terminal:
   ```
   cd apps/mobile
   npx expo start --tunnel
   ```
3. A QR code prints. On the iPhone, install **Expo Go**, then scan the QR with
   the **Camera** app → opens in Expo Go. Allow location.
4. When Claude Code pushes changes: in the terminal, `git pull` then press `r`
   in the Expo process to reload (or shake the phone → Reload).

Tip: typing in Safari's terminal is fiddly — mostly you only run a couple of
commands, and Claude Code does the editing/pushing.

## Option B — A cheap VPS + SSH app (nicer mobile terminal, persistent)

Money's no issue, and this gives the smoothest phone experience.

1. Create a small Linux box: **Hetzner CX22 (~€4/mo)**, DigitalOcean, or AWS
   Lightsail — Ubuntu 22.04+, 2 GB RAM is plenty.
2. On your iPhone install an SSH app: **Blink Shell** or **Termius**. Add the
   box's IP + your key/password.
3. SSH in and set it up once:
   ```
   sudo apt update && sudo apt install -y git
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   npm i -g eas-cli @expo/ngrok
   git clone https://github.com/sawdeckyar/Salah.git
   cd Salah && npm install
   ```
4. Run it:
   ```
   cd apps/mobile && npx expo start --tunnel
   ```
   Scan the QR with Expo Go. Pull + reload as Claude Code pushes.

Keep it running with `tmux` so it survives disconnects:
`tmux new -s salah` → run expo → detach with `Ctrl-b d`, reattach `tmux a -t salah`.

---

## Doing the cloud build from the box too

The same terminal (Codespace or VPS) can run the EAS setup from CLOUD_BUILD.md:
```
eas login
cd apps/mobile && eas init
eas update:configure          # for OTA updates
eas build -p android --profile preview   # APK link for Android testers
# iOS: eas build -p ios --profile preview  (needs Apple Developer account)
```
After that, the GitHub Actions in `.github/workflows/` can build/OTA on every
push — so you may not even need the box for day-to-day, just for the first setup
and for Expo Go tunnel sessions.

## Which to pick
- **Just want to see it on your iPhone now:** Codespaces + `expo start --tunnel`
  + Expo Go. Fastest.
- **Want a comfy, persistent phone setup:** small VPS + Blink/Termius.
- **Want installable builds / TestFlight:** do the EAS setup once on either, then
  let GitHub Actions take over.
