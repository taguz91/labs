---
name: github-pr
description: >
  Creates GitHub Pull Requests using the GitHub CLI (`gh`). Use this skill whenever
  the user wants to open, create, or submit a PR, pull request, or code review.
  Triggers on phrases like "create a PR", "open a pull request", "make a PR to develop",
  "submit my changes for review", "push a PR to testing", or "merge my branch into develop".
  Generates a natural language title and concise summary of all changes. Always use this
  skill when the user mentions PRs, pull requests, or wants to merge a branch into
  testing, develop, or main.
compatibility: "Requires bash tool, GitHub CLI (gh) installed and authenticated, and a Git repo with a GitHub remote. Lint is handled automatically by Husky on each commit."
---

# GitHub PR Skill

Creates a well-described GitHub Pull Request from the current branch using the GitHub CLI.
Lint is handled by Husky pre-commit hooks — no need to re-run it here.

---

## Workflow Overview

```
1. Validate environment
2. Detect current branch + target branch
3. Analyze changes using --stat, then full diff only if small
4. Generate title + summary (read references/pr-templates.md)
5. Confirm with user
6. Create PR via gh CLI
```

---

## Step 1 — Validate Environment

Run all checks in a single command to save time:

```bash
gh auth status && git rev-parse --is-inside-work-tree && git remote -v
```

If any check fails, stop and tell the user what's missing with a clear fix instruction:

- `gh` not installed → `brew install gh` or https://cli.github.com
- Not authenticated → `gh auth login`
- Not a git repo → must be run inside a git project
- No remote → `git remote add origin {url}`

---

## Step 2 — Detect Branches

```bash
# Get current branch and available remote branches in one call
git branch --show-current && git branch -r
```

**Target branch selection:**

- If the user specified a target (e.g. "PR to develop"), use it directly — skip asking.
- If not, ask the user to choose. Common options:
  - `testing` — for QA / staging review
  - `develop` — for team integration
  - `main` — for production releases
- Verify the target exists in the remote list. If not, show available branches and ask again.
- Before moving on confirm: `"Creating PR from {current} → {target}. Correct?"`

Also check there are commits ahead of the target — if not, stop:

```bash
git log origin/{target}..HEAD --oneline
```

---

## Step 3 — Analyze Changes

Use a two-phase approach to keep token usage low:

### Phase 1 — Stat summary (always run)

```bash
git diff --stat origin/{target}...HEAD
git log origin/{target}..HEAD --oneline
```

This gives file counts, line changes, and commit messages — enough for most PRs.

### Phase 2 — Full diff (only if needed)

Run the full diff **only when** the stat shows ≤ 20 files changed:

```bash
git diff origin/{target}...HEAD
```

If the stat shows > 20 files, rely on commit messages + file names from `--stat` to
infer the changes. Do not load the full diff — it will be too large to be useful.

### What to extract

From the stat + commits + diff (if loaded), identify:

- **What was added** — new files, new features, new functions
- **What was modified** — behavior changes, refactors, fixes
- **What was removed** — deleted files, deprecated code
- **Scope** — how many files, which areas of the codebase

---

## Step 4 — Generate Title and Summary

Read `references/pr-templates.md` for full formatting rules and examples.

### Title (quick reference)

- Natural language, starts with a verb: Add, Fix, Refactor, Remove, Improve, Update, Migrate
- Max 72 characters, no conventional commit prefixes (`feat:`, `fix:`, etc.)
- Be specific — name the feature or component

### Summary body (quick reference)

- **Small PR (1–3 change areas):** one short paragraph
- **Large PR (4+ change areas):** short overview paragraph + one mini-summary per major area
- Full templates and examples are in `references/pr-templates.md`

---

## Step 5 — Confirm With User

Show a preview before creating anything:

```
📋 PR Preview
─────────────────────────────
Title:  Add user authentication with JWT tokens
From:   feature/auth → develop

Summary:
This PR introduces JWT-based authentication to the API. Users can now
register, log in, and receive a signed token for authenticated requests.

Changes:
• New auth middleware for route protection
• User registration and login endpoints
• Token refresh logic
─────────────────────────────
Create this PR? (yes / edit title / edit summary / cancel)
```

Wait for the user's response before proceeding. If they want edits, apply them and
show the preview again before creating.

---

## Step 6 — Create the PR

```bash
gh pr create \
  --base {target_branch} \
  --head {current_branch} \
  --title "{title}" \
  --body "{summary}"
```

After creation, output the PR URL so the user can open it directly.

If the branch hasn't been pushed yet, offer to push first:

```bash
git push -u origin {current_branch}
```

Then retry `gh pr create`.

---

## Error Handling

| Situation                   | Action                                                           |
| --------------------------- | ---------------------------------------------------------------- |
| Branch not pushed           | Offer to push with `git push -u origin {branch}`, then retry     |
| PR already exists           | Show existing PR URL, ask if they want to update the description |
| Target branch doesn't exist | List available remote branches, ask user to pick                 |
| No commits ahead of target  | Stop — tell the user there's nothing to PR                       |
| > 20 files changed          | Skip full diff, use stat + commits only for summary generation   |
