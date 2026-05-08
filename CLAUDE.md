# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal labs repository for developing and testing **Claude Code skills**. Skills are reusable prompt templates that extend Claude Code's capabilities for specific workflows.

## Architecture

### Skills Structure

Skills live in `skills/{skill-name}/` and follow this pattern:

```
skills/
  {skill-name}/
    SKILL.md          # Main skill definition with frontmatter + instructions
    references/       # Optional: supporting docs, templates, examples
```

**SKILL.md format:**
- YAML frontmatter with `name`, `description`, and `compatibility` fields
- `description` should include trigger phrases (e.g., "create a PR", "open a pull request")
- Body contains step-by-step workflow instructions for Claude Code to follow

### Current Skills

#### `github-pr`
Creates GitHub Pull Requests using the GitHub CLI (`gh`).

**Key components:**
- `skills/github-pr/SKILL.md` - Main workflow (6 steps: validate → detect branches → analyze changes → generate title/summary → confirm → create)
- `skills/github-pr/references/pr-templates.md` - Title and summary formatting rules with examples

**Design principles:**
- Token-efficient: uses `git diff --stat` first, only loads full diff if ≤20 files changed
- Natural language titles (no conventional commit prefixes like `feat:`, `fix:`)
- Two-tier summaries: short paragraph for small PRs, overview + subsections for large PRs
- Confirms with user before creating PR

## Development Commands

This is a documentation-only repository with no build/test/lint commands. Skills are markdown files consumed by Claude Code.

### Testing Skills

To test a skill:
1. Invoke it in Claude Code by mentioning trigger phrases from the `description` field
2. Verify it follows the workflow in SKILL.md
3. Check output matches the templates in `references/` (if applicable)

## When Adding New Skills

1. Create `skills/{skill-name}/SKILL.md` with proper frontmatter
2. Define clear trigger phrases in the `description` field
3. Write step-by-step instructions, not implementation code
4. Use references/ for templates, examples, or supporting docs that should be read during execution
5. Include `compatibility` requirements (CLI tools, environment setup, etc.)
6. Update this CLAUDE.md if the skill introduces architectural patterns worth documenting
