"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { PlannerTask, StagedFile, PlannerState, ViewMode } from "./types";
import {
  parseDate, fmtIso, addDays, startOfDay, startOfWeek, sameDay, daysBetween,
  MONTH_NAMES, MONTH_NAMES_SHORT, DAY_NAMES_SHORT,
  HOUR_START, HOUR_END, HOUR_PX, TIME_COL, fmtHour,
} from "./utils";
import { getSampleTasks, SUGGESTED_PROMPTS } from "./sampleData";
import { expandRecurringTasks } from "./recurrence";
import { useAuth } from "@/contexts/AuthContext";
import { getOrCreateDefaultProject } from "@/services/projects";
import { loadTasks, insertTasks, deleteAllTasks } from "@/services/tasks";

// ── Shared atoms ──────────────────────────────────────────────────────────────

const ghostBtnStyle: React.CSSProperties = {
  padding: "8px 14px", background: "transparent",
  color: "var(--fg-2)", border: "1px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  fontFamily: "var(--font-ui)", fontSize: 12, cursor: "pointer",
};

const iconBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)", background: "var(--bg-2)",
  color: "var(--fg-2)", cursor: "pointer",
  fontFamily: "var(--font-mono)", fontSize: 12,
};

function PrimaryButton({
  children, onClick, disabled,
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "10px 18px",
      background: disabled ? "var(--bg-3)" : "var(--accent)",
      color: disabled ? "var(--fg-3)" : "var(--accent-fg)",
      border: "1px solid " + (disabled ? "var(--line)" : "var(--accent)"),
      borderRadius: "var(--radius-sm)",
      fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all .15s",
    }}>{children}</button>
  );
}

function CategoryChip({ cat }: { cat: string }) {
  const labels: Record<string, string> = { work:"WORK", meet:"MEETING", focus:"FOCUS", life:"LIFE" };
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.06em",
      color: `var(--cat-${cat})`,
      border: `1px solid var(--cat-${cat})`,
      borderRadius: 2, padding: "2px 5px",
      width: "fit-content", opacity: 0.85,
    }}>{labels[cat] || cat.toUpperCase()}</span>
  );
}

function FileGlyph({ kind }: { kind: string }) {
  const label: Record<string, string> = { xlsx:"XLS", docx:"DOC", pdf:"PDF", image:"IMG", text:"TXT", csv:"CSV" };
  return (
    <div style={{
      width: 34, height: 38, borderRadius: 2,
      background: "var(--bg-3)", border: "1px solid var(--line)",
      display: "grid", placeItems: "center",
      fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-2)",
      letterSpacing: "0.06em", flexShrink: 0,
    }}>{label[kind] || "FILE"}</div>
  );
}

// ── FlowBar ──────────────────────────────────────────────────────────────────

function FlowBar({
  state, set, startAdd, resetAll, userEmail, onSignOut,
}: {
  state: PlannerState;
  set: (p: Partial<PlannerState>) => void;
  startAdd: () => void;
  resetAll: () => void;
  userEmail?: string;
  onSignOut?: () => void;
}) {
  const inFlow = state.screen === "upload" || state.screen === "extracting";
  const hasData = (state.tasks?.length || 0) > 0 || (state.sources?.length || 0) > 0;

  return (
    <div suppressHydrationWarning style={{
      height: 36, padding: "0 14px",
      borderBottom: "1px solid var(--line)",
      background: "var(--bg-1)",
      display: "flex", alignItems: "center", gap: 12,
      fontFamily: "var(--font-mono)", fontSize: 10,
      color: "var(--fg-3)", letterSpacing: "0.05em",
      flexShrink: 0,
    }}>
      <span style={{ color: "var(--accent)" }}>● BONE</span>
      <span style={{ width: 1, height: 14, background: "var(--line-2)" }} />

      {inFlow ? (
        <>
          {[{ k: "upload", l: "Add documents" }, { k: "extracting", l: "Analyse" }, { k: "review", l: "Review" }].map((s, i) => {
            const active = s.k === state.screen;
            const order = ["upload", "extracting", "review"];
            const done = order.indexOf(state.screen) > i;
            return (
              <div key={s.k} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "0 2px",
                color: active ? "var(--fg)" : done ? "var(--fg-2)" : "var(--fg-3)",
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 2,
                  border: `1px solid ${active ? "var(--accent)" : done ? "var(--fg-2)" : "var(--line-2)"}`,
                  background: active ? "var(--accent-tint)" : "transparent",
                  color: active ? "var(--accent)" : "var(--fg-3)",
                  display: "grid", placeItems: "center", fontSize: 8,
                }}>{i + 1}</span>
                {s.l.toUpperCase()}
              </div>
            );
          })}
        </>
      ) : (
        <span style={{ color: "var(--fg-2)" }}>CALENDAR</span>
      )}

      <div style={{ flex: 1 }} />

      {inFlow ? (
        <button onClick={() => set({ screen: "calendar" })} style={{
          background: "transparent", border: "1px solid var(--line)",
          color: "var(--fg-2)", padding: "3px 10px", borderRadius: 3,
          fontFamily: "inherit", fontSize: 10, letterSpacing: "inherit", cursor: "pointer",
        }}>
          {hasData ? "← BACK TO CALENDAR" : "CANCEL"}
        </button>
      ) : (
        <>
          {hasData && (
            <button onClick={resetAll} style={{
              background: "transparent", border: "1px solid var(--line)",
              color: "var(--fg-3)", padding: "3px 10px", borderRadius: 3,
              fontFamily: "inherit", fontSize: 10, letterSpacing: "inherit", cursor: "pointer",
            }}>RESET</button>
          )}
          <button onClick={startAdd} style={{
            background: "var(--accent)", border: "1px solid var(--accent)",
            color: "var(--accent-fg)", padding: "3px 11px", borderRadius: 3,
            fontFamily: "inherit", fontSize: 10, letterSpacing: "inherit",
            cursor: "pointer", fontWeight: 600,
          }}>+ ADD DOCUMENTS</button>
        </>
      )}

      {/* User identity + sign-out */}
      {!inFlow && userEmail && (
        <>
          <span style={{ width: 1, height: 14, background: "var(--line-2)", marginLeft: 4 }} />
          <span style={{ color: "var(--fg-3)", fontSize: 10, fontFamily: "var(--font-mono)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userEmail}
          </span>
          <button onClick={onSignOut} style={{
            background: "transparent", border: "1px solid var(--line)",
            color: "var(--fg-3)", padding: "3px 10px", borderRadius: 3,
            fontFamily: "inherit", fontSize: 10, letterSpacing: "inherit", cursor: "pointer",
          }}>SIGN OUT</button>
        </>
      )}
    </div>
  );
}

// ── Upload screen ────────────────────────────────────────────────────────────

