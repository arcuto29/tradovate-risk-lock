/**
 * TopstepX Platform Adapter
 * Transport: REST API (fetch/XHR)
 * Status: BETA
 */
(function() {
  'use strict';

  var TopstepXAdapter = {
    name: 'TopstepX',
    version: '1.0.0',
    supportLevel: 'BETA',

    capabilities: {
      fetchInterception: true,
      xhrInterception: true,
      websocketInterception: false,
      positionDetection: true,
      pnlDetection: true,
      closeDetection: true,
      reduceDetection: true,
      reverseDetection: false,
      cancelDetection: true,
      stopModifyDetection: true,
      targetModifyDetection: true,
    },

    matches: function(hostname) {
      return hostname.includes('topstepx.com');
    },

    parseFetch: function(url, method, body) {
      if (!url || !url.includes('topstepx.com')) return null;
      if (method !== 'POST' && method !== 'PUT') return null;
      if (!url.includes('/Order') && !url.includes('/order')) return null;
      return this._normalizeBody(body);
    },

    parseXHR: function(url, method, body) {
      return this.parseFetch(url, method, body);
    },

    parseWebSocket: function(socketUrl, data) {
      return null; // TopstepX uses REST, not WS for orders
    },

    _normalizeBody: function(body) {
      if (!body) return null;
      return {
        symbol: (body.symbolId || body.symbol || body.instrument || '').toUpperCase(),
        side: (body.action || body.orderAction || body.side || '').toLowerCase(),
        quantity: Math.abs(body.positionSize || body.qty || body.quantity || body.size || 0),
        orderType: body.orderType || body.type || 'market',
        reduceOnly: !!(body.reduceOnly || body.isReduceOnly),
        isClose: !!(body.isClose || body.closePosition || body.flatten),
        raw: body,
      };
    },

    extractPosition: function(doc) {
      // TopstepX uses data-testid attributes
      return null; // Requires DOM inspection during testing
    },

    extractPnL: function(doc) {
      var el = doc.querySelector('[data-testid="realized-pnl-display-value-amount"]');
      if (!el) return null;
      var text = el.textContent || '';
      var match = text.match(/\$\s*(-?[\d,]+\.?\d*)|(-[\d,]+\.?\d*)/);
      if (!match) return null;
      var val = parseFloat((match[1] || match[2] || '0').replace(/,/g, ''));
      return { realized: val, unrealized: null, source: 'dom' };
    },
  };

  if (typeof window !== 'undefined') {
    window.__SentinelAdapters = window.__SentinelAdapters || {};
    window.__SentinelAdapters.TopstepX = TopstepXAdapter;
  }
})();
