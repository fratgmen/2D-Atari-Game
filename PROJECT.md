# Blok Yağmuru — Proje Dokümanı

IEEE öğrenci topluluğu temalı, stantta QR kodla telefonlardan oynatılan 2D yakalama oyunu.

## 1. Amaç

Etkinlik standına gelen ziyaretçiler monitördeki QR kodu okutur ve kurulum gerektirmeden telefon tarayıcısında oyunu açar. Bir IEEE topluluk karakteri seçer, takma adını girer ve oynar. Skorlar tüm oyuncular için ortak ve kalıcı bir tabloda tutulur. Tablo stanttaki büyük ekranda canlı olarak görünür, bu da standa ilgi ve rekabet çeker.

## 2. Oyun akışı

1. **Başlangıç ekranı:** Oyuncu karakter seçer, seçilen topluluğun toplanacak ve kaçılacak eşyalarını önizlemede görür, takma ad girer ve "Oyna"ya basar.
2. **Oyun:** Kuş ekranın altında sağa-sola hareket eder. Gökten topluluğa özel eşyalar düşer.
3. **Oyun sonu:** Üç can bitince skor sunucuya gönderilir. Oyuncu sıralamadaki yerini ve güncel ilk 10'u görür. "Tekrar oyna" ya da "Adı değiştir" ile devam eder.

**Kontroller**

| Cihaz | Kontrol |
|---|---|
| Telefon | Parmağı ekranda sürüklemek |
| Bilgisayar | Fare hareketi, ← → veya A / D tuşları |
| Her ikisi | Duraklat butonu, Esc / P tuşu; sekme değişince otomatik duraklama |

## 3. Oyun kuralları

Tüm değerler `public/rules.js` içindedir. Tarayıcı ve sunucu bu dosyayı ortak kullanır.

| Kural | Değer |
|---|---|
| Can | 3 |
| Seviye atlama | Her 20 saniyede bir, en fazla 12. seviye |
| Düşme hızı | 150 px/sn, her seviyede %13 artar |
| Eşya aralığı | 0,95 sn'den başlar, seviye başına 0,055 sn azalır (en az 0,32 sn) |
| Kaçılacak eşya oranı | %22'den başlar, seviye başına +%1,5 (en fazla %40) |
| Toplanacak eşya | 10 × seviye puan |
| Altın yıldız (%5) | 50 × seviye puan |
| Kalp (%3, can eksikse) | +1 can |
| Kaçılacak eşyaya çarpmak | −1 can, −15 puan, 1 sn dokunulmazlık |

## 4. Karakterler ve eşyalar

Karakter görselleri `public/birds/<id>.webp` içindedir: arka planı temizlenmiş, 256 px yüksekliğinde şeffaf WebP. Eşyalar `public/themes.js` içinde tanımlıdır. Revize için yalnızca bu dosyayı düzenlemek yeterlidir.

| Karakter | Topluluk | Topla | Kaç |
|---|---|---|---|
| AESS | Aerospace & Electronic Systems | 🚀 Roket, 🛰️ Uydu, 📡 Radar anteni | ☄️ Göktaşı, 🛸 Tanımsız cisim |
| CS | Computer Society | 💻 Bilgisayar, 💾 Disket, 🖱️ Fare | 🐛 Bug, 💣 Mantık bombası |
| EA | Educational Activities | 📚 Kitap, 🎓 Mezuniyet kepi, ✏️ Kalem | 💤 Derste uyku, 📉 Düşük not |
| EMBS | Engineering in Medicine & Biology | 🧬 DNA, 🔬 Mikroskop, 🩺 Stetoskop | 🦠 Mikrop, ☣️ Biyolojik tehlike |
| PES | Power & Energy Society | 🔋 Batarya, 💡 Ampul, ☀️ Güneş enerjisi | 🪫 Boş batarya, 🌩️ Kısa devre fırtınası |
| RAS | Robotics & Automation Society | 🤖 Robot, ⚙️ Dişli, 🦾 Robot kol | 💧 Su damlası, 🧲 Mıknatıs |
| WiE | Women in Engineering | 👩‍💻 Kadın yazılımcı, 👩‍🔬 Kadın bilim insanı, 🏆 Başarı | 🚧 Engel, 🚫 Önyargı |

