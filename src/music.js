// ── HUNTER KILLER — OST MUSIC ENGINE ────────────────────────────────────────
// Basil Poledouris — The Hunt for Red October (1990)
//
// State → playlist mapping:
//   ambient  → Nuclear Scam → Red Route I   (underway, tense travel)
//   stealth  → Ancestral Aid → Two Wives    (silent running)
//   combat   → Chopper → Kaboom!!!          (upbeat action)
//   (intro music: Hymn to Red October plays on menu screen)
//
// window._musicStart()        start on game launch
// window._musicStop()         stop on abort / game over
// window._musicCombat(bool)   combat state
// window._musicStealth(bool)  stealth state
// window._musicVolume(v)      master volume 0–1

const _MUS = (() => {
  const SRC = {
    hymn:      '/Sounds/OST/ost_hymn.mp3',
    nuclear:   '/Sounds/OST/ost_nuclear.mp3',
    ancestral: '/Sounds/OST/ost_ancestral.mp3',
    chopper:   '/Sounds/OST/ost_chopper.mp3',
    twoWives:  '/Sounds/OST/ost_twowives.mp3',
    redRoute:  '/Sounds/OST/ost_redroute.mp3',
    plane:     '/Sounds/OST/ost_planecrash.mp3',
    kaboom:    '/Sounds/OST/ost_kaboom.mp3',
    course:    '/Sounds/OST/ost_course.mp3',
  };

  const DISPLAY = {
    hymn:      'HYMN TO RED OCTOBER',
    nuclear:   'NUCLEAR SCAM',
    ancestral: 'ANCESTRAL AID',
    chopper:   'CHOPPER',
    twoWives:  'TWO WIVES',
    redRoute:  'RED ROUTE I',
    plane:     'PLANE CRASH',
    kaboom:    'KABOOM!!!',
    course:    'COURSE TWO-FIVE-ZERO',
  };

  // Ordered playlists — advance to next track when current ends
  const LISTS = {
    ambient: ['nuclear', 'redRoute'],
    stealth: ['ancestral', 'twoWives'],
    combat:  ['chopper', 'kaboom'],
  };

  let _vol = 1.0;
  let _mode = 'ambient';
  let _idx = { ambient: 0, stealth: 0, combat: 0 };
  let _cur = null;      // { key, el }
  let _fadeIv = null;
  let _combatTO = null;
  const _pool = {};     // key → Audio element

  function _el(key) {
    if (!_pool[key]) {
      const a = new Audio(SRC[key]);
      a.volume = 0;
      a.preload = 'auto';
      _pool[key] = a;
    }
    return _pool[key];
  }

  function _updateDisplay(key) {
    const el = document.getElementById('aco-now-playing');
    if (el) el.textContent = DISPLAY[key] || key;
  }

  function _crossfade(key, secs = 3) {
    if (_cur && _cur.key === key) return;

    const fromEl = _cur ? _cur.el : null;
    const toEl   = _el(key);

    if (_fadeIv) { clearInterval(_fadeIv); _fadeIv = null; }

    toEl.currentTime = 0;
    toEl.volume = 0;
    toEl.onended = () => _advance(key);
    toEl.play().catch(() => {});

    _cur = { key, el: toEl };
    _updateDisplay(key);

    const steps = Math.max(1, secs * 20);
    const ms    = 1000 / 20;
    let   step  = 0;

    _fadeIv = setInterval(() => {
      step++;
      const t = step / steps;
      toEl.volume = Math.min(_vol, t * _vol);
      if (fromEl) fromEl.volume = Math.max(0, (1 - t) * _vol);
      if (step >= steps) {
        clearInterval(_fadeIv); _fadeIv = null;
        if (fromEl) { fromEl.pause(); fromEl.currentTime = 0; fromEl.volume = 0; fromEl.onended = null; }
      }
    }, ms);
  }

  // When a track ends naturally, advance to the next in its playlist
  function _advance(endedKey) {
    for (const [mode, list] of Object.entries(LISTS)) {
      const i = list.indexOf(endedKey);
      if (i === -1) continue;
      _idx[mode] = (i + 1) % list.length;
      if (_mode === mode) _crossfade(list[_idx[mode]], 2);
      return;
    }
  }

  function _pick(mode) {
    return LISTS[mode][_idx[mode] % LISTS[mode].length];
  }

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  function start() {
    _mode = 'ambient';
    // Preload ambient tracks immediately so first play is gapless
    _el('nuclear'); _el('redRoute');
    _crossfade(_pick('ambient'), 2);
  }

  function stop() {
    if (_fadeIv)  { clearInterval(_fadeIv);  _fadeIv  = null; }
    if (_combatTO){ clearTimeout(_combatTO); _combatTO = null; }
    Object.values(_pool).forEach(a => {
      try { a.pause(); a.currentTime = 0; a.volume = 0; a.onended = null; } catch(e) {}
    });
    _cur = null;
    _updateDisplay('—');
  }

  function setCombat(on) {
    if (_combatTO) { clearTimeout(_combatTO); _combatTO = null; }
    if (on) {
      _mode = 'combat';
      _el('chopper'); _el('kaboom'); // preload
      _crossfade(_pick('combat'), 1.5);
    } else {
      _combatTO = setTimeout(() => {
        if (_mode === 'combat') {
          _mode = 'ambient';
          _crossfade(_pick('ambient'), 5);
        }
      }, 8000);
    }
  }

  function setStealth(on) {
    if (on && _mode !== 'combat') {
      _mode = 'stealth';
      _el('ancestral'); _el('twoWives'); // preload
      _crossfade(_pick('stealth'), 4);
    } else if (!on && _mode === 'stealth') {
      _mode = 'ambient';
      _crossfade(_pick('ambient'), 4);
    }
  }

  function setVolume(v) {
    _vol = Math.max(0, Math.min(1, v));
    if (_cur) _cur.el.volume = _vol;
  }

  return { start, stop, setCombat, setStealth, setVolume };
})();

window._musicStart   = ()  => _MUS.start();
window._musicStop    = ()  => _MUS.stop();
window._musicCombat  = on  => _MUS.setCombat(on);
window._musicStealth = on  => _MUS.setStealth(on);
window._musicVolume  = v   => _MUS.setVolume(v);
window._musicTrack   = ()  => {}; // no-op — tracks auto-select by game state
