/**
 * Page-level interceptor for Tradovate Risk Lock.
 * Injected into the PAGE context to intercept fetch/XHR calls.
 *
 * DISCOVERY: Tradovate saves risk settings via:
 * PUT https://risk-monitor-api-demo.ninjatrader.com/risk-settings/{accountId}
 * PUT https://risk-monitor-api.ninjatrader.com/risk-settings/{accountId}
 * 
 * AUTO-SYNC: Also reads GET responses from the same endpoint to automatically
 * capture the user's current risk settings and send them to the desktop app.
 * 
 * This is a regular fetch() call, NOT WebSocket.
 * The domain is ninjatrader.com (NinjaTrader owns Tradovate).
 */
(function() {
  'use strict';

  let isLocked = false; // Start unlocked — only block when we KNOW it's locked
  let lockedSettings = null;
  let stateReceived = false;

  // Listen for lock state updates from the content script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_LOCK_STATE') {
      isLocked = event.data.locked;
      lockedSettings = event.data.settings;
      stateReceived = true;
      console.log('[TradovateRiskLock-Injector] Lock state:', isLocked, lockedSettings);
    }
  });

  // ─── Intercept fetch() ─────────────────────────────────────────────────────
  const origFetch = window.fetch;
  window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const options = typeof args[0] === 'string' ? args[1] : args[0];

    if (isRiskSettingsUrl(url)) {
      const method = (options?.method || 'GET').toUpperCase();

      // AUTO-SYNC: Intercept GET responses to read current risk settings
      if (method === 'GET') {
        return origFetch.apply(this, args).then(response => {
          const clone = response.clone();
          clone.json().then(data => {
            if (data && typeof data === 'object') {
              console.log('[TradovateRiskLock-Injector] Read current risk settings:', data);
              window.postMessage({ type: 'TRL_RISK_SETTINGS_READ', settings: data }, '*');
            }
          }).catch(() => {});
          return response;
        });
      }

      // BLOCK: Only block PUT/POST (modifications) when locked
      if (isLocked && (method === 'PUT' || method === 'POST')) {
        let body = null;
        if (options?.body) {
          if (typeof options.body === 'string') {
            try { body = JSON.parse(options.body); } catch {}
          }
        }

        if (isWeakeningChange(body)) {
          console.log('[TradovateRiskLock-Injector] BLOCKED:', method, url, body);
          window.postMessage({ type: 'TRL_BLOCKED', endpoint: url, body: JSON.stringify(body)?.substring(0, 300) }, '*');
          return Promise.reject(new Error('Blocked by Tradovate Risk Lock'));
        } else {
          console.log('[TradovateRiskLock-Injector] ALLOWED (tightening):', method, url);
          window.postMessage({ type: 'TRL_ALLOWED', endpoint: url }, '*');
        }
      }
    }

    return origFetch.apply(this, args);
  };

  // ─── Intercept XMLHttpRequest ──────────────────────────────────────────────
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._trlUrl = url;
    this._trlMethod = method;
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(body) {
    if (isLocked && isRiskSettingsUrl(this._trlUrl)) {
      const method = (this._trlMethod || 'GET').toUpperCase();
      if (method === 'PUT' || method === 'POST') {
        let parsed = null;
        if (typeof body === 'string') { try { parsed = JSON.parse(body); } catch {} }

        if (isWeakeningChange(parsed)) {
          console.log('[TradovateRiskLock-Injector] BLOCKED XHR:', this._trlUrl, parsed);
          window.postMessage({ type: 'TRL_BLOCKED', endpoint: this._trlUrl, body: JSON.stringify(parsed)?.substring(0, 300) }, '*');
          return; // Block
        }
      }
    }
    return origSend.call(this, body);
  };

  // ─── URL Detection ─────────────────────────────────────────────────────────
  function isRiskSettingsUrl(url) {
    if (!url) return false;
    return (
      url.includes('risk-monitor-api') && url.includes('risk-settings') ||
      url.includes('ninjatrader.com') && url.includes('risk-settings') ||
      url.includes('tradovateapi.com') && url.includes('userAccountRiskParameter') ||
      url.includes('tradovateapi.com') && url.includes('userAccountPositionLimit') ||
      url.includes('tradovateapi.com') && url.includes('userAccountAutoLiq')
    );
  }

  // ─── Weakening Logic ───────────────────────────────────────────────────────
  function isWeakeningChange(body) {
    if (!body || typeof body !== 'object') return true;

    if (lockedSettings) {
      // maxLossPerTrade: block if INCREASED (allows more loss)
      if (body.maxLossPerTrade !== undefined && lockedSettings.dailyLossLimit > 0) {
        if (body.maxLossPerTrade > lockedSettings.dailyLossLimit) return true;
        if (body.maxLossPerTrade === 0 || body.maxLossPerTrade === null) return true;
      }

      // dailyLossLimit: block if INCREASED
      if (body.dailyLossLimit !== undefined && lockedSettings.dailyLossLimit > 0) {
        if (body.dailyLossLimit > lockedSettings.dailyLossLimit) return true;
        if (body.dailyLossLimit === 0) return true;
      }

      // maxProfitPerTrade / dailyProfitTrigger: block if INCREASED (harder to hit = weaker protection)
      if (body.maxProfitPerTrade !== undefined && lockedSettings.dailyProfitTarget > 0) {
        if (body.maxProfitPerTrade > lockedSettings.dailyProfitTarget) return true;
        if (body.maxProfitPerTrade === 0 || body.maxProfitPerTrade === null) return true;
      }

      if (body.dailyProfitTrigger !== undefined && lockedSettings.dailyProfitTarget > 0) {
        if (body.dailyProfitTrigger > lockedSettings.dailyProfitTarget) return true;
        if (body.dailyProfitTrigger === 0) return true;
      }

      // maxLimitInTrade / maxPositionSize: block if INCREASED
      if (body.maxLimitInTrade !== undefined && lockedSettings.maxContracts > 0) {
        if (body.maxLimitInTrade > lockedSettings.maxContracts) return true;
        if (body.maxLimitInTrade === null) return true;
      }

      if (body.maxPositionSize !== undefined && lockedSettings.maxContracts > 0) {
        if (body.maxPositionSize > lockedSettings.maxContracts) return true;
      }

      // maxLossPerDay (weekly variant)
      if (body.maxLossPerDay !== undefined && lockedSettings.dailyLossLimit > 0) {
        if (body.maxLossPerDay > lockedSettings.dailyLossLimit) return true;
        if (body.maxLossPerDay === 0 || body.maxLossPerDay === null) return true;
      }

      // Lock toggles: block if disabled
      if (body.lockRiskSettings === false) return true;
      if (body.active === false) return true;
    }

    // No settings to compare — block unless it's a lock action
    if (!lockedSettings) {
      if (body.lockRiskSettings === true || body.active === true) return false;
      return true;
    }

    return false;
  }

  console.log('[TradovateRiskLock-Injector] Fetch interceptor installed. Monitoring risk-monitor-api + tradovateapi.');
})();
