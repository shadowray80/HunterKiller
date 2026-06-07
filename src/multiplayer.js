import { supabase, ensureAuth } from './supabase.js';

// ── STATE ──
let _user = null;
let _username = null;
let _lobbyChannel = null;
let _sessionChannel = null;
let _gameChannel = null;
let _onlineUsers = {};
let _currentCode = null;
let _isHost = false;
let _isReady = false;
let _currentMap = null;
let _currentMode = 'ffa';

// Remote players — read by game.js for rendering
window._mpRemotePlayers = {};

// ── TEAM CONFIG ──
export const TEAMS = {
  alpha: { name: 'WOLFPACK', color: '#22ee88', glow: '#00cc66' },  // green
  bravo: { name: 'KRAKEN',   color: '#ff8833', glow: '#ff6600' }   // orange
};
// AI enemy (BRAVO) stays red — player teams use non-red colours
let _myTeam = 'alpha';
window._mpMyTeam = null; // set at game launch

// ── AI CONFIG ──
let _aiAlpha = 0;  // AI wingmen on player's team
let _aiBravo = 2;  // AI opponents
let _aiInterval = null;

// ── MAPS AVAILABLE FOR MULTIPLAYER ──
const MP_MAPS = [
  { id: 'canyon',   name: 'THE CANYON',       tag: 'TERRAIN',    hf: true  },
  { id: 'trench',   name: 'THE TRENCH',        tag: 'TERRAIN',    hf: true  },
  { id: 'abyss',    name: 'THE ABYSS',         tag: 'TERRAIN',    hf: true  },
  { id: 'dropoff',  name: 'THE DROP OFF',      tag: 'VOLCANIC',   hf: true  },
  { id: 'bungalow', name: 'THE BUNGALOW',      tag: 'FLOOR PLAN', hf: false },
  { id: 'museum',   name: 'THE MUSEUM',        tag: 'FLOOR PLAN', hf: false },
  { id: 'office',   name: 'THE OFFICE BLOCK',  tag: 'FLOOR PLAN', hf: false },
  { id: 'house',    name: 'THE HOUSE',          tag: 'DEFAULT',    hf: false },
];

// ── INIT ──
export async function initMultiplayer() {
  const result = await ensureAuth();
  if (!result || result._authError) {
    const msg = result?._authError || 'Unknown error';
    const el = document.getElementById('mp-auth-error');
    if (el) el.textContent = `⚠ AUTH FAILED: ${msg}`;
    console.error('Auth failed:', msg);
    return;
  }
  _user = result;
  _username = localStorage.getItem('hk_username') || null;
  const disp = document.getElementById('mp-username-display');
  if (disp) disp.textContent = _username || '---';
  _wireAIPickers();
  await _joinLobbyPresence();
  _listenForPings();
  _subscribeToSessions();
  showView('lobby');
}

function _wireAIPickers() {
  function wire(team, initVal) {
    let val = initVal;
    const valEl = document.getElementById(`mp-ai-${team}-val`);
    const dn = document.getElementById(`mp-ai-${team}-dn`);
    const up = document.getElementById(`mp-ai-${team}-up`);
    if (!valEl || !dn || !up) return;
    valEl.textContent = val;
    dn.addEventListener('click', () => {
      if (val <= 0) return;
      val--;
      valEl.textContent = val;
      if (team === 'alpha') _aiAlpha = val; else _aiBravo = val;
    });
    up.addEventListener('click', () => {
      if (val >= 3) return;
      val++;
      valEl.textContent = val;
      if (team === 'alpha') _aiAlpha = val; else _aiBravo = val;
    });
  }
  wire('alpha', _aiAlpha);
  wire('bravo', _aiBravo);
}

// ── VIEWS ──
function showView(view) {
  ['lobby','create','waiting'].forEach(v => {
    const el = document.getElementById(`mp-${v}-view`);
    if (el) el.style.display = v === view ? '' : 'none';
  });
}

// ── PRESENCE — who's online ──
async function _joinLobbyPresence() {
  if (_lobbyChannel) { supabase.removeChannel(_lobbyChannel); }
  _lobbyChannel = supabase.channel('lobby', { config: { presence: { key: _user.id } } });
  _lobbyChannel
    .on('presence', { event: 'sync' }, () => {
      const st = _lobbyChannel.presenceState();
      _onlineUsers = {};
      Object.values(st).flat().forEach(p => { _onlineUsers[p.user_id] = p; });
      _renderOnline();
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      newPresences.forEach(p => { _onlineUsers[p.user_id] = p; });
      _renderOnline();
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences.forEach(p => { delete _onlineUsers[p.user_id]; });
      _renderOnline();
    })
    .subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await _lobbyChannel.track({ user_id: _user.id, username: _username || 'UNKNOWN', status: 'lobby' });
      }
    });
}

