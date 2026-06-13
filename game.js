'use strict';

// ════════════════════════════════════════════════════════════════════════════
//  Asteroids — render sobre PixiJS v8 (WebGL)
//  La lógica de juego (física toroidal, colisiones, estados, IA) se mantiene;
//  cada entidad sincroniza un objeto PIXI en su método sync().
// ════════════════════════════════════════════════════════════════════════════

const W = 800;
const H = 600;

// ── Paletas de color ────────────────────────────────────────────────────────
const COL_SHIP   = 0xffffff;
const COL_THRUST = [0xff8800, 0xffbb33, 0xff6600];
const COL_AST    = [0x99ccff, 0xbcd6ff, 0xffffff];   // debris de asteroide
const COL_DEATH  = [0xffaa00, 0xff6600, 0xffdd33];   // explosión de nave
const COL_HUNTER = 0xff5533;

const PU_DEFS = {
  triple: { color: 0x00ffff, label: '3x', tag: '3X DISPARO' },
  bomb:   { color: 0xff5533, label: 'B',  tag: 'BOMBA'      },
  magnet: { color: 0xffcc00, label: 'M',  tag: 'IMAN'       },
  life:   { color: 0x33ff66, label: '+1', tag: '1UP'        },
};

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyB', 'ShiftLeft'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pick  = arr => arr[randInt(0, arr.length - 1)];

// ── PixiJS: app, capas y filtros (se inicializan en main) ───────────────────────
let app;
const layers = {};
const LAYER_ORDER = [
  'starfield', 'particle', 'shockwave',
  'asteroid', 'hunter', 'powerup', 'bullet', 'ship', 'hud',
];

function buildLayers() {
  for (const name of LAYER_ORDER) {
    layers[name] = new PIXI.Container();
    app.stage.addChild(layers[name]);
  }
}

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;

    // Halo azulado + núcleo blanco (resplandor neón sin filtros)
    this.gfx = new PIXI.Graphics()
      .circle(0, 0, 5).fill({ color: 0x88ddff, alpha: 0.22 })
      .circle(0, 0, this.radius).fill(0xffffff);
    layers.bullet.addChild(this.gfx);
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  sync() {
    this.gfx.x = this.x;
    this.gfx.y = this.y;
  }

  destroy() { this.gfx.destroy(); }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

