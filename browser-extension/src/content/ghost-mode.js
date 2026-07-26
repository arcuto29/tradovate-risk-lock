/**
 * Ghost Mode - MAIN WORLD
 * Hides P&L display elements on trading platforms.
 * When active, trader cannot see their P&L until session ends.
 * Forces trading based on setups, not emotions from watching money move.
 * 
 * Listens via postMessage AND polls chrome.storage for state changes.
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
    '[data-name="pnl"]',
    // Tradesea
    '[class*="balance"]',
    '[class*="equity"]',
  ];

  // Listen for messages from bridge scripts
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_GHOST_MODE') {
      console.log('[TradingGuardian] Ghost Mode message received:', event.data.enabled);
      setGhostMode(event.data.enabled);
    }
    if (event.data && event.data.type === 'TRL_APP_DISCONNECTED') {
      console.log('[TradingGuardian] App disconnected - disabling ghost mode');
      setGhostMode(false);
    }
  });

  function setGhostMode(enabled) {
    if (enabled && !ghostModeActive) {
      ghostModeActive = true;
      startHiding();
    } else if (!enabled && ghostModeActive) {
      ghostModeActive = false;
      stopHiding();
    }
  }

  function startHiding() {
    console.log('[TradingGuardian] Ghost Mode ON - blurring P&L');
    hidePnlElements();
    hideInterval = setInterval(hidePnlElements, 2000);
  }

  function stopHiding() {
    console.log('[TradingGuardian] Ghost Mode OFF - removing blur');
    if (hideInterval) { clearInterval(hideInterval); hideInterval = null; }
    // Aggressively remove blur - run immediately and then several more times
    forceRemoveAllBlur();
    setTimeout(forceRemoveAllBlur, 300);
    setTimeout(forceRemoveAllBlur, 700);
    setTimeout(forceRemoveAllBlur, 1500);
    setTimeout(forceRemoveAllBlur, 3000);
  }

  function hidePnlElements() {
    PNL_SELECTORS.forEach(function(selector) {
      try {
        var elements = document.querySelectorAll(selector);
        elements.forEach(function(el) {
          el.style.setProperty('filter', 'blur(12px)', 'important');
          el.style.setProperty('user-select', 'none', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el.setAttribute('data-ghost-hidden', 'true');
        });
      } catch(e) {}
    });
  }

  function forceRemoveAllBlur() {
    // Method 1: Find by our attribute
    var hidden = document.querySelectorAll('[data-ghost-hidden="true"]');
    hidden.forEach(function(el) {
      el.style.removeProperty('filter');
      el.style.removeProperty('user-select');
      el.style.removeProperty('pointer-events');
      el.removeAttribute('data-ghost-hidden');
    });

    // Method 2: Find anything with blur(12px) on it
    PNL_SELECTORS.forEach(function(selector) {
      try {
        var elements = document.querySelectorAll(selector);
        elements.forEach(function(el) {
          var filter = el.style.filter || window.getComputedStyle(el).filter;
          if (filter && filter.includes('blur')) {
            el.style.removeProperty('filter');
            el.style.removeProperty('user-select');
            el.style.removeProperty('pointer-events');
            el.removeAttribute('data-ghost-hidden');
          }
        });
      } catch(e) {}
    });

    // Method 3: Nuclear option - find ANY element on page with blur(12px)
    try {
      var allBlurred = document.querySelectorAll('[style*="blur"]');
      allBlurred.forEach(function(el) {
        if (el.style.filter && el.style.filter.includes('blur(12px)')) {
          el.style.removeProperty('filter');
          el.style.removeProperty('user-select');
          el.style.removeProperty('pointer-events');
          el.removeAttribute('data-ghost-hidden');
        }
      });
    } catch(e) {}
  }

  console.log('[TradingGuardian] Ghost Mode loaded.');
})();
