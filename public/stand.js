import { api } from './api.js';

const list = document.getElementById('board');
const urlEl = document.getElementById('url');
const qrEl = document.getElementById('qr');
let lastJson = '';
let shownUrl = null;

// Stant ekranı günlerce açık kalır: adres değişirse (PUBLIC_URL düzeltilir, sunucu
// yeni bir alan adına taşınır) QR kimse sayfayı tazelemeden kendini yeniler.
async function refreshQr() {
  try {
    const { playUrl } = await api.config();
    if (playUrl === shownUrl) return;
    shownUrl = playUrl;
    urlEl.textContent = playUrl.replace(/^https?:\/\//, '');
    qrEl.src = `/qr.svg?v=${Date.now()}`;
  } catch { /* bir sonraki turda tekrar dener */ }
}

refreshQr();
setInterval(refreshQr, 60000);

async function refresh() {
  try {
    const { entries } = await api.leaderboard(10);
    const json = JSON.stringify(entries);
    if (json === lastJson) return;
    const prevTop = lastJson ? JSON.parse(lastJson)[0]?.nickname : null;
    lastJson = json;
    if (!entries.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Henüz skor yok. İlk sen ol.';
      list.replaceChildren(li);
      return;
    }
    list.replaceChildren(...entries.map((e) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      const score = document.createElement('span');
      name.className = 'name'; name.textContent = e.nickname;
      score.className = 'pts'; score.textContent = e.score.toLocaleString('tr-TR');
      const av = document.createElement('img');
      av.className = 'avatar'; av.alt = '';
      if (e.character) av.src = `/birds/${e.character}.webp`; else av.hidden = true;
      li.append(av, name, score);
      return li;
    }));
    if (prevTop && prevTop !== entries[0].nickname) {
      list.firstElementChild.classList.add('new-leader');
    }
  } catch { /* bir sonraki turda tekrar dener */ }
}

refresh();
setInterval(refresh, 4000);
