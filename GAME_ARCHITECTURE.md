# OPERATION PRINTER SCANNER — Game Architecture Guide

*For Tim (plain English) and for Claude AI (precise technical reference)*

---

## What This Game Is

A submarine combat game played inside a 3D model of your home. The player controls a submarine (Alpha) hunting an AI enemy submarine (Bravo) through the rooms of a house. The space is mapped as a grid of voxels (3D pixels). Surface ships patrol above and drop depth charges. The game runs on a single HTML canvas using vanilla JavaScript — no game engine, no frameworks.

---

## The Two Humans in This Project

**Tim** — game designer, vision holder. Speaks in terms of what he *sees and feels* on screen.  
**Claude** — implementation. Must always map Tim's descriptions to the exact code names below.

---

## The Four View Modes

This is the most important section. The game has four distinct views controlled by `state.viewMode`.

---

### 1. COMMAND VIEW — `state.viewMode === 'command'`
**Tim calls this:** "the command view", "the map", "top-down"  
**What you see:** A 3D top-down isometric view of the whole battlefield. You can see the walls, furniture, terrain, and both submarines as dots. The camera can be rotated and zoomed. This is like looking at a diorama from above and to the side.  
**Projection function:** `project(wx, wy, wz)` — isometric, camera rotates around the Y axis via `camRotY`  
**Rendered by:** `render()`  
**Controls:** Drag to rotate view, pinch to zoom, buttons at the bottom of screen  
**When active:** Default on game start; return to it by pressing ◈ COMMAND from periscope

---

### 2. PERISCOPE VIEW — `state.viewMode === 'periscope'`
**Tim calls this:** "the underwater view", "the periscope view", "the underwater periscope view"  
**What you see:** First-person view from inside the water. You see the 3D terrain walls and floor from eye level. The water surface is a shimmering line somewhere on screen — above it is sky/clouds, below it is the dark ocean. You can look left/right/up/down by dragging. This is the main combat view.  
**Projection function:** `projectPeriscope(wx, wy, wz)` — first-person perspective relative to the player submarine's position and bearing  
**Rendered by:** `renderPeriscope()`  
**Controls:** Left drag zone = move/aim, right drag zone = rise/dive, FIRE button, sliders on screen  
**When active:** Press ⊙ PERISCOPE button; also the default view when a game launches

---

### 3. SURFACE VIEW — `state.viewMode === 'surface'`
**Tim calls this:** "the surface view", "the view with the clouds", "the view where you can see the ships"  
**What you see:** First-person horizontal view at the water surface level. Sky above, water below. Ships appear as battleship silhouettes on the horizon. You can rotate the view horizontally (panoramic). This activates automatically when the submarine rises close to the surface (within 1 voxel of GRID.H).  
**Projection function:** `projectPeriscope()` with the surface line at screen centre  
**Rendered by:** `renderSurfacePeriscope()`  
**Controls:** Same as Periscope View  
**When active:** Automatically when player.y >= GRID.H - 1 (very near the surface)

---

### 4. SURFACED VIEW — `state.viewMode === 'surfaced'`
**Tim calls this:** "surfaced", "on the surface"  
**What you see:** A fixed image of a submarine conning tower (deck view) with the horizon visible. The submarine has fully broken the surface. Background is sky/ocean gradient.  
**Rendered by:** `renderSurfacedView()` (wraps `renderSurfacePeriscope()` for the background)  
**When active:** Automatically when player.y >= GRID.H (at or above the surface ceiling)

---

### View Transition Summary

```
COMMAND ←→ PERISCOPE     (press ⊙ PERISCOPE / ◈ COMMAND button)
PERISCOPE → SURFACE      (automatic: sub rises to within 1 voxel of surface)
SURFACE → SURFACED       (automatic: sub reaches the surface ceiling)
SURFACED → back          (automatic: sub dives below surface again)
```

The variable `state.preSurfaceView` remembers whether you were in COMMAND or PERISCOPE before surfacing, so diving returns you to the right place.

