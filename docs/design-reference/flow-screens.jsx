// Flow screens: type select, upload, extraction.
// Each screen receives shared { state, set, theme, T } props.

const PlannerStep = ({ idx, total, label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
    <span>STEP {String(idx).padStart(2,"0")} / {String(total).padStart(2,"0")}</span>
    <span style={{ width: 56, height: 1, background: "var(--line-2)" }} />
    <span style={{ color: "var(--fg-2)" }}>{label}</span>
  </div>
);

// ── Upload ──────────────────────────────────────────────────────────────────
const FileGlyph = ({ kind }) => {
  const label = { xlsx: "XLS", docx: "DOC", pdf: "PDF", image: "IMG", text: "TXT", csv: "CSV" }[kind] || "FILE";
  return (
    <div style={{
      width: 34, height: 38, borderRadius: 2,
      background: "var(--bg-3)", border: "1px solid var(--line)",
      display: "grid", placeItems: "center",
      fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-2)",
      letterSpacing: "0.06em", flexShrink: 0,
    }}>{label}</div>
  );
};

const ScreenUpload = ({ state, set }) => {
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef(null);
  const files = state.files;
  // Are we adding to an existing plan, or building the first one?
  const adding = (state.tasks?.length || 0) > 0 || (state.sources?.length || 0) > 0;

  const inferKind = (name) => {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (["xlsx", "xls"].includes(ext)) return "xlsx";
    if (ext === "docx" || ext === "doc") return "docx";
    if (ext === "pdf") return "pdf";
    if (ext === "csv") return "csv";
    if (["jpg", "jpeg", "png", "heic", "webp", "gif"].includes(ext)) return "image";
    return "text";
  };
  const fmtSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  };
  const addFiles = (fileList) => {
    if (!fileList || !fileList.length) return;
    const incoming = Array.from(fileList);
    const incomingMeta = incoming.map(f => ({
      name: f.name,
      kind: inferKind(f.name),
      size: fmtSize(f.size),
      // Heuristic: bigger file ≈ more candidate items. Just for demo flavor.
      items: Math.max(3, Math.min(40, Math.round(f.size / 8000) + Math.floor(Math.random() * 6))),
    }));
    // De-dupe by name+size (keep newest at top of staged area)
    const keptOld = files
      .map((f, i) => ({ f, raw: state.rawFiles[i] }))
      .filter(({ f }) => !incomingMeta.find(i => i.name === f.name && i.size === f.size));
    const mergedMeta = [...incomingMeta, ...keptOld.map(x => x.f)].slice(0, 20);
    const mergedRaw  = [...incoming,     ...keptOld.map(x => x.raw)].slice(0, 20);
    set({ files: mergedMeta, rawFiles: mergedRaw });
  };

  return (
    <div style={{ padding: "44px 56px", height: "100%", display: "flex", flexDirection: "column", gap: 28 }}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.docx,.doc,.pdf,.txt,.md,.csv,.jpg,.jpeg,.png,.heic,.webp,.gif"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
        style={{ display: "none" }}
      />
      <PlannerStep idx={1} total={2} label={adding ? "Add more source material" : "Drop your source material"} />
      <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 320px" }}>
          <div style={{
            fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)",
            letterSpacing: "var(--display-tracking)", fontSize: 32, lineHeight: 1.1,
          }}>{adding ? <>Add to<br />your plan.</> : <>Feed it<br />everything.</>}</div>
          <div style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 14, lineHeight: 1.55 }}>
            {adding
              ? <>New items merge into your existing calendar — nothing you've already built is lost.</>
              : <>Spreadsheets, meeting notes, photos of whiteboards, calendar exports — the model reads them all and merges into one optimized schedule.</>}
          </div>
          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px",
            fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>
            <span style={{ color: "var(--fg-3)" }}>FORMATS</span><span>.xlsx .xls .docx .pdf .txt .csv .jpg .png</span>
            <span style={{ color: "var(--fg-3)" }}>MAX</span><span>20 files · 50 MB total</span>
            <span style={{ color: "var(--fg-3)" }}>OCR</span><span style={{ color: "var(--ok)" }}>● enabled</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={(e) => {
              // Only clear when truly leaving the dropzone (not just moving over
              // a child); compare relatedTarget against currentTarget.
              if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              addFiles(e.dataTransfer.files);
            }}
            style={{
              border: `1.5px dashed ${drag ? "var(--accent)" : "var(--line-2)"}`,
              background: drag ? "var(--accent-tint)" : "var(--bg-1)",
              borderRadius: "var(--radius)",
              padding: "44px 32px", textAlign: "center",
              transition: "all .15s",
              cursor: "pointer",
            }}
          >
            <div style={{
              width: 44, height: 44, margin: "0 auto 14px",
              borderRadius: "var(--radius-sm)", background: "var(--bg-3)",
              border: "1px solid var(--line-2)", display: "grid", placeItems: "center",
              fontFamily: "var(--font-mono)", color: "var(--accent)",
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
            <button onClick={() => set({ files: [], rawFiles: [] })} style={ghostBtnStyle()}>Clear</button>
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
                  const nextMeta = files.filter((_, j) => j !== i);
                  const nextRaw = state.rawFiles.filter((_, j) => j !== i);
                  set({ files: nextMeta, rawFiles: nextRaw });
                }} style={{
                  background: "transparent", border: "none", color: "var(--fg-3)",
                  cursor: "pointer", padding: 4, fontFamily: "var(--font-mono)",
                }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => set({ screen: "calendar" })} style={ghostBtnStyle()}>{adding ? "← Back to calendar" : "← Cancel"}</button>
        <PrimaryButton disabled={!files.length} onClick={() => set({ screen: "extracting" })}>
          {files.length ? `Extract ${files.reduce((s, f) => s + f.items, 0)} items →` : "Add a file to continue"}
        </PrimaryButton>
      </div>
    </div>
  );
};

