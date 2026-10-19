"use client";
import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await fetch("/api/auth", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (r.ok) { location.href = "/"; return; }
    const j = await r.json().catch(() => ({}));
    setError(j.error ?? "התחברות נכשלה");
    setBusy(false);
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "70vh" }}>
      <div className="card" style={{ width: 360 }}>
        <h1 style={{ marginTop: 0 }}>Agent OS</h1>
        <form onSubmit={submit} className="grid" style={{ gap: 8 }}>
          <input placeholder="אימייל" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" />
          <input placeholder="סיסמה" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          <button disabled={busy}>{busy ? "מתחבר…" : "התחבר"}</button>
          {error && <div style={{ color: "var(--red)", fontSize: 13 }}>{error}</div>}
          <div className="muted">שכחת סיסמה? פנה אל הסוכן בצ׳אט לאיפוס.</div>
        </form>
      </div>
    </div>
  );
}
