require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getPool } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/leaves',        require('./routes/leaves'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics',     require('./routes/analytics'));

// ── Page routes ───────────────────────────────────────────────────────────────
const pages = ['student', 'advisor', 'hod', 'principal', 'admin'];
pages.forEach(page => {
  app.get(`/${page}.html`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pages', `${page}.html`));
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard', 'index.html'));
});

app.get('/dashboard/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard', 'index.html'));
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: err.message });
  }
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await getPool(); // establish DB connection on startup
    app.listen(PORT, () => {
      console.log(`\n🚀 ApprovIQ running at http://localhost:${PORT}`);
      console.log(`   Database: ${process.env.DB_DATABASE} on ${process.env.DB_SERVER}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