async function _updatePresenceStatus(status) {
  if (_lobbyChannel) {
    await _lobbyChannel.track({ user_id: _user.id, username: _username || 'UNKNOWN', status });
  }
}

// ── SESSIONS LIST ──
async function _subscribeToSessions() {
  _renderSessions();
  supabase.channel('sessions-watch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => _renderSessions())
    .subscribe();
}

async function _renderSessions() {
  const list = document.getElementById('mp-sessions-list');
  if (!list) return;
  const { data } = await supabase.from('sessions').select('*').eq('status', 'waiting').order('created_at', { ascending: false }).limit(10);
  if (!data || data.length === 0) {
    list.innerHTML = '<div class="mp-empty">No open games — create one!</div>'; return;
  }
  list.innerHTML = data.map(s => {
    const map = MP_MAPS.find(m => m.id === s.map_id) || { name: s.map_id };
    return `<div class="mp-session-row">
      <div class="mp-session-info">
        <span class="mp-session-code">${s.id}</span>
        <span class="mp-session-map">${map.name}</span>
        <span class="mp-session-mode">${s.mode.toUpperCase()}</span>
      </div>
      <button class="mp-join-btn" onclick="window._mpJoin('${s.id}')">JOIN</button>
    </div>`;
  }).join('');
}

// ── ONLINE PLAYERS ──
function _renderOnline() {
  const list = document.getElementById('mp-online-list');
  if (!list) return;
  const others = Object.entries(_onlineUsers).filter(([id]) => id !== _user?.id);
  if (others.length === 0) { list.innerHTML = '<div class="mp-empty">No other players online</div>'; return; }
  list.innerHTML = others.map(([id, p]) => `
    <div class="mp-player-row">
      <span class="mp-player-name">${p.username || 'UNKNOWN'}</span>
      <span class="mp-player-status ${p.status === 'ingame' ? 'status-ingame' : ''}">${p.status === 'ingame' ? '⚔ IN GAME' : '● LOBBY'}</span>
      <button class="mp-ping-btn" onclick="window._mpPing('${id}')">PING</button>
    </div>`).join('');
}

// ── CREATE GAME ──
export function showCreateGame() {
  _currentMap = null; _currentMode = 'ffa';
  // Render map picker
  const picker = document.getElementById('mp-map-picker');
  if (picker) {
    picker.innerHTML = MP_MAPS.map(m => `
      <button class="mp-map-btn" data-id="${m.id}" onclick="window._mpSelectMap('${m.id}')">
        <span class="mp-map-tag">${m.tag}</span>
        <span class="mp-map-name">${m.name}</span>
      </button>`).join('');
  }
  showView('create');
}

window._mpSelectMap = function(id) {
  _currentMap = id;
  document.querySelectorAll('.mp-map-btn').forEach(b => b.classList.toggle('selected', b.dataset.id === id));
};

window._mpSelectMode = function(mode) {
  _currentMode = mode;
  document.querySelectorAll('.mp-mode-btn').forEach(b => b.classList.toggle('selected', b.dataset.mode === mode));
};

export async function createGame() {
  if (!_currentMap) { _setCreateStatus('⚠ SELECT A MAP FIRST'); return; }
  if (!_user) { _setCreateStatus('⚠ NOT SIGNED IN — TRY AGAIN'); return; }

  const btn = document.getElementById('mp-create-confirm');
  if (btn) btn.textContent = 'CREATING...';
  _setCreateStatus('');

  const maxP = parseInt(document.getElementById('mp-max-players').value) || 4;
  const code = 'HK-' + Math.random().toString(36).substr(2, 4).toUpperCase();

  const { error } = await supabase.from('sessions').insert({
    id: code, map_id: _currentMap, mode: _currentMode,
    max_players: maxP, ai_fill: false, host_id: _user.id, status: 'waiting'
  });

  if (btn) btn.textContent = 'CREATE GAME →';

  if (error) {
    console.error('Create session error:', error);
    _setCreateStatus(`⚠ ${error.message}`);
    return;
  }

  await _enterWaitingRoom(code, true);
}

function _setCreateStatus(msg) {
  let el = document.getElementById('mp-create-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mp-create-status';
    el.style.cssText = 'color:#ff6644;font-size:11px;padding:8px 0;letter-spacing:0.1em;';
    const actions = document.getElementById('mp-create-actions');
    if (actions) actions.before(el);
  }
  el.textContent = msg;
}

// ── JOIN GAME ──
window._mpJoin = async function(code) {
  return await _enterWaitingRoom(code, false);
};

export async function joinByCode(rawCode) {
  const code = (rawCode || '').toUpperCase().trim();
  const errEl = document.getElementById('mp-join-code-error');
  if (errEl) errEl.style.display = 'none';
  if (!code) return;
  const { data: sess } = await supabase.from('sessions').select('id').eq('id', code).maybeSingle();
  if (!sess) {
    if (errEl) { errEl.textContent = `⚠ SESSION ${code} NOT FOUND — HOST MAY NOT HAVE STARTED IT YET`; errEl.style.display = ''; }
    return;
  }
  await _enterWaitingRoom(code, false);
}

// ── WAITING ROOM ──
async function _enterWaitingRoom(code, asHost) {
  _currentCode = code; _isHost = asHost; _isReady = false;
  showView('waiting');
  _updatePresenceStatus('waiting');

  // Insert or update player record — always write latest username so stale rows get refreshed
  const { data: existing } = await supabase.from('session_players').select('id').eq('session_id', code).eq('player_id', _user.id).maybeSingle();
  if (!existing) {
    await supabase.from('session_players').insert({
      session_id: code, player_id: _user.id, username: _username || 'UNKNOWN', ready: false
    });
  } else if (_username) {
    await supabase.from('session_players').update({ username: _username }).eq('session_id', code).eq('player_id', _user.id);
  }

  // Auto-assign teams after insert
  await _assignTeams(code);

  // Fetch our team assignment
  const { data: myRow } = await supabase.from('session_players').select('team').eq('session_id', code).eq('player_id', _user.id).maybeSingle();
  if (myRow) _myTeam = myRow.team || 'alpha';

  document.getElementById('mp-waiting-code').textContent = code;
  document.getElementById('mp-launch-btn').style.display = asHost ? '' : 'none';

  // Load session info
  const { data: sess } = await supabase.from('sessions').select('*').eq('id', code).single();
  if (sess) {
    const map = MP_MAPS.find(m => m.id === sess.map_id) || { name: sess.map_id };
    document.getElementById('mp-waiting-map').textContent = `${map.name}  ·  ${sess.mode.toUpperCase()}`;
  }

  // Real-time sync for waiting room
  if (_sessionChannel) supabase.removeChannel(_sessionChannel);
  _sessionChannel = supabase.channel(`waiting:${code}`)
    .on('broadcast', { event: 'launch' }, async ({ payload }) => { await _launchGame(payload.map_id, payload.mode); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'session_players', filter: `session_id=eq.${code}` }, () => _renderWaitingRoom())
    .subscribe();

  _renderWaitingRoom();
}

async function _assignTeams(code) {
  const { data: players } = await supabase.from('session_players').select('*').eq('session_id', code).order('joined_at');
  if (!players) return;
  for (let i = 0; i < players.length; i++) {
    const team = i % 2 === 0 ? 'alpha' : 'bravo';
    await supabase.from('session_players').update({ team }).eq('id', players[i].id);
  }
}

async function _renderWaitingRoom() {
  const { data: players } = await supabase.from('session_players').select('*').eq('session_id', _currentCode).order('joined_at');
  if (!players) return;

  const alpha = players.filter(p => p.team === 'alpha');
  const bravo = players.filter(p => p.team === 'bravo');

  function playerRow(p) {
    const isMe = p.player_id === _user?.id;
    return `<div class="mp-waiting-player ${p.ready ? 'ready' : ''} ${isMe ? 'me' : ''}">
      <span class="mp-wp-name">${p.username || 'UNKNOWN'}${isMe ? ' ◀' : ''}</span>
      <span class="mp-wp-status">${p.ready ? '✓ READY' : '○ WAITING'}</span>
    </div>`;
  }

  // AI slot rows — only the host sees AI config at this point
  function aiRow(team, i) {
    const names = { alpha: 'WOLFPACK', bravo: 'KRAKEN' };
    return `<div class="mp-waiting-player ai-slot">
      <span class="mp-wp-name">⚙ ${names[team] || team} AI #${i + 1}</span>
      <span class="mp-wp-status ai">◉ STANDING BY</span>
    </div>`;
  }
  const alphaAI = _isHost ? Array.from({ length: _aiAlpha }, (_, i) => aiRow('alpha', i)).join('') : '';
  const bravoAI = _isHost ? Array.from({ length: _aiBravo }, (_, i) => aiRow('bravo', i)).join('') : '';

  const list = document.getElementById('mp-waiting-players');
  if (list) {
    list.innerHTML = `
      <div class="mp-team-col alpha">
        <div class="mp-team-label">◈ WOLFPACK (ALPHA)</div>
        ${alpha.map(playerRow).join('')}${alphaAI || (!alpha.length ? '<div class="mp-empty">—</div>' : '')}
      </div>
      <div class="mp-team-col bravo">
        <div class="mp-team-label">◈ KRAKEN (BRAVO)</div>
        ${bravo.map(playerRow).join('')}${bravoAI || (!bravo.length ? '<div class="mp-empty">—</div>' : '')}
      </div>`;
  }

  // Ready button state
  const me = players.find(p => p.player_id === _user?.id);
  _isReady = me?.ready || false;
  const readyBtn = document.getElementById('mp-ready-btn');
  if (readyBtn) {
    readyBtn.textContent = _isReady ? '✓ READY' : 'READY UP';
    readyBtn.classList.toggle('is-ready', _isReady);
  }

  // Launch button — host can always launch; show ready count as a hint
  const others = players.filter(p => p.player_id !== _user?.id);
  const readyCount = others.filter(p => p.ready).length;
  const launchBtn = document.getElementById('mp-launch-btn');
  if (launchBtn) {
    launchBtn.disabled = false;
    launchBtn.textContent = others.length === 0
      ? 'LAUNCH →'
      : readyCount === others.length
        ? `LAUNCH ✓ (${readyCount}/${others.length} READY)`
        : `LAUNCH (${readyCount}/${others.length} READY)`;
  }
}

export async function toggleReady() {
  _isReady = !_isReady;
  await supabase.from('session_players').update({ ready: _isReady }).eq('session_id', _currentCode).eq('player_id', _user.id);
}

export async function launchSession() {
  const { data: sess } = await supabase.from('sessions').select('*').eq('id', _currentCode).single();
  if (!sess) return;
  await supabase.from('sessions').update({ status: 'ingame' }).eq('id', _currentCode);
  await _sessionChannel.send({ type: 'broadcast', event: 'launch', payload: { map_id: sess.map_id, mode: sess.mode } });
  await _launchGame(sess.map_id, sess.mode);
}

function _ping(vol = 0.7) {
  const a = new Audio('/Sounds/sonar_ping_single.mp3');
  a.volume = vol;
  a.play().catch(() => {});
}

// ── VOICE CHAT (WebRTC P2P, PTT) ──
const _vc = {
  stream: null,
  peers: {},
  pendingOffers: new Set(),  // outbound offers waiting for our stream
  queuedOffers: new Map(),   // inbound offers waiting for our stream (from -> sdp)
  iceQueue: new Map(),       // ICE candidates queued before peer exists (from -> [])
};

const _iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

async function _vcInit() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    _vc.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    _vc.stream.getAudioTracks().forEach(t => t.enabled = false);
    const el = document.getElementById('peri-ptt-btns');
    if (el) el.style.display = 'flex';
    // Process queued inbound offers — stream is now ready so we can add our track
    for (const [from, sdp] of _vc.queuedOffers) await _vcAnswer(from, sdp);
    _vc.queuedOffers.clear();
    // Offer any outbound peers we queued while waiting for stream
    _vc.pendingOffers.forEach(id => _vcOffer(id));
    _vc.pendingOffers.clear();
    // Offer any already-known players we haven't connected to yet
    Object.keys(window._mpRemotePlayers || {}).forEach(id => {
      if (!_vc.peers[id] && _user && _user.id < id) _vcOffer(id);
    });
  } catch(e) { console.warn('[VC] mic unavailable:', e.message); }
}