---

## The Coordinate System

The world is a 3D grid. Think of it as a box:

```
         Y=GRID.H  ← WATER SURFACE (top of the world)
              ↑
              │   (water / air space where subs move)
              │
         Y=0  ← SEABED (bottom of the world)

X goes left→right (West→East)
Z goes front→back (North→South)
```

| Variable | Value (Standard Map) | Value (Canyon Map) | Meaning |
|----------|---------------------|-------------------|---------|
| `GRID.W` | 64 | 64 | Width (X axis) |
| `GRID.D` | 48 | 48 | Depth (Z axis) |
| `GRID.H` | 6 | 32 | Height (Y axis) — water column depth |

**Standard map:** GRID.H = 6 voxels tall (a house ceiling, ~3m real-world)  
**Canyon/terrain map:** GRID.H = 32 voxels tall (a deep underwater canyon)

One voxel = approximately 0.32m horizontally and 0.5m vertically.

**Key rule:** Y = GRID.H is ALWAYS the water surface. Y = 0 is ALWAYS the seabed. Ships float at Y = GRID.H. The player submarine moves between Y=0 and Y=GRID.H.

---

## The Two Terrain Types

### Standard / Floor Plan Maps
Built from a bitmap image of a floor plan. Rooms, walls, furniture, corridors. The "terrain" is wall boxes and furniture objects. GRID.H = 6. Examples: the house maps.

### Heightfield / Canyon Maps
Built from a grayscale heightmap image. Each pixel brightness = terrain column height. Bright pixel = tall mountain reaching near the surface. Dark pixel = deep valley at the seabed. GRID.H = 32. Example: "THE CANYON".

---

## The Sonar Minimap

A 200×200 pixel canvas in the bottom-left corner (`#sonar-canvas`). **Always visible in all view modes.** Updated every frame by `drawSonar()`.

- **Standard maps:** Shows room outlines and furniture footprints (rectangles)
- **Canyon maps:** Shows a topographic contour map — height bands from dark (seabed) to bright teal (peaks), with contour lines at band boundaries
- Also shows: torpedo tracks (orange), enemy position (red when revealed), player position (green), ship contacts (gold diamonds), sonar sweep animation

---

## The Point Cloud (Dots)

A pre-generated array called `cloudPoints[]`. These are thousands of small dots placed on every surface in the scene. They are what give the world its "sonar scan" look. Colored by `ptColor(type, alpha, yFrac)`:

- `terrain` = teal/cyan gradient by height (canyon map surface dots)
- `wall` = blue
- `floor` = dark blue
- `furniture types` = warm amber/gold tones

The dots are only visible in COMMAND VIEW and PERISCOPE VIEW.  
The density can be adjusted with the ◎+/◎− buttons.

---

## The Terrain Quads (Canyon Map Only)

In the canyon/heightfield map, the terrain is also rendered as 3D quadrilateral panels (`terrainQuads[]`) — one quad per grid cell, angled to match the terrain height at each corner. These are the actual 3D surface seen in PERISCOPE VIEW.

- Stored as flat float array: 12 values per quad (4 corners × 3 coordinates)
- Colored in the draw queue dispatch (inside `renderPeriscope()`)
- Recently updated to use contour-map colour bands matching the sonar

---

## Key Rendering Pipelines

### Command View (`render()`)
1. Clear canvas, draw background gradient
2. Sort all cloudPoints by depth (back to front)
3. Draw each point using `project()` → isometric 2D position
4. Draw wall edges (wireframe lines) on top
5. Draw player sub, enemy sub, torpedoes, explosions
6. Draw HUD overlays

### Periscope View (`renderPeriscope()`)
1. Draw background gradient (dark ocean, horizon line based on player depth)
2. Draw surface shimmer + ships at waterline (only if near surface)
3. **Combined painter's algorithm:**
   - Project all terrain quads → screen positions
   - Project all entities (enemy, whales, squids, megalodons)
   - Sort everything back-to-front by depth
   - Draw in order: quads first (terrain fills the background), then entities on top
