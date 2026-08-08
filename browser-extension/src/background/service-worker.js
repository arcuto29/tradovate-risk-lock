import { WS_URL, WS_RECONNECT_INTERVAL, STORAGE_KEYS } from '../shared/constants.js';

let ws = null;
let lockState = { locked: false, settings: null };
let sessionState = { blocked: false, sessionHours: null, enabled: false };
let reconnectTimer = null;

function connectToDesktopApp() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
  
  // On startup/wake, check if we were in emergency mode
  chrome.storage.local.get(['sentinel_emergency_mode', 'sentinel_last_lock_state', 'sentinel_fallback_state'], (stored) => {
    if (stored.sentinel_emergency_mode && stored.sentinel_last_lock_state) {
      lockState = stored.sentinel_last_lock_state;
      // Check if lock has expired (if settings have a reset time)
      if (stored.sentinel_fallback_state && stored.sentinel_fallback_state.settings) {
        var resetTimeISO = stored.sentinel_fallback_state.settings.resetTimeISO;
        if (resetTimeISO && new Date(resetTimeISO) < new Date()) {
          // Lock expired - clear emergency mode
          chrome.storage.local.set({ sentinel_emergency_mode: false });
          lockState = { locked: false, settings: null };
          updateRules(false);
          chrome.action.setBadgeText({ text: '' });
          return;
        }
      }
      updateRules(true);
      chrome.action.setBadgeText({ text: 'EMR' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    }
  });

  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      chrome.storage.local.set({ [STORAGE_KEYS.CONNECTION_STATUS]: true });
      ws.send(JSON.stringify({ type: 'check_lock' }));
      ws.send(JSON.stringify({ type: 'check_session' }));
      // Send any queued bypass reports
      chrome.storage.local.get('pending_bypass_reports', (r) => {
        const pending = r.pending_bypass_reports || [];
        if (pending.length > 0) {
          pending.forEach((report) => {
            ws.send(JSON.stringify({ type: 'report_bypass', details: report.details }));
          });
          chrome.storage.local.set({ pending_bypass_reports: [] });
        }
      });
    };
    ws.onmessage = (event) => { try { handleMessage(JSON.parse(event.data)); } catch {} };
    ws.onclose = () => { ws = null; chrome.storage.local.set({ [STORAGE_KEYS.CONNECTION_STATUS]: false }); clearAllState(); scheduleReconnect(); };
    ws.onerror = () => { ws = null; clearAllState(); scheduleReconnect(); };
  } catch { scheduleReconnect(); }
}

function scheduleReconnect() { if (reconnectTimer) return; reconnectTimer = setTimeout(() => { reconnectTimer = null; connectToDesktopApp(); }, WS_RECONNECT_INTERVAL); }

// Clear all cached state and tell content scripts to disable when app disconnects
function clearAllState() {
  // CRITICAL SAFETY: If we were LOCKED when disconnected, keep enforcing last known rules
  // Only go fail-open if we were UNLOCKED (safe to disable)
  if (lockState.locked) {
    // LOCKED DISCONNECT - keep protection active with last known rules
    console.log('[Sentinel] Desktop disconnected while LOCKED - keeping emergency protection active');
    chrome.storage.local.set({
      [STORAGE_KEYS.CONNECTION_STATUS]: false,
      sentinel_emergency_mode: true,
      sentinel_last_lock_state: lockState,
      sentinel_emergency_started: Date.now(),
      // Retain all enforcement state for fallback
      sentinel_fallback_state: {
        locked: true,
        settings: lockState.settings,
        sessionState: sessionState,
        stateVersion: Date.now(),
      },
    });
    
    // Tell content scripts we're in emergency fallback mode (still enforce, but show warning)
    const urls = ['https://trader.tradovate.com/*', 'https://app.tradesea.ai/*', 'https://topstepx.com/*', 'https://*.topstepx.com/*', 'https://www.tradingview.com/*'];
    urls.forEach(pattern => {
      chrome.tabs.query({ url: pattern }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'EMERGENCY_FALLBACK', locked: true, settings: lockState.settings }).catch(() => {});
        });
      });
    });
    
    // Keep DNR rules active
    updateRules(true);
    chrome.action.setBadgeText({ text: 'EMR' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    
    // Schedule reconnect but do NOT disable enforcement
    scheduleReconnect();
    return;
  }

  // UNLOCKED DISCONNECT - safe to disable everything
  lockState = { locked: false, settings: null };
  sessionState = { blocked: false, sessionHours: null, enabled: false };
  chrome.storage.local.set({
    [STORAGE_KEYS.CONNECTION_STATUS]: false,
    [STORAGE_KEYS.LOCK_STATE]: lockState,
    coach_config: { enabled: false, maxTradesPerDay: 0, cooldownSeconds: 0, maxDailyLoss: 0 },
    position_limits: null,
    full_day_blocked: false,
    ghost_mode: false,
    sentinel_emergency_mode: false,
  });
  // Tell all content scripts the app is disconnected - disable everything
  const urls = ['https://trader.tradovate.com/*', 'https://app.tradesea.ai/*', 'https://topstepx.com/*', 'https://*.topstepx.com/*', 'https://www.tradingview.com/*'];
  urls.forEach(pattern => {
    chrome.tabs.query({ url: pattern }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'APP_DISCONNECTED' }).catch(() => {});
        chrome.tabs.sendMessage(tab.id, { type: 'COACH_CONFIG_UPDATE', enabled: false, maxTradesPerDay: 0, cooldownSeconds: 0, maxDailyLoss: 0 }).catch(() => {});
        chrome.tabs.sendMessage(tab.id, { type: 'SESSION_STATE_UPDATE', blocked: false, sessionHours: null }).catch(() => {});
        chrome.tabs.sendMessage(tab.id, { type: 'GHOST_MODE', enabled: false }).catch(() => {});
      });
    });
  });
  updateRules(false);
  chrome.action.setBadgeText({ text: '' });
}

