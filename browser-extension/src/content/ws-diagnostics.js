/**
 * WebSocket Diagnostics - MAIN WORLD
 * Observes all outbound WebSocket frames for order identification.
 * Does NOT block any messages. Purely diagnostic.
 * 
 * Dev Mode only. Disabled by default.
 */
(function() {
  'use strict';

  // ═══ Configuration ════════════════════════════════════════════════════════
  var WS_DIAG_ENABLED = false;
  var wsLog = [];
  var wsSocketId = 0;
  var MAX_LOG_ENTRIES = 500;
  var MAX_PREVIEW_LENGTH = 200;

  // Action label for manual test correlation
  var currentTestAction = 'NONE';
  var VALID_ACTIONS = ['BUY_OPEN', 'SELL_OPEN', 'CLOSE_LONG', 'CLOSE_SHORT',
    'PARTIAL_REDUCE', 'REVERSE', 'CANCEL', 'MOVE_STOP', 'MOVE_TARGET',
    'FLATTEN', 'NONE'];

  // Socket registry (WeakMap so GC can clean up closed sockets)
  var socketRegistry = new WeakMap();
  var socketList = []; // Keep references for inspection

  // ═══ Sensitive data patterns to redact ════════════════════════════════════
  var REDACT_PATTERNS = [
    /("auth[^"]*"\s*:\s*)"[^"]+"/gi,
    /("token[^"]*"\s*:\s*)"[^"]+"/gi,
    /("session[^"]*[Ii]d"\s*:\s*)"[^"]+"/gi,
    /("cookie[^"]*"\s*:\s*)"[^"]+"/gi,
    /("account[^"]*[Ii]d"\s*:\s*)"?\d{4,}"?/gi,
    /("user[^"]*[Ii]d"\s*:\s*)"[^"]+"/gi,
    /("email"\s*:\s*)"[^"]+"/gi,
    /("password"\s*:\s*)"[^"]+"/gi,
  ];

  function redactPreview(text) {
    if (!text || typeof text !== 'string') return '';
    var preview = text.substring(0, MAX_PREVIEW_LENGTH);
    for (var i = 0; i < REDACT_PATTERNS.length; i++) {
      preview = preview.replace(REDACT_PATTERNS[i], '$1"[REDACTED]"');
    }
    // Redact long numeric sequences (account IDs)
    preview = preview.replace(/\d{6,}/g, '[ID]');
    if (text.length > MAX_PREVIEW_LENGTH) preview += '...[truncated]';
    return preview;
  }

  function sanitizeUrl(url) {
    if (!url) return 'unknown';
    try {
      var parsed = new URL(url);
      // Keep hostname + path, redact query params
      return parsed.hostname + parsed.pathname.replace(/\d{4,}/g, '[ID]');
    } catch(e) {
      return url.split('?')[0].replace(/\d{4,}/g, '[ID]');
    }
  }

  function getPayloadType(data) {
    if (data === null || data === undefined) return 'empty';
    if (typeof data === 'string') return 'text';
    if (data instanceof ArrayBuffer) return 'arraybuffer';
    if (data instanceof Blob) return 'blob';
    if (data instanceof Uint8Array || ArrayBuffer.isView(data)) return 'typedarray';
    return 'unknown';
  }

  function getPayloadLength(data) {
    if (!data) return 0;
    if (typeof data === 'string') return data.length;
    if (data instanceof ArrayBuffer) return data.byteLength;
    if (data instanceof Blob) return data.size;
    if (ArrayBuffer.isView(data)) return data.byteLength;
    return 0;
  }

  // ═══ Tradovate WebSocket Message Parser ════════════════════════════════════
  // Format: "endpoint\nrequestId\n\n{jsonBody}"
  // Order endpoints: order/placeorder, order/placeOCO, order/placeOSO
  // Cancel: order/cancelorder
  // Modify: order/modifyorder
  // Close: order/placeorder with isClose or liquidatePosition
  
  var TRADOVATE_ORDER_ENDPOINTS = ['order/placeorder', 'order/placeoco', 'order/placeoso'];
  var TRADOVATE_CANCEL_ENDPOINTS = ['order/cancelorder'];
  var TRADOVATE_MODIFY_ENDPOINTS = ['order/modifyorder'];
  var TRADOVATE_CLOSE_ENDPOINTS = ['order/liquidateposition', 'position/liquidateposition'];

  function parseTradovateWsMessage(data) {
    if (!data || typeof data !== 'string') return null;
    
    // Split by \n - format is: endpoint\nid\n\n{json}
    var parts = data.split('\n');
    if (parts.length < 3) return null;
    
    var endpoint = (parts[0] || '').toLowerCase().trim();
    var requestId = parts[1] || '';
    
    // Check if this is a trading-related endpoint
    var isOrder = TRADOVATE_ORDER_ENDPOINTS.some(function(e) { return endpoint === e; });
    var isCancel = TRADOVATE_CANCEL_ENDPOINTS.some(function(e) { return endpoint === e; });
    var isModify = TRADOVATE_MODIFY_ENDPOINTS.some(function(e) { return endpoint === e; });
    var isClose = TRADOVATE_CLOSE_ENDPOINTS.some(function(e) { return endpoint === e; });
    
    if (!isOrder && !isCancel && !isModify && !isClose) return null;
    
    // Parse the JSON body (after the double newline)
    var jsonStr = '';
    var doubleNewline = data.indexOf('\n\n');
    if (doubleNewline >= 0) {
      jsonStr = data.substring(doubleNewline + 2);
    }
    
    var body = null;
    try { body = JSON.parse(jsonStr); } catch(e) { return null; }
    if (!body) return null;
    
    return {
      isOrder: isOrder || isClose,
      isCancel: isCancel,
      isModify: isModify,
      isClose: isClose,
      endpoint: endpoint,
      requestId: requestId,
      action: body.action || '', // Buy, Sell
      symbol: body.symbol || '',
      qty: body.orderQty || body.qty || 1,
      orderType: body.orderType || 'Market',
      timeInForce: body.timeInForce || 'Day',
      isLiquidate: endpoint.includes('liquidate'),
      body: body,
    };
  }

  function evaluateTradovateOrder(parsed) {
    if (!parsed) return { allow: true, reason: 'No parsed data', classification: 'UNKNOWN' };
    
    // CANCEL: Always allow
    if (parsed.isCancel) {
      return { allow: true, reason: 'Cancel order - always allowed', classification: 'CANCEL_ORDER' };
    }
    
    // CLOSE/LIQUIDATE: Always allow (exit safety)
    if (parsed.isClose || parsed.isLiquidate) {
      return { allow: true, reason: 'Close/liquidate - always allowed (exit safety)', classification: 'CLOSE_POSITION' };
    }
    
    // MODIFY: Allow (usually stop/TP changes)
    if (parsed.isModify) {
      return { allow: true, reason: 'Modify order - allowed', classification: 'MODIFY_PROTECTIVE_ORDER' };
    }
    
    // ORDER: Check against rules
    // Access the lockActive state from session-blocker-main.js via window
    var lockActive = window.__sentinelLockActive || false;
    
    if (!lockActive) {
      return { allow: true, reason: 'Not locked - all orders allowed', classification: 'OPEN_POSITION' };
    }
    
    // ─── RULE CHECKS (when locked) ──────────────────────────────────────
    
    // Full day block
    if (window.__sentinelFullDayBlocked) {
      return { allow: false, reason: 'Trading blocked for today (pre-market check)', classification: 'OPEN_POSITION' };
    }
    
    // Session block
    if (window.__sentinelSessionBlocked) {
      return { allow: false, reason: 'Outside trading hours', classification: 'OPEN_POSITION' };
    }
    
    // News block
    if (window.__sentinelNewsBlocked && window.__sentinelNewsBlocked()) {
      return { allow: false, reason: 'News event window active', classification: 'OPEN_POSITION' };
    }
    
    // Position size check
    var symbol = (parsed.symbol || '').toUpperCase();
    var qty = parsed.qty || 1;
    if (window.__sentinelGetMax) {
      var max = window.__sentinelGetMax(symbol);
      if (qty > max) {
        return { allow: false, reason: 'Position size ' + qty + ' exceeds max ' + max + ' for ' + symbol, classification: 'OPEN_POSITION' };
      }
    }
    
    // Blocked symbol
    if (window.__sentinelBlockedSymbols && window.__sentinelBlockedSymbols.length > 0) {
      for (var i = 0; i < window.__sentinelBlockedSymbols.length; i++) {
        if (symbol.includes(window.__sentinelBlockedSymbols[i].toUpperCase())) {
          return { allow: false, reason: 'Symbol ' + symbol + ' is blocked', classification: 'OPEN_POSITION' };
        }
      }
    }
    
    // Tilt meter
    if (window.__tiltMeter && window.__tiltMeter.shouldBlock()) {
      return { allow: false, reason: 'Tilt meter red - score ' + window.__tiltMeter.getScore(), classification: 'OPEN_POSITION' };
    }
    
    // All checks passed
    return { allow: true, reason: 'All rules passed', classification: 'OPEN_POSITION' };
  }

  // ═══ WebSocket.prototype.send interceptor ═════════════════════════════════
  var origWsSend = WebSocket.prototype.send;

  WebSocket.prototype.send = function(data) {
    // ─── TRADOVATE ORDER INTERCEPTION ───────────────────────────────────
    // Tradovate sends orders via WS to demo.tradovateapi.com/v1/websocket
    // Format: "endpoint\nrequestId\n\n{json}"
    // Order endpoints: order/placeorder, order/placeOCO, order/placeOSO
    // Cancel: order/cancelorder
    // Modify: order/modifyorder
    
    if (typeof data === 'string' && this.url && this.url.includes('tradovateapi.com')) {
      var parsed = parseTradovateWsMessage(data);
      if (parsed && parsed.isOrder) {
        // Check if we should block this order
        var blockDecision = evaluateTradovateOrder(parsed);
        
        if (blockDecision && !blockDecision.allow) {
          // BLOCK: Do NOT call original send
          console.log('[Sentinel] BLOCKED WebSocket order:', blockDecision.reason);
          if (typeof playBlockSound === 'function' && window.__sentinelSoundOnBlock) playBlockSound();
          window.postMessage({ type: 'TRL_ORDER_BLOCKED', reason: blockDecision.reason }, '*');
          
          // Log diagnostic
          if (WS_DIAG_ENABLED) {
            try {
              wsLog.push({
                id: 'ws_blocked_' + (++wsSocketId),
                socketUrl: sanitizeUrl(this.url),
                timestamp: new Date().toISOString(),
                payloadType: 'text',
                payloadLength: data.length,
                preview: redactPreview(data),
                testAction: currentTestAction,
                classification: blockDecision.classification,
                decision: 'BLOCKED',
                reason: blockDecision.reason,
              });
              if (wsLog.length > MAX_LOG_ENTRIES) wsLog.shift();
            } catch(e) {}
          }
          return; // Do NOT send to broker
        }
        
        // ALLOWED: Log if diagnostics enabled, then send
        if (WS_DIAG_ENABLED) {
          try {
            wsLog.push({
              id: 'ws_allowed_' + (++wsSocketId),
              socketUrl: sanitizeUrl(this.url),
              timestamp: new Date().toISOString(),
              payloadType: 'text',
              payloadLength: data.length,
              preview: redactPreview(data),
              testAction: currentTestAction,
              classification: blockDecision ? blockDecision.classification : 'ALLOWED',
              decision: 'ALLOWED',
              reason: blockDecision ? blockDecision.reason : 'passed',
            });
            if (wsLog.length > MAX_LOG_ENTRIES) wsLog.shift();
          } catch(e) {}
        }
        
        // Track order for tilt meter
        if (parsed.action === 'Buy' || parsed.action === 'Sell') {
          window.postMessage({ type: 'TRL_ORDER_PLACED', size: parsed.qty || 1, symbol: parsed.symbol, direction: parsed.action === 'Buy' ? 'Long' : 'Short' }, '*');
        }
      }
    }

    // Always call original (unless blocked above which returns early)
    var result = origWsSend.apply(this, arguments);

    // Only log if diagnostics enabled
    if (WS_DIAG_ENABLED) {
      try {
        // Register this socket if not already tracked
        if (!socketRegistry.has(this)) {
          var id = ++wsSocketId;
          var info = {
            id: id,
            url: sanitizeUrl(this.url),
            createdAt: new Date().toISOString(),
            frameCount: 0,
            actionCorrelations: {},
          };
          socketRegistry.set(this, info);
          socketList.push({ ref: this, info: info });
        }

        var socketInfo = socketRegistry.get(this);
        socketInfo.frameCount++;

        // Track action correlations
        if (currentTestAction !== 'NONE') {
          if (!socketInfo.actionCorrelations[currentTestAction]) {
            socketInfo.actionCorrelations[currentTestAction] = 0;
          }
          socketInfo.actionCorrelations[currentTestAction]++;
        }

        // Build diagnostic entry
        var payloadType = getPayloadType(data);
        var entry = {
          id: 'ws_' + socketInfo.id + '_' + socketInfo.frameCount,
          socketId: socketInfo.id,
          socketUrl: socketInfo.url,
          timestamp: new Date().toISOString(),
          payloadType: payloadType,
          payloadLength: getPayloadLength(data),
          preview: payloadType === 'text' ? redactPreview(data) : '[binary ' + getPayloadLength(data) + ' bytes]',
          testAction: currentTestAction,
        };

        wsLog.push(entry);
        if (wsLog.length > MAX_LOG_ENTRIES) wsLog.shift();

        // Console output for real-time observation
        if (currentTestAction !== 'NONE') {
          console.log('[Sentinel WS Diag] [' + currentTestAction + '] Socket#' + socketInfo.id + ' ' + payloadType + ' ' + getPayloadLength(data) + 'b → ' + entry.preview.substring(0, 80));
        }
      } catch(e) {
        // Diagnostic failure must NEVER affect WebSocket
      }
    }

    return result;
  };

  // ═══ Track new WebSocket connections ══════════════════════════════════════
  var OrigWebSocket = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    var ws = protocols ? new OrigWebSocket(url, protocols) : new OrigWebSocket(url);

    if (WS_DIAG_ENABLED) {
      var id = ++wsSocketId;
      var info = {
        id: id,
        url: sanitizeUrl(url),
        createdAt: new Date().toISOString(),
        frameCount: 0,
        actionCorrelations: {},
      };
      socketRegistry.set(ws, info);
      socketList.push({ ref: ws, info: info });
      console.log('[Sentinel WS Diag] New WebSocket#' + id + ' → ' + sanitizeUrl(url));
    }

    return ws;
  };
  window.WebSocket.prototype = OrigWebSocket.prototype;
  window.WebSocket.CONNECTING = OrigWebSocket.CONNECTING;
  window.WebSocket.OPEN = OrigWebSocket.OPEN;
  window.WebSocket.CLOSING = OrigWebSocket.CLOSING;
  window.WebSocket.CLOSED = OrigWebSocket.CLOSED;

  // ═══ Dev Mode Console Commands ════════════════════════════════════════════
  window.__sentinelWS = {
    enable: function() {
      WS_DIAG_ENABLED = true;
      console.warn('[Sentinel WS Diag] ⚠ WebSocket diagnostics ENABLED. Paper trading only.');
      console.log('Commands:');
      console.log('  __sentinelWS.setAction("BUY_OPEN")  - label next frames');
      console.log('  __sentinelWS.setAction("NONE")      - stop labeling');
      console.log('  __sentinelWS.getSockets()            - list active sockets');
      console.log('  __sentinelWS.getLog()                - get all logged frames');
      console.log('  __sentinelWS.getForAction("BUY_OPEN") - frames for specific action');
      console.log('  __sentinelWS.copy()                  - copy log to clipboard');
      console.log('  __sentinelWS.export()                - download as JSON');
      console.log('  __sentinelWS.clear()                 - clear log');
    },
    disable: function() { WS_DIAG_ENABLED = false; console.log('[Sentinel WS Diag] Disabled.'); },
    setAction: function(action) {
      if (VALID_ACTIONS.indexOf(action) === -1) {
        console.error('Invalid action. Use one of:', VALID_ACTIONS.join(', '));
        return;
      }
      currentTestAction = action;
      if (action !== 'NONE') console.log('[Sentinel WS Diag] Action label set: ' + action + ' - place your trade now.');
      else console.log('[Sentinel WS Diag] Action label cleared.');
    },
    getSockets: function() {
      return socketList.map(function(s) {
        return { id: s.info.id, url: s.info.url, frames: s.info.frameCount, actions: s.info.actionCorrelations, state: s.ref.readyState };
      });
    },
    getLog: function() { return JSON.parse(JSON.stringify(wsLog)); },
    getForAction: function(action) {
      return wsLog.filter(function(e) { return e.testAction === action; });
    },
    copy: function() {
      try {
        var json = JSON.stringify(wsLog, null, 2);
        navigator.clipboard.writeText(json).then(function() {
          console.log('[Sentinel WS Diag] Copied ' + wsLog.length + ' entries.');
        });
      } catch(e) { console.error('Copy failed. Use __sentinelWS.getLog() instead.'); }
    },
    export: function() {
      try {
        var json = JSON.stringify({ sockets: socketList.map(function(s) { return s.info; }), frames: wsLog }, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'sentinel-ws-diagnostics-' + new Date().toISOString().split('T')[0] + '.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        console.log('[Sentinel WS Diag] Exported.');
      } catch(e) { console.error('Export failed:', e.message); }
    },
    clear: function() { wsLog = []; console.log('[Sentinel WS Diag] Cleared.'); },
    actions: VALID_ACTIONS,
  };

  // Listen for dev mode toggle
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_DEV_MODE') {
      if (event.data.enabled) {
        WS_DIAG_ENABLED = true;
        console.log('[Sentinel WS Diag] Auto-enabled via dev mode.');
      }
    }
  });

  console.log('[Sentinel] WebSocket diagnostics module loaded. Use __sentinelWS.enable() to start.');
})();
