// ── HUNTER KILLER — BLADE RUNNER / TRON THE GRID MUSIC ENGINE ──────────────
// Vangelis / Daft Punk aesthetic. Pure Web Audio API.
//
// window._musicStart()        start on game launch
// window._musicStop()         stop on abort / game over
// window._musicCombat(bool)   true = combat, false = back to ambient
// window._musicStealth(bool)  true = stealth, false = back to ambient

const _MUS = (() => {
  const BPM  = 96;                // Vangelis/Daft Punk tempo — cinematic weight
  const S16  = 60 / BPM / 4;     // 16th note in seconds (~0.127s)
  const S8   = S16 * 2;
  const S4   = S16 * 4;
  const AHEAD = 0.15;
  const POLL  = 16;

  // ── NOTES ────────────────────────────────────────────────────────────────
  const A1=55,   D2=73.4,  A2=110,  C3=130.8, D3=146.8, E3=164.8,
        F3=174.6,G3=196,   A3=220,  B3=246.9, C4=261.6, D4=293.7,
        E4=329.6,F4=349.2, G4=392,  A4=440,   B4=493.9, C5=523.3,
        D5=587.3,E5=659.3, F5=698.5,A5=880;

  // ── STATE ────────────────────────────────────────────────────────────────
  let ctx, master, comp, revBig, revHall, revGate, revSend, hallSend, gateSend;
  let gDrum, gArp, gBass, gLead, gPad, gStab, gDrone;
  let _step=0, _nextT=0, _sched=null;
  let _mode='ambient';
  let _smoothR=0.06;
  const G = {};
  const LAYERS = ['drum','arp','bass','lead','pad','stab','drone'];
  LAYERS.forEach(k => G[k]={c:0,t:0});

  // ── REVERB HELPERS ────────────────────────────────────────────────────────
  function mkRev(dur, decay, pre=0) {
    const n = ctx.sampleRate*(dur+pre);
    const b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c=0;c<2;c++) {
      const d=b.getChannelData(c);
      const pn=~~(ctx.sampleRate*pre);
      for (let i=0;i<n;i++) {
        if(i<pn) d[i]=0;
        else d[i]=(Math.random()*2-1)*Math.pow(1-(i-pn)/(n-pn),decay);
      }
    }
    const cv=ctx.createConvolver(); cv.buffer=b; return cv;
  }
  function mkGateRev() {  // gated reverb: quick build → hard gate
    const n=~~(ctx.sampleRate*0.55);
    const b=ctx.createBuffer(2,n,ctx.sampleRate);
    for(let c=0;c<2;c++){
      const d=b.getChannelData(c);
      for(let i=0;i<n;i++){
        const ramp = i<n*0.12 ? i/(n*0.12) : Math.max(0,1-(i-n*0.12)/(n*0.08));
        d[i]=(Math.random()*2-1)*ramp;
      }
    }
    const cv=ctx.createConvolver(); cv.buffer=b; return cv;
  }

  // ── NOISE BUFFER ─────────────────────────────────────────────────────────
  let _nb=null;
  function NB(){
    if(_nb&&_nb._c===ctx) return _nb;
    const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
    const d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    b._c=ctx; _nb=b; return b;
  }

  // ── WAVESHAPER ────────────────────────────────────────────────────────────
  function mkClip(amt){
    const ws=ctx.createWaveShaper(), n=512, c=new Float32Array(n);
    for(let i=0;i<n;i++){const x=i*2/n-1; c[i]=(Math.PI+amt)*x/(Math.PI+amt*Math.abs(x));}
    ws.curve=c; return ws;
  }

  // ── SOFT TRON PULSE — ambient heartbeat ──────────────────────────────────
  function pulse(t){
    if(!ctx) return;
    const o=ctx.createOscillator(), e=ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(80,t);
    o.frequency.exponentialRampToValueAtTime(38,t+0.18);
    e.gain.setValueAtTime(0,t);
    e.gain.linearRampToValueAtTime(0.55,t+0.004);
    e.gain.exponentialRampToValueAtTime(0.001,t+0.55);
    o.connect(e); e.connect(gDrum); o.start(t); o.stop(t+0.6);
    // Subtle high-freq shimmer on the pulse
    const o2=ctx.createOscillator(), e2=ctx.createGain();
    o2.type='sine'; o2.frequency.value=2400;
    e2.gain.setValueAtTime(0.018,t); e2.gain.exponentialRampToValueAtTime(0.001,t+0.06);
    o2.connect(e2); e2.connect(gDrum); o2.start(t); o2.stop(t+0.08);
  }

  // ── KICK ─────────────────────────────────────────────────────────────────
  // Industrial sub kick — massive, chest-felt
  function kick(t){
    if(!ctx) return;
    // Main sub sweep
    const o=ctx.createOscillator(), e=ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(240,t);
    o.frequency.exponentialRampToValueAtTime(32,t+0.10);
    e.gain.setValueAtTime(0,t);
    e.gain.linearRampToValueAtTime(1.8,t+0.003);
    e.gain.exponentialRampToValueAtTime(0.001,t+0.60);
    o.connect(e); e.connect(gDrum); o.start(t); o.stop(t+0.65);
    // Mid punch
    const o2=ctx.createOscillator(), e2=ctx.createGain();
    o2.type='triangle'; o2.frequency.setValueAtTime(180,t);
    o2.frequency.exponentialRampToValueAtTime(55,t+0.05);
    e2.gain.setValueAtTime(0.95,t); e2.gain.exponentialRampToValueAtTime(0.001,t+0.14);
    o2.connect(e2); e2.connect(gDrum); o2.start(t); o2.stop(t+0.16);
    // Transient click
    const ns=ctx.createBufferSource();
    const nc=ctx.createBuffer(1,~~(ctx.sampleRate*0.008),ctx.sampleRate);
    const nd=nc.getChannelData(0); for(let i=0;i<nd.length;i++) nd[i]=(Math.random()*2-1)*(1-i/nd.length);
    ns.buffer=nc;
    const nf=ctx.createBiquadFilter(); nf.type='lowpass'; nf.frequency.value=1600;
    const ne=ctx.createGain(); ne.gain.setValueAtTime(0.7,t); ne.gain.exponentialRampToValueAtTime(0.001,t+0.008);
    ns.connect(nf); nf.connect(ne); ne.connect(gDrum); ns.start(t); ns.stop(t+0.01);
    // Side-chain pump (the Tron pumping effect)
    if(gPad){ gPad.gain.cancelScheduledValues(t); gPad.gain.setValueAtTime(G.pad.c*0.12,t); gPad.gain.setTargetAtTime(G.pad.t,t+0.05,0.08); }
    if(gArp){ gArp.gain.cancelScheduledValues(t); gArp.gain.setValueAtTime(G.arp.c*0.50,t); gArp.gain.setTargetAtTime(G.arp.t,t+0.03,0.05); }
    if(gDrone){ gDrone.gain.cancelScheduledValues(t); gDrone.gain.setValueAtTime(G.drone.c*0.30,t); gDrone.gain.setTargetAtTime(G.drone.t,t+0.06,0.10); }
  }

  // ── SNARE ────────────────────────────────────────────────────────────────
  function snare(t){
    if(!ctx) return;
    const ns=ctx.createBufferSource(); ns.buffer=NB();
    const bf=ctx.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value=2800; bf.Q.value=1.5;
    const eg=ctx.createGain(); eg.gain.setValueAtTime(1.0,t); eg.gain.exponentialRampToValueAtTime(0.001,t+0.22);
    ns.connect(bf); bf.connect(eg);
    eg.connect(gDrum); eg.connect(gateSend);
    ns.start(t); ns.stop(t+0.25);
    const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=210;
    const oe=ctx.createGain(); oe.gain.setValueAtTime(0.5,t); oe.gain.exponentialRampToValueAtTime(0.001,t+0.07);
    o.connect(oe); oe.connect(gDrum); o.start(t); o.stop(t+0.09);
  }

  // ── HI-HAT ────────────────────────────────────────────────────────────────
  function hat(t,open,vel=0.12){
    if(!ctx) return;
    const dur=open?0.20:0.030;
    const ns=ctx.createBufferSource(); ns.buffer=NB();
    const hf=ctx.createBiquadFilter(); hf.type='highpass'; hf.frequency.value=open?8200:10800;
    const eg=ctx.createGain(); eg.gain.setValueAtTime(vel,t); eg.gain.exponentialRampToValueAtTime(0.001,t+dur);
    ns.connect(hf); hf.connect(eg); eg.connect(gDrum);
    ns.start(t); ns.stop(t+dur+0.01);
  }

  // ── BASS ─────────────────────────────────────────────────────────────────
  // Driven square, resonant — Tron Grid bassline character
  function bassNote(t,freq,dur,vel=1){
    if(!ctx) return;
    const o=ctx.createOscillator(); o.type='square'; o.frequency.value=freq;
    const clip=mkClip(60);
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=4;
    lp.frequency.setValueAtTime(180,t); lp.frequency.exponentialRampToValueAtTime(550+freq*0.4,t+0.04);
    lp.frequency.exponentialRampToValueAtTime(320,t+dur*0.55);
    const eg=ctx.createGain();
    eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(0.75*vel,t+0.009);
    eg.gain.setValueAtTime(0.52*vel,t+dur*0.6); eg.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(clip); clip.connect(lp); lp.connect(eg); eg.connect(gBass);
    o.start(t); o.stop(t+dur+0.02);
    const sub=ctx.createOscillator(); sub.type='sine'; sub.frequency.value=freq*0.5;
    const se=ctx.createGain(); se.gain.setValueAtTime(0.5*vel,t); se.gain.exponentialRampToValueAtTime(0.001,t+dur*0.9);
    sub.connect(se); se.connect(gBass); sub.start(t); sub.stop(t+dur+0.02);
  }

  // ── ARP ──────────────────────────────────────────────────────────────────
  // Blade Runner / Tron — deliberate detuned saws, high-resonance filter
  function arpNote(t,freq,vel=1){
    if(!ctx) return;
    [-10,6].forEach(det=>{
      const o=ctx.createOscillator(); o.type='sawtooth';
      o.frequency.value=freq; o.detune.value=det;
      const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=8;
      lp.frequency.setValueAtTime(60,t);
      lp.frequency.exponentialRampToValueAtTime(5800,t+0.020);
      lp.frequency.exponentialRampToValueAtTime(500,t+S16*0.78);
      const eg=ctx.createGain();
      eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(0.35*vel,t+0.005);
      eg.gain.exponentialRampToValueAtTime(0.001,t+S16*0.85);
      o.connect(lp); lp.connect(eg); eg.connect(gArp);
      o.start(t); o.stop(t+S16+0.01);
    });
  }

  // ── LEAD — saxophone-like (Blade Runner) ─────────────────────────────────
  // Square wave through bandpass with vibrato — like a synth sax
  let _lastLead=A3;
  function leadNote(t,freq,dur,vel=1){
    if(!ctx) return;
    const o=ctx.createOscillator(); o.type='square';
    o.frequency.setValueAtTime(_lastLead,t);
    o.frequency.exponentialRampToValueAtTime(freq,t+Math.min(0.08,dur*0.25));
    _lastLead=freq;
    // Bandpass for sax body
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=800; bp.Q.value=1.8;
    // Second LP for smoothing
    const lp=ctx.createBiquadFilter(); lp.type='lowpass';
    lp.frequency.setValueAtTime(800,t); lp.frequency.exponentialRampToValueAtTime(2800,t+0.06);
    lp.frequency.exponentialRampToValueAtTime(1200,t+dur*0.6);
    const eg=ctx.createGain();
    eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(0.58*vel,t+0.035);
    eg.gain.setValueAtTime(0.44*vel,t+dur*0.5); eg.gain.exponentialRampToValueAtTime(0.001,t+dur);
    // Vibrato LFO — starts after attack
    const lfo=ctx.createOscillator(); lfo.type='sine'; lfo.frequency.value=5.2;
    const lg=ctx.createGain(); lg.gain.value=0;
    lg.gain.setValueAtTime(0,t+0.12); lg.gain.linearRampToValueAtTime(10,t+0.25);
    lfo.connect(lg); lg.connect(o.detune);
    o.connect(bp); bp.connect(lp); lp.connect(eg); eg.connect(gLead); eg.connect(hallSend);
    o.start(t); o.stop(t+dur+0.02);
    lfo.start(t); lfo.stop(t+dur+0.02);
    // Harmonic overtone (breathy quality)
    const o2=ctx.createOscillator(); o2.type='sine'; o2.frequency.value=freq*2;
    const e2=ctx.createGain(); e2.gain.setValueAtTime(0.08*vel,t); e2.gain.exponentialRampToValueAtTime(0.001,t+dur*0.7);
    o2.connect(e2); e2.connect(gLead); o2.start(t); o2.stop(t+dur+0.02);
  }

  // ── STABS ────────────────────────────────────────────────────────────────
  function stab(t,root){
    if(!ctx) return;
    [1,1.498,2,2.997].forEach((m,i)=>{
      const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=root*m;
      const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=2;
      lp.frequency.setValueAtTime(200,t); lp.frequency.exponentialRampToValueAtTime(3800,t+0.016);
      lp.frequency.exponentialRampToValueAtTime(700,t+0.16);
      const eg=ctx.createGain();
      eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(0.32/(i+1),t+0.01);
      eg.gain.exponentialRampToValueAtTime(0.001,t+0.20);
      o.connect(lp); lp.connect(eg); eg.connect(gStab); eg.connect(revSend);
      o.start(t); o.stop(t+0.22);
    });
  }

  // ── DRONE (Blade Runner deep atmospheric) ────────────────────────────────
  let _droneNodes=[], _droneTimer=null;
  const DRONE_CHORDS=[
    [A1,A2,E3],[A1,A2,D3],[A1,C3,G3],[A1,E3,A3]
  ];
  let _droneIdx=0;

  function startDrone(){
    stopDrone(); if(!ctx) return;
    const ch=DRONE_CHORDS[_droneIdx];
    _droneNodes=[];
    ch.forEach((freq,ci)=>{
      // Multiple slow-beating oscillators for shimmer
      [0,0.3,-0.2,0.8].forEach(det=>{
        if(!ctx) return;
        const o=ctx.createOscillator();
        o.type=ci===0?'sine':'sawtooth'; o.frequency.value=freq; o.detune.value=det*100;
        const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=ci===0?200:480;
        const eg=ctx.createGain();
        eg.gain.setValueAtTime(0,ctx.currentTime);
        eg.gain.linearRampToValueAtTime(ci===0?0.06:0.022,ctx.currentTime+6);
        o.connect(lp); lp.connect(eg); eg.connect(gDrone); eg.connect(hallSend);
        o.start(); _droneNodes.push({osc:o,eg});
      });
    });
    const secs=S16*64*(4+~~(Math.random()*4));
    _droneTimer=setTimeout(()=>{if(!ctx)return; _droneIdx=(_droneIdx+1)%DRONE_CHORDS.length; startDrone();},secs*1000);
  }
  function stopDrone(){
    if(_droneTimer){clearTimeout(_droneTimer);_droneTimer=null;}
    _droneNodes.forEach(n=>{
      if(!n) return;
      try{n.eg.gain.setTargetAtTime(0,ctx.currentTime,1.5); n.osc.stop(ctx.currentTime+5);}catch(e){}
    });
    _droneNodes=[];
  }

  // ── PAD ───────────────────────────────────────────────────────────────────
  const PAD_CHORDS=[
    [A2,E3,A3,C4,E4],   // Am
    [A2,D3,A3,D4,F4],   // Dm
    [F3,A3,C4,F4,A4],   // F maj
    [E3,B3,E4,G4,B4],   // Em
  ];
  let _padIdx=0,_padNodes=[],_padTimer=null;
  function startPad(){
    stopPad(); if(!ctx) return;
    const ch=PAD_CHORDS[_padIdx]; _padNodes=[];
    ch.forEach((freq,ci)=>{
      [-15,-5,5,14].forEach(det=>{
        if(!ctx) return;
        const o=ctx.createOscillator();
        o.type=ci%2===0?'sawtooth':'triangle';
        o.frequency.value=freq; o.detune.value=det+(Math.random()-0.5)*4;
        const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=650+(ci*60);
        const eg=ctx.createGain();
        eg.gain.setValueAtTime(0,ctx.currentTime);
        eg.gain.linearRampToValueAtTime(0.032,ctx.currentTime+6);
        o.connect(lp); lp.connect(eg); eg.connect(gPad); eg.connect(revSend);
        o.start(); _padNodes.push({osc:o,eg});
      });
    });
    const secs=S16*32*(8+~~(Math.random()*4));
    _padTimer=setTimeout(()=>{if(!ctx) return; _padIdx=(_padIdx+1)%PAD_CHORDS.length; startPad();},secs*1000);
  }
  function stopPad(){
    if(_padTimer){clearTimeout(_padTimer);_padTimer=null;}
    _padNodes.forEach(n=>{
      if(!n) return;
      try{n.eg.gain.setTargetAtTime(0,ctx.currentTime,1.2); n.osc.stop(ctx.currentTime+4);}catch(e){}
    });
    _padNodes=[];
  }

  // ── BLADE RUNNER RAIN texture ─────────────────────────────────────────────
  // Occasional very high sparse arp notes — the Vangelis shimmer
  let _rainTimer=null;
  function rainDrop(){
    if(!ctx||_mode==='combat') return;
    const RAIN=[A4,C5,E5,G4,A5,F5,D5];
    const freq=RAIN[~~(Math.random()*RAIN.length)];
    arpNote(ctx.currentTime+0.01, freq, 0.08);
    const next=2000+Math.random()*4000;
    _rainTimer=setTimeout(rainDrop, next);
  }
  function startRain(){ if(_rainTimer) clearTimeout(_rainTimer); rainDrop(); }
  function stopRain(){ if(_rainTimer){clearTimeout(_rainTimer);_rainTimer=null;} }

  // ── SEQUENCES ─────────────────────────────────────────────────────────────

  // Am arpeggio — slower, more deliberate. Every 8th note in ambient, every 16th in combat
  const ARP_NOTES=[A3,C4,E4,G4, A4,G4,E4,C4, A3,E4,C4,G4, A4,G4,E4,A3,
                   A3,C4,E4,G4, A4,B4,A4,G4, E4,D4,C4,B3, A3,G3,A3,C4];
  const ARP_VEL  =[1,.7,.7,.8,  .9,.7,.7,.7, 1,.7,.7,.9,  .8,.7,.7,.7,
                   1,.7,.7,.8,  .9,.8,.7,.7,  .8,.7,.7,.7, 1,.7,.8,.7];

  // Tron / Blade Runner bassline — Am walking line
  const BASS_C=[
    [A2,3.5,.9],null,null,null,  [C3,1.5,.75],null,[E3,2,.8],null,
    [G3,2,.85],null,[E3,1.5,.7],null,  [D3,1.5,.75],null,[A2,2,.8],null,
    [A2,3.5,.9],null,null,null,  [E3,1.5,.8],null,[G3,2,.85],null,
    [A3,2,.9],null,[G3,1.5,.7],null,  [E3,4,.85],null,null,null,
  ];
  const BASS_A=[
    [A2,8,.7],null,null,null,  null,null,null,null,
    [D3,6,.65],null,null,null, null,null,null,null,
    [A2,8,.7],null,null,null,  null,null,null,null,
    [E3,5,.65],null,null,null, [C3,3,.6],null,null,null,
  ];

  // Stab pattern (combat only — bar 2 off-beats)
  const STAB_PAT=[null,null,null,null,null,null,A2,null, null,null,null,null,null,null,F3,null,
                  null,null,null,null,null,null,G3,null,  null,null,null,null,null,null,E3,null];

  // Lead melody — emotional, sax-like, Blade Runner style
  // Plays across both bars in combat
  const LEAD_C=[
    null,null,null,null, [A3,S4*.9,.75],null,null,null,
    [C4,S16*3*.9,.8],null,null,null, [E4,S16*2*.9,.7],null,[D4,S16*2*.9,.65],null,
    [C4,S4*.9,.75],null,null,null, [E4,S16*3*.9,.85],null,null,null,
    [A4,S8*.9,.9],null,[G4,S16*3*.9,.8],null, [A4,S4*.9,1],null,null,null,
  ];
  // Ambient lead — just occasional long notes
  const LEAD_A=[
    null,null,null,null, null,null,null,null, null,null,null,null, null,null,null,null,
    null,null,null,null, [A3,S16*7*.9,.45],null,null,null, null,null,null,null, [E3,S16*5*.9,.4],null,null,null,
  ];

  // ── SCHEDULER ─────────────────────────────────────────────────────────────
  function schedStep(s,t){
    const i=s%32;
    if(_mode==='combat'){
      if(i%8===0) kick(t);
      if(i===8||i===24) snare(t);
      // 16th hats, accented on 8th notes
      if(i%2===0) hat(t,false, i%4===0?0.16:0.09);
      if(i===12||i===28) hat(t,true,0.22);
      if((i===7||i===23)&&Math.random()>.6) hat(t,false,0.07);
      // Arp — every step in combat
      arpNote(t,ARP_NOTES[i],ARP_VEL[i]);
      // Bass
      const bn=BASS_C[i]; if(bn) bassNote(t,bn[0],bn[1]*S16*.92,bn[2]);
      // Stabs
      const sn=STAB_PAT[i]; if(sn) stab(t,sn);
      // Lead
      const ln=LEAD_C[i]; if(ln) leadNote(t,ln[0],ln[1],ln[2]);

    }else if(_mode==='ambient'){
      // Soft Tron pulse on every beat — no melodic arp in ambient
      if(i%4===0) pulse(t);
      const bn=BASS_A[i]; if(bn) bassNote(t,bn[0],bn[1]*S16*.88,bn[2]*0.7);
      const la=LEAD_A[i]; if(la) leadNote(t,la[0],la[1],la[2]);

    }else{ // stealth
      if(i===0) bassNote(t,A2,S16*8*.9,0.4);
      if(i===16) bassNote(t,E3,S16*5*.9,0.35);
    }
  }

  // ── GAIN SMOOTHING ─────────────────────────────────────────────────────────
  function smooth(){
    const R=_smoothR;
    [['drum',gDrum],['arp',gArp],['bass',gBass],['lead',gLead],['pad',gPad],['stab',gStab],['drone',gDrone]].forEach(([k,g])=>{
      if(!g) return;
      G[k].c+=(G[k].t-G[k].c)*R;
      g.gain.value=Math.max(0,G[k].c);
    });
  }
  function tgt(drum,arp,bass,lead,pad,stab,drone){
    G.drum.t=drum; G.arp.t=arp; G.bass.t=bass; G.lead.t=lead;
    G.pad.t=pad;   G.stab.t=stab; G.drone.t=drone;
  }

  // ── MAIN POLL ──────────────────────────────────────────────────────────────
  function poll(){
    if(!ctx) return;
    while(_nextT<ctx.currentTime+AHEAD){ schedStep(_step,_nextT); _nextT+=S16; _step++; }
    smooth();
  }

  // ── INIT ───────────────────────────────────────────────────────────────────
  function init(){
    if(ctx){try{ctx.close();}catch(e){}}
    _nb=null; _lastLead=A3;
    ctx=new(window.AudioContext||window.webkitAudioContext)();

    comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-14; comp.knee.value=8; comp.ratio.value=5;
    comp.attack.value=0.003; comp.release.value=0.15;
    comp.connect(ctx.destination);

    master=ctx.createGain(); master.gain.value=0.85; master.connect(comp);

    // Three reverbs: big hall, smaller hall, gated
    revBig =mkRev(3.5,1.8,0.02); revBig.connect(master);
    revHall=mkRev(1.8,2.2,0);    revHall.connect(master);
    revGate=mkGateRev();          revGate.connect(master);
    revSend =ctx.createGain(); revSend.gain.value=0.28;  revSend.connect(revBig);
    hallSend=ctx.createGain(); hallSend.gain.value=0.35; hallSend.connect(revHall);
    gateSend=ctx.createGain(); gateSend.gain.value=0.60; gateSend.connect(revGate);

    gDrum =ctx.createGain(); gDrum.connect(master);
    gArp  =ctx.createGain(); gArp.connect(master);
    gBass =ctx.createGain(); gBass.connect(master);
    gLead =ctx.createGain(); gLead.connect(master);
    gPad  =ctx.createGain(); gPad.connect(master);
    gStab =ctx.createGain(); gStab.connect(master);
    gDrone=ctx.createGain(); gDrone.connect(master);
    LAYERS.forEach(k=>{G[k].c=0;G[k].t=0;});
  }

  // ── PUBLIC ─────────────────────────────────────────────────────────────────
  function start(){
    init();
    if(ctx.state==='suspended') ctx.resume();
    _step=0; _nextT=ctx.currentTime+0.05;
    if(_sched) clearInterval(_sched);
    _sched=setInterval(poll,POLL);
    _mode='ambient';
    tgt(0.28, 0.08, 0.18, 0.12, 0.25, 0, 0.22);
    startPad(); startDrone(); startRain();
  }

  function stop(){
    if(_sched){clearInterval(_sched);_sched=null;}
    if(_rampReset){clearTimeout(_rampReset);_rampReset=null;}
    _smoothR=0.06;
    stopPad(); stopDrone(); stopRain();
    if(!ctx) return;
    try{master.gain.setTargetAtTime(0,ctx.currentTime,0.35);}catch(e){}
    const _c=ctx; ctx=null; _nb=null;
    setTimeout(()=>{try{_c.close();}catch(e){}},1500);
  }

  let _ct=null, _rampReset=null;
  function setCombat(on){
    if(_ct){clearTimeout(_ct);_ct=null;}
    if(_rampReset){clearTimeout(_rampReset);_rampReset=null;}
    if(on){
      stopRain();
      _mode='combat';
      // Fast smooth rate for punchy onset, restore after 1.5s
      _smoothR=0.18;
      _rampReset=setTimeout(()=>{_smoothR=0.06;},1500);
      // Hard immediate gain jump — feels like hitting a wall
      G.drum.c=0.58; G.arp.c=0.45; G.bass.c=0.38; G.stab.c=0.30;
      tgt(0.82, 0.68, 0.62, 0.54, 0.10, 0.62, 0.06);
      // Immediate percussion impact on combat start
      if(ctx){
        const now=ctx.currentTime+0.01;
        kick(now);
        kick(now+S16*2);
        stab(now+S16*0.5, A2);
      }
    }else{
      _ct=setTimeout(()=>{
        if(_mode==='combat'){
          _mode='ambient';
          tgt(0.28, 0.08, 0.18, 0.12, 0.25, 0, 0.22);
          startRain();
        }
      }, S16*8*1000);
    }
  }

  function setStealth(on){
    if(on&&_mode!=='combat'){ stopRain(); _mode='stealth'; tgt(0,0,0.10,0,0.08,0,0.06); }
    else if(!on&&_mode==='stealth'){ _mode='ambient'; tgt(0.28,0.08,0.18,0.12,0.25,0,0.22); startRain(); }
  }

  function setVolume(v){ if(master) master.gain.setTargetAtTime(Math.max(0,Math.min(1,v))*0.85,ctx.currentTime,0.3); }

  return{start,stop,setCombat,setStealth,setVolume};
})();

window._musicStart   = ()=>_MUS.start();
window._musicStop    = ()=>_MUS.stop();
window._musicCombat  = on=>_MUS.setCombat(on);
window._musicStealth = on=>_MUS.setStealth(on);
window._musicVolume  = v=>_MUS.setVolume(v);
