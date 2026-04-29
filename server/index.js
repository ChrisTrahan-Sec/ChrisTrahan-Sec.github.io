const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public'))); // optional static files

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

// Ensure data files exist
fs.ensureFileSync(LOG_FILE);
if (!fs.readJsonSync(LOG_FILE, { throws: false })) fs.writeJsonSync(LOG_FILE, []);

fs.ensureFileSync(USERS_FILE);
if (!fs.readJsonSync(USERS_FILE, { throws: false })) fs.writeJsonSync(USERS_FILE, []);

app.post('/api/request-account', async (req, res) => {
  const { name, email, notes } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });

  const entry = { id: Date.now(), name, email, notes, created_at: new Date().toISOString() };

  // append to local JSON
  const arr = await fs.readJson(LOG_FILE).catch(() => []);
  arr.push(entry);
  await fs.writeJson(LOG_FILE, arr);

  // send email to site owner (admin@qfwllc.com) and CC Chris
  const mail = {
    from: '"QFW Site" <no-reply@qfwllc.com>',
    to: 'admin@qfwllc.com',
    cc: 'chris@qfwllc.com',
    subject: `Account request: ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nNotes: ${notes}\n\nID: ${entry.id}`
  };

  transporter.sendMail(mail, (err, info) => {
    if (err) {
      console.error('Mail error', err);
      return res.status(500).json({ error: 'Failed to send email' });
    }
    return res.json({ ok: true, id: entry.id });
  });
});

app.post('/api/create-user', async (req, res) => {
  const { name, email, password, notes } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });

  const users = await fs.readJson(USERS_FILE).catch(() => []);
  const existing = users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'A user with that email already exists' });

  const user = {
    id: Date.now(),
    name,
    email,
    password,
    notes,
    created_at: new Date().toISOString()
  };

  users.push(user);
  await fs.writeJson(USERS_FILE, users);

  return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const users = await fs.readJson(USERS_FILE).catch(() => []);
  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
