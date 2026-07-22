/**
 * Session Injector - Blocks order placement API calls during blocked hours.
 * Injected into PAGE context on Tradesea, TopstepX, and Tradovate.
 *
 * Intercepts fetch/XHR calls that place orders and blocks them
 * if the current time is outside allowed session hours.
 */
(function() {
  'use strict';

  let sessionBlocked = false;
  let sessionHours = null;
  let positionLimits = null;

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_SESSION_STATE') {
      sessionBlocked = event.data.blocked;
      sessionHours = event.data.sessionHours;
      positionLimits = event.data.positionLimits;
      console.log('[TradingGuardian-Session] State:', sessionBlocked ? 'BLOCKED' : 'ALLOWED', sessionHours);
    }
  });

  // Order placement URL patterns for each platform
  const ORDER_PATTERNS = [
    // Tradovate / NinjaTrader
    'order/placeorder',
    'order/place',
    'order/placeOSO',
    'order/placeOCO',
    'order/modifyorder',
    'order/modify',
    // Generic patterns
    '/order',
    '/orders',
    '/place',
    '/submit',
    // TopstepX / ProjectX
    'api/Order',
    'api/order',
    '/v1/order',
    // Tradesea
    'trade/place',
    'trade/submit',
    'execution/order',
  ];

  // URLs that are NOT orders (don't block these)
  const SAFE_PATTERNS = [
    '/order/list',
    '/order/item',
    '/order/deps',
    '/order/items',
    '/orders/history',
    '/position',
    '/account',
    '/chart',
    '/market',
    '/quote',
    '/tick',
    '/bar',
  ];

  function isOrderUrl(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    // Skip safe read-only URLs
    if (SAFE_PATTERNS.some(p => lower.includes(p))) return false;
    // Check if it matches an order pattern
    return ORDER_PATTERNS.some(p => lower.includes(p.toLowerCase()));
  }

  // Intercept fetch
  const origFetch = window.fetch;
  window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const options = typeof args[0] === 'string' ? args[1] : args[0];
    const method = (options?.method || 'GET').toUpperCase();

    if (sessionBlocked && (method === 'POST' || method === 'PUT') && isOrderUrl(url)) {
      console.log('[TradingGuardian-Session] BLOCKED ORDER:', method, url);
      window.postMessage({ type: 'TRL_ORDER_BLOCKED', url, reason: 'Outside trading hours' }, '*');
      return Promise.reject(new Error('Blocked by Trading Guardian: Outside trading hours'));
    }

    // Position size check (always active, not just during blocked hours)
    if ((method === 'POST' || method === 'PUT') && isOrderUrl(url)) {
      let body = null;
      if (options?.body && typeof options.body === 'string') {
        try { body = JSON.parse(options.body); } catch {}
      }
      if (body && isOversized(body)) {
        console.log('[TradingGuardian-Size] BLOCKED OVERSIZE:', body.positionSize, body.symbolId);
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', url, reason: `Position size ${body.positionSize} exceeds max for ${body.symbolId || 'unknown'}` }, '*');
        return Promise.reject(new Error('Blocked by Trading Guardian: Position size exceeds limit'));
      }
    }

    return origFetch.apply(this, args);
  };

  // Intercept XHR
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._trlUrl = url;
    this._trlMethod = method;
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const method = (this._trlMethod || 'GET').toUpperCase();
    if (sessionBlocked && (method === 'POST' || method === 'PUT') && isOrderUrl(this._trlUrl)) {
      console.log('[TradingGuardian-Session] BLOCKED ORDER XHR:', this._trlUrl);
      window.postMessage({ type: 'TRL_ORDER_BLOCKED', url: this._trlUrl }, '*');
      return;
    }
    return origSend.call(this, body);
  };

  // Intercept WebSocket (for platforms using WS for orders)
  const origWsSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function(data) {
    if (sessionBlocked && typeof data === 'string') {
      const lower = data.toLowerCase();
      if (lower.includes('placeorder') || lower.includes('place_order') || lower.includes('order/place') || lower.includes('submitorder')) {
        console.log('[TradingGuardian-Session] BLOCKED WS ORDER:', data.substring(0, 100));
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', url: 'WebSocket order' }, '*');
        return;
      }
    }
    return origWsSend.call(this, data);
  };

  console.log('[TradingGuardian-Session] Order interceptor installed.');
})();


  // ─── Position Size Check ───────────────────────────────────────────────────
  // Blocks orders that exceed the user's max position size.
  // NQ (F.US.ENQ) = max 1 contract
  // MNQ (F.US.EMNQ) = max 5 contracts
  // These are defaults; configurable from the desktop app.

  function isOversized(body) {
    if (!body || !body.positionSize) return false;
    if (!positionLimits) {
      // Default limits: 1 NQ, 5 MNQ
      positionLimits = { nqMax: 1, mnqMax: 5 };
    }

    const symbol = (body.symbolId || '').toUpperCase();
    const size = body.positionSize;

    // NQ (full-size)
    if (symbol.includes('ENQ') && !symbol.includes('EMNQ')) {
      return size > positionLimits.nqMax;
    }

    // MNQ (micro)
    if (symbol.includes('EMNQ') || symbol.includes('MNQ')) {
      return size > positionLimits.mnqMax;
    }

    // Other contracts — use NQ limit as default
    return size > positionLimits.nqMax;
  }

  console.log('[TradingGuardian] Position size interceptor installed. Max: 1 NQ / 5 MNQ');
})();
