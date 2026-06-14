// ── MISSION 06: LAUNCH AUTHORITY ──
// Arctic under-ice. Two heightfields: seafloor + ice ceiling with launch holes.
// Fire an ICBM through 3 distinct holes before the enemy sub stops you.

const LA_GW = 128, LA_GD = 128;
const LA_SURFACE_MAP     = '/maps/LaunchAuth_Surface.png';
const LA_ICE_MAP         = '/maps/LaunchAuth_Ice.png';
const LA_ICE_SCALE       = 10;
const LA_FLOOR_SCALE     = 18;
const LA_GRID_H          = 32;
const LA_HOLE_THRESH     = 30;
const LA_SPAWN_X         = 64;
const LA_SPAWN_Z         = 108;
const LA_SPAWN_Y         = 14;
const LA_LAUNCHES_NEEDED = 3;
const LA_MIN_HOLE_DIST   = 15;   // min units between distinct holes
const LA_COUNTDOWN_FRAMES = 180; // 3 seconds

// ── STATE ──
let _laActive         = false;
let _laDifficulty     = 'captain';
let _laUnderHole      = false;
let _laHoleIcePx      = 255;
let _laLaunchState    = 'idle';  // 'idle' | 'countdown' | 'flying' | 'done'
let _laCountFrames    = 0;
let _laLastSec        = -1;
let _laMissile        = null;
let _laCanvas         = null;
let _laSuccessCount   = 0;
let _laLaunchPositions = [];
let _laMFrame         = 0;       // mission frame counter
let _laRevertGuard    = false;   // prevent _goToPeriscope spam
// Enemy fire rate control
let _laEnemyFireOpen  = false;
let _laEnemyFireTimer = 900;     // first window at 15 s
// Smoke ring animation
let _laSmokeRings     = [];

// ── COUNTDOWN MESSAGES (techy pre-launch chatter) ──
const _LA_CD = {
  3: '◈ PLATFORM STABLE — GYROSCOPE SPOOLING',
  2: '⚠ WARHEAD ARMED — LAUNCH KEY COMMITTED',
  1: '▸ IGNITION SEQUENCE — STAND CLEAR OF TUBE',
};

// ── HEIGHTFIELD LOADER ──
function _laLoadHeightfields() {
  return new Promise(function(resolve) {
    var pending = 2;
    function tryResolve() { if (--pending > 0) return; resolve(_laFlatGrid()); }
    function loadPng(src, onPx, onErr) {
      var img = new Image(); img.onload = function() {
        var tmp = document.createElement('canvas'); tmp.width = LA_GW; tmp.height = LA_GD;
        var tc = tmp.getContext('2d'); tc.drawImage(img, 0, 0, LA_GW, LA_GD);
        onPx(tc.getImageData(0, 0, LA_GW, LA_GD).data);
      }; img.onerror = onErr; img.src = src;
    }
    function _laFlatGrid() {
      var g = []; for (var z = 0; z < LA_GD; z++) { g[z] = []; for (var x = 0; x < LA_GW; x++) g[z][x] = 0; } return g;
    }
    loadPng(LA_SURFACE_MAP, function(px) {
      var hg = []; for (var z = 0; z < LA_GD; z++) { hg[z] = []; for (var x = 0; x < LA_GW; x++) hg[z][x] = px[(z*LA_GW+x)*4]; }
      window._canyonHeightGrid = hg; window._hfGridW = LA_GW; window._hfGridD = LA_GD;
      window._hfGridH = LA_GRID_H; window._hfTerrainScale = LA_FLOOR_SCALE; tryResolve();
    }, function() {
      window._canyonHeightGrid = _laFlatGrid(); window._hfGridW = LA_GW; window._hfGridD = LA_GD;
      window._hfGridH = LA_GRID_H; window._hfTerrainScale = LA_FLOOR_SCALE; tryResolve();
    });
    loadPng(LA_ICE_MAP, function(px) {
      var hg = []; for (var z = 0; z < LA_GD; z++) { hg[z] = []; for (var x = 0; x < LA_GW; x++) hg[z][x] = px[(z*LA_GW+x)*4]; }
      window._pendingIceCeilingGrid = hg; window._pendingIceTerrainScale = LA_ICE_SCALE; tryResolve();
    }, function() { window._pendingIceCeilingGrid = undefined; tryResolve(); });
  });
}

