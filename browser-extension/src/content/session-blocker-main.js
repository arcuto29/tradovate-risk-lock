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
  var totalDailyPnL = 0;
  var lastOrderTime = 0;

  // ─── NEW: Advanced Protection Features ─────────────────────────────────────
  var consecutiveLosses = 0;
  var originalMaxSize = 0; // Stores original max at session start
  var currentMaxSize = 0; // Current max (reduces after losses)
  var highWaterMark = 0; // Highest P&L reached today
  var profitLockThreshold = 0; // Lock out after reaching this profit
  var drawdownFromHigh = 200; // Lock if P&L drops this much from high
  var profitLocked = false;
  var scalingLockEnabled = true; // One-way ratchet: can only reduce, never increase
  var lossStreakEnabled = true; // Auto-reduce size after consecutive losses
  var profitLockEnabled = true; // Lock out after hitting profit target or drawdown from high
  var escalatingCooldown = true; // Cooldown gets longer after each loss

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
      if (event.data.profitLockThreshold) profitLockThreshold = event.data.profitLockThreshold;
      if (event.data.drawdownFromHigh) drawdownFromHigh = event.data.drawdownFromHigh;
      scalingLockEnabled = event.data.scalingLockEnabled !== false;
      lossStreakEnabled = event.data.lossStreakEnabled !== false;
      profitLockEnabled = event.data.profitLockEnabled !== false;
      escalatingCooldown = event.data.escalatingCooldown !== false;
      // Set original max size at start
      if (!originalMaxSize) { originalMaxSize = positionLimits.nqMax; currentMaxSize = positionLimits.nqMax; }
    }
    if (event.data && event.data.type === 'TRL_TRADE_RESULT') {
      if (event.data.result === 'loss') {
        consecutiveLosses++;
        lastLossTime = Date.now();
        cooldownActive = true;
        // ESCALATING COOLDOWN: 2min → 4min → 8min → 16min max
        var escalatedCooldown = escalatingCooldown 
          ? cooldownSeconds * Math.pow(2, Math.min(consecutiveLosses - 1, 3))
          : cooldownSeconds;
        cooldownUntil = Date.now() + (escalatedCooldown * 1000);
        warningShown = false;
        
        // LOSS STREAK AUTO-TIGHTEN
        if (lossStreakEnabled && consecutiveLosses >= 2) {
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
    
    // Use loss-streak-reduced size if active
    var effectiveNqMax = (lossStreakEnabled && currentMaxSize > 0 && currentMaxSize < positionLimits.nqMax) 
      ? currentMaxSize : positionLimits.nqMax;
    var effectiveMnqMax = (lossStreakEnabled && currentMaxSize > 0) 
      ? Math.max(1, currentMaxSize * 5) : positionLimits.mnqMax;
    
    if (symbol.includes('EMNQ') || symbol.includes('MNQ')) return size > effectiveMnqMax;
    if (symbol.includes('ENQ') || symbol.includes('NQ')) return size > effectiveNqMax;
    if (symbol.includes('MES')) return size > positionLimits.mesMax;
    if (symbol.includes('ES')) return size > positionLimits.esMax;
    return size > positionLimits.defaultMax;
  }

  // ─── Psychology coach check ────────────────────────────────────────────────
  function checkCoach(body) {
    if (!coachEnabled) return null;
    var now = Date.now();

    // PROFIT LOCK: blocked if you hit profit target or gave back too much from high
    if (profitLocked) {
      return { block: true, reason: 'PROFIT PROTECTED', message: 'You reached your profit target or gave back too much from your high. Your green day is protected. Walk away.' };
    }

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
    if (!coachEnabled) return;
    
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
          console.log('[TradingGuardian] Loss detected: -$' + lossAmount.toFixed(2) + ' (Total P&L: $' + currentPnl.toFixed(2) + ')');
          
          lastLossTime = Date.now();
          cooldownActive = true;
          var escalatedCooldown = escalatingCooldown 
            ? cooldownSeconds * Math.pow(2, Math.min(consecutiveLosses - 1, 3))
            : cooldownSeconds;
          cooldownUntil = Date.now() + (escalatedCooldown * 1000);
          warningShown = false;
          totalDailyPnL = currentPnl;
          
          // Check daily loss limit
          if (Math.abs(currentPnl) >= maxDailyLoss && currentPnl < 0) {
            dailyLossBlocked = true;
            console.log('[TradingGuardian] DAILY LOSS LIMIT HIT: $' + currentPnl.toFixed(2));
            window.postMessage({ type: 'TRL_COACH_BLOCK', reason: 'DAILY LOSS REACHED', message: 'You have reached your maximum daily loss ($' + Math.abs(currentPnl).toFixed(2) + '). Protecting your capital is the priority. Step away and reset for tomorrow.' }, '*');
          }
          
          window.postMessage({ type: 'TRL_LOSS_DETECTED', amount: lossAmount, totalPnl: currentPnl }, '*');
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
                  lastLossTime = Date.now();
                  cooldownActive = true;
                  cooldownUntil = Date.now() + (cooldownSeconds * 1000);
                  warningShown = false;
                  totalDailyPnL += pnl;
                  if (totalDailyPnL <= -maxDailyLoss) {
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
