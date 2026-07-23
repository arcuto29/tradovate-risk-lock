/**
 * TradingView Interceptor - MAIN WORLD
 * Runs in page context to intercept fetch calls for order placement.
 * Bypasses CSP by using world: "MAIN" in manifest.
 */
(function() {
  'use strict';

  var sessionBlocked = false; // Start unblocked — only block when we KNOW session is blocked
  var positionLimits = { limits: [], defaultMax: 2 };
  var blockedSymbols = [];

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_SESSION_STATE') {
      sessionBlocked = event.data.blocked;
      if (event.data.positionLimits) positionLimits = event.data.positionLimits;
    }
    if (event.data && event.data.type === 'TRL_POSITION_LIMITS') {
      positionLimits = { limits: event.data.limits || [], defaultMax: event.data.defaultMax || 2 };
    }
    if (event.data && event.data.type === 'TRL_BLOCKED_SYMBOLS') {
      blockedSymbols = event.data.symbols || [];
    }
  });

  function isOrderPlaceUrl(url) { return url && url.includes('/trading/place'); }
  function isOrderModifyUrl(url) { return url && (url.includes('/trading/modify') || url.includes('/trading/cancel') || url.includes('/trading/close')); }

  function getMaxForSymbol(symbol) {
    if (!symbol) return positionLimits.defaultMax || 2;
    var s = symbol.toUpperCase();
    var limits = positionLimits.limits || [];
    for (var i = 0; i < limits.length; i++) {
      var sym = (limits[i].symbol || '').toUpperCase();
      if (sym && s.includes(sym)) return limits[i].maxSize || 1;
    }
    return positionLimits.defaultMax || 2;
  }

  var origFetch = window.fetch;
  window.fetch = function() {
    var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url ? arguments[0].url : '');
    var opts = typeof arguments[0] === 'string' ? arguments[1] : arguments[0];
    var method = (opts && opts.method ? opts.method : 'GET').toUpperCase();

    if ((method === 'POST' || method === 'PUT') && isOrderPlaceUrl(url)) {
      // Skip checks for order modifications (moving SL/TP, closing positions)
      if (isOrderModifyUrl(url)) {
        return origFetch.apply(this, arguments);
      }

      // Blocked symbol check
      var body = null;
      if (opts && opts.body && typeof opts.body === 'string') {
        try { body = JSON.parse(opts.body); } catch(e) {}
      }

      if (body) {
        var symbol = (body.symbol || body.instrument || '').toUpperCase();
        if (symbol && blockedSymbols.length > 0) {
          for (var i = 0; i < blockedSymbols.length; i++) {
            if (symbol.includes(blockedSymbols[i].toUpperCase())) {
              window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Symbol ' + symbol + ' is blocked' }, '*');
              return Promise.reject(new Error('Blocked: Symbol is blocked'));
            }
          }
        }
      }

      if (sessionBlocked) {
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Outside trading hours' }, '*');
        return Promise.reject(new Error('Blocked: Outside trading hours'));
      }

      var body = null;
      if (opts && opts.body && typeof opts.body === 'string') {
        try { body = JSON.parse(opts.body); } catch(e) {}
      }

      if (body) {
        var qty = body.qty || body.quantity || body.amount || body.size || 0;
        var symbol = body.symbol || body.instrument || '';
        var max = getMaxForSymbol(symbol);
        if (qty > max) {
          window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Position size ' + qty + ' exceeds max ' + max + ' for ' + symbol }, '*');
          return Promise.reject(new Error('Blocked: Position size exceeds limit'));
        }
      }
    }

    return origFetch.apply(this, arguments);
  };

  console.log('[TradingGuardian] TradingView MAIN world interceptor loaded.');
})();
