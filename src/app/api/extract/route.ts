import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── Resilient JSON parser ─────────────────────────────────────────────────────

function parseTaskArrayResilient(raw: string): unknown[] {
  if (!raw) return [];
  let s = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
  const start = s.indexOf("[");
  if (start < 0) return [];
  s = s.slice(start);

  const closeFull = s.lastIndexOf("]");
  if (closeFull > 0) {
    try {
      const arr = JSON.parse(s.slice(0, closeFull + 1));
      if (Array.isArray(arr)) return arr;
    } catch (_) { /* fall through */ }
  }

  // Salvage truncated JSON
  let depth = 0, inStr = false, esc = false, lastGoodEnd = -1;
  for (let i = 1; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) { esc = false; continue; } if (c === "\\") { esc = true; continue; } if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") { depth++; continue; }
    if (c === "}") { depth--; if (depth === 0) lastGoodEnd = i + 1; continue; }
    if (c === "]" && depth === 0) break;
  }
  if (lastGoodEnd < 0) return [];
  try { const arr = JSON.parse(s.slice(0, lastGoodEnd) + "]"); return Array.isArray(arr) ? arr : []; }
  catch (_) { return []; }
}

// ── File text extraction ──────────────────────────────────────────────────────

async function extractText(buffer: ArrayBuffer, filename: string): Promise<{ ok: boolean; text: string; note?: string }> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  try {
    if (["txt","csv","md","ics","json","log","tsv","yml","yaml"].includes(ext)) {
      return { ok: true, text: new TextDecoder().decode(buffer) };
    }
    if (ext === "xlsx" || ext === "xls") {
      const { read, utils } = await import("xlsx");
      const wb = read(buffer, { type: "array" });
      const text = wb.SheetNames.map(name =>
        `--- Sheet: ${name} ---\n${utils.sheet_to_csv(wb.Sheets[name])}`
      ).join("\n\n");
      return { ok: true, text };
    }
    if (ext === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return { ok: true, text: result.value };
    }
    if (ext === "pdf") {
      const pdfjsLib = await import("pdfjs-dist");
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
        if (pages.join("").length > 20000) break;
      }
      return { ok: true, text: pages.join("\n") };
    }
    return { ok: false, text: "", note: `Unsupported file type: .${ext}` };
  } catch (err) {
    return { ok: false, text: "", note: String(err) };
  }
}

// ── Smart planning prompt ─────────────────────────────────────────────────────

function buildSmartPrompt(fileBlocks: string[]): string {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][today.getDay()];

  return `You are an expert AI planning assistant. Today is ${todayIso} (${dayName}).

Your job is to read documents and generate a complete, intelligent calendar plan — not just a literal copy of dates.

══════════════════════════════════════════════════════════════════
WHAT YOU MUST DO
══════════════════════════════════════════════════════════════════
1. EXTRACT all tasks, events, deadlines, milestones, and goals.
2. INFER phases and logical groupings from the content.
3. CREATE milestones at the end of each phase or before major deadlines.
4. CREATE reminders 1–2 days before important deadlines (mark isReminder: true).
5. BREAK large tasks into smaller sub-tasks when appropriate.
6. DETECT dependencies — if task B depends on task A, reflect that.
7. ESTIMATE timelines realistically if the document doesn't specify them.
8. AVOID scheduling conflicts by spreading tasks sensibly.
9. USE ACTUAL DATES from the file when present.

══════════════════════════════════════════════════════════════════
DATE RECOGNITION — parse all of these formats:
══════════════════════════════════════════════════════════════════
• ISO:        2026-06-15
• European:   15.06.2026
• Long:       June 15, 2026 / 15 June 2026
• Relative:   "next Monday", "tomorrow", "end of month", "next week"
• Vague:      "early June" → June 3, "mid-June" → June 15, "end of June" → June 28
• Quarters:   "Q3 2026" → July 1, 2026
Always convert to YYYY-MM-DD. Use today (${todayIso}) as the anchor for relative dates.

══════════════════════════════════════════════════════════════════
RECURRENCE — same rules as before
══════════════════════════════════════════════════════════════════
For recurring rows, return ONE object with a "recurrence" field (never enumerate instances).
The recurrence object:
  { perWeek, total, daysInARow, daysOfWeek: ["mon","wed",...],
    timeOfDay: "morning"|"noon"|"afternoon"|"evening",
    duration, months: ["may","june",...], year, wholeYear }

For non-recurring rows, leave recurrence: null and set date/start/dur.

══════════════════════════════════════════════════════════════════
SMART PLANNING RULES
══════════════════════════════════════════════════════════════════
• If a deadline exists → add a "Prepare for [X]" task 2 days before.
• If a multi-week project → add weekly check-in milestones.
• If approval/review is mentioned → create the review as a separate milestone.
• If a dependency is detected → record it in dependsOn (array of task IDs like ["t3","t5"]).
• If multiple tasks share a theme → assign them the same phase name.
• Keep tasks realistic: don't schedule 6+ hours of work in a single day.

══════════════════════════════════════════════════════════════════
FILES TO ANALYZE
══════════════════════════════════════════════════════════════════
${fileBlocks.join("\n\n")}

══════════════════════════════════════════════════════════════════
OUTPUT FORMAT — return ONLY a JSON array, no prose, no fences
══════════════════════════════════════════════════════════════════
Each object:
{
  "id":          "t1" | "t2" ...     // sequential
  "title":       string              // ≤ 60 chars, clear action verb
  "description": string              // 1–2 sentences of context (empty string if none)
  "cat":         "work"|"meet"|"focus"|"life"
  "date":        "YYYY-MM-DD" | null  // null only for recurring rows
  "endDate":     "YYYY-MM-DD" | null  // for multi-day events
  "allDay":      boolean
  "start":       number | null       // 0–23 decimal hour, null if allDay or recurring
  "dur":         number | null       // hours 0.5–4
  "prio":        "high"|"med"|"low"
  "isMilestone": boolean             // true for phase-end milestones and key checkpoints
  "isReminder":  boolean             // true for pre-deadline reminders
  "phase":       string | null       // e.g. "Phase 1 – Discovery", null if not grouped
  "dependsOn":   string[]            // IDs of tasks this depends on, e.g. ["t2","t3"]
  "reason":      string              // ≤ 12 words: why this is placed here
  "source":      string              // exact filename
  "recurrence":  object | null
  "condition":   string | null       // original recurrence text
}

Rules:
• Up to 120 items. Quality over quantity — only real, actionable items.
• Skip column headers. Skip decorative rows.
• isMilestone tasks can be allDay:true with no start/dur.
• isReminder tasks get prio:"high" automatically.
• Return compact JSON — no whitespace between properties.`;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (!files.length) {
    return NextResponse.json({ error: "files are required" }, { status: 400 });
  }

  const fileBlocks: string[] = [];
  const skipped: { source: string; note: string }[] = [];

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const { ok, text, note } = await extractText(buffer, file.name);
    if (ok && text.trim()) {
      fileBlocks.push(`=== ${file.name} ===\n${text.slice(0, 14000)}`);
    } else {
      skipped.push({ source: file.name, note: note || "unreadable" });
    }
  }

  if (!fileBlocks.length) {
    return NextResponse.json({ error: "No readable file contents", skipped }, { status: 422 });
  }

  const prompt = buildSmartPrompt(fileBlocks);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8096,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("");

  const extracted = parseTaskArrayResilient(raw);

  return NextResponse.json({ extracted, skipped, count: extracted.length });
}
