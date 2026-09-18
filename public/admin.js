import { api } from './api.js';

const STORAGE_KEY = 'blok-yagmuru-admin-token';

const authSection = document.getElementById('auth');
const panelSection = document.getElementById('panel');
const tokenInput = document.getElementById('token');
const authError = document.getElementById('auth-error');
const listError = document.getElementById('list-error');
const list = document.getElementById('list');
const filterInput = document.getElementById('filter');

let token = '';
let entries = [];

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

    const del = document.createElement('button');
    del.className = 'btn admin-del';
    del.type = 'button';
    del.textContent = 'Sil';
    del.addEventListener('click', () => deleteNickname(e.nickname, li));

    li.append(name, score, del);
    return li;
  }));
}

async function load() {
  listError.textContent = '';
  try {
    const res = await api.adminList(token);
    entries = res.entries;
    render();
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
    entries = entries.filter((e) => e.nickname !== nickname);
    render();
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