function _vcCleanup() {
  Object.values(_vc.peers).forEach(p => {
    try { p.pc.close(); } catch(e) {}
    if (p.audio) { p.audio.pause(); p.audio.remove(); }
  });
  _vc.peers = {};
  _vc.pendingOffers.clear();
  _vc.queuedOffers.clear();
  _vc.iceQueue.clear();
  if (_vc.stream) { _vc.stream.getTracks().forEach(t => t.stop()); _vc.stream = null; }
  const el = document.getElementById('peri-ptt-btns');
  if (el) el.style.display = 'none';
}

function _vcPeer(peerId) {
  if (_vc.peers[peerId]) return _vc.peers[peerId];
  const pc = new RTCPeerConnection({ iceServers: _iceServers });
  const entry = { pc, audio: null, pttActive: false };
  _vc.peers[peerId] = entry;
  if (_vc.stream) _vc.stream.getTracks().forEach(t => pc.addTrack(t, _vc.stream));
  pc.ontrack = e => {
    if (!entry.audio) {
      entry.audio = document.createElement('audio');
      entry.audio.autoplay = true;
      document.body.appendChild(entry.audio);
    }
    entry.audio.srcObject = e.streams[0];
    entry.audio.muted = !entry.pttActive;
    entry.audio.play().catch(() => {});
  };
  pc.onicecandidate = e => {
    if (e.candidate && _gameChannel)
      _gameChannel.send({ type: 'broadcast', event: 'rtc-ice',
        payload: { from: _user.id, to: peerId, c: e.candidate.toJSON() } });
  };
  return entry;
}

