# Manual Platform Verification Checklist

These items cannot be automated because they require real broker connections.
Verify on DEMO accounts only.

## TopstepX (userapi.topstepx.com)

- [ ] Open long (Buy Market) — blocked if exceeds max
- [ ] Open short (Sell Market) — blocked if exceeds max
- [ ] Close position — NEVER blocked
- [ ] Reduce position — NEVER blocked
- [ ] Cancel pending order — NEVER blocked
- [ ] Move stop loss — NEVER blocked
- [ ] Move take profit — NEVER blocked
- [ ] Oversize block overlay appears + sound plays
- [ ] Extension disconnect fallback maintains protection

## Tradovate (demo.tradovateapi.com)

- [ ] WebSocket buy order — blocked if oversized
- [ ] WebSocket sell order — blocked if oversized
- [ ] REST close position — NEVER blocked
- [ ] REST cancel order — NEVER blocked
- [ ] Market data socket — NOT intercepted
- [ ] Trading socket — intercepted correctly

## General Extension

- [ ] Block sound plays on prevented order
- [ ] Overlay shows reason (size/session/symbol/news)
- [ ] Console shows no TypeError or crash
- [ ] Multiple tabs: all intercepted correctly
- [ ] Extension reconnects after desktop restart

## Verify After Each Release

Run these 5 minimum tests before any Whop release:

1. Open oversized order → BLOCKED ✓
2. Close existing position → ALLOWED ✓
3. Cancel pending order → ALLOWED ✓
4. Lock expires → unlocked correctly ✓
5. App restart while locked → still locked ✓
