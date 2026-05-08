// src/db.js — SQLite database layer using better-sqlite3
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'db', 'github.db');

// Ensure db directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pull_requests (
      id          INTEGER PRIMARY KEY,
      number      INTEGER NOT NULL,
      repo        TEXT NOT NULL,
      title       TEXT NOT NULL,
      author      TEXT NOT NULL,
      state       TEXT NOT NULL,  -- open | closed | merged
      draft       INTEGER DEFAULT 0,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      merged_at   TEXT,
      url         TEXT NOT NULL,
      -- review_requested: 1 if current user is in reviewers
      review_requested INTEGER DEFAULT 0,
      UNIQUE(repo, number)
    );

    CREATE TABLE IF NOT EXISTS action_runs (
      id          INTEGER PRIMARY KEY,
      repo        TEXT NOT NULL,
      workflow    TEXT NOT NULL,
      run_number  INTEGER NOT NULL,
      status      TEXT NOT NULL,  -- queued | in_progress | completed
      conclusion  TEXT,           -- success | failure | cancelled | skipped | null
      branch      TEXT,
      triggered_by TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      url         TEXT NOT NULL,
      UNIQUE(id)
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      synced_at  TEXT NOT NULL,
      pr_count   INTEGER,
      run_count  INTEGER,
      error      TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_pr_repo    ON pull_requests(repo);
    CREATE INDEX IF NOT EXISTS idx_pr_author  ON pull_requests(author);
    CREATE INDEX IF NOT EXISTS idx_pr_state   ON pull_requests(state);
    CREATE INDEX IF NOT EXISTS idx_run_repo   ON action_runs(repo);
    CREATE INDEX IF NOT EXISTS idx_run_status ON action_runs(status);
  `);
}

// ── Pull Requests ──────────────────────────────────────────────────────────────

function upsertPR(pr) {
  const stmt = getDb().prepare(`
    INSERT INTO pull_requests
      (id, number, repo, title, author, state, draft, created_at, updated_at, merged_at, url, review_requested)
    VALUES
      (@id, @number, @repo, @title, @author, @state, @draft, @created_at, @updated_at, @merged_at, @url, @review_requested)
    ON CONFLICT(repo, number) DO UPDATE SET
      title=excluded.title, state=excluded.state, draft=excluded.draft,
      updated_at=excluded.updated_at, merged_at=excluded.merged_at,
      review_requested=excluded.review_requested
  `);
  stmt.run(pr);
}

function getPRStats({ repo, author, since, until } = {}) {
  const db = getDb();
  const filters = buildFilters({ repo, author, since, until, table: 'pull_requests' });

  const myOpen = db.prepare(`
    SELECT COUNT(*) as count FROM pull_requests
    WHERE author = ? AND state = 'open' ${filters.sql}
  `).get(filters.myUsername, ...filters.values);

  const needsReview = db.prepare(`
    SELECT COUNT(*) as count FROM pull_requests
    WHERE review_requested = 1 AND state = 'open' ${filters.sql}
  `).get(filters.myUsername, ...filters.values);

  return { myOpenPRs: myOpen.count, needsMyReview: needsReview.count };
}

function listPRs({ repo, author, since, until, state } = {}) {
  const conditions = [];
  const params = [];

  if (repo)   { conditions.push('repo = ?');    params.push(repo); }
  if (author) { conditions.push('author = ?');  params.push(author); }
  if (state)  { conditions.push('state = ?');   params.push(state); }
  if (since)  { conditions.push('updated_at >= ?'); params.push(since); }
  if (until)  { conditions.push('updated_at <= ?'); params.push(until); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  return getDb().prepare(`
    SELECT * FROM pull_requests ${where} ORDER BY updated_at DESC LIMIT 500
  `).all(...params);
}

// ── Action Runs ───────────────────────────────────────────────────────────────

function upsertRun(run) {
  const stmt = getDb().prepare(`
    INSERT INTO action_runs
      (id, repo, workflow, run_number, status, conclusion, branch, triggered_by, created_at, updated_at, url)
    VALUES
      (@id, @repo, @workflow, @run_number, @status, @conclusion, @branch, @triggered_by, @created_at, @updated_at, @url)
    ON CONFLICT(id) DO UPDATE SET
      status=excluded.status, conclusion=excluded.conclusion, updated_at=excluded.updated_at
  `);
  stmt.run(run);
}

function getRunStats({ repo, since, until } = {}) {
  const db = getDb();
  const conditions = ["status = 'completed'"];
  const params = [];

  if (repo)  { conditions.push('repo = ?');        params.push(repo); }
  if (since) { conditions.push('updated_at >= ?');  params.push(since); }
  if (until) { conditions.push('updated_at <= ?');  params.push(until); }

  const where = 'WHERE ' + conditions.join(' AND ');

  const success = db.prepare(
    `SELECT COUNT(*) as count FROM action_runs ${where} AND conclusion = 'success'`
  ).get(...params);

  const failure = db.prepare(
    `SELECT COUNT(*) as count FROM action_runs ${where} AND conclusion IN ('failure','timed_out')`
  ).get(...params);

  const inProgress = db.prepare(
    `SELECT COUNT(*) as count FROM action_runs WHERE status IN ('queued','in_progress')
     ${repo ? 'AND repo = ?' : ''}`
  ).get(...(repo ? [repo] : []));

  return {
    success: success.count,
    failure: failure.count,
    inProgress: inProgress.count,
  };
}

function listRuns({ repo, since, until, conclusion } = {}) {
  const conditions = [];
  const params = [];

  if (repo)       { conditions.push('repo = ?');        params.push(repo); }
  if (conclusion) { conditions.push('conclusion = ?');  params.push(conclusion); }
  if (since)      { conditions.push('updated_at >= ?'); params.push(since); }
  if (until)      { conditions.push('updated_at <= ?'); params.push(until); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  return getDb().prepare(`
    SELECT * FROM action_runs ${where} ORDER BY updated_at DESC LIMIT 500
  `).all(...params);
}

// ── Meta ──────────────────────────────────────────────────────────────────────

function getRepos() {
  const prs   = getDb().prepare('SELECT DISTINCT repo FROM pull_requests').all();
  const runs  = getDb().prepare('SELECT DISTINCT repo FROM action_runs').all();
  const repos = new Set([...prs, ...runs].map(r => r.repo));
  return [...repos].sort();
}

function getAuthors() {
  return getDb().prepare('SELECT DISTINCT author FROM pull_requests ORDER BY author').all().map(r => r.author);
}

function logSync({ pr_count, run_count, error } = {}) {
  getDb().prepare(`
    INSERT INTO sync_log (synced_at, pr_count, run_count, error)
    VALUES (datetime('now'), ?, ?, ?)
  `).run(pr_count ?? 0, run_count ?? 0, error ?? null);
}

function getLastSync() {
  return getDb().prepare(`SELECT * FROM sync_log ORDER BY id DESC LIMIT 1`).get();
}

function buildFilters({ repo, author, since, until }) {
  const conditions = [];
  const values = [];
  if (repo)   { conditions.push('repo = ?');    values.push(repo); }
  if (author) { conditions.push('author = ?');  values.push(author); }
  if (since)  { conditions.push('updated_at >= ?'); values.push(since); }
  if (until)  { conditions.push('updated_at <= ?'); values.push(until); }
  const sql = conditions.length ? 'AND ' + conditions.join(' AND ') : '';
  return { sql, values };
}

module.exports = {
  getDb, upsertPR, upsertRun, getPRStats, getRunStats,
  listPRs, listRuns, getRepos, getAuthors, logSync, getLastSync,
};
