/**
 * TradingView Blocker - Session hours + Position size lock for TradingView.
 * Covers ALL brokers connected through TradingView (Coinexx, Fyntura, Tradovate, etc.)
 *
 * TradingView order API:
 * POST https://papertrading.tradingview.com/trading/place/{accountId}
 * POST https://trading.tradingview.com/trading/place/{accountId}
 * POST https://*.tradingview.com/trading/place/{accountId}
 * 
 * Also covers: /trading/modify/, /trading/cancel/ (we only block place)
 */
(function() {
  'use strict';

  // ─── Inline fetch override BEFORE TradingView loads ────────────────────────
  const inlineScript = document.createElement('script');
  inlineScript.textContent = `
(function() {
  'use strict';
  
  var sessionBlocked = false;
  var positionLimits = { nqMax: 1, mnqMax: 5, esMax: 1, mesMax: 5, defaultMax: 2 };
  
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_SESSION_STATE') {
      sessionBlocked = event.data.blocked;
      if (event.data.positionLimits) positionLimits = event.data.positionLimits;
    }
  });
  
  function isOrderPlaceUrl(url) {
    if (!url) return false;
    return url.includes('/trading/place');
  }
  
  function getMaxForSymbol(symbol) {
    if (!symbol) return positionLimits.defaultMax;
    var s = symbol.toUpperCase();
    // Micro NQ
    if (s.includes('MNQ') || s.includes('MNQU') || s.includes('MICRO') && s.includes('NQ')) return positionLimits.mnqMax;
    // Full NQ
    if (s.includes('NQ')) return positionLimits.nqMax;
    // Micro ES
    if (s.includes('MES') || s.includes('MICRO') && s.includes('ES')) return positionLimits.mesMax;
    // Full ES
    if (s.includes('ES')) return positionLimits.esMax;
    // Default
    return positionLimits.defaultMax;
  }
  
  function checkOrder(body) {
    if (!body) return null;
    var qty = body.qty || body.quantity || body.amount || body.lots || body.size;
    var symbol = body.symbol || body.instrument || body.ticker || '';
    
    if (!qty) return null;
    
    var max = getMaxForSymbol(symbol);
    if (qty > max) {
      return 'Position size ' + qty + ' exceeds max ' + max + ' for ' + (symbol || 'contract');
    }
    return null;
  }
  
  // Override fetch
  var origFetch = window.fetch;
  window.fetch = function() {
    var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url ? arguments[0].url : '');
    var opts = typeof arguments[0] === 'string' ? arguments[1] : arguments[0];
    var method = (opts && opts.method ? opts.method : 'GET').toUpperCase();
    
    if ((method === 'POST' || method === 'PUT') && isOrderPlaceUrl(url)) {
      // Session block
      if (sessionBlocked) {
        console.log('[TradingGuardian] BLOCKED TV order: Outside trading hours');
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', url: url, reason: 'Outside trading hours' }, '*');
        return Promise.reject(new Error('Blocked by Trading Guardian: Outside trading hours'));
      }
      
      // Position size check
      var body = null;
      if (opts && opts.body) {
        if (typeof opts.body === 'string') {
          try { body = JSON.parse(opts.body); } catch(e) {}
        }
      }
      
      if (body) {
        var violation = checkOrder(body);
        if (violation) {
          console.log('[TradingGuardian] BLOCKED TV order:', violation);
          window.postMessage({ type: 'TRL_ORDER_BLOCKED', url: url, reason: violation }, '*');
          return Promise.reject(new Error('Blocked by Trading Guardian: ' + violation));
        }
      }
    }
    
    return origFetch.apply(this, arguments);
  };
  
  // Override XHR
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, url) {
    this._tgUrl = url;
    this._tgMethod = m;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    var method = (this._tgMethod || 'GET').toUpperCase();
    if ((method === 'POST' || method === 'PUT') && isOrderPlaceUrl(this._tgUrl)) {
      if (sessionBlocked) {
        console.log('[TradingGuardian] BLOCKED TV XHR order: Outside hours');
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', url: this._tgUrl, reason: 'Outside trading hours' }, '*');
        return;
      }
      var parsed = null;
      if (typeof body === 'string') { try { parsed = JSON.parse(body); } catch(e) {} }
      if (parsed) {
        var violation = checkOrder(parsed);
        if (violation) {
          console.log('[TradingGuardian] BLOCKED TV XHR:', violation);
          window.postMessage({ type: 'TRL_ORDER_BLOCKED', url: this._tgUrl, reason: violation }, '*');
          return;
        }
      }
    }
    return origSend.apply(this, arguments);
  };
  
  console.log('[TradingGuardian] TradingView interceptor installed. Covers all TV-connected brokers.');
})();
`;
  (document.head || document.documentElement).prepend(inlineScript);

  // ─── Content script communication ──────────────────────────────────────────
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
      positionLimits: { nqMax: 1, mnqMax: 5, esMax: 1, mesMax: 5, defaultMax: 2 },
    }, '*');
  }

  setInterval(sendStateToPage, 5000);

  // ─── Listen for blocked events ─────────────────────────────────────────────
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_ORDER_BLOCKED') {
      showOverlay(event.data.reason);
      chrome.runtime.sendMessage({
        type: 'REPORT_BYPASS_ATTEMPT',
        details: `BLOCKED on TradingView: ${event.data.reason || 'order blocked'}`,
      });
    }
  });

  // ─── Overlay ───────────────────────────────────────────────────────────────
  let overlayShown = false;

  function showOverlay(reason) {
    if (overlayShown) return; overlayShown = true;
    const isSession = reason && reason.includes('hours');
    const title = isSession ? 'SESSION<br>BLOCKED' : 'OVERSIZE<br>BLOCKED';
    const message = isSession
      ? 'You are outside your allowed trading hours.<br>Orders are blocked until NY session.'
      : `${reason || 'Position size exceeds your limit.'}`;

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

  console.log('[TradingGuardian] TradingView blocker loaded.');
})();
