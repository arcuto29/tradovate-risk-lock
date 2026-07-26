/**
 * Loss Reaction Timer - MAIN WORLD
 * When cooldown activates after a loss, instead of just blocking,
 * shows a breathing exercise overlay that they must complete.
 * Makes the cooldown productive, not just waiting.
 */
(function() {
  'use strict';

  var reactionEnabled = false;

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_COACH_CONFIG') {
      reactionEnabled = event.data.enabled === true;
    }
    if (event.data && event.data.type === 'TRL_COACH_BLOCK' && event.data.reason === 'COOLDOWN ACTIVE') {
      if (reactionEnabled) showReactionOverlay();
    }
    if (event.data && event.data.type === 'TRL_COACH_BLOCK' && event.data.reason === 'COOLDOWN') {
      if (reactionEnabled) showReactionOverlay();
    }
  });

  function showReactionOverlay() {
    if (document.getElementById('trl-reaction-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'trl-reaction-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.95);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;';

    overlay.innerHTML = `
      <div style="text-align:center;max-width:400px;padding:40px;">
        <div id="trl-breathe-circle" style="width:120px;height:120px;border-radius:50%;border:2px solid rgba(56,189,248,0.3);margin:0 auto 30px;display:flex;align-items:center;justify-content:center;animation:trlBreathe 8s ease-in-out infinite;">
          <span id="trl-breathe-text" style="color:rgba(56,189,248,0.8);font-size:14px;font-weight:600;">Breathe In</span>
        </div>
        <h2 style="color:#fff;font-size:20px;font-weight:800;margin-bottom:12px;">Take a Moment</h2>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6;margin-bottom:30px;">You just took a loss. Before you trade again, complete this exercise.</p>
        <div id="trl-reaction-steps">
          <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-bottom:15px;">Type the following to continue:</p>
          <p style="color:rgba(56,189,248,0.7);font-size:14px;font-weight:600;margin-bottom:15px;letter-spacing:0.5px;">"I will not revenge trade"</p>
          <input id="trl-reaction-input" type="text" placeholder="Type here..." style="width:100%;padding:12px 16px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:rgba(255,255,255,0.03);color:#fff;font-size:14px;text-align:center;outline:none;" />
          <p id="trl-reaction-error" style="color:rgba(239,68,68,0.7);font-size:11px;margin-top:8px;display:none;">Type it exactly as shown</p>
          <button id="trl-reaction-submit" style="margin-top:20px;padding:12px 30px;border:1px solid rgba(56,189,248,0.3);border-radius:8px;background:rgba(56,189,248,0.1);color:rgba(56,189,248,0.8);font-size:12px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:1.5px;">Continue</button>
        </div>
      </div>
    `;

    // Add breathing animation
    var style = document.createElement('style');
    style.textContent = '@keyframes trlBreathe{0%,100%{transform:scale(1);border-color:rgba(56,189,248,0.3)}50%{transform:scale(1.3);border-color:rgba(56,189,248,0.6)}}';
    overlay.appendChild(style);

    document.body.appendChild(overlay);

    // Breathing text cycle
    var breatheText = document.getElementById('trl-breathe-text');
    var breatheCycle = setInterval(function() {
      if (!document.getElementById('trl-reaction-overlay')) { clearInterval(breatheCycle); return; }
      if (breatheText.textContent === 'Breathe In') breatheText.textContent = 'Hold';
      else if (breatheText.textContent === 'Hold') breatheText.textContent = 'Breathe Out';
      else breatheText.textContent = 'Breathe In';
    }, 2666);

    // Submit handler
    var input = document.getElementById('trl-reaction-input');
    var submit = document.getElementById('trl-reaction-submit');
    var error = document.getElementById('trl-reaction-error');

    submit.onclick = function() {
      var value = input.value.trim().toLowerCase();
      if (value === 'i will not revenge trade') {
        overlay.remove();
        clearInterval(breatheCycle);
      } else {
        error.style.display = 'block';
        input.style.borderColor = 'rgba(239,68,68,0.3)';
        setTimeout(function() { error.style.display = 'none'; input.style.borderColor = 'rgba(255,255,255,0.1)'; }, 2000);
      }
    };

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submit.click();
    });
  }

  console.log('[TradingGuardian] Loss Reaction Timer loaded.');
})();