const HUNTER_POINTS = 250;
const HUNTER_SPEED  = 90;
const HUNTER_RADIUS = 14;
const HUNTER_HP     = 3;

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular (geometría dibujada una sola vez)
    const n = randInt(8, 13);
    const flat = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      flat.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    this.gfx = new PIXI.Graphics().poly(flat).stroke({ width: 1.5, color: 0xffffff, alpha: 0.9 });
    layers.asteroid.addChild(this.gfx);
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  sync() {
    this.gfx.x = this.x;
    this.gfx.y = this.y;
    this.gfx.rotation = this.rot;
  }

  destroy() { this.gfx.destroy(); }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() {
    this.gfx = new PIXI.Graphics();
    this.gfx.moveTo(20, 0).lineTo(-12, -9).lineTo(-7, 0).lineTo(-12, 9).closePath()
            .stroke({ width: 1.5, color: COL_SHIP });
    layers.ship.addChild(this.gfx);
    this.reset();
  }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.dead          = false;
    this.tripleShot    = 0;
    this.magnet        = 0;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot    > 0) this.tripleShot    -= dt;
    if (this.magnet        > 0) this.magnet        -= dt;

    const ROT   = 3.5;   // rad/s
    const THRUST = 260;  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      const SPREAD = Math.PI / 12;
      return [
        new Bullet(ox, oy, this.angle - SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  sync() {
    this.gfx.x = this.x;
    this.gfx.y = this.y;
    this.gfx.rotation = this.angle;
    // Parpadeo y ocultación durante invencibilidad de reaparición
    const blink = this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0;
    this.gfx.visible = !this.dead && !blink;
  }

  destroy() { this.gfx.destroy(); }
}

// ── Partículas (explosión / estela, con color) ──────────────────────────────────
class Particle {
  constructor(x, y, color = 0xffffff, opts = {}) {
    this.x  = x;
    this.y  = y;
    const angle = opts.angle != null ? opts.angle + rand(-0.4, 0.4) : rand(0, Math.PI * 2);
    const speed = opts.speed != null ? opts.speed : rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = opts.life != null ? opts.life : rand(0.4, 1.1);
    this.ttl  = this.life;
    this.size = opts.size != null ? opts.size : rand(1.4, 2.6);
    this.dead = false;

    this.gfx = new PIXI.Graphics().circle(0, 0, this.size).fill(color);
    layers.particle.addChild(this.gfx);
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  sync() {
    const a = Math.max(this.ttl / this.life, 0);
    this.gfx.x = this.x;
    this.gfx.y = this.y;
    this.gfx.alpha = a;
    this.gfx.scale.set(0.4 + a * 0.6);
  }

  destroy() { this.gfx.destroy(); }
}

// ── PowerUp (tipos: triple / bomb / magnet / life) ──────────────────────────────
class PowerUp {
  constructor(x, y, type = 'triple') {
    this.x      = x;
    this.y      = y;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 14;
    this.ttl    = 9;
    this.rot    = 0;
    this.type   = type;
    this.dead   = false;

    const def = PU_DEFS[type];
    this.gfx = new PIXI.Container();
    this.gfx.x = x; this.gfx.y = y;
    layers.powerup.addChild(this.gfx);

    // Halo de color (resplandor)
    this.gfx.addChild(new PIXI.Graphics().circle(0, 0, 18).fill({ color: def.color, alpha: 0.16 }));

    // Anillo hexagonal (rota)
    this.ring = new PIXI.Graphics();
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      pts.push(Math.cos(a) * 14, Math.sin(a) * 14);
    }
    this.ring.poly(pts).stroke({ width: 1.8, color: def.color });
    this.gfx.addChild(this.ring);

    // Etiqueta (no rota)
    this.label = new PIXI.Text({
      text: def.label,
      style: { fontFamily: 'monospace', fontWeight: 'bold', fontSize: 11, fill: def.color },
    });
    this.label.anchor.set(0.5);
    this.gfx.addChild(this.label);
  }

  update(dt) {
    // Imán: si está activo, el power-up es atraído hacia la nave
    if (ship && ship.magnet > 0 && !ship.dead) {
      const dx = ship.x - this.x;
      const dy = ship.y - this.y;
      const d  = Math.hypot(dx, dy) || 1;
      const PULL = 520;
      this.vx += (dx / d) * PULL * dt;
      this.vy += (dy / d) * PULL * dt;
      this.vx *= 0.9;
      this.vy *= 0.9;
    } else {
      this.vx *= 0.94;
      this.vy *= 0.94;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    this.rot += dt * 2.4;
    if (this.ttl <= 0) this.dead = true;
  }

  sync() {
    this.gfx.x = this.x;
    this.gfx.y = this.y;
    this.ring.rotation = this.rot;
    // Parpadeo cuando está por expirar
    const blink = this.ttl < 3 && Math.floor(this.ttl * 6) % 2 === 0;
    this.gfx.visible = !blink;
  }

  destroy() { this.gfx.destroy(); }
}

// ── Shockwave (onda expansiva de la bomba) ──────────────────────────────────────
class Shockwave {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 0;
    this.maxRadius = 340;
    this.speed = 760;
    this.dead = false;
    this.hitAst = new Set();
    this.hitHunters = new Set();

    this.gfx = new PIXI.Graphics();
    layers.shockwave.addChild(this.gfx);
  }

  update(dt) {
    this.radius += this.speed * dt;
    if (this.radius >= this.maxRadius) this.dead = true;
  }

  sync() {
    const t = this.radius / this.maxRadius;
    this.gfx.clear();
    this.gfx.circle(this.x, this.y, this.radius)
            .stroke({ width: 5 * (1 - t) + 1, color: 0x88ddff, alpha: 1 - t });
    this.gfx.circle(this.x, this.y, this.radius * 0.7)
            .stroke({ width: 2 * (1 - t), color: 0xffffff, alpha: (1 - t) * 0.5 });
  }

  destroy() { this.gfx.destroy(); }
}

// ── Hunter ──────────────────────────────────────────────────────────────────────
class Hunter {
  constructor() {
    const edge = randInt(0, 3);
    if (edge === 0) { this.x = rand(0, W); this.y = 0; }
    else if (edge === 1) { this.x = rand(0, W); this.y = H; }
    else if (edge === 2) { this.x = 0;          this.y = rand(0, H); }
    else                 { this.x = W;           this.y = rand(0, H); }

    this.vx       = 0;
    this.vy       = 0;
    this.angle    = 0;
    this.radius   = HUNTER_RADIUS;
    this.dead     = false;
    this.hp       = HUNTER_HP;
    this.maxHp    = HUNTER_HP;
    this.hitFlash = 0;
    this._flashing = null;
    this._lastHp   = -1;

    this.gfx   = new PIXI.Container();
    this.bodyG = new PIXI.Graphics();
    this.barG  = new PIXI.Graphics();
    this.gfx.addChild(this.bodyG, this.barG);
    layers.hunter.addChild(this.gfx);

    this._drawBody(false);
  }

  _drawBody(flashing) {
    const stroke = flashing ? 0xffffff : 0xff6644;
    const fill   = flashing ? 0xffffff : 0xff5500;
    const fa     = flashing ? 0.35 : 0.18;
    this.bodyG.clear();
    this.bodyG.moveTo(16, 0).lineTo(-10, -8).lineTo(-5, 0).lineTo(-10, 8).closePath()
              .fill({ color: fill, alpha: fa })
              .stroke({ width: 1.8, color: stroke });
    this.bodyG.circle(2, 0, 2.5).fill(0xffff44);
  }

  _drawBar() {
    const BAR_W = 28, BAR_H = 3;
    const barX  = -BAR_W / 2;
    const barY  = -HUNTER_RADIUS - 7;
    const ratio = this.hp / this.maxHp;
    const hpColor = ratio > 0.6 ? 0x00ff00 : ratio > 0.3 ? 0xffff00 : 0xff0000;
    this.barG.clear();
    this.barG.rect(barX - 1, barY - 1, BAR_W + 2, BAR_H + 2).fill({ color: 0x000000, alpha: 0.6 });
    this.barG.rect(barX, barY, BAR_W, BAR_H).fill(0x444444);
    this.barG.rect(barX, barY, Math.round(BAR_W * ratio), BAR_H).fill(hpColor);
  }

  _toroidalDelta(a, b, max) {
    let d = b - a;
    if (d >  max / 2) d -= max;
    if (d < -max / 2) d += max;
    return d;
  }

  update(dt) {
    if (this.hitFlash > 0) this.hitFlash -= dt;

    const dx = this._toroidalDelta(this.x, ship.x, W);
    const dy = this._toroidalDelta(this.y, ship.y, H);
    const targetAngle = Math.atan2(dy, dx);

    const ACCEL = 180;
    this.vx += Math.cos(targetAngle) * ACCEL * dt;
    this.vy += Math.sin(targetAngle) * ACCEL * dt;

    const speed = Math.hypot(this.vx, this.vy);
    if (speed > HUNTER_SPEED) {
      this.vx = (this.vx / speed) * HUNTER_SPEED;
      this.vy = (this.vy / speed) * HUNTER_SPEED;
    }

    if (speed > 5) this.angle = Math.atan2(this.vy, this.vx);

    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  sync() {
    this.gfx.x = this.x;
    this.gfx.y = this.y;
    this.bodyG.rotation = this.angle;

    const flashing = this.hitFlash > 0;
    if (flashing !== this._flashing) { this._flashing = flashing; this._drawBody(flashing); }
    if (this.hp !== this._lastHp)    { this._lastHp = this.hp;    this._drawBar(); }
  }

  destroy() { this.gfx.destroy(); }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerups, hunters, shockwaves;
let starfield;
let score, lives, level, bombs;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;
let levelPowerupDropped;

// ── Starfield parallax ──────────────────────────────────────────────────────────
class Starfield {
  constructor() {
    this.bands = [];
    const defs = [
      { n: 70, factor: 0.06, size: 1.0, alpha: 0.45, color: 0x5577aa },
      { n: 45, factor: 0.14, size: 1.4, alpha: 0.7,  color: 0xaaccff },
      { n: 22, factor: 0.26, size: 2.0, alpha: 1.0,  color: 0xffffff },
    ];
    for (const d of defs) {
      const cont = new PIXI.Container();
      layers.starfield.addChild(cont);
      const stars = [];
      for (let i = 0; i < d.n; i++) {
        const g = new PIXI.Graphics().circle(0, 0, d.size).fill({ color: d.color, alpha: d.alpha });
        g.x = rand(0, W);
        g.y = rand(0, H);
        cont.addChild(g);
        stars.push(g);
      }
      this.bands.push({ factor: d.factor, stars });
    }
  }

  update(dt) {
    const vx = ship ? ship.vx : 0;
    const vy = ship ? ship.vy : 0;
    for (const band of this.bands) {
      for (const s of band.stars) {
        s.x = wrap(s.x - vx * band.factor * dt, W);
        s.y = wrap(s.y - vy * band.factor * dt, H);
      }
    }
  }
}

// ── HUD ──────────────────────────────────────────────────────────────────────
const hud = {};
function setupHUD() {
  const mono = (size, fill, weight = 'normal') => ({
    fontFamily: 'monospace', fontSize: size, fill, fontWeight: weight,
  });

  hud.score = new PIXI.Text({ text: '', style: mono(15, 0xffffff) });
  hud.score.x = 14; hud.score.y = 16;

  hud.level = new PIXI.Text({ text: '', style: mono(15, 0xffffff) });
  hud.level.anchor.set(0.5, 0);
  hud.level.x = W / 2; hud.level.y = 16;

  hud.tag = new PIXI.Text({ text: '', style: mono(13, 0x00ffff) });
  hud.tag.x = 14; hud.tag.y = 42;

  hud.bombs = new PIXI.Text({ text: '', style: mono(15, 0xff7755) });
  hud.bombs.x = 14; hud.bombs.y = 66;

  hud.dynamic = new PIXI.Graphics();   // iconos de vida + barra de triple

  hud.overlayTitle = new PIXI.Text({
    text: 'GAME OVER',
    style: mono(46, 0xffffff, 'bold'),
  });
  hud.overlayTitle.anchor.set(0.5);
  hud.overlayTitle.x = W / 2; hud.overlayTitle.y = H / 2 - 18;

  hud.overlaySub = new PIXI.Text({ text: '', style: mono(18, 0xaaaaaa) });
  hud.overlaySub.anchor.set(0.5);
  hud.overlaySub.x = W / 2; hud.overlaySub.y = H / 2 + 22;

  hud.overlayTitle.visible = false;
  hud.overlaySub.visible = false;

  layers.hud.addChild(
    hud.dynamic, hud.score, hud.level, hud.tag, hud.bombs,
    hud.overlayTitle, hud.overlaySub,
  );
}

function drawLifeIcon(g, x, y) {
  // Triángulo apuntando hacia arriba (nave en miniatura)
  g.moveTo(x, y - 9).lineTo(x - 5, y + 6).lineTo(x, y + 3).lineTo(x + 5, y + 6).closePath()
   .stroke({ width: 1.2, color: 0xffffff });
}

function syncHUD() {
  hud.score.text = `SCORE  ${score}`;
  hud.level.text = `NIVEL ${level}`;

  hud.dynamic.clear();
  for (let i = 0; i < lives; i++) drawLifeIcon(hud.dynamic, W - 16 - i * 22, 26);

  // Indicadores de power-ups activos
  let line = 42;
  if (ship && ship.tripleShot > 0) {
    hud.tag.visible = true;
    hud.tag.y = line;
    hud.tag.style.fill = 0x00ffff;
    hud.tag.text = '3X DISPARO';
    const t = Math.min(ship.tripleShot / 10, 1);
    hud.dynamic.rect(14, line + 18, 80, 4).fill({ color: 0xffffff, alpha: 0.15 });
    hud.dynamic.rect(14, line + 18, 80 * t, 4).fill(0x00ffff);
    line += 30;
  } else {
    hud.tag.visible = false;
  }

  if (ship && ship.magnet > 0) {
    const t = Math.min(ship.magnet / 8, 1);
    hud.dynamic.rect(14, line + 4, 80, 4).fill({ color: 0xffcc00, alpha: 0.15 });
    hud.dynamic.rect(14, line + 4, 80 * t, 4).fill(0xffcc00);
    line += 12;
  }

  hud.bombs.y = line + 6;
  hud.bombs.text = bombs > 0 ? `BOMBAS x${bombs}  [B]` : '';

  const over = state === 'gameover';
  hud.overlayTitle.visible = over;
  hud.overlaySub.visible = over;
  if (over) hud.overlaySub.text = `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`;
}

// ── Gestión de entidades ────────────────────────────────────────────────────────
function cull(arr) {
  const alive = [];
  for (const e of arr) {
    if (e.dead) e.destroy();
    else alive.push(e);
  }
  return alive;
}

function destroyAll(arr) { for (const e of arr) e.destroy(); }

function clearLevelEntities() {
  if (bullets)    destroyAll(bullets);
  if (asteroids)  destroyAll(asteroids);
  if (particles)  destroyAll(particles);
  if (powerups)   destroyAll(powerups);
  if (hunters)    destroyAll(hunters);
  if (shockwaves) destroyAll(shockwaves);
  bullets = []; asteroids = []; particles = []; powerups = []; hunters = []; shockwaves = [];
}

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  clearLevelEntities();
  if (ship) ship.destroy();
  ship = new Ship();
  if (!starfield) starfield = new Starfield();

  levelPowerupDropped = false;
  score  = 0;
  lives  = 3;
  level  = 1;
  bombs  = 1;
  state  = 'playing';
  spawnAsteroids(4);
  hunters.push(new Hunter());
}

function nextLevel() {
  level++;
  clearLevelEntities();
  levelPowerupDropped = false;
  ship.reset();
  spawnAsteroids(3 + level);
  hunters.push(new Hunter());
}

function explode(x, y, count, palette) {
  const colors = palette || COL_AST;
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y, pick(colors)));
}

