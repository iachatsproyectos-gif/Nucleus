import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'nucleus-dev-secret-change-me';

const db = new Database(join(__dirname, 'nucleus.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS maps (
    id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    name TEXT,
    encrypted TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS keep_tokens (
    user_id INTEGER PRIMARY KEY,
    access_token TEXT,
    refresh_token TEXT,
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/auth/register', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
    const token = jwt.sign({ userId: result.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token });
  } catch (e) {
    res.status(409).json({ error: 'Email already registered' });
  }
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

app.get('/maps', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT id, name, updated_at FROM maps WHERE user_id = ?').all(req.user.userId);
  res.json({ maps: rows });
});

app.get('/maps/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT encrypted, updated_at, name FROM maps WHERE user_id = ? AND id = ?')
    .get(req.user.userId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json({ encrypted: JSON.parse(row.encrypted), updatedAt: row.updated_at, name: row.name });
});

app.put('/maps/:id', authMiddleware, (req, res) => {
  const { encrypted, updatedAt, name } = req.body || {};
  if (!encrypted) return res.status(400).json({ error: 'encrypted payload required' });
  db.prepare(`
    INSERT INTO maps (id, user_id, name, encrypted, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, id) DO UPDATE SET
      encrypted = excluded.encrypted,
      updated_at = excluded.updated_at,
      name = COALESCE(excluded.name, maps.name)
  `).run(req.params.id, req.user.userId, name || null, JSON.stringify(encrypted), updatedAt || new Date().toISOString());
  res.json({ ok: true });
});

app.post('/keep/export', authMiddleware, (req, res) => {
  const { title, text } = req.body || {};
  res.json({ ok: true, note: { title, text }, message: 'Keep API stub — usa puente manual en cliente' });
});

app.get('/keep/notes', authMiddleware, (req, res) => {
  res.json({ notes: [], message: 'Keep API no configurada — usa import manual' });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Nucleus server http://localhost:${PORT}`);
});
