/**
 * Psychology Coach - MAIN WORLD
 * Runs in page context to intercept orders and check trading patterns.
 * Detects: revenge trading, overtrading, rapid-fire, cooldown violations.
 * For Tradovate specifically.
 */
(function() {
  'use strict';

  var coachEnabled = true;
  var maxTradesPerDay = 10;
  var cooldownSeconds = 120;
  var maxDailyLoss = 500;
  var trades = [];
  var lastLossTime = 0;
  var cooldownActive = false;
  var cooldownUntil = 0;
  var warningShown = false;
  var totalPnL = 0;
  var dailyLossBlocked = false;
  var orderTimestamps = [];

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
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
        totalPnL -= Math.abs(event.data.pnl || 0);
      } else if (event.data.result === 'win') {
        totalPnL += Math.abs(event.data.pnl || 0);
      }
      if (totalPnL <= -maxDailyLoss) dailyLossBlocked = true;
    }
  });

  function checkOrder(url, body) {
    if (!coachEnabled) return null;
    var now = Date.now();

    if (dailyLossBlocked) return { block: true, reason: 'DAILY LOSS REACHED', message: 'You have reached your maximum daily loss. Protecting your capital is the priority. Step away and reset for tomorrow.' };

    if (cooldownActive && now < cooldownUntil) {
      var remaining = Math.ceil((cooldownUntil - now) / 1000);
      if (!warningShown) { warningShown = true; return { warn: true, reason: 'TAKE A MOMENT', message: 'You just took a loss. Give yourself a moment to reset before your next decision. Cooldown: ' + remaining + 's.' }; }
      return { block: true, reason: 'COOLDOWN ACTIVE', message: 'Your cooldown is still active. This is protecting you from making an emotional decision. ' + remaining + ' seconds remaining.' };
    } else { cooldownActive = false; warningShown = false; }

    orderTimestamps.push(now);
    orderTimestamps = orderTimestamps.filter(function(t) { return now - t < 10000; });
    if (orderTimestamps.length >= 3) {
      return { block: true, reason: 'SLOW DOWN', message: 'You are placing orders faster than your plan allows. Step back and make sure each trade is intentional.' };
    }

    trades.push({ timestamp: now });
    var startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    trades = trades.filter(function(t) { return t.timestamp > startOfDay.getTime(); });
    if (trades.length > maxTradesPerDay + 2) {
      return { block: true, reason: 'TRADE LIMIT REACHED', message: 'You have exceeded your planned number of trades for today. Quality over quantity. Walk away.' };
    }
    if (trades.length > maxTradesPerDay) {
      return { warn: true, reason: 'APPROACHING LIMIT', message: 'You have placed ' + trades.length + ' trades today. Your plan allows ' + maxTradesPerDay + '. Consider whether this next trade is truly in your plan.' };
    }

    if (lastLossTime > 0 && (now - lastLossTime) < 30000) {
      return { warn: true, reason: 'CHECK YOURSELF', message: 'You are entering a trade immediately after a loss. Make sure this is a planned setup and not an emotional reaction.' };
    }

    return null;
  }

  function isTradeUrl(url) {
    if (!url) return false;
    return url.includes('/Order') || url.includes('/trading/place') || url.includes('/order/place');
  }

  function isModifyUrl(url, body) {
    if (!url) return false;
    var lower = url.toLowerCase();
    // ONLY skip on explicit modify/cancel/close endpoints
    if (lower.includes('/order/modify') || lower.includes('/order/cancel') || lower.includes('/order/update')) return true;
    if (lower.includes('/trading/modify') || lower.includes('/trading/cancel') || lower.includes('/trading/close')) return true;
    // Body MUST have orderId AND no size — only then it's safe to skip
    if (body && body.orderId) {
      var hasSize = body.qty || body.quantity || body.positionSize || body.amount || body.size;
      if (hasSize) return false; // Has size = could be new order, don't skip
      return true; // orderId + no size = modifying existing
    }
    return false; // When in doubt, let coach fire
  }

  // Override fetch for coach checks on Tradovate
  var origFetch = window.fetch;
  window.fetch = function() {
    var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url ? arguments[0].url : '');
    var opts = typeof arguments[0] === 'string' ? arguments[1] : arguments[0];
    var method = (opts && opts.method ? opts.method : 'GET').toUpperCase();

    if ((method === 'POST' || method === 'PUT') && isTradeUrl(url)) {
      var body = null;
      if (opts && opts.body && typeof opts.body === 'string') {
        try { body = JSON.parse(opts.body); } catch(e) {}
      }

      // Skip coach for order modifications (moving SL/TP, canceling, closing)
      if (isModifyUrl(url, body)) {
        return origFetch.apply(this, arguments);
      }

      // Also skip if URL is risk-settings (that's handled by the injector, not coach)
      if (url.includes('risk-monitor-api')) {
        return origFetch.apply(this, arguments);
      }

      var result = checkOrder(url, body);
      if (result) {
        if (result.block) {
          window.postMessage({ type: 'TRL_COACH_BLOCK', reason: result.reason, message: result.message }, '*');
          return Promise.reject(new Error('Blocked: ' + result.reason));
        }
        if (result.warn) {
          window.postMessage({ type: 'TRL_COACH_WARN', reason: result.reason, message: result.message }, '*');
        }
      }
    }

    return origFetch.apply(this, arguments);
  };

  console.log('[TradingGuardian-Coach] MAIN world coach loaded on Tradovate.');
})();
