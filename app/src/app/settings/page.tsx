"use client";
import { useApi, api } from "@/components/ui";
import { useEffect, useState } from "react";

export default function Settings() {
  const { data: u, reload } = useApi<{ user: { email: string; name: string; role: string } | null }>("/api/auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [bootToken, setBootToken] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/bootstrap-config").catch(() => {});
  }, []);

  if (u === null) return <div className="card muted">טוען…</div>;

  if (!u.user) {
    // First run: bootstrap form (creates owner + returns agent token once)
    return (
      <>
        <h1>הגדרות — אתחול ראשון</h1>
        <div className="card" style={{ maxWidth: 420 }}>
          <p className="muted">צור את משתמש הבעלים. בסיום יוחזר טוקן שירות לסוכן (מוצג פעם אחת).</p>
          <form onSubmit={async e => {
            e.preventDefault(); setError("");
            try {
              const r = await fetch("/api/bootstrap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password, name }) });
              const j = await r.json();
              if (!r.ok) setError(j.error ?? "failed");
              else setBootToken(j.agentToken);
            } catch (err) { setError(String(err)); }
          }} className="grid" style={{ gap: 8 }}>
            <input placeholder="אימייל" value={email} onChange={e => setEmail(e.target.value)} />
            <input placeholder="שם" value={name} onChange={e => setName(e.target.value)} />
            <input placeholder="סיסמה" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <button>צור בעלים ואתחל</button>
            {error && <div style={{ color: "var(--red)" }}>{error}</div>}
          </form>
          {bootToken && (
            <div style={{ marginTop: 12, background: "var(--panel2)", padding: 12, borderRadius: 8, direction: "ltr" }}>
              <div className="muted">Agent service token (העתק עכשיו — לא יוצג שוב):</div>
              <code>{bootToken}</code>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <h1>הגדרות</h1>
      <div className="grid cols3">
        <div className="card">
          <b>משתמש</b>
          <div className="muted" style={{ margin: "6px 0" }}>{u.user.name} · {u.user.email} · {u.user.role}</div>
          <button className="ghost" onClick={async () => { await api("/api/auth", "DELETE"); reload(); }}>התנתק</button>
        </div>
        <div className="card">
          <b>מודלים ותקציב</b>
          <div className="muted" style={{ marginTop: 6 }}>יעד תקציב: $50 לחודש (מוגדר ב-env BUDGET_MONTHLY_USD). חריגה מציגה התראה בלוח המחוונים.</div>
        </div>
        <div className="card">
          <b>SSO ואבטחה</b>
          <div className="muted" style={{ marginTop: 6 }}>בפריסה ב-Coolify: OIDC מול Authentik + forward-auth לכל תת-דומיין. הסוכן מתחבר עם service token בהרשאות מוגבלות (scopes), הניתן לביטול.</div>
        </div>
        <div className="card">
          <b>חיבורים</b>
          <div className="muted" style={{ marginTop: 6 }}>Hindsight (זיכרון), Garage (תוצרים), Coolify (פריסות) — מוגדרים במשתני סביבה. סודות רק ב-env, לעולם לא בזיכרון הסמנטי.</div>
        </div>
        <div className="card">
          <b>MCP לסוכן</b>
          <div className="muted" style={{ marginTop: 6, direction: "ltr" }}>POST /api/mcp — Bearer &lt;service token&gt;. כלים: project.set_context, task.create/update, run.start/finish, lessons.search/propose, feedback.pending, workflow.get/propose.</div>
        </div>
      </div>
    </>
  );
}
