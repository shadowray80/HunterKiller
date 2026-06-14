// ── MISSION 02: THROUGH THE ANGELS (COMMAND VIEW) ──
// Command view canyon run — Two_Angels.png heightfield.
// Player spawns left (x≈8, z≈64), must reach x≥118 to win.
// Enemy subs patrol the maze and fire torpedoes through the canyons.
// Wall collision deals hull damage. Enemy torpedo proximity = faster pings.

const A2_GW = 128, A2_GD = 128, A2_ENTRY_X = 8, A2_ENTRY_Z = 64;
const A2_EXIT_X = 118;
const A2_WALL_DAMAGE = 5;        // hull damage per wall hit
const A2_WALL_COOLDOWN = 2000;   // ms between wall damage events

// ── MISSION STATE ──
let _a2StartTime = 0;
let _a2WallLastHit = 0;
let _a2PingTimer = 0;
let _a2PingInterval = 2500;      // ms between pings (reduces as torpedo closes)
let _a2LastPingMs = 0;
let _a2WinFired = false;
let _a2Active = false;
let _a2Difficulty = 'captain';

// ── HEIGHTFIELD LOADER ──
function _a2LoadHeightfield() {
  return new Promise(function(resolve) {
    function buildHg(px) {
      var hg = [];
      for (var z = 0; z < A2_GD; z++) {
        hg[z] = [];
        for (var x = 0; x < A2_GW; x++) {
          var raw = px ? px[(z * A2_GW + x) * 4] : 0;
          // S-curve contrast boost: push channel floors darker, angel peaks brighter
          var n = raw / 255;
          var s = n < 0.5
            ? Math.pow(n * 2, 2.0) * 0.5
            : 1 - Math.pow((1 - n) * 2, 2.0) * 0.5;
          hg[z][x] = Math.round(s * 255);
        }
      }
      window._canyonHeightGrid = hg;
      window._hfGridW          = A2_GW;
      window._hfGridD          = A2_GD;
      window._hfGridH          = 25;
      window._hfTerrainScale   = 20;  // taller peaks, deeper channels vs mission 7's 16
      // Build a flat grid array for launchGame — same shape as floor plan grid
      var g = [];
      for (var zz = 0; zz < A2_GD; zz++) {
        g[zz] = [];
        for (var xx = 0; xx < A2_GW; xx++) g[zz][xx] = 0;
      }
      resolve(g);
    }
    var img = new Image();
    img.onload = function() {
      var tmp = document.createElement('canvas');
      tmp.width = A2_GW; tmp.height = A2_GD;
      var tc = tmp.getContext('2d');
      tc.drawImage(img, 0, 0, A2_GW, A2_GD);
      buildHg(tc.getImageData(0, 0, A2_GW, A2_GD).data);
    };
    img.onerror = function() { buildHg(null); };
    img.src = '/maps/Two_Angels.png';
  });
}

// ── WALL COLLISION CALLBACK ──
// Installed during launchAngels2 and fired by game.js when throttle movement is blocked.
function _a2OnWallCollision() {
  if (!_a2Active) return;
  var now = Date.now();
  if (now - _a2WallLastHit < A2_WALL_COOLDOWN) return;
  _a2WallLastHit = now;
  if (window._applyHullDamage) window._applyHullDamage(A2_WALL_DAMAGE, '⚠ HULL IMPACT — CANYON WALL');
}

// ── PROXIMITY PING — called each frame update ──
function _a2UpdatePing() {
  var state = window._getGameState ? window._getGameState() : null;
  if (!state) return;

  // Find closest incoming enemy torpedo
  var torps = state.torpedoes || [];
  var px = state.player.x, py = state.player.y, pz = state.player.z;
  var closestDist = Infinity;
  for (var i = 0; i < torps.length; i++) {
    var t = torps[i];
    if (!t.isEnemy) continue;
    var d = Math.sqrt((t.x - px) * (t.x - px) + (t.y - py) * (t.y - py) + (t.z - pz) * (t.z - pz));
    if (d < closestDist) closestDist = d;
  }

  // Only ping when a torpedo is within 25 units
  if (closestDist > 25) return;

  if (closestDist < 5) {
    _a2PingInterval = 120;
  } else if (closestDist < 12) {
    _a2PingInterval = 300;
  } else if (closestDist < 20) {
    _a2PingInterval = 700;
  } else {
    _a2PingInterval = 1400;
  }

  var now = Date.now();
  if (now - _a2LastPingMs >= _a2PingInterval) {
    _a2LastPingMs = now;
    var vol = Math.min(1.0, 0.25 + (1 - closestDist / 25) * 0.75);
    if (window._playSonarPing) window._playSonarPing(vol);
  }
}