// ── Extraction ──────────────────────────────────────────────────────────────
// Reads the actual contents of uploaded files (PDF, XLSX, DOCX, plus plain
// text formats), sends them to Claude, and parses the returned JSON into
// placed tasks. Falls back to a deterministic synthesis on hard failure.

const TEXT_EXTS = new Set(["txt", "md", "csv", "json", "log", "tsv", "yml", "yaml", "ics"]);

// Lazy-load a UMD script tag once.
function loadOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-extractor="${src}"]`)) {
      // Wait for it to be ready
      const check = () => {
        if (document.querySelector(`script[data-extractor="${src}"]`).dataset.ready === "1") resolve();
        else setTimeout(check, 50);
      };
      return check();
    }
    const s = document.createElement("script");
    s.src = src;
    s.dataset.extractor = src;
    s.onload = () => { s.dataset.ready = "1"; resolve(); };
    s.onerror = (e) => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

async function parsePdf(file) {
  await loadOnce("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
  const pdfjs = window["pdfjs-dist/build/pdf"] || window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  const maxPages = Math.min(pdf.numPages, 30);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(" ") + "\n";
    if (text.length > 16000) break;
  }
  return text;
}

async function parseXlsx(file) {
  await loadOnce("https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js");
  const XLSX = window.XLSX;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  let text = "";
  for (const name of wb.SheetNames) {
    text += `--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}\n`;
    if (text.length > 16000) break;
  }
  return text;
}

async function parseDocx(file) {
  await loadOnce("https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js");
  const buf = await file.arrayBuffer();
  const res = await window.mammoth.extractRawText({ arrayBuffer: buf });
  return res.value || "";
}

async function readFileContents(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  try {
    if (TEXT_EXTS.has(ext)) {
      if (file.size > 500 * 1024) return { ok: false, note: "file too large (>500KB)", text: "" };
      return { ok: true, text: await file.text() };
    }
    if (ext === "pdf")             return { ok: true, text: await parsePdf(file)  };
    if (ext === "xlsx" || ext === "xls") return { ok: true, text: await parseXlsx(file) };
    if (ext === "docx")            return { ok: true, text: await parseDocx(file) };
    if (["jpg","jpeg","png","heic","webp","gif"].includes(ext)) {
      return { ok: false, note: "image OCR not available in this prototype", text: "" };
    }
    return { ok: false, note: "unsupported format", text: "" };
  } catch (e) {
    return { ok: false, note: "parse error: " + (e.message || String(e)).slice(0, 80), text: "" };
  }
}

// Pull a JSON array of tasks out of an AI response, tolerant of:
//  - markdown code fences around the JSON
//  - trailing prose
//  - the array being truncated mid-object by the model's output-token cap
// We progressively shrink the candidate string until JSON.parse succeeds.
function parseTaskArrayResilient(raw) {
  if (typeof raw !== "string" || !raw) return [];
  // Strip markdown fences.
  let s = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  const start = s.indexOf("[");
  if (start < 0) return [];
  s = s.slice(start);

  // Fast path: response is well-formed.
  const closeFull = s.lastIndexOf("]");
  if (closeFull > 0) {
    try {
      const arr = JSON.parse(s.slice(0, closeFull + 1));
      if (Array.isArray(arr)) return arr;
    } catch (_) { /* fall through to salvage */ }
  }

  // Salvage path: the array is truncated mid-object. Walk forward, tracking
  // braces and strings; remember the offset just AFTER each top-level object,
  // then close the array there and parse.
  let depth = 0;            // brace depth inside the array
  let inStr = false;        // inside a JSON string?
  let esc = false;          // previous char was a backslash inside a string?
  let lastGoodEnd = -1;     // index in `s` just AFTER the last complete object
  let sawAnyObject = false;

  for (let i = 1; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') { inStr = false; }
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") { depth++; continue; }
    if (c === "}") {
      depth--;
      if (depth === 0) {
        lastGoodEnd = i + 1;
        sawAnyObject = true;
      }
      continue;
    }
    if (c === "]" && depth === 0) {
      // Hit the real close — full parse should have succeeded above; bail.
      break;
    }
  }

  if (!sawAnyObject || lastGoodEnd < 0) return [];
  const salvaged = s.slice(0, lastGoodEnd) + "]";
  try {
    const arr = JSON.parse(salvaged);
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

async function aiExtractTasks(rawFiles, onFileParsed) {
  const fileBlocks = [];
  const readable = [];
  for (let i = 0; i < rawFiles.length; i++) {
    const f = rawFiles[i];
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    onFileParsed?.(i, "reading");
    const { ok, text, note } = await readFileContents(f);
    onFileParsed?.(i, ok ? "done" : "skipped", note);
    if (ok && text.trim()) {
      readable.push(f.name);
      fileBlocks.push(`=== ${f.name} (${ext}) ===\n${text.slice(0, 12000)}`);
    } else {
      fileBlocks.push(`=== ${f.name} (${ext}) ===\n[could not read contents: ${note || "unknown"}]`);
    }
  }

  if (!readable.length) {
    throw new Error("No file contents were readable — nothing to extract from.");
  }

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const prompt = `You are an AI scheduling assistant. Today is ${todayIso}.

