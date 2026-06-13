# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **HTML5 implementation of Asteroids**, a classic arcade game, rendered with **PixiJS v8 (WebGL)**. The only dependency is PixiJS, loaded from a CDN via a `<script>` tag — there is **no npm install and no build system**. It runs directly in any modern browser (internet connection required for the CDN).

- **Entry point**: `index.html` (loads PixiJS from CDN, then `game.js`)
- **Game logic + render**: `game.js`
- **No build step required**: The project is static and can be served as-is

## Running the Game

### Option 1: Open directly in a browser
```bash
open index.html
# or double-click the file (needs internet for the PixiJS CDN)
```

### Option 2: Use a local static server
```bash
npx serve .
# then open http://localhost:3000
```

The game renders to an 800×600 WebGL canvas (created by PixiJS and appended to `#game`) and includes collision detection, ship physics (thrust/drag/rotation), asteroid splitting, power-ups, an enemy "Hunter", parallax starfield, colored particles, scoring, and game over logic.

## Architecture

### Rendering: PixiJS v8
- PixiJS is exposed as the global `PIXI` (UMD CDN build).
- The app is created asynchronously: `app = new PIXI.Application(); await app.init({...})` inside the `main()` IIFE at the bottom of `game.js`.
- **Layers**: a `PIXI.Container` per layer is added to `app.stage` in back-to-front order — see `LAYER_ORDER` (`starfield`, `particle`, `shockwave`, `asteroid`, `hunter`, `powerup`, `bullet`, `ship`, `hud`).
- **Neon glow** is done without external filters: bullets and power-ups draw a translucent colored halo behind the core shape.

### Game Loop Pattern
- **Entry**: `app.ticker.add(tick)` drives the loop; `tick(ticker)` computes `dt` from `ticker.deltaMS` (clamped to 0.05).
- **Update**: `update(dt)` — processes input, updates physics, handles collisions, manages game state. Pure logic, no rendering.
- **Render**: `render()` — calls `sync()` on every entity to update its PIXI object, plus `syncHUD()`.

### Entity pattern (logic vs. render split)
Each entity class creates its PIXI object (`this.gfx`) in the constructor and adds it to its layer. Static geometry (ship, asteroid polygon, bullet) is drawn **once**; `sync()` only updates `position`/`rotation`/`alpha`/`visible`. On death, the array is filtered through `cull()`, which calls `destroy()` (→ `gfx.destroy()`) on dead entities.

### Core Classes (game entities)
- **`Ship`** — Player vessel with thrust, rotation, drag, shooting cooldown, invincibility frames; tracks `tripleShot` and `magnet` timers
- **`Asteroid`** — Three sizes (large/medium/small); randomly shaped polygon; splits into two smaller asteroids; wraps around screen edges
- **`Bullet`** — Projectiles with time-to-live; wraps around screen
- **`Particle`** — Short-lived colored debris (explosions, thruster trail, muzzle flash); accepts `color` and an `opts` (`angle`/`speed`/`life`/`size`)
- **`PowerUp`** — Typed pickup (`triple` / `bomb` / `magnet` / `life`); rotating hex ring + label; attracted to the ship while `magnet` is active
- **`Shockwave`** — Expanding ring from a bomb; clears asteroids and damages Hunters within its radius (tracked via `hitAst`/`hitHunters` sets)
- **`Hunter`** — Enemy that chases the ship across toroidal space; has HP, a hit-flash, and a health bar (`bodyG` rotates, `barG` stays upright)
- **`Starfield`** — Three parallax bands of stars that drift opposite to the ship's velocity (created once, persists across levels)

### State Management
Global variables track:
- `ship`, `bullets`, `asteroids`, `particles`, `powerups`, `hunters`, `shockwaves` — Live entity arrays
- `starfield` — Persistent parallax background
- `score`, `lives`, `level`, `bombs` — Player progress / inventory
- `state` — One of `'playing'`, `'dead'`, `'gameover'`

Key functions:
- `initGame()` — Resets to start a new game (destroys old entities, recreates ship, keeps starfield)
- `nextLevel()` — Advances level and spawns new asteroids
- `clearLevelEntities()` / `cull()` / `destroyAll()` — Entity lifecycle + PIXI cleanup
- `update(dt)` and `render()` — Core game tick
- `applyPowerUp(type)`, `useBomb()`, `randomPowerUpType()` — Power-up mechanics
- `explode()`, `spawnThrust()`, `spawnMuzzle()` — Particle emitters

### Input System
- `keys` map — Keys currently held (move/rotate ship)
- `justPressed` map + `pressed(code)` — Single-press events (Space to fire, `KeyB`/`ShiftLeft` to drop a bomb)

### Physics
- Toroidal space (wrap-around at screen edges via `wrap()`)
- Ship movement uses drag-based physics (thrust accelerates, drag decelerates)
- No external physics library; all math is inline

## Common Development Tasks

Since there is no build or test suite:
- **Inspect the game**: Open `index.html` and use browser devtools console/debugger
- **Modify logic**: Edit `game.js` directly; refresh the page in the browser to see changes
- **Add features**: Follow the existing class pattern — create `this.gfx` in the constructor, draw static geometry once, implement `sync()` and `destroy()`, push to the right layer, and run the array through `cull()`
- **Add a power-up type**: Extend `PU_DEFS`, then handle it in `applyPowerUp()` and `randomPowerUpType()`

## Notes

- The game uses `'use strict'` at the top of `game.js`
- The only dependency (PixiJS) is loaded from a CDN; the project is otherwise static and unminified
- To run fully offline, vendor `pixi.js` locally and point the `<script>` tag at the local copy