Kaçılacak eşyaların etrafında kesikli, yanıp sönen kırmızı bir halka vardır. Emoji tek başına iyi mi kötü mü olduğunu anlatmadığı için bu halka eklendi; kesikli olması renk körü oyuncuların da ayırt edebilmesini sağlar.

**Yeni karakter eklemek:** `themes.js`'e bir kayıt (id, ad, renk, eşyalar) ve aynı id ile `public/birds/<id>.webp` görseli eklenir. Sunucu geçerli karakter listesini de bu dosyadan okur, ayrıca bir değişiklik gerekmez.

## 5. Teknoloji

| Katman | Seçim | Neden |
|---|---|---|
| İstemci | HTML, CSS, Canvas 2D, ES modülleri (framework yok) | Telefonda hızlı açılır, derleme adımı gerekmez |
| Sunucu | Node.js 20+, Fastify | Şema doğrulaması dahili, hızlı, sade |
| Veritabanı | SQLite (better-sqlite3, WAL modu) | Tek dosya, kurulum yok, stant ölçeği için fazlasıyla yeterli |
| Güvenlik | @fastify/helmet (CSP), @fastify/rate-limit | Güvenlik başlıkları ve istek sınırlama |
| QR | qrcode | Oyun adresini sunucu tarafında SVG olarak üretir |
| Dağıtım | Dockerfile, `/data` volume | Railway / Fly.io / VPS'e taşınabilir |

## 6. Klasör yapısı

```
blok-yagmuru/
├── server.js            Fastify sunucusu: API, QR, statik dosyalar
├── src/db.js            SQLite şeması, migration, sorgular
├── public/
│   ├── index.html       Oyun sayfası
│   ├── game.js          Oyun motoru: çizim, girdi, çarpışma, ekranlar
│   ├── rules.js         Zorluk eğrisi, puanlama, takma ad kuralı (ortak)
│   ├── themes.js        Karakterler ve eşyalar (ortak)
│   ├── api.js           Sunucu istemcisi
│   ├── stand.html/.js   Stant ekranı: QR + canlı skor tablosu
│   ├── admin.html/.js   Moderasyon paneli: token ile takma ad silme
│   ├── style.css
│   └── birds/*.webp     Karakter görselleri
├── Dockerfile
├── README.md            Kurulum ve çalıştırma
└── PROJECT.md           Bu doküman
```

## 7. API

| Metot | Yol | Açıklama |
|---|---|---|
| `POST` | `/api/sessions` | Oyun başında tek kullanımlık oturum açar → `{ sessionId }` |
| `POST` | `/api/scores` | `{ sessionId, nickname, character, score }` gönderir → `{ rank, best, isPersonalBest, entries }` |
| `GET` | `/api/leaderboard?limit=10` | Her takma adın en iyi skoru, büyükten küçüğe (1–50) |
| `GET` | `/api/config` | QR'daki oyun adresi → `{ playUrl }` |
| `GET` | `/api/admin/nicknames` | Tüm takma adları ve en iyi skorlarını döner (en fazla 500); `x-admin-token` başlığı gerekir |
| `DELETE` | `/api/admin/nicknames/:nickname` | Takma adın tüm skorlarını siler; `x-admin-token` başlığı gerekir |
| `GET` | `/qr.svg` | Oyun adresinin QR kodu |
| `GET` | `/stand` | Stant ekranı |
| `GET` | `/admin` | Moderasyon paneli: token girip listeden takma ad silme arayüzü |
| `GET` | `/healthz` | Sağlık kontrolü |

**Hata kodları:** `BAD_NICKNAME` (400), `NO_SESSION` (404), `SESSION_USED` (409), `IMPLAUSIBLE` (422). Hız sınırı aşılırsa 429 döner.

**Hız sınırları:** Oturum açma dakikada 30, skor gönderme dakikada 20 istek (IP başına).

## 8. Veri modeli