// ── HOLE DETECTION ──
function _laGetHolePx(wx, wz) {
  var icg = window._iceCeilingGrid; if (!icg) return 255;
  var gx = Math.max(0, Math.min(LA_GW-1, Math.round(wx)));
  var gz = Math.max(0, Math.min(LA_GD-1, Math.round(wz)));
  return (icg[gz] && icg[gz][gx] !== undefined) ? icg[gz][gx] : 255;
}

function _laIsNewHole(x, z) {
  for (var i = 0; i < _laLaunchPositions.length; i++) {
    var dx = x - _laLaunchPositions[i].x, dz = z - _laLaunchPositions[i].z;
    if (dx*dx + dz*dz < LA_MIN_HOLE_DIST * LA_MIN_HOLE_DIST) return false;
  }
  return true;
}

// ── SOUND ──
function _laPlayMissileSound() {
  var a = new Audio('/Sounds/missile-firing-fl-sound.mp3');
  a.volume = 0.9; a.play().catch(function() {});
}

// ── ICBM BUTTON (HTML overlay) ──
function _laCreateIcbmBtn() {
  var old = document.getElementById('la-icbm-btn'); if (old) old.remove();
  var btn = document.createElement('button');
  btn.id = 'la-icbm-btn';
  btn.innerHTML = '⟁&nbsp;&nbsp;ICBM&nbsp;&nbsp;LAUNCH';
  btn.style.cssText = [
    'position:fixed', 'bottom:22%', 'left:50%', 'transform:translateX(-50%)',
    'background:rgba(0,14,5,0.93)', 'border:2px solid rgba(0,255,90,0.75)',
    'color:rgba(0,255,110,1)', "font-family:'Share Tech Mono',monospace",
    'font-size:15px', 'letter-spacing:0.14em', 'padding:13px 36px',
    'cursor:pointer', 'z-index:1200', 'display:none',
    'text-shadow:0 0 10px #00ff60', 'box-shadow:0 0 18px rgba(0,255,70,0.25)',
    'border-radius:2px', 'pointer-events:auto',
  ].join(';');
  document.body.appendChild(btn);
  function _fire(e) {
    e.preventDefault(); e.stopPropagation();
    if (_laLaunchState === 'idle' && _laUnderHole) _laStartCountdown();
  }
  btn.addEventListener('click', _fire);
  btn.addEventListener('touchend', _fire, { passive: false });
  return btn;
}

function _laUpdateIcbmBtn() {
  var btn = document.getElementById('la-icbm-btn'); if (!btn) return;
  var show = (_laLaunchState === 'idle' && _laUnderHole && _laIsNewHole(
    (window._getGameState ? window._getGameState() : { player: { x: 0, z: 0 } }).player.x,
    (window._getGameState ? window._getGameState() : { player: { x: 0, z: 0 } }).player.z
  ));
  btn.style.display = show ? '' : 'none';
  if (show) {
    var g = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() * 0.0045));
    btn.style.borderColor = 'rgba(0,255,90,' + g + ')';
    btn.style.textShadow = '0 0 ' + Math.round(g * 14) + 'px #00ff60';
  }
}