async function _vcOffer(peerId) {
  const { pc } = _vcPeer(peerId);
  if (pc.signalingState !== 'stable') return;
  try {
    await pc.setLocalDescription(await pc.createOffer());
    _gameChannel.send({ type: 'broadcast', event: 'rtc-offer',
      payload: { from: _user.id, to: peerId, sdp: pc.localDescription } });
  } catch(e) { console.warn('[VC] offer err', e); }
}

async function _vcAnswer(from, sdp) {
  // If our mic isn't ready yet, queue — _vcInit will call us again once stream is ready
  if (!_vc.stream) { _vc.queuedOffers.set(from, sdp); return; }
  const { pc } = _vcPeer(from);
  try {
    await pc.setRemoteDescription(sdp);
    // Drain any ICE candidates that arrived before we had a remote description
    const queued = _vc.iceQueue.get(from);
    if (queued) { for (const c of queued) try { await pc.addIceCandidate(c); } catch(e) {} _vc.iceQueue.delete(from); }
    await pc.setLocalDescription(await pc.createAnswer());
    _gameChannel.send({ type: 'broadcast', event: 'rtc-answer',
      payload: { from: _user.id, to: from, sdp: pc.localDescription } });
  } catch(e) { console.warn('[VC] answer err', e); }
}

export function vcPttStart(teamOnly) {
  if (!_vc.stream) return;
  _vc.stream.getAudioTracks().forEach(t => t.enabled = true);
  // Resume any autoplay-blocked remote audio during this user gesture
  Object.values(_vc.peers).forEach(p => { if (p.audio?.paused) p.audio.play().catch(()=>{}); });
  if (_gameChannel) _gameChannel.send({ type: 'broadcast', event: 'rtc-ptt',
    payload: { from: _user?.id, active: true, teamOnly, team: _myTeam } });
}
export function vcPttStop() {
  if (!_vc.stream) return;
  _vc.stream.getAudioTracks().forEach(t => t.enabled = false);
  if (_gameChannel) _gameChannel.send({ type: 'broadcast', event: 'rtc-ptt',
    payload: { from: _user?.id, active: false } });
}
window._vcPttStart = vcPttStart;
window._vcPttStop  = vcPttStop;

