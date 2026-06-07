// ── MISSION: THROUGH THE ANGELS ──
// Uses existing periscope 3D point-cloud view + Two_Angels.png heightfield.
// Canyon is fully submerged (gridH:25, terrainScale:16 → 9m clear water above peaks).
// Player controls: top bearing strip (heading) + ang-throttle bar (speed).
// Sonar panel shows Captain's Orders (tactical text) instead of sonar sweep.

const ANG_ENTRY_X = 8,  ANG_ENTRY_Z = 62;
const ANG_EXIT_X  = 120, ANG_EXIT_Z  = 60;
const ANG_GW = 128, ANG_GD = 128;
const ANG_SPEEDS = [0, 0.08, 0.18, 0.32];          // world units/tick per throttle zone
const ANG_LABELS = ['STOP', '1/3', '2/3', 'FULL'];

// ── MISSION STATE ──
let _mTorp = null, _mTorpSpawned = false, _mTorpNearAlerted = false;
let _mTorpSpeed = 0.32, _mTorpDelay = 30;
let _mStartTime = 0, _mTrail = [], _mThrottle = 1;

// ── HEIGHTFIELD LOADER ──
function _loadHeightfield() {
  return new Promise(function(resolve) {
    function buildHg(px) {
      const g = [], hg = [];
      for (let z = 0; z < ANG_GD; z++) {
        g[z] = []; hg[z] = [];
        for (let x = 0; x < ANG_GW; x++) {
          const idx = (z * ANG_GW + x) * 4;
          hg[z][x] = px ? px[idx] : 0;
          g[z][x] = 0;
        }
      }
      window._canyonHeightGrid = hg;
      window._hfGridW          = ANG_GW;
      window._hfGridD          = ANG_GD;
      window._hfGridH          = 25;   // 25m water column — fully submerged
      window._hfTerrainScale   = 16;   // canyon walls top at ≤16m
      resolve(g);
    }
    const img = new Image();
    img.onload = function() {
      const tmp = document.createElement('canvas');
      tmp.width = ANG_GW; tmp.height = ANG_GD;
      const tc = tmp.getContext('2d');
      tc.drawImage(img, 0, 0, ANG_GW, ANG_GD);
      buildHg(tc.getImageData(0, 0, ANG_GW, ANG_GD).data);
    };
    img.onerror = function() { buildHg(null); };
    img.src = '/maps/Two_Angels.png';
  });
}

