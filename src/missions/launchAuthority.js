// ── MISSION 06: LAUNCH AUTHORITY ──
// Arctic under-ice. Two heightfields: seafloor (LaunchAuth_Surface.png)
// and ice ceiling (LaunchAuth_Ice.png). Black pixels in ice map = launch holes.
// Navigate to a hole, initiate launch, survive the 10-second countdown.
// Launch outside a hole detonates against the ice — catastrophic.

const LA_GW = 128, LA_GD = 128;
const LA_SURFACE_MAP  = '/maps/LaunchAuth_Surface.png';
const LA_ICE_MAP      = '/maps/LaunchAuth_Ice.png';
const LA_ICE_SCALE    = 10;    // max ice thickness (units) hanging from ceiling
const LA_FLOOR_SCALE  = 18;    // seafloor peak height
const LA_GRID_H       = 32;    // world height
const LA_HOLE_THRESH  = 30;    // ice pixel value below which = open hole
const LA_SPAWN_X      = 64;
const LA_SPAWN_Z      = 108;
const LA_SPAWN_Y      = 14;    // mid-depth on start

// ── STATE ──
let _laActive        = false;
let _laStartTime     = 0;
let _laDifficulty    = 'captain';
let _laUnderHole     = false;
let _laHoleIcePx     = 255;
let _laLaunchState   = 'idle';   // 'idle' | 'countdown' | 'flying' | 'done'
let _laCountFrames   = 0;
let _laLastSec       = -1;
let _laMissile       = null;
let _laBtnBounds     = null;
let _laCanvas        = null;

// ── HEIGHTFIELD LOADER ──
function _laLoadHeightfields() {
  return new Promise(function(resolve) {
    var pending = 2;

    function tryResolve() {
      if (--pending > 0) return;
      var g = [];
      for (var zz = 0; zz < LA_GD; zz++) {
        g[zz] = [];
        for (var xx = 0; xx < LA_GW; xx++) g[zz][xx] = 0;
      }
      resolve(g);
    }

    function loadPng(src, onPx, onErr) {
      var img = new Image();
      img.onload = function() {
        var tmp = document.createElement('canvas');
        tmp.width = LA_GW; tmp.height = LA_GD;
        var tc = tmp.getContext('2d');
        tc.drawImage(img, 0, 0, LA_GW, LA_GD);
        onPx(tc.getImageData(0, 0, LA_GW, LA_GD).data);
      };
      img.onerror = onErr;
      img.src = src;
    }

    // Seafloor
    loadPng(LA_SURFACE_MAP, function(px) {
      var hg = [];
      for (var z = 0; z < LA_GD; z++) {
        hg[z] = [];
        for (var x = 0; x < LA_GW; x++) hg[z][x] = px[(z * LA_GW + x) * 4];
      }
      window._canyonHeightGrid = hg;
      window._hfGridW = LA_GW; window._hfGridD = LA_GD;
      window._hfGridH = LA_GRID_H; window._hfTerrainScale = LA_FLOOR_SCALE;
      tryResolve();
    }, function() {
      var hg = [];
      for (var z = 0; z < LA_GD; z++) { hg[z] = []; for (var x = 0; x < LA_GW; x++) hg[z][x] = 0; }
      window._canyonHeightGrid = hg;
      window._hfGridW = LA_GW; window._hfGridD = LA_GD;
      window._hfGridH = LA_GRID_H; window._hfTerrainScale = LA_FLOOR_SCALE;
      tryResolve();
    });

    // Ice ceiling — stored as pending so launchGame picks it up
    loadPng(LA_ICE_MAP, function(px) {
      var hg = [];
      for (var z = 0; z < LA_GD; z++) {
        hg[z] = [];
        for (var x = 0; x < LA_GW; x++) hg[z][x] = px[(z * LA_GW + x) * 4];
      }
      window._pendingIceCeilingGrid = hg;
      window._pendingIceTerrainScale = LA_ICE_SCALE;
      tryResolve();
    }, function() {
      window._pendingIceCeilingGrid = undefined;
      tryResolve();
    });
  });
}

