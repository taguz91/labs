// src/sync.js — Fetches GitHub data and stores in SQLite
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fetch = require('node-fetch');
const db    = require('./db');

const TOKEN    = process.env.GITHUB_TOKEN;
const USERNAME = process.env.GITHUB_USERNAME;

if (!TOKEN || !USERNAME) {
  console.error('❌  Missing GITHUB_TOKEN or GITHUB_USERNAME in .env');
  process.exit(1);
}

const BASE = 'https://api.github.com';
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'github-dashboard-local',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ghFetch(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 403) throw new Error('GitHub rate limit or auth error');
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${url}`);
  return res.json();
}

async function paginate(url) {
  const results = [];
  let next = url + (url.includes('?') ? '&' : '?') + 'per_page=100&page=1';
  let page = 1;
  while (next && page <= 10) { // cap at 1000 items
    const res = await fetch(next, { headers: HEADERS });
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    page++;
    next = url + `&per_page=100&page=${page}`;
    if (data.length < 100) break;
  }
  return results;
}

// ── Fetch user repos (including org repos where user is a member) ─────────────

async function fetchAllRepos() {
  const personal = await paginate(`${BASE}/user/repos?type=all&sort=updated`);
  // Also fetch org repos
  let orgs = [];
  try {
    const orgList = await ghFetch(`${BASE}/user/orgs`);
    for (const org of orgList.slice(0, 10)) { // limit orgs
      const orgRepos = await paginate(`${BASE}/orgs/${org.login}/repos?type=member&sort=updated`);
      orgs.push(...orgRepos);
    }
  } catch (e) { /* orgs may not be accessible */ }

  const all = [...personal, ...orgs];
  const seen = new Set();
  return all.filter(r => {
    if (seen.has(r.full_name)) return false;
    seen.add(r.full_name);
    return true;
  });
}

// ── Pull Requests ─────────────────────────────────────────────────────────────

async function syncPRs(repos) {
  let count = 0;

  // 1. PRs authored by me (open)
  const myPRs = await paginate(
    `${BASE}/search/issues?q=is:pr+author:${USERNAME}+is:open&sort=updated`
  );
  for (const item of (myPRs.items || myPRs)) {
    const repo = item.repository_url?.replace(`${BASE}/repos/`, '') || 'unknown';
    db.upsertPR({
      id: item.id,
      number: item.number,
      repo,
      title: item.title,
      author: item.user?.login || USERNAME,
      state: item.state,
      draft: item.draft ? 1 : 0,
      created_at: item.created_at,
      updated_at: item.updated_at,
      merged_at: item.pull_request?.merged_at || null,
      url: item.html_url,
      review_requested: 0,
    });
    count++;
  }

  // 2. PRs where my review is requested
  const reviewPRs = await paginate(
    `${BASE}/search/issues?q=is:pr+review-requested:${USERNAME}+is:open&sort=updated`
  );
  for (const item of (reviewPRs.items || reviewPRs)) {
    const repo = item.repository_url?.replace(`${BASE}/repos/`, '') || 'unknown';
    db.upsertPR({
      id: item.id,
      number: item.number,
      repo,
      title: item.title,
      author: item.user?.login || 'unknown',
      state: item.state,
      draft: item.draft ? 1 : 0,
      created_at: item.created_at,
      updated_at: item.updated_at,
      merged_at: null,
      url: item.html_url,
      review_requested: 1,
    });
    count++;
  }

  console.log(`  ✓ Synced ${count} pull requests`);
  return count;
}

// ── Action Runs ───────────────────────────────────────────────────────────────

async function syncActionRuns(repos) {
  let count = 0;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // last 7 days

  for (const repo of repos.slice(0, 50)) { // cap at 50 repos to avoid rate limits
    try {
      const data = await ghFetch(
        `${BASE}/repos/${repo.full_name}/actions/runs?per_page=20&created=>=${since}`
      );
      const runs = data.workflow_runs || [];
      for (const run of runs) {
        db.upsertRun({
          id: run.id,
          repo: repo.full_name,
          workflow: run.name || run.workflow_id?.toString() || 'unknown',
          run_number: run.run_number,
          status: run.status,
          conclusion: run.conclusion,
          branch: run.head_branch,
          triggered_by: run.triggering_actor?.login || run.actor?.login || 'unknown',
          created_at: run.created_at,
          updated_at: run.updated_at,
          url: run.html_url,
        });
        count++;
      }
    } catch (e) {
      // Some repos may not have Actions or may be private — skip silently
    }
  }

  console.log(`  ✓ Synced ${count} action runs across ${repos.length} repos`);
  return count;
}

// ── Main Sync ─────────────────────────────────────────────────────────────────

async function runSync() {
  const startedAt = new Date().toISOString();
  console.log(`\n🔄  GitHub sync started at ${startedAt}`);

  try {
    console.log('  → Fetching repositories...');
    const repos = await fetchAllRepos();
    console.log(`  → Found ${repos.length} repositories`);

    console.log('  → Fetching pull requests...');
    const prCount = await syncPRs(repos);

    console.log('  → Fetching action runs...');
    const runCount = await syncActionRuns(repos);

    db.logSync({ pr_count: prCount, run_count: runCount });
    console.log(`✅  Sync complete — ${prCount} PRs, ${runCount} runs\n`);
  } catch (err) {
    console.error('❌  Sync failed:', err.message);
    db.logSync({ error: err.message });
  }
}

// Run immediately if executed directly
if (require.main === module) {
  runSync().catch(console.error);
}

module.exports = { runSync };