```sql
sessions (id TEXT PK, created_at INTEGER, used INTEGER)
scores   (id INTEGER PK, nickname TEXT, nickname_key TEXT, character TEXT,
          score INTEGER, duration_ms INTEGER, created_at INTEGER)
```

- `nickname_key`: takma adın Türkçe kurallarla küçük harfe çevrilmiş hâli (`FIRAT` → `fırat`). Aynı kişinin skorlarını gruplamak için kullanılır.
- Skor tablosu her `nickname_key` için yalnızca en iyi skoru gösterir. Eşitlikte o skora önce ulaşan üstte yer alır.
- 6 saatten eski oturumlar yarım saatte bir temizlenir.
- `character` sütunu, bu sütun olmadan oluşturulmuş eski veritabanlarına açılışta otomatik eklenir.

## 9. Hile koruması

Stantta birinin tarayıcı geliştirici araçlarından sahte skor göndermesi olası bir senaryo. Önlemler:

1. Oyun başında sunucu bir oturum açar ve başlangıç zamanını kaydeder.
2. Skor gönderilirken sunucu geçen süreyi hesaplar. `rules.js`'teki zorluk eğrisine göre bu sürede ulaşılabilecek en yüksek skoru (gerçekçi değerin yaklaşık 2,5 katı pay bırakarak) geçen skoru reddeder.
3. Her oturum yalnızca bir kez kullanılabilir; işlem veritabanı transaction'ı içinde yapılır.
4. Takma ad hem istemcide hem sunucuda doğrulanır: 2–16 karakter; harf, rakam, boşluk, `_ . -`.
5. Ekrana yazılan tüm kullanıcı metinleri `textContent` ile basılır, XSS'e kapalıdır.

Bu önlemler kararlı bir saldırganı tamamen durdurmaz (gerçek oyunu taklit eden bir script yazılabilir), ancak stant ortamındaki kötüye kullanımın büyük kısmını engeller. Geri kalanı için moderasyon ucu vardır.

## 10. Yapılandırma

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `3000` | |
| `HOST` | `0.0.0.0` | |
| `PUBLIC_URL` | — | QR'a yazılacak adres. Boşsa istek adresi; localhost ise yerel ağ IP'si |
| `DB_PATH` | `./data/scores.db` | Sunucuda kalıcı bir diske işaret etmeli |
| `ADMIN_TOKEN` | — | Moderasyon ucu için; boşsa uç devre dışıdır |
| `LOG_LEVEL` | `info` | |

## 11. Stant kurulumu

**Seçenek A — İnternette yayın (önerilen):** Dockerfile ile Railway, Fly.io veya bir VPS'e deploy edilir, `/data` için kalıcı volume bağlanır ve `PUBLIC_URL` ayarlanır. Ziyaretçiler kendi mobil verileriyle HTTPS üzerinden bağlanır.

**Seçenek B — Yerel ağ:** Laptop'ta `npm start` çalıştırılır, telefonlar aynı Wi-Fi'ye bağlanır. QR, laptop'un yerel IP'sini otomatik gösterir. Fuar Wi-Fi'larında cihazlar arası trafik çoğu zaman engellendiği için ayrı bir router gerekebilir.

**Etkinlik günü kontrol listesi**

- [ ] `/stand` sayfası monitörde tam ekran açık
- [ ] QR kod farklı telefonlarla (iOS + Android) test edildi
- [ ] `ADMIN_TOKEN` ayarlı, `/admin` panelinden bir kere token girilip test edildi
- [ ] Veritabanı kalıcı diskte; sunucu yeniden başlatılınca skorlar korunuyor
- [ ] Etkinlik öncesi test skorları temizlendi

## 12. Açık konular

- Oyunun adı: Artık blok düşmediği için "Blok Yağmuru" yerine etkinliğe uygun bir isim düşünülebilir.
- Eşya listesinin topluluk ekipleriyle revizesi.
- Dağıtım yönteminin (A veya B) seçilmesi.
- Emojiler yerine kulübe özel eşya çizimleri: `themes.js` bu genişletmeye göre tasarlandı.
