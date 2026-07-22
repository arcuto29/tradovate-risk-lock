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
  var totalDailyPnL = 0;
  var lastOrderTime = 0;

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
    
    // Look for P&L display elements in the page
    var pnlElements = document.querySelectorAll('[class*="pnl"], [class*="PnL"], [class*="profit"], [class*="loss"], [class*="pl-"], [data-testid*="pnl"]');
    
    // Also look for common P&L text patterns
    var allText = document.body ? document.body.innerText : '';
    
    // Check for TopstepX specific P&L indicators
    // Look for elements that show realized P&L
    var realizedPnl = document.querySelector('[class*="realized"], [class*="Realized"], [class*="closed-pnl"], [class*="netPnl"]');
    if (realizedPnl) {
      var pnlText = realizedPnl.textContent || '';
      var pnlMatch = pnlText.match(/[-]?\$?([\d,]+\.?\d*)/);
      if (pnlMatch) {
        var currentPnl = parseFloat(pnlMatch[1].replace(',', ''));
        if (pnlText.includes('-') || pnlText.includes('(')) currentPnl = -currentPnl;
        
        if (lastKnownPnL !== null && currentPnl < lastKnownPnL) {
          // P&L went down = loss detected
          var lossAmount = lastKnownPnL - currentPnl;
          console.log('[TradingGuardian] Loss detected: -$' + lossAmount.toFixed(2) + ' (PnL: $' + currentPnl.toFixed(2) + ')');
          
          lastLossTime = Date.now();
          cooldownActive = true;
          cooldownUntil = Date.now() + (cooldownSeconds * 1000);
          warningShown = false;
          totalDailyPnL = currentPnl;
          
          // Check daily loss limit
          if (currentPnl <= -maxDailyLoss) {
            dailyLossBlocked = true;
            console.log('[TradingGuardian] DAILY LOSS LIMIT HIT: $' + currentPnl.toFixed(2));
            window.postMessage({ type: 'TRL_COACH_BLOCK', reason: 'DAILY LOSS REACHED', message: 'You have reached your maximum daily loss. Protecting your capital is the priority. Step away and reset for tomorrow.' }, '*');
          }
          
          window.postMessage({ type: 'TRL_LOSS_DETECTED', amount: lossAmount, totalPnl: currentPnl }, '*');
        }
        
        lastKnownPnL = currentPnl;
      }
    }
    
    // Also check for position close events via fetch responses
    // TopstepX shows "Order filled" or position changes
    var positionElements = document.querySelectorAll('[class*="position"], [class*="Position"]');
    
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
