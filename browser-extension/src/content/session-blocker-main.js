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

  // Listen for config from bridge content script
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_SESSION_STATE') {
      sessionBlocked = event.data.blocked;
      if (event.data.positionLimits) positionLimits = event.data.positionLimits;
    }
    if (event.data && event.data.type === 'TRL_LOCK_STATE') {
      lockActive = event.data.locked === true;
      if (!lockActive) {
        // Clear all enforcement when unlocked
        cooldownActive = false;
        dailyLossBlocked = false;
        profitLocked = false;
        fullDayBlocked = false;
        currentOpenPositions = {}; // Reset position tracking
      }
    }
    if (event.data && event.data.type === 'TRL_FULL_BLOCK') {
      fullDayBlocked = true;
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
      // Set original max size at start
      if (!originalMaxSize) { originalMaxSize = positionLimits.defaultMax || 2; currentMaxSize = positionLimits.defaultMax || 2; }
    }
    if (event.data && event.data.type === 'TRL_TRADE_RESULT') {
      if (event.data.result === 'loss') {
        consecutiveLosses++;
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
      }
    }
  });

  // ─── Order URL detection ───────────────────────────────────────────────────
  var ORDER_URLS = ['userapi.topstepx.com/Order', '/Order', '/api/Order', 'order/place'];
  var SAFE_URLS = ['/Order?accountId', '/order/list', '/order/item', '/orders/history'];
  // URLs that indicate modifying/canceling an existing order (NOT new orders)
  var MODIFY_URLS = ['/Order/modify', '/Order/cancel', '/Order/update', '/order/modify', '/order/cancel', '/order/update', '/Order/editStopLoss', '/Order/editTakeProfit', '/Order/editStop', '/Order/editTarget', '/Order/edit'];

  function isOrderUrl(url) {
    if (!url) return false;
    var lower = url.toLowerCase();
    if (SAFE_URLS.some(function(p) { return lower.includes(p.toLowerCase()); })) return false;
    return ORDER_URLS.some(function(p) { return url.includes(p); });
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

      // FULL DAY BLOCK (Pre-Market Check admitted to revenge trading)
      if (fullDayBlocked) {
        console.log('[TradingGuardian] BLOCKED: Full day block active (Pre-Market Check)');
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Trading blocked for today. You admitted to revenge trading.' }, '*');
        return Promise.reject(new Error('Blocked: Full day block'));
      }

      // Blocked symbol check
      if (lockActive && body && isBlockedSymbol(body)) {
        var blockedSym = (body.symbolId || body.symbol || body.instrument || '');
        console.log('[TradingGuardian] BLOCKED: Symbol blocked -', blockedSym);
        playBlockSound();
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Symbol ' + blockedSym + ' is blocked' }, '*');
        return Promise.reject(new Error('Blocked: Symbol is blocked'));
      }

      // Session block
      if (lockActive && sessionBlocked) {
        console.log('[TradingGuardian] BLOCKED: Outside trading hours');
        playBlockSound();
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Outside trading hours' }, '*');
        return Promise.reject(new Error('Blocked: Outside trading hours'));
      }

      // News event block
      if (lockActive && newsBlockerEnabled && isNewsBlocked()) {
        console.log('[TradingGuardian] BLOCKED: News event window');
        playBlockSound();
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Trading blocked - major news event window active. Wait for volatility to settle.' }, '*');
        return Promise.reject(new Error('Blocked: News event'));
      }

      // Position size (single order check)
      if (lockActive && body && isOversized(body)) {
        var blockedSize = Math.abs(body.positionSize || body.qty || body.quantity || body.size || 0);
        console.log('[TradingGuardian] BLOCKED: Oversize', blockedSize, body.symbolId);
        playBlockSound();
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Position size ' + blockedSize + ' exceeds max for ' + (body.symbolId || 'contract') }, '*');
        window.postMessage({ type: 'TRL_ORDER_PLACED', size: blockedSize }, '*');
        return Promise.reject(new Error('Blocked: Position size exceeds limit'));
      }

      // Pyramiding / Stacking check
      if (lockActive && body) {
        var orderSize = Math.abs(body.positionSize || body.qty || body.quantity || body.size || 0);
        var orderSymbol = (body.symbolId || body.symbol || body.instrument || '').toUpperCase();
        
        if (orderSize > 0 && orderSymbol) {
          var pos = currentOpenPositions[orderSymbol];
          
          if (pos && pos.size > 0) {
            // Already have a position in this symbol - this is stacking
            if (!pyramidingEnabled) {
              // Stacking blocked by default
              console.log('[TradingGuardian] BLOCKED: Stacking disabled. Already in', orderSymbol);
              window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Already have a position in ' + orderSymbol + '. Stacking is disabled.' }, '*');
              return Promise.reject(new Error('Blocked: Stacking disabled'));
            } else {
              // Pyramiding enabled - check limits
              var newTotal = pos.size + orderSize;
              var maxTotal = pyramidMaxContracts > 0 ? pyramidMaxContracts : (positionLimits.defaultMax || 2);
              
              if (newTotal > maxTotal) {
                console.log('[TradingGuardian] BLOCKED: Pyramid max contracts. Current:', pos.size, 'Adding:', orderSize, 'Max:', maxTotal);
                window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Adding ' + orderSize + ' would exceed pyramid max of ' + maxTotal + ' contracts for ' + orderSymbol }, '*');
                return Promise.reject(new Error('Blocked: Pyramid max contracts'));
              }
              
              if (pyramidMaxAddOns > 0 && pos.addOns >= pyramidMaxAddOns) {
                console.log('[TradingGuardian] BLOCKED: Max add-ons reached for', orderSymbol);
                window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Max add-ons reached for ' + orderSymbol + '. Already added ' + pos.addOns + ' times.' }, '*');
                return Promise.reject(new Error('Blocked: Max add-ons'));
              }
              
              // Allowed - update tracking
              pos.size = newTotal;
              pos.addOns++;
            }
          } else {
            // First entry - track it
            currentOpenPositions[orderSymbol] = { size: orderSize, addOns: 0 };
          }
        }
      }

      // Tilt meter check
      if (lockActive && window.__tiltMeter && window.__tiltMeter.shouldBlock()) {
        console.log('[TradingGuardian] TILT BLOCKED: Score', window.__tiltMeter.getScore());
        window.postMessage({ type: 'TRL_COACH_BLOCK', reason: 'TILTING', message: 'Your tilt meter is red. You are making emotional decisions. Step away and reset.' }, '*');
        return Promise.reject(new Error('Blocked: Tilt meter red'));
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

      // Order passed all checks — notify tilt meter
      var orderSize = body ? (body.positionSize || body.qty || body.quantity || body.size || 0) : 0;
      window.postMessage({ type: 'TRL_ORDER_PLACED', size: orderSize }, '*');
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
      var parsed = null;
      if (typeof body === 'string') { try { parsed = JSON.parse(body); } catch(e) {} }

      // Skip coach/size checks for order modifications (moving SL/TP)
      if (isModifyOrCancel(this._tgUrl, parsed)) {
        return origSend.apply(this, arguments);
      }

      // FULL DAY BLOCK
      if (fullDayBlocked) {
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Trading blocked for today.' }, '*');
        return;
      }

      // Blocked symbol
      if (parsed && isBlockedSymbol(parsed)) {
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Symbol is blocked' }, '*');
        return;
      }

      if (sessionBlocked) {
        window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: 'Outside trading hours' }, '*');
        return;
      }
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
          // 2. At least 30 seconds since last loss detection (separate trades)
          if (lossAmount >= 10 && (now - lastLossDetectedTime) > 30000) {
            lastLossDetectedTime = now;
            console.log('[TradingGuardian] Loss detected: -$' + lossAmount.toFixed(2) + ' (Total P&L: $' + currentPnl.toFixed(2) + ')');
            
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
            console.log('[TradingGuardian] Win detected: +$' + winAmount.toFixed(2) + ' (Total P&L: $' + currentPnl.toFixed(2) + ')');
            window.postMessage({ type: 'TRL_TRADE_RESULT', result: 'win', pnl: winAmount }, '*');
            consecutiveLosses = 0;
          }
        }
        
        lastKnownPnL = currentPnl;
      }
    }
  }, 2000); // Check every 2 seconds

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

  console.log('[TradingGuardian] MAIN world interceptor loaded. Session/Size/Coach/P&L active.');
})();
