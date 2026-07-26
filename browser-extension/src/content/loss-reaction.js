/**
 * Loss Reaction Timer - MAIN WORLD
 * When cooldown activates after a loss, shows a fullscreen breathing exercise
 * that completely covers the platform (no charts visible).
 * Forces a pause before trading again.
 */
(function() {
  'use strict';

  var reactionEnabled = false;

  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TRL_COACH_CONFIG') {
      reactionEnabled = event.data.enabled === true;
    }
    if (event.data && event.data.type === 'TRL_APP_DISCONNECTED') {
      reactionEnabled = false;
      var existing = document.getElementById('trl-reaction-overlay');
      if (existing) existing.remove();
    }
    if (event.data && event.data.type === 'TRL_COACH_BLOCK' && (event.data.reason === 'COOLDOWN ACTIVE' || event.data.reason === 'COOLDOWN')) {
      if (reactionEnabled) showReactionOverlay();
    }
  });

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
        '</div>' +
        '<div class="trl-rx-ring-wrap">' +
          '<div class="trl-rx-ring-outer"></div>' +
          '<div class="trl-rx-ring-inner">' +
            '<span id="trl-breathe-text" class="trl-rx-breathe-text">Breathe In</span>' +
          '</div>' +
        '</div>' +
        '<h2 class="trl-rx-title">Take a Moment</h2>' +
        '<p class="trl-rx-subtitle">You just took a loss. Before you trade again, complete this.</p>' +
        '<div class="trl-rx-divider"></div>' +
        '<div class="trl-rx-form">' +
          '<p class="trl-rx-prompt">Type the following to continue:</p>' +
          '<p class="trl-rx-phrase">"I will not revenge trade"</p>' +
          '<input id="trl-reaction-input" class="trl-rx-input" type="text" placeholder="Type here..." autocomplete="off" spellcheck="false" />' +
          '<p id="trl-reaction-error" class="trl-rx-error">Type it exactly as shown</p>' +
          '<button id="trl-reaction-submit" class="trl-rx-btn">Continue</button>' +
        '</div>' +
        '<p class="trl-rx-footer">The market will be here when you\'re ready.</p>' +
      '</div>';

    var style = document.createElement('style');
    style.textContent = '' +
      '#trl-reaction-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}' +
      '.trl-rx-bg{position:absolute;inset:0;background:linear-gradient(135deg,#030108 0%,#0a0520 30%,#0d0a2a 60%,#030108 100%);opacity:1;}' +
      '.trl-rx-content{position:relative;z-index:1;text-align:center;max-width:440px;padding:50px 40px;animation:trlRxFadeIn 0.6s ease-out;}' +
      '.trl-rx-particles{position:fixed;inset:0;pointer-events:none;overflow:hidden;}' +
      '.trl-rx-particle{position:absolute;width:3px;height:3px;border-radius:50%;background:rgba(56,189,248,0.3);animation:trlRxFloat 6s ease-in-out infinite;}' +
      '.trl-rx-ring-wrap{position:relative;width:160px;height:160px;margin:0 auto 40px;}' +
      '.trl-rx-ring-outer{position:absolute;inset:0;border-radius:50%;border:2px solid transparent;background:conic-gradient(from 0deg,rgba(56,189,248,0.4),rgba(168,85,247,0.3),rgba(56,189,248,0.1),rgba(168,85,247,0.4),rgba(56,189,248,0.4)) border-box;-webkit-mask:linear-gradient(#fff 0 0) padding-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:trlRxSpin 8s linear infinite;}' +
      '.trl-rx-ring-inner{position:absolute;inset:8px;border-radius:50%;background:rgba(10,5,30,0.8);display:flex;align-items:center;justify-content:center;animation:trlRxBreathe 8s ease-in-out infinite;box-shadow:0 0 40px rgba(56,189,248,0.1) inset;}' +
      '.trl-rx-breathe-text{color:#67e8f9;font-size:15px;font-weight:600;letter-spacing:1px;text-shadow:0 0 10px rgba(56,189,248,0.5);}' +
      '.trl-rx-title{color:#ffffff;font-size:28px;font-weight:800;margin:0 0 12px;letter-spacing:-0.5px;}' +
      '.trl-rx-subtitle{color:rgba(255,255,255,0.35);font-size:14px;line-height:1.6;margin:0 0 30px;}' +
      '.trl-rx-divider{width:60px;height:1px;background:linear-gradient(90deg,transparent,rgba(56,189,248,0.3),transparent);margin:0 auto 30px;}' +
      '.trl-rx-form{margin:0 auto;}' +
      '.trl-rx-prompt{color:rgba(255,255,255,0.25);font-size:12px;margin:0 0 12px;letter-spacing:0.5px;}' +
      '.trl-rx-phrase{color:#67e8f9;font-size:16px;font-weight:700;margin:0 0 20px;text-shadow:0 0 15px rgba(56,189,248,0.3);}' +
      '.trl-rx-input{width:100%;max-width:320px;padding:14px 20px;border:1px solid rgba(56,189,248,0.15);border-radius:12px;background:rgba(255,255,255,0.03);color:#fff;font-size:15px;text-align:center;outline:none;transition:all 0.3s ease;backdrop-filter:blur(8px);}' +
      '.trl-rx-input:focus{border-color:rgba(56,189,248,0.4);box-shadow:0 0 0 3px rgba(56,189,248,0.08),0 0 20px rgba(56,189,248,0.1);}' +
      '.trl-rx-input.error{border-color:rgba(239,68,68,0.4);box-shadow:0 0 15px rgba(239,68,68,0.1);}' +
      '.trl-rx-error{color:rgba(239,68,68,0.7);font-size:11px;margin:10px 0 0;opacity:0;transition:opacity 0.3s ease;}' +
      '.trl-rx-error.show{opacity:1;}' +
      '.trl-rx-btn{margin-top:24px;padding:14px 40px;border:none;border-radius:12px;background:linear-gradient(135deg,rgba(56,189,248,0.9),rgba(99,102,241,0.9));color:#fff;font-size:13px;font-weight:700;cursor:pointer;text-transform:uppercase;letter-spacing:2px;transition:all 0.3s ease;position:relative;overflow:hidden;}' +
      '.trl-rx-btn:hover{box-shadow:0 0 25px rgba(56,189,248,0.4),0 0 50px rgba(99,102,241,0.2);transform:translateY(-1px);}' +
      '.trl-rx-btn::after{content:"";position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:linear-gradient(45deg,transparent 30%,rgba(255,255,255,0.1) 50%,transparent 70%);animation:trlRxShimmer 3s linear infinite;}' +
      '.trl-rx-footer{color:rgba(255,255,255,0.12);font-size:11px;margin-top:40px;font-style:italic;}' +
      '@keyframes trlRxFadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}' +
      '@keyframes trlRxBreathe{0%,100%{transform:scale(1);box-shadow:0 0 40px rgba(56,189,248,0.1) inset}50%{transform:scale(1.15);box-shadow:0 0 60px rgba(56,189,248,0.2) inset,0 0 30px rgba(168,85,247,0.1)}}' +
      '@keyframes trlRxSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' +
      '@keyframes trlRxFloat{0%,100%{transform:translateY(0) scale(1);opacity:0.3}50%{transform:translateY(-20px) scale(1.5);opacity:0.6}}' +
      '@keyframes trlRxShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}';

    overlay.appendChild(style);
    document.body.appendChild(overlay);

    // Breathing text cycle
    var breatheText = document.getElementById('trl-breathe-text');
    var phase = 0;
    var phases = ['Breathe In', 'Hold', 'Breathe Out', 'Hold'];
    var breatheCycle = setInterval(function() {
      if (!document.getElementById('trl-reaction-overlay')) { clearInterval(breatheCycle); return; }
      phase = (phase + 1) % phases.length;
      breatheText.textContent = phases[phase];
    }, 2000);

    // Submit handler
    var input = document.getElementById('trl-reaction-input');
    var submit = document.getElementById('trl-reaction-submit');
    var error = document.getElementById('trl-reaction-error');

    submit.onclick = function() {
      var value = input.value.trim().toLowerCase();
      if (value === 'i will not revenge trade') {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.4s ease';
        setTimeout(function() { overlay.remove(); }, 400);
        clearInterval(breatheCycle);
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

  console.log('[TradingGuardian] Loss Reaction Timer loaded.');
})();
