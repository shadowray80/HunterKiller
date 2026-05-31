import { supabase, ensureAuth, getUser } from './supabase.js';

// ── STATE ──
let _user = null;
let _username = null;
let _lobbyChannel = null;
let _onlineUsers = {};   // id → { username, status }

// ── INIT ──
export async function initMultiplayer() {
  _user = await ensureAuth();
  if (!_user) return;

  // Load saved username from localStorage
  _username = localStorage.getItem('hk_username') || null;

  await _joinLobbyPresence();
  renderLobby();
}

// ── PRESENCE — who's online ──
async function _joinLobbyPresence() {
  _lobbyChannel = supabase.channel('lobby', {
    config: { presence: { key: _user.id } }
  });

  _lobbyChannel
    .on('presence', { event: 'sync' }, () => {
      const state = _lobbyChannel.presenceState();
      _onlineUsers = {};
      Object.values(state).forEach(presences => {
        presences.forEach(p => {
          _onlineUsers[p.user_id] = { username: p.username, status: p.status };
        });
      });
      renderLobby();
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      newPresences.forEach(p => {
        _onlineUsers[p.user_id] = { username: p.username, status: p.status };
      });
      renderLobby();
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences.forEach(p => { delete _onlineUsers[p.user_id]; });
      renderLobby();
    })
    .subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await _lobbyChannel.track({
          user_id: _user.id,
          username: _username || 'UNKNOWN',
          status: 'lobby'
        });
      }
    });
}

// ── LOBBY RENDER ──
export function renderLobby() {
  const list = document.getElementById('mp-player-list');
  if (!list) return;

  const others = Object.entries(_onlineUsers).filter(([id]) => id !== _user?.id);

  if (others.length === 0) {
    list.innerHTML = '<div class="mp-empty">No other players online</div>';
    return;
  }

  list.innerHTML = others.map(([id, p]) => `
    <div class="mp-player-row">
      <span class="mp-player-name">${p.username || 'UNKNOWN'}</span>
      <span class="mp-player-status">${p.status === 'ingame' ? '⚔ IN GAME' : '● LOBBY'}</span>
      <button class="mp-ping-btn" onclick="window._mpPing('${id}')">PING</button>
    </div>
  `).join('');
}

// ── USERNAME SAVE ──
export async function setUsername(name) {
  _username = name.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 12);
  localStorage.setItem('hk_username', _username);
  document.getElementById('mp-username-display').textContent = _username;
  // Update presence
  if (_lobbyChannel) {
    await _lobbyChannel.track({
      user_id: _user.id,
      username: _username,
      status: 'lobby'
    });
  }
}

// ── PING ──
window._mpPing = async function(targetId) {
  await supabase.channel(`ping:${targetId}`).send({
    type: 'broadcast',
    event: 'ping',
    payload: { from: _user.id, username: _username || 'UNKNOWN' }
  });
};

// Listen for incoming pings
async function _listenForPings() {
  if (!_user) return;
  supabase.channel(`ping:${_user.id}`)
    .on('broadcast', { event: 'ping' }, ({ payload }) => {
      _showPingAlert(payload.username || 'UNKNOWN');
    })
    .subscribe();
}

function _showPingAlert(fromName) {
  const alert = document.getElementById('mp-ping-alert');
  if (!alert) return;
  alert.textContent = `⚡ ${fromName} WANTS TO PLAY`;
  alert.style.opacity = '1';
  setTimeout(() => { alert.style.opacity = '0'; }, 4000);
}

export { _user, _username };
