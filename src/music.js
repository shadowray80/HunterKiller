// ── HUNTER KILLER — SYNTHWAVE ENGINE ─────────────────────────────────────────
// ambient → Bike (Tron Legacy) — driving pulse, resonant arps
// stealth → Outlands (Tron Legacy) — tension drones, no drums, slow swells
// combat  → age (Anthony Rother / Popkiller) — hard mechanical techno
// Son of Flynn emotional pads run underneath everything

const _MUS = (() => {
  const BPM  = 100;
  const S16  = 60/BPM/4;   // 0.150s
  const S8   = S16*2;       // 0.300s
  const S4   = S16*4;       // 0.600s
  const S1   = S16*16;      // 2.400s  (one bar)
  const AHEAD = 0.15;
  const POLL  = 16;

  // ── NOTES ────────────────────────────────────────────────────────────────
  const A1=55,  B1=61.7, C2=65.4, D2=73.4, E2=82.4, F2=87.3, G2=98,
        A2=110, B2=123.5,C3=130.8,D3=146.8,E3=164.8,F3=174.6,G3=196,
        A3=220, B3=246.9,C4=261.6,D4=293.7,E4=329.6,F4=349.2,G4=392,
        A4=440, B4=493.9,C5=523.3,D5=587.3,E5=659.3,G5=784;

  // ── STATE ─────────────────────────────────────────────────────────────────
  let ctx, master, comp;
  let revLong, revMed, revShort, revGate;
  let revSend, hallSend, shortSend, gateSend;
  let gDrum, gBass, gArp, gLead, gPad, gStab, gDrone;
  let _step=0, _nextT=0, _sched=null;
  let _mode='ambient', _smoothR=0.06;
  let _ct=null, _rampReset=null;
  const G={};
  ['drum','bass','arp','lead','pad','stab','drone'].forEach(k=>G[k]={c:0,t:0});

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
    const n=~~(ctx.sampleRate*0.5);
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
    const ws=ctx.createWaveShaper(), n=512, c=new Float32Array(n);
    for(let i=0;i<n;i++){const x=i*2/n-1; c[i]=(Math.PI+amt)*x/(Math.PI+amt*Math.abs(x));}
    ws.curve=c; return ws;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DRUMS
  // ══════════════════════════════════════════════════════════════════════════

  function kick(t, vel=1){
    if(!ctx) return;
    const o1=ctx.createOscillator(), e1=ctx.createGain();
    o1.type='sine';
    o1.frequency.setValueAtTime(200,t);
    o1.frequency.exponentialRampToValueAtTime(36,t+0.12);
    e1.gain.setValueAtTime(0,t);
    e1.gain.linearRampToValueAtTime(1.7*vel,t+0.003);
    e1.gain.exponentialRampToValueAtTime(0.001,t+0.75);
    o1.connect(e1); e1.connect(gDrum); o1.start(t); o1.stop(t+0.8);

    const o2=ctx.createOscillator(), e2=ctx.createGain();
    o2.type='triangle'; o2.frequency.setValueAtTime(160,t);
    o2.frequency.exponentialRampToValueAtTime(50,t+0.06);
    e2.gain.setValueAtTime(0.9*vel,t); e2.gain.exponentialRampToValueAtTime(0.001,t+0.15);
    o2.connect(e2); e2.connect(gDrum); o2.start(t); o2.stop(t+0.17);

    const nc=ctx.createBuffer(1,~~(ctx.sampleRate*0.006),ctx.sampleRate);
    const nd=nc.getChannelData(0); for(let i=0;i<nd.length;i++) nd[i]=(Math.random()*2-1)*(1-i/nd.length);
    const ns=ctx.createBufferSource(); ns.buffer=nc;
    const nf=ctx.createBiquadFilter(); nf.type='highpass'; nf.frequency.value=1400;
    const ne=ctx.createGain(); ne.gain.setValueAtTime(0.55*vel,t); ne.gain.exponentialRampToValueAtTime(0.001,t+0.006);
    ns.connect(nf); nf.connect(ne); ne.connect(gDrum); ns.start(t); ns.stop(t+0.01);

    // sidechain pump
    if(gPad){gPad.gain.cancelScheduledValues(t);gPad.gain.setValueAtTime(G.pad.c*0.08,t);gPad.gain.setTargetAtTime(G.pad.t,t+0.04,0.10);}
    if(gArp){gArp.gain.cancelScheduledValues(t);gArp.gain.setValueAtTime(G.arp.c*0.35,t);gArp.gain.setTargetAtTime(G.arp.t,t+0.02,0.05);}
  }

  function snare(t, vel=1){
    if(!ctx) return;
    const ns=ctx.createBufferSource(); ns.buffer=NB();
    const bf=ctx.createBiquadFilter(); bf.type='bandpass'; bf.frequency.value=3000; bf.Q.value=1.2;
    const eg=ctx.createGain(); eg.gain.setValueAtTime(0.8*vel,t); eg.gain.exponentialRampToValueAtTime(0.001,t+0.18);
    ns.connect(bf); bf.connect(eg); eg.connect(gDrum); eg.connect(gateSend);
    ns.start(t); ns.stop(t+0.2);
    const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=210;
    const oe=ctx.createGain(); oe.gain.setValueAtTime(0.38*vel,t); oe.gain.exponentialRampToValueAtTime(0.001,t+0.06);
    o.connect(oe); oe.connect(gDrum); o.start(t); o.stop(t+0.08);
  }

  function hat(t, open=false, vel=0.09){
    if(!ctx) return;
    const dur=open?0.18:0.024;
    const ns=ctx.createBufferSource(); ns.buffer=NB();
    const hf=ctx.createBiquadFilter(); hf.type='highpass'; hf.frequency.value=open?9000:11000;
    const eg=ctx.createGain(); eg.gain.setValueAtTime(vel,t); eg.gain.exponentialRampToValueAtTime(0.001,t+dur);
    ns.connect(hf); hf.connect(eg); eg.connect(gDrum);
    ns.start(t); ns.stop(t+dur+0.01);
  }

  // Mechanical hit — Anthony Rother's robotic metallic clicks
  function mechHit(t, freq=440, vel=1){
    if(!ctx) return;
    const o=ctx.createOscillator(); o.type='square'; o.frequency.value=freq;
    const clip=mkClip(80);
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq*1.8; bp.Q.value=5;
    const eg=ctx.createGain(); eg.gain.setValueAtTime(0.45*vel,t); eg.gain.exponentialRampToValueAtTime(0.001,t+0.04);
    o.connect(clip); clip.connect(bp); bp.connect(eg); eg.connect(gDrum);
    o.start(t); o.stop(t+0.05);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BASS
  // ══════════════════════════════════════════════════════════════════════════

  // Synthwave pulse bass — saw + sub, resonant filter pluck
  function bassNote(t, freq, dur, vel=1){
    if(!ctx) return;
    const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=freq;
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=5;
    lp.frequency.setValueAtTime(80,t);
    lp.frequency.exponentialRampToValueAtTime(freq*4.5,t+0.022);
    lp.frequency.exponentialRampToValueAtTime(freq*1.4,t+dur*0.45);
    const eg=ctx.createGain();
    eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(0.92*vel,t+0.005);
    eg.gain.setValueAtTime(0.68*vel,t+dur*0.5); eg.gain.exponentialRampToValueAtTime(0.001,t+dur);
    const sub=ctx.createOscillator(); sub.type='sine'; sub.frequency.value=freq*0.5;
    const se=ctx.createGain(); se.gain.setValueAtTime(0.55*vel,t); se.gain.exponentialRampToValueAtTime(0.001,t+dur*0.9);
    o.connect(lp); lp.connect(eg); eg.connect(gBass);
    sub.connect(se); se.connect(gBass);
    o.start(t); o.stop(t+dur+0.02); sub.start(t); sub.stop(t+dur+0.02);
  }

  // Hard combat bass — clipped square, tight and aggressive
  function combatBass(t, freq, dur, vel=1){
    if(!ctx) return;
    const o=ctx.createOscillator(); o.type='square'; o.frequency.value=freq;
    const clip=mkClip(90);
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=9;
    lp.frequency.setValueAtTime(100,t); lp.frequency.exponentialRampToValueAtTime(freq*3.5,t+0.01);
    lp.frequency.exponentialRampToValueAtTime(freq*1.1,t+0.09);
    const eg=ctx.createGain();
    eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(1.1*vel,t+0.003);
    eg.gain.exponentialRampToValueAtTime(0.001,t+dur);
    const sub=ctx.createOscillator(); sub.type='sine'; sub.frequency.value=freq*0.5;
    const se=ctx.createGain(); se.gain.setValueAtTime(0.42*vel,t); se.gain.exponentialRampToValueAtTime(0.001,t+dur*0.8);
    o.connect(clip); clip.connect(lp); lp.connect(eg); eg.connect(gBass);
    sub.connect(se); se.connect(gBass);
    o.start(t); o.stop(t+dur+0.02); sub.start(t); sub.stop(t+dur+0.02);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ARP
  // ══════════════════════════════════════════════════════════════════════════

  // Synthwave arp — detuned saws through resonant filter (classic Tron sound)
  function arpNote(t, freq, vel=1){
    if(!ctx) return;
    [-8,6].forEach(det=>{
      const o=ctx.createOscillator(); o.type='sawtooth';
      o.frequency.value=freq; o.detune.value=det;
      const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=7;
      lp.frequency.setValueAtTime(80,t);
      lp.frequency.exponentialRampToValueAtTime(4000,t+0.014);
      lp.frequency.exponentialRampToValueAtTime(380,t+S8*0.82);
      const eg=ctx.createGain();
      eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(0.26*vel,t+0.004);
      eg.gain.exponentialRampToValueAtTime(0.001,t+S8*0.92);
      o.connect(lp); lp.connect(eg); eg.connect(gArp); eg.connect(shortSend);
      o.start(t); o.stop(t+S8+0.01);
    });
  }

  // Combat arp — square wave, clipped, angular (Anthony Rother feel)
  function combatArp(t, freq, vel=1){
    if(!ctx) return;
    const o=ctx.createOscillator(); o.type='square'; o.frequency.value=freq;
    const clip=mkClip(50);
    const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=11;
    lp.frequency.setValueAtTime(100,t); lp.frequency.exponentialRampToValueAtTime(4500,t+0.007);
    lp.frequency.exponentialRampToValueAtTime(280,t+S16*0.72);
    const eg=ctx.createGain();
    eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(0.32*vel,t+0.003);
    eg.gain.exponentialRampToValueAtTime(0.001,t+S16*0.78);
    o.connect(clip); clip.connect(lp); lp.connect(eg); eg.connect(gArp);
    o.start(t); o.stop(t+S16+0.01);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LEAD — Son of Flynn: sparse, emotional, piano-ish with vibrato
  // ══════════════════════════════════════════════════════════════════════════

  let _lastLead=A3;
  function leadNote(t, freq, dur, vel=1){
    if(!ctx) return;
    const o=ctx.createOscillator(); o.type='triangle';
    o.frequency.setValueAtTime(_lastLead,t);
    o.frequency.exponentialRampToValueAtTime(freq,t+Math.min(0.04,dur*0.15));
    _lastLead=freq;
    const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq*1.4; bp.Q.value=1.1;
    const eg=ctx.createGain();
    eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(0.52*vel,t+0.014);
    eg.gain.setValueAtTime(0.36*vel,t+dur*0.4); eg.gain.exponentialRampToValueAtTime(0.001,t+dur);
    const lfo=ctx.createOscillator(); lfo.frequency.value=5.2;
    const lg=ctx.createGain(); lg.gain.setValueAtTime(0,t+0.10); lg.gain.linearRampToValueAtTime(8,t+0.28);
    lfo.connect(lg); lg.connect(o.detune);
    o.connect(bp); bp.connect(eg); eg.connect(gLead); eg.connect(hallSend);
    o.start(t); o.stop(t+dur+0.02); lfo.start(t); lfo.stop(t+dur+0.02);
    const o2=ctx.createOscillator(); o2.type='sine'; o2.frequency.value=freq*2;
    const e2=ctx.createGain(); e2.gain.setValueAtTime(0.06*vel,t); e2.gain.exponentialRampToValueAtTime(0.001,t+dur*0.5);
    o2.connect(e2); e2.connect(gLead); o2.start(t); o2.stop(t+dur+0.02);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STAB
  // ══════════════════════════════════════════════════════════════════════════

  function stab(t, root){
    if(!ctx) return;
    [1,1.498,2].forEach((m,i)=>{
      const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=root*m;
      const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=3;
      lp.frequency.setValueAtTime(150,t); lp.frequency.exponentialRampToValueAtTime(4200,t+0.011);
      lp.frequency.exponentialRampToValueAtTime(550,t+0.15);
      const eg=ctx.createGain();
      eg.gain.setValueAtTime(0,t); eg.gain.linearRampToValueAtTime(0.30/(i+1),t+0.008);
      eg.gain.exponentialRampToValueAtTime(0.001,t+0.19);
      o.connect(lp); lp.connect(eg); eg.connect(gStab); eg.connect(revSend);
      o.start(t); o.stop(t+0.21);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAD — Son of Flynn: lush detuned chords, slow attack
  // ══════════════════════════════════════════════════════════════════════════

  const PAD_CHORDS=[
    [A2,E3,A3,C4,E4],   // Am
    [F2,C3,F3,A3,C4],   // F
    [C3,G3,C4,E4,G4],   // C
    [E2,B2,E3,G3,B3],   // Em
  ];
  let _padIdx=0, _padNodes=[], _padTimer=null;

  function startPad(){
    stopPad(); if(!ctx) return;
    const ch=PAD_CHORDS[_padIdx]; _padNodes=[];
    ch.forEach((freq,ci)=>{
      [-18,-7,5,16].forEach(det=>{
        if(!ctx) return;
        const o=ctx.createOscillator();
        o.type=ci%2===0?'sawtooth':'triangle';
        o.frequency.value=freq; o.detune.value=det+(Math.random()-0.5)*3;
        const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=680+(ci*75);
        const eg=ctx.createGain(); eg.gain.setValueAtTime(0,ctx.currentTime);
        eg.gain.linearRampToValueAtTime(0.024,ctx.currentTime+5);
        o.connect(lp); lp.connect(eg); eg.connect(gPad); eg.connect(revSend);
        o.start(); _padNodes.push({osc:o,eg});
      });
    });
    const bars=8+~~(Math.random()*8);
    _padTimer=setTimeout(()=>{if(!ctx)return; _padIdx=(_padIdx+1)%PAD_CHORDS.length; startPad();}, bars*S1*1000);
  }

  function stopPad(){
    if(_padTimer){clearTimeout(_padTimer);_padTimer=null;}
    _padNodes.forEach(n=>{try{n.eg.gain.setTargetAtTime(0,ctx.currentTime,1.0);n.osc.stop(ctx.currentTime+3);}catch(e){}});
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
      [0,0.4,-0.3,1.1].forEach(det=>{
        if(!ctx) return;
        const o=ctx.createOscillator();
        o.type=ci===0?'sine':'sawtooth'; o.frequency.value=freq; o.detune.value=det*100;
        const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=ci===0?180:400;
        const eg=ctx.createGain(); eg.gain.setValueAtTime(0,ctx.currentTime);
        eg.gain.linearRampToValueAtTime(ci===0?0.09:0.028,ctx.currentTime+8);
        o.connect(lp); lp.connect(eg); eg.connect(gDrone); eg.connect(revSend);
        o.start(); _droneNodes.push({osc:o,eg});
      });
    });
    const secs=(16+~~(Math.random()*16))*S4;
    _droneTimer=setTimeout(()=>{if(!ctx)return; _droneIdx=(_droneIdx+1)%DRONE_CHORDS.length; startDrone();}, secs*1000);
  }

  function stopDrone(){
    if(_droneTimer){clearTimeout(_droneTimer);_droneTimer=null;}
    _droneNodes.forEach(n=>{try{n.eg.gain.setTargetAtTime(0,ctx.currentTime,2);n.osc.stop(ctx.currentTime+7);}catch(e){}});
    _droneNodes=[];
  }

  // ══════════════════════════════════════════════════════════════════════════
  // OUTLANDS TENSION SWELL — stealth mode only
  // ══════════════════════════════════════════════════════════════════════════

  let _swellTimer=null;
  function swell(){
    if(!ctx||_mode!=='stealth') return;
    const now=ctx.currentTime;
    [A2,E3,A3].forEach((freq,i)=>{
      [-15,-5,8].forEach(det=>{
        if(!ctx) return;
        const o=ctx.createOscillator(); o.type='sawtooth';
        o.frequency.value=freq; o.detune.value=det;
        const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=220+(i*80);
        const eg=ctx.createGain();
        eg.gain.setValueAtTime(0,now);
        eg.gain.linearRampToValueAtTime(0.038/(i+1),now+2.8);
        eg.gain.linearRampToValueAtTime(0,now+5.5);
        o.connect(lp); lp.connect(eg);
        eg.connect(master); eg.connect(revSend);
        o.start(now); o.stop(now+6);
      });
    });
    _swellTimer=setTimeout(swell, 6500+Math.random()*4000);
  }
  function stopSwell(){if(_swellTimer){clearTimeout(_swellTimer);_swellTimer=null;}}

  // ══════════════════════════════════════════════════════════════════════════
  // SEQUENCES
  // ══════════════════════════════════════════════════════════════════════════

  // Ambient: Bike-inspired Am bassline (32 steps = 2 bars)
  const BASS_AMB=[
    [A2,S4,.92],null,null,null,   null,null,null,null,
    [A2,S8,.78],null,null,null,   [G2,S8*.8,.65],null,null,null,
    [A2,S4,.88],null,null,null,   null,null,null,null,
    [E2,S8,.82],null,null,null,   [D2,S8*.8,.70],null,[E2,S8*.6,.60],null,
  ];

  // Combat: locked tight to the kick
  const BASS_CMB=[
    [A2,S16*.9,.95],null,[A2,S16*.7,.70],null,
    [A2,S16*.9,.90],null,[G2,S16*.7,.70],null,
    [A2,S16*.85,.90],null,[A2,S16*.6,.65],null,
    [E2,S16*.9,.85],null,[D2,S16*.7,.70],null,
    [A2,S16*.9,.90],null,[A2,S16*.7,.70],null,
    [A2,S16*.85,.85],null,[G2,S16*.65,.65],null,
    [A2,S16*.9,.90],null,[E2,S16*.6,.60],null,
    [E2,S16*.85,.85],null,[E2,S16*.6,.65],null,
  ];

  // Ambient arp: 8th-note ascending Am pattern (16 notes, played on even steps)
  const ARP_AMB=[A3,C4,E4,G4, A4,G4,E4,C4, A3,E4,C4,G4, A4,G4,C4,A3];
  const ARP_VEL=[1,.82,.80,.85, .90,.80,.75,.80, 1,.80,.75,.85, .90,.80,.80,.75];

  // Combat arp: angular, every 16th note
  const ARP_CMB=[
    A3,A3,E4,G4, A4,A3,G4,E4, A3,C4,E4,A4, G4,E4,C4,A3,
    A3,E3,E4,G4, A4,A3,A4,E4, A3,C4,G4,A4, E4,G4,A4,A3,
  ];

  // Stab hits (combat, off-beats)
  const STAB_PAT=[
    null,null,null,null, null,null,A2,null,
    null,null,null,null, null,null,E3,null,
    null,null,null,null, null,null,A2,null,
    null,null,null,null, null,null,G3,null,
  ];

  // Lead: Son of Flynn style — sparse, long emotional notes
  const LEAD_AMB=[
    null,null,null,null, null,null,null,null,
    null,null,null,null, null,null,null,null,
    [A3,S4*1.8,.44],null,null,null, null,null,null,null,
    [C4,S4*1.4,.50],null,null,null, [E4,S4*2.0,.54],null,null,null,
  ];
  const LEAD_CMB=[
    null,null,null,null, [A3,S8*.9,.65],null,null,null,
    [C4,S16*3*.9,.70],null,null,null, [E4,S8*.85,.60],null,[D4,S8*.8,.55],null,
    [C4,S8*.9,.65],null,null,null, [E4,S16*3*.9,.75],null,null,null,
    [A4,S4*.9,.80],null,[G4,S16*3*.9,.70],null, [A4,S4*.85,.85],null,null,null,
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // SCHEDULER
  // ══════════════════════════════════════════════════════════════════════════

  function schedStep(s, t){
    const i=s%32;

    if(_mode==='combat'){
      // ── age / Popkiller: hard mechanical techno ───────────────────────────
      if(i%4===0) kick(t,1);
      if(i===4||i===12||i===20||i===28) snare(t,0.92);
      if(i%2===0) hat(t,false,i%4===0?0.13:0.07);
      if(i===14||i===30) hat(t,true,0.17);
      if(i===2||i===10||i===18||i===26) mechHit(t,440,0.72);
      if(i===6||i===22) mechHit(t,330,0.52);
      const bc=BASS_CMB[i]; if(bc) combatBass(t,bc[0],bc[1],bc[2]);
      combatArp(t,ARP_CMB[i],ARP_VEL[i%16]);
      const sn=STAB_PAT[i]; if(sn) stab(t,sn);
      const lc=LEAD_CMB[i]; if(lc) leadNote(t,lc[0],lc[1],lc[2]);

    }else if(_mode==='ambient'){
      // ── Bike: driving synthwave pulse ────────────────────────────────────
      if(i%8===0) kick(t,0.92);
      if(i===4||i===12||i===20||i===28) snare(t,0.76);
      if(i%2===0) hat(t,false,i%8===0?0.10:0.055);
      if(i===14||i===30) hat(t,true,0.12);
      if(i%2===0) arpNote(t,ARP_AMB[(i/2)%16],ARP_VEL[(i/2)%16]*0.82);
      const ba=BASS_AMB[i]; if(ba) bassNote(t,ba[0],ba[1],ba[2]*0.88);
      const la=LEAD_AMB[i]; if(la) leadNote(t,la[0],la[1],la[2]);

    }else{
      // ── Outlands: stealth — breath of bass only, no drums ────────────────
      if(i===0)  bassNote(t,A2,S4*3.5,0.32);
      if(i===16) bassNote(t,E2,S4*3.0,0.28);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GAIN SMOOTHING
  // ══════════════════════════════════════════════════════════════════════════

  function smooth(){
    const R=_smoothR;
    [['drum',gDrum],['bass',gBass],['arp',gArp],['lead',gLead],
     ['pad',gPad],['stab',gStab],['drone',gDrone]].forEach(([k,g])=>{
      if(!g) return;
      G[k].c+=(G[k].t-G[k].c)*R;
      g.gain.value=Math.max(0,G[k].c);
    });
  }

  function tgt(drum,bass,arp,lead,pad,stab,drone){
    G.drum.t=drum; G.bass.t=bass; G.arp.t=arp; G.lead.t=lead;
    G.pad.t=pad;   G.stab.t=stab; G.drone.t=drone;
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
    comp.threshold.value=-12; comp.knee.value=6; comp.ratio.value=4;
    comp.attack.value=0.002; comp.release.value=0.12;
    comp.connect(ctx.destination);
    master=ctx.createGain(); master.gain.value=0.85; master.connect(comp);

    revLong =mkRev(4.0,1.6,0.02); revLong.connect(master);
    revMed  =mkRev(1.8,2.0,0);    revMed.connect(master);
    revShort=mkRev(0.6,2.5,0);    revShort.connect(master);
    revGate =mkGateRev();          revGate.connect(master);
    revSend  =ctx.createGain(); revSend.gain.value=0.20;  revSend.connect(revLong);
    hallSend =ctx.createGain(); hallSend.gain.value=0.36; hallSend.connect(revMed);
    shortSend=ctx.createGain(); shortSend.gain.value=0.16;shortSend.connect(revShort);
    gateSend =ctx.createGain(); gateSend.gain.value=0.52; gateSend.connect(revGate);

    gDrum=ctx.createGain(); gDrum.connect(master);
    gBass=ctx.createGain(); gBass.connect(master);
    gArp =ctx.createGain(); gArp.connect(master);
    gLead=ctx.createGain(); gLead.connect(master);
    gPad =ctx.createGain(); gPad.connect(master);
    gStab=ctx.createGain(); gStab.connect(master);
    gDrone=ctx.createGain();gDrone.connect(master);
    Object.keys(G).forEach(k=>{G[k].c=0;G[k].t=0;});
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC
  // ══════════════════════════════════════════════════════════════════════════

  function start(){
    init();
    if(ctx.state==='suspended') ctx.resume();
    _step=0; _nextT=ctx.currentTime+0.05;
    if(_sched) clearInterval(_sched);
    _sched=setInterval(poll,POLL);
    _mode='ambient';
    //           drum  bass  arp   lead  pad   stab  drone
    tgt(        0.32, 0.58, 0.48, 0.18, 0.30, 0,    0.22);
    startPad(); startDrone();
  }

  function stop(){
    if(_sched){clearInterval(_sched);_sched=null;}
    if(_rampReset){clearTimeout(_rampReset);_rampReset=null;}
    _smoothR=0.06;
    stopPad(); stopDrone(); stopSwell();
    if(!ctx) return;
    try{master.gain.setTargetAtTime(0,ctx.currentTime,0.3);}catch(e){}
    const _c=ctx; ctx=null; _nb=null;
    setTimeout(()=>{try{_c.close();}catch(e){}},1500);
  }

  function setCombat(on){
    if(_ct){clearTimeout(_ct);_ct=null;}
    if(_rampReset){clearTimeout(_rampReset);_rampReset=null;}
    if(on){
      stopSwell();
      _mode='combat';
      _smoothR=0.20;
      _rampReset=setTimeout(()=>{_smoothR=0.06;},1500);
      G.drum.c=0.58; G.bass.c=0.48; G.arp.c=0.42; G.stab.c=0.28;
      //           drum  bass  arp   lead  pad   stab  drone
      tgt(        0.88, 0.72, 0.65, 0.55, 0.08, 0.62, 0.05);
      if(ctx){
        const now=ctx.currentTime+0.01;
        kick(now,1); kick(now+S16*4,1);
        stab(now+S16*0.5,A2);
      }
    }else{
      _ct=setTimeout(()=>{
        if(_mode==='combat'){
          _mode='ambient';
          tgt(0.32,0.58,0.48,0.18,0.30,0,0.22);
        }
      }, S16*8*1000);
    }
  }

  function setStealth(on){
    if(on&&_mode!=='combat'){
      _mode='stealth';
      //           drum  bass  arp  lead  pad   stab  drone
      tgt(        0,    0.14, 0,   0,    0.14, 0,    0.24);
      stopSwell(); swell();
    }else if(!on&&_mode==='stealth'){
      stopSwell();
      _mode='ambient';
      tgt(0.32,0.58,0.48,0.18,0.30,0,0.22);
    }
  }

  function setVolume(v){
    if(master) master.gain.setTargetAtTime(Math.max(0,Math.min(1,v))*0.85,ctx.currentTime,0.3);
  }

  return{start,stop,setCombat,setStealth,setVolume};
})();

window._musicStart   = ()=>_MUS.start();
window._musicStop    = ()=>_MUS.stop();
window._musicCombat  = on=>_MUS.setCombat(on);
window._musicStealth = on=>_MUS.setStealth(on);
window._musicVolume  = v=>_MUS.setVolume(v);