// ── HOLE DETECTION ──
function _laGetHolePx(wx, wz) {
  var icg = window._iceCeilingGrid;
  if (!icg) return 255;
  var gx = Math.max(0, Math.min(LA_GW - 1, Math.round(wx)));
  var gz = Math.max(0, Math.min(LA_GD - 1, Math.round(wz)));
  return (icg[gz] && icg[gz][gx] !== undefined) ? icg[gz][gx] : 255;
}

// ── COUNTDOWN EVENTS ──
var _LA_EVENTS = {
  10: null, // already shown at initiation
  8:  '◈ INERTIAL NAVIGATION — GYROSCOPE SPINNING UP',
  6:  '◉ GUIDANCE COMPUTER — TARGET SOLUTION LOCKED',
  4:  '⚠ WARHEAD SAFING REMOVED — LAUNCH KEY ARMED',
  2:  '▸ LAUNCH AUTHORITY CONFIRMED — STAND BY FOR FIRE',
};

function _laStartCountdown() {
  if (_laLaunchState !== 'idle') return;
  _laLaunchState  = 'countdown';
  _laCountFrames  = 600;
  _laLastSec      = 10;
  _laBtnBounds    = null;
  if (window._addEvent) window._addEvent('⟁ LAUNCH SEQUENCE INITIATED — 10 SECONDS TO LAUNCH', true);
}

function _laFireMissile(state) {
  var underHoleNow = _laGetHolePx(state.player.x, state.player.z) < LA_HOLE_THRESH;
  _laMissile = {
    x: state.player.x, z: state.player.z,
    y: state.player.y + 1.5,
    vy: 0.45,
    alive: true,
    throughHole: underHoleNow,
  };
  _laLaunchState = 'flying';
  if (window._addEvent) {
    window._addEvent(underHoleNow
      ? '◎ MISSILE AWAY — TRAJECTORY CLEAR'
      : '◎ MISSILE AWAY — ICE CONTACT IMMINENT', true);
  }
}

function _laWin() {
  if (_laLaunchState === 'done') return;
  _laLaunchState = 'done';
  _laActive = false;
  if (window._addEvent) window._addEvent('⊛ LAUNCH SUCCESSFUL — MISSILE ON TARGET — MISSION COMPLETE', false);
  if (window._musicStop) window._musicStop();
  setTimeout(function() {
    if (window._onCampaignMissionComplete) {
      var fn = window._onCampaignMissionComplete;
      window._onCampaignMissionComplete = null;
      fn();
    }
  }, 3500);
}

function _laIceImpact() {
  if (_laLaunchState === 'done') return;
  _laLaunchState = 'done';
  if (window._addEvent) window._addEvent('⛔ MISSILE DETONATED ON ICE — CATASTROPHIC FAILURE', true);
  // Spawn a volley of explosions at ceiling level
  var gs = window._getGameState ? window._getGameState() : null;
  if (gs && gs.explosions) {
    for (var i = 0; i < 8; i++) {
      gs.explosions.push({
        x: _laMissile.x + (Math.random() - 0.5) * 20,
        y: LA_GRID_H - 1.5,
        z: _laMissile.z + (Math.random() - 0.5) * 20,
        r: 0, maxR: 16 + Math.random() * 12, alpha: 1, isLarge: true,
      });
    }
    // Nuclear flash — set hull to 0 to trigger game over
    if (gs.hull !== undefined) gs.hull = 0;
  }
}

