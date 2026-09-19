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
| Telefon | Ekranın sol/sağ yarısına basılı tutmak (altta bunun için ayrılmış bir bar var) |
| Bilgisayar | Sol/sağ yarıya basılı tutmak, ← → veya A / D tuşları |
| Her ikisi | Duraklat butonu, Esc / P tuşu; sekme değişince otomatik duraklama |

Kuş parmağın altına ışınlanmaz: basılı tutarken ivmelenip bir üst hıza (420 px/sn) ulaşır, bırakınca sürtünmeyle durur. Bu sınır, ileri seviyelerde kaçmayı zorlaştıran asıl unsurdur — eşyalar 25. seviyeden sonra kuşun yatay hızından daha hızlı düşer. Alttaki kontrol barı oyun alanının dışındadır, böylece parmak düşen eşyaların üstünü kapatmaz.

## 3. Oyun kuralları

Tüm değerler `public/rules.js` içindedir. Tarayıcı ve sunucu bu dosyayı ortak kullanır.

| Kural | Değer |
|---|---|
| Can | 3 |
| Seviye atlama | Her 12 saniyede bir, tavan 75. seviye (pratikte ulaşılamaz) |
| Düşme hızı | 175 px/sn, her seviyede %15 artar; sınırsız (20. seviyede 674, 50'de 1461 px/sn) |
| Eşya aralığı | 0,95 sn'den başlar, her seviyede kalan mesafenin %10'u kapanır, 0,07 sn'ye yaklaşır |
| Kaçılacak eşya oranı | %22'den başlar, her seviyede kalan mesafenin %7'si kapanır, %70'e yaklaşır |
| Kuşun yatay hızı | En fazla 420 px/sn, 2000 px/sn² ivmeyle |
| Toplanacak eşya | 10 × seviye puan |
| Altın yıldız (%5) | 50 × seviye puan |
| Kalp (%3, can eksikse) | +1 can |
| Kaçılacak eşyaya çarpmak | −1 can, −15 puan, 1 sn dokunulmazlık |

**Zorluk eğrisi neden düzleşmemeli:** İlk sürümde eğri 12. seviyede duruyordu; oradan sonra oyun sabit zorlukta kaldığı için iyi bir oyuncu istediği kadar hayatta kalıp puan biriktirebiliyordu (80 bin puan görüldü, teorik olarak 1 milyon mümkündü). Artık üç değişkenin hiçbiri durmaz: düşme hızı doğrusal olarak sınırsız artar, eşya aralığı ve tehlike oranı ise üstel yaklaşımla her seviyede biraz daha sıkışır — hiçbir seviyede "artık zorlaşmıyor" noktası yoktur. Kuşun yatay hızı sabit (420 px/sn) olduğundan ~15. seviyeden sonra eşyalar kuşun yetişemeyeceği kadar hızlanır; oyunu tavan değil, oyuncunun hayatta kalması bitirir.

Kabaca beklenen gidişat: 1:48'de 10. seviye (411 px/sn, saniyede 2,4 eşya), 2:48'de 15. seviye (543 px/sn, 3,7 eşya), 3:48'de 20. seviye (674 px/sn, 5,3 eşya, %58 tehlike). Ayar düğmeleri `rules.js` içinde: `levelEverySec`, `baseFall`, `fallGrowth`, `spawnDecay`, `chances.badDecay`.

Düşen eşyanın çarpışma kontrolü süpürülmüş (swept) yapılır: yüksek seviyelerde eşya tek karede yakalama kutusunun boyundan fazla yol alabildiği için yalnızca anlık konuma bakmak onu ıskalardı.

## 3b. Arka plan temaları

Oyun ilerledikçe ortam değişir (`public/scenes.js`). Aralıklar keyfî değil, oyuncuların gerçekte nereye kadar gidebildiğine göre seçildi — 300 simülasyonda oyuncuların %100'ü 3., %89'u 6., %51'i 9., %26'sı 11., %8'i 13. seviyeye ulaşıyor:

| Tema | Seviye | Zaman | Ulaşan |
|---|---|---|---|
| Gündüz | 1–4 | 0:00–0:48 | %100 |
| Gece | 5–8 | 0:48–1:36 | ~%89 |
| Ay yüzeyi | 9–12 | 1:36–2:24 | ~%51 |
| Mars | 13+ | 2:24 sonrası | ~%8 |

Temalar üst seviyelere yayılmadı; oynanan aralığa sıkıştırıldı. İlk geçiş 48. saniyede olmalı çünkü ortalama ziyaretçi ~1 dakika oynuyor — herkesin en az bir değişim görmesi, tekrar oynama isteğini yaratan şey. Ay %50'lik bir eşik, Mars ise övünme seviyesidir. Geçişler 1,6 saniyede yumuşakça karışır (ani değişim hata gibi algılanıyor) ve seviye atlama yazısı o an numara yerine ortamın adını gösterir.

İki tasarım kararı:

- **Ay ve Mars'ta yerçekimi değişmez.** Düşük yerçekimi temaya uygun olurdu ama eşyaları yavaşlatıp zorluk eğrisini tam da en kritik yerde tersine çevirirdi. Tema tamamen görseldir; fizik `rules.js`'ten gelir.
- **Mars'ta kaçılacak eşyaların halkası beyaz dış hat alır** (`ringHalo`). Kırmızı kesikli halka pas rengi zeminde kayboluyordu; bu halka renk körü oyuncular için tek ayırt edici işaret olduğundan görünürlüğü zorunlu.

**Astronot kıyafeti:** Uzaya çıkınca (ay ve mars, `suit: true`) kuş, karakterine özel astronot görseline geçer (`public/birds/<id>-suit.webp`; normal görsel `<id>.webp` gündüz/gece için). Değişim, arka plan geçişinin ortasında (t=0,5) olur ki kostüm değişimi zeminin değişimiyle aynı ana denk gelsin. Donuk bir kesme olmaması için kısa (0,5 sn) bir "puf": kuş hafifçe büyüyüp sönerken bir parıltı bulutu çıkar. Astronot görseli henüz yüklenmediyse normal görsele düşülür, kuş asla boş kalmaz.

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
│   ├── scenes.js        Arka plan temaları ve seviye aralıkları
│   ├── api.js           Sunucu istemcisi
│   ├── stand.html/.js   Stant ekranı: QR + canlı skor tablosu
│   ├── admin.html/.js   Moderasyon paneli: token ile takma ad silme
│   ├── style.css
│   └── birds/*.webp     Karakter görselleri (<id>.webp normal, <id>-suit.webp astronot)
├── Dockerfile
├── README.md            Kurulum ve çalıştırma
└── PROJECT.md           Bu doküman
```

## 7. API

| Metot | Yol | Açıklama |
|---|---|---|
| `POST` | `/api/sessions` | Oyun başında tek kullanımlık oturum açar → `{ sessionId }` |
| `POST` | `/api/scores` | `{ sessionId, nickname, character, score }` gönderir → `{ rank, best, isPersonalBest, claimCode, entries }` |
| `GET` | `/api/leaderboard?limit=10` | Her takma adın en iyi skoru, büyükten küçüğe (1–50) |
| `GET` | `/api/config` | QR'daki oyun adresi → `{ playUrl }` |
| `GET` | `/api/nicknames/:nickname/taken` | Bu ad daha önce kullanıldı mı → `{ taken }` (herkese açık, isim seçerken yumuşak uyarı için) |
| `GET` | `/api/admin/nicknames` | Tüm takma adları, en iyi skorlarını ve ödül kodlarını döner (en fazla 500); `x-admin-token` başlığı gerekir |
| `GET` | `/api/admin/scores` | Ham gönderim geçmişi (IP dahil, en fazla 300); `x-admin-token` başlığı gerekir |
| `DELETE` | `/api/admin/nicknames/:nickname` | Takma adın tüm skorlarını siler; `x-admin-token` başlığı gerekir |
| `GET` | `/qr.svg` | Oyun adresinin QR kodu |
| `GET` | `/stand` | Stant ekranı |
| `GET` | `/admin` | Moderasyon paneli: token girip listeden takma ad silme arayüzü |
| `GET` | `/healthz` | Sağlık kontrolü |

**Hata kodları:** `BAD_NICKNAME` (400), `NO_SESSION` (404), `SESSION_USED` (409), `NICKNAME_TAKEN` (409), `IMPLAUSIBLE` (422). Hız sınırı aşılırsa 429 döner.

**Hız sınırları:** Oturum açma dakikada 30, skor gönderme dakikada 20 istek (IP başına).

## 8. Veri modeli

```sql
sessions (id TEXT PK, created_at INTEGER, used INTEGER)
scores   (id INTEGER PK, nickname TEXT, nickname_key TEXT, character TEXT,
          score INTEGER, duration_ms INTEGER, created_at INTEGER, ip TEXT, owner TEXT)
```

- `nickname_key`: takma adın Türkçe kurallarla küçük harfe çevrilmiş hâli (`FIRAT` → `fırat`). Aynı kişinin skorlarını gruplamak için kullanılır.
- Skor tablosu her `nickname_key` için yalnızca en iyi skoru gösterir. Eşitlikte o skora önce ulaşan üstte yer alır.
- 6 saatten eski oturumlar yarım saatte bir temizlenir.
- `character`, `ip` ve `owner` sütunları, bu sütunlar olmadan oluşturulmuş eski veritabanlarına açılışta otomatik eklenir.

## 9. Hile koruması

Stantta birinin tarayıcı geliştirici araçlarından sahte skor göndermesi olası bir senaryo. Önlemler:

1. Oyun başında sunucu bir oturum açar ve başlangıç zamanını kaydeder.
2. Skor gönderilirken sunucu geçen süreyi hesaplar. `rules.js`'teki zorluk eğrisine göre bu sürede ulaşılabilecek en yüksek skoru (gerçekçi değerin yaklaşık 2,5 katı pay bırakarak) geçen skoru reddeder.
3. Her oturum yalnızca bir kez kullanılabilir; işlem veritabanı transaction'ı içinde yapılır.
4. Takma ad hem istemcide hem sunucuda doğrulanır: 2–16 karakter; harf, rakam, boşluk, `_ . -`.
5. Ekrana yazılan tüm kullanıcı metinleri `textContent` ile basılır, XSS'e kapalıdır.

Bu önlemler kararlı bir saldırganı tamamen durdurmaz (gerçek oyunu taklit eden bir script yazılabilir), ancak stant ortamındaki kötüye kullanımın büyük kısmını engeller. Geri kalanı için moderasyon ucu vardır.

**Aynı IP'den çok sayıda farklı ad:** `scores.ip` sütununda her gönderimin IP'si tutulur. `/admin` panelindeki "Son gönderimler" listesi, aynı IP'den 4 veya daha fazla farklı ad gönderildiğinde o satırları ⚠ ile işaretler. Bu kesin bir kanıt değildir (standın paylaşımlı Wi-Fi'ında birçok telefon aynı IP'den çıkabilir) — otomatik engelleme yapılmaz, sadece insan gözüyle kontrol için işaretlenir.

## 10. Takma ad sahipliği ve ödül teslimatı

Bir takma adı ilk kullanan ziyaretçi o adın **sahibi** olur. Başka biri aynı adla skor göndermeye çalışırsa sunucu reddeder: `409 NICKNAME_TAKEN`, *"Bu isim kullanılıyor, lütfen farklı bir isim dene."* Başlangıç ekranında da "Oyna"ya basılır basılmaz bu kontrol yapılır, oyuncu maçı bitirdikten sonra değil, oynamaya başlamadan önce öğrenir.

Sahiplik, IP değil, `public/device.js`'in tarayıcıda ürettiği rastgele bir **cihaz kimliği** (`x-device-id` başlığı) üzerinden takip edilir — çünkü Türkiye'deki mobil operatörlerin çoğu CGNAT kullanır, aynı Wi-Fi de olduğu gibi: birden fazla ziyaretçinin telefonu aynı IP'yi paylaşabilir. IP ile kilitlemek birbirini hiç tanımayan iki kişiyi "aynı kişi" sayıp haksız yere engelleyebilirdi. Cihaz kimliği her tarayıcıya özeldir (localStorage'da saklanır, kişisel veri değildir). `scores.owner` sütununda tutulur; `scores.ip` ayrı bir sütun olarak, yalnızca yukarıdaki şüpheli-IP işaretlemesi için kalmaya devam eder.

Sınırı bilinçli olarak dar tuttuk: bir cihaz istediği kadar farklı isimle oynayabilir (örn. "Adı değiştir" ile), sadece **başka birinin adını** alamaz. localStorage'ı temizleyen veya gizli sekmede oynayan biri kendi eski adını "unutur" ve o ad artık ona kilitli görünmez — bu durumda `/admin` panelinden eski kaydı silmek adı serbest bırakır.

Ayrıca her skor gönderiminde bir **ödül kodu** üretilir (`scores.id`'nin base36 hâli, örn. `9IX`), etkinlik sonu ödül teslimatında ek bir doğrulama katmanı olarak:

- Oyuncu skor gönderdiğinde, "Oyun bitti" ekranında bu kod gösterilir. Kod her zaman o an tabloda görünen rekor skora aittir — oyuncu daha düşük bir skorla tekrar oynarsa kod değişmez, yeni bir rekor kırarsa kod da güncellenir.
- `/admin` panelindeki takma ad listesinde her ismin yanında aynı kod görünür.
- Ödül verirken: ziyaretçiye ekranındaki kodu sorun, panelde o isme karşılık gelen kodla eşleşiyorsa doğru kişidir. Aynı adı kullanan başka biri farklı bir koda sahip olur, karışıklık netleşir.

Bu, kişisel veri (telefon, e-posta) toplamadan çalışan hafif bir "makbuz" sistemidir; kriptografik güvenlik iddiası taşımaz, sadece stant ortamında yeterli bir doğrulamadır.

## 11. Yapılandırma

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | `3000` | |
| `HOST` | `0.0.0.0` | |
| `PUBLIC_URL` | — | QR'a yazılacak adres. Boşsa istek adresi; localhost ise yerel ağ IP'si. Şema yazılmazsa `https://` eklenir, boşluk/tırnak/sondaki `/` temizlenir; hiç çözülemezse yok sayılır ve istek adresine düşülür (log'a uyarı düşer) |
| `DB_PATH` | `./data/scores.db` | Sunucuda kalıcı bir diske işaret etmeli |
| `ADMIN_TOKEN` | — | Moderasyon ucu için; boşsa uç devre dışıdır |
| `LOG_LEVEL` | `info` | |

## 12. Stant kurulumu

**Seçenek A — İnternette yayın (önerilen):** Dockerfile ile Railway, Fly.io veya bir VPS'e deploy edilir, `/data` için kalıcı volume bağlanır ve `PUBLIC_URL` ayarlanır. Ziyaretçiler kendi mobil verileriyle HTTPS üzerinden bağlanır.

**Seçenek B — Yerel ağ:** Laptop'ta `npm start` çalıştırılır, telefonlar aynı Wi-Fi'ye bağlanır. QR, laptop'un yerel IP'sini otomatik gösterir. Fuar Wi-Fi'larında cihazlar arası trafik çoğu zaman engellendiği için ayrı bir router gerekebilir.

**QR kod:** `/qr.svg` adresi sunucu tarafında, `PUBLIC_URL`'den (yoksa isteğin adresinden) üretilir; sessiz bölgesi standardın istediği 4 modüldür. `/stand` ekranı adresi dakikada bir kontrol eder ve değiştiyse QR'ı kendiliğinden yeniden çizer — ekran günlerce açık kalsa ve adres etkinlik sırasında düzeltilse bile kimsenin sayfayı tazelemesi gerekmez.

**Etkinlik günü kontrol listesi**

- [ ] `/stand` sayfası monitörde tam ekran açık
- [ ] QR kod farklı telefonlarla (iOS + Android) **okutulup oyunun açıldığı** görüldü
- [ ] `ADMIN_TOKEN` ayarlı, `/admin` panelinden bir kere token girilip test edildi
- [ ] Veritabanı kalıcı diskte; sunucu yeniden başlatılınca skorlar korunuyor
- [ ] Ödül vereceğiniz kişiye ekranındaki kodu sorup `/admin` panelindeki kodla eşleştirme adımı ekip içinde biliniyor
- [ ] Etkinlik öncesi test skorları temizlendi

## 13. Açık konular

- Oyunun adı: Artık blok düşmediği için "Blok Yağmuru" yerine etkinliğe uygun bir isim düşünülebilir.
- Eşya listesinin topluluk ekipleriyle revizesi.
- Dağıtım yönteminin (A veya B) seçilmesi.
- Emojiler yerine kulübe özel eşya çizimleri: `themes.js` bu genişletmeye göre tasarlandı.
