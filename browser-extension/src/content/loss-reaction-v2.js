/**
 * Loss Reaction Timer - MAIN WORLD
 * When cooldown activates after consecutive losses, shows a fullscreen breathing exercise
 * that completely covers the platform (no charts visible).
 * Forces a mindful pause before trading again.
 */
(function() {
  'use strict';

  var consecutiveLosses = 0;
  var appConnected = false;
  var lastTriggerTime = 0;
  var overlayDismissedAt = 0;
  var MIN_TRIGGER_INTERVAL = 60000; // Don't trigger more than once per minute
  var GRACE_PERIOD_AFTER_DISMISS = 120000; // 2 min grace after dismissing overlay (covers position closing)

  function handleMessage(event) {
    if (event.source !== window) return;
    if (!event.data) return;
    
    var type = event.data.type;
    
    if (type === 'TRL_COACH_CONFIG' || type === 'TRL_SESSION_STATE' || type === 'TRL_POSITION_LIMITS') {
      appConnected = true;
    }
    if (type === 'TRL_APP_DISCONNECTED') {
      appConnected = false;
      consecutiveLosses = 0;
      var existing = document.getElementById('trl-reaction-overlay');
      if (existing) existing.remove();
    }
    
    if (type === 'TRL_TRADE_RESULT') {
      var now = Date.now();
      
      // Grace period: ignore loss events right after overlay was dismissed
      // (user is closing their position, not taking a new trade)
      if ((now - overlayDismissedAt) < GRACE_PERIOD_AFTER_DISMISS) {
        console.log('[Sentinel LossReaction] Ignoring event during grace period (closing position after overlay)');
        return;
      }
      
      if (event.data.result === 'loss') {
        consecutiveLosses++;
        console.log('[Sentinel LossReaction] Loss #' + consecutiveLosses + ' detected (pnl: ' + (event.data.pnl || 'unknown') + ', time: ' + new Date().toISOString() + ')');
        if (consecutiveLosses >= 2 && appConnected && (now - lastTriggerTime) > MIN_TRIGGER_INTERVAL) {
          console.log('[Sentinel LossReaction] TRIGGER: ' + consecutiveLosses + ' consecutive losses. Showing overlay.');
          lastTriggerTime = now;
          showReactionOverlay();
        }
      } else if (event.data.result === 'win') {
        if (consecutiveLosses > 0) {
          console.log('[Sentinel LossReaction] Win detected. Resetting consecutiveLosses from ' + consecutiveLosses + ' to 0.');
        }
        consecutiveLosses = 0;
      }
    }
    
    // Reset on new day
    if (type === 'TRL_SESSION_RESET' || type === 'TRL_DAY_RESET') {
      console.log('[Sentinel LossReaction] Session/day reset. Clearing consecutiveLosses.');
      consecutiveLosses = 0;
    }
  }

  window.addEventListener('message', handleMessage);

  function showReactionOverlay() {
    if (document.getElementById('trl-reaction-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'trl-reaction-overlay';
    overlay.innerHTML = '<div class="trl-rx-bg"></div>' +
      '<div class="trl-rx-content">' +
        '<div class="trl-rx-particles">' +
          '<div class="trl-rx-particle" style="top:15%;left:20%;animation-delay:0s"></div>' +
          '<div class="trl-rx-particle" style="top:60%;left:75%;animation-delay:1.5s"></div>' +
          '<div class="trl-rx-particle" style="top:30%;left:85%;animation-delay:3s"></div>' +
          '<div class="trl-rx-particle" style="top:75%;left:15%;animation-delay:2s"></div>' +
          '<div class="trl-rx-particle" style="top:45%;left:50%;animation-delay:0.5s"></div>' +
          '<div class="trl-rx-particle" style="top:85%;left:40%;animation-delay:4s"></div>' +
          '<div class="trl-rx-particle" style="top:10%;left:65%;animation-delay:2.5s"></div>' +
        '</div>' +
        '<div class="trl-rx-ring-wrap">' +
          '<div class="trl-rx-ring-outer"></div>' +
          '<div class="trl-rx-ring-inner">' +
            '<span id="trl-breathe-text" class="trl-rx-breathe-text">Breathe In</span>' +
          '</div>' +
          '<div id="trl-breathe-progress" class="trl-rx-progress">Breath 1 of 5</div>' +
        '</div>' +
        '<h2 class="trl-rx-title">Reset Before Your Next Trade</h2>' +
        '<p class="trl-rx-subtitle">You just took ' + consecutiveLosses + ' consecutive losses. Complete this reset before placing another trade.</p>' +
        '<div class="trl-rx-divider"></div>' +
        '<div class="trl-rx-form">' +
          '<p class="trl-rx-prompt">Type the following to continue:</p>' +
          '<p class="trl-rx-phrase">"I will not revenge trade"</p>' +
          '<input id="trl-reaction-input" class="trl-rx-input" type="text" placeholder="Type here..." autocomplete="off" spellcheck="false" />' +
          '<p id="trl-reaction-error" class="trl-rx-error">Type it exactly as shown</p>' +
          '<button id="trl-reaction-submit" class="trl-rx-btn">Continue</button>' +
        '</div>' +
        '<p class="trl-rx-footer">The market will be here when you\'re ready.</p>' +
      '</div>' +
      '<div id="trl-rx-complete" class="trl-rx-complete" style="display:none">' +
        '<div class="trl-rx-complete-icon">&#10003;</div>' +
        '<h2 class="trl-rx-complete-title">Reset Complete</h2>' +
        '<p class="trl-rx-complete-subtitle">Take your next trade only if it matches your plan.</p>' +
        '<p id="trl-rx-rule" class="trl-rx-rule"></p>' +
      '</div>';

    var style = document.createElement('style');
    style.textContent = '' +
      '#trl-reaction-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}' +
      '.trl-rx-bg{position:absolute;inset:0;background:linear-gradient(135deg,#030108 0%,#0a0520 30%,#0d0a2a 60%,#030108 100%);opacity:1;}' +
      '.trl-rx-content{position:relative;z-index:1;text-align:center;max-width:480px;padding:50px 40px;animation:trlRxFadeIn 0.6s ease-out;}' +
      '.trl-rx-particles{position:fixed;inset:0;pointer-events:none;overflow:hidden;}' +
      '.trl-rx-particle{position:absolute;width:3px;height:3px;border-radius:50%;background:rgba(56,189,248,0.3);animation:trlRxFloat 6s ease-in-out infinite;}' +
      '.trl-rx-ring-wrap{position:relative;width:200px;height:200px;margin:0 auto 32px;}' +
      '.trl-rx-ring-outer{position:absolute;inset:0;border-radius:50%;border:2px solid transparent;background:conic-gradient(from 0deg,rgba(56,189,248,0.5),rgba(168,85,247,0.4),rgba(56,189,248,0.15),rgba(168,85,247,0.5),rgba(56,189,248,0.5)) border-box;-webkit-mask:linear-gradient(#fff 0 0) padding-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:trlRxSpin 8s linear infinite;}' +
      '.trl-rx-ring-inner{position:absolute;inset:10px;border-radius:50%;background:rgba(10,5,30,0.85);display:flex;align-items:center;justify-content:center;animation:trlRxBreathe 8s ease-in-out infinite;box-shadow:0 0 50px rgba(56,189,248,0.12) inset,0 0 100px rgba(168,85,247,0.05) inset;}' +
      '.trl-rx-breathe-text{color:#67e8f9;font-size:18px;font-weight:600;letter-spacing:1.5px;text-shadow:0 0 15px rgba(56,189,248,0.6);}' +
      '.trl-rx-progress{position:absolute;bottom:-28px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.25);font-size:11px;letter-spacing:1px;white-space:nowrap;}' +
      '.trl-rx-title{color:#ffffff;font-size:26px;font-weight:800;margin:0 0 12px;letter-spacing:-0.3px;}' +
      '.trl-rx-subtitle{color:rgba(255,255,255,0.4);font-size:14px;line-height:1.6;margin:0 0 28px;}' +
      '.trl-rx-divider{width:80px;height:1px;background:linear-gradient(90deg,transparent,rgba(56,189,248,0.3),rgba(168,85,247,0.2),transparent);margin:0 auto 28px;}' +
      '.trl-rx-form{margin:0 auto;}' +
      '.trl-rx-prompt{color:rgba(255,255,255,0.3);font-size:12px;margin:0 0 12px;letter-spacing:0.5px;}' +
      '.trl-rx-phrase{color:#67e8f9;font-size:17px;font-weight:700;margin:0 0 20px;text-shadow:0 0 15px rgba(56,189,248,0.3);}' +
      '.trl-rx-input{width:100%;max-width:340px;padding:15px 22px;border:1px solid rgba(56,189,248,0.15);border-radius:12px;background:rgba(255,255,255,0.03);color:#fff;font-size:15px;text-align:center;outline:none;transition:all 0.3s ease;backdrop-filter:blur(8px);}' +
      '.trl-rx-input:focus{border-color:rgba(56,189,248,0.4);box-shadow:0 0 0 3px rgba(56,189,248,0.08),0 0 20px rgba(56,189,248,0.1);}' +
      '.trl-rx-input.error{border-color:rgba(239,68,68,0.4);box-shadow:0 0 15px rgba(239,68,68,0.1);}' +
      '.trl-rx-error{color:rgba(239,68,68,0.7);font-size:11px;margin:10px 0 0;opacity:0;transition:opacity 0.3s ease;}' +
      '.trl-rx-error.show{opacity:1;}' +
      '.trl-rx-btn{margin-top:24px;padding:15px 44px;border:none;border-radius:12px;background:linear-gradient(135deg,rgba(56,189,248,0.9),rgba(99,102,241,0.9));color:#fff;font-size:13px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:2px;transition:all 0.3s ease;position:relative;overflow:hidden;}' +
      '.trl-rx-btn:hover{box-shadow:0 0 25px rgba(56,189,248,0.4),0 0 50px rgba(99,102,241,0.2);transform:translateY(-1px);}' +
      '.trl-rx-btn::after{content:"";position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:linear-gradient(45deg,transparent 30%,rgba(255,255,255,0.1) 50%,transparent 70%);animation:trlRxShimmer 3s linear infinite;}' +
      '.trl-rx-footer{color:rgba(255,255,255,0.15);font-size:11px;margin-top:36px;font-style:italic;}' +
      '.trl-rx-complete{position:relative;z-index:2;text-align:center;padding:60px 40px;animation:trlRxFadeIn 0.5s ease-out;}' +
      '.trl-rx-complete-icon{width:72px;height:72px;margin:0 auto 24px;border-radius:50%;background:linear-gradient(135deg,rgba(52,211,153,0.2),rgba(16,185,129,0.1));border:2px solid rgba(52,211,153,0.4);display:flex;align-items:center;justify-content:center;font-size:32px;color:#34d399;box-shadow:0 0 30px rgba(52,211,153,0.2);}' +
      '.trl-rx-complete-title{color:#ffffff;font-size:28px;font-weight:800;margin:0 0 12px;}' +
      '.trl-rx-complete-subtitle{color:rgba(255,255,255,0.5);font-size:15px;margin:0 0 24px;line-height:1.5;}' +
      '.trl-rx-rule{color:#67e8f9;font-size:14px;font-weight:600;font-style:italic;margin:0;padding:16px 24px;background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.15);border-radius:12px;text-shadow:0 0 10px rgba(56,189,248,0.2);}' +
      '@keyframes trlRxFadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}' +
      '@keyframes trlRxBreathe{0%,100%{transform:scale(1);box-shadow:0 0 50px rgba(56,189,248,0.12) inset}50%{transform:scale(1.18);box-shadow:0 0 70px rgba(56,189,248,0.2) inset,0 0 40px rgba(168,85,247,0.1)}}' +
      '@keyframes trlRxSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
      '@keyframes trlRxFloat{0%,100%{transform:translateY(0) scale(1);opacity:0.3}50%{transform:translateY(-25px) scale(1.5);opacity:0.7}}' +
      '@keyframes trlRxShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}';

    overlay.appendChild(style);
    document.body.appendChild(overlay);

    // Breathing text cycle with progress counter
    var breatheText = document.getElementById('trl-breathe-text');
    var progressText = document.getElementById('trl-breathe-progress');
    var phase = 0;
    var breathCount = 0;
    var totalBreaths = 5;
    var phases = ['Breathe In', 'Hold', 'Breathe Out', 'Hold'];
    var breatheCycle = setInterval(function() {
      if (!document.getElementById('trl-reaction-overlay')) { clearInterval(breatheCycle); return; }
      phase = (phase + 1) % phases.length;
      if (phase === 0) {
        breathCount++;
        if (breathCount > totalBreaths) breathCount = totalBreaths;
      }
      breatheText.textContent = phases[phase];
      progressText.textContent = 'Breath ' + Math.min(breathCount + 1, totalBreaths) + ' of ' + totalBreaths;
    }, 2000);

    // Submit handler
    var input = document.getElementById('trl-reaction-input');
    var submit = document.getElementById('trl-reaction-submit');
    var error = document.getElementById('trl-reaction-error');
    var content = overlay.querySelector('.trl-rx-content');
    var complete = document.getElementById('trl-rx-complete');
    var ruleEl = document.getElementById('trl-rx-rule');

    submit.onclick = function() {
      var value = input.value.trim().toLowerCase();
      if (value === 'i will not revenge trade') {
        // Show completion screen
        content.style.display = 'none';
        complete.style.display = 'block';
        clearInterval(breatheCycle);

        // Try to show a commitment contract rule
        try {
          chrome.storage.local.get('commitment_contract', function(r) {
            if (r && r.commitment_contract) {
              ruleEl.textContent = 'Your Rule: "' + r.commitment_contract + '"';
            } else {
              ruleEl.textContent = 'Your Rule: "Never increase size after a loss."';
            }
          });
        } catch(e) {
          ruleEl.textContent = 'Your Rule: "Never increase size after a loss."';
        }

        // Auto-dismiss after 4 seconds
        setTimeout(function() {
          overlayDismissedAt = Date.now();
          overlay.style.opacity = '0';
          overlay.style.transition = 'opacity 0.5s ease';
          setTimeout(function() { overlay.remove(); }, 500);
        }, 4000);
      } else {
        error.classList.add('show');
        input.classList.add('error');
        setTimeout(function() { error.classList.remove('show'); input.classList.remove('error'); }, 2500);
      }
    };

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submit.click();
    });

    // Focus input after animation
    setTimeout(function() { input.focus(); }, 700);
  }

  console.log('[Sentinel] Loss Reaction Timer loaded.');
})();
