// ── HUNTER KILLER — SYNTHWAVE ENGINE ─────────────────────────────────────────
// Four player-selectable tracks. Dark, atmospheric, Tron Legacy.
//
// 0 GRID  — 80s Giorgio Moroder / Tangerine Dream. Slow half-time, warm dark.
// 1 PULSE — Dark modern synthwave. Tight, minimal, sub-heavy.
// 2 VOID  — Dark ambience. No drums. Drone + slow swells. Pure tension.
// 3 DEPTH — Atmospheric. Sub heartbeat. Vast reverberant space.
//
// window._musicStart()        call on game start
// window._musicStop()         call on game over
// window._musicCombat(bool)   combat state
// window._musicStealth(bool)  stealth state
// window._musicTrack(n)       switch track 0-3
// window._musicVolume(v)      master volume 0-1

const _MUS = (() => {
  const BPM   = 100;
  const S16   = 60/BPM/4;   // 0.150 s
  const S8    = S16*2;       // 0.300 s
  const S4    = S16*4;       // 0.600 s
  const S1    = S16*16;      // 2.400 s — one bar
  const AHEAD = 0.15;
  const POLL  = 16;

  // ── NOTES (A minor) ──────────────────────────────────────────────────────
  const A1=55,  B1=61.7,C2=65.4, D2=73.4, E2=82.4, F2=87.3, G2=98,
        A2=110, B2=123.5,C3=130.8,D3=146.8,E3=164.8,F3=174.6,G3=196,
        A3=220, B3=246.9,C4=261.6,D4=293.7,E4=329.6,F4=349.2,G4=392,
        A4=440, B4=493.9,C5=523.3,D5=587.3,E5=659.3;

  // ── STATE ─────────────────────────────────────────────────────────────────
  let ctx, master, comp;
  let revLong, revMed, revShort, revGate;
  let revSend, hallSend, shortSend, gateSend;
  let gDrum, gBass, gArp, gLead, gPad, gDrone;
  let _step=0, _nextT=0, _sched=null;
  let _track=0, _gameMode='normal', _smoothR=0.06;
  let _ct=null, _rampReset=null;
  const G={};
  ['drum','bass','arp','lead','pad','drone'].forEach(k=>G[k]={c:0,t:0});

  // Track base gains: [drum, bass, arp, lead, pad, drone]
  const TG=[
    [0.28, 0.58, 0.32, 0.14, 0.30, 0.22],  // 0 GRID
    [0.40, 0.62, 0.42, 0.10, 0.24, 0.18],  // 1 PULSE
    [0,    0.10, 0,    0.10, 0.38, 0.32],  // 2 VOID
    [0.10, 0.18, 0,    0.08, 0.30, 0.38],  // 3 DEPTH
  ];

  // ── REVERBS ───────────────────────────────────────────────────────────────
  function mkRev(dur, decay, pre=0){
    const n=ctx.sampleRate*(dur+pre);
    const b=ctx.createBuffer(2,n,ctx.sampleRate);
    for(let c=0;c<2;c++){
      const d=b.getChannelData(c), pn=~~(ctx.sampleRate*pre);
      for(let i=0;i<n;i++)
        d[i]=i<pn?0:(Math.random()*2-1)*Math.pow(1-(i-pn)/(n-pn),decay);
    }
    const cv=ctx.createConvolver(); cv.buffer=b; return cv;
  }
  function mkGateRev(){
    const n=~~(ctx.sampleRate*0.55);
    const b=ctx.createBuffer(2,n,ctx.sampleRate);
    for(let c=0;c<2;c++){
      const d=b.getChannelData(c);
      for(let i=0;i<n;i++){
        const r=i<n*0.15?i/(n*0.15):Math.max(0,1-(i-n*0.15)/(n*0.08));
        d[i]=(Math.random()*2-1)*r;
      }
    }
    const cv=ctx.createConvolver(); cv.buffer=b; return cv;
  }

  // ── NOISE / CLIP ──────────────────────────────────────────────────────────
  let _nb=null;
  function NB(){
    if(_nb&&_nb._ctx===ctx) return _nb;
    const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
    const d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    b._ctx=ctx; _nb=b; return b;
  }
  function mkClip(amt){
    const ws=ctx.createWaveShaper(),n=512,c=new Float32Array(n);
    for(let i=0;i<n;i++){const x=i*2/n-1;c[i]=(Math.PI+amt)*x/(Math.PI+amt*Math.abs(x));}
    ws.curve=c; return ws;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DRUMS
  // ══════════════════════════════════════════════════════════════════════════

  // Deep sub kick — long tail, low sweep
  function kick(t, vel=1){
    if(!ctx) return;
    const o1=ctx.createOscillator(), e1=ctx.createGain();
    o1.type='sine';
    o1.frequency.setValueAtTime(180,t);
    o1.frequency.exponentialRampToValueAtTime(34,t+0.14);
    e1.gain.setValueAtTime(0,t);
    e1.gain.linearRampToValueAtTime(1.8*vel,t+0.003);
    e1.gain.exponentialRampToValueAtTime(0.001,t+0.85);
    o1.connect(e1); e1.connect(gDrum); o1.start(t); o1.stop(t+0.9);

    const o2=ctx.createOscillator(), e2=ctx.createGain();
    o2.type='triangle'; o2.frequency.setValueAtTime(120,t);
    o2.frequency.exponentialRampToValueAtTime(48,t+0.07);
    e2.gain.setValueAtTime(0.7*vel,t); e2.gain.exponentialRampToValueAtTime(0.001,t+0.18);
    o2.connect(e2); e2.connect(gDrum); o2.start(t); o2.stop(t+0.2);

    // sidechain pump on pad
    if(gPad){gPad.gain.cancelScheduledValues(t);gPad.gain.setValueAtTime(G.pad.c*0.06,t);gPad.gain.setTargetAtTime(G.pad.t,t+0.05,0.12);}
    if(gArp){gArp.gain.cancelScheduledValues(t);gArp.gain.setValueAtTime(G.arp.c*0.30,t);gArp.gain.setTargetAtTime(G.arp.t,t+0.03,0.06);}
  }

  // Depth-track sub pulse — ultra-low heartbeat thud
  function subPulse(t){
    if(!ctx) return;
    const o=ctx.createOscillator(), e=ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(60,t);
    o.frequency.exponentialRampToValueAtTime(28,t+0.22);
    e.gain.setValueAtTime(0,t);
    e.gain.linearRampToValueAtTime(1.2,t+0.005);
    e.gain.exponentialRampToValueAtTime(0.001,t+1.1);
    o.connect(e); e.connect(gDrum); o.start(t); o.stop(t+1.2);
  }

  function snare(t, vel=1){
    if(!ctx) return;
    const ns=ctx.createBufferSource(); ns.buffer=NB();
    const bf=ctx.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value=2600; bf.Q.value=1.4;
    const eg=ctx.createGain(); eg.gain.setValueAtTime(0.75*vel,t); eg.gain.exponentialRampToValueAtTime(0.001,t+0.20);
    ns.connect(bf); bf.connect(eg); eg.connect(gDrum); eg.connect(gateSend);
    ns.start(t); ns.stop(t+0.22);
    const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=190;
    const oe=ctx.createGain(); oe.gain.setValueAtTime(0.30*vel,t); oe.gain.exponentialRampToValueAtTime(0.001,t+0.06);
    o.connect(oe); oe.connect(gDrum); o.start(t); o.stop(t+0.08);
  }

  function hat(t, open=false, vel=0.07){
    if(!ctx) return;
    const dur=open?0.16:0.022;
    const ns=ctx.createBufferSource(); ns.buffer=NB();
    const hf=ctx.createBiquadFilter(); hf.type='highpass'; hf.frequency.value=open?8800:11000;
    const eg=ctx.createGain(); eg.gain.setValueAtTime(vel,t); eg.gain.exponentialRampToValueAtTime(0.001,t+dur);
    ns.connect(hf); hf.connect(eg); eg.connect(gDrum);
    ns.start(t); ns.stop(t+dur+0.01);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BASS
  // ══════════════════════════════════════════════════════════════════════════

  // Dark resonant bassline — kept below 600 Hz, Moroder-style
  function bassNote(t, freq, dur, vel=1){
    if(!ctx) return;
    const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=freq;
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=6;
    lp.frequency.setValueAtTime(60,t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(600,freq*3.5),t+0.025);
    lp.frequency.exponentialRampToValueAtTime(freq*1.2,t+dur*0.5);
    const eg=ctx.createGain();
    eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(0.88*vel,t+0.006);
    eg.gain.setValueAtTime(0.65*vel,t+dur*0.55); eg.gain.exponentialRampToValueAtTime(0.001,t+dur);
    const sub=ctx.createOscillator(); sub.type='sine'; sub.frequency.value=freq*0.5;
    const se=ctx.createGain(); se.gain.setValueAtTime(0.60*vel,t); se.gain.exponentialRampToValueAtTime(0.001,t+dur*0.9);
    o.connect(lp); lp.connect(eg); eg.connect(gBass);
    sub.connect(se); se.connect(gBass);
    o.start(t); o.stop(t+dur+0.02); sub.start(t); sub.stop(t+dur+0.02);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ARP — dark, kept below 1400 Hz. NOT bright dance music.
  // ══════════════════════════════════════════════════════════════════════════

  function arpNote(t, freq, dur, vel=1){
    if(!ctx) return;
    [-6,5].forEach(det=>{
      const o=ctx.createOscillator(); o.type='sawtooth';
      o.frequency.value=freq; o.detune.value=det;
      const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=5;
      // Dark filter — max 1400 Hz, not 4000 Hz
      lp.frequency.setValueAtTime(60,t);
      lp.frequency.exponentialRampToValueAtTime(1400,t+0.018);
      lp.frequency.exponentialRampToValueAtTime(320,t+dur*0.7);
      const eg=ctx.createGain();
      eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(0.22*vel,t+0.005);
      eg.gain.exponentialRampToValueAtTime(0.001,t+dur*0.9);
      o.connect(lp); lp.connect(eg); eg.connect(gArp); eg.connect(shortSend);
      o.start(t); o.stop(t+dur+0.01);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LEAD — sparse, emotional. Triangle wave, heavy reverb.
  // ══════════════════════════════════════════════════════════════════════════

  let _lastLead=A3;
  function leadNote(t, freq, dur, vel=1){
    if(!ctx) return;
    const o=ctx.createOscillator(); o.type='triangle';
    o.frequency.setValueAtTime(_lastLead,t);
    o.frequency.exponentialRampToValueAtTime(freq,t+Math.min(0.05,dur*0.15));
    _lastLead=freq;
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1800;
    const eg=ctx.createGain();
    eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(0.45*vel,t+0.016);
    eg.gain.setValueAtTime(0.32*vel,t+dur*0.4); eg.gain.exponentialRampToValueAtTime(0.001,t+dur);
    const lfo=ctx.createOscillator(); lfo.frequency.value=4.8;
    const lg=ctx.createGain(); lg.gain.setValueAtTime(0,t+0.12); lg.gain.linearRampToValueAtTime(7,t+0.3);
    lfo.connect(lg); lg.connect(o.detune);
    o.connect(lp); lp.connect(eg); eg.connect(gLead); eg.connect(hallSend);
    o.start(t); o.stop(t+dur+0.02); lfo.start(t); lfo.stop(t+dur+0.02);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAD — lush detuned chords. The emotional core.
  // ══════════════════════════════════════════════════════════════════════════

  const PAD_CHORDS=[
    [A2,E3,A3,C4,E4],   // Am
    [F2,C3,F3,A3,C4],   // F
    [G2,D3,G3,B3,D4],   // Gm
    [E2,B2,E3,G3,B3],   // Em
  ];
  let _padIdx=0, _padNodes=[], _padTimer=null;

  function startPad(){
    stopPad(); if(!ctx) return;
    const ch=PAD_CHORDS[_padIdx]; _padNodes=[];
    ch.forEach((freq,ci)=>{
      // VOID and DEPTH get more voices for thickness
      const dets=(_track>=2)?[-22,-10,0,10,20]:[-16,-5,6,16];
      dets.forEach(det=>{
        if(!ctx) return;
        const o=ctx.createOscillator();
        o.type=ci%2===0?'sawtooth':'triangle';
        o.frequency.value=freq; o.detune.value=det+(Math.random()-0.5)*4;
        const lp=ctx.createBiquadFilter(); lp.type='lowpass';
        lp.frequency.value=_track>=2?550+(ci*60):650+(ci*70);
        const eg=ctx.createGain(); eg.gain.setValueAtTime(0,ctx.currentTime);
        eg.gain.linearRampToValueAtTime(0.020,ctx.currentTime+6);
        o.connect(lp); lp.connect(eg); eg.connect(gPad); eg.connect(revSend);
        o.start(); _padNodes.push({osc:o,eg});
      });
    });
    const bars=8+~~(Math.random()*8);
    _padTimer=setTimeout(()=>{
      if(!ctx) return;
      _padIdx=(_padIdx+1)%PAD_CHORDS.length;
      startPad();
    }, bars*S1*1000);
  }

  function stopPad(){
    if(_padTimer){clearTimeout(_padTimer);_padTimer=null;}
    _padNodes.forEach(n=>{try{n.eg.gain.setTargetAtTime(0,ctx.currentTime,1.2);n.osc.stop(ctx.currentTime+4);}catch(e){}});
    _padNodes=[];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DRONE — deep atmospheric bed
  // ══════════════════════════════════════════════════════════════════════════

  const DRONE_CHORDS=[[A1,A2,E3],[A1,D2,A2],[A1,G2,D3],[A1,E2,B2]];
  let _droneIdx=0, _droneNodes=[], _droneTimer=null;

  function startDrone(){
    stopDrone(); if(!ctx) return;
    const ch=DRONE_CHORDS[_droneIdx]; _droneNodes=[];
    ch.forEach((freq,ci)=>{
      [0,0.5,-0.4,1.2].forEach(det=>{
        if(!ctx) return;
        const o=ctx.createOscillator();
        o.type=ci===0?'sine':'sawtooth'; o.frequency.value=freq; o.detune.value=det*100;
        const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=ci===0?170:380;
        const eg=ctx.createGain(); eg.gain.setValueAtTime(0,ctx.currentTime);
        eg.gain.linearRampToValueAtTime(ci===0?0.10:0.030,ctx.currentTime+9);
        o.connect(lp); lp.connect(eg); eg.connect(gDrone); eg.connect(revSend);
        o.start(); _droneNodes.push({osc:o,eg});
      });
    });
    const secs=(16+~~(Math.random()*16))*S4;
    _droneTimer=setTimeout(()=>{if(!ctx)return;_droneIdx=(_droneIdx+1)%DRONE_CHORDS.length;startDrone();},secs*1000);
  }

  function stopDrone(){
    if(_droneTimer){clearTimeout(_droneTimer);_droneTimer=null;}
    _droneNodes.forEach(n=>{try{n.eg.gain.setTargetAtTime(0,ctx.currentTime,2.5);n.osc.stop(ctx.currentTime+9);}catch(e){}});
    _droneNodes=[];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TENSION SWELL — slow detuned pad rise (VOID track + stealth)
  // ══════════════════════════════════════════════════════════════════════════

  let _swellTimer=null;
  function swell(){
    if(!ctx) return;
    const now=ctx.currentTime;
    [A2,E3,A3].forEach((freq,i)=>{
      [-14,-4,9].forEach(det=>{
        if(!ctx) return;
        const o=ctx.createOscillator(); o.type='sawtooth';
        o.frequency.value=freq; o.detune.value=det;
        const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=180+(i*60);
        const eg=ctx.createGain();
        eg.gain.setValueAtTime(0,now);
        eg.gain.linearRampToValueAtTime(0.040/(i+1),now+3.0);
        eg.gain.linearRampToValueAtTime(0,now+6.0);
        o.connect(lp); lp.connect(eg);
        eg.connect(master); eg.connect(revSend);
        o.start(now); o.stop(now+6.5);
      });
    });
    const interval=(_track===2)?7000+Math.random()*4000:10000+Math.random()*5000;
    _swellTimer=setTimeout(swell, interval);
  }
  function stopSwell(){if(_swellTimer){clearTimeout(_swellTimer);_swellTimer=null;}}

  // ══════════════════════════════════════════════════════════════════════════
  // SEQUENCES
  // ══════════════════════════════════════════════════════════════════════════

  // GRID bass — slow Moroder-style sequence. Long held notes.
  const BASS_GRID=[
    [A2,S1*.92,.88],null,null,null, null,null,null,null,
    [G2,S8*.9,.72],null,null,null,  [E2,S8*.8,.68],null,null,null,
    [A2,S1*.88,.85],null,null,null, null,null,null,null,
    [D2,S4*.9,.75],null,null,null,  [E2,S4*.85,.72],null,null,null,
  ];

  // PULSE bass — tighter, 8th-note-ish
  const BASS_PULSE=[
    [A2,S8*.9,.90],null,null,null,  [A2,S16*.8,.65],null,[G2,S8*.8,.70],null,
    [A2,S8*.85,.82],null,null,null, [E2,S16*.7,.60],null,[A2,S8*.8,.72],null,
    [A2,S8*.88,.88],null,null,null, [A2,S16*.75,.62],null,[G2,S8*.75,.68],null,
    [E2,S8*.9,.85],null,null,null,  [D2,S16*.8,.65],null,[E2,S8*.8,.70],null,
  ];

  // GRID arp — quarter notes, very dark (low freq notes, low filter)
  const ARP_GRID=[A2,E3,A3,E3, A2,G2,A2,E3, A2,E3,A3,G3, A2,E3,D3,A2];
  const ARP_GRID_V=[1,.8,.75,.7, .9,.7,.85,.75, 1,.8,.75,.8, .9,.75,.7,.85];

  // PULSE arp — 8th notes, mid-range but still dark
  const ARP_PULSE=[A3,E4,A3,C4, E4,A3,G3,A3, A3,E4,C4,A3, G3,A3,E4,C4];
  const ARP_PULSE_V=[1,.8,.85,.75, .9,.75,.8,.85, 1,.8,.78,.82, .75,.85,.88,.80];

  // Lead melody (sparse — GRID and VOID have slightly different content)
  const LEAD_SPARSE=[  // two bars, long notes only
    null,null,null,null, null,null,null,null,
    null,null,null,null, null,null,null,null,
    [A3,S4*2.0,.42],null,null,null, null,null,null,null,
    [E3,S4*1.6,.46],null,null,null, [A3,S4*1.8,.50],null,null,null,
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // SCHEDULER
  // ══════════════════════════════════════════════════════════════════════════

  function schedStep(s, t){
    const i=s%32;

    if(_track===0){
      // ── GRID: slow half-time 80s. One kick per bar. ───────────────────────
      // Kick on beat 1 of each bar only
      if(i===0||i===16) kick(t,0.95);
      // Snare on beat 3 (delayed snare — very 80s)
      if(i===8||i===24) snare(t,0.82);
      // Very sparse ghost hats
      if(i===4||i===12||i===20||i===28) hat(t,false,0.055);
      if(i===14||i===30) hat(t,true,0.09);
      // Moroder-style sequenced arp (quarter notes = every 4 steps)
      if(i%4===0) arpNote(t,ARP_GRID[(i/4)%16],S4*0.85,ARP_GRID_V[(i/4)%16]);
      // Slow bass
      const bg=BASS_GRID[i]; if(bg) bassNote(t,bg[0],bg[1],bg[2]);
      // Sparse lead
      const lg=LEAD_SPARSE[i]; if(lg) leadNote(t,lg[0],lg[1],lg[2]);

    }else if(_track===1){
      // ── PULSE: 4-on-floor, tight, dark. ──────────────────────────────────
      if(i%4===0) kick(t,1.0);
      if(i===4||i===12||i===20||i===28) snare(t,0.90);
      if(i%2===0) hat(t,false,i%4===0?0.10:0.055);
      if(i===14||i===30) hat(t,true,0.13);
      // 8th-note dark arp
      if(i%2===0) arpNote(t,ARP_PULSE[(i/2)%16],S8*0.82,ARP_PULSE_V[(i/2)%16]);
      const bp=BASS_PULSE[i]; if(bp) bassNote(t,bp[0],bp[1],bp[2]);
      // Very sparse lead — only occasional
      if(i===20) leadNote(t,A3,S4*1.4,0.35);
      if(i===28) leadNote(t,E3,S4*1.2,0.32);

    }else if(_track===2){
      // ── VOID: no drums. Silence, drones, swells handle everything. ────────
      // Occasional very soft bass breath
      if(i===0)  bassNote(t,A2,S4*3.8,0.28);
      if(i===16) bassNote(t,E2,S4*3.2,0.24);
      // Sparse emotional lead
      const lv=LEAD_SPARSE[i]; if(lv) leadNote(t,lv[0],lv[1],lv[2]*0.85);

    }else{
      // ── DEPTH: sub-heartbeat. Very sparse. Vast. ─────────────────────────
      // Sub pulse every 2 bars (every 32 steps = step 0 only)
      if(i===0) subPulse(t);
      // Minimal bass breath — once every bar
      if(i===0)  bassNote(t,A1,S4*3.6,0.32);
      if(i===16) bassNote(t,A1,S4*3.2,0.28);
      // One long lead note per loop
      if(i===24) leadNote(t,A3,S4*3.0,0.30);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GAIN SMOOTHING
  // ══════════════════════════════════════════════════════════════════════════

  function smooth(){
    const R=_smoothR;
    [['drum',gDrum],['bass',gBass],['arp',gArp],['lead',gLead],
     ['pad',gPad],['drone',gDrone]].forEach(([k,g])=>{
      if(!g) return;
      G[k].c+=(G[k].t-G[k].c)*R;
      g.gain.value=Math.max(0,G[k].c);
    });
  }

  function tgt(drum,bass,arp,lead,pad,drone){
    G.drum.t=drum; G.bass.t=bass; G.arp.t=arp; G.lead.t=lead;
    G.pad.t=pad;   G.drone.t=drone;
  }

  function applyTrackGains(){
    const g=TG[_track]; tgt(g[0],g[1],g[2],g[3],g[4],g[5]);
  }

  function poll(){
    if(!ctx) return;
    while(_nextT<ctx.currentTime+AHEAD){schedStep(_step,_nextT);_nextT+=S16;_step++;}
    smooth();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════════════════════

  function init(){
    if(ctx){try{ctx.close();}catch(e){}}
    _nb=null; _lastLead=A3;
    ctx=new(window.AudioContext||window.webkitAudioContext)();

    comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-12; comp.knee.value=8; comp.ratio.value=4;
    comp.attack.value=0.003; comp.release.value=0.14;
    comp.connect(ctx.destination);
    master=ctx.createGain(); master.gain.value=0.82; master.connect(comp);

    revLong =mkRev(4.5,1.5,0.025); revLong.connect(master);
    revMed  =mkRev(2.0,1.9,0);     revMed.connect(master);
    revShort=mkRev(0.7,2.4,0);     revShort.connect(master);
    revGate =mkGateRev();           revGate.connect(master);
    revSend  =ctx.createGain(); revSend.gain.value=0.22;  revSend.connect(revLong);
    hallSend =ctx.createGain(); hallSend.gain.value=0.40; hallSend.connect(revMed);
    shortSend=ctx.createGain(); shortSend.gain.value=0.14;shortSend.connect(revShort);
    gateSend =ctx.createGain(); gateSend.gain.value=0.55; gateSend.connect(revGate);

    gDrum =ctx.createGain(); gDrum.connect(master);
    gBass =ctx.createGain(); gBass.connect(master);
    gArp  =ctx.createGain(); gArp.connect(master);
    gLead =ctx.createGain(); gLead.connect(master);
    gPad  =ctx.createGain(); gPad.connect(master);
    gDrone=ctx.createGain(); gDrone.connect(master);
    Object.keys(G).forEach(k=>{G[k].c=0;G[k].t=0;});
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  function start(){
    init();
    if(ctx.state==='suspended') ctx.resume();
    _step=0; _nextT=ctx.currentTime+0.05; _gameMode='normal';
    if(_sched) clearInterval(_sched);
    _sched=setInterval(poll,POLL);
    applyTrackGains();
    startPad(); startDrone();
    if(_track===2) { stopSwell(); swell(); }
  }

  function stop(){
    if(_sched){clearInterval(_sched);_sched=null;}
    if(_rampReset){clearTimeout(_rampReset);_rampReset=null;}
    if(_ct){clearTimeout(_ct);_ct=null;}
    _smoothR=0.06;
    stopPad(); stopDrone(); stopSwell();
    if(!ctx) return;
    try{master.gain.setTargetAtTime(0,ctx.currentTime,0.3);}catch(e){}
    const _c=ctx; ctx=null; _nb=null;
    setTimeout(()=>{try{_c.close();}catch(e){}},1500);
  }

  function setTrack(n){
    if(!ctx) return;
    _track=((n%4)+4)%4;
    _step=0;
    stopSwell();
    stopPad(); startPad();   // restart pad with new voice count
    _gameMode='normal';
    applyTrackGains();
    if(_track===2) swell();  // start swells for VOID
  }

  function setCombat(on){
    if(_ct){clearTimeout(_ct);_ct=null;}
    if(_rampReset){clearTimeout(_rampReset);_rampReset=null;}
    if(on){
      stopSwell(); _gameMode='combat';
      _smoothR=0.20;
      _rampReset=setTimeout(()=>{_smoothR=0.06;},1500);
      G.drum.c=Math.max(G.drum.c,0.50);
      G.bass.c=Math.max(G.bass.c,0.40);
      // Combat boosts drums and bass hard, drops pad
      tgt(0.85, 0.72, TG[_track][2]*1.3, TG[_track][3], 0.08, 0.06);
      if(ctx){
        const now=ctx.currentTime+0.01;
        kick(now,1); kick(now+S16*4,1);
      }
    }else{
      _ct=setTimeout(()=>{
        if(_gameMode==='combat'){ _gameMode='normal'; applyTrackGains(); }
      }, S16*8*1000);
    }
  }

  function setStealth(on){
    if(on&&_gameMode!=='combat'){
      _gameMode='stealth';
      tgt(0, TG[_track][1]*0.4, 0, 0, TG[_track][4]*0.5, TG[_track][5]*1.2);
      stopSwell(); swell();
    }else if(!on&&_gameMode==='stealth'){
      stopSwell();
      if(_track===2) swell();
      _gameMode='normal'; applyTrackGains();
    }
  }

  function setVolume(v){
    if(master) master.gain.setTargetAtTime(Math.max(0,Math.min(1,v))*0.82,ctx.currentTime,0.3);
  }

  return{start,stop,setTrack,setCombat,setStealth,setVolume};
})();

window._musicStart   = ()=>_MUS.start();
window._musicStop    = ()=>_MUS.stop();
window._musicTrack   = n=>_MUS.setTrack(n);
window._musicCombat  = on=>_MUS.setCombat(on);
window._musicStealth = on=>_MUS.setStealth(on);
window._musicVolume  = v=>_MUS.setVolume(v);
