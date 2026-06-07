// ── CAMPAIGN SYSTEM ──
// Compartmentalised mission definitions — update any mission independently.

const CAMPAIGN_KEY = 'hk_campaign';

// ── MISSION DEFINITIONS ──
// Each mission is self-contained. To update a mission, edit its object only.
const MISSIONS = [
  {
    index: 0,
    name: 'THE GAP',
    codename: 'NEPTUNE',
    subtitle: 'Mission 1 — Stealth Transit',
    mapId: 'thegap',
    isHeightfield: true,
    objectiveType: 'navigate',
    briefingImg: '/Images/TheGap_MissionBriefing.png',
    briefing:
      'CLASSIFICATION: TOP SECRET\n' +
      'GIUK GAP — NORTH ATLANTIC OCEAN\n\n' +
      'OBJECTIVE: Navigate from Entry Zone A to Exit Zone E.\n\n' +
      'A vast continental shelf stretches out before open ocean. Enemy forces have seeded the area with sonar buoys and conduct regular air patrols. Your objective is simple: pass through undetected.\n\n' +
      'ENVIRONMENT\n' +
      'Open, exposed terrain. Long sightlines for sonar and sensors. Sparse geological features for cover. Deep drop-offs at the shelf edge.\n\n' +
      'KEY LOCATIONS\n' +
      'A — Entry Zone (your start position)\n' +
      'B — Sonar Buoy Fields (avoid detection spheres)\n' +
      'C — Shelf Ridge (use for cover)\n' +
      'D — Deep Drop-Off (major depth change)\n' +
      'E — EXIT ZONE (reach this to complete the mission)\n\n' +
      'TACTICAL NOTES\n' +
      'Avoid the sonar buoy detection spheres — entering one triggers ships and enemy subs. Use Silent Running to shrink buoy detection range. You can engage enemy subs but every kill raises the alert level.\n\n' +
      'RECOMMENDED APPROACH\n' +
      '· Stay silent (STANDARD STEAMING button)\n' +
      '· Hug the shelf ridges (C) for cover\n' +
      '· Avoid all buoy fields (B)\n' +
      '· Reach the green EXIT beacon (E)\n\n' +
      'THREATS: Sonar buoy fields · Patrol aircraft · Depth charges · Enemy submarines',
    // Navigate: mission complete when reaching exit beacon, not by kill count
    killTarget: 0,
    enemyCount: { cadet: 1, captain: 1, commander: 2 },
    // Spawn position (separate from waypoints so A can be a real checkpoint)
    spawnPoint: { x: 14, z: 16 },
    // Waypoints shown on minimap — all four are required checkpoints
    waypoints: [
      { id: 'A', x: 42, z: 18 },
      { id: 'B', x: 85, z: 22 },
      { id: 'C', x: 25, z: 88 },
      { id: 'D', x: 75, z: 75 },
    ],
    // Ordered checkpoints A→B→C→D — must be cleared before exit beacon unlocks
    checkpoints: [
      { id: 'A', x: 42, z: 18, radius: 8 },
      { id: 'B', x: 85, z: 22, radius: 8 },
      { id: 'C', x: 25, z: 88, radius: 8 },
      { id: 'D', x: 75, z: 75, radius: 8 },
    ],
    // Sonar buoys: _ox/_oz are home positions, x/z drift from them
    sonarBuoys: [
      { _ox: 28, _oz: 22, x: 28, z: 22, y: 8, radius: 11 },
      { _ox: 55, _oz: 18, x: 55, z: 18, y: 6, radius: 10 },
      { _ox: 48, _oz: 47, x: 48, z: 47, y: 9, radius: 12 },
      { _ox: 72, _oz: 62, x: 72, z: 62, y: 7, radius: 10 },
      { _ox: 88, _oz: 76, x: 88, z: 76, y: 8, radius: 11 },
    ],
    exitBeacon: { x: 112, z: 108, radius: 6 },
  },
  {
    index: 1,
    name: 'THE COURIER',
    codename: 'CARDINAL',
    subtitle: 'Mission 2 — Extraction',
    mapId: 'bungalow',
    isHeightfield: false,
    briefingImg: '/Images/Rules/Command_view_floorplan.png',
    briefing:
      'CLASSIFICATION: EYES ONLY\n\n' +
      'A CIA asset — codenamed CARDINAL — has gone silent inside a coastal facility. His intelligence is critical to the entire operation.\n\n' +
      'You have a narrow window. A hostile submarine patrols these waters and will not hesitate to end your mission before it begins.\n\n' +
      'Neutralise the contact. Then extract the asset. In that order.\n\n' +
      'The asset does not leave without you.',
    killTarget: 1,
    enemyCount: { cadet: 1, captain: 1, commander: 1 },
  },
  {
    index: 2,
    name: 'THROUGH THE TRENCH',
    codename: 'STYX',
    subtitle: 'Mission 3 — Terrain Run',
    mapId: 'trench',
    isHeightfield: true,
    briefingImg: '/Images/Rules/trench.png',
    briefing:
      'CLASSIFICATION: TOP SECRET\n\n' +
      'The Lofoten Trench — 3,000 metres of sheer volcanic rock forming the world\'s most treacherous underwater canyon.\n\n' +
      'A hostile submarine has been tracking you since the Gap. It knows these waters better than you do. The terrain will kill you if STYX doesn\'t first.\n\n' +
      'Navigate the Trench. Use the rock for cover. Destroy all contacts before they destroy you.\n\n' +
      'The canyon has no mercy, Commander.',
    killTarget: 1,
    enemyCount: { cadet: 1, captain: 1, commander: 2 },
  },
  {
    index: 3,
    name: 'SILENT HUNTER',
    codename: 'PREDATOR',
    subtitle: 'Mission 4 — Hunt and Destroy',
    mapId: 'abyss',
    isHeightfield: true,
    briefingImg: '/Images/Rules/abyss.png',
    briefing:
      'CLASSIFICATION: TOP SECRET — FLASH\n\n' +
      'Deep water. No terrain cover. No surface ships. Just you, the enemy, and 4,000 metres of black ocean below.\n\n' +
      'An enemy submarine has been conducting acoustic surveillance of our communications arrays. It must be silenced permanently.\n\n' +
      'This is a hunter-killer mission in the truest sense. Find it. Fix it. Destroy it.\n\n' +
      'There is nowhere to hide down here, Commander. For either of you.',
    killTarget: 1,
    enemyCount: { cadet: 1, captain: 1, commander: 2 },
  },
  {
    index: 4,
    name: 'GHOST SHIP',
    codename: 'SPECTRE',
    subtitle: 'Mission 5 — Wreck Investigation',
    mapId: 'dropoff',
    isHeightfield: true,
    briefingImg: '/Images/Rules/dropoff.png',
    briefing:
      'CLASSIFICATION: UMBRA\n\n' +
      'The wreck of the USS Vanguard lies on the edge of the continental shelf — a Cold War graveyard carrying authentication codes that were never recovered.\n\n' +
      'An enemy salvage team is already on-site. They cannot be allowed to recover those codes.\n\n' +
      'Engage and destroy all hostile contacts. The shelf edge is unstable — one wrong move and you\'ll be joining the Vanguard on the bottom.\n\n' +
      'No witnesses. No salvage. No mercy.',
    killTarget: 1,
    enemyCount: { cadet: 1, captain: 1, commander: 3 },
  },
  {
    index: 5,
    name: 'LAUNCH AUTHORITY',
    codename: 'ARMAGEDDON',
    subtitle: 'Mission 6 — Final Orders',
    mapId: 'dropoff',
    isHeightfield: true,
    briefingImg: '/Images/Rules/dropoff.png',
    briefing:
      'CLASSIFICATION: NUCLEAR — EYES ONLY — COMMANDING OFFICER\n\n' +
      'Fragmented ELF transmission received at 0347 hours. Authentication: partial. Source: unverified.\n\n' +
      'Content: Authorisation code FOXTROT-NINER-NINER — LAUNCH.\n\n' +
      'A hostile submarine is moving to firing position. Bearing 320. Range unknown.\n\n' +
      'You have contacts in the water. You have a decision to make. You have very little time.\n\n' +
      'Whatever you decide — make it count.',
    killTarget: 1,
    enemyCount: { cadet: 1, captain: 1, commander: 3 },
  },
  {
    index: 6,
    name: 'THROUGH THE ANGELS',
    codename: 'RED ROUTE',
    subtitle: 'Mission 7 — Canyon Run',
    objectiveType: 'angels',
    briefingImg: '/Images/Rules/dropoff.png',
    briefing:
      'CLASSIFICATION: DEEP BLACK\n\n' +
      'The Angels — a chain of volcanic pinnacles in the Norwegian Deep. No chart covers them. No one who has run them has reported back.\n\n' +
      'A Soviet torpedo is in the water behind you. Proximity-fuzed. No countermeasures remaining.\n\n' +
      'There is one way through. We call it the Red Route. A 4-unit gap between two pinnacles at the far end of the passage — too narrow for a Type 53 to navigate at speed.\n\n' +
      'Thread it. The torpedo will not.\n\n' +
      'Use the Engine Order Telegraph to set speed. Tap the heading compass to steer.\n' +
      'The Arch requires depth below 16. The Needle requires precise heading at ½ speed or less.\n\n' +
      'THREATS: Canyon walls · The Arch · Pursuing torpedo · The Angels themselves',
    killTarget: 0,
    enemyCount: { cadet: 0, captain: 0, commander: 0 },
  },
];

