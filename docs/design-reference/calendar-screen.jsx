// Date-based calendar screen with day / week / month views, all-day band for
// multi-day events, AI sidebar, and hover reasoning.

// ── Date helpers ────────────────────────────────────────────────────────────
const MS_DAY = 86400000;
const parseDate = (iso) => {
  // iso is "YYYY-MM-DD" — parse as local midnight (not UTC) so day math doesn't
  // skew across timezones.
  if (!iso) return new Date();
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fmtIso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const startOfWeek = (d) => {
  // Monday as week start
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // 0 = Mon
  x.setDate(x.getDate() - dow);
  return x;
};
const sameDay = (a, b) => fmtIso(a) === fmtIso(b);
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / MS_DAY);
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_NAMES_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY_NAMES = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const HOUR_START = 7;
const HOUR_END = 21;
const HOUR_PX = 36;
const TIME_COL = 56;

const fmtHour = (h) => {
  const hr = ((Math.floor(h) - 1) % 12) + 1;
  const ampm = h < 12 ? "a" : "p";
  const min = (h % 1) ? ":30" : "";
  return `${hr}${min}${ampm}`;
};

const iconBtnStyle = () => ({
  width: 28, height: 28, borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)", background: "var(--bg-2)",
  color: "var(--fg-2)", cursor: "pointer",
  fontFamily: "var(--font-mono)", fontSize: 12,
});

