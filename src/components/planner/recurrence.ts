import type { PlannerTask } from "./types";

// Ported from design-reference/recurrence.js

const MONTH_FULL = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const MONTH_TO_IDX: Record<string, number> = {};
MONTH_FULL.forEach((m, i) => { MONTH_TO_IDX[m] = i; MONTH_TO_IDX[m.slice(0, 3)] = i; });

const DAY_TO_IDX: Record<string, number> = {
  monday:0,mon:0, tuesday:1,tue:1,tues:1,
  wednesday:2,wed:2,weds:2, thursday:3,thu:3,thur:3,thurs:3,
  friday:4,fri:4, saturday:5,sat:5, sunday:6,sun:6,
};

const SPREAD_PATTERN: Record<number, number[]> = {
  1:[2], 2:[1,3], 3:[0,2,4], 4:[0,1,3,4],
  5:[0,1,2,3,4], 6:[0,1,2,3,4,5], 7:[0,1,2,3,4,5,6],
};

const TIME_WINDOWS: Record<string, { pref: number; lo: number; hi: number }> = {
  morning:   { pref:9,  lo:8,    hi:12 },
  noon:      { pref:12, lo:11.5, hi:13 },
  afternoon: { pref:14, lo:12,   hi:17 },
  evening:   { pref:18, lo:17,   hi:21 },
  night:     { pref:20, lo:19,   hi:22 },
  any:       { pref:10, lo:8,    hi:18 },
};

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const isoWeekday = (d: Date) => (d.getDay() + 6) % 7;
const mondayOf = (from: Date) => {
  const x = new Date(from);
  x.setDate(x.getDate() - isoWeekday(x));
  x.setHours(0,0,0,0);
  return x;
};

interface RecurRule {
  perWeek?: number | null;
  total?: number | null;
  daysInARow?: number | null;
  daysOfWeek?: number[] | null;
  timeOfDay?: string | null;
  duration?: number | null;
  months?: number[] | null;
  year?: number | null;
  wholeYear?: boolean;
}

function normaliseRule(raw: Record<string, unknown> | null | undefined): RecurRule | null {
  if (!raw || typeof raw !== "object") return null;
  const r: RecurRule = {};
  const num = (v: unknown) => v != null && v !== "" && Number.isFinite(+(v as number));
  if (num(raw.perWeek))    r.perWeek    = Math.max(1, Math.min(7,   Math.round(+(raw.perWeek as number))));
  if (num(raw.total))      r.total      = Math.max(1, Math.min(400, Math.round(+(raw.total as number))));
  if (num(raw.daysInARow)) r.daysInARow = Math.max(1, Math.min(14,  Math.round(+(raw.daysInARow as number))));
  if (Array.isArray(raw.daysOfWeek)) {
    const idxs = (raw.daysOfWeek as unknown[]).map(d => {
      if (typeof d === "string") return DAY_TO_IDX[d.toLowerCase().slice(0,9)] ?? null;
      if (Number.isFinite(+(d as number))) { const n = Math.round(+(d as number)); return n >= 0 && n <= 6 ? n : null; }
      return null;
    }).filter((v): v is number => v != null);
    if (idxs.length) r.daysOfWeek = [...new Set(idxs)].sort((a,b) => a-b);
  }
  const tod = typeof raw.timeOfDay === "string" ? raw.timeOfDay.toLowerCase() : null;
  if (tod && TIME_WINDOWS[tod]) r.timeOfDay = tod;
  if (num(raw.duration)) r.duration = Math.max(0.25, Math.min(8, +(raw.duration as number)));
  if (Array.isArray(raw.months)) {
    const idxs = (raw.months as unknown[]).map(m => {
      if (typeof m === "string") return MONTH_TO_IDX[m.toLowerCase().slice(0,9)] ?? null;
      if (Number.isFinite(+(m as number))) { const n = Math.round(+(m as number)); return n >= 0 && n <= 11 ? n : null; }
      return null;
    }).filter((v): v is number => v != null);
    if (idxs.length) r.months = [...new Set(idxs)].sort((a,b) => a-b);
  }
  if (num(raw.year)) r.year = Math.round(+(raw.year as number));
  if (raw.wholeYear === true) r.wholeYear = true;
  if (!r.perWeek && !r.total && !r.daysInARow && !r.daysOfWeek && !r.months && !r.wholeYear) return null;
  return r;
}

function resolveMonthRange(rule: RecurRule, today: Date) {
  if (rule.wholeYear) {
    const y = rule.year || today.getFullYear();
    return { start: new Date(y, 0, 1), end: new Date(y, 11, 31), label: `whole ${y}` };
  }
  if (rule.months && rule.months.length) {
    const first = rule.months[0];
    const last = rule.months[rule.months.length - 1];
    let y = rule.year || today.getFullYear();
    if (!rule.year) {
      const endOfRange = new Date(y, last + 1, 0);
      if (endOfRange < startOfDay(today)) y += 1;
    }
    return {
      start: new Date(y, first, 1),
      end: new Date(y, last + 1, 0),
      label: `${MONTH_FULL[first]}${first === last ? "" : "–" + MONTH_FULL[last]} ${y}`,
    };
  }
  return null;
}

