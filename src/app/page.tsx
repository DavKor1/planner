// src/app/page.tsx
// Calendar home screen — to be implemented following the design reference at
// docs/design-reference/calendar-screen.jsx

export default function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        flexDirection: "column",
        gap: "16px",
        color: "var(--fg-2)",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        letterSpacing: "0.08em",
      }}
    >
      <span style={{ color: "var(--accent)", fontSize: "20px" }}>◆ PLANNER</span>
      <p>CALENDAR VIEW — TO BE IMPLEMENTED</p>
      <p style={{ color: "var(--fg-3)" }}>
        See <code>docs/design-reference/calendar-screen.jsx</code>
      </p>
    </main>
  );
}