// ── FRAME UPDATE HOOK ──
function _laUpdate() {
  if (!_laActive) return;
  var state = window._getGameState ? window._getGameState() : null;
  if (!state) return;

  _laHoleIcePx = _laGetHolePx(state.player.x, state.player.z);
  _laUnderHole  = _laHoleIcePx < LA_HOLE_THRESH;

  // Enforce ice ceiling — cap player y so they can't breach solid ice
  // _laUpdate runs before movePlayer, so capping here means ny = capped_y + dy stays sub-threshold
  var _iceCeilY = LA_GRID_H - (_laHoleIcePx / 255) * LA_ICE_SCALE;
  var _maxY = _laUnderHole ? LA_GRID_H + 1.5 : _iceCeilY - 1.2;
  if (state.player.y > _maxY) state.player.y = _maxY;
  // Revert illegal surface mode (can happen on first frame after a fast ascent)
  if (!_laUnderHole && (state.viewMode === 'surface' || state.viewMode === 'surfaced')) {
    state.player.y = Math.min(state.player.y, LA_GRID_H - 2);
    if (window._goToPeriscope) window._goToPeriscope();
  }

  if (_laLaunchState === 'countdown') {
    _laCountFrames--;
    var secsLeft = Math.ceil(_laCountFrames / 60);
    if (secsLeft !== _laLastSec) {
      _laLastSec = secsLeft;
      if (secsLeft > 0 && _LA_EVENTS[secsLeft]) {
        if (window._addEvent) window._addEvent(_LA_EVENTS[secsLeft], false);
      }
    }
    if (_laCountFrames <= 0) _laFireMissile(state);
  }

  if (_laMissile && _laMissile.alive) {
    _laMissile.vy = Math.min(2.6, _laMissile.vy + 0.055);
    _laMissile.y += _laMissile.vy;
    if (_laMissile.y >= LA_GRID_H) {
      _laMissile.alive = false;
      if (_laMissile.throughHole) _laWin(); else _laIceImpact();
    }
  }
}