interface BusySlot { start: number; end: number }
function makeRegistry(existingTasks: PlannerTask[]) {
  const map = new Map<string, BusySlot[]>();
  const put = (iso: string, start: number, dur: number) => {
    const arr = map.get(iso) || [];
    arr.push({ start, end: start + dur });
    arr.sort((a, b) => a.start - b.start);
    map.set(iso, arr);
  };
  for (const t of existingTasks) {
    if (!t.allDay && t.start != null && t.dur != null && t.date) put(t.date, +t.start, +t.dur);
  }
  return {
    claim(iso: string, pref: number, dur: number, window: { lo: number; hi: number }) {
      const busy = map.get(iso) || [];
      const conflicts = (s: number) => busy.some(b => !(s + dur <= b.start || s >= b.end));
      const inside = [pref];
      for (let step = 0.5; step <= 6; step += 0.5) { inside.push(pref - step); inside.push(pref + step); }
      for (const c of inside) {
        if (c < window.lo || c + dur > window.hi) continue;
        if (!conflicts(c)) { put(iso, c, dur); return { start: c, spilled: false }; }
      }
      const outside: number[] = [];
      for (let step = 0.5; step <= 15; step += 0.5) { outside.push(pref - step); outside.push(pref + step); }
      for (const c of outside) {
        if (c < 7 || c + dur > 22) continue;
        if (!conflicts(c)) { put(iso, c, dur); return { start: c, spilled: true }; }
      }
      return null;
    },
  };
}

function expandOne(task: PlannerTask, rule: RecurRule, defaultStartMonday: Date, today: Date, registry: ReturnType<typeof makeRegistry>, nextId: () => number): PlannerTask[] {
  const todKey = rule.timeOfDay || "any";
  const win = TIME_WINDOWS[todKey];
  const duration = rule.duration ?? (task.dur && !task.allDay ? +task.dur : 2);
  const monthRange = resolveMonthRange(rule, today);
  const rangeStart = monthRange ? monthRange.start : defaultStartMonday;
  const rangeEnd   = monthRange ? monthRange.end   : addDays(defaultStartMonday, 7 * 26);
  const iterMonday = mondayOf(rangeStart);
  let dates: Date[] = [];

  if (rule.daysOfWeek && rule.daysOfWeek.length) {
    if (monthRange) {
      let placed = 0;
      for (let w = 0; w < 60; w++) {
        const weekStart = addDays(iterMonday, w * 7);
        if (weekStart > rangeEnd) break;
        for (const idx of rule.daysOfWeek) {
          const d = addDays(weekStart, idx);
          if (d < rangeStart || d > rangeEnd) continue;
          if (rule.total && placed >= rule.total) break;
          dates.push(d); placed++;
        }
        if (rule.total && placed >= rule.total) break;
      }
    } else {
      const perWeek = rule.daysOfWeek.length;
      const weeks = rule.total ? Math.ceil(rule.total / perWeek) : 4;
      for (let w = 0; w < weeks; w++) {
        for (const idx of rule.daysOfWeek) {
          if (rule.total && dates.length >= rule.total) break;
          dates.push(addDays(defaultStartMonday, w * 7 + idx));
        }
      }
    }
  } else if (rule.daysInARow) {
    const anchor = monthRange ? rangeStart : defaultStartMonday;
    for (let i = 0; i < rule.daysInARow; i++) dates.push(addDays(anchor, i));
  } else if (rule.perWeek) {
    const perWeek = rule.perWeek;
    const pattern = SPREAD_PATTERN[perWeek] || SPREAD_PATTERN[3];
    const candidates: Date[][] = [];
    for (let w = 0; w < 60; w++) {
      const weekStart = addDays(iterMonday, w * 7);
      if (weekStart > rangeEnd) break;
      const weekDates: Date[] = [];
      for (const idx of pattern) {
        const d = addDays(weekStart, idx);
        if (d >= rangeStart && d <= rangeEnd) weekDates.push(d);
      }
      if (weekDates.length) candidates.push(weekDates);
    }
    const candidateTotal = candidates.reduce((s, w) => s + w.length, 0);
    let total: number;
    if (rule.total != null) {
      total = Math.min(rule.total, candidateTotal);
    } else if (monthRange) {
      total = candidateTotal;
    } else {
      total = perWeek * 4;
    }
    let placed = 0;
    outer: for (const week of candidates) {
      for (const d of week) {
        if (placed >= total) break outer;
        dates.push(d); placed++;
      }
    }
  }

  if (!dates.length) return [];

  const events: PlannerTask[] = [];
  const total = dates.length;
  dates.forEach((d, i) => {
    const iso = isoOf(d);
    const placement = registry.claim(iso, win.pref, duration, win);
    const start = placement ? placement.start : win.pref;
    events.push({
      id: `r${nextId()}`,
      title: total > 1 ? `${task.title} (${i + 1}/${total})` : task.title,
      cat: task.cat || "work",
      date: iso,
      endDate: null,
      allDay: false,
      start,
      dur: duration,
      prio: task.prio || "med",
      reason: (task.reason ? task.reason + " · " : "") + `auto-expanded: "${task.condition || "recurrence"}"`,
      source: task.source || "",
    });
  });
  return events;
}

export function expandRecurringTasks(tasks: PlannerTask[], opts?: { startDate?: Date }): PlannerTask[] {
  const today = opts?.startDate || new Date();
  const defaultStartMonday = mondayOf(today);
  const simple: PlannerTask[] = [];
  const recurring: { task: PlannerTask; rule: RecurRule }[] = [];

  for (const t of tasks) {
    const rule = normaliseRule(t.recurrence as Record<string, unknown> | null);
    if (rule) {
      recurring.push({ task: t, rule });
    } else {
      simple.push(t);
    }
  }

  const registry = makeRegistry(simple);
  const out = simple.slice();
  let counter = 1;

  for (const { task, rule } of recurring) {
    const expanded = expandOne(task, rule, defaultStartMonday, today, registry, () => counter++);
    out.push(...expanded);
  }

  out.sort((a, b) => {
    if (a.date !== b.date) return (a.date || "").localeCompare(b.date || "");
    return (a.start ?? -1) - (b.start ?? -1);
  });
  out.forEach((t, i) => { t.id = `t${i + 1}`; });
  return out;
}
