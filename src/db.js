import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function createStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS scores (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname     TEXT    NOT NULL,
      nickname_key TEXT    NOT NULL,
      score        INTEGER NOT NULL,
      duration_ms  INTEGER NOT NULL,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scores_key   ON scores (nickname_key, score DESC);
    CREATE INDEX IF NOT EXISTS idx_scores_score ON scores (score DESC);
  `);

  // Basit migration: eski veritabanlarına karakter sütununu ekle
  const cols = db.prepare('PRAGMA table_info(scores)').all().map((c) => c.name);
  if (!cols.includes('character')) db.exec('ALTER TABLE scores ADD COLUMN character TEXT');

  const q = {
    createSession: db.prepare('INSERT INTO sessions (id, created_at) VALUES (?, ?)'),
    getSession: db.prepare('SELECT id, created_at, used FROM sessions WHERE id = ?'),
    consume: db.prepare('UPDATE sessions SET used = 1 WHERE id = ? AND used = 0'),
    prevBest: db.prepare('SELECT MAX(score) AS best FROM scores WHERE nickname_key = ?'),
    insert: db.prepare(
      'INSERT INTO scores (nickname, nickname_key, character, score, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ),
    rankOf: db.prepare(
      'SELECT COUNT(*) + 1 AS rank FROM (SELECT MAX(score) AS s FROM scores GROUP BY nickname_key) WHERE s > ?'
    ),
    // Her takma ad için yalnızca en iyi skor; eşitlikte önce ulaşan üstte.
    leaderboard: db.prepare(`
      SELECT nickname, character, MAX(score) AS score, created_at
      FROM scores GROUP BY nickname_key
      ORDER BY score DESC, created_at ASC
      LIMIT ?`),
    deleteNickname: db.prepare('DELETE FROM scores WHERE nickname_key = ?'),
    pruneSessions: db.prepare('DELETE FROM sessions WHERE created_at < ?'),
  };

  const submit = db.transaction(({ sessionId, nickname, key, character, score, durationMs, now }) => {
    if (q.consume.run(sessionId).changes !== 1) return null; // aynı oyun iki kez kaydedilemez
    const before = q.prevBest.get(key).best ?? -1;
    q.insert.run(nickname, key, character, score, durationMs, now);
    const best = Math.max(before, score);
    return { rank: q.rankOf.get(best).rank, best, isPersonalBest: score > before };
  });

  return {
    createSession: (id, now) => q.createSession.run(id, now),
    getSession: (id) => q.getSession.get(id),
    submit,
    leaderboard: (limit) =>
      q.leaderboard.all(limit).map((r, i) => ({ rank: i + 1, nickname: r.nickname, character: r.character, score: r.score })),
    deleteNickname: (key) => q.deleteNickname.run(key).changes,
    pruneSessions: (olderThan) => q.pruneSessions.run(olderThan).changes,
    close: () => db.close(),
  };
}
