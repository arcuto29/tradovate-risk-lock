/**
 * Session Blocker Bridge - ISOLATED WORLD
 * Communicates between the Chrome extension APIs and the MAIN world script.
 * Sends session state and coach config to the page via postMessage.
 * Listens for blocked/warning events and shows overlays + reports to desktop app.
 */
(function() {
  'use strict';

  let sessionBlocked = false;
  let sessionHours = null;

  // Get state from background
  chrome.runtime.sendMessage({ type: 'GET_SESSION_STATE' }, (r) => {
    if (r) { sessionBlocked = r.blocked; sessionHours = r.sessionHours; sendStateToPage(); }
  });

  chrome.runtime.sendMessage({ type: 'GET_COACH_CONFIG' }, (r) => {
    if (r) sendCoachToPage(r);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SESSION_STATE_UPDATE') { sessionBlocked = msg.blocked; sessionHours = msg.sessionHours; sendStateToPage(); }
    if (msg.type === 'COACH_CONFIG_UPDATE') sendCoachToPage(msg);
    if (msg.type === 'POSITION_LIMITS_UPDATE') sendLimitsToPage(msg);
  });

  function sendStateToPage() {
    window.postMessage({ type: 'TRL_SESSION_STATE', blocked: sessionBlocked, sessionHours, positionLimits: currentLimits }, '*');
  }

  function sendCoachToPage(config) {
    window.postMessage({ type: 'TRL_COACH_CONFIG', enabled: config.enabled, maxTradesPerDay: config.maxTradesPerDay, cooldownSeconds: config.cooldownSeconds, maxDailyLoss: config.maxDailyLoss }, '*');
  }

  function sendLimitsToPage(data) {
    if (data.limits) currentLimits = { limits: data.limits, defaultMax: data.defaultMax || 2 };
    window.postMessage({ type: 'TRL_POSITION_LIMITS', limits: data.limits, defaultMax: data.defaultMax || 2 }, '*');
  }

  var currentLimits = { limits: [], defaultMax: 2 };

  // Load saved limits
  chrome.storage.local.get('position_limits', (r) => {
    if (r.position_limits) {
      currentLimits = { limits: r.position_limits.limits || [], defaultMax: r.position_limits.defaultMax || 2 };
      sendLimitsToPage(currentLimits);
    }
  });

  setInterval(sendStateToPage, 5000);

  // Listen for events from MAIN world
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data && event.data.type === 'TRL_ORDER_BLOCKED') {
      showOverlay(event.data.reason);
      chrome.runtime.sendMessage({ type: 'REPORT_BYPASS_ATTEMPT', details: `BLOCKED on ${window.location.hostname}: ${event.data.reason}` });
    }

    if (event.data && event.data.type === 'TRL_COACH_WARN') {
      showWarning(event.data.reason, event.data.message);
      chrome.runtime.sendMessage({ type: 'REPORT_BYPASS_ATTEMPT', details: `COACH WARN: ${event.data.reason}` });
    }

    if (event.data && event.data.type === 'TRL_COACH_BLOCK') {
      showBlock(event.data.reason, event.data.message);
      chrome.runtime.sendMessage({ type: 'REPORT_BYPASS_ATTEMPT', details: `COACH BLOCK: ${event.data.reason}` });
    }
  });

  // ─── Overlays ──────────────────────────────────────────────────────────────
  function showOverlay(reason) {
    if (document.getElementById('tradovate-risk-lock-overlay')) return;
    const isSession = reason && reason.includes('hours');
    const title = isSession ? 'SESSION<br>BLOCKED' : 'OVERSIZE<br>BLOCKED';
    const quote = getRandomQuote();
    const o = document.createElement('div'); o.id = 'tradovate-risk-lock-overlay';
    o.innerHTML = `<div class="trl-overlay-content"><div class="trl-alert-badge">&#9679; GUARDIAN &bull; ALERT</div><h1>${title}</h1><p class="trl-message">${reason}</p><p class="trl-motivation">${quote}</p><button id="trl-dismiss-btn" class="trl-dismiss-btn">Dismiss</button><p class="trl-footer">This attempt has been recorded.</p></div>`;
    document.body.appendChild(o);
    document.getElementById('trl-dismiss-btn').onclick = () => o.remove();
    setTimeout(() => o.remove(), 20000);
  }

  function showWarning(reason, message) {
    if (document.getElementById('trl-coach-warning')) return;
    const quote = getRandomQuote();
    const w = document.createElement('div'); w.id = 'trl-coach-warning';
    w.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483646;background:#1a1a2e;border:1px solid #f59e0b;border-radius:12px;padding:20px 24px;max-width:360px;font-family:-apple-system,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
    w.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><span style="font-size:20px;">&#9888;</span><span style="font-size:12px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;">${reason}</span></div><p style="color:#e2e8f0;font-size:14px;line-height:1.5;margin:0 0 10px 0;">${message}</p><p style="color:#94a3b8;font-size:12px;font-style:italic;margin:0 0 14px 0;">${quote}</p><button id="trl-coach-dismiss" style="padding:6px 16px;border:1px solid rgba(255,255,255,0.2);border-radius:6px;background:transparent;color:#94a3b8;font-size:12px;cursor:pointer;">I understand</button>`;
    document.body.appendChild(w);
    document.getElementById('trl-coach-dismiss').onclick = () => w.remove();
    setTimeout(() => w.remove(), 10000);
  }

  function showBlock(reason, message) {
    if (document.getElementById('tradovate-risk-lock-overlay')) return;
    const quote = getRandomQuote();
    const o = document.createElement('div'); o.id = 'tradovate-risk-lock-overlay';
    o.innerHTML = `<div class="trl-overlay-content"><div class="trl-alert-badge">&#9679; GUARDIAN &bull; COACH</div><h1>${reason}</h1><p class="trl-message">${message}</p><p class="trl-motivation">${quote}</p><button id="trl-dismiss-btn" class="trl-dismiss-btn">Dismiss</button><p class="trl-footer">This has been recorded.</p></div>`;
    document.body.appendChild(o);
    document.getElementById('trl-dismiss-btn').onclick = () => o.remove();
    setTimeout(() => o.remove(), 20000);
  }

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

  console.log('[TradingGuardian] Bridge loaded on', window.location.hostname);
})();
