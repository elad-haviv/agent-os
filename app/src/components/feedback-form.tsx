"use client";
import { api } from "@/components/ui";
import { useState } from "react";

export function FeedbackForm({ runId, onDone }: { runId: string; onDone?: () => void }) {
  const [ul, setUl] = useState("green");
  const [el, setEl] = useState<string | null>(null);
  const [outcome, setOutcome] = useState("yes");
  const [mistakes, setMistakes] = useState("");
  const [note, setNote] = useState("");
  const [needsFix, setNeedsFix] = useState(false);

  async function submit() {
    await api("/api/feedback", "POST", {
      runId, understandingLight: ul, executionLight: el ?? ul,
      outcomeAchieved: outcome, mistakes, whatShouldHave: note, needsFix,
    });
    onDone?.();
  }

  const LightRow = ({ value, set, label }: { value: string; set: (v: string) => void; label: string }) => (
    <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
      <span className="muted" style={{ width: 90 }}>{label}</span>
      {["green", "yellow", "red"].map(c => (
        <button key={c} className={`lg-${c} ${value === c ? "lg-sel" : ""}`} onClick={() => set(c)} style={{ padding: "6px 14px" }}>
          {c === "green" ? "🟢" : c === "yellow" ? "🟡" : "🔴"}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ marginTop: 12 }}>
      <LightRow value={ul} set={setUl} label="רמזור הבנה" />
      <LightRow value={el ?? ul} set={setEl!} label="רמזור ביצוע" />
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0" }}>
        <span className="muted" style={{ width: 90 }}>הישג</span>
        <select value={outcome} onChange={e => setOutcome(e.target.value)}>
          <option value="yes">כן</option><option value="partial">חלקית</option><option value="no">לא</option>
        </select>
      </div>
      <input placeholder="טעויות (תגיות, מופרד בפסיקים)" value={mistakes} onChange={e => setMistakes(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
      <textarea placeholder="מה היה צריך לעשות?" value={note} onChange={e => setNote(e.target.value)} style={{ width: "100%", minHeight: 60 }} />
      <label className="muted" style={{ display: "block", margin: "8px 0" }}>
        <input type="checkbox" checked={needsFix} onChange={e => setNeedsFix(e.target.checked)} /> דרוש תיקון (פותח ריצה חדשה)
      </label>
      <button onClick={submit} disabled={!el}>שמור משוב</button>
    </div>
  );
}