function _startGameSync(code) {
  window._mpRemotePlayers = {};
  if (_gameChannel) supabase.removeChannel(_gameChannel);

  if (!window._mpRemoteTorps) window._mpRemoteTorps = {};
  _gameChannel = supabase.channel(`game:${code}`);
  _gameChannel
    .on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (payload.id !== _user?.id) {
        const isNew = !window._mpRemotePlayers[payload.id];
        // Update in-place so torpedo lockedTargetRef stays live
        if (isNew) window._mpRemotePlayers[payload.id] = payload;
        else Object.assign(window._mpRemotePlayers[payload.id], payload);
        if (isNew && _user && _user.id < payload.id) {
          if (_vc.stream) _vcOffer(payload.id);
          else _vc.pendingOffers.add(payload.id);
        }
      }
    })
    .on('broadcast', { event: 'torp' }, ({ payload }) => {
      if (payload.owner !== _user?.id) {
        window._mpRemoteTorps[payload.id] = Object.assign({}, payload, { progress: 0, age: 0 });
      }
    })
    .on('broadcast', { event: 'hit' }, ({ payload }) => {
      if (payload.target === _user?.id && window._applyHullDamage) {
        _lastAttacker = payload.from; // track who's hitting us for death broadcast
        window._applyHullDamage(payload.damage, '⚠ DIRECT HIT — HULL BREACH');
        if (payload.hx !== undefined && window.spawnExplosion)
          window.spawnExplosion(payload.hx, payload.hy, payload.hz, false);
        if (window.playExplosion) window.playExplosion(false);
      }
    })
    .on('broadcast', { event: 'died' }, ({ payload }) => {
      if (payload.id !== _user?.id) {
        // Remove from remote players so their ghost disappears
        delete window._mpRemotePlayers[payload.id];
        if (window._mpOnPlayerDied) window._mpOnPlayerDied(payload.id, payload.killedBy, payload.username);
      }
    })
    .on('broadcast', { event: 'rtc-offer' }, ({ payload }) => {
      if (payload.to === _user?.id) _vcAnswer(payload.from, payload.sdp);
    })
    .on('broadcast', { event: 'rtc-answer' }, async ({ payload }) => {
      if (payload.to !== _user?.id) return;
      const entry = _vc.peers[payload.from];
      if (entry) try { await entry.pc.setRemoteDescription(payload.sdp); } catch(e) {}
    })
    .on('broadcast', { event: 'rtc-ice' }, async ({ payload }) => {
      if (payload.to !== _user?.id) return;
      const entry = _vc.peers[payload.from];
      if (entry && entry.pc.remoteDescription) {
        try { await entry.pc.addIceCandidate(payload.c); } catch(e) {}
      } else {
        // Queue — peer doesn't exist yet or remote description not set
        if (!_vc.iceQueue.has(payload.from)) _vc.iceQueue.set(payload.from, []);
        _vc.iceQueue.get(payload.from).push(payload.c);
      }
    })
    .on('broadcast', { event: 'rtc-ptt' }, ({ payload }) => {
      const entry = _vc.peers[payload.from];
      if (!entry) return;
      const shouldHear = payload.active && (!payload.teamOnly || payload.team === _myTeam);
      entry.pttActive = shouldHear; // store so ontrack can apply it later
      if (entry.audio) {
        entry.audio.muted = !shouldHear;
        if (shouldHear) entry.audio.play().catch(() => {});
      }
    })
    .subscribe();

  _vcInit();

  let _lastAttacker = null;
  window._mpMyUserId = _user?.id;

  // Called by game.js when local player dies — broadcasts kill credit to attacker
  window._mpBroadcastDeath = function() {
    if (!_gameChannel) return;
    _gameChannel.send({ type: 'broadcast', event: 'died',
      payload: { id: _user.id, username: _username || '?', killedBy: _lastAttacker, team: _myTeam }
    });
    _lastAttacker = null;
  };

  // Called by game.js every 3 frames
  window._mpSendPos = function(x, y, z, heading, silentRunning) {
    window._mpLocalPos = { x, y, z, team: _myTeam }; // cache for AI proximity checks
    if (!_gameChannel) return;
    _gameChannel.send({
      type: 'broadcast', event: 'pos',
      payload: { id: _user.id, username: _username || '?', x, y, z, heading, team: _myTeam, sr: !!silentRunning }
    });
  };

  // Called by game.js when player fires a torpedo
  window._mpBroadcastTorp = function(t) {
    if (!_gameChannel || !t) return;
    _gameChannel.send({
      type: 'broadcast', event: 'torp',
      payload: {
        id: `${_user.id}_${Date.now()}_${Math.random().toString(36).substr(2,4)}`,
        owner: _user.id, team: _myTeam,
        ox: t.ox, oy: t.oy, oz: t.oz,
        x: t.x, y: t.y, z: t.z,
        dx: t.dx, dy: t.dy || 0, dz: t.dz,
        speed: t.speed,
        isHoming: !!t.isHoming, isMine: !!t.isMine
      }
    });
  };

  // Broadcast a hit on a remote player — they receive and apply hull damage
  window._mpBroadcastHit = function(targetId, damage, hx, hy, hz) {
    if (!_gameChannel) return;
    _gameChannel.send({
      type: 'broadcast', event: 'hit',
      payload: { target: targetId, damage, hx, hy, hz, from: _user?.id }
    });
  };

}

