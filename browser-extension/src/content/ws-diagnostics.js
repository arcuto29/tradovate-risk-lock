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

  // ═══ WebSocket.prototype.send interceptor ═════════════════════════════════
  var origWsSend = WebSocket.prototype.send;

  WebSocket.prototype.send = function(data) {
    // Always call original first - NEVER block
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
