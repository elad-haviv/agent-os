import { db, uid, now } from "./sqlite";
import { getSessionUser, getServiceToken } from "./auth";

export async function audit(actor: string, channel: string, action: string, detail = "") {
  db().prepare("INSERT INTO audit_log (id, actor, channel, action, detail) VALUES (?, ?, ?, ?, ?)")
    .run(uid(), actor, channel, action, detail);
}

export function jsonError(msg: string, status = 400) {
  return Response.json({ error: msg }, { status });
}

// Route helpers: user session (browser) OR bearer token (agent)
export async function requireAuth(req: Request) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer /i, "") ?? null;
  const token = bearer && bearer !== "undefined" ? getServiceToken(bearer) : null;
  if (token) {
    const scopes = token.scopes.split(",");
    // approve scope = user-equivalent credential (used for historical imports)
    const channel = scopes.includes("approve") ? "app" : "mcp";
    return { actor: `agent:${token.name}`, channel, scopes };
  }
  const user = await getSessionUser();
  if (user) return { actor: user.email, channel: "app", scopes: ["read", "write", "approve"] };
  return null;
}

// Kanban columns (spec: לוחות Kanban)
export const KANBAN_COLUMNS = [
  "new",                    // חדשה
  "awaiting_understanding", // ממתין לאישור הבנה
  "in_progress",            // בביצוע
  "awaiting_feedback",      // ממתין למשוב
  "fixing",                 // בתיקון
  "done",                   // הושלם
  "blocked",                // חסום / בוטל
] as const;

// Protected transition: only user feedback moves a task to done (spec: מעבר מוגן)
export function canTransition(from: string, to: string, byAgent: boolean): boolean {
  if (to === "done" && byAgent) return false;
  if (to === "in_progress" && from === "new" && byAgent) return true; // requires approved understanding
  return true;
}
