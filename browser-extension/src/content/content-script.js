/**
 * Content Script - Tradovate Risk Lock (Directional Blocking)
 *
 * This content script:
 * 1. Injects the WebSocket interceptor into the PAGE context (so it can actually block WS calls)
 * 2. Communicates lock state from the extension background to the injected script
 * 3. Listens for blocked/allowed events from the injected script
 * 4. Shows the blocking overlay and reports to the desktop app
 */
(function() {
  'use strict';
  let isLocked = false, lockedSettings = null, overlayShown = false;

  // ─── Step 1: Inject the interceptor into the PAGE context ──────────────────
  // Content scripts run in an isolated world and CANNOT intercept the page's WebSocket.
  // We must inject code directly into the page via a <script> tag.
  function injectPageScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/content/injector.js');
    script.onload = function() { this.remove(); };
    (document.head || document.documentElement).appendChild(script);
  }
  injectPageScript();

  // ─── Step 2: Get lock state and send it to the injected script ─────────────
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
      settings: lockedSettings,
    }, '*');
  }

  // Re-send state periodically in case page reloaded scripts
  setInterval(sendStateToPage, 5000);

  // ─── Step 3: Listen for events from the injected script ────────────────────
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data && event.data.type === 'TRL_BLOCKED') {
      console.log('[TradovateRiskLock] Blocked:', event.data.endpoint);
      showOverlay();
      chrome.runtime.sendMessage({
        type: 'REPORT_BYPASS_ATTEMPT',
        details: `BLOCKED WS: ${event.data.endpoint} | ${event.data.body}`,
      });
    }

    if (event.data && event.data.type === 'TRL_ALLOWED') {
      chrome.runtime.sendMessage({
        type: 'REPORT_SETTINGS_ACCESS',
        url: `ALLOWED WS: ${event.data.endpoint}`,
      });
    }
  });

  // ─── Step 4: Overlay ───────────────────────────────────────────────────────
  function showOverlay() {
    if (overlayShown) return; overlayShown = true;
    const o = document.createElement('div'); o.id = 'tradovate-risk-lock-overlay';
    o.innerHTML = `<div class="trl-overlay-content">
      <div class="trl-alert-badge">&#9679; GUARDIAN &bull; ALERT</div>
      <h1>LIMIT<br>TAMPERED</h1>
      <p class="trl-message">You attempted to raise your risk limits.<br>Guardian detected it and blocked you.<br>Session is locked.</p>
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
    const now = new Date();
    const rh = parseInt(lockedSettings.resetTime?.split(':')[0] || '17');
    const rm = parseInt(lockedSettings.resetTime?.split(':')[1] || '0');
    const reset = new Date(); reset.setHours(rh, rm, 0, 0);
    if (reset <= now) reset.setDate(reset.getDate() + 1);
    const diff = Math.max(0, Math.floor((reset.getTime() - now.getTime()) / 1000));
    const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
    el.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }

  function hideOverlay() { document.getElementById('tradovate-risk-lock-overlay')?.remove(); overlayShown = false; }

  console.log('[TradovateRiskLock] Content script loaded. Injector deployed to page context.');
})();
