// ── HUNTER KILLER — PROCEDURAL MUSIC ENGINE ──────────────────────────────
// Tron / 80s action synth aesthetic.  No audio files — pure Web Audio API.
// Three modes: 'ambient' (suspense), 'combat' (action), 'stealth' (silent).
//
// Game hooks exposed on window:
//   window._musicStart()       — call from launchGame
//   window._musicStop()        — call on game over / abort
//   window._musicCombat(bool)  — true = combat mode, false = back to ambient
//   window._musicStealth(bool) — true = stealth mode

const _MUS = (() => {
  // ── CONSTANTS ──────────────────────────────────────────────────────────
  const BPM        = 126;
  const STEP       = 60 / BPM / 4;   // 16th-note duration (seconds)
  const LOOKAHEAD  = 0.12;            // schedule this far ahead
  const SCHED_MS   = 20;              // scheduler poll interval

  // Notes (Hz)
  const A2=110, C3=130.8, D3=146.8, E3=164.8, F3=174.6, G3=196,
        A3=220, C4=261.6, D4=293.7,  E4=329.6, G4=392,   A4=440;

  // ── STATE ──────────────────────────────────────────────────────────────
  let ctx, master, revSend;
  let gDrum, gArp, gBass, gLead, gPad;
  let _step=0, _nextTime=0, _sched=null;
  let _mode='ambient';  // 'ambient' | 'combat' | 'stealth'

  // current / target gain per layer (smoothed each scheduler tick)
  const G = {
    drum:  {cur:0, tgt:0},
    arp:   {cur:0, tgt:0},
    bass:  {cur:0, tgt:0},
    lead:  {cur:0, tgt:0},
    pad:   {cur:0, tgt:0},
  };

  // ── REVERB (impulse-response built algorithmically) ────────────────────
  function makeReverb(dur=2.0, decay=2.0) {
    const len   = ctx.sampleRate * dur;
    const buf   = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c=0; c<2; c++) {
      const d = buf.getChannelData(c);
      for (let i=0; i<len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, decay);
    }
    const cv = ctx.createConvolver();
    cv.buffer = buf;
    return cv;
  }

  // ── NOISE BUFFER (reused for drums) ───────────────────────────────────
  let _noiseBuf = null;
  function noiseBuf() {
    if (_noiseBuf) return _noiseBuf;
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i=0; i<d.length; i++) d[i] = Math.random()*2-1;
    _noiseBuf = b;
    return b;
  }

  // ── DRUM SYNTHESIS ─────────────────────────────────────────────────────
  function kick(t) {
    // Sine sweep: 200Hz → 40Hz in 80ms (punchy 80s kick)
    const o  = ctx.createOscillator();
    const eg = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    eg.gain.setValueAtTime(1.2, t);
    eg.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o.connect(eg); eg.connect(gDrum);
    o.start(t); o.stop(t + 0.4);

    // Click transient on top
    const ns  = ctx.createBufferSource();
    const nbuf= ctx.createBuffer(1, ctx.sampleRate*0.015, ctx.sampleRate);
    const nd  = nbuf.getChannelData(0);
    for (let i=0; i<nd.length; i++) nd[i] = (Math.random()*2-1)*(1-i/nd.length);
    ns.buffer = nbuf;
    const nf  = ctx.createBiquadFilter(); nf.type='lowpass'; nf.frequency.value=3000;
    const neg = ctx.createGain();
    neg.gain.setValueAtTime(0.5, t);
    neg.gain.exponentialRampToValueAtTime(0.001, t+0.015);
    ns.connect(nf); nf.connect(neg); neg.connect(gDrum);
    ns.start(t); ns.stop(t+0.02);
  }

  function snare(t) {
    // Noise body
    const ns  = ctx.createBufferSource(); ns.buffer = noiseBuf();
    const bf  = ctx.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value=2800; bf.Q.value=1.0;
    const eg  = ctx.createGain();
    eg.gain.setValueAtTime(0.7, t);
    eg.gain.exponentialRampToValueAtTime(0.001, t+0.18);
    ns.connect(bf); bf.connect(eg); eg.connect(gDrum);
    ns.start(t); ns.stop(t+0.2);

    // Tone (snare body crack)
    const o   = ctx.createOscillator(); o.type='triangle'; o.frequency.value=240;
    const oe  = ctx.createGain();
    oe.gain.setValueAtTime(0.35, t);
    oe.gain.exponentialRampToValueAtTime(0.001, t+0.06);
    o.connect(oe); oe.connect(gDrum);
    o.start(t); o.stop(t+0.08);
  }

  function hat(t, open=false) {
    const dur = open ? 0.22 : 0.04;
    const ns  = ctx.createBufferSource(); ns.buffer = noiseBuf();
    const hf  = ctx.createBiquadFilter(); hf.type='highpass'; hf.frequency.value = open ? 9000 : 11000;
    const eg  = ctx.createGain();
    eg.gain.setValueAtTime(open ? 0.22 : 0.13, t);
    eg.gain.exponentialRampToValueAtTime(0.001, t+dur);
    ns.connect(hf); hf.connect(eg); eg.connect(gDrum);
    ns.start(t); ns.stop(t+dur+0.01);
  }

  // ── SYNTH NOTE FACTORIES ───────────────────────────────────────────────
  function bassNote(t, freq, dur) {
    // Square wave + sub-sine + lowpass
    const o  = ctx.createOscillator(); o.type='square'; o.frequency.value=freq;
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=480;
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0, t);
    eg.gain.linearRampToValueAtTime(0.75, t+0.012);
    eg.gain.setValueAtTime(0.55, t+dur*0.6);
    eg.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(lp); lp.connect(eg); eg.connect(gBass);
    o.start(t); o.stop(t+dur+0.02);

    const sub = ctx.createOscillator(); sub.type='sine'; sub.frequency.value=freq*0.5;
    const se  = ctx.createGain();
    se.gain.setValueAtTime(0.4, t);
    se.gain.exponentialRampToValueAtTime(0.001, t+dur*0.85);
    sub.connect(se); se.connect(gBass);
    sub.start(t); sub.stop(t+dur+0.02);
  }

  function arpNote(t, freq) {
    // Short sawtooth + filter — THE Tron arpeggiated synth
    const o  = ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=freq;
    const lp = ctx.createBiquadFilter();
    lp.type='lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(3500, t+0.03);
    lp.frequency.exponentialRampToValueAtTime(900, t+STEP*0.7);
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0, t);
    eg.gain.linearRampToValueAtTime(0.55, t+0.008);
    eg.gain.exponentialRampToValueAtTime(0.001, t+STEP*0.85);
    o.connect(lp); lp.connect(eg); eg.connect(gArp);
    o.start(t); o.stop(t+STEP+0.01);
  }

  function leadNote(t, freq, dur) {
    const o  = ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=freq;
    const lp = ctx.createBiquadFilter();
    lp.type='lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(2800, t+0.04);
    lp.frequency.exponentialRampToValueAtTime(1000, t+dur*0.6);
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0, t);
    eg.gain.linearRampToValueAtTime(0.5, t+0.025);
    eg.gain.setValueAtTime(0.38, t+dur*0.5);
    eg.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(lp); lp.connect(eg); eg.connect(gLead);
    o.start(t); o.stop(t+dur+0.02);

    // Harmony a 5th above (optional, soft)
    const o2 = ctx.createOscillator(); o2.type='triangle'; o2.frequency.value=freq*1.5;
    const e2 = ctx.createGain();
    e2.gain.setValueAtTime(0, t);
    e2.gain.linearRampToValueAtTime(0.12, t+0.04);
    e2.gain.exponentialRampToValueAtTime(0.001, t+dur*0.7);
    o2.connect(e2); e2.connect(gLead);
    o2.start(t); o2.stop(t+dur+0.02);
  }

  // ── SEQUENCES (32 steps = 2 bars of 16th notes) ───────────────────────

  // Arpeggio: Am7 chord tones cycling up and down — quintessential Tron
  const ARP_NOTES = [A3,C4,E4,G4, A4,G4,E4,C4, A3,C4,E4,G4, A4,G4,E4,C4,
                     A3,E4,C4,G4, A4,G4,E4,C4, D4,C4,A3,G3, E3,G3,A3,C4];

  // Bass: driving arpeggiated Am7, walks up/down
  const BASS_COMBAT = [
    [A2,4],null,null,null, [C3,2],null,null,[E3,2], [G3,2],null,[E3,2],null, null,null,[C3,2],null,
    [A2,4],null,null,null, [C3,2],null,[G3,2],null, [A3,2],null,[G3,2],null, [E3,3],null,null,null,
  ];

  // Bass ambient: sparse, atmospheric
  const BASS_AMBIENT = [
    [A2,6],null,null,null, null,null,null,null, [C3,4],null,null,null, null,null,null,null,
    [A2,6],null,null,null, null,null,null,null, [E3,4],null,null,null, [C3,3],null,null,null,
  ];

  // Bass stealth: just roots, very slow
  const BASS_STEALTH = [
    [A2,8],null,null,null, null,null,null,null, null,null,null,null, null,null,null,null,
    [E3,6],null,null,null, null,null,null,null, [A2,8],null,null,null, null,null,null,null,
  ];

  // Lead melody (combat only) — plays over 2nd bar
  const LEAD_MELODY = [
    null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null,
    [A3,3],null,null,null, [G3,2],null,[E3,2],null, [D4,2],null,[E4,2],null, [A3,5],null,null,null,
  ];

  // ── STEP SCHEDULER ─────────────────────────────────────────────────────
  function scheduleStep(s, t) {
    const i = s % 32;

    if (_mode === 'combat') {
      // Kick: every beat (every 8 steps)
      if (i % 8 === 0) kick(t);
      // Snare: beat 2 (step 8) and beat 4 (step 24)
      if (i === 8 || i === 24) snare(t);
      // Closed hi-hat: every 8th note (every 4 steps), accent off-beats
      if (i % 2 === 0) hat(t, false);
      // Open hi-hat: off-beats of 2 and 4
      if (i === 12 || i === 28) hat(t, true);

      // Arpeggio (the Tron signature sound)
      arpNote(t, ARP_NOTES[i]);

      // Bass
      const bn = BASS_COMBAT[i];
      if (bn) bassNote(t, bn[0], bn[1]*STEP*0.92);

      // Lead melody
      const ln = LEAD_MELODY[i];
      if (ln) leadNote(t, ln[0], ln[1]*STEP*0.92);

    } else if (_mode === 'ambient') {
      // Sparse hi-hat on beats 1 and 3 only
      if (i === 0 || i === 16) hat(t, false);

      // Occasional soft snare ghost on beat 3
      if (i === 16 && Math.random() > 0.6) snare(t);

      // Sparse arp (only every 4 steps, quiet — techy texture)
      if (i % 4 === 0 && Math.random() > 0.4) arpNote(t, ARP_NOTES[i]);

      // Sparse bass
      const bn = BASS_AMBIENT[i];
      if (bn) bassNote(t, bn[0], bn[1]*STEP*0.88);

    } else { // stealth
      // Almost nothing — just bass roots on bar boundaries
      if (i === 0 && Math.random() > 0.3) hat(t, false);
      const bn = BASS_STEALTH[i];
      if (bn) bassNote(t, bn[0], bn[1]*STEP*0.9);
    }
  }

  // ── PAD (sustained atmospheric drone) ─────────────────────────────────
  // Runs independently with slow chord changes every ~8 bars
  let _padOscs = [];
  const PAD_CHORDS = [
    [A2, E3, A3, C4],   // Am
    [A2, E3, G3, C4],   // Am7
    [F3, A3, C4, E4],   // Fmaj7
    [G3, D4, G4, D4],   // G5
    [A2, E3, A3, E4],   // Am (wide)
    [D3, A3, D4, F3],   // Dm
  ];
  let _padChordIdx = 0;
  let _padChangeTimer = null;

  function startPad() {
    stopPad();
    const chord = PAD_CHORDS[_padChordIdx];
    _padOscs = chord.map((freq, ci) => {
      // Each chord tone: detuned pair of saws
      [0, +6].forEach(detune => {
        const o  = ctx.createOscillator();
        o.type   = 'sawtooth';
        o.frequency.value = freq;
        o.detune.value    = detune + ci * 2; // slight spread
        const lp = ctx.createBiquadFilter();
        lp.type  = 'lowpass'; lp.frequency.value = 600;
        const eg = ctx.createGain();
        // Slow attack + sustain
        eg.gain.setValueAtTime(0, ctx.currentTime);
        eg.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 3.5);
        o.connect(lp); lp.connect(eg); eg.connect(gPad);
        o.start();
        _padOscs.push({ osc: o, env: eg });
      });
    });
    // Schedule next chord change in 8–12 bars
    const barLen = STEP * 32;
    const changeSecs = barLen * (8 + Math.floor(Math.random() * 4));
    _padChangeTimer = setTimeout(() => {
      _padChordIdx = (_padChordIdx + 1) % PAD_CHORDS.length;
      startPad();
    }, changeSecs * 1000);
  }

  function stopPad() {
    if (_padChangeTimer) clearTimeout(_padChangeTimer);
    _padOscs.forEach(p => {
      if (!p || !p.osc) return;
      try {
        p.env.gain.setTargetAtTime(0, ctx.currentTime, 1.0);
        p.osc.stop(ctx.currentTime + 3);
      } catch(e) {}
    });
    _padOscs = [];
  }

  // ── GAIN SMOOTHING ─────────────────────────────────────────────────────
  const SMOOTH = 0.04;
  function smoothGains() {
    for (const [k, node] of [['drum',gDrum],['arp',gArp],['bass',gBass],['lead',gLead],['pad',gPad]]) {
      if (!node) continue;
      G[k].cur += (G[k].tgt - G[k].cur) * SMOOTH;
      node.gain.value = G[k].cur;
    }
  }

  // ── MODE TARGETS ───────────────────────────────────────────────────────
  function applyModeGains(mode) {
    if (mode === 'combat') {
      G.drum.tgt = 0.70; G.arp.tgt  = 0.52; G.bass.tgt = 0.55;
      G.lead.tgt = 0.40; G.pad.tgt  = 0.10;
    } else if (mode === 'ambient') {
      G.drum.tgt = 0;    G.arp.tgt  = 0.12; G.bass.tgt = 0.28;
      G.lead.tgt = 0;    G.pad.tgt  = 0.28;
    } else { // stealth
      G.drum.tgt = 0;    G.arp.tgt  = 0;    G.bass.tgt = 0.12;
      G.lead.tgt = 0;    G.pad.tgt  = 0.10;
    }
  }

  // ── MAIN SCHEDULER LOOP ────────────────────────────────────────────────
  function runScheduler() {
    if (!ctx) return;
    while (_nextTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(_step, _nextTime);
      _nextTime += STEP;
      _step++;
    }
    smoothGains();
  }

  // ── INIT ───────────────────────────────────────────────────────────────
  function init() {
    if (ctx) return;
    ctx    = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.82;
    master.connect(ctx.destination);

    // Reverb send (drums and arp route a little to reverb for space)
    const rev  = makeReverb(1.8, 2.2);
    revSend    = ctx.createGain(); revSend.gain.value = 0.18;
    rev.connect(master);
    revSend.connect(rev);

    gDrum = ctx.createGain(); gDrum.connect(master); gDrum.connect(revSend);
    gArp  = ctx.createGain(); gArp.connect(master);  gArp.connect(revSend);
    gBass = ctx.createGain(); gBass.connect(master);
    gLead = ctx.createGain(); gLead.connect(master);  gLead.connect(revSend);
    gPad  = ctx.createGain(); gPad.connect(master);

    // Start all at zero
    Object.values(G).forEach(g => { g.cur = 0; g.tgt = 0; });
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────
  function start() {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    _step     = 0;
    _nextTime = ctx.currentTime + 0.05;
    if (_sched) clearInterval(_sched);
    _sched = setInterval(runScheduler, SCHED_MS);
    _mode  = 'ambient';
    applyModeGains('ambient');
    startPad();
  }

  function stop() {
    if (_sched) { clearInterval(_sched); _sched = null; }
    stopPad();
    if (master) {
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    }
    // Kill ctx after fade so nodes clean up
    setTimeout(() => {
      if (ctx) { try { ctx.close(); } catch(e) {} ctx = null; _noiseBuf = null; }
    }, 2000);
  }

  let _combatDecayTimer = null;
  function setCombat(on) {
    if (_combatDecayTimer) { clearTimeout(_combatDecayTimer); _combatDecayTimer = null; }
    if (on) {
      _mode = 'combat';
      applyModeGains('combat');
    } else {
      // Decay back to ambient after a beat (let the bar finish)
      _combatDecayTimer = setTimeout(() => {
        if (_mode === 'combat') { _mode = 'ambient'; applyModeGains('ambient'); }
      }, STEP * 8 * 1000); // wait 2 beats
    }
  }

  function setStealth(on) {
    if (on && _mode !== 'combat') { _mode = 'stealth'; applyModeGains('stealth'); }
    else if (!on && _mode === 'stealth') { _mode = 'ambient'; applyModeGains('ambient'); }
  }

  return { start, stop, setCombat, setStealth };
})();

window._musicStart   = () => _MUS.start();
window._musicStop    = () => _MUS.stop();
window._musicCombat  = on => _MUS.setCombat(on);
window._musicStealth = on => _MUS.setStealth(on);
