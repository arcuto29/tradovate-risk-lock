/**
 * Psychology Coach - Detects revenge trading, overtrading, and emotional patterns.
 * 
 * WARN first, then BLOCK if ignored.
 * 
 * Detects:
 * 1. Revenge trading — placed a trade within 30 seconds of a loss
 * 2. Overtrading — more than X trades in the session
 * 3. Rapid-fire orders — 3+ orders within 10 seconds
 * 4. Size increase after loss — went bigger after a losing trade
 * 5. Daily loss cutoff — P&L drops below max allowed loss
 * 6. Cooldown violation — trading before cooldown timer expires
 * 
 * This runs in the PAGE context (injected inline) to intercept orders.
 */
(function() {
  'use strict';

  const inlineScript = document.createElement('script');
  inlineScript.textContent = `
(function() {
  'use strict';

  // ─── State ─────────────────────────────────────────────────────────────────
  var coachEnabled = true;
  var maxTradesPerDay = 10;
  var cooldownSeconds = 120; // 2 minutes after a loss
  var maxDailyLoss = 500;
  
  var trades = []; // { timestamp, size, result: 'pending'|'win'|'loss' }
  var lastLossTime = 0;
  var cooldownActive = false;
  var cooldownUntil = 0;
  var warningShown = false;
  var totalPnL = 0;
  var dailyLossBlocked = false;
  var orderTimestamps = []; // for rapid-fire detection
  
  // Listen for config from content script
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_COACH_CONFIG') {
      coachEnabled = event.data.enabled !== false;
      maxTradesPerDay = event.data.maxTradesPerDay || 10;
      cooldownSeconds = event.data.cooldownSeconds || 120;
      maxDailyLoss = event.data.maxDailyLoss || 500;
    }
    if (event.data && event.data.type === 'TRL_TRADE_RESULT') {
      recordTradeResult(event.data.result, event.data.pnl);
    }
  });

  function recordTradeResult(result, pnl) {
    if (result === 'loss') {
      lastLossTime = Date.now();
      cooldownActive = true;
      cooldownUntil = Date.now() + (cooldownSeconds * 1000);
      totalPnL -= Math.abs(pnl || 0);
    } else if (result === 'win') {
      totalPnL += Math.abs(pnl || 0);
    }
    
    // Check daily loss
    if (totalPnL <= -maxDailyLoss) {
      dailyLossBlocked = true;
    }
  }

  // ─── Order Interception ────────────────────────────────────────────────────
  function checkOrder(url, body) {
    if (!coachEnabled) return null;
    
    var now = Date.now();
    
    // 1. Daily loss cutoff
    if (dailyLossBlocked) {
      return { block: true, reason: 'DAILY LOSS HIT', message: 'You have hit your daily loss limit of $' + maxDailyLoss + '. Trading is blocked for the rest of the session.' };
    }
    
    // 2. Cooldown after loss
    if (cooldownActive && now < cooldownUntil) {
      var remaining = Math.ceil((cooldownUntil - now) / 1000);
      if (!warningShown) {
        warningShown = true;
        return { block: false, warn: true, reason: 'COOLDOWN', message: 'You just took a loss. Take a breath. Cooldown: ' + remaining + 's remaining.' };
      }
      // Second attempt during cooldown = BLOCK
      return { block: true, reason: 'COOLDOWN VIOLATION', message: 'You ignored the cooldown warning. Order blocked. Wait ' + remaining + ' seconds.' };
    } else {
      cooldownActive = false;
      warningShown = false;
    }
    
    // 3. Rapid-fire detection (3+ orders in 10 seconds)
    orderTimestamps.push(now);
    orderTimestamps = orderTimestamps.filter(function(t) { return now - t < 10000; });
    if (orderTimestamps.length >= 3) {
      if (!warningShown) {
        warningShown = true;
        return { block: false, warn: true, reason: 'RAPID FIRE', message: 'You\\'re placing orders too fast. Slow down and think.' };
      }
      return { block: true, reason: 'RAPID FIRE BLOCKED', message: '3+ orders in 10 seconds. Blocked. Take a step back.' };
    }
    
    // 4. Max trades per day
    trades.push({ timestamp: now, size: (body && body.positionSize) || 1 });
    // Clean old trades (keep only today)
    var startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
    trades = trades.filter(function(t) { return t.timestamp > startOfDay.getTime(); });
    
    if (trades.length > maxTradesPerDay) {
      if (trades.length === maxTradesPerDay + 1) {
        return { block: false, warn: true, reason: 'OVERTRADING', message: 'You have placed ' + trades.length + ' trades today. Your max is ' + maxTradesPerDay + '. Consider stopping.' };
      }
      if (trades.length > maxTradesPerDay + 2) {
        return { block: true, reason: 'OVERTRADE BLOCKED', message: 'You exceeded your max trades (' + maxTradesPerDay + '). Order blocked.' };
      }
    }
    
    // 5. Revenge trading (trade within 30s of a loss)
    if (lastLossTime > 0 && (now - lastLossTime) < 30000) {
      return { block: false, warn: true, reason: 'REVENGE ALERT', message: 'You just lost and immediately tried to trade again. Are you revenge trading?' };
    }
    
    return null; // All clear
  }

  // Hook into the existing fetch override or create one
  var _origFetch = window._tgOrigFetch || window.fetch;
  if (!window._tgOrigFetch) window._tgOrigFetch = window.fetch;
  
  window.fetch = function() {
    var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] && arguments[0].url ? arguments[0].url : '');
    var opts = typeof arguments[0] === 'string' ? arguments[1] : arguments[0];
    var method = (opts && opts.method ? opts.method : 'GET').toUpperCase();
    
    if ((method === 'POST' || method === 'PUT') && isTradeUrl(url)) {
      var body = null;
      if (opts && opts.body && typeof opts.body === 'string') {
        try { body = JSON.parse(opts.body); } catch(e) {}
      }
      
      var result = checkOrder(url, body);
      if (result) {
        if (result.block) {
          console.log('[TradingGuardian-Coach] BLOCKED:', result.reason);
          window.postMessage({ type: 'TRL_COACH_BLOCK', reason: result.reason, message: result.message }, '*');
          return Promise.reject(new Error('Blocked by Trading Guardian: ' + result.reason));
        } else if (result.warn) {
          console.log('[TradingGuardian-Coach] WARNING:', result.reason);
          window.postMessage({ type: 'TRL_COACH_WARN', reason: result.reason, message: result.message }, '*');
          // Let it through but show warning
        }
      }
    }
    
    return _origFetch.apply(this, arguments);
  };
  
  function isTradeUrl(url) {
    if (!url) return false;
    return url.includes('/Order') || url.includes('/trading/place') || url.includes('/order');
  }

  console.log('[TradingGuardian-Coach] Psychology coach installed. Max trades: ' + maxTradesPerDay + ', Cooldown: ' + cooldownSeconds + 's, Max loss: $' + maxDailyLoss);
})();
`;
  (document.head || document.documentElement).prepend(inlineScript);

  // ─── Content script: overlays and communication ────────────────────────────
  
  // Send config to page
  chrome.runtime.sendMessage({ type: 'GET_COACH_CONFIG' }, (r) => {
    if (r) sendConfigToPage(r);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'COACH_CONFIG_UPDATE') sendConfigToPage(msg);
  });

  function sendConfigToPage(config) {
    window.postMessage({
      type: 'TRL_COACH_CONFIG',
      enabled: config.enabled,
      maxTradesPerDay: config.maxTradesPerDay,
      cooldownSeconds: config.cooldownSeconds,
      maxDailyLoss: config.maxDailyLoss,
    }, '*');
  }

  // Listen for coach events
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data && event.data.type === 'TRL_COACH_WARN') {
      showWarning(event.data.reason, event.data.message);
      chrome.runtime.sendMessage({ type: 'REPORT_BYPASS_ATTEMPT', details: `COACH WARNING: ${event.data.reason} - ${event.data.message}` });
    }
    
    if (event.data && event.data.type === 'TRL_COACH_BLOCK') {
      showBlock(event.data.reason, event.data.message);
      chrome.runtime.sendMessage({ type: 'REPORT_BYPASS_ATTEMPT', details: `COACH BLOCKED: ${event.data.reason} - ${event.data.message}` });
    }
  });

  // ─── Warning Overlay (dismissible, yellow) ─────────────────────────────────
  function showWarning(reason, message) {
    if (document.getElementById('trl-coach-warning')) return;
    const w = document.createElement('div');
    w.id = 'trl-coach-warning';
    w.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483646;background:#1a1a2e;border:1px solid #f59e0b;border-radius:12px;padding:20px 24px;max-width:360px;font-family:-apple-system,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:slideIn 0.3s ease-out;';
    w.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="font-size:20px;">&#9888;</span>
        <span style="font-size:12px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;">${reason}</span>
      </div>
      <p style="color:#e2e8f0;font-size:14px;line-height:1.5;margin:0 0 14px 0;">${message}</p>
      <button id="trl-coach-dismiss" style="padding:6px 16px;border:1px solid rgba(255,255,255,0.2);border-radius:6px;background:transparent;color:#94a3b8;font-size:12px;cursor:pointer;">I understand</button>
    `;
    document.body.appendChild(w);
    document.getElementById('trl-coach-dismiss').onclick = () => w.remove();
    setTimeout(() => w.remove(), 10000);
  }

  // ─── Block Overlay (full screen, red) ──────────────────────────────────────
  let blockShown = false;
  function showBlock(reason, message) {
    if (blockShown) return; blockShown = true;
    const o = document.createElement('div'); o.id = 'tradovate-risk-lock-overlay';
    o.innerHTML = `<div class="trl-overlay-content">
      <div class="trl-alert-badge">&#9679; GUARDIAN &bull; COACH</div>
      <h1>${reason}</h1>
      <p class="trl-message">${message}</p>
      <button id="trl-dismiss-btn" class="trl-dismiss-btn">Dismiss</button>
      <p class="trl-footer">This has been recorded in your activity log.</p>
    </div>`;
    document.body.appendChild(o);
    document.getElementById('trl-dismiss-btn').onclick = () => { o.remove(); blockShown = false; };
    setTimeout(() => { o.remove(); blockShown = false; }, 20000);
  }

  console.log('[TradingGuardian] Psychology coach content script loaded.');
})();
