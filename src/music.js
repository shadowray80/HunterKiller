// ── HUNTER KILLER — TRON / 80s ACTION SYNTH ENGINE ──────────────────────
// Full Daft Punk / Giorgio Moroder aesthetic. Pure Web Audio API.
//
// window._musicStart()        start music when game launches
// window._musicStop()         stop on abort / game over
// window._musicCombat(bool)   true = full combat mode, false = back to ambient
// window._musicStealth(bool)  true = stealth, false = back to ambient

const _MUS = (() => {
  const BPM    = 126;
  const S16    = 60 / BPM / 4;   // one 16th note in seconds
  const AHEAD  = 0.14;
  const POLL   = 16;

  // ── NOTES ───────────────────────────────────────────────────────────────
  const A1=55,  A2=110, C3=130.8, D3=146.8, E3=164.8, F3=174.6, G3=196,
        A3=220, B3=246.9, C4=261.6, D4=293.7, E4=329.6, F4=349.2,
        G4=392,  A4=440,  B4=493.9, C5=523.3, D5=587.3, E5=659.3;

  // ── STATE ────────────────────────────────────────────────────────────────
  let ctx, master, comp, revBig, revGate, revSend, gateSend;
  let gDrum, gArp, gBass, gLead, gPad, gStab;
  let _step = 0, _nextT = 0, _sched = null;
  let _mode = 'ambient';
  const G = { drum:{c:0,t:0}, arp:{c:0,t:0}, bass:{c:0,t:0},
              lead:{c:0,t:0}, pad:{c:0,t:0},  stab:{c:0,t:0} };

  // ── REVERB HELPERS ───────────────────────────────────────────────────────
  function mkRev(dur, decay) {
    const n = ctx.sampleRate * dur;
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/n, decay);
    }
    const cv = ctx.createConvolver(); cv.buffer = b; return cv;
  }

  // Gated reverb: attack then sharp gate — the 80s snare sound
  function mkGateRev() {
    const n = ~~(ctx.sampleRate * 0.6);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const env = i < n*0.25 ? i/(n*0.25) : Math.max(0, 1-(i-n*0.25)/(n*0.1));
        d[i] = (Math.random()*2-1) * env;
      }
    }
    const cv = ctx.createConvolver(); cv.buffer = b; return cv;
  }

  // ── NOISE BUFFER ─────────────────────────────────────────────────────────
  let _nbuf = null;
  function NB() {
    if (_nbuf && _nbuf._c === ctx) return _nbuf;
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random()*2-1;
    b._c = ctx; _nbuf = b; return b;
  }

  // ── WAVESHAPER (soft clip / warmth) ──────────────────────────────────────
  function mkClip(amount) {
    const ws = ctx.createWaveShaper();
    const n = 256, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i*2/n - 1;
      c[i] = (Math.PI + amount) * x / (Math.PI + amount * Math.abs(x));
    }
    ws.curve = c; return ws;
  }

  // ── KICK ─────────────────────────────────────────────────────────────────
  // Big Tron-style kick: massive sub sweep + hard punch transient
  function kick(t) {
    if (!ctx) return;
    // Sub sweep — the backbone
    const o1 = ctx.createOscillator(), e1 = ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(220, t);
    o1.frequency.exponentialRampToValueAtTime(35, t+0.09);
    e1.gain.setValueAtTime(0, t);
    e1.gain.linearRampToValueAtTime(1.6, t+0.002);
    e1.gain.exponentialRampToValueAtTime(0.001, t+0.55);
    o1.connect(e1); e1.connect(gDrum); o1.start(t); o1.stop(t+0.6);

    // Mid click — body
    const o2 = ctx.createOscillator(), e2 = ctx.createGain();
    o2.type = 'triangle'; o2.frequency.setValueAtTime(160, t);
    o2.frequency.exponentialRampToValueAtTime(60, t+0.04);
    e2.gain.setValueAtTime(0.9, t); e2.gain.exponentialRampToValueAtTime(0.001, t+0.12);
    o2.connect(e2); e2.connect(gDrum); o2.start(t); o2.stop(t+0.15);

    // Hard click transient
    const ns = ctx.createBufferSource();
    const nc = ctx.createBuffer(1, ~~(ctx.sampleRate*0.009), ctx.sampleRate);
    const nd = nc.getChannelData(0);
    for (let i=0; i<nd.length; i++) nd[i]=(Math.random()*2-1)*(1-i/nd.length);
    ns.buffer = nc;
    const nf = ctx.createBiquadFilter(); nf.type='lowpass'; nf.frequency.value=1800;
    const ne = ctx.createGain(); ne.gain.setValueAtTime(0.8,t); ne.gain.exponentialRampToValueAtTime(0.001,t+0.009);
    ns.connect(nf); nf.connect(ne); ne.connect(gDrum); ns.start(t); ns.stop(t+0.01);

    // Side-chain pump — duck pad when kick hits (the Tron pumping effect)
    if (gPad) {
      gPad.gain.cancelScheduledValues(t);
      gPad.gain.setValueAtTime(G.pad.c * 0.15, t);
      gPad.gain.setTargetAtTime(G.pad.t, t+0.04, 0.07);
    }
    if (gArp) {
      gArp.gain.cancelScheduledValues(t);
      gArp.gain.setValueAtTime(G.arp.c * 0.55, t);
      gArp.gain.setTargetAtTime(G.arp.t, t+0.03, 0.05);
    }
  }

  // ── SNARE ────────────────────────────────────────────────────────────────
  // 80s gated reverb snare — signature Bloodsport / Phil Collins sound
  function snare(t) {
    if (!ctx) return;
    // Noise body through gate reverb
    const ns = ctx.createBufferSource(); ns.buffer = NB();
    const bf = ctx.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value=3000; bf.Q.value=1.4;
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0.9, t); eg.gain.exponentialRampToValueAtTime(0.001, t+0.22);
    ns.connect(bf); bf.connect(eg);
    eg.connect(gDrum);             // dry
    eg.connect(gateSend);          // gated reverb
    ns.start(t); ns.stop(t+0.25);

    // Tone snap
    const o = ctx.createOscillator(); o.type='triangle'; o.frequency.value=200;
    const oe = ctx.createGain();
    oe.gain.setValueAtTime(0.55, t); oe.gain.exponentialRampToValueAtTime(0.001, t+0.07);
    o.connect(oe); oe.connect(gDrum); o.start(t); o.stop(t+0.08);
  }

  // ── HI-HAT ───────────────────────────────────────────────────────────────
  function hat(t, open, accent) {
    if (!ctx) return;
    const dur = open ? 0.21 : 0.032;
    const vol = accent ? (open?0.28:0.16) : (open?0.19:0.10);
    const ns = ctx.createBufferSource(); ns.buffer = NB();
    const hf = ctx.createBiquadFilter(); hf.type='highpass'; hf.frequency.value = open ? 8000 : 11000;
    const hp = ctx.createBiquadFilter(); hp.type='peaking'; hp.frequency.value=14000; hp.gain.value=4;
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(vol, t); eg.gain.exponentialRampToValueAtTime(0.001, t+dur);
    ns.connect(hf); hf.connect(hp); hp.connect(eg); eg.connect(gDrum);
    ns.start(t); ns.stop(t+dur+0.01);
  }

  // ── BASS ─────────────────────────────────────────────────────────────────
  // Driven square bass — fat, distorted, punchy
  function bassNote(t, freq, dur, vel=1) {
    if (!ctx) return;
    // Main square voice → clip → lowpass
    const o = ctx.createOscillator(); o.type='square'; o.frequency.value=freq;
    const clip = mkClip(80);
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=3.5;
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.exponentialRampToValueAtTime(600+freq*0.5, t+0.035);
    lp.frequency.exponentialRampToValueAtTime(380, t+dur*0.5);
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0, t);
    eg.gain.linearRampToValueAtTime(0.7*vel, t+0.008);
    eg.gain.setValueAtTime(0.5*vel, t+dur*0.6);
    eg.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(clip); clip.connect(lp); lp.connect(eg); eg.connect(gBass);
    o.start(t); o.stop(t+dur+0.02);

    // Sub sine — the low end weight
    const sub = ctx.createOscillator(); sub.type='sine'; sub.frequency.value=freq*0.5;
    const se = ctx.createGain();
    se.gain.setValueAtTime(0.55*vel, t); se.gain.exponentialRampToValueAtTime(0.001, t+dur*0.92);
    sub.connect(se); se.connect(gBass); sub.start(t); sub.stop(t+dur+0.02);
  }

  // ── ARP ──────────────────────────────────────────────────────────────────
  // THE Tron arpeggiator — detuned dual saws + high-resonance filter sweep
  function arpNote(t, freq, vel=1) {
    if (!ctx) return;
    // Two detuned sawtooths — the stereo width of the Tron arp
    [-8, 5].forEach((det, i) => {
      const o = ctx.createOscillator(); o.type = i===0 ? 'sawtooth' : 'sawtooth';
      o.frequency.value = freq; o.detune.value = det;
      const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=7;
      lp.frequency.setValueAtTime(80, t);
      lp.frequency.exponentialRampToValueAtTime(5500, t+0.022);
      lp.frequency.exponentialRampToValueAtTime(650, t+S16*0.72);
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0, t);
      eg.gain.linearRampToValueAtTime(0.38*vel, t+0.005);
      eg.gain.exponentialRampToValueAtTime(0.001, t+S16*0.82);
      o.connect(lp); lp.connect(eg); eg.connect(gArp);
      o.start(t); o.stop(t+S16+0.01);
    });
    // Sub octave square — adds weight to the arp on strong beats
    if (vel > 0.8) {
      const sub = ctx.createOscillator(); sub.type='square'; sub.frequency.value=freq*0.5;
      const slf = ctx.createBiquadFilter(); slf.type='lowpass'; slf.frequency.value=300;
      const se = ctx.createGain();
      se.gain.setValueAtTime(0.12, t); se.gain.exponentialRampToValueAtTime(0.001, t+S16*0.5);
      sub.connect(slf); slf.connect(se); se.connect(gArp);
      sub.start(t); sub.stop(t+S16*0.55);
    }
  }

  // ── STAB ─────────────────────────────────────────────────────────────────
  // Power chord stabs — classic 80s action / Bloodsport
  function stab(t, root) {
    if (!ctx) return;
    [1, 1.5, 2].forEach((mult, i) => {   // root, 5th, octave
      const o = ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=root*mult;
      const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=2;
      lp.frequency.setValueAtTime(200, t);
      lp.frequency.exponentialRampToValueAtTime(3500, t+0.018);
      lp.frequency.exponentialRampToValueAtTime(800, t+0.14);
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0, t);
      eg.gain.linearRampToValueAtTime(0.35/(i+1), t+0.01);
      eg.gain.exponentialRampToValueAtTime(0.001, t+0.18);
      o.connect(lp); lp.connect(eg); eg.connect(gStab); eg.connect(revSend);
      o.start(t); o.stop(t+0.2);
    });
  }

  // ── LEAD ─────────────────────────────────────────────────────────────────
  // Portamento sawtooth lead — cinematic, sings over the top
  let _leadLastFreq = A3;
  function leadNote(t, freq, dur, vel=1) {
    if (!ctx) return;
    const o = ctx.createOscillator(); o.type='sawtooth';
    // Portamento from last note
    o.frequency.setValueAtTime(_leadLastFreq, t);
    o.frequency.exponentialRampToValueAtTime(freq, t+Math.min(0.06, dur*0.3));
    _leadLastFreq = freq;
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=2.5;
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.exponentialRampToValueAtTime(3800, t+0.05);
    lp.frequency.exponentialRampToValueAtTime(1400, t+dur*0.7);
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0, t);
    eg.gain.linearRampToValueAtTime(0.55*vel, t+0.025);
    eg.gain.setValueAtTime(0.42*vel, t+dur*0.55);
    eg.gain.exponentialRampToValueAtTime(0.001, t+dur);
    o.connect(lp); lp.connect(eg); eg.connect(gLead); eg.connect(revSend);
    o.start(t); o.stop(t+dur+0.02);
    // Detuned unison for width
    const o2 = ctx.createOscillator(); o2.type='sawtooth'; o2.frequency.value=freq; o2.detune.value=12;
    const e2 = ctx.createGain();
    e2.gain.setValueAtTime(0.18*vel, t); e2.gain.exponentialRampToValueAtTime(0.001, t+dur*0.8);
    const lp2 = ctx.createBiquadFilter(); lp2.type='lowpass'; lp2.frequency.value=2000;
    o2.connect(lp2); lp2.connect(e2); e2.connect(gLead);
    o2.start(t); o2.stop(t+dur+0.02);
  }

  // ── PAD ───────────────────────────────────────────────────────────────────
  // Huge detuned pad — slow attack, massive reverb, lush
  const PAD_CHORDS = [
    [A2,E3,A3,C4,E4],  // Am
    [A2,E3,G3,B3,E4],  // Am7
    [D3,A3,D4,F4,A4],  // Dm
    [E3,B3,E4,G4,B4],  // Em
    [F3,C4,F4,A4,C5],  // F
    [G3,D4,G4,B4,D5],  // G
  ];
  let _padIdx=0, _padNodes=[], _padTimer=null;

  function startPad() {
    stopPad();
    if (!ctx) return;
    const chord = PAD_CHORDS[_padIdx];
    _padNodes = [];
    chord.forEach((freq, ci) => {
      // 4 oscillators per note — different detune amounts for huge width
      [-12, -4, 4, 11].forEach(det => {
        if (!ctx) return;
        const o = ctx.createOscillator();
        o.type = ci % 2 === 0 ? 'sawtooth' : 'triangle';
        o.frequency.value = freq;
        o.detune.value = det + (Math.random()-0.5)*3;
        const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=700+(ci*80);
        const eg = ctx.createGain();
        eg.gain.setValueAtTime(0, ctx.currentTime);
        eg.gain.linearRampToValueAtTime(0.038, ctx.currentTime+5); // very slow attack
        o.connect(lp); lp.connect(eg); eg.connect(gPad); eg.connect(revSend);
        o.start();
        _padNodes.push({osc:o, eg});
      });
    });
    // Chord change every 8–12 bars
    const secs = S16 * 32 * (8 + ~~(Math.random()*4));
    _padTimer = setTimeout(() => {
      if (!ctx) return;
      _padIdx = (_padIdx+1) % PAD_CHORDS.length;
      startPad();
    }, secs * 1000);
  }

  function stopPad() {
    if (_padTimer) { clearTimeout(_padTimer); _padTimer = null; }
    _padNodes.forEach(n => {
      if (!n) return;
      try { n.eg.gain.setTargetAtTime(0, ctx.currentTime, 1.0); n.osc.stop(ctx.currentTime+4); } catch(e) {}
    });
    _padNodes = [];
  }

  // ── SEQUENCES (32 steps = 2 bars) ────────────────────────────────────────

  // Am7 arp — up-down sweep, accent on beats 1&3
  const ARP_NOTES = [A3,C4,E4,G4, A4,G4,E4,C4, A3,E4,C4,A4, G4,E4,C4,A3,
                     A3,C4,E4,G4, A4,B4,A4,G4, E4,D4,C4,B3, A3,G3,A3,C4];
  const ARP_VEL   = [1, .7,.7,.8, .9,.7,.7,.7, 1, .7,.7,.9, .7,.7,.7,.7,
                     1, .7,.7,.8, .9,.8,.7,.7, .8,.7,.7,.7, 1, .7,.8,.7];

  // Bass — syncopated driving Am7 line
  const BASS_C = [
    [A2,4,.9],null,null,null, [C3,1.5,.7],null,[E3,2,.8],null,
    [G3,2,.8],null,[E3,1.5,.7],null, [C3,1.5,.7],null,[A2,2,.8],null,
    [A2,4,.9],null,null,null, [E3,1.5,.8],null,[G3,2,.8],null,
    [A3,2,.9],null,[G3,1.5,.7],null, [E3,3,.8],null,null,null,
  ];
  const BASS_A = [  // ambient — breathing bass
    [A2,7,.7],null,null,null, null,null,null,null,
    [C3,5,.65],null,null,null, null,null,null,null,
    [A2,7,.7],null,null,null, null,null,null,null,
    [E3,5,.65],null,null,null, [C3,3,.6],null,null,null,
  ];

  // Stab positions (combat bar 2 only) — off-beat power chords
  const STAB_NOTES = [null,null,null,null,null,null,A2,null, null,null,null,null,null,null,F3,null,
                      null,null,null,null,null,null,G3,null, null,null,null,null,null,null,E3,null];

  // Lead melody — heroic Am pentatonic phrase across both bars
  const LEAD_COMBAT = [
    null,null,null,null, [A3,2,.8],null,[C4,1.5,.7],null,
    [E4,3,.9],null,null,null, [D4,1.5,.7],null,[C4,1.5,.7],null,
    [A3,2,.8],null,null,null, [E4,2,.85],null,[G4,2,.9],null,
    [A4,4,1],null,null,null, null,null,null,null,
  ];
  // Ambient lead — sparse, atmospheric
  const LEAD_AMB = [
    null,null,null,null, null,null,null,null,
    null,null,null,null, null,null,null,null,
    null,null,null,null, [A3,6,.5],null,null,null,
    null,null,null,null, [E3,5,.45],null,null,null,
  ];

  // ── STEP SCHEDULER ───────────────────────────────────────────────────────
  function sched(s, t) {
    const i = s % 32;

    if (_mode === 'combat') {
      // ── DRUMS ──
      if (i%8===0) kick(t);
      if (i===8||i===24) snare(t);
      // 16th hats with accents on 8th notes
      if (i%2===0) hat(t, false, i%4===0);
      // Open hat on off-beats of 2 and 4
      if (i===12||i===28) hat(t, true, true);
      // Occasional 32nd hat roll into snare
      if ((i===7||i===23) && Math.random()>0.55) hat(t, false, false);

      // ── ARP ──
      arpNote(t, ARP_NOTES[i], ARP_VEL[i]);

      // ── BASS ──
      const bn = BASS_C[i];
      if (bn) bassNote(t, bn[0], bn[1]*S16*0.9, bn[2]);

      // ── STABS ──
      const sn = STAB_NOTES[i];
      if (sn) stab(t, sn);

      // ── LEAD ──
      const ln = LEAD_COMBAT[i];
      if (ln) leadNote(t, ln[0], ln[1]*S16*0.92, ln[2]);

    } else if (_mode === 'ambient') {
      // Sparse hi-hat on 1 and 3
      if (i===0||i===16) hat(t, false, true);
      // Very occasional ghost hat
      if ((i===8||i===24) && Math.random()>0.7) hat(t, false, false);
      // Arp: every 4 steps, slightly random, quieter
      if (i%4===0) arpNote(t, ARP_NOTES[i], ARP_VEL[i]*0.5);
      const bn = BASS_A[i];
      if (bn) bassNote(t, bn[0], bn[1]*S16*0.88, bn[2]*0.75);
      const la = LEAD_AMB[i];
      if (la) leadNote(t, la[0], la[1]*S16*0.9, la[2]);

    } else { // stealth
      if (i===0&&Math.random()>0.5) hat(t, false, false);
      if (i===0) bassNote(t, A2, S16*8*0.9, 0.45);
      if (i===16) bassNote(t, E3, S16*5*0.9, 0.38);
    }
  }

  // ── GAIN SMOOTHING ────────────────────────────────────────────────────────
  function smooth() {
    const R = 0.05;
    [['drum',gDrum],['arp',gArp],['bass',gBass],['lead',gLead],['pad',gPad],['stab',gStab]].forEach(([k,g])=>{
      if (!g) return;
      G[k].c += (G[k].t - G[k].c) * R;
      g.gain.value = Math.max(0, G[k].c);
    });
  }

  function targets(drum,arp,bass,lead,pad,stab) {
    G.drum.t=drum; G.arp.t=arp; G.bass.t=bass;
    G.lead.t=lead; G.pad.t=pad; G.stab.t=stab;
  }

  // ── MAIN POLL ─────────────────────────────────────────────────────────────
  function poll() {
    if (!ctx) return;
    while (_nextT < ctx.currentTime + AHEAD) {
      sched(_step, _nextT);
      _nextT += S16; _step++;
    }
    smooth();
  }

  // ── INIT ─────────────────────────────────────────────────────────────────
  function init() {
    if (ctx) { try { ctx.close(); } catch(e) {} }
    _nbuf = null; _leadLastFreq = A3;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Master chain: master gain → compressor → destination
    comp   = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8;
    comp.ratio.value = 4;       comp.attack.value = 0.003;
    comp.release.value = 0.18;
    comp.connect(ctx.destination);

    master = ctx.createGain(); master.gain.value = 0.88;
    master.connect(comp);

    // Reverbs
    revBig  = mkRev(2.5, 2.0); revBig.connect(master);
    revGate = mkGateRev();     revGate.connect(master);
    revSend  = ctx.createGain(); revSend.gain.value = 0.30; revSend.connect(revBig);
    gateSend = ctx.createGain(); gateSend.gain.value = 0.55; gateSend.connect(revGate);

    // Layer gain nodes
    gDrum = ctx.createGain(); gDrum.connect(master);
    gArp  = ctx.createGain(); gArp.connect(master);
    gBass = ctx.createGain(); gBass.connect(master);
    gLead = ctx.createGain(); gLead.connect(master);
    gPad  = ctx.createGain(); gPad.connect(master);
    gStab = ctx.createGain(); gStab.connect(master);
    Object.values(G).forEach(g => { g.c=0; g.t=0; });
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────────
  function start() {
    init();
    if (ctx.state === 'suspended') ctx.resume();
    _step = 0; _nextT = ctx.currentTime + 0.05;
    if (_sched) clearInterval(_sched);
    _sched = setInterval(poll, POLL);
    _mode = 'ambient';
    targets(0, 0.12, 0.22, 0.14, 0.28, 0);
    startPad();
  }

  function stop() {
    if (_sched) { clearInterval(_sched); _sched = null; }
    stopPad();
    if (!ctx) return;
    try { master.gain.setTargetAtTime(0, ctx.currentTime, 0.35); } catch(e) {}
    const _c = ctx; ctx = null; _nbuf = null;
    setTimeout(() => { try { _c.close(); } catch(e) {} }, 1500);
  }

  let _cTimer = null;
  function setCombat(on) {
    if (_cTimer) { clearTimeout(_cTimer); _cTimer = null; }
    if (on) {
      _mode = 'combat';
      targets(0.75, 0.60, 0.58, 0.50, 0.14, 0.55);
    } else {
      _cTimer = setTimeout(() => {
        if (_mode==='combat') { _mode='ambient'; targets(0, 0.12, 0.22, 0.14, 0.28, 0); }
      }, S16*8*1000);
    }
  }

  function setStealth(on) {
    if (on && _mode!=='combat') { _mode='stealth'; targets(0, 0, 0.10, 0, 0.10, 0); }
    else if (!on && _mode==='stealth') { _mode='ambient'; targets(0, 0.12, 0.22, 0.14, 0.28, 0); }
  }

  return { start, stop, setCombat, setStealth };
})();

window._musicStart   = () => _MUS.start();
window._musicStop    = () => _MUS.stop();
window._musicCombat  = on => _MUS.setCombat(on);
window._musicStealth = on => _MUS.setStealth(on);
