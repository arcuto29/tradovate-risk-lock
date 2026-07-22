/**
 * TradingView Interceptor - MAIN WORLD
 * Runs in page context to intercept fetch calls for order placement.
 * Bypasses CSP by using world: "MAIN" in manifest.
 */
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

  function isOrderPlaceUrl(url) { return url && url.includes('/trading/place'); }

  function getMaxForSymbol(symbol) {
    if (!symbol) return positionLimits.defaultMax;
    var s = symbol.toUpperCase();
    if (s.includes('MNQ')) return positionLimits.mnqMax;
    if (s.includes('NQ')) return positionLimits.nqMax;
    if (s.includes('MES')) return positionLimits.mesMax;
    if (s.includes('ES')) return positionLimits.esMax;
    return positionLimits.defaultMax;
  }

  var origFetch = window.fetch;
  window.fetch = function() {
    var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url ? arguments[0].url : '');
    var opts = typeof arguments[0] === 'string' ? arguments[1] : arguments[0];
    var method = (opts && opts.method ? opts.method : 'GET').toUpperCase();

    if ((method === 'POST' || method === 'PUT') && isOrderPlaceUrl(url)) {
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
