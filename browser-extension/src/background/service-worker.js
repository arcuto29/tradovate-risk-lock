import { WS_URL, WS_RECONNECT_INTERVAL, STORAGE_KEYS } from '../shared/constants.js';

let ws = null;
let lockState = { locked: false, settings: null };
let sessionState = { blocked: false, sessionHours: null, enabled: false };
let reconnectTimer = null;

function connectToDesktopApp() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { chrome.storage.local.set({ [STORAGE_KEYS.CONNECTION_STATUS]: true }); ws.send(JSON.stringify({ type: 'check_lock' })); ws.send(JSON.stringify({ type: 'check_session' })); };
    ws.onmessage = (event) => { try { handleMessage(JSON.parse(event.data)); } catch {} };
    ws.onclose = () => { ws = null; chrome.storage.local.set({ [STORAGE_KEYS.CONNECTION_STATUS]: false }); scheduleReconnect(); };
    ws.onerror = () => { ws = null; scheduleReconnect(); };
  } catch { scheduleReconnect(); }
}

function scheduleReconnect() { if (reconnectTimer) return; reconnectTimer = setTimeout(() => { reconnectTimer = null; connectToDesktopApp(); }, WS_RECONNECT_INTERVAL); }

function handleMessage(msg) {
  if (msg.type === 'connected' || msg.type === 'lock_state') { lockState = { locked: msg.locked, settings: msg.settings || null }; updateRules(msg.locked); broadcastLock(); }
  if (msg.type === 'lock_state_changed') { lockState.locked = msg.locked; updateRules(msg.locked); broadcastLock(); ws?.send(JSON.stringify({ type: 'check_lock' })); }
  if (msg.type === 'session_state') { sessionState = { blocked: msg.blocked, sessionHours: msg.sessionHours, enabled: msg.enabled }; broadcastSession(); }
  if (msg.type === 'session_state_changed') { sessionState = { blocked: msg.blocked, sessionHours: msg.sessionHours, enabled: msg.enabled }; broadcastSession(); }
  if (msg.type === 'coach_config') { chrome.storage.local.set({ coach_config: msg }); broadcastCoach(msg); }
  if (msg.type === 'position_limits') { chrome.storage.local.set({ position_limits: msg }); broadcastPositionLimits(msg); }
  if (msg.type === 'full_day_block') { chrome.storage.local.set({ full_day_blocked: true }); broadcastFullBlock(); }
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
  chrome.tabs.query({ url: 'https://trader.tradovate.com/*' }, (tabs) => {
    tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'LOCK_STATE_UPDATE', locked: lockState.locked, settings: lockState.settings }).catch(() => {}));
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
      tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'POSITION_LIMITS_UPDATE', limits: limitsData.limits, defaultMax: limitsData.defaultMax, blockedSymbols: limitsData.blockedSymbols || [] }).catch(() => {}));
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
        sendResponse(r.coach_config || { enabled: true, maxTradesPerDay: 10, cooldownSeconds: 120, maxDailyLoss: 500 });
      });
      return true; // Keep channel open for async response
    case 'GET_CONNECTION_STATUS':
      sendResponse({ connected: ws?.readyState === WebSocket.OPEN, locked: lockState.locked, sessionBlocked: sessionState.blocked });
      break;
    case 'REPORT_BYPASS_ATTEMPT':
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'report_bypass', details: msg.details }));
      sendResponse({ success: true });
      break;
    case 'TILT_UPDATE':
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'tilt_update', score: msg.score, level: msg.level, blocked: msg.blocked }));
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