async function _launchGame(mapId, mode) {
  const bg = window.BATTLEGROUNDS?.find(b => b.id === mapId);
  if (!bg) { console.error('Map not found:', mapId); return; }
  _updatePresenceStatus('ingame');

  // 3-ping countdown then launch
  const overlay = document.getElementById('mp-launch-overlay');
  if (overlay) { overlay.style.display = 'flex'; overlay.textContent = '3'; }
  _ping(0.5);

  await new Promise(r => setTimeout(r, 900));
  if (overlay) overlay.textContent = '2';
  _ping(0.65);

  await new Promise(r => setTimeout(r, 900));
  if (overlay) overlay.textContent = '1';
  _ping(0.8);

  await new Promise(r => setTimeout(r, 900));
  if (overlay) { overlay.textContent = 'DIVE IN'; }
  _ping(1.0);

  await new Promise(r => setTimeout(r, 600));
  if (overlay) overlay.style.display = 'none';
  document.getElementById('multiplayer-screen').style.display = 'none';

  _startGameSync(_currentCode);
  window._mpMyTeam = _myTeam;

  // Show team badge in HUD
  const teamInfo = TEAMS[_myTeam] || TEAMS.alpha;
  setTimeout(() => {
    const badge = document.getElementById('mp-team-badge');
    if (badge) {
      badge.textContent = `◈ ${teamInfo.name}`;
      badge.style.color = teamInfo.color;
      badge.style.textShadow = `0 0 8px ${teamInfo.glow}`;
      badge.style.display = '';
    }
  }, 500);

  // Set heightfield globals — normally done by buildCard click handler in solo play
  window._isHeightfield = !!bg.isHeightfield;
  window._hfTerrainScale = bg.gridTerrainScale || undefined;
  if (!bg.isHeightfield) {
    // Clear any stale heightfield data from previous game
    window._canyonHeightGrid = undefined;
    window._hfGridW = undefined;
    window._hfGridD = undefined;
    window._hfGridH = undefined;
  }

  if (bg.loadAsync) {
    const grid = await bg.loadAsync();
    // loadAsync sets _canyonHeightGrid, _hfGridW/D/H — restore the cached hGrid too
    if (bg._hGrid) window._canyonHeightGrid = bg._hGrid;
    window.launchGame(grid);
  } else {
    window.launchGame(bg.makeGrid());
  }

  // Force show minimap so movement controls work immediately
  setTimeout(() => {
    const sw = document.getElementById('sonar-wrap');
    if (sw) sw.style.display = '';
  }, 400);

  // Spawn AI players after game world is ready
  if (_isHost && (_aiAlpha > 0 || _aiBravo > 0)) {
    setTimeout(() => _startAIPlayers(), 1200);
  }
}

// ── AI PLAYERS ──────────────────────────────────────────────────────────────

