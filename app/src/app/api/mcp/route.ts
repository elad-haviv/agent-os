export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Agent OS MCP server (streamable HTTP).
// Hermes connects with a Bearer service token (scopes: read, write — approve is user-only).
// Tools per spec: project.set_context, task.create/update, run.start/finish,
// lessons.search/propose, feedback.pending, workflow.get/propose.
//
// Env: AGENT_TOKEN is seeded as the default token at first bootstrap (see /api/bootstrap).

import { db, uid, sqlArgs } from "@/lib/sqlite";
import { audit } from "@/lib/api";
import { getServiceToken } from "@/lib/auth";

type Tool = { name: string; description: string; inputSchema: object };

const TOOLS: Tool[] = [
  { name: "project.set_context", description: "Pin the session to a project; returns project + its lessons", inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] } },
  { name: "task.create", description: "Create a task with understanding + required outcome (criteria list)", inputSchema: { type: "object", properties: { title: { type: "string" }, projectId: { type: "string" }, understanding: { type: "string" }, requiredOutcome: { type: "array", items: { type: "string" } }, origin: { type: "string" }, tags: { type: "array", items: { type: "string" } }, taskType: { type: "string" } }, required: ["title"] } },
  { name: "task.update", description: "Update task status/criteria. NOTE: 'done' is user-only (protected transition)", inputSchema: { type: "object", properties: { id: { type: "string" }, status: { type: "string", enum: ["new", "awaiting_understanding", "in_progress", "awaiting_feedback", "fixing", "blocked"] }, understanding: { type: "string" }, requiredOutcome: { type: "array", items: { type: "string" } }, blockedReason: { type: "string" } }, required: ["id"] } },
  { name: "run.start", description: "Open a run on a task (agentKind main|sub, parentRunId for subagents)", inputSchema: { type: "object", properties: { taskId: { type: "string" }, agentKind: { type: "string" }, agentName: { type: "string" }, model: { type: "string" }, parentRunId: { type: "string" }, workflowStep: { type: "string" }, lessonsApplied: { type: "array", items: { type: "string" } } }, required: ["taskId"] } },
  { name: "run.finish", description: "Close a run: steps, tokens, cost, artifacts (Garage links), log", inputSchema: { type: "object", properties: { id: { type: "string" }, status: { type: "string" }, steps: { type: "number" }, inputTokens: { type: "number" }, outputTokens: { type: "number" }, costUsd: { type: "number" }, artifacts: { type: "array", items: { type: "string" } }, log: { type: "string" } }, required: ["id"] } },
  { name: "lessons.search", description: "Fetch applicable lessons (approved) by project/taskType/tags — pull before similar tasks", inputSchema: { type: "object", properties: { projectId: { type: "string" }, taskType: { type: "string" }, q: { type: "string" } } } },
  { name: "lessons.propose", description: "Propose a new lesson (goes to user for approval; conflicts flagged)", inputSchema: { type: "object", properties: { rule: { type: "string" }, scope: { type: "string" }, scopeRef: { type: "string" }, sourceFeedbackId: { type: "string" } }, required: ["rule"] } },
  { name: "feedback.pending", description: "Runs awaiting user feedback + feedback events not yet processed by you", inputSchema: { type: "object", properties: {} } },
  { name: "workflow.get", description: "Get the active workflow for a scope (global or project slug)", inputSchema: { type: "object", properties: { scope: { type: "string" }, scopeRef: { type: "string" } } } },
  { name: "workflow.propose", description: "Propose a new workflow version (graph JSON); inactive until user approves", inputSchema: { type: "object", properties: { basedOn: { type: "string" }, graphJson: { type: "string" } }, required: ["basedOn", "graphJson"] } },
];

