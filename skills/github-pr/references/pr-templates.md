# PR Title & Summary Templates

Reference for generating natural language PR titles and body summaries.

---

## Title Rules

- **Start with a verb** in present tense: Add, Fix, Improve, Remove, Refactor, Update, Extract, Replace, Migrate, Enable, Disable, Expose, Handle, Support
- **Be specific** — name the feature, module, or error, not just the action
- **Max 72 characters**
- **No conventional commit prefixes** (no `feat:`, `fix:`, etc.)
- **No trailing period**

### Title patterns by change type

| Type           | Pattern                         | Example                                           |
| -------------- | ------------------------------- | ------------------------------------------------- |
| New feature    | `Add {what}`                    | `Add real-time notifications via WebSocket`       |
| Bug fix        | `Fix {what} in {where}`         | `Fix null error on empty cart checkout`           |
| Refactor       | `Refactor {what} into {result}` | `Refactor auth logic into dedicated service`      |
| Removal        | `Remove {what}`                 | `Remove deprecated v1 API endpoints`              |
| Performance    | `Improve {what} performance`    | `Improve search query performance with indexing`  |
| Config/infra   | `Update {what}`                 | `Update CI pipeline to Node 20`                   |
| Migration      | `Migrate {from} to {to}`        | `Migrate database layer from Sequelize to Prisma` |
| Multiple mixed | Most prominent change           | `Add payment integration and refactor order flow` |

---

## PR Body Template

### Small PR (1–3 areas of change)

```markdown
## Summary

{One short paragraph explaining what this PR does, why it was needed,
and the overall approach taken. 3–5 sentences max.}

## Changes

- {Change 1}
- {Change 2}
- {Change 3}
```

### Large PR (4+ distinct changes or multiple features)

```markdown
## Summary

{One short paragraph giving the high-level overview of the PR.
What's the big picture? Why does this PR exist?}

## Changes

### {Feature or area 1}

{2–3 sentences describing what changed in this area, what it does, and why.}

### {Feature or area 2}

{2–3 sentences describing what changed in this area.}

### {Feature or area 3}

{2–3 sentences describing what changed in this area.}
```

---

## Writing Good Summaries

**Do:**

- Explain _what_ changed and _why_, not just _how_
- Mention the user-facing impact when relevant ("Users can now...", "This fixes an issue where...")
- Call out breaking changes explicitly
- Note any dependencies added or removed

**Don't:**

- Copy-paste commit messages verbatim
- Write "Changed some files" or other vague descriptions
- List every single file modified
- Use technical jargon without context

---

## Examples

### Small PR — Bug Fix

**Title:** `Fix session expiry not resetting on user activity`

**Body:**

```markdown
## Summary

User sessions were expiring even when the user was actively using the app.
This was caused by the session timer not resetting on API calls authenticated
with a valid token. The fix updates the session middleware to refresh the
expiry window on every authenticated request.

## Changes

- Reset session expiry on each authenticated request in middleware
- Add unit tests for session refresh behavior
- Update session timeout config default from 15min to 30min
```

---

### Large PR — New Feature + Refactor

**Title:** `Add order tracking system and refactor shipping module`

**Body:**

```markdown
## Summary

This PR introduces a full order tracking system that lets customers follow
their shipment in real time. It also refactors the shipping module to support
multiple carriers, which was needed to integrate the new tracking providers.

## Changes

### Order tracking

Customers can now view live tracking updates on their order detail page.
Tracking events are pulled from carrier APIs every 15 minutes via a
background job and stored in the new `order_events` table.

### Shipping module refactor

The shipping module was tightly coupled to a single carrier (FedEx).
It has been extracted into a carrier-agnostic interface with separate
adapters for FedEx, UPS, and DHL, making it easy to add new carriers later.

### Database migrations

Added `order_events` and `carrier_configs` tables. Migration is backwards
compatible and includes seed data for existing orders.
```
