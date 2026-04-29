const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..')));

const UPLOADS_DIR = path.join(__dirname, 'uploads');
fs.ensureDirSync(UPLOADS_DIR);
app.use('/uploads', express.static(UPLOADS_DIR));
const upload = multer({ dest: UPLOADS_DIR });

// Replace with your email SMTP settings (example uses qfwllc domain)
// e.g., host: 'smtp.qfwllc.com' or use your provider (Gmail/Outlook) with app password
const transporter = nodemailer.createTransport({
  host: 'smtp.qfwllc.com',
  port: 587,
  secure: false,
  auth: { user: 'no-reply@qfwllc.com', pass: 'your_smtp_password' }
});

const LOG_FILE = path.join(__dirname, 'requests.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const DB_FILE = path.join(__dirname, 'data.db');

const db = new sqlite3.Database(DB_FILE);
const runAsync = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (err) {
  if (err) reject(err); else resolve(this);
}));
const getAsync = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => {
  if (err) reject(err); else resolve(row);
}));
const allAsync = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => {
  if (err) reject(err); else resolve(rows);
}));

async function initDatabase() {
  await runAsync(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    coin_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    rarity TEXT,
    purchase_price REAL,
    purchase_date TEXT,
    photo_url TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  fs.ensureFileSync(LOG_FILE);
  if (!fs.readJsonSync(LOG_FILE, { throws: false })) fs.writeJsonSync(LOG_FILE, []);

  fs.ensureFileSync(USERS_FILE);
  if (!fs.readJsonSync(USERS_FILE, { throws: false })) fs.writeJsonSync(USERS_FILE, []);

  const legacyUsers = await fs.readJson(USERS_FILE).catch(() => []);
  for (const legacy of legacyUsers) {
    const existing = await getAsync('SELECT id, password FROM users WHERE lower(email) = lower(?)', [legacy.email]);
    if (!existing) {
      await runAsync(
        'INSERT INTO users (name, email, password, notes, created_at) VALUES (?, ?, ?, ?, ?)',
        [legacy.name, legacy.email, legacy.password, legacy.notes || null, legacy.created_at || new Date().toISOString()]
      );
    } else if (!existing.password && legacy.password) {
      await runAsync('UPDATE users SET password = ? WHERE id = ?', [legacy.password, existing.id]);
    }
  }
}

initDatabase().catch((err) => {
  console.error('Failed to initialize database', err);
  process.exit(1);
});

app.post('/api/request-account', async (req, res) => {
  const { name, email, notes } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });

  const entry = { id: Date.now(), name, email, notes, created_at: new Date().toISOString() };

  const arr = await fs.readJson(LOG_FILE).catch(() => []);
  arr.push(entry);
  await fs.writeJson(LOG_FILE, arr);

  const mail = {
    from: '"QFW Site" <no-reply@qfwllc.com>',
    to: 'admin@qfwllc.com',
    cc: 'chris@qfwllc.com',
    subject: `Account request: ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nNotes: ${notes}\n\nID: ${entry.id}`
  };

  transporter.sendMail(mail, (err) => {
    if (err) {
      console.error('Mail error', err);
      return res.status(500).json({ error: 'Failed to send email' });
    }
    return res.json({ ok: true, id: entry.id });
  });
});

app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.json({ ok: true, url: fileUrl });
});

app.post('/api/create-user', async (req, res) => {
  const { name, email, password, notes } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });

  const existing = await getAsync('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(409).json({ error: 'A user with that email already exists' });

  const result = await runAsync(
    'INSERT INTO users (name, email, password, notes, created_at) VALUES (?, ?, ?, ?, ?)',
    [name, email, password, notes || null, new Date().toISOString()]
  );

  const user = await getAsync('SELECT id, name, email FROM users WHERE id = ?', [result.lastID]);
  return res.json({ ok: true, user });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const user = await getAsync('SELECT id, name, email FROM users WHERE lower(email) = lower(?) AND password = ?', [email, password]);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  return res.json({ ok: true, user });
});

app.get('/api/inventory', async (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const items = await allAsync('SELECT * FROM inventory WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  return res.json(items);
});

app.post('/api/inventory', async (req, res) => {
  const { userId, coin_name, quantity, rarity, purchase_price, purchase_date, photo_url, notes } = req.body || {};
  if (!userId || !coin_name) return res.status(400).json({ error: 'userId and coin_name are required' });

  const result = await runAsync(
    `INSERT INTO inventory (user_id, coin_name, quantity, rarity, purchase_price, purchase_date, photo_url, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, coin_name, Number(quantity) || 1, rarity || null, purchase_price ? Number(purchase_price) : null, purchase_date || null, photo_url || null, notes || null, new Date().toISOString(), new Date().toISOString()]
  );

  const item = await getAsync('SELECT * FROM inventory WHERE id = ?', [result.lastID]);
  return res.json({ ok: true, item });
});

app.put('/api/inventory/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { userId, coin_name, quantity, rarity, purchase_price, purchase_date, photo_url, notes } = req.body || {};
  if (!id || !userId) return res.status(400).json({ error: 'id and userId are required' });

  const existing = await getAsync('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [id, userId]);
  if (!existing) return res.status(404).json({ error: 'Inventory item not found' });

  const updated = {
    coin_name: coin_name !== undefined ? coin_name : existing.coin_name,
    quantity: quantity !== undefined ? Number(quantity) || 1 : existing.quantity,
    rarity: rarity !== undefined ? rarity : existing.rarity,
    purchase_price: purchase_price !== undefined ? (purchase_price === '' ? null : Number(purchase_price)) : existing.purchase_price,
    purchase_date: purchase_date !== undefined ? purchase_date : existing.purchase_date,
    photo_url: photo_url !== undefined ? photo_url : existing.photo_url,
    notes: notes !== undefined ? notes : existing.notes
  };

  await runAsync(
    `UPDATE inventory SET coin_name = ?, quantity = ?, rarity = ?, purchase_price = ?, purchase_date = ?, photo_url = ?, notes = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [updated.coin_name, updated.quantity, updated.rarity, updated.purchase_price, updated.purchase_date, updated.photo_url, updated.notes, new Date().toISOString(), id, userId]
  );

  const item = await getAsync('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [id, userId]);
  return res.json({ ok: true, item });
});

app.delete('/api/inventory/:id', async (req, res) => {
  const id = Number(req.params.id);
  const userId = Number(req.query.userId);
  if (!id || !userId) return res.status(400).json({ error: 'id and userId are required' });

  await runAsync('DELETE FROM inventory WHERE id = ? AND user_id = ?', [id, userId]);
  return res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
