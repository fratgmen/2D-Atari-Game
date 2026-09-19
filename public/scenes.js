// Arka plan temaları. Seviye aralıkları oyuncuların gerçekte nereye kadar
// gidebildiğine göre seçildi: ölçümde oyuncuların %100'ü 3., %89'u 6., %51'i 9.,
// %26'sı 11. seviyeye ulaşıyor. Bu yüzden temalar üste değil, oynanan aralığa
// sıkıştırıldı — herkes en az bir değişim görsün, Mars ise övünme seviyesi olsun.
export const SCENES = [
  {
    id: 'day', name: 'Gündüz', fromLevel: 1,
    skyTop: '#2f6fb3', skyBottom: '#74b9e0',
    ground: '#7cbf4a', groundEdge: '#4d8a2f',
    stripes: ['#ffcc33', '#ff8a3d', '#ff5d8f'],
    starBright: null, starDim: null,     // gündüz yıldız yok
    surface: null, decor: 'sun',
    ringHalo: null,
  },
  {
    id: 'night', name: 'Gece', fromLevel: 5,
    skyTop: '#12153a', skyBottom: '#1b1f4b',
    ground: '#2a2f6b', groundEdge: '#1a1d4a',
    stripes: ['#ffcc33', '#ff8a3d', '#ff5d8f'],
    starBright: '#7a7fc4', starDim: '#343a82',
    surface: null, decor: 'moon',
    ringHalo: null,
  },
  {
    id: 'moon', name: 'Ay yüzeyi', fromLevel: 9,
    skyTop: '#04050f', skyBottom: '#0b0d22',
    ground: '#8a8fa8', groundEdge: '#5f6478',
    stripes: ['#d7dae6', '#9aa0b8', '#6f7590'],
    starBright: '#ffffff', starDim: '#8f95bb',
    surface: 'crater', decor: 'earth',
    ringHalo: null,
  },
  {
    id: 'mars', name: 'Mars', fromLevel: 13,
    skyTop: '#6b3220', skyBottom: '#a8613d',
    ground: '#a8502f', groundEdge: '#71321b',
    stripes: ['#ffcc33', '#f0ede0', '#7a3a20'],
    starBright: '#ffd9b0', starDim: '#a86b4a',
    surface: 'rock', decor: 'marsSun',
    // Kaçılacak eşyaların kırmızı halkası pas rengi zeminde kaybolur; beyaz bir
    // dış hat halkayı görünür tutar (renk körü oyuncular için kritik).
    ringHalo: '#ffffff',
  },
];

export const sceneAt = (level) => {
  let found = SCENES[0];
  for (const s of SCENES) if (level >= s.fromLevel) found = s;
  return found;
};

const rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

// İki tema arasında yumuşak geçiş için renk karışımı (ani değişim hata gibi algılanıyor).
export function mixHex(a, b, t) {
  if (!a) return b;
  if (!b) return a;
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const m = (x, y) => Math.round(x + (y - x) * t);
  return `rgb(${m(r1, r2)},${m(g1, g2)},${m(b1, b2)})`;
}
