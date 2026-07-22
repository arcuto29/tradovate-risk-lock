/**
 * Session Blocker + Position Size Lock - MAIN WORLD
 * Runs in the page's JavaScript context (world: "MAIN")
 * This bypasses CSP restrictions since it's not an inline script.
 * 
 * Platforms: TopstepX, Tradesea
 */
(function() {
  'use strict';

  var sessionBlocked = false;
  var positionLimits = { nqMax: 1, mnqMax: 5, esMax: 1, mesMax: 5, defaultMax: 2 };
  var coachEnabled = true;
  var maxTradesPerDay = 10;
  var cooldownSeconds = 120;
  var maxDailyLoss = 500;
  var trades = [];
  var lastLossTime = 0;
  var cooldownActive = false;
  var cooldownUntil = 0;
  var warningShown = false;
  var orderTimestamps = [];
  var dailyLossBlocked = false;

  // Listen for config from bridge content script
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_SESSION_STATE') {
      sessionBlocked = event.data.blocked;
      if (event.data.positionLimits) positionLimits = event.data.positionLimits;
    }
    if (event.data && event.data.type === 'TRL_COACH_CONFIG') {
      coachEnabled = event.data.enabled !== false;
      maxTradesPerDay = event.data.maxTradesPerDay || 10;
      cooldownSeconds = event.data.cooldownSeconds || 120;
      maxDailyLoss = event.data.maxDailyLoss || 500;
    }
    if (event.data && event.data.type === 'TRL_TRADE_RESULT') {
      if (event.data.result === 'loss') {
        lastLossTime = Date.now();
        cooldownActive = true;
        cooldownUntil = Date.now() + (cooldownSeconds * 1000);
      }
    }
  });

  // ─── Order URL detection ───────────────────────────────────────────────────
  var ORDER_URLS = ['userapi.topstepx.com/Order', '/Order', '/api/Order', 'order/place'];
  var SAFE_URLS = ['/Order?accountId', '/order/list', '/order/item', '/orders/history'];

  function isOrderUrl(url) {
    if (!url) return false;
    var lower = url.toLowerCase();
    if (SAFE_URLS.some(function(p) { return lower.includes(p.toLowerCase()); })) return false;
    return ORDER_URLS.some(function(p) { return url.includes(p); });
  }

  function isPostOrPut(method) {
    return method === 'POST' || method === 'PUT';
  }

  // ─── Position size check ───────────────────────────────────────────────────
  function isOversized(body) {
    if (!body || !body.positionSize) return false;
    var symbol = (body.symbolId || '').toUpperCase();
    var size = body.positionSize;
    if (symbol.includes('EMNQ') || symbol.includes('MNQ')) return size > positionLimits.mnqMax;
    if (symbol.includes('ENQ') || symbol.includes('NQ')) return size > positionLimits.nqMax;
    if (symbol.includes('MES')) return size > positionLimits.mesMax;
    if (symbol.includes('ES')) return size > positionLimits.esMax;
    return size > positionLimits.defaultMax;
  }

  // ─── Psychology coach check ────────────────────────────────────────────────
  function checkCoach(body) {
    if (!coachEnabled) return null;
    var now = Date.now();

    if (dailyLossBlocked) return { block: true, reason: 'DAILY LOSS HIT', message: 'Daily loss limit reached. Trading blocked.' };

    if (cooldownActive && now < cooldownUntil) {
      var remaining = Math.ceil((cooldownUntil - now) / 1000);
      if (!warningShown) { warningShown = true; return { warn: true, reason: 'COOLDOWN', message: 'You just lost. Wait ' + remaining + 's.' }; }
      return { block: true, reason: 'COOLDOWN VIOLATION', message: 'Cooldown ignored. Blocked. Wait ' + remaining + 's.' };
    } else { cooldownActive = false; warningShown = false; }

    orderTimestamps.push(now);
    orderTimestamps = orderTimestamps.filter(function(t) { return now - t < 10000; });
    if (orderTimestamps.length >= 3) {
      return { block: true, reason: 'RAPID FIRE', message: '3+ orders in 10 seconds. Slow down.' };
    }

    trades.push({ timestamp: now });
    var startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    trades = trades.filter(function(t) { return t.timestamp > startOfDay.getTime(); });
    if (trades.length > maxTradesPerDay + 2) {
      return { block: true, reason: 'OVERTRADE', message: 'Max trades exceeded (' + maxTradesPerDay + '). Blocked.' };
    }
    if (trades.length > maxTradesPerDay) {
      return { warn: true, reason: 'OVERTRADING', message: trades.length + ' trades today. Max is ' + maxTradesPerDay + '.' };
    }

    if (lastLossTime > 0 && (now - lastLossTime) < 30000) {
      return { warn: true, reason: 'REVENGE ALERT', message: 'Trading within 30s of a loss. Are you revenge trading?' };
    }

    return null;
  }

  // ─── Override fetch ────────────────────────────────────────────────────────
  var origFetch = window.fetch;
  window.fetch = function() {
    var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url ? arguments[0].url : '');
    var opts = typeof arguments[0] === 'string' ? arguments[1] : arguments[0];
    var method = (opts && opts.method ? opts.method : 'GET').toUpperCase();

    if (isPostOrPut(method) && isOrderUrl(url)) {
      // Session block
      if (sessionBlocked) {
        console.log('[TradingGuardian] BLOCKED: Outside trading hours');
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Outside trading hours' }, '*');
        return Promise.reject(new Error('Blocked: Outside trading hours'));
      }

      // Parse body
      var body = null;
      if (opts && opts.body && typeof opts.body === 'string') {
        try { body = JSON.parse(opts.body); } catch(e) {}
      }

      // Position size
      if (body && isOversized(body)) {
        console.log('[TradingGuardian] BLOCKED: Oversize', body.positionSize, body.symbolId);
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Position size ' + body.positionSize + ' exceeds max for ' + (body.symbolId || 'contract') }, '*');
        return Promise.reject(new Error('Blocked: Position size exceeds limit'));
      }

      // Psychology coach
      var coachResult = checkCoach(body);
      if (coachResult) {
        if (coachResult.block) {
          console.log('[TradingGuardian] COACH BLOCKED:', coachResult.reason);
          window.postMessage({ type: 'TRL_COACH_BLOCK', reason: coachResult.reason, message: coachResult.message }, '*');
          return Promise.reject(new Error('Blocked: ' + coachResult.reason));
        }
        if (coachResult.warn) {
          console.log('[TradingGuardian] COACH WARNING:', coachResult.reason);
          window.postMessage({ type: 'TRL_COACH_WARN', reason: coachResult.reason, message: coachResult.message }, '*');
        }
      }
    }

    return origFetch.apply(this, arguments);
  };

  // ─── Override XHR ──────────────────────────────────────────────────────────
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, url) { this._tgUrl = url; this._tgMethod = m; return origOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function(body) {
    var method = (this._tgMethod || 'GET').toUpperCase();
    if (isPostOrPut(method) && isOrderUrl(this._tgUrl)) {
      if (sessionBlocked) {
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Outside trading hours' }, '*');
        return;
      }
      var parsed = null;
      if (typeof body === 'string') { try { parsed = JSON.parse(body); } catch(e) {} }
      if (parsed && isOversized(parsed)) {
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Position size exceeds limit' }, '*');
        return;
      }
      var coachResult = checkCoach(parsed);
      if (coachResult && coachResult.block) {
        window.postMessage({ type: 'TRL_COACH_BLOCK', reason: coachResult.reason, message: coachResult.message }, '*');
        return;
      }
    }
    return origSend.apply(this, arguments);
  };

  console.log('[TradingGuardian] MAIN world interceptor loaded. Session/Size/Coach active.');
})();
