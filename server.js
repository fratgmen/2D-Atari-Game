import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import QRCode from 'qrcode';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createStore } from './src/db.js';
import { maxPlausibleScore, normalizeNickname, nicknameKey } from './public/rules.js';
import { CHARACTER_IDS } from './public/themes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const PUBLIC_URL = process.env.PUBLIC_URL?.replace(/\/$/, '');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, 'data', 'scores.db');
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

const store = createStore(DB_PATH);
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, trustProxy: true });

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
});
await app.register(rateLimit, { global: false });
await app.register(fastifyStatic, { root: path.join(__dirname, 'public') });

// ---------- yardımcılar ----------

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

// QR'ın göstereceği adres: PUBLIC_URL > istek adresi > (localhost ise) yerel ağ IP'si
function playUrl(req) {
  if (PUBLIC_URL) return PUBLIC_URL;
  const host = req.headers.host ?? `localhost:${PORT}`;
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host)) {
    const ip = lanAddresses()[0];
    if (ip) return `http://${ip}:${PORT}`;
  }
  return `${req.protocol}://${host}`;
}

function isAdmin(req) {
  const given = Buffer.from(String(req.headers['x-admin-token'] ?? ''));
  const expected = Buffer.from(ADMIN_TOKEN);
  return ADMIN_TOKEN.length > 0 && given.length === expected.length && timingSafeEqual(given, expected);
}

const fail = (reply, status, code, message) => reply.code(status).send({ code, message });

// ---------- API ----------

app.get('/healthz', async () => ({ ok: true }));

app.get('/api/config', async (req) => ({ playUrl: playUrl(req) }));

app.post(
  '/api/sessions',
  { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
  async () => {
    const id = randomUUID();
    store.createSession(id, Date.now());
    return { sessionId: id };
  }
);

app.post(
  '/api/scores',
  {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['sessionId', 'nickname', 'character', 'score'],
        additionalProperties: false,
        properties: {
          sessionId: { type: 'string', pattern: '^[0-9a-f-]{36}$' },
          nickname: { type: 'string', maxLength: 64 },
          character: { type: 'string', enum: CHARACTER_IDS },
          score: { type: 'integer', minimum: 0, maximum: 10000000 },
        },
      },
    },
  },
  async (req, reply) => {
    const { sessionId, score, character } = req.body;
    const nickname = normalizeNickname(req.body.nickname);
    if (!nickname) {
      return fail(reply, 400, 'BAD_NICKNAME', 'Takma ad 2–16 karakter olmalı: harf, rakam, boşluk, _ . -');
    }

    const session = store.getSession(sessionId);
    if (!session) return fail(reply, 404, 'NO_SESSION', 'Oyun oturumu bulunamadı, skor kaydedilmedi.');
    if (session.used) return fail(reply, 409, 'SESSION_USED', 'Bu oyunun skoru zaten kaydedildi.');

    const now = Date.now();
    const elapsed = now - session.created_at;
    if (score > maxPlausibleScore(elapsed)) {
      req.log.warn({ score, elapsed, nickname }, 'implausible score rejected');
      return fail(reply, 422, 'IMPLAUSIBLE', 'Bu skor oyun süresiyle uyuşmuyor, kaydedilmedi.');
    }

    const result = store.submit({
      sessionId, nickname, key: nicknameKey(nickname), character, score, durationMs: elapsed, now,
    });
    if (!result) return fail(reply, 409, 'SESSION_USED', 'Bu oyunun skoru zaten kaydedildi.');

    return { ...result, entries: store.leaderboard(10) };
  }
);

app.get(
  '/api/leaderboard',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
      },
    },
  },
  async (req, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { entries: store.leaderboard(req.query.limit) };
  }
);

// Stantta uygunsuz takma adları silmek için (ADMIN_TOKEN ayarlıysa çalışır)
app.delete('/api/admin/nicknames/:nickname', async (req, reply) => {
  if (!isAdmin(req)) return fail(reply, 401, 'UNAUTHORIZED', 'Yetkisiz.');
  const removed = store.deleteNickname(nicknameKey(req.params.nickname.trim()));
  return { removed };
});

// ---------- QR ve stant ekranı ----------

app.get('/qr.svg', async (req, reply) => {
  const svg = await QRCode.toString(playUrl(req), {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#12153a', light: '#f3efe0' },
  });
  reply.header('Cache-Control', 'no-cache').type('image/svg+xml').send(svg);
});

app.get('/stand', (req, reply) => reply.sendFile('stand.html'));

// ---------- başlat / kapat ----------

const pruneTimer = setInterval(() => store.pruneSessions(Date.now() - SESSION_TTL_MS), 30 * 60 * 1000);
pruneTimer.unref();

async function shutdown(signal) {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  store.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: PORT, host: HOST });
const lan = lanAddresses().map((ip) => `http://${ip}:${PORT}`);
app.log.info(`Oyun: ${PUBLIC_URL ?? lan[0] ?? `http://localhost:${PORT}`}  |  Stant ekranı: /stand`);
