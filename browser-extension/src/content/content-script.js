/**
 * Content Script - Tradovate Risk Lock (Directional Blocking)
 *
 * Does NOT block all access to risk settings. Only blocks API calls that WEAKEN protection.
 * Allows: tightening limits, locking account after a win, enabling lock toggles.
 * Blocks: increasing loss limits, removing limits, disabling locks.
 */
(function() {
  'use strict';
  let isLocked = false, lockedSettings = null, overlayShown = false, observer = null, checkInterval = null;
  const BANNER_ID = 'trl-warning-banner';

  chrome.runtime.sendMessage({ type: 'GET_LOCK_STATE' }, (r) => { if (r) { isLocked = r.locked; lockedSettings = r.settings; if (isLocked) startMonitoring(); } });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'LOCK_STATE_UPDATE') { const was = isLocked; isLocked = msg.locked; lockedSettings = msg.settings; if (isLocked && !was) startMonitoring(); else if (!isLocked && was) { stopMonitoring(); hideOverlay(); removeBanner(); } }
  });

  function startMonitoring() {
    if (observer) return;
    interceptNetworkRequests();
    observer = new MutationObserver((muts) => { if (!isLocked) return; muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) checkForRisk(n); })); });
    observer.observe(document.body, { childList: true, subtree: true });
    checkInterval = setInterval(scanPage, 3000);
    scanPage();
  }

  function stopMonitoring() { if (observer) { observer.disconnect(); observer = null; } if (checkInterval) { clearInterval(checkInterval); checkInterval = null; } }

  function checkForRisk(el) {
    if (!isLocked) return;
    const t = el.textContent?.toLowerCase() || '';
    const kws = ['daily loss limit','weekly loss limit','daily profit trigger','risk settings','position limit'];
    if (kws.filter(k => t.includes(k)).length >= 2) showBanner();
  }

  function scanPage() {
    if (!isLocked) return;
    document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
      const t = h.textContent?.toLowerCase() || '';
      if ((t.includes('risk settings') || t.includes('risk parameters')) && h.getBoundingClientRect().width > 0) showBanner();
    });
  }

  function showBanner() {
    if (document.getElementById(BANNER_ID)) return;
    const b = document.createElement('div'); b.id = BANNER_ID;
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483646;background:linear-gradient(135deg,#7c2d12,#991b1b);color:#fef2f2;padding:14px 20px;font-family:-apple-system,sans-serif;font-size:14px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;gap:12px;';
    b.innerHTML = '<span style="font-size:20px">&#9888;</span><span><strong>Risk Lock Active</strong> — You can tighten limits or lock your account, but you <strong>cannot</strong> weaken or remove limits until reset.</span>';
    document.body.prepend(b);
  }
  function removeBanner() { document.getElementById(BANNER_ID)?.remove(); }

  function interceptNetworkRequests() {
    // Intercept fetch (backup - Tradovate primarily uses WebSocket)
    const origFetch = window.fetch;
    window.fetch = function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (isLocked && isRiskUrl(url)) {
        const body = getBody(args[1]);
        if (isWeakening(url, body)) { report(url, body); showOverlay(); return Promise.reject(new Error('Blocked by Risk Lock')); }
        reportAllowed(url);
      }
      return origFetch.apply(this, args);
    };

    // Intercept XHR (backup)
    const origOpen = XMLHttpRequest.prototype.open, origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(m, url, ...r) { this._trl = url; return origOpen.call(this, m, url, ...r); };
    XMLHttpRequest.prototype.send = function(body) {
      if (isLocked && isRiskUrl(this._trl)) {
        let parsed = null; if (typeof body === 'string') try { parsed = JSON.parse(body); } catch {}
        if (isWeakening(this._trl, parsed)) { report(this._trl, parsed); showOverlay(); return; }
        reportAllowed(this._trl);
      }
      return origSend.call(this, body);
    };

    // Intercept WebSocket - THIS IS THE MAIN ONE
    // Tradovate uses WebSocket for all API calls including risk settings
    // Format: "endpoint\nrequestId\nqueryParams\njsonBody"
    const OrigWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = protocols ? new OrigWebSocket(url, protocols) : new OrigWebSocket(url);

      const origSendWs = ws.send.bind(ws);
      ws.send = function(data) {
        if (isLocked && typeof data === 'string') {
          // Tradovate WebSocket format: "endpoint\nrequestId\nqueryParams\njsonBody"
          const lines = data.split('\n');
          const endpoint = lines[0] || '';

          if (isRiskEndpoint(endpoint)) {
            // Parse the JSON body (4th line)
            let body = null;
            if (lines.length >= 4 && lines[3]) {
              try { body = JSON.parse(lines[3]); } catch {}
            }

            if (isWeakening(endpoint, body)) {
              report('WS: ' + endpoint, body);
              showOverlay();
              console.log('[TradovateRiskLock] BLOCKED WebSocket:', endpoint, body);
              return; // Block the message from being sent
            }
            reportAllowed('WS: ' + endpoint);
            console.log('[TradovateRiskLock] ALLOWED WebSocket:', endpoint);
          }
        }
        return origSendWs(data);
      };

      return ws;
    };
    // Copy over static properties
    window.WebSocket.CONNECTING = OrigWebSocket.CONNECTING;
    window.WebSocket.OPEN = OrigWebSocket.OPEN;
    window.WebSocket.CLOSING = OrigWebSocket.CLOSING;
    window.WebSocket.CLOSED = OrigWebSocket.CLOSED;
    window.WebSocket.prototype = OrigWebSocket.prototype;
  }

  function isRiskEndpoint(endpoint) {
    const riskEndpoints = [
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
    return riskEndpoints.some(r => endpoint.includes(r));
  }

  function getBody(opts) { if (!opts?.body) return null; if (typeof opts.body === 'string') try { return JSON.parse(opts.body); } catch {} return null; }
  function isRiskUrl(url) { if (!url) return false; return ['userAccountRiskParameter/','userAccountPositionLimit/','userAccountAutoLiq/'].some(p => url.includes(p) && (url.includes('/update') || url.includes('/create') || url.includes('/delete'))); }

  function isWeakening(url, body) {
    if (url.includes('/delete')) return true;
    if (!body || typeof body !== 'object') return true;
    if (lockedSettings) {
      if (body.dailyLossLimit !== undefined && lockedSettings.dailyLossLimit > 0) { if (body.dailyLossLimit > lockedSettings.dailyLossLimit || body.dailyLossLimit === 0) return true; }
      if (body.dailyProfitTrigger !== undefined && lockedSettings.dailyProfitTarget > 0) { if (body.dailyProfitTrigger > lockedSettings.dailyProfitTarget || body.dailyProfitTrigger === 0) return true; }
      if (body.maxPositionSize !== undefined && lockedSettings.maxContracts > 0) { if (body.maxPositionSize > lockedSettings.maxContracts) return true; }
      if (body.lockRiskSettings === false) return true;
      if (body.active === false) return true;
    }
    if (!lockedSettings) { if (body.lockRiskSettings === true || body.active === true) return false; return true; }
    return false;
  }

  function showOverlay() {
    if (overlayShown) return; overlayShown = true;
    const o = document.createElement('div'); o.id = 'tradovate-risk-lock-overlay';
    o.innerHTML = `<div class="trl-overlay-content">
      <div class="trl-alert-badge">&#9679; GUARDIAN &bull; ALERT</div>
      <h1>LIMIT<br>TAMPERED</h1>
      <p class="trl-message">You attempted to raise your risk limits.<br>Guardian detected it and blocked you.<br>Session is locked.</p>
      <p class="trl-unlock-label">UNLOCKS IN</p>
      <p class="trl-countdown" id="trl-countdown">--:--:--</p>
      <button id="trl-dismiss-btn" class="trl-dismiss-btn">Dismiss</button>
      <p class="trl-footer">This attempt has been recorded.</p>
    </div>`;
    document.body.appendChild(o);
    document.getElementById('trl-dismiss-btn').onclick = hideOverlay;
    updateCountdown();
    const ci = setInterval(() => { if (!document.getElementById('trl-countdown')) { clearInterval(ci); return; } updateCountdown(); }, 1000);
    setTimeout(hideOverlay, 30000);
  }

  function updateCountdown() {
    const el = document.getElementById('trl-countdown');
    if (!el || !lockedSettings) return;
    const now = new Date();
    const rh = parseInt(lockedSettings.resetTime?.split(':')[0] || '17');
    const rm = parseInt(lockedSettings.resetTime?.split(':')[1] || '0');
    const reset = new Date(); reset.setHours(rh, rm, 0, 0);
    if (reset <= now) reset.setDate(reset.getDate() + 1);
    const diff = Math.max(0, Math.floor((reset.getTime() - now.getTime()) / 1000));
    const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
    el.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  }
  function hideOverlay() { document.getElementById('tradovate-risk-lock-overlay')?.remove(); overlayShown = false; }

  function report(url, body) { chrome.runtime.sendMessage({ type: 'REPORT_BYPASS_ATTEMPT', details: `BLOCKED: ${url} | ${JSON.stringify(body)?.substring(0,200)}` }); }
  function reportAllowed(url) { chrome.runtime.sendMessage({ type: 'REPORT_SETTINGS_ACCESS', url: `ALLOWED: ${url}` }); }

  console.log('[TradovateRiskLock] Loaded — directional blocking. Tightening allowed, weakening blocked.');
})();
