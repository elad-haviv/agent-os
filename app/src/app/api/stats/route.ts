export const dynamic = "force-dynamic";

import { db } from "@/lib/sqlite";
import { requireAuth, jsonError } from "@/lib/api";

// GET /api/stats — metrics (spec: סטטיסטיקות ומדדים)
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const d = db();

  // First-pass acceptance: tasks whose main runs never triggered a fix run, got green
  const firstPass = d.prepare(`
    SELECT COUNT(*) AS n FROM tasks t WHERE t.status = 'done' AND (
      SELECT COUNT(*) FROM runs r WHERE r.task_id = t.id AND r.agent_kind = 'main'
    ) = 1
  `).get() as { n: number };
  const doneTotal = d.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'done'`).get() as { n: number };

  // Understanding score: % of feedback with green understanding light
  const und = d.prepare(`
    SELECT
      SUM(CASE WHEN understanding_light = 'green' THEN 1 ELSE 0 END) AS g,
      SUM(CASE WHEN understanding_light IN ('green','yellow','red') THEN 1 ELSE 0 END) AS n
    FROM feedback
  `).get() as { g: number | null; n: number | null };

  // Outcome achieved distribution
  const outcomes = d.prepare(`SELECT outcome_achieved, COUNT(*) AS n FROM feedback GROUP BY outcome_achieved`).all();

  // Avg runs to green (תיקונים למשימה)
  const avgRuns = d.prepare(`
    SELECT AVG(c) AS avg FROM (
      SELECT task_id, COUNT(*) AS c FROM runs WHERE agent_kind = 'main' GROUP BY task_id
    ) WHERE task_id IN (SELECT id FROM tasks WHERE status = 'done')
  `).get() as { avg: number | null };

  // Repeated mistake: mistakes tag already covered by an approved lesson (approx: tag overlap with lesson scope_ref)
  const repeat = d.prepare(`
    SELECT COUNT(*) AS n FROM feedback WHERE processed = 1 AND needs_fix = 1 AND tags != ''
  `).get() as { n: number };

  // Cost by month + by model
  const costByModel = d.prepare(`SELECT model, SUM(cost_usd) AS cost, SUM(input_tokens + output_tokens) AS tokens FROM runs GROUP BY model`).all();
  const costTotal = d.prepare(`SELECT SUM(cost_usd) AS cost FROM runs`).get() as { cost: number | null };

  // Lesson effectiveness: avg runs per task before vs after lesson approval (approx via applied_count)
  const lessons = d.prepare(`SELECT COUNT(*) AS approved FROM lessons WHERE status = 'approved'`).get() as { approved: number };
  const proposed = d.prepare(`SELECT COUNT(*) AS proposed FROM lessons WHERE status = 'proposed'`).get() as { proposed: number };

  // Response time: run end -> feedback creation (avg minutes)
  const resp = d.prepare(`
    SELECT AVG((julianday(f.created_at) - julianday(r.ended_at)) * 24 * 60) AS avg_minutes
    FROM feedback f JOIN runs r ON r.id = f.run_id WHERE r.ended_at IS NOT NULL
  `).get() as { avg_minutes: number | null };

  // Per-project segmentation
  const byProject = d.prepare(`
    SELECT p.name, COUNT(t.id) AS tasks,
      SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done
    FROM projects p LEFT JOIN tasks t ON t.project_id = p.id GROUP BY p.id
  `).all();

  return Response.json({
    firstPassAcceptance: doneTotal.n ? firstPass.n / doneTotal.n : null,
    understandingScore: und.n ? (und.g ?? 0) / und.n : null,
    outcomes,
    avgRunsToGreen: avgRuns.avg,
    fixRunsNeedingLessons: repeat.n,
    lessonsApproved: lessons.approved,
    lessonsProposed: proposed.proposed,
    costTotalUsd: costTotal.cost ?? 0,
    costByModel,
    avgUserResponseMinutes: resp.avg_minutes,
    byProject,
  });
}