// ── DIFFICULTY CONFIG ──
const DIFFICULTY_CONFIG = {
  cadet: {
    label: 'CADET',
    lives: 5,
    desc: '5 lives · Hull repairs faster · Enemy fires less frequently',
    color: '#00ff9d',
  },
  captain: {
    label: 'CAPTAIN',
    lives: 3,
    desc: '3 lives · Standard difficulty',
    color: '#00e5ff',
  },
  commander: {
    label: 'COMMANDER',
    lives: 2,
    desc: '2 lives · Multiple enemies on later missions · More aggressive AI',
    color: '#ff4444',
  },
};

// ── CAMPAIGN VICTORY SLIDES ──
const VICTORY_SLIDES = [
  {
    title: 'MISSION ACCOMPLISHED',
    text:
      'Against every calculation of probability — against odds that should have broken lesser crews — USS Alpha and her people survived.\n\n' +
      'Six contacts. Six kills. From the GIUK Gap to the final firing solution, they held the line when no one else could.\n\n' +
      'The waterways are secure. The lanes are open. Supply convoys are moving again.',
    img: '/Images/Sub_Surface.png',
  },
  {
    title: 'THE WATERWAYS ARE SECURE',
    text:
      'Allied Command has confirmed: the threat is neutralised. The North Atlantic remains free.\n\n' +
      'What began as a transit patrol became the most decisive submarine action of the Cold War.\n\n' +
      'Your crew did that. All of them. Every one who made it back — and every one who didn\'t.',
    img: '/Images/Splash_Screen.png',
  },
  {
    title: 'CITATION FOR DISTINGUISHED SERVICE',
    text:
      'The crew of USS Alpha is hereby commended for exceptional valour in the face of overwhelming hostile forces.\n\n' +
      'Your names will not be published. Your mission will not be acknowledged. The world will never know what happened in those waters.\n\n' +
      'But we know. And the ocean remembers.\n\n— COMSUBPAC · CLASSIFICATION: EYES ONLY',
    img: '/Images/Sub_Surface.png',
  },
];

