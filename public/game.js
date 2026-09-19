import {
  RULES, levelAt, fallSpeed, spawnInterval, badChance, normalizeNickname, nicknameKey,
} from './rules.js';
import { api } from './api.js';
import { CHARACTERS, getCharacter, pickWeighted } from './themes.js';
import { SCENES, sceneAt, mixHex } from './scenes.js';

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const canvas = $('game');
const ctx = canvas.getContext('2d');
const ui = {
  hud: $('hud'), score: $('score'), level: $('level'), lives: $('lives'), pauseBtn: $('pause'),
  start: $('screen-start'), pause: $('screen-pause'), over: $('screen-over'),
  form: $('start-form'), nick: $('nickname'), nickError: $('nick-error'), nickHint: $('nick-hint'),
  boardStart: $('board-start'), boardOver: $('board-over'),
  finalScore: $('final-score'), rank: $('rank'), claim: $('claim'), claimCode: $('claim-code'),
  again: $('again'), changeNick: $('change-nick'), resume: $('resume'),
  picker: $('picker'), pvSociety: $('pv-society'), pvCollect: $('pv-collect'), pvAvoid: $('pv-avoid'),
  overBird: $('over-bird'),
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- sabitler ----------
const W = 360;                 // mantıksal genişlik; yükseklik ekran oranına göre
let H = 640;
const ITEM = 36;               // düşen eşya boyutu (mantıksal px)
const GROUND = 40;
const CONTROL_H = 96;          // alttaki kontrol barı: parmak oyun alanını kapatmasın
// Kuş anında parmağın altına ışınlanmıyor; ivmelenip bir üst hıza ulaşıyor.
// İleri seviyelerde kaçmayı zorlaştıran asıl şey bu sınır.
const BIRD = { w: 84, accel: 2000, maxSpeed: 420, friction: 2600 };
const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];

const groundY = () => H - CONTROL_H - GROUND; // oyun alanının alt sınırı (zemin şeridinin üstü)

// ---------- durum ----------
const game = {
  state: 'start',           // start | playing | paused | over
  items: [], texts: [], sparks: [],
  score: 0, lives: RULES.maxLives, time: 0,
  spawnIn: 0.4, invuln: 0, shake: 0,
  nickname: '', character: CHARACTERS[0], sessionPromise: null,
  player: { x: W / 2, vx: 0, tilt: 0, bounce: 0 },
  lastLevel: 1,
};
const keys = { left: false, right: false };
const pointers = new Map(); // pointerId -> 'left' | 'right' (aynı anda iki parmak olabilir)
let view = { s: 1, ox: 0, oy: 0, dpr: 1 };
let stars = [];
let surface = [];                                  // zemindeki krater/kaya lekeleri
const scene = { from: SCENES[0], to: SCENES[0], t: 1 }; // t: geçiş ilerlemesi
const SCENE_FADE = 1.6;                            // sn
let runId = 0;
const hudCache = { score: -1, level: -1, lives: -1 };

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- görseller ----------
const birdImages = new Map(CHARACTERS.map((c) => {
  const img = new Image();
  img.src = `/birds/${c.id}.webp`;
  return [c.id, img];
}));
const birdSize = () => {
  const img = birdImages.get(game.character.id);
  const ratio = img?.naturalWidth ? img.naturalHeight / img.naturalWidth : 0.92;
  return { w: BIRD.w, h: BIRD.w * ratio };
};
// Kuşun "yakalama" bölgesi: gövdenin üst yarısı
function catchBox() {
  const { w, h } = birdSize();
  const top = groundY() - h + 6;
  return { x: game.player.x - w * 0.36, y: top + h * 0.08, w: w * 0.72, h: h * 0.5 };
}