// ── TORPEDO AI ──
function _torpUpdate(pos) {
  if (!_mTorp) return;

  // Noisemakers (countermeasures) divert the torpedo
  let targetX = pos.x, targetZ = pos.z;
  if (window._getNoisemakerPositions) {
    const nms = window._getNoisemakerPositions();
    if (nms.length) {
      let bestDist = Infinity, bestNm = null;
      for (const nm of nms) {
        const d = Math.hypot(nm.x - _mTorp.x, nm.z - _mTorp.z);
        if (d < bestDist) { bestDist = d; bestNm = nm; }
      }
      if (bestNm && bestDist < 28) { targetX = bestNm.x; targetZ = bestNm.z; }
    }
  }

  // Steer toward target (limited turn rate — realistic torpedo)
  const dx = targetX - _mTorp.x, dz = targetZ - _mTorp.z;
  const targetH = Math.atan2(dx, dz);
  let dh = targetH - _mTorp.heading;
  while (dh >  Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  _mTorp.heading += Math.max(-0.035, Math.min(0.035, dh));
  _mTorp.dx = Math.sin(_mTorp.heading);
  _mTorp.dz = Math.cos(_mTorp.heading);
  _mTorp.x += _mTorp.dx * _mTorpSpeed;
  _mTorp.z += _mTorp.dz * _mTorpSpeed;
  window._angelsEnemyTorp = _mTorp; // keep shared periscope ref current

  // Terrain collision → torpedo detonates
  const hg = window._canyonHeightGrid;
  if (hg) {
    const gx = Math.max(0, Math.min(ANG_GW - 1, Math.round(_mTorp.x)));
    const gz = Math.max(0, Math.min(ANG_GD - 1, Math.round(_mTorp.z)));
    const terrH = (hg[gz][gx] / 255) * (window._hfTerrainScale || 16);
    if (terrH > _mTorp.y + 0.5) { _torpDetonate(); return; }
  }

  // Out of grid bounds
  if (_mTorp.x < 1 || _mTorp.x > ANG_GW - 2 || _mTorp.z < 1 || _mTorp.z > ANG_GD - 2) {
    _torpDetonate(); return;
  }

  // Near-contact alert
  const dist2d = Math.hypot(pos.x - _mTorp.x, pos.z - _mTorp.z);
  if (!_mTorpNearAlerted && dist2d < 15) {
    _mTorpNearAlerted = true;
    if (window._addEvent) window._addEvent('⚠ TORPEDO CLOSING FAST — MAKE YOUR MOVE', true);
  }

  // Direct hit
  if (dist2d < 2.5) {
    _mTorp = null; window._angelsEnemyTorp = null;
    if (window._applyHullDamage) window._applyHullDamage(100, '⚠ TORPEDO DETONATION — HULL BREACH');
  }
}

function _torpDetonate() {
  _mTorp = null; window._angelsEnemyTorp = null;
  if (window._addEvent) window._addEvent('TORPEDO DETONATED — CANYON WALL — CONTINUE EAST', false);
  if (window._musicStop) window._musicStop();
  setTimeout(function() {
    if (window._musicStart)   window._musicStart();
    if (window._musicStealth) window._musicStealth(true);
  }, 2000);
}

// ── MAIN UPDATE — assigned to window._angelsUpdate inside launchAngels ──
function _angelsUpdateFn() {
  if (!window._getPlayerPos || !_mStartTime) return;
  const pos = window._getPlayerPos();

  // Auto-move at throttle speed
  const spd = ANG_SPEEDS[_mThrottle] || 0;
  if (spd > 0 && window._movePlayerFwd) window._movePlayerFwd(spd);

  // Build position trail for Captain's Orders display
  const last = _mTrail[_mTrail.length - 1];
  if (!last || Math.hypot(pos.x - last.x, pos.z - last.z) > 1.0) {
    _mTrail.push({ x: pos.x, z: pos.z });
    if (_mTrail.length > 350) _mTrail.shift();
  }

  // Spawn torpedo after delay
  const elapsed = (Date.now() - _mStartTime) / 1000;
  if (!_mTorpSpawned && elapsed > _mTorpDelay) {
    _mTorpSpawned = true;
    let spawnH = 0;
    if (_mTrail.length >= 2) {
      const a = _mTrail[_mTrail.length - 2], b = _mTrail[_mTrail.length - 1];
      const ddx = b.x - a.x, ddz = b.z - a.z;
      if (Math.hypot(ddx, ddz) > 0.01) spawnH = Math.atan2(ddx, ddz);
    }
    _mTorp = {
      x: pos.x - Math.sin(spawnH) * 15,
      z: pos.z - Math.cos(spawnH) * 15,
      y: pos.y, heading: spawnH, dx: 0, dz: 0,
    };
    window._angelsEnemyTorp = _mTorp;
    if (window._addEvent) window._addEvent('⚠ TORPEDO IN WATER — CONTACT ASTERN', true);
  }

  if (_mTorp) _torpUpdate(pos);
}

// ── CAPTAIN'S ORDERS — draws into the sonar canvas instead of sonar sweep ──
function _angelsDrawSonarFn() {
  const canvas = document.getElementById('sonar-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  ctx.fillStyle = '#050d18';
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = 'rgba(0,220,255,0.82)';
  ctx.font = 'bold 7px Share Tech Mono';
  ctx.textAlign = 'center';
  ctx.fillText('RED ROUTE  ·  ANGELS', W / 2, 11);
  ctx.strokeStyle = 'rgba(0,160,200,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(5, 16); ctx.lineTo(W - 5, 16); ctx.stroke();

  let y = 27;
  function row(label, value, valColor) {
    ctx.font = '6.5px Share Tech Mono';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,150,190,0.55)';
    ctx.fillText(label, 7, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = valColor || 'rgba(0,220,255,0.88)';
    ctx.fillText(value, W - 7, y);
    y += 13;
  }

  const pos = window._getPlayerPos ? window._getPlayerPos() : null;
  if (pos) row('DEPTH', (25 - pos.y).toFixed(1) + 'm');
  row('THROTTLE', ANG_LABELS[_mThrottle], _mThrottle === 3 ? '#ffcc00' : null);

  y += 4;
  ctx.strokeStyle = 'rgba(0,160,200,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(5, y); ctx.lineTo(W - 5, y); ctx.stroke();
  y += 10;

  // Heading orders
  ctx.font = 'bold 6px Share Tech Mono';
  ctx.fillStyle = 'rgba(0,180,220,0.6)';
  ctx.textAlign = 'left';
  ctx.fillText('ORDERS', 7, y);
  y += 11;

  if (pos) {
    const exitDx   = ANG_EXIT_X - pos.x, exitDz = ANG_EXIT_Z - pos.z;
    const exitDist  = Math.hypot(exitDx, exitDz);
    const exitBear  = Math.round(((Math.atan2(exitDx, exitDz) * 180 / Math.PI) + 360) % 360);
    ctx.font = '7.5px Share Tech Mono';
    if (exitDist < 15) {
      ctx.fillStyle = 'rgba(0,255,140,0.95)'; ctx.textAlign = 'left';
      ctx.fillText('EXIT AHEAD', 7, y); y += 13;
      ctx.fillText('REDUCE SPEED', 7, y);
    } else {
      ctx.fillStyle = 'rgba(0,230,255,0.92)'; ctx.textAlign = 'left';
      ctx.fillText('MAKE FOR ' + String(exitBear).padStart(3, '0') + '°', 7, y); y += 13;
      ctx.fillStyle = 'rgba(0,180,220,0.7)';
      ctx.fillText('RANGE  ' + exitDist.toFixed(0) + 'u', 7, y);
    }
  }

  y += 18;
  ctx.strokeStyle = 'rgba(0,160,200,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(5, y); ctx.lineTo(W - 5, y); ctx.stroke();
  y += 10;

  // Contact / torpedo status
  ctx.font = 'bold 6px Share Tech Mono';
  ctx.fillStyle = 'rgba(0,180,220,0.6)'; ctx.textAlign = 'left';
  ctx.fillText('CONTACT', 7, y);
  y += 11;
  ctx.font = '7.5px Share Tech Mono';

  if (_mTorp && pos) {
    const dist  = Math.hypot(pos.x - _mTorp.x, pos.z - _mTorp.z);
    const blink = Math.floor(Date.now() / 400) % 2;
    ctx.fillStyle = dist < 15 ? (blink ? '#ff8800' : 'rgba(255,120,0,0.5)') : 'rgba(255,140,0,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText('⚠ TORP ASTERN', 7, y); y += 13;
    ctx.fillStyle = 'rgba(255,120,0,0.8)';
    ctx.fillText('  RANGE  ' + dist.toFixed(0) + 'u', 7, y);
  } else if (!_mTorpSpawned && _mStartTime > 0) {
    const rem = Math.max(0, _mTorpDelay - (Date.now() - _mStartTime) / 1000);
    ctx.fillStyle = 'rgba(0,200,130,0.72)'; ctx.textAlign = 'left';
    ctx.fillText('CLEAR  T-' + rem.toFixed(0) + 's', 7, y);
  } else if (_mTorpSpawned && !_mTorp) {
    ctx.fillStyle = 'rgba(0,220,120,0.85)'; ctx.textAlign = 'left';
    ctx.fillText('TORPEDO GONE', 7, y);
  } else {
    ctx.fillStyle = 'rgba(0,180,120,0.5)'; ctx.textAlign = 'left';
    ctx.fillText('NO CONTACT', 7, y);
  }

  // Bottom rule
  ctx.strokeStyle = 'rgba(0,160,200,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(5, H - 5); ctx.lineTo(W - 5, H - 5); ctx.stroke();
}

// ── TOP-DOWN SONAR — depth-coloured point cloud, always visible, sweep adds flash ──
// Colour = terrain height: deep blue (channel floor) → cyan → green → yellow → red (wall tops).
// Every cell always rendered at 30% base brightness; sweep arm flashes it to 100%.
// Multiple scatter particles per cell give the dense cloud look.
function _angelsDrawOnPeriFn(ctx, cx, cy, r) {
  const now        = Date.now();
  const sweepAngle = now * 0.001 * Math.PI * 2 / 5; // one rotation per 5 s
  const sonarRange = 28;                              // world units (wider = more context)
  const scale      = (r - 14) / sonarRange;

  function normAngle(a) { return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); }
  const sa = normAngle(sweepAngle);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#010810';
  ctx.fill();

  const pos = window._getPlayerPos ? window._getPlayerPos() : null;
  const hg  = window._canyonHeightGrid;

  // ── TERRAIN POINT CLOUD ──
  if (pos && hg) {
    const px = pos.x, pz = pos.z;

    for (let gz = Math.max(0, Math.floor(pz - sonarRange)); gz <= Math.min(127, Math.ceil(pz + sonarRange)); gz++) {
      for (let gx = Math.max(0, Math.floor(px - sonarRange)); gx <= Math.min(127, Math.ceil(px + sonarRange)); gx++) {
        const dx   = gx - px, dz = gz - pz;
        const dist = Math.hypot(dx, dz);
        if (dist > sonarRange || dist < 0.3) continue;

        const h = hg[gz][gx] / 255; // 0=channel floor, 1=wall top

        // Sweep: flash on arm pass, base visibility 30% otherwise
        const cellAngle  = normAngle(Math.atan2(dz, dx));
        const angleDiff  = normAngle(sa - cellAngle);
        const sweepFlash = Math.max(0, 1 - angleDiff / (Math.PI * 0.1)); // bright ~18° behind arm
        const persist    = 0.30 + 0.70 * Math.max(0, 1 - angleDiff / (Math.PI * 2));

        const distFade  = 1 - (dist / sonarRange) * 0.45;
        // Channels (h≈0) very faint; walls (h≈1) solid
        const baseAlpha = h < 0.06
          ? 0.06 * persist
          : (0.15 + h * 0.70) * persist * distFade;
        const alpha = Math.min(1, baseAlpha + sweepFlash * 0.55);
        if (alpha < 0.04) continue;

        // Depth colour map: blue → cyan → green → yellow → red/orange
        let rv, gv, bv;
        if (h < 0.20) {
          const t = h / 0.20;
          rv = 0; gv = Math.round(t * 55); bv = Math.round(90 + t * 140);
        } else if (h < 0.42) {
          const t = (h - 0.20) / 0.22;
          rv = 0; gv = Math.round(55 + t * 200); bv = Math.round(230 - t * 185);
        } else if (h < 0.62) {
          const t = (h - 0.42) / 0.20;
          rv = Math.round(t * 210); gv = 255; bv = Math.round(45 - t * 45);
        } else if (h < 0.82) {
          const t = (h - 0.62) / 0.20;
          rv = Math.round(210 + t * 45); gv = Math.round(255 - t * 135); bv = 0;
        } else {
          const t = (h - 0.82) / 0.18;
          rv = 255; gv = Math.round(120 - t * 110); bv = 0;
        }

        // Sweep flash: push toward white
        if (sweepFlash > 0.05) {
          const f = sweepFlash * 0.75;
          rv = Math.min(255, rv + Math.round(f * (255 - rv)));
          gv = Math.min(255, gv + Math.round(f * 0.55 * (255 - gv)));
          bv = Math.min(255, bv + Math.round(f * 0.30 * (255 - bv)));
        }

        // Multiple scatter particles per cell — denser on tall walls, sparse on channels
        const nPts = h > 0.70 ? 5 : h > 0.45 ? 4 : h > 0.20 ? 3 : h > 0.06 ? 2 : 1;
        const baseSeed = gx * 1664525 + gz * 22695477;
        const dotSz    = Math.max(1.2, scale * 0.50 + distFade * 1.5);

        for (let p = 0; p < nPts; p++) {
          const seed = (baseSeed + p * 999983) | 0;
          const jx = (((seed * 1013904223) & 0x7FFFFFFF) / 0x7FFFFFFF - 0.5) * scale * 0.80;
          const jz = (((seed * 1664525 + 1013904223) & 0x7FFFFFFF) / 0x7FFFFFFF - 0.5) * scale * 0.80;
          const pAlpha = alpha * (0.65 + (((seed * 7) & 0xFF) / 255) * 0.35);
          ctx.fillStyle = `rgba(${rv},${gv},${bv},${pAlpha.toFixed(2)})`;
          ctx.fillRect(cx + dx * scale + jx - dotSz * 0.5,
                       cy + dz * scale + jz - dotSz * 0.5,
                       dotSz, dotSz);
        }
      }
    }
  }

  // ── RANGE RINGS ──
  ctx.strokeStyle = 'rgba(0,160,200,0.14)';
  ctx.lineWidth   = 0.7;
  [0.33, 0.66, 1.0].forEach(f => {
    ctx.beginPath();
    ctx.arc(cx, cy, (r - 14) * f, 0, Math.PI * 2);
    ctx.stroke();
  });

  // ── CROSSHAIR ──
  const cr = r - 8;
  ctx.strokeStyle = 'rgba(0,160,200,0.18)';
  ctx.lineWidth   = 0.5;
  ctx.beginPath(); ctx.moveTo(cx - cr, cy); ctx.lineTo(cx + cr, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - cr); ctx.lineTo(cx, cy + cr); ctx.stroke();

  // ── SWEEP TRAILING GLOW ──
  const trailLen = Math.PI * 0.5;
  const nSegs    = 22;
  for (let i = 0; i < nSegs; i++) {
    const t  = i / nSegs;
    const a1 = sweepAngle - trailLen + t * trailLen;
    const a2 = sweepAngle - trailLen + (t + 1) / nSegs * trailLen;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r - 8, a1, a2);
    ctx.closePath();
    ctx.fillStyle = `rgba(0,220,180,${(t * 0.09).toFixed(3)})`;
    ctx.fill();
  }

  // ── SWEEP ARM ──
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(sweepAngle) * (r - 8), cy + Math.sin(sweepAngle) * (r - 8));
  ctx.strokeStyle = 'rgba(0,255,200,0.6)';
  ctx.lineWidth   = 1.5;
  ctx.shadowBlur  = 14;
  ctx.shadowColor = 'rgba(0,240,180,0.75)';
  ctx.stroke();
  ctx.shadowBlur  = 0;

  // ── TORPEDO BLIP (orange, blinking) ──
  if (_mTorp && pos) {
    const tdx = _mTorp.x - pos.x, tdz = _mTorp.z - pos.z;
    if (Math.hypot(tdx, tdz) < sonarRange && Math.floor(now / 300) % 2) {
      ctx.beginPath();
      ctx.arc(cx + tdx * scale, cy + tdz * scale, 5, 0, Math.PI * 2);
      ctx.fillStyle   = '#ff8800';
      ctx.shadowBlur  = 12;
      ctx.shadowColor = '#ff8800';
      ctx.fill();
      ctx.shadowBlur  = 0;
    }
  }

  // ── OWN SUB (white centre dot) ──
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle   = '#ffffff';
  ctx.shadowBlur  = 10;
  ctx.shadowColor = '#00ffcc';
  ctx.fill();
  ctx.shadowBlur  = 0;

  ctx.restore();
}

