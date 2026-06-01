// Root PlannerApp — composes screens and applies a theme.
// Each design-canvas artboard mounts one PlannerApp with a direction prop.
//
// Flow model (iterative, calendar-centric):
//   • The calendar is the HOME screen and starts completely empty.
//   • "Start Planning" opens the upload → extract sub-flow.
//   • Extracted items MERGE into the existing plan (never replace), so users
//     can keep adding documents and plans without starting over.
//   • A full reset is an explicit, secondary action only.

const { useState, useEffect, useMemo, useRef } = React;

const PlannerApp = ({ direction, tone, defaultView, startScreen, instanceId }) => {
  const [state, setState] = useState({
    screen: startScreen || "calendar",
    files: [],            // staging buffer for the CURRENT upload session
    rawFiles: [],         // matching native File objects, for actual reading
    tasks: [],            // accumulated tasks across all sessions (empty on launch)
    sources: [],          // accumulated file metadata across sessions (for context)
    view: defaultView || "week",
  });

  const set = (patch) => setState(s => ({ ...s, ...patch }));

  // Open the upload sub-flow with a fresh staging buffer. Existing tasks +
  // sources are preserved so additions build on prior work.
  const startAdd = () => setState(s => ({ ...s, screen: "upload", files: [], rawFiles: [] }));

  // Explicit "clear everything" — the only path back to a blank planner.
  const resetAll = () => setState(s => ({
    ...s, screen: "calendar", files: [], rawFiles: [], tasks: [], sources: [],
  }));

  useEffect(() => {
    if (defaultView && defaultView !== state.view) set({ view: defaultView });
  }, [defaultView]);

  // When the user changes the "Start at" tweak, jump every artboard to that
  // screen. Without this the prop change would be silently ignored after mount.
  useEffect(() => {
    if (startScreen && startScreen !== state.screen) set({ screen: startScreen });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startScreen]);

  // Build CSS vars for this instance and scope them to a wrapper.
  const vars = useMemo(() => window.buildPlannerVars(direction, tone), [direction, tone]);
  const wrapperStyle = {
    ...vars,
    width: "100%",
    height: "100%",
    background: "var(--bg)",
    color: "var(--fg)",
    fontFamily: "var(--font-ui)",
    fontSize: 13,
    overflow: "hidden",
    position: "relative",
  };

  const Screen = {
    upload: window.ScreenUpload,
    extracting: window.ScreenExtraction,
    calendar: window.ScreenCalendar,
  }[state.screen] || window.ScreenCalendar;

  return (
    <div style={wrapperStyle}>
      {/* Mini app chrome at the top */}
      <FlowBar state={state} set={set} startAdd={startAdd} resetAll={resetAll} direction={direction} />
      <div style={{ position: "absolute", top: 36, left: 0, right: 0, bottom: 0 }}>
        <Screen state={state} set={set} startAdd={startAdd} resetAll={resetAll} />
      </div>
    </div>
  );
};

const FlowBar = ({ state, set, startAdd, resetAll, direction }) => {
  const dirLabel = window.PLANNER_THEMES[direction]?.label || direction;
  const inFlow = state.screen === "upload" || state.screen === "extracting";
  const hasData = (state.tasks?.length || 0) > 0 || (state.sources?.length || 0) > 0;

  return (
    <div style={{
      height: 36, padding: "0 14px",
      borderBottom: "1px solid var(--line)",
      background: "var(--bg-1)",
      display: "flex", alignItems: "center", gap: 12,
      fontFamily: "var(--font-mono)", fontSize: 10,
      color: "var(--fg-3)", letterSpacing: "0.05em",
    }}>
      <span style={{ color: "var(--accent)" }}>● {dirLabel.toUpperCase()}</span>
      <span style={{ width: 1, height: 14, background: "var(--line-2)" }} />

      {inFlow ? (
        // Sub-flow: show the two-step progress (Upload → Extract).
        <>
          {[{ k: "upload", l: "Add documents" }, { k: "extracting", l: "Extract" }].map((s, i) => {
            const active = s.k === state.screen;
            const order = ["upload", "extracting"];
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
            <button onClick={resetAll} title="Clear all plans and start over" style={{
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
    </div>
  );
};

window.PlannerApp = PlannerApp;
