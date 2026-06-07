# Mission: Through The Angels — Design & Implementation Handoff

## Project Context

**Game**: Hunter Killer / Operation Hunter Killer  
**Stack**: Vite + vanilla JS, deployed on Vercel (`npx vercel --prod`)  
**Working dir**: `f:\HunterKiller\hsd`  
**Key files**:
- `src/game.js` — main game engine (~10,000 lines)
- `src/music.js` — OST crossfade engine (Basil Poledouris / Red October tracks)
- `src/multiplayer.js` — Supabase realtime multiplayer
- `src/campaign.js` — 6-mission campaign skeleton
- `index.html` — all UI panels defined here
- `src/style.css` — styles

**Deployment**: `npx vercel --prod` from `f:\HunterKiller\hsd`

---

## Existing Game Systems (relevant to this mission)

### Coordinate System
- World is a grid: `GRID.W` × `GRID.H` (H = 30 = surface waterline)
- `state.player.x/y/z` — player position (y=30 = surface, y<30 = submerged)
- `state.periAngleH` — periscope horizontal bearing (radians)
- `surfaceBearing` — surface view bearing (same convention as periAngleH after recent fix)

### Movement
- `movePeriDir(dir)` — forward/back using current bearing
- `movePeriStrafe(dir)` — strafe
- Both use `state.periAngleH` (submerged) or `surfaceBearing` (surface)
- **No auto-forward exists yet** — player always drags to move

### Views
- `state.viewMode`: `'periscope'` | `'surface'` | `'surfaced'` | `'command'`
- `projectPeriscope(wx, wy, wz)` — 3D projection, negates fx (mirrored like real periscope)
- `projectSurface(wx, wy, wz)` — same convention after recent fix (also negates fx)

### Minimap
- Canvas element `#minimap-canvas`, drawn every frame
- Shows player chevron, ships, mines, torpedo pickups

### Music
- `window._musicStart()` / `window._musicStop()`
- `window._musicCombat(bool)` / `window._musicStealth(bool)`
- OST tracks: Nuclear Scam, Red Route I (ambient), Ancestral Aid, Two Wives (stealth), Chopper, Kaboom (combat)
- **Red Route I is perfect for this mission**

### Campaign
- `src/campaign.js` — mission launcher, each mission calls `launchGame(config)`
- Missions can pass config to game.js via globals or config object

### Torpedoes
- `state.torpedoes[]` — array of active torpedoes with `{x,y,z,dx,dy,dz,speed,...}`
- Enemy torpedoes have `isEnemy:true`

---

## Mission: Through The Angels — Full Design

### Concept
Inspired by the Red October "Red Route" canyon sequence. The sub auto-moves at player-set throttle speed. Player navigates a 3D underwater canyon (the "Angels" — rock pinnacle formations) using:
1. An **Engine Order Telegraph** (throttle: All Stop / ¼ / ½ / ¾ / Full / Flank)
2. An **inertial heading dial** (issue heading commands, sub turns gradually — rate depends on speed)
3. A **bathymetric chart** (Admiralty-style contour map) for situational awareness
4. A **sonar display** (replaces periscope for this mission) with two sub-modes

A pursuing torpedo must be shaken by threading a tight gap between two angel formations that the torpedo cannot navigate.

### No heightfield needed
The canyon is defined as a **parametric spline** — a centerline polyline with width and depth envelope at each waypoint. The angels are explicit geometric placements (position + size + shape). All defined in JavaScript data, no external assets.

### Canyon Geometry System

