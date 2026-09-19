// Oyun kuralları — hem tarayıcı hem sunucu bu dosyayı kullanır (tek doğruluk kaynağı).
// Sunucu, gönderilen skorun oyun süresine göre mümkün olup olmadığını buradan hesaplar.

export const RULES = Object.freeze({
  maxLives: 3,
  levelEverySec: 12,     // her 12 saniyede bir seviye atlanır
  // Tavan pratikte ulaşılamayacak kadar yüksek: oyunun sonunu tavan değil,
  // oyuncunun hayatta kalması belirlesin. (Eğri 12. seviyede dururken iyi bir
  // oyuncu sabit zorlukta sınırsız puan biriktirebiliyordu.)
  maxLevel: 75,
  baseFall: 175,         // px/sn, 1. seviyede düşme hızı
  fallGrowth: 0.15,      // seviye başına hız artışı (%15), sınırsız
  // Eşya aralığı ve tehlike oranı tabana/tavana yapışıp durmasın diye üstel
  // yaklaşım kullanılır: her seviye kalan mesafenin bir kısmını kapatır, yani
  // hiçbir seviyede zorluk artışı tamamen durmaz.
  baseSpawn: 0.95,       // sn, 1. seviyede iki eşya arası süre
  minSpawn: 0.07,        // sonsuzda yaklaşılan alt sınır
  spawnDecay: 0.90,
  badPenalty: 15,        // bombaya çarpınca kaybedilen puan
  invulnSec: 1.0,        // çarpıştıktan sonra kısa dokunulmazlık
  points: Object.freeze({ good: 10, star: 50 }), // seviye ile çarpılır
  chances: Object.freeze({ badBase: 0.22, badMax: 0.70, badDecay: 0.93, star: 0.05, heart: 0.03 }),
});

export const levelAt = (t) => Math.min(RULES.maxLevel, 1 + Math.floor(t / RULES.levelEverySec));
export const fallSpeed = (lvl) => RULES.baseFall * (1 + RULES.fallGrowth * (lvl - 1));
export const spawnInterval = (lvl) =>
  RULES.minSpawn + (RULES.baseSpawn - RULES.minSpawn) * RULES.spawnDecay ** (lvl - 1);
export const badChance = (lvl) =>
  RULES.chances.badMax - (RULES.chances.badMax - RULES.chances.badBase) * RULES.chances.badDecay ** (lvl - 1);

// Verilen sürede ulaşılabilecek skorun cömert üst sınırı.
// Her doğan eşyanın ortalama iki "iyi blok" değerinde olduğunu varsayar (gerçekte ~0.9).
export function maxPlausibleScore(elapsedMs) {
  const seconds = Math.ceil(elapsedMs / 1000) + 2;
  let total = 0;
  for (let s = 0; s < seconds; s++) {
    const lvl = levelAt(s);
    total += (1 / (spawnInterval(lvl) * 0.8)) * RULES.points.good * 2 * lvl;
  }
  return Math.ceil(total) + 500;
}

const NICK_RE = /^[\p{L}\p{N} _.\-]{2,16}$/u;

export function normalizeNickname(raw) {
  if (typeof raw !== 'string') return null;
  const n = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  return NICK_RE.test(n) ? n : null;
}

export const nicknameKey = (n) => n.toLocaleLowerCase('tr-TR');
