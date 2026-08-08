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

  // ═══════════════════════════════════════════════════════════════════════════
  // INJECTION GUARD: Prevent double-injection on SPA navigation or re-injection.
  // If this script runs again (extension reload, SPA soft nav), skip entirely.
  // There must always be EXACTLY ONE effective enforcement layer.
  // ═══════════════════════════════════════════════════════════════════════════
  if (window.__sentinelInterceptorActive === true) {
    console.log('[Sentinel] Interceptor already active — skipping duplicate injection.');
    return;
  }
  window.__sentinelInterceptorActive = true;

  var sessionBlocked = false; // Start unblocked — only block when we KNOW session is blocked
  var fullDayBlocked = false; // Pre-market check blocked for the day
  var lockActive = false; // Only enforce limits when locked
  var sessionEnded = false; // SESSION_ENDED: blocks new entries, allows exits
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

  // Sound on block (opt-in: off by default)
  var soundOnBlock = false;

  // FOMO / Late Entry Protection
  var fomoEnabled = false;
  var fomoMode = 'warn'; // observe | warn | confirm | reduce | block
  var fomoMaxEntriesPerWindow = 3;
  var fomoWindowMinutes = 5;
  var fomoMinSecondsBetween = 30;
  var fomoBlockFirstMinutes = 0;
  var fomoEntryTimestamps = []; // timestamps of recent entries
  var fomoSessionStartTime = Date.now(); // when lock was activated
  var fomoReducedUntil = 0; // timestamp when FOMO reduce expires (0 = not active)
  var fomoTemporaryMax = 0; // temporary max size during FOMO reduce (0 = not active)

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
      sessionEnded = event.data.sessionEnded === true;
      // Expose lock state globally for WebSocket interceptor
      window.__sentinelLockActive = lockActive;
      window.__sentinelSessionEnded = sessionEnded;
      window.__sentinelSessionBlocked = sessionBlocked;
      window.__sentinelFullDayBlocked = fullDayBlocked;
      window.__sentinelBlockedSymbols = blockedSymbols;
      window.__sentinelGetMax = getMaxForSymbol;
      window.__sentinelNewsBlocked = isNewsBlocked;
      if (lockActive) {
        fomoSessionStartTime = Date.now(); // Track when session started for FOMO first-minutes rule
        resetBehavioralStateEngine(); // New session → fresh state tracking
      }
      if (!lockActive) {
        // Compute session summary before clearing state
        if (sessionId && stateTransitionHistory.length > 0) {
          var summary = getSessionBehaviorSummary();
          window.postMessage({ type: 'TRL_SESSION_SUMMARY', ...summary }, '*');
        }
        // Clear all enforcement when unlocked
        sessionEnded = false;
        cooldownActive = false;
        dailyLossBlocked = false;
        profitLocked = false;
        fullDayBlocked = false;
        currentOpenPositions = {}; // Reset position tracking
        consecutiveWins = 0;
        winStreakTriggered = false;
        fomoEntryTimestamps = []; // Reset FOMO tracking
      }
      recalculateBehavioralState('lock_state_change');
    }
    if (event.data && event.data.type === 'TRL_FULL_BLOCK') {
      fullDayBlocked = true;
      recalculateBehavioralState('full_day_block');
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
      sessionEnded = false;
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
    if (event.data && event.data.type === 'TRL_SOUND_CONFIG') {
      soundOnBlock = event.data.soundOnBlock === true;
      window.__sentinelSoundOnBlock = soundOnBlock;
    }
    if (event.data && event.data.type === 'TRL_FOMO_CONFIG') {
      fomoEnabled = event.data.fomoEnabled === true;
      fomoMode = event.data.fomoMode || 'warn';
      fomoMaxEntriesPerWindow = event.data.fomoMaxEntriesPerWindow || 3;
      fomoWindowMinutes = event.data.fomoWindowMinutes || 5;
      fomoMinSecondsBetween = event.data.fomoMinSecondsBetween || 30;
      fomoBlockFirstMinutes = event.data.fomoBlockFirstMinutes || 0;
    }
    // ─── Certification Mode: State Injection ──────────────────────────────────
    if (event.data && event.data.type === 'TRL_CERT_INJECT') {
      var inject = event.data.inject;
      var val = event.data.value;
      if (inject === 'max_contracts') { positionLimits.defaultMax = val; }
      else if (inject === 'trade_limit_reached') { maxTradesPerDay = 1; trades = [{timestamp: Date.now()}, {timestamp: Date.now()}]; }
      else if (inject === 'daily_loss_reached') { dailyLossBlocked = true; recalculateBehavioralState('cert_inject_daily_loss'); }
      else if (inject === 'fomo_config') {
        fomoEnabled = val.fomoEnabled; fomoMode = val.fomoMode;
        fomoMaxEntriesPerWindow = val.fomoMaxEntriesPerWindow; fomoWindowMinutes = val.fomoWindowMinutes;
        fomoMinSecondsBetween = val.fomoMinSecondsBetween; fomoBlockFirstMinutes = val.fomoBlockFirstMinutes;
      }
      else if (inject === 'clear_all') {
        // Reset all injected states
        dailyLossBlocked = false; trades = []; fomoEnabled = false;
        recalculateBehavioralState('cert_inject_cleared');
      }
      console.log('[Sentinel CERT] Injected:', inject, val);
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
        totalTradeCount++;
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
        recalculateBehavioralState('trade_loss_' + consecutiveLosses);
      } else if (event.data.result === 'win') {
        consecutiveLosses = 0;
        consecutiveWins++;
        totalTradeCount++;
        
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
        recalculateBehavioralState('trade_win_' + consecutiveWins);
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

  /**
   * getEffectiveMaxSize — Centralized function composing ALL temporary caps.
   * Always returns the LOWEST active restriction. Never mutates baseline.
   * Layered: plan max → loss streak → FOMO reduce → (future: readiness)
   */
  function getEffectiveMaxSize(symbol) {
    // Layer 1: Base plan max (from position limits config)
    var max = getMaxForSymbol(symbol);

    // Layer 2: Loss streak reduction (if active and lower)
    if (lossStreakEnabled && currentMaxSize > 0 && currentMaxSize < max) {
      max = currentMaxSize;
    }

    // Layer 3: FOMO reduce temporary cap (if active and lower)
    if (fomoReducedUntil > 0 && Date.now() < fomoReducedUntil && fomoTemporaryMax > 0 && fomoTemporaryMax < max) {
      max = fomoTemporaryMax;
    }

    // Layer 4: Win streak reduction (already folded into currentMaxSize above)
    // (Win streak modifies currentMaxSize which is checked in Layer 2)

    // Final: never below 1 (always allow at least 1 contract for exits)
    return Math.max(1, max);
  }

  function isOversized(body) {
    if (!body) return false;
    var size = body.positionSize || body.qty || body.quantity || body.amount || body.size || 0;
    size = Math.abs(size); // Handle negative values for sell/short orders
    if (!size || size <= 0) return false;
    var symbol = (body.symbolId || body.symbol || body.instrument || '').toUpperCase();
    var max = getEffectiveMaxSize(symbol);
    
    // Only block if single order exceeds max (not cumulative)
    return size > max;
  }

  // ─── FOMO / Late Entry Check ────────────────────────────────────────────────
  // Returns: null (no issue), or { triggered: true, reason: string }
  function checkFomo() {
    if (!fomoEnabled || !lockActive) return null;
    var now = Date.now();

    // Rule 1: Block entries in first N minutes of session
    if (fomoBlockFirstMinutes > 0) {
      var sessionElapsed = (now - fomoSessionStartTime) / 60000; // minutes
      if (sessionElapsed < fomoBlockFirstMinutes) {
        return { triggered: true, reason: 'FOMO: Wait ' + Math.ceil(fomoBlockFirstMinutes - sessionElapsed) + ' more minutes before first entry (first ' + fomoBlockFirstMinutes + 'min rule)' };
      }
    }

    // Rule 2: Min seconds between entries
    if (fomoMinSecondsBetween > 0 && fomoEntryTimestamps.length > 0) {
      var lastEntry = fomoEntryTimestamps[fomoEntryTimestamps.length - 1];
      var elapsed = (now - lastEntry) / 1000;
      if (elapsed < fomoMinSecondsBetween) {
        return { triggered: true, reason: 'FOMO: Only ' + Math.floor(elapsed) + 's since last entry (min ' + fomoMinSecondsBetween + 's rule)' };
      }
    }

    // Rule 3: Max entries per time window
    if (fomoMaxEntriesPerWindow > 0 && fomoWindowMinutes > 0) {
      var windowStart = now - (fomoWindowMinutes * 60000);
      var entriesInWindow = fomoEntryTimestamps.filter(function(t) { return t > windowStart; }).length;
      if (entriesInWindow >= fomoMaxEntriesPerWindow) {
        return { triggered: true, reason: 'FOMO: ' + entriesInWindow + ' entries in last ' + fomoWindowMinutes + ' minutes (max ' + fomoMaxEntriesPerWindow + ' rule)' };
      }
    }

    return null;
  }

  // Record an entry for FOMO tracking (called when order passes all checks)
  function recordFomoEntry() {
    var now = Date.now();
    fomoEntryTimestamps.push(now);
    // Keep last 30 minutes of entries
    var cutoff = now - 1800000;
    fomoEntryTimestamps = fomoEntryTimestamps.filter(function(t) { return t > cutoff; });
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
  var sentinelFetchMarker = '__sentinel_fetch_' + Date.now();
  var interceptedFetch = function() {
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

      // ═══ CERTIFICATION DIAGNOSTIC — emit for Platform Certification Mode ═══
      window.postMessage({ type: 'TRL_CERT_DIAGNOSTIC',
        platform: window.location.hostname,
        endpoint: url.replace(/https?:\/\/[^/]+/, '').split('?')[0],
        method: method,
        detectedAction: decision.classification.action,
        detectedSide: decision.classification.side,
        detectedSymbol: decision.classification.symbol,
        detectedQuantity: decision.classification.quantity,
        classifierConfidence: decision.classification.confidence,
        decision: decision.allow ? 'ALLOWED' : 'BLOCKED',
        reason: decision.reason,
        timestamp: new Date().toISOString(),
      }, '*');
      
      if (!decision.allow) {
        if (decision.playSound && soundOnBlock) playBlockSound();
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: decision.reason, priority: decision.priority }, '*');
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
  interceptedFetch._sentinelMarker = sentinelFetchMarker;
  window.fetch = interceptedFetch;

  /**
   * evaluateTradingRequest - Single decision point for ALL trading requests
   * @param {string} url - The request URL
   * @param {string} method - HTTP method
   * @param {object|null} body - Parsed request body
   * @returns {{ allow: boolean, reason: string, classification: object, playSound: boolean, priority: string }}
   *
   * Priority levels:
   *   LOW      — silently logged (allowed orders, queries)
   *   MEDIUM   — small non-blocking toast (coach warnings, passive notifications)
   *   HIGH     — persistent warning (coach blocks: daily loss, profit lock, trade limit, cooldown)
   *   CRITICAL — full block overlay (hard blocks: session, full-day, symbol, size, stacking, tilt, news)
   *
   * STATE PRECEDENCE (first match wins, only one overlay/action per order):
   *   1. EXIT_SAFETY      — CLOSE/REDUCE/CANCEL/MODIFY/QUERY always allowed (no check needed)
   *   2. SESSION_ENDED    — blocks ALL new/increase (user ended session voluntarily)
   *   3. FULL_DAY_BLOCK   — 24h hard lockout (kill switch / pre-market check)
   *   4. BLOCKED_SYMBOL   — instrument restriction
   *   5. SESSION_HOURS    — outside trading window
   *   6. NEWS_BLOCKER     — economic event window
   *   7. POSITION_SIZE    — exceeds max contracts (includes loss-streak + FOMO reduce caps)
   *   8. STACKING         — pyramiding disabled
   *   9. TILT_METER       — behavioral score ≥ 61
   *  10. COACH            — daily loss / profit lock / trade limit / cooldown
   *  11. FOMO             — rapid entry detection (user-defined rules)
   *  12. NORMAL           — all rules passed, order allowed
   */
  function evaluateTradingRequest(url, method, body) {
    var classification = classifyOrder(url, body);
    var decision = { allow: true, reason: '', classification: classification, playSound: false, requestReached: false, priority: 'LOW' };

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

    // ─── SESSION_ENDED: Block all new/increase exposure ─────────────────────
    if (sessionEnded) {
      decision.allow = false;
      decision.reason = 'Session ended — new entries blocked until lock expires. Exits allowed.';
      decision.playSound = true; decision.priority = 'HIGH';
      logDiagnostic(url, method, body, classification, 'BLOCKED_SESSION_ENDED', false);
      window.postMessage({ type: 'TRL_COACH_BLOCK', reason: 'SESSION ENDED', message: 'You ended your session. New entries blocked until your lock expires. Close/reduce/cancel still allowed.', priority: 'HIGH' }, '*');
      return decision;
    }

    // ─── REVERSAL: Evaluate the new-risk portion against rules ─────────────
    if (classification.action === 'REVERSE_POSITION') {
      // The close portion is always safe. Check if the NEW exposure violates rules.
      var newRiskQty = classification.newRiskQuantity || 0;
      var symbol = classification.symbol;
      
      // Check new-risk portion against max contracts (uses ALL active caps)
      if (lockActive && newRiskQty > 0 && symbol) {
        var max = getEffectiveMaxSize(symbol);
        if (newRiskQty > max) {
          decision.allow = false;
          decision.reason = 'Reversal blocked: new exposure ' + newRiskQty + ' exceeds effective max ' + max + ' for ' + symbol;
          decision.playSound = true; decision.priority = 'CRITICAL';
          logDiagnostic(url, method, body, classification, 'BLOCKED_REVERSAL_SIZE', false);
          return decision;
        }
      }
      // Check other rules against the new-risk portion
      if (lockActive && symbol && isBlockedSymbol(body)) {
        decision.allow = false;
        decision.reason = 'Reversal blocked: ' + symbol + ' is a blocked symbol';
        decision.playSound = true; decision.priority = 'CRITICAL';
        logDiagnostic(url, method, body, classification, 'BLOCKED_REVERSAL_SYMBOL', false);
        return decision;
      }
      if (lockActive && sessionBlocked) {
        decision.allow = false;
        decision.reason = 'Reversal blocked: outside session hours';
        decision.playSound = true; decision.priority = 'CRITICAL';
        logDiagnostic(url, method, body, classification, 'BLOCKED_REVERSAL_SESSION', false);
        return decision;
      }
      if (lockActive && newsBlockerEnabled && isNewsBlocked()) {
        decision.allow = false;
        decision.reason = 'Reversal blocked: news event window';
        decision.playSound = true; decision.priority = 'CRITICAL';
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
      decision.allow = false; decision.reason = 'Full day block active'; decision.playSound = true; decision.priority = 'CRITICAL';
      logDiagnostic(url, method, body, classification, 'BLOCKED_FULL_DAY', false);
      return decision;
    }

    // Blocked symbol
    if (lockActive && body && isBlockedSymbol(body)) {
      decision.allow = false; decision.reason = 'Symbol is blocked'; decision.playSound = true; decision.priority = 'CRITICAL';
      logDiagnostic(url, method, body, classification, 'BLOCKED_SYMBOL', false);
      return decision;
    }

    // Session hours
    if (lockActive && sessionBlocked) {
      decision.allow = false; decision.reason = 'Outside trading hours'; decision.playSound = true; decision.priority = 'CRITICAL';
      logDiagnostic(url, method, body, classification, 'BLOCKED_SESSION', false);
      return decision;
    }

    // News block
    if (lockActive && newsBlockerEnabled && isNewsBlocked()) {
      decision.allow = false; decision.reason = 'News event window active'; decision.playSound = true; decision.priority = 'CRITICAL';
      logDiagnostic(url, method, body, classification, 'BLOCKED_NEWS', false);
      return decision;
    }

    // Position size
    if (lockActive && body && isOversized(body)) {
      decision.allow = false; decision.reason = 'Position size exceeds limit'; decision.playSound = true; decision.priority = 'CRITICAL';
      logDiagnostic(url, method, body, classification, 'BLOCKED_SIZE', false);
      return decision;
    }

    // Pyramiding/stacking
    if (lockActive && body && classification.action === 'INCREASE_POSITION' && !pyramidingEnabled) {
      decision.allow = false; decision.reason = 'Stacking blocked - already in position'; decision.playSound = true; decision.priority = 'CRITICAL';
      logDiagnostic(url, method, body, classification, 'BLOCKED_STACKING', false);
      return decision;
    }

    // Tilt meter
    if (lockActive && window.__tiltMeter && window.__tiltMeter.shouldBlock()) {
      decision.allow = false; decision.reason = 'Tilt meter red - score ' + window.__tiltMeter.getScore(); decision.playSound = true; decision.priority = 'CRITICAL';
      logDiagnostic(url, method, body, classification, 'BLOCKED_TILT', false);
      return decision;
    }

    // Psychology coach
    var coachResult = checkCoach(body);
    if (coachResult && coachResult.block) {
      decision.allow = false; decision.reason = coachResult.reason + ': ' + coachResult.message; decision.playSound = true; decision.priority = 'HIGH';
      logDiagnostic(url, method, body, classification, 'BLOCKED_COACH', false);
      window.postMessage({ type: 'TRL_COACH_BLOCK', reason: coachResult.reason, message: coachResult.message, priority: 'HIGH' }, '*');
      return decision;
    }

    // FOMO / Late Entry Protection
    var fomoResult = checkFomo();
    if (fomoResult && fomoResult.triggered) {
      if (fomoMode === 'block') {
        decision.allow = false; decision.reason = fomoResult.reason; decision.playSound = true; decision.priority = 'HIGH';
        logDiagnostic(url, method, body, classification, 'BLOCKED_FOMO', false);
        window.postMessage({ type: 'TRL_COACH_BLOCK', reason: 'FOMO DETECTED', message: fomoResult.reason, priority: 'HIGH' }, '*');
        return decision;
      } else if (fomoMode === 'warn') {
        // Allow but warn
        window.postMessage({ type: 'TRL_COACH_WARN', reason: 'FOMO DETECTED', message: fomoResult.reason }, '*');
        logDiagnostic(url, method, body, classification, 'FOMO_WARN', true);
      } else if (fomoMode === 'reduce') {
        // Temporarily halve max size for the configured window duration
        var symbol = classification.symbol;
        var currentMax = getEffectiveMaxSize(symbol);
        fomoTemporaryMax = Math.max(1, Math.floor(currentMax / 2));
        fomoReducedUntil = Date.now() + (fomoWindowMinutes * 60000);
        window.postMessage({ type: 'TRL_COACH_WARN', reason: 'FOMO: SIZE REDUCED', message: fomoResult.reason + ' — Max size temporarily reduced to ' + fomoTemporaryMax + ' for ' + fomoWindowMinutes + ' min.' }, '*');
        logDiagnostic(url, method, body, classification, 'FOMO_REDUCE', true);
        recalculateBehavioralState('fomo_reduce_triggered');
        // Re-check size with reduced cap — if current order exceeds it, block
        if (body && isOversized(body)) {
          decision.allow = false; decision.reason = 'FOMO reduce: size ' + classification.quantity + ' exceeds temporary max ' + fomoTemporaryMax; decision.playSound = true; decision.priority = 'HIGH';
          logDiagnostic(url, method, body, classification, 'BLOCKED_FOMO_REDUCE', false);
          return decision;
        }
      } else if (fomoMode === 'observe') {
        // Log only
        logDiagnostic(url, method, body, classification, 'FOMO_OBSERVED', true);
      }
    }

    // ─── ALL CHECKS PASSED: Allow the order ───────────────────────────────
    decision.allow = true;
    decision.reason = 'All rules passed';
    decision.requestReached = true;
    // Track for FOMO (only risk-increasing orders count)
    if (classification.action === 'OPEN_POSITION' || classification.action === 'INCREASE_POSITION') {
      recordFomoEntry();
    }
    logDiagnostic(url, method, body, classification, 'ALLOWED', true);
    return decision;
  }
  // ─── Override XHR (uses unified evaluateTradingRequest) ──────────────────
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  var sentinelXhrMarker = '__sentinel_xhr_' + Date.now();
  XMLHttpRequest.prototype.open = function(m, url) { this._tgUrl = url; this._tgMethod = m; return origOpen.apply(this, arguments); };
  var interceptedSend = function(body) {
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
        if (decision.playSound && soundOnBlock) playBlockSound();
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: decision.reason, priority: decision.priority }, '*');
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
  interceptedSend._sentinelMarker = sentinelXhrMarker;
  XMLHttpRequest.prototype.send = interceptedSend;

  // ═══════════════════════════════════════════════════════════════════════════
  // OVERRIDE INTEGRITY CHECKER — Self-healing tamper detection
  // Verifies fetch/XHR overrides are intact every 3 seconds.
  // If removed: re-applies them and reports the tamper attempt.
  // ═══════════════════════════════════════════════════════════════════════════
  var tamperDetected = 0;
  var TAMPER_CHECK_INTERVAL = 3000;

  function checkOverrideIntegrity() {
    if (!lockActive) return; // Only enforce when locked

    var tampered = false;

    // Check fetch override
    if (!window.fetch || !window.fetch._sentinelMarker || window.fetch._sentinelMarker !== sentinelFetchMarker) {
      tampered = true;
      window.fetch = interceptedFetch;
      console.warn('[Sentinel] TAMPER DETECTED: window.fetch was reassigned. Override restored.');
    }

    // Check XHR send override
    if (!XMLHttpRequest.prototype.send || !XMLHttpRequest.prototype.send._sentinelMarker || XMLHttpRequest.prototype.send._sentinelMarker !== sentinelXhrMarker) {
      tampered = true;
      XMLHttpRequest.prototype.send = interceptedSend;
      console.warn('[Sentinel] TAMPER DETECTED: XMLHttpRequest.prototype.send was reassigned. Override restored.');
    }

    // Check XHR open override (verify our wrapped version is still in place)
    if (XMLHttpRequest.prototype.open === origOpen) {
      tampered = true;
      var wrappedOpen = function(m, url) { this._tgUrl = url; this._tgMethod = m; return origOpen.apply(this, arguments); };
      wrappedOpen._sentinelMarker = sentinelXhrMarker;
      XMLHttpRequest.prototype.open = wrappedOpen;
      console.warn('[Sentinel] TAMPER DETECTED: XMLHttpRequest.prototype.open was restored. Override re-applied.');
    }

    if (tampered) {
      tamperDetected++;
      window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'TAMPER DETECTED: Order interceptors were removed. Protection restored. Attempt #' + tamperDetected, priority: 'CRITICAL' }, '*');
      window.postMessage({ type: 'TRL_DIAGNOSTIC_LOG', entry: { type: 'tamper_detected', count: tamperDetected, timestamp: Date.now() } }, '*');
    }
  }

  setInterval(checkOverrideIntegrity, TAMPER_CHECK_INTERVAL);

  // ═══════════════════════════════════════════════════════════════════════════
  // BEHAVIORAL STATE ENGINE — Event-driven with 5s fallback reconciliation
  // States: NORMAL → CAUTION → ELEVATED → HIGH_RISK → LOCKDOWN
  // Recalculates IMMEDIATELY on meaningful events, 5s interval as safety net.
  // ═══════════════════════════════════════════════════════════════════════════
  var currentBehavioralState = 'NORMAL';
  var lastTransitionTime = 0;
  var TRANSITION_DEDUP_MS = 3000; // Reduced from 10s to 3s to catch rapid transitions
  var sessionId = ''; // Set on lock activation, used for grouping transitions
  var stateTransitionHistory = []; // In-memory log for session summary
  var stateTimeTracking = { NORMAL: 0, CAUTION: 0, ELEVATED: 0, HIGH_RISK: 0, LOCKDOWN: 0 };
  var lastStateChangeTime = Date.now();
  var lastStateChangeMonotonic = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  var peakState = 'NORMAL';
  var escalationCount = 0;
  var recoveryCount = 0;
  var worstTrigger = '';
  var firstEscalationTime = null;
  var totalTradeCount = 0;
  var STATE_LEVELS = { NORMAL: 0, CAUTION: 1, ELEVATED: 2, HIGH_RISK: 3, LOCKDOWN: 4 };

  function generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  function deriveBehavioralState() {
    if (sessionEnded || fullDayBlocked || dailyLossBlocked) return 'LOCKDOWN';
    var tiltScore = (window.__tiltMeter && window.__tiltMeter.getScore) ? window.__tiltMeter.getScore() : 0;
    if (tiltScore >= 61 || profitLocked) return 'HIGH_RISK';
    if (tiltScore >= 41 || cooldownActive) return 'ELEVATED';
    if (tiltScore >= 21 || consecutiveLosses >= 2) return 'CAUTION';
    return 'NORMAL';
  }

  function getTransitionReason(newState, triggeringEvent) {
    var tiltScore = (window.__tiltMeter && window.__tiltMeter.getScore) ? window.__tiltMeter.getScore() : 0;
    if (newState === 'LOCKDOWN') {
      if (sessionEnded) return 'session ended by trader';
      if (fullDayBlocked) return 'full day block active';
      if (dailyLossBlocked) return 'daily loss limit hit';
    } else if (newState === 'HIGH_RISK') {
      if (tiltScore >= 61) return 'tilt meter red (score ' + tiltScore + ')';
      if (profitLocked) return 'profit lock triggered';
    } else if (newState === 'ELEVATED') {
      if (cooldownActive) return 'cooldown after loss';
      return 'tilt rising (score ' + tiltScore + ')';
    } else if (newState === 'CAUTION') {
      if (consecutiveLosses >= 2) return consecutiveLosses + ' consecutive losses';
      return 'tilt increasing (score ' + tiltScore + ')';
    } else if (newState === 'NORMAL') {
      return 'risk reduced — behavior stabilized';
    }
    return triggeringEvent || 'state change';
  }

  /**
   * recalculateBehavioralState — Called on every meaningful event + 5s fallback.
   * @param {string} triggeringEvent — describes what triggered this recalculation
   */
  function recalculateBehavioralState(triggeringEvent) {
    if (!lockActive) {
      if (currentBehavioralState !== 'NORMAL') {
        currentBehavioralState = 'NORMAL';
      }
      return;
    }

    var newState = deriveBehavioralState();
    if (newState === currentBehavioralState) return;

    var now = Date.now();
    if ((now - lastTransitionTime) < TRANSITION_DEDUP_MS && newState === currentBehavioralState) return;

    // Track time spent in previous state using monotonic clock (immune to clock jumps)
    var monoNow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : now;
    var timeInPrevState = monoNow - lastStateChangeMonotonic;
    // Sanity check: reject impossible durations (> 24h or negative = clock jump)
    if (timeInPrevState < 0 || timeInPrevState > 86400000) timeInPrevState = 0;
    stateTimeTracking[currentBehavioralState] = (stateTimeTracking[currentBehavioralState] || 0) + timeInPrevState;
    lastStateChangeTime = now;
    lastStateChangeMonotonic = monoNow;

    // Track escalation vs recovery
    var isEscalation = STATE_LEVELS[newState] > STATE_LEVELS[currentBehavioralState];
    var isRecovery = STATE_LEVELS[newState] < STATE_LEVELS[currentBehavioralState];
    if (isEscalation) {
      escalationCount++;
      if (!firstEscalationTime) firstEscalationTime = now;
    }
    if (isRecovery) recoveryCount++;

    // Track peak state
    if (STATE_LEVELS[newState] > STATE_LEVELS[peakState]) {
      peakState = newState;
      worstTrigger = triggeringEvent || getTransitionReason(newState, triggeringEvent);
    }

    lastTransitionTime = now;
    var reason = getTransitionReason(newState, triggeringEvent);
    var tiltScore = (window.__tiltMeter && window.__tiltMeter.getScore) ? window.__tiltMeter.getScore() : 0;

    var transition = {
      sessionId: sessionId,
      from: currentBehavioralState,
      to: newState,
      reason: reason,
      triggeringEvent: triggeringEvent || 'unknown',
      timestamp: new Date().toISOString(),
      tiltScore: tiltScore,
      consecutiveLosses: consecutiveLosses,
      tradeCount: totalTradeCount,
      pnlSnapshot: (typeof lastKnownPnL === 'number') ? lastKnownPnL : null,
      pnlSnapshotAt: lastPnlUpdateTime > 0 ? new Date(lastPnlUpdateTime).toISOString() : null,
      pnlSource: 'DOM',
      pnlConfidence: (lastPnlUpdateTime > 0 && (Date.now() - lastPnlUpdateTime) < PNL_STALE_THRESHOLD_MS) ? 'approximate' : 'stale',
    };

    currentBehavioralState = newState;
    stateTransitionHistory.push(transition);

    window.postMessage({ type: 'TRL_STATE_TRANSITION', ...transition }, '*');
    window.postMessage({ type: 'TRL_DIAGNOSTIC_LOG', entry: { type: 'state_transition', ...transition } }, '*');
  }

  /**
   * getSessionBehaviorSummary — Computes session summary from accumulated data.
   * Called at session end (End My Session or lock expiry).
   */
  function getSessionBehaviorSummary() {
    // Finalize time tracking for current state using monotonic clock
    var monoNow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var timeInCurrentState = monoNow - lastStateChangeMonotonic;
    // Sanity: reject impossible durations
    if (timeInCurrentState < 0 || timeInCurrentState > 86400000) timeInCurrentState = 0;
    var finalTimeTracking = {};
    for (var key in stateTimeTracking) { finalTimeTracking[key] = stateTimeTracking[key]; }
    finalTimeTracking[currentBehavioralState] = (finalTimeTracking[currentBehavioralState] || 0) + timeInCurrentState;

    var startingState = stateTransitionHistory.length > 0 ? stateTransitionHistory[0].from : 'NORMAL';
    var recoveredBeforeEnd = currentBehavioralState === 'NORMAL' || currentBehavioralState === 'CAUTION';

    return {
      sessionId: sessionId,
      startingState: startingState,
      endingState: currentBehavioralState,
      peakState: peakState,
      timeInNormal: finalTimeTracking.NORMAL || 0,
      timeInCaution: finalTimeTracking.CAUTION || 0,
      timeInElevated: finalTimeTracking.ELEVATED || 0,
      timeInHighRisk: finalTimeTracking.HIGH_RISK || 0,
      timeInLockdown: finalTimeTracking.LOCKDOWN || 0,
      escalationCount: escalationCount,
      recoveryCount: recoveryCount,
      worstTrigger: worstTrigger,
      firstEscalationTime: firstEscalationTime ? new Date(firstEscalationTime).toISOString() : null,
      transitionCount: stateTransitionHistory.length,
      tradeCount: totalTradeCount,
      recoveredBeforeEnd: recoveredBeforeEnd,
      timestamp: new Date().toISOString(),
    };
  }

  // Reset behavioral state tracking on new session
  function resetBehavioralStateEngine() {
    currentBehavioralState = 'NORMAL';
    lastTransitionTime = 0;
    stateTransitionHistory = [];
    stateTimeTracking = { NORMAL: 0, CAUTION: 0, ELEVATED: 0, HIGH_RISK: 0, LOCKDOWN: 0 };
    lastStateChangeTime = Date.now();
    lastStateChangeMonotonic = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    peakState = 'NORMAL';
    escalationCount = 0;
    recoveryCount = 0;
    worstTrigger = '';
    firstEscalationTime = null;
    totalTradeCount = 0;
    sessionId = generateSessionId();
  }

  // 5-second fallback reconciliation (safety net only)
  setInterval(function() { recalculateBehavioralState('periodic_reconciliation'); }, 5000);

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
  var lastPnlUpdateTime = 0; // Monotonic timestamp of last P&L DOM read
  var PNL_STALE_THRESHOLD_MS = 10000; // 10 seconds = stale
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
          recalculateBehavioralState('profit_lock_triggered');
        }
        
        // DRAWDOWN FROM HIGH: If P&L drops too much from peak
        if (profitLockEnabled && highWaterMark > 0 && (highWaterMark - currentPnl) >= drawdownFromHigh && !profitLocked) {
          profitLocked = true;
          console.log('[TradingGuardian] DRAWDOWN FROM HIGH: Peak $' + highWaterMark.toFixed(2) + ', Now $' + currentPnl.toFixed(2) + ', Gave back $' + (highWaterMark - currentPnl).toFixed(2));
          window.postMessage({ type: 'TRL_COACH_BLOCK', reason: 'GIVING IT BACK', message: 'You were up $' + highWaterMark.toFixed(0) + ' and gave back $' + (highWaterMark - currentPnl).toFixed(0) + '. Protecting what is left. Session over.' }, '*');
          recalculateBehavioralState('drawdown_from_high');
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
              recalculateBehavioralState('daily_loss_hit');
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
        lastPnlUpdateTime = Date.now();
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
