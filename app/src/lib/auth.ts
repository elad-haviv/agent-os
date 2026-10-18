import { cookies } from "next/headers";
import crypto from "crypto";
import { db, uid } from "./sqlite";

const COOKIE = "agentos_session";

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, channel = "app") {
  const id = uid();
  db().prepare("INSERT INTO sessions (id, user_id, channel) VALUES (?, ?, ?)").run(id, userId, channel);
  const jar = await cookies();
  jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return id;
}

export async function getSessionUser() {
  const jar = await cookies();
  const sid = jar.get(COOKIE)?.value;
  if (!sid) return null;
  const row = db().prepare(
    `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
  ).get(sid) as { id: string; email: string; name: string; role: string } | undefined;
  return row ?? null;
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

// Agent (MCP) auth: bearer service token, hashed lookup
export function getServiceToken(bearer: string | null) {
  if (!bearer) return null;
  const row = db().prepare("SELECT * FROM service_tokens WHERE token_hash = ? AND revoked = 0").get(hashToken(bearer)) as
    | { id: string; name: string; scopes: string }
    | undefined;
  return row ?? null;
}
