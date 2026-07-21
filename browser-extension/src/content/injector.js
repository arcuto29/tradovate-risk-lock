/**
 * Page-level WebSocket interceptor for Tradovate Risk Lock.
 * This script is injected into the PAGE context (not the content script isolated world)
 * so it can actually intercept WebSocket.send() calls made by Tradovate's code.
 *
 * Communication with the content script happens via window.postMessage.
 */
(function() {
  'use strict';

  const RISK_ENDPOINTS = [
    'userAccountRiskParameter/update',
    'userAccountRiskParameter/create',
    'userAccountRiskParameter/delete',
    'userAccountPositionLimit/update',
    'userAccountPositionLimit/create',
    'userAccountPositionLimit/delete',
    'userAccountAutoLiq/update',
    'userAccountAutoLiq/create',
    'userAccountAutoLiq/delete',
  ];

  let isLocked = false;
  let lockedSettings = null;

  // Listen for lock state updates from the content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_LOCK_STATE') {
      isLocked = event.data.locked;
      lockedSettings = event.data.settings;
      console.log('[TradovateRiskLock-Injector] Lock state:', isLocked, lockedSettings);
    }
  });

  // Intercept WebSocket constructor
  const OrigWebSocket = window.WebSocket;
  const origSendDescriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'send');

  // Override WebSocket.prototype.send so ALL WebSocket instances are intercepted
  const origSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function(data) {
    if (isLocked && typeof data === 'string' && data.length > 0) {
      // Tradovate WS format: "endpoint\nrequestId\nqueryParams\njsonBody"
      const firstNewline = data.indexOf('\n');
      if (firstNewline > 0) {
        const endpoint = data.substring(0, firstNewline);

        if (RISK_ENDPOINTS.some(r => endpoint.includes(r))) {
          // Parse body
          const lines = data.split('\n');
          let body = null;
          if (lines.length >= 4 && lines[3]) {
            try { body = JSON.parse(lines[3]); } catch {}
          }

          if (isWeakeningChange(endpoint, body)) {
            console.log('[TradovateRiskLock-Injector] BLOCKED:', endpoint, body);
            // Notify content script
            window.postMessage({ type: 'TRL_BLOCKED', endpoint, body: JSON.stringify(body)?.substring(0, 300) }, '*');
            return; // DROP the message - never reaches server
          } else {
            console.log('[TradovateRiskLock-Injector] ALLOWED (tightening):', endpoint);
            window.postMessage({ type: 'TRL_ALLOWED', endpoint }, '*');
          }
        }
      }
    }
    return origSend.call(this, data);
  };

  function isWeakeningChange(endpoint, body) {
    // DELETE = always weakening
    if (endpoint.includes('/delete')) return true;

    // No body or unparseable = block to be safe
    if (!body || typeof body !== 'object') return true;

    if (lockedSettings) {
      // Daily loss limit: block if INCREASED or removed
      if (body.dailyLossLimit !== undefined && lockedSettings.dailyLossLimit > 0) {
        if (body.dailyLossLimit > lockedSettings.dailyLossLimit) return true;
        if (body.dailyLossLimit === 0) return true;
      }

      // Daily profit trigger: block if INCREASED (higher = harder to hit) or removed
      if (body.dailyProfitTrigger !== undefined && lockedSettings.dailyProfitTarget > 0) {
        if (body.dailyProfitTrigger > lockedSettings.dailyProfitTarget) return true;
        if (body.dailyProfitTrigger === 0) return true;
      }

      // Max position size: block if INCREASED
      if (body.maxPositionSize !== undefined && lockedSettings.maxContracts > 0) {
        if (body.maxPositionSize > lockedSettings.maxContracts) return true;
      }

      // Lock toggle: block if being DISABLED
      if (body.lockRiskSettings === false) return true;
      if (body.active === false) return true;
    }

    // No locked settings to compare = block everything except explicit lock actions
    if (!lockedSettings) {
      if (body.lockRiskSettings === true || body.active === true) return false;
      return true;
    }

    // Not weakening
    return false;
  }

  console.log('[TradovateRiskLock-Injector] WebSocket interceptor installed.');
})();
