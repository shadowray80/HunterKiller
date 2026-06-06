// ── HUNTER KILLER — PROCEDURAL MUSIC ENGINE ──────────────────────────────
// Tron / 80s-action synth aesthetic.  Pure Web Audio API, no files.
//
// window._musicStart()        — call from launchGame
// window._musicStop()         — call on abort / game over
// window._musicCombat(bool)   — true = action, false = back to ambient
// window._musicStealth(bool)  — true = stealth, false = back to ambient

const _MUS = (() => {
  const BPM      = 126;
  const STEP     = 60 / BPM / 4;   // 16th-note in seconds
  const AHEAD    = 0.12;            // lookahead
  const POLL_MS  = 18;

  // Notes (Hz)
  const A2=110, C3=130.8, D3=146.8, E3=164.8, F3=174.6, G3=196,
        A3=220, C4=261.6, D4=293.7,  E4=329.6, G4=392,   A4=440;

  let ctx = null, master = null, rev = null;
  let gDrum, gArp, gBass, gLead, gPad;
  let _step = 0, _nextTime = 0, _sched = null;
  let _mode = 'ambient';

  // Per-layer gain targets & current values (smoothed each poll)
  const L = {
    drum: {c:0,t:0}, arp:{c:0,t:0}, bass:{c:0,t:0}, lead:{c:0,t:0}, pad:{c:0,t:0}
  };

  // ── REVERB ────────────────────────────────────────────────────────────
  function mkReverb(dur, decay) {
    const n = ctx.sampleRate * dur;
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/n, decay);
    }
    const cv = ctx.createConvolver(); cv.buffer = b; return cv;
  }

  // ── SHARED NOISE BUFFER ───────────────────────────────────────────────
  let _nbuf = null;
  function nb() {
    if (_nbuf && _nbuf._ctx === ctx) return _nbuf;
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random()*2-1;
    b._ctx = ctx;
    _nbuf = b;
    return b;
  }

  // ── DRUM VOICES ───────────────────────────────────────────────────────
  function kick(t) {
    if (!ctx) return;
    // Sub sine sweep — punchy 80s kick
    const o = ctx.createOscillator(), eg = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(185, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.07);
    eg.gain.setValueAtTime(0, t);
    eg.gain.linearRampToValueAtTime(1.4, t + 0.002);
    eg.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(eg); eg.connect(gDrum);
    o.start(t); o.stop(t + 0.45);
    // High click for attack
    const ns = ctx.createBufferSource(), nc = ctx.createBuffer(1, ~~(ctx.sampleRate*0.012), ctx.sampleRate);
    const nd = nc.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random()*2-1) * (1-i/nd.length);
    ns.buffer = nc;
    const nf = ctx.createBiquadFilter(); nf.type='lowpass'; nf.frequency.value=2200;
    const ne = ctx.createGain();
    ne.gain.setValueAtTime(0.6, t); ne.gain.exponentialRampToValueAtTime(0.001, t+0.012);
    ns.connect(nf); nf.connect(ne); ne.connect(gDrum);
    ns.start(t); ns.stop(t+0.015);
  }

  function snare(t) {
    if (!ctx) return;
    // Noise body
    const ns = ctx.createBufferSource(); ns.buffer = nb();
    const bf = ctx.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value=2600; bf.Q.value=1.2;
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0.75, t); eg.gain.exponentialRampToValueAtTime(0.001, t+0.19);
    ns.connect(bf); bf.connect(eg); eg.connect(gDrum); eg.connect(rev);
    ns.start(t); ns.stop(t+0.2);
    // Body tone
    const o = ctx.createOscillator(); o.type='triangle'; o.frequency.value=220;
    const oe = ctx.createGain();
    oe.gain.setValueAtTime(0.4, t); oe.gain.exponentialRampToValueAtTime(0.001, t+0.07);
    o.connect(oe); oe.connect(gDrum);
    o.start(t); o.stop(t+0.09);
  }

  function hat(t, open) {
    if (!ctx) return;
    const dur = open ? 0.19 : 0.038;
    const ns = ctx.createBufferSource(); ns.buffer = nb();
    const hf = ctx.createBiquadFilter(); hf.type='highpass'; hf.frequency.value = open ? 8500 : 10500;
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(open ? 0.21 : 0.11, t);
    eg.gain.exponentialRampToValueAtTime(0.001, t+dur);
    ns.connect(hf); hf.connect(eg); eg.connect(gDrum);
    ns.start(t); ns.stop(t+dur+0.01);
  }

  // ── SYNTH VOICES ──────────────────────────────────────────────────────
  function bassNote(t, freq, dur) {
    if (!ctx) return;
    // Square + sub-sine + lowpass — fat analog bass
    const o = ctx.createOscillator(); o.type='square'; o.frequency.value=freq;
    const lp = ctx.createBiquadFilter();
    lp.type='lowpass';
    lp.frequency.setValueAtTime(280, t);
    lp.frequency.exponentialRampToValueAtTime(520, t+0.04);
    lp.Q.value = 2.5;
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0, t);
    eg.gain.linearRampToValueAtTime(0.8, t+0.01);
    eg.gain.setValueAtTime(0.55, t+dur*0.55);
    eg.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(lp); lp.connect(eg); eg.connect(gBass);
    o.start(t); o.stop(t+dur+0.02);
    // Sub sine octave down
    const sub = ctx.createOscillator(); sub.type='sine'; sub.frequency.value=freq*0.5;
    const se = ctx.createGain();
    se.gain.setValueAtTime(0.42, t); se.gain.exponentialRampToValueAtTime(0.001, t+dur*0.9);
    sub.connect(se); se.connect(gBass);
    sub.start(t); sub.stop(t+dur+0.02);
  }

  function arpNote(t, freq) {
    if (!ctx) return;
    // Detuned sawtooth pair + sharp filter sweep — THE Tron arp sound
    [-7, 0].forEach(cents => {
      const o = ctx.createOscillator(); o.type='sawtooth';
      o.frequency.value = freq; o.detune.value = cents;
      const lp = ctx.createBiquadFilter();
      lp.type='lowpass'; lp.Q.value = 3.0;
      lp.frequency.setValueAtTime(150, t);
      lp.frequency.exponentialRampToValueAtTime(4200, t+0.025);
      lp.frequency.exponentialRampToValueAtTime(700, t+STEP*0.75);
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0, t);
      eg.gain.linearRampToValueAtTime(0.42, t+0.006);
      eg.gain.exponentialRampToValueAtTime(0.001, t+STEP*0.88);
      o.connect(lp); lp.connect(eg); eg.connect(gArp);
      o.start(t); o.stop(t+STEP+0.01);
    });
  }

  function leadNote(t, freq, dur) {
    if (!ctx) return;
    const o = ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=freq;
    const lp = ctx.createBiquadFilter();
    lp.type='lowpass'; lp.Q.value=2.0;
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.exponentialRampToValueAtTime(3200, t+0.04);
    lp.frequency.exponentialRampToValueAtTime(1100, t+dur*0.65);
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0, t);
    eg.gain.linearRampToValueAtTime(0.52, t+0.022);
    eg.gain.setValueAtTime(0.38, t+dur*0.5);
    eg.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(lp); lp.connect(eg); eg.connect(gLead); eg.connect(rev);
    o.start(t); o.stop(t+dur+0.02);
    // Soft 5th harmony
    const o2 = ctx.createOscillator(); o2.type='triangle'; o2.frequency.value=freq*1.5;
    const e2 = ctx.createGain();
    e2.gain.setValueAtTime(0.13, t); e2.gain.exponentialRampToValueAtTime(0.001, t+dur*0.6);
    o2.connect(e2); e2.connect(gLead);
    o2.start(t); o2.stop(t+dur+0.02);
  }

  // ── SEQUENCES (32 steps = 2 bars of 16th notes at 126bpm) ─────────────

  // Am7 arpeggio cycling — the Tron signature
  const ARP = [A3,C4,E4,G4, A4,G4,E4,C4, A3,E4,C4,G4, A4,G4,E4,A3,
               A3,C4,E4,G4, A4,G4,E4,C4, D4,C4,A3,G3, E3,G3,A3,C4];

  // Bass patterns
  const BASS_C = [  // combat — driving arpeggiated Am7
    [A2,4],null,null,null, [C3,2],null,null,[E3,2], [G3,2],null,[E3,2],null, null,null,[C3,2],null,
    [A2,4],null,null,null, [C3,2],null,[G3,2],null, [A3,2],null,[G3,2],null, [E3,3],null,null,null
  ];
  const BASS_A = [  // ambient — sparse, breathing
    [A2,6],null,null,null, null,null,null,null, [C3,4],null,null,null, null,null,null,null,
    [A2,6],null,null,null, null,null,null,null, [E3,5],null,null,null, [C3,3],null,null,null
  ];
  const BASS_S = [  // stealth — roots only, very slow
    [A2,8],null,null,null, null,null,null,null, null,null,null,null, null,null,null,null,
    [E3,6],null,null,null, null,null,null,null, [A2,8],null,null,null, null,null,null,null
  ];

  // Lead melody — plays over bar 2 in combat
  const LEAD = [
    null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null,
    [A3,3],null,null,null, [G3,2],null,[E3,2],null, [D4,2],null,[E4,2],null, [A3,5],null,null,null
  ];

  // ── SCHEDULER STEP ────────────────────────────────────────────────────
  function step(s, t) {
    const i = s % 32;
    if (_mode === 'combat') {
      if (i % 8 === 0) kick(t);
      if (i === 8 || i === 24) snare(t);
      if (i % 2 === 0) hat(t, false);
      if (i === 12 || i === 28) hat(t, true);
      arpNote(t, ARP[i]);
      const bn = BASS_C[i]; if (bn) bassNote(t, bn[0], bn[1]*STEP*0.9);
      const ln = LEAD[i];   if (ln) leadNote(t, ln[0], ln[1]*STEP*0.9);
    } else if (_mode === 'ambient') {
      if (i === 0 || i === 16) hat(t, false);
      if (i === 24 && Math.random() > 0.55) snare(t);
      if (i % 4 === 0 && Math.random() > 0.42) arpNote(t, ARP[i]);
      const bn = BASS_A[i]; if (bn) bassNote(t, bn[0], bn[1]*STEP*0.88);
    } else { // stealth
      if (i === 0 && Math.random() > 0.4) hat(t, false);
      const bn = BASS_S[i]; if (bn) bassNote(t, bn[0], bn[1]*STEP*0.9);
    }
  }

  // ── PAD (sustained chord drone) ───────────────────────────────────────
  const CHORDS = [
    [A2,E3,A3,C4], [A2,E3,G3,C4], [F3,A3,C4,E4],
    [G3,D4,G4,B3], [A2,E3,A3,E4], [D3,A3,D4,F3]
  ];
  let _padIdx=0, _padNodes=[], _padTimer=null;

  function startPad() {
    stopPad();
    if (!ctx) return;
    const chord = CHORDS[_padIdx];
    _padNodes = [];
    chord.forEach((freq, ci) => {
      [0, 7].forEach(det => {  // slight detune for width
        if (!ctx) return;
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det + ci;
        const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=580;
        const eg = ctx.createGain();
        eg.gain.setValueAtTime(0, ctx.currentTime);
        eg.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 4);
        o.connect(lp); lp.connect(eg); eg.connect(gPad);
        o.start();
        _padNodes.push({osc:o, eg});
      });
    });
    const secs = STEP * 32 * (8 + ~~(Math.random()*4));
    _padTimer = setTimeout(() => {
      if (!ctx) return;
      _padIdx = (_padIdx + 1) % CHORDS.length;
      startPad();
    }, secs * 1000);
  }

  function stopPad() {
    if (_padTimer) { clearTimeout(_padTimer); _padTimer = null; }
    _padNodes.forEach(n => {
      if (!n) return;
      try { n.eg.gain.setTargetAtTime(0, ctx.currentTime, 0.8); n.osc.stop(ctx.currentTime+3); } catch(e) {}
    });
    _padNodes = [];
  }

  // ── GAIN SMOOTHING ─────────────────────────────────────────────────────
  function smooth() {
    const R = 0.045;
    [['drum',gDrum],['arp',gArp],['bass',gBass],['lead',gLead],['pad',gPad]].forEach(([k,g]) => {
      if (!g) return;
      L[k].c += (L[k].t - L[k].c) * R;
      g.gain.value = Math.max(0, L[k].c);
    });
  }

  function setTargets(drum,arp,bass,lead,pad) {
    L.drum.t=drum; L.arp.t=arp; L.bass.t=bass; L.lead.t=lead; L.pad.t=pad;
  }

  // ── MAIN LOOP ─────────────────────────────────────────────────────────
  function poll() {
    if (!ctx) return;
    while (_nextTime < ctx.currentTime + AHEAD) {
      step(_step, _nextTime);
      _nextTime += STEP;
      _step++;
    }
    smooth();
  }

  // ── INIT ───────────────────────────────────────────────────────────────
  function init() {
    // Close any previous context cleanly
    if (ctx) { try { ctx.close(); } catch(e) {} }
    _nbuf = null;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.80; master.connect(ctx.destination);
    rev = mkReverb(1.6, 2.5);
    const revG = ctx.createGain(); revG.gain.value = 0.22;
    rev.connect(master); revG.connect(rev);

    gDrum = ctx.createGain(); gDrum.connect(master);
    gArp  = ctx.createGain(); gArp.connect(master); gArp.connect(revG);
    gBass = ctx.createGain(); gBass.connect(master);
    gLead = ctx.createGain(); gLead.connect(master);
    gPad  = ctx.createGain(); gPad.connect(master); gPad.connect(revG);
    Object.values(L).forEach(l => { l.c=0; l.t=0; });
  }

  // ── PUBLIC ────────────────────────────────────────────────────────────
  function start() {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    _step = 0; _nextTime = ctx.currentTime + 0.05;
    if (_sched) clearInterval(_sched);
    _sched = setInterval(poll, POLL_MS);
    _mode = 'ambient';
    setTargets(0, 0.10, 0.26, 0, 0.26);
    startPad();
  }

  function stop() {
    if (_sched) { clearInterval(_sched); _sched = null; }
    stopPad();
    if (ctx) {
      try { master.gain.setTargetAtTime(0, ctx.currentTime, 0.4); } catch(e) {}
      const _c = ctx; ctx = null; _nbuf = null;
      setTimeout(() => { try { _c.close(); } catch(e) {} }, 1500);
    }
  }

  let _combatTimer = null;
  function setCombat(on) {
    if (_combatTimer) { clearTimeout(_combatTimer); _combatTimer = null; }
    if (on) {
      _mode = 'combat';
      setTargets(0.68, 0.50, 0.52, 0.38, 0.10);
    } else {
      _combatTimer = setTimeout(() => {
        if (_mode === 'combat') { _mode = 'ambient'; setTargets(0, 0.10, 0.26, 0, 0.26); }
      }, STEP * 8 * 1000);
    }
  }

  function setStealth(on) {
    if (on && _mode !== 'combat') {
      _mode = 'stealth';
      setTargets(0, 0, 0.10, 0, 0.10);
    } else if (!on && _mode === 'stealth') {
      _mode = 'ambient';
      setTargets(0, 0.10, 0.26, 0, 0.26);
    }
  }

  return { start, stop, setCombat, setStealth };
})();

window._musicStart   = () => _MUS.start();
window._musicStop    = () => _MUS.stop();
window._musicCombat  = on => _MUS.setCombat(on);
window._musicStealth = on => _MUS.setStealth(on);