const _AI_GRID = 78; // approximate playfield size

function _startAIPlayers() {
  if (_aiInterval) { clearInterval(_aiInterval); _aiInterval = null; }

  const aiNames = { alpha: 'WOLFPACK', bravo: 'KRAKEN' };

  function spawnAI(team, idx) {
    const id = `ai_${team}_${idx}`;
    // Spread spawns: alpha starts near player (front half), bravo starts in back half
    const side = team === 'alpha' ? 0.1 : 0.55;
    window._mpRemotePlayers[id] = {
      id,
      username: `${aiNames[team]}-${idx + 1}`,
      x: _AI_GRID * (side + Math.random() * 0.35),
      y: 3 + Math.random() * 6,
      z: _AI_GRID * (side + Math.random() * 0.35),
      heading: Math.random() * Math.PI * 2,
      team,
      sr: false,
      _depthTarget: 3 + Math.random() * 6,
      _nextDepth: Date.now() + 5000,
      _nextTurn: Date.now() + Math.random() * 3000,
    };
  }

  for (let i = 0; i < _aiAlpha; i++) spawnAI('alpha', i);
  for (let i = 0; i < _aiBravo; i++) spawnAI('bravo', i);

  // Update AI at 8fps
  _aiInterval = setInterval(_tickAI, 125);
}

function _tickAI() {
  const rp = window._mpRemotePlayers;
  if (!rp) return;
  const now = Date.now();
  const allAI = Object.values(rp).filter(p => p.id && p.id.startsWith('ai_'));
  const allEntities = Object.values(rp); // includes humans + AI

  allAI.forEach(ai => {
    // Find nearest enemy — store x, y, z for torpedo aiming
    let nearestDist = Infinity, nearestPos = null;

    if (window._mpLocalPos && window._mpLocalPos.team !== ai.team) {
      const p = window._mpLocalPos;
      const dx = p.x - ai.x, dz = p.z - ai.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < nearestDist) { nearestDist = d; nearestPos = { x: p.x, y: p.y || ai.y, z: p.z }; }
    }

    allEntities.forEach(other => {
      if (!other || other.id === ai.id || other.team === ai.team) return;
      const dx = other.x - ai.x, dz = other.z - ai.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < nearestDist) { nearestDist = d; nearestPos = { x: other.x, y: other.y || ai.y, z: other.z }; }
    });

    const SPEED = 0.18;
    const MAX_TURN = 0.04;

    if (nearestPos && nearestDist < 35) {
      // Hunt — steer toward nearest enemy
      const targetH = Math.atan2(nearestPos.x - ai.x, nearestPos.z - ai.z);
      let diff = targetH - ai.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ai.heading += Math.sign(diff) * Math.min(Math.abs(diff), MAX_TURN);

      // Fire torpedo — enemy within range, roughly ahead, cooldown elapsed
      if (nearestDist < 24 && now > (ai._nextFire || 0)) {
        let aDiff = Math.atan2(nearestPos.x - ai.x, nearestPos.z - ai.z) - ai.heading;
        while (aDiff > Math.PI) aDiff -= Math.PI * 2;
        while (aDiff < -Math.PI) aDiff += Math.PI * 2;
        if (Math.abs(aDiff) < Math.PI / 2.5) { // within ~72° forward arc
          const tdx = nearestPos.x - ai.x;
          const tdy = nearestPos.y - ai.y;
          const tdz = nearestPos.z - ai.z;
          const tlen = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz) || 1;
          const torpId = `aitorp_${ai.id}_${now}`;
          if (!window._mpRemoteTorps) window._mpRemoteTorps = {};
          window._mpRemoteTorps[torpId] = {
            x: ai.x, y: ai.y, z: ai.z,
            dx: tdx / tlen, dy: tdy / tlen, dz: tdz / tlen,
            speed: 0.3, progress: 0, age: 0,
            owner: ai.id, team: ai.team,
          };
          // Cooldown: 18–36 seconds
          ai._nextFire = now + 18000 + Math.random() * 18000;
        }
      }
    } else {
      // Patrol — gradual random turns
      if (now > (ai._nextTurn || 0)) {
        ai.heading += (Math.random() - 0.5) * 1.2;
        ai._nextTurn = now + 4000 + Math.random() * 6000;
      }
    }

    // Move
    ai.x += Math.sin(ai.heading) * SPEED;
    ai.z += Math.cos(ai.heading) * SPEED;

    // Bounce off bounds
    if (ai.x < 3)    { ai.heading = Math.PI - ai.heading; ai.x = 3; }
    if (ai.x > _AI_GRID) { ai.heading = Math.PI - ai.heading; ai.x = _AI_GRID; }
    if (ai.z < 3)    { ai.heading = -ai.heading; ai.z = 3; }
    if (ai.z > _AI_GRID) { ai.heading = -ai.heading; ai.z = _AI_GRID; }

    // Smooth depth wander
    if (now > (ai._nextDepth || 0)) {
      ai._depthTarget = 2 + Math.random() * 8;
      ai._nextDepth = now + 6000 + Math.random() * 8000;
    }
    if (ai._depthTarget !== undefined) ai.y += (ai._depthTarget - ai.y) * 0.02;

    // Broadcast AI position so human guests also see them
    if (_gameChannel) {
      _gameChannel.send({
        type: 'broadcast', event: 'pos',
        payload: { id: ai.id, username: ai.username, x: ai.x, y: ai.y, z: ai.z, heading: ai.heading, team: ai.team, sr: false }
      });
    }
  });
}

