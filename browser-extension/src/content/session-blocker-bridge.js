/**
 * Session Blocker Bridge - ISOLATED WORLD
 * Communicates between the Chrome extension APIs and the MAIN world script.
 * Sends session state and coach config to the page via postMessage.
 * Listens for blocked/warning events and shows overlays + reports to desktop app.
 */
(function() {
  'use strict';

  let sessionBlocked = false;
  let sessionHours = null;

  // Get state from background
  chrome.runtime.sendMessage({ type: 'GET_SESSION_STATE' }, (r) => {
    if (r) { sessionBlocked = r.blocked; sessionHours = r.sessionHours; sendStateToPage(); }
  });

  // Get sound config
  chrome.storage.local.get('sound_on_block', (r) => {
    window.postMessage({ type: 'TRL_SOUND_CONFIG', soundOnBlock: r?.sound_on_block || false }, '*');
  });

  // Get FOMO config
  chrome.storage.local.get('fomo_config', (r) => {
    if (r?.fomo_config) {
      window.postMessage({ type: 'TRL_FOMO_CONFIG', fomoEnabled: r.fomo_config.fomoEnabled, fomoMode: r.fomo_config.fomoMode, fomoMaxEntriesPerWindow: r.fomo_config.fomoMaxEntriesPerWindow, fomoWindowMinutes: r.fomo_config.fomoWindowMinutes, fomoMinSecondsBetween: r.fomo_config.fomoMinSecondsBetween, fomoBlockFirstMinutes: r.fomo_config.fomoBlockFirstMinutes }, '*');
    }
  });

  // Get lock state
  chrome.runtime.sendMessage({ type: 'GET_LOCK_STATE' }, (r) => {
    if (r) { window.postMessage({ type: 'TRL_LOCK_STATE', locked: r.locked }, '*'); }
  });

  chrome.runtime.sendMessage({ type: 'GET_COACH_CONFIG' }, (r) => {
    if (r) sendCoachToPage(r);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SESSION_STATE_UPDATE') { sessionBlocked = msg.blocked; sessionHours = msg.sessionHours; sendStateToPage(); }
    if (msg.type === 'LOCK_STATE_UPDATE') { window.postMessage({ type: 'TRL_LOCK_STATE', locked: msg.locked }, '*'); }
    if (msg.type === 'EMERGENCY_FALLBACK') { window.postMessage({ type: 'TRL_EMERGENCY_FALLBACK', locked: true, settings: msg.settings }, '*'); }
    if (msg.type === 'COACH_CONFIG_UPDATE') sendCoachToPage(msg);
    if (msg.type === 'POSITION_LIMITS_UPDATE') sendLimitsToPage(msg);
    if (msg.type === 'FULL_DAY_BLOCK') { window.postMessage({ type: 'TRL_FULL_BLOCK' }, '*'); }
    if (msg.type === 'GHOST_MODE') { window.postMessage({ type: 'TRL_GHOST_MODE', enabled: msg.enabled }, '*'); }
    if (msg.type === 'NEWS_CONFIG') { window.postMessage({ type: 'TRL_NEWS_CONFIG', enabled: msg.enabled, blockMinutesBefore: msg.blockMinutesBefore, blockMinutesAfter: msg.blockMinutesAfter, events: msg.events || [] }, '*'); }
    if (msg.type === 'SOUND_CONFIG') { window.postMessage({ type: 'TRL_SOUND_CONFIG', soundOnBlock: msg.soundOnBlock }, '*'); }
    if (msg.type === 'FOMO_CONFIG') { window.postMessage({ type: 'TRL_FOMO_CONFIG', fomoEnabled: msg.fomoEnabled, fomoMode: msg.fomoMode, fomoMaxEntriesPerWindow: msg.fomoMaxEntriesPerWindow, fomoWindowMinutes: msg.fomoWindowMinutes, fomoMinSecondsBetween: msg.fomoMinSecondsBetween, fomoBlockFirstMinutes: msg.fomoBlockFirstMinutes }, '*'); }
    if (msg.type === 'APP_DISCONNECTED') {
      // App is not running - disable all enforcement
      sessionBlocked = false;
      window.postMessage({ type: 'TRL_APP_DISCONNECTED' }, '*');
      window.postMessage({ type: 'TRL_COACH_CONFIG', enabled: false, maxTradesPerDay: 0, cooldownSeconds: 0, maxDailyLoss: 0 }, '*');
      window.postMessage({ type: 'TRL_SESSION_STATE', blocked: false, sessionHours: null, positionLimits: { limits: [], defaultMax: 0 } }, '*');
      window.postMessage({ type: 'TRL_GHOST_MODE', enabled: false }, '*');
    }
    if (msg.type === 'DEV_MODE_UPDATE') {
      chrome.storage.local.set({ sentinel_dev_mode: msg.enabled });
      window.postMessage({ type: 'TRL_DEV_MODE', enabled: msg.enabled }, '*');
    }
  });

  function sendStateToPage() {
    window.postMessage({ type: 'TRL_SESSION_STATE', blocked: sessionBlocked, sessionHours, positionLimits: currentLimits }, '*');
  }

  function sendCoachToPage(config) {
    window.postMessage({ type: 'TRL_COACH_CONFIG', enabled: config.enabled, maxTradesPerDay: config.maxTradesPerDay, cooldownSeconds: config.cooldownSeconds, maxDailyLoss: config.maxDailyLoss }, '*');
  }

  function sendLimitsToPage(data) {
    if (data.limits) currentLimits = { limits: data.limits, defaultMax: data.defaultMax || 2 };
    window.postMessage({ type: 'TRL_POSITION_LIMITS', limits: data.limits, defaultMax: data.defaultMax || 2, lossLimitAmount: data.lossLimitAmount || 0, pyramidingEnabled: data.pyramidingEnabled || false, pyramidMaxContracts: data.pyramidMaxContracts || 0, pyramidMaxAddOns: data.pyramidMaxAddOns || 0 }, '*');
    // Also forward blocked symbols if present
    if (data.blockedSymbols) {
      window.postMessage({ type: 'TRL_BLOCKED_SYMBOLS', symbols: data.blockedSymbols }, '*');
    }
  }

  var currentLimits = { limits: [], defaultMax: 2 };

  // Load saved limits
  chrome.storage.local.get('position_limits', (r) => {
    if (r.position_limits) {
      currentLimits = { limits: r.position_limits.limits || [], defaultMax: r.position_limits.defaultMax || 2 };
      sendLimitsToPage(currentLimits);
    }
  });

  setInterval(sendStateToPage, 5000);

  // Send dev mode status to main world for diagnostic logging on load
  chrome.storage.local.get('sentinel_dev_mode', (r) => {
    window.postMessage({ type: 'TRL_DEV_MODE', enabled: r?.sentinel_dev_mode || false }, '*');
  });

  // Listen for events from MAIN world
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data && event.data.type === 'TRL_ORDER_BLOCKED') {
      var priority = event.data.priority || 'CRITICAL';
      if (priority === 'CRITICAL') {
        showOverlay(event.data.reason);
      } else if (priority === 'HIGH') {
        showBlock(event.data.reason, event.data.reason);
      } else if (priority === 'MEDIUM') {
        showWarning('ORDER BLOCKED', event.data.reason);
      }
      // LOW = silently logged (no visual)
      try { chrome.runtime.sendMessage({ type: 'REPORT_BYPASS_ATTEMPT', details: `BLOCKED on ${window.location.hostname}: ${event.data.reason}`, priority: priority }); } catch(e) {}
    }

    if (event.data && event.data.type === 'TRL_COACH_WARN') {
      showWarning(event.data.reason, event.data.message);
      // Warnings are NOT bypass attempts — just log them passively
      try { chrome.runtime.sendMessage({ type: 'DIAGNOSTIC_LOG', entry: { type: 'coach_warn', reason: event.data.reason } }); } catch(e) {}
    }

    if (event.data && event.data.type === 'TRL_COACH_BLOCK') {
      // Don't show regular overlay if loss reaction timer will handle it
      var isCooldown = event.data.reason === 'COOLDOWN ACTIVE' || event.data.reason === 'COOLDOWN';
      var priority = event.data.priority || 'HIGH';
      if (!isCooldown) {
        if (priority === 'CRITICAL') {
          showOverlay(event.data.reason);
        } else {
          showBlock(event.data.reason, event.data.message);
        }
      }
      try { chrome.runtime.sendMessage({ type: 'REPORT_BYPASS_ATTEMPT', details: `COACH BLOCK: ${event.data.reason}`, priority: priority }); } catch(e) {}
    }

    if (event.data && event.data.type === 'TRL_TILT_UPDATE') {
      try { chrome.runtime.sendMessage({ type: 'TILT_UPDATE', score: event.data.score, level: event.data.level, blocked: event.data.blocked }); } catch(e) {}
    }

    if (event.data && event.data.type === 'TRL_TRADE_FILL') {
      try { chrome.runtime.sendMessage({ type: 'TRADE_FILL', symbol: event.data.symbol, size: event.data.size, direction: event.data.direction, entryTime: event.data.entryTime, exitTime: event.data.exitTime, pnl: event.data.pnl, result: event.data.result }); } catch(e) {}
    }

    if (event.data && event.data.type === 'TRL_DIAGNOSTIC_LOG') {
      try { chrome.runtime.sendMessage({ type: 'DIAGNOSTIC_LOG', entry: event.data.entry }); } catch(e) {}
    }
  });

  // ─── Overlays ──────────────────────────────────────────────────────────────
  var lastOverlayTime = 0;
  var lastWarningReason = '';
  var OVERLAY_COOLDOWN = 5000; // Don't show another overlay within 5s
  var WARNING_DEDUP_MS = 30000; // Don't repeat same warning within 30s
  
  function showOverlay(reason) {
    if (document.getElementById('tradovate-risk-lock-overlay')) return;
    var now = Date.now();
    if ((now - lastOverlayTime) < OVERLAY_COOLDOWN) return;
    lastOverlayTime = now;
    
    var title = 'ORDER<br>BLOCKED';
    if (reason && reason.includes('hours')) title = 'SESSION<br>BLOCKED';
    else if (reason && reason.includes('size')) title = 'OVERSIZE<br>BLOCKED';
    else if (reason && reason.includes('blocked for today')) title = 'FULL DAY<br>BLOCK';
    else if (reason && reason.includes('DAILY LOSS')) title = 'DAILY LOSS<br>REACHED';
    else if (reason && reason.includes('symbol')) title = 'SYMBOL<br>BLOCKED';
    else if (reason && reason.includes('TRADE LIMIT')) title = 'MAX TRADES<br>REACHED';
    const o = document.createElement('div'); o.id = 'tradovate-risk-lock-overlay';
    o.innerHTML = `<div class="trl-overlay-content"><div class="trl-alert-badge">SENTINEL</div><h1>${title}</h1><p class="trl-message">${reason}</p><button id="trl-dismiss-btn" class="trl-dismiss-btn">Dismiss</button></div>`;
    document.body.appendChild(o);
    document.getElementById('trl-dismiss-btn').onclick = () => o.remove();
    setTimeout(() => o.remove(), 8000); // 8s instead of 20s
  }

  function showWarning(reason, message) {
    if (document.getElementById('trl-coach-warning')) return;
    // Deduplicate: don't repeat same reason within 30s
    var now = Date.now();
    if (reason === lastWarningReason && (now - lastOverlayTime) < WARNING_DEDUP_MS) return;
    lastWarningReason = reason;
    lastOverlayTime = now;
    
    const w = document.createElement('div'); w.id = 'trl-coach-warning';
    w.style.cssText = 'position:fixed;top:20px;right:20px;z-index:2147483646;background:#1a1a2e;border:1px solid #f59e0b;border-radius:12px;padding:16px 20px;max-width:320px;font-family:-apple-system,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.5);opacity:0;transition:opacity 0.3s;';
    w.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="font-size:11px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;">Sentinel</span></div><p style="color:#e2e8f0;font-size:13px;line-height:1.4;margin:0;">${message}</p>`;
    document.body.appendChild(w);
    setTimeout(() => { w.style.opacity = '1'; }, 10);
    setTimeout(() => { w.style.opacity = '0'; setTimeout(() => w.remove(), 300); }, 5000); // 5s instead of 10s
  }

  function showBlock(reason, message) {
    if (document.getElementById('tradovate-risk-lock-overlay')) return;
    var now = Date.now();
    if ((now - lastOverlayTime) < OVERLAY_COOLDOWN) return;
    lastOverlayTime = now;
    
    const o = document.createElement('div'); o.id = 'tradovate-risk-lock-overlay';
    o.innerHTML = `<div class="trl-overlay-content"><div class="trl-alert-badge">SENTINEL</div><h1>${reason}</h1><p class="trl-message">${message}</p><button id="trl-dismiss-btn" class="trl-dismiss-btn">Dismiss</button></div>`;
    document.body.appendChild(o);
    document.getElementById('trl-dismiss-btn').onclick = () => o.remove();
    setTimeout(() => o.remove(), 8000);
  }

  console.log('[TradingGuardian] Bridge loaded on', window.location.hostname);
})();
