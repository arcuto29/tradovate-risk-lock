# Sentinel Broker Certification

## Overview

Sentinel supports trading platforms at different certification levels. Each platform must be individually verified before it can be labeled as fully protected.

## Support Levels

| Level | Meaning | Order Interception | What Works |
|-------|---------|-------------------|------------|
| **VERIFIED** | All order types tested and confirmed | Full | Everything |
| **BETA** | Most order types working | Partial | Opens/closes detected, some edge cases unverified |
| **EXPERIMENTAL** | Basic detection, not all paths confirmed | Limited | Some orders detected, diagnostics active |
| **LOCKOUT_ONLY** | Cannot intercept individual orders | None | Platform blocklist (kill app + hosts file) only |

## Current Platform Status

| Platform | Level | Transport | Notes |
|----------|-------|-----------|-------|
| TopstepX | BETA | fetch/XHR | REST API confirmed. Close/reduce detection needs verification. |
| Tradesea | EXPERIMENTAL | fetch/XHR | Similar to TopstepX. Unverified. |
| Tradovate Web | EXPERIMENTAL | fetch/XHR | Uses separate injector. Unverified with new classifier. |
| TradingView Paper | EXPERIMENTAL | WebSocket | Orders via WS. Diagnostics phase - cannot intercept yet. |
| TradingView + Tradovate | EXPERIMENTAL | fetch+WS | May route to Tradovate API. Unverified. |
| TradingView + Other Broker | LOCKOUT_ONLY | Unknown | Cannot certify. Lockout/blocklist protection only. |

## How to Certify a New Broker

### Step 1: Collect Diagnostics

1. Enable Dev Mode in Sentinel (Ctrl+Shift+D)
2. Load the extension on the trading platform
3. For REST platforms: `__sentinel.enableDiagnostics()`
4. For WebSocket platforms: `__sentinelWS.enable()`
5. Set action labels before each trade: `__sentinelWS.setAction("BUY_OPEN")`

### Step 2: Test Each Action

Perform these actions one at a time on PAPER/SIM trading:

1. Flat -> Market Buy 1 contract
2. Close that long position
3. Flat -> Market Sell 1 contract
4. Close that short position
5. Long 3 -> Sell 1 (partial reduce)
6. Long 3 -> Sell 3 (full close)
7. Long 3 -> Sell 5 (reversal)
8. Place and cancel a limit order
9. Place and cancel a stop order
10. Move a stop loss tighter
11. Move a stop loss wider
12. Move a take profit
13. Use flatten/close all button
14. Use chart trading buttons
15. Use DOM/order book if supported

### Step 3: Export and Analyze

1. Export: `__sentinel.exportDiagnostics()` or `__sentinelWS.export()`
2. Review the JSON for order patterns
3. Identify request formats for each action type
4. Create sanitized fixtures in `browser-extension/fixtures/`

### Step 4: Build Adapter

1. Create adapter in `browser-extension/src/platforms/{platform}/adapter.js`
2. Implement `parseFetch()`, `parseXHR()`, or `parseWebSocket()` based on transport
3. Implement `classifyOrder()` using the captured patterns
4. Add to the platform registry

### Step 5: Replay Test

1. Load fixtures
2. Run each fixture through the adapter's parser + classifier
3. Verify expected classification matches actual
4. Fix any mismatches

### Step 6: Promote Support Level

```
LOCKOUT_ONLY (unknown platform)
     |
     v  (diagnostics collected)
EXPERIMENTAL (basic detection working)
     |
     v  (all order types classified correctly in replay)
BETA (most paths verified)
     |
     v  (full live paper-trading session with zero misclassifications)
VERIFIED (production ready)
```

## What Each Level Means for Users

### VERIFIED
- Sentinel can intercept and block risk-increasing orders
- Exits (close, reduce, cancel) are always allowed
- Full tilt meter, coach, session, news enforcement
- Protection status: "Full Protection"

### BETA
- Most order types intercepted correctly
- Some edge cases (reversals, complex orders) may not be classified
- Protection status: "Protected (Beta)"

### EXPERIMENTAL
- Basic order detection working
- Not all order types verified
- Unknown request formats may slip through
- Protection status: "Partial Protection (Experimental)"

### LOCKOUT_ONLY
- Cannot intercept individual orders on this platform
- Platform blocklist works (kills the app, blocks the website)
- Session hours enforcement via blocklist
- Protection status: "Lockout Protection Only"

## Architecture

```
browser-extension/src/platforms/
  base/adapter.js          - Base adapter interface
  registry.js              - Central platform registry
  topstepx/adapter.js      - TopstepX REST adapter
  tradesea/adapter.js      - Tradesea REST adapter
  tradingview-paper/adapter.js    - TradingView Paper (WS, experimental)
  tradingview-tradovate/adapter.js - TradingView+Tradovate bridge
  tradingview-generic/adapter.js  - Unknown TradingView broker (lockout only)

browser-extension/fixtures/
  README.md                - How to collect/use fixtures
  {platform}-{date}.json   - Sanitized diagnostic captures
```

## Safety Rules

1. **Never block an unidentified request that might be an exit**
2. **Never show "Full Protection" when the adapter is EXPERIMENTAL or lower**
3. **Never block WebSocket frames until fixtures are collected AND replay tests pass**
4. **Always allow platform lockout (kill app + hosts file) regardless of adapter level**
5. **Unknown brokers get LOCKOUT_ONLY - never pretend we can intercept what we haven't verified**
