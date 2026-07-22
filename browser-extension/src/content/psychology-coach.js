/**
 * Psychology Coach Bridge - ISOLATED WORLD (Tradovate)
 * Communicates coach config and shows overlays/warnings.
 */
(function() {
  'use strict';

  chrome.runtime.sendMessage({ type: 'GET_COACH_CONFIG' }, (r) => {
    if (r) sendConfigToPage(r);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'COACH_CONFIG_UPDATE') sendConfigToPage(msg);
  });

  function sendConfigToPage(config) {
    window.postMessage({ type: 'TRL_COACH_CONFIG', enabled: config.enabled, maxTradesPerDay: config.maxTradesPerDay, cooldownSeconds: config.cooldownSeconds, maxDailyLoss: config.maxDailyLoss }, '*');
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data && event.data.type === 'TRL_COACH_WARN') {
      showWarning(event.data.reason, event.data.message);
      chrome.runtime.sendMessage({ type: 'REPORT_BYPASS_ATTEMPT', details: `COACH WARN: ${event.data.reason}` });
    }

    if (event.data && event.data.type === 'TRL_COACH_BLOCK') {
      showBlock(event.data.reason, event.data.message);
      chrome.runtime.sendMessage({ type: 'REPORT_BYPASS_ATTEMPT', details: `COACH BLOCK: ${event.data.reason}` });
    }
  });

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

  function showWarning(reason, message) {
    if (document.getElementById('trl-coach-warning')) return;
    const quote = getRandomQuote();
    const w = document.createElement('div'); w.id = 'trl-coach-warning';
    w.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483646;background:#1a1a2e;border:1px solid #f59e0b;border-radius:12px;padding:20px 24px;max-width:360px;font-family:-apple-system,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:trl-slide-in 0.3s ease-out;';
    w.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><span style="font-size:20px;">&#9888;</span><span style="font-size:12px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;">${reason}</span></div><p style="color:#e2e8f0;font-size:14px;line-height:1.5;margin:0 0 10px 0;">${message}</p><p style="color:#94a3b8;font-size:12px;font-style:italic;margin:0 0 14px 0;">${quote}</p><button id="trl-coach-dismiss" style="padding:6px 16px;border:1px solid rgba(255,255,255,0.2);border-radius:6px;background:transparent;color:#94a3b8;font-size:12px;cursor:pointer;">I understand</button>`;
    document.body.appendChild(w);
    document.getElementById('trl-coach-dismiss').onclick = () => w.remove();
    setTimeout(() => w.remove(), 10000);
  }

  let blockShown = false;
  function showBlock(reason, message) {
    if (blockShown) return; blockShown = true;
    const quote = getRandomQuote();
    const o = document.createElement('div'); o.id = 'tradovate-risk-lock-overlay';
    o.innerHTML = `<div class="trl-overlay-content"><div class="trl-alert-badge">&#9679; GUARDIAN &bull; COACH</div><h1>${reason}</h1><p class="trl-message">${message}</p><p class="trl-motivation">${quote}</p><button id="trl-dismiss-btn" class="trl-dismiss-btn">Dismiss</button><p class="trl-footer">This has been recorded.</p></div>`;
    document.body.appendChild(o);
    document.getElementById('trl-dismiss-btn').onclick = () => { o.remove(); blockShown = false; };
    setTimeout(() => { o.remove(); blockShown = false; }, 20000);
  }

  console.log('[TradingGuardian-Coach] Bridge loaded on Tradovate.');
})();