function spawnThrust() {
  // Estela del propulsor: detrás de la nave, en sentido opuesto al morro
  const back = ship.angle + Math.PI;
  const bx = ship.x + Math.cos(back) * 10;
  const by = ship.y + Math.sin(back) * 10;
  particles.push(new Particle(bx, by, pick(COL_THRUST), {
    angle: back, speed: rand(60, 130), life: rand(0.2, 0.45), size: rand(1.2, 2.2),
  }));
}

function spawnMuzzle() {
  const ox = ship.x + Math.cos(ship.angle) * 22;
  const oy = ship.y + Math.sin(ship.angle) * 22;
  for (let i = 0; i < 4; i++) {
    particles.push(new Particle(ox, oy, 0x88ddff, {
      angle: ship.angle, speed: rand(80, 180), life: rand(0.1, 0.25), size: rand(1, 1.8),
    }));
  }
}

function randomPowerUpType() {
  const r = Math.random();
  if (r < 0.45) return 'triple';
  if (r < 0.72) return 'bomb';
  if (r < 0.92) return 'magnet';
  return 'life';
}

function applyPowerUp(type) {
  const def = PU_DEFS[type];
  if (type === 'triple')      ship.tripleShot = 10;
  else if (type === 'bomb')   bombs++;
  else if (type === 'magnet') ship.magnet = 8;
  else if (type === 'life')   lives++;
  explode(ship.x, ship.y, 10, [def.color, 0xffffff]);
}

