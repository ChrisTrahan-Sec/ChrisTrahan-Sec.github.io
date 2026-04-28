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

// Ensure log file exists
fs.ensureFileSync(LOG_FILE);
if (!fs.readJsonSync(LOG_FILE, { throws: false })) fs.writeJsonSync(LOG_FILE, []);

app.post('/api/request-account', async (req, res) => {
  const { name, email, notes } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email required' });

  const entry = { id: Date.now(), name, email, notes, created_at: new Date().toISOString() };

  // append to local JSON
  const arr = await fs.readJson(LOG_FILE).catch(() => []);
  arr.push(entry);
  await fs.writeJson(LOG_FILE, arr);

  // send email to site owner (admin@qfwllc.com)
  const mail = {
    from: '"QFW Site" <no-reply@qfwllc.com>',
    to: 'admin@qfwllc.com',
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