```javascript
// Canyon defined as waypoints: {x, z, width, floorY, ceilY}
// x/z = world position of channel centerline
// width = half-width of safe passage (meters in world units)
// floorY = floor depth (lower = deeper, min ~5)
// ceilY = ceiling depth (upper = surface side, max 29)
const ANGELS_PATH = [
  { x: 50,  z: 10,  width: 12, floorY: 10, ceilY: 26 }, // entry — wide
  { x: 55,  z: 25,  width: 9,  floorY: 12, ceilY: 25 }, // first bend
  { x: 65,  z: 38,  width: 7,  floorY: 14, ceilY: 24 }, // angel pair 1
  { x: 72,  z: 52,  width: 8,  floorY: 11, ceilY: 26 }, // open section
  { x: 78,  z: 67,  width: 5,  floorY: 16, ceilY: 22 }, // the narrows (arch — go deep)
  { x: 82,  z: 80,  width: 6,  floorY: 13, ceilY: 25 }, // post-arch
  { x: 88,  z: 95,  width: 4,  floorY: 15, ceilY: 23 }, // needle gap (torpedo kill)
  { x: 95,  z: 110, width: 14, floorY: 8,  ceilY: 27 }, // exit — open water
];

// Angel formations: pinnacles and arches
const ANGELS_FORMATIONS = [
  { x: 63, z: 36, r: 3.5, hBot: 8, hTop: 24, type: 'pinnacle' },  // left angel
  { x: 68, z: 40, r: 3.0, hBot: 8, hTop: 24, type: 'pinnacle' },  // right angel
  { x: 76, z: 65, r: 6.0, hBot: 5, hTop: 20, type: 'arch',        // the arch (go under)
    archFloor: 5, archCeil: 16 },
  { x: 86, z: 93, r: 2.0, hBot: 10, hTop: 27, type: 'pinnacle' }, // needle left
  { x: 90, z: 97, r: 2.0, hBot: 10, hTop: 27, type: 'pinnacle' }, // needle right
];
```

### New Input Systems

#### Engine Order Telegraph (EOT)
- Speeds: `[0, 0.05, 0.1, 0.18, 0.28, 0.4]` world units/tick (All Stop → Flank)
- UI: vertical dial or lever with click-up/click-down, labelled with nautical names
- Auto-applies `movePeriDir(-1)` each tick at the set speed magnitude
- Turning radius increases with speed (tighter turns only at lower speeds)

#### Inertial Heading
- Player sets a **target heading** (tap/drag a compass dial)
- Sub turns toward it at a rate: `turnRate = maxTurn * (1 - speed/flankSpeed)`
- At full speed, turn rate ~0.5°/sec. At stop, ~3°/sec.
- This means you MUST plan ahead — issue heading changes early

#### Depth Control
- Existing depth slider remains, but becomes critical
- Some passages require specific depth bands
- The torpedo runs at y=24 (shallow) — diving to y=14 or lower loses it temporarily

### Sonar Display (replaces periscope view for this mission)

**Plan view** (horizontal sweep):
- Circular sweep, green on black
- Canyon walls appear as arc-shaped returns left and right
- Angel pinnacles as solid blobs
- Torpedo contact: faster return, distinctive triple-ping sound, distance shown
- Own ship at center

**Section view** (vertical cross-section ahead):
- Shows floor depth and ceiling clearance directly ahead
- Horizontal = left/right, vertical = depth
- Sub shown as a dot in the section
- Critical for arch/narrows passages

Toggle between plan/section with a button.

### Bathymetric Chart View

Canvas-rendered, Admiralty chart style:
- **Background**: `#f5f0e0` (cream/sepia)
- **Contour lines**: indigo (`#1a237e`), spaced by depth interval, generated from canyon envelope data
- **Depth soundings**: italic numbers scattered in key areas
- **Angel symbols**: asterisk `*` with depth label (hazard notation)
- **Red Route**: pre-drawn dashed course line through the safe channel
- **Own ship**: small chevron, moves along track, faint pencil trail behind
- **Torpedo**: blinking contact dot with projected intercept vector (dashed red)
- **Needle gap**: shown only as geometry — player figures out it's the exit point

Toggle from sonar using a chart button.

### Torpedo Chaser

