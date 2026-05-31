import { supabase, ensureAuth } from './supabase.js';

// ── STATE ──
let _user = null;
let _username = null;
let _lobbyChannel = null;
let _sessionChannel = null;
let _onlineUsers = {};
let _currentCode = null;
let _isHost = false;
let _isReady = false;
let _currentMap = null;
let _currentMode = 'ffa';

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
  _user = await ensureAuth();
  if (!_user) { console.error('Auth failed'); return; }
  _username = localStorage.getItem('hk_username') || null;
  const disp = document.getElementById('mp-username-display');
  if (disp) disp.textContent = _username || '---';
  await _joinLobbyPresence();
  _listenForPings();
  _subscribeToSessions();
  showView('lobby');
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
  const aiFill = document.getElementById('mp-ai-fill').checked;
  const code = 'HK-' + Math.random().toString(36).substr(2, 4).toUpperCase();

  const { error } = await supabase.from('sessions').insert({
    id: code, map_id: _currentMap, mode: _currentMode,
    max_players: maxP, ai_fill: aiFill, host_id: _user.id, status: 'waiting'
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
  await _enterWaitingRoom(code, false);
};

// ── WAITING ROOM ──
async function _enterWaitingRoom(code, asHost) {
  _currentCode = code; _isHost = asHost; _isReady = false;
  showView('waiting');
  _updatePresenceStatus('waiting');

  // Insert player record
  const { data: existing } = await supabase.from('session_players').select('id').eq('session_id', code).eq('player_id', _user.id).maybeSingle();
  if (!existing) {
    await supabase.from('session_players').insert({
      session_id: code, player_id: _user.id, username: _username || 'UNKNOWN', ready: false
    });
  }

  // Auto-assign teams after insert
  await _assignTeams(code);

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

  const list = document.getElementById('mp-waiting-players');
  if (list) {
    list.innerHTML = `
      <div class="mp-team-col alpha">
        <div class="mp-team-label">◈ ALPHA</div>
        ${alpha.map(playerRow).join('') || '<div class="mp-empty">—</div>'}
      </div>
      <div class="mp-team-col bravo">
        <div class="mp-team-label">◈ BRAVO</div>
        ${bravo.map(playerRow).join('') || '<div class="mp-empty">—</div>'}
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

  // Launch button — enabled when ≥2 players all ready
  const allReady = players.length >= 2 && players.every(p => p.ready);
  const launchBtn = document.getElementById('mp-launch-btn');
  if (launchBtn) launchBtn.disabled = !allReady;
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

  if (bg.loadAsync) {
    const grid = await bg.loadAsync();
    window.launchGame(grid);
  } else {
    window.launchGame(bg.makeGrid());
  }
}

export async function leaveSession() {
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
window._mpPing = async function(targetId) {
  await supabase.channel(`ping:${targetId}`).send({
    type: 'broadcast', event: 'ping',
    payload: { from: _user.id, username: _username || 'UNKNOWN' }
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
  if (!_currentCode || !_user) return;
  await supabase.from('session_players')
    .update({ kills, deaths })
    .eq('session_id', _currentCode)
    .eq('player_id', _user.id);
  _currentCode = null;
}

// Hook called from game.js via window._mpEndGame
window._mpEndGame = mpEndGame;

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
