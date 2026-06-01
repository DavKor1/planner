// recurrence.js
//
// Expand tasks that carry a `recurrence` rule (parsed out of natural-language
// conditions like "3 times a week" or "Every Monday and Wednesday") into
// concrete dated calendar entries.
//
// Inputs come from the AI extractor — for any source row that describes a
// recurring rule, the extractor emits ONE row with a `recurrence` object and
// the original `condition` text. The expander then:
//   • picks realistic days of the week (spread, not stacked)
//   • places each occurrence inside the requested time-of-day window
//   • respects total count, weekly frequency, duration, days-in-a-row
//   • avoids overlaps by walking forward to the next free hour
//   • records every assumption made into window.PLANNER_RECURRENCE_LOG
//     so the UI / console can show why a given date was chosen.

(function () {
  // Month names → 0..11. Accepts full names and 3-letter abbreviations.
  const MONTH_FULL = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const MONTH_TO_IDX = {};
  MONTH_FULL.forEach((m, i) => { MONTH_TO_IDX[m] = i; MONTH_TO_IDX[m.slice(0, 3)] = i; });

  // Mon=0 .. Sun=6 (matches the rest of the calendar UI)
  const DAY_TO_IDX = {
    monday: 0, mon: 0,
    tuesday: 1, tue: 1, tues: 1,
    wednesday: 2, wed: 2, weds: 2,
    thursday: 3, thu: 3, thur: 3, thurs: 3,
    friday: 4, fri: 4,
    saturday: 5, sat: 5,
    sunday: 6, sun: 6,
  };

  // Default day-of-week patterns when only frequency is specified — chosen
  // to spread occurrences across the week rather than stacking them.
  const SPREAD_PATTERN = {
    1: [2],                   // Wed
    2: [1, 3],                // Tue, Thu
    3: [0, 2, 4],             // Mon, Wed, Fri
    4: [0, 1, 3, 4],          // Mon, Tue, Thu, Fri
    5: [0, 1, 2, 3, 4],       // Mon–Fri
    6: [0, 1, 2, 3, 4, 5],    // Mon–Sat
    7: [0, 1, 2, 3, 4, 5, 6], // every day
  };

  // Time-of-day → [preferred hour, window start, window end]
  const TIME_WINDOWS = {
    morning:   { pref: 9,  lo: 8,    hi: 12 },
    noon:      { pref: 12, lo: 11.5, hi: 13 },
    afternoon: { pref: 14, lo: 12,   hi: 17 },
    evening:   { pref: 18, lo: 17,   hi: 21 },
    night:     { pref: 20, lo: 19,   hi: 22 },
    any:       { pref: 10, lo: 8,    hi: 18 },
  };

  // --- date helpers ----------------------------------------------------------
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const isoOf = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseIso = (s) => {
    if (!s || typeof s !== "string") return null;
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  };

  // Mon=0 .. Sun=6
  const isoWeekday = (d) => (d.getDay() + 6) % 7;

  // Roll forward to the Monday of the week containing `from`. If `from` is
  // already Monday, return it.
  const mondayOf = (from) => {
    const x = new Date(from);
    const dow = isoWeekday(x);
    x.setDate(x.getDate() - dow);
    x.setHours(0, 0, 0, 0);
    return x;
  };

  // --- text parser -----------------------------------------------------------
  // Read a natural-language condition like:
  //   "2 times a week, in the afternoon for 2 hours 6 times in total, whole may"
  //   "Every Monday and Wednesday"
  //   "3 days in a row, in the morning for 2 hours, whole june"
  // and return a recurrence object compatible with normaliseRule().
  //
  // Returns null if the text clearly describes a single non-recurring event
  // ("once, …") or contains no recurrence cues at all.
  function parseRecurrenceFromText(input) {
    if (!input || typeof input !== "string") return null;
    const text = input.toLowerCase();

    // "once" / "one time" / "single" → not recurring, even if it mentions time/duration.
    if (/\b(once|one[\s-]?time|one off|a single time|just once)\b/.test(text)) return null;

    const rule = {};
    let hits = 0;

    // perWeek: "3 times a week", "2x per week", "twice a week", "thrice weekly"
    const WORDS = { once: 1, twice: 2, thrice: 3, daily: 7 };
    let m;
    if ((m = text.match(/(\d+)\s*(?:x|times?)\s*(?:a|per|each|\/)\s*week/))) { rule.perWeek = +m[1]; hits++; }
    else if ((m = text.match(/\b(twice|thrice)\s+(?:a|per|each)\s+week/))) { rule.perWeek = WORDS[m[1]]; hits++; }
    else if (/\bweekly\b/.test(text)) { rule.perWeek = 1; hits++; }
    else if (/\bdaily\b|\bevery\s+day\b/.test(text)) { rule.perWeek = 7; hits++; }

    // total: "6 times in total", "8 times total", "6 sessions in total"
    if ((m = text.match(/(\d+)\s*(?:times?|sessions?|occurrences?)\s*(?:in\s+)?total/))) { rule.total = +m[1]; hits++; }
    else if ((m = text.match(/total\s*(?:of\s+)?(\d+)/))) { rule.total = +m[1]; hits++; }

    // daysInARow: "3 days in a row", "3 consecutive days"
    // tolerate typos: "rowm", "rows"
    if ((m = text.match(/(\d+)\s*days?\s*in\s*a\s*rows?m?\b/))) { rule.daysInARow = +m[1]; hits++; }
    else if ((m = text.match(/(\d+)\s*consecutive\s*days?/))) { rule.daysInARow = +m[1]; hits++; }

    // daysOfWeek: "every Monday and Wednesday", "on Tue, Thu and Fri"
    // Don't fire on the standalone word "monday" — require an introducing
    // preposition / "every" so we don't misread "Monday morning" as a rule.
    const dowMatches = [];
    const dowIntro = /\b(every|each|on|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b/;
    if (dowIntro.test(text)) {
      const dayRe = /\b(mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?)\b/g;
      let dm;
      while ((dm = dayRe.exec(text))) {
        const key = dm[1].replace(/s$/, "");
        if (DAY_TO_IDX[key] != null) dowMatches.push(key);
      }
    }
    if (dowMatches.length) { rule.daysOfWeek = dowMatches; hits++; }

    // timeOfDay: morning/afternoon/evening/noon/night
    if (/\bmornings?\b/.test(text))         { rule.timeOfDay = "morning"; }
    else if (/\bafternoons?\b/.test(text))  { rule.timeOfDay = "afternoon"; }
    else if (/\bevenings?\b/.test(text))    { rule.timeOfDay = "evening"; }
    else if (/\bnoon|midday|lunchtime\b/.test(text)) { rule.timeOfDay = "noon"; }
    else if (/\bnights?\b/.test(text))      { rule.timeOfDay = "night"; }

    // duration: "for 2 hours", "2-hour", "90 minutes"
    if ((m = text.match(/for\s+(\d+(?:\.\d+)?)\s*hours?/))) { rule.duration = +m[1]; }
    else if ((m = text.match(/(\d+(?:\.\d+)?)\s*[- ]?hours?\b/))) { rule.duration = +m[1]; }
    else if ((m = text.match(/(\d+)\s*(?:min|minutes?)\b/))) { rule.duration = +m[1] / 60; }

    // months / wholeYear
    if (/\b(whole|entire|all)\s+(year|the\s+year)\b/.test(text) || /\ball\s+year\s+round\b/.test(text)) {
      rule.wholeYear = true;
      hits++;
    } else {
      // "whole may" / "entire june" / "all of may"
      const wholeMonth = text.match(/\b(?:whole|entire|all\s+of)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/g);
      // "April, May and June" / "April–June" / "April through June" / "April to June"
      const allMonthMatches = [];
      const monthName = "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)";
      const rangeRe = new RegExp(`\\b${monthName}\\s*(?:[-–—]|to|through|thru|until|till)\\s*${monthName}\\b`, "g");
      let rm;
      while ((rm = rangeRe.exec(text))) {
        const a = MONTH_TO_IDX[rm[1].replace(/sept/, "sep")];
        const b = MONTH_TO_IDX[rm[2].replace(/sept/, "sep")];
        if (a != null && b != null) {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) allMonthMatches.push(MONTH_FULL[i]);
        }
      }
      // bare list "April, May, June" or "in May and June"
      const bareRe = new RegExp(`\\b${monthName}\\b`, "g");
      let bm;
      while ((bm = bareRe.exec(text))) {
        const idx = MONTH_TO_IDX[bm[1].replace(/sept/, "sep")];
        if (idx != null) allMonthMatches.push(MONTH_FULL[idx]);
      }
      // Prefer "whole X" if present; else any month mention.
      const collected = (wholeMonth || []).map(s => {
        const name = s.replace(/^(?:whole|entire|all\s+of)\s+/, "").replace(/sept/, "sep");
        return MONTH_FULL[MONTH_TO_IDX[name]];
      }).concat(allMonthMatches).filter(Boolean);
      if (collected.length) { rule.months = Array.from(new Set(collected)); hits++; }
    }

    // year: "2026", "in 2027"
    if ((m = text.match(/\b(20\d{2})\b/))) { rule.year = +m[1]; }

    // Only return a rule if we found at least one recurrence cue.
    if (!hits) return null;
    return rule;
  }

  // Merge two partial rules. `a` wins on field conflicts (it's the trusted
  // source — typically the AI-supplied rule). `b` fills gaps.
  function mergeRules(a, b) {
    if (!a) return b;
    if (!b) return a;
    const out = { ...b, ...a };
    // Object/array fields: keep `a`'s only if non-empty.
    if (!a.daysOfWeek?.length && b.daysOfWeek?.length) out.daysOfWeek = b.daysOfWeek;
    if (!a.months?.length && b.months?.length) out.months = b.months;
    return out;
  }

  // --- rule normaliser -------------------------------------------------------
  // Coerce whatever shape the AI produced into a known schema and clamp
  // sane bounds.
  function normaliseRule(raw) {
    if (!raw || typeof raw !== "object") return null;
    const r = {
      perWeek: null,
      total: null,
      daysInARow: null,
      daysOfWeek: null,
      timeOfDay: null,
      duration: null,
    };
    // Numeric fields: skip explicit nulls/undefined. `+null` coerces to 0
    // which Number.isFinite considers valid, so we must guard against it or
    // the clamp turns null → 1 and breaks branch selection downstream.
    const num = (v) => v != null && v !== "" && Number.isFinite(+v);
    if (num(raw.perWeek))    r.perWeek    = Math.max(1, Math.min(7,   Math.round(+raw.perWeek)));
    if (num(raw.total))      r.total      = Math.max(1, Math.min(400, Math.round(+raw.total)));
    if (num(raw.daysInARow)) r.daysInARow = Math.max(1, Math.min(14,  Math.round(+raw.daysInARow)));
    if (Array.isArray(raw.daysOfWeek)) {
      // Accept either day NAMES ("mon", "monday", …) from text/AI, or numeric
      // indexes (0..6) from an already-normalised rule. Idempotent.
      const idxs = raw.daysOfWeek.map(d => {
        if (typeof d === "string") return DAY_TO_IDX[d.toLowerCase().slice(0, 9)];
        if (Number.isFinite(+d)) {
          const n = Math.round(+d);
          return n >= 0 && n <= 6 ? n : null;
        }
        return null;
      }).filter(v => v != null);
      if (idxs.length) r.daysOfWeek = Array.from(new Set(idxs)).sort((a, b) => a - b);
    }
    const tod = typeof raw.timeOfDay === "string" ? raw.timeOfDay.toLowerCase() : null;
    if (tod && TIME_WINDOWS[tod]) r.timeOfDay = tod;
    if (num(raw.duration))   r.duration   = Math.max(0.25, Math.min(8, +raw.duration));

    // Month range: array of month names OR numeric indexes (0..11).
    // Idempotent — re-normalising a normalised rule preserves months.
    if (Array.isArray(raw.months)) {
      const idxs = raw.months.map(m => {
        if (typeof m === "string") return MONTH_TO_IDX[m.toLowerCase().slice(0, 9)];
        if (Number.isFinite(+m)) {
          const n = Math.round(+m);
          return n >= 0 && n <= 11 ? n : null;
        }
        return null;
      }).filter(v => v != null);
      if (idxs.length) r.months = Array.from(new Set(idxs)).sort((a, b) => a - b);
    }
    if (num(raw.year)) r.year = Math.round(+raw.year);
    if (raw.wholeYear === true) r.wholeYear = true;

    // If nothing useful was set, drop the rule.
    if (!r.perWeek && !r.total && !r.daysInARow && !r.daysOfWeek && !r.months && !r.wholeYear) return null;
    return r;
  }

  // Resolve months / wholeYear into a concrete [start, end] Date range.
  // Returns null if the rule has no month constraint.
  function resolveMonthRange(rule, today) {
    if (rule.wholeYear) {
      const y = rule.year || today.getFullYear();
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31), label: `whole ${y}` };
    }
    if (rule.months && rule.months.length) {
      const first = rule.months[0];
      const last  = rule.months[rule.months.length - 1];
      // Pick a sensible year: if no year given and the entire range is in the
      // past for the current calendar year, roll to next year.
      let y = rule.year || today.getFullYear();
      if (!rule.year) {
        const endOfRangeThisYear = new Date(y, last + 1, 0);
        if (endOfRangeThisYear < startOfDay(today)) y += 1;
      }
      return {
        start: new Date(y, first, 1),
        end:   new Date(y, last + 1, 0),
        label: `${MONTH_FULL[first]}${first === last ? "" : "–" + MONTH_FULL[last]} ${y}`,
      };
    }
    return null;
  }

  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

  // --- overlap registry ------------------------------------------------------
  // Tracks busy intervals per ISO date so we can shift a new placement to
  // the next free hour inside its time-of-day window.
  function makeRegistry(existingTasks) {
    const map = new Map(); // iso -> [{start, end}]
    const put = (iso, start, dur) => {
      const arr = map.get(iso) || [];
      arr.push({ start, end: start + dur });
      arr.sort((a, b) => a.start - b.start);
      map.set(iso, arr);
    };
    // Seed with any already-placed (non-recurring) timed tasks so we don't
    // overlap them either.
    for (const t of existingTasks) {
      if (!t.allDay && t.start != null && t.dur != null && t.date) {
        put(t.date, +t.start, +t.dur);
      }
    }
    return {
      // Find a free start ≥ window.lo, ≤ window.hi-dur, preferring `pref`.
      // Walks at 0.5-hour resolution. Returns null only if absolutely no
      // slot in the window fits — caller decides what to do.
      claim(iso, pref, dur, window) {
        const busy = map.get(iso) || [];
        const conflicts = (s) => busy.some(b => !(s + dur <= b.start || s >= b.end));
        // First try preferred. Then expand outward in 0.5h steps INSIDE the
        // time-of-day window.
        const inside = [pref];
        for (let step = 0.5; step <= 6; step += 0.5) {
          inside.push(pref - step);
          inside.push(pref + step);
        }
        for (const c of inside) {
          if (c < window.lo) continue;
          if (c + dur > window.hi) continue;
          if (!conflicts(c)) { put(iso, c, dur); return { start: c, spilled: false }; }
        }
        // Window saturated. Walk outward across the workable day (7–22) and
        // grab the closest non-overlapping slot — better to spill the window
        // than to double-book.
        const outside = [];
        for (let step = 0.5; step <= 15; step += 0.5) {
          outside.push(pref - step);
          outside.push(pref + step);
        }
        for (const c of outside) {
          if (c < 7 || c + dur > 22) continue;
          if (!conflicts(c)) { put(iso, c, dur); return { start: c, spilled: true }; }
        }
        return null;
      },
      // For "I don't care, just don't overlap" cases.
      isBusy(iso, start, dur) {
        const busy = map.get(iso) || [];
        return busy.some(b => !(start + dur <= b.start || start >= b.end));
      },
    };
  }

  // --- main expansion --------------------------------------------------------
  function expandTasks(tasks, opts) {
    const log = [];
    const today = opts?.startDate || new Date();
    const defaultStartMonday = mondayOf(today);

    // Split into recurring vs simple. For each task:
    //   1. Try the AI-supplied `recurrence` field.
    //   2. ALWAYS also try to parse `condition` (and as a last resort `title`
    //      + `reason`) — this rescues tasks the AI saved as a single dated
    //      event when the source text actually describes a recurring rule.
    //   3. Merge: AI fields win, text-derived fields fill in gaps.
    // The simple (truly non-recurring) tasks seed the overlap registry so
    // recurring placements honour them too.
    const simple = [];
    const recurring = [];
    for (const t of tasks) {
      const aiRule = normaliseRule(t.recurrence);
      const condText = [t.condition, t.title, t.reason].filter(Boolean).join(" · ");
      const textRule = normaliseRule(parseRecurrenceFromText(condText));
      const rule = normaliseRule(mergeRules(aiRule, textRule));
      if (rule) {
        if (!aiRule && textRule) {
          log.push(`· "${t.title}": no AI recurrence — recovered from text: ${JSON.stringify(textRule)}`);
        } else if (aiRule && textRule && JSON.stringify(aiRule) !== JSON.stringify(rule)) {
          log.push(`· "${t.title}": AI recurrence enriched from text → ${JSON.stringify(rule)}`);
        }
        recurring.push({ task: t, rule });
      } else {
        simple.push(t);
      }
    }
    const registry = makeRegistry(simple);

    const out = simple.slice();
    let counter = 1;

    for (const { task, rule } of recurring) {
      const expanded = expandOne(task, rule, defaultStartMonday, today, registry, log, () => counter++);
      out.push(...expanded);
    }

    // Re-sort by date + start for tidy output, give stable ids.
    out.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.start ?? -1) - (b.start ?? -1);
    });
    out.forEach((t, i) => { t.id = `t${i + 1}`; });

    // Expose log for inspection.
    window.PLANNER_RECURRENCE_LOG = log;
    if (log.length) {
      console.groupCollapsed(`[planner] expanded ${recurring.length} recurring rule${recurring.length === 1 ? "" : "s"} → ${out.length - simple.length} events`);
      log.forEach(line => console.log(line));
      console.groupEnd();
    }
    return out;
  }

  function expandOne(task, rule, defaultStartMonday, today, registry, log, nextId) {
    const todKey = rule.timeOfDay || "any";
    const window = TIME_WINDOWS[todKey];
    const duration = rule.duration ?? (task.dur && !task.allDay ? +task.dur : 2);
    const noteAssumptions = [];

    // If the rule names month(s) or whole-year, occurrences are constrained
    // to that range. Otherwise we fall back to "the next few weeks".
    const monthRange = resolveMonthRange(rule, today);
    const rangeStart = monthRange ? monthRange.start : defaultStartMonday;
    const rangeEnd   = monthRange ? monthRange.end   : addDays(defaultStartMonday, 7 * 26);
    if (monthRange) noteAssumptions.push(`scoped to ${monthRange.label}`);

    // The first Monday at-or-before the range start, so weekly iteration
    // naturally lines up.
    const iterMonday = mondayOf(rangeStart);

    // Decide which dates to fire on.
    let dates = [];

    if (rule.daysOfWeek && rule.daysOfWeek.length) {
      // Explicit weekdays. With a month range, fire on every matching day in
      // the range (or stop at `total`). Without, default to 4 weeks.
      const perWeek = rule.daysOfWeek.length;
      if (monthRange) {
        let placed = 0;
        for (let w = 0; w < 60; w++) {
          const weekStart = addDays(iterMonday, w * 7);
          if (weekStart > rangeEnd) break;
          for (const idx of rule.daysOfWeek) {
            const d = addDays(weekStart, idx);
            if (d < rangeStart || d > rangeEnd) continue;
            if (rule.total && placed >= rule.total) break;
            dates.push(d);
            placed++;
          }
          if (rule.total && placed >= rule.total) break;
        }
      } else {
        const weeks = rule.total ? Math.ceil(rule.total / perWeek) : 4;
        if (!rule.total) noteAssumptions.push("no total or month range given → defaulted to 4 weeks");
        for (let w = 0; w < weeks; w++) {
          for (const idx of rule.daysOfWeek) {
            if (rule.total && dates.length >= rule.total) break;
            dates.push(addDays(defaultStartMonday, w * 7 + idx));
          }
        }
      }
    } else if (rule.daysInARow) {
      // N consecutive days. Anchor at the start of the range if one is given,
      // otherwise the upcoming Monday.
      const anchor = monthRange ? rangeStart : defaultStartMonday;
      noteAssumptions.push(`anchored ${rule.daysInARow} consecutive days starting ${isoOf(anchor)}`);
      for (let i = 0; i < rule.daysInARow; i++) dates.push(addDays(anchor, i));
    } else if (rule.perWeek) {
      const perWeek = rule.perWeek;
      const pattern = SPREAD_PATTERN[perWeek] || SPREAD_PATTERN[3];

      // Build every candidate date within the range first.
      const candidates = [];
      for (let w = 0; w < 60; w++) {
        const weekStart = addDays(iterMonday, w * 7);
        if (weekStart > rangeEnd) break;
        const weekDates = [];
        for (const idx of pattern) {
          const d = addDays(weekStart, idx);
          if (d < rangeStart || d > rangeEnd) continue;
          weekDates.push(d);
        }
        if (weekDates.length) candidates.push(weekDates);
      }
      const candidateTotal = candidates.reduce((s, w) => s + w.length, 0);

      // Total resolution:
      //   - explicit total wins (but capped at candidateTotal if higher)
      //   - if a month range is given and no total, fill the entire range
      //   - else default to 4 weeks
      let total;
      if (rule.total != null) {
        total = Math.min(rule.total, candidateTotal);
        if (rule.total > candidateTotal) {
          noteAssumptions.push(`total (${rule.total}) exceeds available slots in range — capped at ${candidateTotal}`);
        }
      } else if (monthRange) {
        total = candidateTotal;
        noteAssumptions.push(`no total given → filling range (${candidateTotal} events)`);
      } else {
        total = perWeek * 4;
        noteAssumptions.push(`no total or month range given → using ${total} (4 weeks × ${perWeek}/wk)`);
      }

      // Take the first `total` dates, but if that means the LAST week would
      // be sparser than the earlier ones, that's fine — task says "prioritise
      // the total session count while keeping distribution as even as possible".
      let placed = 0;
      outer: for (const week of candidates) {
        for (const d of week) {
          if (placed >= total) break outer;
          dates.push(d);
          placed++;
        }
      }
    }

    if (!dates.length) {
      log.push(`· "${task.title}": rule had no usable dates — skipped`);
      return [];
    }

    // Place each occurrence inside the time-of-day window without overlap.
    const events = [];
    const total = dates.length;
    dates.forEach((d, i) => {
      const iso = isoOf(d);
      const placement = registry.claim(iso, window.pref, duration, window);
      const start = placement ? placement.start : window.pref;
      if (!placement) {
        noteAssumptions.push(`${iso}: could not find a free slot anywhere — kept ${start}:00 (may overlap)`);
      } else if (placement.spilled) {
        noteAssumptions.push(`${iso}: ${todKey} window full, placed at ${start}:00 instead`);
      }
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
        reason: (task.reason ? task.reason + " · " : "") +
          `auto-expanded: "${task.condition || "recurrence"}"`,
        source: task.source || "",
        // Provenance for debugging / future edits
        _recurrence: { ...rule, _from: task.id, _condition: task.condition || null },
      });
    });

    const summary =
      `· "${task.title}" [${task.condition || "rule"}] → ${events.length} event${events.length === 1 ? "" : "s"} ` +
      `(${todKey}, ${duration}h` +
      (events.length ? `, ${events[0].date}…${events[events.length - 1].date}` : "") +
      `)` +
      (noteAssumptions.length ? `\n    ↳ assumptions: ${noteAssumptions.join("; ")}` : "");
    log.push(summary);
    return events;
  }

  // Public API
  window.expandRecurringTasks = expandTasks;
  window.parseRecurrenceFromText = parseRecurrenceFromText;
  window.PLANNER_RECURRENCE_LOG = [];
})();
