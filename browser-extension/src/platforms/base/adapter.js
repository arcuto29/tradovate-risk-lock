/**
 * Base Platform Adapter
 * All platform adapters extend this interface.
 * 
 * Support Levels:
 * - VERIFIED: Full certification, all order types tested and confirmed
 * - BETA: Most order types working, some edge cases unverified
 * - EXPERIMENTAL: Basic detection working, not all paths confirmed
 * - LOCKOUT_ONLY: Cannot intercept orders, only platform blocklist/lockout works
 */

var BasePlatformAdapter = {
  name: 'base',
  version: '1.0.0',
  supportLevel: 'LOCKOUT_ONLY', // VERIFIED | BETA | EXPERIMENTAL | LOCKOUT_ONLY

  capabilities: {
    fetchInterception: false,
    xhrInterception: false,
    websocketInterception: false,
    positionDetection: false,
    pnlDetection: false,
    closeDetection: false,
    reduceDetection: false,
    reverseDetection: false,
    cancelDetection: false,
    stopModifyDetection: false,
    targetModifyDetection: false,
  },

  /**
   * Does this adapter handle the current page?
   * @param {string} hostname
   * @param {string} pathname
   * @returns {boolean}
   */
  matches: function(hostname, pathname) { return false; },

  /**
   * Parse a fetch request into a normalized order object
   * @param {string} url
   * @param {string} method
   * @param {object|null} body
   * @returns {object|null} - normalized order or null if not a trading request
   */
  parseFetch: function(url, method, body) { return null; },

  /**
   * Parse an XHR request into a normalized order object
   * @param {string} url
   * @param {string} method
   * @param {object|null} body
   * @returns {object|null}
   */
  parseXHR: function(url, method, body) { return null; },

  /**
   * Parse a WebSocket outbound frame into a normalized order object
   * @param {string} socketUrl
   * @param {string|ArrayBuffer} data
   * @returns {object|null}
   */
  parseWebSocket: function(socketUrl, data) { return null; },

  /**
   * Classify a normalized order
   * @param {object} normalizedOrder
   * @param {object} currentPosition - { side, quantity }
   * @returns {object} - { action, reason, confidence, closeQuantity, newRiskQuantity }
   */
  classifyOrder: function(normalizedOrder, currentPosition) {
    return { action: 'UNKNOWN', reason: 'Base adapter cannot classify', confidence: 'low', closeQuantity: 0, newRiskQuantity: 0 };
  },

  /**
   * Extract current position from DOM or responses
   * @param {Document} document
   * @returns {object|null} - { symbol, side, quantity, source }
   */
  extractPosition: function(document) { return null; },

  /**
   * Extract current P&L from DOM
   * @param {Document} document
   * @returns {object|null} - { realized, unrealized, source }
   */
  extractPnL: function(document) { return null; },
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.__SentinelAdapters = window.__SentinelAdapters || {};
  window.__SentinelAdapters.Base = BasePlatformAdapter;
}
