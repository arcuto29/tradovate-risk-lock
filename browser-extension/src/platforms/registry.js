/**
 * Platform Registry
 * Central registry of all supported trading platforms and their adapters.
 * The risk engine asks this registry which adapter to use for the current page.
 */
(function() {
  'use strict';

  var PlatformRegistry = {
    version: '1.0.0',

    platforms: [
      {
        id: 'topstepx',
        name: 'TopstepX',
        adapter: 'topstepx',
        supportLevel: 'BETA',
        transport: 'fetch',
        matchHostnames: ['topstepx.com'],
        notes: 'REST API order placement. Fetch interception confirmed.',
      },
      {
        id: 'tradesea',
        name: 'Tradesea',
        adapter: 'tradesea',
        supportLevel: 'EXPERIMENTAL',
        transport: 'fetch',
        matchHostnames: ['app.tradesea.ai', 'tradesea.ai'],
        notes: 'Similar to TopstepX. Fetch interception expected.',
      },
      {
        id: 'tradovate-web',
        name: 'Tradovate Web',
        adapter: 'tradovate-web',
        supportLevel: 'EXPERIMENTAL',
        transport: 'fetch',
        matchHostnames: ['trader.tradovate.com'],
        notes: 'REST API. Uses separate injector.js content script.',
      },
      {
        id: 'tradingview-paper',
        name: 'TradingView Paper',
        adapter: 'tradingview-paper',
        supportLevel: 'EXPERIMENTAL',
        transport: 'websocket',
        matchHostnames: ['www.tradingview.com'],
        matchCondition: 'paper-trading-active',
        notes: 'Orders sent via WebSocket. Requires WS interception. Diagnostics phase.',
      },
      {
        id: 'tradingview-tradovate',
        name: 'TradingView + Tradovate',
        adapter: 'tradingview-tradovate',
        supportLevel: 'EXPERIMENTAL',
        transport: 'fetch+websocket',
        matchHostnames: ['www.tradingview.com'],
        matchCondition: 'tradovate-broker-connected',
        notes: 'Orders may go to Tradovate API via fetch or via TradingView WS bridge.',
      },
      {
        id: 'tradingview-generic',
        name: 'TradingView + Unknown Broker',
        adapter: 'tradingview-generic',
        supportLevel: 'LOCKOUT_ONLY',
        transport: 'unknown',
        matchHostnames: ['www.tradingview.com'],
        matchCondition: 'unknown-broker',
        notes: 'Cannot certify order interception. Lockout/blocklist protection only.',
      },
    ],

    /**
     * Get the appropriate adapter for the current page
     * @param {string} hostname
     * @param {string} pathname
     * @param {object} pageContext - additional context (broker name, account type)
     * @returns {object} platform entry or null
     */
    getAdapter: function(hostname, pathname, pageContext) {
      for (var i = 0; i < this.platforms.length; i++) {
        var p = this.platforms[i];
        var hostnameMatch = p.matchHostnames.some(function(h) {
          return hostname.includes(h);
        });
        if (hostnameMatch) return p;
      }
      return null;
    },

    /**
     * Get platform support level
     */
    getSupportLevel: function(platformId) {
      var p = this.platforms.find(function(pl) { return pl.id === platformId; });
      return p ? p.supportLevel : 'LOCKOUT_ONLY';
    },

    /**
     * Get all platforms with their status
     */
    getAll: function() {
      return this.platforms.map(function(p) {
        return { id: p.id, name: p.name, supportLevel: p.supportLevel, transport: p.transport };
      });
    },
  };

  if (typeof window !== 'undefined') {
    window.__SentinelRegistry = PlatformRegistry;
  }
})();