// ── PROGRESS BAR ──
function _laSetObjBar(msg) {
  var el = document.getElementById('campaign-objective-bar');
  if (!el) return;
  if (msg) { el.textContent = msg; el.style.display = ''; return; }
  var bullets = '';
  for (var i = 0; i < LA_LAUNCHES_NEEDED; i++) bullets += (i < _laSuccessCount ? '⊛ ' : '⊙ ');
  el.textContent = '⟁ LAUNCH ' + bullets.trim() + '  ·  ' + _laSuccessCount + '/' + LA_LAUNCHES_NEEDED + ' HOLES CLEARED';
  el.style.display = '';
}

// ── COUNTDOWN ──
function _laStartCountdown() {
  if (_laLaunchState !== 'idle') return;
  _laLaunchState = 'countdown';
  _laCountFrames = LA_COUNTDOWN_FRAMES;
  _laLastSec = 3;
  var btn = document.getElementById('la-icbm-btn'); if (btn) btn.style.display = 'none';
  if (window._addEvent) window._addEvent('⟁ ICBM LAUNCH SEQUENCE — INITIATED', true);
}

// ── FIRE ──
function _laFireMissile(st) {
  var underHoleNow = _laGetHolePx(st.player.x, st.player.z) < LA_HOLE_THRESH;
  _laMissile = {
    x: st.player.x, z: st.player.z,
    y: st.player.y + 1.5,
    vy: 0.3, alive: true, throughHole: underHoleNow,
    originX: st.player.x, originZ: st.player.z,
  };
  _laLaunchState = 'flying';
  _laSmokeRings = [];
  _laPlayMissileSound();
  if (window._addEvent) window._addEvent(
    underHoleNow ? '◎ ICBM AWAY — TRAJECTORY NOMINAL' : '◎ ICBM AWAY — ICE IMPACT IMMINENT', true
  );
}

// ── OUTCOME ──
function _laSuccess(x, z) {
  _laLaunchPositions.push({ x: x, z: z });
  _laSuccessCount++;
  _laMissile = null;
  _laLaunchState = 'idle';
  if (_laSuccessCount >= LA_LAUNCHES_NEEDED) {
    _laWin();
  } else {
    if (window._addEvent) window._addEvent(
      '⊛ LAUNCH CONFIRMED — ' + _laSuccessCount + '/' + LA_LAUNCHES_NEEDED + ' · FIND NEXT HOLE', false
    );
    _laSetObjBar();
  }
}

function _laWin() {
  if (_laLaunchState === 'done') return;
  _laLaunchState = 'done'; _laActive = false;
  if (window._addEvent) window._addEvent('⊛ ALL LAUNCHES COMPLETE — MISSION SUCCESS', false);
  if (window._musicStop) window._musicStop();
  setTimeout(function() {
    if (window._onCampaignMissionComplete) {
      var fn = window._onCampaignMissionComplete; window._onCampaignMissionComplete = null; fn();
    }
  }, 3500);
}

function _laIceImpact(x, z, y) {
  if (_laLaunchState === 'done') return;
  _laLaunchState = 'done';
  _laMissile = null;
  if (window._addEvent) window._addEvent('⛔ ICBM DETONATED ON ICE — CATASTROPHIC FAILURE', true);
  var gs = window._getGameState ? window._getGameState() : null;
  if (gs && gs.explosions) {
    for (var i = 0; i < 12; i++) {
      gs.explosions.push({
        x: x + (Math.random()-0.5)*24, y: LA_GRID_H - 1.5,
        z: z + (Math.random()-0.5)*24,
        r: 0, maxR: 20 + Math.random()*16, alpha: 1, isLarge: true,
      });
    }
    // Additional low-altitude shockwave blasts
    for (var j = 0; j < 6; j++) {
      gs.explosions.push({
        x: x + (Math.random()-0.5)*40, y: y - Math.random()*6,
        z: z + (Math.random()-0.5)*40,
        r: 0, maxR: 14 + Math.random()*10, alpha: 1, isLarge: true,
      });
    }
    if (gs.hull !== undefined) gs.hull = 0;
  }
}

