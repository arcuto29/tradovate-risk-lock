/**
 * Session Blocker - Blocks order placement outside allowed trading hours.
 * Runs on: app.tradesea.ai, topstepx.com
 * Also runs on trader.tradovate.com (loaded by content-script.js)
 *
 * Blocks ALL order placement during blocked hours.
 * Allows chart viewing, account info, etc.
 */
(function() {
  'use strict';
  let sessionBlocked = false;
  let sessionHours = null; // { startHour, startMin, endHour, endMin, timezone }

  // Inject the session interceptor into page context
  function injectPageScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/content/session-injector.js');
    script.onload = function() { this.remove(); };
    (document.head || document.documentElement).appendChild(script);
  }
  injectPageScript();

  // Get session state from background
  chrome.runtime.sendMessage({ type: 'GET_SESSION_STATE' }, (r) => {
    if (r) {
      sessionBlocked = r.blocked;
      sessionHours = r.sessionHours;
      sendStateToPage();
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SESSION_STATE_UPDATE') {
      sessionBlocked = msg.blocked;
      sessionHours = msg.sessionHours;
      sendStateToPage();
      if (!sessionBlocked) hideOverlay();
    }
  });

  function sendStateToPage() {
    window.postMessage({
      type: 'TRL_SESSION_STATE',
      blocked: sessionBlocked,
      sessionHours: sessionHours,
    }, '*');
  }

  setInterval(sendStateToPage, 5000);

  // Listen for blocked events from injected script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data && event.data.type === 'TRL_ORDER_BLOCKED') {
      showOverlay();
      chrome.runtime.sendMessage({
        type: 'REPORT_BYPASS_ATTEMPT',
        details: `SESSION BLOCKED: Attempted order on ${window.location.hostname} during blocked hours`,
      });
    }
  });

  // Overlay
  let overlayShown = false;

  function showOverlay() {
    if (overlayShown) return; overlayShown = true;
    const o = document.createElement('div'); o.id = 'tradovate-risk-lock-overlay';
    o.innerHTML = `<div class="trl-overlay-content">
      <div class="trl-alert-badge">&#9679; GUARDIAN &bull; ALERT</div>
      <h1>SESSION<br>BLOCKED</h1>
      <p class="trl-message">You are outside your allowed trading hours.<br>Orders are blocked until NY session.</p>
      <p class="trl-unlock-label">TRADING OPENS AT</p>
      <p class="trl-countdown" id="trl-session-time">${sessionHours ? `${sessionHours.startHour}:${String(sessionHours.startMin).padStart(2,'0')} AM ET` : '8:30 AM ET'}</p>
      <button id="trl-dismiss-btn" class="trl-dismiss-btn">Dismiss</button>
      <p class="trl-footer">This attempt has been recorded.</p>
    </div>`;
    document.body.appendChild(o);
    document.getElementById('trl-dismiss-btn').onclick = hideOverlay;
    setTimeout(hideOverlay, 20000);
  }

  function hideOverlay() { document.getElementById('tradovate-risk-lock-overlay')?.remove(); overlayShown = false; }

  console.log('[TradingGuardian] Session blocker loaded on', window.location.hostname);
})();