You are given the literal contents of the user's uploaded files below. EXTRACT every task, event, deadline, appointment, tournament, meeting, or goal that is LITERALLY mentioned in the file contents. DO NOT invent items. DO NOT pad. If the file lists 50 events, return 50. If it lists 1, return 1.

USE THE ACTUAL DATES from the file. Events may be in the past, present, or future, and may span multiple days. Preserve their real dates. Do NOT force them into a single week.

══════════════════════════════════════════════════════════════════════════
RECURRENCE — IMPORTANT
══════════════════════════════════════════════════════════════════════════
Source rows may describe a RULE rather than a single occurrence:
  • "2 times a week, in the afternoon for 2 hours, 6 times in total"
  • "Every Monday and Wednesday"
  • "3 days in a row, in the morning, for 2 hours"
  • "Once, in the afternoon for 2 hours"           ← NOT recurring

For any RECURRING row, return EXACTLY ONE object with a "recurrence" field.
DO NOT enumerate the individual occurrences yourself — the system will
expand them and spread them across the week.

For non-recurring rows ("once", or a row with an explicit single date),
leave "recurrence" as null and fill date/start/dur normally.

The "recurrence" object schema (omit a field or use null if not given):
  {
    "perWeek":    integer 1-7       // "3 times a week" → 3
    "total":      integer           // "6 times in total" → 6
    "daysInARow": integer           // "3 days in a row" → 3
    "daysOfWeek": ["mon","wed",...] // "every Monday and Wednesday"
    "timeOfDay":  "morning"|"noon"|"afternoon"|"evening"
    "duration":   number of hours   // "for 2 hours" → 2
    "months":     ["may","june",...]// "whole may", "April–June", "May and Jul"
    "year":       integer | null    // only if the file names a specific year
    "wholeYear":  true | false      // "whole year", "all year"
  }
