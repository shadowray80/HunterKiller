// ── HUNTER KILLER — OST MUSIC ENGINE ────────────────────────────────────────
// Basil Poledouris — The Hunt for Red October (1990)
//
// State → playlist mapping:
//   ambient  → Nuclear Scam → Red Route I   (underway, tense travel)
//   stealth  → Ancestral Aid → Two Wives    (silent running)
//   combat   → Chopper → Kaboom!!!          (upbeat action)
//
// window._musicStart()        start on game launch
// window._musicStop()         stop on abort / game over
// window._musicCombat(bool)   combat state
// window._musicStealth(bool)  stealth state
// window._musicVolume(v)      master volume 0–1  (affects game + intro music)

const _MUS = (() => {
  const SRC = {
    nuclear:   '/Sounds/OST/ost_nuclear.mp3',
    ancestral: '/Sounds/OST/ost_ancestral.mp3',
    chopper:   '/Sounds/OST/ost_chopper.mp3',
    twoWives:  '/Sounds/OST/ost_twowives.mp3',
    redRoute:  '/Sounds/OST/ost_redroute.mp3',
    kaboom:    '/Sounds/OST/ost_kaboom.mp3',
  };

  const DISPLAY = {
    nuclear:   'NUCLEAR SCAM',
    ancestral: 'ANCESTRAL AID',
    chopper:   'CHOPPER',
    twoWives:  'TWO WIVES',
    redRoute:  'RED ROUTE I',
    kaboom:    'KABOOM!!!',
  };

  const LISTS = {
    ambient: ['nuclear', 'redRoute'],
    stealth: ['ancestral', 'twoWives'],
    combat:  ['chopper', 'kaboom'],
  };

  let _vol      = 0.2;   // master volume — default 20%
  let _mode     = 'ambient';
  let _cur      = null;  // { key, el, startVol } — currently playing / fading in
  let _prev     = null;  // el fading out
  let _fadeIv   = null;
  let _combatTO = null;
  let _trackTO  = null;  // 2-minute rotation timer
  const _pool   = {};

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

  function _pickRandom(mode) {
    const list = LISTS[mode];
    if (list.length === 1) return list[0];
    const others = list.filter(k => !_cur || k !== _cur.key);
    return others[Math.floor(Math.random() * others.length)];
  }

  function _scheduleNext() {
    if (_trackTO) clearTimeout(_trackTO);
    const delay = (90 + Math.random() * 60) * 1000;
    _trackTO = setTimeout(() => {
      if (_cur) _crossfade(_pickRandom(_mode), 4);
    }, delay);
  }

  function _crossfade(key, secs = 3) {
    if (_cur && _cur.key === key) return;

    const fromEl     = _cur ? _cur.el : null;
    const fromStartV = fromEl ? fromEl.volume : 0; // capture actual current volume
    const toEl       = _el(key);

    // Prevent any stale onended from firing on elements we're now controlling
    if (fromEl) fromEl.onended = null;
    toEl.onended = null;

    if (_fadeIv) { clearInterval(_fadeIv); _fadeIv = null; }

    toEl.currentTime = 0;
    toEl.volume      = 0;
    toEl.play().catch(() => {});

    _prev = fromEl;
    _cur  = { key, el: toEl };
    _updateDisplay(key);
    _scheduleNext();

    const steps = Math.max(1, secs * 20);
    const ms    = 1000 / 20;
    let   step  = 0;

    _fadeIv = setInterval(() => {
      step++;
      const t = Math.min(1, step / steps);
      toEl.volume = t * _vol;                           // fade in to current _vol
      if (fromEl) fromEl.volume = (1 - t) * fromStartV; // fade out from captured start vol
      if (t >= 1) {
        clearInterval(_fadeIv); _fadeIv = null;
        if (fromEl) {
          fromEl.pause();
          fromEl.currentTime = 0;
          fromEl.volume      = 0;
          fromEl.onended     = null;
        }
        _prev = null;
        // Wire onended AFTER fade completes — prevents double-fire during crossfade
        toEl.onended = () => _crossfade(_pickRandom(_mode), 3);
      }
    }, ms);
  }

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  function start() {
    _mode = 'ambient';
    _el('nuclear'); _el('redRoute');
    _crossfade(_pickRandom('ambient'), 2);
  }

  function stop() {
    if (_fadeIv)   { clearInterval(_fadeIv);   _fadeIv   = null; }
    if (_combatTO) { clearTimeout(_combatTO);  _combatTO = null; }
    if (_trackTO)  { clearTimeout(_trackTO);   _trackTO  = null; }
    Object.values(_pool).forEach(a => {
      try { a.pause(); a.currentTime = 0; a.volume = 0; a.onended = null; } catch(e) {}
    });
    _cur = null; _prev = null;
    _updateDisplay('—');
  }

  function setCombat(on) {
    if (_combatTO) { clearTimeout(_combatTO); _combatTO = null; }
    if (on) {
      _mode = 'combat';
      _el('chopper'); _el('kaboom');
      _crossfade(_pickRandom('combat'), 1.5);
    } else {
      _combatTO = setTimeout(() => {
        if (_mode === 'combat') {
          _mode = 'ambient';
          _crossfade(_pickRandom('ambient'), 5);
        }
      }, 8000);
    }
  }

  function setStealth(on) {
    if (on && _mode !== 'combat') {
      _mode = 'stealth';
      _el('ancestral'); _el('twoWives');
      _crossfade(_pickRandom('stealth'), 4);
    } else if (!on && _mode === 'stealth') {
      _mode = 'ambient';
      _crossfade(_pickRandom('ambient'), 4);
    }
  }

  function setVolume(v) {
    _vol = Math.max(0, Math.min(1, v));
    if (_cur)  _cur.el.volume = _vol;
    if (_prev) _prev.volume   = _vol;
    // Also apply to intro music (defined in game.js as window._introMusic)
    if (window._introMusic) window._introMusic.volume = _vol;
  }

  return { start, stop, setCombat, setStealth, setVolume };
})();

window._musicStart   = ()  => _MUS.start();
window._musicStop    = ()  => _MUS.stop();
window._musicCombat  = on  => _MUS.setCombat(on);
window._musicStealth = on  => _MUS.setStealth(on);
window._musicVolume  = v   => _MUS.setVolume(v);
