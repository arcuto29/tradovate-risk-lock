# Tradovate Risk Settings Lock

A Windows desktop app + Chrome/Edge browser extension that prevents traders from **weakening** their Tradovate risk settings during an active trading session.

## The Problem

Tradovate lets you set risk limits and even has a built-in "Lock Risk Settings" toggle — but that only activates after a limit is hit. Before that, you can go back, increase your loss limit, remove your profit target, and keep trading emotionally.

This tool locks your settings **proactively at the start of the session**.

## How It Works

1. Open the desktop app before trading
2. Enter your risk limits (same as in Tradovate)
3. Press **"Lock for Today"**
4. The browser extension blocks any API call that would *weaken* your settings
5. Auto-unlocks at your configured reset time (default: 5:00 PM ET)

## Directional Blocking

This does NOT block all access to Tradovate's risk settings page.

**You CAN still:**
- Open risk settings to view them
- Tighten limits (lower your loss limit)
- Lock your account after a win
- Enable "Lock Risk Settings if Trading Locked"
- Set a profit trigger to auto-lock

**You CANNOT:**
- Increase your loss limit
- Remove a profit target
- Increase max position size
- Disable risk locks
- Delete risk parameters

## Quick Start

### Desktop App
```bash
cd desktop-app
npm install
npm run build
npm start
```

### Browser Extension
1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the `browser-extension/` folder

## Architecture

- **Desktop App:** Electron + React + TypeScript + SQLite
- **Browser Extension:** Chrome Manifest V3, connects via WebSocket (port 47392)
- **Communication:** Desktop runs WebSocket server, extension connects as client

## Important Disclaimer

This is a **behavioral barrier**, not a security system. It creates friction during emotional moments. A determined user with admin access CAN bypass it. The goal is that the extra steps give you time to reconsider.

This does NOT replace Tradovate's risk management. It does NOT connect to Tradovate's servers. It only prevents your browser from sending API calls that weaken your settings.
