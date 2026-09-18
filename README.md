# Blok Yağmuru

Stantta QR kodla telefonlardan oynatılan, IEEE öğrenci topluluğu temalı 2D yakalama oyunu. Oyuncu 7 IEEE topluluk kuşundan (AESS, CS, EA, EMBS, PES, RAS, WiE) birini seçer, takma ad girer; seçtiği topluluğa özel eşyaları toplar, kırmızı halkalı eşyalardan kaçar (3 can). Her 20 saniyede seviye atlar: eşyalar hızlanır, daha sık düşer, puanlar seviye ile çarpılır. Skorlar sunucudaki SQLite veritabanında kalıcıdır.

## Çalıştırma

```bash
npm install
npm start            # http://localhost:3000
```

- Oyun: `/`
- Stant ekranı (büyük QR + canlı skor tablosu): `/stand`
- Moderasyon paneli (uygunsuz adları silmek için): `/admin`

## Ortam değişkenleri

| Değişken      | Varsayılan            | Açıklama |
|---------------|-----------------------|----------|
| `PORT`        | 3000                  | |
| `PUBLIC_URL`  | —                     | QR'a yazılacak adres. Boşsa isteğin adresi, localhost ise yerel ağ IP'si kullanılır. |
| `DB_PATH`     | `./data/scores.db`    | SQLite dosyası. Sunucuda kalıcı bir diske işaret etmeli. |
| `ADMIN_TOKEN` | —                     | Uygunsuz takma adları silmek için. |

Uygunsuz bir adı silmek: `https://ADRES/admin` adresini açın, `ADMIN_TOKEN` değerini bir kere girin, listeden ilgili adın yanındaki "Sil"e basın. Token tarayıcıda saklanır, standdaki laptopta tekrar girmeniz gerekmez.

Komut satırından silmek isterseniz:

```bash
curl -X DELETE -H "x-admin-token: $ADMIN_TOKEN" https://ADRES/api/admin/nicknames/kotu-isim
```

## Stant için iki seçenek

1. **İnternette yayınla (önerilen):** Railway, Fly.io veya bir VPS'e Dockerfile ile deploy et, `/data` için kalıcı volume bağla, `PUBLIC_URL`'i ayarla. Ziyaretçiler kendi mobil verileriyle bağlanır, HTTPS olur.
2. **Yerel ağ:** Laptop'ta `npm start`, telefonlar aynı Wi-Fi'ye bağlanır. `/stand` sayfası QR'a otomatik olarak laptop'un yerel IP'sini koyar. Fuar Wi-Fi'larında cihazlar arası trafik çoğu zaman engellidir, kendi router'ını götürmek gerekir.

## Karakterleri ve eşyaları düzenleme

Her şey `public/themes.js` içinde: karakter adı, renk, toplanacak ve kaçılacak eşyalar (emoji, ad, görünme ağırlığı). Kuş görselleri `public/birds/<id>.webp` (arka planı temizlenmiş, 256 px). Yeni karakter eklemek için dosyaya bir kayıt ve aynı id ile bir görsel eklemek yeterli; sunucu karakter listesini de bu dosyadan doğrular.

## Mimari

- `public/rules.js` — zorluk eğrisi, puanlama, takma ad kuralı. Tarayıcı ve sunucu aynı dosyayı kullanır.
- Oyun başında `POST /api/sessions` ile tek kullanımlık oturum açılır. `POST /api/scores` skoru, oturumun süresine göre mümkün olan üst sınırla karşılaştırır; aynı oturum ikinci kez kaydedilemez. Uçlar hız sınırlıdır.
- Skor tablosu her takma adın en iyi skorunu gösterir (Türkçe büyük/küçük harf duyarsız: `FIRAT` = `fırat`).