- Spawns 30 seconds into mission, from behind the player
- Homes toward player at speed ~0.35 (slightly slower than sub at full)
- Fixed depth: y = 24 (shallow running — can be escaped by going deep briefly)
- Cannot navigate angel geometry: uses simple A* or steering toward player, but treats formations as hard obstacles with a minimum turn radius larger than the needle gap
- When torpedo enters the needle gap zone at wrong angle: hits a pinnacle → detonation
- Player sees/hears: sonar goes white (overload), 2 seconds blank, then clears to open water

### Mission Flow

1. **Briefing screen**: Chart view, Red Route highlighted, "Thread the pass. Shake the fish."
2. **Entry**: Sub starts moving at ¼ ahead. Wide canyon. Learn the controls.
3. **First angels**: Two pinnacles. Set heading to thread between them.
4. **The Narrows / Arch**: Must dive to ~y=14 to pass under the arch. Depth critical.
5. **Torpedo spawn**: Contact alert on sonar. Triple ping. Gets closer. Player must balance speed (close torpedo) vs. turning radius (navigation).
6. **The Needle Gap**: 4-unit wide passage. Must approach on specific heading at specific depth. Thread it at ½ speed or less (tight turn required).
7. **Torpedo detonation**: Hits pinnacle. Sonar white-out. Silence.
8. **Exit**: Open water. Music crossfades to Red Route I. Mission complete → campaign return.

### Self-Containment

Everything lives in a mission module:
- `src/missions/angels.js` (or within campaign.js)
- Canyon geometry defined locally
- Custom render functions (sonar display, chart) called only during this mission
- `state.missionMode = 'angels'` gates the custom input/render code
- On mission end, `state.missionMode = null` restores normal gameplay
- No changes to open-world systems

### Render Approach for Sonar

The sonar plan view is a canvas overlay (separate canvas or drawn into main canvas during the mission). The sweep line rotates every ~1.5 seconds. Returns "fade out" over ~4 sweep cycles (phosphor decay effect). Canyon walls computed by raycasting from player position outward at each sweep angle, checking against canyon envelope and formation geometry.

The chart is pre-rendered once when the mission starts (the canyon geometry is known), then the dynamic elements (own ship, torpedo) are overlaid each frame.

---

## Implementation Order

1. **Canyon geometry + collision** — the spline path, formation collision checks
2. **EOT throttle input** — the new speed system + auto-movement
3. **Inertial heading** — turn rate physics
4. **Sonar display** — plan view first, section view second
5. **Chart renderer** — pre-render pass + dynamic overlay
6. **Torpedo chaser** — homing agent with formation avoidance
7. **Mission flow** — briefing → play → torpedo kill → exit

---

## Existing Code Reference Points

| Thing | Location |
|-------|----------|
| Player movement | `game.js` ~line 5190 `movePeriDir()` |
| Bearing (periscope) | `state.periAngleH` |
| Bearing (surface) | `surfaceBearing` (let, ~line 809) |
| Depth | `state.player.y` (0=floor, 30=surface) |
| Torpedo array | `state.torpedoes[]` |
| Minimap draw | `game.js` ~line 5520 |
| Ship wireframe | `game.js` ~line 8339 `drawShipWireframe3D()` |
| Periscope projection | `game.js` ~line 4136 `projectPeriscope()` |
| Surface projection | inside `renderSurfacePeriscope()` ~line 9458 |
| Music control | `window._musicStart/Stop/Combat/Stealth/Volume()` |
| Campaign system | `src/campaign.js` |
| Launch game | `launchGame(config)` in `game.js` |

---

## Recent Changes (this session)

- **Bearing sync fix**: Surface/periscope view transition now correctly preserves look direction. `surfaceBearing = periAngleH` (was `-periAngleH`). `projectSurface` now negates fx (same as periscope). Both drag directions now `+= dx`. Strafe sign unified to `-1`.
- **Music system**: 20% default volume, 2-minute track rotation, `onended` double-fire fix, intro music volume linked to ACOUSTICS panel.
- **Torpedo pickups** (multiplayer): 20-torpedo start, LCG-seeded pickup placement, broadcast collect sync.
