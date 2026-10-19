# IDEA.md — Agent OS

> The management and training system for my AI agent. The chat stays in Telegram/Discord;
> the management, feedback, and tuning live at **os.haviv.pro**.

## The core idea

Every AI coding agent today optimizes for *doing tasks*. None of them optimize for
*getting better at doing my tasks*. Agent OS closes that loop:

1. **Every task is recorded** — from any channel (gateway, app, cron). A task that isn't
   recorded doesn't exist.
2. **Success is defined before execution** — the agent drafts its understanding + a list
   of required outcomes; I approve *before* it burns tokens. This is the single biggest
   lever: understanding errors are far cheaper to fix at approval time than after a build.
3. **Every result gets feedback** — two traffic lights (understanding / execution) plus
   did-it-achieve-the-outcome. Two lights because "understood wrong" and "executed badly"
   are different failure modes with different lessons.
4. **Feedback distills into lessons** — the agent proposes a rule ("in UI tasks, always
   include a visible save button"), I approve it, and `lessons.search` injects approved
   rules before similar future tasks. Nothing changes behavior without my approval.
5. **The loop is measured** — first-pass acceptance and understanding score are the two
   headline metrics; everything else (fixes-per-task, cost, response time, repeat
   mistakes) explains them.

The product I'm really building: **a compounding asset out of my agent's mistakes.**

## Why now

I already run a full agent stack — Hermes gateway (Telegram/Discord), Hindsight memory,
Coolify deploys, Garage storage, MCP tool servers. The missing piece is the *management
layer*: visibility into what the agent does, a place to judge it, and a mechanism that
turns my judgments into permanent behavior change. Without it the agent repeats mistakes;
with it, every correction is amortized across all future work.

## What exists (MVP, live at os.haviv.pro)

- Next.js 15 PWA, node:sqlite, deployed on Coolify as a standalone app
- 9 screens: dashboard (KPIs + Pelago map slot + unified swimlane kanban), projects,
  project page, task page (run timeline + feedback form), mobile-first feedback queue,
  standards book (lessons), workflow editor (versioned flowcharts), stats, settings
- 7-entity data model: Project, Task, **Run** (the critical entity — every fix attempt
  is a new run, so improvement is measurable over time), Feedback, Lesson, Workflow, Session
- Protected transitions: only user feedback can complete a task; agent tokens are
  scope-limited (`read,write`) and hard-refused on approvals
- MCP server (`/api/mcp`, bearer token) with 10 tools: `project.set_context`,
  `task.create/update`, `run.start/finish`, `lessons.search/propose`, `feedback.pending`,
  `workflow.get/propose` — the app and the agent speak the same API
- Real history imported: 12 projects, 33 tasks, 84 runs, real token/cost data
- Cost tracking learned the hard way: spend must be split by **billing provider**
  (OpenRouter actual vs. Nous Portal subscription) — estimates at list price are not
  invoices and overstate real spend by mixing providers

## Where it goes next (phases)

**Phase 3 — the loop gets teeth**
- Telegram feedback buttons (🟢🟡🔴) on the completion message — otherwise the queue
  fills up and the loop starves
- Feedback events push to the agent immediately (webhook), not on next chat
- Cost by billing provider + monthly budget alert and soft-block at $50
- Weekly auto-retro: what was learned, which mistakes repeat, which lessons don't help

**Phase 4 — memory integration**
- Approved lessons written to Hindsight with project tags, and exported as skill files
  the agent loads natively (skills > memory entries for enforcement)
- Lesson effectiveness tracking: score before/after a lesson enters use
- Conflict detection surfaced as decisions, lesson consolidation/retirement

**Phase 5 — autonomy gates**
- Per-project autonomy levels (supervised / standard / autonomous) with approval gates
  for deletion, production deploys, spend over threshold
- Authentik SSO (OIDC + Google) protecting Agent OS and every project subdomain via
  forward-auth; passkey/MFA
- Re-run verification: after a new lesson, replay a previously failed task to prove
  the lesson works; model comparison (same task, two models, pick cheapest that gets green)

**Phase 6 — the map & the widgets**
- Real Pelago integration: adapter feeds run data into `pelago.py`, island biomes derived
  from project source, night cron + rebuild-on-task-complete, islands link to project pages
- JSON-defined widgets the agent can create itself (data source + view template)

## Design principles (learned from building v1)

- **The agent is a user, not an admin.** Service token, scopes, no self-approval —
  every trust boundary in the app exists to keep this true.
- **Runs, not tasks, are the unit of learning.** Tasks hold intent; runs hold evidence.
- **Feedback must be cheaper than correction.** One-tap lights on mobile, in-chat buttons,
  voice notes. If judging the agent is expensive, the loop dies.
- **Estimates ≠ spend.** Track what was actually billed, per provider, or the budget
  metric lies.
- **Everything as data.** Workflows are versioned JSON graphs, widgets are JSON,
  lessons are rows — so the agent can read and propose changes to any of them,
  but only the human can activate.

## Non-goals

- Not a chat UI (the gateway owns conversation)
- Not a general kanban (tasks exist to be judged, not just tracked)
- Not multi-agent orchestration (one main agent; subagents are runs, not citizens)
