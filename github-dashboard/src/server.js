// src/server.js — Express REST API + cron scheduler
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const cron    = require('node-cron');

const db         = require('./db');
const { runSync } = require('./sync');

const app  = express();
const PORT = process.env.PORT || 3333;
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL_MINUTES || '60', 10);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── API Routes ────────────────────────────────────────────────────────────────

// GET /api/summary — headline stats
app.get('/api/summary', (req, res) => {
  const { repo, author, since, until } = req.query;
  try {
    const prStats  = db.getPRStats({ repo, author, since, until });
    const runStats = db.getRunStats({ repo, since, until });
    const lastSync = db.getLastSync();
    res.json({ ...prStats, ...runStats, lastSync });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/prs — list pull requests
app.get('/api/prs', (req, res) => {
  const { repo, author, since, until, state } = req.query;
  try {
    res.json(db.listPRs({ repo, author, since, until, state }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runs — list action runs
app.get('/api/runs', (req, res) => {
  const { repo, since, until, conclusion } = req.query;
  try {
    res.json(db.listRuns({ repo, since, until, conclusion }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/repos — distinct repos in DB
app.get('/api/repos', (_req, res) => {
  try { res.json(db.getRepos()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/authors — distinct PR authors
app.get('/api/authors', (_req, res) => {
  try { res.json(db.getAuthors()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/sync — trigger manual sync
app.post('/api/sync', async (_req, res) => {
  try {
    runSync(); // fire-and-forget
    res.json({ status: 'sync started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/status — server health
app.get('/api/status', (_req, res) => {
  const lastSync = db.getLastSync();
  res.json({
    ok: true,
    username: process.env.GITHUB_USERNAME,
    syncIntervalMinutes: SYNC_INTERVAL,
    lastSync,
  });
});

// ── Cron ──────────────────────────────────────────────────────────────────────

function startCron() {
  // Convert minutes to cron expression: every N minutes
  const cronExpr = `*/${SYNC_INTERVAL} * * * *`;
  console.log(`⏱  Scheduled sync every ${SYNC_INTERVAL} min (cron: ${cronExpr})`);
  cron.schedule(cronExpr, () => {
    console.log('⏰  Cron triggered sync');
    runSync().catch(console.error);
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`\n🚀  GitHub Dashboard running at http://localhost:${PORT}`);
  console.log(`    User: ${process.env.GITHUB_USERNAME || '(not set)'}`);

  startCron();

  // Initial sync on startup
  console.log('\n🔄  Running initial sync...');
  runSync().catch(console.error);
});
