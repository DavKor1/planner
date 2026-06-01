// Sample data shown when the user jumps straight to the calendar via Tweaks
// without running the upload flow. Dates anchor to the current week so the
// canvas always lands on a populated view.

(function () {
  const today = new Date();
  // Find this week's Monday
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const iso = (offset) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    // Use local Y/M/D components — toISOString() returns UTC, which is off by
    // one calendar day in any positive UTC-offset timezone.
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  window.PLANNER_TASKS = [
    { id: "t1",  title: "Finish Q3 deck",            cat: "work",  date: iso(0), allDay: false, start: 9,    dur: 2.5, prio: "high",  reason: "Pulled from Q3-deliverables.xlsx, deadline Thu — placed early in your highest-focus block.", source: "Q3-deliverables.xlsx" },
    { id: "t2",  title: "Design review w/ Lin",      cat: "meet",  date: iso(0), allDay: false, start: 13,   dur: 1,   prio: "med",   reason: "Recurring Mon 1pm in Calendar export.csv.", source: "Calendar export.csv" },
    { id: "t3",  title: "Gym · upper",                cat: "life",  date: iso(0), allDay: false, start: 18.5, dur: 1,   prio: "low",   reason: "'Gym ~3×/week' from personal-goals.md — anchored to your evening window.", source: "personal-goals.md" },
    { id: "t4",  title: "Inbox triage",               cat: "work",  date: iso(1), allDay: false, start: 9,    dur: 0.5, prio: "low",   reason: "Daily ritual detected in standup notes.", source: "Team standups notes.docx" },
    { id: "t5",  title: "Spec: pricing v2",           cat: "focus", date: iso(1), allDay: false, start: 10,   dur: 3,   prio: "high",  reason: "Largest unblocked task, batched into Tue deep-work window.", source: "Q3-deliverables.xlsx" },
    { id: "t6",  title: "1:1 · Marco",                cat: "meet",  date: iso(1), allDay: false, start: 14,   dur: 0.5, prio: "med",   reason: "Weekly 1:1 — kept at user's preferred 2pm slot.", source: "Calendar export.csv" },
    { id: "t7",  title: "Doctor — bloodwork",         cat: "life",  date: iso(1), allDay: false, start: 16,   dur: 1,   prio: "high",  reason: "'Before Friday' from goals.md — earliest available afternoon.", source: "personal-goals.md" },
    { id: "t8",  title: "Pricing draft → eng review", cat: "focus", date: iso(2), allDay: false, start: 9.5,  dur: 2,   prio: "high",  reason: "Dependent on the pricing spec. Scheduled the morning after.", source: "Q3-deliverables.xlsx" },
    { id: "t9",  title: "Team standup",               cat: "meet",  date: iso(2), allDay: false, start: 12,   dur: 0.5, prio: "med",   reason: "Mon/Wed/Fri recurring.", source: "Team standups notes.docx" },
    { id: "t10", title: "Gym · cardio",               cat: "life",  date: iso(2), allDay: false, start: 18,   dur: 1,   prio: "low",   reason: "2nd gym session of the week.", source: "personal-goals.md" },
    { id: "t11", title: "Customer interview · Alex",  cat: "meet",  date: iso(3), allDay: false, start: 10,   dur: 1,   prio: "high",  reason: "Confirmed slot from calendar export.", source: "Calendar export.csv" },
    { id: "t12", title: "Ship pricing v2",            cat: "focus", date: iso(3), allDay: false, start: 13,   dur: 3,   prio: "high",  reason: "Deadline EOW — buffered with Thu afternoon block.", source: "Q3-deliverables.xlsx" },
    { id: "t13", title: "Read: Shape Up ch.4",        cat: "life",  date: iso(3), allDay: false, start: 17,   dur: 1,   prio: "low",   reason: "'Study 1hr daily' — placed after deep work as decompress.", source: "personal-goals.md" },
    { id: "t14", title: "Demo to leadership",         cat: "meet",  date: iso(4), allDay: false, start: 11,   dur: 1,   prio: "high",  reason: "Final slot before EOW, after pricing ships.", source: "Calendar export.csv" },
    { id: "t15", title: "Retro notes",                cat: "work",  date: iso(4), allDay: false, start: 14.5, dur: 1,   prio: "med",   reason: "Captured from standup notes — Friday wrap.", source: "Team standups notes.docx" },
    { id: "t16", title: "Gym · legs",                 cat: "life",  date: iso(4), allDay: false, start: 17,   dur: 1,   prio: "low",   reason: "3rd of 3 weekly sessions.", source: "personal-goals.md" },
    // Plus a multi-day all-day to demo the band rendering
    { id: "t17", title: "Off-site retreat",           cat: "work",  date: iso(5), endDate: iso(6), allDay: true, prio: "med", reason: "Weekend offsite from goals.md.", source: "personal-goals.md" },
  ];
})();

window.PLANNER_PROMPTS = [
  "Reduce workload this Friday",
  "Find 90m for studying",
  "Why is this task placed here?",
  "Reschedule low-priority items",
];
