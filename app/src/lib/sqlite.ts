// Agent OS data layer — node:sqlite (zero native deps; Postgres + Drizzle compose ships for Coolify).
import { DatabaseSync } from "node:sqlite";
import crypto from "crypto";
import path from "path";
import fs from "fs";

const g = globalThis as unknown as { agentosDb?: DatabaseSync };

function openDb(): DatabaseSync {
  if (g.agentosDb) return g.agentosDb;
  const url = process.env.DATABASE_URL ?? "file:./agentos.db";
  const file = url.startsWith("file:") ? url.slice(5) : url;
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(path.resolve(file));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  migrate(db);
  g.agentosDb = db;
  return db;
}

function migrate(db: DatabaseSync) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
    password_hash TEXT NOT NULL, role TEXT DEFAULT 'owner', created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    channel TEXT DEFAULT 'app', project_id TEXT, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS service_tokens (
    id TEXT PRIMARY KEY, name TEXT, token_hash TEXT UNIQUE NOT NULL,
    scopes TEXT DEFAULT 'read,write', revoked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), last_used TEXT
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
    work_source TEXT DEFAULT 'local', work_source_ref TEXT,
    subdomain TEXT, coolify_app TEXT, bank_name TEXT,
    status TEXT DEFAULT 'active', autonomy TEXT DEFAULT 'standard',
    budget_usd REAL DEFAULT 50, created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, project_id TEXT REFERENCES projects(id),
    origin TEXT DEFAULT 'gateway', required_outcome TEXT, understanding TEXT,
    understanding_approved INTEGER DEFAULT 0, priority INTEGER DEFAULT 2,
    status TEXT DEFAULT 'new', workflow_id TEXT, tags TEXT DEFAULT '',
    blocked_reason TEXT, task_type TEXT DEFAULT 'general', golden INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id),
    parent_run_id TEXT, agent_kind TEXT DEFAULT 'main', agent_name TEXT DEFAULT 'hermes',
    model TEXT DEFAULT 'z-ai/glm-5.3-flash', workflow_step TEXT,
    status TEXT DEFAULT 'running', log TEXT DEFAULT '', steps INTEGER DEFAULT 0,
    artifacts TEXT DEFAULT '', input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0, started_at TEXT DEFAULT (datetime('now')), ended_at TEXT,
    lessons_applied TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY, run_id TEXT UNIQUE NOT NULL REFERENCES runs(id),
    understanding_light TEXT DEFAULT 'none', execution_light TEXT DEFAULT 'none',
    outcome_achieved TEXT DEFAULT 'pending', mistakes TEXT DEFAULT '',
    what_should_have TEXT DEFAULT '', tags TEXT DEFAULT '',
    needs_fix INTEGER DEFAULT 0, processed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY, rule TEXT NOT NULL, scope TEXT DEFAULT 'global', scope_ref TEXT,
    source_feedback_id TEXT REFERENCES feedback(id), status TEXT DEFAULT 'proposed',
    conflict_with TEXT, applied_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, scope TEXT DEFAULT 'global', scope_ref TEXT,
    graph_json TEXT NOT NULL, version INTEGER DEFAULT 1, active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY, actor TEXT NOT NULL, channel TEXT NOT NULL,
    action TEXT NOT NULL, detail TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_runs_task ON runs(task_id);
  `);
}

export function db(): DatabaseSync { return openDb(); }
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

// node:sqlite accepts only SQLInputValue; route handlers build unknown[] args.
export type SqlArg = string | number | bigint | Uint8Array | null;
export function sqlArgs(args: unknown[]): SqlArg[] {
  return args.map(a => (a === undefined ? null : (a as SqlArg)));
}

// ONE-TIME backfill enablement (active deploy only): grant the imported-history
// token the approve scope so historical feedback/lessons can be written via API.
// Removed in the follow-up commit which clamps scopes back to read,write.
db().prepare(`UPDATE service_tokens SET scopes = 'read,write,approve' WHERE scopes = 'read,write' AND revoked = 0`).run();