// ── WIN CONDITION CHECK ──
function _a2CheckWin() {
  if (_a2WinFired) return;
  var state = window._getGameState ? window._getGameState() : null;
  if (!state) return;
  if (state.player.x >= A2_EXIT_X) {
    _a2WinFired = true;
    _a2Active = false;
    window._onWallCollision = null;
    if (window._addEvent) window._addEvent('⊛ EXIT REACHED — MISSION COMPLETE', false);
    if (window._musicStop) window._musicStop();
    setTimeout(function() {
      if (window._onCampaignMissionComplete) {
        var fn = window._onCampaignMissionComplete;
        window._onCampaignMissionComplete = null;
        fn();
      }
    }, 1500);
  }
}

// ── MAIN UPDATE HOOK (called every frame by game.js) ──
function _a2UpdateFn() {
  if (!_a2Active || !_a2StartTime) return;
  _a2UpdatePing();
  _a2CheckWin();
}

// ── SPAWN ENEMIES AT DEFENSIBLE CANYON POSITIONS ──
function _a2SpawnEnemies(difficulty) {
  var state = window._getGameState ? window._getGameState() : null;
  var hg = window._canyonHeightGrid;

  // Reposition BRAVO to a mid-canyon spot facing west (toward player)
  if (state) {
    var ex = 60 + Math.floor(Math.random() * 30);
    var ez = 55 + Math.floor(Math.random() * 20);
    var terrH = (hg && hg[ez] && hg[ez][ex] ? hg[ez][ex] : 0) / 255 * 16;
    state.enemy.x = ex;
    state.enemy.y = Math.max(terrH + 3, 8);
    state.enemy.z = ez;
    state.enemy.alive = true;
    state.enemy.hits = 0;
    state.enemy.heading = Math.PI;
  }

  // Spawn additional enemies for higher difficulties
  // cadet=0 extra, captain=1 extra, commander=2 extra
  var extras = { cadet: 0, captain: 1, commander: 2 };
  var n = extras[difficulty] || 0;
  if (n > 0 && window._spawnExtraEnemies) {
    window._spawnExtraEnemies(n);
  }
}

// ── OBJECTIVE BAR ──
function _a2SetObjectiveBar() {
  var objBar = document.getElementById('campaign-objective-bar');
  if (objBar) {
    objBar.textContent = '⊙ OBJECTIVE: NAVIGATE THE CANYON — REACH THE FAR SIDE · AVOID WALLS · DESTROY OR EVADE ALL CONTACTS';
    objBar.style.display = '';
  }
}

// ── LAUNCH ──
function launchAngels2(difficulty) {
  _a2WinFired = false;
  _a2Active = false;
  _a2StartTime = 0;
  _a2WallLastHit = 0;
  _a2LastPingMs = 0;
  _a2PingInterval = 3000;
  _a2Difficulty = difficulty || 'captain';

  _a2LoadHeightfield().then(function(grid) {
    window._isHeightfield = true;
    window._campaignMode  = true;
    window._campaignCheckpoints = null;
    window._campaignExitBeacon  = null;

    window.launchGame(grid);

    // Reinstall hooks (launchGame clears them)
    window._angelsUpdate = _a2UpdateFn;
    window._onWallCollision = _a2OnWallCollision;

    // Position player at left canyon entrance
    if (window._setPlayerSpawn) window._setPlayerSpawn(A2_ENTRY_X, A2_ENTRY_Z);

    // Switch to command view
    if (window._goToCommand) window._goToCommand();

    // Spawn enemies
    _a2SpawnEnemies(_a2Difficulty);

    // Music — force Red Route track
    if (window._musicForce) window._musicForce('redRoute');

    // Objective bar
    _a2SetObjectiveBar();

    // Brief message
    if (window._addEvent) window._addEvent('▸ ANGELS CANYON — MAKE FOR THE FAR SIDE — AVOID THE WALLS', false);
    setTimeout(function() {
      if (window._addEvent) window._addEvent('⚠ ENEMY CONTACTS IN WATER — USE COUNTERMEASURES AND TORPEDOES', true);
    }, 3000);

    _a2StartTime = Date.now();
    _a2Active = true;
  });
}

window.launchAngels2 = launchAngels2;
