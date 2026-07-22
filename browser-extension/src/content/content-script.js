/**
 * Content Script - Tradovate Risk Lock (ISOLATED WORLD)
 * 
 * The injector.js now runs in MAIN world via manifest (world: "MAIN").
 * This script handles:
 * - Communicating lock state from extension background to the MAIN world injector
 * - Showing overlays when risk settings changes are blocked
 * - Reporting events to the desktop app
 */
(function() {
  'use strict';
  let isLocked = false, lockedSettings = null, overlayShown = false;

  // ─── Get lock state and send to MAIN world ─────────────────────────────────
  chrome.runtime.sendMessage({ type: 'GET_LOCK_STATE' }, (r) => {
    if (r) {
      isLocked = r.locked;
      lockedSettings = r.settings;
      sendStateToPage();
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'LOCK_STATE_UPDATE') {
      isLocked = msg.locked;
      lockedSettings = msg.settings;
      sendStateToPage();
      if (!isLocked) hideOverlay();
    }
  });

  function sendStateToPage() {
    window.postMessage({
      type: 'TRL_LOCK_STATE',
      locked: isLocked,
      settings: lockedSettings ? {
        ...lockedSettings,
        resetTimeISO: lockedSettings.resetTime || null,
        timeRemaining: lockedSettings.timeRemaining || null,
      } : null,
    }, '*');
  }

  // Re-send state periodically
  setInterval(sendStateToPage, 5000);

  // ─── Listen for events from MAIN world injector ────────────────────────────
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data && event.data.type === 'TRL_BLOCKED') {
      console.log('[TradovateRiskLock] Blocked:', event.data.endpoint);
      showOverlay();
      chrome.runtime.sendMessage({
        type: 'REPORT_BYPASS_ATTEMPT',
        details: `BLOCKED: ${event.data.endpoint} | ${event.data.body}`,
      });
    }

    if (event.data && event.data.type === 'TRL_ALLOWED') {
      chrome.runtime.sendMessage({
        type: 'REPORT_SETTINGS_ACCESS',
        url: `ALLOWED: ${event.data.endpoint}`,
      });
    }
  });

  // ─── Overlay with quotes ───────────────────────────────────────────────────
  function showOverlay() {
    if (overlayShown) return; overlayShown = true;
    const quote = getRandomQuote();
    const o = document.createElement('div'); o.id = 'tradovate-risk-lock-overlay';
    o.innerHTML = `<div class="trl-overlay-content">
      <div class="trl-alert-badge">&#9679; GUARDIAN &bull; ALERT</div>
      <h1>LIMIT<br>TAMPERED</h1>
      <p class="trl-message">You attempted to raise your risk limits.<br>Guardian detected it and blocked you.<br>Session is locked.</p>
      <p class="trl-motivation">${quote}</p>
      <p class="trl-unlock-label">UNLOCKS IN</p>
      <p class="trl-countdown" id="trl-countdown">--:--:--</p>
      <button id="trl-dismiss-btn" class="trl-dismiss-btn">Dismiss</button>
      <p class="trl-footer">This attempt has been recorded.</p>
    </div>`;
    document.body.appendChild(o);
    document.getElementById('trl-dismiss-btn').onclick = hideOverlay;
    updateCountdown();
    const ci = setInterval(() => { if (!document.getElementById('trl-countdown')) { clearInterval(ci); return; } updateCountdown(); }, 1000);
    setTimeout(hideOverlay, 30000);
  }

  function updateCountdown() {
    const el = document.getElementById('trl-countdown');
    if (!el || !lockedSettings) return;
    // Use the resetTime from the lock state (which is an ISO timestamp calculated by the desktop app)
    // This matches what the desktop app shows
    if (lockedSettings.resetTimeISO) {
      const reset = new Date(lockedSettings.resetTimeISO);
      const diff = Math.max(0, Math.floor((reset.getTime() - Date.now()) / 1000));
      const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
      el.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    } else {
      // Fallback: use timeRemaining from lock state if available
      const remaining = lockedSettings.timeRemaining;
      if (remaining && remaining > 0) {
        const h = Math.floor(remaining / 3600), m = Math.floor((remaining % 3600) / 60), s = remaining % 60;
        el.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
      }
    }
  }

  function hideOverlay() { document.getElementById('tradovate-risk-lock-overlay')?.remove(); overlayShown = false; }

  function getRandomQuote() {
    const quotes = [
      "Your future self is thanking you for stopping right now.",
      "You already know the right decision. That's why you set these rules.",
      "99% of traders lose money. Be the 1% that makes it. Tomorrow is a new day.",
      "Some of the best trades are the ones you don't take. Stick to your rules.",
      "Discipline is what separates funded traders from blown accounts.",
      "You don't need to trade every day. You need to survive every day.",
      "The market will be here tomorrow. Will your account?",
      "One good day of patience is worth more than a week of revenge trading.",
      "Protect the capital. The setups will come.",
      "This feeling will pass. Your account balance won't come back.",
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  console.log('[TradovateRiskLock] Content script loaded (ISOLATED world). Communicating with MAIN world injector.');
})();
