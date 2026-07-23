/**
 * Tilt Meter - MAIN WORLD
 * Monitors trading behavior in real-time and calculates a "tilt score"
 * 0-100 scale: 0-30 = green, 31-60 = yellow, 61-100 = red
 * At red (61+), orders are blocked automatically.
 *
 * Signals tracked:
 * 1. Order frequency (orders per minute)
 * 2. Size escalation (sizing up after losses)
 * 3. Trade count vs plan
 * 4. Time since last loss (trading too fast after loss)
 * 5. Consecutive losses
 */
(function() {
  'use strict';

  var tiltEnabled = true;
  var tiltScore = 0;
  var maxTradesPerDay = 10;

  // Tracking state
  var orderTimestamps = [];
  var recentSizes = [];
  var lastLossTime = 0;
  var consecutiveLosses = 0;
  var totalTrades = 0;
  var lastSize = 0;
  var sizedUpAfterLoss = false;

  // Listen for config
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_TILT_CONFIG') {
      tiltEnabled = event.data.enabled !== false;
      maxTradesPerDay = event.data.maxTradesPerDay || 10;
    }
    if (event.data && event.data.type === 'TRL_TRADE_RESULT') {
      if (event.data.result === 'loss') {
        consecutiveLosses++;
        lastLossTime = Date.now();
      } else {
        consecutiveLosses = 0;
        sizedUpAfterLoss = false;
      }
      recalculate();
    }
  });

  function recordOrder(size) {
    if (!tiltEnabled) return;

    var now = Date.now();
    orderTimestamps.push(now);
    totalTrades++;

    // Track size changes
    if (size && size > 0) {
      recentSizes.push({ size: size, time: now });
      // Detect sizing up after a loss
      if (lastLossTime > 0 && (now - lastLossTime) < 120000 && lastSize > 0 && size > lastSize) {
        sizedUpAfterLoss = true;
      }
      lastSize = size;
    }

    // Clean old data (keep last 5 minutes)
    var fiveMinAgo = now - 300000;
    orderTimestamps = orderTimestamps.filter(function(t) { return t > fiveMinAgo; });
    recentSizes = recentSizes.filter(function(s) { return s.time > fiveMinAgo; });

    recalculate();
  }

  function recalculate() {
    if (!tiltEnabled) { tiltScore = 0; broadcast(); return; }

    var now = Date.now();
    var score = 0;

    // 1. Order frequency (0-25 points)
    // More than 3 orders per minute = tilting
    var oneMinAgo = now - 60000;
    var recentOrders = orderTimestamps.filter(function(t) { return t > oneMinAgo; }).length;
    if (recentOrders >= 5) score += 25;
    else if (recentOrders >= 4) score += 20;
    else if (recentOrders >= 3) score += 15;
    else if (recentOrders >= 2) score += 5;

    // 2. Size escalation after loss (0-25 points)
    if (sizedUpAfterLoss) score += 25;

    // 3. Trade count vs plan (0-20 points)
    if (maxTradesPerDay > 0) {
      var ratio = totalTrades / maxTradesPerDay;
      if (ratio >= 2) score += 20;
      else if (ratio >= 1.5) score += 15;
      else if (ratio >= 1) score += 10;
      else if (ratio >= 0.8) score += 5;
    }

    // 4. Trading too fast after loss (0-15 points)
    if (lastLossTime > 0) {
      var timeSinceLoss = now - lastLossTime;
      if (timeSinceLoss < 15000) score += 15;       // < 15 seconds
      else if (timeSinceLoss < 30000) score += 10;  // < 30 seconds
      else if (timeSinceLoss < 60000) score += 5;   // < 1 minute
    }

    // 5. Consecutive losses (0-15 points)
    if (consecutiveLosses >= 4) score += 15;
    else if (consecutiveLosses >= 3) score += 12;
    else if (consecutiveLosses >= 2) score += 8;
    else if (consecutiveLosses >= 1) score += 3;

    // Cap at 100
    tiltScore = Math.min(100, Math.max(0, score));
    broadcast();
  }

  function broadcast() {
    var level = 'green';
    if (tiltScore >= 61) level = 'red';
    else if (tiltScore >= 31) level = 'yellow';

    window.postMessage({
      type: 'TRL_TILT_UPDATE',
      score: tiltScore,
      level: level,
      blocked: tiltScore >= 61
    }, '*');
  }

  // Hook into order detection — listen for order events from the main interceptor
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_ORDER_PLACED') {
      recordOrder(event.data.size || 0);
    }
    // Also track blocked orders (they still count as "attempts")
    if (event.data && event.data.type === 'TRL_ORDER_BLOCKED') {
      recordOrder(0);
    }
  });

  // Check if tilt should block
  function shouldBlock() {
    return tiltEnabled && tiltScore >= 61;
  }

  // Expose for other scripts
  window.__tiltMeter = {
    getScore: function() { return tiltScore; },
    getLevel: function() { return tiltScore >= 61 ? 'red' : tiltScore >= 31 ? 'yellow' : 'green'; },
    shouldBlock: shouldBlock,
    recordOrder: recordOrder
  };

  // Recalculate every 5 seconds (score decays as time passes)
  setInterval(function() {
    if (tiltEnabled) recalculate();
  }, 5000);

  // Broadcast tilt score to desktop app via bridge
  setInterval(function() {
    if (!tiltEnabled) return;
    var level = 'green';
    if (tiltScore >= 61) level = 'red';
    else if (tiltScore >= 31) level = 'yellow';

    window.postMessage({
      type: 'TRL_TILT_UPDATE',
      score: tiltScore,
      level: level,
      blocked: tiltScore >= 61
    }, '*');
  }, 2000);

  // Broadcast initial state
  broadcast();

  console.log('[TradingGuardian] Tilt Meter loaded.');
})();