function handleMessage(msg) {
  if (msg.type === 'connected' || msg.type === 'lock_state') {
    lockState = { locked: msg.locked, settings: msg.settings || null };
    updateRules(msg.locked);
    broadcastLock();
    // Clear emergency mode on reconnect
    chrome.storage.local.set({ sentinel_emergency_mode: false });
  }
  if (msg.type === 'lock_state_changed') {
    lockState.locked = msg.locked;
    updateRules(msg.locked);
    broadcastLock();
    ws?.send(JSON.stringify({ type: 'check_lock' }));
    // Clear emergency mode on state change from desktop
    chrome.storage.local.set({ sentinel_emergency_mode: false });
  }
  if (msg.type === 'session_state') { sessionState = { blocked: msg.blocked, sessionHours: msg.sessionHours, enabled: msg.enabled }; broadcastSession(); }
  if (msg.type === 'session_state_changed') { sessionState = { blocked: msg.blocked, sessionHours: msg.sessionHours, enabled: msg.enabled }; broadcastSession(); }
  if (msg.type === 'coach_config') { chrome.storage.local.set({ coach_config: msg }); broadcastCoach(msg); }
  if (msg.type === 'position_limits') { chrome.storage.local.set({ position_limits: msg }); broadcastPositionLimits(msg); }
  if (msg.type === 'full_day_block') { chrome.storage.local.set({ full_day_blocked: true }); broadcastFullBlock(); }
  if (msg.type === 'ghost_mode') { chrome.storage.local.set({ ghost_mode: msg.enabled }); broadcastGhostMode(msg.enabled); }
  if (msg.type === 'news_config') { chrome.storage.local.set({ news_config: msg }); broadcastNewsConfig(msg); }
  if (msg.type === 'sound_config') { chrome.storage.local.set({ sound_on_block: msg.soundOnBlock }); broadcastSoundConfig(msg.soundOnBlock); }
  if (msg.type === 'pong') { lockState.locked = msg.locked; }
  chrome.storage.local.set({ [STORAGE_KEYS.LOCK_STATE]: lockState });
}

async function updateRules(locked) {
  try {
    if (locked) await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['risk_api_rules'] });
    else await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['risk_api_rules'] });
  } catch {}
  const badge = locked ? 'ON' : (sessionState.blocked ? 'BLK' : '');
  chrome.action.setBadgeText({ text: badge });
  if (locked) chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  else if (sessionState.blocked) chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
}

function broadcastLock() {
  const urls = ['https://trader.tradovate.com/*', 'https://app.tradesea.ai/*', 'https://topstepx.com/*', 'https://*.topstepx.com/*', 'https://www.tradingview.com/*'];
  urls.forEach(pattern => {
    chrome.tabs.query({ url: pattern }, (tabs) => {
      tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'LOCK_STATE_UPDATE', locked: lockState.locked, settings: lockState.settings }).catch(() => {}));
    });
  });
}

function broadcastSession() {
  const urls = ['https://trader.tradovate.com/*', 'https://app.tradesea.ai/*', 'https://topstepx.com/*', 'https://*.topstepx.com/*', 'https://www.tradingview.com/*'];
  urls.forEach(pattern => {
    chrome.tabs.query({ url: pattern }, (tabs) => {
      tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'SESSION_STATE_UPDATE', blocked: sessionState.blocked, sessionHours: sessionState.sessionHours }).catch(() => {}));
    });
  });
  if (!lockState.locked) {
    chrome.action.setBadgeText({ text: sessionState.blocked ? 'BLK' : '' });
    if (sessionState.blocked) chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
  }
}

function broadcastCoach(config) {
  const urls = ['https://trader.tradovate.com/*', 'https://app.tradesea.ai/*', 'https://topstepx.com/*', 'https://*.topstepx.com/*', 'https://www.tradingview.com/*'];
  urls.forEach(pattern => {
    chrome.tabs.query({ url: pattern }, (tabs) => {
      tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'COACH_CONFIG_UPDATE', ...config }).catch(() => {}));
    });
  });
}