// Emojiler bir kez ekran dışı canvas'a çizilip önbelleğe alınır (her karede metin çizmek pahalı)
const emojiCache = new Map();
function emojiSprite(emoji) {
  let c = emojiCache.get(emoji);
  if (c) return c;
  const size = 128;
  c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.font = `${size * 0.78}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, size / 2, size / 2 + size * 0.04);
  emojiCache.set(emoji, c);
  return c;
}


// ---------- ölçekleme ----------
function resize() {
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  H = Math.round(clamp((W * r.height) / r.width, 560, 780));
  const s = Math.min(r.width / W, r.height / H);
  view = { s, ox: (r.width - W * s) / 2, oy: (r.height - H * s) / 2, dpr: Math.min(devicePixelRatio || 1, 3) };
  canvas.width = Math.round(r.width * view.dpr);
  canvas.height = Math.round(r.height * view.dpr);
  stars = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * groundY(), b: Math.random() }));
  surface = Array.from({ length: 11 }, () => ({
    x: Math.random() * W, o: Math.random() * (GROUND - 14) + 5,
    rx: rand(7, 20), ry: rand(2.5, 5),
  }));
  game.player.x = clamp(game.player.x, BIRD.w / 2, W - BIRD.w / 2);
}

// ---------- girdi ----------
function toLogicalX(clientX) {
  const r = canvas.getBoundingClientRect();
  return (clientX - r.left - view.ox) / view.s;
}
// Yönlendirme ekranın sol/sağ yarısına basılı tutarak yapılır (kuşa dokunarak değil):
// parmak oyun alanının ortasını kapatmaz, alttaki bar da parmaklar için ayrılmıştır.
const sideOf = (clientX) => (toLogicalX(clientX) < W / 2 ? 'left' : 'right');

function inputDir() {
  let left = keys.left;
  let right = keys.right;
  for (const side of pointers.values()) {
    if (side === 'left') left = true;
    else right = true;
  }
  return (right ? 1 : 0) - (left ? 1 : 0); // iki yan birden basılıysa dur
}

canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing') return;
  pointers.set(e.pointerId, sideOf(e.clientX));
  canvas.setPointerCapture(e.pointerId); // parmak barın dışına taşsa da bırakma olayını yakala
});
canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, sideOf(e.clientX)); // parmak ortadan karşı yana kaydı
});
const releasePointer = (e) => pointers.delete(e.pointerId);
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('lostpointercapture', releasePointer);

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.left = true; e.preventDefault(); }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.right = true; e.preventDefault(); }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (game.state === 'playing') pauseGame();
    else if (game.state === 'paused') resumeGame();
  }
});
addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') pauseGame();
});
addEventListener('blur', () => { keys.left = keys.right = false; pointers.clear(); });

// ---------- oyun mantığı ----------
function spawn(level, playing) {
  const r = Math.random();
  const bad = badChance(level);
  const { star, heart } = RULES.chances;
  let kind = 'good';
  if (r < bad) kind = 'bad';
  else if (r < bad + star) kind = 'star';
  else if (playing && r < bad + star + heart && game.lives < RULES.maxLives) kind = 'heart';

  const ch = game.character;
  const def = kind === 'good' ? pickWeighted(ch.collect) : kind === 'bad' ? pickWeighted(ch.avoid) : null;
  const size = kind === 'heart' ? 28 : kind === 'star' ? 32 : ITEM;

  game.items.push({
    kind, emoji: def?.emoji, w: size, h: size,
    x: rand(8, W - size - 8), y: -size - 4,
    vy: fallSpeed(level) * rand(0.88, 1.12) * (playing ? 1 : 0.55),
    rot: rand(-0.3, 0.3), spin: kind === 'bad' ? rand(-1.6, 1.6) : rand(-0.4, 0.4),
  });
}

function floatText(text, x, y, color, big = false) { game.texts.push({ text, x, y, color, big, t: 0 }); }

function burst(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), v = rand(60, 200);
    game.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, color, t: 0 });
  }
}

function addScore(pts, x, y, color) {
  game.score += pts;
  floatText(`+${pts}`, x, y, color);
  burst(x, y, color, 8);
}

function collect(it, level) {
  it.dead = true;
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  game.player.bounce = 0.18;
  if (it.kind === 'good') addScore(RULES.points.good * level, cx, cy, '#ffcc33');
  else if (it.kind === 'star') addScore(RULES.points.star * level, cx, cy, '#ffcc33');
  else if (it.kind === 'heart') {
    if (game.lives < RULES.maxLives) { game.lives++; floatText('+1 can', cx, cy, '#ff5d8f'); burst(cx, cy, '#ff5d8f'); }
    else addScore(RULES.points.good * level, cx, cy, '#ff5d8f');
  } else hit(cx, cy);
}

function hit(cx, cy) {
  if (game.invuln > 0) { burst(cx, cy, '#6a6fb0', 6); return; }
  game.lives--;
  game.score = Math.max(0, game.score - RULES.badPenalty);
  game.invuln = RULES.invulnSec;
  if (!reducedMotion) game.shake = 0.35;
  floatText(`-${RULES.badPenalty}`, cx, cy, '#ff3b30');
  burst(cx, cy, '#ff3b30', 18);
  navigator.vibrate?.(90);
  if (game.lives <= 0) endGame();
}

function update(dt) {
  const playing = game.state === 'playing';
  if (playing) game.time += dt;
  const level = playing ? levelAt(game.time) : 1;
  const p = game.player;

  if (playing) {
    const dir = inputDir();
    if (dir) p.vx = clamp(p.vx + dir * BIRD.accel * dt, -BIRD.maxSpeed, BIRD.maxSpeed);
    else {
      const drop = BIRD.friction * dt; // bırakınca hemen durmaz, kayarak yavaşlar
      p.vx = Math.abs(p.vx) <= drop ? 0 : p.vx - Math.sign(p.vx) * drop;
    }
    p.x += p.vx * dt;
    const half = BIRD.w / 2;
    if (p.x < half || p.x > W - half) { p.x = clamp(p.x, half, W - half); p.vx = 0; }
    game.invuln = Math.max(0, game.invuln - dt);
    if (level !== game.lastLevel) {
      const entered = sceneAt(level) !== sceneAt(game.lastLevel);
      game.lastLevel = level;
      // Atmosfer değiştiğinde seviye numarası yerine yeni ortamın adı yazılır:
      // oyuncunun ne kadar ilerlediğini en görünür anlatan şey bu.
      floatText(entered ? sceneAt(level).name : `Seviye ${level}`, W / 2, H * 0.42, '#ffcc33', true);
    }
  }

  const want = sceneAt(level);
  if (want !== scene.to) { scene.from = scene.to; scene.to = want; scene.t = 0; }
  if (scene.t < 1) scene.t = Math.min(1, scene.t + dt / SCENE_FADE);
  p.tilt += (clamp(p.vx / 1400, -0.28, 0.28) - p.tilt) * Math.min(1, dt * 12);
  p.bounce = Math.max(0, p.bounce - dt);

  game.spawnIn -= dt;
  if (game.spawnIn <= 0) {
    spawn(level, playing);
    game.spawnIn = spawnInterval(level) * (playing ? rand(0.8, 1.2) : 2.4);
  }

  const box = catchBox();
  const floorY = groundY() + GROUND;
  for (const it of game.items) {
    const prevY = it.y;
    it.y += it.vy * dt;
    it.rot += it.spin * dt;
    // Süpürülmüş çarpışma: yüksek seviyelerde eşya bir karede kutunun boyundan
    // fazla yol alabilir, sadece anlık konuma bakmak onu ıskalardı.
    if (playing && !it.dead &&
        it.y + it.h >= box.y && prevY <= box.y + box.h &&
        it.x + it.w >= box.x && it.x <= box.x + box.w) {
      collect(it, level);
      if (game.state !== 'playing') break;
    }
    if (it.y > floorY) it.dead = true;
  }
  game.items = game.items.filter((i) => !i.dead);

  for (const t of game.texts) { t.t += dt; t.y -= (t.big ? 18 : 42) * dt; }
  game.texts = game.texts.filter((t) => t.t < (t.big ? 1.4 : 0.8));
  for (const s of game.sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 520 * dt; }
  game.sparks = game.sparks.filter((s) => s.t < 0.55);
  game.shake = Math.max(0, game.shake - dt);

  if (game.state === 'playing') syncHud(level);
}

function syncHud(level) {
  if (hudCache.score !== game.score) { ui.score.textContent = game.score.toLocaleString('tr-TR'); hudCache.score = game.score; }
  if (hudCache.level !== level) { ui.level.textContent = level; hudCache.level = level; }
  if (hudCache.lives !== game.lives) {
    ui.lives.replaceChildren(...Array.from({ length: RULES.maxLives }, (_, i) => {
      const h = document.createElement('span');
      h.className = i < game.lives ? 'heart' : 'heart empty';
      return h;
    }));
    ui.lives.setAttribute('aria-label', `${game.lives} can`);
    hudCache.lives = game.lives;
  }
}

// ---------- çizim ----------
function drawItem(it, ringHalo) {
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  if (it.kind === 'good' || it.kind === 'bad') {
    if (it.kind === 'bad') {
      // Kaçılacak eşyaların etrafında kırmızı uyarı halkası — renk körü dostu olması için kesikli
      const pulse = 1 + Math.sin(performance.now() / 140) * 0.06;
      ctx.beginPath();
      ctx.arc(0, 0, it.w * 0.62 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,59,48,.22)';
      ctx.fill();
      ctx.setLineDash([5, 4]);
      if (ringHalo) {           // Mars'ın pas rengi zemininde kırmızı halka kaybolur
        ctx.lineWidth = 5.5;
        ctx.strokeStyle = ringHalo;
        ctx.stroke();
      }
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ff3b30';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.rotate(it.rot);
    ctx.drawImage(emojiSprite(it.emoji), -it.w / 2, -it.h / 2, it.w, it.h);
  } else if (it.kind === 'star') {
    const pulse = 1 + Math.sin(performance.now() / 120) * 0.08;
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 7 : 15, a = (Math.PI / 5) * i - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffcc33'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff6d6'; ctx.stroke();
  } else {
    ctx.fillStyle = '#ff5d8f';
    const px = 4;
    HEART.forEach((row, r) => [...row].forEach((c, k) => {
      if (c === '1') ctx.fillRect((k - 3.5) * px, (r - 3) * px, px, px);
    }));
  }
  ctx.restore();
}

function drawBird() {
  const img = birdImages.get(game.character.id);
  if (!img?.complete || !img.naturalWidth) return;
  const { w, h } = birdSize();
  const p = game.player;
  const squash = p.bounce > 0 ? Math.sin((p.bounce / 0.18) * Math.PI) * 0.08 : 0;
  const baseY = groundY() + 4;
  // gölge
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.ellipse(p.x, baseY, w * 0.34, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(p.x, baseY);
  ctx.rotate(p.tilt);
  ctx.scale(1 + squash, 1 - squash);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
}

// İki tema arasındaki geçişte tüm renkler karıştırılır; yıldızlar, zemin lekeleri
// ve gökyüzü cismi ise saydamlıkla açılıp kapanır.
function blendedScene() {
  const { from, to, t } = scene;
  const mix = (key) => mixHex(from[key], to[key], t);
  return {
    from, to, t,
    skyTop: mix('skyTop'), skyBottom: mix('skyBottom'),
    ground: mix('ground'), groundEdge: mix('groundEdge'),
    stripes: [0, 1, 2].map((i) => mixHex(from.stripes[i], to.stripes[i], t)),
    starBright: mix('starBright'), starDim: mix('starDim'),
    starAlpha: (from.starBright ? 1 - t : 0) + (to.starBright ? t : 0),
    surfaceAlpha: (from.surface ? 1 - t : 0) + (to.surface ? t : 0),
    ringHalo: t < 0.5 ? from.ringHalo : to.ringHalo,
  };
}

function drawDecor(sc) {
  if (sc.from !== sc.to && sc.from.decor) drawSkyBody(sc.from.decor, 1 - sc.t);
  if (sc.to.decor) drawSkyBody(sc.to.decor, sc.from === sc.to ? 1 : sc.t);
}

function drawSkyBody(kind, alpha) {
  if (alpha <= 0.02) return;
  const cx = W * 0.76, cy = H * 0.17;
  const disc = (r, color) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };
  ctx.save();
  ctx.globalAlpha = alpha;
  if (kind === 'sun') {
    disc(30, 'rgba(255,204,51,.22)');
    disc(21, '#ffcc33');
    disc(15, '#ffe9a8');
  } else if (kind === 'moon') {
    disc(20, '#e8e6d8');
    ctx.fillStyle = '#c3c0b0';
    for (const [dx, dy, r] of [[-6, -5, 4], [5, 3, 5], [-2, 8, 3]]) {
      ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'earth') {
    disc(17, '#2f6fb3');
    ctx.fillStyle = '#7cbf4a';
    for (const [dx, dy, rx, ry] of [[-5, -4, 6, 4], [6, 5, 5, 3]]) {
      ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = '#f3efe0';
    ctx.beginPath(); ctx.ellipse(cx + 1, cy - 8, 11, 3, 0.3, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'marsSun') {
    disc(18, 'rgba(255,217,176,.18)');   // toz bulutunun içinden solgun görünür
    disc(11, '#ffd9b0');
  }
  ctx.restore();
}

function draw() {
  const { s, ox, oy, dpr } = view;
  const sc = blendedScene();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#12153a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let sx = 0, sy = 0;
  if (game.shake > 0) { const m = game.shake * 16; sx = rand(-m, m); sy = rand(-m, m); }
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (ox + sx), dpr * (oy + sy));

  const gy = groundY();
  const sky = ctx.createLinearGradient(0, 0, 0, gy);
  sky.addColorStop(0, sc.skyTop);
  sky.addColorStop(1, sc.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  if (sc.starAlpha > 0) {
    ctx.globalAlpha = sc.starAlpha;
    for (const st of stars) {
      ctx.fillStyle = st.b > 0.75 ? sc.starBright : sc.starDim;
      ctx.fillRect(st.x | 0, st.y | 0, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  drawDecor(sc);

  // zemin + Atari şeritleri
  ctx.fillStyle = sc.ground; ctx.fillRect(0, gy, W, GROUND);
  if (sc.surfaceAlpha > 0) {
    ctx.globalAlpha = sc.surfaceAlpha;
    ctx.fillStyle = sc.groundEdge;
    for (const f of surface) {
      ctx.beginPath();
      ctx.ellipse(f.x, gy + f.o, f.rx, f.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = sc.stripes[0]; ctx.fillRect(0, gy, W, 4);
  ctx.fillStyle = sc.stripes[1]; ctx.fillRect(0, gy + 7, W, 3);
  ctx.fillStyle = sc.stripes[2]; ctx.fillRect(0, gy + 13, W, 2);

  for (const it of game.items) drawItem(it, sc.ringHalo);

  if (game.state !== 'start') {
    const blink = game.invuln > 0 && Math.floor(game.invuln * 10) % 2 === 0;
    if (!blink) drawBird();
  }

  for (const sp of game.sparks) {
    ctx.globalAlpha = 1 - sp.t / 0.55;
    ctx.fillStyle = sp.color;
    ctx.fillRect(sp.x | 0, sp.y | 0, 3, 3);
  }
  ctx.textAlign = 'center';
  for (const t of game.texts) {
    ctx.font = `${t.big ? 20 : 12}px "Press Start 2P", monospace`;
    ctx.globalAlpha = 1 - t.t / (t.big ? 1.4 : 0.8);
    ctx.fillStyle = '#000'; ctx.fillText(t.text, t.x + 2, t.y + 2);
    ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  drawControlBar();
}

// Parmakların durduğu alt bar: oyun alanının dışında kalır, basılı olan yan yanar.
function drawControlBar() {
  const top = H - CONTROL_H;
  const dir = game.state === 'playing' ? inputDir() : 0;

  ctx.fillStyle = '#12153a';
  ctx.fillRect(0, top, W, CONTROL_H);
  ctx.fillStyle = '#2a2f6b';
  ctx.fillRect(0, top, W, 3);
  ctx.fillRect(W / 2 - 1, top + 14, 2, CONTROL_H - 28);

  for (const side of [-1, 1]) {
    const active = dir === side;
    const cx = side < 0 ? W * 0.25 : W * 0.75;
    const cy = top + CONTROL_H / 2;
    if (active) {
      ctx.fillStyle = 'rgba(255,204,51,.12)';
      ctx.fillRect(side < 0 ? 0 : W / 2, top + 3, W / 2, CONTROL_H - 3);
    }
    ctx.fillStyle = active ? '#ffcc33' : '#6a6fb0';
    ctx.beginPath();
    ctx.moveTo(cx + 13 * side, cy);          // uç dışa bakar: solda ◀, sağda ▶
    ctx.lineTo(cx - 9 * side, cy - 15);
    ctx.lineTo(cx - 9 * side, cy + 15);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------- ekranlar ----------
function show(screen) {
  for (const el of [ui.start, ui.pause, ui.over]) el.hidden = el !== screen;
  ui.hud.hidden = !(game.state === 'playing' || game.state === 'paused');
}

function renderBoard(el, entries) {
  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Henüz skor yok. İlk sen ol.';
    el.replaceChildren(li);
    return;
  }
  const me = game.nickname ? nicknameKey(game.nickname) : null;
  el.replaceChildren(...entries.map((e) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    const pts = document.createElement('span');
    name.className = 'name'; name.textContent = e.nickname;
    pts.className = 'pts'; pts.textContent = e.score.toLocaleString('tr-TR');
    if (me && nicknameKey(e.nickname) === me) li.classList.add('me');
    li.append(avatar(e.character), name, pts);
    return li;
  }));
}

function avatar(id) {
  const img = document.createElement('img');
  img.className = 'avatar';
  img.alt = '';
  if (id) img.src = `/birds/${id}.webp`;
  else img.hidden = true;
  return img;
}

// Başlangıç ekranındaki tablo, ekran boyu elverdiği kadar satır gösterir:
// kısa telefonlarda bir satır fazlası en alttaki yazıyı ekrandan taşırıyor.
const startBoardRows = () => (innerHeight < 700 ? 3 : 4);

function refreshBoard(el, limit = 10) {
  api.leaderboard(limit)
    .then(({ entries }) => renderBoard(el, entries))
    .catch(() => {
      const li = document.createElement('li');
      li.className = 'note';
      li.textContent = 'Skor tablosu yüklenemedi.';
      el.replaceChildren(li);
    });
}

function startGame() {
  runId++;
  Object.assign(game, {
    state: 'playing', items: [], texts: [], sparks: [],
    score: 0, lives: RULES.maxLives, time: 0, spawnIn: 0.6, invuln: 0, shake: 0,
  });
  Object.assign(game.player, { x: W / 2, vx: 0, tilt: 0, bounce: 0 });
  pointers.clear();
  game.lastLevel = 1;
  Object.assign(hudCache, { score: -1, level: -1, lives: -1 });
  // Oturum sunucuda oyun başında açılır; skor gönderilirken süre buradan doğrulanır.
  game.sessionPromise = api.startSession().then((r) => r.sessionId).catch(() => null);
  show(null);
}

function pauseGame() {
  game.state = 'paused';
  keys.left = keys.right = false;
  pointers.clear();
  show(ui.pause);
  ui.resume.focus();
}
function resumeGame() { game.state = 'playing'; show(null); }

async function endGame() {
  game.state = 'over';
  const token = runId;
  ui.finalScore.textContent = game.score.toLocaleString('tr-TR');
  ui.rank.textContent = 'Skor kaydediliyor…';
  ui.claim.hidden = true;
  ui.boardOver.replaceChildren();
  ui.overBird.src = `/birds/${game.character.id}.webp`;
  show(ui.over);
  ui.again.focus();

  const sessionId = await game.sessionPromise;
  if (token !== runId) return;
  if (!sessionId) {
    ui.rank.textContent = 'Sunucuya ulaşılamadı, bu skor tabloya girmedi.';
    refreshBoard(ui.boardOver);
    return;
  }
  try {
    const r = await api.submitScore({
      sessionId, nickname: game.nickname, character: game.character.id, score: game.score,
    });
    if (token !== runId) return;
    ui.rank.textContent = r.isPersonalBest
      ? `Yeni rekorun! Sıralamada ${r.rank}. sıradasın.`
      : `En iyi skorun ${r.best.toLocaleString('tr-TR')}, sıralamada ${r.rank}. sıradasın.`;
    ui.claimCode.textContent = r.claimCode;
    ui.claim.hidden = false;
    renderBoard(ui.boardOver, r.entries);
  } catch (err) {
    if (token !== runId) return;
    ui.rank.textContent = err.message;
    refreshBoard(ui.boardOver);
  }
}

const submitBtn = ui.form.querySelector('button[type=submit]');

ui.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const n = normalizeNickname(ui.nick.value);
  if (!n) {
    ui.nickError.textContent = '2–16 karakter: harf, rakam, boşluk, _ . -';
    ui.nick.focus();
    return;
  }
  ui.nickError.textContent = '';
  ui.nickHint.textContent = '';
  ui.nick.value = n;

  // Takma ad başkasına aitse oyuna hiç başlamadan engelle — sunucu skor
  // gönderiminde zaten reddedecek, ama bunu maçı bitirdikten sonra öğrenmek kötü olur.
  submitBtn.disabled = true;
  try {
    const { taken, mine } = await api.nicknameTaken(n);
    if (taken && !mine) {
      ui.nickError.textContent = 'Bu isim kullanılıyor, lütfen farklı bir isim dene.';
      ui.nick.focus();
      return;
    }
  } catch { /* kontrol edilemedi: yine de oyna, asıl karar skor gönderiminde verilir */ }
  finally { submitBtn.disabled = false; }

  ui.nick.blur();
  game.nickname = n;
  try { localStorage.setItem('blok-nickname', n); } catch { /* gizli sekme */ }
  startGame();
});
// Yazarken, isim başkasına aitse yazmayı bitirmeden uyarır (engellemenin asıl
// yeri "Oyna" ve skor gönderimi — bu sadece erken bir ön izleme).
let nickCheckToken = 0;
ui.nick.addEventListener('input', () => {
  ui.nickError.textContent = '';
  ui.nickHint.textContent = '';
  const n = normalizeNickname(ui.nick.value);
  if (!n) return;
  const token = ++nickCheckToken;
  setTimeout(() => {
    if (token !== nickCheckToken) return; // kullanıcı yazmaya devam etti, eski sonuç geçersiz
    api.nicknameTaken(n).then(({ taken, mine }) => {
      if (token === nickCheckToken) {
        ui.nickHint.textContent = taken && !mine ? 'Bu isim alınmış. Lütfen farklı bir isim dene.' : '';
      }
    }).catch(() => {});
  }, 400);
});
ui.again.addEventListener('click', startGame);
ui.resume.addEventListener('click', resumeGame);
ui.pauseBtn.addEventListener('click', pauseGame);
ui.changeNick.addEventListener('click', () => {
  runId++;
  game.state = 'start';
  game.items = [];
  ui.nickHint.textContent = '';
  show(ui.start);
  refreshBoard(ui.boardStart, startBoardRows());
  ui.nick.focus();
  ui.nick.select();
});

// ---------- döngü ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.state !== 'paused') update(dt);
  draw();
  requestAnimationFrame(frame);
}

// ---------- karakter seçimi ----------
function selectCharacter(id) {
  const ch = getCharacter(id);
  game.character = ch;
  game.items = game.items.filter((i) => i.kind !== 'good' && i.kind !== 'bad'); // arka plandaki eşyalar yeni temaya geçsin
  stage.style.setProperty('--theme', ch.color);
  ui.pvSociety.textContent = `IEEE ${ch.society}`;
  const chips = (list) => list.map((i) => {
    const s = document.createElement('span');
    s.className = 'chip';
    s.textContent = i.emoji;
    s.title = i.label;
    s.setAttribute('aria-label', i.label);
    return s;
  });
  ui.pvCollect.replaceChildren(...chips(ch.collect));
  ui.pvAvoid.replaceChildren(...chips(ch.avoid));
  try { localStorage.setItem('blok-character', ch.id); } catch { /* gizli sekme */ }
}

function buildPicker(selectedId) {
  ui.picker.replaceChildren(...CHARACTERS.map((c) => {
    const label = document.createElement('label');
    label.className = 'pick';
    label.style.setProperty('--c', c.color);
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'character'; input.value = c.id;
    input.checked = c.id === selectedId;
    input.addEventListener('change', () => selectCharacter(c.id));
    const img = document.createElement('img');
    img.src = `/birds/${c.id}.webp`; img.alt = ''; img.width = 64; img.height = 60;
    const name = document.createElement('span');
    name.textContent = c.name;
    label.append(input, img, name);
    label.title = `IEEE ${c.society}`;
    return label;
  }));
}

let savedCharacter = null;
try { savedCharacter = localStorage.getItem('blok-character'); } catch { /* yok say */ }
const initial = getCharacter(savedCharacter).id;
buildPicker(initial);
selectCharacter(initial);

try { ui.nick.value = localStorage.getItem('blok-nickname') ?? ''; } catch { /* yok say */ }
resize();
new ResizeObserver(resize).observe(stage);
refreshBoard(ui.boardStart, startBoardRows());
requestAnimationFrame(frame);
