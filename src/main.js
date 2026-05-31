import './game.js';
import { initMultiplayer, setUsername, showCreateGame, createGame, toggleReady, launchSession, leaveSession } from './multiplayer.js';

// ── MULTIPLAYER ──
document.getElementById('intro-multi-btn').addEventListener('click', async () => {
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('multiplayer-screen').style.display = '';
  await initMultiplayer();
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

// Waiting room
document.getElementById('mp-ready-btn').addEventListener('click', toggleReady);
document.getElementById('mp-launch-btn').addEventListener('click', launchSession);
document.getElementById('mp-leave-btn').addEventListener('click', leaveSession);