function ScreenUpload({ state, set }: {
  state: PlannerState;
  set: (p: Partial<PlannerState>) => void;
  startAdd?: () => void;
  projectId?: string;
  userId?: string;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const files = state.files;
  const adding = (state.tasks?.length || 0) > 0 || (state.sources?.length || 0) > 0;

  const inferKind = (name: string) => {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (["xlsx","xls"].includes(ext)) return "xlsx";
    if (ext === "docx" || ext === "doc") return "docx";
    if (ext === "pdf") return "pdf";
    if (ext === "csv") return "csv";
    if (["jpg","jpeg","png","heic","webp","gif"].includes(ext)) return "image";
    return "text";
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const incoming = Array.from(fileList);
    const incomingMeta: StagedFile[] = incoming.map(f => ({
      name: f.name,
      kind: inferKind(f.name),
      size: fmtSize(f.size),
      items: Math.max(3, Math.min(40, Math.round(f.size / 8000) + Math.floor(Math.random() * 6))),
    }));
    const keptOld = files
      .map((f, i) => ({ f, raw: state.rawFiles[i] }))
      .filter(({ f }) => !incomingMeta.find(i => i.name === f.name && i.size === f.size));
    const mergedMeta = [...incomingMeta, ...keptOld.map(x => x.f)].slice(0, 20);
    const mergedRaw  = [...incoming,     ...keptOld.map(x => x.raw)].slice(0, 20);
    set({ files: mergedMeta, rawFiles: mergedRaw });
  };

  return (
    <div style={{ padding: "44px 56px", height: "100%", display: "flex", flexDirection: "column", gap: 28, overflow: "auto" }}>
      <input ref={inputRef} type="file" multiple
        accept=".xlsx,.xls,.docx,.doc,.pdf,.txt,.md,.csv,.jpg,.jpeg,.png,.heic,.webp,.gif"
        onChange={e => { addFiles(e.target.files); e.target.value = ""; }}
        style={{ display: "none" }} />

      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        <span>STEP 01 / 02</span>
        <span style={{ width: 56, height: 1, background: "var(--line-2)" }} />
        <span style={{ color: "var(--fg-2)" }}>{adding ? "Add more source material" : "Drop your source material"}</span>
      </div>

      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        {/* Left copy */}
        <div style={{ flex: "0 0 320px" }}>
          <div style={{
            fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)",
            letterSpacing: "var(--display-tracking)", fontSize: 32, lineHeight: 1.1,
          }}>{adding ? <>Add to<br />your plan.</> : <>Feed it<br />everything.</>}</div>
          <div style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 14, lineHeight: 1.55 }}>
            {adding
              ? "New items merge into your existing calendar — nothing you've already built is lost."
              : "Spreadsheets, meeting notes, photos of whiteboards, calendar exports — the model reads them all and merges into one optimized schedule."}
          </div>
          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px",
            fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>
            <span style={{ color: "var(--fg-3)" }}>FORMATS</span><span>.xlsx .xls .docx .pdf .txt .csv .jpg .png</span>
            <span style={{ color: "var(--fg-3)" }}>MAX</span><span>20 files · 50 MB total</span>
            <span style={{ color: "var(--fg-3)" }}>OCR</span><span style={{ color: "var(--ok)" }}>● enabled</span>
          </div>
        </div>

        {/* Right drop zone */}
        <div style={{ flex: 1 }}>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragEnter={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }}
            onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
            style={{
              border: `1.5px dashed ${drag ? "var(--accent)" : "var(--line-2)"}`,
              background: drag ? "var(--accent-tint)" : "var(--bg-1)",
              borderRadius: "var(--radius)",
              padding: "44px 32px", textAlign: "center",
              transition: "all .15s", cursor: "pointer",
            }}
          >
            <div style={{
              width: 44, height: 44, margin: "0 auto 14px",
              borderRadius: "var(--radius-sm)", background: "var(--bg-3)",
              border: "1px solid var(--line-2)", display: "grid", placeItems: "center",
              fontFamily: "var(--font-mono)", color: "var(--accent)", fontSize: 20,
            }}>↑</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: "var(--display-weight)" }}>
              Drop files here, or <span style={{ color: "var(--accent)", textDecoration: "underline", textDecorationColor: "var(--line-2)" }}>browse</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 6 }}>
              Up to 20 files. We never train on your data.
            </div>
          </div>

          <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: "0.04em" }}>
              {files.length} FILE{files.length !== 1 && "S"} STAGED
            </div>
            <button onClick={() => set({ files: [], rawFiles: [] })} style={ghostBtnStyle}>Clear</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {files.map((f, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                background: "var(--bg-2)", border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
              }}>
                <FileGlyph kind={f.kind} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 2 }}>{f.size} · ~{f.items} candidate items</div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ok)" }}>● READY</div>
                <button onClick={() => {
                  set({ files: files.filter((_, j) => j !== i), rawFiles: state.rawFiles.filter((_, j) => j !== i) });
                }} style={{ background: "transparent", border: "none", color: "var(--fg-3)", cursor: "pointer", padding: 4, fontFamily: "var(--font-mono)" }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => set({ screen: "calendar" })} style={ghostBtnStyle}>{adding ? "← Back to calendar" : "← Cancel"}</button>
        <PrimaryButton disabled={!files.length} onClick={() => set({ screen: "extracting" })}>
          {files.length ? "Extract items →" : "Add a file to continue"}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ── Extraction screen ─────────────────────────────────────────────────────────

// ── Helpers shared by extraction ─────────────────────────────────────────────

function normaliseRaw(t: Record<string, unknown>, i: number): PlannerTask {
  const hasRec = t.recurrence && typeof t.recurrence === "object";
  const todayIso = fmtIso(new Date());
  const dateIso = typeof t.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : (hasRec ? null : todayIso);
  const endIso = typeof t.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.endDate) ? t.endDate : null;
  const allDay = hasRec ? false : (!!t.allDay || t.start == null);
  return {
    id: String(t.id || `t${i + 1}`),
    title: String(t.title || "Untitled").slice(0, 100),
    description: typeof t.description === "string" ? t.description : "",
    cat: (["work","meet","focus","life"].includes(t.cat as string) ? t.cat : "work") as PlannerTask["cat"],
    date: dateIso,
    endDate: endIso && dateIso && endIso >= dateIso ? endIso : null,
    allDay,
    start: hasRec ? null : (allDay ? null : Math.max(0, Math.min(23.5, parseFloat(String(t.start)) || 9))),
    dur: hasRec
      ? (Number.isFinite(+(t.recurrence as Record<string,unknown>)?.duration!) ? +(t.recurrence as Record<string,unknown>).duration! : null)
      : (allDay ? null : Math.max(0.5, Math.min(4, parseFloat(String(t.dur)) || 1))),
    prio: (["high","med","low"].includes(t.prio as string) ? t.prio : "med") as PlannerTask["prio"],
    reason: String(t.reason || `From ${t.source || "uploaded files"}.`),
    source: String(t.source || ""),
    phase: typeof t.phase === "string" ? t.phase : null,
    isMilestone: t.isMilestone === true,
    isReminder: t.isReminder === true,
    dependsOn: Array.isArray(t.dependsOn) ? (t.dependsOn as string[]) : [],
    recurrence: hasRec ? (t.recurrence as Record<string,unknown>) : null,
    condition: typeof t.condition === "string" ? t.condition : null,
    _reviewStatus: "pending",
  };
}

// ── Inline edit modal ─────────────────────────────────────────────────────────

