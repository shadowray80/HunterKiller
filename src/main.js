import './game.js';
import './campaign.js';
import { initMultiplayer, setUsername, showCreateGame, createGame, toggleReady, launchSession, leaveSession, renderLeaderboard, joinByCode } from './multiplayer.js';

// ── MULTIPLAYER ──
document.getElementById('intro-multi-btn').addEventListener('click', async () => {
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('multiplayer-screen').style.display = '';
  await initMultiplayer();
  renderLeaderboard('mp-leaderboard');
});

// Standalone leaderboard from home screen
document.getElementById('intro-lb-btn').addEventListener('click', async () => {
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('leaderboard-screen').style.display = '';
  renderLeaderboard('lb-content');
});
document.getElementById('lb-back-btn').addEventListener('click', () => {
  document.getElementById('leaderboard-screen').style.display = 'none';
  document.getElementById('intro-screen').style.display = '';
});

document.getElementById('mp-back-btn').addEventListener('click', () => {
  document.getElementById('multiplayer-screen').style.display = 'none';
  document.getElementById('intro-screen').style.display = '';
});

// Username
document.getElementById('mp-username-save').addEventListener('click', () => {
  const val = document.getElementById('mp-username-input').value.trim();
  if (val) setUsername(val);
});
document.getElementById('mp-username-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const val = e.target.value.trim(); if (val) setUsername(val); }
});

// Create game flow
document.getElementById('mp-create-btn').addEventListener('click', showCreateGame);
document.getElementById('mp-create-cancel').addEventListener('click', () => {
  const { showView } = window._mpShowView || {};
  document.getElementById('mp-create-view').style.display = 'none';
  document.getElementById('mp-lobby-view').style.display = '';
});
document.getElementById('mp-create-confirm').addEventListener('click', createGame);

// Join by code
document.getElementById('mp-join-code-btn').addEventListener('click', () => {
  joinByCode(document.getElementById('mp-join-code-input').value);
});
document.getElementById('mp-join-code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') joinByCode(e.target.value);
});

// Waiting room
document.getElementById('mp-ready-btn').addEventListener('click', toggleReady);
document.getElementById('mp-launch-btn').addEventListener('click', launchSession);
document.getElementById('mp-leave-btn').addEventListener('click', leaveSession);

// ── INVITE GENERATOR ──
document.getElementById('mp-invite-btn').addEventListener('click', () => {
  const modal = document.getElementById('invite-gen-modal');
  const code = window._mpGetSessionCode ? window._mpGetSessionCode() : '???';
  document.getElementById('invite-gen-code').textContent = code;
  // Default time: now + 30 minutes
  const def = new Date(Date.now() + 30 * 60 * 1000);
  def.setSeconds(0, 0);
  document.getElementById('invite-gen-time').value = def.toISOString().slice(0, 16);
  document.getElementById('invite-gen-result').style.display = 'none';
  modal.style.display = modal.style.display === 'none' ? '' : 'none';
});
document.getElementById('invite-gen-cancel').addEventListener('click', () => {
  document.getElementById('invite-gen-modal').style.display = 'none';
});
let _inviteShareText = '';
document.getElementById('invite-gen-create').addEventListener('click', () => {
  const t = document.getElementById('invite-gen-time').value;
  const msg = document.getElementById('invite-gen-msg').value.trim();
  if (!t) return;
  const atMs = new Date(t).getTime();
  const url = window._mpGenerateInvite ? window._mpGenerateInvite(atMs, msg) : null;
  if (!url) return;
  const code = window._mpGetSessionCode ? window._mpGetSessionCode() : '???';
  const timeStr = new Date(atMs).toLocaleString([], {
    weekday:'short', month:'short', day:'numeric',
    hour:'2-digit', minute:'2-digit', timeZoneName:'short'
  });
  _inviteShareText = `Hunter Killer multiplayer game invite\n`
    + `⏱ ${timeStr}\n`
    + (msg ? `${msg}\n` : '')
    + `Join here: ${url}`;
  document.getElementById('invite-gen-url').value = _inviteShareText;
  document.getElementById('invite-gen-result').style.display = '';
  document.getElementById('invite-gen-confirm').style.display = 'none';
});
document.getElementById('invite-gen-copy').addEventListener('click', () => {
  navigator.clipboard.writeText(_inviteShareText).then(() => {
    const c = document.getElementById('invite-gen-confirm');
    c.style.display = '';
    setTimeout(() => { c.style.display = 'none'; }, 2500);
  });
});
document.getElementById('invite-gen-share').addEventListener('click', () => {
  if (navigator.share) {
    const url = window._mpGenerateInvite ? document.getElementById('invite-gen-url').value.split('\n').pop() : '';
    navigator.share({ title: 'Hunter Killer — Multiplayer Invite', text: _inviteShareText });
  } else {
    navigator.clipboard.writeText(_inviteShareText);
  }
});

