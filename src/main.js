import './game.js';
import { initMultiplayer, setUsername } from './multiplayer.js';

// ── MULTIPLAYER LOBBY ──
document.getElementById('intro-multi-btn').addEventListener('click', async () => {
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('multiplayer-screen').style.display = '';
  await initMultiplayer();
});

document.getElementById('mp-back-btn').addEventListener('click', () => {
  document.getElementById('multiplayer-screen').style.display = 'none';
  document.getElementById('intro-screen').style.display = '';
});

document.getElementById('mp-username-save').addEventListener('click', () => {
  const val = document.getElementById('mp-username-input').value.trim();
  if (val) setUsername(val);
});

document.getElementById('mp-username-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const val = e.target.value.trim();
    if (val) setUsername(val);
  }
});
