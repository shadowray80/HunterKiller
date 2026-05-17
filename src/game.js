window.onerror=function(m,s,l){if(l===0)return true;return false;};

// Safari polyfills
function padL(str, len, ch) { str = String(str); ch = ch || '0'; while (str.length < len) { str = ch + str; } return str; }
function prependEl(parent, child) { if (parent.firstChild) { parent.insertBefore(child, parent.firstChild); } else { parent.appendChild(child); } }

const TORP_CD_MS = 5000;
const PING_CD_MS = 5000;
function torpReady() { return Date.now() - state.torpLastFired >= TORP_CD_MS; }
function pingReady() { return Date.now() - state.pingLastFired >= PING_CD_MS; }
function torpSecsLeft() { return Math.ceil((TORP_CD_MS - (Date.now()-state.torpLastFired))/1000); }


// DEBUG - remove later
var _dbg = [];
function dbg(msg) {
  _dbg.push(msg);
  var el = document.getElementById('_dbg_el');
  if (!el) {
    el = document.createElement('div');
    el.id = '_dbg_el';
    el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.85);color:lime;font-size:9px;padding:4px;z-index:99999;max-height:120px;overflow-y:auto;font-family:monospace;';
    if (document.body) document.body.appendChild(el);
  }
  if (el) el.textContent = _dbg.slice(-8).join('\n');
}
window.addEventListener('error', function(e) {
  dbg('ERR:' + (e.message||'?') + ' L' + (e.lineno||0));
});
// ════════════════════════════════════════════════
// THREE.JS INLINE (minimal, points-cloud renderer)
// We'll use plain Canvas 2D for the 3D projection
// to avoid CDN dependencies — pure vanilla JS
// ════════════════════════════════════════════════

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// ── GRID CONFIG ──
// ── FLOOR PLAN GRID ──
// 64x48 voxel grid sampled from real house plan (40'x30', 3m ceiling)
const FLOOR_PLAN = [
[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,1,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,1,1,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],
[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];


// ── FURNITURE PIECES ──
const HOUSE_FURNITURE = [
  // BEDROOM 2 (x:1-17, z:1-15)
  { type:'bed',     x1:3,  y1:0, z1:1,  x2:9,  y2:2, z2:5  },
  { type:'desk',    x1:11, y1:0, z1:1,  x2:16, y2:2, z2:3  },
  { type:'bench',   x1:3,  y1:0, z1:5,  x2:9,  y2:1, z2:6  },
  // BEDROOM 3 (x:19-32, z:1-15)
  { type:'bed',     x1:20, y1:0, z1:1,  x2:26, y2:2, z2:5  },
  { type:'desk',    x1:27, y1:0, z1:1,  x2:31, y2:2, z2:4  },
  { type:'bench',   x1:20, y1:0, z1:5,  x2:26, y2:1, z2:6  },
  // BATHROOM (x:33-39, z:1-15)
  { type:'bath',    x1:34, y1:0, z1:1,  x2:38, y2:1, z2:5  },
  { type:'toilet',  x1:34, y1:0, z1:6,  x2:37, y2:2, z2:9  },
  { type:'sink',    x1:34, y1:0, z1:10, x2:38, y2:2, z2:12 },
  // MASTER BEDROOM (x:41-53, z:1-15)
  { type:'bed',     x1:43, y1:0, z1:1,  x2:51, y2:2, z2:6  },
  { type:'bench',   x1:43, y1:0, z1:6,  x2:51, y2:1, z2:7  },
  { type:'desk',    x1:41, y1:0, z1:1,  x2:43, y2:2, z2:5  },
  { type:'desk',    x1:51, y1:0, z1:1,  x2:53, y2:2, z2:5  },
  // FAMILY ROOM (x:1-19, z:25-46)
  { type:'sofa',    x1:2,  y1:0, z1:26, x2:14, y2:2, z2:29 },
  { type:'sofa',    x1:2,  y1:0, z1:29, x2:5,  y2:2, z2:37 },
  { type:'table',   x1:6,  y1:0, z1:30, x2:11, y2:1, z2:35 },
  { type:'bench',   x1:2,  y1:0, z1:38, x2:10, y2:2, z2:42 },
  // DINING AREA (x:20-39, z:25-46)
  { type:'table',   x1:23, y1:0, z1:28, x2:36, y2:2, z2:38 },
  { type:'chair',   x1:21, y1:0, z1:29, x2:23, y2:2, z2:32 },
  { type:'chair',   x1:21, y1:0, z1:33, x2:23, y2:2, z2:36 },
  { type:'chair',   x1:36, y1:0, z1:29, x2:38, y2:2, z2:32 },
  { type:'chair',   x1:36, y1:0, z1:33, x2:38, y2:2, z2:36 },
  { type:'chair',   x1:25, y1:0, z1:38, x2:28, y2:2, z2:40 },
  { type:'chair',   x1:31, y1:0, z1:38, x2:34, y2:2, z2:40 },
  { type:'chair',   x1:25, y1:0, z1:26, x2:28, y2:2, z2:28 },
  { type:'chair',   x1:31, y1:0, z1:26, x2:34, y2:2, z2:28 },
  // KITCHEN (x:40-53, z:25-36)
  { type:'counter', x1:41, y1:0, z1:25, x2:53, y2:2, z2:27 },
  { type:'counter', x1:41, y1:0, z1:25, x2:43, y2:2, z2:36 },
  { type:'island',  x1:45, y1:0, z1:29, x2:51, y2:2, z2:33 },
  { type:'counter', x1:41, y1:0, z1:34, x2:53, y2:2, z2:36 },
  // WASHROOM (x:54-62, z:37-46)
  { type:'counter', x1:55, y1:0, z1:37, x2:62, y2:2, z2:39 },
  { type:'toilet',  x1:55, y1:0, z1:40, x2:58, y2:2, z2:43 },
  { type:'bath',    x1:55, y1:0, z1:43, x2:62, y2:1, z2:46 },
];

const GRID = { W: 64, H: 6, D: 48 };
// Scale: door openings measured at ~0.6m in plan, normalised to 1m
// Each voxel = 0.317m (XZ), 0.5m (Y)
// House: 20.3m × 15.2m × 3.0m ceiling
const VOXEL_XZ = 0.3170; // metres per voxel horizontally
const VOXEL_Y  = 0.50;   // metres per voxel vertically


// ── SPAWN POINTS — one guaranteed clear cell per room ──
const SPAWN_POINTS = [
  { name: 'FAMILY ROOM',    x:  2, z: 29 },
  { name: 'DINING AREA',    x: 21, z: 29 },
  { name: 'KITCHEN',        x: 41, z: 29 },
  { name: 'CORRIDOR',       x:  2, z: 18 },
  { name: 'BEDROOM 2',      x:  2, z:  2 },
  { name: 'BEDROOM 3',      x: 21, z:  2 },
  { name: 'MASTER BEDROOM', x: 42, z:  2 },
  { name: 'BATHROOM',       x: 34, z:  2 },
  { name: 'WASHROOM',       x: 55, z: 39 },
  { name: 'CLOSET',         x: 55, z:  2 },
];

// Player always spawns in family room, enemy gets a random OTHER room
function getPlayerSpawn() {
  return SPAWN_POINTS.find(s => s.name === 'FAMILY ROOM');
}

function getEnemySpawn(avoidRoom) {
  const options = SPAWN_POINTS.filter(s =>
    s.name !== 'FAMILY ROOM' && s.name !== avoidRoom
  );
  return options[Math.floor(Math.random() * options.length)];
}

function spawnEnemy(avoidRoom) {
  let ex, ez, ey;
  if (window._isHeightfield) {
    ex = 3 + Math.floor(Math.random() * (GRID.W - 6));
    ez = 3 + Math.floor(Math.random() * (GRID.D - 6));
    const gz = Math.min(ez, GRID.D-1), gx = Math.min(ex, GRID.W-1);
    const raw = (window._canyonHeightGrid && window._canyonHeightGrid[gz] && window._canyonHeightGrid[gz][gx] !== undefined) ? window._canyonHeightGrid[gz][gx] : 0;
    ey = Math.max((raw/255)*GRID.H + 2.5, GRID.H * 0.35);
  } else {
    const options = SPAWN_POINTS.filter(s => s.name !== 'FAMILY ROOM' && s.name !== avoidRoom);
    const preferred = options[Math.floor(Math.random() * options.length)];
    const sp = findClearCell(preferred.x, preferred.z);
    ex = sp.x; ez = sp.z; ey = 3;
    addEvent(`▸ ENEMY CONTACT — ${preferred.name}`, true);
    setTimeout(() => addEvent('▸ WEAPONS HOT — GOOD HUNTING', false), 1500);
  }
  state.enemy.x = ex;
  state.enemy.y = ey;
  state.enemy.z = ez;
  state.enemy.alive = true;
  state.enemy.hits = 0;
  state.enemy.bubbling = false;
  state.enemy.bubbleTimer = 0;
  state.enemy.heading = Math.random() * Math.PI * 2;
  if (window._isHeightfield) {
    addEvent('▸ ENEMY CONTACT — CANYON SECTOR', true);
    setTimeout(() => addEvent('▸ WEAPONS HOT — GOOD HUNTING', false), 1500);
  }
}

function findClearCell(preferX, preferZ) {
  // Scan entire grid for any clear cell near preferred position
  for (let r=0; r<30; r++) {
    for (let dz=-r; dz<=r; dz++) {
      for (let dx=-r; dx<=r; dx++) {
        if (r>0 && Math.abs(dx)!==r && Math.abs(dz)!==r) continue;
        const nx=preferX+dx, nz=preferZ+dz;
        if (nx>1&&nx<GRID.W-2&&nz>1&&nz<GRID.D-2) {
          if (!(FLOOR_PLAN[nz]&&FLOOR_PLAN[nz][nx])) {
            return {x:nx, z:nz};
          }
        }
      }
    }
  }
  // Last resort - scan whole grid
  for (let z=1; z<GRID.D-1; z++) {
    for (let x=1; x<GRID.W-1; x++) {
      if (!(FLOOR_PLAN[z]&&FLOOR_PLAN[z][x])) return {x:x, z:z};
    }
  }
  return {x:2, z:2};
}

function spawnPlayer() {
  const sp = findClearCell(Math.floor(GRID.W/2), Math.floor(GRID.D/2));
  state.player.x = sp.x;
  state.player.z = sp.z;
  if (window._isHeightfield && window._canyonHeightGrid) {
    const gz = Math.min(Math.floor(sp.z), GRID.D-1), gx = Math.min(Math.floor(sp.x), GRID.W-1);
    const raw = (window._canyonHeightGrid[gz] && window._canyonHeightGrid[gz][gx] !== undefined) ? window._canyonHeightGrid[gz][gx] : 0;
    state.player.y = Math.max((raw/255)*GRID.H + 2.5, GRID.H * 0.35);
  } else {
    state.player.y = 3;
  }
}

// ── GAME STATE ──
const state = {
  mode: 'navigate',
  player: { x: 4, y: 3, z: 40, heading: 0 },
  enemy:  { x: 44, y: 3, z: 2, heading: 180, alive: true,
            aiState: 'hunt', aiTarget: null, aiTimer: 0, flankDir: 1,
            hits: 0, bubbling: false, bubbleTimer: 0, evasionTimer: 0 },
  torpedoes: [],
  aimCursor: null,
  torpCount: Infinity,
  score: 0,
  kills: 0,
  torpsFired: 0,
  torpsHit: 0,
  timesDetected: 0,
  maxDepth: 0,
  hull: 100,
  lives: 3,
  sonarPings: [],
  particles: [],
  revealed: false,
  revealTimer: 0,
  revealAlpha: 0,      // fade alpha for enemy
  enemyTrail: [],      // recent enemy positions
  pingCooldown: 0,
  forceReveal: true,
  silentRunning: false,
  silentPings: [],
  enemySilentAlpha: 0,
  enemyKnowsPlayer: true,
  enemyKnowsTimer: 0,
  enemyLastKnown: null,
  enemyPings: [],
  enemyPingTimer: 900,
  playerNoise: 0,
  firingSolution: null,
  lastEnemyPos: null,
  lastEnemyPosTime: 0,
  explosions: [],
  muzzleFlash: 0,
  viewMode: 'command',
  battleStations: false,
  showWireframe: true,
  showDots: true,
  torpLastFired: 0,     // timestamp of last torpedo fire
  enemyLastFired: 0,
  enemyCooldown: 0,
  pingLastFired: 0,
  torpCooldown: 0,
  ships: [],
  depthCharges: [],
  shells: [],
  noisemakers: [],
  countermeasures: 3,
  acousticLock: 0,
  whales: [],
  weaponMode: 'torpedo',  // 'torpedo' or 'mine'
  periAngleH: 0,         // periscope horizontal bearing (radians)
  periAngleV: 0.1,       // periscope vertical tilt (radians, 0=horizon)
  periDragActive: false,
  time: 0,
  events: [],
  camera: { rotX: 0.4, rotY: 0.4 },
  animFrame: 0,
  moveTimer: 0,
  enemyMoveTimer: 0,
};

// ── WAYPOINT MISSION ──
const WP_DEFS = [
  { num:1, x:15, y:3, z:20 },
  { num:2, x:48, y:3, z:20 },
  { num:3, x:58, y:3, z:30 },
  { num:4, x:38, y:3, z:43 },
  { num:5, x:10, y:3, z:35 },
];
state.wpMission = {
  active: false, waypoints: [], nextRequired: 1, score: 0,
  timeLeft: 0, triggerIn: Infinity, result: null, resultTimer: 0,
};
state.squids = [];

// ── AUDIO: Sonar ping via Web Audio API ──
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

var _pingAudio = null;
function playPing() {
  if (!_pingAudio) _pingAudio = new Audio('/Sounds/subping.mp3');
  _pingAudio.currentTime = 0;
  _pingAudio.play().catch(function(){});
}
var _explosionAudio = null;
function playExplosion(isEnemy = false) {
  if (!_explosionAudio) _explosionAudio = new Audio('/Sounds/explosion.mp3');
  _explosionAudio.currentTime = 0;
  _explosionAudio.play().catch(function(){});
}

var _explosionShipAudio = null;
function playExplosionShip() {
  if (!_explosionShipAudio) _explosionShipAudio = new Audio('/Sounds/Explosion_Ship.mp3');
  _explosionShipAudio.currentTime = 0;
  _explosionShipAudio.play().catch(function(){});
}

var _diveSignalAudio = null;
function playDiveSignal() {
  if (!_diveSignalAudio) _diveSignalAudio = new Audio('/Sounds/Dive_Signal.mp3');
  _diveSignalAudio.currentTime = 0;
  _diveSignalAudio.play().catch(function(){});
}

// Sub surface image
var _subSurfaceImg = null;
function getSubSurfaceImg() {
  if (!_subSurfaceImg) {
    _subSurfaceImg = new Image();
    _subSurfaceImg.src = '/Images/Sub_Surface.png';
  }
  return _subSurfaceImg;
}

// Torpedo launch
var _torpLaunchAudio = null;
function playTorpedoLaunch() {
  if (!_torpLaunchAudio) _torpLaunchAudio = new Audio('/Sounds/Torpedo_Launch.mp3');
  _torpLaunchAudio.currentTime = 0;
  _torpLaunchAudio.play().catch(function(){});
}

// Ship sonar ping (volume-scaled, reused element — ships ping infrequently)
var _shipSonarAudio = null;
function playShipSonar(vol) {
  if (!_shipSonarAudio) _shipSonarAudio = new Audio('/Sounds/sonar_ping_single.mp3');
  _shipSonarAudio.currentTime = 0;
  _shipSonarAudio.volume = Math.max(0.02, Math.min(1, vol));
  _shipSonarAudio.play().catch(function(){});
}

// Shell hits water (near miss / warning shot)
var _waterSurfExpAudio = null;
function playWaterSurfaceExplosion() {
  if (!_waterSurfExpAudio) _waterSurfExpAudio = new Audio('/Sounds/water_Surface_explosion.mp3');
  _waterSurfExpAudio.currentTime = 0;
  _waterSurfExpAudio.play().catch(function(){});
}
// Shell direct hit
var _exp01Audio = null;
function playExplosion01() {
  if (!_exp01Audio) _exp01Audio = new Audio('/Sounds/explosion_01.mp3');
  _exp01Audio.currentTime = 0;
  _exp01Audio.play().catch(function(){});
}

// ── WHALE AUDIO ──
var _whaleCallIdx = 0;
var WHALE_SOUNDS = ['/Sounds/Whale_01.mp3', '/Sounds/Whale_02.mp3', '/Sounds/Whale_03.mp3'];

// ── MEGALODON ──
var MEG_SPAWN_INTERVAL = 7200; // ~2 min at 60fps
var MEG_MAX = 1;
var MEG_BITE_DAMAGE = 5;
var MEG_BITE_RANGE = 2.5;
var MEG_BITE_COOLDOWN = 180; // 3s between bites
function playWhaleCall() {
  var snd = WHALE_SOUNDS[_whaleCallIdx % 3];
  _whaleCallIdx++;
  var a = new Audio(snd);
  a.volume = 0.6;
  a.play().catch(function(){});
  return a;
}

// ── AMBIENT SOUND MANAGER ──
// Underwater: Web Audio API AudioBufferSourceNode (frame-accurate gapless loop)
// Surface/surfaced: HTML Audio with loop (waves)
var _ambWaves = null;
var _ambCurrentMode = null; // 'underwater' | 'surface' | null

// Web Audio gapless underwater layer
var _uwBuffer  = null;   // decoded AudioBuffer — loaded once
var _uwSource  = null;   // current AudioBufferSourceNode (one-shot, recreated each play)
var _uwGain    = null;   // GainNode — persistent, stays connected
var _uwLoading = false;

function _uwLoad() {
  if (_uwBuffer || _uwLoading) return;
  _uwLoading = true;
  initAudio();
  fetch('/Sounds/underwater-ambience-loop.mp3')
    .then(function(r) { return r.arrayBuffer(); })
    .then(function(b) { return audioCtx.decodeAudioData(b); })
    .then(function(decoded) {
      _uwBuffer = decoded;
      _uwLoading = false;
      if (_ambCurrentMode === 'underwater') _uwStart();
    })
    .catch(function() { _uwLoading = false; });
}

function _uwStart() {
  if (!_uwBuffer) { _uwLoad(); return; }
  // Stop any existing source before creating a new one
  if (_uwSource) { try { _uwSource.stop(); } catch(e){} _uwSource = null; }
  if (!_uwGain) {
    _uwGain = audioCtx.createGain();
    _uwGain.gain.value = 0.8;
    _uwGain.connect(audioCtx.destination);
  }
  _uwSource = audioCtx.createBufferSource();
  _uwSource.buffer = _uwBuffer;
  _uwSource.loop = true;        // loop point is sample-accurate — zero gap
  _uwSource.connect(_uwGain);
  _uwSource.start(0);
}

function _uwStop() {
  if (_uwSource) { try { _uwSource.stop(); } catch(e){} _uwSource = null; }
}

function _getAmbWaves() {
  if (!_ambWaves) {
    _ambWaves = new Audio('/Sounds/waves.mp3');
    _ambWaves.loop = true;
    _ambWaves.volume = 0.45;
  }
  return _ambWaves;
}

function setAmbientMode(mode) {
  // mode: 'underwater' | 'surface' | 'off'
  if (mode === _ambCurrentMode) return;
  _ambCurrentMode = mode;
  if (mode === 'underwater') {
    if (_ambWaves) _ambWaves.pause();
    _uwStart();
  } else if (mode === 'surface') {
    _uwStop();
    _getAmbWaves().play().catch(function(){});
  } else {
    _uwStop();
    if (_ambWaves) _ambWaves.pause();
  }
}

// ── ROOM GEOMETRY from floor plan ──
// Build geometry from FLOOR_PLAN grid
// Wall cells become solid obstacles, open cells are navigable
let furniture;
furniture = buildFloorPlanGeometry();

function buildFloorPlanGeometry() {
  const pieces = [];
  const GW = GRID.W, GD = GRID.D, GH = GRID.H;

  // ── HEIGHTFIELD TERRAIN (canyon map) ───────────────────────────────
  if (window._isHeightfield && window._canyonHeightGrid) {
    const hg = window._canyonHeightGrid;
    // Terrain columns — one box per cell, height from heightmap
    // No border walls: player is clamped by movePlayer bounds, open black is fine
    for (let gz = 0; gz < GD; gz++) {
      for (let gx = 0; gx < GW; gx++) {
        const raw = (hg[gz] && hg[gz][gx] !== undefined) ? hg[gz][gx] : 0;
        const h = (raw / 255) * GH;
        if (h < 0.4) continue; // deep open water — nothing to draw
        pieces.push({
          type:'terrain', x1:gx, y1:0, z1:gz, x2:gx+1, y2:h, z2:gz+1,
          nx:0, ny:1, nz:0, terrainH: h
        });
      }
    }
    // Water surface so player can still surface
    pieces.push({type:'surface', x1:0, y1:GH, z1:0, x2:GW, y2:GH, z2:GD});
    return pieces;
  }

  // ── STANDARD FLOOR PLAN ────────────────────────────────────────────
  // Floor and ceiling (always)
  pieces.push({ type:'floor',   x1:0, y1:0,   z1:0, x2:GW, y2:0,   z2:GD });
  pieces.push({ type:'surface', x1:0, y1:GH,  z1:0, x2:GW, y2:GH,  z2:GD });

  // Build wall segments from the floor plan grid
  // Each wall cell becomes a full-height box
  const visited = (function(){var _a=[];for(var _i=0;_i<GD;_i++)_a.push(new Uint8Array(GW));return _a;})();

  for (let gz = 0; gz < GD; gz++) {
    for (let gx = 0; gx < GW; gx++) {
      if (!FLOOR_PLAN[gz] || !FLOOR_PLAN[gz][gx] || visited[gz][gx]) continue;

      // Detect if this is an outer wall or inner wall/furniture
      const isOuter = gz===0 || gz===GD-1 || gx===0 || gx===GW-1;
      const wallH = GH; // all walls full height — subs navigate through rooms not over walls

      // Grow rectangle horizontally for efficient merge
      let x2 = gx + 1;
      while (x2 < GW && FLOOR_PLAN[gz][x2] && !visited[gz][x2]) x2++;

      // Check if we can grow vertically too
      let z2 = gz + 1;
      while (z2 < GD) {
        let ok = true;
        for (let tx = gx; tx < x2; tx++) {
          if (!FLOOR_PLAN[z2] || !FLOOR_PLAN[z2][tx] || visited[z2][tx]) { ok = false; break; }
        }
        if (!ok) break;
        z2++;
      }

      // Mark visited
      for (let tz = gz; tz < z2; tz++)
        for (let tx = gx; tx < x2; tx++)
          visited[tz][tx] = 1;

      // Determine wall type
      const isEdge = gz===0||gz===GD-1||gx===0||gx===GW-1;
      const type = isEdge ? 'wall' : 'wall-inner';

      pieces.push({
        type, x1:gx, y1:0, z1:gz, x2:x2, y2:wallH, z2:z2,
        nx: gx===0?-1:gx===GW-1?1:0,
        ny: 0,
        nz: gz===0?-1:gz===GD-1?1:0
      });
    }
  }

  // Walls only from colour plan - furniture/doors disabled for now
  if (false) {
    // disabled
  } else {
    // Add generic furniture for built-in plan
    HOUSE_FURNITURE.forEach(f => {
      let blocked = false;
      for (let gz=Math.floor(f.z1);gz<Math.ceil(f.z2)&&!blocked;gz++)
        for (let gx=Math.floor(f.x1);gx<Math.ceil(f.x2)&&!blocked;gx++)
          if (FLOOR_PLAN[gz]&&FLOOR_PLAN[gz][gx]) blocked=true;
      if (!blocked) pieces.push(f);
    });
  }

  return pieces;
}

// Camera forward vector in world space (used for backface culling)
function getCamForward() {
  return {
    x: Math.sin(camRotY),
    y: 0,
    z: Math.cos(camRotY)
  };
}

// Pre-generate point cloud
const cloudPoints = [];
function generateCloud() {
  cloudPoints.length = 0;
  if (typeof buildWallEdges === 'function') buildWallEdges();
  if (typeof buildStaticDots === 'function') buildStaticDots();

  // Seeded pseudo-random for consistent jitter (same cloud each regenerate)
  let seed = 12345;
  function rand() {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  }

  furniture.forEach(f => {
    // Backface cull outer walls
    if (f.type === 'wall' && f.nx !== undefined && (f.nx!==0||f.nz!==0)) {
      const cam = getCamForward();
      if (f.nx * cam.x + f.nz * cam.z > 0.1) return;
    }

    // Heightfield terrain: skip flat column tops — bilinear infill added in buildWallEdges
    if (f.type === 'terrain' && window._isHeightfield) return;

    const step = f.type === 'terrain'  ? cloudDensity :
                 f.type === 'surface'  ? Math.max(3.0, cloudDensity * 6)   : cloudDensity;
    const jit = step * 0.12; // small jitter — just enough to break grid lines, not enough to cause doubles

    const w = f.x2 - f.x1;
    const h = f.y2 - f.y1;
    const d = f.z2 - f.z1;

    // ── SURFACE-ONLY SAMPLING ──
    // Sample each of the 6 faces of the box with brick-pattern offset
    // Face: TOP (y = f.y2)
    if (f.type !== 'wall' || true) { // always do top
      let rowIdx = 0;
      for (let z = f.z1; z <= f.z2; z += step, rowIdx++) {
        const xOffset = (rowIdx % 2) * step * 0.5; // brick offset
        for (let x = f.x1 + xOffset; x <= f.x2; x += step) {
          cloudPoints.push({
            x: x + (rand()-0.5)*jit,
            y: f.y2,
            z: z + (rand()-0.5)*jit,
            type: f.type, nx: 0, ny: 1, nz: 0,
            yFrac: f.terrainH !== undefined ? f.terrainH / GRID.H : undefined
          });
        }
      }
    }

    // Face: BOTTOM (y = f.y1) — floor only
    if (f.type === 'floor' || f.type === 'surface') {
      let rowIdx = 0;
      for (let z = f.z1; z <= f.z2; z += step, rowIdx++) {
        const xOffset = (rowIdx % 2) * step * 0.5;
        for (let x = f.x1 + xOffset; x <= f.x2; x += step) {
          cloudPoints.push({
            x: x + (rand()-0.5)*jit,
            y: f.y1,
            z: z + (rand()-0.5)*jit,
            type: f.type, nx: 0, ny: -1, nz: 0
          });
        }
      }
    }

    // Terrain: top face only — skip sides to avoid volume fog
    if (f.type === 'terrain') return;

    // Face: FRONT & BACK (z faces)
    if (d > 0.1) {
      [[f.z1, -1], [f.z2, 1]].forEach(([fz, nz]) => {
        let rowIdx = 0;
        for (let y = f.y1; y <= f.y2; y += step, rowIdx++) {
          const xOffset = (rowIdx % 2) * step * 0.5;
          for (let x = f.x1 + xOffset; x <= f.x2; x += step) {
            cloudPoints.push({
              x: x + (rand()-0.5)*jit,
              y: y + (rand()-0.5)*jit,
              z: fz,
              type: f.type, nx: 0, ny: 0, nz: nz,
              yFrac: f.terrainH !== undefined ? y / GRID.H : undefined
            });
          }
        }
      });
    }

    // Face: LEFT & RIGHT (x faces)
    if (w > 0.1) {
      [[f.x1, -1], [f.x2, 1]].forEach(([fx, nx]) => {
        let rowIdx = 0;
        for (let y = f.y1; y <= f.y2; y += step, rowIdx++) {
          const zOffset = (rowIdx % 2) * step * 0.5;
          for (let z = f.z1 + zOffset; z <= f.z2; z += step) {
            cloudPoints.push({
              x: fx,
              y: y + (rand()-0.5)*jit,
              z: z + (rand()-0.5)*jit,
              type: f.type, nx: nx, ny: 0, nz: 0,
              yFrac: f.terrainH !== undefined ? y / GRID.H : undefined
            });
          }
        }
      });
    }
  });
}

// ── ISOMETRIC PROJECTION ──
let W, H, cx, cy;
function resize() {
  W = canvas.width = canvas.offsetWidth || window.innerWidth;
  H = canvas.height = canvas.offsetHeight || window.innerHeight;
  cx = W/2; cy = H * 0.38;
}
resize();
window.addEventListener('resize', () => { resize(); if (_tacticalOn) setTacticalSonar(true); }); let ISO_SCALE = 12;  // smaller for larger grid
let cloudDensity = 0.35; // lower = denser cloud — 5x default
const DENSITY_MIN = 0.3, DENSITY_MAX = 3.0;
let periPointSize = 15; // periscope point size
let camRotY = 0.785; // starting angle (45°)
let surfaceBearing = 0; // surface periscope bearing
window._activeTypeGrid = null; // set by launchGame when colour plan loaded
const ISO_MIN = 5, ISO_MAX = 30;

// ── WALL EDGES + TERRAIN QUADS for wireframe / solid rendering ──
const wallEdges = [];
const terrainQuads = []; // flat [x0,y0,z0, x1,y1,z1, x2,y2,z2, x3,y3,z3] per quad
function buildWallEdges() {
  wallEdges.length = 0;
  terrainQuads.length = 0;
  furniture.forEach(f => {
    if (f.type === 'floor' || f.type === 'surface' || f.type === 'terrain') return;
    const {x1,y1,z1,x2,y2,z2,type} = f;
    const push = (ax,ay,az,bx,by,bz) => wallEdges.push({ax,ay,az,bx,by,bz,type});
    push(x1,y1,z1, x2,y1,z1); push(x2,y1,z1, x2,y1,z2);
    push(x2,y1,z2, x1,y1,z2); push(x1,y1,z2, x1,y1,z1);
    push(x1,y2,z1, x2,y2,z1); push(x2,y2,z1, x2,y2,z2);
    push(x2,y2,z2, x1,y2,z2); push(x1,y2,z2, x1,y2,z1);
    push(x1,y1,z1, x1,y2,z1); push(x2,y1,z1, x2,y2,z1);
    push(x2,y1,z2, x2,y2,z2); push(x1,y1,z2, x1,y2,z2);
  });
  // Heightfield: synthwave grid — quads only, edges drawn in painter pass (no wallEdges for terrain)
  if (window._isHeightfield && window._canyonHeightGrid) {
    const hg = window._canyonHeightGrid;
    const GH = GRID.H;
    const HCOLS = 64, HROWS = 48;
    const hv = (gz, gx) => (hg[gz] && hg[gz][gx] !== undefined) ? (hg[gz][gx] / 255) * GH : 0;
    for (let gz = 0; gz < HROWS - 1; gz++) {
      for (let gx = 0; gx < HCOLS - 1; gx++) {
        // flat array: [TL TR BR BL] world coords — 12 floats per quad
        terrainQuads.push(
          gx,   hv(gz,   gx),   gz,
          gx+1, hv(gz,   gx+1), gz,
          gx+1, hv(gz+1, gx+1), gz+1,
          gx,   hv(gz+1, gx),   gz+1
        );
      }
    }
    // Bilinearly-interpolated surface points — sit at the smooth terrain height
    // within each quad, not at flat column tops, so they read as texture not planes
    let rngS = 98765;
    const rng = () => { rngS = ((rngS * 1664525 + 1013904223) >>> 0); return rngS / 4294967296; };
    for (let gz = 0; gz < HROWS - 1; gz++) {
      for (let gx = 0; gx < HCOLS - 1; gx++) {
        const h00 = hv(gz,   gx),   h10 = hv(gz,   gx+1);
        const h01 = hv(gz+1, gx),   h11 = hv(gz+1, gx+1);
        for (let p = 0; p < 6; p++) {
          const u = rng(), v = rng();
          const wy = h00*(1-u)*(1-v) + h10*u*(1-v) + h01*(1-u)*v + h11*u*v;
          cloudPoints.push({ x: gx+u, y: wy, z: gz+v, type:'terrain', nx:0, ny:1, nz:0, yFrac: wy/GH });
        }
      }
    }
  }
}

// ── STATIC BRICK-PATTERN DOTS ──
// Built once — fixed positions, no per-frame jitter
const staticDots = [];
function buildStaticDots() {
  staticDots.length = 0;
  furniture.forEach(f => {
    if (f.type === 'terrain') return; // terrain handled by cloud points only
    const {x1,y1,z1,x2,y2,z2,type} = f;
    const isFlat = type === 'floor' || type === 'surface';
    const step = isFlat ? 3.0 : 1.4; // sparse on floor/ceiling, moderate on walls

    // XZ faces (top/bottom of box)
    [y1, y2].forEach(fy => {
      let row = 0;
      for (let z = z1; z < z2; z += step, row++) {
        const xOff = (row & 1) * step * 0.5; // brick offset on alternating rows
        for (let x = x1 + xOff; x < x2; x += step)
          staticDots.push({x, y: fy, z, type});
      }
    });
    // XY faces (front/back of box)
    [z1, z2].forEach(fz => {
      let row = 0;
      for (let y = y1; y < y2; y += step, row++) {
        const xOff = (row & 1) * step * 0.5;
        for (let x = x1 + xOff; x < x2; x += step)
          staticDots.push({x, y, z: fz, type});
      }
    });
    // YZ faces (left/right of box)
    [x1, x2].forEach(fx => {
      let row = 0;
      for (let y = y1; y < y2; y += step, row++) {
        const zOff = (row & 1) * step * 0.5;
        for (let z = z1 + zOff; z < z2; z += step)
          staticDots.push({x: fx, y, z, type});
      }
    });
  });
}

generateCloud(); // also calls buildWallEdges() via the hook inside it

function project(wx, wy, wz) {
  const gx = wx - GRID.W/2;
  const gy = wy - GRID.H/2;
  const gz = wz - GRID.D/2;
  // Rotate around Y axis by camRotY
  const rx = gx * Math.cos(camRotY) - gz * Math.sin(camRotY);
  const rz = gx * Math.sin(camRotY) + gz * Math.cos(camRotY);
  // Project to screen (isometric-style, fixed elevation angle)
  const sx = rx * ISO_SCALE;
  const sy = (gy * 0.82 + rz * 0.55) * ISO_SCALE;
  return { sx: cx + sx, sy: cy - sy };
}

function ptColor(type, alpha, yFrac) {
  switch(type) {
    case 'terrain': {
      // Same 10-band contour palette as sonar minimap and periscope quads
      const f = yFrac !== undefined ? yFrac : 0.5;
      const band = Math.floor(f * 10) / 10;
      const g2 = Math.round(12 + band * 168);
      const b2 = Math.round(22 + band * 148);
      return `rgba(0,${g2},${b2},${alpha*0.92})`;
    }
    case 'floor':   return `rgba(0,120,160,${alpha*0.45})`;
    case 'surface': return `rgba(0,200,255,${alpha*0.65})`;
    case 'wall':    return `rgba(0,160,220,${alpha*0.65})`;
    case 'wardrobe': return `rgba(180,100,220,${alpha*0.9})`; // purple
    case 'door':     return `rgba(0,120,160,${alpha*0.3})`;  // door header — dim
    case 'wall-inner': return `rgba(0,180,200,${alpha*0.7})`; // inner walls — teal
    // Furniture — warm amber/gold tones, distinct from walls
    case 'bed':     return `rgba(220,160,60,${alpha*0.9})`;   // warm gold
    case 'sofa':    return `rgba(200,140,80,${alpha*0.9})`;   // tan
    case 'table':   return `rgba(180,120,60,${alpha*0.85})`;  // wood brown
    case 'chair':   return `rgba(200,140,80,${alpha*0.85})`;  // tan
    case 'desk':    return `rgba(160,200,180,${alpha*0.85})`; // sage green
    case 'bench':   return `rgba(180,160,120,${alpha*0.8})`;  // light wood
    case 'counter': return `rgba(160,180,200,${alpha*0.85})`; // cool grey-blue
    case 'island':  return `rgba(140,170,200,${alpha*0.9})`;  // slightly darker
    case 'bath':    return `rgba(120,200,220,${alpha*0.85})`; // aqua
    case 'toilet':  return `rgba(200,200,210,${alpha*0.8})`;  // white-ish
    case 'sink':    return `rgba(140,200,220,${alpha*0.85})`; // aqua
    default:        return `rgba(60,220,120,${alpha*0.85})`;
  }
}

// ── SONAR ──
const sonarCtx = document.getElementById('sonar-canvas').getContext('2d');
let sonarAngle = 0;
const sonarPings = [];
let _sonarTerrainCache = null; // pre-rendered heightmap image, rebuilt on map load

function drawSonar() {
  const sc = sonarCtx;
  const sw = 200, sh = 200;
  const scx = sw/2, scy = sh/2;
  // Scale: fit the room grid into the minimap
  const scaleX = (sw - 4) / GRID.W;
  const scaleZ = (sh - 4) / GRID.D;
  const scale = Math.min(scaleX, scaleZ);
  const offX = scx - (GRID.W/2) * scale;
  const offZ = scy - (GRID.D/2) * scale;

  // world → minimap coords (top-down, world X = screen X, world Z = screen Y)
  function mm(wx, wz) {
    return { x: offX + wx * scale, y: offZ + wz * scale };
  }

  sc.fillStyle = 'rgba(0,4,12,0.97)';
  sc.fillRect(0,0,sw,sh);

  // ── ROOM BOUNDARY ──
  const r0 = mm(0,0), r1 = mm(GRID.W, GRID.D);
  sc.strokeStyle = 'rgba(0,150,200,0.25)';
  sc.lineWidth = 1;
  sc.strokeRect(r0.x, r0.y, r1.x-r0.x, r1.y-r0.y);

  // ── TERRAIN CONTOUR MAP (canyon / heightfield battleground) ──
  if (window._isHeightfield && window._canyonHeightGrid) {
    if (!_sonarTerrainCache) {
      const hg = window._canyonHeightGrid;
      const oc = document.createElement('canvas');
      oc.width = sw; oc.height = sh;
      const ox = oc.getContext('2d');
      const img = ox.createImageData(sw, sh);
      const d = img.data;
      const numBands = 10; // contour intervals

      // Pass 1: compute bilinear heights into a float buffer
      const hbuf = new Float32Array(sw * sh);
      for (let py = 0; py < sh; py++) {
        for (let px = 0; px < sw; px++) {
          const wx = (px - offX) / scale;
          const wz = (py - offZ) / scale;
          const gx = Math.floor(wx), gz = Math.floor(wz);
          if (gx < 0 || gx >= GRID.W || gz < 0 || gz >= GRID.D || !hg[gz]) {
            hbuf[py * sw + px] = -1; continue;
          }
          const fx = wx - gx, fz = wz - gz;
          const gx1 = Math.min(gx + 1, GRID.W - 1), gz1 = Math.min(gz + 1, GRID.D - 1);
          const h00 = (hg[gz][gx]   || 0) / 255;
          const h10 = (hg[gz][gx1]  || 0) / 255;
          const h01 = (hg[gz1] ? (hg[gz1][gx]  || 0) : 0) / 255;
          const h11 = (hg[gz1] ? (hg[gz1][gx1] || 0) : 0) / 255;
          hbuf[py * sw + px] = h00*(1-fx)*(1-fz) + h10*fx*(1-fz) + h01*(1-fx)*fz + h11*fx*fz;
        }
      }

      // Pass 2: colour each pixel by height band; mark band edges as contour lines
      for (let py = 0; py < sh; py++) {
        for (let px = 0; px < sw; px++) {
          const h = hbuf[py * sw + px];
          const idx = (py * sw + px) * 4;
          if (h < 0.02) { d[idx + 3] = 0; continue; }

          const band = Math.floor(h * numBands);
          const hR   = px < sw - 1 ? hbuf[py * sw + px + 1] : h;
          const hD   = py < sh - 1 ? hbuf[(py + 1) * sw + px] : h;
          const isContour = (hR >= 0 && Math.floor(hR * numBands) !== band) ||
                            (hD >= 0 && Math.floor(hD * numBands) !== band);

          if (isContour) {
            // Bright contour line — brighter at higher elevations
            const cl = Math.round(160 + h * 95);
            d[idx] = 0; d[idx+1] = cl; d[idx+2] = Math.round(cl * 0.8);
            d[idx+3] = 230;
          } else {
            // Band fill: dark blue-black at seabed → deep teal at peaks
            const shade = band / numBands;
            d[idx]     = 0;
            d[idx + 1] = Math.round(8  + shade * 80);
            d[idx + 2] = Math.round(15 + shade * 70);
            d[idx + 3] = Math.round((0.55 + shade * 0.35) * 255);
          }
        }
      }
      ox.putImageData(img, 0, 0);
      _sonarTerrainCache = oc;
    }
    sc.drawImage(_sonarTerrainCache, 0, 0);
  } else {
    // ── FURNITURE FOOTPRINTS (floor plan maps) ──
    furniture.forEach(f => {
      if (f.type==='floor'||f.type==='surface'||f.type==='wall') return;
      const fp0 = mm(f.x1, f.z1), fp1 = mm(f.x2, f.z2);
      sc.fillStyle = 'rgba(0,120,180,0.18)';
      sc.strokeStyle = 'rgba(0,150,200,0.3)';
      sc.lineWidth = 0.5;
      sc.fillRect(fp0.x, fp0.y, fp1.x-fp0.x, fp1.y-fp0.y);
      sc.strokeRect(fp0.x, fp0.y, fp1.x-fp0.x, fp1.y-fp0.y);
    });

    // ── GRID LINES (faint) ──
    sc.strokeStyle = 'rgba(0,100,140,0.1)';
    sc.lineWidth = 0.5;
    for (let gx=0; gx<=GRID.W; gx+=4) {
      const a=mm(gx,0), b=mm(gx,GRID.D);
      sc.beginPath(); sc.moveTo(a.x,a.y); sc.lineTo(b.x,b.y); sc.stroke();
    }
    for (let gz=0; gz<=GRID.D; gz+=4) {
      const a=mm(0,gz), b=mm(GRID.W,gz);
      sc.beginPath(); sc.moveTo(a.x,a.y); sc.lineTo(b.x,b.y); sc.stroke();
    }
  }

  // ── SONAR SWEEP ──
  sonarAngle = (sonarAngle + 0.018) % (Math.PI*2);
  sc.save();
  sc.translate(scx, scy);
  const sweepR = Math.max(r1.x-r0.x, r1.y-r0.y);
  const sg = sc.createLinearGradient(0,0,sweepR,0);
  sg.addColorStop(0, 'rgba(0,255,157,0.12)');
  sg.addColorStop(1, 'rgba(0,255,157,0)');
  sc.fillStyle = sg;
  sc.save();
  sc.rotate(sonarAngle);
  sc.beginPath();
  sc.moveTo(0,0);
  sc.arc(0,0,sweepR,-0.5,0);
  sc.closePath();
  sc.fill();
  sc.restore();
  sc.restore();

  // ── TORPEDO TRACKS ──
  state.torpedoes.forEach(t => {
    const tp = mm(t.x, t.z);
    const tp2 = mm(t.x - t.dx*3, t.z - t.dz*3);
    sc.beginPath(); sc.moveTo(tp.x,tp.y); sc.lineTo(tp2.x,tp2.y);
    sc.strokeStyle='rgba(255,170,0,0.5)'; sc.lineWidth=1.5; sc.stroke();
    sc.beginPath(); sc.arc(tp.x,tp.y,2.5,0,Math.PI*2);
    sc.fillStyle='#ffaa00'; sc.shadowBlur=6; sc.shadowColor='#ffaa00';
    sc.fill(); sc.shadowBlur=0;
  });

  // ── ENEMY TRAIL ──
  // In silent mode only show when a ping/fire reveal is active
  const _silentReveal = Math.max(state.revealAlpha, state.enemySilentAlpha);
  const showEnemy = !state.silentRunning || state.forceReveal || _silentReveal > 0;
  const _revA = state.silentRunning
    ? _silentReveal * 0.5
    : (state.forceReveal ? 0.5 : Math.max(0.25, state.revealAlpha));
  if (showEnemy) {
    state.enemyTrail.forEach((t, i) => {
      const tp = mm(t.x, t.z);
      const a = _revA * (1-t.age/300) * (i/Math.max(1,state.enemyTrail.length));
      if (a > 0.05) {
        sc.beginPath(); sc.arc(tp.x, tp.y, 2, 0, Math.PI*2);
        sc.fillStyle=`rgba(255,68,68,${a})`; sc.fill();
      }
    });
  }

  // ── ENEMY BLIP ──
  if (state.enemy.alive && showEnemy) {
    const ep = mm(state.enemy.x, state.enemy.z);
    const ea = state.silentRunning
      ? _silentReveal
      : (state.forceReveal ? 1.0 : Math.max(0.7, state.revealAlpha));

    // Bearing line from player to enemy
    const pp2 = mm(state.player.x, state.player.z);
    sc.beginPath(); sc.moveTo(pp2.x, pp2.y); sc.lineTo(ep.x, ep.y);
    sc.strokeStyle=`rgba(255,68,68,${ea*0.4})`; sc.lineWidth=0.8;
    sc.setLineDash([3,3]); sc.stroke(); sc.setLineDash([]);

    // Enemy dot
    sc.beginPath(); sc.arc(ep.x, ep.y, 4, 0, Math.PI*2);
    sc.fillStyle=`rgba(255,68,68,${ea})`;
    sc.shadowBlur=10; sc.shadowColor='#ff4444'; sc.fill(); sc.shadowBlur=0;

    // Depth indicator bar next to dot
    const depthFrac = state.enemy.y / GRID.H;
    sc.fillStyle=`rgba(255,68,68,${ea*0.7})`;
    sc.fillRect(ep.x+6, ep.y-6, 3, 12*(1-depthFrac));

    // Update bearing readout
    const dx = state.enemy.x - state.player.x;
    const dz = state.enemy.z - state.player.z;
    const bearing = ((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360;
    const range = Math.sqrt(dx*dx + dz*dz).toFixed(1);
    const depthDiff = state.enemy.y - state.player.y;
    const depthStr = depthDiff > 0 ? `+${depthDiff} ABOVE` : depthDiff < 0 ? `${depthDiff} BELOW` : 'SAME';
    document.getElementById('sonar-readout').innerHTML =
      `<span style="color:#ff4444">BRAVO</span> &nbsp;${padL(bearing.toFixed(0),3,'0')}° &nbsp;${range}u &nbsp;${depthStr}`;
  } else {
    document.getElementById('sonar-readout').innerHTML =
      `<span style="color:#0097a7">BEARING — &nbsp;RANGE — &nbsp;DEPTH —</span>`;
  }

  // ── ENEMY PING RINGS on minimap ──
  state.enemyPings.forEach(p => {
    const ep = mm(p.wx, p.wz);
    const er = p.r * scale;
    sc.beginPath();
    sc.arc(ep.x, ep.y, er, 0, Math.PI * 2);
    sc.strokeStyle = `rgba(255,80,80,${p.alpha * 0.85})`;
    sc.lineWidth = 1.5;
    sc.stroke();
  });

  // ── NOISEMAKER BLIPS on minimap ──
  if (state.noisemakers) state.noisemakers.forEach(function(nm) {
    const _nmbp = mm(nm.x, nm.z);
    const _nmba = Math.max(0.3, 1 - nm.age/540);
    const _pulse = 0.5 + 0.5*Math.sin(nm.age*0.25);
    sc.beginPath(); sc.arc(_nmbp.x, _nmbp.y, 3 + _pulse*2, 0, Math.PI*2);
    sc.strokeStyle = `rgba(255,180,0,${_nmba*_pulse*0.7})`; sc.lineWidth=1; sc.stroke();
    sc.beginPath(); sc.arc(_nmbp.x, _nmbp.y, 2.5, 0, Math.PI*2);
    sc.fillStyle=`rgba(255,160,0,${_nmba})`; sc.shadowBlur=5; sc.shadowColor='#ffaa00'; sc.fill(); sc.shadowBlur=0;
  });

  // ── PLAYER SUB (always at correct world position) ──
  const pp = mm(state.player.x, state.player.z);
  // Heading indicator: command view uses camera rotation; other views use sub heading
  const _sonarHeading = (state.viewMode === 'command') ? camRotY : state.periAngleH + Math.PI;
  sc.save();
  sc.translate(pp.x, pp.y);
  sc.rotate(_sonarHeading);
  sc.beginPath(); sc.moveTo(0,-7); sc.lineTo(3,4); sc.lineTo(0,2); sc.lineTo(-3,4); sc.closePath();
  sc.fillStyle='rgba(0,229,255,0.4)'; sc.strokeStyle='#00e5ff'; sc.lineWidth=0.8;
  sc.fill(); sc.stroke();
  sc.restore();
  // Player dot
  sc.beginPath(); sc.arc(pp.x, pp.y, 3.5, 0, Math.PI*2);
  sc.fillStyle='#00e5ff'; sc.shadowBlur=10; sc.shadowColor='#00e5ff';
  sc.fill(); sc.shadowBlur=0;

  // ── WHALE BLIPS ──
  if (state.whales) state.whales.forEach(function(whale) {
    if (!whale.alive) return;
    var wp = mm(whale.x, whale.z);
    sc.beginPath(); sc.arc(wp.x, wp.y, 3.5, 0, Math.PI*2);
    sc.fillStyle = '#00ff66'; sc.shadowBlur = 8; sc.shadowColor = '#00ff66';
    sc.fill(); sc.shadowBlur = 0;
    sc.font = '6px Share Tech Mono'; sc.textAlign = 'center'; sc.textBaseline = 'alphabetic';
    sc.fillStyle = 'rgba(0,240,100,0.65)';
    sc.fillText('WHL', wp.x, wp.y - 5);
  });

  // ── MEGALODON BLIPS ──
  if (state.megalodons) state.megalodons.forEach(function(meg) {
    if (!meg.alive) return;
    var mp = mm(meg.x, meg.z);
    sc.beginPath(); sc.arc(mp.x, mp.y, 4.5, 0, Math.PI*2);
    sc.fillStyle = '#6688aa'; sc.shadowBlur = 10; sc.shadowColor = '#6688aa';
    sc.fill(); sc.shadowBlur = 0;
    sc.font = '6px Share Tech Mono'; sc.textAlign = 'center'; sc.textBaseline = 'alphabetic';
    sc.fillStyle = 'rgba(100,140,180,0.75)';
    sc.fillText('MEG', mp.x, mp.y - 6);
  });

  // ── SURFACE SHIP CONTACTS ──
  if (state.ships) state.ships.forEach(function(ship) {
    if (!ship.alive && !ship.sinking) return;
    var sp2 = mm(ship.x, ship.z);
    // Heading tick — small line showing ship direction
    var hx = sp2.x + Math.sin(ship.heading) * 7, hz = sp2.y + Math.cos(ship.heading) * 7;
    sc.beginPath(); sc.moveTo(sp2.x, sp2.y); sc.lineTo(hx, hz);
    sc.strokeStyle = 'rgba(255,230,80,0.55)'; sc.lineWidth = 1; sc.stroke();
    // Diamond contact blip
    sc.save();
    sc.translate(sp2.x, sp2.y);
    sc.rotate(Math.PI / 4);
    sc.beginPath(); sc.rect(-3, -3, 6, 6);
    var shipAlpha = ship.sinking ? Math.max(0.3, ship.sinkY / GRID.H) : 1.0;
    sc.fillStyle = `rgba(255,220,60,${shipAlpha})`;
    sc.shadowBlur = 8; sc.shadowColor = '#ffdd00';
    sc.fill(); sc.shadowBlur = 0;
    sc.restore();
    sc.font = '6px Share Tech Mono'; sc.textAlign = 'center'; sc.textBaseline = 'alphabetic';
    sc.fillStyle = `rgba(255,220,60,${shipAlpha * 0.8})`;
    sc.fillText(ship.label.split(' ')[0], sp2.x, sp2.y - 6);
  });

  // ── WAYPOINT BLIPS ──
  const wpm = state.wpMission;
  if (wpm.active || wpm.result !== null) {
    wpm.waypoints.forEach(wp => {
      const wpos = mm(wp.x, wp.z);
      const color = wp.collected ? '#ff8800' : '#00ff66';
      const pulse = wp.collected ? 1 : 0.5 + 0.5*Math.sin(state.animFrame*0.15 + wp.num);
      sc.beginPath(); sc.arc(wpos.x, wpos.y, 4, 0, Math.PI*2);
      sc.fillStyle = color; sc.shadowBlur = 8*pulse; sc.shadowColor = color;
      sc.globalAlpha = 0.6 + 0.4*pulse;
      sc.fill(); sc.shadowBlur = 0; sc.globalAlpha = 1;
    });
  }

  // ── LABELS ──
  sc.font='7px Share Tech Mono'; sc.textAlign='left'; sc.textBaseline='alphabetic';
  sc.fillStyle='rgba(0,180,220,0.5)';
  sc.fillText(`-${((GRID.H-state.player.y)*VOXEL_Y).toFixed(1)}m`, pp.x+5, pp.y-3);
}

let lastCamRotY = camRotY;

// ── RENDER ──
function renderBSOverlay() {
  if (!state.battleStations) return;
  const pulse = 0.04 + 0.03 * Math.sin(state.animFrame * 0.08);
  ctx.save();
  // Red corner vignette
  const vg = ctx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.75);
  vg.addColorStop(0,'rgba(255,0,0,0)');
  vg.addColorStop(1,'rgba(255,0,0,'+(pulse*3)+')');
  ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);
  // BATTLE STATIONS text
  ctx.font='bold 11px monospace';
  ctx.fillStyle='rgba(255,80,80,'+(0.6+pulse*5)+')';
  ctx.textAlign='center';
  ctx.fillText('⚠ BATTLE STATIONS',W/2,24);
  ctx.restore();
}

function render() {
  // Regenerate point cloud if camera rotated (backface culling update)
  if (Math.abs(camRotY - lastCamRotY) > 0.05) {
    generateCloud();
    lastCamRotY = camRotY;
  }

  ctx.clearRect(0,0,W,H);

  // Background gradient (deep ocean feel)
  const bg = ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H));
  bg.addColorStop(0,'rgba(0,18,35,1)');
  bg.addColorStop(1,'rgba(1,5,15,1)');
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,W,H);

  // Sort points by distance from camera (painter's algorithm)
  // Camera is looking from outside, so sort by dot product with cam forward
  const camFwd = getCamForward();
  const sorted = cloudPoints.map(p => {
    const {sx,sy} = project(p.x,p.y,p.z);
    // Depth = how far along camera forward vector this point is
    const depth = p.x * camFwd.x + p.z * camFwd.z - p.y * 0.3;
    return {...p,sx,sy,depth};
  }).sort((a,b)=>b.depth-a.depth); // far to near


  // Draw point cloud — with backface culling
  const camS = Math.sin(camRotY), camC = Math.cos(camRotY);
  if (state.showDots) sorted.forEach(p => {
    // Backface cull: face must point toward the isometric camera
    if (p.nx * 0.82 * camS + p.ny * 0.55 + p.nz * 0.82 * camC <= 0) return;
    const sz = p.type==='floor'||p.type==='surface' ? 0.8 : 1.0;
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, sz, 0, Math.PI*2);
    ctx.fillStyle = ptColor(p.type, 0.85, p.yFrac);
    ctx.fill();
  });

  // Wireframe overlay
  if (state.showWireframe) {
    ctx.save();
    ctx.lineCap = 'round';
    wallEdges.forEach(e => {
      const pa = project(e.ax, e.ay, e.az);
      const pb = project(e.bx, e.by, e.bz);
      ctx.strokeStyle = e.type === 'terrain' ? `rgba(80,160,90,0.3)` : `rgba(0,200,255,0.45)`;
      ctx.lineWidth = wireframeScale * 0.5;
      ctx.beginPath(); ctx.moveTo(pa.sx, pa.sy); ctx.lineTo(pb.sx, pb.sy); ctx.stroke();
    });
    ctx.restore();
  }

  // Grid overlay on floor
  for (let gx=0;gx<=GRID.W;gx+=2) {
    const p1 = project(gx,0,0), p2 = project(gx,0,GRID.D);
    ctx.beginPath();
    ctx.moveTo(p1.sx,p1.sy); ctx.lineTo(p2.sx,p2.sy);
    ctx.strokeStyle = 'rgba(0,150,200,0.08)';
    ctx.lineWidth=0.5; ctx.stroke();
  }
  for (let gz=0;gz<=GRID.D;gz+=2) {
    const p1=project(0,0,gz), p2=project(GRID.W,0,gz);
    ctx.beginPath();
    ctx.moveTo(p1.sx,p1.sy); ctx.lineTo(p2.sx,p2.sy);
    ctx.strokeStyle='rgba(0,150,200,0.08)';
    ctx.lineWidth=0.5; ctx.stroke();
  }

  // Surface grid (ceiling)
  for (let gx=0;gx<=GRID.W;gx+=2) {
    const p1=project(gx,GRID.H,0), p2=project(gx,GRID.H,GRID.D);
    ctx.beginPath(); ctx.moveTo(p1.sx,p1.sy); ctx.lineTo(p2.sx,p2.sy);
    ctx.strokeStyle='rgba(0,220,255,0.06)'; ctx.lineWidth=0.5; ctx.stroke();
  }

  // Sonar ping rings
  state.sonarPings = state.sonarPings.filter(p => p.r < 60);
  state.sonarPings.forEach(ping => {
    ping.r += 0.8;
    const pingPos = project(state.player.x, state.player.y, state.player.z);
    ctx.beginPath();
    ctx.arc(pingPos.sx, pingPos.sy, ping.r * 2, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(0,255,157,${Math.max(0,0.6-ping.r/60)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Enemy sonar ping rings (red, radiating from enemy position)
  state.enemyPings.forEach(p => {
    if (!state.enemy.alive) return;
    const ep = project(p.wx, state.enemy.y, p.wz);
    if (!ep) return;
    ctx.beginPath();
    ctx.arc(ep.sx, ep.sy, p.r * 2.2, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(255,60,60,${p.alpha * 0.55})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });

  // Torpedoes
  state.torpedoes.forEach(t => {
    const torpPos = project(t.x, t.y, t.z);
    ctx.beginPath();
    ctx.arc(torpPos.sx,torpPos.sy,4,0,Math.PI*2);
    ctx.fillStyle='rgba(255,170,0,0.9)';
    ctx.shadowBlur=12; ctx.shadowColor='#ffaa00';
    ctx.fill(); ctx.shadowBlur=0;
    const torpPos2 = project(t.x-t.dx*0.8, t.y-t.dy*0.8, t.z-t.dz*0.8);
    ctx.beginPath();
    ctx.moveTo(torpPos.sx,torpPos.sy); ctx.lineTo(torpPos2.sx,torpPos2.sy);
    ctx.strokeStyle='rgba(255,170,0,0.3)'; ctx.lineWidth=2; ctx.stroke();
  });

  // Firing solution predicted intercept marker
  if (state.firingSolution) {
    const fs = state.firingSolution;
    const fp = project(fs.x, fs.y, fs.z);
    const pulse = 0.6 + Math.sin(state.animFrame * 0.15) * 0.4;
    const fsSize = 16;
    ctx.strokeStyle = `rgba(255,200,0,${pulse})`;
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 12; ctx.shadowColor = '#ffcc00';
    ctx.beginPath(); ctx.arc(fp.sx, fp.sy, fsSize/2, 0, Math.PI*2); ctx.stroke();
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([tx,ty]) => {
      ctx.beginPath();
      ctx.moveTo(fp.sx + tx*(fsSize/2+4), fp.sy + ty*(fsSize/2+4));
      ctx.lineTo(fp.sx + tx*(fsSize/2+8), fp.sy + ty*(fsSize/2+8));
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
    ctx.font = '8px Share Tech Mono';
    ctx.fillStyle = `rgba(255,200,0,${pulse})`;
    ctx.textAlign = 'left';
    ctx.fillText('INTERCEPT', fp.sx + 12, fp.sy - 4);
    ctx.fillText(`${fs.x.toFixed(0)},${fs.y.toFixed(0)},${fs.z.toFixed(0)}`, fp.sx + 12, fp.sy + 6);
  }

  // Aim cursor (manual torpedo mode)
  if (state.aimCursor && state.mode === 'torpedo') {
    const ap = project(state.aimCursor.x, state.aimCursor.y, state.aimCursor.z);
    const acSize = 14;
    ctx.strokeStyle='rgba(255,68,68,0.9)';
    ctx.lineWidth=1.5;
    ctx.shadowBlur=10; ctx.shadowColor='#ff4444';
    ctx.strokeRect(ap.sx-acSize/2, ap.sy-acSize/2, acSize, acSize);
    [[0,0],[1,0],[0,1],[1,1]].forEach(([cx2,cy2]) => {
      const bx = ap.sx - acSize/2 + cx2*acSize;
      const by = ap.sy - acSize/2 + cy2*acSize;
      ctx.beginPath();
      ctx.moveTo(bx + (cx2?4:-4), by);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx, by + (cy2?4:-4));
      ctx.stroke();
    });
    ctx.shadowBlur=0;
    const aimPlayerPos = project(state.player.x, state.player.y, state.player.z);
    ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(aimPlayerPos.sx,aimPlayerPos.sy); ctx.lineTo(ap.sx,ap.sy);
    ctx.strokeStyle='rgba(255,68,68,0.3)'; ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw subs
  drawSub(state.player, '#00e5ff', 'SUB ALPHA', false, 1.0);
  if (state.enemy.alive) {
    const effectiveAlpha = state.forceReveal ? 1.0 : state.revealAlpha;
    const showEnemySub = state.forceReveal || state.revealed || state.revealAlpha > 0;
    if (showEnemySub) {
      state.enemyTrail.forEach((t, i) => {
        const trailAlpha = effectiveAlpha * (1 - t.age/300) * (i/Math.max(1,state.enemyTrail.length)) * 0.5;
        if (trailAlpha > 0.02) {
          const trailPos = project(t.x, t.y, t.z);
          ctx.beginPath();
          ctx.arc(trailPos.sx, trailPos.sy, 3, 0, Math.PI*2);
          ctx.fillStyle = `rgba(255,68,68,${trailAlpha})`;
          ctx.shadowBlur = 6; ctx.shadowColor = '#ff4444';
          ctx.fill(); ctx.shadowBlur = 0;
        }
      });
    }
    drawSub(state.enemy, '#ff4444', 'BRAVO', !showEnemySub, effectiveAlpha);
  }

  // Draw whales
  if (state.whales) state.whales.forEach(function(w){ drawWhale(w); });

  // Draw megalodons
  if (state.megalodons) state.megalodons.forEach(function(m){ drawMegalodon(m); });

  // Draw squids
  if (state.squids) state.squids.forEach(function(s){ drawSquid(s); });

  // Explosions — drawn on top of everything
  drawExplosions();

  // Depth markers on left edge
  for (let d=0; d<=GRID.H; d+=2) {
    const p = project(0, d, 0);
    ctx.fillStyle='rgba(0,180,220,0.4)';
    ctx.font='8px Share Tech Mono';
    ctx.fillText(`${-d*2}m`, p.sx-28, p.sy+3);
  }
}

function drawSub(sub, color, label, hidden=false, alpha=1.0) {
  const sp = project(sub.x, sub.y, sub.z);
  if (hidden || alpha < 0.02) return;

  const isEnemy = color === '#ff4444' || color.includes('255,68,68');
  const col     = isEnemy ? '#ff4444' : '#00e5ff';
  const colFill = isEnemy ? 'rgba(255,68,68,0.11)' : 'rgba(0,180,255,0.10)';
  const colHi   = isEnemy ? 'rgba(255,150,150,0.38)' : 'rgba(120,235,255,0.42)';
  const colDim  = isEnemy ? 'rgba(255,100,100,0.22)' : 'rgba(0,200,255,0.22)';

  // Forward vector in world space → screen angle (bow = +X axis in local space)
  const fwdX = isEnemy ? Math.sin(sub.heading) : Math.sin(state.periAngleH);
  const fwdZ = isEnemy ? Math.cos(sub.heading)  : -Math.cos(state.periAngleH);
  const sp2  = project(sub.x + fwdX * 2, sub.y, sub.z + fwdZ * 2);
  const screenAngle = Math.atan2(sp2.sy - sp.sy, sp2.sx - sp.sx);

  ctx.save();
  ctx.translate(sp.sx, sp.sy);
  ctx.rotate(screenAngle); // orient hull along actual heading
  ctx.globalAlpha = alpha;

  const haloR = isEnemy ? 44 : 34;
  const grd = ctx.createRadialGradient(0,0,0,0,0,haloR);
  grd.addColorStop(0, isEnemy ? 'rgba(255,68,68,0.16)' : 'rgba(0,229,255,0.13)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(0,0,haloR,0,Math.PI*2); ctx.fill();

  ctx.shadowBlur = 10; ctx.shadowColor = col;

  if (!isEnemy) {
    // ── VIRGINIA CLASS SSN (Alpha) ──
    // Bow → +X (right), Stern → -X (left).  Length ≈ 44px, beam ≈ 12px.

    // Main hull — long slim cigar, tapered nose and tail
    ctx.beginPath();
    ctx.moveTo(22, 0);                                        // bow tip
    ctx.bezierCurveTo(22,-2,  14,-6,   2,-6);
    ctx.bezierCurveTo(-4,-6, -14,-5, -20,-3);
    ctx.bezierCurveTo(-22,-1,-22, 1, -20, 3);
    ctx.bezierCurveTo(-14, 5,  -4, 6,   2,  6);
    ctx.bezierCurveTo(14,  6,  22,  2,  22, 0);
    ctx.closePath();
    ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1.3;
    ctx.fill(); ctx.stroke();

    // Top-deck ridge highlight
    ctx.beginPath();
    ctx.moveTo(18,-2); ctx.bezierCurveTo(6,-5, -6,-5, -16,-2);
    ctx.strokeStyle = colHi; ctx.lineWidth = 0.8; ctx.stroke();

    // Keel centreline
    ctx.beginPath(); ctx.moveTo(18,0); ctx.lineTo(-18,0);
    ctx.strokeStyle = colDim; ctx.lineWidth = 0.5; ctx.stroke();

    // Sail — compact, swept-back, 1/3 from bow (x≈8)
    ctx.beginPath();
    ctx.moveTo(10,-6); ctx.lineTo(8,-15);
    ctx.bezierCurveTo(8,-17, 14,-17, 14,-15);
    ctx.lineTo(14,-6);
    ctx.closePath();
    ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1.1;
    ctx.fill(); ctx.stroke();

    // Periscope / mast cluster
    ctx.beginPath(); ctx.moveTo(12,-15); ctx.lineTo(12,-20); ctx.lineTo(14,-20);
    ctx.strokeStyle = col; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10,-14); ctx.lineTo(10,-18);
    ctx.strokeStyle = colHi; ctx.lineWidth = 0.7; ctx.stroke();

    // Fairwater (sail) planes — horizontal fins each side of sail
    [[-1],[1]].forEach(([s]) => {
      ctx.beginPath();
      ctx.moveTo(10, s*6); ctx.lineTo(6, s*10); ctx.lineTo(14, s*9); ctx.lineTo(14, s*6);
      ctx.closePath();
      ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 0.8;
      ctx.fill(); ctx.stroke();
    });

    // Stern cruciform X-planes
    [[-1],[1]].forEach(([s]) => {
      ctx.beginPath();
      ctx.moveTo(-16, s*3); ctx.lineTo(-22, s*9); ctx.lineTo(-22, s*4); ctx.lineTo(-18, 0);
      ctx.closePath();
      ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 0.85;
      ctx.fill(); ctx.stroke();
    });
    // Vertical rudder
    ctx.beginPath();
    ctx.moveTo(-16,-2); ctx.lineTo(-23,-7); ctx.lineTo(-23,7); ctx.lineTo(-16,2);
    ctx.closePath();
    ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 0.85;
    ctx.fill(); ctx.stroke();

    // Single large pump-jet / propeller at stern
    ctx.save(); ctx.translate(-22, 0);
    const pSpin = state.animFrame * 0.13;
    for (let b=0; b<7; b++) {
      ctx.save(); ctx.rotate(pSpin + b*Math.PI*2/7);
      ctx.beginPath(); ctx.ellipse(0,-3.5,1.1,3.5,0.25,0,Math.PI*2);
      ctx.fillStyle = col; ctx.globalAlpha = 0.5*alpha; ctx.fill(); ctx.restore();
    }
    // Hub
    ctx.beginPath(); ctx.arc(0,0,1.8,0,Math.PI*2);
    ctx.fillStyle = col; ctx.globalAlpha = 0.7*alpha; ctx.fill();
    ctx.restore();

    // 4 torpedo tube ports at bow
    [-2.5,-0.8,0.8,2.5].forEach(oy => {
      ctx.beginPath(); ctx.arc(22,oy,1.1,0,Math.PI*2);
      ctx.fillStyle=col; ctx.globalAlpha=0.55*alpha; ctx.fill();
    });

  } else {
    // ── TYPHOON CLASS SSBN (Bravo) ──
    // Massive: bow → +X, stern → -X.  Length ≈ 52px, beam ≈ 24px.

    // Outer pressure hull — very wide, blunt rounded bow
    ctx.beginPath();
    ctx.moveTo(26, 0);                                        // bow tip (still rounded)
    ctx.bezierCurveTo(26,-8,  18,-14,  4,-14);
    ctx.bezierCurveTo(-6,-14,-18,-12,-24, -7);
    ctx.bezierCurveTo(-26,-4,-26,  4, -24,  7);
    ctx.bezierCurveTo(-18, 12, -6, 14,  4, 14);
    ctx.bezierCurveTo(18, 14,  26,  8,  26,  0);
    ctx.closePath();
    ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.fill(); ctx.stroke();

    // Twin pressure-hull spine ridges (the distinctive Typhoon double-hull)
    [-5,5].forEach(ry => {
      ctx.beginPath();
      ctx.moveTo(22,ry); ctx.bezierCurveTo(6,ry*1.2,-10,ry*1.2,-22,ry);
      ctx.strokeStyle = colDim; ctx.lineWidth = 0.8; ctx.stroke();
    });

    // Outer hull highlight
    ctx.beginPath();
    ctx.moveTo(20,-8); ctx.bezierCurveTo(4,-12,-12,-12,-20,-8);
    ctx.strokeStyle = colHi; ctx.lineWidth = 0.8; ctx.stroke();

    // Wide, prominent sail — forward-biased (≈1/4 from bow)
    ctx.beginPath();
    ctx.moveTo(14,-14); ctx.lineTo(12,-26);
    ctx.bezierCurveTo(12,-29, 2,-29, 2,-26);
    ctx.lineTo(2,-14);
    ctx.closePath();
    ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1.3;
    ctx.fill(); ctx.stroke();

    // Sail top detail
    ctx.beginPath(); ctx.moveTo(8,-14); ctx.lineTo(8,-26);
    ctx.strokeStyle = colDim; ctx.lineWidth = 0.6; ctx.stroke();

    // Periscope cluster atop sail
    [[4,-26],[7,-26],[10,-26]].forEach(([x,y]) => {
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y-5);
      ctx.strokeStyle = col; ctx.lineWidth = 0.9; ctx.stroke();
    });

    // Large swept-back stern stabilisers
    [[-1],[1]].forEach(([s]) => {
      ctx.beginPath();
      ctx.moveTo(-20, s*5); ctx.lineTo(-28, s*18); ctx.lineTo(-26, s*10); ctx.lineTo(-22, s*4);
      ctx.closePath();
      ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1.1;
      ctx.fill(); ctx.stroke();
    });
    // Vertical tail fin / rudder
    ctx.beginPath();
    ctx.moveTo(-18,-4); ctx.lineTo(-28,-12); ctx.lineTo(-28,12); ctx.lineTo(-18,4);
    ctx.closePath();
    ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1.1;
    ctx.fill(); ctx.stroke();

    // Twin counter-rotating propellers (signature Typhoon feature)
    [-6,6].forEach((yOff, idx) => {
      ctx.save(); ctx.translate(-26, yOff);
      const pSpin = state.animFrame * (idx===0 ? 0.09 : -0.09); // counter-rotate
      for (let b=0; b<5; b++) {
        ctx.save(); ctx.rotate(pSpin + b*Math.PI*2/5);
        ctx.beginPath(); ctx.ellipse(0,-3,1.0,3,0.2,0,Math.PI*2);
        ctx.fillStyle = col; ctx.globalAlpha = 0.48*alpha; ctx.fill(); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0,0,1.6,0,Math.PI*2);
      ctx.fillStyle = col; ctx.globalAlpha = 0.65*alpha; ctx.fill();
      ctx.restore();
    });

    // 6 torpedo tube ports at bow (wider spread)
    [-5,-2,1,-1,2,5].forEach((oy,i) => {
      if (i > 3) return;
      ctx.beginPath(); ctx.arc(26, oy*1.2, 1.3, 0, Math.PI*2);
      ctx.fillStyle=col; ctx.globalAlpha=0.55*alpha; ctx.fill();
    });
  }

  ctx.shadowBlur = 0; ctx.globalAlpha = 1.0;
  ctx.restore();

  // Labels — offset perpendicular to heading so they don't overlap hull
  ctx.globalAlpha = alpha;
  ctx.font = '8px Share Tech Mono';
  ctx.textAlign = 'left';
  ctx.fillStyle = col;
  ctx.fillText(label, sp.sx+30, sp.sy-12);
  ctx.fillStyle = isEnemy ? 'rgba(255,68,68,0.5)' : 'rgba(0,200,255,0.5)';
  ctx.fillText(`${sub.x.toFixed(0)},${sub.y.toFixed(0)},${sub.z.toFixed(0)}`, sp.sx+30, sp.sy-2);
  ctx.globalAlpha = 1.0;
}

// ── EXPLOSION EFFECTS ──
function spawnExplosion(wx, wy, wz, isEnemy, customCol) {
  const col = customCol || (isEnemy ? '#ff4444' : '#00e5ff');
  state.explosions.push({
    wx, wy, wz,
    col,
    age: 0,
    duration: 120, // frames
    rings: [
      { delay: 0,  speed: 0.6, maxR: 60 },
      { delay: 8,  speed: 0.5, maxR: 80 },
      { delay: 16, speed: 0.4, maxR: 50 },
      { delay: 24, speed: 0.3, maxR: 35 },
    ],
    // debris particles in screen space
    debris: (function(){
    var _a=[];
    for(var _i=0;_i<16;_i++) _a.push({
      angle: Math.random() * Math.PI * 2,
      speed: 1.5 + Math.random() * 3,
      dist: 0,
      size: 1 + Math.random() * 2,
      velocity: { x: 0, y: 0, z: 0 }
    });
    return _a;
  })()
  });
}

function revealPlayerToEnemy(frames) {
  state.enemyKnowsPlayer = true;
  state.enemyKnowsTimer = Math.max(state.enemyKnowsTimer, frames);
  state.enemyLastKnown = {x: state.player.x, z: state.player.z};
}

// ── SCORE HELPERS ──
function addScore(amount) {
  state.score += amount;
  const s = state.score;
  const el1 = document.getElementById('hud-score');
  const el2 = document.getElementById('peri-score');
  const el3 = document.getElementById('sb-score');
  if (el1) el1.textContent = s;
  if (el2) el2.textContent = s;
  if (el3) el3.textContent = s;
}

function _mkPuff(wx, wy, wz, col, maxR, rings, debrisN) {
  state.explosions.push({
    wx, wy, wz, col, age: 0, duration: 70,
    rings,
    debris: (function(){
      var _a = [];
      for (var _i = 0; _i < debrisN; _i++) _a.push({
        angle: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.2,
        dist: 0, size: 0.5 + Math.random() * 1.0,
        velocity: { x: 0, y: 0, z: 0 }
      });
      return _a;
    })()
  });
}
function spawnFirePuff(wx, wy, wz) {
  _mkPuff(wx, wy, wz, '#ff6600',
    30, [{ delay:0, speed:0.35, maxR:28 },{ delay:5, speed:0.25, maxR:18 }], 6);
}
function spawnBloodPuff(wx, wy, wz) {
  _mkPuff(wx, wy, wz, '#cc1111',
    20, [{ delay:0, speed:0.3, maxR:22 },{ delay:4, speed:0.2, maxR:14 }], 5);
}
function spawnBubblePuff(wx, wy, wz) {
  _mkPuff(wx, wy, wz, '#88ccdd',
    18, [{ delay:0, speed:0.25, maxR:16 },{ delay:3, speed:0.18, maxR:10 }], 4);
}

function drawExplosions(projFn) {
  state.explosions = state.explosions.filter(ex => ex.age < ex.duration);
  state.explosions.forEach(ex => {
    ex.age++;
    // Use passed projection fn, or fall back to view-mode default
    const sp = projFn
      ? projFn(ex.wx, ex.wy, ex.wz)
      : (state.viewMode === 'periscope'
          ? projectPeriscope(ex.wx, ex.wy, ex.wz)
          : project(ex.wx, ex.wy, ex.wz));
    if (!sp) return; // behind camera
    const t = ex.age / ex.duration;
    const baseCol = ex.col === '#ff4444' ? '255,68,68' : ex.col === '#00ff66' ? '0,255,102' : '0,229,255';

    // ── RINGS ──
    ex.rings.forEach(ring => {
      const rAge = ex.age - ring.delay;
      if (rAge <= 0) return;
      const r = rAge * ring.speed;
      if (r > ring.maxR) return;
      const progress = r / ring.maxR;
      const alpha = (1 - progress) * (1 - t * 0.5);

      ctx.beginPath();
      ctx.arc(sp.sx, sp.sy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${baseCol},${alpha.toFixed(2)})`;
      ctx.lineWidth = 2.5 * (1 - progress * 0.7);
      ctx.shadowBlur = 12 * (1 - progress);
      ctx.shadowColor = ex.col;
      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // ── CORE FLASH ──
    if (ex.age < 20) {
      const flashAlpha = (1 - ex.age / 20) * 0.9;
      const flashR = ex.age * 2.5;
      const grad = ctx.createRadialGradient(sp.sx, sp.sy, 0, sp.sx, sp.sy, flashR);
      grad.addColorStop(0, `rgba(255,255,255,${flashAlpha})`);
      grad.addColorStop(0.3, `rgba(${baseCol},${flashAlpha * 0.8})`);
      grad.addColorStop(1, `rgba(${baseCol},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sp.sx, sp.sy, flashR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── DEBRIS PARTICLES ──
    ex.debris.forEach(d => {
      d.dist += d.speed * (1 - t * 0.8);
      const dx = Math.cos(d.angle) * d.dist;
      const dy = Math.sin(d.angle) * d.dist * 0.5; // flatten vertically
      const alpha = Math.max(0, 1 - t * 1.4);
      ctx.beginPath();
      ctx.arc(sp.sx + dx, sp.sy + dy, d.size * (1 - t), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${baseCol},${alpha.toFixed(2)})`;
      ctx.shadowBlur = 4;
      ctx.shadowColor = ex.col;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // ── "DESTROYED" TEXT LABEL — fades in then out ──
    if (ex.col === '#ff4444' && ex.age > 10 && ex.age < 80) {
      const labelAlpha = ex.age < 30
        ? (ex.age - 10) / 20
        : 1 - (ex.age - 30) / 50;
      ctx.font = 'bold 11px Share Tech Mono';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,68,68,${labelAlpha.toFixed(2)})`;
      ctx.shadowBlur = 10; ctx.shadowColor = '#ff4444';
      ctx.fillText('TARGET DESTROYED', sp.sx, sp.sy - 30 - ex.age * 0.3);
      ctx.shadowBlur = 0;
    }
  });
}

// ── HULL DAMAGE & DEATH ──
var _imploding = false;
var _gameOver = false;
function applyHullDamage(dmg, msg) {
  if (_imploding) return;
  state.hull = Math.max(0, state.hull - dmg);
  document.getElementById('sys-hull').textContent = state.hull + '%';
  document.getElementById('peri-hull').textContent = state.hull + '%';
  if (_scoreboardOn) updateScoreboard();
  if (msg) addEvent(msg, true);
  if (state.hull <= 0) triggerImplosion();
}

function updateLivesDisplay() {
  var ids = ['p1','p2','p3'];
  for (var i = 0; i < 3; i++) {
    var alive = i < state.lives;
    var h = document.getElementById('hud-life-' + ids[i]);
    var p = document.getElementById('life-' + ids[i]);
    if (h) { h.classList.toggle('dead', !alive); }
    if (p) { p.classList.toggle('dead', !alive); }
  }
}

function gameOver() {
  _imploding = false;
  addEvent('▸ ALL SUBMARINES LOST — MISSION FAILED', true);
  setTimeout(function() {
    _gameOver = true;
    document.getElementById('periscope-overlay').classList.remove('active');
    document.getElementById('hud').style.display = 'none';
    document.getElementById('controls-wrap').style.display = 'none';
    document.getElementById('sonar-wrap').style.display = 'none';
    document.getElementById('canvas').style.display = 'none';
    document.getElementById('intro-screen').style.display = '';
  }, 2500);
}

function triggerImplosion() {
  if (_imploding) return;
  _imploding = true;
  playExplosion(false);
  spawnExplosion(state.player.x, state.player.y, state.player.z, false);
  addEvent('⚠ HULL FAILURE — IMPLOSION', true);
  setTimeout(function() {
    // Second bigger explosion — implosion crush
    spawnExplosion(state.player.x, state.player.y, state.player.z, false);
    spawnExplosion(state.player.x, state.player.y, state.player.z, false);
    state.lives = Math.max(0, state.lives - 1);
    updateLivesDisplay();
    if (state.lives <= 0) {
      gameOver();
      return;
    }
    addEvent('▸ SUBMARINE LOST — RESPAWNING (' + state.lives + ' LEFT)', false);
    setTimeout(function() {
      state.hull = 100;
      _imploding = false;
      document.getElementById('sys-hull').textContent = '100%';
      document.getElementById('peri-hull').textContent = '100%';
      spawnPlayer();
    }, 2500);
  }, 800);
}

// ── UPDATE ──
function update() {
  state.animFrame++;
  state.time++;
  const _depth = GRID.H - state.player.y;
  if (_depth > state.maxDepth) state.maxDepth = _depth;
  if (_scoreboardOn && state.animFrame % 20 === 0) updateScoreboard();

  // ── ENEMY AI — state machine (movement + firing) ──
  if (state.enemy.alive) updateEnemyAI();

  // Update cooldowns
  // Update fire button every frame using real time
  const _ready = torpReady();
  const _secs = _ready ? 'FIRE' : torpSecsLeft() + 's';
  const _fb2 = document.getElementById('peri-btn-fire');
  if (_fb2) {
    const _sp = _fb2.querySelector('span');
    if (_sp) _sp.textContent = _secs;
    _fb2.style.opacity = _ready ? '1' : '0.45';
    _fb2.style.borderColor = _ready ? '' : 'rgba(255,100,100,0.6)';
  }

  // Age trail points (trail updated inside updateEnemyAI)
  state.enemyTrail.forEach(t => t.age++);
  state.enemyTrail = state.enemyTrail.filter(t => t.age < 300);

  // ── CRUSH DEPTH CHECK ──
  var _crushFrac = getCrushFrac();
  var _crushY = _crushFrac * GRID.H; // min safe y (world units)
  if (_crushFrac > 0 && state.player.y < _crushY) {
    // Below crush depth — take hull damage every 6 frames
    if (state.time % 6 === 0) {
      state.hull = Math.max(0, state.hull - 1);
      document.getElementById('sys-hull').textContent = state.hull + '%';
      if (state.time % 60 === 0) addEvent('⚠ CRUSH DEPTH — HULL FAILING', true);
    }
    if (state.hull <= 0) triggerImplosion();
  }

  // ── SURFACED HULL REPAIR ──
  if (state.viewMode === 'surfaced' && state.hull < 100 && !_imploding) {
    if (state.time % 180 === 0) {
      state.hull = Math.min(100, state.hull + 1);
      document.getElementById('sys-hull').textContent = state.hull + '%';
      document.getElementById('peri-hull').textContent = state.hull + '%';
      if (state.hull % 10 === 0) addEvent('▸ HULL REPAIR — ' + state.hull + '%', false);
    }
    // Ships become aggressive when player is surfaced
    if (state.time % 240 === 0 && state.ships) {
      addEvent('⚠ SURFACE CONTACT — ENEMY SHIPS CLOSING', true);
    }
  }

  // Acoustic lock — how well the enemy is centred in the periscope crosshairs
  state.acousticLock = 0;
  if (state.enemy.alive && (state.viewMode === 'periscope' || state.viewMode === 'surface')) {
    var _aep = projectPeriscope(state.enemy.x, state.enemy.y, state.enemy.z);
    if (_aep && _aep.depth > 0.5) {
      var _adx = _aep.sx - W/2, _ady = _aep.sy - H*0.44;
      var _adist = Math.sqrt(_adx*_adx + _ady*_ady);
      var _lockPxR = Math.min(W, H) * 0.52 * 0.15; // innermost ring radius px
      state.acousticLock = Math.max(0, 1 - _adist / _lockPxR);
    }
  }

  // Update surface ships
  updateShips();
  updateShells();
  updateNoisemakers();
  updateDepthCharges();
  updateWhales();
  updateMegalodons();
  updateSquids();

  // Update torpedoes
  state.torpedoes = state.torpedoes.filter(t => {
    t.progress += t.speed;
    if (t.isHoming) {
      // Homing torpedo — steer then move directly (not from origin formula)
      _steerHomingTorp(t);
      t.x += t.dx * t.speed;
      t.y += (t.dy || 0) * t.speed;
      t.z += t.dz * t.speed;
      // ── TERRAIN COLLISION — the Red October moment ──
      const _thx = Math.round(t.x), _thz = Math.round(t.z);
      if (t.x < 1 || t.x >= GRID.W-1 || t.z < 1 || t.z >= GRID.D-1 ||
          (FLOOR_PLAN[_thz] && FLOOR_PLAN[_thz][_thx])) {
        spawnExplosion(t.x, t.y, t.z, false);
        playExplosion(false);
        addEvent('▸ ACOUSTIC — TERRAIN DETONATION', false);
        return false;
      }
    } else {
      t.x = t.ox + t.dx * t.progress;
      t.y = t.oy + t.dy * t.progress;
      t.z = t.oz + t.dz * t.progress;
    }

    // Hit enemy (armed after travelling minimum safe distance)
    const travelDist = t.isHoming ? t.progress : Math.sqrt((t.x-t.ox)*(t.x-t.ox)+(t.y-t.oy)*(t.y-t.oy)+(t.z-t.oz)*(t.z-t.oz));
    // OBB check — oriented along enemy heading to match hull footprint
    var _ehDx = t.x - state.enemy.x, _ehDy = t.y - state.enemy.y, _ehDz = t.z - state.enemy.z;
    var _ehCos = Math.cos(state.enemy.heading), _ehSin = Math.sin(state.enemy.heading);
    var _ehLong = _ehDx * _ehSin + _ehDz * _ehCos;
    var _ehLat  = _ehDx * _ehCos - _ehDz * _ehSin;
    if (travelDist > 3.5 && !t.isEnemy && state.enemy.alive &&
        Math.abs(_ehLong) < 1.85 && Math.abs(_ehLat) < 0.8 && Math.abs(_ehDy) < 0.9) {
      state.enemy.hits++;
      state.torpsHit++;
      addScore(10);
      spawnBubblePuff(t.x, t.y, t.z);
      state.enemy.bubbling = true;
      if (state.enemy.hits >= 3) {
        state.enemy.alive = false;
        state.enemy.hits = 0;
        state.kills++;
        addScore(30);
        playExplosion(true);
        spawnExplosion(t.x, t.y, t.z, true);
        document.getElementById('kill-count').textContent = state.kills;
        document.getElementById('enemy-status').textContent = 'DESTROYED';
        addEvent('⊛ DIRECT HIT — BRAVO DESTROYED (+30)', false);
        setTimeout(()=>respawnEnemy(),5000);
      } else {
        playExplosion(false);
        addEvent(`⊛ BRAVO HIT ${state.enemy.hits}/3 — LEAKING BUBBLES (+10)`, false);
      }
      return false;
    }

    // Hit whale
    if (travelDist > 3.5 && !t.isEnemy && state.whales) {
      for (var _wi = 0; _wi < state.whales.length; _wi++) {
        var _wh = state.whales[_wi];
        if (!_wh.alive) continue;
        if (Math.abs(t.x-_wh.x)<1.5 && Math.abs(t.y-_wh.y)<1.8 && Math.abs(t.z-_wh.z)<1.5) {
          _wh.alive = false;
          if (_wh.audio) { try { _wh.audio.pause(); _wh.audio.currentTime = 0; } catch(e){} }
          addScore(-10);
          playExplosion(false);
          spawnExplosion(t.x, t.y, t.z, false, '#00ff66');
          addEvent('⚠ YOU JUST BLEW UP A WHALE! (-10)', true);
          setTimeout(function(){ addEvent('⚠ WHAT THE HELL — THAT WAS A WHALE!', true); }, 1200);
          return false;
        }
      }
    }

    // Hit megalodon
    if (travelDist > 3.5 && !t.isEnemy && state.megalodons) {
      for (var _mi = 0; _mi < state.megalodons.length; _mi++) {
        var _meg = state.megalodons[_mi];
        if (!_meg.alive) continue;
        if (Math.abs(t.x-_meg.x)<2.0 && Math.abs(t.y-_meg.y)<2.0 && Math.abs(t.z-_meg.z)<2.0) {
          _meg.hits++;
          addScore(10);
          spawnBloodPuff(t.x, t.y, t.z);
          _meg.bleeding = true;
          if (_meg.hits >= _meg.maxHits) {
            _meg.alive = false;
            addScore(20);
            playExplosion(false);
            spawnExplosion(t.x, t.y, t.z, false, '#6688aa');
            addEvent('⊛ MEGALODON TERMINATED (+20)', false);
            setTimeout(function(){ addEvent('▸ MEGALODON EXTINCT — WHALES SAFE', false); }, 1500);
          } else {
            playExplosion(false);
            addEvent('⊛ MEGALODON HIT — BLEEDING (+10)', false);
          }
          return false;
        }
      }
    }

    // Hit giant squid
    if (travelDist > 3.5 && !t.isEnemy && state.squids) {
      for (var _si = 0; _si < state.squids.length; _si++) {
        var _sq = state.squids[_si];
        if (!_sq.alive) continue;
        if (Math.abs(t.x-_sq.x)<2.0 && Math.abs(t.y-_sq.y)<2.5 && Math.abs(t.z-_sq.z)<2.0) {
          _sq.alive = false;
          playExplosion(false);
          spawnExplosion(t.x, t.y, t.z, false, '#9933ff');
          spawnExplosion(t.x, t.y, t.z, false, '#cc44ff');
          addEvent('⊛ LEVIATHAN TAKE DOWN!', false);
          setTimeout(function(){ addEvent('▸ WAYPOINT MISSION UNLOCKED', false); }, 1000);
          setTimeout(function(){ startWaypointMission(); }, 1800);
          return false;
        }
      }
    }

    // Hit player (direct — armed after minimum safe distance)
    if (travelDist > 3.5 && t.isEnemy &&
        Math.abs(t.x-state.player.x)<2.0 &&
        Math.abs(t.y-state.player.y)<2.0 &&
        Math.abs(t.z-state.player.z)<2.0) {
      applyHullDamage(20, '⚠ DIRECT HIT — HULL BREACH');
      playExplosion(false);
      spawnExplosion(t.x, t.y, t.z, false);
      return false;
    }

    // Torpedo mine — hits surface and detonates against ships above
    if (t.isMine && t.y >= GRID.H) {
      let hitShip = false;
      if (state.ships) {
        state.ships.forEach(ship => {
          if (!ship.alive || ship.sinking) return;
          const mdx = t.x - ship.x, mdz = t.z - ship.z;
          if (Math.sqrt(mdx*mdx + mdz*mdz) < (ship.length || 8) * 0.5 + 3) {
            ship.sinking = true; ship.sinkY = GRID.H; ship.sinkVel = 0; ship.tilt = 0;
            playExplosionShip();
            spawnExplosion(ship.x, GRID.H, ship.z, true);
            spawnExplosion(ship.x + (Math.random()-0.5)*3, GRID.H, ship.z + (Math.random()-0.5)*3, true);
            state.kills++; state.torpsHit++;
            document.getElementById('kill-count').textContent = state.kills;
            addEvent('⊛ TORPEDO MINE — SHIP SUNK', false);
            hitShip = true;
          }
        });
      }
      spawnExplosion(t.x, GRID.H, t.z, hitShip);
      if (!hitShip) { playExplosion(false); addEvent('▸ MINE DETONATED — NO TARGET', false); }
      return false;
    }

    // Out of bounds or hit furniture — grace period of 4 units so torpedo clears the firer
    const atSurfaceLevel = t.y >= GRID.H - 1;
    const hitFurniture = !atSurfaceLevel && travelDist > 4.0 && inFurniture(t.x, t.y, t.z);
    if (hitFurniture) {
      spawnExplosion(t.x, t.y, t.z, false);
      addEvent('⊛ TORPEDO IMPACT — OBSTACLE', false);
      // Splash damage to player from nearby wall hit
      var _sdx = t.x-state.player.x, _sdy = t.y-state.player.y, _sdz = t.z-state.player.z;
      var _spdist = Math.sqrt(_sdx*_sdx+_sdy*_sdy+_sdz*_sdz);
      if (_spdist < 3) {
        applyHullDamage(10, '⚠ CLOSE MISS — SHOCKWAVE');
      } else if (_spdist < 6) {
        applyHullDamage(5, '▸ NEAR MISS — CONCUSSION');
      }
      return false;
    }
    return t.x>=0&&t.x<=GRID.W&&t.y>=0&&t.y<=GRID.H&&t.z>=0&&t.z<=GRID.D;
  });

  // Sonar reveal decay with smooth fade
  if (state.revealTimer > 0) {
    state.revealTimer--;
    // Fade out in last 120 frames
    state.revealAlpha = state.revealTimer < 120
      ? state.revealTimer / 120
      : 1.0;
  } else {
    state.revealed = false;
    state.revealAlpha = 0;
  }

  // Ping cooldown
  if (state.pingCooldown > 0) state.pingCooldown--;

  // Bubble trail on damaged Bravo
  if (state.enemy.alive && state.enemy.bubbling) {
    state.enemy.bubbleTimer = (state.enemy.bubbleTimer || 0) + 1;
    if (state.enemy.bubbleTimer % 50 === 0) spawnBubblePuff(state.enemy.x, state.enemy.y, state.enemy.z);
  }

  // Advance silent running ping reveal rings
  if (state.silentPings.length) {
    state.silentPings = state.silentPings.filter(p => {
      p.r += 0.18;
      p.alpha = Math.max(0, p.alpha - 0.005);
      return p.alpha > 0.01 && p.r < 36;
    });
  }

  // Linger the enemy contact after a silent ping sweeps past
  if (state.silentRunning && state.enemy.alive) {
    const pingHit = silentRevealAlpha(state.enemy.x, state.enemy.z);
    if (pingHit > state.enemySilentAlpha) {
      state.enemySilentAlpha = pingHit;
    } else {
      state.enemySilentAlpha = Math.max(0, state.enemySilentAlpha - 0.004);
    }
  } else {
    state.enemySilentAlpha = 0;
  }

  // ── ENEMY PINGS (silent running) ──
  if (state.silentRunning && state.enemy.alive) {
    state.enemyPingTimer--;
    if (state.enemyPingTimer <= 0) {
      state.enemyPingTimer = 720 + Math.floor(Math.random() * 720); // 12–24s between pings
      state.enemyPings.push({wx: state.enemy.x, wz: state.enemy.z, r: 0, alpha: 1.0});
      revealPlayerToEnemy(360);
      // Briefly reveal enemy on 3D views
      state.revealTimer = Math.max(state.revealTimer, 180);
      state.revealAlpha = 1.0;
      state.enemySilentAlpha = 1.0;
      playPing();
      addEvent('⚠ BRAVO PINGING — POSITION COMPROMISED', true);
    }
  }
  if (state.enemyPings.length) {
    state.enemyPings = state.enemyPings.filter(p => {
      p.r += 0.22;
      p.alpha = Math.max(0, p.alpha - 0.004);
      return p.alpha > 0.01 && p.r < 68;
    });
  }

  // ── ENEMY KNOWLEDGE DECAY (silent running) ──
  if (state.silentRunning) {
    if (state.enemyKnowsTimer > 0) {
      state.enemyKnowsTimer--;
      if (state.enemyKnowsTimer === 0) {
        state.enemyKnowsPlayer = false;
        addEvent('◎ CONTACT LOST — BRAVO IS BLIND', false);
      }
    }
  } else {
    // Standard steaming: enemy always knows player position
    state.enemyKnowsPlayer = true;
    state.enemyKnowsTimer = 0;
  }

  // Update HUD - y=GRID.H is surface (0m), y=0 is seabed (deepest)
  const depthM = ((GRID.H - state.player.y) * VOXEL_Y).toFixed(1);
  document.getElementById('depth-display').textContent = `-${depthM}m`;
  document.getElementById('torp-count').textContent = state.torpCount === Infinity ? '∞' : state.torpCount;
  const _hdgDeg = ((state.periAngleH * 180 / Math.PI + 180) % 360 + 360) % 360;
  document.getElementById('heading-display').textContent = padL(_hdgDeg.toFixed(0), 3, '0') + '°';

  // Clock
  const t = Math.floor(state.time/60);
  const h=padL(Math.floor(t/3600).toString(),2,'0');
  const m=padL(Math.floor((t%3600)/60).toString(),2,'0');
  const s=padL((t%60).toString(),2,'0');
  document.getElementById('clock').textContent = `${h}:${m}:${s}Z`;

  // ── WAYPOINT MISSION UPDATE ──
  const wpm = state.wpMission;
  if (!wpm.active && wpm.result === null) {
    if (--wpm.triggerIn <= 0) startWaypointMission();
  } else if (wpm.active) {
    wpm.timeLeft--;
    if (state.time % 60 === 0) updateWpPanel();
    if (wpm.timeLeft <= 0) { missionFailed(); return; }
    const nextWp = wpm.waypoints.find(w => w.num === wpm.nextRequired && !w.collected);
    if (nextWp) {
      const p = state.player;
      if (Math.abs(p.x-nextWp.x)<2 && Math.abs(p.y-nextWp.y)<2 && Math.abs(p.z-nextWp.z)<2)
        collectWaypoint(nextWp);
    }
  } else if (wpm.result !== null) {
    if (--wpm.resultTimer <= 0) {
      wpm.result = null;
      document.getElementById('wp-panel').style.display = 'none';
    }
  }
}

// Check if a position (with sub radius) overlaps any solid furniture
function isOccupied(x, y, z, radius = 0.6) {
  return furniture.some(f => {
    if (f.type==='floor'||f.type==='surface') return false;
    return (
      x + radius > f.x1 && x - radius < f.x2 &&
      y + radius > f.y1 && y - radius < f.y2 &&
      z + radius > f.z1 && z - radius < f.z2
    );
  });
}

// Check if a point is inside solid furniture (for torpedo)
function inFurniture(x, y, z, ignoreSurface=false) {
  return furniture.some(f => {
    if (f.type==='floor') return false;
    if (f.type==='surface' || ignoreSurface && f.type==='surface') return false;
    return x > f.x1 && x < f.x2 && y > f.y1 && y < f.y2 && z > f.z1 && z < f.z2;
  });
}

function respawnEnemy() {
  spawnEnemy('');
  state.enemy.aiState = 'hunt';
  state.enemy.aiTarget = null;
  state.enemy.aiTimer = 120;
  state.enemy.flankDir = Math.random() < 0.5 ? 1 : -1;
  document.getElementById('enemy-status').textContent='HUNTING';
  addEvent('▸ NEW CONTACT DETECTED', true);
}

function addEvent(msg, warn=false) {
  const el = document.createElement('div');
  el.className = 'event-msg' + (warn?' warn':'');
  el.textContent = msg;
  prependEl(document.getElementById('event-log'),el);
  setTimeout(()=>el.remove(),3000);
}

// ── CONTROLS ──
function movePlayer(dx,dy,dz) {
  if (state.mode === 'torpedo') {
    // Move aim cursor
    if (!state.aimCursor) state.aimCursor = {...state.player};
    state.aimCursor.x = Math.max(0,Math.min(GRID.W-1,state.aimCursor.x+dx));
    state.aimCursor.y = Math.max(0,Math.min(GRID.H-1,state.aimCursor.y+dy));
    state.aimCursor.z = Math.max(0,Math.min(GRID.D-1,state.aimCursor.z+dz));
    return;
  }
  const nx = Math.max(0.6, Math.min(GRID.W-0.6, state.player.x+dx));
  const ny = Math.max(0.6, Math.min(GRID.H + 1.5, state.player.y+dy));
  const nz = Math.max(0.6, Math.min(GRID.D-0.6, state.player.z+dz));
  if (!isOccupied(nx, ny, nz)) {
    state.player.x=nx; state.player.y=ny; state.player.z=nz;
    // Depth → viewMode transitions
    // Waterline is exactly GRID.H: above = surfaced (deck visible), below = periscope up or underwater
    if (ny >= GRID.H && state.viewMode !== 'surfaced') {
      state.preSurfaceView = (state.viewMode === 'command') ? 'command' : 'periscope';
      state.viewMode = 'surfaced';
      surfaceBearing = -state.periAngleH;
      setAmbientMode('surface');
      addEvent('▸ SURFACED — HULL RECHARGING', false);
      setTimeout(()=>addEvent('⚠ EXPOSED — ENEMY SHIPS ALERTED', true), 800);
    } else if (ny >= GRID.H - 1 && ny < GRID.H && state.viewMode === 'periscope') {
      state.preSurfaceView = 'periscope';
      state.viewMode = 'surface';
      surfaceBearing = -state.periAngleH;
      setAmbientMode('surface');
      addEvent('▸ PERISCOPE UP — SURFACE SCAN', false);
      setTimeout(()=>addEvent('▸ SHIPS ON SURFACE — PICK YOUR TARGET', true), 1000);
    } else if (ny >= GRID.H - 1 && ny < GRID.H && state.viewMode === 'surfaced' && state.preSurfaceView !== 'command') {
      state.viewMode = 'surface';
      setAmbientMode('surface');
      addEvent('▸ DIVING — PERISCOPE DEPTH', false);
    }
    // Auto exit surface/surfaced when diving — return to the view we came from
    if (ny < GRID.H - 1 && (state.viewMode === 'surface' || state.viewMode === 'surfaced')) {
      const returnTo = state.preSurfaceView || 'periscope';
      state.preSurfaceView = null;
      state.viewMode = returnTo;
      scopeMaskCanvas.style.display = returnTo === 'periscope' ? '' : 'none';
      setAmbientMode('underwater');
      playDiveSignal();
      addEvent(returnTo === 'command' ? '▸ COMMAND MAP — DIVING' : '▸ PERISCOPE — DIVING', false);
    }
  } else {
    if (!isOccupied(nx, state.player.y, state.player.z)) state.player.x=nx;
    else if (!isOccupied(state.player.x, ny, state.player.z)) state.player.y=ny;
    else if (!isOccupied(state.player.x, state.player.y, nz)) state.player.z=nz;
  }
}

// ── DRAG CONTROLS ──
// Left zone: XZ movement/aim. Right zone: depth.
// Two-finger anywhere: rotate camera.

const MOVE_THRESHOLD = 18; // px per cube step (smaller for larger grid)
const DEPTH_THRESHOLD = 22;

function setupDragZone(el, onDelta) {
  let startX = 0, startY = 0, accumX = 0, accumY = 0;
  let active = false;

  function start(x, y) {
    startX = x; startY = y;
    accumX = 0; accumY = 0;
    active = true;
    el.classList.add('active');
  }
  function move(x, y) {
    if (!active) return;
    accumX += x - startX;
    accumY += y - startY;
    startX = x; startY = y;
    // Fire steps
    while (accumX > MOVE_THRESHOLD)  { onDelta(1, 0);  accumX -= MOVE_THRESHOLD; }
    while (accumX < -MOVE_THRESHOLD) { onDelta(-1, 0); accumX += MOVE_THRESHOLD; }
    while (accumY > DEPTH_THRESHOLD)  { onDelta(0, 1);  accumY -= DEPTH_THRESHOLD; }
    while (accumY < -DEPTH_THRESHOLD) { onDelta(0, -1); accumY += DEPTH_THRESHOLD; }
  }
  function end() { active = false; el.classList.remove('active'); }

  el.addEventListener('touchstart', e => { e.preventDefault(); if(e.touches.length===1) start(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
  el.addEventListener('touchmove',  e => { e.preventDefault(); if(e.touches.length===1) move(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
  el.addEventListener('touchend',   e => { e.preventDefault(); end(); }, {passive:false});
  el.addEventListener('mousedown',  e => start(e.clientX, e.clientY));
  el.addEventListener('mousemove',  e => { if(e.buttons) move(e.clientX, e.clientY); });
  el.addEventListener('mouseup',    () => end());
  el.addEventListener('mouseleave', () => end());
}

// Left zone: XZ (drag right=+X, drag up=+Z)
// Left zone: screen-relative movement (Desert Strike style)
// Drag delta is in screen space — unrotate by camRotY to get world XZ direction
setupDragZone(document.getElementById('zone-move'), (dx, dy) => {
  // Screen up (-dy) and screen right (+dx) need to be mapped to world X/Z
  // The camera rotates the world by camRotY, so we rotate the input by -camRotY
  const cos = Math.cos(-camRotY);
  const sin = Math.sin(-camRotY);
  // Screen space: right=+dx, up=-dy (dy is inverted — drag up = negative dy)
  const sx =  dx;
  const sz = -dy; // up on screen = forward
  // Rotate into world space
  const wx = Math.round(sx * cos - sz * sin);
  const wz = Math.round(sx * sin + sz * cos);
  if (wx !== 0 || wz !== 0) movePlayer(wx, 0, wz);
});

// Right zone: depth
// Drag UP (dy=-1) = DIVE, drag DOWN (dy=1) = RISE (lever/stick convention)
setupDragZone(document.getElementById('zone-depth'), (dx, dy) => {
  movePlayer(0, dy, 0);
});

// ── CAMERA: single-finger drag on canvas ──
// Horizontal drag = rotate, Vertical drag = zoom
// Only fires above the controls-wrap area

let camDragActive = false;
let camDragLastX = 0, camDragLastY = 0;
let camDragMoved = false;
const CAM_DRAG_THRESHOLD = 6;

function getControlsTop() {
  const wrap = document.getElementById('controls-wrap');
  if (!wrap || wrap.style.display === 'none') return window.innerHeight;
  const rect = wrap.getBoundingClientRect();
  return rect.height > 0 ? rect.top : window.innerHeight;
}

function camDragStart(x, y) {
  if (state.viewMode !== 'command') return; // non-command views handled by periDrag
  if (y >= getControlsTop()) return;
  camDragActive = true;
  camDragMoved = false;
  camDragLastX = x;
  camDragLastY = y;
}
function camDragMove(x, y) {
  if (!camDragActive) return;
  if (state.viewMode !== 'command') return;
  const dx = x - camDragLastX;
  const dy = y - camDragLastY;
  if (!camDragMoved) {
    if (Math.abs(dx) < CAM_DRAG_THRESHOLD && Math.abs(dy) < CAM_DRAG_THRESHOLD) return;
    camDragMoved = true;
  }
  // Horizontal → rotate camera
  camRotY += dx * 0.008;
  // Vertical → move sub in camera-forward direction (screen-up = forward)
  if (dy !== 0) {
    const speed = -dy / ISO_SCALE;
    const nx = Math.max(0.6, Math.min(GRID.W-0.6, state.player.x + Math.sin(camRotY) * speed));
    const nz = Math.max(0.6, Math.min(GRID.D-0.6, state.player.z + Math.cos(camRotY) * speed));
    if (!isOccupied(nx, state.player.y, nz)) {
      state.player.x = nx;
      state.player.z = nz;
    }
  }
  centreOnPlayer();
  camDragLastX = x;
  camDragLastY = y;
}

// Compute what cx/cy should be so the player sub sits at screen centre
function centreOnPlayer() {
  if (state.viewMode === 'periscope') return; // periscope uses fixed screen centre
  const gx = state.player.x - GRID.W/2;
  const gz = state.player.z - GRID.D/2;
  const gy = state.player.y - GRID.H/2;
  const rx =  gx * Math.cos(camRotY) - gz * Math.sin(camRotY);
  const rz =  gx * Math.sin(camRotY) + gz * Math.cos(camRotY);
  const screenX = rx * ISO_SCALE;
  const screenY = (gy * 0.82 + rz * 0.55) * ISO_SCALE;
  cx = W/2 - screenX;
  cy = H*0.42 + screenY;
}
function camDragEnd() { camDragActive = false; camDragMoved = false; }

// Two-finger pan+zoom state
let _pinchDist0 = 0, _pinchMidX = 0, _pinchMidY = 0;

canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    camDragStart(e.touches[0].clientX, e.touches[0].clientY);
  } else if (e.touches.length === 2 && state.viewMode === 'command') {
    const t = e.touches;
    _pinchDist0 = Math.hypot(t[0].clientX-t[1].clientX, t[0].clientY-t[1].clientY);
    _pinchMidX = (t[0].clientX + t[1].clientX) / 2;
    _pinchMidY = (t[0].clientY + t[1].clientY) / 2;
    camDragEnd();
  }
  e.preventDefault();
}, {passive:false});

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    camDragMove(e.touches[0].clientX, e.touches[0].clientY);
  } else if (e.touches.length === 2 && state.viewMode === 'command' && _pinchDist0 > 0) {
    const t = e.touches;
    const d = Math.hypot(t[0].clientX-t[1].clientX, t[0].clientY-t[1].clientY);
    const midX = (t[0].clientX + t[1].clientX) / 2;
    const midY = (t[0].clientY + t[1].clientY) / 2;
    // Pan: shift camera offset by midpoint delta
    cx += midX - _pinchMidX;
    cy += midY - _pinchMidY;
    // Zoom: scale by distance ratio
    ISO_SCALE = Math.max(ISO_MIN, Math.min(ISO_MAX, ISO_SCALE * d / _pinchDist0));
    _pinchDist0 = d;
    _pinchMidX = midX;
    _pinchMidY = midY;
  }
}, {passive:false});

canvas.addEventListener('touchend', e => { camDragEnd(); _pinchDist0 = 0; }, {passive:false});

// Mouse: left-drag to rotate+move, scroll wheel to zoom
canvas.addEventListener('mousedown', e => { if(e.button===0) camDragStart(e.clientX, e.clientY); });
canvas.addEventListener('mousemove', e => { if(e.buttons & 1) camDragMove(e.clientX, e.clientY); });
canvas.addEventListener('mouseup',   e => { if(e.button===0) camDragEnd(); });
canvas.addEventListener('wheel', e => {
  if (state.viewMode === 'command') {
    ISO_SCALE = Math.max(ISO_MIN, Math.min(ISO_MAX, ISO_SCALE * (1 - e.deltaY * 0.001)));
    centreOnPlayer();
    e.preventDefault();
  }
}, {passive:false});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ── KEYBOARD: DOOM-STYLE CONTROLS ──
// Command view:  W/S = forward/back relative to camera (screen up = forward)
//                A/D = strafe left/right relative to camera
// Periscope:     W/S = forward/back in periAngleH direction
//                A/D = strafe left/right perpendicular to periAngleH
// Q/E = rise/dive   Z/X = rotate camera

// Move 1 cell in screen direction (sdx right+, sdz down+), rotated by camRotY
function _cmdStep(sdx, sdz) {
  var cos = Math.cos(-camRotY), sin = Math.sin(-camRotY);
  var wx = sdx * cos - (-sdz) * sin;
  var wz = sdx * sin + (-sdz) * cos;
  if (Math.abs(wx) >= Math.abs(wz)) movePlayer(wx > 0 ? 1 : -1, 0, 0);
  else movePlayer(0, 0, wz > 0 ? 1 : -1);
}

// Move 1 cell in world XZ direction (fX, fZ), allowing diagonal movement
function _periStep(fX, fZ) {
  var sx = Math.abs(fX) > 0.3 ? (fX > 0 ? 1 : -1) : 0;
  var sz = Math.abs(fZ) > 0.3 ? (fZ > 0 ? 1 : -1) : 0;
  if (sx === 0 && sz === 0) {
    if (Math.abs(fX) >= Math.abs(fZ)) sx = fX > 0 ? 1 : -1;
    else sz = fZ > 0 ? 1 : -1;
  }
  movePlayer(sx, 0, sz);
}

document.addEventListener('keydown', function(e) {
  var code = e.code || e.key;
  var isPeri = (state.viewMode === 'periscope' || state.viewMode === 'surface');
  var sinH = Math.sin(state.periAngleH);
  var cosH = Math.cos(state.periAngleH);
  switch(code) {
    case 'ArrowUp':    case 'KeyW':
      isPeri ? _periStep(-sinH,  cosH) : _cmdStep(0, -1); break;
    case 'ArrowDown':  case 'KeyS':
      isPeri ? _periStep( sinH, -cosH) : _cmdStep(0,  1); break;
    case 'ArrowLeft':  case 'KeyA':
      isPeri ? _periStep( cosH,  sinH) : _cmdStep( 1, 0); break;
    case 'ArrowRight': case 'KeyD':
      isPeri ? _periStep(-cosH, -sinH) : _cmdStep(-1, 0); break;
    case 'KeyQ': case 'KeyE': movePlayer(0,  1, 0); break;
    case 'KeyC': case 'c':   movePlayer(0, -1, 0); break;
    case 'KeyZ': case 'z': camRotY -= 0.15; break;
    case 'KeyX': case 'x': camRotY += 0.15; break;
    case 'KeyP': case 'p': doPing(); break;
    case 'KeyT': case 't': doTorpedoMode(); break;
    case 'KeyF': case 'f': doFire(); break;
  }
});

document.getElementById('btn-ping').addEventListener('click', doPing);
function doPing() {
  if (!pingReady()) {
    addEvent('⚠ SONAR RECHARGING — ' + Math.ceil((PING_CD_MS-(Date.now()-state.pingLastFired))/1000) + 's', true);
    return;
  }
  playPing();
  state.sonarPings.push({r:0});
  if (state.silentRunning) state.silentPings.push({ r: 0, alpha: 1.0 });
  state.pingLastFired = Date.now();

  // Visual cooldown on button
  const btn = document.getElementById('btn-ping');
  btn.classList.add('ping-active');
  const cdInterval = setInterval(()=>{
    const remaining = Math.ceil(state.pingCooldown/60);
    if (remaining > 0) {
      btn.textContent = `◎ PING ${remaining}s`;
    } else {
      btn.textContent = '◎ PING';
      btn.classList.remove('ping-active');
      clearInterval(cdInterval);
    }
  }, 200);

  if (!state.enemy.alive) {
    addEvent('◎ SONAR PING — NO CONTACT', false);
    return;
  }

  const dist = Math.sqrt(
    (state.player.x-state.enemy.x)*(state.player.x-state.enemy.x) +
    (state.player.z-state.enemy.z)*(state.player.z-state.enemy.z)
  );

  // Always get contact — range just affects quality of solution
  const inRange = dist < 20; // whole grid is max ~20 units diagonal
  if (inRange) {
    state.revealed = true;
    state.revealTimer = 360;
    state.revealAlpha = 1.0;
    document.getElementById('sys-sonar').textContent = 'CONTACT';
    setTimeout(()=>{ document.getElementById('sys-sonar').textContent='ONLINE'; }, 3000);

    // ── COMPUTE FIRING SOLUTION ──
    // Work out enemy velocity from trail
    let velX = 0, velY = 0, velZ = 0;
    if (state.enemyTrail.length >= 2) {
      const recent = state.enemyTrail[state.enemyTrail.length-1];
      const older  = state.enemyTrail[Math.max(0, state.enemyTrail.length-3)];
      velX = (recent.x - older.x) / Math.max(1, state.enemyTrail.length-1);
      velY = (recent.y - older.y) / Math.max(1, state.enemyTrail.length-1);
      velZ = (recent.z - older.z) / Math.max(1, state.enemyTrail.length-1);
    }

    // Torpedo travel time estimate (distance / torpedo speed in grid units)
    const TORP_SPEED = 0.15; // grid units per frame
    const travelFrames = dist / TORP_SPEED;
    // Enemy moves every 90 frames, so predict how many moves during travel
    const movesAhead = travelFrames / 90;

    // Predicted intercept position
    let ix = state.enemy.x + velX * movesAhead * 3;
    let iy = state.enemy.y + velY * movesAhead * 3;
    let iz = state.enemy.z + velZ * movesAhead * 3;

    // If no velocity data, just aim at current position
    if (velX === 0 && velZ === 0) {
      ix = state.enemy.x;
      iy = state.enemy.y;
      iz = state.enemy.z;
    }

    // Clamp to grid
    ix = Math.max(0, Math.min(GRID.W-1, ix));
    iy = Math.max(0, Math.min(GRID.H-1, iy));
    iz = Math.max(0, Math.min(GRID.D-1, iz));

    state.firingSolution = { x:ix, y:iy, z:iz };

    addEvent('◎ FIRING SOLUTION LOCKED — TAP FIRE', false);
    document.getElementById('mode-badge').textContent = '⊛ SOLUTION LOCKED';
    document.getElementById('mode-badge').style.color = 'rgba(255,200,0,1)';
    document.getElementById('mode-badge').style.borderColor = '#ffcc00';
    setTimeout(()=>{
      document.getElementById('mode-badge').style.color='';
      document.getElementById('mode-badge').style.borderColor='';
    }, 600);

  } else {
    addEvent('◎ SONAR PING — NO CONTACT', false);
    state.firingSolution = null;
  }

  if (Math.random() < 0.3) addEvent('⚠ PING DETECTED BY ENEMY', true);
}

// Torpedo mode
document.getElementById('btn-torpedo').addEventListener('click', doTorpedoMode);
function doTorpedoMode() {
  if (state.torpCount <= 0) { addEvent('⚠ NO TORPEDOES REMAINING', true); return; }
  if (state.mode === 'torpedo') {
    // Cancel
    state.mode='navigate';
    state.aimCursor=null;
    document.getElementById('mode-badge').textContent='◈ NAVIGATE';
    document.getElementById('btn-fire').style.display='none';
    document.getElementById('torpedo-aim-hint').style.display='none';
    return;
  }
  state.mode='torpedo';
  state.aimCursor = {x:state.player.x, y:state.player.y, z:state.player.z+3};
  document.getElementById('mode-badge').textContent='⊛ TORPEDO AIM';
  document.getElementById('mode-badge').style.color='var(--warn)';
  document.getElementById('mode-badge').style.borderColor='var(--warn)';
  document.getElementById('btn-fire').style.display='block';
  document.getElementById('torpedo-aim-hint').style.display='block';
  setTimeout(()=>{
    document.getElementById('mode-badge').style.color='';
    document.getElementById('mode-badge').style.borderColor='';
  },500);
}

// Fire
document.getElementById('btn-fire').addEventListener('click', doFire);
function doFire() {
  if (state.torpCount <= 0) { addEvent('⚠ NO TORPEDOES REMAINING', true); return; }
  if (state.torpCooldown > 0) { addEvent('⚠ TORPEDO RELOADING — ' + Math.ceil(state.torpCooldown/60) + 's', true); return; }

  // Use firing solution from ping if available, otherwise use aim cursor
  const target = state.firingSolution || state.aimCursor;
  if (!target) return;

  // Clamp launch and target Y to waterline — in surface/surfaced mode player.y >= GRID.H,
  // which puts both origin and aim cursor above the grid bounds, causing instant removal.
  const fireY   = Math.min(state.player.y, GRID.H);
  const targetY = Math.min(target.y, GRID.H);
  const dx = target.x - state.player.x;
  const dy = targetY - fireY;
  const dz = target.z - state.player.z;
  const len = Math.sqrt(dx*dx+dy*dy+dz*dz) || 1;

  state.torpedoes.push({
    ox:state.player.x, oy:fireY, oz:state.player.z,
    x:state.player.x,  y:fireY,  z:state.player.z,
    dx:dx/len, dy:dy/len, dz:dz/len,
    speed:0.3, progress:0
  });

  if (state.silentRunning) {
    revealPlayerToEnemy(420);
    addEvent('⚠ TORPEDO LAUNCH — POSITION COMPROMISED', true);
  }
  if (state.torpCount !== Infinity) state.torpCount--;
  state.torpsFired++;
  state.torpLastFired = Date.now();
  // Auto red alert on first torpedo
  if (!state.battleStations) document.getElementById('btn-battlestations').click();
  state.firingSolution = null;
  state.mode = 'navigate';
  state.aimCursor = null;

  const fireBtn = document.getElementById('btn-fire');
  fireBtn.style.display = 'none';
  fireBtn.style.animation = '';
  fireBtn.textContent = '▶ FIRE';
  document.getElementById('peri-btn-fire').classList.remove('armed');

  playTorpedoLaunch();
  addEvent('⊛ TORPEDO AWAY', false);
  if (state.torpCount === 0) addEvent('⚠ TUBES EMPTY', true);
}

// Reveal toggle
document.getElementById('btn-reveal').addEventListener('click', () => {
  state.forceReveal = !state.forceReveal;
  const btn = document.getElementById('btn-reveal');
  if (state.forceReveal) {
    btn.textContent = '👁 HIDE ENEMY';
    btn.classList.add('active');
    addEvent('▸ TRAINING MODE — ENEMY VISIBLE', false);
  } else {
    btn.textContent = '👁 SHOW ENEMY';
    btn.classList.remove('active');
    addEvent('▸ COMBAT MODE — GO DARK', false);
  }
});


// ── DENSITY CONTROLS ──
let _densityTimer = null;
function debouncedGenerateCloud() {
  if (_densityTimer) clearTimeout(_densityTimer);
  _densityTimer = setTimeout(() => { generateCloud(); _densityTimer = null; }, 300);
}

document.getElementById('btn-density-up').addEventListener('click', () => {
  cloudDensity = Math.max(DENSITY_MIN, cloudDensity - 0.2);
  periPointSize = Math.min(12, periPointSize + 0.8);
  debouncedGenerateCloud();
  addEvent(`◎ DENSITY + (${cloudDensity.toFixed(1)} / peri ${periPointSize.toFixed(1)})`, false);
});

document.getElementById('btn-density-down').addEventListener('click', () => {
  cloudDensity = Math.min(DENSITY_MAX, cloudDensity + 0.2);
  periPointSize = Math.max(1.5, periPointSize - 0.8);
  debouncedGenerateCloud();
  addEvent(`◎ DENSITY - (${cloudDensity.toFixed(1)} / peri ${periPointSize.toFixed(1)})`, false);
});

// Respawn — move both subs to new positions (old command-bar btn + new periscope btn)
function doRespawn() {
  spawnPlayer();
  spawnEnemy('FAMILY ROOM');
  addEvent('▸ REDEPLOYING — STAND BY', false);
}
document.getElementById('btn-respawn').addEventListener('click', doRespawn);
document.getElementById('peri-btn-respawn').addEventListener('click', doRespawn);

// Stats / system-status toggle
// ── SCOREBOARD OVERLAY ──
let _scoreboardOn = false;
function updateScoreboard() {
  document.getElementById('sb-score').textContent = state.score;
  document.getElementById('sb-kills').textContent = state.kills;
  document.getElementById('sb-detected').textContent = state.timesDetected;
  document.getElementById('sb-torps').textContent = state.torpsFired;
  const acc = state.torpsFired > 0
    ? Math.round(state.torpsHit / state.torpsFired * 100) + '%'
    : '—';
  document.getElementById('sb-accuracy').textContent = acc;
  const depthM = state.maxDepth > 0
    ? (state.maxDepth * 0.5).toFixed(0) + 'm'
    : '—';
  document.getElementById('sb-maxdepth').textContent = depthM;
  document.getElementById('sb-hull-stat').textContent = state.hull + '%';
}
function setScoreboard(on) {
  _scoreboardOn = on;
  // Tactical button label flips: map visible → "STATUS", scoreboard visible → "TACTICAL"
  document.getElementById('peri-btn-tactical').textContent = on ? '◎ TACTICAL' : '◉ STATUS';
  const sb = document.getElementById('scoreboard');
  if (!on) { sb.style.display = 'none'; return; }
  updateScoreboard();
  const fwd = document.getElementById('peri-fwd-wrap').getBoundingClientRect();
  Object.assign(sb.style, {
    display: 'flex',
    position: 'fixed',
    left: fwd.left + 'px',
    top: fwd.top + 'px',
    width: fwd.width + 'px',
    height: fwd.height + 'px',
    bottom: 'auto',
    margin: '0',
    zIndex: '20',
    pointerEvents: 'none',
  });
}
// peri-btn-stats is now SPARE — no action yet

// ── WEAPON SELECT ──
document.getElementById('peri-btn-weapon').addEventListener('click', () => {
  const _modes = ['torpedo', 'acoustic', 'mine'];
  state.weaponMode = _modes[(_modes.indexOf(state.weaponMode) + 1) % _modes.length];
  const btn = document.getElementById('peri-btn-weapon');
  if (state.weaponMode === 'mine') {
    btn.innerHTML = '⬆<br><span class="peri-weapon-label">MINE</span>';
    btn.classList.remove('acoustic-mode'); btn.classList.add('mine-mode');
    addEvent('⬆ WEAPON: TORPEDO MINE', false);
  } else if (state.weaponMode === 'acoustic') {
    btn.innerHTML = '◎<br><span class="peri-weapon-label">ACOU</span>';
    btn.classList.remove('mine-mode'); btn.classList.add('acoustic-mode');
    addEvent('◎ WEAPON: ACOUSTIC HOMING TORPEDO — KEEP TARGET IN CROSSHAIRS', false);
  } else {
    btn.innerHTML = '━━▶<br><span class="peri-weapon-label">TORP</span>';
    btn.classList.remove('mine-mode'); btn.classList.remove('acoustic-mode');
    addEvent('▶ WEAPON: TORPEDO', false);
  }
});

// ── TACTICAL SONAR OVERLAY ──
let _tacticalOn = false;
function setTacticalSonar(on) {
  _tacticalOn = on;
  document.getElementById('peri-btn-tactical').classList.toggle('active-btn', on);
  const wrap = document.getElementById('sonar-wrap');
  if (!on) { wrap.style.display = 'none'; return; }
  const fwd = document.getElementById('peri-fwd-wrap').getBoundingClientRect();
  const sc = document.getElementById('sonar-canvas');
  // Resize canvas resolution to match drag zone
  // Keep canvas at 200×200 resolution — CSS scales it to fill the zone
  sc.style.width = '100%';
  sc.style.height = '100%';
  sc.style.boxShadow = 'none';
  sc.style.border = 'none';
  sc.style.display = 'block';
  // Hide label and readout — canvas fills the whole wrapper
  wrap.querySelector('div:first-child').style.display = 'none';
  document.getElementById('sonar-readout').style.display = 'none';
  // Position wrapper exactly over the forward drag zone, no border
  // pointer-events: none so touches pass through to the fwd-wrap handler beneath
  Object.assign(wrap.style, {
    display: 'block', position: 'fixed',
    left: fwd.left + 'px', top: fwd.top + 'px',
    width: fwd.width + 'px', height: fwd.height + 'px',
    bottom: 'auto', margin: '0', padding: '0',
    background: 'none', border: 'none',
    zIndex: '20', pointerEvents: 'none',
  });
}
document.getElementById('peri-btn-tactical').addEventListener('click', () => {
  if (_scoreboardOn) {
    // Scoreboard showing → switch to map
    setScoreboard(false);
    if (window._isHeightfield) setTacticalSonar(true);
  } else {
    // Map showing → switch to scoreboard
    if (window._isHeightfield) setTacticalSonar(false);
    setScoreboard(true);
  }
});

// ── BFS PATHFINDING ──
function bfsStep(sx, sz, tx, tz) {
  if (sx===tx && sz===tz) return null;
  const visited = {};
  const queue = [{x:sx, z:sz, parent:null}];
  visited[sx+','+sz] = true;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  let found = null;
  let iterations = 0;
  while (queue.length && !found && iterations++ < 400) {
    const cur = queue.shift();
    for (let d = 0; d < 4; d++) {
      const nx = cur.x + dirs[d][0];
      const nz = cur.z + dirs[d][1];
      if (nx<1||nx>GRID.W-2||nz<1||nz>GRID.D-2) continue;
      if (FLOOR_PLAN[nz] && FLOOR_PLAN[nz][nx]) continue;
      const key = nx+','+nz;
      if (visited[key]) continue;
      visited[key] = true;
      const node = {x:nx, z:nz, parent:cur};
      if (nx===tx && nz===tz) { found=node; break; }
      queue.push(node);
    }
    if (found) break;
  }
  if (!found) {
    // No path found — pick least-occupied random step
    const dirs2 = [[1,0],[-1,0],[0,1],[0,-1]];
    const free = dirs2.filter(d => {
      const nx=sx+d[0], nz=sz+d[1];
      return nx>0&&nx<GRID.W-1&&nz>0&&nz<GRID.D-1&&!(FLOOR_PLAN[nz]&&FLOOR_PLAN[nz][nx]);
    });
    if (!free.length) return null;
    const pick = free[Math.floor(Math.random()*free.length)];
    return {x:sx+pick[0], z:sz+pick[1]};
  }
  // Walk back to find first step from start
  let node = found;
  while (node.parent && node.parent.parent) node = node.parent;
  return node;
}

// ── LINE OF SIGHT CHECK ──
function hasLineOfSight(ax, az, bx, bz) {
  const steps = Math.ceil(Math.sqrt(Math.pow(bx-ax,2)+Math.pow(bz-az,2)) * 2);
  if (steps === 0) return true;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const ix = Math.round(ax + (bx-ax)*t);
    const iz = Math.round(az + (bz-az)*t);
    if (FLOOR_PLAN[iz] && FLOOR_PLAN[iz][ix]) return false;
  }
  return true;
}

// ── ENEMY TORPEDO LOGIC ──
var _redAlertAudio = null;
function playSiren() {
  if (!_redAlertAudio) {
    _redAlertAudio = new Audio('/Sounds/Red_Alert.mp3');
  }
  _redAlertAudio.currentTime = 0;
  _redAlertAudio.play().catch(function(){});
}


document.getElementById('peri-btn-battlestations').addEventListener('click', () => {
  document.getElementById('btn-battlestations').click();
});

document.getElementById('peri-alert-btn').addEventListener('click', () => {
  document.getElementById('btn-battlestations').click();
});

function _updateAlertImage() {
  var img = document.getElementById('peri-alert-img');
  if (img) img.src = state.battleStations ? '/Images/Alert_Red.png' : '/Images/Alert_Grey.png';
}

document.getElementById('btn-battlestations').addEventListener('click', () => {
  state.battleStations = !state.battleStations;
  const btn = document.getElementById('btn-battlestations');
  const periBtn = document.getElementById('peri-btn-battlestations');
  if (state.battleStations) {
    btn.classList.add('active');
    btn.style.color = '#ff4444';
    btn.style.borderColor = '#ff4444';
    btn.style.boxShadow = '0 0 15px rgba(255,0,0,0.5)';
    if (periBtn) { periBtn.style.color='#ff4444'; periBtn.style.borderColor='#ff4444'; }
    addEvent('🚨 RED ALERT — ALL HANDS TO BATTLE STATIONS', true);
    playSiren(); // plays once only
  } else {
    btn.classList.remove('active');
    btn.style.color = '';
    btn.style.borderColor = '';
    btn.style.boxShadow = '';
    if (periBtn) { periBtn.style.color=''; periBtn.style.borderColor=''; }
    addEvent('▸ STAND DOWN — RED ALERT CANCELLED', false);
  }
  _updateAlertImage();
});

// ── TORPEDO COOLDOWN DISPLAY ──
const TORP_COOLDOWN_FRAMES = 300; // 5 seconds at 60fps
const PING_COOLDOWN_FRAMES = 300;

function drawFireBtn() {
  const btn = document.getElementById('peri-btn-fire') || document.getElementById('btn-fire');
  if (!btn) return;
  if (state.torpCooldown > 0) {
    const secs = Math.ceil(state.torpCooldown / 60);
    btn.querySelector('span') ? btn.querySelector('span').textContent = secs + 's' : btn.textContent = secs + 's';
    btn.style.opacity = '0.5';
  } else {
    btn.querySelector('span') ? btn.querySelector('span').textContent = 'FIRE' : btn.textContent = 'FIRE';
    btn.style.opacity = '1';
  }
}

// ── ENEMY AI HELPERS ──

// Find a cell adjacent to a wall that blocks LOS to player
function findNearestCover(ex, ez, px, pz) {
  var best = null, bestScore = -Infinity;
  var R = 14;
  for (var dz = -R; dz <= R; dz++) {
    for (var dx = -R; dx <= R; dx++) {
      var cx = Math.round(ex) + dx, cz = Math.round(ez) + dz;
      if (cx < 1 || cx > GRID.W-2 || cz < 1 || cz > GRID.D-2) continue;
      if (FLOOR_PLAN[cz] && FLOOR_PLAN[cz][cx]) continue;
      var nearWall = (FLOOR_PLAN[cz+1] && FLOOR_PLAN[cz+1][cx]) ||
                     (FLOOR_PLAN[cz-1] && FLOOR_PLAN[cz-1][cx]) ||
                     (FLOOR_PLAN[cz]   && FLOOR_PLAN[cz][cx+1]) ||
                     (FLOOR_PLAN[cz]   && FLOOR_PLAN[cz][cx-1]);
      if (!nearWall) continue;
      var hidden = !hasLineOfSight(cx, cz, px, pz);
      var distE = Math.sqrt(dx*dx + dz*dz);
      var distP = Math.sqrt((cx-px)*(cx-px) + (cz-pz)*(cz-pz));
      // Prefer: hidden from player, reasonably close to enemy, not too close to player
      var score = (hidden ? 20 : 0) + distP * 0.4 - distE * 1.0;
      if (score > bestScore) { bestScore = score; best = {x: cx, z: cz}; }
    }
  }
  return best;
}

// Find a flanking position — 90 degrees off the player's axis, ~10 cells away
function findFlankPos(ex, ez, px, pz) {
  var toPEx = ex - px, toPEz = ez - pz;
  var len = Math.sqrt(toPEx*toPEx + toPEz*toPEz) || 1;
  var perpX = -toPEz / len, perpZ = toPEx / len;
  var targetDist = 10 + Math.round(Math.random() * 6);
  var side = state.enemy.flankDir;
  var fx = Math.round(px + perpX * targetDist * side);
  var fz = Math.round(pz + perpZ * targetDist * side);
  fx = Math.max(1, Math.min(GRID.W-2, fx));
  fz = Math.max(1, Math.min(GRID.D-2, fz));
  // If blocked, try the other side
  if (FLOOR_PLAN[fz] && FLOOR_PLAN[fz][fx]) {
    fx = Math.round(px - perpX * targetDist * side);
    fz = Math.round(pz - perpZ * targetDist * side);
    fx = Math.max(1, Math.min(GRID.W-2, fx));
    fz = Math.max(1, Math.min(GRID.D-2, fz));
  }
  if (FLOOR_PLAN[fz] && FLOOR_PLAN[fz][fx]) return null;
  return {x: fx, z: fz};
}

// Fire a torpedo at the player from the enemy
function enemyFire() {
  var edx = state.player.x - state.enemy.x;
  var edy = state.player.y - state.enemy.y;
  var edz = state.player.z - state.enemy.z;
  var elen = Math.sqrt(edx*edx + edy*edy + edz*edz) || 1;
  var off = 2.0;
  state.torpedoes.push({
    ox: state.enemy.x + edx/elen*off, oy: state.enemy.y + edy/elen*off, oz: state.enemy.z + edz/elen*off,
    x:  state.enemy.x + edx/elen*off, y:  state.enemy.y + edy/elen*off, z:  state.enemy.z + edz/elen*off,
    dx: edx/elen, dy: edy/elen, dz: edz/elen,
    speed: 0.09, progress: 0, isEnemy: true
  });
  state.enemyLastFired = Date.now();
  state.timesDetected++;
  // Torpedo launch noise reveals Bravo's position briefly on the minimap
  if (state.silentRunning) {
    state.revealTimer = Math.max(state.revealTimer, 180);
    state.revealAlpha = 1.0;
    state.enemySilentAlpha = Math.max(state.enemySilentAlpha, 1.0);
  }
  addEvent('⚠ TORPEDO IN THE WATER!', true);
}

// ── ACOUSTIC TORPEDO HOMING PHYSICS ──
function _steerHomingTorp(t) {
  if (t.heading === undefined) t.heading = Math.atan2(t.dx, t.dz);

  // Find best target: nearest noisemaker wins if it's significantly closer than the enemy
  var tgtX = state.enemy.alive ? state.enemy.x : (t.x + t.dx * 30);
  var tgtZ = state.enemy.alive ? state.enemy.z : (t.z + t.dz * 30);
  var tgtY = state.enemy.alive ? state.enemy.y : t.y;
  if (state.noisemakers && state.noisemakers.length) {
    var eDist2 = state.enemy.alive
      ? (state.enemy.x-t.x)*(state.enemy.x-t.x) + (state.enemy.z-t.z)*(state.enemy.z-t.z)
      : Infinity;
    state.noisemakers.forEach(function(nm) {
      var nd2 = (nm.x-t.x)*(nm.x-t.x) + (nm.z-t.z)*(nm.z-t.z);
      if (nd2 < eDist2 * 0.55) { tgtX = nm.x; tgtZ = nm.z; tgtY = nm.y; eDist2 = nd2; }
    });
  }

  // Steer toward target with a maximum turn rate (realistic turn radius)
  var desH = Math.atan2(tgtX - t.x, tgtZ - t.z);
  var da = desH - t.heading;
  while (da >  Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  var lk = t.lockStrength !== undefined ? t.lockStrength : 0.5;
  // Tighter turn when lock is strong; minimum turn rate so it always tries
  var effTurn = 0.03 * (0.22 + lk * 0.78);
  t.heading += Math.sign(da) * Math.min(Math.abs(da), effTurn);
  t.dx = Math.sin(t.heading);
  t.dz = Math.cos(t.heading);

  // Update lock strength from player's periscope guidance
  if ((state.viewMode === 'periscope' || state.viewMode === 'surface') && state.acousticLock > 0) {
    t.lockStrength = Math.min(1, lk + state.acousticLock * 0.022);
  } else {
    t.lockStrength = Math.max(0.08, lk - 0.004); // slowly degrades without guidance
  }

  // Slow vertical homing
  var dvy = tgtY - t.y;
  if (Math.abs(dvy) > 0.25) {
    t.vy = ((t.vy || 0) * 0.88) + Math.sign(dvy) * 0.006;
    t.vy = Math.max(-0.022, Math.min(0.022, t.vy));
    t.dy = t.vy;
  }
}

// ── ENEMY AI — STATE MACHINE ──
// States: 'hunt' | 'cover' | 'ambush' | 'flank'
var _enemyMoveTimer = 0;
function updateEnemyAI() {
  if (!state.enemy.alive) return;

  var en = state.enemy;
  var ex = Math.round(en.x), ez = Math.round(en.z);
  var px = Math.round(state.player.x), pz = Math.round(state.player.z);
  var dist2d = Math.sqrt((en.x-state.player.x)*(en.x-state.player.x) + (en.z-state.player.z)*(en.z-state.player.z));
  var los = hasLineOfSight(ex, ez, px, pz);
  var silentBlind = state.silentRunning && !state.enemyKnowsPlayer;
  var canFire = state.battleStations && (Date.now() - state.enemyLastFired >= TORP_CD_MS) && !silentBlind;

  // Update trail
  _enemyMoveTimer++;
  if (_enemyMoveTimer % 45 === 0) {
    state.lastEnemyPos = {x: en.x, y: en.y, z: en.z};
    state.lastEnemyPosTime = state.time;
    state.enemyTrail.push({x: en.x, y: en.y, z: en.z, age: 0});
    if (state.enemyTrail.length > 8) state.enemyTrail.shift();
  }
  state.enemyTrail.forEach(function(t) { t.age++; });
  state.enemyTrail = state.enemyTrail.filter(function(t) { return t.age < 300; });

  en.aiTimer = Math.max(0, en.aiTimer - 1);

  // ── HOMING TORPEDO DETECTION — triggers evasive manoeuvres ──
  var _incomingHomer = null;
  for (var _ehi = 0; _ehi < state.torpedoes.length; _ehi++) {
    var _eht = state.torpedoes[_ehi];
    if (!_eht.isHoming || _eht.isEnemy) continue;
    var _ehdx = _eht.x - en.x, _ehdz = _eht.z - en.z;
    if (Math.sqrt(_ehdx*_ehdx + _ehdz*_ehdz) < 24) { _incomingHomer = _eht; break; }
  }
  if (_incomingHomer) {
    en.evasionTimer = Math.max(en.evasionTimer, 360);
    if (en.aiState !== 'evade') {
      en.aiState = 'evade';
      // Turn hard away from the torpedo
      en.heading = Math.atan2(en.x - _incomingHomer.x, en.z - _incomingHomer.z)
                   + (Math.random()-0.5) * Math.PI * 0.6;
      addEvent('⚠ BRAVO TAKING EVASIVE ACTION', true);
    }
  }

  // ── STATE: HUNT ──
  // Move toward player, fire when LOS opens up
  if (en.aiState === 'hunt') {
    // Fire if we have LOS and are in range
    if (canFire && los && dist2d < 28) {
      enemyFire();
      // After firing, break for cover
      var cover = findNearestCover(en.x, en.z, state.player.x, state.player.z);
      if (cover) {
        en.aiState = 'cover';
        en.aiTarget = cover;
        en.aiTimer = 180; // 3s timeout to reach cover
      }
      return;
    }
    // Move toward player (or last known position when silent-blind) every ~30 frames
    if (_enemyMoveTimer % 30 === 0) {
      var tx, tz;
      if (silentBlind) {
        if (state.enemyLastKnown) {
          tx = Math.round(state.enemyLastKnown.x);
          tz = Math.round(state.enemyLastKnown.z);
        } else {
          tx = Math.max(1, Math.min(GRID.W-2, ex + Math.round((Math.random()-0.5)*10)));
          tz = Math.max(1, Math.min(GRID.D-2, ez + Math.round((Math.random()-0.5)*10)));
        }
      } else {
        tx = px; tz = pz;
        // If very close, back off slightly
        if (dist2d < 5) { tx = ex + (ex-px)*2; tz = ez + (ez-pz)*2; }
      }
      var tx2 = Math.max(1, Math.min(GRID.W-2, tx));
      var tz2 = Math.max(1, Math.min(GRID.D-2, tz));
      var next = bfsStep(ex, ez, tx2, tz2);
      if (next) {
        var ny = Math.max(0.6, Math.min(GRID.H-0.6, en.y + (Math.random()-0.5)*0.4));
        var nx = en.x + (next.x - ex) * 0.85;
        var nz2 = en.z + (next.z - ez) * 0.85;
        if (!isOccupied(nx, ny, nz2)) {
          en.x = nx; en.y = ny; en.z = nz2;
          en.heading = Math.atan2(next.x-ex, next.z-ez);
        }
      }
    }
    // Occasionally switch to flank mode to surprise the player
    if (en.aiTimer === 0 && Math.random() < 0.3) {
      var fpos = findFlankPos(en.x, en.z, state.player.x, state.player.z);
      if (fpos) {
        en.aiState = 'flank';
        en.aiTarget = fpos;
        en.aiTimer = 240;
        en.flankDir = en.flankDir * -1; // alternate sides
      } else {
        en.aiTimer = 120;
      }
    } else if (en.aiTimer === 0) {
      en.aiTimer = 90 + Math.round(Math.random() * 60);
    }
  }

  // ── STATE: COVER ──
  // Break toward a wall/corner that blocks LOS, reload there
  else if (en.aiState === 'cover') {
    var tgt = en.aiTarget;
    if (!tgt) { en.aiState = 'hunt'; en.aiTimer = 60; return; }
    var dtx = Math.abs(en.x - tgt.x), dtz = Math.abs(en.z - tgt.z);
    // Arrived at cover position
    if (dtx < 1.5 && dtz < 1.5) {
      en.aiState = 'ambush';
      en.aiTimer = 300 + Math.round(Math.random() * 180); // wait 5-8s
      return;
    }
    // Timeout — give up and go back to hunting
    if (en.aiTimer === 0) { en.aiState = 'hunt'; en.aiTimer = 60; return; }
    // Move toward cover every ~25 frames (faster retreat)
    if (_enemyMoveTimer % 25 === 0) {
      var ctx2 = Math.max(1, Math.min(GRID.W-2, tgt.x));
      var ctz = Math.max(1, Math.min(GRID.D-2, tgt.z));
      var cnext = bfsStep(ex, ez, ctx2, ctz);
      if (cnext) {
        // Vary depth while retreating — hug mid-depth to avoid depth charges
        var cny = Math.max(1.5, Math.min(GRID.H-1.5, en.y + (Math.random()-0.5)*0.6));
        var cnx = en.x + (cnext.x - ex) * 0.9;
        var cnz = en.z + (cnext.z - ez) * 0.9;
        if (!isOccupied(cnx, cny, cnz)) {
          en.x = cnx; en.y = cny; en.z = cnz;
          en.heading = Math.atan2(cnext.x-ex, cnext.z-ez);
        }
      }
    }
  }

  // ── STATE: AMBUSH ──
  // Lurk behind cover. Fire when player wanders close with LOS, or timeout and hunt
  else if (en.aiState === 'ambush') {
    // Opportunistic shot — fire if player comes within ambush range
    if (canFire && los && dist2d < 20) {
      enemyFire();
      // Re-cover after firing
      var ac = findNearestCover(en.x, en.z, state.player.x, state.player.z);
      en.aiState = 'cover';
      en.aiTarget = ac || {x: ex + (Math.random()-0.5)*4, z: ez + (Math.random()-0.5)*4};
      en.aiTimer = 150;
      return;
    }
    // Subtle depth variation while hiding
    if (_enemyMoveTimer % 60 === 0) {
      var hy = Math.max(1.0, Math.min(GRID.H-1.0, en.y + (Math.random()-0.5)*0.8));
      if (!isOccupied(en.x, hy, en.z)) en.y = hy;
    }
    // Timeout — exit ambush and flank or hunt
    if (en.aiTimer === 0) {
      if (Math.random() < 0.5) {
        var af = findFlankPos(en.x, en.z, state.player.x, state.player.z);
        if (af) {
          en.aiState = 'flank';
          en.aiTarget = af;
          en.aiTimer = 240;
          en.flankDir = en.flankDir * -1;
        } else {
          en.aiState = 'hunt';
          en.aiTimer = 90;
        }
      } else {
        en.aiState = 'hunt';
        en.aiTimer = 90;
      }
    }
  }

  // ── STATE: FLANK ──
  // Circle round to a new angle on the player, then open fire
  else if (en.aiState === 'flank') {
    var ftgt = en.aiTarget;
    if (!ftgt) { en.aiState = 'hunt'; en.aiTimer = 60; return; }
    var fdtx = Math.abs(en.x - ftgt.x), fdtz = Math.abs(en.z - ftgt.z);
    // Arrived at flank position — fire if LOS, then cover
    if (fdtx < 2 && fdtz < 2) {
      if (canFire && los && dist2d < 30) {
        enemyFire();
      }
      var fc = findNearestCover(en.x, en.z, state.player.x, state.player.z);
      en.aiState = 'cover';
      en.aiTarget = fc || null;
      en.aiTimer = 180;
      return;
    }
    // Timeout — just go hunt
    if (en.aiTimer === 0) { en.aiState = 'hunt'; en.aiTimer = 60; return; }
    // Move toward flank position every ~28 frames
    if (_enemyMoveTimer % 28 === 0) {
      var ftx = Math.max(1, Math.min(GRID.W-2, ftgt.x));
      var ftz = Math.max(1, Math.min(GRID.D-2, ftgt.z));
      var fnext = bfsStep(ex, ez, ftx, ftz);
      if (fnext) {
        var fny = Math.max(0.6, Math.min(GRID.H-0.6, en.y + (Math.random()-0.5)*0.5));
        var fnx = en.x + (fnext.x - ex) * 0.88;
        var fnz = en.z + (fnext.z - ez) * 0.88;
        if (!isOccupied(fnx, fny, fnz)) {
          en.x = fnx; en.y = fny; en.z = fnz;
          en.heading = Math.atan2(fnext.x-ex, fnext.z-ez);
        }
      }
    }
  }

  // ── STATE: EVADE — frantic evasion of incoming acoustic torpedo ──
  else if (en.aiState === 'evade') {
    en.evasionTimer--;
    if (en.evasionTimer <= 0) {
      en.aiState = 'hunt'; en.aiTimer = 60;
      addEvent('▸ BRAVO RESUMING HUNT PATTERN', false);
      return;
    }
    // Rapid depth changes
    if (_enemyMoveTimer % 18 === 0) {
      en.y = Math.max(0.4, Math.min(GRID.H-0.6, en.y + (Math.random()-0.5)*1.6));
    }
    // Zigzag heading changes
    if (_enemyMoveTimer % 22 === 0) {
      en.heading += (Math.random()-0.5) * Math.PI * 0.85;
    }
    // Normal movement via BFS toward a random point — fast but pathfinding-safe
    if (_enemyMoveTimer % 7 === 0) {
      var _rtx = Math.max(2, Math.min(GRID.W-3, ex + Math.round((Math.random()-0.5)*18)));
      var _rtz = Math.max(2, Math.min(GRID.D-3, ez + Math.round((Math.random()-0.5)*18)));
      var _evnext = bfsStep(ex, ez, _rtx, _rtz);
      if (_evnext) {
        var _evny = Math.max(0.5, Math.min(GRID.H-0.6, en.y + (Math.random()-0.5)*0.5));
        var _evnx = en.x + (_evnext.x - ex) * 0.95;
        var _evnz = en.z + (_evnext.z - ez) * 0.95;
        if (!isOccupied(_evnx, _evny, _evnz)) {
          en.x = _evnx; en.y = _evny; en.z = _evnz;
          en.heading = Math.atan2(_evnext.x - ex, _evnext.z - ez);
        }
      }
    }
    // ── RED OCTOBER MOMENT ──
    // Only when torpedo is very close (< 5 units): panic move ignores pathfinding → terrain risk
    if (_incomingHomer && _enemyMoveTimer % 4 === 0) {
      var _panicDist = Math.sqrt(
        (_incomingHomer.x-en.x)*(_incomingHomer.x-en.x) +
        (_incomingHomer.z-en.z)*(_incomingHomer.z-en.z)
      );
      if (_panicDist < 5) {
        var _pnx = en.x + Math.sin(en.heading) * 0.45;
        var _pnz = en.z + Math.cos(en.heading) * 0.45;
        var _pgx = Math.round(_pnx), _pgz = Math.round(_pnz);
        if (_pgx < 1 || _pgx >= GRID.W-1 || _pgz < 1 || _pgz >= GRID.D-1 ||
            (FLOOR_PLAN[_pgz] && FLOOR_PLAN[_pgz][_pgx])) {
          var _kcx = en.x, _kcy = en.y, _kcz = en.z;
          en.alive = false; en.hits = 0;
          state.kills++; addScore(50);
          playExplosionShip();
          spawnExplosion(_kcx, _kcy, _kcz, true);
          spawnExplosion(_kcx+(Math.random()-0.5)*3, _kcy, _kcz+(Math.random()-0.5)*3, true);
          setTimeout(function() {
            spawnExplosion(_kcx+(Math.random()-0.5)*4, _kcy, _kcz+(Math.random()-0.5)*4, true);
            playExplosionShip();
          }, 350);
          document.getElementById('kill-count').textContent = state.kills;
          document.getElementById('enemy-status').textContent = 'DESTROYED';
          addEvent('⊛ BRAVO DROVE INTO TERRAIN — DESTROYED (+50)', false);
          setTimeout(function() { addEvent('▸ "THEY TURNED INTO THE MOUNTAIN"', false); }, 1800);
          setTimeout(function() { respawnEnemy(); }, 7000);
          return;
        }
        en.x = _pnx; en.z = _pnz;
      }
    }
  }
}

// ── BATTLE STATIONS RED LIGHT OVERLAY ──
function drawBattleStationsOverlay() {
  if (!state.battleStations) return;
  const pulse = 0.04 + 0.03 * Math.sin(state.animFrame * 0.08);
  ctx.save();
  ctx.fillStyle = `rgba(255,0,0,${pulse})`;
  ctx.fillRect(0, 0, W, H);
  // Red vignette corners
  const vg = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.8);
  vg.addColorStop(0, 'rgba(255,0,0,0)');
  vg.addColorStop(1, `rgba(255,0,0,${pulse * 2})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Reset view
document.getElementById('btn-resetview').addEventListener('click', () => {
  camRotY = 0.785;
  ISO_SCALE = 12;
  cx = W/2; cy = H * 0.38;
  centreOnPlayer();
  generateCloud();
  addEvent('▸ VIEW RESET', false);
});

// ── DEPTH GAUGE ──
const depthGaugeCanvas = document.getElementById('depth-gauge-canvas');
const dgCtx = depthGaugeCanvas.getContext('2d');

function drawDepthGauge() {
  const dg = dgCtx;
  const gw = 44, gh = 155;
  const trackX = 18, trackW = 8;
  const trackTop = 8, trackBot = gh - 16;
  const trackH = trackBot - trackTop;

  dg.clearRect(0, 0, gw, gh);

  // Track background
  dg.fillStyle = 'rgba(0,20,40,0.8)';
  dg.fillRect(trackX, trackTop, trackW, trackH);
  dg.strokeStyle = 'rgba(0,150,200,0.4)';
  dg.lineWidth = 1;
  dg.strokeRect(trackX, trackTop, trackW, trackH);

  // Depth tick marks + labels (surface at top, seabed at bottom)
  dg.font = '6px Share Tech Mono';
  dg.textAlign = 'right';
  for (let d = 0; d <= GRID.H; d += 2) {
    const ypos = trackTop + (1 - d / GRID.H) * trackH;
    const depthLabel = -Math.round((1 - d / GRID.H) * 80);
    dg.strokeStyle = 'rgba(0,150,200,0.3)';
    dg.lineWidth = 0.5;
    dg.beginPath();
    dg.moveTo(trackX - 3, ypos);
    dg.lineTo(trackX, ypos);
    dg.stroke();
    if (d % 4 === 0) {
      dg.fillStyle = 'rgba(0,150,200,0.5)';
      dg.fillText(`${depthLabel}`, trackX - 4, ypos + 2);
    }
  }

  // Surface / seabed labels
  dg.textAlign = 'left';
  dg.fillStyle = 'rgba(0,200,255,0.5)';
  dg.font = '5px Share Tech Mono';
  dg.fillText('SFC', trackX + trackW + 2, trackTop + 3);
  dg.fillText('SEA', trackX + trackW + 2, trackBot + 1);

  // Enemy marker (red) — only if revealed or force shown
  const showEnemyDepth = state.forceReveal || state.revealAlpha > 0;
  if (showEnemyDepth && state.enemy.alive) {
    const enemyDepthFrac = state.enemy.y / GRID.H;
    const ey = trackTop + (1 - enemyDepthFrac) * trackH;
    const ea = state.forceReveal ? 1.0 : state.revealAlpha;

    // Red filled marker on track
    dg.fillStyle = `rgba(255,68,68,${ea})`;
    dg.shadowBlur = 6; dg.shadowColor = '#ff4444';
    dg.fillRect(trackX, ey - 3, trackW, 6);
    dg.shadowBlur = 0;

    // Arrow pointing left with label
    dg.fillStyle = `rgba(255,68,68,${ea})`;
    dg.font = '6px Share Tech Mono';
    dg.textAlign = 'right';
    dg.fillText('B', trackX - 5, ey + 2);

    // Dashed line across gauge
    dg.setLineDash([2,2]);
    dg.strokeStyle = `rgba(255,68,68,${ea * 0.4})`;
    dg.lineWidth = 0.8;
    dg.beginPath();
    dg.moveTo(0, ey); dg.lineTo(gw, ey);
    dg.stroke();
    dg.setLineDash([]);
  }

  // Player marker (teal)
  const playerDepthFrac = state.player.y / GRID.H;
  const py = trackTop + (1 - playerDepthFrac) * trackH;

  dg.fillStyle = '#00e5ff';
  dg.shadowBlur = 8; dg.shadowColor = '#00e5ff';
  dg.fillRect(trackX, py - 3, trackW, 6);
  dg.shadowBlur = 0;

  // Arrow + depth label
  dg.fillStyle = '#00e5ff';
  dg.font = '6px Share Tech Mono';
  dg.textAlign = 'right';
  dg.fillText('A', trackX - 5, py + 2);

  // Depth value at bottom
  const depthM = ((GRID.H - state.player.y)*VOXEL_Y).toFixed(1);
  dg.textAlign = 'center';
  dg.fillStyle = '#00e5ff';
  dg.font = '7px Share Tech Mono';
  dg.fillText(`-${depthM}m`, gw/2, gh - 4);
}

// ── PERISCOPE RENDERER ──
const scopeMaskCanvas = document.getElementById('scope-mask');
const scopeCtx = scopeMaskCanvas.getContext('2d');
const periCompassCanvas = document.getElementById('peri-compass-canvas');
const periCompassCtx = periCompassCanvas.getContext('2d');

// Crush depth: fraction of track (from seabed upward) that is forbidden based on hull
function getCrushFrac() { return Math.max(0, (1 - state.hull / 100) * 0.85); }

// Draw the hull integrity bar — 100 vertical ticks spanning full compass width
function drawHullBar(pc, yStart, canvasW) {
  var numBars = 100;
  var pad = 2;
  var gap = 1; // 1px gap between every bar
  var availW = canvasW - pad * 2;
  var barW = (availW - (numBars - 1) * gap) / numBars;
  var barH = 10;
  var activeBars = Math.round(state.hull); // 0-100 bars shown

  pc.save();
  pc.clearRect(0, yStart - 1, canvasW, barH + 3);

  var col;
  if (state.hull > 60)      col = '#00e5ff';
  else if (state.hull > 30) col = '#ffaa00';
  else {
    var p = 0.65 + 0.35 * Math.sin(state.animFrame * 0.18);
    col = 'rgba(255,' + Math.round(40 * p) + ',0,' + (0.7 + 0.3 * p) + ')';
  }
  pc.fillStyle = col;

  for (var i = 0; i < activeBars; i++) {
    var bx = pad + i * (barW + gap);
    pc.fillRect(bx, yStart, barW, barH);
  }
  pc.restore();
}

// Perspective project a world point from the sub's POV
function projectPeriscope(wx, wy, wz) {
  // Translate relative to player
  const rx = wx - state.player.x;
  const ry = wy - state.player.y;
  const rz = wz - state.player.z;

  // Rotate by periscope horizontal bearing
  const cosH = Math.cos(state.periAngleH);
  const sinH = Math.sin(state.periAngleH);
  const fx =  rx * cosH + rz * sinH;
  const fz = -rx * sinH + rz * cosH;
  const fy =  ry;

  // Rotate by vertical tilt
  const cosV = Math.cos(state.periAngleV);
  const sinV = Math.sin(state.periAngleV);
  const ffz = fz * cosV - fy * sinV;
  const ffy = fz * sinV + fy * cosV;

  // ffz is depth into scene (positive = in front)
  if (ffz <= 0.1) return null; // behind camera

  const FOV = 0.7; // radians half-angle
  const fovScale = (W * 0.5) / Math.tan(FOV);
  const sx = W/2 - (fx / ffz) * fovScale;  // negated fx to unmirror
  const sy = H*0.44 - (ffy / ffz) * fovScale;
  return { sx, sy, depth: ffz };
}

// Returns 0-1 reveal factor at world-space point (wx, wz) based on active silent ping rings.
// A ring sweeps outward from the player; points glow on the wavefront and trail fades behind it.
function silentRevealAlpha(wx, wz) {
  if (!state.silentPings.length) return 0;
  const dx = wx - state.player.x, dz = wz - state.player.z;
  const dist = Math.sqrt(dx*dx + dz*dz);
  let best = 0;
  for (const ping of state.silentPings) {
    const diff = ping.r - dist; // positive = ring has passed this point
    if (diff >= -0.4 && diff <= 4.5) {
      const t = diff < 0 ? Math.max(0, 1 + diff * 2.5) : Math.max(0, 1 - diff / 4.5);
      best = Math.max(best, t * ping.alpha);
    }
  }
  return Math.min(1, best);
}

function renderPeriscope() {
  // Use fixed screen centre for periscope — independent of command view pan
  const pcx = W/2, pcy = H * 0.44;

  // Dark ocean background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  // Surface line position on screen (based on player depth)
  const surfaceFrac = state.player.y / GRID.H; // 0=floor, 1=surface
  const surfaceScreenY = pcy - (state.periAngleV * 200) - surfaceFrac * 150;

  bg.addColorStop(0, '#000810');
  bg.addColorStop(Math.max(0, Math.min(1, surfaceScreenY/H - 0.05)), '#001825');
  bg.addColorStop(Math.max(0, Math.min(1, surfaceScreenY/H)), '#003355');
  bg.addColorStop(Math.min(1, surfaceScreenY/H + 0.03), '#001520');
  bg.addColorStop(1, '#000508');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── SURFACE SHIMMER ──
  const sy0 = surfaceScreenY;
  if (sy0 > -20 && sy0 < H + 20) {
    // Shimmer lines
    for (let i = 0; i < 18; i++) {
      const shimX = (i * 47 + state.animFrame * 0.4) % W;
      const shimW = 15 + Math.sin(state.animFrame * 0.03 + i) * 10;
      const shimAlpha = 0.04 + Math.sin(state.animFrame * 0.05 + i * 0.7) * 0.03;
      ctx.fillStyle = `rgba(0,180,255,${shimAlpha})`;
      ctx.fillRect(shimX - shimW/2, sy0 - 2, shimW, 4);
    }
    // Surface line glow
    const surfGrad = ctx.createLinearGradient(0, sy0 - 8, 0, sy0 + 8);
    surfGrad.addColorStop(0, 'rgba(0,180,255,0)');
    surfGrad.addColorStop(0.5, 'rgba(0,200,255,0.25)');
    surfGrad.addColorStop(1, 'rgba(0,100,180,0)');
    ctx.fillStyle = surfGrad;
    ctx.fillRect(0, sy0 - 8, W, 16);

    // Light rays from surface
    if (surfaceFrac > 0.5) {
      for (let r = 0; r < 5; r++) {
        const rayX = (r * 137 + W * 0.2) % W;
        const rayAlpha = 0.03 + Math.sin(state.animFrame * 0.02 + r) * 0.015;
        ctx.beginPath();
        ctx.moveTo(rayX, sy0);
        ctx.lineTo(rayX - 20, sy0 + 180);
        ctx.lineTo(rayX + 20, sy0 + 180);
        ctx.closePath();
        ctx.fillStyle = `rgba(0,160,220,${rayAlpha})`;
        ctx.fill();
      }
    }

    // ── WATER SURFACE GRID + 3D WIREFRAME SHIPS ──
    var depthVis = Math.max(0, (surfaceFrac - 0.70) / 0.30);
    drawWaterGrid(surfaceFrac);
    if (depthVis > 0.02 && state.ships) state.ships.forEach(function(ship) {
      if (!ship.alive && !ship.sinking) return;
      var wy = ship.sinking ? ship.sinkY : GRID.H;
      var sp = projectPeriscope(ship.x, wy, ship.z);
      if (!sp || sp.depth > 55 || sp.depth < 0.1) return;
      var alpha = (1 - sp.depth / 55) * depthVis;
      if (ship.sinking) alpha *= Math.max(0.15, ship.sinkY / GRID.H);
      if (alpha < 0.04) return;
      drawShipWireframe3D(ship, alpha);
    });
  }

  // ── COMBINED PAINTER: terrain quads + entities, depth-sorted ──
  // All items sorted farthest-first so near terrain quads occlude distant entities
  {
    const drawQueue = [];

    // Terrain quads
    if (window._isHeightfield && terrainQuads.length > 0) {
      for (let i = 0; i < terrainQuads.length; i += 12) {
        const p0 = projectPeriscope(terrainQuads[i],   terrainQuads[i+1],  terrainQuads[i+2]);
        const p1 = projectPeriscope(terrainQuads[i+3], terrainQuads[i+4],  terrainQuads[i+5]);
        const p2 = projectPeriscope(terrainQuads[i+6], terrainQuads[i+7],  terrainQuads[i+8]);
        const p3 = projectPeriscope(terrainQuads[i+9], terrainQuads[i+10], terrainQuads[i+11]);
        if (!p0 || !p1 || !p2 || !p3) continue;
        const avgD = (p0.depth + p1.depth + p2.depth + p3.depth) * 0.25;
        if (avgD > 55 || avgD < 0.3) continue;
        if (p0.sx < -60 && p1.sx < -60 && p2.sx < -60 && p3.sx < -60) continue;
        if (p0.sx > W+60 && p1.sx > W+60 && p2.sx > W+60 && p3.sx > W+60) continue;
        if (p0.sy < -60 && p1.sy < -60 && p2.sy < -60 && p3.sy < -60) continue;
        if (p0.sy > H+60 && p1.sy > H+60 && p2.sy > H+60 && p3.sy > H+60) continue;
        // Average height fraction of the 4 corners (y values at indices +1,+4,+7,+10)
        const avgY = (terrainQuads[i+1] + terrainQuads[i+4] + terrainQuads[i+7] + terrainQuads[i+10]) * 0.25;
        const yFrac = avgY / GRID.H;
        const qwx = (terrainQuads[i] + terrainQuads[i+3] + terrainQuads[i+6] + terrainQuads[i+9]) * 0.25;
        const qwz = (terrainQuads[i+2] + terrainQuads[i+5] + terrainQuads[i+8] + terrainQuads[i+11]) * 0.25;
        drawQueue.push({ depth: avgD, kind: 'quad', c: [p0.sx, p0.sy, p1.sx, p1.sy, p2.sx, p2.sy, p3.sx, p3.sy], yFrac, wx: qwx, wz: qwz });
      }
    }

    // Enemy sub
    const showEnemyP = state.silentRunning || state.forceReveal || state.revealAlpha > 0;
    if (state.enemy.alive && showEnemyP) {
      const ep = projectPeriscope(state.enemy.x, state.enemy.y, state.enemy.z);
      if (ep && ep.depth > 0.2) drawQueue.push({ depth: ep.depth, kind: 'enemy', ep });
    }

    // Whales
    if (state.whales) state.whales.forEach(function(w) {
      if (!w.alive) return;
      const pp = projectPeriscope(w.x, w.y, w.z);
      if (!pp || pp.depth < 0.1 || pp.depth > 50) return;
      drawQueue.push({ depth: pp.depth, kind: 'whale', w });
    });

    // Megalodons
    if (state.megalodons) state.megalodons.forEach(function(m) {
      if (!m.alive) return;
      const pp = projectPeriscope(m.x, m.y, m.z);
      if (!pp || pp.depth < 0.1 || pp.depth > 55) return;
      drawQueue.push({ depth: pp.depth, kind: 'megalodon', m });
    });

    // Squids
    if (state.squids) state.squids.forEach(function(s) {
      if (!s.alive) return;
      const pp = projectPeriscope(s.x, s.y, s.z);
      if (!pp || pp.depth < 0.1 || pp.depth > 55) return;
      drawQueue.push({ depth: pp.depth, kind: 'squid', s });
    });

    // Sort farthest first
    drawQueue.sort(function(a, b) { return b.depth - a.depth; });

    ctx.save();
    ctx.lineWidth = 0.7; ctx.lineCap = 'round';
    for (let qi = 0; qi < drawQueue.length; qi++) {
      const item = drawQueue[qi];
      if (item.kind === 'quad') {
        const c = item.c, d = item.depth;
        const distA = Math.max(0, 1 - d / 55);
        const shade = Math.floor((item.yFrac || 0) * 10) / 10;
        ctx.fillStyle = _hexToRgba(terrainFillColor, terrainFillOpacity);
        ctx.beginPath();
        ctx.moveTo(c[0], c[1]); ctx.lineTo(c[2], c[3]);
        ctx.lineTo(c[4], c[5]); ctx.lineTo(c[6], c[7]);
        ctx.closePath(); ctx.fill();
        // Contour edge — in silent mode use ping-reveal alpha instead of lineOpacity
        if (distA > 0.02) {
          let lineA = 0;
          if (state.silentRunning && state.silentPings.length > 0) {
            lineA = distA * silentRevealAlpha(item.wx, item.wz);
          } else if (lineOpacity > 0) {
            lineA = distA * lineOpacity;
          }
          if (lineA > 0.01) {
            ctx.strokeStyle = _hexToRgba(lineColor, lineA);
            ctx.lineWidth = (state.showWireframe ? 0.8 : 0.3) * wireframeScale;
            ctx.stroke();
            ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[4], c[5]); ctx.stroke();
          }
        }
      } else if (item.kind === 'enemy') {
        const eAlpha = state.silentRunning
          ? state.enemySilentAlpha
          : (state.forceReveal ? 1 : state.revealAlpha);
        if (eAlpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = eAlpha;
          drawTyphoonPeri(eAlpha);
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      } else if (item.kind === 'whale') {
        drawWhalePeri(item.w);
      } else if (item.kind === 'megalodon') {
        drawMegalodonPeri(item.m);
      } else if (item.kind === 'squid') {
        drawSquidPeri(item.s);
      }
    }
    ctx.restore();
  }

  // ── NOISEMAKERS — sinking barrels pulsing acoustic signal ──
  if (state.noisemakers && state.noisemakers.length) {
    state.noisemakers.forEach(function(nm) {
      const _nmp = projectPeriscope(nm.x, nm.y, nm.z);
      if (!_nmp || _nmp.depth < 0.2 || _nmp.depth > 60) return;
      const _nms = Math.max(0.5, 4 - _nmp.depth * 0.06);
      const _nma = Math.max(0.3, 1 - nm.age / 540);
      // Pulse ring
      const _pulse = 0.5 + 0.5 * Math.sin(nm.age * 0.25);
      ctx.beginPath();
      ctx.arc(_nmp.sx, _nmp.sy, _nms * (2.5 + _pulse * 4), 0, Math.PI*2);
      ctx.strokeStyle = `rgba(255,180,0,${_nma * _pulse * 0.5})`;
      ctx.lineWidth = 1; ctx.stroke();
      // Barrel body
      ctx.beginPath();
      ctx.arc(_nmp.sx, _nmp.sy, _nms * 1.8, 0, Math.PI*2);
      ctx.fillStyle = `rgba(200,140,20,${_nma})`;
      ctx.shadowBlur = 6; ctx.shadowColor = '#ffaa00'; ctx.fill(); ctx.shadowBlur = 0;
    });
  }

  // ── POINT CLOUD — drawn after terrain fills so dots sit on the surface ──
  if (state.showDots) cloudPoints.forEach(p => {
    const dx = state.player.x - p.x, dy = state.player.y - p.y, dz = state.player.z - p.z;
    // Skip back-face culling for terrain-surface dots — they must be visible from any angle
    if (p.type !== 'terrain' && p.nx*dx + p.ny*dy + p.nz*dz <= 0) return;
    const pp = projectPeriscope(p.x, p.y, p.z);
    if (!pp || pp.depth < 0.1 || pp.depth > 72) return;
    if (pp.sx < -80 || pp.sx > W+80 || pp.sy < -80 || pp.sy > H+80) return;
    const alpha = Math.max(0, 1 - pp.depth / 62) * 1.2;
    if (alpha < 0.02) return;
    const s = Math.max(0.6, Math.min(50, periPointSize / pp.depth));
    ctx.fillStyle = ptColor(p.type, Math.min(1, alpha), p.yFrac);
    ctx.fillRect(pp.sx - s * 0.5, pp.sy - s * 0.5, s, s);
  });

  // ── WIREFRAME OVERLAY (toggleable with ◈ LINES button, or revealed by silent ping) ──
  const _doWireframe = state.showWireframe || (state.silentRunning && state.silentPings.length > 0);
  if (_doWireframe) {
    ctx.save();
    ctx.lineCap = 'round';
    wallEdges.forEach(e => {
      if (e.type === 'terrain') return; // terrain edges drawn in painter pass above
      const pa = projectPeriscope(e.ax, e.ay, e.az);
      const pb = projectPeriscope(e.bx, e.by, e.bz);
      if (!pa || !pb) return;
      const maxD = Math.max(pa.depth, pb.depth);
      if (maxD > 55) return;
      const minD = Math.min(pa.depth, pb.depth);
      let a = Math.max(0, 1 - maxD / 50) * (minD < 8 ? 0.75 : 0.45);
      if (state.silentRunning) {
        const midX = (e.ax + e.bx) * 0.5, midZ = (e.az + e.bz) * 0.5;
        a *= silentRevealAlpha(midX, midZ);
      }
      if (a < 0.02) return;
      ctx.lineWidth = (minD < 8 ? Math.max(0.6, 1.8 / minD) : 0.5) * wireframeScale;
      ctx.strokeStyle = `rgba(0,200,255,${a})`;
      ctx.beginPath(); ctx.moveTo(pa.sx, pa.sy); ctx.lineTo(pb.sx, pb.sy); ctx.stroke();
    });
    ctx.restore();
  }


  // ── TORPEDOES IN PERISCOPE ──
  // Project each torpedo dot from world space — accurate trail toward actual target
  state.torpedoes.forEach(t => {
    let lastSx = null, lastSy = null;
    for (let i = 0; i <= 16; i++) {
      // Nose at i=0, trail dots behind at i>0
      const behind = i * 0.4;
      const tx = t.x - t.dx * behind;
      const ty = t.y - t.dy * behind;
      const tz = t.z - t.dz * behind;
      const tp = projectPeriscope(tx, ty, tz);
      if (!tp || tp.depth < 0.05) continue;

      const fade = 1 - (i / 16);
      const atSurface = t.y >= GRID.H - 1.0;
      const baseSize = atSurface ? 12 : (i===0 ? 8 : 4);
      const dotR = Math.max(1, Math.min(14, baseSize * fade / Math.max(0.3, tp.depth * 0.3)));

      ctx.beginPath();
      ctx.arc(tp.sx, tp.sy, dotR, 0, Math.PI*2);
      if (t.isMine) {
        // Cyan rising trail for mines
        if (i === 0) {
          ctx.fillStyle = `rgba(0,255,200,${fade})`;
          ctx.shadowBlur = 20; ctx.shadowColor = '#00ffcc';
        } else if (i < 5) {
          ctx.fillStyle = `rgba(0,200,255,${fade * 0.9})`;
          ctx.shadowBlur = 8; ctx.shadowColor = '#00c8ff';
        } else {
          ctx.fillStyle = `rgba(0,120,200,${fade * 0.6})`;
          ctx.shadowBlur = 3; ctx.shadowColor = '#0080cc';
        }
      } else if (i === 0) {
        ctx.fillStyle = `rgba(255,240,80,${fade})`;
        ctx.shadowBlur = 20; ctx.shadowColor = '#ffdd00';
      } else if (i < 5) {
        ctx.fillStyle = `rgba(255,160,20,${fade * 0.9})`;
        ctx.shadowBlur = 8; ctx.shadowColor = '#ff8800';
      } else {
        ctx.fillStyle = `rgba(255,80,0,${fade * 0.6})`;
        ctx.shadowBlur = 3; ctx.shadowColor = '#ff4400';
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      lastSx = tp.sx; lastSy = tp.sy;
    }
  });

  // ── MUZZLE FLASH ──
  if (state.muzzleFlash > 0) {
    state.muzzleFlash--;
    const mAlpha = state.muzzleFlash / 8;
    const mR = 30 * mAlpha;
    if (mR > 0) {
      const mg = ctx.createRadialGradient(pcx, pcy+60, 0, pcx, pcy+60, mR);
      mg.addColorStop(0, `rgba(255,255,180,${mAlpha})`);
      mg.addColorStop(1, `rgba(255,140,0,0)`);
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(pcx, pcy+60, mR, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // ── DEPTH CHARGES ──
  drawDepthCharges();

  // ── EXPLOSIONS IN PERISCOPE ──
  drawExplosions();

  // ── SCOPE MASK (circular vignette) ──
  scopeMaskCanvas.width = W;
  scopeMaskCanvas.height = H;
  const sc = scopeCtx;
  sc.clearRect(0, 0, W, H);

  const scopeR = Math.min(W, H) * 0.52;
  const scopeCX = pcx, scopeCY = pcy;

  // Dark outside the circle
  sc.fillStyle = 'rgba(0,0,0,0.97)';
  sc.fillRect(0, 0, W, H);
  sc.globalCompositeOperation = 'destination-out';
  sc.beginPath();
  sc.arc(scopeCX, scopeCY, scopeR, 0, Math.PI*2);
  sc.fill();
  sc.globalCompositeOperation = 'source-over';

  // Scope ring — red in battle stations
  sc.beginPath();
  sc.arc(scopeCX, scopeCY, scopeR, 0, Math.PI*2);
  const ringPulse = state.battleStations ? (0.7 + 0.3*Math.sin(state.animFrame*0.12)) : 0.7;
  sc.strokeStyle = state.battleStations ? `rgba(255,60,60,${ringPulse})` : 'rgba(0,180,220,0.7)';
  sc.lineWidth = state.battleStations ? 4 : 3;
  sc.stroke();
  // Second outer ring in battle stations
  if (state.battleStations) {
    sc.beginPath();
    sc.arc(scopeCX, scopeCY, scopeR+4, 0, Math.PI*2);
    sc.strokeStyle = `rgba(255,0,0,${ringPulse*0.4})`;
    sc.lineWidth = 2;
    sc.stroke();
  }

  // Inner vignette
  const vigGrad = sc.createRadialGradient(scopeCX, scopeCY, scopeR*0.7, scopeCX, scopeCY, scopeR);
  vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vigGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
  sc.fillStyle = vigGrad;
  sc.beginPath();
  sc.arc(scopeCX, scopeCY, scopeR, 0, Math.PI*2);
  sc.fill();

  // Crosshair reticle
  sc.strokeStyle = 'rgba(0,229,255,0.5)';
  sc.lineWidth = 0.8;
  // Main cross
  sc.beginPath(); sc.moveTo(scopeCX - scopeR*0.85, scopeCY); sc.lineTo(scopeCX + scopeR*0.85, scopeCY); sc.stroke();
  sc.beginPath(); sc.moveTo(scopeCX, scopeCY - scopeR*0.85); sc.lineTo(scopeCX, scopeCY + scopeR*0.85); sc.stroke();
  // Range rings
  [0.15, 0.3, 0.5].forEach(r => {
    sc.beginPath();
    sc.arc(scopeCX, scopeCY, scopeR * r, 0, Math.PI*2);
    sc.strokeStyle = `rgba(0,229,255,${0.15 - r*0.1})`;
    sc.stroke();
  });
  // ── ACOUSTIC LOCK RING ──
  var _activeHomer = null;
  for (var _li = 0; _li < state.torpedoes.length; _li++) {
    if (state.torpedoes[_li].isHoming && !state.torpedoes[_li].isEnemy) {
      _activeHomer = state.torpedoes[_li]; break;
    }
  }
  if (_activeHomer || state.weaponMode === 'acoustic') {
    var _lk = _activeHomer ? (_activeHomer.lockStrength || 0) : state.acousticLock;
    var _lockR = scopeR * 0.15;
    // Background ring
    sc.beginPath(); sc.arc(scopeCX, scopeCY, _lockR, 0, Math.PI*2);
    sc.strokeStyle = 'rgba(255,140,0,0.18)'; sc.lineWidth = 2.5; sc.stroke();
    // Filled arc scaled to lock strength
    if (_lk > 0.01) {
      var _lkRGB = _lk > 0.75 ? '0,255,100' : _lk > 0.4 ? '255,200,0' : '255,50,50';
      sc.beginPath();
      sc.arc(scopeCX, scopeCY, _lockR, -Math.PI/2, -Math.PI/2 + _lk * Math.PI * 2);
      sc.strokeStyle = `rgba(${_lkRGB},${0.55 + _lk*0.45})`;
      sc.lineWidth = 3.5; sc.stroke();
    }
    // Status label
    var _lkLabel = _activeHomer
      ? (_lk > 0.75 ? '⊛ LOCK' : _lk > 0.4 ? '◎ GUIDE' : '○ WEAK')
      : (_lk > 0.35 ? '◎ AIM' : '○ AIM');
    var _lkCol = _lk > 0.75 ? '#00ff66' : _lk > 0.4 ? '#ffcc00' : '#ff4444';
    sc.font = 'bold 8px Share Tech Mono'; sc.textAlign = 'center';
    sc.fillStyle = _lkCol;
    sc.fillText(_lkLabel, scopeCX, scopeCY - _lockR - 7);
  }

  // Tick marks
  for (let a = 0; a < 360; a += 10) {
    const rad = a * Math.PI/180;
    const inner = a % 30 === 0 ? scopeR * 0.88 : scopeR * 0.92;
    sc.beginPath();
    sc.moveTo(scopeCX + Math.cos(rad)*inner, scopeCY + Math.sin(rad)*inner);
    sc.lineTo(scopeCX + Math.cos(rad)*scopeR*0.97, scopeCY + Math.sin(rad)*scopeR*0.97);
    sc.strokeStyle = `rgba(0,180,220,${a%30===0?0.5:0.25})`;
    sc.lineWidth = a%30===0 ? 1.5 : 0.7;
    sc.stroke();
  }
  // Optical scratch lines
  sc.strokeStyle = 'rgba(0,100,150,0.08)';
  sc.lineWidth = 0.5;
  for (let i = 0; i < 4; i++) {
    sc.beginPath();
    sc.moveTo(scopeCX - scopeR + i*scopeR*0.6, scopeCY - scopeR);
    sc.lineTo(scopeCX - scopeR*0.5 + i*scopeR*0.6, scopeCY + scopeR);
    sc.stroke();
  }

  // ── BEARING COMPASS ──
  const pc = periCompassCtx;
  // Sync canvas resolution to actual display width so hull bars are crisp
  var _cw = periCompassCanvas.offsetWidth || 260;
  if (periCompassCanvas.width !== _cw) periCompassCanvas.width = _cw;
  const cpW = periCompassCanvas.width;
  pc.fillStyle = 'rgba(0,5,15,0.9)';
  pc.fillRect(0, 0, cpW, 48);
  const bearingDeg = ((state.periAngleH * 180 / Math.PI + 180) % 360 + 360) % 360;
  const centreX = cpW / 2;
  pc.font = '7px Share Tech Mono';
  for (let d = -90; d <= 90; d += 5) {
    const deg = (bearingDeg + d + 360) % 360;
    const px = centreX + d * 1.4;
    if (d % 30 === 0) {
      const labels = ['N','030','060','E','120','150','S','210','240','W','300','330'];
      const label = labels[Math.round(deg/30) % 12];
      pc.fillStyle = label==='N'||label==='E'||label==='S'||label==='W' ? '#00ff9d' : 'rgba(0,200,255,0.7)';
      pc.textAlign = 'center';
      pc.fillText(label, px, 10);
      pc.strokeStyle = 'rgba(0,200,255,0.5)';
      pc.lineWidth = 1.5;
      pc.beginPath(); pc.moveTo(px, 13); pc.lineTo(px, 22); pc.stroke();
    } else if (d % 10 === 0) {
      pc.strokeStyle = 'rgba(0,150,200,0.35)';
      pc.lineWidth = 0.8;
      pc.beginPath(); pc.moveTo(px, 16); pc.lineTo(px, 22); pc.stroke();
    } else {
      pc.strokeStyle = 'rgba(0,120,160,0.2)';
      pc.lineWidth = 0.5;
      pc.beginPath(); pc.moveTo(px, 18); pc.lineTo(px, 22); pc.stroke();
    }
  }
  // Centre marker
  pc.strokeStyle = '#00e5ff';
  pc.lineWidth = 2;
  pc.beginPath(); pc.moveTo(centreX, 12); pc.lineTo(centreX, 26); pc.stroke();
  // Current bearing readout
  pc.fillStyle = '#00e5ff';
  pc.font = 'bold 8px Share Tech Mono';
  pc.textAlign = 'center';
  pc.fillText(padL(bearingDeg.toFixed(0),3,'0')+'°', centreX, 10);
  // Hull integrity bar below bearing strip
  drawHullBar(pc, 30, periCompassCanvas.width);

  // Update periscope HUD
  const dM = ((GRID.H - state.player.y)*VOXEL_Y).toFixed(1);
  document.getElementById('peri-depth').textContent = `-${dM}m`;
  document.getElementById('peri-bearing').textContent = padL(bearingDeg.toFixed(0),3,'0')+'°';
  document.getElementById('peri-torps').textContent = state.torpCount;
  document.getElementById('peri-hull').textContent = state.hull + '%';

  // Contact status
  const showContact = state.forceReveal || state.revealAlpha > 0;
  if (showContact && state.enemy.alive) {
    const edx = state.enemy.x - state.player.x;
    const edz = state.enemy.z - state.player.z;
    const eBearing = ((Math.atan2(edx, -edz) * 180/Math.PI) + 360) % 360;
    const eRange = Math.sqrt(edx*edx + edz*edz).toFixed(1);
    document.getElementById('peri-contact').innerHTML =
      '<span style="color:#ff4444">BRAVO '+padL(eBearing.toFixed(0),3,'0')+'° '+eRange+'u</span>';
  } else {
    document.getElementById('peri-contact').textContent = 'NO CONTACT';
  }
}

// ── PERISCOPE DRAG (look around) ──
function setupPeriDrag() {
  let lastX = 0, lastY = 0, active = false;

  function isInteractive(e) {
    // Don't start drag if the target is a button or inside the action bar
    const t = e.target;
    return t.tagName === 'BUTTON' ||
           t.closest('#peri-actions') ||
           t.closest('#peri-info-left') ||
           t.closest('#peri-compass');
  }

  function start(x, y, e) {
    if (isInteractive(e)) return;
    if (y >= getControlsTop()) return;
    active = true; lastX = x; lastY = y;
  }
  function move(x, y) {
    if (!active) return;
    const dx = x - lastX, dy = y - lastY;
    if (state.viewMode === 'surface' || state.viewMode === 'surfaced') {
      surfaceBearing -= dx * 0.006;
    } else {
      state.periAngleH += dx * 0.006;
      state.periAngleV = Math.max(-0.6, Math.min(0.8, state.periAngleV + dy * 0.004));
    }
    lastX = x; lastY = y;
  }
  function end() { active = false; }

  const isNonCommand = () => state.viewMode !== 'command';
  canvas.addEventListener('touchstart', e => {
    if (isNonCommand() && e.touches.length===1)
      start(e.touches[0].clientX, e.touches[0].clientY, e);
  }, {passive:true});
  canvas.addEventListener('touchmove', e => {
    if (isNonCommand() && e.touches.length===1 && active) {
      move(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }
  }, {passive:false});
  canvas.addEventListener('touchend', () => end());
  canvas.addEventListener('mousedown', e => {
    if (isNonCommand() && e.button===0) start(e.clientX, e.clientY, e);
  });
  canvas.addEventListener('mousemove', e => {
    if (isNonCommand() && (e.buttons&1)) move(e.clientX, e.clientY);
  });
  canvas.addEventListener('mouseup', () => end());
}
setupPeriDrag();

// ── COMPASS DRAG (rotate heading) ──
(function setupCompassDrag() {
  const el = document.getElementById('peri-compass');
  let lastX = 0, active = false;
  const RAD_PER_PX = (1 / 1.4) * (Math.PI / 180); // matches compass 1.4 px/deg render scale

  el.addEventListener('pointerdown', e => {
    active = true; lastX = e.clientX;
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener('pointermove', e => {
    if (!active) return;
    const dx = e.clientX - lastX;
    if (state.viewMode === 'surface' || state.viewMode === 'surfaced') {
      surfaceBearing -= dx * RAD_PER_PX;
    } else {
      state.periAngleH += dx * RAD_PER_PX;
    }
    lastX = e.clientX;
    e.preventDefault();
  });
  el.addEventListener('pointerup',     () => { active = false; });
  el.addEventListener('pointercancel', () => { active = false; });
})();

// ── PERISCOPE TOGGLE ──
// btn-periscope lives in the hidden controls-wrap — route to the unified toggle
document.getElementById('btn-periscope').addEventListener('click', () => {
  if (state.viewMode === 'command') goToPeriscope(); else goToCommand();
});

// Switch to command viewport (map) — periscope UI stays visible
function goToCommand() {
  state.viewMode = 'command';
  setAmbientMode('off');
  // Keep periscope overlay active — only the main canvas content changes
  document.getElementById('peri-btn-back').textContent = '⊙ PERISCOPE';
  // Hide circular vignette — it only belongs in periscope view
  scopeMaskCanvas.style.display = 'none';
  const flash = document.getElementById('view-transition');
  flash.classList.add('flash');
  setTimeout(() => flash.classList.remove('flash'), 200);
  addEvent('▸ COMMAND MAP', false);
}

// Switch back to periscope underwater view
function goToPeriscope() {
  state.viewMode = 'periscope';
  setAmbientMode('underwater');
  document.getElementById('peri-btn-back').textContent = '◈ COMMAND';
  // Restore circular vignette for periscope view
  scopeMaskCanvas.style.display = '';
  const flash = document.getElementById('view-transition');
  flash.classList.add('flash');
  setTimeout(() => flash.classList.remove('flash'), 200);
  addEvent('▸ PERISCOPE — SCANNING', false);
}

// COMMAND / PERISCOPE toggle button
document.getElementById('peri-btn-back').addEventListener('click', () => {
  if (state.viewMode === 'command') goToPeriscope(); else goToCommand();
});
document.getElementById('peri-btn-back').addEventListener('pointerup', () => {
  // pointerup fires after click on touch; guard against double-fire
});

// ── PERISCOPE SLIDERS & FIRE ──

// Vertical slider on any element — drag up = +1 step, drag down = -1 step
// Uses pointer capture to prevent scroll stealing
function makePeriSlider(wrapId, onStep, stepPx) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  let active = false, lastY = 0, accum = 0;

  function onDown(e) {
    active = true; lastY = e.clientY; accum = 0;
    if (e.pointerId !== undefined) wrap.setPointerCapture(e.pointerId);
    e.stopPropagation(); e.preventDefault();
  }
  function onMove(e) {
    if (!active) return;
    e.stopPropagation(); e.preventDefault();
    const dy = e.clientY - lastY;
    lastY = e.clientY;
    accum += dy;
    while (accum < -stepPx) { onStep(1);  accum += stepPx; }  // drag up → +1
    while (accum >  stepPx) { onStep(-1); accum -= stepPx; }  // drag down → -1
  }
  function onUp(e) { active = false; }

  // Pointer events (covers both touch and mouse, no scroll conflict)
  wrap.addEventListener('pointerdown',  onDown,  {passive:false});
  wrap.addEventListener('pointermove',  onMove,  {passive:false});
  wrap.addEventListener('pointerup',    onUp,    {passive:false});
  wrap.addEventListener('pointercancel',onUp,    {passive:false});
  // Belt-and-suspenders: also block touchmove at the element level
  wrap.addEventListener('touchstart',   e => { e.preventDefault(); }, {passive:false});
  wrap.addEventListener('touchmove',    e => { e.preventDefault(); }, {passive:false});
}

// Map zone: vertical drag = forward/back, horizontal drag = strafe left/right
// Both relative to periscope heading direction
let periMoveAccumX = 0, periMoveAccumZ = 0;
let periStrafeAccumX = 0, periStrafeAccumZ = 0;

(function() {
  const wrap = document.getElementById('peri-fwd-wrap');
  let active = false, lastX = 0, lastY = 0;
  let accumFwd = 0, accumStrafe = 0;
  const STEP_PX = 20;

  function onDown(e) {
    active = true;
    lastX = e.clientX; lastY = e.clientY;
    accumFwd = 0; accumStrafe = 0;
    if (e.pointerId !== undefined) wrap.setPointerCapture(e.pointerId);
    e.stopPropagation(); e.preventDefault();
  }
  function onMove(e) {
    if (!active) return;
    e.stopPropagation(); e.preventDefault();
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;

    // Vertical drag = forward/back in facing direction
    accumFwd += dy; // drag up = positive = forward
    while (accumFwd >= STEP_PX)  { movePeriDir( 1); accumFwd -= STEP_PX; }
    while (accumFwd <= -STEP_PX) { movePeriDir(-1); accumFwd += STEP_PX; }

    // Horizontal drag = strafe
    // Periscope projection negates screen-X, so the sign must flip vs command view
    accumStrafe += (state.viewMode === 'command') ? -dx : dx;
    while (accumStrafe >= STEP_PX)  { movePeriStrafe( 1); accumStrafe -= STEP_PX; }
    while (accumStrafe <= -STEP_PX) { movePeriStrafe(-1); accumStrafe += STEP_PX; }
  }
  function onUp() { active = false; }

  wrap.addEventListener('pointerdown',  onDown,  {passive:false});
  wrap.addEventListener('pointermove',  onMove,  {passive:false});
  wrap.addEventListener('pointerup',    onUp,    {passive:false});
  wrap.addEventListener('pointercancel',onUp,    {passive:false});
  wrap.addEventListener('touchstart',   e => e.preventDefault(), {passive:false});
  wrap.addEventListener('touchmove',    e => e.preventDefault(), {passive:false});
})();

// Forward/back: when H increases we look right, so forward = (sin(H), cos(H)) wait...
// projectPeriscope: fx = rx*cosH + rz*sinH. Point at rz=1: fx=sinH. 
// When H increases, fx increases = point moves RIGHT on screen = world rotates right = looking left? No...
// Actually: screen_x = fx/ffz. If fx increases, point moves right on screen.
// A point at rz=1 (in front): as H increases, fx=sinH goes positive = moves right.
// That means as H increases, things IN FRONT move RIGHT = camera is rotating LEFT.
// So H increasing = looking LEFT. Drag right increases H = looking left. Still wrong.
// The drag should be: H -= dx for correct feel. Let's keep drag as += but flip projection.
// OR: just test empirically — the user says fwd/back works. Don't touch movement.
// Just fix the arrow to match whatever the actual look direction is.
function movePeriDir(dir) {
  const speedMult = state.silentRunning ? 0.5 : 1.0;
  const fwdX = -Math.sin(state.periAngleH) * -dir * speedMult;
  const fwdZ =  Math.cos(state.periAngleH) * -dir * speedMult;
  periMoveAccumX += fwdX;
  periMoveAccumZ += fwdZ;
  const stepX = Math.trunc(periMoveAccumX);
  const stepZ = Math.trunc(periMoveAccumZ);
  if (stepX !== 0 || stepZ !== 0) {
    movePlayer(stepX, 0, stepZ);
    periMoveAccumX -= stepX;
    periMoveAccumZ -= stepZ;
  }
}

// Strafe perpendicular to periscope heading (drag right = move right relative to view)
// Strafe right = 90° clockwise from forward
function movePeriStrafe(dir) {
  const speedMult = state.silentRunning ? 0.5 : 1.0;
  const strafeX =  Math.cos(state.periAngleH) * -dir * speedMult;
  const strafeZ =  Math.sin(state.periAngleH) * -dir * speedMult;
  periStrafeAccumX += strafeX;
  periStrafeAccumZ += strafeZ;
  const stepX = Math.trunc(periStrafeAccumX);
  const stepZ = Math.trunc(periStrafeAccumZ);
  if (stepX !== 0 || stepZ !== 0) {
    movePlayer(stepX, 0, stepZ);
    periStrafeAccumX -= stepX;
    periStrafeAccumZ -= stepZ;
  }
}

// Depth — drag up = rise (increase world Y toward surface), drag down = dive
makePeriSlider('peri-depth-slider-wrap', (dir) => {
  // dir=1 when dragging up → rise → increase world y (toward GRID.H = surface)
  movePlayer(0, dir, 0);
}, 28);

// ── DRAW PERISCOPE DEPTH SLIDER ──
const periDepthSliderCanvas = document.getElementById('peri-depth-slider');
const pdsCtx = periDepthSliderCanvas.getContext('2d');

function drawPeriDepthSlider() {
  const c = pdsCtx;
  const w = 44, h = 140;
  const trackX = 16, trackW = 10;
  const trackTop = 8, trackBot = h - 8;
  const trackH = trackBot - trackTop;

  // Waterline sits at the very top of the track — surfaced and periscope both pin here
  const waterlineY = trackTop;

  c.clearRect(0, 0, w, h);

  const surfZoneActive = state.viewMode === 'surfaced';

  // Track background (underwater portion)
  c.fillStyle = 'rgba(0,15,30,0.8)';
  c.fillRect(trackX, waterlineY, trackW, trackBot - waterlineY);
  c.strokeStyle = 'rgba(0,150,200,0.4)';
  c.lineWidth = 1;
  c.strokeRect(trackX, trackTop, trackW, trackH);

  // Waterline divider
  const wlAlpha = (state.viewMode === 'surface' || surfZoneActive) ? 1.0 : 0.5;
  c.strokeStyle = `rgba(0,220,255,${wlAlpha})`;
  c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(trackX - 5, waterlineY); c.lineTo(trackX + trackW + 5, waterlineY); c.stroke();
  c.lineWidth = 1;
  // Tilde wave symbol at waterline
  c.font = '7px Share Tech Mono';
  c.fillStyle = `rgba(0,220,255,${wlAlpha})`;
  c.textAlign = 'right';
  c.fillText('~', trackX - 6, waterlineY + 3);

  // Crush depth — red forbidden zone grows upward as hull weakens (underwater portion only)
  var crushFrac = getCrushFrac();
  var uwH = trackBot - waterlineY; // height of underwater portion in pixels
  if (crushFrac > 0) {
    var crushY = waterlineY + (1 - crushFrac) * uwH;
    var rg = c.createLinearGradient(0, crushY, 0, trackBot);
    rg.addColorStop(0, 'rgba(255,0,0,0)');
    rg.addColorStop(0.3, 'rgba(200,0,0,0.35)');
    rg.addColorStop(1,   'rgba(255,0,0,0.55)');
    c.fillStyle = rg;
    c.fillRect(trackX, crushY, trackW, trackBot - crushY);
    // Crush line marker
    c.strokeStyle = 'rgba(255,60,60,0.85)';
    c.lineWidth = 1;
    c.setLineDash([2, 2]);
    c.beginPath(); c.moveTo(trackX - 4, crushY); c.lineTo(trackX + trackW + 2, crushY); c.stroke();
    c.setLineDash([]);
    c.font = '5px Share Tech Mono';
    c.fillStyle = 'rgba(255,80,80,0.8)';
    c.textAlign = 'left';
    c.fillText('MAX', trackX + trackW + 3, crushY + 4);
  }

  // Depth tick marks — only in underwater portion (y 0..GRID.H)
  c.font = '5px Share Tech Mono';
  for (let d = 0; d <= GRID.H; d += 2) {
    // d=0 is seabed, d=GRID.H is surface; map to underwater portion of track
    const yp = waterlineY + (1 - d/GRID.H) * (trackBot - waterlineY);
    c.strokeStyle = 'rgba(0,150,200,0.25)';
    c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(trackX-3, yp); c.lineTo(trackX, yp); c.stroke();
    if (d % 4 === 0) {
      const dm = -Math.round(d/GRID.H*80);
      c.fillStyle = 'rgba(0,150,200,0.4)';
      c.textAlign = 'right';
      c.fillText(`${dm}`, trackX - 4, yp + 2);
    }
  }

  // Helper: world y → track pixel
  function depthToY(wy) {
    if (wy >= GRID.H) return trackTop; // surfaced pins to top
    return waterlineY + (1 - wy/GRID.H) * (trackBot - waterlineY);
  }

  // Enemy depth marker (B, red)
  const showE = state.forceReveal || state.revealAlpha > 0;
  if (showE && state.enemy.alive) {
    const ey = depthToY(state.enemy.y);
    const ea = state.forceReveal ? 0.9 : state.revealAlpha;
    c.fillStyle = `rgba(255,68,68,${ea})`;
    c.shadowBlur = 5; c.shadowColor = '#ff4444';
    c.fillRect(trackX, ey-3, trackW, 6);
    c.shadowBlur = 0;
    c.fillStyle = `rgba(255,68,68,${ea})`;
    c.textAlign = 'left'; c.font = '6px Share Tech Mono';
    c.fillText('B', trackX + trackW + 3, ey + 2);
  }

  // Player depth marker (A, teal)
  const py = depthToY(state.player.y);
  const markerCol = state.viewMode === 'surfaced' ? '#00ff9d' : '#00e5ff';
  c.fillStyle = markerCol;
  c.shadowBlur = 8; c.shadowColor = markerCol;
  c.fillRect(trackX, py-4, trackW, 8);
  c.shadowBlur = 0;
  c.fillStyle = markerCol;
  c.beginPath();
  c.moveTo(trackX + trackW, py);
  c.lineTo(trackX + trackW + 6, py-4);
  c.lineTo(trackX + trackW + 6, py+4);
  c.closePath(); c.fill();
  c.textAlign = 'left'; c.font = '6px Share Tech Mono';
  c.fillText('A', trackX + trackW + 3, py + 2);

  // Depth readout
  c.fillStyle = markerCol; c.font = '7px Share Tech Mono';
  c.textAlign = 'center';
  if (state.viewMode === 'surfaced') {
    c.fillText('SURF', w/2, h - 1);
  } else {
    const dmVal = ((GRID.H - Math.min(state.player.y, GRID.H))/GRID.H*80).toFixed(0);
    c.fillText(`-${dmVal}m`, w/2, h - 1);
  }
}

// ── PERISCOPE MINIMAP (draws on the fwd/back canvas) ──
const periFwdCanvas = document.getElementById('peri-fwd-slider');
const pfCtx = periFwdCanvas.getContext('2d');

function drawPeriFwdSlider() {
  const c = pfCtx;
  const w = periFwdCanvas.offsetWidth || 120;
  const h = periFwdCanvas.offsetHeight || 200;
  periFwdCanvas.width = w;
  periFwdCanvas.height = h;

  // In terrain mode the sonar contour map is the navigation aid — this canvas
  // has no rooms/furniture to draw so just show a dark drag zone.
  if (window._isHeightfield) {
    c.fillStyle = 'rgba(0,4,12,0.97)';
    c.fillRect(0, 0, w, h);
    return;
  }

  // ── MINIMAP (top-down, same as sonar in command view) ──
  const pad = 8;
  const mapW = w - pad*2, mapH = h - pad*2;
  const scaleX = mapW / GRID.W;
  const scaleZ = mapH / GRID.D;
  const scale = Math.min(scaleX, scaleZ);
  const offX = pad + (mapW - scale*GRID.W)/2;
  const offZ = pad + (mapH - scale*GRID.D)/2;

  function mm(wx, wz) {
    return { x: offX + wx*scale, y: offZ + wz*scale };
  }

  // Background
  c.fillStyle = 'rgba(0,4,12,0.97)';
  c.fillRect(0,0,w,h);

  // Room boundary
  const r0=mm(0,0), r1=mm(GRID.W,GRID.D);
  c.strokeStyle='rgba(0,150,200,0.3)'; c.lineWidth=1;
  c.strokeRect(r0.x,r0.y,r1.x-r0.x,r1.y-r0.y);

  // Furniture footprints
  furniture.forEach(f => {
    if (f.type==='floor'||f.type==='surface') return;
    const fp0=mm(f.x1,f.z1), fp1=mm(f.x2,f.z2);
    const isWall = f.type==='wall'||f.type==='wall-inner';
    c.fillStyle = isWall ? 'rgba(0,130,180,0.35)' : 'rgba(60,200,120,0.25)';
    c.strokeStyle = isWall ? 'rgba(0,160,210,0.4)' : 'rgba(60,200,120,0.4)';
    c.lineWidth = 0.5;
    c.fillRect(fp0.x,fp0.y,Math.max(1,fp1.x-fp0.x),Math.max(1,fp1.y-fp0.y));
    c.strokeRect(fp0.x,fp0.y,Math.max(1,fp1.x-fp0.x),Math.max(1,fp1.y-fp0.y));
  });

  // Sonar sweep
  sonarAngle = (sonarAngle + 0.018) % (Math.PI*2);
  const pp2 = mm(state.player.x, state.player.z);
  c.save(); c.translate(pp2.x, pp2.y);
  const sweepR = Math.max(mapW,mapH)*0.8;
  const sg = c.createLinearGradient(0,0,sweepR,0);
  sg.addColorStop(0,'rgba(0,255,157,0.15)'); sg.addColorStop(1,'rgba(0,255,157,0)');
  c.fillStyle=sg; c.save(); c.rotate(sonarAngle);
  c.beginPath(); c.moveTo(0,0); c.arc(0,0,sweepR,-0.5,0); c.closePath(); c.fill();
  c.restore(); c.restore();

  // Torpedo tracks
  state.torpedoes.forEach(t => {
    const tp=mm(t.x,t.z), tp2=mm(t.x-t.dx*3,t.z-t.dz*3);
    c.beginPath(); c.moveTo(tp.x,tp.y); c.lineTo(tp2.x,tp2.y);
    c.strokeStyle='rgba(255,170,0,0.6)'; c.lineWidth=1.5; c.stroke();
    c.beginPath(); c.arc(tp.x,tp.y,2.5,0,Math.PI*2);
    c.fillStyle='#ffaa00'; c.shadowBlur=6; c.shadowColor='#ffaa00'; c.fill(); c.shadowBlur=0;
  });

  // Enemy trail — hidden in silent mode unless a reveal is active
  const _mmSilRev = Math.max(state.revealAlpha, state.enemySilentAlpha);
  const showE = !state.silentRunning || state.forceReveal || _mmSilRev > 0;
  if (showE) {
    const _mmRevA = state.silentRunning ? _mmSilRev * 0.5 : (state.forceReveal ? 0.5 : state.revealAlpha);
    state.enemyTrail.forEach((t,i) => {
      const tp=mm(t.x,t.z);
      const a=_mmRevA*(1-t.age/300)*(i/Math.max(1,state.enemyTrail.length));
      if(a>0.05){c.beginPath();c.arc(tp.x,tp.y,2,0,Math.PI*2);c.fillStyle=`rgba(255,68,68,${a})`;c.fill();}
    });
    if (state.enemy.alive) {
      const ep=mm(state.enemy.x,state.enemy.z);
      const ea=state.silentRunning ? _mmSilRev : (state.forceReveal?1:Math.max(0.7,state.revealAlpha));
      // Bearing line
      const playerPt=mm(state.player.x,state.player.z);
      c.beginPath();c.moveTo(playerPt.x,playerPt.y);c.lineTo(ep.x,ep.y);
      c.strokeStyle=`rgba(255,68,68,${ea*0.3})`;c.lineWidth=0.8;c.setLineDash([3,3]);c.stroke();c.setLineDash([]);
      // Enemy dot
      c.beginPath();c.arc(ep.x,ep.y,4,0,Math.PI*2);
      c.fillStyle=`rgba(255,68,68,${ea})`;c.shadowBlur=8;c.shadowColor='#ff4444';c.fill();c.shadowBlur=0;
    }
  }

  // ── WHALE BLIPS ──
  if (state.whales) state.whales.forEach(function(whale) {
    if (!whale.alive) return;
    const wp2=mm(whale.x,whale.z);
    c.beginPath();c.arc(wp2.x,wp2.y,3.5,0,Math.PI*2);
    c.fillStyle='#00ff66';c.shadowBlur=8;c.shadowColor='#00ff66';c.fill();c.shadowBlur=0;
    c.font='6px Share Tech Mono';c.textAlign='center';c.textBaseline='alphabetic';
    c.fillStyle='rgba(0,240,100,0.65)';c.fillText('WHL',wp2.x,wp2.y-5);
  });

  // ── MEGALODON BLIPS ──
  if (state.megalodons) state.megalodons.forEach(function(meg) {
    if (!meg.alive) return;
    const mp2=mm(meg.x,meg.z);
    c.beginPath();c.arc(mp2.x,mp2.y,4.5,0,Math.PI*2);
    c.fillStyle='#6688aa';c.shadowBlur=10;c.shadowColor='#6688aa';c.fill();c.shadowBlur=0;
    c.font='6px Share Tech Mono';c.textAlign='center';c.textBaseline='alphabetic';
    c.fillStyle='rgba(100,140,180,0.75)';c.fillText('MEG',mp2.x,mp2.y-6);
  });

  // ── SURFACE SHIP CONTACTS ──
  if (state.ships) state.ships.forEach(function(ship) {
    if (!ship.alive && !ship.sinking) return;
    const sp3=mm(ship.x,ship.z);
    const hx2=sp3.x+Math.sin(ship.heading)*7, hz2=sp3.y+Math.cos(ship.heading)*7;
    c.beginPath();c.moveTo(sp3.x,sp3.y);c.lineTo(hx2,hz2);
    c.strokeStyle='rgba(255,230,80,0.55)';c.lineWidth=1;c.stroke();
    c.save();c.translate(sp3.x,sp3.y);c.rotate(Math.PI/4);
    c.beginPath();c.rect(-3,-3,6,6);
    const sA=ship.sinking?Math.max(0.3,ship.sinkY/GRID.H):1.0;
    c.fillStyle=`rgba(255,220,60,${sA})`;c.shadowBlur=8;c.shadowColor='#ffdd00';c.fill();c.shadowBlur=0;
    c.restore();
    c.font='6px Share Tech Mono';c.textAlign='center';c.textBaseline='alphabetic';
    c.fillStyle=`rgba(255,220,60,${sA*0.8})`;c.fillText(ship.label.split(' ')[0],sp3.x,sp3.y-6);
  });

  // FWD arrow above map
  c.fillStyle = 'rgba(0,220,150,0.7)';
  c.shadowBlur = 6; c.shadowColor = '#00ff9d';
  c.beginPath(); c.moveTo(w/2, 4); c.lineTo(w/2-10, 16); c.lineTo(w/2+10, 16); c.closePath(); c.fill();
  c.font = '6px Share Tech Mono'; c.fillStyle='rgba(0,220,150,0.6)';
  c.textAlign='center'; c.shadowBlur=0;
  c.fillText('FWD', w/2, 26);

  // BWD arrow below map
  c.fillStyle = 'rgba(0,220,150,0.7)';
  c.shadowBlur = 6; c.shadowColor = '#00ff9d';
  c.beginPath(); c.moveTo(w/2, h-4); c.lineTo(w/2-10, h-16); c.lineTo(w/2+10, h-16); c.closePath(); c.fill();
  c.font = '6px Share Tech Mono'; c.fillStyle='rgba(0,220,150,0.6)'; c.shadowBlur=0;
  c.fillText('BWD', w/2, h-28);

  // LEFT strafe arrow
  c.fillStyle = 'rgba(0,180,255,0.6)';
  c.shadowBlur = 4; c.shadowColor = '#00aaff';
  c.beginPath(); c.moveTo(4, h/2); c.lineTo(16, h/2-8); c.lineTo(16, h/2+8); c.closePath(); c.fill();
  c.font = '5px Share Tech Mono'; c.fillStyle='rgba(0,180,255,0.5)';
  c.textAlign='center'; c.shadowBlur=0;
  c.fillText('◄', 10, h/2+14);

  // RIGHT strafe arrow
  c.fillStyle = 'rgba(0,180,255,0.6)';
  c.shadowBlur = 4; c.shadowColor = '#00aaff';
  c.beginPath(); c.moveTo(w-4, h/2); c.lineTo(w-16, h/2-8); c.lineTo(w-16, h/2+8); c.closePath(); c.fill();
  c.font = '5px Share Tech Mono'; c.fillStyle='rgba(0,180,255,0.5)';
  c.shadowBlur=0;
  c.fillText('►', w-10, h/2+14);

  // Player dot with heading arrow matching periscope direction
  // periAngleH: 0 = facing +Z (down on minimap), PI/2 = facing +X (right on minimap)
  // minimap: X = world X (right), Y = world Z (down)
  // So heading on minimap: angle from up = periAngleH (clockwise from north/up)
  const ppx = mm(state.player.x, state.player.z);
  const arrowLen = 14;
  // Use surfaceBearing in surface mode, periAngleH otherwise
  const _bearingForArrow = state.viewMode === 'surface' ? -surfaceBearing : state.periAngleH;
  const arrowDx = -Math.sin(_bearingForArrow) * arrowLen;
  const arrowDy =  Math.cos(_bearingForArrow) * arrowLen;

  // Glow halo
  const grd = c.createRadialGradient(ppx.x, ppx.y, 0, ppx.x, ppx.y, 16);
  grd.addColorStop(0, 'rgba(0,229,255,0.25)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = grd;
  c.beginPath(); c.arc(ppx.x, ppx.y, 16, 0, Math.PI*2); c.fill();

  // Heading arrow line
  c.strokeStyle = '#00e5ff'; c.lineWidth = 1.5;
  c.shadowBlur = 6; c.shadowColor = '#00e5ff';
  c.beginPath();
  c.moveTo(ppx.x, ppx.y);
  c.lineTo(ppx.x + arrowDx, ppx.y + arrowDy);
  c.stroke();

  // Arrowhead
  const tipX = ppx.x + arrowDx;
  const tipY = ppx.y + arrowDy;
  const aH = state.periAngleH;
  const perpA = aH + Math.PI/2;
  c.beginPath();
  c.moveTo(tipX, tipY);
  c.lineTo(tipX - Math.sin(aH)*5 + Math.sin(perpA)*3,
           tipY + Math.cos(aH)*5 + Math.cos(perpA)*3);
  c.lineTo(tipX - Math.sin(aH)*5 - Math.sin(perpA)*3,
           tipY + Math.cos(aH)*5 - Math.cos(perpA)*3);
  c.closePath();
  c.fillStyle = '#00e5ff'; c.fill();
  c.shadowBlur = 0;

  // Player dot (on top of arrow)
  c.beginPath(); c.arc(ppx.x, ppx.y, 3.5, 0, Math.PI*2);
  c.fillStyle='#00e5ff'; c.shadowBlur=8; c.shadowColor='#00e5ff'; c.fill(); c.shadowBlur=0;
}

// ── PERISCOPE FIRE ──
function periFireTorpedo() {
  if (!torpReady()) { addEvent('⚠ TORPEDO RELOADING — ' + torpSecsLeft() + 's', true); return; }

  // ── ACOUSTIC HOMING TORPEDO ──
  if (state.weaponMode === 'acoustic') {
    if (state.torpCount !== Infinity && state.torpCount <= 0) { addEvent('⚠ NO TORPEDOES', true); return; }
    if (!state.enemy.alive) { addEvent('⚠ NO TARGET', true); return; }
    const _ah = state.periAngleH;
    const _adx = -Math.sin(_ah), _adz = Math.cos(_ah);
    const _aox = state.player.x + _adx * 1.5, _aoz = state.player.z + _adz * 1.5;
    state.torpedoes.push({
      ox: _aox, oy: state.player.y, oz: _aoz,
      x:  _aox, y:  state.player.y, z:  _aoz,
      dx: _adx, dy: 0, dz: _adz,
      heading: Math.atan2(_adx, _adz),
      speed: 0.11, progress: 0,
      isHoming: true, lockStrength: Math.max(0.25, state.acousticLock)
    });
    if (state.torpCount !== Infinity) state.torpCount--;
    state.torpsFired++;
    state.torpLastFired = Date.now();
    state.muzzleFlash = 8;
    if (state.silentRunning) revealPlayerToEnemy(420);
    if (!state.battleStations) document.getElementById('btn-battlestations').click();
    playTorpedoLaunch();
    const _lkWord = state.acousticLock > 0.7 ? 'STRONG LOCK' : state.acousticLock > 0.35 ? 'PARTIAL LOCK' : 'WEAK LOCK — KEEP TRACKING';
    addEvent(`⊛ ACOUSTIC AWAY — ${_lkWord}`, false);
    document.getElementById('torp-count').textContent = state.torpCount === Infinity ? '∞' : state.torpCount;
    return;
  }

  // ── TORPEDO MINE ──
  if (state.weaponMode === 'mine') {
    if (state.torpCount !== Infinity && state.torpCount <= 0) { addEvent('⚠ NO TORPEDOES', true); return; }
    state.torpedoes.push({
      ox: state.player.x, oy: state.player.y, oz: state.player.z,
      x:  state.player.x, y:  state.player.y, z:  state.player.z,
      dx: 0, dy: 1, dz: 0, speed: 0.15, progress: 0, isMine: true
    });
    if (state.torpCount !== Infinity) state.torpCount--;
    state.torpsFired++;
    state.torpLastFired = Date.now();
    state.muzzleFlash = 8;
    playTorpedoLaunch();
    addEvent('⬆ TORPEDO MINE AWAY — RISING', false);
    return;
  }

  if (state.viewMode === 'surface' || state.viewMode === 'surfaced') {
    if (state.torpCount !== Infinity && state.torpCount <= 0) { addEvent('⚠ NO TORPEDOES', true); return; }
    const sndx = Math.sin(-surfaceBearing);
    const sndz = Math.cos(-surfaceBearing);
    state.torpedoes.push({ ox:state.player.x, oy:GRID.H, oz:state.player.z,
      x:state.player.x, y:GRID.H, z:state.player.z,
      dx:sndx, dy:0, dz:sndz, speed:0.3, progress:0 });
    if (state.silentRunning) revealPlayerToEnemy(420);
    if (state.torpCount !== Infinity) state.torpCount--;
    state.torpsFired++;
    state.torpLastFired = Date.now();
    if (!state.battleStations) document.getElementById('btn-battlestations').click();
    state.muzzleFlash = 8;
    playTorpedoLaunch();
    addEvent('⊛ SURFACE TORPEDO AWAY', false);
    return;
  }
  if (state.torpCount !== Infinity && state.torpCount <= 0) { addEvent('⚠ NO TORPEDOES REMAINING', true); return; }

  if (state.firingSolution) {
    doFire();
    document.getElementById('peri-btn-fire').classList.remove('armed');
    return;
  }

  // Correct world-space forward from projectPeriscope inverse:
  // Rotate world by H then V to get camera. Forward=(0,0,1) in cam.
  // Invert V: fz=cosV, fy=sinV
  // Invert H: rx=-sinH*cosV, rz=cosH*cosV, ry=sinV
  const cosH = Math.cos(state.periAngleH);
  const sinH = Math.sin(state.periAngleH);
  const cosV = Math.cos(state.periAngleV);
  const sinV = Math.sin(state.periAngleV);

  const ndx = -sinH * cosV;
  const ndy = -sinV;  // negative: +periAngleV = looking down = lower world Y
  const ndz =  cosH * cosV;
  const nlen = Math.sqrt(ndx*ndx + ndy*ndy + ndz*ndz) || 1;

  const ox = state.player.x + (ndx/nlen) * 2;
  const oy = Math.max(0.5, Math.min(GRID.H-0.5, state.player.y + (ndy/nlen) * 2));
  const oz = state.player.z + (ndz/nlen) * 2;

  state.torpedoes.push({ ox, oy, oz, x:ox, y:oy, z:oz,
    dx:ndx/nlen, dy:ndy/nlen, dz:ndz/nlen, speed:0.3, progress:0 });
  if (state.torpCount !== Infinity) state.torpCount--;
  state.torpsFired++;
  document.getElementById('torp-count').textContent = state.torpCount === Infinity ? '∞' : state.torpCount;
  state.muzzleFlash = 8;
  playTorpedoLaunch();
  addEvent('⊛ TORPEDO AWAY', false);
}




// Periscope ping button
document.getElementById('peri-btn-ping-peri').addEventListener('click', doPing);
document.getElementById('peri-btn-ping-peri').addEventListener('pointerup', doPing);
document.getElementById('peri-btn-cm').addEventListener('click', launchCountermeasures);

// ── SILENT RUNNING TOGGLE ──
let _silentPreset = null;
document.getElementById('peri-btn-reveal-peri').addEventListener('click', () => {
  const btn = document.getElementById('peri-btn-reveal-peri');
  if (!state.silentRunning) {
    // Engage silent running
    state.silentRunning = true;
    state.silentPings = [];
    state.forceReveal = false;
    // Enemy briefly retains last known position before losing contact
    state.enemyKnowsPlayer = true;
    state.enemyKnowsTimer = 240;
    state.enemyLastKnown = {x: state.player.x, z: state.player.z};
    state.enemyPingTimer = 720 + Math.floor(Math.random() * 480); // 12-20s until first enemy ping
    state.playerNoise = 0;
    // Save and apply preset: dense points, lines off, black fill
    _silentPreset = { cloudDensity, showWireframe: state.showWireframe, terrainFillOpacity, lineOpacity };
    cloudDensity = DENSITY_MIN;
    state.showWireframe = false;
    terrainFillOpacity = 1.0;
    lineOpacity = 0;
    debouncedGenerateCloud();
    btn.textContent = '◎ SILENT';
    btn.classList.add('silent-active');
    addEvent('◎ SILENT RUNNING — ENGAGED', false);
  } else {
    // Disengage silent running — back to standard steaming
    state.silentRunning = false;
    state.silentPings = [];
    state.enemyPings = [];
    state.enemyKnowsPlayer = true;
    state.enemyKnowsTimer = 0;
    state.playerNoise = 0;
    state.forceReveal = true;
    if (_silentPreset) {
      cloudDensity = _silentPreset.cloudDensity;
      state.showWireframe = _silentPreset.showWireframe;
      terrainFillOpacity = _silentPreset.terrainFillOpacity;
      lineOpacity = _silentPreset.lineOpacity;
      debouncedGenerateCloud();
      _silentPreset = null;
    }
    btn.innerHTML = 'STANDARD<br>STEAMING';
    btn.classList.remove('silent-active');
    addEvent('◎ SILENT RUNNING — DISENGAGED', false);
  }
});

// Periscope density buttons
document.getElementById('peri-density-up').addEventListener('click', () => {
  cloudDensity = Math.max(DENSITY_MIN, cloudDensity - 0.2);
  debouncedGenerateCloud();
});

document.getElementById('peri-density-down').addEventListener('click', () => {
  cloudDensity = Math.min(DENSITY_MAX, cloudDensity + 0.2);
  debouncedGenerateCloud();
});

// Periscope point size buttons (no cloud rebuild needed)
document.getElementById('peri-size-up').addEventListener('click', () => {
  periPointSize = Math.min(50, periPointSize + 5);
  document.getElementById('peri-size-val').textContent = periPointSize.toFixed(0);
});
document.getElementById('peri-size-down').addEventListener('click', () => {
  periPointSize = Math.max(5, periPointSize - 5);
  document.getElementById('peri-size-val').textContent = periPointSize.toFixed(0);
});

let wireframeScale = 2.5; // line thickness multiplier

document.getElementById('peri-btn-signal').addEventListener('click', () => {
  const panel = document.getElementById('render-panel');
  const btn = document.getElementById('peri-btn-signal');
  const open = panel.style.display === 'none' || panel.style.display === '';
  panel.style.display = open ? 'flex' : 'none';
  btn.classList.toggle('open', open);
});

document.getElementById('peri-wireframe-btn').addEventListener('click', () => {
  state.showWireframe = !state.showWireframe;
  const btn = document.getElementById('peri-wireframe-btn');
  btn.textContent = state.showWireframe ? 'ON' : 'OFF';
  btn.classList.toggle('on', state.showWireframe);
});

document.getElementById('peri-dots-btn').addEventListener('click', () => {
  state.showDots = !state.showDots;
  const btn = document.getElementById('peri-dots-btn');
  btn.textContent = state.showDots ? 'ON' : 'OFF';
  btn.classList.toggle('on', state.showDots);
});

document.getElementById('peri-line-thick').addEventListener('click', () => {
  wireframeScale = Math.min(4.0, wireframeScale + 0.5);
});
document.getElementById('peri-line-thin').addEventListener('click', () => {
  wireframeScale = Math.max(0.25, wireframeScale - 0.25);
});

// ── LINE COLOUR CONTROLS ──
let lineColor = '#00e5ff';
let lineOpacity = 0.25;
document.getElementById('line-color-pick').addEventListener('input', e => {
  lineColor = e.target.value;
});
document.getElementById('line-opacity-up').addEventListener('click', () => {
  lineOpacity = Math.min(1, Math.round((lineOpacity + 0.05) * 100) / 100);
  document.getElementById('line-opacity-val').textContent = Math.round(lineOpacity * 100) + '%';
});
document.getElementById('line-opacity-down').addEventListener('click', () => {
  lineOpacity = Math.max(0, Math.round((lineOpacity - 0.05) * 100) / 100);
  document.getElementById('line-opacity-val').textContent = Math.round(lineOpacity * 100) + '%';
});

// ── TERRAIN FILL CONTROLS ──
let terrainFillColor = '#000000';
let terrainFillOpacity = 1.0;
function _hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
document.getElementById('terrain-color-pick').addEventListener('input', e => {
  terrainFillColor = e.target.value;
});
document.getElementById('terrain-fill-up').addEventListener('click', () => {
  terrainFillOpacity = Math.min(1, Math.round((terrainFillOpacity + 0.05) * 100) / 100);
  document.getElementById('terrain-fill-val').textContent = Math.round(terrainFillOpacity * 100) + '%';
});
document.getElementById('terrain-fill-down').addEventListener('click', () => {
  terrainFillOpacity = Math.max(0, Math.round((terrainFillOpacity - 0.05) * 100) / 100);
  document.getElementById('terrain-fill-val').textContent = Math.round(terrainFillOpacity * 100) + '%';
});

const periFireBtn = document.getElementById('peri-btn-fire');
periFireBtn.addEventListener('click',     periFireTorpedo);
periFireBtn.addEventListener('pointerup', periFireTorpedo);

// ══════════════════════════════════════════════
// WAYPOINT MISSION SYSTEM
// ══════════════════════════════════════════════

function draw7Seg(canvas, digit, color) {
  const c = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  c.clearRect(0, 0, W, H);
  const p = 2, sw = 3, iw = W-p*2, ih = H-p*2, hh = ih/2;
  const segs = [
    [p,    p,    p+iw, p    ],  // 0 top
    [p,    p,    p,    p+hh ],  // 1 top-left
    [p+iw, p,    p+iw, p+hh],  // 2 top-right
    [p,    p+hh, p+iw, p+hh],  // 3 middle
    [p,    p+hh, p,    p+ih ],  // 4 bot-left
    [p+iw, p+hh, p+iw, p+ih],  // 5 bot-right
    [p,    p+ih, p+iw, p+ih],  // 6 bottom
  ];
  const on = { 1:[2,5], 2:[0,2,3,4,6], 3:[0,2,3,5,6], 4:[1,2,3,5], 5:[0,1,3,5,6] };
  c.lineWidth = sw; c.lineCap = 'square';
  c.strokeStyle = 'rgba(0,60,20,0.3)';
  segs.forEach(([x1,y1,x2,y2]) => { c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke(); });
  c.strokeStyle = color; c.shadowBlur = 6; c.shadowColor = color;
  (on[digit]||[]).forEach(i => {
    const [x1,y1,x2,y2] = segs[i];
    c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
  });
  c.shadowBlur = 0;
}

function updateWpPanel() {
  const m = state.wpMission;
  [1,2,3,4,5].forEach(n => {
    const wp = m.waypoints.find(w => w.num === n);
    const cvs = document.getElementById('wp-d'+n);
    if (!cvs) return;
    draw7Seg(cvs, n, !wp ? 'rgba(0,60,20,0.3)' : wp.collected ? '#ff8800' : '#00ff66');
  });
  const se = document.getElementById('wp-score-val');
  if (se) se.textContent = String(m.score).padStart(2,'0');
  const te = document.getElementById('wp-timer-val');
  if (te) {
    const secs = Math.max(0, Math.ceil(m.timeLeft/60));
    te.textContent = Math.floor(secs/60)+':'+String(secs%60).padStart(2,'0');
    te.style.color = secs < 30 ? '#ff4444' : 'var(--teal)';
  }
  const re = document.getElementById('wp-result-text');
  if (re) {
    if (m.result === 'accomplished') { re.textContent = 'MISSION ACCOMPLISHED'; re.style.color = '#00ff9d'; }
    else if (m.result === 'failed')  { re.textContent = 'MISSION FAILED';        re.style.color = '#ff4444'; }
    else re.textContent = '';
  }
}

function startWaypointMission() {
  const m = state.wpMission;
  m.active = true;
  m.waypoints = WP_DEFS.map(d => ({...d, collected:false, rotAngle:Math.random()*Math.PI*2}));
  m.nextRequired = 1; m.score = 0; m.timeLeft = 3600; m.result = null; m.resultTimer = 0;
  document.getElementById('wp-panel').style.display = 'flex';
  updateWpPanel();
  addEvent('▸ INCOMING TRANSMISSION', false);
  setTimeout(()=>addEvent('▸ WAYPOINT MISSION — PLOT COURSE IN SEQUENCE', false), 1200);
  setTimeout(()=>addEvent('▸ NAVIGATE WAYPOINTS 1→5 — 1 MINUTE', false), 2400);
  playWpStart();
}

function collectWaypoint(wp) {
  wp.collected = true;
  var pts = wp.num * 10;
  state.wpMission.score += pts;
  state.wpMission.nextRequired++;
  addScore(pts);
  addEvent('⊛ WAYPOINT '+wp.num+' SECURED — +'+pts+' PTS', false);
  playWpCollect();
  updateWpPanel();
  if (state.wpMission.nextRequired > 5) missionAccomplished();
}

function missionAccomplished() {
  const m = state.wpMission;
  m.active = false; m.result = 'accomplished'; m.resultTimer = 360;
  m.triggerIn = 18000;
  addEvent('★ MISSION ACCOMPLISHED — '+m.score+' PTS ADDED TO SCORE', false);
  playWpAccomplished();
  updateWpPanel();
}

function missionFailed() {
  const m = state.wpMission;
  m.active = false; m.result = 'failed'; m.resultTimer = 300;
  m.timeLeft = 0; m.triggerIn = 10800;
  addEvent('⚠ WAYPOINT MISSION FAILED', true);
  playWpFailed();
  updateWpPanel();
}

function playWpCollect() {
  try {
    if (!audioCtx) initAudio(); if (!audioCtx) return;
    [440,554,659].forEach((freq,i) => {
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination); o.type='sine'; o.frequency.value=freq;
      const t=audioCtx.currentTime+i*0.07;
      g.gain.setValueAtTime(0.22,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.35);
      o.start(t); o.stop(t+0.4);
    });
  } catch(e) {}
}

function playWpAccomplished() {
  try {
    if (!audioCtx) initAudio(); if (!audioCtx) return;
    [[523,0],[659,0.12],[784,0.24],[1047,0.42],[784,0.58],[1047,0.74]].forEach(([freq,t])=>{
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination); o.type='square'; o.frequency.value=freq;
      const at=audioCtx.currentTime+t;
      g.gain.setValueAtTime(0.1,at); g.gain.exponentialRampToValueAtTime(0.001,at+0.22);
      o.start(at); o.stop(at+0.25);
    });
  } catch(e) {}
}

function playWpFailed() {
  try {
    if (!audioCtx) initAudio(); if (!audioCtx) return;
    [660,550,440,330].forEach((freq,i) => {
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination); o.type='sawtooth'; o.frequency.value=freq;
      const t=audioCtx.currentTime+i*0.15;
      g.gain.setValueAtTime(0.14,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.18);
      o.start(t); o.stop(t+0.2);
    });
  } catch(e) {}
}

function playWpStart() {
  try {
    if (!audioCtx) initAudio(); if (!audioCtx) return;
    [700,600,700,800,600,700,900].forEach((freq,i) => {
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination); o.type='sine'; o.frequency.value=freq;
      const t=audioCtx.currentTime+i*0.09;
      g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.07);
      o.start(t); o.stop(t+0.1);
    });
  } catch(e) {}
}

function drawWpMarker(c, sx, sy, num, color, rotAngle, scale) {
  const r = 14 * scale;
  if (r < 1) return;
  c.save();
  c.translate(sx, sy);
  // Rotating dashed ring
  c.beginPath();
  for (let i=0; i<8; i++) {
    const a1 = rotAngle + i*Math.PI/4;
    c.arc(0, 0, r, a1, a1+Math.PI/4*0.55);
  }
  c.strokeStyle = color; c.lineWidth = 2*scale;
  c.shadowBlur = 10; c.shadowColor = color; c.stroke(); c.shadowBlur = 0;
  // Number
  c.fillStyle = color; c.font = 'bold '+Math.round(Math.max(9,11*scale))+'px Share Tech Mono';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.shadowBlur = 8; c.shadowColor = color; c.fillText(num, 0, 0); c.shadowBlur = 0;
  c.restore();
}

function drawWaypoints() {
  const m = state.wpMission;
  if (!m.active && m.result === null) return;
  m.waypoints.forEach(wp => {
    wp.rotAngle = (wp.rotAngle||0) + (wp.collected ? 0.01 : 0.03);
    const color = wp.collected ? '#ff8800' : '#00ff66';
    const isNext = !wp.collected && wp.num === m.nextRequired;
    const pulse = isNext ? (0.6 + 0.4*Math.sin(state.animFrame*0.12)) : 1;
    ctx.globalAlpha = 0.9 * pulse;
    if (state.viewMode === 'command' || state.viewMode === 'surfaced') {
      const sp = project(wp.x, wp.y, wp.z);
      drawWpMarker(ctx, sp.sx, sp.sy, wp.num, color, wp.rotAngle, 1);
    } else if (state.viewMode === 'periscope' || state.viewMode === 'surface') {
      const sp = projectPeriscope(wp.x, wp.y, wp.z);
      if (sp && sp.depth > 0.5 && sp.depth < 25) {
        const scale = Math.max(0.4, Math.min(2, 7/sp.depth));
        drawWpMarker(ctx, sp.sx, sp.sy, wp.num, color, wp.rotAngle, scale);
      }
    }
    ctx.globalAlpha = 1;
  });
}

let _lastFrameTime = 0;
function loop(now) {
  if (_gameOver) return;
  requestAnimationFrame(loop);
  if (now - _lastFrameTime < 33) return; // cap at ~30fps
  _lastFrameTime = now;
  try {
  update();
  if (state.viewMode === 'surfaced') {
    renderSurfacedView();
    drawPeriDepthSlider();
    drawPeriFwdSlider();
  } else if (state.viewMode === 'surface') {
    renderSurfacePeriscope();
    drawPeriDepthSlider();
    drawPeriFwdSlider();
    updateSurfaceBtn();
  } else if (state.viewMode === 'periscope') {
    renderPeriscope();
    renderBSOverlay();
    drawPeriDepthSlider();
    drawPeriFwdSlider();
    updateSurfaceBtn();
  } else {
    render();
    renderBSOverlay();
    if (state.ships) state.ships.forEach(ship => {
      if (!ship.alive && !ship.sinking) return;
      drawShipPoints(ctx, ship, ship.sinking ? ship.sinkY : GRID.H, project);
    });
    drawPeriFwdSlider();
  }
  drawWaypoints();
  drawSonar();
  drawDepthGauge();
  } catch(e) { resize(); }
}

// Startup handled by launchGame()

// Don't auto-start — upload screen launches the loop

// ── FLOOR PLAN UPLOAD SCREEN ──
const uploadScreen = document.getElementById('upload-screen');
const previewCanvas = document.getElementById('plan-canvas-preview');
const previewCtx = previewCanvas.getContext('2d');
const fileInput = document.getElementById('file-input');
const thresholdSlider = document.getElementById('threshold-slider');
const thresholdVal = document.getElementById('threshold-val');
const uploadStats = document.getElementById('upload-stats');

let uploadedImageData = null; // raw grayscale pixel data from uploaded plan
let uploadedW = 0, uploadedH = 0;

// Draw the current FLOOR_PLAN on the preview canvas
function drawPreview(planGrid) {
  const pw = previewCanvas.width, ph = previewCanvas.height;
  const gc = previewCtx;
  gc.fillStyle = '#020d1a';
  gc.fillRect(0,0,pw,ph);
  const cw = pw / planGrid[0].length;
  const ch = ph / planGrid.length;
  planGrid.forEach((row, gz) => {
    row.forEach((cell, gx) => {
      if (cell) {
        gc.fillStyle = '#00e5ff';
        gc.fillRect(gx*cw, gz*ch, cw, ch);
      }
    });
  });
}

// Draw initial preview with built-in plan
drawPreview(FLOOR_PLAN);

// Upload button
document.getElementById('upload-file-btn').addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new window.Image();
    img.onload = () => {
      const oc = document.createElement('canvas');
      oc.width = img.width; oc.height = img.height;
      const octx = oc.getContext('2d');
      octx.drawImage(img, 0, 0);
      const idata = octx.getImageData(0, 0, img.width, img.height);

      // Check if colour-coded
      if (isColourCoded(idata.data, img.width, img.height)) {
        uploadStats.textContent = `Colour-coded plan detected! Processing...`;
        const result = buildGridFromColour(idata.data, img.width, img.height);
        if (result) {
          window._pendingGrid = result.grid;
          window._pendingTypeGrid = result.typeGrid;
          window._isColourCoded = true;
          drawPreview(result.grid);
          const walls = [].concat.apply([],result.grid).filter(function(v){return v;}).length;
          uploadStats.textContent = `Colour plan · ${GRID.W}×${GRID.D} grid · ${walls} obstacle cells`;
          return;
        }
      }

      window._isColourCoded = false;
      window._pendingTypeGrid = null;

      // Regular greyscale detection
      const gray = new Float32Array(img.width * img.height);
      for (let i=0; i<gray.length; i++) {
        gray[i] = 0.299*idata.data[i*4] + 0.587*idata.data[i*4+1] + 0.114*idata.data[i*4+2];
      }
      uploadedImageData = gray;
      uploadedW = img.width;
      uploadedH = img.height;
      uploadStats.textContent = `Image: ${img.width}×${img.height}px`;
      processAndPreview();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

function processAndPreview() {
  if (!uploadedImageData) return;
  const threshold = parseInt(thresholdSlider.value);
  const darkLimit = (threshold / 100) * 255;
  const grid = buildGridFromImage(uploadedImageData, uploadedW, uploadedH, darkLimit);
  drawPreview(grid);
  const walls = [].concat.apply([],grid).filter(function(v){return v;}).length;
  const open = [].concat.apply([],grid).filter(function(v){return !v;}).length;
  uploadStats.textContent = `${GRID.W}×${GRID.D} grid · ${walls} wall cells · ${open} open`;
  // Store for launch
  window._pendingGrid = grid;
}

function isColourCoded(imageData, w, h) {
  // Check if image has significant red, green, or blue regions
  // (indicating it's been colour-coded by AI)
  let redPx=0, greenPx=0, bluePx=0, yellowPx=0;
  for (let i=0; i<imageData.length; i+=4) {
    const r=imageData[i], g=imageData[i+1], b=imageData[i+2];
    if (r>150 && g<100 && b<100) redPx++;
    if (g>120 && r<150 && b<100 && g>r+30) greenPx++;
    if (b>150 && r<100 && g<150) bluePx++;
    if (r>200 && g>200 && b<50) yellowPx++;
  }
  const total = w*h;
  return (redPx/total > 0.005 || greenPx/total > 0.005 || bluePx/total > 0.005 || yellowPx/total > 0.005);
}

function buildGridFromColour(imageData, iw, ih) {
  // ── COLOUR-CODED PLAN IMPORTER ──
  // Reads AI colour-coded plans:
  // Black = walls (full height)
  // Red = beds (obstacle, medium height)
  // Green = furniture/robes (obstacle, low-medium height)
  // Blue = kitchen benches (obstacle, medium height)  
  // Cyan = bathroom fixtures (obstacle, medium height)
  // White = navigable floor

  const GW = GRID.W, GD = GRID.D;

  // Find plan bounds from black wall pixels
  let rmin=ih,rmax=0,cmin=iw,cmax=0;
  for (let y=0;y<ih;y++) for (let x=0;x<iw;x++) {
    const i=(y*iw+x)*4;
    const r=imageData[i],g=imageData[i+1],b=imageData[i+2];
    if (r<80&&g<80&&b<80) {
      if(y<rmin)rmin=y;if(y>rmax)rmax=y;if(x<cmin)cmin=x;if(x>cmax)cmax=x;
    }
  }
  if (rmax<=rmin||cmax<=cmin) return null;
  const planW=cmax-cmin, planH=rmax-rmin;

  // Build grid with type info
  const grid = (function(){var _a=[];for(var _i=0;_i<GD;_i++)_a.push(new Array(GW).fill(0));return _a;})();
  const typeGrid = (function(){var _a=[];for(var _i=0;_i<GD;_i++)_a.push(new Array(GW).fill('open'));return _a;})();

  for (let gz=0;gz<GD;gz++) {
    for (let gx=0;gx<GW;gx++) {
      const px0=cmin+Math.floor(gx/GW*planW), px1=Math.max(px0+1,cmin+Math.floor((gx+1)/GW*planW));
      const py0=rmin+Math.floor(gz/GD*planH), py1=Math.max(py0+1,rmin+Math.floor((gz+1)/GD*planH));
      let wC=0,bC=0,rC=0,gC=0,kC=0,cyC=0,yC=0,puC=0,total=0;
      for (let py=py0;py<py1;py++) for (let px=px0;px<px1;px++) {
        if (py>=0&&py<ih&&px>=0&&px<iw) {
          const i=(py*iw+px)*4;
          const r=imageData[i],g=imageData[i+1],b=imageData[i+2];
          total++;
          if (r<80&&g<80&&b<80) wC++;           // wall
          else if (r>150&&g<100&&b<100) rC++;    // bed
          else if (g>120&&r<150&&b<100&&g>r+30) gC++; // furniture
          else if (r>200&&g>200&&b<50) yC++;  // door (yellow #FFFF00)
          else if (r>100&&b>100&&g<50) puC++;  // wardrobe (purple #800080)
          else if (b>150&&r<100&&g<150) kC++;    // bench
          else if (b>150&&g>150&&r<100) cyC++;   // bathroom
        }
      }
      if (!total) continue;
      const wF=wC/total, yF=yC/total, puF=puC/total;
      // Yellow (door openings) FIRST — always navigable even if wall pixels bleed in
      if (yF > 0.08) { grid[gz][gx]=0; typeGrid[gz][gx]='door'; }
      // Black structural walls
      else if (wF > 0.2) { grid[gz][gx]=1; typeGrid[gz][gx]='wall'; }
      // Purple wardrobes/built-ins — full-height obstacles same as walls
      else if (puF > 0.25) { grid[gz][gx]=1; typeGrid[gz][gx]='wall'; }
    }
  }

  // Widen door openings: clear wall cells immediately adjacent to a door cell
  // when open space exists on the far side — handles thin yellow lines in GPT output
  for (let gz=1;gz<GD-1;gz++) for (let gx=1;gx<GW-1;gx++) {
    if (typeGrid[gz][gx] !== 'door') continue;
    const dirs4 = [[0,1],[0,-1],[1,0],[-1,0]];
    for (const [dz,dx] of dirs4) {
      const nz=gz+dz, nx=gx+dx;
      if (nz<1||nz>=GD-1||nx<1||nx>=GW-1) continue;
      if (grid[nz][nx]===1) {
        const nz2=gz+dz*2, nx2=gx+dx*2;
        if (nz2>=0&&nz2<GD&&nx2>=0&&nx2<GW && grid[nz2][nx2]===0) {
          grid[nz][nx]=0; typeGrid[nz][nx]='door';
        }
      }
    }
  }

  // Clean isolated wall noise
  for (let pass=0;pass<2;pass++) {
    for (let gz=1;gz<GD-1;gz++) for (let gx=1;gx<GW-1;gx++) {
      if (!grid[gz][gx]) continue;
      const n8=grid[gz-1][gx-1]+grid[gz-1][gx]+grid[gz-1][gx+1]+
               grid[gz][gx-1]+grid[gz][gx+1]+
               grid[gz+1][gx-1]+grid[gz+1][gx]+grid[gz+1][gx+1];
      if (n8<=1) { grid[gz][gx]=0; typeGrid[gz][gx]='open'; }
    }
  }

  // Force border walls
  for (let i=0;i<GW;i++){grid[0][i]=1;grid[GD-1][i]=1;}
  for (let i=0;i<GD;i++){grid[i][0]=1;grid[i][GW-1]=1;}

  // ── CONNECTIVITY REPAIR ──
  // Flood-fill from the centre to find all reachable open cells.
  // Any isolated open region gets a breach punched through its thinnest wall
  // so every room is reachable and the level is always playable.
  const visited = Array.from({length:GD}, ()=>new Uint8Array(GW));
  const queue = [];
  // Seed from centre; walk inward until we find an open cell
  for (let r=0; r<Math.max(GW,GD)/2; r++) {
    const cz=Math.floor(GD/2), cx=Math.floor(GW/2);
    if (!grid[cz+r] || !grid[cz-r]) continue;
    let seeded=false;
    for (let dz=-r;dz<=r&&!seeded;dz++) for (let dx=-r;dx<=r&&!seeded;dx++) {
      const sz=cz+dz, sx=cx+dx;
      if (sz<1||sz>=GD-1||sx<1||sx>=GW-1) continue;
      if (!grid[sz][sx]) { queue.push([sz,sx]); visited[sz][sx]=1; seeded=true; }
    }
    if (seeded) break;
  }
  // BFS
  for (let qi=0; qi<queue.length; qi++) {
    const [z,x]=queue[qi];
    for (const [dz,dx] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nz=z+dz, nx=x+dx;
      if (nz<0||nz>=GD||nx<0||nx>=GW||visited[nz][nx]||grid[nz][nx]) continue;
      visited[nz][nx]=1; queue.push([nz,nx]);
    }
  }
  // Find sealed open regions and punch a 1-cell breach through the thinnest adjacent wall
  for (let gz=1;gz<GD-1;gz++) for (let gx=1;gx<GW-1;gx++) {
    if (grid[gz][gx] || visited[gz][gx]) continue;
    // Unvisited open cell — find shortest wall path to a visited cell
    let bestWz=-1, bestWx=-1, bestLen=999;
    for (const [dz,dx] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      // Walk in this direction until we hit a visited open cell or the border
      let wLen=0, wz=gz, wx=gx;
      while (wz>=1&&wz<GD-1&&wx>=1&&wx<GW-1) {
        wz+=dz; wx+=dx; wLen++;
        if (!grid[wz][wx] && visited[wz][wx]) {
          if (wLen < bestLen) { bestLen=wLen; bestWz=gz+dz; bestWx=gx+dx; }
          break;
        }
        if (wLen>8) break; // don't breach thick walls
      }
    }
    if (bestWz>=0) {
      // Punch breach and flood-fill the newly connected region
      grid[bestWz][bestWx]=0; typeGrid[bestWz][bestWx]='door';
      const patch=[[ gz, gx]];
      visited[gz][gx]=1;
      for (let pi=0;pi<patch.length;pi++) {
        const [pz,px]=patch[pi];
        for (const [dz,dx] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          const nz=pz+dz,nx=px+dx;
          if (nz<0||nz>=GD||nx<0||nx>=GW||visited[nz][nx]) continue;
          if (!grid[nz][nx]) { visited[nz][nx]=1; patch.push([nz,nx]); }
        }
      }
      visited[bestWz][bestWx]=1;
    }
  }

  return {grid, typeGrid};
}

function buildGridFromImage(gray, iw, ih, darkLimit) {
  // ── STEP 1: FIND PLAN BOUNDS ──
  const darkBound = Math.min(darkLimit * 0.6, 60);
  let rmin=ih, rmax=0, cmin=iw, cmax=0;
  for (let y=0; y<ih; y++) for (let x=0; x<iw; x++) {
    if (gray[y*iw+x] < darkBound) {
      if (y<rmin) rmin=y; if (y>rmax) rmax=y;
      if (x<cmin) cmin=x; if (x>cmax) cmax=x;
    }
  }
  if (rmax<=rmin || cmax<=cmin) return FLOOR_PLAN;
  const margin = Math.floor(Math.min(iw,ih) * 0.01);
  rmin=Math.max(0,rmin-margin); rmax=Math.min(ih-1,rmax+margin);
  cmin=Math.max(0,cmin-margin); cmax=Math.min(iw-1,cmax+margin);
  const planW=cmax-cmin, planH=rmax-rmin;

  // ── STEP 2: SOBEL EDGE DETECTION ──
  const edge = new Float32Array(iw * ih);
  for (let y=1; y<ih-1; y++) {
    for (let x=1; x<iw-1; x++) {
      const gx = (
        -gray[(y-1)*iw+(x-1)] - 2*gray[y*iw+(x-1)] - gray[(y+1)*iw+(x-1)] +
         gray[(y-1)*iw+(x+1)] + 2*gray[y*iw+(x+1)] + gray[(y+1)*iw+(x+1)]
      );
      const gy = (
        -gray[(y-1)*iw+(x-1)] - 2*gray[(y-1)*iw+x] - gray[(y-1)*iw+(x+1)] +
         gray[(y+1)*iw+(x-1)] + 2*gray[(y+1)*iw+x] + gray[(y+1)*iw+(x+1)]
      );
      edge[y*iw+x] = Math.sqrt(gx*gx + gy*gy);
    }
  }

  // ── STEP 3: EDGE DENSITY (wall thickness detection) ──
  // Walls are thick — many nearby edge pixels
  // Text, furniture lines, door arcs are thin — few nearby edge pixels
  const edgeThresh = 40;
  // densRad=3 is best for typical floor plan wall thickness
  const densRad = 3;
  const minDensity = densRad * densRad * 0.15;

  // Compute local edge density using sliding sum
  const density = new Float32Array(iw * ih);
  for (let y=rmin; y<=rmax; y++) {
    for (let x=cmin; x<=cmax; x++) {
      if (edge[y*iw+x] <= edgeThresh) continue;
      let count = 0;
      for (let dy=-densRad; dy<=densRad; dy++) {
        for (let dx=-densRad; dx<=densRad; dx++) {
          const ny=y+dy, nx=x+dx;
          if (ny>=0&&ny<ih&&nx>=0&&nx<iw && edge[ny*iw+nx] > edgeThresh) count++;
        }
      }
      density[y*iw+x] = count;
    }
  }

  // ── STEP 4: DOWNSAMPLE TO GRID ──
  const GW = GRID.W, GD = GRID.D;
  const grid = (function(){var _a=[];for(var _i=0;_i<GD;_i++)_a.push(new Array(GW).fill(0));return _a;})();

  for (let gz=0; gz<GD; gz++) {
    for (let gx=0; gx<GW; gx++) {
      const px0=Math.floor(cmin+gx/GW*planW),   px1=Math.max(px0+1,Math.floor(cmin+(gx+1)/GW*planW));
      const py0=Math.floor(rmin+gz/GD*planH),   py1=Math.max(py0+1,Math.floor(rmin+(gz+1)/GD*planH));
      let thickCount=0, darkCount=0, total=0;
      for (let py=py0; py<py1; py++) {
        for (let px=px0; px<px1; px++) {
          if (py>=0&&py<ih&&px>=0&&px<iw) {
            total++;
            if (density[py*iw+px] > minDensity) thickCount++;
            if (gray[py*iw+px] < darkLimit * 0.55) darkCount++;
          }
        }
      }
      if (total > 0) {
        // Wall = thick edges OR very dark fill — use darkLimit from slider
        grid[gz][gx] = (thickCount/total > 0.2 || darkCount/total > 0.15) ? 1 : 0;
      }
    }
  }

  // ── STEP 5: MULTI-PASS CLEANUP ──
  // Pass 1: remove isolated noise (text, symbols, dimension lines)
  for (let pass=0; pass<3; pass++) {
    for (let gz=1; gz<GD-1; gz++) {
      for (let gx=1; gx<GW-1; gx++) {
        if (!grid[gz][gx]) continue;
        const n8 =
          grid[gz-1][gx-1]+grid[gz-1][gx]+grid[gz-1][gx+1]+
          grid[gz][gx-1]+                  grid[gz][gx+1]+
          grid[gz+1][gx-1]+grid[gz+1][gx]+grid[gz+1][gx+1];
        if (n8 <= 2) grid[gz][gx] = 0;
      }
    }
  }

  // ── STEP 6: ENSURE NAVIGABLE SPACE via flood fill ──
  // Find the largest open region — if less than 20% of grid is navigable, 
  // we've over-detected. Loosen threshold automatically.
  const openCount = [].concat.apply([],grid).filter(function(v){return !v;}).length;
  const openFrac = openCount / (GW * GD);
  if (openFrac < 0.25) {
    // Too many walls — erode: remove cells with fewer than 4 wall neighbours
    for (let gz=1; gz<GD-1; gz++) {
      for (let gx=1; gx<GW-1; gx++) {
        if (!grid[gz][gx]) continue;
        const n4 = grid[gz-1][gx]+grid[gz+1][gx]+grid[gz][gx-1]+grid[gz][gx+1];
        if (n4 < 3) grid[gz][gx] = 0;
      }
    }
  }

  // Force border
  for (let i=0; i<GW; i++) { grid[0][i]=1; grid[GD-1][i]=1; }
  for (let i=0; i<GD; i++) { grid[i][0]=1; grid[i][GW-1]=1; }

  return grid;
}

thresholdSlider.addEventListener('input', () => {
  thresholdVal.textContent = thresholdSlider.value + '% dark';
  processAndPreview();
});

// ── PRE-BUILT BATTLEGROUND MAPS ──
// Each makeGrid() returns a 48-row x 64-col array (0=open, 1=wall)
var BATTLEGROUNDS = [
  // ── BUILDING / FLOOR PLAN MAPS ──────────────────────────────────
  {
    id: 'bungalow', name: 'THE BUNGALOW',
    desc: 'Three-bed house — hallway, kitchen, ensuite',
    tag: 'DEFAULT',
    makeGrid: function() {
      var R=48,C=64,z,x; var g=[];
      for(z=0;z<R;z++){g[z]=[];for(x=0;x<C;x++)g[z][x]=0;}
      for(x=0;x<C;x++){g[0][x]=1;g[R-1][x]=1;}
      for(z=0;z<R;z++){g[z][0]=1;g[z][C-1]=1;}
      // Hallway walls full-width
      for(x=1;x<C-1;x++){g[15][x]=1;g[18][x]=1;}
      // Upper zone vertical dividers (cols at x=21 lounge|kitchen, x=42 kitchen|master)
      for(z=1;z<15;z++){g[z][21]=1;g[z][42]=1;}
      // Lower zone vertical dividers (bath|bed2|bed3|ensuite)
      for(z=19;z<36;z++){g[z][14]=1;g[z][36]=1;g[z][53]=1;}
      // Utility area wall
      for(x=1;x<C-1;x++) g[36][x]=1;
      // Kitchen island
      g[5][28]=1;g[5][29]=1;g[6][28]=1;g[6][29]=1;
      // Bathroom shower partition
      for(z=19;z<25;z++) g[z][7]=1;
      g[24][8]=1;g[24][9]=1;
      // Master bedroom wardrobe alcove
      for(z=1;z<5;z++){g[z][58]=1;g[z][59]=1;}
      // Bedroom 2 wardrobe
      g[22][25]=1;g[22][26]=1;g[22][27]=1;g[23][25]=1;g[23][26]=1;g[23][27]=1;
      // ── Doorways (clear AFTER all wall loops) ──
      // Hallway top: into lounge / kitchen / master
      g[15][8]=0;g[15][9]=0;g[15][10]=0;
      g[15][29]=0;g[15][30]=0;g[15][31]=0;
      g[15][50]=0;g[15][51]=0;g[15][52]=0;
      // Hallway bottom: into bathroom / bed2 / bed3 / ensuite
      g[18][5]=0;g[18][6]=0;g[18][7]=0;
      g[18][22]=0;g[18][23]=0;g[18][24]=0;
      g[18][43]=0;g[18][44]=0;g[18][45]=0;
      g[18][57]=0;g[18][58]=0;g[18][59]=0;
      // Upper divider doors (lounge-kitchen, kitchen-master)
      g[6][21]=0;g[7][21]=0;g[8][21]=0;
      g[6][42]=0;g[7][42]=0;g[8][42]=0;
      // Lower divider doors (bath-bed2, bed2-bed3, bed3-ensuite)
      g[26][14]=0;g[27][14]=0;g[28][14]=0;
      g[26][36]=0;g[27][36]=0;g[28][36]=0;
      g[26][53]=0;g[27][53]=0;g[28][53]=0;
      // Utility area door
      g[36][28]=0;g[36][29]=0;g[36][30]=0;
      return g;
    }
  },
  {
    id: 'museum', name: 'THE MUSEUM',
    desc: 'Side galleries flank a pillar-lined atrium',
    tag: 'TACTICAL',
    makeGrid: function() {
      var R=48,C=64,z,x,i; var g=[];
      for(z=0;z<R;z++){g[z]=[];for(x=0;x<C;x++)g[z][x]=0;}
      for(x=0;x<C;x++){g[0][x]=1;g[R-1][x]=1;}
      for(z=0;z<R;z++){g[z][0]=1;g[z][C-1]=1;}
      // Wing walls separating galleries from central atrium
      for(z=1;z<R-1;z++){g[z][19]=1;g[z][44]=1;}
      // Left wing gallery dividers (3 rooms stacked vertically)
      for(x=1;x<19;x++){g[16][x]=1;g[32][x]=1;}
      // Right wing gallery dividers
      for(x=45;x<C-1;x++){g[16][x]=1;g[32][x]=1;}
      // Pillars in central atrium (2x2 blocks)
      var pl=[[5,24],[5,38],[16,24],[16,38],[26,24],[26,38],[37,24],[37,38]];
      for(i=0;i<pl.length;i++){
        var pz=pl[i][0],px=pl[i][1];
        g[pz][px]=1;g[pz][px+1]=1;
        if(pz+1<R-1){g[pz+1][px]=1;g[pz+1][px+1]=1;}
      }
      // ── Doorways ──
      // Left wing to atrium (3 per wing, one per gallery)
      g[7][19]=0;g[8][19]=0;g[9][19]=0;
      g[22][19]=0;g[23][19]=0;g[24][19]=0;
      g[37][19]=0;g[38][19]=0;g[39][19]=0;
      // Right wing to atrium
      g[7][44]=0;g[8][44]=0;g[9][44]=0;
      g[22][44]=0;g[23][44]=0;g[24][44]=0;
      g[37][44]=0;g[38][44]=0;g[39][44]=0;
      // Left gallery internal doors
      g[16][8]=0;g[16][9]=0;g[16][10]=0;
      g[32][8]=0;g[32][9]=0;g[32][10]=0;
      // Right gallery internal doors
      g[16][52]=0;g[16][53]=0;g[16][54]=0;
      g[32][52]=0;g[32][53]=0;g[32][54]=0;
      return g;
    }
  },
  {
    id: 'office', name: 'THE OFFICE BLOCK',
    desc: 'Open plan, meeting rooms, server suite',
    tag: 'URBAN',
    makeGrid: function() {
      var R=48,C=64,z,x,i; var g=[];
      for(z=0;z<R;z++){g[z]=[];for(x=0;x<C;x++)g[z][x]=0;}
      for(x=0;x<C;x++){g[0][x]=1;g[R-1][x]=1;}
      for(z=0;z<R;z++){g[z][0]=1;g[z][C-1]=1;}
      // Main floor / service corridor divider
      for(x=1;x<C-1;x++) g[34][x]=1;
      // Meeting block (top-right): outer walls
      for(z=1;z<25;z++) g[z][40]=1;
      for(x=40;x<C-1;x++){g[14][x]=1;g[24][x]=1;}
      // Meeting block internal dividers
      for(z=1;z<14;z++) g[z][51]=1;
      for(z=15;z<24;z++) g[z][51]=1;
      // Break room right wall (bottom-left)
      for(z=35;z<R-1;z++) g[z][21]=1;
      // Server room left wall (bottom-right)
      for(z=35;z<R-1;z++) g[z][43]=1;
      // Cubicle partitions in open plan (short horizontal screens)
      var cu=[[8,3,10],[8,14,21],[8,25,31],[17,3,10],[17,14,21],[17,25,31],[26,3,10],[26,14,21],[26,25,31]];
      for(i=0;i<cu.length;i++){
        var cz=cu[i][0];
        for(x=cu[i][1];x<=cu[i][2];x++) g[cz][x]=1;
      }
      // ── Doorways ──
      // Main floor ↔ service corridor
      g[34][10]=0;g[34][11]=0;g[34][12]=0;
      g[34][31]=0;g[34][32]=0;g[34][33]=0;
      g[34][52]=0;g[34][53]=0;g[34][54]=0;
      // Meeting block entrance (from main floor into top-left meeting room)
      g[11][40]=0;g[12][40]=0;g[13][40]=0;
      // Meeting block horizontal divider gap
      g[14][50]=0;g[14][51]=0;
      // Meeting block bottom exit
      g[24][46]=0;g[24][47]=0;
      // Meeting room internal doors
      g[6][51]=0;
      g[19][51]=0;g[20][51]=0;
      // Break room side door
      g[39][21]=0;g[40][21]=0;
      // Server room side door
      g[39][43]=0;g[40][43]=0;
      return g;
    }
  },
  // ── UNDERWATER TERRAIN MAPS ──────────────────────────────────────
  {
    id: 'ravine', name: 'SUNKEN RAVINE',
    desc: 'Winding chasm with side caverns and rock pillars',
    tag: 'HIGH-SKILL',
    makeGrid: function() {
      var R=48,C=64,z,x,i; var g=[];
      // Start solid rock — carve out the ravine
      for(z=0;z<R;z++){g[z]=[];for(x=0;x<C;x++)g[z][x]=1;}
      // Main winding channel
      for(z=1;z<R-1;z++){
        var ctr=31+Math.round(Math.sin(z*0.21)*9+Math.sin(z*0.08)*5);
        var half=3+Math.round(Math.abs(Math.sin(z*0.37))*4+Math.abs(Math.cos(z*0.13))*2);
        if(half<3) half=3;
        for(x=ctr-half;x<=ctr+half;x++) if(x>0&&x<C-1) g[z][x]=0;
      }
      // Alternating side caverns (widens channel left or right)
      var cav=[[4,1],[10,-1],[17,1],[24,-1],[31,1],[38,-1],[43,1]];
      for(i=0;i<cav.length;i++){
        var cz=cav[i][0],side=cav[i][1];
        for(z=cz;z<cz+5&&z<R-1;z++){
          var cc=31+Math.round(Math.sin(z*0.21)*9+Math.sin(z*0.08)*5);
          if(side>0){for(x=cc+2;x<=cc+11;x++) if(x>0&&x<C-1) g[z][x]=0;}
          else{for(x=cc-11;x<=cc-2;x++) if(x>0&&x<C-1) g[z][x]=0;}
        }
      }
      // Rock pillars inside carved areas (only if cell already open)
      var pl=[[6,33],[13,28],[20,35],[27,29],[34,32],[41,27]];
      for(i=0;i<pl.length;i++){
        var pz=pl[i][0],px=pl[i][1];
        if(pz>0&&pz<R-1&&px>0&&px<C-1&&g[pz][px]===0){
          g[pz][px]=1;
          if(px+1<C-1&&g[pz][px+1]===0) g[pz][px+1]=1;
          if(pz+1<R-1&&g[pz+1][px]===0) g[pz+1][px]=1;
        }
      }
      return g;
    }
  },
  {
    id: 'reef', name: 'CORAL REEF',
    desc: 'Dense organic formations with swim-through channels',
    tag: 'AMBUSH ZONE',
    makeGrid: function() {
      var R=48,C=64,z,x; var g=[];
      for(z=0;z<R;z++){g[z]=[];for(x=0;x<C;x++)g[z][x]=0;}
      for(x=0;x<C;x++){g[0][x]=1;g[R-1][x]=1;}
      for(z=0;z<R;z++){g[z][0]=1;g[z][C-1]=1;}
      // Organic coral noise — denser toward the seafloor (high z)
      for(z=2;z<R-2;z++){
        for(x=2;x<C-2;x++){
          var depth=z/R;
          var n=Math.sin(x*0.72+z*0.51)*Math.cos(x*0.34-z*0.57)+
                Math.sin(x*1.31-z*0.83)*0.52+
                Math.cos(x*0.46+z*1.03)*0.68;
          var thresh=0.72-depth*0.46;
          if(n>thresh) g[z][x]=1;
        }
      }
      // Guarantee two winding swim-through channels
      for(z=1;z<R-1;z++){
        var cx=20+Math.round(Math.sin(z*0.24)*7+Math.sin(z*0.09)*4);
        if(cx<2) cx=2; if(cx>C-3) cx=C-3;
        g[z][cx]=0;g[z][cx-1]=0;g[z][cx+1]=0;
        var cx2=44+Math.round(Math.cos(z*0.22)*7+Math.cos(z*0.11)*3);
        if(cx2<2) cx2=2; if(cx2>C-3) cx2=C-3;
        g[z][cx2]=0;g[z][cx2-1]=0;g[z][cx2+1]=0;
      }
      return g;
    }
  },
  {
    id: 'seamount', name: 'SEAMOUNT RANGE',
    desc: 'Parallel ridges, mountain passes, isolated peaks',
    tag: 'LONG-RANGE',
    makeGrid: function() {
      var R=48,C=64,z,x,i,p; var g=[];
      for(z=0;z<R;z++){g[z]=[];for(x=0;x<C;x++)g[z][x]=0;}
      for(x=0;x<C;x++){g[0][x]=1;g[R-1][x]=1;}
      for(z=0;z<R;z++){g[z][0]=1;g[z][C-1]=1;}
      // Four wavy mountain ridges (horizontal bands)
      var ridges=[7,18,29,39];
      var passes=[8,26,45]; // x-positions of gaps through each ridge
      for(i=0;i<ridges.length;i++){
        var rc=ridges[i];
        for(x=1;x<C-1;x++){
          var wave=Math.round(Math.sin(x*0.27+i*0.9)*2+Math.cos(x*0.14+i*0.5)*1.5);
          var top=rc+wave-1,bot=rc+wave+2;
          if(top<1) top=1; if(bot>R-2) bot=R-2;
          for(z=top;z<=bot;z++) g[z][x]=1;
        }
        // Cut passes through each ridge
        for(p=0;p<passes.length;p++){
          var px=passes[p];
          var wave2=Math.round(Math.sin(px*0.27+i*0.9)*2+Math.cos(px*0.14+i*0.5)*1.5);
          var pt=rc+wave2-2,pb=rc+wave2+3;
          if(pt<1) pt=1; if(pb>R-2) pb=R-2;
          for(z=pt;z<=pb;z++){g[z][px]=0;if(px+1<C-1)g[z][px+1]=0;}
        }
      }
      // Isolated seamount peaks in the valleys
      var peaks=[[3,15],[3,35],[3,55],[12,5],[12,58],[23,20],[23,50],[34,12],[34,36],[34,56],[44,22],[44,42]];
      for(i=0;i<peaks.length;i++){
        var ppz=peaks[i][0],ppx=peaks[i][1];
        if(ppz>0&&ppz<R-1&&ppx>0&&ppx<C-1){
          g[ppz][ppx]=1;
          if(ppx+1<C-1) g[ppz][ppx+1]=1;
          if(ppz+1<R-1){g[ppz+1][ppx]=1;if(ppx+1<C-1)g[ppz+1][ppx+1]=1;}
        }
      }
      return g;
    }
  },
  // ── CANYON HEIGHTFIELD ─────────────────────────────────────────────
  {
    id: 'canyon', name: 'THE CANYON',
    desc: 'Natural rocky terrain — heightmap battleground',
    tag: 'TERRAIN',
    isHeightfield: true,
    _hGrid: null,
    makeGrid: function() {
      // Synchronous fallback: open ocean with border walls only
      var R=48,C=64,z,x; var g=[];
      for(z=0;z<R;z++){g[z]=[];for(x=0;x<C;x++)g[z][x]=0;}
      for(x=0;x<C;x++){g[0][x]=1;g[R-1][x]=1;}
      for(z=0;z<R;z++){g[z][0]=1;g[z][C-1]=1;}
      return g;
    },
    loadAsync: function() {
      var self = this;
      return new Promise(function(resolve) {
        var img = new Image();
        function smoothHg(hg, R, C, passes) {
          for(var p=0;p<passes;p++){
            var t=[]; for(var z=0;z<R;z++){t[z]=[];for(var x=0;x<C;x++){var s=0,n=0;for(var dz=-1;dz<=1;dz++)for(var dx=-1;dx<=1;dx++){var nz=z+dz,nx2=x+dx;if(nz>=0&&nz<R&&nx2>=0&&nx2<C){s+=hg[nz][nx2];n++;}}t[z][x]=s/n;}}
            for(var z=0;z<R;z++)for(var x=0;x<C;x++)hg[z][x]=t[z][x];
          }
          return hg;
        }
        img.onload = function() {
          var tmp = document.createElement('canvas');
          tmp.width = 64; tmp.height = 48;
          var tc = tmp.getContext('2d');
          tc.drawImage(img, 0, 0, 64, 48);
          var px = tc.getImageData(0, 0, 64, 48).data;
          var R=48,C=64,z,x; var g=[]; var hg=[];
          for(z=0;z<R;z++){
            g[z]=[]; hg[z]=[];
            for(x=0;x<C;x++){
              var idx=(z*C+x)*4;
              hg[z][x]=px[idx];
              g[z][x]=0;
            }
          }
          smoothHg(hg, R, C, 2);
          self._hGrid=hg; window._canyonHeightGrid=hg;
          resolve(g);
        };
        img.onerror = function() {
          // Procedural fallback canyon if PNG not found
          var R=48,C=64,z,x; var g=[]; var hg=[];
          for(z=0;z<R;z++){
            g[z]=[]; hg[z]=[];
            for(x=0;x<C;x++){
              var nx=x/C, nz=z/R;
              var h=Math.round(128+80*Math.sin(nx*3)*Math.sin(nz*4)+40*Math.sin(nx*7+1)*Math.cos(nz*6+2));
              if(h<0)h=0; if(h>255)h=255;
              hg[z][x]=h; g[z][x]=0;
            }
          }
          smoothHg(hg, R, C, 2);
          self._hGrid=hg; window._canyonHeightGrid=hg;
          resolve(g);
        };
        img.src='/maps/canyon.png';
      });
    }
  },
  // ── TRENCH HEIGHTFIELD ─────────────────────────────────────────────
  {
    id: 'trench', name: 'THE TRENCH',
    desc: 'Deep ocean trench — extreme depth and narrow passages',
    tag: 'TERRAIN',
    isHeightfield: true,
    _hGrid: null,
    makeGrid: function() {
      var R=48,C=64,z,x; var g=[];
      for(z=0;z<R;z++){g[z]=[];for(x=0;x<C;x++)g[z][x]=0;}
      for(x=0;x<C;x++){g[0][x]=1;g[R-1][x]=1;}
      for(z=0;z<R;z++){g[z][0]=1;g[z][C-1]=1;}
      return g;
    },
    loadAsync: function() {
      var self = this;
      return new Promise(function(resolve) {
        var img = new Image();
        function smoothHg(hg, R, C, passes) {
          for(var p=0;p<passes;p++){
            var t=[]; for(var z=0;z<R;z++){t[z]=[];for(var x=0;x<C;x++){var s=0,n=0;for(var dz=-1;dz<=1;dz++)for(var dx=-1;dx<=1;dx++){var nz=z+dz,nx2=x+dx;if(nz>=0&&nz<R&&nx2>=0&&nx2<C){s+=hg[nz][nx2];n++;}}t[z][x]=s/n;}}
            for(var z=0;z<R;z++)for(var x=0;x<C;x++)hg[z][x]=t[z][x];
          }
          return hg;
        }
        img.onload = function() {
          var tmp = document.createElement('canvas');
          tmp.width = 64; tmp.height = 48;
          var tc = tmp.getContext('2d');
          tc.drawImage(img, 0, 0, 64, 48);
          var px = tc.getImageData(0, 0, 64, 48).data;
          var R=48,C=64,z,x; var g=[]; var hg=[];
          for(z=0;z<R;z++){
            g[z]=[]; hg[z]=[];
            for(x=0;x<C;x++){
              var idx=(z*C+x)*4;
              hg[z][x]=px[idx];
              g[z][x]=0;
            }
          }
          smoothHg(hg, R, C, 2);
          self._hGrid=hg; window._canyonHeightGrid=hg;
          resolve(g);
        };
        img.onerror = function() {
          var R=48,C=64,z,x; var g=[]; var hg=[];
          for(z=0;z<R;z++){
            g[z]=[]; hg[z]=[];
            for(x=0;x<C;x++){
              var nx=x/C, nz=z/R;
              var h=Math.round(100+60*Math.sin(nx*2)*Math.sin(nz*3)+80*Math.abs(Math.sin(nx*5+nz*4)));
              if(h<0)h=0; if(h>255)h=255;
              hg[z][x]=h; g[z][x]=0;
            }
          }
          smoothHg(hg, R, C, 2);
          self._hGrid=hg; window._canyonHeightGrid=hg;
          resolve(g);
        };
        img.src='/maps/trench.png';
      });
    }
  }
];

// Launch with current grid
function launchGame(planGrid) {
  _sonarTerrainCache = null; // rebuild sonar heightmap for new map
  // Heightfield maps use GRID.H = 32 for canyon depth; standard maps use 6
  GRID.H = window._isHeightfield ? 32 : 6;

  if (planGrid && planGrid !== FLOOR_PLAN) {
    for (let gz=0;gz<FLOOR_PLAN.length;gz++)
      for (let gx=0;gx<FLOOR_PLAN[0].length;gx++)
        FLOOR_PLAN[gz][gx] = (planGrid[gz] && planGrid[gz][gx] !== undefined) ? planGrid[gz][gx] : 0;
  }
  // Apply colour type grid if available
  if (window._pendingTypeGrid) {
    window._activeTypeGrid = window._pendingTypeGrid;
  } else {
    window._activeTypeGrid = null;
  }
  furniture.length = 0;
  buildFloorPlanGeometry().forEach(f => furniture.push(f));
  generateCloud();

  // Reset player and enemy to spawn points
  spawnPlayer();
  spawnEnemy('FAMILY ROOM');
  if (typeof centreOnPlayer === 'function') centreOnPlayer();

  // Initialise surface ships
  initShips();

  // Reset whales and schedule first spawn
  state.whales = [];
  setTimeout(spawnWhale, 4000);

  // Reset megalodons and schedule first spawn
  state.megalodons = [];
  setTimeout(spawnMegalodon, 30000);

  // Reset squids and schedule first spawn
  state.squids = [];
  state.wpMission.triggerIn = Infinity;
  setTimeout(spawnSquid, 8000);

  // Reset lives and game-over flag
  _gameOver = false;
  state.lives = 3;
  updateLivesDisplay();
  state.hull = 100;
  document.getElementById('sys-hull').textContent = '100%';
  document.getElementById('peri-hull').textContent = '100%';

  uploadScreen.style.display = 'none';
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('battleground-screen').style.display = 'none';
  // Restore game UI in case we're returning from game over
  document.getElementById('hud').style.display = '';
  document.getElementById('controls-wrap').style.display = 'none'; // permanently hidden
  document.getElementById('sys-panel').style.display = 'none';     // shown via STATUS button
  document.getElementById('sonar-wrap').style.display = 'none'; // shown via TACTICAL button
  document.getElementById('canvas').style.display = '';
  // Always start in periscope view with periscope UI
  state.viewMode = 'periscope';
  setAmbientMode('underwater');
  document.getElementById('periscope-overlay').classList.add('active');
  document.getElementById('peri-btn-back').textContent = '◈ COMMAND';
  document.getElementById('torpedo-aim-hint').style.display = 'none'; // shown only in torpedo aim mode
  addEvent('▸ SYSTEMS ONLINE — ALL UNITS SYNCED', false);
  // Sync render panel button states on launch
  const _db = document.getElementById('peri-dots-btn');
  const _wb = document.getElementById('peri-wireframe-btn');
  if (_db) { _db.textContent = state.showDots ? 'ON' : 'OFF'; _db.classList.toggle('on', state.showDots); }
  if (_wb) { _wb.textContent = state.showWireframe ? 'ON' : 'OFF'; _wb.classList.toggle('on', state.showWireframe); }
  // Auto-show tactical sonar on terrain/canyon maps; reset scoreboard + button label
  setScoreboard(false);
  if (window._isHeightfield) {
    setTimeout(() => setTacticalSonar(true), 50);
  } else {
    setTacticalSonar(false);
  }
  loop();
}

// ── WHALES ──
var WHALE_SPAWN_INTERVAL = 1800; // ~30s at 60fps
var WHALE_MAX = 3;

function spawnWhale() {
  if (!state.whales) state.whales = [];
  if (state.whales.filter(function(w){ return w.alive; }).length >= WHALE_MAX) return;
  var sx = 3 + Math.floor(Math.random() * (GRID.W - 6));
  var sz = 3 + Math.floor(Math.random() * (GRID.D - 6));
  var sp = findClearCell(sx, sz);
  var whale = {
    x: sp.x + Math.random() * 2 - 1,
    y: 1.5 + Math.random() * (GRID.H - 3),
    z: sp.z + Math.random() * 2 - 1,
    heading: Math.random() * Math.PI * 2,
    speed: 0.006 + Math.random() * 0.004,
    length: 9, beam: 3.5,
    alive: true,
    audio: playWhaleCall(),
    turnTimer: 0,
    turnInterval: 180 + Math.floor(Math.random() * 300),
  };
  state.whales.push(whale);
  addEvent('▸ BIOLOGIC CONTACT — WHALE', false);
}

function updateWhales() {
  if (!state.whales) state.whales = [];
  if (state.time > 0 && state.time % WHALE_SPAWN_INTERVAL === 0) spawnWhale();
  state.whales = state.whales.filter(function(w) { return w.alive; });
  state.whales.forEach(function(whale) {
    whale.turnTimer++;
    if (whale.turnTimer >= whale.turnInterval) {
      whale.heading += (Math.random() - 0.5) * Math.PI * 0.9;
      whale.turnTimer = 0;
      whale.turnInterval = 180 + Math.floor(Math.random() * 300);
    }
    whale.x += Math.sin(whale.heading) * whale.speed;
    whale.z += Math.cos(whale.heading) * whale.speed;
    whale.y += (Math.random() - 0.5) * 0.01;
    whale.y = Math.max(1.2, Math.min(GRID.H - 1.2, whale.y));
    if (whale.x < 2 || whale.x > GRID.W - 2) {
      whale.heading = Math.PI - whale.heading;
      whale.x = Math.max(2, Math.min(GRID.W - 2, whale.x));
    }
    if (whale.z < 2 || whale.z > GRID.D - 2) {
      whale.heading = -whale.heading;
      whale.z = Math.max(2, Math.min(GRID.D - 2, whale.z));
    }
  });
}

// Draw whale in command (sonar isometric) view
function drawWhale(whale) {
  if (!whale.alive) return;
  var sp = project(whale.x, whale.y, whale.z);
  var col = '#00ff66';
  var colFill = 'rgba(0,220,80,0.13)';
  var screenAngle = -(whale.heading - camRotY);
  ctx.save();
  ctx.translate(sp.sx, sp.sy);
  ctx.rotate(screenAngle);
  ctx.globalAlpha = 0.88;
  // Glow halo
  var grd = ctx.createRadialGradient(0,0,0,0,0,26);
  grd.addColorStop(0, 'rgba(0,220,80,0.18)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(0,0,26,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur = 9; ctx.shadowColor = col;
  // Body
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.bezierCurveTo(20,-6, 8,-9, 0,-8);
  ctx.bezierCurveTo(-10,-8, -17,-6, -20, 0);
  ctx.bezierCurveTo(-17, 6, -10, 8, 0, 8);
  ctx.bezierCurveTo(8, 9, 20, 6, 20, 0);
  ctx.closePath();
  ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
  ctx.fill(); ctx.stroke();
  // Dorsal fin
  ctx.beginPath();
  ctx.moveTo(-2,-8); ctx.lineTo(-7,-17); ctx.lineTo(-11,-8);
  ctx.closePath();
  ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1;
  ctx.fill(); ctx.stroke();
  // Tail flukes
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(-27,-7); ctx.lineTo(-24, 0); ctx.lineTo(-27, 7);
  ctx.closePath();
  ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1;
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.rotate(-screenAngle); // undo rotation for text
  ctx.font = '7px Share Tech Mono'; ctx.fillStyle = '#00ff66';
  ctx.textAlign = 'center'; ctx.fillText('WHALE', 0, -24);
  ctx.restore();
}

// Draw whale in periscope first-person view
function drawWhalePeri(whale) {
  if (!whale.alive) return;
  var pp = projectPeriscope(whale.x, whale.y, whale.z);
  if (!pp || pp.depth < 0.1 || pp.depth > 50) return;
  var wScale = Math.max(0.3, Math.min(2.5, 8 / pp.depth));
  var alpha = Math.max(0, 1 - pp.depth / 42) * 0.9;
  if (alpha < 0.05) return;
  ctx.save();
  ctx.translate(pp.sx, pp.sy);
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 10; ctx.shadowColor = '#00ff66';
  // Body ellipse
  ctx.beginPath();
  ctx.ellipse(0, 0, 16*wScale, 6*wScale, 0, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,220,80,0.15)'; ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 1.2;
  ctx.fill(); ctx.stroke();
  // Dorsal fin
  ctx.beginPath();
  ctx.moveTo(-2*wScale, -6*wScale);
  ctx.lineTo(-5*wScale, -15*wScale);
  ctx.lineTo(-9*wScale, -6*wScale);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,220,80,0.2)'; ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 0.8;
  ctx.fill(); ctx.stroke();
  // Tail
  ctx.beginPath();
  ctx.moveTo(-16*wScale, 0);
  ctx.lineTo(-21*wScale, -5*wScale); ctx.lineTo(-19*wScale, 0);
  ctx.lineTo(-21*wScale, 5*wScale); ctx.closePath();
  ctx.fillStyle = 'rgba(0,220,80,0.2)'; ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 0.8;
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.font = Math.round(7*wScale) + 'px Share Tech Mono';
  ctx.fillStyle = '#00ff66'; ctx.textAlign = 'center';
  ctx.fillText('WHALE', 0, -19*wScale);
  ctx.restore();
}

// ── MEGALODON ──
function spawnMegalodon() {
  if (!state.megalodons) state.megalodons = [];
  if (state.megalodons.filter(function(m){ return m.alive; }).length >= MEG_MAX) return;
  var sx = 3 + Math.floor(Math.random() * (GRID.W - 6));
  var sz = 3 + Math.floor(Math.random() * (GRID.D - 6));
  var sp = findClearCell(sx, sz);
  var meg = {
    x: sp.x + Math.random() * 2 - 1,
    y: 1.0 + Math.random() * (GRID.H - 2),
    z: sp.z + Math.random() * 2 - 1,
    heading: Math.random() * Math.PI * 2,
    speed: 0.045 + Math.random() * 0.02,
    length: 14, beam: 4.5,
    alive: true,
    turnTimer: 0,
    turnInterval: 120 + Math.floor(Math.random() * 180),
    biteTimer: 0,
    hits: 0, maxHits: 2, bleeding: false, bleedTimer: 0
  };
  state.megalodons.push(meg);
  addEvent('▸ APEX PREDATOR — MEGALODON DETECTED', true);
  setTimeout(function(){ addEvent('▸ MEGALODON HUNTING — PROTECT THE WHALES', false); }, 1500);
}

function updateMegalodons() {
  if (!state.megalodons) state.megalodons = [];
  if (state.time > 0 && state.time % MEG_SPAWN_INTERVAL === 0) spawnMegalodon();
  state.megalodons = state.megalodons.filter(function(m) { return m.alive; });

  state.megalodons.forEach(function(meg) {
    if (meg.biteTimer > 0) meg.biteTimer--;

    // Find nearest whale to hunt
    var nearestWhale = null;
    var nearestDist = Infinity;
    if (state.whales) {
      state.whales.forEach(function(w) {
        if (!w.alive) return;
        var dx = w.x - meg.x, dz = w.z - meg.z;
        var d = Math.sqrt(dx*dx + dz*dz);
        if (d < nearestDist) { nearestDist = d; nearestWhale = w; }
      });
    }

    if (nearestWhale && nearestDist < 22) {
      // Steer toward whale
      var tx = nearestWhale.x - meg.x;
      var tz = nearestWhale.z - meg.z;
      var targetH = Math.atan2(tx, tz);
      var hdiff = targetH - meg.heading;
      while (hdiff >  Math.PI) hdiff -= Math.PI * 2;
      while (hdiff < -Math.PI) hdiff += Math.PI * 2;
      meg.heading += hdiff * 0.06;

      // Kill whale on contact
      if (nearestDist < 2.0) {
        nearestWhale.alive = false;
        if (nearestWhale.audio) { try { nearestWhale.audio.pause(); nearestWhale.audio.currentTime = 0; } catch(e){} }
        spawnExplosion(nearestWhale.x, nearestWhale.y, nearestWhale.z, false, '#6688aa');
        addEvent('▸ MEGALODON STRIKE — WHALE LOST', true);
        setTimeout(function(){ addEvent('▸ ELIMINATE THE MEGALODON', false); }, 1200);
      }
    } else {
      // Roam
      meg.turnTimer++;
      if (meg.turnTimer >= meg.turnInterval) {
        meg.heading += (Math.random() - 0.5) * Math.PI * 0.8;
        meg.turnTimer = 0;
        meg.turnInterval = 120 + Math.floor(Math.random() * 180);
      }
    }

    // Move
    meg.x += Math.sin(meg.heading) * meg.speed;
    meg.z += Math.cos(meg.heading) * meg.speed;
    meg.y += (Math.random() - 0.5) * 0.012;
    meg.y = Math.max(1.0, Math.min(GRID.H - 1.0, meg.y));

    // Boundary bounce
    if (meg.x < 2 || meg.x > GRID.W - 2) {
      meg.heading = Math.PI - meg.heading;
      meg.x = Math.max(2, Math.min(GRID.W - 2, meg.x));
    }
    if (meg.z < 2 || meg.z > GRID.D - 2) {
      meg.heading = -meg.heading;
      meg.z = Math.max(2, Math.min(GRID.D - 2, meg.z));
    }

    // Blood trail on wounded meg
    if (meg.bleeding) {
      meg.bleedTimer = (meg.bleedTimer || 0) + 1;
      if (meg.bleedTimer % 60 === 0) spawnBloodPuff(meg.x, meg.y, meg.z);
    }

    // Bite player sub
    var pdx = state.player.x - meg.x;
    var pdy = state.player.y - meg.y;
    var pdz = state.player.z - meg.z;
    var playerDist = Math.sqrt(pdx*pdx + pdy*pdy + pdz*pdz);
    if (playerDist < MEG_BITE_RANGE && meg.biteTimer === 0) {
      meg.biteTimer = MEG_BITE_COOLDOWN;
      applyHullDamage(MEG_BITE_DAMAGE, '⚠ MEGALODON BITE — HULL BREACH');
      setTimeout(function(){ addEvent('▸ MEGALODON ON THE SUB — FIRE NOW', true); }, 300);
    }
  });
}

function drawMegalodon(meg) {
  if (!meg.alive) return;
  var sp = project(meg.x, meg.y, meg.z);
  var col = '#6688aa';
  var colFill = 'rgba(80,110,150,0.13)';
  var screenAngle = -(meg.heading - camRotY);
  ctx.save();
  ctx.translate(sp.sx, sp.sy);
  ctx.rotate(screenAngle);
  ctx.globalAlpha = 0.9;
  // Glow halo
  var grd = ctx.createRadialGradient(0,0,0,0,0,34);
  grd.addColorStop(0, 'rgba(80,110,180,0.18)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(0,0,34,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur = 10; ctx.shadowColor = col;
  // Main body — elongated torpedo shape
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.bezierCurveTo(28,-5, 12,-9, 0,-8);
  ctx.bezierCurveTo(-14,-8, -24,-5, -28, 0);
  ctx.bezierCurveTo(-24, 5, -14, 8, 0, 8);
  ctx.bezierCurveTo(12, 9, 28, 5, 28, 0);
  ctx.closePath();
  ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
  ctx.fill(); ctx.stroke();
  // Pointed snout
  ctx.beginPath();
  ctx.moveTo(28, 0); ctx.lineTo(36, 1); ctx.lineTo(34, -1);
  ctx.closePath();
  ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1;
  ctx.fill(); ctx.stroke();
  // Large dorsal fin
  ctx.beginPath();
  ctx.moveTo(6, -8); ctx.lineTo(3, -24); ctx.lineTo(-8, -8);
  ctx.closePath();
  ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
  ctx.fill(); ctx.stroke();
  // Pectoral fins
  ctx.beginPath();
  ctx.moveTo(12, 8); ctx.lineTo(20, 20); ctx.lineTo(2, 8);
  ctx.closePath();
  ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1;
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12,-8); ctx.lineTo(20,-20); ctx.lineTo(2,-8);
  ctx.closePath();
  ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1;
  ctx.fill(); ctx.stroke();
  // Crescent tail
  ctx.beginPath();
  ctx.moveTo(-28, 0); ctx.lineTo(-38,-12); ctx.lineTo(-32, 0); ctx.lineTo(-38, 12);
  ctx.closePath();
  ctx.fillStyle = colFill; ctx.strokeStyle = col; ctx.lineWidth = 1;
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.rotate(-screenAngle);
  ctx.font = '7px Share Tech Mono'; ctx.fillStyle = col;
  ctx.textAlign = 'center'; ctx.fillText('MEGALODON', 0, -32);
  ctx.restore();
}

function drawMegalodonPeri(meg) {
  if (!meg.alive) return;
  var pp = projectPeriscope(meg.x, meg.y, meg.z);
  if (!pp || pp.depth < 0.1 || pp.depth > 55) return;
  var mScale = Math.max(0.3, Math.min(2.5, 10 / pp.depth));
  var alpha = Math.max(0, 1 - pp.depth / 46) * 0.9;
  if (alpha < 0.05) return;
  var col = '#6688aa';
  ctx.save();
  ctx.translate(pp.sx, pp.sy);
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 10; ctx.shadowColor = col;
  // Body — elongated ellipse
  ctx.beginPath();
  ctx.ellipse(0, 0, 20*mScale, 7*mScale, 0, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(80,110,150,0.15)'; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
  ctx.fill(); ctx.stroke();
  // Large dorsal fin
  ctx.beginPath();
  ctx.moveTo(3*mScale, -7*mScale);
  ctx.lineTo(0, -20*mScale);
  ctx.lineTo(-7*mScale, -7*mScale);
  ctx.closePath();
  ctx.fillStyle = 'rgba(80,110,150,0.2)'; ctx.strokeStyle = col; ctx.lineWidth = 0.8;
  ctx.fill(); ctx.stroke();
  // Crescent tail
  ctx.beginPath();
  ctx.moveTo(-20*mScale, 0);
  ctx.lineTo(-28*mScale, -9*mScale); ctx.lineTo(-23*mScale, 0);
  ctx.lineTo(-28*mScale,  9*mScale); ctx.closePath();
  ctx.fillStyle = 'rgba(80,110,150,0.2)'; ctx.strokeStyle = col; ctx.lineWidth = 0.8;
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.font = Math.round(7*mScale) + 'px Share Tech Mono';
  ctx.fillStyle = col; ctx.textAlign = 'center';
  ctx.fillText('MEGALODON', 0, -24*mScale);
  ctx.restore();
}

// ── GIANT SQUID ──
var SQUID_MAX = 1;
var SQUID_SPAWN_INTERVAL = 14400; // respawn ~8 min after kill (at 30fps)

function spawnSquid() {
  if (!state.squids) state.squids = [];
  if (state.squids.filter(function(s){ return s.alive; }).length >= SQUID_MAX) return;
  var sx = 5 + Math.floor(Math.random() * (GRID.W - 10));
  var sz = 5 + Math.floor(Math.random() * (GRID.D - 10));
  var sp = findClearCell(sx, sz);
  state.squids.push({
    x: sp.x + Math.random() * 2 - 1,
    y: 2.0 + Math.random() * (GRID.H - 4),
    z: sp.z + Math.random() * 2 - 1,
    heading: Math.random() * Math.PI * 2,
    speed: 0.005 + Math.random() * 0.003,
    alive: true,
    turnTimer: 0,
    turnInterval: 200 + Math.floor(Math.random() * 280),
    tentPhase: Math.random() * Math.PI * 2,
  });
  addEvent('▸ ANOMALOUS CONTACT — GIANT SQUID', true);
  setTimeout(function(){ addEvent('▸ LEVIATHAN DETECTED — ENGAGE TO UNLOCK MISSION', false); }, 1500);
}

function updateSquids() {
  if (!state.squids) state.squids = [];
  state.squids = state.squids.filter(function(s){ return s.alive; });
  var missionIdle = !state.wpMission.active && state.wpMission.result === null;
  if (missionIdle && state.squids.length === 0 && state.time > 0 && state.time % SQUID_SPAWN_INTERVAL === 0) spawnSquid();
  state.squids.forEach(function(sq) {
    sq.tentPhase += 0.08;
    sq.turnTimer++;
    if (sq.turnTimer >= sq.turnInterval) {
      sq.heading += (Math.random() - 0.5) * Math.PI * 1.1;
      sq.turnTimer = 0;
      sq.turnInterval = 200 + Math.floor(Math.random() * 280);
    }
    sq.x += Math.sin(sq.heading) * sq.speed;
    sq.z += Math.cos(sq.heading) * sq.speed;
    sq.y += Math.sin(sq.tentPhase * 0.3) * 0.008;
    sq.y = Math.max(1.5, Math.min(GRID.H - 1.5, sq.y));
    if (sq.x < 2 || sq.x > GRID.W - 2) { sq.heading = Math.PI - sq.heading; sq.x = Math.max(2, Math.min(GRID.W-2, sq.x)); }
    if (sq.z < 2 || sq.z > GRID.D - 2) { sq.heading = -sq.heading; sq.z = Math.max(2, Math.min(GRID.D-2, sq.z)); }
  });
}

function drawSquid(sq) {
  if (!sq.alive) return;
  var sp = project(sq.x, sq.y, sq.z);
  var col = '#ff8800';
  var screenAngle = -(sq.heading - camRotY);
  ctx.save();
  ctx.translate(sp.sx, sp.sy);
  ctx.rotate(screenAngle);
  ctx.globalAlpha = 0.88;
  var grd = ctx.createRadialGradient(0,0,0,0,0,22);
  grd.addColorStop(0, 'rgba(255,100,0,0.22)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur = 10; ctx.shadowColor = col;
  // Mantle (body)
  ctx.beginPath();
  ctx.ellipse(4, 0, 12, 6, 0, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,100,0,0.18)'; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
  ctx.fill(); ctx.stroke();
  // Head
  ctx.beginPath();
  ctx.ellipse(-4, 0, 6, 5, 0, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  // Tentacles (8, wiggling with tentPhase)
  for (var ti = 0; ti < 8; ti++) {
    var tAng = (ti / 8) * Math.PI * 2;
    var tWave = Math.sin(sq.tentPhase + ti * 0.8) * 4;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.quadraticCurveTo(-12 + tWave, Math.sin(tAng)*8, -18 + tWave, Math.sin(tAng)*14);
    ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6;
    ctx.stroke();
  }
  ctx.globalAlpha = 0.88;
  ctx.shadowBlur = 0;
  ctx.rotate(-screenAngle);
  ctx.font = '7px Share Tech Mono'; ctx.fillStyle = col;
  ctx.textAlign = 'center'; ctx.fillText('SQUID', 0, -22);
  ctx.restore();
}

function drawSquidPeri(sq) {
  if (!sq.alive) return;
  var pp = projectPeriscope(sq.x, sq.y, sq.z);
  if (!pp || pp.depth < 0.1 || pp.depth > 55) return;
  var sc = Math.max(0.3, Math.min(2.5, 9 / pp.depth));
  var alpha = Math.max(0, 1 - pp.depth / 46) * 0.95;
  if (alpha < 0.05) return;
  var col = '#ff7700';
  ctx.save();
  ctx.translate(pp.sx, pp.sy);
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 14; ctx.shadowColor = '#ff5500';
  // Mantle
  ctx.beginPath();
  ctx.ellipse(5*sc, 0, 14*sc, 7*sc, 0, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,100,0,0.18)'; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
  ctx.fill(); ctx.stroke();
  // Head
  ctx.beginPath();
  ctx.ellipse(-4*sc, 0, 7*sc, 6*sc, 0, 0, Math.PI*2);
  ctx.fill(); ctx.stroke();
  // Fin lobes
  ctx.beginPath();
  ctx.moveTo(10*sc, -7*sc); ctx.lineTo(16*sc, -13*sc); ctx.lineTo(14*sc, -7*sc);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,100,0,0.2)'; ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10*sc,  7*sc); ctx.lineTo(16*sc,  13*sc); ctx.lineTo(14*sc,  7*sc);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Tentacles — 8, fanning out from head, wiggling
  ctx.lineWidth = 0.9;
  for (var ti = 0; ti < 8; ti++) {
    var spread = ((ti / 7) - 0.5) * Math.PI * 0.9;
    var wave = Math.sin(sq.tentPhase + ti * 0.9) * 5 * sc;
    var tx1 = -10*sc, ty1 = Math.sin(spread) * 5*sc;
    var tx2 = -20*sc + wave, ty2 = Math.sin(spread) * 14*sc;
    var tx3 = -28*sc + wave * 1.4, ty3 = Math.sin(spread) * 20*sc;
    ctx.beginPath();
    ctx.moveTo(tx1, ty1);
    ctx.quadraticCurveTo(tx2, ty2, tx3, ty3);
    ctx.strokeStyle = `rgba(255,120,0,${0.7 - ti * 0.04})`;
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.font = Math.round(7*sc) + 'px Share Tech Mono';
  ctx.fillStyle = col; ctx.textAlign = 'center';
  ctx.fillText('GIANT SQUID', 0, -22*sc);
  ctx.restore();
}

// ── WATER SURFACE GRID (Battlezone/Tron style) ──
function drawWaterGrid(surfaceFrac) {
  const sf = surfaceFrac !== undefined ? surfaceFrac : (state.player.y / GRID.H);
  const baseA = Math.max(0, (sf - 0.55) / 0.45) * 0.55;
  if (baseA < 0.01) return;
  const px = state.player.x, pz = state.player.z;
  const spacing = 2.0, range = 36;
  const xMin = Math.floor((px - range) / spacing) * spacing;
  const xMax = Math.ceil((px + range) / spacing) * spacing;
  const zMin = Math.floor((pz - range) / spacing) * spacing;
  const zMax = Math.ceil((pz + range) / spacing) * spacing;
  ctx.save();
  ctx.lineWidth = 0.8;
  // X-direction lines (constant X, vary Z)
  for (let wx = xMin; wx <= xMax; wx += spacing) {
    const p1 = projectPeriscope(wx, GRID.H, pz - range);
    const p2 = projectPeriscope(wx, GRID.H, pz + range);
    if (!p1 || !p2) continue;
    const distFade = Math.max(0, 1 - Math.min(p1.depth, p2.depth) / 40);
    const a = baseA * distFade;
    if (a < 0.01) continue;
    ctx.strokeStyle = `rgba(0,200,230,${a.toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(p1.sx, p1.sy); ctx.lineTo(p2.sx, p2.sy); ctx.stroke();
  }
  // Z-direction lines (constant Z, vary X)
  for (let wz = zMin; wz <= zMax; wz += spacing) {
    const p1 = projectPeriscope(px - range, GRID.H, wz);
    const p2 = projectPeriscope(px + range, GRID.H, wz);
    if (!p1 || !p2) continue;
    const distFade = Math.max(0, 1 - Math.min(p1.depth, p2.depth) / 40);
    const a = baseA * distFade;
    if (a < 0.01) continue;
    ctx.strokeStyle = `rgba(0,200,230,${a.toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(p1.sx, p1.sy); ctx.lineTo(p2.sx, p2.sy); ctx.stroke();
  }
  ctx.restore();
}

// ── 3D WIREFRAME SHIP (Battlezone-style) ──
// ── TYPHOON CLASS 3D WIREFRAME (periscope / surface views) ──
function drawTyphoonPeri(alpha, projFn) {
  projFn = projFn || projectPeriscope;
  const en  = state.enemy;
  const cosH = Math.cos(en.heading), sinH = Math.sin(en.heading);

  // World dimensions: L=length, B=beam, HH=half-height
  const L  = 3.5, B  = 1.2, HH = 0.55;
  const hl = L * 0.5, hb = B * 0.5;

  // Local → world → screen  (bow = +lz, starboard = +lx, up = +ly)
  function tp(lx, ly, lz) {
    const wx = en.x + lx * cosH + lz * sinH;
    const wz = en.z - lx * sinH + lz * cosH;
    return projFn(wx, en.y + ly, wz);
  }

  const col = '#ff4444';
  function line(a, b, a2) {
    if (!a || !b) return;
    ctx.strokeStyle = `rgba(255,68,68,${((a2 !== undefined ? a2 : alpha)).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
  }

  ctx.save();
  ctx.shadowBlur = 8; ctx.shadowColor = col;

  // Hull cross-section frames — 7 rings from stern to bow
  // Each ring: [lz, widthScale, heightScale]
  const ringDefs = [
    [-hl,      0.30, 0.30],  // stern cap
    [-hl*0.70, 0.82, 0.82],  // aft
    [-hl*0.25, 1.00, 1.00],  // aft-mid
    [ 0,       1.00, 1.00],  // amidships (widest)
    [ hl*0.30, 1.00, 0.95],  // fore-mid
    [ hl*0.68, 0.80, 0.78],  // forward
    [ hl,      0.28, 0.28],  // bow cap
  ];

  // 8-point oval for each ring: T, TS, S, BS, B, BP, P, TP
  const offsets = [
    [ 0,    1,    0  ],  // top
    [ 0.70, 0.70, 0  ],  // top-starboard
    [ 1,    0,    0  ],  // starboard
    [ 0.70,-0.70, 0  ],  // bottom-starboard
    [ 0,   -1,    0  ],  // bottom
    [-0.70,-0.70, 0  ],  // bottom-port
    [-1,    0,    0  ],  // port
    [-0.70, 0.70, 0  ],  // top-port
  ];

  const rings = ringDefs.map(([lz, xs, ys]) =>
    offsets.map(([ox, oy]) => tp(ox * hb * xs, oy * HH * ys, lz))
  );

  // Draw ring frames
  ctx.lineWidth = 1.1;
  rings.forEach(r => {
    for (let i = 0; i < 8; i++) line(r[i], r[(i+1)%8], alpha * 0.8);
  });

  // Longitudinal stringers (top, starboard, bottom, port + 45° diagonals)
  ctx.lineWidth = 1.0;
  for (let i = 0; i < rings.length - 1; i++) {
    [0, 2, 4, 6].forEach(k => line(rings[i][k], rings[i+1][k], alpha * 0.85));
    [1, 3, 5, 7].forEach(k => line(rings[i][k], rings[i+1][k], alpha * 0.45));
  }

  // Twin pressure-hull ridges along the top (distinctive Typhoon feature)
  ctx.lineWidth = 0.8;
  const ridgeZ0 = -hl * 0.65, ridgeZ1 = hl * 0.55;
  [-0.38, 0.38].forEach(rx => {
    const r0 = tp(rx * hb, HH * 0.98, ridgeZ0);
    const r1 = tp(rx * hb, HH * 0.98, ridgeZ1);
    line(r0, r1, alpha * 0.55);
  });

  // ── SAIL (conning tower) — wide, forward of amidships ──
  const sailZ  =  hl * 0.22;   // sail centre
  const sailHl =  hl * 0.22;   // fore-aft half-length of sail base
  const sailHb =  hb * 0.42;   // port-starboard half-width of sail
  const sailBot =  HH * 0.88;  // sail base height (just above hull top)
  const sailTop =  HH * 0.88 + L * 0.28; // sail top height

  const sFL = tp(-sailHb, sailBot, sailZ + sailHl);
  const sFR = tp( sailHb, sailBot, sailZ + sailHl);
  const sAL = tp(-sailHb, sailBot, sailZ - sailHl);
  const sAR = tp( sailHb, sailBot, sailZ - sailHl);
  const sTL = tp(-sailHb, sailTop, sailZ + sailHl * 0.6);
  const sTR = tp( sailHb, sailTop, sailZ + sailHl * 0.6);
  const sTAL = tp(-sailHb, sailTop * 0.85, sailZ - sailHl);
  const sTAR = tp( sailHb, sailTop * 0.85, sailZ - sailHl);

  ctx.lineWidth = 1.2;
  // Sail base footprint
  line(sFL, sFR); line(sAL, sAR); line(sFL, sAL); line(sFR, sAR);
  // Sail verticals
  line(sFL, sTL); line(sFR, sTR); line(sAL, sTAL); line(sAR, sTAR);
  // Sail top
  line(sTL, sTR); line(sTAL, sTAR); line(sTL, sTAL); line(sTR, sTAR);
  // Internal sail spine
  const sailSpineBot = tp(0, sailBot, sailZ);
  const sailSpineTop = tp(0, sailTop * 0.9, sailZ);
  ctx.lineWidth = 0.7;
  line(sailSpineBot, sailSpineTop, alpha * 0.4);

  // Periscope / mast cluster (3 masts at different heights)
  ctx.lineWidth = 0.9;
  [[-0.3, sailTop, sailZ + sailHl*0.3],
   [ 0,   sailTop, sailZ + sailHl*0.1],
   [ 0.3, sailTop, sailZ - sailHl*0.1]].forEach(([mx, my, mz], i) => {
    const mBot = tp(mx * sailHb, my,             mz);
    const mTop = tp(mx * sailHb, my + L * 0.12 - i * L * 0.03, mz);
    line(mBot, mTop, alpha * (0.85 - i * 0.15));
  });

  // ── STERN STABILISERS ──
  const stZ = -hl * 0.60;
  ctx.lineWidth = 1.1;
  [[-1],[1]].forEach(([s]) => {
    // Horizontal planes (port/starboard)
    const h1 = tp(s * hb * 0.8,  0,          stZ);
    const h2 = tp(s * hb * 2.3, -HH * 0.1,   stZ - hl * 0.18);
    const h3 = tp(s * hb * 1.9, -HH * 0.1,   stZ - hl * 0.32);
    const h4 = tp(s * hb * 0.8,  0,           stZ - hl * 0.12);
    line(h1, h2); line(h2, h3); line(h3, h4); line(h4, h1, alpha * 0.6);
  });
  // Vertical rudder (top)
  const rv1 = tp(0,  HH * 0.7,  stZ);
  const rv2 = tp(0,  HH * 2.4,  stZ - hl * 0.22);
  const rv3 = tp(0,  HH * 2.0,  stZ - hl * 0.36);
  const rv4 = tp(0,  HH * 0.7,  stZ - hl * 0.12);
  line(rv1, rv2); line(rv2, rv3); line(rv3, rv4); line(rv4, rv1, alpha * 0.6);
  // Vertical keel (bottom)
  const rk1 = tp(0, -HH * 0.7,  stZ);
  const rk2 = tp(0, -HH * 2.2,  stZ - hl * 0.20);
  const rk3 = tp(0, -HH * 1.8,  stZ - hl * 0.33);
  const rk4 = tp(0, -HH * 0.7,  stZ - hl * 0.12);
  line(rk1, rk2); line(rk2, rk3); line(rk3, rk4); line(rk4, rk1, alpha * 0.6);

  // ── TWIN COUNTER-ROTATING PROPELLERS ──
  [-hb * 0.38, hb * 0.38].forEach((px, idx) => {
    const hub = tp(px, 0, -hl);
    if (!hub) return;
    const tip = tp(px + 0.28, 0, -hl);
    const propR = tip ? Math.abs(tip.sx - hub.sx) * 2.2 + 4 : 8;
    const spin = state.animFrame * (idx === 0 ? 0.10 : -0.10);
    ctx.save(); ctx.translate(hub.sx, hub.sy);
    for (let b = 0; b < 5; b++) {
      ctx.save(); ctx.rotate(spin + b * Math.PI * 2 / 5);
      ctx.strokeStyle = `rgba(255,68,68,${(alpha * 0.55).toFixed(3)})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -propR); ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = `rgba(255,68,68,${(alpha * 0.8).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });

  // Label above sail
  const labelPt = tp(0, sailTop + L * 0.08, sailZ);
  if (labelPt) {
    ctx.shadowBlur = 0;
    const ls = Math.max(0.5, Math.min(2, 8 / labelPt.depth));
    ctx.font = `${Math.round(7 * ls)}px Share Tech Mono`;
    ctx.fillStyle = col; ctx.textAlign = 'center';
    ctx.globalAlpha = alpha;
    ctx.fillText('BRAVO', labelPt.sx, labelPt.sy);
    ctx.globalAlpha = 1;
  }

  ctx.shadowBlur = 0; ctx.lineWidth = 0.7;
  ctx.restore();
}

// projFn defaults to projectPeriscope; pass projectSurface for the surface view.
function drawShipWireframe3D(ship, alpha, projFn) {
  projFn = projFn || projectPeriscope;
  const wy = ship.sinking ? ship.sinkY : GRID.H;
  const H = ship.heading;
  const cosH = Math.cos(H), sinH = Math.sin(H);
  const L = ship.length || 8;
  const B = (ship.beam || L * 0.18);

  // Local-space → world → screen projection
  // Local axes: +lz = bow, +lx = starboard, +ly = up
  function tp(lx, ly, lz) {
    const wx = ship.x + lx * cosH + lz * sinH;
    const wz = ship.z - lx * sinH + lz * cosH;
    return projFn(wx, wy + ly, wz);
  }

  // ── Hull vertices (local space, bow = +Z) ──
  const hl = L * 0.5;       // half length
  const hb = B * 0.5;       // half beam
  const dk = L * 0.04;      // deck height above waterline
  const kl = L * 0.06;      // keel depth below waterline
  const bow = L * 0.38;     // bow taper starts here from centre

  // Main hull box (8 corners): stern-to-bow along Z
  // Deck corners (ly = dk)
  const dFL = tp(-hb, dk,  bow);   // deck fore-left
  const dFR = tp( hb, dk,  bow);   // deck fore-right
  const dAL = tp(-hb, dk, -hl);    // deck aft-left
  const dAR = tp( hb, dk, -hl);    // deck aft-right
  // Keel corners (ly = -kl)
  const kFL = tp(-hb, -kl,  bow);
  const kFR = tp( hb, -kl,  bow);
  const kAL = tp(-hb, -kl, -hl);
  const kAR = tp( hb, -kl, -hl);
  // Bow tip (ly = dk/2 for a mid-height point)
  const bowTip = tp(0, dk * 0.3, hl);

  // Superstructure
  const ss0z = -hl * 0.05;  // superstructure centre Z (slightly aft of midship)
  const ssH  = L * 0.10;    // superstructure height
  const ssHB = hb * 0.55;   // superstructure half-beam
  const ssHLf = hl * 0.22;  // superstructure half-length fore
  const ssHLa = hl * 0.28;  // superstructure half-length aft
  const ssFL = tp(-ssHB, dk + ssH, ss0z + ssHLf);
  const ssFR = tp( ssHB, dk + ssH, ss0z + ssHLf);
  const ssAL = tp(-ssHB, dk + ssH, ss0z - ssHLa);
  const ssAR = tp( ssHB, dk + ssH, ss0z - ssHLa);
  const ssBL = tp(-ssHB, dk,       ss0z - ssHLa);
  const ssBR = tp( ssHB, dk,       ss0z - ssHLa);
  const ssTFL = tp(-ssHB, dk,      ss0z + ssHLf);
  const ssTFR = tp( ssHB, dk,      ss0z + ssHLf);

  // Bridge top (narrow box above superstructure)
  const brH  = L * 0.06;
  const brHB = hb * 0.30;
  const brHL = hl * 0.10;
  const brFL = tp(-brHB, dk + ssH + brH, ss0z + brHL);
  const brFR = tp( brHB, dk + ssH + brH, ss0z + brHL);
  const brAL = tp(-brHB, dk + ssH + brH, ss0z - brHL);
  const brAR = tp( brHB, dk + ssH + brH, ss0z - brHL);

  // Mast (single pole at bridge top centre, used for label)
  const mastTop = tp(0, dk + ssH + brH + L * 0.14, ss0z);
  const mastBot = tp(0, dk + ssH + brH,             ss0z);

  // Gun turrets (fore and aft)
  const gtSz = B * 0.32;
  const turrFore = tp(0, dk + gtSz * 0.4, hl * 0.52);
  const turrForeL = tp(-gtSz * 0.5, dk, hl * 0.52);
  const turrForeR = tp( gtSz * 0.5, dk, hl * 0.52);
  const turrAft = tp(0, dk + gtSz * 0.4, -hl * 0.65);
  const turrAftL = tp(-gtSz * 0.5, dk, -hl * 0.65);
  const turrAftR = tp( gtSz * 0.5, dk, -hl * 0.65);
  // Gun barrels (fore points forward +Z, aft points backward -Z)
  const gunFore = tp(0, dk + gtSz * 0.5, hl * 0.52 + L * 0.14);
  const gunAft  = tp(0, dk + gtSz * 0.5, -hl * 0.65 - L * 0.12);

  // Funnel (smokestack mid-ship)
  const fnZ = ss0z + hl * 0.08;
  const fnBot = tp(0, dk + ssH,          fnZ);
  const fnTop = tp(0, dk + ssH + L*0.07, fnZ);

  // ── Draw helpers ──
  const col = ship.col || '#00e8ff';
  // Parse colour to rgb for rgba usage
  let cr = 0, cg = 232, cb = 255;
  if (col.startsWith('#') && col.length === 7) {
    cr = parseInt(col.slice(1,3),16);
    cg = parseInt(col.slice(3,5),16);
    cb = parseInt(col.slice(5,7),16);
  }

  function line(a, b, a2) {
    if (!a || !b) return;
    const fa = (a2 !== undefined ? a2 : alpha);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${fa.toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
  }

  ctx.save();
  ctx.lineWidth = 1.2;
  ctx.shadowBlur = 6;
  ctx.shadowColor = col;

  // Hull deck outline
  line(dAL, dAR); line(dFL, dFR);
  line(dAL, dFL); line(dAR, dFR);
  // Bow rakes to tip
  line(dFL, bowTip); line(dFR, bowTip);
  line(kFL, bowTip); line(kFR, bowTip);
  // Keel outline
  line(kAL, kAR); line(kFL, kFR);
  line(kAL, kFL); line(kAR, kFR);
  // Sides (deck to keel)
  line(dAL, kAL, alpha * 0.6); line(dAR, kAR, alpha * 0.6);
  line(dFL, kFL, alpha * 0.5); line(dFR, kFR, alpha * 0.5);
  // Stern transom
  line(dAL, dAR); line(kAL, kAR);
  line(dAL, kAL, alpha * 0.7); line(dAR, kAR, alpha * 0.7);

  // Superstructure
  ctx.lineWidth = 1.0;
  line(ssFL, ssFR); line(ssAL, ssAR);
  line(ssFL, ssAL); line(ssFR, ssAR);
  line(ssFL, ssTFL, alpha*0.5); line(ssFR, ssTFR, alpha*0.5);
  line(ssAL, ssBL, alpha*0.5);  line(ssAR, ssBR, alpha*0.5);

  // Bridge
  ctx.lineWidth = 0.9;
  line(brFL, brFR); line(brAL, brAR);
  line(brFL, brAL); line(brFR, brAR);
  line(ssFL, brFL, alpha*0.6); line(ssFR, brFR, alpha*0.6);
  line(ssAL, brAL, alpha*0.5); line(ssAR, brAR, alpha*0.5);

  // Mast
  ctx.lineWidth = 0.7;
  line(mastBot, mastTop, alpha * 0.9);

  // Funnel
  line(fnBot, fnTop, alpha * 0.8);

  // Gun turrets
  ctx.lineWidth = 0.8;
  line(turrForeL, turrForeR, alpha*0.7);
  line(turrForeL, turrFore,  alpha*0.7);
  line(turrForeR, turrFore,  alpha*0.7);
  line(turrFore,  gunFore,   alpha*0.85);
  line(turrAftL,  turrAftR,  alpha*0.7);
  line(turrAftL,  turrAft,   alpha*0.7);
  line(turrAftR,  turrAft,   alpha*0.7);
  line(turrAft,   gunAft,    alpha*0.85);

  // Ship label at mast top
  if (mastTop && ship.label) {
    ctx.font = '10px Share Tech Mono';
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${(alpha*0.9).toFixed(3)})`;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 4;
    ctx.fillText(ship.label, mastTop.sx, mastTop.sy - 5);
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ── BATTLESHIP SIDE-PROFILE RENDERER ──
// Iowa/Yamato-class silhouette: bow right (+X), superstructure above (local -Y = screen up).
function _drawShipProfile(c, ship, cx, cy, halfLen, sc, screenAngle, tilt, alpha) {
  if (halfLen < 6) return;
  var hl = halfLen;
  // Proportions
  var fb = hl * 0.13;   // freeboard (hull above waterline)
  var dr = hl * 0.07;   // draft (keel below waterline)
  var dk = -fb;         // top of main deck (local Y, negative = above waterline)

  // Normalize: superstructure must face screen-up
  if (Math.cos(screenAngle) < 0) screenAngle += Math.PI;

  c.save();
  c.translate(cx, cy);
  c.rotate(screenAngle);
  c.rotate(tilt);
  c.globalAlpha = alpha;

  var col   = '#00ccff';
  var dark  = 'rgba(0,8,22,0.98)';
  var mid   = 'rgba(0,18,38,0.97)';

  // ── HULL ──
  c.strokeStyle = col; c.fillStyle = dark; c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-hl,        dr * 0.4);      // stern bottom
  c.lineTo(-hl,       -fb * 0.85);     // stern transom
  c.lineTo(-hl * 0.92, dk);            // stern deck edge
  c.lineTo( hl * 0.60, dk);            // main deck (long flat run)
  c.lineTo( hl * 0.78, dk + fb*0.28);  // bow sheer step up
  c.lineTo( hl * 0.92, dk + fb*0.55);  // bow flare
  c.lineTo( hl,        0);             // clipper bow at waterline
  c.lineTo( hl * 0.94, dr);            // bow keel
  c.lineTo(-hl * 0.97, dr);            // keel run
  c.closePath();
  c.fill(); c.stroke();

  // ── BELT ARMOUR LINE (red stripe at waterline) ──
  c.strokeStyle = 'rgba(180,30,30,0.55)'; c.lineWidth = fb * 0.18;
  c.beginPath(); c.moveTo(-hl*0.96, -fb*0.22); c.lineTo(hl*0.88, -fb*0.22); c.stroke();
  c.strokeStyle = col;

  // ── TURRET helper: draws a triple-gun turret ──
  // tx = centre X on deck, facing = +1 (guns point bow) or -1 (guns point stern)
  function turret(tx, facing) {
    var tw = hl * 0.11, th = fb * 1.0;
    var tyBot = dk, tyTop = dk - th;
    // Base box
    c.fillStyle = mid; c.strokeStyle = col; c.lineWidth = 1;
    c.beginPath(); c.rect(tx - tw * 0.5, tyTop, tw, th); c.fill(); c.stroke();
    // Rounded mantlet (front face)
    c.beginPath(); c.arc(tx + facing * tw * 0.35, tyTop + th * 0.45, tw * 0.32, 0, Math.PI * 2); c.fill(); c.stroke();
    // Three gun barrels
    var barLen = hl * 0.28, barY0 = tyTop + th * 0.28, barSp = th * 0.18;
    c.lineWidth = 1.4;
    for (var gi = -1; gi <= 1; gi++) {
      c.beginPath();
      c.moveTo(tx + facing * tw * 0.5, barY0 + gi * barSp);
      c.lineTo(tx + facing * (tw * 0.5 + barLen), barY0 + gi * barSp);
      c.stroke();
    }
  }

  // Fore turret A (foremost, lower)
  turret(hl * 0.48, 1);
  // Fore turret B (superfiring, higher — raised platform)
  var sfH = fb * 0.55;
  c.fillStyle = mid; c.strokeStyle = col; c.lineWidth = 0.8;
  c.beginPath(); c.rect(hl*0.25 - hl*0.07, dk - sfH, hl*0.14, sfH); c.fill(); c.stroke();
  turret(hl * 0.25, 1); // drawn on top of platform (shares dk line — platform lifts it)
  // Aft turret (facing stern)
  turret(-hl * 0.52, -1);

  // ── MAIN CITADEL / SUPERSTRUCTURE ──
  // Step 1: wide lower belt
  var s1X = hl*0.05, s1W = hl*0.38, s1H = fb*1.6;
  c.fillStyle = mid; c.strokeStyle = col; c.lineWidth = 1.1;
  c.beginPath(); c.rect(s1X - s1W*0.5, dk - s1H, s1W, s1H); c.fill(); c.stroke();

  // Step 2: narrower mid level
  var s2W = s1W*0.72, s2H = fb*1.3;
  c.beginPath(); c.rect(s1X - s2W*0.5, dk - s1H - s2H, s2W, s2H); c.fill(); c.stroke();

  // Step 3: bridge tower (pagoda style — narrows at top)
  var s3W = s2W*0.55, s3H = fb*1.4;
  c.beginPath(); c.rect(s1X - s3W*0.5, dk - s1H - s2H - s3H, s3W, s3H); c.fill(); c.stroke();

  // Step 4: top rangefinder platform
  var s4W = s3W*0.75, s4H = fb*0.6;
  c.lineWidth = 0.8;
  c.beginPath(); c.rect(s1X - s4W*0.5, dk - s1H - s2H - s3H - s4H, s4W, s4H); c.fill(); c.stroke();

  // Bridge windows (row of lit slits)
  var winY = dk - s1H - s2H - s3H * 0.55;
  c.fillStyle = 'rgba(0,220,255,0.6)'; c.shadowBlur = 4; c.shadowColor = '#00aaff';
  for (var wi = 0; wi < 5; wi++) {
    c.fillRect(s1X - s3W*0.34 + wi * s3W*0.17, winY, s3W*0.1, fb*0.28);
  }
  c.shadowBlur = 0;
  c.strokeStyle = col; c.fillStyle = mid;

  // ── AFT SUPERSTRUCTURE ──
  var aX = -hl*0.22, aW = hl*0.16, aH = fb*1.2;
  c.lineWidth = 1;
  c.beginPath(); c.rect(aX - aW*0.5, dk - aH, aW, aH); c.fill(); c.stroke();
  var a2W = aW*0.65, a2H = fb*0.8;
  c.beginPath(); c.rect(aX - a2W*0.5, dk - aH - a2H, a2W, a2H); c.fill(); c.stroke();

  // ── FUNNELS (two, raked aft) ──
  var fnH = fb * 1.9, fnW = hl * 0.05, fnRake = hl * 0.04;
  var fn1X = hl * 0.02, fn2X = -hl * 0.07;
  c.lineWidth = 1;
  for (var fi = 0; fi < 2; fi++) {
    var fnX2 = fi === 0 ? fn1X : fn2X;
    c.beginPath();
    c.moveTo(fnX2 - fnW, dk - s1H);
    c.lineTo(fnX2 - fnW - fnRake, dk - s1H - fnH);
    c.lineTo(fnX2 + fnW - fnRake, dk - s1H - fnH);
    c.lineTo(fnX2 + fnW, dk - s1H);
    c.closePath(); c.fill(); c.stroke();
    // Cap
    c.beginPath(); c.rect(fnX2 - fnW*1.6 - fnRake, dk - s1H - fnH - 1.5, fnW*3.2, 2); c.fill(); c.stroke();
    // Smoke puff
    c.fillStyle = 'rgba(40,60,80,0.35)';
    c.beginPath(); c.arc(fnX2 - fnRake*2, dk - s1H - fnH - 5, fb*0.7, 0, Math.PI*2); c.fill();
    c.fillStyle = mid;
  }

  // ── FORE MAST (tripod legs + top platform) ──
  var mfX  = s1X + s3W*0.3;
  var mfBot = dk - s1H - s2H - s3H - s4H;
  var mfTop = mfBot - fb * 4.5;
  c.strokeStyle = col; c.lineWidth = 1; c.shadowBlur = 4; c.shadowColor = col;
  // Tripod
  c.beginPath(); c.moveTo(mfX, mfBot); c.lineTo(mfX, mfTop); c.stroke();
  c.lineWidth = 0.6;
  c.beginPath(); c.moveTo(mfX - fb*1.2, mfBot); c.lineTo(mfX, mfTop + fb); c.stroke();
  c.beginPath(); c.moveTo(mfX + fb*0.7, mfBot); c.lineTo(mfX, mfTop + fb); c.stroke();
  // Yardarms
  c.beginPath(); c.moveTo(mfX - fb*1.8, mfTop + fb*0.9); c.lineTo(mfX + fb*1.2, mfTop + fb*0.9); c.stroke();
  c.beginPath(); c.moveTo(mfX - fb*1.1, mfTop + fb*2.1); c.lineTo(mfX + fb*0.7, mfTop + fb*2.1); c.stroke();
  // Crow's nest box
  c.fillStyle = mid; c.lineWidth = 0.8;
  c.beginPath(); c.rect(mfX - fb*0.55, mfTop, fb*1.1, fb*0.8); c.fill(); c.stroke();

  // ── AFT MAST ──
  var maX  = aX + a2W*0.2;
  var maBot = dk - aH - a2H;
  var maTop = maBot - fb * 3.2;
  c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(maX, maBot); c.lineTo(maX, maTop); c.stroke();
  c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(maX - fb*1.0, maTop + fb*0.7); c.lineTo(maX + fb*0.7, maTop + fb*0.7); c.stroke();
  c.shadowBlur = 0;

  // ── WATERLINE ──
  c.strokeStyle = `rgba(0,200,255,0.22)`; c.lineWidth = 0.5;
  c.setLineDash([5, 4]);
  c.beginPath(); c.moveTo(-hl*0.96, 0); c.lineTo(hl*0.92, 0); c.stroke();
  c.setLineDash([]);

  // ── LABEL ──
  c.rotate(-screenAngle - tilt);
  c.font = Math.round(Math.max(6, Math.min(10, hl * 0.11))) + 'px Share Tech Mono';
  c.fillStyle = `rgba(0,200,255,${alpha * 0.85})`; c.textAlign = 'center';
  c.fillText(ship.label, 0, mfTop - 5);

  c.restore();
}

// ── SURFACE SHIPS ──
function initShips() {
  state.ships = [
    {
      label: 'DESTROYER 01', type: 'destroyer',
      x: 20, z: 30,  // position in grid
      heading: 0.3,  // world heading (radians)
      speed: 0.018,
      length: 7, beam: 1.5,
      alive: true, sinking: false, sinkY: GRID.H,
      sinkVel: 0, tilt: 0,
      col: '#00ccff',
      hits: 0, onFire: false, fireTimer: 0
    },
    {
      label: 'FRIGATE 02', type: 'frigate',
      x: 45, z: 20,
      heading: 2.1,
      speed: 0.025,
      length: 5, beam: 1.2,
      alive: true, sinking: false, sinkY: GRID.H,
      sinkVel: 0, tilt: 0,
      col: '#00aaee',
      hits: 0, onFire: false, fireTimer: 0
    },
    {
      label: 'PATROL 03', type: 'patrol',
      x: 10, z: 30,
      heading: 1.2,
      speed: 0.035,
      length: 4, beam: 1.0,
      alive: true, sinking: false, sinkY: GRID.H,
      sinkVel: 0, tilt: 0,
      col: '#0088cc',
      hits: 0, onFire: false, fireTimer: 0
    },
  ];
}

// ── DEPTH CHARGES ──
function drawDepthCharges() {
  if (!state.depthCharges || !state.depthCharges.length) return;
  state.depthCharges.forEach(function(dc) {
    if (dc.exploded) return;

    // ── TRAIL (dot trace as barrel descends) ──
    if (dc.trail) {
      dc.trail.forEach(function(pt, i) {
        var pp = projectPeriscope(pt.x, pt.y, pt.z);
        if (!pp || pp.depth > 60) return;
        var a = (i / dc.trail.length) * 0.55;
        var r = Math.max(0.8, 2.5 - pp.depth * 0.04);
        ctx.beginPath();
        ctx.arc(pp.sx, pp.sy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,160,40,' + a + ')';
        ctx.fill();
      });
    }

    // ── BARREL ──
    var p = projectPeriscope(dc.x, dc.y, dc.z);
    if (!p || p.depth > 60 || p.depth < 0.1) return;

    var sc2 = Math.max(0.4, Math.min(2.5, 7 / p.depth));
    var bw = 6 * sc2;   // barrel width
    var bh = 9 * sc2;   // barrel height
    var bx = p.sx, by = p.sy;

    ctx.save();
    ctx.translate(bx, by);

    // Body — dark olive/brown
    ctx.fillStyle = 'rgba(60,45,20,0.95)';
    ctx.strokeStyle = '#cc8800';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.roundRect(-bw * 0.5, -bh * 0.5, bw, bh, bw * 0.28);
    ctx.fill();
    ctx.stroke();

    // Metal bands (3 straps)
    ctx.strokeStyle = 'rgba(220,150,30,0.85)';
    ctx.lineWidth = Math.max(0.5, 0.9 * sc2);
    [-bh * 0.3, 0, bh * 0.3].forEach(function(sy2) {
      ctx.beginPath();
      ctx.moveTo(-bw * 0.5, sy2);
      ctx.lineTo( bw * 0.5, sy2);
      ctx.stroke();
    });

    // Detonator cap (top)
    ctx.fillStyle = 'rgba(200,60,20,0.95)';
    ctx.strokeStyle = '#ff4400';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(0, -bh * 0.5, bw * 0.3, bh * 0.12, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    // Glow when close to player depth
    var depthDiff = Math.abs(dc.y - state.player.y);
    if (depthDiff < 3) {
      var g = 1 - depthDiff / 3;
      ctx.shadowBlur = 12 * g;
      ctx.shadowColor = '#ff4400';
      ctx.strokeStyle = 'rgba(255,80,0,' + (g * 0.7) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-bw * 0.5, -bh * 0.5, bw, bh, bw * 0.28);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  });
}

function playDepthCharge(dist) {
  var vol = Math.max(0.08, Math.min(1.0, 1.0 - (dist || 0) / 18));
  var a = new Audio('/Sounds/Depth_Charge_Distant.mp3');
  a.volume = vol;
  a.play().catch(function(){});
}

function updateDepthCharges() {
  if (!state.depthCharges) state.depthCharges = [];

  // Ships drop depth charges when player is within range and in Battle Stations
  if (state.battleStations) {
    state.ships.forEach(ship => {
      if (!ship.alive || ship.sinking) return;
      if (!ship.dcTimer) ship.dcTimer = Math.floor(Math.random() * 300);
      ship.dcTimer--;
      if (ship.dcTimer > 0) return;
      ship.dcTimer = 240 + Math.floor(Math.random() * 180); // 4-7s cooldown

      // Need detection to know where to drop; drop range tightens with confidence
      const det = ship.detection || 0;
      if (det < 0.05) return; // blind — no contact, no drops

      // Drop radius from ship shrinks as detection confidence rises (6→0.8 world units)
      const dcScatter = Math.max(0.8, 6 * (1 - det * 0.88));

      // Use last-known hunt position as the drop aim point when confident
      const aimX = det > 0.5 ? ship.huntX : ship.x;
      const aimZ = det > 0.5 ? ship.huntZ : ship.z;

      // Only drop when ship is actually over the target zone
      const dx = aimX - ship.x;
      const dz = aimZ - ship.z;
      const dist2d = Math.sqrt(dx*dx + dz*dz);
      if (dist2d > 8 + det * 10) return; // low detection = must be almost on top

      // Drop depth charge — falls from surface down
      state.depthCharges.push({
        x: aimX + (Math.random()-0.5) * dcScatter * 2,
        y: GRID.H,
        z: aimZ + (Math.random()-0.5) * dcScatter * 2,
        vy: 0,
        armed: false,
        exploded: false,
        label: ship.label,
        trail: []
      });
      const detWord = det > 0.75 ? 'LOCKED ON' : det > 0.4 ? 'TRACKING' : 'SEARCHING';
      addEvent(`⚠ DEPTH CHARGES! — ${ship.label} (${detWord})`, true);
      setTimeout(()=>addEvent('⚠ BRACE FOR IMPACT', true), 800);
    });
  }

  // Update depth charges
  state.depthCharges = state.depthCharges.filter(dc => {
    if (dc.exploded) return false;

    // Fall toward seabed (slow, weighted-barrel descent ~6-8 seconds)
    dc.vy = Math.min(0.035, dc.vy + 0.001);
    dc.y = Math.max(0, dc.y - dc.vy);
    if (!dc.armed && dc.y < GRID.H - 1) dc.armed = true;

    // Trail
    if (!dc.trail) dc.trail = [];
    dc.trail.push({ x: dc.x, y: dc.y, z: dc.z });
    if (dc.trail.length > 50) dc.trail.shift();

    // Explode at player depth or seabed
    const dy = Math.abs(dc.y - state.player.y);
    const dx = Math.abs(dc.x - state.player.x);
    const dz = Math.abs(dc.z - state.player.z);

    if (dc.armed && (dc.y <= 0.5 || (dx < 3 && dy < 2 && dz < 3))) {
      dc.exploded = true;
      const dist3 = Math.sqrt(dx*dx+dy*dy+dz*dz);
      playDepthCharge(dist3);
      spawnExplosion(dc.x, dc.y, dc.z, false);
      if (dist3 < 4) {
        const dmg = dist3 < 1 ? 20 : dist3 < 2 ? 10 : 5;
        applyHullDamage(dmg, dmg >= 20 ? '⚠ DEPTH CHARGE — DIRECT' : dmg >= 10 ? '⚠ DEPTH CHARGE — CLOSE' : '▸ DEPTH CHARGE — NEAR MISS');
      } else if (dist3 < 8) {
        addEvent('▸ DEPTH CHARGE — CLOSE MISS', false);
      }
      return false;
    }
    return dc.y > 0;
  });
}

function spawnShip(ship) {
  ship.x = 5 + Math.random() * (GRID.W - 10);
  ship.z = 5 + Math.random() * (GRID.D - 10);
  ship.heading = Math.random() * Math.PI * 2;
  ship.alive = true;
  ship.sinking = false;
  ship.sinkY = GRID.H;
  ship.sinkVel = 0;
  ship.tilt = 0;
  ship.hits = 0;
  ship.onFire = false;
  ship.fireTimer = 0;
  ship.sonarTimer = undefined;
  ship.detection = 0;
  ship.huntX = ship.x;
  ship.huntZ = ship.z;
  addEvent(`▸ NEW CONTACT — ${ship.label} DETECTED`, true);
}

function updateShips() {
  state.ships.forEach(ship => {
    if (ship.sinking) {
      // Sink with accelerating velocity and dramatic list
      ship.sinkVel += 0.0006;
      ship.sinkY = Math.max(0, ship.sinkY - ship.sinkVel);
      ship.tilt = Math.min(Math.PI * 0.42, ship.tilt + 0.004 + ship.sinkVel * 0.05);
      // Bubbles and debris at the surface above the sinking ship
      if (Math.random() < 0.015 && ship.sinkY > 0.5) {
        spawnExplosion(
          ship.x + (Math.random()-0.5)*ship.length*0.5,
          GRID.H,
          ship.z + (Math.random()-0.5)*ship.length*0.5,
          false
        );
      }
      if (ship.sinkY <= 0) {
        ship.sinking = false;
        ship.alive = false;
        addEvent(`▸ ${ship.label} LOST — RESTING ON SEABED`, false);
        setTimeout(() => spawnShip(ship), 20000); // respawn after 20s
      }
      return;
    }
    if (!ship.alive) return;

    // Move forward
    ship.x += Math.sin(ship.heading) * ship.speed;
    ship.z += Math.cos(ship.heading) * ship.speed;

    // Bounce off grid boundaries — negate the velocity component that caused the penetration.
    // X wall: negate X component (sin) → heading = -heading
    // Z wall: negate Z component (cos) → heading = π - heading
    const margin = ship.length / 2;
    if (ship.x < margin || ship.x > GRID.W - margin) {
      ship.heading = -ship.heading;
      ship.x = Math.max(margin, Math.min(GRID.W - margin, ship.x));
    }
    if (ship.z < margin || ship.z > GRID.D - margin) {
      ship.heading = Math.PI - ship.heading;
      ship.z = Math.max(margin, Math.min(GRID.D - margin, ship.z));
    }

    // ── SHIP SONAR — detection, homing, ping sound ──
    if (ship.sonarTimer === undefined) {
      ship.sonarTimer = Math.floor(Math.random() * 200);
      ship.detection  = 0;
      ship.huntX = ship.x;
      ship.huntZ = ship.z;
    }

    // Detection confidence decays over time; silent running makes ships lose contact faster
    const _decayRate = state.silentRunning ? 0.0018 : 0.0007;
    ship.detection = Math.max(0, ship.detection - _decayRate);

    ship.sonarTimer--;
    if (ship.sonarTimer <= 0) {
      // Next ping interval: 240 frames (~4s) at 0 detection → 45 frames (~0.75s) at full lock
      ship.sonarTimer = Math.round(240 - ship.detection * 195) + Math.floor(Math.random() * 40);

      const _psdx = state.player.x - ship.x;
      const _psdz = state.player.z - ship.z;
      const _psdist = Math.sqrt(_psdx*_psdx + _psdz*_psdz);

      // Detection range: red alert expands it, silent running collapses it
      const _baseRange = state.battleStations ? 28 : 20;
      const _effRange  = state.silentRunning ? 6 : _baseRange;
      // Silent running — still detectable via enemy-knows flag (player fired/was pinged)
      const _noiseHit  = state.silentRunning && state.enemyKnowsPlayer && _psdist < _baseRange;

      if (_psdist < _effRange || _noiseHit) {
        // Contact! Update detection confidence and last-known position
        const _gain = state.battleStations ? 0.28 : 0.16;
        ship.detection = Math.min(1, ship.detection + _gain);
        ship.huntX = state.player.x;
        ship.huntZ = state.player.z;
      }

      // Ping sound — only when ship is right overhead and actively hunting
      if (state.battleStations && ship.detection > 0.3 && _psdist < 8) {
        const _pingVol = (0.2 + ship.detection * 0.8) * Math.max(0.2, 1 - _psdist / 10);
        playShipSonar(_pingVol);
      }
    }

    // Steer toward last-known position when we have a contact
    if (ship.detection > 0.15) {
      const _hx = ship.huntX - ship.x;
      const _hz = ship.huntZ - ship.z;
      const _hdist = Math.sqrt(_hx*_hx + _hz*_hz);
      if (_hdist > 1.5) {
        const _tgt = Math.atan2(_hx, _hz);
        let _da = _tgt - ship.heading;
        while (_da >  Math.PI) _da -= Math.PI * 2;
        while (_da < -Math.PI) _da += Math.PI * 2;
        // Turn rate scales with confidence — faint contact = slow wander, lock = hard turn
        ship.heading += _da * 0.04 * ship.detection;
      }
    }

    // Fire puffs on damaged ships
    if (ship.onFire) {
      ship.fireTimer = (ship.fireTimer || 0) + 1;
      if (ship.fireTimer % 75 === 0) spawnFirePuff(ship.x, GRID.H, ship.z);
    }

    // ── SHELL FIRE — attack surfaced player ──
    const _surfExposed = state.viewMode === 'surfaced' ||
      (state.viewMode === 'surface' && !state.silentRunning);
    if (_surfExposed) {
      if (ship.shellTimer === undefined) {
        // Stagger first shot per ship so they don't all fire at once
        ship.shellTimer = 60 + Math.floor(Math.random() * 120);
        ship.warningShotFired = false;
      }
      ship.shellTimer--;
      if (ship.shellTimer <= 0) {
        ship.shellTimer = 240 + Math.floor(Math.random() * 240); // 4-8s between shots
        const _sdx = state.player.x - ship.x;
        const _sdz = state.player.z - ship.z;
        const _sdist = Math.sqrt(_sdx*_sdx + _sdz*_sdz);
        if (_sdist < 40) { // only fire if in range
          let _stx, _stz;
          const _isWarn = !ship.warningShotFired;
          if (_isWarn) {
            // Warning shot — deliberately misses, splashes nearby
            const _missAng = Math.atan2(_sdx, _sdz) + (Math.random() - 0.5) * 1.0;
            const _missOff = 3.5 + Math.random() * 3;
            _stx = state.player.x + Math.sin(_missAng) * _missOff;
            _stz = state.player.z + Math.cos(_missAng) * _missOff;
            ship.warningShotFired = true;
            addEvent(`⚠ WARNING SHOT — ${ship.label} IS FIRING`, true);
          } else {
            // Aimed shot — targets player's current position
            _stx = state.player.x + (Math.random() - 0.5) * 0.8;
            _stz = state.player.z + (Math.random() - 0.5) * 0.8;
            addEvent(`⚠ SHELLS INCOMING — ${ship.label}`, true);
          }
          state.shells.push({
            ox: ship.x, oz: ship.z,
            tx: _stx, tz: _stz,
            t: 0,
            duration: 80 + Math.random() * 30,
            arcHeight: 1.2 + Math.random() * 0.8,
            isWarning: _isWarn,
            shipLabel: ship.label
          });
        }
      }
    } else {
      ship.shellTimer = undefined;
      ship.warningShotFired = false;
    }

    // Check torpedo hits
    state.torpedoes.forEach(t => {
      if (!ship.alive || ship.sinking) return;
      const travelDist = Math.sqrt((t.x-t.ox)*(t.x-t.ox)+(t.y-t.oy)*(t.y-t.oy)+(t.z-t.oz)*(t.z-t.oz));
      if (travelDist < 3) return; // arming distance
      // Must be a player torpedo near the surface to hit a ship (mines handled separately)
      const dx = t.x - ship.x, dz = t.z - ship.z;
      const dist2d = Math.sqrt(dx*dx + dz*dz);
      if (!t.isMine && !t.isEnemy && t.y >= GRID.H - 1.5 && dist2d < ship.length/2 + 1.5) {
        const maxHits = ship.type === 'destroyer' ? 3 : 2;
        const killBonus = ship.type === 'destroyer' ? 30 : 20;
        ship.hits++;
        addScore(10);
        if (ship.hits >= maxHits) {
          // ── KILL ──
          addScore(killBonus);
          ship.sinking = true;
          ship.sinkY = GRID.H;
          ship.sinkVel = 0;
          ship.tilt = 0;
          ship.onFire = false;
          playExplosionShip();
          spawnExplosion(ship.x,                                    GRID.H, ship.z,                                    true);
          spawnExplosion(ship.x + (Math.random()-0.5)*ship.length,  GRID.H, ship.z + (Math.random()-0.5)*ship.length,  true);
          setTimeout(() => {
            spawnExplosion(ship.x + (Math.random()-0.5)*3, GRID.H, ship.z + (Math.random()-0.5)*3, true);
            spawnExplosion(ship.x + (Math.random()-0.5)*4, GRID.H, ship.z + (Math.random()-0.5)*4, true);
            playExplosionShip();
          }, 300);
          setTimeout(() => {
            spawnExplosion(ship.x + (Math.random()-0.5)*2, GRID.H, ship.z + (Math.random()-0.5)*2, true);
            spawnExplosion(ship.x + (Math.random()-0.5)*5, GRID.H, ship.z + (Math.random()-0.5)*5, false);
          }, 750);
          setTimeout(() => {
            spawnExplosion(ship.x + (Math.random()-0.5)*3, GRID.H, ship.z + (Math.random()-0.5)*3, false);
          }, 1300);
          addEvent(`⊛ ${ship.label} DESTROYED (+${killBonus})`, false);
          setTimeout(() => addEvent(`▸ ${ship.label} IS GOING DOWN`, false), 2000);
        } else {
          // ── HIT — catches fire ──
          ship.onFire = true;
          spawnFirePuff(ship.x, GRID.H, ship.z);
          playExplosion(true);
          addEvent(`⊛ ${ship.label} HIT ${ship.hits}/${maxHits} — ON FIRE (+10)`, false);
        }
        t.progress = 999; // remove torpedo
      }
    });
  });
}

// ── NOISEMAKER / COUNTERMEASURE UPDATE ──
function updateNoisemakers() {
  if (!state.noisemakers || !state.noisemakers.length) return;
  state.noisemakers = state.noisemakers.filter(function(nm) {
    nm.age++;
    nm.vy = Math.min(0.035, nm.vy + 0.0008);
    nm.y = Math.max(0, nm.y - nm.vy);
    return nm.age < 540; // 9 second lifetime
  });
}

function launchCountermeasures() {
  if (!state.countermeasures || state.countermeasures <= 0) {
    addEvent('⚠ NO COUNTERMEASURES REMAINING', true); return;
  }
  state.countermeasures--;
  const _cmBtn = document.getElementById('peri-btn-cm');
  if (_cmBtn) _cmBtn.textContent = state.countermeasures > 0 ? `◈ CM ${state.countermeasures}` : '◈ CM —';
  // Launch two noisemakers aft of the sub
  const _bh = state.periAngleH + Math.PI;
  for (var _ci = 0; _ci < 2; _ci++) {
    const _off = (_ci - 0.5) * 0.6;
    state.noisemakers.push({
      x: state.player.x + Math.sin(_bh + _off) * 1.8,
      y: state.player.y,
      z: state.player.z + Math.cos(_bh + _off) * 1.8,
      vy: 0, age: 0
    });
  }
  playTorpedoLaunch();
  addEvent('◈ COUNTERMEASURES DEPLOYED — NOISEMAKERS AWAY', false);
  if (state.countermeasures === 0) addEvent('⚠ ALL COUNTERMEASURES EXPENDED', true);
}

// ── SHELL UPDATE — arcing naval gun fire at surfaced player ──
function updateShells() {
  if (!state.shells || !state.shells.length) return;
  state.shells = state.shells.filter(shell => {
    shell.t += 1 / shell.duration;
    if (shell.t >= 1) {
      // Shell lands at target
      const _hdx = shell.tx - state.player.x;
      const _hdz = shell.tz - state.player.z;
      const _hdist = Math.sqrt(_hdx*_hdx + _hdz*_hdz);
      const _atSurface = state.viewMode === 'surfaced' || state.viewMode === 'surface';
      spawnExplosion(shell.tx, GRID.H, shell.tz, true);
      if (!shell.isWarning && _hdist < 2.0 && _atSurface) {
        // Direct hit
        playExplosion01();
        applyHullDamage(25, '⚠ SHELL IMPACT — DIRECT HIT');
        addEvent('⊛ DIRECT HIT — HULL BREACHED', true);
      } else if (!shell.isWarning && _hdist < 5) {
        playWaterSurfaceExplosion();
        addEvent('▸ NEAR MISS — SHELL IN THE WATER', false);
      } else {
        playWaterSurfaceExplosion();
      }
      return false;
    }
    return true;
  });
}

// Draw a ship as a point cloud at given y level, with tilt
function drawShipPoints(ctx2d, ship, yLevel, projectFn) {
  if (!ship.alive && !ship.sinking) return;

  // Project ship centre
  const sp = projectFn(ship.x, yLevel, ship.z);
  if (!sp) return;

  const alpha = ship.sinking ? Math.max(0.1, ship.sinkY / GRID.H) : 1.0;
  const col = ship.col;
  const colFill = col.replace(')', `,0.15)`).replace('rgb(', 'rgba(').replace('#00ccff','rgba(0,204,255,0.15)').replace('#00aaee','rgba(0,170,238,0.15)').replace('#0088cc','rgba(0,136,204,0.15)');

  // Scale: project a point ship.length/2 ahead to get screen size
  const spFwd = projectFn(
    ship.x + Math.sin(ship.heading) * ship.length/2,
    yLevel,
    ship.z + Math.cos(ship.heading) * ship.length/2
  );
  if (!spFwd) return;

  // Screen-space ship vector
  const sdx = spFwd.sx - sp.sx;
  const sdy = spFwd.sy - sp.sy;
  const screenLen = Math.sqrt(sdx*sdx + sdy*sdy);
  if (screenLen < 2) return;

  // Screen heading angle
  const screenAngle = Math.atan2(sdy, sdx);
  const scale = screenLen / (ship.length / 2);
  const beamScale = scale * ship.beam * 0.5;

  ctx2d.save();
  ctx2d.translate(sp.sx, sp.sy);
  ctx2d.rotate(screenAngle + Math.PI / 2); // rotate so bow points in heading direction
  ctx2d.globalAlpha = alpha;

  // Tilt for sinking
  if (ship.sinking) ctx2d.rotate(ship.tilt * 0.5);

  ctx2d.shadowBlur = 10;
  ctx2d.shadowColor = col;
  ctx2d.strokeStyle = col;
  ctx2d.lineWidth = 1.5;

  // ── HULL — proper ship shape (top-down view) ──
  const hw = beamScale;
  const hl = screenLen;
  ctx2d.beginPath();
  ctx2d.moveTo(hl, 0);                                        // bow tip
  ctx2d.bezierCurveTo(hl*0.7, -hw*0.9, hl*0.1, -hw*1.1, -hl*0.3, -hw);
  ctx2d.lineTo(-hl*0.85, -hw*0.6);
  ctx2d.lineTo(-hl,      -hw*0.35);
  ctx2d.lineTo(-hl,       hw*0.35);
  ctx2d.lineTo(-hl*0.85,  hw*0.6);
  ctx2d.lineTo(-hl*0.3,   hw);
  ctx2d.bezierCurveTo(hl*0.1, hw*1.1, hl*0.7, hw*0.9, hl, 0);
  ctx2d.closePath();
  ctx2d.fillStyle = colFill;
  ctx2d.fill();
  ctx2d.stroke();

  // ── SUPERSTRUCTURE (raised deck, aft of center) ──
  const ssL = hl * 0.65, ssW = hw * 0.52, ssX = -hl * 0.12;
  ctx2d.lineWidth = 1;
  ctx2d.beginPath();
  ctx2d.rect(ssX - ssL*0.5, -ssW*0.5, ssL, ssW);
  ctx2d.fillStyle = colFill;
  ctx2d.fill(); ctx2d.stroke();

  // ── FUNNEL (dark oval, aft of bridge) ──
  ctx2d.beginPath();
  ctx2d.ellipse(ssX - ssL*0.15, 0, ssL*0.09, ssW*0.28, 0, 0, Math.PI*2);
  ctx2d.fillStyle = 'rgba(0,0,10,0.85)';
  ctx2d.fill(); ctx2d.stroke();

  // ── BOW MAST — gold dot ──
  ctx2d.beginPath();
  ctx2d.arc(hl * 0.5, 0, 2.5, 0, Math.PI * 2);
  ctx2d.fillStyle = `rgba(255,220,80,${alpha})`;
  ctx2d.shadowColor = '#ffdd00'; ctx2d.shadowBlur = 6;
  ctx2d.fill();

  // ── LABEL ──
  ctx2d.shadowBlur = 0;
  ctx2d.rotate(-(screenAngle + Math.PI / 2));
  ctx2d.font = `${Math.max(7, Math.min(11, screenLen * 0.25))}px Share Tech Mono`;
  ctx2d.fillStyle = `rgba(0,200,255,${alpha * 0.8})`;
  ctx2d.textAlign = 'center';
  ctx2d.fillText(ship.label, 0, -hw * 1.6 - 4);

  ctx2d.globalAlpha = 1;
  ctx2d.shadowBlur = 0;
  ctx2d.restore();
}

// ── SURFACE PERISCOPE VIEW ──

function renderSurfacePeriscope() {
  const pcx = W/2, pcy = H * 0.44;
  const horizonY = pcy;
  const f = state.animFrame;
  const FOV = 0.8;
  const fovScale = (W * 0.5) / Math.tan(FOV);

  // ── PROJECT SURFACE ──
  function projectSurface(wx, wy, wz) {
    const rx = wx - state.player.x;
    const ry = wy - GRID.H;
    const rz = wz - state.player.z;
    const cosB = Math.cos(surfaceBearing), sinB = Math.sin(surfaceBearing);
    const fx = rx*cosB + rz*sinB;
    const fz = -rx*sinB + rz*cosB;
    if (fz <= 0.3) return null;
    const sx = pcx + (fx/fz)*fovScale;
    const sy = horizonY - (ry/fz)*fovScale*2;
    return {sx, sy, depth:fz};
  }

  // ── SKY ──
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0,   '#000205');
  sky.addColorStop(0.5, '#010810');
  sky.addColorStop(1,   '#041a28');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizonY);

  // ── STARS ──
  for (let i = 0; i < 80; i++) {
    const sx2 = (Math.sin(i*127.3)*0.5+0.5)*W;
    const sy2 = (Math.sin(i*93.7)*0.5+0.5)*horizonY*0.82;
    const tw = 0.2 + 0.7*Math.abs(Math.sin(f*0.03+i*2.1));
    ctx.beginPath(); ctx.arc(sx2, sy2, 0.5+Math.sin(i*17.3)*0.3, 0, Math.PI*2);
    ctx.fillStyle = `rgba(180,210,255,${tw*0.6})`; ctx.fill();
  }

  // ── POINT CLOUD CLOUDS ──
  // Generate once: billowing 3D cloud volumes with bright edges, dark interiors
  if (!renderSurfacePeriscope._clouds) {
    const pts = [];
    // Each cluster has a centre + radius. Points near the surface of the sphere
    // are bright (edge-lit), points deeper inside are darker
    const clusters = [
      // {ang, yFrac, n, spread, baseSize}
      {ang:0.0,  y:0.72, n:120, sp:0.28, sz:2.2},
      {ang:0.75, y:0.78, n:80,  sp:0.20, sz:1.8},
      {ang:1.55, y:0.68, n:140, sp:0.32, sz:2.5},
      {ang:2.4,  y:0.75, n:100, sp:0.24, sz:2.0},
      {ang:3.2,  y:0.70, n:130, sp:0.28, sz:2.3},
      {ang:4.05, y:0.80, n:70,  sp:0.18, sz:1.6},
      {ang:4.9,  y:0.65, n:150, sp:0.34, sz:2.6},
      {ang:5.75, y:0.74, n:90,  sp:0.22, sz:1.9},
    ];

    clusters.forEach((cl, ci) => {
      // Generate multiple sub-lobes per cloud (3-5 overlapping spheres)
      const lobes = 3 + (ci % 3);
      for (let li = 0; li < lobes; li++) {
        const lobeSeed = ci * 100 + li * 37;
        // Lobe centre offset from cluster centre
        const lOffAng = (Math.sin(lobeSeed * 0.3) * 0.5) * cl.sp * 0.6;
        const lOffY   = (Math.sin(lobeSeed * 0.7) * 0.3) * cl.sp * 0.4;
        const lRadius = cl.sp * (0.5 + Math.sin(lobeSeed * 0.5) * 0.2);

        for (let i = 0; i < Math.floor(cl.n / lobes); i++) {
          const seed = ci * 1000 + li * 200 + i;
          // Random point in a sphere using sin/cos seeds
          const r1 = Math.sin(seed * 127.3) * 0.5 + 0.5;
          const r2 = Math.sin(seed * 93.7)  * 0.5 + 0.5;
          const r3 = Math.sin(seed * 71.1)  * 0.5 + 0.5;
          const r4 = Math.sin(seed * 53.9)  * 0.5 + 0.5;

          // Spherical coordinates
          const theta = r1 * Math.PI * 2;
          const phi   = r2 * Math.PI;
          // Bias toward surface (shell) — use r4 to push points outward
          const rad = lRadius * (0.6 + r4 * 0.4);

          const dAng = Math.sin(theta) * Math.sin(phi) * rad;
          const dY   = Math.cos(phi) * rad * 0.5; // flatten vertically

          // Distance from lobe surface (0=interior, 1=edge)
          const surfaceness = rad / lRadius;

          // Edge-lit: bright at surface, dark inside
          // Bright teal-white at edge, near-black at centre
          const edgeBright = Math.pow(surfaceness, 2.5);
          const alpha = 0.05 + edgeBright * 0.55;
          // Colour: bright edge = teal-white, inner = dark blue-grey
          const rCol = Math.floor(edgeBright * 120 + 20);
          const gCol = Math.floor(edgeBright * 170 + 30);
          const bCol = Math.floor(edgeBright * 210 + 40);

          pts.push({
            baseAng: cl.ang + lOffAng + dAng,
            yFrac:   cl.y   + lOffY   + dY,
            alpha,
            r: cl.sz * (0.5 + r3 * 0.8) * (0.4 + edgeBright * 0.8),
            rCol, gCol, bCol,
            drift: (r1 - 0.5) * 0.6
          });
        }
      }
    });
    renderSurfacePeriscope._clouds = pts;
  }

  // Draw cloud points
  renderSurfacePeriscope._clouds.forEach(pt => {
    let relAng = pt.baseAng + surfaceBearing;
    while (relAng >  Math.PI) relAng -= Math.PI * 2;
    while (relAng < -Math.PI) relAng += Math.PI * 2;
    if (Math.abs(relAng) > 1.25) return;
    const depthFade = 1 - Math.abs(relAng) / 1.25;
    const sx3 = pcx + Math.tan(relAng) * fovScale * 0.85;
    const sy3 = pt.yFrac * horizonY + Math.sin(f * 0.004 + pt.drift * 5) * 1.5;
    if (sy3 < 0 || sy3 > horizonY + 20) return;
    ctx.beginPath();
    ctx.arc(sx3, sy3, pt.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${pt.rCol},${pt.gCol},${pt.bCol},${pt.alpha * depthFade})`;
    ctx.fill();
  });

  // ── HORIZON GLOW — warm light on the water line ──
  const hg = ctx.createLinearGradient(0, horizonY-20, 0, horizonY+15);
  hg.addColorStop(0,   'rgba(0,0,0,0)');
  hg.addColorStop(0.4, 'rgba(20,60,90,0.35)');
  hg.addColorStop(0.6, 'rgba(30,80,110,0.5)');
  hg.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = hg; ctx.fillRect(0, horizonY-20, W, 35);

  // ── OCEAN ──
  const water = ctx.createLinearGradient(0, horizonY, 0, H);
  water.addColorStop(0, '#020c14');
  water.addColorStop(0.4, '#010810');
  water.addColorStop(1, '#010508');
  ctx.fillStyle = water; ctx.fillRect(0, horizonY, W, H-horizonY);

  // Wave lines — perspective
  for (let row = 0; row < 22; row++) {
    const t2 = row/22;
    const waveY = horizonY + Math.pow(t2,1.7)*(H-horizonY)*0.92;
    const waveAlpha = 0.025 + t2*0.1;
    const waveAnim = f*0.007*(1-t2*0.6);
    const waveW = W*(0.25+t2*0.75);
    const waveX = (W-waveW)/2;
    ctx.beginPath();
    for (let x = 0; x <= waveW; x += 3) {
      const wy = waveY + Math.sin(x/waveW*Math.PI*5+waveAnim+row*0.7)*(0.5+t2*2.5);
      x===0 ? ctx.moveTo(waveX+x, wy) : ctx.lineTo(waveX+x, wy);
    }
    ctx.strokeStyle = `rgba(0,80,130,${waveAlpha})`; ctx.lineWidth=0.7+t2*1.2; ctx.stroke();
  }

  // Specular glints
  for (let i = 0; i < 20; i++) {
    const gx2 = (Math.sin(i*83.1+f*0.009)*0.5+0.5)*W;
    const gt = (Math.sin(i*47.3+f*0.007)*0.5+0.5);
    const gy2 = horizonY + Math.pow(gt,1.5)*(H-horizonY)*0.65;
    const ga = (0.03+Math.sin(f*0.07+i)*0.025)*(1-gt*0.5);
    ctx.beginPath(); ctx.ellipse(gx2, gy2, 6+gt*16, 0.8, 0, 0, Math.PI*2);
    ctx.fillStyle = `rgba(0,100,180,${ga})`; ctx.fill();
  }

  // ── SHIPS — 3D wireframe models ──
  state.ships.forEach(ship => {
    if (!ship.alive && !ship.sinking) return;
    const wy2 = ship.sinking ? ship.sinkY : GRID.H;
    const sp = projectSurface(ship.x, wy2, ship.z);
    if (!sp || sp.depth < 0.5 || sp.depth > 80) return;
    const sinkFrac = ship.sinking ? Math.max(0, ship.sinkY / GRID.H) : 1.0;
    const alpha = Math.min(1, (1 - sp.depth / 80) * 1.6) * sinkFrac;
    if (alpha < 0.02) return;
    drawShipWireframe3D(ship, alpha, projectSurface);
  });

  // ── SHELLS — arcing naval gun rounds ──
  if (state.shells && state.shells.length) {
    state.shells.forEach(shell => {
      const t = shell.t;
      // Current world position along the arc
      const cwx = shell.ox + (shell.tx - shell.ox) * t;
      const cwz = shell.oz + (shell.tz - shell.oz) * t;
      const cwy = GRID.H + Math.sin(t * Math.PI) * shell.arcHeight;
      const csp = projectSurface(cwx, cwy, cwz);
      if (!csp || csp.depth < 0.2 || csp.depth > 120) return;

      // Trail — 8 fading dots back along the arc
      for (let i = 1; i <= 8; i++) {
        const tt = Math.max(0, t - i * 0.035);
        const twx = shell.ox + (shell.tx - shell.ox) * tt;
        const twz = shell.oz + (shell.tz - shell.oz) * tt;
        const twy = GRID.H + Math.sin(tt * Math.PI) * shell.arcHeight;
        const tsp = projectSurface(twx, twy, twz);
        if (!tsp || tsp.depth < 0.2) continue;
        const fa = (1 - i / 9) * 0.55;
        const tr = Math.max(0.5, (3 - csp.depth * 0.03) * (1 - i / 9));
        ctx.beginPath();
        ctx.arc(tsp.sx, tsp.sy, tr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,160,30,${fa})`;
        ctx.fill();
      }

      // Shell head — bright glowing dot
      const sr = Math.max(1.5, 5 - csp.depth * 0.04);
      ctx.beginPath();
      ctx.arc(csp.sx, csp.sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,230,100,1)';
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#ffaa00';
      ctx.fill();
      ctx.shadowBlur = 0;

      // Short streak in direction of travel
      const t2 = Math.min(1, t + 0.025);
      const nwx = shell.ox + (shell.tx - shell.ox) * t2;
      const nwz = shell.oz + (shell.tz - shell.oz) * t2;
      const nwy = GRID.H + Math.sin(t2 * Math.PI) * shell.arcHeight;
      const nsp = projectSurface(nwx, nwy, nwz);
      if (nsp && nsp.depth > 0.2) {
        ctx.beginPath();
        ctx.moveTo(csp.sx, csp.sy);
        ctx.lineTo(nsp.sx, nsp.sy);
        ctx.strokeStyle = 'rgba(255,200,60,0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }

  // ── SURFACE EXPLOSIONS ──
  // Rings + flash projected via projectSurface
  drawExplosions(projectSurface);
  // Rising smoke column for surface-level hits (wy === GRID.H)
  state.explosions.forEach(ex => {
    if (ex.wy < GRID.H - 0.5) return; // only surface explosions
    const sp2 = projectSurface(ex.wx, GRID.H, ex.wz);
    if (!sp2 || sp2.depth < 0.5 || sp2.depth > 60) return;
    const t = ex.age / ex.duration;
    const distFade = Math.max(0, 1 - sp2.depth / 60);
    const colStr = ex.col === '#ff4444' ? '255,68,68' : '0,229,255';
    // Draw 5 billowing smoke puffs rising above the horizon
    for (let i = 0; i < 5; i++) {
      const pufft = (t + i * 0.18) % 1;
      const rise = pufft * 80 * (1 - sp2.depth / 60 * 0.5);
      const spread = i * 5 * distFade;
      const r = (8 + i * 6) * distFade * (1 - pufft * 0.4);
      const a = (1 - pufft) * (1 - t * 0.6) * distFade * 0.7;
      if (a < 0.01 || r < 1) continue;
      ctx.beginPath();
      ctx.arc(sp2.sx + spread, sp2.sy - rise, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${colStr},${a.toFixed(3)})`;
      ctx.shadowBlur = r * 0.8;
      ctx.shadowColor = ex.col;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  });

  // ── TORPEDO TRAIL — red dots from sub toward target, fading behind ──
  // Store persistent trail points
  // ── TRON GRID ──
  ctx.save();
  const cosB2=Math.cos(surfaceBearing), sinB2=Math.sin(surfaceBearing);
  const gridRange=40, gridStep=4;
  for (let gd=gridStep; gd<=gridRange; gd+=gridStep) {
    const f1x=-gridRange*cosB2+gd*sinB2, f1z=gridRange*sinB2+gd*cosB2;
    const f2x=gridRange*cosB2+gd*sinB2,  f2z=-gridRange*sinB2+gd*cosB2;
    if (f1z<0.3||f2z<0.3) continue;
    const a=Math.max(0,0.11-gd/gridRange*0.09);
    ctx.strokeStyle=`rgba(0,200,240,${a})`; ctx.lineWidth=0.5;
    ctx.beginPath();
    ctx.moveTo(pcx+(f1x/f1z)*fovScale, Math.min(H,horizonY+(1/f1z)*fovScale*0.28));
    ctx.lineTo(pcx+(f2x/f2z)*fovScale, Math.min(H,horizonY+(1/f2z)*fovScale*0.28));
    ctx.stroke();
  }
  for (let gl=-gridRange; gl<=gridRange; gl+=gridStep) {
    const f1x2=gl*cosB2+0.5*sinB2, f1z2=-gl*sinB2+0.5*cosB2;
    const f2x2=gl*cosB2+gridRange*sinB2, f2z2=-gl*sinB2+gridRange*cosB2;
    if (f1z2<0.3||f2z2<0.3) continue;
    const a2=Math.max(0,0.09-Math.abs(gl)/gridRange*0.07);
    ctx.strokeStyle=`rgba(0,200,240,${a2})`; ctx.lineWidth=0.5;
    ctx.beginPath();
    ctx.moveTo(pcx+(f1x2/f1z2)*fovScale, Math.min(H,horizonY+(1/f1z2)*fovScale*0.28));
    ctx.lineTo(pcx+(f2x2/f2z2)*fovScale, Math.min(H,horizonY+(1/f2z2)*fovScale*0.28));
    ctx.stroke();
  }
  ctx.restore();

  // ── TORPEDO TRAIL ──
  if (!renderSurfacePeriscope._torpTrail) renderSurfacePeriscope._torpTrail = [];
  const trail = renderSurfacePeriscope._torpTrail;
  state.torpedoes.forEach(t => {
    if (t.y < GRID.H - 3.0) return;
    trail.push({x:t.x, z:t.z, age:0, isEnemy:t.isEnemy||false});
  });
  for (let i=trail.length-1; i>=0; i--) {
    trail[i].age++;
    if (trail[i].age > 80) trail.splice(i,1);
  }
  const cosB3=Math.cos(surfaceBearing), sinB3=Math.sin(surfaceBearing);
  trail.forEach(pt => {
    const rx=pt.x-state.player.x, rz=pt.z-state.player.z;
    const fx=rx*cosB3+rz*sinB3, fz=-rx*sinB3+rz*cosB3;
    if (fz<0.2) return;
    const sx=pcx+(fx/fz)*fovScale;
    const sy=horizonY+(1/fz)*fovScale*0.26;
    if (sx<-20||sx>W+20||sy>H) return;
    const fade=1-pt.age/80;
    const r=Math.max(1,(5-fz*0.05)*fade);
    ctx.beginPath(); ctx.arc(sx,sy,r,0,Math.PI*2);
    ctx.fillStyle=`rgba(255,${pt.isEnemy?40:60},0,${fade*0.9})`;
    ctx.shadowBlur=4; ctx.shadowColor='#ff2020'; ctx.fill(); ctx.shadowBlur=0;
  });
  state.torpedoes.forEach(t => {
    if (t.y < GRID.H - 3.0) return;
    const rx=t.x-state.player.x, rz=t.z-state.player.z;
    const fx=rx*cosB3+rz*sinB3, fz=-rx*sinB3+rz*cosB3;
    if (fz<0.2) return;
    const sx=pcx+(fx/fz)*fovScale, sy=horizonY+(1/fz)*fovScale*0.26;
    if (sy>H) return;
    const p=0.8+0.2*Math.sin(f*0.3);
    ctx.beginPath(); ctx.arc(sx,sy,6*p,0,Math.PI*2);
    ctx.fillStyle='rgba(255,80,80,1)';
    ctx.shadowBlur=18; ctx.shadowColor='#ff0000'; ctx.fill(); ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(sx,sy,11,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,100,100,0.3)'; ctx.lineWidth=1; ctx.stroke();
  });

}
function drawSurfaceCompass(bearingDeg) {
  const pc = periCompassCtx;
  var _scw = periCompassCanvas.offsetWidth || 260;
  if (periCompassCanvas.width !== _scw) periCompassCanvas.width = _scw;
  const pw = periCompassCanvas.width, ph = periCompassCanvas.height;
  pc.fillStyle = 'rgba(0,5,15,0.9)';
  pc.fillRect(0, 0, pw, ph);
  const centreX = pw/2;
  pc.font = '7px Share Tech Mono';
  for (let d = -90; d <= 90; d += 5) {
    const deg = (bearingDeg + d + 360) % 360;
    const px2 = centreX + d * 1.4;
    if (d % 30 === 0) {
      const labels = ['N','030','060','E','120','150','S','210','240','W','300','330'];
      const label = labels[Math.round(deg/30) % 12];
      pc.fillStyle = label==='N'||label==='E'||label==='S'||label==='W' ? '#00ff9d' : 'rgba(0,200,255,0.7)';
      pc.textAlign = 'center';
      pc.fillText(label, px2, 10);
      pc.strokeStyle = 'rgba(0,200,255,0.5)'; pc.lineWidth = 1.5;
      pc.beginPath(); pc.moveTo(px2, 13); pc.lineTo(px2, ph-2); pc.stroke();
    } else if (d % 10 === 0) {
      pc.strokeStyle = 'rgba(0,150,200,0.35)'; pc.lineWidth = 0.8;
      pc.beginPath(); pc.moveTo(px2, 16); pc.lineTo(px2, ph-2); pc.stroke();
    }
  }
  pc.strokeStyle = '#00ff9d'; pc.lineWidth = 2;
  pc.beginPath(); pc.moveTo(centreX, 12); pc.lineTo(centreX, ph-2); pc.stroke();
  pc.fillStyle = '#00e5ff'; pc.font = 'bold 8px Share Tech Mono';
  pc.textAlign = 'center';
  pc.fillText(padL(bearingDeg.toFixed(0),3,'0')+'°', centreX, 10);
  drawHullBar(pc, 30, pw);
}


// ── SURFACE MODE ──
function updateSurfaceBtn() {} // no-op, surface triggered by depth slider

// ── SURFACED VIEW — top-down sub deck visible from periscope looking back ──
function renderSurfacedView() {
  // Reuse the surface periscope sky/ocean background
  renderSurfacePeriscope();

  // Draw sub PNG — conning tower view, fixed (not bearing-relative, you ARE on the tower)
  const ctx2 = ctx;
  const W2 = canvas.width, H2 = canvas.height;
  const img = getSubSurfaceImg();
  if (img.complete && img.naturalWidth > 0) {
    const horizonY2 = H2 * 0.42;
    const imgW = Math.min(W2 * 0.70, H2 * 0.80);
    const imgH = imgW * (img.naturalHeight / img.naturalWidth);
    const ix = (W2 - imgW) / 2;
    const iy = horizonY2 + 10; // top of sub image sits just below the horizon
    ctx2.drawImage(img, ix, iy, imgW, imgH);
  }

  // SURFACED status overlay
  ctx2.save();
  ctx2.font = 'bold 11px Share Tech Mono';
  ctx2.textAlign = 'center';
  ctx2.fillStyle = 'rgba(0,255,140,0.85)';
  ctx2.shadowBlur = 12; ctx2.shadowColor = '#00ff88';
  ctx2.fillText('SURFACED — HULL RECHARGING', W2 / 2, H2 * 0.12);
  ctx2.shadowBlur = 0;
  ctx2.font = '9px Share Tech Mono';
  ctx2.fillStyle = 'rgba(255,120,80,0.75)';
  ctx2.fillText('⚠ EXPOSED TO SURFACE THREATS', W2 / 2, H2 * 0.12 + 16);
  // Hull % readout
  ctx2.font = '10px Share Tech Mono';
  ctx2.fillStyle = state.hull > 60 ? '#00e5ff' : state.hull > 30 ? '#ffcc00' : '#ff4444';
  ctx2.fillText('HULL ' + state.hull + '%', W2 / 2, H2 * 0.12 + 32);
  ctx2.restore();

  // Draw compass using surface bearing
  const bearingDeg = ((surfaceBearing * 180 / Math.PI) % 360 + 360) % 360;
  drawSurfaceCompass(bearingDeg);
}











// Upload screen — dive in with uploaded plan
document.getElementById('launch-btn').addEventListener('click', function() {
  launchGame(window._pendingGrid || FLOOR_PLAN);
});

// ── INTRO CANVAS ANIMATION — removed ──
if (false) (function() {
  const ic = document.getElementById('intro-canvas');
  if (!ic) return;
  const ic2d = ic.getContext('2d');
  var _iraf = null;

  function _iSub(c2, cx, cy, len, isEnemy, T) {
    const h = len * 0.13;
    const R = isEnemy ? [255,60,60] : [0,200,255];
    const col = (a) => `rgba(${R[0]},${R[1]},${R[2]},${a})`;
    const shimmer = 0.82 + 0.18 * Math.sin(T * 1.4 + (isEnemy ? 1.2 : 0));
    c2.save(); c2.translate(cx, cy);

    // Ambient glow
    var g = c2.createRadialGradient(0, h*0.5, 0, 0, h*0.5, len * 0.65);
    g.addColorStop(0, col(0.14*shimmer)); g.addColorStop(1, col(0));
    c2.fillStyle = g; c2.fillRect(-len*0.65, -h*1.5, len*1.3, h*4);

    // Hull path — torpedo capsule side profile
    function hull() {
      c2.beginPath();
      c2.moveTo(-len*0.42, h*0.2);
      c2.bezierCurveTo(-len*0.5, h*0.2, -len*0.5, h*0.8, -len*0.42, h*0.8);
      c2.bezierCurveTo(-len*0.3, h, len*0.22, h, len*0.38, h*0.65);
      c2.bezierCurveTo(len*0.5, h*0.4, len*0.5, h*0.1, len*0.38, 0);
      c2.bezierCurveTo(len*0.22, -h*0.1, -len*0.3, 0, -len*0.42, h*0.2);
      c2.closePath();
    }
    hull(); c2.fillStyle = isEnemy ? 'rgba(20,2,2,0.95)' : 'rgba(1,10,20,0.95)'; c2.fill();

    // Top edge glow
    hull();
    var vg = c2.createLinearGradient(0, -h*0.1, 0, h*1.05);
    vg.addColorStop(0, col(0.75*shimmer)); vg.addColorStop(0.12, col(0.05));
    vg.addColorStop(0.88, col(0.05));    vg.addColorStop(1, col(0.55*shimmer));
    c2.fillStyle = vg; c2.fill();

    // Side edge glow (bow + stern)
    hull();
    var hg2 = c2.createLinearGradient(-len*0.5, 0, len*0.5, 0);
    hg2.addColorStop(0, col(0.5*shimmer)); hg2.addColorStop(0.12, col(0));
    hg2.addColorStop(0.88, col(0)); hg2.addColorStop(1, col(0.6*shimmer));
    c2.fillStyle = hg2; c2.fill();

    // Hull outline
    hull(); c2.strokeStyle = col(0.8*shimmer); c2.lineWidth = 1.4;
    c2.shadowBlur = 9; c2.shadowColor = col(0.45); c2.stroke(); c2.shadowBlur = 0;

    // Internal frame lines
    for (var d = 1; d <= 5; d++) {
      var px = -len*0.42 + (len*0.80) * d/6;
      c2.beginPath(); c2.moveTo(px, h*0.1); c2.lineTo(px, h*0.9);
      c2.strokeStyle = col(0.11); c2.lineWidth = 0.6; c2.stroke();
    }
    c2.beginPath(); c2.moveTo(-len*0.35, h*0.5); c2.lineTo(len*0.35, h*0.5);
    c2.strokeStyle = col(0.13); c2.lineWidth = 0.6; c2.stroke();

    // Conning tower
    var tX = -len*0.04, tW = len*0.08, tH = h*1.0;
    c2.fillStyle = isEnemy ? 'rgba(15,1,1,0.96)' : 'rgba(1,8,18,0.96)';
    c2.fillRect(tX - tW/2, -tH, tW, tH);
    c2.strokeStyle = col(0.8*shimmer); c2.lineWidth = 1.1;
    c2.shadowBlur = 5; c2.shadowColor = col(0.4);
    c2.strokeRect(tX - tW/2, -tH, tW, tH); c2.shadowBlur = 0;
    // Hatch
    c2.beginPath(); c2.arc(tX, -tH*0.55, tW*0.28, 0, Math.PI*2);
    c2.strokeStyle = col(0.5); c2.lineWidth = 0.8; c2.stroke();

    // Mast
    c2.beginPath(); c2.moveTo(tX, -tH); c2.lineTo(tX, -tH - h*0.8);
    c2.strokeStyle = col(0.7*shimmer); c2.lineWidth = 1.0;
    c2.shadowBlur = 4; c2.shadowColor = col(0.4); c2.stroke(); c2.shadowBlur = 0;
    c2.beginPath(); c2.arc(tX, -tH - h*0.8, 2, 0, Math.PI*2);
    c2.fillStyle = col(0.9*shimmer); c2.shadowBlur = 7; c2.shadowColor = col(0.6);
    c2.fill(); c2.shadowBlur = 0;

    // Prop
    var pX = -len*0.44, pR = h*0.28;
    c2.beginPath(); c2.arc(pX, h*0.5, pR, 0, Math.PI*2);
    c2.strokeStyle = col(0.35*shimmer); c2.lineWidth = 0.8; c2.stroke();
    for (var b = 0; b < 3; b++) {
      var ba = b*Math.PI*2/3 + T*2.5;
      c2.beginPath(); c2.moveTo(pX, h*0.5);
      c2.lineTo(pX + Math.cos(ba)*pR, h*0.5 + Math.sin(ba)*pR);
      c2.strokeStyle = col(0.28*shimmer); c2.lineWidth = 0.7; c2.stroke();
    }
    c2.restore();
  }

  function _iShip(c2, cx, cy, len, T) {
    var hH = len * 0.09;
    var shimmer = 0.8 + 0.15 * Math.sin(T * 0.7 + cx * 0.01);
    var col = (a) => `rgba(0,200,255,${a*shimmer})`;
    c2.save(); c2.translate(cx, cy);

    // Horizon glow
    var hg = c2.createRadialGradient(0,0,0,0,0,len*0.8);
    hg.addColorStop(0,'rgba(0,120,200,0.14)'); hg.addColorStop(1,'rgba(0,0,0,0)');
    c2.fillStyle = hg; c2.fillRect(-len*0.8,-len*0.4,len*1.6,len*0.45);

    function shipH() {
      c2.beginPath();
      c2.moveTo(-len/2, 0); c2.lineTo(-len/2, hH*0.5);
      c2.bezierCurveTo(-len/2,hH,-len*0.28,hH*1.08,0,hH);
      c2.bezierCurveTo(len*0.28,hH*0.92,len*0.46,hH*0.55,len/2,hH*0.2);
      c2.lineTo(len/2,0); c2.closePath();
    }
    shipH(); c2.fillStyle='rgba(1,10,20,0.96)'; c2.fill();
    shipH();
    var eg = c2.createLinearGradient(-len/2,0,len/2,0);
    eg.addColorStop(0,col(0.7)); eg.addColorStop(0.14,col(0.04));
    eg.addColorStop(0.86,col(0.04)); eg.addColorStop(1,col(0.7));
    c2.fillStyle=eg; c2.fill();
    shipH(); c2.strokeStyle=col(0.75); c2.lineWidth=1.2;
    c2.shadowBlur=7; c2.shadowColor=col(0.4); c2.stroke(); c2.shadowBlur=0;

    // Waterline stripe
    c2.beginPath(); c2.moveTo(-len/2,0); c2.lineTo(len/2,0);
    c2.strokeStyle=col(0.3); c2.lineWidth=0.6; c2.stroke();

    // Superstructure
    var sW=len*0.30, sH=hH*1.55, sX=-len*0.04;
    c2.fillStyle='rgba(1,8,18,0.97)'; c2.fillRect(sX-sW/2,-sH,sW,sH);
    c2.strokeStyle=col(0.72); c2.lineWidth=1.0;
    c2.shadowBlur=5; c2.shadowColor=col(0.35);
    c2.strokeRect(sX-sW/2,-sH,sW,sH); c2.shadowBlur=0;
    // Deck dividers
    for(var dl=1;dl<=2;dl++){
      c2.beginPath(); c2.moveTo(sX-sW/2,-sH*dl/3); c2.lineTo(sX+sW/2,-sH*dl/3);
      c2.strokeStyle=col(0.17); c2.lineWidth=0.5; c2.stroke();
    }
    // Mast
    c2.beginPath(); c2.moveTo(sX,-sH); c2.lineTo(sX,-sH-hH*2.8);
    c2.strokeStyle=col(0.6); c2.lineWidth=0.9;
    c2.shadowBlur=4; c2.shadowColor=col(0.35); c2.stroke(); c2.shadowBlur=0;
    c2.beginPath(); c2.arc(sX,-sH-hH*2.8,1.8,0,Math.PI*2);
    c2.fillStyle=`rgba(255,200,50,${0.85*shimmer})`;
    c2.shadowBlur=7; c2.shadowColor='#ffcc00'; c2.fill(); c2.shadowBlur=0;
    c2.restore();
  }

  function _iDraw() {
    var intro = document.getElementById('intro-screen');
    if (!intro || getComputedStyle(intro).display === 'none') { _iraf = null; return; }
    var IW = ic.width  = ic.offsetWidth  || window.innerWidth;
    var IH = ic.height = ic.offsetHeight || window.innerHeight;
    var T = Date.now() * 0.001;
    var CX = IW / 2;
    var HY = IH * 0.44;

    // Sky
    var sky = ic2d.createLinearGradient(0,0,0,HY);
    sky.addColorStop(0,'#000308'); sky.addColorStop(1,'#020e1c');
    ic2d.fillStyle=sky; ic2d.fillRect(0,0,IW,HY);

    // Stars
    for(var si=0;si<55;si++){
      var sx=((Math.sin(si*127.3)*0.5+0.5)*IW)|0;
      var sy=((Math.sin(si*93.7)*0.5+0.5)*HY*0.82)|0;
      var sa=0.15+0.25*Math.abs(Math.sin(T*0.25+si*1.8));
      ic2d.beginPath(); ic2d.arc(sx,sy,0.7,0,Math.PI*2);
      ic2d.fillStyle=`rgba(150,200,255,${sa})`; ic2d.fill();
    }

    // Water
    var water = ic2d.createLinearGradient(0,HY,0,IH);
    water.addColorStop(0,'#010c18'); water.addColorStop(1,'#000408');
    ic2d.fillStyle=water; ic2d.fillRect(0,HY,IW,IH-HY);

    // ── SURFACE GRID (perspective) ──
    var scroll = (T * 0.12) % 1;
    for(var r=0;r<20;r++){
      var frac=Math.pow((r+scroll)/20,1.85);
      var gy=HY+frac*(IH-HY)*0.9;
      var ga=0.025+frac*0.22;
      ic2d.beginPath(); ic2d.moveTo(0,gy); ic2d.lineTo(IW,gy);
      ic2d.strokeStyle=`rgba(0,200,240,${ga})`; ic2d.lineWidth=0.4+frac*0.9; ic2d.stroke();
    }
    for(var vc=-15;vc<=15;vc++){
      if(vc===0) continue;
      var vbx=CX+vc*IW/13;
      var va=Math.max(0.012,0.09-Math.abs(vc)*0.005);
      ic2d.strokeStyle=`rgba(0,200,240,${va})`; ic2d.lineWidth=0.4;
      ic2d.beginPath(); ic2d.moveTo(CX,HY); ic2d.lineTo(vbx,IH*0.97); ic2d.stroke();
    }

    // ── SEABED GRID ──
    for(var vc2=-10;vc2<=10;vc2++){
      var vbx2=CX+vc2*IW/9;
      ic2d.strokeStyle='rgba(0,160,210,0.04)'; ic2d.lineWidth=0.4;
      ic2d.beginPath(); ic2d.moveTo(CX,IH*0.87); ic2d.lineTo(vbx2,IH); ic2d.stroke();
    }
    for(var r2=0;r2<5;r2++){
      var gy2=IH*0.87+r2/4*(IH*0.13);
      ic2d.beginPath(); ic2d.moveTo(0,gy2); ic2d.lineTo(IW,gy2);
      ic2d.strokeStyle=`rgba(0,150,210,${0.025+r2*0.01})`; ic2d.lineWidth=0.4; ic2d.stroke();
    }

    // ── SHIPS ──
    var s1x=IW*0.14+Math.sin(T*0.07)*IW*0.018;
    var s2x=IW*0.56+Math.sin(T*0.055+1)*IW*0.014;
    var s3x=IW*0.83+Math.sin(T*0.065+2)*IW*0.012;
    _iShip(ic2d, s1x, HY, IW*0.14, T);
    _iShip(ic2d, s2x, HY, IW*0.16, T+0.8);
    _iShip(ic2d, s3x, HY, IW*0.11, T+1.6);

    // ── FRIENDLY SUB ──
    var sfx=IW*0.21+Math.sin(T*0.04)*IW*0.008;
    var sfy=IH*0.685;
    _iSub(ic2d, sfx, sfy, IW*0.30, false, T);

    // ── ENEMY SUB ──
    var sex=IW*0.72-Math.sin(T*0.05)*IW*0.008;
    var sey=IH*0.625;
    _iSub(ic2d, sex, sey, IW*0.21, true, T);

    // ── TORPEDO (friendly → enemy) ──
    var tprog=(Math.sin(T*0.55)*0.5+0.5);
    var tx1=sfx+IW*0.155, ty1=sfy+IW*0.008;
    var tx2t=sex-IW*0.105, ty2t=sey+IW*0.006;
    if(tprog>0.05){
      var tx2=tx1+(tx2t-tx1)*tprog, ty2=ty1+(ty2t-ty1)*tprog;
      // Trail
      var trailG=ic2d.createLinearGradient(tx1,ty1,tx2,ty2);
      trailG.addColorStop(0,'rgba(255,80,60,0)');
      trailG.addColorStop(1,'rgba(255,80,60,0.45)');
      ic2d.beginPath(); ic2d.moveTo(tx1,ty1); ic2d.lineTo(tx2,ty2);
      ic2d.strokeStyle=trailG; ic2d.lineWidth=1.2; ic2d.stroke();
      // Head
      ic2d.beginPath(); ic2d.arc(tx2,ty2,4,0,Math.PI*2);
      ic2d.fillStyle='rgba(255,80,60,0.95)';
      ic2d.shadowBlur=14; ic2d.shadowColor='#ff2020'; ic2d.fill(); ic2d.shadowBlur=0;
    }

    // ── SCAN LINE ──
    var scY=(T*160)%IH;
    var scG=ic2d.createLinearGradient(0,scY-55,0,scY+55);
    scG.addColorStop(0,'rgba(0,200,255,0)');
    scG.addColorStop(0.5,'rgba(0,200,255,0.028)');
    scG.addColorStop(1,'rgba(0,200,255,0)');
    ic2d.fillStyle=scG; ic2d.fillRect(0,scY-55,IW,110);

    // ── DEPTH MARKER line at horizon ──
    ic2d.beginPath(); ic2d.moveTo(0,HY); ic2d.lineTo(IW,HY);
    ic2d.strokeStyle='rgba(0,180,240,0.22)'; ic2d.lineWidth=0.6; ic2d.stroke();

    // Clock
    var now=new Date(), clk=document.getElementById('intro-clock');
    if(clk) clk.textContent=[now.getHours(),now.getMinutes(),now.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');

    _iraf = requestAnimationFrame(_iDraw);
  }

  _iDraw();

  // Re-start when returning to intro from another screen
  document.getElementById('bg-back-btn') && document.getElementById('bg-back-btn').addEventListener('click', function(){ if(!_iraf) _iDraw(); });
  var _origUpBack = document.getElementById('upload-back-btn');
  if(_origUpBack) _origUpBack.addEventListener('click', function(){ if(!_iraf) _iDraw(); });
})();

// ── INTRO SCREEN NAVIGATION ──
document.getElementById('intro-btn-floorplan').addEventListener('click', function() {
  window._pendingGrid = null;
  window._isHeightfield = false;
  launchGame(FLOOR_PLAN);
});

document.getElementById('intro-btn-ocean').addEventListener('click', function() {
  var canyonBg = BATTLEGROUNDS.find(function(b) { return b.id === 'canyon'; });
  if (!canyonBg) return;
  window._isHeightfield = true;
  document.getElementById('intro-screen').style.display = 'none';
  canyonBg.loadAsync().then(function(mapGrid) {
    window._pendingGrid = mapGrid;
    launchGame(mapGrid);
  });
});

document.getElementById('intro-choose-btn').addEventListener('click', function() {
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('battleground-screen').style.display = 'flex';
});

document.getElementById('intro-upload-btn').addEventListener('click', function() {
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('upload-screen').style.display = 'flex';
  try { drawPreview(FLOOR_PLAN); } catch(e) {}
});

document.getElementById('bg-back-btn').addEventListener('click', function() {
  document.getElementById('battleground-screen').style.display = 'none';
  document.getElementById('intro-screen').style.display = 'flex';
});

document.getElementById('upload-back-btn').addEventListener('click', function() {
  document.getElementById('upload-screen').style.display = 'none';
  document.getElementById('intro-screen').style.display = 'flex';
});

// ── BATTLEGROUND CARDS ──
(function() {
  var bgGrid = document.getElementById('bg-grid');

  function drawCardPreview(pc, mapGrid, hGrid) {
    pc.fillStyle = '#020d1a';
    pc.fillRect(0, 0, 128, 54);
    var cw = 128/64, ch = 54/48;
    for (var mz = 0; mz < 48; mz++) {
      for (var mx = 0; mx < 64; mx++) {
        if (hGrid) {
          var h = hGrid[mz][mx] / 255;
          pc.fillStyle = 'rgb('+Math.round(h*20)+','+Math.round(40+h*180)+','+Math.round(80+h*175)+')';
          pc.fillRect(mx*cw, mz*ch, Math.max(1,cw), Math.max(1,ch));
        } else if (mapGrid[mz] && mapGrid[mz][mx]) {
          pc.fillStyle = '#00e5ff';
          pc.fillRect(mx*cw, mz*ch, Math.max(1,cw), Math.max(1,ch));
        }
      }
    }
  }

  function buildCard(bg, mapGrid) {
    var card = document.createElement('div');
    card.className = 'bg-card';
    var pv = document.createElement('canvas');
    pv.className = 'bg-card-preview';
    pv.width = 128; pv.height = 54;
    drawCardPreview(pv.getContext('2d'), mapGrid, bg._hGrid || null);
    var nm = document.createElement('div'); nm.className = 'bg-card-name'; nm.textContent = bg.name;
    var ds = document.createElement('div'); ds.className = 'bg-card-desc'; ds.textContent = bg.desc;
    var tg = document.createElement('div'); tg.className = 'bg-card-tag'; tg.textContent = bg.tag;
    card.appendChild(pv); card.appendChild(nm); card.appendChild(ds); card.appendChild(tg);
    card.addEventListener('click', function() {
      window._pendingGrid = mapGrid;
      window._pendingTypeGrid = null;
      window._isHeightfield = !!bg.isHeightfield;
      launchGame(mapGrid);
    });
    return card;
  }

  for (var i = 0; i < BATTLEGROUNDS.length; i++) {
    (function(bg) {
      if (bg.loadAsync) {
        var placeholder = document.createElement('div');
        placeholder.className = 'bg-card bg-card-loading';
        var pnm = document.createElement('div'); pnm.className='bg-card-name'; pnm.textContent=bg.name;
        var pds = document.createElement('div'); pds.className='bg-card-desc'; pds.textContent='Loading terrain…';
        var ptg = document.createElement('div'); ptg.className='bg-card-tag'; ptg.textContent=bg.tag;
        placeholder.appendChild(pnm); placeholder.appendChild(pds); placeholder.appendChild(ptg);
        bgGrid.appendChild(placeholder);
        bg.loadAsync().then(function(mapGrid) {
          var card = buildCard(bg, mapGrid);
          bgGrid.insertBefore(card, placeholder);
          placeholder.remove();
        });
      } else {
        bgGrid.appendChild(buildCard(bg, bg.makeGrid()));
      }
    })(BATTLEGROUNDS[i]);
  }
})();