// ── INVITE LANDING PAGE ──
(function () {
  const params = new URLSearchParams(location.search);
  const code = params.get('invite');
  const at = parseInt(params.get('at'), 10);
  const msg = params.get('msg');
  if (!code || !at || isNaN(at)) return;

  // Show invite screen, hide intro
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('invite-screen').style.display = '';
  document.getElementById('invite-code-display').textContent = code;

  if (msg) {
    const el = document.getElementById('invite-msg-text');
    el.textContent = msg;
    el.style.display = '';
  }

  const deployTime = new Date(at * 1000);
  document.getElementById('invite-local-time').textContent =
    deployTime.toLocaleString([], { weekday:'short', month:'short', day:'numeric',
      hour:'2-digit', minute:'2-digit', timeZoneName:'short' });

  function _sonarPing() {
    const a = new Audio('/Sounds/sonar_ping_single.mp3');
    a.volume = 0.7;
    a.play().catch(() => {});
  }

  let _pinging = false, _pingTimer = null;
  function startMissionHot() {
    if (_pinging) return;
    _pinging = true;
    const btn = document.getElementById('invite-join-btn');
    const status = document.getElementById('invite-status-text');
    btn.disabled = false;
    status.textContent = 'MISSION IS HOT — DEPLOY NOW';
    status.style.color = '#00ff9d';
    _sonarPing();
    setTimeout(_sonarPing, 600);
    setTimeout(_sonarPing, 1200);
    _pingTimer = setInterval(_sonarPing, 30000);
  }

  function tick() {
    const diff = at * 1000 - Date.now();
    const countEl = document.getElementById('invite-countdown');
    const statusEl = document.getElementById('invite-status-text');
    const btn = document.getElementById('invite-join-btn');

    if (diff <= 0) {
      countEl.textContent = '00:00:00';
      startMissionHot();
      return;
    }
    // Enable button 2 minutes early
    if (diff < 120000) btn.disabled = false;

    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60), sec = s % 60;
    const pad = n => String(n).padStart(2, '0');

    countEl.textContent = d > 0
      ? `${d}d ${pad(h)}h ${pad(m)}m`
      : `${pad(h)}:${pad(m)}:${pad(sec)}`;
    if (!_pinging) statusEl.textContent = diff < 3600000
      ? `T-MINUS ${pad(m)}:${pad(sec)}`
      : 'STAND BY';
  }
  tick();
  setInterval(tick, 1000);

  document.getElementById('invite-join-btn').addEventListener('click', async () => {
    if (_pingTimer) clearInterval(_pingTimer);
    document.getElementById('invite-screen').style.display = 'none';
    document.getElementById('multiplayer-screen').style.display = '';
    await initMultiplayer();
    renderLeaderboard('mp-leaderboard');
    // Pre-fill the join-by-code input so it's obvious what to enter
    const codeInput = document.getElementById('mp-join-code-input');
    if (codeInput) codeInput.value = code;
    // Try to auto-join — if session doesn't exist yet the error shows next to the input
    await joinByCode(code);
  });
})();