function broadcastPositionLimits(limitsData) {
  const urls = ['https://trader.tradovate.com/*', 'https://app.tradesea.ai/*', 'https://topstepx.com/*', 'https://*.topstepx.com/*', 'https://www.tradingview.com/*'];
  urls.forEach(pattern => {
    chrome.tabs.query({ url: pattern }, (tabs) => {
      tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'POSITION_LIMITS_UPDATE', limits: limitsData.limits, defaultMax: limitsData.defaultMax, blockedSymbols: limitsData.blockedSymbols || [], lossLimitAmount: limitsData.lossLimitAmount || 0 }).catch(() => {}));
    });
  });
}

function broadcastFullBlock() {
  const urls = ['https://trader.tradovate.com/*', 'https://app.tradesea.ai/*', 'https://topstepx.com/*', 'https://*.topstepx.com/*', 'https://www.tradingview.com/*'];
  urls.forEach(pattern => {
    chrome.tabs.query({ url: pattern }, (tabs) => {
      tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'FULL_DAY_BLOCK' }).catch(() => {}));
    });
  });
}

function broadcastGhostMode(enabled) {
  const urls = ['https://trader.tradovate.com/*', 'https://app.tradesea.ai/*', 'https://topstepx.com/*', 'https://*.topstepx.com/*', 'https://www.tradingview.com/*'];
  urls.forEach(pattern => {
    chrome.tabs.query({ url: pattern }, (tabs) => {
      tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'GHOST_MODE', enabled }).catch(() => {}));
    });
  });
}

function broadcastNewsConfig(config) {
  const urls = ['https://trader.tradovate.com/*', 'https://app.tradesea.ai/*', 'https://topstepx.com/*', 'https://*.topstepx.com/*', 'https://www.tradingview.com/*'];
  urls.forEach(pattern => {
    chrome.tabs.query({ url: pattern }, (tabs) => {
      tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'NEWS_CONFIG', ...config }).catch(() => {}));
    });
  });
}

function broadcastSoundConfig(soundOnBlock) {
  const urls = ['https://trader.tradovate.com/*', 'https://app.tradesea.ai/*', 'https://topstepx.com/*', 'https://*.topstepx.com/*', 'https://www.tradingview.com/*'];
  urls.forEach(pattern => {
    chrome.tabs.query({ url: pattern }, (tabs) => {
      tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'SOUND_CONFIG', soundOnBlock }).catch(() => {}));
    });
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'GET_LOCK_STATE':
      sendResponse(lockState);
      break;
    case 'GET_SESSION_STATE':
      sendResponse(sessionState);
      break;
    case 'GET_COACH_CONFIG':
      chrome.storage.local.get('coach_config', (r) => {
        sendResponse(r.coach_config || { enabled: false, maxTradesPerDay: 0, cooldownSeconds: 0, maxDailyLoss: 0 });
      });
      return true; // Keep channel open for async response
    case 'GET_CONNECTION_STATUS':
      sendResponse({ connected: ws?.readyState === WebSocket.OPEN, locked: lockState.locked, sessionBlocked: sessionState.blocked });
      break;
    case 'REPORT_BYPASS_ATTEMPT':
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'report_bypass', details: msg.details }));
      } else {
        // WebSocket not connected - queue the report for when it reconnects
        chrome.storage.local.get('pending_bypass_reports', (r) => {
          const pending = r.pending_bypass_reports || [];
          pending.push({ details: msg.details, timestamp: Date.now() });
          chrome.storage.local.set({ pending_bypass_reports: pending });
        });
      }
      sendResponse({ success: true });
      break;
    case 'TILT_UPDATE':
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'tilt_update', score: msg.score, level: msg.level, blocked: msg.blocked }));
      sendResponse({ success: true });
      break;
    case 'TRADE_FILL':
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'trade_fill', symbol: msg.symbol, size: msg.size, direction: msg.direction, entryTime: msg.entryTime, exitTime: msg.exitTime, pnl: msg.pnl, result: msg.result }));
      sendResponse({ success: true });
      break;
    case 'REPORT_SETTINGS_ACCESS':
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'report_settings_access', url: msg.url }));
      sendResponse({ success: true });
      break;
    case 'TRADOVATE_SETTINGS_READ':
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'tradovate_settings_read', settings: msg.settings }));
      sendResponse({ success: true });
      break;
    case 'FORCE_RECONNECT':
      connectToDesktopApp();
      sendResponse({ success: true });
      break;
    default:
      sendResponse({ error: 'Unknown message type' });
  }
  return false;
});

// Check session state every minute
setInterval(() => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
    ws.send(JSON.stringify({ type: 'check_session' }));
  }
}, 30000);

connectToDesktopApp();
chrome.runtime.onInstalled.addListener(() => connectToDesktopApp());