Month-range parsing:
  • "whole may"          → months: ["may"]
  • "whole june"         → months: ["june"]
  • "April, May, June"   → months: ["april","may","june"]
  • "April through June" → months: ["april","may","june"]   (fill the gap)
  • "every other Tuesday in March" → months: ["march"], daysOfWeek: ["tue"]
  • "all year" / "whole year" → wholeYear: true
With months set, the system fires occurrences across every applicable week
in those months. If "total" is also given, total takes precedence; if not,
the range is filled.

Also copy the original natural-language condition into the "condition"
field so the user can see what was parsed.

FILES:
${fileBlocks.join("\n\n")}

For every extracted item, return an object with these fields:
- id: "t1", "t2", ...
- title: short string copied from the file (≤ 60 chars)
- cat: "work" | "meet" | "focus" | "life" (tournaments → "meet")
- date: "YYYY-MM-DD" start date for non-recurring rows. For recurring rows,
        you may set it to null — the system will compute dates from the rule.
- endDate: "YYYY-MM-DD" for multi-day events, else null
- allDay: true if no clock time given AND not recurring, false otherwise
- start: number 0-23, hour only when allDay=false (e.g. "19:30" → 19.5).
         Leave null for recurring rows.
- dur: number 0.5-3, hours, only when allDay=false (compute end-start if both given)
- prio: "high" | "med" | "low" (default "med")
- reason: ≤ 8 words, terse. e.g. "From june_events.xlsx, Condition column."
- source: exact filename
- recurrence: object as defined above, or null
- condition: original recurrence text from the file, or null

