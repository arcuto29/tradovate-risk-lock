/**
 * Session Blocker + Position Size Lock + P&L Tracking - MAIN WORLD
 * Runs in the page's JavaScript context (world: "MAIN")
 * This bypasses CSP restrictions since it's not an inline script.
 * 
 * Platforms: TopstepX, Tradesea
 * 
 * P&L TRACKING: Monitors incoming WebSocket messages for trade fills/closures
 * to detect wins and losses. This powers the cooldown and revenge trading features.
 */
(function() {
  'use strict';

  var sessionBlocked = false; // Start unblocked — only block when we KNOW session is blocked
  var fullDayBlocked = false; // Pre-market check blocked for the day
  var lockActive = false; // Only enforce limits when locked
  var newsBlockerEnabled = false;
  var newsBlockMinBefore = 30;
  var newsBlockMinAfter = 15;
  var newsEvents = [];
  var positionLimits = { limits: [], defaultMax: 2 };
  var blockedSymbols = [];
  var coachEnabled = false;
  var maxTradesPerDay = 10;
  var cooldownSeconds = 120;
  var maxDailyLoss = 0;
  var trades = [];
  var lastLossTime = 0;
  var cooldownActive = false;
  var cooldownUntil = 0;
  var lastOrderTime = 0;
  var dailyLossBlocked = false;
  var totalDailyPnL = 0;
  var lastLossDetectedTime = 0;
  var lastCloseOrderTime = 0; // When a close/reduce order was last detected

  // ─── Pyramiding / Stacking Protection ──────────────────────────────────────
  var pyramidingEnabled = false;   // false = block all stacking (default)
  var pyramidMaxContracts = 0;     // max total contracts allowed (0 = use position limit)
  var pyramidMaxAddOns = 0;        // max times they can add to a position (0 = no adds)
  var currentOpenPositions = {};   // { symbol: { size: N, addOns: N } }

  // ─── NEW: Advanced Protection Features ─────────────────────────────────────
  var consecutiveLosses = 0;
  var originalMaxSize = 0; // Stores original max at session start
  var currentMaxSize = 0; // Current max (reduces after losses)
  var highWaterMark = 0; // Highest P&L reached today
  var profitLockThreshold = 0; // Lock out after reaching this profit
  var drawdownFromHigh = 0; // Lock if P&L drops this much from high (0 = disabled)
  var profitLocked = false;
  var scalingLockEnabled = false; // One-way ratchet: can only reduce, never increase
  var lossStreakEnabled = false; // Auto-reduce size after consecutive losses
  var profitLockEnabled = false; // Lock out after hitting profit target or drawdown from high
  var escalatingCooldown = false; // Cooldown gets longer after each loss
  
  // Win Streak Protection
  var winStreakEnabled = false;
  var winStreakThreshold = 3;
  var winStreakReminder = true;
  var winStreakReduceSize = false;
  var winStreakCooldown = false;
  var winStreakCooldownSeconds = 120;
  var winStreakSuggestStop = true;
  var winStreakAutoLock = false;
  var consecutiveWins = 0;
  var winStreakTriggered = false;

  // Listen for config from bridge content script
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_SESSION_STATE') {
      sessionBlocked = event.data.blocked;
      window.__sentinelSessionBlocked = sessionBlocked;
      if (event.data.positionLimits) positionLimits = event.data.positionLimits;
    }
    if (event.data && event.data.type === 'TRL_LOCK_STATE') {
      lockActive = event.data.locked === true;
      // Expose lock state globally for WebSocket interceptor
      window.__sentinelLockActive = lockActive;
      window.__sentinelSessionBlocked = sessionBlocked;
      window.__sentinelFullDayBlocked = fullDayBlocked;
      window.__sentinelBlockedSymbols = blockedSymbols;
      window.__sentinelGetMax = getMaxForSymbol;
      window.__sentinelNewsBlocked = isNewsBlocked;
      if (!lockActive) {
        // Clear all enforcement when unlocked
        cooldownActive = false;
        dailyLossBlocked = false;
        profitLocked = false;
        fullDayBlocked = false;
        currentOpenPositions = {}; // Reset position tracking
        consecutiveWins = 0;
        winStreakTriggered = false;
      }
    }
    if (event.data && event.data.type === 'TRL_FULL_BLOCK') {
      fullDayBlocked = true;
    }
    if (event.data && event.data.type === 'TRL_EMERGENCY_FALLBACK') {
      // Desktop disconnected while locked - keep enforcement active
      lockActive = true;
      console.log('[Sentinel] EMERGENCY FALLBACK: Desktop disconnected while locked. Keeping protection active. Exits allowed.');
    }
    if (event.data && event.data.type === 'TRL_APP_DISCONNECTED') {
      // Desktop app is not running — disable ALL enforcement
      sessionBlocked = false;
      fullDayBlocked = false;
      coachEnabled = false;
      cooldownActive = false;
      dailyLossBlocked = false;
      profitLocked = false;
      blockedSymbols = [];
      positionLimits = { limits: [], defaultMax: 0 };
      maxDailyLoss = 0;
      console.log('[TradingGuardian] App disconnected — all enforcement disabled');
    }
    if (event.data && event.data.type === 'TRL_POSITION_LIMITS') {
      positionLimits = { limits: event.data.limits || [], defaultMax: event.data.defaultMax || 2 };
      // Read loss limit from Risk Settings (single source of truth)
      if (event.data.lossLimitAmount && event.data.lossLimitAmount > 0) {
        maxDailyLoss = event.data.lossLimitAmount;
      }
      // Pyramiding config
      if (event.data.pyramidingEnabled !== undefined) pyramidingEnabled = event.data.pyramidingEnabled;
      if (event.data.pyramidMaxContracts !== undefined) pyramidMaxContracts = event.data.pyramidMaxContracts;
      if (event.data.pyramidMaxAddOns !== undefined) pyramidMaxAddOns = event.data.pyramidMaxAddOns;
    }
    if (event.data && event.data.type === 'TRL_NEWS_CONFIG') {
      newsBlockerEnabled = event.data.enabled || false;
      newsBlockMinBefore = event.data.blockMinutesBefore || 30;
      newsBlockMinAfter = event.data.blockMinutesAfter || 15;
      newsEvents = event.data.events || [];
    }
    if (event.data && event.data.type === 'TRL_BLOCKED_SYMBOLS') {
      blockedSymbols = event.data.symbols || [];
    }
    if (event.data && event.data.type === 'TRL_COACH_CONFIG') {
      coachEnabled = event.data.enabled !== false;
      maxTradesPerDay = event.data.maxTradesPerDay || 10;
      cooldownSeconds = event.data.cooldownSeconds || 120;
      // Don't override maxDailyLoss here — Risk Settings is the source of truth
      if (event.data.profitLockThreshold !== undefined) profitLockThreshold = event.data.profitLockThreshold;
      if (event.data.drawdownFromHigh !== undefined) drawdownFromHigh = event.data.drawdownFromHigh;
      scalingLockEnabled = event.data.scalingLockEnabled === true;
      lossStreakEnabled = event.data.lossStreakEnabled === true;
      profitLockEnabled = event.data.profitLockEnabled === true;
      escalatingCooldown = event.data.escalatingCooldown === true;
      // Win Streak settings
      winStreakEnabled = event.data.winStreakEnabled === true;
      winStreakThreshold = event.data.winStreakThreshold || 3;
      winStreakReminder = event.data.winStreakReminder !== false;
      winStreakReduceSize = event.data.winStreakReduceSize === true;
      winStreakCooldown = event.data.winStreakCooldown === true;
      winStreakCooldownSeconds = event.data.winStreakCooldownSeconds || 120;
      winStreakSuggestStop = event.data.winStreakSuggestStop !== false;
      winStreakAutoLock = event.data.winStreakAutoLock === true;
      // Set original max size at start
      if (!originalMaxSize) { originalMaxSize = positionLimits.defaultMax || 2; currentMaxSize = positionLimits.defaultMax || 2; }
    }
    if (event.data && event.data.type === 'TRL_TRADE_RESULT') {
      if (event.data.result === 'loss') {
        consecutiveLosses++;
        consecutiveWins = 0;
        winStreakTriggered = false;
        if (coachEnabled) {
          lastLossTime = Date.now();
          cooldownActive = true;
          // ESCALATING COOLDOWN: 2min → 4min → 8min → 16min max
          var escalatedCooldown = escalatingCooldown 
            ? cooldownSeconds * Math.pow(2, Math.min(consecutiveLosses - 1, 3))
            : cooldownSeconds;
          cooldownUntil = Date.now() + (escalatedCooldown * 1000);
        }
        
        // LOSS STREAK AUTO-TIGHTEN
        if (coachEnabled && lossStreakEnabled && consecutiveLosses >= 2) {
          currentMaxSize = consecutiveLosses >= 3 ? 1 : Math.max(1, Math.ceil(originalMaxSize / 2));
          console.log('[TradingGuardian] Loss streak ' + consecutiveLosses + ' - Max size: ' + currentMaxSize);
          window.postMessage({ type: 'TRL_COACH_WARN', reason: 'SIZE REDUCED', message: 'After ' + consecutiveLosses + ' consecutive losses, your max size is now ' + currentMaxSize + ' contract(s). Protecting your capital.' }, '*');
        }
      } else if (event.data.result === 'win') {
        consecutiveLosses = 0;
        consecutiveWins++;
        
        // WIN STREAK PROTECTION — fire ONE action only (most important)
        if (winStreakEnabled && consecutiveWins >= winStreakThreshold && !winStreakTriggered) {
          winStreakTriggered = true;
          console.log('[Sentinel] Win streak triggered: ' + consecutiveWins + ' consecutive wins (threshold: ' + winStreakThreshold + ')');
          
          // Action: Auto-lock takes priority (most aggressive — blocks everything)
          if (winStreakAutoLock) {
            window.postMessage({ type: 'TRL_COACH_BLOCK', reason: 'WIN STREAK LOCK', message: 'Session locked after ' + consecutiveWins + ' consecutive wins. Protecting your profits.' }, '*');
          }
          // Action: Reduce size (silent enforcement, no popup)
          else if (winStreakReduceSize) {
            currentMaxSize = Math.max(1, Math.ceil(originalMaxSize / 2));
            console.log('[Sentinel] Win streak: Size reduced to ' + currentMaxSize);
            // Single non-blocking notification
            window.postMessage({ type: 'TRL_COACH_WARN', reason: 'WIN STREAK', message: 'Size reduced to ' + currentMaxSize + ' after ' + consecutiveWins + ' wins. Protecting profits.' }, '*');
          }
          // Action: Cooldown (silent enforcement)
          else if (winStreakCooldown) {
            cooldownActive = true;
            cooldownUntil = Date.now() + (winStreakCooldownSeconds * 1000);
            window.postMessage({ type: 'TRL_COACH_WARN', reason: 'WIN STREAK', message: consecutiveWins + '-win streak. ' + winStreakCooldownSeconds + 's pause before next trade.' }, '*');
          }
          // Action: Suggest stopping (passive notification only)
          else if (winStreakSuggestStop) {
            window.postMessage({ type: 'TRL_COACH_WARN', reason: 'WIN STREAK', message: consecutiveWins + ' wins in a row. Consider ending on a high note.' }, '*');
          }
          // Action: Reminder only (lightest touch)
          else if (winStreakReminder) {
            window.postMessage({ type: 'TRL_COACH_WARN', reason: 'WIN STREAK', message: 'You\'re on a ' + consecutiveWins + '-win streak. Protect your profits.' }, '*');
          }
        }
      }
    }
  });

  // ─── Order URL detection ───────────────────────────────────────────────────
  var ORDER_URLS = ['userapi.topstepx.com/Order', 'topstepx.com/Order', 'tradovate.com/Order', 'tradovateapi.com/order/', 'tradovateapi.com/Order', 'ninjatrader.com/Order', 'tradesea.ai/Order', 'tradingview.com/broker/', '/api/Order', 'order/place', 'order/placeOrder', 'order/placeOCO', 'order/placeOSO'];
  var SAFE_URLS = ['/Order?accountId', '/order/list', '/order/item', '/orders/history', '/order/deps', '/order/ldeps', '/risk-settings'];
  // URLs that indicate modifying/canceling an existing order (NOT new orders)
  var MODIFY_URLS = ['/Order/modify', '/Order/cancel', '/Order/update', '/order/modify', '/order/cancel', '/order/update', '/Order/editStopLoss', '/Order/editTakeProfit', '/Order/editStop', '/Order/editTarget', '/Order/edit', '/order/modifyOrder', '/order/cancelOrder'];
  // Domains that are NEVER trading platforms (ad networks, analytics, etc)
  var IGNORE_DOMAINS = ['doubleclick.net', 'google.com', 'googleapis.com', 'gstatic.com', 'facebook.com', 'analytics', 'sentry.io', 'cloudflare', 'jsdelivr', 'unpkg', 'cdn.'];

  function isOrderUrl(url) {
    if (!url) return false;
    var lower = url.toLowerCase();
    // Never intercept ad/analytics/CDN requests
    if (IGNORE_DOMAINS.some(function(d) { return lower.includes(d); })) return false;
    if (SAFE_URLS.some(function(p) { return lower.includes(p.toLowerCase()); })) return false;
    // Only match URLs that contain known trading endpoint patterns AND are on trading domains
    var isTradingDomain = lower.includes('topstepx') || lower.includes('tradovate') || lower.includes('tradesea') || lower.includes('tradingview') || lower.includes('ninjatrader');
    if (!isTradingDomain) return false;
    return ORDER_URLS.some(function(p) { return lower.includes(p.toLowerCase()); });
  }

  function isModifyOrCancel(url, body) {
    if (!url) return false;
    var lower = url.toLowerCase();
    // ONLY skip on explicit modify/cancel URL endpoints
    if (MODIFY_URLS.some(function(p) { return lower.includes(p.toLowerCase()); })) return true;
    // Body MUST have an orderId AND no new position size — that's the only safe check
    // If there's ANY size/quantity field, treat it as a new order (don't let anything bypass)
    if (body && body.orderId) {
      var hasSize = body.positionSize || body.qty || body.quantity || body.amount || body.size;
      if (hasSize) return false; // Has size = could be a new order, don't skip
      return true; // Has orderId but no size = definitely modifying existing
    }
    // If body only has price changes (stopPrice, limitPrice, triggerPrice) with an existing order reference
    if (body && (body.stopPrice !== undefined || body.limitPrice !== undefined || body.triggerPrice !== undefined)) {
      // Has price fields but check if it also has a new position — if no new qty it's a drag
      var hasNewQty = body.positionSize || body.qty || body.quantity;
      if (!hasNewQty) return true; // Only price change = SL/TP drag
    }
    return false; // When in doubt, don't skip — let coach fire
  }

  function isPostOrPut(method) {
    return method === 'POST' || method === 'PUT';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ORDER CLASSIFIER v2 - Hardened
  // NEVER blocks exits. Position-aware. Full diagnostic output.
  // ═══════════════════════════════════════════════════════════════════════════

  var CLOSE_URLS = ['/Order/close', '/order/close', '/Position/close', '/position/close', '/Order/flatten', '/order/flatten', '/Position/flatten', '/position/flatten'];
  var CANCEL_URLS = ['/Order/cancel', '/order/cancel', '/Order/delete', '/order/delete', '/order/cancelAll', '/Order/cancelAll'];
  var MODIFY_STOP_URLS = ['/Order/editStopLoss', '/Order/editStop', '/order/modifyStop', '/Order/editTakeProfit', '/order/modifyTakeProfit'];
  var QUERY_URLS = ['/Order?', '/order/list', '/orders/history', '/Position?', '/position/list', '/account/', '/user/'];

  // Position state tracking
  // SOURCE: inferred from intercepted order submissions only (not from broker DOM or API responses)
  // CONFIDENCE: low - can become stale if orders reject, partial fill, or position changes outside this tab
  var positionState = {}; // { SYMBOL: { side: 'long'|'short'|'flat', quantity: number, lastUpdated: timestamp } }
  var POSITION_SOURCE = 'inferred'; // Always 'inferred' until we implement broker DOM/API position reading
  var POSITION_CONFIDENCE = 'low';  // Always 'low' for inferred-only tracking

  function getPositionForSymbol(symbol) {
    if (!symbol) return { side: 'flat', quantity: 0 };
    var pos = positionState[symbol.toUpperCase()] || currentOpenPositions[symbol.toUpperCase()];
    if (pos && pos.size > 0) {
      return { side: (pos.direction || 'long').toLowerCase(), quantity: pos.size || 0 };
    }
    return { side: 'flat', quantity: 0 };
  }

  /**
   * classifyOrder - Full order classification with all required fields
   * Returns: { action, reason, symbol, side, quantity, positionBefore, positionSource, positionConfidence, closeQuantity, newRiskQuantity, confidence }
   */
  function classifyOrder(url, body) {
    var symbol = '';
    var side = '';
    var quantity = 0;
    var positionBefore = { side: 'flat', quantity: 0 };

    // Extract order details from body
    if (body) {
      symbol = String(body.symbolId || body.symbol || body.instrument || '').toUpperCase();
      side = String(body.action || body.orderAction || body.side || '').toLowerCase();
      quantity = Math.abs(body.positionSize || body.qty || body.quantity || body.amount || body.size || 0);
    }

    positionBefore = getPositionForSymbol(symbol);

    // Build base result template
    var result = {
      action: 'UNKNOWN',
      reason: '',
      symbol: symbol || 'UNKNOWN',
      side: side || 'unknown',
      quantity: quantity,
      positionBefore: positionBefore,
      positionSource: POSITION_SOURCE,
      positionConfidence: POSITION_CONFIDENCE,
      closeQuantity: 0,
      newRiskQuantity: 0,
      confidence: 'low',
    };

    if (!url) { result.reason = 'No URL provided'; return result; }
    var lower = url.toLowerCase();

    // ─── URL-based classification (highest confidence) ─────────────────────
    if (QUERY_URLS.some(function(p) { return lower.includes(p.toLowerCase()); })) {
      result.action = 'QUERY'; result.reason = 'URL matches query/list pattern'; result.confidence = 'high'; return result;
    }
    if (CLOSE_URLS.some(function(p) { return lower.includes(p.toLowerCase()); })) {
      result.action = 'CLOSE_POSITION'; result.reason = 'URL matches close/flatten pattern'; result.confidence = 'high';
      result.closeQuantity = positionBefore.quantity || quantity; return result;
    }
    if (CANCEL_URLS.some(function(p) { return lower.includes(p.toLowerCase()); })) {
      result.action = 'CANCEL_ORDER'; result.reason = 'URL matches cancel pattern'; result.confidence = 'high'; return result;
    }
    if (MODIFY_STOP_URLS.some(function(p) { return lower.includes(p.toLowerCase()); })) {
      result.action = 'MODIFY_PROTECTIVE_ORDER'; result.reason = 'URL matches stop/TP modification pattern'; result.confidence = 'high'; return result;
    }

    // ─── Body flag-based classification ────────────────────────────────────
    if (body) {
      var action = String(body.action || body.orderAction || body.type || '').toLowerCase();
      if (action === 'close' || action === 'flatten' || action === 'closeposition' || action === 'closeall') {
        result.action = 'CLOSE_POSITION'; result.reason = 'body.action=' + action; result.confidence = 'high';
        result.closeQuantity = positionBefore.quantity || quantity; return result;
      }
      if (action === 'cancel' || action === 'cancelorder' || action === 'cancelall') {
        result.action = 'CANCEL_ORDER'; result.reason = 'body.action=' + action; result.confidence = 'high'; return result;
      }
      if (body.isClose === true || body.closePosition === true || body.flatten === true) {
        result.action = 'CLOSE_POSITION'; result.reason = 'body flag: isClose/closePosition/flatten=true'; result.confidence = 'high';
        result.closeQuantity = positionBefore.quantity || quantity; return result;
      }
      if (body.reduceOnly === true || body.isReduceOnly === true) {
        result.action = 'REDUCE_POSITION'; result.reason = 'body flag: reduceOnly/isReduceOnly=true'; result.confidence = 'high';
        result.closeQuantity = Math.min(quantity, positionBefore.quantity); return result;
      }

      // ─── Position-aware classification (lower confidence - inferred position) ─
      if (symbol && positionBefore.side !== 'flat' && positionBefore.quantity > 0 && side && quantity > 0) {
        var isSelling = (side === 'sell' || side === 'sellshort' || side === 'short');
        var isBuying = (side === 'buy' || side === 'buytocover' || side === 'long');
        var isLong = positionBefore.side === 'long';
        var isShort = positionBefore.side === 'short';

        // Selling against a long position
        if (isLong && isSelling) {
          if (quantity < positionBefore.quantity) {
            result.action = 'REDUCE_POSITION'; result.reason = 'Sell ' + quantity + ' reduces long ' + positionBefore.quantity + ' ' + symbol;
            result.confidence = 'medium'; result.closeQuantity = quantity; result.newRiskQuantity = 0; return result;
          } else if (quantity === positionBefore.quantity) {
            result.action = 'CLOSE_POSITION'; result.reason = 'Sell ' + quantity + ' closes long ' + positionBefore.quantity + ' ' + symbol;
            result.confidence = 'medium'; result.closeQuantity = quantity; result.newRiskQuantity = 0; return result;
          } else {
            result.action = 'REVERSE_POSITION'; result.reason = 'Sell ' + quantity + ' reverses long ' + positionBefore.quantity + ' (close ' + positionBefore.quantity + ' + open short ' + (quantity - positionBefore.quantity) + ')';
            result.confidence = 'medium'; result.closeQuantity = positionBefore.quantity; result.newRiskQuantity = quantity - positionBefore.quantity; return result;
          }
        }

        // Buying against a short position
        if (isShort && isBuying) {
          if (quantity < positionBefore.quantity) {
            result.action = 'REDUCE_POSITION'; result.reason = 'Buy ' + quantity + ' reduces short ' + positionBefore.quantity + ' ' + symbol;
            result.confidence = 'medium'; result.closeQuantity = quantity; result.newRiskQuantity = 0; return result;
          } else if (quantity === positionBefore.quantity) {
            result.action = 'CLOSE_POSITION'; result.reason = 'Buy ' + quantity + ' closes short ' + positionBefore.quantity + ' ' + symbol;
            result.confidence = 'medium'; result.closeQuantity = quantity; result.newRiskQuantity = 0; return result;
          } else {
            result.action = 'REVERSE_POSITION'; result.reason = 'Buy ' + quantity + ' reverses short ' + positionBefore.quantity + ' (close ' + positionBefore.quantity + ' + open long ' + (quantity - positionBefore.quantity) + ')';
            result.confidence = 'medium'; result.closeQuantity = positionBefore.quantity; result.newRiskQuantity = quantity - positionBefore.quantity; return result;
          }
        }

        // Buying when already long = INCREASE
        if (isLong && isBuying) {
          result.action = 'INCREASE_POSITION'; result.reason = 'Buy ' + quantity + ' adds to existing long ' + positionBefore.quantity + ' ' + symbol;
          result.confidence = 'medium'; result.newRiskQuantity = quantity; return result;
        }

        // Selling when already short = INCREASE
        if (isShort && isSelling) {
          result.action = 'INCREASE_POSITION'; result.reason = 'Sell ' + quantity + ' adds to existing short ' + positionBefore.quantity + ' ' + symbol;
          result.confidence = 'medium'; result.newRiskQuantity = quantity; return result;
        }
      }

      // ─── Flat position or unknown - default to OPEN if we have side+qty ────
      if (positionBefore.side === 'flat' && side && quantity > 0) {
        result.action = 'OPEN_POSITION'; result.reason = 'Flat position + new order with side=' + side + ' qty=' + quantity;
        result.confidence = 'medium'; result.newRiskQuantity = quantity; return result;
      }
    }

    // ─── Cannot determine - mark as UNKNOWN (NOT open) ────────────────────
    result.action = 'UNKNOWN';
    result.reason = 'Unable to classify: no recognizable close/reduce/open signals. URL=' + sanitizeUrl(url) + ' side=' + side + ' qty=' + quantity;
    result.confidence = 'low';
    return result;
  }

  /**
   * isRiskReducing - determines if an order should bypass all rule checks
   */
  function isRiskReducing(url, body) {
    var result = classifyOrder(url, body);
    return result.action === 'CLOSE_POSITION' || result.action === 'REDUCE_POSITION' ||
           result.action === 'CANCEL_ORDER' || result.action === 'MODIFY_PROTECTIVE_ORDER' ||
           result.action === 'QUERY';
  }

  /**
   * isRiskIncreasing - determines if an order should be checked against rules
   */
  function isRiskIncreasing(url, body) {
    var result = classifyOrder(url, body);
    return result.action === 'OPEN_POSITION' || result.action === 'INCREASE_POSITION';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIAGNOSTIC LOGGER - Dev Mode Only, Non-Blocking, Sanitized
  // Disabled by default. Only enabled via explicit dev command.
  // ═══════════════════════════════════════════════════════════════════════════

  var diagnosticLog = [];
  var diagnosticEnabled = false; // OFF by default - never auto-enables
  var diagnosticEventId = 0;
  var SENTINEL_VERSION = '2.1.0';
  var IS_DEV_BUILD = true; // Set to false for production builds

  // Listen for dev mode toggle from bridge - only if dev build
  if (IS_DEV_BUILD) {
    window.addEventListener('message', function(event) {
      if (event.source !== window) return;
      if (event.data && event.data.type === 'TRL_DEV_MODE') {
        diagnosticEnabled = event.data.enabled === true;
        if (diagnosticEnabled) {
          console.warn('[Sentinel Diagnostics] ⚠ DIAGNOSTIC LOGGING ACTIVE. Use paper trading only.');
        } else {
          console.log('[Sentinel Diagnostics] Logging disabled.');
        }
      }
    });
  }

  function detectPlatform() {
    var host = window.location.hostname;
    if (host.includes('tradingview')) return 'TradingView';
    if (host.includes('topstepx')) return 'TopstepX';
    if (host.includes('tradovate')) return 'Tradovate';
    if (host.includes('tradesea')) return 'Tradesea';
    return 'Unknown';
  }

  function sanitizeUrl(url) {
    try {
      var parsed = new URL(url, window.location.origin);
      var path = parsed.pathname;
      path = path.replace(/\/\d{4,}/g, '/[ID]');
      path = path.replace(/[a-f0-9]{8}-[a-f0-9]{4}/gi, '[UUID]');
      return path;
    } catch(e) {
      return (url || '').split('?')[0].replace(/\/\d{4,}/g, '/[ID]');
    }
  }

  function getProtectionStatus() {
    var status = 'FULL_PROTECTION';
    var reasons = [];
    if (!lockActive) { status = 'UNLOCKED'; reasons.push('Not locked'); }
    if (POSITION_SOURCE === 'inferred') { reasons.push('Position state inferred (not broker-verified)'); if (status === 'FULL_PROTECTION') status = 'PARTIAL_PROTECTION'; }
    // Could add P&L monitor health check here in future
    return { status: status, reasons: reasons };
  }

  /**
   * logDiagnostic - NON-BLOCKING. Wrapped in try-catch so it never affects enforcement.
   */
  function logDiagnostic(url, method, body, classification, decision, requestReached) {
    if (!diagnosticEnabled) return;
    try {
      var symbol = '';
      var side = '';
      var quantity = 0;
      var flags = {};

      if (body) {
        symbol = String(body.symbolId || body.symbol || body.instrument || '').toUpperCase();
        side = String(body.action || body.orderAction || body.side || '').toUpperCase() || 'UNKNOWN';
        quantity = Math.abs(body.positionSize || body.qty || body.quantity || body.size || 0);
        flags = {
          reduceOnly: !!(body.reduceOnly || body.isReduceOnly),
          isClose: !!(body.isClose || body.closePosition || body.flatten),
          action: body.action || body.orderAction || null,
          orderType: body.orderType || body.type || null,
        };
      }

      var entry = {
        id: 'diag_' + (++diagnosticEventId),
        platform: detectPlatform(),
        timestamp: new Date().toISOString(),
        method: method || 'UNKNOWN',
        urlPath: sanitizeUrl(url),
        symbol: symbol || 'UNKNOWN',
        side: side,
        quantity: quantity,
        flags: flags,
        positionBefore: classification.positionBefore || { side: 'unknown', quantity: 0 },
        positionSource: classification.positionSource || POSITION_SOURCE,
        positionConfidence: classification.positionConfidence || POSITION_CONFIDENCE,
        classification: classification.action,
        classificationReason: classification.reason,
        closeQuantity: classification.closeQuantity || 0,
        newRiskQuantity: classification.newRiskQuantity || 0,
        classificationConfidence: classification.confidence || 'low',
        decision: decision,
        requestReachedOriginalHandler: requestReached === true ? true : requestReached === false ? false : 'unknown',
        protectionStatus: getProtectionStatus(),
        sentinelVersion: SENTINEL_VERSION,
      };

      diagnosticLog.push(entry);
      if (diagnosticLog.length > 500) diagnosticLog.shift();
      console.log('[Sentinel Diagnostics]', JSON.stringify(entry, null, 2));
      try { window.postMessage({ type: 'TRL_DIAGNOSTIC_LOG', entry: entry }, '*'); } catch(e2) {}
    } catch(e) {
      // Diagnostic failure must NEVER affect order enforcement
      console.error('[Sentinel Diagnostics] Logger error (non-blocking):', e.message);
    }
  }

  // ─── Position size check ───────────────────────────────────────────────────
  // ─── Block Sound ─────────────────────────────────────────────────────────
  function playBlockSound() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch(e) {}
  }

  // Check if currently within a news event block window
  function isNewsBlocked() {
    if (!newsBlockerEnabled || !newsEvents || newsEvents.length === 0) return false;
    var now = new Date();
    var nowET = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    var todayStr = nowET.getFullYear() + '-' + String(nowET.getMonth() + 1).padStart(2, '0') + '-' + String(nowET.getDate()).padStart(2, '0');
    
    for (var i = 0; i < newsEvents.length; i++) {
      var ev = newsEvents[i];
      if (ev.date !== todayStr) continue;
      var parts = ev.time.split(':');
      var eventMin = parseInt(parts[0]) * 60 + parseInt(parts[1]);
      var currentMin = nowET.getHours() * 60 + nowET.getMinutes();
      var blockStart = eventMin - newsBlockMinBefore;
      var blockEnd = eventMin + newsBlockMinAfter;
      if (currentMin >= blockStart && currentMin <= blockEnd) return true;
    }
    return false;
  }

  function isBlockedSymbol(body) {
    if (!body || blockedSymbols.length === 0) return false;
    var symbol = (body.symbolId || body.symbol || body.instrument || '').toUpperCase();
    if (!symbol) return false;
    for (var i = 0; i < blockedSymbols.length; i++) {
      var blocked = blockedSymbols[i].toUpperCase();
      if (blocked && symbol.includes(blocked)) return true;
    }
    return false;
  }

  function getMaxForSymbol(symbol) {
    if (!symbol) return positionLimits.defaultMax || 2;
    var upper = symbol.toUpperCase();
    // Check against user-defined limits
    var limits = positionLimits.limits || [];
    for (var i = 0; i < limits.length; i++) {
      var sym = (limits[i].symbol || '').toUpperCase();
      if (sym && upper.includes(sym)) return limits[i].maxSize || 1;
    }
    return positionLimits.defaultMax || 2;
  }

  function isOversized(body) {
    if (!body) return false;
    var size = body.positionSize || body.qty || body.quantity || body.amount || body.size || 0;
    size = Math.abs(size); // Handle negative values for sell/short orders
    if (!size || size <= 0) return false;
    var symbol = (body.symbolId || body.symbol || body.instrument || '').toUpperCase();
    var max = getMaxForSymbol(symbol);
    
    // Apply loss-streak reduction if active
    if (lossStreakEnabled && currentMaxSize > 0 && currentMaxSize < max) {
      max = currentMaxSize;
    }
    
    // Only block if single order exceeds max (not cumulative)
    return size > max;
  }

  // ─── Psychology coach check ────────────────────────────────────────────────
  // Coach ONLY handles: cooldown after loss, profit lock, daily loss.
  // Trade count and rapid-fire are handled by the tilt meter now.
  function checkCoach(body) {
    if (!coachEnabled) return null;
    var now = Date.now();

    // PROFIT LOCK: blocked if you hit profit target or gave back too much from high
    if (profitLocked) {
      return { block: true, reason: 'PROFIT PROTECTED', message: 'You reached your profit target or gave back too much from your high. Your green day is protected. Walk away.' };
    }

    // DAILY LOSS: blocked if hit max daily loss
    if (dailyLossBlocked) {
      return { block: true, reason: 'DAILY LOSS REACHED', message: 'You have reached your maximum daily loss. Protecting your capital is the priority. Step away and reset for tomorrow.' };
    }

    // MAX TRADES: blocked if exceeded
    if (maxTradesPerDay > 0) {
      trades.push({ timestamp: now });
      var startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
      trades = trades.filter(function(t) { return t.timestamp > startOfDay.getTime(); });
      if (trades.length > maxTradesPerDay) {
        return { block: true, reason: 'TRADE LIMIT REACHED', message: 'You have exceeded your planned number of trades (' + maxTradesPerDay + ') for today. Walk away.' };
      }
    }

    // COOLDOWN: forced wait after a loss
    if (cooldownActive && now < cooldownUntil) {
      var remaining = Math.ceil((cooldownUntil - now) / 1000);
      return { block: true, reason: 'COOLDOWN ACTIVE', message: 'Cooldown active. ' + remaining + ' seconds remaining. This is protecting you from an emotional decision.' };
    } else {
      cooldownActive = false;
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
      // Parse body first so we can check if it's a modification
      var body = null;
      if (opts && opts.body && typeof opts.body === 'string') {
        try { body = JSON.parse(opts.body); } catch(e) {}
      }

      // Skip coach/size checks for order modifications (moving SL/TP, canceling orders)
      if (isModifyOrCancel(url, body)) {
        return origFetch.apply(this, arguments);
      }

      // ═══ USE UNIFIED EVALUATOR ═══
      var decision = evaluateTradingRequest(url, method, body);
      
      if (!decision.allow) {
        if (decision.playSound) playBlockSound();
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: decision.reason }, '*');
        window.postMessage({ type: 'TRL_ORDER_PLACED', size: 0 }, '*'); // Track blocked attempt for tilt
        return Promise.reject(new Error('Blocked: ' + decision.reason));
      }
      
      // Order allowed - track for tilt meter and position state
      var orderSize = body ? Math.abs(body.positionSize || body.qty || body.quantity || body.size || 0) : 0;
      var orderSymbol = (decision.classification.symbol || '').toUpperCase();
      var orderDirection = decision.classification.side || 'Long';
      if (orderDirection === 'sell' || orderDirection === 'SELL' || orderDirection === 'short' || orderDirection === 'SHORT') orderDirection = 'Short';
      else orderDirection = 'Long';
      lastOrderSymbol = orderSymbol || lastOrderSymbol;
      lastOrderDirection = orderDirection;

      // Only fire ORDER_PLACED for risk-increasing actions (tilt meter tracks these)
      if (decision.classification.action === 'OPEN_POSITION' || decision.classification.action === 'INCREASE_POSITION') {
        window.postMessage({ type: 'TRL_ORDER_PLACED', size: orderSize, symbol: lastOrderSymbol, direction: orderDirection }, '*');
        // Update position tracking
        if (orderSymbol && orderSize > 0) {
          if (!currentOpenPositions[orderSymbol]) {
            currentOpenPositions[orderSymbol] = { size: orderSize, addOns: 0, direction: orderDirection.toLowerCase() };
          } else {
            currentOpenPositions[orderSymbol].size += orderSize;
            currentOpenPositions[orderSymbol].addOns++;
          }
        }
      }
    }

    return origFetch.apply(this, arguments);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UNIFIED TRADING REQUEST EVALUATOR
  // Both fetch and XHR call this single function. No duplicated logic.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * evaluateTradingRequest - Single decision point for ALL trading requests
   * @param {string} url - The request URL
   * @param {string} method - HTTP method
   * @param {object|null} body - Parsed request body
   * @returns {{ allow: boolean, reason: string, classification: object, playSound: boolean }}
   */
  function evaluateTradingRequest(url, method, body) {
    var classification = classifyOrder(url, body);
    var decision = { allow: true, reason: '', classification: classification, playSound: false, requestReached: false };

    // ─── EXIT SAFETY: Always allow risk-reducing actions FIRST ─────────────
    if (classification.action === 'CLOSE_POSITION' || classification.action === 'REDUCE_POSITION' ||
        classification.action === 'CANCEL_ORDER' || classification.action === 'MODIFY_PROTECTIVE_ORDER' ||
        classification.action === 'QUERY') {
      decision.allow = true;
      decision.reason = 'Risk-reducing: ' + classification.action;
      decision.requestReached = true;
      // Mark close time so P&L polling doesn't count the resulting P&L drop as a new loss
      if (classification.action === 'CLOSE_POSITION' || classification.action === 'REDUCE_POSITION') {
        lastCloseOrderTime = Date.now();
      }
      logDiagnostic(url, method, body, classification, 'ALLOWED', true);
      return decision;
    }

    // ─── REVERSAL: Evaluate the new-risk portion against rules ─────────────
    if (classification.action === 'REVERSE_POSITION') {
      // The close portion is always safe. Check if the NEW exposure violates rules.
      var newRiskQty = classification.newRiskQuantity || 0;
      var symbol = classification.symbol;
      
      // Check new-risk portion against max contracts
      if (lockActive && newRiskQty > 0 && symbol) {
        var max = getMaxForSymbol(symbol);
        if (newRiskQty > max) {
          decision.allow = false;
          decision.reason = 'Reversal blocked: new exposure ' + newRiskQty + ' exceeds max ' + max + ' for ' + symbol;
          decision.playSound = true;
          logDiagnostic(url, method, body, classification, 'BLOCKED_REVERSAL_SIZE', false);
          return decision;
        }
      }
      // Check other rules against the new-risk portion
      if (lockActive && symbol && isBlockedSymbol(body)) {
        decision.allow = false;
        decision.reason = 'Reversal blocked: ' + symbol + ' is a blocked symbol';
        decision.playSound = true;
        logDiagnostic(url, method, body, classification, 'BLOCKED_REVERSAL_SYMBOL', false);
        return decision;
      }
      if (lockActive && sessionBlocked) {
        decision.allow = false;
        decision.reason = 'Reversal blocked: outside session hours';
        decision.playSound = true;
        logDiagnostic(url, method, body, classification, 'BLOCKED_REVERSAL_SESSION', false);
        return decision;
      }
      if (lockActive && newsBlockerEnabled && isNewsBlocked()) {
        decision.allow = false;
        decision.reason = 'Reversal blocked: news event window';
        decision.playSound = true;
        logDiagnostic(url, method, body, classification, 'BLOCKED_REVERSAL_NEWS', false);
        return decision;
      }
      // If new-risk passes all checks, allow the full reversal
      decision.allow = true;
      decision.reason = 'Reversal allowed: new exposure ' + newRiskQty + ' within limits';
      decision.requestReached = true;
      logDiagnostic(url, method, body, classification, 'ALLOWED_REVERSAL', true);
      return decision;
    }

    // ─── UNKNOWN: Allow but degrade protection status ─────────────────────
    if (classification.action === 'UNKNOWN') {
      decision.allow = true;
      decision.reason = 'Unknown format - allowing (may be exit). Protection degraded.';
      decision.requestReached = true;
      logDiagnostic(url, method, body, classification, 'ALLOWED_UNKNOWN_DEGRADED', true);
      console.warn('[Sentinel] UNKNOWN order format - protection degraded. URL:', sanitizeUrl(url));
      // Track that we've seen an unknown format (degrades protection status)
      if (typeof window.__sentinel_unknownCount === 'undefined') window.__sentinel_unknownCount = 0;
      window.__sentinel_unknownCount++;
      return decision;
    }

    // ─── RISK-INCREASING: Check ALL rules ─────────────────────────────────
    // Actions: OPEN_POSITION, INCREASE_POSITION, MODIFY_ENTRY_ORDER

    // Full day block
    if (fullDayBlocked) {
      decision.allow = false; decision.reason = 'Full day block active'; decision.playSound = true;
      logDiagnostic(url, method, body, classification, 'BLOCKED_FULL_DAY', false);
      return decision;
    }

    // Blocked symbol
    if (lockActive && body && isBlockedSymbol(body)) {
      decision.allow = false; decision.reason = 'Symbol is blocked'; decision.playSound = true;
      logDiagnostic(url, method, body, classification, 'BLOCKED_SYMBOL', false);
      return decision;
    }

    // Session hours
    if (lockActive && sessionBlocked) {
      decision.allow = false; decision.reason = 'Outside trading hours'; decision.playSound = true;
      logDiagnostic(url, method, body, classification, 'BLOCKED_SESSION', false);
      return decision;
    }

    // News block
    if (lockActive && newsBlockerEnabled && isNewsBlocked()) {
      decision.allow = false; decision.reason = 'News event window active'; decision.playSound = true;
      logDiagnostic(url, method, body, classification, 'BLOCKED_NEWS', false);
      return decision;
    }

    // Position size
    if (lockActive && body && isOversized(body)) {
      decision.allow = false; decision.reason = 'Position size exceeds limit'; decision.playSound = true;
      logDiagnostic(url, method, body, classification, 'BLOCKED_SIZE', false);
      return decision;
    }

    // Pyramiding/stacking
    if (lockActive && body && classification.action === 'INCREASE_POSITION' && !pyramidingEnabled) {
      decision.allow = false; decision.reason = 'Stacking blocked - already in position'; decision.playSound = true;
      logDiagnostic(url, method, body, classification, 'BLOCKED_STACKING', false);
      return decision;
    }

    // Tilt meter
    if (lockActive && window.__tiltMeter && window.__tiltMeter.shouldBlock()) {
      decision.allow = false; decision.reason = 'Tilt meter red - score ' + window.__tiltMeter.getScore(); decision.playSound = true;
      logDiagnostic(url, method, body, classification, 'BLOCKED_TILT', false);
      return decision;
    }

    // Psychology coach
    var coachResult = checkCoach(body);
    if (coachResult && coachResult.block) {
      decision.allow = false; decision.reason = coachResult.reason + ': ' + coachResult.message; decision.playSound = true;
      logDiagnostic(url, method, body, classification, 'BLOCKED_COACH', false);
      window.postMessage({ type: 'TRL_COACH_BLOCK', reason: coachResult.reason, message: coachResult.message }, '*');
      return decision;
    }

    // ─── ALL CHECKS PASSED: Allow the order ───────────────────────────────
    decision.allow = true;
    decision.reason = 'All rules passed';
    decision.requestReached = true;
    logDiagnostic(url, method, body, classification, 'ALLOWED', true);
    return decision;
  }
  // ─── Override XHR (uses unified evaluateTradingRequest) ──────────────────
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, url) { this._tgUrl = url; this._tgMethod = m; return origOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function(body) {
    var method = (this._tgMethod || 'GET').toUpperCase();
    if (isPostOrPut(method) && isOrderUrl(this._tgUrl)) {
      var parsed = null;
      if (typeof body === 'string') { try { parsed = JSON.parse(body); } catch(e) {} }

      // Skip modifications (SL/TP moves)
      if (isModifyOrCancel(this._tgUrl, parsed)) {
        return origSend.apply(this, arguments);
      }

      // Use unified evaluator
      var decision = evaluateTradingRequest(this._tgUrl, method, parsed);
      
      if (!decision.allow) {
        if (decision.playSound) playBlockSound();
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: decision.reason }, '*');
        return; // Block the XHR - don't call origSend
      }
      
      // Track the order for tilt meter
      var orderSize = parsed ? Math.abs(parsed.positionSize || parsed.qty || parsed.quantity || parsed.size || 0) : 0;
      if (decision.classification.action === 'OPEN_POSITION' || decision.classification.action === 'INCREASE_POSITION') {
        window.postMessage({ type: 'TRL_ORDER_PLACED', size: orderSize, symbol: decision.classification.symbol, direction: decision.classification.side }, '*');
      }
    }
    return origSend.apply(this, arguments);
  };

  // ─── P&L Tracking: Monitor incoming WebSocket messages for trade results ───
  // TopstepX sends trade results back through WebSocket.
  // We listen for messages containing P&L data to detect wins/losses.
  
  var origAddEventListener = WebSocket.prototype.addEventListener;
  var origOnMessageDescriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
  
  // Patch WebSocket to intercept incoming messages
  var _origWsConstructor = window.WebSocket;
  var patchedSockets = [];
  
  // Monitor all WebSocket instances for incoming trade results
  var origWsProtoOnmessage = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
  
  // Use a MutationObserver approach - periodically check for P&L changes in the DOM
  // This is more reliable than intercepting WebSocket since TopstepX's WS is already connected
  
  var lastKnownPnL = null;
  var pnlCheckInterval = setInterval(function() {
    // Always scan P&L even if coach is disabled - loss-reaction needs it
    
    // TopstepX specific: data-testid="realized-pnl-display-value-amount"
    var realizedPnl = document.querySelector('[data-testid="realized-pnl-display-value-amount"]');
    
    // Fallback selectors for other platforms
    if (!realizedPnl) realizedPnl = document.querySelector('[data-testid*="realized-pnl"]');
    if (!realizedPnl) realizedPnl = document.querySelector('[aria-label*="Realized Day P&L"]');
    if (!realizedPnl) realizedPnl = document.querySelector('[class*="realized-pnl"]');
    
    if (realizedPnl) {
      var pnlText = realizedPnl.textContent || '';
      // Match dollar amounts like $-3,998.48 or $500.00 or -$1,234.56
      var pnlMatch = pnlText.match(/\$\s*(-?[\d,]+\.?\d*)|(-[\d,]+\.?\d*)/);
      if (pnlMatch) {
        var numStr = (pnlMatch[1] || pnlMatch[2] || '0').replace(/,/g, '');
        var currentPnl = parseFloat(numStr);
        
        // Track high water mark
        if (currentPnl > highWaterMark) {
          highWaterMark = currentPnl;
        }
        
        // PROFIT LOCK: Check if hit profit target
        if (profitLockEnabled && profitLockThreshold > 0 && currentPnl >= profitLockThreshold && !profitLocked) {
          profitLocked = true;
          console.log('[TradingGuardian] PROFIT TARGET HIT: $' + currentPnl.toFixed(2) + ' >= $' + profitLockThreshold);
          window.postMessage({ type: 'TRL_COACH_BLOCK', reason: 'PROFIT PROTECTED', message: 'You hit your profit target of $' + profitLockThreshold + '. Your green day is locked in. Walk away a winner.' }, '*');
        }
        
        // DRAWDOWN FROM HIGH: If P&L drops too much from peak
        if (profitLockEnabled && highWaterMark > 0 && (highWaterMark - currentPnl) >= drawdownFromHigh && !profitLocked) {
          profitLocked = true;
          console.log('[TradingGuardian] DRAWDOWN FROM HIGH: Peak $' + highWaterMark.toFixed(2) + ', Now $' + currentPnl.toFixed(2) + ', Gave back $' + (highWaterMark - currentPnl).toFixed(2));
          window.postMessage({ type: 'TRL_COACH_BLOCK', reason: 'GIVING IT BACK', message: 'You were up $' + highWaterMark.toFixed(0) + ' and gave back $' + (highWaterMark - currentPnl).toFixed(0) + '. Protecting what is left. Session over.' }, '*');
        }
        
        if (lastKnownPnL !== null && currentPnl < lastKnownPnL) {
          // P&L dropped = loss detected
          var lossAmount = lastKnownPnL - currentPnl;
          var now = Date.now();
          
          // Only count as a real loss if:
          // 1. Drop is at least $10 (ignore fees/spread ticks)
          // 2. At least 60 seconds since last loss detection (separate trades)
          // 3. Not during a position close (P&L can drop when closing a loser)
          if (lossAmount >= 10 && (now - lastLossDetectedTime) > 60000 && (now - lastCloseOrderTime) > 30000) {
            lastLossDetectedTime = now;
            console.log('[Sentinel PnL] Loss detected: -$' + lossAmount.toFixed(2) + ' (Total P&L: $' + currentPnl.toFixed(2) + ', Previous: $' + lastKnownPnL.toFixed(2) + ', ConsecLosses: ' + (consecutiveLosses + 1) + ', Time: ' + new Date().toISOString() + ')');
            
            // Post trade result so loss-reaction.js can trigger
            window.postMessage({ type: 'TRL_TRADE_RESULT', result: 'loss', pnl: -lossAmount }, '*');
            
            if (coachEnabled) {
              lastLossTime = Date.now();
              cooldownActive = true;
              var escalatedCooldown = escalatingCooldown 
                ? cooldownSeconds * Math.pow(2, Math.min(consecutiveLosses - 1, 3))
                : cooldownSeconds;
              cooldownUntil = Date.now() + (escalatedCooldown * 1000);
            }
            totalDailyPnL = currentPnl;
            
            // Check daily loss limit
            if (coachEnabled && maxDailyLoss > 0 && Math.abs(currentPnl) >= maxDailyLoss && currentPnl < 0) {
              dailyLossBlocked = true;
              console.log('[TradingGuardian] DAILY LOSS LIMIT HIT: $' + currentPnl.toFixed(2));
              window.postMessage({ type: 'TRL_COACH_BLOCK', reason: 'DAILY LOSS REACHED', message: 'You have reached your maximum daily loss ($' + Math.abs(currentPnl).toFixed(2) + '). Protecting your capital is the priority. Step away and reset for tomorrow.' }, '*');
            }
          
            window.postMessage({ type: 'TRL_LOSS_DETECTED', amount: lossAmount, totalPnl: currentPnl }, '*');
          }
        } else if (lastKnownPnL !== null && currentPnl > lastKnownPnL) {
          // P&L went up = win detected
          var winAmount = currentPnl - lastKnownPnL;
          // Only count as real win if at least $10 (ignore small ticks)
          if (winAmount >= 10) {
            console.log('[Sentinel PnL] Win detected: +$' + winAmount.toFixed(2) + ' (Total P&L: $' + currentPnl.toFixed(2) + ', ConsecLosses was: ' + consecutiveLosses + ', Time: ' + new Date().toISOString() + ')');
            window.postMessage({ type: 'TRL_TRADE_RESULT', result: 'win', pnl: winAmount }, '*');
            consecutiveLosses = 0;
          }
        }
        
        lastKnownPnL = currentPnl;
      }
    }
  }, 2000); // Check every 2 seconds

  // ─── Trade Fill Logger ─────────────────────────────────────────────────────
  // Tracks individual trades for the analytics dashboard
  var openTrades = {}; // { symbol: { entryTime, size, direction, entryPnL } }
  var tradeIdCounter = 0;

  // When an order is placed successfully, log the entry
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_ORDER_PLACED' && event.data.size > 0) {
      // An order went through - log as trade entry
      // We know symbol + size from the last order body we parsed
      var symbol = event.data.symbol || lastOrderSymbol || 'UNKNOWN';
      var size = event.data.size || 1;
      var direction = event.data.direction || lastOrderDirection || 'Long';
      
      if (!openTrades[symbol]) {
        openTrades[symbol] = {
          entryTime: new Date().toISOString(),
          size: size,
          direction: direction,
          entryPnL: lastKnownPnL || 0,
          id: ++tradeIdCounter,
        };
      }
    }

    // When a trade result comes in (win/loss), calculate and send to desktop
    if (event.data && event.data.type === 'TRL_TRADE_RESULT') {
      var pnl = event.data.pnl || 0;
      var result = event.data.result || (pnl >= 0 ? 'win' : 'loss');
      
      // Find the open trade to close
      var closedSymbol = lastOrderSymbol || Object.keys(openTrades)[0] || 'UNKNOWN';
      var openTrade = openTrades[closedSymbol];
      var entryTime = openTrade ? openTrade.entryTime : new Date(Date.now() - 60000).toISOString();
      var size = openTrade ? openTrade.size : 1;
      var direction = openTrade ? openTrade.direction : 'Long';
      
      var tradeFill = {
        type: 'trade_fill',
        symbol: closedSymbol,
        size: size,
        direction: direction,
        entryTime: entryTime,
        exitTime: new Date().toISOString(),
        pnl: pnl,
        result: result,
      };

      // Send to desktop app via bridge
      window.postMessage({ type: 'TRL_TRADE_FILL', ...tradeFill }, '*');
      
      // Clear the open trade
      if (openTrades[closedSymbol]) {
        delete openTrades[closedSymbol];
      }
    }
  });

  // Track last order details for logging
  var lastOrderSymbol = '';
  var lastOrderDirection = 'Long';

  // Also monitor fetch responses for order fills
  var origFetchForPnL = window.fetch;
  window.fetch = (function(previousFetch) {
    return function() {
      var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url ? arguments[0].url : '');
      var result = previousFetch.apply(this, arguments);
      
      // Monitor responses from order/events endpoints for fill data
      if (url.includes('Events') || url.includes('OrderData') || url.includes('Position')) {
        result.then(function(response) {
          return response.clone().text().then(function(text) {
            try {
              var data = JSON.parse(text);
              // Look for filled orders with P&L info
              if (data && (data.realizedPnl !== undefined || data.pnl !== undefined || data.profit !== undefined)) {
                var pnl = data.realizedPnl || data.pnl || data.profit || 0;
                if (pnl < 0) {
                  console.log('[TradingGuardian] Loss from API: $' + pnl);
                  if (coachEnabled) {
                    lastLossTime = Date.now();
                    cooldownActive = true;
                    cooldownUntil = Date.now() + (cooldownSeconds * 1000);
                  }
                  totalDailyPnL += pnl;
                  if (coachEnabled && maxDailyLoss > 0 && totalDailyPnL <= -maxDailyLoss) {
                    dailyLossBlocked = true;
                    window.postMessage({ type: 'TRL_COACH_BLOCK', reason: 'DAILY LOSS REACHED', message: 'You have reached your maximum daily loss. Protecting your capital is the priority.' }, '*');
                  }
                }
              }
            } catch(e) {}
          });
        }).catch(function() {});
      }
      
      return result;
    };
  })(window.fetch);

  // ─── Dev Mode Console Commands (DEV BUILD ONLY) ────────────────────────────
  // In production builds, IS_DEV_BUILD = false and these are never exposed
  if (IS_DEV_BUILD) {
    window.__sentinel = {
      enableDiagnostics: function() { diagnosticEnabled = true; console.warn('[Sentinel Diagnostics] ⚠ ENABLED. Use paper trading only. No sensitive data is logged.'); },
      disableDiagnostics: function() { diagnosticEnabled = false; console.log('[Sentinel Diagnostics] DISABLED.'); },
      getDiagnostics: function() { return JSON.parse(JSON.stringify(diagnosticLog)); },
      exportDiagnostics: function() {
        try {
          var json = JSON.stringify(diagnosticLog, null, 2);
          var blob = new Blob([json], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = 'sentinel-diagnostics-' + new Date().toISOString().split('T')[0] + '.json';
          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
          console.log('[Sentinel Diagnostics] Exported ' + diagnosticLog.length + ' entries.');
        } catch(e) { console.error('[Sentinel Diagnostics] Export failed:', e.message); }
      },
      copyDiagnostics: function() {
        try {
          var json = JSON.stringify(diagnosticLog, null, 2);
          navigator.clipboard.writeText(json).then(function() { console.log('[Sentinel Diagnostics] Copied ' + diagnosticLog.length + ' entries to clipboard.'); });
        } catch(e) { console.error('[Sentinel Diagnostics] Copy failed:', e.message); }
      },
      clearDiagnostics: function() { diagnosticLog = []; diagnosticEventId = 0; console.log('[Sentinel Diagnostics] Cleared.'); },
      getClassification: function(url, body) { return classifyOrder(url, body); },
      getProtectionStatus: function() { return getProtectionStatus(); },
      getPositionState: function() { return JSON.parse(JSON.stringify(positionState)); },
    };
    console.log('[Sentinel] Dev commands available: __sentinel.enableDiagnostics() / .exportDiagnostics() / .copyDiagnostics() / .clearDiagnostics() / .getProtectionStatus()');
  }

  console.log('[Sentinel] Order interceptor loaded. Exit safety: ON. Position tracking: ' + POSITION_SOURCE + ' (' + POSITION_CONFIDENCE + ').');
})();
