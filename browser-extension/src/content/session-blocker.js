/**
 * Session Blocker + Position Size Lock
 * Runs on: app.tradesea.ai, topstepx.com
 *
 * IMPORTANT: This injects the fetch override INLINE at document_start
 * so it runs BEFORE TopstepX/Tradesea's own scripts load.
 * This ensures our override catches their fetch calls.
 */
(function() {
  'use strict';

  // ─── STEP 1: Inject fetch override IMMEDIATELY (before page scripts load) ──
  // This MUST be inline, not loaded from a file, because it needs to run
  // before TopstepX captures a reference to the original fetch.
  const inlineScript = document.createElement('script');
  inlineScript.textContent = `
(function() {
  'use strict';
  
  let sessionBlocked = false;
  let positionLimits = { nqMax: 1, mnqMax: 5 };
  
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_SESSION_STATE') {
      sessionBlocked = event.data.blocked;
      if (event.data.positionLimits) positionLimits = event.data.positionLimits;
    }
  });
  
  const ORDER_URLS = ['userapi.topstepx.com/Order', '/Order', '/order', '/api/Order'];
  
  function isOrderUrl(url) {
    if (!url) return false;
    return ORDER_URLS.some(function(p) { return url.includes(p); });
  }
  
  function isOversized(body) {
    if (!body || !body.positionSize) return false;
    var symbol = (body.symbolId || '').toUpperCase();
    var size = body.positionSize;
    
    // MNQ (micro) - check first since ENQ is substring of EMNQ
    if (symbol.includes('EMNQ') || symbol.includes('MNQ')) {
      return size > positionLimits.mnqMax;
    }
    // NQ (full-size)
    if (symbol.includes('ENQ') || symbol.includes('NQ')) {
      return size > positionLimits.nqMax;
    }
    // Other contracts - use NQ limit
    return size > positionLimits.nqMax;
  }
  
  // Override fetch IMMEDIATELY
  var origFetch = window.fetch;
  window.fetch = function() {
    var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url ? arguments[0].url : '');
    var opts = typeof arguments[0] === 'string' ? arguments[1] : arguments[0];
    var method = (opts && opts.method ? opts.method : 'GET').toUpperCase();
    
    if ((method === 'POST' || method === 'PUT') && isOrderUrl(url)) {
      // Session block check
      if (sessionBlocked) {
        console.log('[TradingGuardian] BLOCKED: Outside trading hours');
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', url: url, reason: 'Outside trading hours' }, '*');
        return Promise.reject(new Error('Blocked by Trading Guardian: Outside trading hours'));
      }
      
      // Position size check
      var body = null;
      if (opts && opts.body && typeof opts.body === 'string') {
        try { body = JSON.parse(opts.body); } catch(e) {}
      }
      if (body && isOversized(body)) {
        console.log('[TradingGuardian] BLOCKED: Position size ' + body.positionSize + ' exceeds max for ' + body.symbolId);
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', url: url, reason: 'Position size ' + body.positionSize + ' exceeds max for ' + (body.symbolId || 'contract') }, '*');
        return Promise.reject(new Error('Blocked by Trading Guardian: Position size exceeds limit'));
      }
    }
    
    return origFetch.apply(this, arguments);
  };
  
  // Also override XMLHttpRequest for good measure
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, url) {
    this._tgUrl = url;
    this._tgMethod = m;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    var method = (this._tgMethod || 'GET').toUpperCase();
    if ((method === 'POST' || method === 'PUT') && isOrderUrl(this._tgUrl)) {
      if (sessionBlocked) {
        console.log('[TradingGuardian] BLOCKED XHR: Outside trading hours');
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', url: this._tgUrl, reason: 'Outside trading hours' }, '*');
        return;
      }
      var parsed = null;
      if (typeof body === 'string') { try { parsed = JSON.parse(body); } catch(e) {} }
      if (parsed && isOversized(parsed)) {
        console.log('[TradingGuardian] BLOCKED XHR: Oversize');
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', url: this._tgUrl, reason: 'Position size exceeds limit' }, '*');
        return;
      }
    }
    return origSend.apply(this, arguments);
  };
  
  console.log('[TradingGuardian] Fetch/XHR interceptor installed BEFORE page scripts. Max: 1 NQ / 5 MNQ');
})();
`;
  // Insert BEFORE any other script on the page
  (document.head || document.documentElement).prepend(inlineScript);

  // ─── STEP 2: Content script communication ──────────────────────────────────
  let sessionBlocked = false;
  let sessionHours = null;

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
      positionLimits: { nqMax: 1, mnqMax: 5 },
    }, '*');
  }

  setInterval(sendStateToPage, 5000);

  // ─── STEP 3: Listen for blocked events ─────────────────────────────────────
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_ORDER_BLOCKED') {
      showOverlay(event.data.reason);
      chrome.runtime.sendMessage({
        type: 'REPORT_BYPASS_ATTEMPT',
        details: `BLOCKED on ${window.location.hostname}: ${event.data.reason || 'order blocked'}`,
      });
    }
  });

  // ─── STEP 4: Overlay ───────────────────────────────────────────────────────
  let overlayShown = false;

  function showOverlay(reason) {
    if (overlayShown) return; overlayShown = true;
    const isSession = reason && reason.includes('hours');
    const title = isSession ? 'SESSION<br>BLOCKED' : 'OVERSIZE<br>BLOCKED';
    const message = isSession
      ? 'You are outside your allowed trading hours.<br>Orders are blocked until NY session.'
      : 'Your order exceeds your max position size.<br>Max: 1 NQ / 5 MNQ.';

    const o = document.createElement('div'); o.id = 'tradovate-risk-lock-overlay';
    o.innerHTML = `<div class="trl-overlay-content">
      <div class="trl-alert-badge">&#9679; GUARDIAN &bull; ALERT</div>
      <h1>${title}</h1>
      <p class="trl-message">${message}</p>
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
