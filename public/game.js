import {
  RULES, levelAt, fallSpeed, spawnInterval, badChance, normalizeNickname, nicknameKey,
} from './rules.js';
import { api } from './api.js';
import { CHARACTERS, getCharacter, pickWeighted } from './themes.js';

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
  finalScore: $('final-score'), rank: $('rank'),
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
const BIRD = { w: 84, speed: 480 }; // yükseklik görsel oranından hesaplanır
const HEART = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];

// ---------- durum ----------
const game = {
  state: 'start',           // start | playing | paused | over
  items: [], texts: [], sparks: [],
  score: 0, lives: RULES.maxLives, time: 0,
  spawnIn: 0.4, invuln: 0, shake: 0,
  nickname: '', character: CHARACTERS[0], sessionPromise: null,
  player: { x: W / 2, targetX: null, vx: 0, tilt: 0, bounce: 0 },
  lastLevel: 1,
};
const keys = { left: false, right: false };
let view = { s: 1, ox: 0, oy: 0, dpr: 1 };
let stars = [];
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
  const top = H - GROUND - h + 6;
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
  stars = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: Math.random() * (H - GROUND), b: Math.random() }));
  game.player.x = clamp(game.player.x, BIRD.w / 2, W - BIRD.w / 2);
}

// ---------- girdi ----------
function toLogicalX(clientX) {
  const r = canvas.getBoundingClientRect();
  return (clientX - r.left - view.ox) / view.s;
}
canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing') return;
  canvas.setPointerCapture(e.pointerId);
  game.player.targetX = toLogicalX(e.clientX);
});
canvas.addEventListener('pointermove', (e) => {
  if (game.state === 'playing') game.player.targetX = toLogicalX(e.clientX);
});

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
addEventListener('blur', () => { keys.left = keys.right = false; });

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
    const before = p.x;
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (dir) { p.targetX = null; p.x += dir * BIRD.speed * dt; }
    else if (p.targetX != null) p.x += (p.targetX - p.x) * Math.min(1, dt * 20);
    p.x = clamp(p.x, BIRD.w / 2, W - BIRD.w / 2);
    p.vx = dt > 0 ? (p.x - before) / dt : 0;
    game.invuln = Math.max(0, game.invuln - dt);
    if (level !== game.lastLevel) {
      game.lastLevel = level;
      floatText(`Seviye ${level}`, W / 2, H * 0.42, '#ffcc33', true);
    }
  }
  p.tilt += (clamp(p.vx / 1400, -0.28, 0.28) - p.tilt) * Math.min(1, dt * 12);
  p.bounce = Math.max(0, p.bounce - dt);

  game.spawnIn -= dt;
  if (game.spawnIn <= 0) {
    spawn(level, playing);
    game.spawnIn = spawnInterval(level) * (playing ? rand(0.8, 1.2) : 2.4);
  }

  const box = catchBox();
  for (const it of game.items) {
    it.y += it.vy * dt;
    it.rot += it.spin * dt;
    if (playing && !it.dead &&
        it.y + it.h >= box.y && it.y <= box.y + box.h &&
        it.x + it.w >= box.x && it.x <= box.x + box.w) {
      collect(it, level);
      if (game.state !== 'playing') break;
    }
    if (it.y > H + 10) it.dead = true;
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
function drawItem(it) {
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
  const baseY = H - GROUND + 4;
  // gölge
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.ellipse(p.x, H - GROUND + 4, w * 0.34, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(p.x, baseY);
  ctx.rotate(p.tilt);
  ctx.scale(1 + squash, 1 - squash);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
}

function draw() {
  const { s, ox, oy, dpr } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#12153a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let sx = 0, sy = 0;
  if (game.shake > 0) { const m = game.shake * 16; sx = rand(-m, m); sy = rand(-m, m); }
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (ox + sx), dpr * (oy + sy));

  ctx.fillStyle = '#1b1f4b';
  ctx.fillRect(0, 0, W, H);
  for (const st of stars) {
    ctx.fillStyle = st.b > 0.75 ? '#7a7fc4' : '#343a82';
    ctx.fillRect(st.x | 0, st.y | 0, 2, 2);
  }

  // zemin + Atari şeritleri
  const gy = H - GROUND;
  ctx.fillStyle = '#2a2f6b'; ctx.fillRect(0, gy, W, GROUND);
  ctx.fillStyle = '#ffcc33'; ctx.fillRect(0, gy, W, 4);
  ctx.fillStyle = '#ff8a3d'; ctx.fillRect(0, gy + 7, W, 3);
  ctx.fillStyle = '#ff5d8f'; ctx.fillRect(0, gy + 13, W, 2);

  for (const it of game.items) drawItem(it);

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
  Object.assign(game.player, { x: W / 2, targetX: null, vx: 0, tilt: 0, bounce: 0 });
  game.lastLevel = 1;
  Object.assign(hudCache, { score: -1, level: -1, lives: -1 });
  // Oturum sunucuda oyun başında açılır; skor gönderilirken süre buradan doğrulanır.
  game.sessionPromise = api.startSession().then((r) => r.sessionId).catch(() => null);
  show(null);
}

function pauseGame() { game.state = 'paused'; keys.left = keys.right = false; show(ui.pause); ui.resume.focus(); }
function resumeGame() { game.state = 'playing'; show(null); }

async function endGame() {
  game.state = 'over';
  const token = runId;
  ui.finalScore.textContent = game.score.toLocaleString('tr-TR');
  ui.rank.textContent = 'Skor kaydediliyor…';
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
    renderBoard(ui.boardOver, r.entries);
  } catch (err) {
    if (token !== runId) return;
    ui.rank.textContent = err.message;
    refreshBoard(ui.boardOver);
  }
}

ui.form.addEventListener('submit', (e) => {
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
  ui.nick.blur();
  game.nickname = n;
  try { localStorage.setItem('blok-nickname', n); } catch { /* gizli sekme */ }
  startGame();
});
// Yazarken, aynı adın skor tablosunda zaten var olup olmadığını yumuşak bir
// uyarıyla gösterir (engellemez — ad tekilliği garanti edilmiyor, iki farklı
// ziyaretçi aynı adı seçebilir, bu sadece bilgilendirme).
let nickCheckToken = 0;
ui.nick.addEventListener('input', () => {
  ui.nickError.textContent = '';
  ui.nickHint.textContent = '';
  const n = normalizeNickname(ui.nick.value);
  if (!n) return;
  const token = ++nickCheckToken;
  setTimeout(() => {
    if (token !== nickCheckToken) return; // kullanıcı yazmaya devam etti, eski sonuç geçersiz
    api.nicknameTaken(n).then(({ taken }) => {
      if (token === nickCheckToken) {
        ui.nickHint.textContent = taken ? 'Bu isim skor tablosunda var. Sensen sorun yok, değilsen farklı bir ad dene.' : '';
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
  refreshBoard(ui.boardStart, 5);
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
refreshBoard(ui.boardStart, 5);
requestAnimationFrame(frame);
