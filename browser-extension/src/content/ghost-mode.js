/**
 * Ghost Mode - MAIN WORLD
 * Hides P&L display elements on trading platforms.
 * When active, trader cannot see their P&L until session ends.
 * Forces trading based on setups, not emotions from watching money move.
 */
(function() {
  'use strict';

  var ghostModeActive = false;
  var hideInterval = null;

  // P&L selectors for each platform
  var PNL_SELECTORS = [
    // TopstepX
    '[data-testid="realized-pnl-display-value-amount"]',
    '[data-testid*="realized-pnl"]',
    '[data-testid*="unrealized-pnl"]',
    '[data-testid*="pnl"]',
    '[aria-label*="P&L"]',
    '[aria-label*="Realized"]',
    '[aria-label*="Unrealized"]',
    '[class*="pnl"]',
    '[class*="profit"]',
    '[class*="loss"]',
    // Tradovate
    '[class*="realized-pnl"]',
    '[class*="unrealizedPl"]',
    '[class*="realizedPl"]',
    '[class*="daily-pl"]',
    // TradingView
    '[class*="pnl"]',
    '[data-name="pnl"]',
    // Tradesea
    '[class*="balance"]',
    '[class*="equity"]',
  ];

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_GHOST_MODE') {
      ghostModeActive = event.data.enabled;
      if (ghostModeActive) {
        startHiding();
      } else {
        stopHiding();
      }
    }
  });

  function startHiding() {
    hidePnlElements();
    // Keep hiding every 2 seconds (in case new elements appear)
    hideInterval = setInterval(hidePnlElements, 2000);
  }

  function stopHiding() {
    if (hideInterval) { clearInterval(hideInterval); hideInterval = null; }
    showPnlElements();
  }

  function hidePnlElements() {
    PNL_SELECTORS.forEach(function(selector) {
      try {
        var elements = document.querySelectorAll(selector);
        elements.forEach(function(el) {
          el.style.filter = 'blur(12px)';
          el.style.userSelect = 'none';
          el.style.pointerEvents = 'none';
          el.setAttribute('data-ghost-hidden', 'true');
        });
      } catch(e) {}
    });
  }

  function showPnlElements() {
    var hidden = document.querySelectorAll('[data-ghost-hidden="true"]');
    hidden.forEach(function(el) {
      el.style.filter = '';
      el.style.userSelect = '';
      el.style.pointerEvents = '';
      el.removeAttribute('data-ghost-hidden');
    });
  }

  console.log('[TradingGuardian] Ghost Mode loaded.');
})();