function EditTaskModal({ task, onSave, onClose }: {
  task: PlannerTask;
  onSave: (t: PlannerTask) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [date, setDate] = useState(task.date || "");
  const [cat, setCat] = useState(task.cat);
  const [prio, setPrio] = useState(task.prio);
  const [startH, setStartH] = useState(String(task.start ?? ""));
  const [dur, setDur] = useState(String(task.dur ?? ""));
  const [description, setDescription] = useState(task.description || "");

  const inp: React.CSSProperties = {
    width: "100%", background: "var(--bg-1)", border: "1px solid var(--line-2)",
    borderRadius: "var(--radius-sm)", color: "var(--fg)",
    fontFamily: "var(--font-ui)", fontSize: 12, padding: "6px 10px", outline: "none",
  };
  const lbl: React.CSSProperties = {
    fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)",
    letterSpacing: "0.06em", marginBottom: 4, display: "block",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(26,24,21,0.55)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-2)", border: "1px solid var(--line-2)",
        borderRadius: "var(--radius)", padding: "28px 32px", width: 480,
        boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 22 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>Edit event</span>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: "var(--fg-3)", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={lbl}>TITLE</span>
            <input style={inp} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <span style={lbl}>DESCRIPTION</span>
            <textarea style={{ ...inp, height: 60, resize: "vertical" }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <span style={lbl}>DATE</span>
              <input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <span style={lbl}>CATEGORY</span>
              <select style={{ ...inp }} value={cat} onChange={e => setCat(e.target.value as PlannerTask["cat"])}>
                <option value="work">Work</option>
                <option value="meet">Meeting</option>
                <option value="focus">Focus</option>
                <option value="life">Life</option>
              </select>
            </div>
            <div>
              <span style={lbl}>START (hour, e.g. 9.5)</span>
              <input style={inp} value={startH} onChange={e => setStartH(e.target.value)} placeholder="9" />
            </div>
            <div>
              <span style={lbl}>DURATION (hours)</span>
              <input style={inp} value={dur} onChange={e => setDur(e.target.value)} placeholder="1" />
            </div>
            <div>
              <span style={lbl}>PRIORITY</span>
              <select style={{ ...inp }} value={prio} onChange={e => setPrio(e.target.value as PlannerTask["prio"])}>
                <option value="high">High</option>
                <option value="med">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={ghostBtnStyle}>Cancel</button>
          <PrimaryButton onClick={() => {
            const parsedStart = parseFloat(startH);
            const parsedDur = parseFloat(dur);
            onSave({
              ...task,
              title: title.trim() || task.title,
              description,
              date: date || task.date,
              cat,
              prio,
              start: isNaN(parsedStart) ? task.start : parsedStart,
              dur: isNaN(parsedDur) ? task.dur : parsedDur,
              allDay: isNaN(parsedStart),
            });
          }}>Save changes</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── Review table ──────────────────────────────────────────────────────────────

function ReviewTable({ tasks, onToggle, onEdit, onEditSave }: {
  tasks: PlannerTask[];
  onToggle: (id: string) => void;
  onEdit: (t: PlannerTask) => void;
  onEditSave: (t: PlannerTask) => void;
}) {
  const [editing, setEditing] = useState<PlannerTask | null>(null);

  // Group by phase
  const phases = useMemo(() => {
    const map = new Map<string, PlannerTask[]>();
    tasks.forEach(t => {
      const key = t.phase || "—";
      (map.get(key) || map.set(key, []).get(key)!).push(t);
    });
    return map;
  }, [tasks]);

  const accepted = tasks.filter(t => t._reviewStatus === "accepted").length;
  const total = tasks.length;

  return (
    <>
      {editing && (
        <EditTaskModal
          task={editing}
          onSave={t => { onEditSave(t); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
      <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          padding: "11px 18px", borderBottom: "1px solid var(--line)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.06em",
        }}>
          <span>PROPOSED SCHEDULE · {total} EVENTS</span>
          <span style={{ color: accepted > 0 ? "var(--ok)" : "var(--fg-3)" }}>{accepted} ACCEPTED</span>
        </div>

        {/* Rows grouped by phase */}
        <div style={{ maxHeight: 440, overflow: "auto" }}>
          {[...phases.entries()].map(([phase, phaseTasks]) => (
            <div key={phase}>
              {phase !== "—" && (
                <div style={{
                  padding: "6px 18px", background: "var(--bg-2)",
                  fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)",
                  letterSpacing: "0.08em", borderBottom: "1px solid var(--line)",
                }}>{phase.toUpperCase()}</div>
              )}
              {phaseTasks.map(t => {
                const accepted = t._reviewStatus === "accepted";
                const rejected = t._reviewStatus === "rejected";
                return (
                  <div key={t.id} style={{
                    padding: "10px 18px",
                    display: "grid", gridTemplateColumns: "28px 16px 1fr auto auto auto auto",
                    gap: 10, alignItems: "center",
                    borderBottom: "1px solid var(--line)",
                    background: accepted ? "rgba(59,122,79,0.06)" : rejected ? "rgba(164,68,43,0.05)" : "transparent",
                    opacity: rejected ? 0.45 : 1,
                    transition: "background .12s, opacity .12s",
                  }}>
                    {/* Accept toggle */}
                    <button
                      onClick={() => onToggle(t.id)}
                      title={accepted ? "Click to reject" : "Click to accept"}
                      style={{
                        width: 22, height: 22, borderRadius: 4, border: `1.5px solid ${accepted ? "var(--ok)" : rejected ? "var(--warn)" : "var(--line-2)"}`,
                        background: accepted ? "var(--ok)" : "transparent",
                        color: accepted ? "#fff" : "transparent",
                        cursor: "pointer", fontSize: 11, flexShrink: 0,
                        display: "grid", placeItems: "center",
                      }}>✓</button>

                    {/* Type badge */}
                    <span style={{ fontSize: 13, flexShrink: 0 }}>
                      {t.isMilestone ? "◆" : t.isReminder ? "🔔" : "·"}
                    </span>

                    {/* Title + meta */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                      {t.description && (
                        <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
                      )}
                    </div>

                    {/* Date */}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", whiteSpace: "nowrap" }}>
                      {t.date || "recurring"}
                      {t.start != null && !t.allDay ? ` ${String(Math.floor(t.start)).padStart(2,"0")}:${t.start % 1 ? "30" : "00"}` : ""}
                    </span>

                    {/* Category */}
                    <CategoryChip cat={t.cat} />

                    {/* Priority */}
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.04em",
                      color: t.prio === "high" ? "var(--warn)" : t.prio === "med" ? "var(--accent)" : "var(--fg-3)",
                    }}>{t.prio.toUpperCase()}</span>

                    {/* Edit */}
                    <button
                      onClick={() => setEditing(t)}
                      style={{ background: "transparent", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", color: "var(--fg-3)", cursor: "pointer", padding: "3px 8px", fontFamily: "var(--font-mono)", fontSize: 9 }}>
                      EDIT
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Extraction screen ─────────────────────────────────────────────────────────

function ScreenExtraction({ state, set }: {
  state: PlannerState;
  set: (p: Partial<PlannerState>) => void;
  startAdd?: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [proposed, setProposed] = useState<PlannerTask[]>([]);
  const [phase, setPhase] = useState<"extracting" | "review">("extracting");
  const [status, setStatus] = useState<"reading" | "placing" | "done">("reading");
  const [errMsg, setErrMsg] = useState("");
  const [fileStatus, setFileStatus] = useState<Record<number, string>>({});
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    let progIv: ReturnType<typeof setInterval>;

    (async () => {
      let p = 0;
      progIv = setInterval(() => {
        if (cancelRef.current) return;
        p = Math.min(0.82, p + 0.010);
        setProgress(p);
      }, 120);

      let tasks: PlannerTask[] = [];
      try {
        if (!state.rawFiles?.length) throw new Error("no files were uploaded");
        state.rawFiles.forEach((_, i) => setFileStatus(prev => ({ ...prev, [i]: "reading" })));

        const formData = new FormData();
        state.rawFiles.forEach(f => formData.append("files", f));

        const res = await fetch("/api/extract", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Server error ${res.status}`);
        }
        const data = await res.json();

        if (data.skipped) {
          data.skipped.forEach((r: { source: string }) => {
            const idx = state.rawFiles.findIndex(f => f.name === r.source);
            if (idx >= 0) setFileStatus(prev => ({ ...prev, [idx]: "skipped" }));
          });
        }
        state.rawFiles.forEach((_, i) => setFileStatus(prev => ({ ...prev, [i]: prev[i] || "done" })));

        const rawExtracted: PlannerTask[] = (data.extracted || []).map(
          (t: Record<string, unknown>, i: number) => normaliseRaw(t, i)
        );
        tasks = expandRecurringTasks(rawExtracted, { startDate: new Date() });
        // Keep _reviewStatus from normaliseRaw (all "pending")
        tasks = tasks.map(t => ({ ...t, _reviewStatus: "pending" as const }));

      } catch (e) {
        setErrMsg(e instanceof Error ? e.message : String(e));
        tasks = [];
      }

      if (cancelRef.current) return;
      clearInterval(progIv);
      setStatus("placing");

      if (tasks.length === 0) {
        setProgress(1);
        setStatus("done");
        return;
      }

      // Animate items appearing
      for (let i = 0; i < tasks.length; i++) {
        if (cancelRef.current) return;
        await new Promise(r => setTimeout(r, 40));
        setProposed(tasks.slice(0, i + 1));
        setProgress(0.82 + 0.18 * (i + 1) / tasks.length);
      }
      setStatus("done");
      setProgress(1);
    })();

    return () => { cancelRef.current = true; clearInterval(progIv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = status === "done";
  const noTasks = done && proposed.length === 0;
  const inReview = phase === "review";
  const accepted = proposed.filter(t => t._reviewStatus === "accepted");
  const milestones = proposed.filter(t => t.isMilestone).length;
  const reminders = proposed.filter(t => t.isReminder).length;

  const toggleReview = (id: string) => {
    setProposed(prev => prev.map(t => t.id !== id ? t : {
      ...t,
      _reviewStatus: t._reviewStatus === "accepted" ? "rejected" : "accepted",
    }));
  };
  const editSave = (updated: PlannerTask) => {
    setProposed(prev => prev.map(t => t.id === updated.id ? { ...updated, _reviewStatus: "accepted" } : t));
  };
  const acceptAll = () => setProposed(prev => prev.map(t => ({ ...t, _reviewStatus: "accepted" as const })));
  const rejectAll = () => setProposed(prev => prev.map(t => ({ ...t, _reviewStatus: "rejected" as const })));

  const confirmToCalendar = () => {
    const toAdd = proposed.filter(t => t._reviewStatus === "accepted").map(({ _reviewStatus, ...rest }) => rest);
    if (toAdd.length) {
      const offset = state.tasks?.length || 0;
      const merged = [
        ...(state.tasks || []),
        ...toAdd.map((t, i) => ({ ...t, id: `t${offset + i + 1}` })),
      ];
      set({ tasks: merged, sources: [...(state.sources || []), ...(state.files || [])], files: [], rawFiles: [], screen: "calendar" });
    } else {
      set({ screen: "calendar" });
    }
  };

  // ── Extracting phase ──
  if (!inReview) {
    return (
      <div style={{ padding: "44px 56px", height: "100%", display: "flex", flexDirection: "column", gap: 24, overflow: "auto" }}>
        {/* Step */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          <span>STEP 02 / 03</span>
          <span style={{ width: 56, height: 1, background: "var(--line-2)" }} />
          <span style={{ color: "var(--fg-2)" }}>{done ? (noTasks ? "Nothing found" : "AI planning complete") : status === "placing" ? "Building schedule" : "Analysing documents"}</span>
        </div>

        <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
          {/* Left */}
          <div style={{ flex: "0 0 340px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", letterSpacing: "var(--display-tracking)", fontSize: 30, lineHeight: 1.1 }}>
              {done
                ? noTasks ? "Nothing found." : <>Built <span style={{ color: "var(--accent)" }}>{proposed.length}</span> events.</>
                : "Reading your files."}
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 12, lineHeight: 1.55 }}>
              {done
                ? noTasks
                  ? "Nothing actionable was found in the uploaded files."
                  : `${proposed.length} events generated — including ${milestones} milestone${milestones !== 1 ? "s" : ""} and ${reminders} reminder${reminders !== 1 ? "s" : ""}. Review each one before adding to your calendar.`
                : "Parsing documents then applying smart planning: detecting phases, milestones, dependencies, and reminders."}
            </div>

            {/* Progress card */}
            <div style={{ marginTop: 22, background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "14px 16px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: "var(--fg-3)" }}>PROGRESS</span>
                <span style={{ color: "var(--accent)" }}>{Math.round(progress * 100)}%</span>
              </div>
              <div style={{ height: 3, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ width: `${progress * 100}%`, height: "100%", background: "var(--accent)", transition: "width .12s linear" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {state.files.map((f, i) => {
                  const st = fileStatus[i] || "queued";
                  const color = st === "done" ? "var(--ok)" : st === "skipped" ? "var(--warn)" : st === "reading" ? "var(--accent)" : "var(--fg-3)";
                  const mark = st === "done" ? "✓" : st === "skipped" ? "⨯" : st === "reading" ? "···" : "—";
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: st === "queued" ? "var(--fg-3)" : "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{f.name}</span>
                      <span style={{ color }}>{mark}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {errMsg && <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--warn)" }}>error: {errMsg}</div>}

            {/* Legend */}
            {done && !noTasks && (
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
                <span>◆ milestone &nbsp;·&nbsp; 🔔 reminder &nbsp;·&nbsp; · task</span>
                {milestones > 0 && <span style={{ color: "var(--accent)" }}>{milestones} milestone{milestones !== 1 ? "s" : ""} generated</span>}
                {reminders > 0 && <span style={{ color: "var(--warn)" }}>{reminders} reminder{reminders !== 1 ? "s" : ""} generated</span>}
              </div>
            )}
          </div>

          {/* Right live list */}
          <div style={{ flex: 1, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxHeight: 500 }}>
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.06em", display: "flex", justifyContent: "space-between" }}>
              <span>AI PLANNER · live</span>
              <span style={{ color: "var(--accent)" }}>{proposed.length} EVENTS</span>
            </div>
            <div style={{ padding: "4px 0", display: "flex", flexDirection: "column", maxHeight: 450, overflow: "hidden" }}>
              {proposed.length === 0 && (
                <div style={{ padding: "40px 18px", textAlign: "center", color: "var(--fg-3)", fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                  {done ? "NO ITEMS FOUND" : "AWAITING AI PLANNER ···"}
                </div>
              )}
              {proposed.slice(-14).map(t => (
                <div key={t.id} style={{
                  padding: "8px 18px", display: "grid",
                  gridTemplateColumns: "16px 1fr auto auto",
                  gap: 10, alignItems: "center", fontSize: 12,
                  animation: "plannerFadeIn .25s ease-out",
                  borderBottom: "1px solid var(--line)",
                }}>
                  <span style={{ fontSize: 11 }}>{t.isMilestone ? "◆" : t.isReminder ? "🔔" : "·"}</span>
                  <div>
                    <span style={{ color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{t.title}</span>
                    {t.phase && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)" }}>{t.phase}</span>}
                  </div>
                  <CategoryChip cat={t.cat} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: t.prio === "high" ? "var(--warn)" : t.prio === "med" ? "var(--accent)" : "var(--fg-3)" }}>
                    {t.date || "recur"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={() => set({ screen: "upload" })} style={ghostBtnStyle}>← Back</button>
          <PrimaryButton
            disabled={!done || noTasks}
            onClick={() => {
              if (noTasks) { set({ screen: "calendar" }); return; }
              // Pre-accept all before entering review
              setProposed(prev => prev.map(t => ({ ...t, _reviewStatus: "accepted" as const })));
              setPhase("review");
            }}
          >
            {done ? (noTasks ? "Back to calendar →" : `Review ${proposed.length} events →`) : "Planning…"}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // ── Review phase ──
  return (
    <div style={{ padding: "44px 56px", height: "100%", display: "flex", flexDirection: "column", gap: 20, overflow: "auto" }}>
      {/* Step */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
        <span>STEP 03 / 03</span>
        <span style={{ width: 56, height: 1, background: "var(--line-2)" }} />
        <span style={{ color: "var(--fg-2)" }}>Review & confirm</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)", letterSpacing: "var(--display-tracking)", fontSize: 28, lineHeight: 1.1 }}>
            Review your plan.
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 8, lineHeight: 1.5 }}>
            Accept or reject each event. Edit any details. Only accepted events go to your calendar.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          <button onClick={acceptAll} style={{ ...ghostBtnStyle, color: "var(--ok)", borderColor: "var(--ok)", fontSize: 11 }}>✓ Accept all</button>
          <button onClick={rejectAll} style={{ ...ghostBtnStyle, color: "var(--warn)", borderColor: "var(--warn)", fontSize: 11 }}>✕ Reject all</button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 24, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
        <span style={{ color: "var(--ok)" }}>✓ {accepted.length} accepted</span>
        <span style={{ color: "var(--warn)" }}>✕ {proposed.filter(t => t._reviewStatus === "rejected").length} rejected</span>
        <span>· {proposed.filter(t => t._reviewStatus === "pending").length} pending</span>
        {milestones > 0 && <span style={{ color: "var(--accent)" }}>◆ {milestones} milestones</span>}
        {reminders > 0 && <span style={{ color: "var(--warn)" }}>🔔 {reminders} reminders</span>}
      </div>

      <ReviewTable
        tasks={proposed}
        onToggle={toggleReview}
        onEdit={() => {}}
        onEditSave={editSave}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => setPhase("extracting")} style={ghostBtnStyle}>← Back to results</button>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {accepted.length === 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--warn)" }}>No events accepted yet</span>
          )}
          <PrimaryButton
            disabled={accepted.length === 0}
            onClick={confirmToCalendar}
          >
            Add {accepted.length} event{accepted.length !== 1 ? "s" : ""} to calendar →
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── Calendar toolbar ──────────────────────────────────────────────────────────

function CalendarToolbar({
  view, setView, currentDate, setCurrentDate, hasTasks, taskCount, onAdd,
}: {
  view: ViewMode; setView: (v: ViewMode) => void;
  currentDate: Date; setCurrentDate: (d: Date) => void;
  hasTasks: boolean; taskCount: number; onAdd: () => void;
}) {
  const weekStart = startOfWeek(currentDate);
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const weekLabel = sameMonth
    ? `${MONTH_NAMES_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}–${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
    : `${MONTH_NAMES_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTH_NAMES_SHORT[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  const dayLabel = `${DAY_NAMES_SHORT[(currentDate.getDay()+6)%7]}, ${MONTH_NAMES_SHORT[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
  const monthLabel = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  const label = view === "month" ? monthLabel : view === "day" ? dayLabel : weekLabel;

  const shift = (delta: number) => {
    const step = view === "month" ? 30 : view === "week" ? 7 : 1;
    setCurrentDate(addDays(currentDate, step * delta));
  };

  return (
    <div style={{
      height: 52, padding: "0 18px",
      borderBottom: "1px solid var(--line)",
      display: "flex", alignItems: "center", gap: 16,
      background: "var(--bg-1)", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => shift(-1)} style={iconBtnStyle}>←</button>
        <button onClick={() => shift(1)} style={iconBtnStyle}>→</button>
        <button onClick={() => setCurrentDate(startOfDay(new Date()))} style={{ ...ghostBtnStyle, padding: "6px 10px", fontSize: 11 }}>Today</button>
      </div>
      <div style={{
        fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)",
        letterSpacing: "var(--display-tracking)", fontSize: 18,
      }}>{label}</div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: 2 }}>
        {(["day","week","month"] as ViewMode[]).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "5px 12px", border: 0, borderRadius: 3,
            background: view === v ? "var(--bg-3)" : "transparent",
            color: view === v ? "var(--fg)" : "var(--fg-2)",
            fontFamily: "var(--font-ui)", fontSize: 11, cursor: "pointer",
            textTransform: "capitalize", fontWeight: view === v ? 500 : 400,
          }}>{v}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: "var(--font-mono)", fontSize: 10, color: hasTasks ? "var(--accent)" : "var(--fg-3)" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: hasTasks ? "var(--accent)" : "var(--fg-3)" }} />
        {hasTasks ? `AI · ${taskCount} ITEMS` : "EMPTY"}
      </div>
      <button onClick={onAdd} style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 12px", background: "var(--accent)", color: "var(--accent-fg)",
        border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, cursor: "pointer",
      }}>+ Add documents</button>
    </div>
  );
}

// ── Calendar grid ─────────────────────────────────────────────────────────────

function GridBackground({ dayCount }: { dayCount: number }) {
  const lines: React.ReactNode[] = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) {
    lines.push(<div key={`h${h}`} style={{
      position: "absolute", top: (h - HOUR_START) * HOUR_PX,
      left: 0, right: 0, height: 1, background: "var(--line)",
    }} />);
    if (h < HOUR_END) lines.push(<div key={`hh${h}`} style={{
      position: "absolute", top: (h - HOUR_START) * HOUR_PX + HOUR_PX / 2,
      left: 0, right: 0, height: 1, background: "var(--line)", opacity: 0.4,
    }} />);
  }
  for (let d = 1; d <= dayCount; d++) {
    lines.push(<div key={`v${d}`} style={{
      position: "absolute", top: 0, bottom: 0,
      left: `${(d * 100) / dayCount}%`, width: 1, background: "var(--line)",
    }} />);
  }
  return <>{lines}</>;
}

function NowLine({ days }: { days: Date[] }) {
  const now = new Date();
  const todayIdx = days.findIndex(d => sameDay(d, now));
  if (todayIdx < 0) return null;
  const nowHour = now.getHours() + now.getMinutes() / 60;
  if (nowHour < HOUR_START || nowHour > HOUR_END) return null;
  const top = (nowHour - HOUR_START) * HOUR_PX;
  const left = (todayIdx / days.length) * 100;
  const w = 100 / days.length;
  return (
    <>
      <div style={{ position: "absolute", top, left: `${left}%`, width: `${w}%`, height: 1, background: "var(--accent)", zIndex: 3 }} />
      <div style={{ position: "absolute", top: top - 3, left: `calc(${left}% - 3px)`, width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", zIndex: 3 }} />
    </>
  );
}

function TaskBlock({
  task, dayWidth, onHover, onLeave, onClick, isSelected,
}: {
  task: PlannerTask; dayWidth: number;
  onHover: (t: PlannerTask, e: React.MouseEvent) => void;
  onLeave: () => void;
  onClick: (t: PlannerTask) => void;
  isSelected: boolean;
}) {
  const start = task.start ?? 9;
  const dur = task.dur ?? 1;
  const top = (start - HOUR_START) * HOUR_PX;
  const height = Math.max(20, dur * HOUR_PX - 2);

  if (task.isMilestone) {
    return (
      <div
        onMouseEnter={e => onHover(task, e)}
        onMouseLeave={onLeave}
        onClick={() => onClick(task)}
        style={{
          position: "absolute", top, height: 24, left: 3, width: dayWidth - 6,
          background: "var(--accent-tint)",
          border: `1.5px solid var(--accent)`,
          borderRadius: "var(--radius-sm)",
          padding: "3px 7px", fontSize: 11, color: "var(--accent)",
          cursor: "pointer", overflow: "hidden",
          boxShadow: isSelected ? "0 0 0 1px var(--accent)" : "none",
          display: "flex", alignItems: "center", gap: 5,
        }}
      >
        <span style={{ fontSize: 9, flexShrink: 0 }}>◆</span>
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2, fontSize: 10 }}>{task.title}</span>
      </div>
    );
  }

  if (task.isReminder) {
    return (
      <div
        onMouseEnter={e => onHover(task, e)}
        onMouseLeave={onLeave}
        onClick={() => onClick(task)}
        style={{
          position: "absolute", top, height: 22, left: 3, width: dayWidth - 6,
          background: "transparent",
          border: `1px dashed var(--warn)`,
          borderRadius: "var(--radius-sm)",
          padding: "2px 7px", fontSize: 10, color: "var(--warn)",
          cursor: "pointer", overflow: "hidden",
          boxShadow: isSelected ? "0 0 0 1px var(--warn)" : "none",
          display: "flex", alignItems: "center", gap: 5,
        }}
      >
        <span style={{ fontSize: 9, flexShrink: 0 }}>🔔</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={e => onHover(task, e)}
      onMouseLeave={onLeave}
      onClick={() => onClick(task)}
      style={{
        position: "absolute", top, height, left: 3, width: dayWidth - 6,
        background: "var(--bg-2)",
        borderLeft: `2px solid var(--cat-${task.cat})`,
        borderTop: "1px solid var(--line)",
        borderRight: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        borderRadius: "var(--radius-sm)",
        padding: "4px 7px", fontSize: 11, color: "var(--fg)",
        cursor: "pointer", overflow: "hidden",
        boxShadow: isSelected ? "0 0 0 1px var(--accent)" : "none",
        transition: "background .12s, box-shadow .12s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
        <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>{task.title}</span>
        {task.prio === "high" && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--warn)", flexShrink: 0, marginLeft: 4 }} />}
      </div>
      {height > 32 && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.04em" }}>
          {fmtHour(start)}–{fmtHour(start + dur)}
        </div>
      )}
    </div>
  );
}

function DayWidthBlock(props: { task: PlannerTask; isSelected: boolean; onHover: (t: PlannerTask, e: React.MouseEvent) => void; onLeave: () => void; onClick: (t: PlannerTask) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0 }}>
      {w > 0 && <TaskBlock {...props} dayWidth={w} />}
    </div>
  );
}

function AllDayBand({ task, leftPct, widthPct, rowIdx, onClick, onHover, onLeave, isSelected }: {
  task: PlannerTask; leftPct: number; widthPct: number; rowIdx: number;
  onClick: (t: PlannerTask) => void;
  onHover: (t: PlannerTask, e: React.MouseEvent) => void;
  onLeave: () => void;
  isSelected: boolean;
}) {
  return (
    <div
      onClick={() => onClick(task)}
      onMouseEnter={e => onHover(task, e)}
      onMouseLeave={onLeave}
      style={{
        position: "absolute",
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        top: 4 + rowIdx * 22, height: 20,
        background: `var(--cat-${task.cat})`,
        color: "var(--accent-fg)",
        borderRadius: "var(--radius-sm)",
        padding: "0 8px",
        display: "flex", alignItems: "center",
        fontSize: 11, fontWeight: 500,
        cursor: "pointer", overflow: "hidden",
        whiteSpace: "nowrap", textOverflow: "ellipsis",
        boxShadow: isSelected ? "0 0 0 2px var(--accent)" : "none",
        opacity: 0.92,
      }}
      title={task.title}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</span>
    </div>
  );
}

function DayWeekView({
  view, tasks, currentDate, hovered, setHovered, selected, setSelected,
}: {
  view: ViewMode; tasks: PlannerTask[]; currentDate: Date;
  hovered: { task: PlannerTask; x: number; y: number } | null;
  setHovered: (h: { task: PlannerTask; x: number; y: number } | null) => void;
  selected: PlannerTask | null;
  setSelected: (t: PlannerTask | null) => void;
}) {
  const dayCount = view === "day" ? 1 : 7;
  const startDate = view === "day" ? startOfDay(currentDate) : startOfWeek(currentDate);
  const days = Array.from({ length: dayCount }, (_, i) => addDays(startDate, i));
  const today = startOfDay(new Date());
  const winStart = days[0];
  const winEnd = days[days.length - 1];

  const visible = tasks.filter(t => {
    if (!t.date) return false;
    const ts = parseDate(t.date);
    const te = t.endDate ? parseDate(t.endDate) : ts;
    return te >= winStart && ts <= winEnd;
  });

  const allDayItems = visible.filter(t => t.allDay || t.endDate);
  const timedItems = visible.filter(t => !t.allDay && !t.endDate);

  // Stack all-day bands
  const rows: { startIdx: number; endIdxExclusive: number }[][] = [];
  const bandsWithRow = allDayItems
    .slice()
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .map(t => {
      const ts = parseDate(t.date);
      const te = t.endDate ? parseDate(t.endDate) : ts;
      const startIdx = Math.max(0, daysBetween(winStart, ts));
      const endIdxExclusive = Math.min(dayCount, daysBetween(winStart, te) + 1);
      let row = 0;
      while (rows[row] && rows[row].some(r => !(endIdxExclusive <= r.startIdx || startIdx >= r.endIdxExclusive))) row++;
      (rows[row] ||= []).push({ startIdx, endIdxExclusive });
      return { task: t, startIdx, endIdxExclusive, row };
    });
  const bandsHeight = Math.max(0, rows.length * 22 + 8);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      {/* Day headers */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--line)", background: "var(--bg-1)", flexShrink: 0 }}>
        <div style={{ width: TIME_COL, flexShrink: 0 }} />
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          return (
            <div key={i} style={{
              flex: 1, padding: "8px 10px",
              borderRight: "1px solid var(--line)",
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: isToday ? "var(--accent)" : "var(--fg-3)", letterSpacing: "0.06em" }}>
                {DAY_NAMES_SHORT[(d.getDay()+6)%7].toUpperCase()}
              </span>
              <span style={{
                fontFamily: "var(--font-display)", fontSize: 16,
                fontWeight: isToday ? "bold" : 400,
                color: isToday ? "var(--accent)" : "var(--fg)",
              }}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>

      {/* All-day band */}
      {bandsWithRow.length > 0 && (
        <div style={{ display: "flex", borderBottom: "1px solid var(--line)", background: "var(--bg-1)", flexShrink: 0 }}>
          <div style={{ width: TIME_COL, flexShrink: 0, padding: "8px 0", textAlign: "right", paddingRight: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.04em" }}>ALL DAY</span>
          </div>
          <div style={{ flex: 1, position: "relative", height: bandsHeight }}>
            {bandsWithRow.map((b, i) => (
              <AllDayBand
                key={b.task.id + "-" + i}
                task={b.task}
                leftPct={(b.startIdx / dayCount) * 100}
                widthPct={((b.endIdxExclusive - b.startIdx) / dayCount) * 100}
                rowIdx={b.row}
                isSelected={selected?.id === b.task.id}
                onClick={t => setSelected(t)}
                onHover={(t, e) => setHovered({ task: t, x: e.clientX, y: e.clientY })}
                onLeave={() => setHovered(null)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Hour grid + events */}
      <div style={{ flex: 1, position: "relative", overflow: "auto", display: "flex", minHeight: 0 }}>
        {/* Time labels */}
        <div style={{ width: TIME_COL, flexShrink: 0, borderRight: "1px solid var(--line)", position: "relative", minHeight: (HOUR_END - HOUR_START + 1) * HOUR_PX }}>
          {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => (
            <div key={i} style={{
              position: "absolute", top: i * HOUR_PX - 6, right: 8,
              fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.04em",
            }}>{fmtHour(HOUR_START + i)}</div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ flex: 1, position: "relative", minHeight: (HOUR_END - HOUR_START + 1) * HOUR_PX }}>
          <GridBackground dayCount={dayCount} />
          <NowLine days={days} />
          {timedItems.map(t => {
            if (!t.date) return null;
            const tDay = parseDate(t.date);
            const idx = daysBetween(winStart, tDay);
            if (idx < 0 || idx >= dayCount) return null;
            return (
              <div key={t.id} style={{
                position: "absolute", top: 0, bottom: 0,
                left: `${(idx / dayCount) * 100}%`, width: `${100 / dayCount}%`,
              }}>
                <DayWidthBlock task={t}
                  isSelected={selected?.id === t.id}
                  onHover={(task, e) => setHovered({ task, x: e.clientX, y: e.clientY })}
                  onLeave={() => setHovered(null)}
                  onClick={task => setSelected(task)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MonthView({ tasks, currentDate, selected, setSelected, setCurrentDate, setView }: {
  tasks: PlannerTask[]; currentDate: Date;
  selected: PlannerTask | null; setSelected: (t: PlannerTask | null) => void;
  setCurrentDate: (d: Date) => void; setView: (v: ViewMode) => void;
}) {
  const year = currentDate.getFullYear();
  const monthIdx = currentDate.getMonth();
  const first = new Date(year, monthIdx, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -startOffset);
  const today = startOfDay(new Date());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const tasksByIso: Record<string, PlannerTask[]> = {};
  tasks.forEach(t => {
    if (!t.date) return;
    const ts = parseDate(t.date);
    const te = t.endDate ? parseDate(t.endDate) : ts;
    for (let d = new Date(ts); d <= te; d = addDays(d, 1)) {
      const k = fmtIso(d);
      (tasksByIso[k] ||= []).push(t);
    }
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--line)", background: "var(--bg-1)", flexShrink: 0 }}>
        {["MON","TUE","WED","THU","FRI","SAT","SUN"].map(d => (
          <div key={d} style={{
            padding: "8px 12px", fontFamily: "var(--font-mono)", fontSize: 10,
            color: "var(--fg-3)", letterSpacing: "0.06em",
            borderRight: "1px solid var(--line)",
          }}>{d}</div>
        ))}
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: "repeat(6, 1fr)", minHeight: 0 }}>
        {cells.map((d, idx) => {
          const inMonth = d.getMonth() === monthIdx;
          const isToday = sameDay(d, today);
          const cellTasks = tasksByIso[fmtIso(d)] || [];
          const isWeekend = ((d.getDay()+6)%7) >= 5;
          return (
            <div key={idx}
              onDoubleClick={() => { setCurrentDate(startOfDay(d)); setView("day"); }}
              style={{
                borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)",
                padding: "4px 6px 3px",
                background: inMonth ? "var(--bg-1)" : "var(--bg)",
                display: "flex", flexDirection: "column", gap: 2, overflow: "hidden",
                opacity: inMonth ? 1 : 0.5, cursor: "pointer",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 10,
                  color: isToday ? "var(--accent-fg)" : (isWeekend ? "var(--fg-3)" : "var(--fg-2)"),
                  background: isToday ? "var(--accent)" : "transparent",
                  padding: isToday ? "1px 5px" : "1px 0",
                  borderRadius: 2,
                }}>{d.getDate()}</span>
                {cellTasks.length > 3 && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)" }}>+{cellTasks.length - 3}</span>
                )}
              </div>
              {cellTasks.slice(0, 3).map((t, i) => (
                <div key={t.id + "-" + i}
                  onClick={e => { e.stopPropagation(); setSelected(t); }}
                  style={{
                    fontSize: 10, color: "var(--fg)",
                    borderLeft: `2px solid var(--cat-${t.cat})`,
                    paddingLeft: 5, paddingRight: 3, paddingTop: 1, paddingBottom: 1,
                    background: selected?.id === t.id ? "var(--accent-tint)" : "transparent",
                    borderRadius: 2, cursor: "pointer",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    lineHeight: 1.3,
                  }}>{t.title}</div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Left rail ─────────────────────────────────────────────────────────────────

function LeftRail({ tasks, sources, startAdd }: {
  tasks: PlannerTask[]; sources: StagedFile[]; startAdd: () => void;
}) {
  const counts = tasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.cat] = (acc[t.cat] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{
      width: 200, borderRight: "1px solid var(--line)",
      background: "var(--bg-1)", display: "flex", flexDirection: "column",
      padding: "18px 14px", flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 22 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 4, background: "var(--accent)",
          display: "grid", placeItems: "center",
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
          color: "var(--accent-fg)",
        }}>P</div>
        <span style={{
          fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)",
          letterSpacing: "var(--display-tracking)", fontSize: 15,
        }}>Planner</span>
      </div>

      {/* New plan button */}
      <button onClick={startAdd} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        width: "100%", padding: "9px 10px", marginBottom: 18,
        background: "var(--accent)", color: "var(--accent-fg)",
        border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, cursor: "pointer",
      }}>+ New plan</button>

      {/* Sources */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em", marginBottom: 8 }}>
        SOURCES{sources.length ? ` · ${sources.length}` : ""}
      </div>
      {sources.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--fg-3)", lineHeight: 1.5 }}>
          No documents yet. Add files to build your plan.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {sources.slice(0, 6).map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--fg-2)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--fg-3)", border: "1px solid var(--line)", borderRadius: 2, padding: "1px 3px", flexShrink: 0 }}>
                {(f.kind || "file").toUpperCase().slice(0, 3)}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            </div>
          ))}
          {sources.length > 6 && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", marginTop: 2 }}>+{sources.length - 6} more</div>
          )}
        </div>
      )}

      {/* Categories */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em", marginTop: 22, marginBottom: 8 }}>CATEGORIES</div>
      {[
        { c: "work",  l: "Work" },
        { c: "meet",  l: "Meetings" },
        { c: "focus", l: "Focus" },
        { c: "life",  l: "Life" },
      ].map(o => (
        <div key={o.c} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", fontSize: 12, color: "var(--fg-2)" }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: `var(--cat-${o.c})` }} />
          <span style={{ flex: 1 }}>{o.l}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{counts[o.c] || 0}</span>
        </div>
      ))}

      {/* AI status */}
      <div style={{ marginTop: "auto", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em", marginBottom: 6 }}>AI STATUS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "var(--fg-2)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)" }} />
          {tasks.length ? "Optimized" : "Awaiting data"}
        </div>
      </div>
    </div>
  );
}

// ── AI Sidebar ────────────────────────────────────────────────────────────────

function AISidebar({ selected, setSelected, tasks, hasTasks, sourceCount, startAdd }: {
  selected: PlannerTask | null; setSelected: (t: PlannerTask | null) => void;
  tasks: PlannerTask[]; hasTasks: boolean; sourceCount: number; startAdd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const intro = hasTasks
    ? `I scanned ${sourceCount} document${sourceCount === 1 ? "" : "s"} and placed ${tasks.length} item${tasks.length === 1 ? "" : "s"} using their real dates. Add more anytime — I'll merge them into what's already here.`
    : "Your planner is empty. Add a document and I'll pull out every task, deadline, and event and place it on your calendar.";

  const firstUpcoming = useMemo(() => {
    if (!tasks.length) return null;
    return [...tasks].filter(t => t.date).sort((a, b) => (a.date || "").localeCompare(b.date || ""))[0];
  }, [tasks]);

  const chat = [
    { role: "ai", text: intro },
    ...(hasTasks && firstUpcoming ? [
      { role: "user", text: "When's the next big thing?" },
      { role: "ai", text: `The next item on your calendar is "${firstUpcoming.title}" on ${firstUpcoming.date}.` },
    ] : []),
  ];

  return (
    <div style={{
      width: 320, borderLeft: "1px solid var(--line)",
      background: "var(--bg-1)", display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 4,
          background: "var(--accent-tint)", color: "var(--accent)",
          display: "grid", placeItems: "center",
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
        }}>✦</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Scheduler</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.04em" }}>
            {hasTasks ? `ONLINE · ${sourceCount} SOURCE${sourceCount === 1 ? "" : "S"}` : "ONLINE · READY"}
          </div>
        </div>
        <button style={iconBtnStyle}>⋯</button>
      </div>

      {/* Selected task detail */}
      {selected && (
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em" }}>
              SELECTED · {String(selected.id).toUpperCase()}
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "transparent", border: 0, color: "var(--fg-3)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11 }}>✕</button>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{selected.title}</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <CategoryChip cat={selected.cat} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em", padding: "2px 5px", border: "1px solid var(--line)", borderRadius: 2 }}>
              {selected.prio.toUpperCase()}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-2)", letterSpacing: "0.04em", padding: "2px 5px", border: "1px solid var(--line)", borderRadius: 2 }}>
              {selected.date}{selected.endDate ? ` → ${selected.endDate}` : ""}
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.04em", marginBottom: 4 }}>WHY HERE</div>
          <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.5 }}>{selected.reason}</div>
          {selected.source && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.04em", marginTop: 8 }}>
              SOURCE · {selected.source}
            </div>
          )}
        </div>
      )}

      {/* Chat messages */}
      <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12, overflow: "auto", minHeight: 0 }}>
        {chat.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "92%",
            background: m.role === "user" ? "var(--accent-tint)" : "var(--bg-2)",
            border: m.role === "user" ? "1px solid var(--accent-tint)" : "1px solid var(--line)",
            padding: "8px 11px", borderRadius: "var(--radius-sm)",
            fontSize: 12, lineHeight: 1.5, color: "var(--fg)",
          }}>
            {m.role === "ai" && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.06em", marginBottom: 3 }}>SCHEDULER</div>
            )}
            {m.text}
          </div>
        ))}
      </div>

      {/* Bottom actions */}
      <div style={{ padding: "12px 18px", borderTop: "1px solid var(--line)" }}>
        {hasTasks ? (
          <>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em", marginBottom: 6 }}>SUGGESTED</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
              {SUGGESTED_PROMPTS.map(p => (
                <button key={p} onClick={() => setDraft(p)} style={{
                  fontSize: 10.5, padding: "4px 8px",
                  background: "var(--bg-2)", border: "1px solid var(--line)",
                  borderRadius: 3, color: "var(--fg-2)", cursor: "pointer",
                  fontFamily: "var(--font-ui)",
                }}>{p}</button>
              ))}
            </div>
          </>
        ) : (
          <button onClick={startAdd} style={{
            width: "100%", marginBottom: 10, padding: "9px 10px",
            background: "var(--accent-tint)", color: "var(--accent)",
            border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)",
            fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>+ Add documents to start</button>
        )}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--bg-2)", border: "1px solid var(--line)",
          borderRadius: "var(--radius-sm)", padding: "8px 12px",
        }}>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Ask the scheduler…"
            style={{ flex: 1, background: "transparent", border: 0, outline: "none", color: "var(--fg)", fontFamily: "var(--font-ui)", fontSize: 12 }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", padding: "1px 4px", border: "1px solid var(--line)", borderRadius: 2 }}>↵</span>
        </div>
      </div>
    </div>
  );
}

// ── Hover tooltip ─────────────────────────────────────────────────────────────

function HoverTooltip({ hovered, containerRef }: {
  hovered: { task: PlannerTask; x: number; y: number } | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (!hovered) return null;
  const containerRect = containerRef.current?.getBoundingClientRect();
  if (!containerRect) return null;
  const left = Math.min(hovered.x - containerRect.left + 14, containerRect.width - 300);
  const top = Math.min(hovered.y - containerRect.top + 12, containerRect.height - 120);
  return (
    <div style={{
      position: "absolute", left, top, zIndex: 50,
      width: 280, padding: "10px 12px",
      background: "var(--bg-3)", border: "1px solid var(--line-2)",
      borderRadius: "var(--radius-sm)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      pointerEvents: "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hovered.task.title}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.06em", flexShrink: 0 }}>WHY?</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--fg-2)", lineHeight: 1.5 }}>{hovered.task.reason}</div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function CalendarEmptyState({ startAdd, loadSample }: { startAdd: () => void; loadSample: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ maxWidth: 460, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{
          width: 56, height: 56, borderRadius: "var(--radius)",
          background: "var(--accent-tint)", color: "var(--accent)",
          display: "grid", placeItems: "center",
          fontFamily: "var(--font-mono)", fontSize: 24,
        }}>✦</div>
        <div>
          <div style={{
            fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)",
            letterSpacing: "var(--display-tracking)", fontSize: 34, lineHeight: 1.1,
          }}>Your planner is empty.</div>
          <div style={{ fontSize: 14, color: "var(--fg-2)", marginTop: 10, lineHeight: 1.55, maxWidth: 400 }}>
            Drop in notes, spreadsheets, or docs and the scheduler builds your calendar.
            Add more anytime — nothing gets overwritten.
          </div>
        </div>
        <button onClick={startAdd} style={{
          padding: "13px 28px", background: "var(--accent)", color: "var(--accent-fg)",
          border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)",
          fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, cursor: "pointer",
          boxShadow: "0 2px 12px var(--accent-tint)",
        }}>Start Planning</button>
        <button onClick={loadSample} style={{
          background: "transparent", border: 0, color: "var(--fg-3)", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em",
          textDecoration: "underline", textDecorationColor: "var(--line-2)",
        }}>or explore a sample week</button>
      </div>
    </div>
  );
}

// ── Calendar screen ───────────────────────────────────────────────────────────

function ScreenCalendar({ state, set, startAdd }: {
  state: PlannerState;
  set: (p: Partial<PlannerState>) => void;
  startAdd: () => void;
  projectId?: string;
  userId?: string;
}) {
  const tasks = state.tasks || [];
  const hasTasks = tasks.length > 0;
  const sources = state.sources || [];

  const initialDate = useMemo(() => {
    const now = startOfDay(new Date());
    const upcoming = tasks.filter(t => t.date).map(t => parseDate(t.date!)).filter(d => d >= now).sort((a, b) => a.getTime() - b.getTime());
    if (upcoming.length) return upcoming[0];
    const past = tasks.filter(t => t.date).map(t => parseDate(t.date!)).sort((a, b) => a.getTime() - b.getTime());
    return past[Math.floor(past.length / 2)] || now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tasks]);

  const [view, setView] = useState<ViewMode>(state.view || "week");
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [hovered, setHovered] = useState<{ task: PlannerTask; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<PlannerTask | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setCurrentDate(initialDate); }, [initialDate]);

  const loadSample = useCallback(() => {
    set({ tasks: getSampleTasks(), sources: [{ name: "sample-week.ics", kind: "ics", size: "1 KB", items: 17 }] });
  }, [set]);

  return (
    <div ref={containerRef} style={{ height: "100%", display: "flex", position: "relative" }}>
      <LeftRail tasks={tasks} sources={sources} startAdd={startAdd} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <CalendarToolbar
          view={view} setView={setView}
          currentDate={currentDate} setCurrentDate={setCurrentDate}
          hasTasks={hasTasks} taskCount={tasks.length} onAdd={startAdd}
        />
        <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "var(--bg)", minHeight: 0 }}>
          {!hasTasks
            ? <CalendarEmptyState startAdd={startAdd} loadSample={loadSample} />
            : view === "month"
              ? <MonthView tasks={tasks} currentDate={currentDate} selected={selected} setSelected={setSelected} setCurrentDate={setCurrentDate} setView={setView} />
              : <DayWeekView view={view} tasks={tasks} currentDate={currentDate} hovered={hovered} setHovered={setHovered} selected={selected} setSelected={setSelected} />
          }
        </div>
      </div>
      <AISidebar selected={selected} setSelected={setSelected} tasks={tasks} hasTasks={hasTasks} sourceCount={sources.length} startAdd={startAdd} />
      <HoverTooltip hovered={hovered} containerRef={containerRef} />
    </div>
  );
}

// ── Root PlannerApp ───────────────────────────────────────────────────────────

export default function PlannerApp() {
  const { user, signOut } = useAuth();

  const [state, setState] = useState<PlannerState>({
    screen: "calendar",
    files: [],
    rawFiles: [],
    tasks: [],
    sources: [],
    view: "week",
  });

  // The current project ID — resolved once on mount.
  const projectIdRef = useRef<string | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState("");

  // Load persisted tasks on mount
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setDbLoading(true);
      setDbError("");

      const project = await getOrCreateDefaultProject(user.id);
      if (cancelled) return;

      if (!project) {
        setDbError("Could not load your plan. Please refresh.");
        setDbLoading(false);
        return;
      }

      projectIdRef.current = project.id;
      const tasks = await loadTasks(project.id);
      if (cancelled) return;

      setState(s => ({
        ...s,
        tasks,
        // Show sources derived from the loaded tasks (unique sources)
        sources: [...new Map(
          tasks.filter(t => t.source).map(t => [
            t.source,
            { name: t.source!, kind: "doc", size: "", items: 0 },
          ])
        ).values()],
      }));
      setDbLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user]);

  const set = useCallback((patch: Partial<PlannerState>) => {
    setState(s => ({ ...s, ...patch }));
  }, []);

  const startAdd = useCallback(() => {
    setState(s => ({ ...s, screen: "upload", files: [], rawFiles: [] }));
  }, []);

  const resetAll = useCallback(async () => {
    setState(s => ({ ...s, screen: "calendar", files: [], rawFiles: [], tasks: [], sources: [] }));
    // Delete all persisted tasks for this project
    if (projectIdRef.current) {
      await deleteAllTasks(projectIdRef.current);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    // Middleware will redirect to /login
    window.location.href = "/login";
  }, [signOut]);

  const Screen = state.screen === "upload"
    ? ScreenUpload
    : state.screen === "extracting"
      ? ScreenExtractionWrapper
      : ScreenCalendar;

  return (
    <div suppressHydrationWarning style={{
      width: "100vw", height: "100vh",
      background: "var(--bg)", color: "var(--fg)",
      fontFamily: "var(--font-ui)", fontSize: 13,
      overflow: "hidden", position: "relative",
      display: "flex", flexDirection: "column",
    }}>
      <FlowBar
        state={state}
        set={set}
        startAdd={startAdd}
        resetAll={resetAll}
        userEmail={user?.email}
        onSignOut={handleSignOut}
      />
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0, position: "relative" }}>
        {dbLoading ? (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: "0.06em",
          }}>
            LOADING YOUR PLAN…
          </div>
        ) : dbError ? (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              padding: "16px 24px", background: "rgba(168,68,43,0.08)",
              border: "1px solid rgba(168,68,43,0.25)", borderRadius: "var(--radius-sm)",
              fontSize: 13, color: "var(--warn)", fontFamily: "var(--font-ui)",
            }}>{dbError}</div>
          </div>
        ) : (
          <Screen
            state={state}
            set={set}
            startAdd={startAdd}
            projectId={projectIdRef.current ?? ""}
            userId={user?.id ?? ""}
          />
        )}
      </div>
    </div>
  );
}