// ── SAVE STATE ──
function defaultSave() {
  return { missionIndex: 0, difficulty: 'captain', totalKills: 0, totalScore: 0, unlockedCodes: [] };
}

function loadSave() {
  try {
    return Object.assign(defaultSave(), JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || '{}'));
  } catch (e) {
    return defaultSave();
  }
}

function writeSave(s) {
  localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(s));
}

// ── MODULE STATE ──
let _save = loadSave();
let _pendingMissionIndex = 0;
let _pendingDifficulty = 'captain';
let _missionKillCount = 0;
let _victorySlide = 0;

// ── SCREEN HELPERS ──
const CAMPAIGN_SCREENS = [
  'campaign-screen', 'campaign-difficulty-screen',
  'campaign-briefing-screen', 'campaign-result-screen',
  'campaign-victory-screen', 'campaign-failed-screen',
];

function hideAllCampaignScreens() {
  CAMPAIGN_SCREENS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function showScreen(id) {
  hideAllCampaignScreens();
  document.getElementById('intro-screen').style.display = 'none';
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

// ── CAMPAIGN HOME ──
function showCampaignHome() {
  _save = loadSave();
  renderCampaignHome();
  showScreen('campaign-screen');
}

function renderCampaignHome() {
  const prog = document.getElementById('cp-progress-label');
  if (prog) {
    const idx = Math.min(_save.missionIndex, MISSIONS.length - 1);
    prog.textContent = _save.unlockedCodes.length === MISSIONS.length
      ? 'CAMPAIGN COMPLETE'
      : `MISSION ${idx + 1} OF ${MISSIONS.length}`;
  }

  MISSIONS.forEach((m, i) => {
    const tile = document.getElementById('cp-tile-' + i);
    if (!tile) return;
    const unlocked = _save.unlockedCodes.includes(m.codename);
    const isCurrent = i === _save.missionIndex && !unlocked;
    tile.className = 'cp-mission-tile' +
      (unlocked ? ' cp-tile-done' : '') +
      (isCurrent ? ' cp-tile-current' : '');
  });

  const continueBtn = document.getElementById('cp-continue-btn');
  if (continueBtn) {
    continueBtn.style.display = (_save.missionIndex > 0 || _save.unlockedCodes.length > 0) ? '' : 'none';
  }
}

// ── DIFFICULTY SELECT ──
function showDifficultySelect(missionIndex) {
  _pendingMissionIndex = missionIndex;
  const mission = MISSIONS[missionIndex];
  const label = document.getElementById('cpd-mission-label');
  if (label) label.textContent = `MISSION ${missionIndex + 1} — ${mission.name}`;
  showScreen('campaign-difficulty-screen');
}

// ── MISSION BRIEFING ──
function showMissionBriefing(missionIndex, difficulty) {
  _pendingMissionIndex = missionIndex;
  _pendingDifficulty = difficulty;
  const mission = MISSIONS[missionIndex];
  const diff = DIFFICULTY_CONFIG[difficulty];

  document.getElementById('cpb-mission-name').textContent = mission.name;
  document.getElementById('cpb-codename').textContent = 'OPERATION: ' + mission.codename;
  document.getElementById('cpb-subtitle').textContent = mission.subtitle;
  document.getElementById('cpb-briefing-text').textContent = mission.briefing;
  document.getElementById('cpb-difficulty-badge').textContent = diff.label;
  document.getElementById('cpb-difficulty-badge').style.color = diff.color;
  document.getElementById('cpb-lives-badge').textContent = diff.lives + ' LIVES';
  const img = document.getElementById('cpb-mission-img');
  if (img) { img.src = mission.briefingImg; img.style.display = ''; }

  showScreen('campaign-briefing-screen');
}

// ── LAUNCH MISSION ──
function launchMission(missionIndex, difficulty) {
  const mission = MISSIONS[missionIndex];
  const diff = DIFFICULTY_CONFIG[difficulty];

  // ── ANGELS mission: self-contained canyon run (no battleground needed) ──
  if (mission.objectiveType === 'angels') {
    _missionKillCount = 0;
    window._campaignMode = true;

    window._onCampaignMissionComplete = function () {
      window._onCampaignMissionComplete = null;
      completeMission(missionIndex, difficulty);
    };
    window._onCampaignGameOver = function () {
      window._onCampaignGameOver = null;
      window._campaignMode = false;
      setTimeout(function () { showMissionFailed(missionIndex, difficulty); }, 100);
    };

    hideAllCampaignScreens();
    document.getElementById('intro-screen').style.display = 'none';

    if (window.launchAngels) {
      window.launchAngels(difficulty);
    } else {
      console.error('[campaign] launchAngels not available — angels.js not loaded');
    }
    return;
  }

  const bg = window.BATTLEGROUNDS && window.BATTLEGROUNDS.find(b => b.id === mission.mapId);
  if (!bg) { console.error('[campaign] No battleground found:', mission.mapId); return; }

  _missionKillCount = 0;
  var _killTarget = mission.enemyCount[difficulty] || 1;
  window._campaignLives = diff.lives;
  window._campaignMode = true;
  window._campaignBriefingImg = mission.briefingImg;

  // Set mission-specific gameplay data
  window._campaignWaypoints = mission.waypoints || null;
  window._campaignSonarBuoys = mission.sonarBuoys
    ? mission.sonarBuoys.map(function(b) { return Object.assign({}, b, { _ang: Math.random() * Math.PI * 2 }); })
    : null;
  window._campaignExitBeacon = mission.exitBeacon
    ? Object.assign({}, mission.exitBeacon, { _reached: false })
    : null;
  window._campaignCheckpoints = mission.checkpoints
    ? mission.checkpoints.map(function(cp) { return Object.assign({}, cp, { collected: false }); })
    : null;

  var isNavigate = mission.objectiveType === 'navigate';

  // Navigate mission: complete when exit beacon reached
  if (isNavigate) {
    window._onEnemySubKill = null;
    window._onCampaignMissionComplete = function () {
      window._onCampaignMissionComplete = null;
      completeMission(missionIndex, difficulty);
    };
  } else {
    // Destroy mission: complete when kill target reached
    window._onCampaignMissionComplete = null;
    window._onEnemySubKill = function () {
      _missionKillCount++;
      if (_missionKillCount >= _killTarget) {
        window._onEnemySubKill = null;
        setTimeout(function () { completeMission(missionIndex, difficulty); }, 2000);
      }
    };
  }

  window._onCampaignGameOver = function () {
    window._onCampaignGameOver = null;
    window._onEnemySubKill = null;
    window._onCampaignMissionComplete = null;
    window._campaignMode = false;
    window._campaignBriefingImg = null;
    window._campaignWaypoints = null;
    window._campaignSonarBuoys = null;
    window._campaignExitBeacon = null;
    window._campaignCheckpoints = null;
    setTimeout(function () { showMissionFailed(missionIndex, difficulty); }, 100);
  };

  // Show mission objective bar
  var objBar = document.getElementById('campaign-objective-bar');
  if (objBar) {
    objBar.textContent = isNavigate
      ? '⊙ OBJECTIVE: CLEAR CHECKPOINTS A → B → C → D → EXIT IN ORDER · AVOID SONAR BUOYS'
      : '⊙ OBJECTIVE: DESTROY ALL ENEMY CONTACTS';
    objBar.style.display = '';
  }

  hideAllCampaignScreens();
  document.getElementById('intro-screen').style.display = 'none';

  var extraCount = (mission.enemyCount[difficulty] || 1) - 1;

  if (mission.isHeightfield) {
    window._isHeightfield = true;
    bg.loadAsync().then(function (mapGrid) {
      window._pendingGrid = mapGrid;
      window.launchGame(mapGrid);
      if (extraCount > 0 && window._spawnExtraEnemies) window._spawnExtraEnemies(extraCount);
      var spawnRef = mission.spawnPoint || (mission.waypoints && mission.waypoints.find(function(w) { return w.id === 'A'; }));
      if (spawnRef && window._setPlayerSpawn) window._setPlayerSpawn(spawnRef.x, spawnRef.z);
    });
  } else {
    window._isHeightfield = false;
    window._pendingGrid = null;
    window.launchGame(bg.makeGrid());
    if (extraCount > 0 && window._spawnExtraEnemies) window._spawnExtraEnemies(extraCount);
    var spawnRef = mission.spawnPoint || (mission.waypoints && mission.waypoints.find(function(w) { return w.id === 'A'; }));
    if (spawnRef && window._setPlayerSpawn) window._setPlayerSpawn(spawnRef.x, spawnRef.z);
  }
}

// ── MISSION COMPLETE ──
function completeMission(missionIndex, difficulty) {
  window._campaignMode = false;
  window._campaignBriefingImg = null;
  window._campaignWaypoints = null;
  window._campaignSonarBuoys = null;
  window._campaignExitBeacon = null;
  window._campaignCheckpoints = null;
  window._onCampaignMissionComplete = null;
  var ob = document.getElementById('campaign-objective-bar');
  if (ob) ob.style.display = 'none';
  if (window._endMissionClean) window._endMissionClean();

  _save = loadSave();
  const mission = MISSIONS[missionIndex];
  if (!_save.unlockedCodes.includes(mission.codename)) {
    _save.unlockedCodes.push(mission.codename);
  }
  const nextIndex = missionIndex + 1;
  if (nextIndex > _save.missionIndex) _save.missionIndex = nextIndex;
  _save.difficulty = difficulty;
  writeSave(_save);

  if (nextIndex >= MISSIONS.length) {
    showCampaignVictory();
  } else {
    showMissionResult(missionIndex, nextIndex, difficulty);
  }
}

// ── MISSION RESULT SCREEN ──
function showMissionResult(completedIndex, nextIndex, difficulty) {
  const mission = MISSIONS[completedIndex];
  const nextMission = MISSIONS[nextIndex];

  document.getElementById('cpr-codename').textContent = 'OPERATION: ' + mission.codename + ' — COMPLETE';
  document.getElementById('cpr-code').textContent = mission.codename;
  document.getElementById('cpr-next-name').textContent = nextMission.name;
  document.getElementById('cpr-next-subtitle').textContent = nextMission.subtitle;

  document.getElementById('cpr-next-btn').onclick = function () {
    showMissionBriefing(nextIndex, difficulty);
  };

  showScreen('campaign-result-screen');
}

// ── MISSION FAILED SCREEN ──
function showMissionFailed(missionIndex, difficulty) {
  const mission = MISSIONS[missionIndex];
  document.getElementById('cpf-mission-name').textContent = mission.name;
  document.getElementById('cpf-retry-btn').onclick = function () {
    showMissionBriefing(missionIndex, difficulty);
  };
  showScreen('campaign-failed-screen');
}

// ── CAMPAIGN VICTORY ──
function showCampaignVictory() {
  _victorySlide = 0;
  renderVictorySlide();
  showScreen('campaign-victory-screen');
}

function renderVictorySlide() {
  const slide = VICTORY_SLIDES[_victorySlide];
  document.getElementById('cpv-title').textContent = slide.title;
  document.getElementById('cpv-text').textContent = slide.text;
  const img = document.getElementById('cpv-img');
  if (img) { img.src = slide.img; }
  document.getElementById('cpv-slide-num').textContent = (_victorySlide + 1) + ' / ' + VICTORY_SLIDES.length;
  document.getElementById('cpv-prev').disabled = _victorySlide === 0;
  const isLast = _victorySlide === VICTORY_SLIDES.length - 1;
  document.getElementById('cpv-next').style.display = isLast ? 'none' : '';
  document.getElementById('cpv-finish').style.display = isLast ? '' : 'none';
}

// ── EVENT WIRING ──
// (module runs after DOM is ready — no DOMContentLoaded needed)
(function () {

  // Home → Campaign
  document.getElementById('intro-campaign-btn').addEventListener('click', function () {
    showCampaignHome();
  });

  // Campaign home buttons
  document.getElementById('cp-back-btn').addEventListener('click', function () {
    hideAllCampaignScreens();
    document.getElementById('intro-screen').style.display = '';
  });

  document.getElementById('cp-new-btn').addEventListener('click', function () {
    showDifficultySelect(0);
  });

  document.getElementById('cp-continue-btn').addEventListener('click', function () {
    _save = loadSave();
    const idx = Math.min(_save.missionIndex, MISSIONS.length - 1);
    showDifficultySelect(idx);
  });

  // Code entry
  document.getElementById('cp-code-btn').addEventListener('click', function () {
    const val = document.getElementById('cp-code-input').value.trim().toUpperCase();
    const mIdx = MISSIONS.findIndex(m => m.codename === val);
    const errEl = document.getElementById('cp-code-error');
    if (mIdx === -1) {
      if (errEl) { errEl.textContent = 'UNKNOWN CODE: ' + val; errEl.style.display = ''; }
    } else {
      if (errEl) errEl.style.display = 'none';
      document.getElementById('cp-code-input').value = '';
      showDifficultySelect(mIdx);
    }
  });
  document.getElementById('cp-code-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('cp-code-btn').click();
  });

  // Test jump buttons
  document.querySelectorAll('.cp-test-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const idx = parseInt(btn.dataset.mission, 10);
      showDifficultySelect(idx);
    });
  });

  // Difficulty select
  document.getElementById('cpd-back-btn').addEventListener('click', function () {
    showCampaignHome();
  });

  document.querySelectorAll('.cpd-opt').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const diff = btn.dataset.diff;
      showMissionBriefing(_pendingMissionIndex, diff);
    });
  });

  // Mission briefing
  document.getElementById('cpb-back-btn').addEventListener('click', function () {
    showDifficultySelect(_pendingMissionIndex);
  });

  document.getElementById('cpb-launch-btn').addEventListener('click', function () {
    launchMission(_pendingMissionIndex, _pendingDifficulty);
  });

  // Mission result
  document.getElementById('cpr-menu-btn').addEventListener('click', function () {
    showCampaignHome();
  });

  // Mission failed
  document.getElementById('cpf-menu-btn').addEventListener('click', function () {
    showCampaignHome();
  });

  // Victory slides
  document.getElementById('cpv-prev').addEventListener('click', function () {
    if (_victorySlide > 0) { _victorySlide--; renderVictorySlide(); }
  });
  document.getElementById('cpv-next').addEventListener('click', function () {
    if (_victorySlide < VICTORY_SLIDES.length - 1) { _victorySlide++; renderVictorySlide(); }
  });
  document.getElementById('cpv-finish').addEventListener('click', function () {
    hideAllCampaignScreens();
    document.getElementById('intro-screen').style.display = '';
  });
}());
