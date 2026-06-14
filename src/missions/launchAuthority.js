// ── MISSION 06: LAUNCH AUTHORITY ──
// Arctic under-ice: two heightfields.
// LaunchAuth_Surface.png — seafloor (black=deep, white=peaks).
// LaunchAuth_Ice.png     — ice ceiling (black=hole/opening, white=thick solid ice).
// The sub navigates the space between. Ice holes = potential launch positions.

const LA_GW = 128, LA_GD = 128;
const LA_SURFACE_MAP  = '/maps/LaunchAuth_Surface.png';
const LA_ICE_MAP      = '/maps/LaunchAuth_Ice.png';
const LA_ICE_SCALE    = 10;   // max ice thickness hanging from ceiling
const LA_FLOOR_SCALE  = 18;   // max seafloor peak height
const LA_GRID_H       = 32;   // world height (space between maps)

let _laActive    = false;
let _laStartTime = 0;
let _laDifficulty = 'captain';

// Load both heightfields in parallel, resolve when both are done
function _laLoadHeightfields() {
  return new Promise(function(resolve) {
    var pending = 2;
    var floorHg = null, iceHg = null;

    function tryResolve() {
      if (--pending > 0) return;
      // Floor grid is set on window already; resolve with a blank flat grid for launchGame
      var g = [];
      for (var zz = 0; zz < LA_GD; zz++) {
        g[zz] = [];
        for (var xx = 0; xx < LA_GW; xx++) g[zz][xx] = 0;
      }
      resolve(g);
    }

    function loadPng(src, onPixels, onFail) {
      var img = new Image();
      img.onload = function() {
        var tmp = document.createElement('canvas');
        tmp.width = LA_GW; tmp.height = LA_GD;
        var tc = tmp.getContext('2d');
        tc.drawImage(img, 0, 0, LA_GW, LA_GD);
        onPixels(tc.getImageData(0, 0, LA_GW, LA_GD).data);
      };
      img.onerror = onFail;
      img.src = src;
    }

    // Seafloor
    loadPng(LA_SURFACE_MAP, function(px) {
      floorHg = [];
      for (var z = 0; z < LA_GD; z++) {
        floorHg[z] = [];
        for (var x = 0; x < LA_GW; x++) floorHg[z][x] = px[(z * LA_GW + x) * 4];
      }
      window._canyonHeightGrid = floorHg;
      window._hfGridW          = LA_GW;
      window._hfGridD          = LA_GD;
      window._hfGridH          = LA_GRID_H;
      window._hfTerrainScale   = LA_FLOOR_SCALE;
      tryResolve();
    }, function() {
      floorHg = [];
      for (var z = 0; z < LA_GD; z++) { floorHg[z] = []; for (var x = 0; x < LA_GW; x++) floorHg[z][x] = 0; }
      window._canyonHeightGrid = floorHg;
      window._hfGridW = LA_GW; window._hfGridD = LA_GD;
      window._hfGridH = LA_GRID_H; window._hfTerrainScale = LA_FLOOR_SCALE;
      tryResolve();
    });

    // Ice ceiling
    loadPng(LA_ICE_MAP, function(px) {
      iceHg = [];
      for (var z = 0; z < LA_GD; z++) {
        iceHg[z] = [];
        for (var x = 0; x < LA_GW; x++) iceHg[z][x] = px[(z * LA_GW + x) * 4];
      }
      window._pendingIceCeilingGrid = iceHg;
      window._pendingIceTerrainScale = LA_ICE_SCALE;
      tryResolve();
    }, function() {
      window._pendingIceCeilingGrid = undefined;
      tryResolve();
    });
  });
}

function _laSetObjectiveBar() {
  var objBar = document.getElementById('campaign-objective-bar');
  if (objBar) {
    objBar.textContent = '⊙ OBJECTIVE: NAVIGATE UNDER THE ICE — LOCATE A LAUNCH HOLE — TOP SECRET SHOWS ICE MAP';
    objBar.style.display = '';
  }
}

function launchLaunchAuthority(difficulty) {
  _laActive    = false;
  _laStartTime = 0;
  _laDifficulty = difficulty || 'captain';

  _laLoadHeightfields().then(function(grid) {
    window._isHeightfield = true;
    window._campaignMode  = true;

    // TOP SECRET button shows the ice ceiling map (not the briefing image)
    window._campaignBriefingImg = LA_ICE_MAP;

    window.launchGame(grid);

    // Reinstall hooks after launchGame (it clears them)
    window._angelsUpdate = null;

    // Spawn: south-centre, mid-depth, heading north into the ice field
    if (window._setPlayerSpawn) window._setPlayerSpawn(64, 110);
    if (window._setPlayerHeading) window._setPlayerHeading(-Math.PI); // north

    // Command view
    if (window._goToCommand) window._goToCommand();

    // Enemy sub — positioned north under the ice, heading south
    var state = window._getGameState ? window._getGameState() : null;
    if (state && state.enemy) {
      state.enemy.x = 64;
      state.enemy.y = LA_GRID_H * 0.45;
      state.enemy.z = 25;
      state.enemy.heading = Math.PI; // facing south toward player
      state.enemy.alive = true;
      state.enemy.hits  = 0;
    }

    // Extra enemies based on difficulty
    var extras = { cadet: 0, captain: 1, commander: 2 };
    var n = extras[_laDifficulty] || 0;
    if (n > 0 && window._spawnExtraEnemies) window._spawnExtraEnemies(n);

    // Music — ambient, cold
    if (window._musicStart) window._musicStart();

    _laSetObjectiveBar();

    if (window._addEvent) window._addEvent('▸ UNDER THE ARCTIC ICE — BEARING NORTH — LOCATE LAUNCH HOLE', false);
    setTimeout(function() {
      if (window._addEvent) window._addEvent('▸ TOP SECRET BUTTON SHOWS ICE CEILING MAP — FIND AN OPENING', false);
    }, 4000);

    _laStartTime = Date.now();
    _laActive    = true;
  });
}

window.launchLaunchAuthority = launchLaunchAuthority;
