# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **pure HTML5 Canvas implementation of Asteroids**, a classic arcade game. The project has **zero dependencies** — no npm packages, no frameworks, no build system. It runs directly in any modern browser.

- **Entry point**: `index.html`
- **Game logic**: `game.js` (~424 lines)
- **No build step required**: The project is static and can be served as-is

## Running the Game

### Option 1: Open directly in a browser
```bash
open index.html
# or double-click the file
```

### Option 2: Use a local static server
```bash
npx serve .
# then open http://localhost:3000
```

The game renders to an 800×600 pixel Canvas and includes collision detection, ship physics (thrust/drag/rotation), asteroid splitting, scoring, and game over logic.

## Architecture

### Game Loop Pattern
- **Entry**: `requestAnimationFrame` loop calls `loop(ts)` each frame
- **Update**: `update(dt)` — processes input, updates physics, handles collisions, manages game state
- **Draw**: `draw()` — clears canvas, renders all entities and HUD (score/level/lives)

### Core Classes (game entities)
- **`Ship`** — Player-controlled vessel with thrust, rotation, drag, shooting cooldown, and invincibility frames
- **`Asteroid`** — Three sizes (large/medium/small); randomly shaped; splits into two smaller asteroids when destroyed; wraps around screen edges
- **`Bullet`** — Projectiles with time-to-live; wraps around screen
- **`Particle`** — Short-lived explosion debris that fades out

### State Management
Global variables track:
- `ship`, `bullets`, `asteroids`, `particles` — Live entity arrays
- `score`, `lives`, `level` — Player progress
- `state` — One of `'playing'`, `'dead'`, `'gameover'`

Key functions:
- `initGame()` — Resets to start a new game
- `nextLevel()` — Advances level and spawns new asteroids
- `update(dt)` and `draw()` — Core game tick

### Input System
- `keys` map — Tracks which keys are currently held (processed by `update()` to move/rotate ship)
- `justPressed` map — Detects single-press events (e.g., spacebar to fire)

### Physics
- Toroidal space (wrap-around at screen edges)
- Ship movement uses drag-based physics (thrust accelerates, drag decelerates)
- No external physics library; all math is inline

## Common Development Tasks

Since there is no build or test suite:
- **Inspect the game**: Open `index.html` and use browser devtools console/debugger
- **Modify logic**: Edit `game.js` directly; refresh the page in the browser to see changes
- **Add features**: Follow the existing class patterns; add new entity types as ES6 classes

## Notes

- The game uses `'use strict'` at the top of `game.js`
- No minification or optimization has been applied — the code is human-readable as-is
- The project demonstrates core game development patterns (game loops, entity systems, collision detection) in pure JavaScript without external dependencies
