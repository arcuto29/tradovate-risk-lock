import { WS_URL, WS_RECONNECT_INTERVAL, STORAGE_KEYS } from '../shared/constants.js';

let ws = null;
let lockState = { locked: false, settings: null };
let reconnectTimer = null;

function connectToDesktopApp() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;
  try {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { chrome.storage.local.set({ [STORAGE_KEYS.CONNECTION_STATUS]: true }); ws.send(JSON.stringify({ type: 'check_lock' })); };
    ws.onmessage = (event) => { try { handleMessage(JSON.parse(event.data)); } catch {} };
    ws.onclose = () => { ws = null; chrome.storage.local.set({ [STORAGE_KEYS.CONNECTION_STATUS]: false }); scheduleReconnect(); };
    ws.onerror = () => { ws = null; scheduleReconnect(); };
  } catch { scheduleReconnect(); }
}

function scheduleReconnect() { if (reconnectTimer) return; reconnectTimer = setTimeout(() => { reconnectTimer = null; connectToDesktopApp(); }, WS_RECONNECT_INTERVAL); }

function handleMessage(msg) {
  if (msg.type === 'connected' || msg.type === 'lock_state') { lockState = { locked: msg.locked, settings: msg.settings || null }; updateRules(msg.locked); broadcast(); }
  if (msg.type === 'lock_state_changed') { lockState.locked = msg.locked; updateRules(msg.locked); broadcast(); ws?.send(JSON.stringify({ type: 'check_lock' })); }
  if (msg.type === 'pong') { lockState.locked = msg.locked; }
  chrome.storage.local.set({ [STORAGE_KEYS.LOCK_STATE]: lockState });
}

async function updateRules(locked) {
  try {
    if (locked) await chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['risk_api_rules'] });
    else await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['risk_api_rules'] });
  } catch {}
  chrome.action.setBadgeText({ text: locked ? 'ON' : '' });
  if (locked) chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
}

function broadcast() {
  chrome.tabs.query({ url: 'https://trader.tradovate.com/*' }, (tabs) => {
    tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'LOCK_STATE_UPDATE', locked: lockState.locked, settings: lockState.settings }).catch(() => {}));
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_LOCK_STATE') sendResponse(lockState);
  if (msg.type === 'GET_CONNECTION_STATUS') sendResponse({ connected: ws?.readyState === WebSocket.OPEN, locked: lockState.locked });
  if (msg.type === 'REPORT_BYPASS_ATTEMPT') { ws?.send(JSON.stringify({ type: 'report_bypass', details: msg.details })); sendResponse({ success: true }); }
  if (msg.type === 'REPORT_SETTINGS_ACCESS') { ws?.send(JSON.stringify({ type: 'report_settings_access', url: msg.url })); sendResponse({ success: true }); }
  if (msg.type === 'FORCE_RECONNECT') { connectToDesktopApp(); sendResponse({ success: true }); }
  return true;
});

setInterval(() => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 30000);
connectToDesktopApp();
chrome.runtime.onInstalled.addListener(() => connectToDesktopApp());