// ── Extraction wrapper that handles Supabase persistence ──────────────────────

function ScreenExtractionWrapper({
  state, set, startAdd, projectId, userId,
}: {
  state: PlannerState;
  set: (p: Partial<PlannerState>) => void;
  startAdd: () => void;
  projectId: string;
  userId: string;
}) {
  // Intercept the set call so that when the screen switches to "calendar"
  // after confirmation, we persist the new tasks to Supabase first.
  const setWithPersist = useCallback(async (patch: Partial<PlannerState>) => {
    // Detect the confirmation step: screen switches to "calendar" with new tasks
    if (patch.screen === "calendar" && patch.tasks && projectId && userId) {
      const existing = state.tasks ?? [];
      const incoming = patch.tasks.filter(
        t => !existing.find(e => e.id === t.id)
      );
      if (incoming.length > 0) {
        const saved = await insertTasks(incoming, projectId, userId);
        // Remap client IDs to DB UUIDs in the merged list
        const idMap = new Map(incoming.map((t, i) => [t.id, saved[i]?.id ?? t.id]));
        patch = {
          ...patch,
          tasks: patch.tasks.map(t => idMap.has(t.id) ? { ...t, id: idMap.get(t.id)! } : t),
        };
      }
    }
    set(patch);
  }, [set, state.tasks, projectId, userId]);

  return <ScreenExtraction state={state} set={setWithPersist} startAdd={startAdd} />;
}