// ── FRAME UPDATE ──
function _laUpdate() {
  if (!_laActive) return;
  var state = window._getGameState ? window._getGameState() : null;
  if (!state) return;

  _laMFrame++;

  // ── Ice ceiling enforcement ──
  _laHoleIcePx = _laGetHolePx(state.player.x, state.player.z);
  _laUnderHole = _laHoleIcePx < LA_HOLE_THRESH;
  var _iceCeilY = LA_GRID_H - (_laHoleIcePx / 255) * LA_ICE_SCALE;
  var _maxY = _laUnderHole ? LA_GRID_H + 1.5 : _iceCeilY - 1.2;
  if (state.player.y > _maxY) state.player.y = _maxY;
  if (!_laUnderHole && (state.viewMode === 'surface' || state.viewMode === 'surfaced')) {
    state.player.y = Math.min(state.player.y, LA_GRID_H - 2);
    if (!_laRevertGuard && window._goToPeriscope) { _laRevertGuard = true; window._goToPeriscope(); }
  } else if (state.viewMode === 'periscope') { _laRevertGuard = false; }

  // ── Enemy fire rate control — one shot per 12-18 s window ──
  // Main enemy uses state.enemyLastFired (real-time clock); extra enemies use en.lastFired
  if (!_laEnemyFireOpen) {
    _laEnemyFireTimer--;
    if (_laEnemyFireTimer <= 0) {
      _laEnemyFireOpen = true;
      _laEnemyFireTimer = 90; // 1.5-second window
    }
    // Block main enemy by keeping lastFired in the future
    state.enemyLastFired = Date.now();
    // Block extra enemies
    if (state.extraEnemies) state.extraEnemies.forEach(function(e) {
      e.lastFired = Date.now() + 15000;
    });
  } else {
    _laEnemyFireTimer--;
    if (_laEnemyFireTimer <= 0) {
      _laEnemyFireOpen = false;
      _laEnemyFireTimer = 720 + Math.floor(Math.random() * 360); // 12-18 s until next window
    }
  }

  // ── Countdown tick ──
  if (_laLaunchState === 'countdown') {
    _laCountFrames--;
    var secsLeft = Math.ceil(_laCountFrames / 60);
    if (secsLeft !== _laLastSec && secsLeft >= 1) {
      _laLastSec = secsLeft;
      if (_LA_CD[secsLeft] && window._addEvent) window._addEvent(_LA_CD[secsLeft], false);
    }
    if (_laCountFrames <= 0) {
      // Check still under hole
      if (_laGetHolePx(state.player.x, state.player.z) < LA_HOLE_THRESH) {
        _laFireMissile(state);
      } else {
        // Moved out from under hole during countdown — fire anyway (hits ice)
        _laFireMissile(state);
      }
    }
    return;
  }

  // ── Missile flight ──
  if (_laMissile && _laMissile.alive) {
    _laMissile.vy = Math.min(2.8, _laMissile.vy + 0.065);
    _laMissile.y += _laMissile.vy;

    // Smoke ring every 4 frames
    if (_laMFrame % 4 === 0) {
      _laSmokeRings.push({ x: _laMissile.x, z: _laMissile.z, y: _laMissile.y - 2, r: 0, alpha: 0.55, born: _laMFrame });
    }
    // Decay rings
    _laSmokeRings = _laSmokeRings.filter(function(s) { return _laMFrame - s.born < 60; });
    _laSmokeRings.forEach(function(s) { s.r += 0.35; s.alpha -= 0.009; });

    if (_laMissile.y >= LA_GRID_H) {
      _laMissile.alive = false;
      if (_laMissile.throughHole) {
        _laSuccess(_laMissile.originX, _laMissile.originZ);
      } else {
        _laIceImpact(_laMissile.x, _laMissile.z, _laMissile.y);
      }
    }
  }

  // Update ICBM button visibility
  _laUpdateIcbmBtn();
}