function useBomb() {
  if (bombs <= 0 || ship.dead) return;
  bombs--;
  shockwaves.push(new Shockwave(ship.x, ship.y));
  explode(ship.x, ship.y, 12, [0x88ddff, 0xffffff]);
}

function killShip() {
  explode(ship.x, ship.y, 16, COL_DEATH);
  ship.dead = true;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (starfield) starfield.update(dt);

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = cull(particles);
    hunters.forEach(h => h.update(dt));
    shockwaves.forEach(s => s.update(dt));
    shockwaves = cull(shockwaves);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = cull(particles);
    asteroids.forEach(a => a.update(dt));
    powerups.forEach(p => p.update(dt));
    powerups = cull(powerups);
    hunters.forEach(h => h.update(dt));
    shockwaves.forEach(s => s.update(dt));
    shockwaves = cull(shockwaves);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    const shots = ship.tryShoot();
    if (shots.length) { bullets.push(...shots); spawnMuzzle(); }
  }

  // Bomba
  if (pressed('KeyB') || pressed('ShiftLeft')) useBomb();

  ship.update(dt);
  if (ship.thrusting && Math.random() > 0.25) spawnThrust();

  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(dt));
  particles.forEach(p => p.update(dt));
  hunters.forEach(h => h.update(dt));
  shockwaves.forEach(s => s.update(dt));

  bullets   = cull(bullets);
  particles = cull(particles);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 5, COL_AST);
        newAsteroids.push(...a.split());
        if (a.size >= 2 && (!levelPowerupDropped || Math.random() < 0.20)) {
          powerups.push(new PowerUp(a.x, a.y, randomPowerUpType()));
          levelPowerupDropped = true;
        }
      }
    }
  }
  asteroids = cull(asteroids).concat(newAsteroids);
  bullets   = cull(bullets);

  // Onda expansiva vs asteroides y Cazadores (limpia sin dividir)
  for (const s of shockwaves) {
    for (const a of asteroids) {
      if (!a.dead && !s.hitAst.has(a) && dist(s, a) < s.radius) {
        s.hitAst.add(a);
        a.dead = true;
        score += POINTS[a.size];
        explode(a.x, a.y, a.size * 4, COL_AST);
      }
    }
    for (const h of hunters) {
      if (!h.dead && !s.hitHunters.has(h) && dist(s, h) < s.radius) {
        s.hitHunters.add(h);
        h.hp--;
        h.hitFlash = 0.12;
        if (h.hp <= 0) { h.dead = true; score += HUNTER_POINTS; explode(h.x, h.y, 12, COL_DEATH); }
      }
    }
  }
  asteroids  = cull(asteroids);
  shockwaves = cull(shockwaves);

  // Bala vs Cazador
  for (const b of bullets) {
    for (const h of hunters) {
      if (!h.dead && !b.dead && dist(b, h) < h.radius) {
        b.dead = true;
        h.hp--;
        h.hitFlash = 0.12;
        if (h.hp <= 0) {
          h.dead = true;
          score += HUNTER_POINTS;
          explode(h.x, h.y, 12, COL_DEATH);
        } else {
          explode(h.x, h.y, 3, [COL_HUNTER, 0xffaa66]);
        }
      }
    }
  }
  hunters = cull(hunters);
  bullets = cull(bullets);

  // Power-up update y colisión nave-powerup
  powerups.forEach(p => p.update(dt));
  for (const p of powerups) {
    if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
      p.dead = true;
      applyPowerUp(p.type);
    }
  }
  powerups = cull(powerups);

  // Nave vs asteroide
  if (ship.invincible <= 0) {
    for (const a of asteroids) {
      if (dist(ship, a) < ship.radius + a.radius * 0.82) {
        killShip();
        break;
      }
    }
  }

  // Nave vs Cazador
  if (ship.invincible <= 0 && !ship.dead) {
    for (const h of hunters) {
      if (dist(ship, h) < ship.radius + h.radius) {
        killShip();
        break;
      }
    }
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Render: sincroniza cada entidad con su objeto PIXI ──────────────────────────
function render() {
  ship.sync();
  bullets.forEach(b => b.sync());
  asteroids.forEach(a => a.sync());
  particles.forEach(p => p.sync());
  powerups.forEach(p => p.sync());
  hunters.forEach(h => h.sync());
  shockwaves.forEach(s => s.sync());
  syncHUD();
}

// ── Loop principal ────────────────────────────────────────────────────────────
function tick(ticker) {
  const dt = Math.min(ticker.deltaMS / 1000, 0.05);
  update(dt);
  render();
}

// ── Bootstrap ───────────────────────────────────────────────────────────────────
(async function main() {
  app = new PIXI.Application();
  await app.init({
    width: W,
    height: H,
    background: 0x000000,
    antialias: true,
    preference: 'webgl',
  });
  document.getElementById('game').appendChild(app.canvas);

  buildLayers();
  setupHUD();
  initGame();

  app.ticker.add(tick);
})();