function rpc(id: unknown, result: object) {
  return Response.json({ jsonrpc: "2.0", id, result });
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer /i, "") ?? null;
  const token = getServiceToken(auth);
  if (!token) return Response.json({ error: "unauthorized: service token required" }, { status: 401 });
  const body = await req.json();
  const { method, id, params } = body;

  if (method === "initialize") {
    return rpc(id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: {} },
      serverInfo: { name: "agent-os", version: "0.1.0" },
    });
  }
  if (method === "notifications/initialized") return new Response(null, { status: 204 });

  if (method === "tools/list") return rpc(id, { tools: TOOLS });

  if (method !== "tools/call") return rpc(id, {});

  const { name, arguments: a } = params ?? {};
  const d = db();
  const log = (action: string, detail: string) => audit(`agent:${token.name}`, "mcp", action, detail);

  try {
    switch (name) {
      case "project.set_context": {
        const p = d.prepare("SELECT * FROM projects WHERE slug = ?").get(a.slug) as Record<string, unknown> | undefined;
        if (!p) return rpc(id, { content: [{ type: "text", text: "project not found" }], isError: true });
        const lessons = d.prepare(`SELECT rule, scope, scope_ref FROM lessons WHERE status = 'approved' AND (scope = 'global' OR (scope = 'project' AND scope_ref = ?))`).all(a.slug);
        await log("project.set_context", a.slug);
        return rpc(id, { content: [{ type: "text", text: JSON.stringify({ project: p, lessons }) }] });
      }
      case "task.create": {
        const id2 = uid();
        d.prepare(`INSERT INTO tasks (id, title, project_id, origin, required_outcome, understanding, tags, task_type)
          VALUES (?, ?, ?, 'gateway', ?, ?, ?, ?)`)
          .run(id2, a.title, a.projectId ?? null, JSON.stringify(a.requiredOutcome ?? []), a.understanding ?? null, (a.tags ?? []).join(","), a.taskType ?? "general");
        await log("task.create", `${id2}:${a.title}`);
        return rpc(id, { content: [{ type: "text", text: JSON.stringify({ id: id2, status: "new", note: "agent must draft understanding + required outcome, then set status=awaiting_understanding for user approval" }) }] });
      }
      case "task.update": {
        if (a.status === "done") return rpc(id, { content: [{ type: "text", text: "protected transition: only user feedback completes a task" }], isError: true });
        if (a.status === "in_progress") {
          const t = d.prepare("SELECT understanding_approved FROM tasks WHERE id = ?").get(a.id) as { understanding_approved: number } | undefined;
          if (!t) return rpc(id, { content: [{ type: "text", text: "task not found" }], isError: true });
          if (!t.understanding_approved) return rpc(id, { content: [{ type: "text", text: "understanding not yet approved by user" }], isError: true });
        }
        const sets: string[] = ["updated_at = datetime('now')"];
        const args: unknown[] = [];
        for (const k of ["status", "understanding", "required_outcome", "blocked_reason", "priority"]) {
          if (k in a) { sets.push(`${k} = ?`); args.push(k === "required_outcome" ? JSON.stringify(a[k]) : a[k]); }
        }
        args.push(a.id);
        d.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...sqlArgs(args));
        await log("task.update", `${a.id}:${a.status ?? ""}`);
        return rpc(id, { content: [{ type: "text", text: "ok" }] });
      }
      case "run.start": {
        const rid = uid();
        d.prepare(`INSERT INTO runs (id, task_id, parent_run_id, agent_kind, agent_name, model, workflow_step, lessons_applied)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(rid, a.taskId, a.parentRunId ?? null, a.agentKind ?? "main", a.agentName ?? "hermes", a.model ?? "z-ai/glm-5.3-flash", a.workflowStep ?? null, (a.lessonsApplied ?? []).join(","));
        if ((a.agentKind ?? "main") === "main") {
          d.prepare(`UPDATE tasks SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(a.taskId);
        }
        await log("run.start", rid);
        return rpc(id, { content: [{ type: "text", text: JSON.stringify({ id: rid }) }] });
      }
      case "run.finish": {
        const artifacts = Array.isArray(a.artifacts) ? a.artifacts.join(",") : (a.artifacts ?? "");
        d.prepare(`UPDATE runs SET status = ?, log = ?, steps = ?, input_tokens = ?, output_tokens = ?, cost_usd = ?, artifacts = ?, ended_at = datetime('now') WHERE id = ?`)
          .run(a.status ?? "done", a.log ?? "", a.steps ?? 0, a.inputTokens ?? 0, a.outputTokens ?? 0, a.costUsd ?? 0, artifacts, a.id);
        const run = d.prepare("SELECT agent_kind, task_id FROM runs WHERE id = ?").get(a.id) as { agent_kind: string; task_id: string } | undefined;
        if (run?.agent_kind === "main") {
          d.prepare(`UPDATE tasks SET status = 'awaiting_feedback', updated_at = datetime('now') WHERE id = ?`).run(run.task_id);
        }
        await log("run.finish", a.id);
        return rpc(id, { content: [{ type: "text", text: JSON.stringify({ ok: true, taskStatus: run?.agent_kind === "main" ? "awaiting_feedback" : undefined }) }] });
      }
      case "lessons.search": {
        const rows = d.prepare(`SELECT l.* FROM lessons l WHERE l.status = 'approved' AND (l.scope = 'global'
          OR (l.scope = 'project' AND l.scope_ref = ?) OR (l.scope = 'task-type' AND l.scope_ref = ?))`)
          .all((a.projectId ?? "") as string, (a.taskType ?? "") as string);
        const text = a.q ? rows.filter(r => (r.rule as string).toLowerCase().includes(String(a.q).toLowerCase())) : rows;
        await log("lessons.search", `${a.projectId ?? ""}/${a.taskType ?? ""}`);
        return rpc(id, { content: [{ type: "text", text: JSON.stringify({ lessons: text }) }] });
      }
      case "lessons.propose": {
        const lid = uid();
        const conflicts = d.prepare(`SELECT id, rule FROM lessons WHERE status = 'approved' AND scope = ? AND rule LIKE ?`)
          .all(a.scope ?? "global", `%${(a.rule ?? "").split(" ").slice(0, 4).join(" ")}%`) as { id: string; rule: string }[];
        d.prepare(`INSERT INTO lessons (id, rule, scope, scope_ref, source_feedback_id, status, conflict_with) VALUES (?, ?, ?, ?, ?, 'proposed', ?)`)
          .run(lid, a.rule, a.scope ?? "global", a.scopeRef ?? null, a.sourceFeedbackId ?? null, conflicts[0]?.id ?? null);
        await log("lesson.propose", `${lid}:${a.rule}`);
        return rpc(id, { content: [{ type: "text", text: JSON.stringify({ id: lid, status: "proposed", conflictsWith: conflicts[0]?.rule ?? null, note: "waits for user approval; not applied until approved" }) }] });
      }
      case "feedback.pending": {
        const queue = d.prepare(
          `SELECT r.id AS run_id, r.task_id, t.title, r.ended_at, f.execution_light
           FROM runs r JOIN tasks t ON t.id = r.task_id LEFT JOIN feedback f ON f.run_id = r.id
           WHERE r.status = 'done' AND r.agent_kind = 'main' AND f.id IS NULL ORDER BY r.ended_at DESC`
        ).all();
        const unprocessed = d.prepare(
          `SELECT f.*, t.title FROM feedback f JOIN runs r ON r.id = f.run_id JOIN tasks t ON t.id = r.task_id
           WHERE f.processed = 0 ORDER BY f.created_at DESC`
        ).all();
        return rpc(id, { content: [{ type: "text", text: JSON.stringify({ awaitingUserFeedback: queue, newUserFeedback: unprocessed }) }] });
      }
      case "workflow.get": {
        const w = d.prepare(`SELECT * FROM workflows WHERE active = 1 AND scope = ? AND (scope_ref = ? OR scope_ref IS NULL) ORDER BY version DESC LIMIT 1`)
          .get(a.scope ?? "global", a.scopeRef ?? "") as Record<string, unknown> | undefined;
        return rpc(id, { content: [{ type: "text", text: JSON.stringify({ workflow: w ?? null }) }] });
      }
      case "workflow.propose": {
        const base = d.prepare("SELECT * FROM workflows WHERE id = ?").get(a.basedOn) as Record<string, unknown> | undefined;
        if (!base) return rpc(id, { content: [{ type: "text", text: "base workflow not found" }], isError: true });
        const nid = uid();
        d.prepare(`INSERT INTO workflows (id, name, scope, scope_ref, graph_json, version, active) VALUES (?, ?, ?, ?, ?, ?, 0)`)
          .run(nid, base.name as string, base.scope as string, (base.scope_ref as string | null), a.graphJson, (base.version as number) + 1);
        await log("workflow.propose", `${base.name} v${(base.version as number) + 1}`);
        return rpc(id, { content: [{ type: "text", text: JSON.stringify({ id: nid, version: (base.version as number) + 1, active: false, note: "waits for user activation" }) }] });
      }
      default:
        return rpc(id, { content: [{ type: "text", text: `unknown tool: ${name}` }], isError: true });
    }
  } catch (e) {
    return rpc(id, { content: [{ type: "text", text: `error: ${String(e)}` }], isError: true });
  }
}

export async function GET() {
  return Response.json({ server: "agent-os-mcp", tools: TOOLS.map(t => t.name) });
}