// ── Toolbar ─────────────────────────────────────────────────────────────────
const CalendarToolbar = ({ view, setView, currentDate, setCurrentDate, hasTasks, taskCount, onAdd }) => {
  const monthLabel = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  const weekStart = startOfWeek(currentDate);
  const weekEnd = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const weekLabel = sameMonth
    ? `${MONTH_NAMES_SHORT[weekStart.getMonth()]} ${weekStart.getDate()}–${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
    : `${MONTH_NAMES_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTH_NAMES_SHORT[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  const dayLabel = `${DAY_NAMES[(currentDate.getDay()+6)%7]}, ${MONTH_NAMES_SHORT[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`;
  const label = view === "month" ? monthLabel : view === "day" ? dayLabel : weekLabel;

  const shift = (delta) => {
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
        <button onClick={() => shift(-1)} style={iconBtnStyle()}>←</button>
        <button onClick={() => shift(1)} style={iconBtnStyle()}>→</button>
        <button onClick={() => setCurrentDate(startOfDay(new Date()))} style={{ ...ghostBtnStyle(), padding: "6px 10px", fontSize: 11 }}>Today</button>
      </div>
      <div style={{
        fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)",
        letterSpacing: "var(--display-tracking)", fontSize: 18,
      }}>{label}</div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: 2 }}>
        {["day", "week", "month"].map(v => (
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
};

// ── Task block (timed) ──────────────────────────────────────────────────────
const TaskBlock = ({ task, dayWidth, onHover, onLeave, onClick, isSelected }) => {
  const start = task.start ?? 9;
  const dur = task.dur ?? 1;
  const top = (start - HOUR_START) * HOUR_PX;
  const height = Math.max(20, dur * HOUR_PX - 2);
  return (
    <div
      onMouseEnter={(e) => onHover(task, e)}
      onMouseLeave={onLeave}
      onClick={() => onClick(task)}
      style={{
        position: "absolute",
        top, height, left: 3, width: dayWidth - 6,
        background: "var(--bg-2)",
        borderLeft: `2px solid var(--cat-${task.cat})`,
        borderTop: "1px solid var(--line)",
        borderRight: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        borderRadius: "var(--radius-sm)",
        padding: "4px 7px",
        fontSize: 11, color: "var(--fg)",
        cursor: "pointer", overflow: "hidden",
        boxShadow: isSelected ? `0 0 0 1px var(--accent)` : "none",
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
};

// ── All-day band (single bar per multi-day or all-day event) ───────────────
const AllDayBand = ({ task, leftPct, widthPct, rowIdx, onClick, onHover, onLeave, isSelected }) => (
  <div
    onClick={() => onClick(task)}
    onMouseEnter={(e) => onHover(task, e)}
    onMouseLeave={onLeave}
    style={{
      position: "absolute",
      left: `calc(${leftPct}% + 2px)`,
      width: `calc(${widthPct}% - 4px)`,
      top: 4 + rowIdx * 22,
      height: 20,
      background: `var(--cat-${task.cat})`,
      color: "var(--accent-fg)",
      borderRadius: "var(--radius-sm)",
      padding: "0 8px",
      display: "flex", alignItems: "center", gap: 6,
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

// ── Grid background ─────────────────────────────────────────────────────────
const GridBackground = ({ width, dayCount }) => {
  const lines = [];
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
};

const NowLine = ({ days, currentDate }) => {
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
      <div style={{
        position: "absolute", top, left: `${left}%`, width: `${w}%`, height: 1,
        background: "var(--accent)", zIndex: 3,
      }} />
      <div style={{
        position: "absolute", top: top - 3, left: `calc(${left}% - 3px)`, width: 7, height: 7,
        borderRadius: "50%", background: "var(--accent)", zIndex: 3,
      }} />
    </>
  );
};

// ── Day / Week view ─────────────────────────────────────────────────────────
const DayWeekView = ({ view, tasks, currentDate, hovered, setHovered, selected, setSelected }) => {
  const dayCount = view === "day" ? 1 : 7;
  const startDate = view === "day" ? startOfDay(currentDate) : startOfWeek(currentDate);
  const days = Array.from({ length: dayCount }, (_, i) => addDays(startDate, i));
  const today = startOfDay(new Date());

  // Partition tasks intersecting the visible window
  const winStart = days[0];
  const winEnd = days[days.length - 1];
  const visible = tasks.filter(t => {
    const ts = parseDate(t.date);
    const te = t.endDate ? parseDate(t.endDate) : ts;
    return te >= winStart && ts <= winEnd;
  });
  const allDayItems = visible.filter(t => t.allDay || t.endDate);
  const timedItems = visible.filter(t => !t.allDay && !t.endDate);

  // Build all-day rows so bands stack without overlap.
  const rows = [];
  const bandsWithRow = allDayItems
    .slice()
    .sort((a, b) => parseDate(a.date) - parseDate(b.date))
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
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: isToday ? "var(--accent)" : "var(--fg-3)",
                letterSpacing: "0.06em",
              }}>{DAY_NAMES_SHORT[(d.getDay()+6)%7].toUpperCase()}</span>
              <span style={{
                fontFamily: "var(--font-display)", fontSize: 16,
                fontWeight: isToday ? "var(--display-weight)" : 400,
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
            {bandsWithRow.map((b, i) => {
              const leftPct = (b.startIdx / dayCount) * 100;
              const widthPct = ((b.endIdxExclusive - b.startIdx) / dayCount) * 100;
              return (
                <AllDayBand
                  key={b.task.id || i}
                  task={b.task}
                  leftPct={leftPct} widthPct={widthPct} rowIdx={b.row}
                  isSelected={selected?.id === b.task.id}
                  onClick={(t) => setSelected(t)}
                  onHover={(t, e) => setHovered({ task: t, x: e.clientX, y: e.clientY })}
                  onLeave={() => setHovered(null)}
                />
              );
            })}
          </div>
        </div>
      )}
      {/* Hour grid */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", minHeight: 0 }}>
        <div style={{ width: TIME_COL, flexShrink: 0, borderRight: "1px solid var(--line)", position: "relative", overflow: "hidden" }}>
          {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => {
            const h = HOUR_START + i;
            return (
              <div key={h} style={{
                position: "absolute", top: i * HOUR_PX - 6, right: 8,
                fontFamily: "var(--font-mono)", fontSize: 9,
                color: "var(--fg-3)", letterSpacing: "0.04em",
              }}>{fmtHour(h)}</div>
            );
          })}
        </div>
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <GridBackground dayCount={dayCount} />
          <NowLine days={days} currentDate={currentDate} />
          {timedItems.map(t => {
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
                  onClick={(task) => setSelected(task)} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Wrapper so TaskBlock can size itself to its parent via offsetWidth.
const DayWidthBlock = ({ task, isSelected, onHover, onLeave, onClick }) => {
  const ref = React.useRef(null);
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0 }}>
      {w > 0 && <TaskBlock task={task} dayWidth={w} isSelected={isSelected} onHover={onHover} onLeave={onLeave} onClick={onClick} />}
    </div>
  );
};

// ── Month view ──────────────────────────────────────────────────────────────
const MonthView = ({ tasks, currentDate, selected, setSelected, setCurrentDate, setView }) => {
  const year = currentDate.getFullYear();
  const monthIdx = currentDate.getMonth();
  const first = new Date(year, monthIdx, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon = 0
  const gridStart = addDays(first, -startOffset);
  const today = startOfDay(new Date());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  // Bucket tasks per cell (single-day) and also note multi-day overlaps.
  const tasksByIso = {};
  tasks.forEach(t => {
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
                opacity: inMonth ? 1 : 0.5,
                cursor: "pointer",
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
                <div key={t.id + "-" + i} onClick={(e) => { e.stopPropagation(); setSelected(t); }} style={{
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
};

// ── Left rail ───────────────────────────────────────────────────────────────
const LeftRail = ({ set, tasks, sources = [], startAdd, resetAll }) => {
  const counts = tasks.reduce((acc, t) => { acc[t.cat] = (acc[t.cat] || 0) + 1; return acc; }, {});
  return (
    <div style={{
      width: 200, borderRight: "1px solid var(--line)",
      background: "var(--bg-1)", display: "flex", flexDirection: "column",
      padding: "18px 14px", flexShrink: 0,
    }}>
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
      <button onClick={startAdd} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        width: "100%", padding: "9px 10px", marginBottom: 18,
        background: "var(--accent)", color: "var(--accent-fg)",
        border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, cursor: "pointer",
      }}>+ New plan</button>

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
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--fg-3)", border: "1px solid var(--line)", borderRadius: 2, padding: "1px 3px", flexShrink: 0 }}>{(f.kind || "file").toUpperCase().slice(0, 3)}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            </div>
          ))}
          {sources.length > 6 && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", marginTop: 2 }}>+{sources.length - 6} more</div>
          )}
        </div>
      )}

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em", marginTop: 22, marginBottom: 8 }}>CATEGORIES</div>
      {[
        { c: "work",  l: "Work" },
        { c: "meet",  l: "Meetings" },
        { c: "focus", l: "Focus" },
        { c: "life",  l: "Life" },
      ].map(o => (
        <div key={o.c} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 10px", fontSize: 12, color: "var(--fg-2)",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: `var(--cat-${o.c})` }} />
          <span style={{ flex: 1 }}>{o.l}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{counts[o.c] || 0}</span>
        </div>
      ))}

      <div style={{ marginTop: "auto", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em", marginBottom: 6 }}>AI STATUS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: "var(--fg-2)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)" }} />
          {tasks.length ? "Optimized" : "Awaiting data"}
        </div>
      </div>
    </div>
  );
};

// ── AI sidebar ──────────────────────────────────────────────────────────────
const RecurrenceLogPanel = ({ log }) => {
  const [open, setOpen] = React.useState(true);
  return (
    <div style={{ borderBottom: "1px solid var(--line)", background: "var(--bg-1)" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        padding: "10px 18px", background: "transparent", border: 0, cursor: "pointer",
        textAlign: "left",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)",
          letterSpacing: "0.06em",
        }}>RECURRENCE · {log.length} RULE{log.length === 1 ? "" : "S"} EXPANDED</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 18px 12px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflow: "auto" }}>
          {log.map((line, i) => {
            // Split summary line and (optional) assumption line.
            const parts = line.split(/\n\s*↳ assumptions: /);
            const summary = parts[0].replace(/^·\s*/, "");
            const assumptions = parts[1];
            return (
              <div key={i} style={{
                background: "var(--bg-2)", border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)", padding: "8px 10px",
              }}>
                <div style={{ fontSize: 11, color: "var(--fg)", lineHeight: 1.45 }}>{summary}</div>
                {assumptions && (
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--warn)",
                    marginTop: 4, lineHeight: 1.4,
                  }}>↳ {assumptions}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AISidebar = ({ selected, setSelected, tasks, hasTasks, sourceCount, startAdd }) => {
  const [draft, setDraft] = React.useState("");
  const intro = hasTasks
    ? `I scanned ${sourceCount} document${sourceCount === 1 ? "" : "s"} and placed ${tasks.length} item${tasks.length === 1 ? "" : "s"} using their real dates. Add more anytime — I'll merge them into what's already here.`
    : "Your planner is empty. Add a document and I'll pull out every task, deadline, and event and place it on your calendar.";
  const chat = [
    { role: "ai", text: intro },
    ...(hasTasks ? [
      { role: "user", text: "When's the next big thing?" },
      { role: "ai", text: tasks.length
        ? `The next item on your calendar is "${[...tasks].sort((a,b)=>(a.date||"").localeCompare(b.date||""))[0]?.title}" on ${[...tasks].sort((a,b)=>(a.date||"").localeCompare(b.date||""))[0]?.date}.`
        : "Nothing scheduled yet." },
    ] : []),
  ];

  return (
    <div style={{
      width: 320, borderLeft: "1px solid var(--line)",
      background: "var(--bg-1)", display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 4,
          background: "var(--accent-tint)", color: "var(--accent)",
          display: "grid", placeItems: "center",
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
        }}>✦</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Scheduler</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.04em" }}>{hasTasks ? `ONLINE · ${sourceCount} SOURCE${sourceCount === 1 ? "" : "S"}` : "ONLINE · READY"}</div>
        </div>
        <button style={iconBtnStyle()}>⋯</button>
      </div>

      {selected && (
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em" }}>SELECTED · {String(selected.id).toUpperCase()}</div>
            <button onClick={() => setSelected(null)} style={{ background: "transparent", border: 0, color: "var(--fg-3)", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11 }}>✕</button>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{selected.title}</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <CategoryChip cat={selected.cat} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em", padding: "2px 5px", border: "1px solid var(--line)", borderRadius: 2 }}>{selected.prio.toUpperCase()}</span>
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

      {hasTasks && Array.isArray(window.PLANNER_RECURRENCE_LOG) && window.PLANNER_RECURRENCE_LOG.length > 0 && (
        <RecurrenceLogPanel log={window.PLANNER_RECURRENCE_LOG} />
      )}


      <div style={{ flex: 1, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", minHeight: 0 }}>
        {chat.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "92%",
            background: m.role === "user" ? "var(--accent-tint)" : "var(--bg-2)",
            border: m.role === "user" ? "1px solid var(--accent-tint)" : "1px solid var(--line)",
            padding: "8px 11px", borderRadius: "var(--radius-sm)",
            fontSize: 12, lineHeight: 1.5,
            color: "var(--fg)",
          }}>
            {m.role === "ai" && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--accent)", letterSpacing: "0.06em", marginBottom: 3 }}>SCHEDULER</div>
            )}
            {m.text}
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 18px", borderTop: "1px solid var(--line)" }}>
        {hasTasks ? (
          <>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", letterSpacing: "0.06em", marginBottom: 6 }}>SUGGESTED</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
              {window.PLANNER_PROMPTS.map(p => (
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
            style={{
              flex: 1, background: "transparent", border: 0, outline: "none",
              color: "var(--fg)", fontFamily: "var(--font-ui)", fontSize: 12,
            }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", padding: "1px 4px", border: "1px solid var(--line)", borderRadius: 2 }}>↵</span>
        </div>
      </div>
    </div>
  );
};

// ── Hover tooltip ───────────────────────────────────────────────────────────
const HoverTooltip = ({ hovered, containerRef }) => {
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
};

// ── Root calendar screen ────────────────────────────────────────────────────
const ScreenCalendar = ({ state, set, startAdd, resetAll }) => {
  const tasks = state.tasks || [];
  const hasTasks = tasks.length > 0;
  const sources = state.sources || [];

  // Auto-center: when arriving here for the first time, jump to today or, if
  // no tasks are scheduled in the next 30 days, to the median of the tasks.
  const initialDate = React.useMemo(() => {
    const now = startOfDay(new Date());
    const upcoming = tasks
      .map(t => parseDate(t.date))
      .filter(d => d >= now)
      .sort((a, b) => a - b);
    if (upcoming.length) return upcoming[0];
    // Fall back to median of past tasks if all are past
    const past = tasks.map(t => parseDate(t.date)).sort((a, b) => a - b);
    return past[Math.floor(past.length / 2)] || now;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tasks]);

  const [view, setView] = React.useState(state.view || "week");
  const [currentDate, setCurrentDate] = React.useState(initialDate);
  const [hovered, setHovered] = React.useState(null);
  const [selected, setSelected] = React.useState(null);
  const containerRef = React.useRef(null);

  // Re-center whenever the upstream task set changes (e.g. fresh extraction).
  React.useEffect(() => { setCurrentDate(initialDate); }, [initialDate]);
  React.useEffect(() => {
    if (state.view && state.view !== view) setView(state.view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.view]);

  return (
    <div ref={containerRef} style={{ height: "100%", display: "flex", position: "relative" }}>
      <LeftRail set={set} tasks={tasks} sources={sources} startAdd={startAdd} resetAll={resetAll} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <CalendarToolbar view={view} setView={setView}
          currentDate={currentDate} setCurrentDate={setCurrentDate}
          hasTasks={hasTasks} taskCount={tasks.length} onAdd={startAdd} />
        <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "var(--bg)", minHeight: 0 }}>
          {!hasTasks
            ? <CalendarEmptyState startAdd={startAdd} set={set} />
            : view === "month"
              ? <MonthView tasks={tasks} currentDate={currentDate}
                  selected={selected} setSelected={setSelected}
                  setCurrentDate={setCurrentDate} setView={setView} />
              : <DayWeekView view={view} tasks={tasks} currentDate={currentDate}
                  hovered={hovered} setHovered={setHovered}
                  selected={selected} setSelected={setSelected} />
          }
        </div>
      </div>
      <AISidebar selected={selected} setSelected={setSelected}
        tasks={tasks} hasTasks={hasTasks} sourceCount={sources.length} startAdd={startAdd} />
      <HoverTooltip hovered={hovered} containerRef={containerRef} />
    </div>
  );
};

// Prominent first-run state. The accent CTA is where the eye lands when the
// calendar opens empty.
const CalendarEmptyState = ({ startAdd, set }) => (
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
      <button onClick={() => set({ tasks: window.PLANNER_TASKS, sources: [{ name: "sample-week.ics", kind: "ics" }] })} style={{
        background: "transparent", border: 0, color: "var(--fg-3)", cursor: "pointer",
        fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.04em",
        textDecoration: "underline", textDecorationColor: "var(--line-2)",
      }}>or explore a sample week</button>
    </div>
  </div>
);

Object.assign(window, { ScreenCalendar });