// ── PERISCOPE DRAW HOOK ──
function _laDraw(ctx, pcx, pcy) {
  var state = window._getGameState ? window._getGameState() : null;
  if (!state) return;
  var W = ctx.canvas.width, H = ctx.canvas.height;
  var proj = window._projectPeriscope;

  // Missile streak
  if (_laMissile && _laMissile.alive && proj) {
    var tip  = proj(_laMissile.x, _laMissile.y, _laMissile.z);
    var tail = proj(_laMissile.x, Math.max(0, _laMissile.y - 12), _laMissile.z);
    if (tip && tail && tip.depth > 0.1 && tip.depth < 90) {
      ctx.save();
      var g = ctx.createLinearGradient(tip.sx, tip.sy, tail.sx, tail.sy);
      g.addColorStop(0,   'rgba(255,255,255,0.95)');
      g.addColorStop(0.25,'rgba(255,200,80,0.8)');
      g.addColorStop(1,   'rgba(255,60,0,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(2, 10 / Math.max(0.5, tip.depth * 0.18));
      ctx.shadowBlur = 32; ctx.shadowColor = '#ffffff';
      ctx.beginPath(); ctx.moveTo(tip.sx, tip.sy); ctx.lineTo(tail.sx, tail.sy); ctx.stroke();
      ctx.shadowBlur = 0;
      // Bright nose
      ctx.beginPath(); ctx.arc(tip.sx, tip.sy, Math.max(2, 6 / Math.max(0.4, tip.depth * 0.15)), 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,240,0.95)';
      ctx.shadowBlur = 24; ctx.shadowColor = '#fffad0'; ctx.fill(); ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // Countdown display
  if (_laLaunchState === 'countdown') {
    var secsLeft = Math.ceil(_laCountFrames / 60);
    var pulse = 0.75 + 0.25 * Math.sin(Date.now() * 0.009);
    ctx.save();
    ctx.fillStyle = 'rgba(0,2,10,0.80)';
    ctx.fillRect(W * 0.14, H * 0.10, W * 0.72, H * 0.40);
    ctx.strokeStyle = `rgba(255,50,50,${pulse * 0.85})`;
    ctx.lineWidth = 1.5; ctx.strokeRect(W * 0.14, H * 0.10, W * 0.72, H * 0.40);

    ctx.textAlign = 'center'; ctx.shadowBlur = 14; ctx.shadowColor = '#ff2200';
    ctx.fillStyle = `rgba(255,80,60,${pulse})`;
    ctx.font = `bold ${Math.round(W * 0.017)}px Share Tech Mono`;
    ctx.fillText('⟁ LAUNCH SEQUENCE IN PROGRESS', W * 0.5, H * 0.175);

    ctx.font = `bold ${Math.round(W * 0.072)}px Share Tech Mono`;
    ctx.fillStyle = `rgba(255,50,50,${pulse})`;
    ctx.fillText('T - ' + String(secsLeft).padStart(2, '0'), W * 0.5, H * 0.325);

    ctx.font = `${Math.round(W * 0.0105)}px Share Tech Mono`;
    ctx.fillStyle = 'rgba(180,220,255,0.88)';
    ctx.shadowBlur = 0;
    [
      secsLeft <= 8 ? '✓ INERTIAL NAV — GYROSCOPE ALIGNED'        : '  GYROSCOPE SPINNING…',
      secsLeft <= 6 ? '✓ GUIDANCE COMPUTER — SOLUTION LOCKED'     : '  GUIDANCE ALIGNING…',
      secsLeft <= 4 ? '✓ WARHEAD ARMED — SAFETIES REMOVED'        : '  WARHEAD SAFING…',
      secsLeft <= 2 ? '✓ LAUNCH AUTHORITY — CONFIRMED'            : '  AWAITING AUTHORITY…',
    ].forEach(function(m, i) {
      ctx.fillText(m, W * 0.5, H * 0.375 + i * H * 0.027);
    });
    ctx.restore();
    _laBtnBounds = null;
    return;
  }

  // Hole indicator + launch button (idle state)
  if (_laLaunchState === 'idle') {
    ctx.save();
    ctx.textAlign = 'center'; ctx.shadowBlur = 0;

    if (_laUnderHole) {
      var glow = 0.80 + 0.20 * Math.sin(Date.now() * 0.007);
      ctx.fillStyle = `rgba(0,255,150,${glow})`;
      ctx.shadowBlur = 16; ctx.shadowColor = '#00ff80';
      ctx.font = `bold ${Math.round(W * 0.012)}px Share Tech Mono`;
      ctx.fillText('◎  LAUNCH WINDOW ACQUIRED  ◎', W * 0.5, H * 0.075);
      ctx.shadowBlur = 0;

      // Launch button — bottom centre
      var bw = W * 0.34, bh = H * 0.058, bx = W * 0.5 - bw * 0.5, by = H * 0.865;
      ctx.fillStyle = 'rgba(0,18,6,0.88)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = `rgba(0,255,100,${glow})`;
      ctx.lineWidth = 1.5; ctx.shadowBlur = 12; ctx.shadowColor = '#00ff60';
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = `rgba(0,255,120,${glow})`;
      ctx.font = `bold ${Math.round(W * 0.013)}px Share Tech Mono`;
      ctx.shadowBlur = 8;
      ctx.fillText('[ ◎  INITIATE LAUNCH ]', W * 0.5, by + bh * 0.66);
      ctx.shadowBlur = 0;
      _laBtnBounds = { x1: bx, y1: by, x2: bx + bw, y2: by + bh };
    } else {
      var iceM = (_laHoleIcePx / 255 * LA_ICE_SCALE).toFixed(1);
      ctx.fillStyle = 'rgba(80,150,210,0.72)';
      ctx.font = `${Math.round(W * 0.011)}px Share Tech Mono`;
      ctx.fillText('⟁  ICE OVERHEAD  ' + iceM + ' m  ·  NAVIGATE TO FIND LAUNCH HOLE', W * 0.5, H * 0.075);
      _laBtnBounds = null;
    }
    ctx.restore();
  }
}

// ── CANVAS CLICK / TOUCH HANDLER ──
function _laOnClick(e) {
  if (!_laBtnBounds || _laLaunchState !== 'idle') return;
  var el = _laCanvas;
  if (!el) return;
  var rect = el.getBoundingClientRect();
  var scX = el.width / rect.width, scY = el.height / rect.height;
  var cx, cy;
  if (e.changedTouches && e.changedTouches.length) {
    cx = (e.changedTouches[0].clientX - rect.left) * scX;
    cy = (e.changedTouches[0].clientY - rect.top)  * scY;
  } else {
    cx = (e.clientX - rect.left) * scX;
    cy = (e.clientY - rect.top)  * scY;
  }
  var b = _laBtnBounds;
  if (cx >= b.x1 && cx <= b.x2 && cy >= b.y1 && cy <= b.y2) {
    e.preventDefault(); e.stopPropagation();
    _laStartCountdown();
  }
}

// ── OBJECTIVE BAR ──
function _laSetObjBar() {
  var el = document.getElementById('campaign-objective-bar');
  if (el) {
    el.textContent = '⊙ OBJECTIVE: NAVIGATE TO A LAUNCH HOLE · INITIATE LAUNCH · SURVIVE THE COUNTDOWN';
    el.style.display = '';
  }
}

// ── MAIN LAUNCH ENTRY ──
function launchLaunchAuthority(difficulty) {
  _laActive      = false;
  _laStartTime   = 0;
  _laDifficulty  = difficulty || 'captain';
  _laLaunchState = 'idle';
  _laCountFrames = 0;
  _laLastSec     = -1;
  _laMissile     = null;
  _laBtnBounds   = null;
  _laUnderHole   = false;
  _laHoleIcePx   = 255;

  _laLoadHeightfields().then(function(grid) {
    window._isHeightfield   = true;
    window._campaignMode    = true;
    window._arcticSurface   = true;  // icy surface — no waves or ships

    // TOP SECRET button shows the ice ceiling map
    window._campaignBriefingImg = LA_ICE_MAP;

    window.launchGame(grid);

    // Clear surface ships — no vessels on frozen arctic ocean
    var st = window._getGameState ? window._getGameState() : null;
    if (st) {
      st.ships = [];
      // Set spawn depth
      st.player.y = LA_SPAWN_Y;
    }

    // Reinstall hooks
    window._angelsUpdate    = _laUpdate;
    window._angelsDrawOnPeri = _laDraw;

    // Start in periscope view
    if (window._goToPeriscope) window._goToPeriscope();

    // Spawn at south-centre, periscope facing north
    if (window._setPlayerSpawn)   window._setPlayerSpawn(LA_SPAWN_X, LA_SPAWN_Z);
    if (window._setPlayerHeading) window._setPlayerHeading(Math.PI); // periAngleH=π = north

    // Enemy sub — lurking mid-ice field, heading south toward player
    if (st && st.enemy) {
      st.enemy.x = 55 + Math.random() * 18;
      st.enemy.y = 16 + Math.random() * 6;
      st.enemy.z = 20 + Math.random() * 30;
      st.enemy.heading = Math.PI; // facing south
      st.enemy.alive = true;
      st.enemy.hits  = 0;
    }

    // Extra enemies by difficulty
    var extras = { cadet: 0, captain: 1, commander: 2 };
    var n = extras[_laDifficulty] || 0;
    if (n > 0 && window._spawnExtraEnemies) window._spawnExtraEnemies(n);

    // Wire canvas click handler; expose cleanup for campaign system
    _laCanvas = document.getElementById('canvas');
    if (_laCanvas) {
      _laCanvas.addEventListener('click',    _laOnClick);
      _laCanvas.addEventListener('touchend', _laOnClick);
    }
    window._launchAuthorityCleanup = function() {
      _laActive = false;
      window._arcticSurface = false;
      window._angelsUpdate = null;
      window._angelsDrawOnPeri = null;
      if (_laCanvas) {
        _laCanvas.removeEventListener('click',    _laOnClick);
        _laCanvas.removeEventListener('touchend', _laOnClick);
        _laCanvas = null;
      }
    };

    // Music
    if (window._musicStart) window._musicStart();

    _laSetObjBar();

    if (window._addEvent) window._addEvent('▸ UNDER THE ARCTIC ICE — BEARING NORTH', false);
    setTimeout(function() {
      if (window._addEvent) window._addEvent('▸ LOCATE A LAUNCH HOLE · TOP SECRET SHOWS ICE MAP', false);
    }, 4000);
    setTimeout(function() {
      if (window._addEvent) window._addEvent('⚠ ENEMY CONTACT IN WATER — DO NOT LET THEM STOP YOU', true);
    }, 8000);

    _laStartTime = Date.now();
    _laActive    = true;
  });
}

window.launchLaunchAuthority = launchLaunchAuthority;