4. Draw point cloud dots on top of terrain
5. Draw depth charges + trails
6. Draw explosions
7. Draw scope mask overlay (circular vignette)
8. Update compass, hull bar, HUD text

---

## Surface Ships

Ships live in `state.ships[]`. Each ship has:
- `x, z` — horizontal position (Y is always GRID.H while floating)
- `heading` — direction in radians
- `alive`, `sinking`, `sinkY`, `tilt` — life/death state
- `label` — name shown on sonar and above ship

Ships are drawn differently per view:
- **Command view:** Top-down shape (`drawShipPoints()`) — shows the ship from above
- **Surface/Periscope view (near surface):** Side silhouette (`_drawShipProfile()`) — the battleship outline with turrets, bridge, funnels, masts. Only visible when player is within 30% of surface depth (`surfaceFrac > 0.70`).
- **Underwater view:** NOT drawn (intentional — too distracting)
- **Sonar:** Gold diamond blip with heading indicator

---

## Depth Charges

Dropped by ships when Battle Stations (🚨) is active and the player is within range below a ship. Each charge:
- Falls from Y=GRID.H down to Y=0 or player depth
- Takes ~7 seconds to reach the seabed (slow, intentional)
- Drawn in PERISCOPE VIEW as a dark olive barrel with metal bands and red detonator cap
- Leaves an orange dot trail as it descends
- Glows red when near the player's depth
- Explodes on proximity to player or at seabed; applies hull damage

---

## Known Issues (as of session end)

1. **Mountains appear green in Periscope View (canyon map)** — The terrain quads now use contour-map colours but the point cloud dots on top still use the old `ptColor('terrain')` palette which can appear greenish. These need to be brought into the same colour scheme.

2. **Contour map style not obvious in Periscope View** — The quad colours are very dark (correct for deep seabed) but high-elevation peaks should be noticeably brighter teal, matching the sonar minimap. The colour range in the quad shader may need to be expanded.

3. **Tim's preferred UI:** Tim wants to move toward using the Periscope View as the primary UI for everything, with the Command View accessible as a mode within that same UI rather than a completely separate screen.

---

## File Structure

```
f:\HunterKiller\hsd\
├── index.html          — All HTML, canvas elements, HUD structure
├── src/
│   ├── game.js         — Entire game (~6700+ lines, single file)
│   ├── main.js         — Entry point, imports game.js
│   └── style.css       — All styles
├── public/
│   ├── manifest.json   — PWA manifest
│   └── Images/         — Splash screen, battleground previews
│   └── Sounds/         — Audio files (torpedo, explosion, depth charge, etc.)
└── GAME_ARCHITECTURE.md — This document
```

The game is deployed on Vercel at **hunter-killer.vercel.app**.  
Deploy command: `npx vercel --prod` from the project root.

---

## Glossary (Tim's words → Code terms)

| Tim says | Code means |
|----------|-----------|
| "underwater view" / "periscope view" | `viewMode === 'periscope'`, `renderPeriscope()` |
| "surface view" / "view with clouds" / "where you see ships" | `viewMode === 'surface'`, `renderSurfacePeriscope()` |
| "command view" / "top-down" / "the map" | `viewMode === 'command'`, `render()` |
| "the dots" / "point cloud" | `cloudPoints[]`, drawn by the dots loop in each render |
| "terrain" / "mountains" / "canyon" | Heightfield map, `terrainQuads[]`, `window._canyonHeightGrid` |
| "the sonar" / "radar" / "minimap" | `#sonar-canvas`, `drawSonar()` |
| "surface" (noun, the water) | Y = GRID.H (the top of the world grid) |
| "seabed" / "floor" | Y = 0 (the bottom of the world grid) |
| "heading" | Direction the sub faces, in radians (0 = North / -Z axis) |
| "bearing" | Same as heading but displayed in degrees 000°–359° |
| "Battle Stations" / "Red Alert" | `state.battleStations === true` |
