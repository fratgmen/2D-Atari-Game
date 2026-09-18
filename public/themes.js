// Karakterler ve her karaktere özel düşen eşyalar.
// Revize için yalnızca bu dosyayı düzenlemek yeterli: emoji, ad veya ağırlık değiştirilebilir.
// weight: aynı gruptaki eşyalar arasında görünme sıklığı (büyük = daha sık).
// İleride emoji yerine kendi çiziminizi kullanmak isterseniz: { img: '/items/roket.webp', ... }

export const CHARACTERS = [
  {
    id: 'aess', name: 'AESS', society: 'Aerospace & Electronic Systems', color: '#2f6fb3',
    collect: [
      { emoji: '🚀', label: 'Roket', weight: 3 },
      { emoji: '🛰️', label: 'Uydu', weight: 3 },
      { emoji: '📡', label: 'Radar anteni', weight: 2 },
    ],
    avoid: [
      { emoji: '☄️', label: 'Göktaşı', weight: 3 },
      { emoji: '🛸', label: 'Tanımsız cisim', weight: 1 },
    ],
  },
  {
    id: 'cs', name: 'CS', society: 'Computer Society', color: '#e8833a',
    collect: [
      { emoji: '💻', label: 'Bilgisayar', weight: 3 },
      { emoji: '💾', label: 'Disket', weight: 2 },
      { emoji: '🖱️', label: 'Fare', weight: 2 },
    ],
    avoid: [
      { emoji: '🐛', label: 'Bug', weight: 3 },
      { emoji: '💣', label: 'Mantık bombası', weight: 1 },
    ],
  },
  {
    id: 'ea', name: 'EA', society: 'Educational Activities', color: '#4aa3d9',
    collect: [
      { emoji: '📚', label: 'Kitap', weight: 3 },
      { emoji: '🎓', label: 'Mezuniyet kepi', weight: 2 },
      { emoji: '✏️', label: 'Kalem', weight: 2 },
    ],
    avoid: [
      { emoji: '💤', label: 'Derste uyku', weight: 2 },
      { emoji: '📉', label: 'Düşük not', weight: 2 },
    ],
  },
  {
    id: 'embs', name: 'EMBS', society: 'Engineering in Medicine & Biology', color: '#6b2d6b',
    collect: [
      { emoji: '🧬', label: 'DNA', weight: 3 },
      { emoji: '🔬', label: 'Mikroskop', weight: 2 },
      { emoji: '🩺', label: 'Stetoskop', weight: 2 },
    ],
    avoid: [
      { emoji: '🦠', label: 'Mikrop', weight: 3 },
      { emoji: '☣️', label: 'Biyolojik tehlike', weight: 1 },
    ],
  },
  {
    id: 'pes', name: 'PES', society: 'Power & Energy Society', color: '#7cbf4a',
    collect: [
      { emoji: '🔋', label: 'Batarya', weight: 3 },
      { emoji: '💡', label: 'Ampul', weight: 2 },
      { emoji: '☀️', label: 'Güneş enerjisi', weight: 2 },
    ],
    avoid: [
      { emoji: '🪫', label: 'Boş batarya', weight: 2 },
      { emoji: '🌩️', label: 'Kısa devre fırtınası', weight: 2 },
    ],
  },
  {
    id: 'ras', name: 'RAS', society: 'Robotics & Automation Society', color: '#8e2b3f',
    collect: [
      { emoji: '🤖', label: 'Robot', weight: 3 },
      { emoji: '⚙️', label: 'Dişli', weight: 3 },
      { emoji: '🦾', label: 'Robot kol', weight: 2 },
    ],
    avoid: [
      { emoji: '💧', label: 'Su damlası', weight: 2 },
      { emoji: '🧲', label: 'Mıknatıs', weight: 2 },
    ],
  },
  {
    id: 'wie', name: 'WiE', society: 'Women in Engineering', color: '#6e3f8f',
    collect: [
      { emoji: '👩‍💻', label: 'Kadın yazılımcı', weight: 3 },
      { emoji: '👩‍🔬', label: 'Kadın bilim insanı', weight: 3 },
      { emoji: '🏆', label: 'Başarı', weight: 2 },
    ],
    avoid: [
      { emoji: '🚧', label: 'Engel', weight: 2 },
      { emoji: '🚫', label: 'Önyargı', weight: 2 },
    ],
  },
];

export const CHARACTER_IDS = CHARACTERS.map((c) => c.id);
export const getCharacter = (id) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

export function pickWeighted(list) {
  const total = list.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of list) { r -= item.weight; if (r < 0) return item; }
  return list[list.length - 1];
}
