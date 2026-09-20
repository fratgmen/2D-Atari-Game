import { api } from './api.js';
import { nicknameKey, levelAt } from './rules.js';

const STORAGE_KEY = 'blok-yagmuru-admin-token';
const SUSPICIOUS_THRESHOLD = 4; // aynı IP'den bu kadar farklı ad görülürse uyarı işareti konur

const authSection = document.getElementById('auth');
const panelSection = document.getElementById('panel');
const tokenInput = document.getElementById('token');
const authError = document.getElementById('auth-error');
const listError = document.getElementById('list-error');
const list = document.getElementById('list');
const rawList = document.getElementById('raw-list');
const filterInput = document.getElementById('filter');

let token = '';
let entries = [];
let rawEntries = [];

// Skorun inandırıcılığını gözle kontrol etmek için: puanlar seviyeyle çarpıldığından
// yüksek bir skor ancak uzun bir oyunla mümkün. Kısa süreli yüksek skor şüphelidir.
function durationCell(ms) {
  const el = document.createElement('span');
  el.className = 'admin-dur';
  if (!Number.isFinite(ms) || ms <= 0) { el.textContent = '—'; return el; }
  const s = Math.round(ms / 1000);
  el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} · S${levelAt(s)}`;
  el.title = 'Oyun süresi ve ulaşılan seviye';
  return el;
}

function showPanel() {
  authSection.hidden = true;
  panelSection.hidden = false;
}

function showAuth(message) {
  panelSection.hidden = true;
  authSection.hidden = false;
  authError.textContent = message ?? '';
}

function render() {
  const q = filterInput.value.trim().toLocaleLowerCase('tr-TR');
  const filtered = q ? entries.filter((e) => e.nickname.toLocaleLowerCase('tr-TR').includes(q)) : entries;

  if (!filtered.length) {
    const li = document.createElement('li');
    li.className = 'admin-empty';
    li.textContent = entries.length ? 'Eşleşen takma ad yok.' : 'Henüz skor yok.';
    list.replaceChildren(li);
    return;
  }

  list.replaceChildren(...filtered.map((e) => {
    const li = document.createElement('li');
    li.className = 'admin-row';

    const name = document.createElement('span');
    name.className = 'admin-name';
    name.textContent = e.nickname;

    const score = document.createElement('span');
    score.className = 'admin-score';
    score.textContent = e.score.toLocaleString('tr-TR');

    const code = document.createElement('span');
    code.className = 'admin-code';
    code.textContent = e.code;
    code.title = 'Ödül teslimatında oyuncudan bu kodu isteyin';

    const del = document.createElement('button');
    del.className = 'btn admin-del';
    del.type = 'button';
    del.textContent = 'Sil';
    del.addEventListener('click', () => deleteNickname(e.nickname, li));

    li.append(name, score, durationCell(e.duration_ms), code, del);
    return li;
  }));
}

// Aynı IP'den kaç farklı takma ad gönderilmiş, sayar. Standın paylaşımlı
// Wi-Fi'ında birçok telefon aynı IP'den çıkabileceği için bu kesin bir kanıt
// değil, sadece göze çarpması gereken bir örüntü.
function suspiciousIps(rows) {
  const namesByIp = new Map();
  for (const r of rows) {
    if (!r.ip) continue;
    let set = namesByIp.get(r.ip);
    if (!set) namesByIp.set(r.ip, set = new Set());
    set.add(nicknameKey(r.nickname));
  }
  return new Set([...namesByIp].filter(([, names]) => names.size >= SUSPICIOUS_THRESHOLD).map(([ip]) => ip));
}

function renderRaw() {
  if (!rawEntries.length) {
    const li = document.createElement('li');
    li.className = 'admin-empty';
    li.textContent = 'Henüz gönderim yok.';
    rawList.replaceChildren(li);
    return;
  }

  const flagged = suspiciousIps(rawEntries);

  rawList.replaceChildren(...rawEntries.map((e) => {
    const li = document.createElement('li');
    li.className = 'admin-row admin-row-raw';
    if (flagged.has(e.ip)) li.classList.add('admin-flag');

    const time = document.createElement('span');
    time.className = 'admin-time';
    time.textContent = new Date(e.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const name = document.createElement('span');
    name.className = 'admin-name';
    name.textContent = (flagged.has(e.ip) ? '⚠ ' : '') + e.nickname;

    const score = document.createElement('span');
    score.className = 'admin-score';
    score.textContent = e.score.toLocaleString('tr-TR');

    const ip = document.createElement('span');
    ip.className = 'admin-ip';
    ip.textContent = e.ip ?? '—';

    const del = document.createElement('button');
    del.className = 'btn admin-del';
    del.type = 'button';
    del.textContent = 'Sil';
    del.addEventListener('click', () => deleteNickname(e.nickname, li));

    li.append(time, name, score, durationCell(e.duration_ms), ip, del);
    return li;
  }));
}

async function load() {
  listError.textContent = '';
  try {
    const [listRes, rawRes] = await Promise.all([api.adminList(token), api.adminScores(token)]);
    entries = listRes.entries;
    rawEntries = rawRes.entries;
    render();
    renderRaw();
  } catch (err) {
    if (err.status === 401) { logout('Token geçersiz.'); return; }
    listError.textContent = err.message;
  }
}

async function deleteNickname(nickname, row) {
  if (!confirm(`"${nickname}" adının tüm skorları silinsin mi?`)) return;
  row.classList.add('busy');
  try {
    await api.adminDelete(nickname, token);
    const key = nicknameKey(nickname);
    entries = entries.filter((e) => nicknameKey(e.nickname) !== key);
    rawEntries = rawEntries.filter((e) => nicknameKey(e.nickname) !== key);
    render();
    renderRaw();
  } catch (err) {
    if (err.status === 401) { logout('Token geçersiz.'); return; }
    listError.textContent = err.message;
    row.classList.remove('busy');
  }
}

function logout(message) {
  token = '';
  localStorage.removeItem(STORAGE_KEY);
  tokenInput.value = '';
  showAuth(message);
}

document.getElementById('save-token').addEventListener('click', () => {
  const value = tokenInput.value.trim();
  if (!value) return;
  token = value;
  localStorage.setItem(STORAGE_KEY, value);
  showPanel();
  load();
});
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('save-token').click();
});
document.getElementById('refresh').addEventListener('click', load);
document.getElementById('logout').addEventListener('click', () => logout());
filterInput.addEventListener('input', render);

const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  token = saved;
  showPanel();
  load();
}