// ── THROTTLE BAR — wired once via event delegation ──
(function() {
  function _handle(e) {
    const zone = e.target.closest('.ang-throt-zone');
    if (!zone) return;
    const i = parseInt(zone.dataset.throt, 10);
    if (!isNaN(i)) {
      _mThrottle = Math.max(0, Math.min(ANG_LABELS.length - 1, i));
      _updateThrottleUI();
    }
  }
  function _wireBar() {
    const bar = document.getElementById('ang-throttle');
    if (!bar || bar._angWired) return;
    bar._angWired = true;
    bar.addEventListener('click', _handle);
    bar.addEventListener('touchstart', function(e) { e.preventDefault(); _handle(e); }, { passive: false });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _wireBar);
  } else {
    _wireBar();
  }
})();

function _updateThrottleUI() {
  document.querySelectorAll('.ang-throt-zone').forEach(function(z, i) {
    z.classList.toggle('active', i === _mThrottle);
  });
}

// ── LAUNCH ──
function launchAngels(difficulty) {
  _mTorp = null; _mTorpSpawned = false; _mTorpNearAlerted = false;
  _mTrail = []; _mStartTime = 0; _mThrottle = 1;
  _mTorpDelay = difficulty === 'cadet' ? 45 : difficulty === 'commander' ? 20 : 30;
  _mTorpSpeed = difficulty === 'commander' ? 0.38 : 0.32;

  _loadHeightfield().then(function(grid) {
    window._isHeightfield = true;
    window._campaignMode  = true;
    window._campaignCheckpoints = null;
    window._campaignExitBeacon = { x: ANG_EXIT_X, z: ANG_EXIT_Z, radius: 10, _reached: false };

    window.launchGame(grid); // clears _angelsDrawSonar/_angelsUpdate/throttle bar

    // Reinstall hooks now that launchGame has cleared them
    window._angelsDrawSonar  = _angelsDrawSonarFn;
    window._angelsUpdate     = _angelsUpdateFn;
    window._angelsDrawOnPeri = _angelsDrawOnPeriFn;

    if (window._killEnemy)      window._killEnemy();
    if (window._setPlayerSpawn) window._setPlayerSpawn(ANG_ENTRY_X, ANG_ENTRY_Z);

    // Show throttle bar
    const bar = document.getElementById('ang-throttle');
    if (bar) bar.style.display = 'flex';
    _updateThrottleUI();

    // Label the sonar panel as Captain's Orders
    const sonarLbl = document.querySelector('#sonar-wrap > div:first-child');
    if (sonarLbl) sonarLbl.textContent = "CAPTAIN'S ORDERS";

    _mStartTime = Date.now();

    if (window._musicStart)   window._musicStart();
    if (window._musicStealth) window._musicStealth(true);
    if (window._musicCombat)  window._musicCombat(false);

    if (window._addEvent) window._addEvent('▸ ANGELS CANYON — SET BEARING AND THROTTLE — FIND THE EXIT', false);
  });
}

window.launchAngels = launchAngels;