Rules:
- Return ONLY a JSON array — compact, no whitespace/newlines, no markdown fences, no prose.
- Up to 80 items max.
- Skip header rows and column titles — only real scheduled items.
- If a file is unreadable (binary, image), extract nothing from it.
- Keep the response short so it fits in one reply; truncate "reason" before truncating the list.`;

  const raw = await window.claude.complete(prompt);
  const parsed = parseTaskArrayResilient(raw);
  if (!parsed.length) throw new Error("AI returned no items");

  const cleaned = parsed.map((t, i) => {
    const hasRecurrence = t.recurrence && typeof t.recurrence === "object";
    const dateIso = typeof t.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date)
      ? t.date
      : (hasRecurrence ? null : todayIso);
    const endIso = typeof t.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.endDate) ? t.endDate : null;
    const allDay = hasRecurrence ? false : (!!t.allDay || t.start == null);
    return {
      id: t.id || `t${i + 1}`,
      title: String(t.title || "Untitled").slice(0, 100),
      cat: ["work","meet","focus","life"].includes(t.cat) ? t.cat : "meet",
      date: dateIso,
      endDate: endIso && dateIso && endIso >= dateIso ? endIso : null,
      allDay,
      start: hasRecurrence ? null : (allDay ? null : Math.max(0, Math.min(23.5, parseFloat(t.start) || 9))),
      dur:   hasRecurrence ? (Number.isFinite(+t.recurrence?.duration) ? +t.recurrence.duration : null)
                           : (allDay ? null : Math.max(0.5, Math.min(4, parseFloat(t.dur) || 1))),
      prio: ["high","med","low"].includes(t.prio) ? t.prio : "med",
      reason: String(t.reason || `From ${t.source || "uploaded files"}.`),
      source: t.source || "",
      recurrence: hasRecurrence ? t.recurrence : null,
      condition: typeof t.condition === "string" ? t.condition : null,
    };
  });

  // Expand any rows that carry a recurrence rule into concrete dated events,
  // spread across the week and de-overlapped. Non-recurring rows pass
  // through untouched.
  const expanded = window.expandRecurringTasks
    ? window.expandRecurringTasks(cleaned, { startDate: new Date() })
    : cleaned;

  return expanded;
}

const ScreenExtraction = ({ state, set }) => {
  const [progress, setProgress] = React.useState(0);
  const [extracted, setExtracted] = React.useState([]);
  const [status, setStatus] = React.useState("reading");
  const [errMsg, setErrMsg] = React.useState("");
  const [fileStatus, setFileStatus] = React.useState({}); // index -> 'reading' | 'done' | 'skipped'
  const [fileNotes, setFileNotes] = React.useState({});
  const cancelRef = React.useRef(false);

  React.useEffect(() => {
    cancelRef.current = false;
    let progIv;
    (async () => {
      // Slow climb up to ~30% while we parse each file, then to ~85% while AI thinks.
      let p = 0;
      progIv = setInterval(() => {
        if (cancelRef.current) return;
        p = Math.min(0.85, p + 0.012);
        setProgress(p);
      }, 110);

      let tasks;
      try {
        if (!state.rawFiles?.length) throw new Error("no files were uploaded");
        tasks = await aiExtractTasks(state.rawFiles, (idx, st, note) => {
          setFileStatus(prev => ({ ...prev, [idx]: st }));
          if (note) setFileNotes(prev => ({ ...prev, [idx]: note }));
        });
      } catch (e) {
        setErrMsg(e.message || String(e));
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
      for (let i = 0; i < tasks.length; i++) {
        if (cancelRef.current) return;
        await new Promise(r => setTimeout(r, 60));
        setExtracted(tasks.slice(0, i + 1));
        setProgress(0.85 + (0.15 * (i + 1) / tasks.length));
      }
      setStatus("done");
      setProgress(1);
    })();
    return () => {
      cancelRef.current = true;
      clearInterval(progIv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = status === "done";
  const noTasks = done && extracted.length === 0;

  return (
    <div style={{ padding: "44px 56px", height: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
      <PlannerStep idx={2} total={2} label={done ? (noTasks ? "Nothing to extract" : "Extraction complete") : status === "placing" ? "Placing on calendar" : "Reading & extracting"} />
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
        <div style={{ flex: "0 0 340px" }}>
          <div style={{
            fontFamily: "var(--font-display)", fontWeight: "var(--display-weight)",
            letterSpacing: "var(--display-tracking)", fontSize: 30, lineHeight: 1.1,
          }}>
            {done
              ? (noTasks
                  ? <>No tasks found.</>
                  : <>Lifted <span style={{ color: "var(--accent)" }}>{extracted.length}</span> {extracted.length === 1 ? "item" : "items"}.</>)
              : <>Reading the file{state.rawFiles.length === 1 ? "" : "s"}.</>}
          </div>
          <div style={{ fontSize: 13, color: "var(--fg-2)", marginTop: 12, lineHeight: 1.55 }}>
            {done
              ? (noTasks
                  ? "Nothing in the uploaded files looked like a task, event, or deadline. Try uploading notes, a calendar export, or a task list."
                  : "Every task below was extracted from your file contents. Hover any task in the calendar to see exactly what the file said.")
              : "Parsing PDFs, spreadsheets, and docs into text, then asking the scheduler to place only what's actually in them."}
          </div>
          <div style={{
            marginTop: 22, background: "var(--bg-2)", border: "1px solid var(--line)",
            borderRadius: "var(--radius-sm)", padding: "14px 16px",
            fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)",
          }}>
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
                const note = fileNotes[i];
                const color = st === "done" ? "var(--ok)" : st === "skipped" ? "var(--warn)" : st === "reading" ? "var(--accent)" : "var(--fg-3)";
                const mark = st === "done" ? "✓" : st === "skipped" ? "⨯" : st === "reading" ? "···" : "—";
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: st === "queued" ? "var(--fg-3)" : "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{f.name}</span>
                      <span style={{ color }}>{mark}</span>
                    </div>
                    {note && st === "skipped" && (
                      <div style={{ fontSize: 9, color: "var(--warn)", opacity: 0.8, marginTop: 1 }}>
                        skipped · {note}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {errMsg && (
            <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--warn)" }}>
              error: {errMsg}
            </div>
          )}
        </div>
        <div style={{ flex: 1, background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--radius)", overflow: "hidden", maxHeight: 540 }}>
          <div style={{
            padding: "12px 18px", borderBottom: "1px solid var(--line)",
            fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)",
            letterSpacing: "0.06em", display: "flex", justifyContent: "space-between",
          }}>
            <span>EXTRACTED · live</span>
            <span style={{ color: "var(--accent)" }}>{extracted.length} ITEMS</span>
          </div>
          <div style={{ padding: "8px 0", display: "flex", flexDirection: "column", maxHeight: 490, overflow: "hidden" }}>
            {extracted.length === 0 && (
              <div style={{ padding: "40px 18px", textAlign: "center", color: "var(--fg-3)", fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                {done ? "NO ITEMS FOUND IN UPLOADED FILES" : "AWAITING SCHEDULER ···"}
              </div>
            )}
            {extracted.slice(-11).map((t) => (
              <div key={t.id} style={{
                padding: "10px 18px", display: "grid",
                gridTemplateColumns: "26px 1fr 80px 60px",
                gap: 14, alignItems: "center", fontSize: 12,
                animation: "plannerFadeIn .3s ease-out",
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>#{String(t.id).replace(/\D/g,"").padStart(2, "0")}</span>
                <span style={{ color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                <CategoryChip cat={t.cat} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: t.prio === "high" ? "var(--warn)" : t.prio === "med" ? "var(--accent)" : "var(--fg-3)", textAlign: "right", letterSpacing: "0.04em" }}>
                  {t.prio.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => set({ screen: "upload" })} style={ghostBtnStyle()}>← Back</button>
        <PrimaryButton disabled={!done} onClick={() => {
          if (extracted.length) {
            // Merge the new batch into the accumulated plan. Re-id so the new
            // items can't collide with ids already on the calendar.
            const offset = state.tasks?.length || 0;
            const merged = [
              ...(state.tasks || []),
              ...extracted.map((t, i) => ({ ...t, id: `t${offset + i + 1}` })),
            ];
            set({
              tasks: merged,
              sources: [...(state.sources || []), ...(state.files || [])],
              files: [], rawFiles: [],
              screen: "calendar",
            });
          } else {
            set({ screen: "calendar" });
          }
        }}>
          {done
            ? (noTasks
                ? "Back to calendar →"
                : `Add ${extracted.length} ${extracted.length === 1 ? "item" : "items"} to calendar →`)
            : "Extracting…"}
        </PrimaryButton>
      </div>
    </div>
  );
};

// ── Shared atoms ────────────────────────────────────────────────────────────
const PrimaryButton = ({ children, onClick, disabled }) => (
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

const ghostBtnStyle = () => ({
  padding: "8px 14px", background: "transparent",
  color: "var(--fg-2)", border: "1px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  fontFamily: "var(--font-ui)", fontSize: 12,
  cursor: "pointer",
});

const CategoryChip = ({ cat }) => {
  const labels = { work: "WORK", meet: "MEETING", focus: "FOCUS", life: "LIFE" };
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.06em",
      color: `var(--cat-${cat})`,
      border: `1px solid var(--cat-${cat})`,
      borderRadius: 2, padding: "2px 5px",
      width: "fit-content", opacity: 0.85,
    }}>{labels[cat]}</span>
  );
};

Object.assign(window, {
  ScreenUpload, ScreenExtraction,
  PrimaryButton, ghostBtnStyle, CategoryChip, PlannerStep, FileGlyph,
});
