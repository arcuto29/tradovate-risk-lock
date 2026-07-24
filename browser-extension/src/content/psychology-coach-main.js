/**
 * Psychology Coach - MAIN WORLD (Tradovate)
 * Handles: cooldown after loss, daily loss block, max trades block.
 * Does NOT handle: rapid-fire detection (tilt meter does that),
 *   revenge trading detection (tilt meter does that).
 * 
 * Clear separation:
 *   - Risk Settings: hard limits (loss, profit, max trades, size, symbols)
 *   - Coach: cooldown + loss streak + profit protection
 *   - Tilt Meter: real-time behavior score (speed, sizing, patterns)
 */
(function() {
  'use strict';

  var coachEnabled = false;
  var maxTradesPerDay = 10;
  var cooldownSeconds = 120;
  var maxDailyLoss = 0; // 0 = disabled, reads from Risk Settings
  var trades = [];
  var lastLossTime = 0;
  var cooldownActive = false;
  var cooldownUntil = 0;
  var totalPnL = 0;
  var dailyLossBlocked = false;

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_COACH_CONFIG') {
      coachEnabled = event.data.enabled !== false;
      maxTradesPerDay = event.data.maxTradesPerDay || 10;
      cooldownSeconds = event.data.cooldownSeconds || 120;
      // Don't set maxDailyLoss from coach — Risk Settings is source of truth
    }
    if (event.data && event.data.type === 'TRL_POSITION_LIMITS') {
      // Read loss limit from Risk Settings
      if (event.data.lossLimitAmount && event.data.lossLimitAmount > 0) {
        maxDailyLoss = event.data.lossLimitAmount;
      }
    }
    if (event.data && event.data.type === 'TRL_TRADE_RESULT') {
      if (event.data.result === 'loss') {
        if (coachEnabled) {
          lastLossTime = Date.now();
          cooldownActive = true;
          cooldownUntil = Date.now() + (cooldownSeconds * 1000);
        }
        totalPnL -= Math.abs(event.data.pnl || 0);
      } else if (event.data.result === 'win') {
        totalPnL += Math.abs(event.data.pnl || 0);
      }
      if (coachEnabled && maxDailyLoss > 0 && totalPnL <= -maxDailyLoss) dailyLossBlocked = true;
    }
  });

  function checkOrder(url, body) {
    if (!coachEnabled) return null;
    var now = Date.now();

    // 1. Daily loss block
    if (dailyLossBlocked) {
      return { block: true, reason: 'DAILY LOSS REACHED', message: 'You hit your max daily loss. Done for the day.' };
    }

    // 2. Max trades block
    if (maxTradesPerDay > 0) {
      trades.push({ timestamp: now });
      var startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
      trades = trades.filter(function(t) { return t.timestamp > startOfDay.getTime(); });
      if (trades.length > maxTradesPerDay) {
        return { block: true, reason: 'TRADE LIMIT', message: 'You exceeded ' + maxTradesPerDay + ' trades today. Done.' };
      }
    }

    // 3. Cooldown block
    if (cooldownActive && now < cooldownUntil) {
      var remaining = Math.ceil((cooldownUntil - now) / 1000);
      return { block: true, reason: 'COOLDOWN', message: remaining + 's cooldown. Wait it out.' };
    } else {
      cooldownActive = false;
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
    if (lower.includes('/order/modify') || lower.includes('/order/cancel') || lower.includes('/order/update')) return true;
    if (lower.includes('/order/editstoploss') || lower.includes('/order/edittakeprofit') || lower.includes('/order/edit')) return true;
    if (lower.includes('/trading/modify') || lower.includes('/trading/cancel') || lower.includes('/trading/close')) return true;
    if (body && body.orderId) {
      var hasSize = body.qty || body.quantity || body.positionSize || body.amount || body.size;
      if (hasSize) return false;
      return true;
    }
    if (body && (body.stopPrice !== undefined || body.limitPrice !== undefined || body.triggerPrice !== undefined)) {
      var hasNewQty = body.positionSize || body.qty || body.quantity;
      if (!hasNewQty) return true;
    }
    return false;
  }

  // Override fetch
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

      // Skip modifications (SL/TP moves)
      if (isModifyUrl(url, body)) {
        return origFetch.apply(this, arguments);
      }

      // Skip risk-settings (handled by injector)
      if (url.includes('risk-monitor-api')) {
        return origFetch.apply(this, arguments);
      }

      // Check tilt meter first
      if (window.__tiltMeter && window.__tiltMeter.shouldBlock()) {
        window.postMessage({ type: 'TRL_COACH_BLOCK', reason: 'TILTING', message: 'Tilt meter is red. Step away.' }, '*');
        return Promise.reject(new Error('Blocked: Tilting'));
      }

      // Then coach checks
      var result = checkOrder(url, body);
      if (result && result.block) {
        window.postMessage({ type: 'TRL_COACH_BLOCK', reason: result.reason, message: result.message }, '*');
        return Promise.reject(new Error('Blocked: ' + result.reason));
      }

      // Order passed — notify tilt meter
      var orderSize = body ? (body.qty || body.quantity || body.positionSize || 0) : 0;
      window.postMessage({ type: 'TRL_ORDER_PLACED', size: orderSize }, '*');
    }

    return origFetch.apply(this, arguments);
  };

  console.log('[TradingGuardian-Coach] Loaded on Tradovate. Clean.');
})();