export async function leaveSession() {
  if (_aiInterval) { clearInterval(_aiInterval); _aiInterval = null; }
  if (_currentCode) {
    await supabase.from('session_players').delete().eq('session_id', _currentCode).eq('player_id', _user.id);
    if (_sessionChannel) supabase.removeChannel(_sessionChannel);
  }
  _currentCode = null; _isHost = false;
  _updatePresenceStatus('lobby');
  await _renderSessions();
  showView('lobby');
}

// ── USERNAME ──
export async function setUsername(name) {
  _username = name.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 12);
  if (!_username) return;
  localStorage.setItem('hk_username', _username);
  document.getElementById('mp-username-display').textContent = _username;
  if (_lobbyChannel) {
    await _lobbyChannel.track({ user_id: _user.id, username: _username, status: 'lobby' });
  }
}

// ── PING ──
window._mpPing = function(targetId) {
  const ch = supabase.channel(`ping:${targetId}`);
  ch.subscribe(status => {
    if (status === 'SUBSCRIBED') {
      ch.send({
        type: 'broadcast', event: 'ping',
        payload: { from: _user?.id, username: _username || 'UNKNOWN' }
      });
      setTimeout(() => supabase.removeChannel(ch), 1500);
    }
  });
};

function _listenForPings() {
  if (!_user) return;
  supabase.channel(`ping:${_user.id}`)
    .on('broadcast', { event: 'ping' }, ({ payload }) => {
      const alert = document.getElementById('mp-ping-alert');
      if (!alert) return;
      alert.textContent = `⚡ ${payload.username} WANTS TO PLAY`;
      alert.style.opacity = '1';
      setTimeout(() => { alert.style.opacity = '0'; }, 4000);
    }).subscribe();
}

// ── END GAME — save kills/deaths to Supabase ──
export async function mpEndGame(kills, deaths) {
  _vcCleanup();
  if (_aiInterval) { clearInterval(_aiInterval); _aiInterval = null; }
  // Remove AI entries from remote players
  if (window._mpRemotePlayers) {
    Object.keys(window._mpRemotePlayers).forEach(id => { if (id.startsWith('ai_')) delete window._mpRemotePlayers[id]; });
  }
  if (!_currentCode || !_user) return;
  await supabase.from('session_players')
    .update({ kills, deaths })
    .eq('session_id', _currentCode)
    .eq('player_id', _user.id);
  _currentCode = null;
}

// Hook called from game.js via window._mpEndGame
window._mpEndGame = mpEndGame;

// ── INVITE LINK GENERATION ──
window._mpGetSessionCode = function() { return _currentCode; };
window._mpGenerateInvite = function(atMs, msg) {
  var code = _currentCode;
  if (!code) return null;
  var url = new URL(location.href);
  url.search = '';
  url.searchParams.set('invite', code);
  url.searchParams.set('at', Math.floor(atMs / 1000));
  if (msg) url.searchParams.set('msg', msg);
  return url.toString();
};

// ── LEADERBOARD ──
export async function fetchLeaderboard() {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('total_kills', { ascending: false })
    .limit(20);
  if (error) { console.error('Leaderboard error:', error); return []; }
  return data || [];
}

export async function renderLeaderboard(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div class="mp-empty">Loading...</div>';
  const rows = await fetchLeaderboard();
  if (!rows.length) { el.innerHTML = '<div class="mp-empty">No games recorded yet</div>'; return; }
  el.innerHTML = `
    <div class="lb-header">
      <span class="lb-rank">#</span>
      <span class="lb-name">CALL SIGN</span>
      <span class="lb-stat">KILLS</span>
      <span class="lb-stat">DEATHS</span>
      <span class="lb-stat">K/D</span>
      <span class="lb-stat">GAMES</span>
    </div>
    ${rows.map((r, i) => `
      <div class="lb-row ${r.player_id === _user?.id ? 'lb-me' : ''}">
        <span class="lb-rank">${i + 1}</span>
        <span class="lb-name">${r.username}</span>
        <span class="lb-stat">${r.total_kills}</span>
        <span class="lb-stat">${r.total_deaths}</span>
        <span class="lb-stat">${r.kd_ratio}</span>
        <span class="lb-stat">${r.games_played}</span>
      </div>`).join('')}`;
}

export { _user, _username };