// ── DRAW HOOK (all non-periscope view modes + periscope via game.js hook) ──
function _laDraw(ctx, pcx, pcy) {
  var state = window._getGameState ? window._getGameState() : null;
  if (!state) return;
  var W = ctx.canvas.width, H = ctx.canvas.height;
  var isCmd = (state.viewMode === 'command');
  var isPeri = !isCmd;

  // ── Missile visual ──
  if (_laMissile && _laMissile.alive) {
    if (isCmd && window._projectCmd) {
      _laDrawMissileCmd(ctx, W, H);
    } else if (isPeri && window._projectPeriscope) {
      _laDrawMissilePeri(ctx);
    }
  }

  // ── Countdown overlay (all views) ──
  if (_laLaunchState === 'countdown') {
    var secsLeft = Math.max(0, Math.ceil(_laCountFrames / 60));
    var pulse = 0.75 + 0.25 * Math.sin(Date.now() * 0.012);
    ctx.save();
    ctx.fillStyle = 'rgba(0,4,2,0.82)';
    ctx.fillRect(W*0.16, H*0.08, W*0.68, H*0.36);
    ctx.strokeStyle = 'rgba(255,60,50,' + (pulse * 0.9) + ')';
    ctx.lineWidth = 1.5; ctx.strokeRect(W*0.16, H*0.08, W*0.68, H*0.36);
    ctx.textAlign = 'center'; ctx.shadowBlur = 14; ctx.shadowColor = '#ff2200';
    ctx.fillStyle = 'rgba(255,90,70,' + pulse + ')';
    ctx.font = 'bold ' + Math.round(W*0.016) + 'px Share Tech Mono';
    ctx.fillText('⟁  ICBM LAUNCH SEQUENCE', W*0.5, H*0.155);
    ctx.font = 'bold ' + Math.round(W*0.076) + 'px Share Tech Mono';
    ctx.fillStyle = 'rgba(255,50,40,' + pulse + ')';
    ctx.fillText(secsLeft, W*0.5, H*0.30);
    var checks = [
      secsLeft < 3 ? '✓ GYROSCOPE ALIGNED' : '  GYROSCOPE SPINNING…',
      secsLeft < 2 ? '✓ WARHEAD ARMED'     : '  ARMING WARHEAD…',
      secsLeft < 1 ? '✓ IGNITION PRIMED'   : '  PRIMING IGNITION…',
    ];
    ctx.font = Math.round(W*0.011) + 'px Share Tech Mono';
    ctx.fillStyle = 'rgba(170,220,255,0.88)'; ctx.shadowBlur = 0;
    checks.forEach(function(m, i) { ctx.fillText(m, W*0.5, H*0.355 + i * H*0.027); });
    ctx.restore();
    return;
  }

  // ── Idle: hole/status indicator ──
  if (_laLaunchState === 'idle') {
    ctx.save(); ctx.textAlign = 'center'; ctx.shadowBlur = 0;
    if (_laUnderHole) {
      var newHole = _laIsNewHole(state.player.x, state.player.z);
      if (newHole) {
        var glow = 0.80 + 0.20 * Math.sin(Date.now() * 0.007);
        ctx.fillStyle = 'rgba(0,255,150,' + glow + ')';
        ctx.shadowBlur = 16; ctx.shadowColor = '#00ff80';
        ctx.font = 'bold ' + Math.round(W*0.012) + 'px Share Tech Mono';
        ctx.fillText('◎  LAUNCH WINDOW ACQUIRED  ◎', W*0.5, H*0.075);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(255,190,50,0.80)';
        ctx.font = Math.round(W*0.011) + 'px Share Tech Mono';
        ctx.fillText('⊛ HOLE ALREADY USED — NAVIGATE TO A NEW OPENING', W*0.5, H*0.075);
      }
    } else {
      var iceM = (_laHoleIcePx / 255 * LA_ICE_SCALE).toFixed(1);
      ctx.fillStyle = 'rgba(80,150,210,0.72)';
      ctx.font = Math.round(W*0.011) + 'px Share Tech Mono';
      ctx.fillText('⟁  ICE OVERHEAD  ' + iceM + ' m  ·  NAVIGATE TO FIND LAUNCH HOLE', W*0.5, H*0.075);
    }
    // Progress dots
    var dotStr = '';
    for (var d = 0; d < LA_LAUNCHES_NEEDED; d++) dotStr += (d < _laSuccessCount ? ' ⊛' : ' ⊙');
    ctx.fillStyle = 'rgba(140,200,255,0.7)';
    ctx.font = Math.round(W*0.013) + 'px Share Tech Mono';
    ctx.fillText('LAUNCHES' + dotStr, W*0.5, H*0.94);
    ctx.restore();
  }
}

