// Pelago adapter (spec: מתאם) — converts Agent OS Postgres data into the Pelago
// aggregates file consumed by `pelago.py --input agentos.json --output world.html`.
//
// Usage:  node scripts/pelago-adapter.mjs > agentos.json
// Env:    DATABASE_URL (postgres on Coolify, sqlite file: in dev)
//
// Mapping (spec: מיפוי):
//   session  <- run (main agent runs)
//   request  <- task (or user message)
//   tokens   <- run input_tokens + output_tokens
//   tools    <- step kinds (derived from run log; shell/edit/read/web)
//   subagents<- runs with agent_kind = 'sub' (airships)
//   biome    <- project work_source (github -> tech, gdrive -> forest, local -> plains)

import { readFileSync } from "node:fs";

const BIOME = { github: "tech", gdrive: "forest", local: "plains" };

const url = process.env.DATABASE_URL ?? "file:./agentos.db";
let rows;
if (url.startsWith("file:")) {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(url.slice(5));
  rows = {
    runs: db.prepare(`SELECT r.*, t.title AS task_title, p.slug AS project_slug, p.work_source
      FROM runs r JOIN tasks t ON t.id = r.task_id LEFT JOIN projects p ON p.id = t.project_id
      WHERE r.status = 'done'`).all(),
    tasks: db.prepare(`SELECT t.*, p.slug AS project_slug FROM tasks t LEFT JOIN projects p ON p.id = t.project_id`).all(),
    projects: db.prepare(`SELECT * FROM projects`).all(),
  };
} else {
  // Postgres on Coolify: query via pg-compatible REST proxy or psql; keep the
  // same row shapes. Simplest reliable path on the VPS:
  const { execSync } = await import("node:child_process");
  const out = execSync(
    `psql "$DATABASE_URL" -Atc "SELECT json_agg(row_to_json(x)) FROM (SELECT r.id, r.task_id, r.parent_run_id, r.agent_kind, r.input_tokens, r.output_tokens, t.title AS task_title, p.slug AS project_slug, p.work_source FROM runs r JOIN tasks t ON t.id=r.task_id LEFT JOIN projects p ON p.id=t.project_id WHERE r.status='done') x"`,
    { shell: "/bin/bash", encoding: "utf8" });
  rows = { runs: JSON.parse(out || "[]"), tasks: [], projects: [] };
}

const byTask = new Map();
for (const r of rows.runs) {
  const list = byTask.get(r.task_id) ?? [];
  list.push(r);
  byTask.set(r.task_id, list);
}

const sessions = [];
for (const [taskId, runs] of byTask) {
  const main = runs.find(r => !r.parent_run_id) ?? runs[0];
  const tokens = runs.reduce((s, r) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0);
  const log = main.log ?? "";
  const tools = {};
  for (const [kind, re] of [["shell", /(?:\$|npm|git|curl)/], ["edit", /(?:write|patch|sed)/], ["read", /(?:read|grep)/], ["web", /(?:https?:\/\/|fetch)/]]) {
    const m = log.match(new RegExp(re, "g"));
    if (m) tools[kind] = m.length;
  }
  sessions.push({
    id: main.id,
    request: rows.tasks.find(t => t.id === taskId)?.task_title ?? main.task_title ?? taskId,
    tokens,
    tools,
    subagents: runs.filter(r => r.parent_run_id).length,
    project: main.project_slug ?? "general",
    biome: BIOME[main.work_source] ?? "plains",
    timestamp: main.started_at,
  });
}

process.stdout.write(JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), sessions }, null, 2));
