// Bu tarayıcı için kalıcı, anonim bir kimlik: bir takma adı "sahiplenmek" için
// IP yerine kullanılır (IP paylaşımlı Wi-Fi'da veya mobil operatör CGNAT'ında
// birden çok kişiye ait olabilir, cihaz kimliği olmaz). Kişisel veri değildir,
// sadece bu tarayıcıya özel rastgele bir koddur.
let cached;

export function deviceId() {
  if (cached !== undefined) return cached;
  try {
    let id = localStorage.getItem('blok-device-id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('blok-device-id', id);
    }
    cached = id;
  } catch {
    cached = null; // gizli sekme / depolama kapalı: sunucu IP'ye düşer
  }
  return cached;
}