function _laDrawMissilePeri(ctx) {
  var proj = window._projectPeriscope;
  var tip  = proj(_laMissile.x, _laMissile.y, _laMissile.z);
  var tail = proj(_laMissile.x, Math.max(0, _laMissile.y - 10), _laMissile.z);
  if (!tip || !tail || tip.depth < 0.1 || tip.depth > 90) return;
  ctx.save();
  var g = ctx.createLinearGradient(tip.sx, tip.sy, tail.sx, tail.sy);
  g.addColorStop(0,    'rgba(255,255,255,0.95)');
  g.addColorStop(0.2,  'rgba(255,210,80,0.85)');
  g.addColorStop(1,    'rgba(255,60,0,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = Math.max(2, 10 / Math.max(0.4, tip.depth * 0.18));
  ctx.shadowBlur = 28; ctx.shadowColor = '#ffffff';
  ctx.beginPath(); ctx.moveTo(tip.sx, tip.sy); ctx.lineTo(tail.sx, tail.sy); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(tip.sx, tip.sy, Math.max(2, 6 / Math.max(0.4, tip.depth*0.14)), 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,240,0.95)'; ctx.shadowBlur = 20; ctx.shadowColor = '#fffad0';
  ctx.fill(); ctx.shadowBlur = 0;
  // Smoke rings in peri
  _laSmokeRings.forEach(function(s) {
    var sp = proj(s.x, s.y, s.z);
    if (!sp || sp.depth < 0.1) return;
    var sr = Math.max(1, (s.r * 3) / Math.max(0.4, sp.depth * 0.18));
    ctx.beginPath(); ctx.arc(sp.sx, sp.sy, sr, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(200,190,170,' + Math.max(0, s.alpha) + ')';
    ctx.lineWidth = 1.5; ctx.stroke();
  });
  ctx.restore();
}

function _laDrawMissileCmd(ctx, W, H) {
  var proj = window._projectCmd;
  var nose = proj(_laMissile.x, _laMissile.y, _laMissile.z);
  var base = proj(_laMissile.x, Math.max(0, _laMissile.y - 4), _laMissile.z);
  if (!nose || !base) return;
  ctx.save();
  var cw = 5, bodyH = Math.abs(base.sy - nose.sy) + 4;
  // Body
  ctx.fillStyle = 'rgba(210,215,230,0.92)';
  ctx.fillRect(nose.sx - cw/2, nose.sy, cw, bodyH);
  // Nose cone
  ctx.beginPath();
  ctx.moveTo(nose.sx - cw/2, nose.sy);
  ctx.lineTo(nose.sx, nose.sy - 12);
  ctx.lineTo(nose.sx + cw/2, nose.sy);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,80,60,0.95)'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff3000';
  ctx.fill(); ctx.shadowBlur = 0;
  // Fins
  ctx.fillStyle = 'rgba(160,170,190,0.85)';
  ctx.fillRect(nose.sx - cw/2 - 4, base.sy - 8, 4, 8);
  ctx.fillRect(nose.sx + cw/2,     base.sy - 8, 4, 8);
  // Exhaust glow
  ctx.beginPath(); ctx.arc(base.sx, base.sy + 4, 7, 0, Math.PI*2);
  var eg = ctx.createRadialGradient(base.sx, base.sy + 4, 0, base.sx, base.sy + 4, 7);
  eg.addColorStop(0, 'rgba(255,200,80,0.9)'); eg.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = eg; ctx.fill();
  // Smoke trail (command view)
  _laSmokeRings.forEach(function(s) {
    var sp = proj(s.x, s.y, s.z);
    if (!sp) return;
    ctx.beginPath(); ctx.arc(sp.sx, sp.sy, Math.max(2, s.r * 2), 0, Math.PI*2);
    ctx.fillStyle = 'rgba(180,175,165,' + Math.max(0, s.alpha * 0.7) + ')';
    ctx.fill();
  });
  ctx.restore();
}

// ── MAIN ENTRY ──
function launchLaunchAuthority(difficulty) {
  _laActive         = false;
  _laDifficulty     = difficulty || 'captain';
  _laLaunchState    = 'idle';
  _laCountFrames    = 0;
  _laLastSec        = -1;
  _laMissile        = null;
  _laUnderHole      = false;
  _laHoleIcePx      = 255;
  _laSuccessCount   = 0;
  _laLaunchPositions = [];
  _laMFrame         = 0;
  _laRevertGuard    = false;
  _laEnemyFireOpen  = false;
  _laEnemyFireTimer = 900;
  _laSmokeRings     = [];

  _laLoadHeightfields().then(function(grid) {
    window._isHeightfield    = true;
    window._campaignMode     = true;
    window._arcticSurface    = true;
    window._campaignBriefingImg = LA_ICE_MAP;

    window.launchGame(grid);

    var st = window._getGameState ? window._getGameState() : null;
    if (st) { st.ships = []; st.player.y = LA_SPAWN_Y; }

    window._angelsUpdate     = _laUpdate;
    window._angelsDrawOnPeri = _laDraw;

    if (window._goToPeriscope) window._goToPeriscope();
    if (window._setPlayerSpawn)   window._setPlayerSpawn(LA_SPAWN_X, LA_SPAWN_Z);
    if (window._setPlayerHeading) window._setPlayerHeading(Math.PI);

    if (st && st.enemy) {
      st.enemy.x = 55 + Math.random()*18; st.enemy.y = 16 + Math.random()*6;
      st.enemy.z = 20 + Math.random()*30; st.enemy.heading = Math.PI;
      st.enemy.alive = true; st.enemy.hits = 0;
    }
    var extras = { cadet: 0, captain: 1, commander: 2 };
    var n = extras[_laDifficulty] || 0;
    if (n > 0 && window._spawnExtraEnemies) window._spawnExtraEnemies(n);

    _laCreateIcbmBtn();

    _laCanvas = document.getElementById('canvas');
    window._launchAuthorityCleanup = function() {
      _laActive = false;
      window._arcticSurface = false;
      window._angelsUpdate = null;
      window._angelsDrawOnPeri = null;
      var btn = document.getElementById('la-icbm-btn'); if (btn) btn.remove();
      _laCanvas = null;
    };

    if (window._musicStart) window._musicStart();
    _laSetObjBar();

    if (window._addEvent) window._addEvent('▸ UNDER THE ARCTIC ICE — BEARING NORTH', false);
    setTimeout(function() {
      if (window._addEvent) window._addEvent('▸ NAVIGATE TO A LAUNCH HOLE — TOP SECRET SHOWS ICE MAP', false);
    }, 4000);
    setTimeout(function() {
      if (window._addEvent) window._addEvent('⚠ HOSTILE CONTACT IN WATER — DO NOT LET THEM STOP YOU', true);
    }, 8000);

    _laActive = true;
  });
}

window.launchLaunchAuthority = launchLaunchAuthority;
