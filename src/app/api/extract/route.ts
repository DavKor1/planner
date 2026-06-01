import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ExtractedItem, ExtractionResult } from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── Resilient JSON parser (ported from prototype) ─────────────────────────────

function parseTaskArrayResilient(raw: string): ExtractedItem[] {
  const text = raw.trim();

  // Strip markdown fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const json = fenced ? fenced[1].trim() : text;

  // Try a clean parse first
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Truncated JSON — try repairing by appending closing brackets
    for (const suffix of ["]", "}]", "}}"]) {
      try {
        const repaired = JSON.parse(json + suffix);
        if (Array.isArray(repaired)) return repaired;
      } catch {
        // continue
      }
    }
    return [];
  }
}

// ── Text extraction helpers ───────────────────────────────────────────────────

async function extractText(
  buffer: ArrayBuffer,
  filename: string
): Promise<{ ok: boolean; text: string; note?: string }> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  try {
    if (ext === "txt" || ext === "csv" || ext === "md" || ext === "ics") {
      const text = new TextDecoder().decode(buffer);
      return { ok: true, text };
    }

    if (ext === "xlsx" || ext === "xls") {
      const { read, utils } = await import("xlsx");
      const wb = read(buffer, { type: "array" });
      const sheets = wb.SheetNames.map((name) =>
        utils.sheet_to_csv(wb.Sheets[name])
      ).join("\n\n");
      return { ok: true, text: sheets };
    }

    if (ext === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return { ok: true, text: result.value };
    }

    if (ext === "pdf") {
      // Basic text extraction via pdfjs-dist
      const pdfjsLib = await import("pdfjs-dist");
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items.map((item: { str?: string }) => item.str ?? "").join(" "));
      }
      return { ok: true, text: pages.join("\n") };
    }

    return { ok: false, text: "", note: `Unsupported file type: .${ext}` };
  } catch (err) {
    return { ok: false, text: "", note: String(err) };
  }
}

// ── Extraction prompt (ported verbatim from prototype) ────────────────────────

function buildPrompt(fileBlocks: string[]): string {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return `You are an AI scheduling assistant. Today is ${todayIso}.

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
    "perWeek":    integer 1-7,
    "total":      integer,
    "daysInARow": integer,
    "daysOfWeek": ["mon","wed",...],
    "timeOfDay":  "morning"|"noon"|"afternoon"|"evening",
    "duration":   number of hours,
    "months":     ["may","june",...],
    "year":       integer | null,
    "wholeYear":  true | false
  }

FILES:
${fileBlocks.join("\n\n")}

For every extracted item, return an object with these fields:
- id: "t1", "t2", ...
- title: short string copied from the file (≤ 60 chars)
- cat: "work" | "meet" | "focus" | "life"
- date: "YYYY-MM-DD" or null for recurring rows
- endDate: "YYYY-MM-DD" for multi-day events, else null
- allDay: true if no clock time given AND not recurring, false otherwise
- start: hour as number 0-23 when allDay=false, null for recurring
- dur: hours 0.5-3, when allDay=false
- prio: "high" | "med" | "low"
- reason: ≤ 8 words terse explanation
- source: exact filename
- recurrence: object or null
- condition: original recurrence text from file, or null

Rules:
- Return ONLY a JSON array — compact, no markdown fences, no prose.
- Up to 80 items max.
- Skip header rows and column titles.
- If a file is unreadable, extract nothing from it.`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const planId = formData.get("plan_id") as string;
  const files = formData.getAll("files") as File[];

  if (!planId || !files.length) {
    return NextResponse.json({ error: "plan_id and files are required" }, { status: 400 });
  }

  // Verify plan belongs to user
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id")
    .eq("id", planId)
    .eq("user_id", user.id)
    .single();

  if (planError || !plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const results: ExtractionResult[] = [];
  const fileBlocks: string[] = [];

  // Read and upload each file
  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const { ok, text, note } = await extractText(buffer, file.name);

    // Upload to Supabase Storage
    const storagePath = `${user.id}/${planId}/${Date.now()}-${file.name}`;
    await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, { contentType: file.type });

    // Record document in DB
    await supabase.from("documents").insert({
      plan_id: planId,
      user_id: user.id,
      filename: file.name,
      size: file.size,
      storage_path: storagePath,
      status: ok ? "processing" : "error",
      error_message: note,
    });

    if (ok && text.trim()) {
      fileBlocks.push(`=== ${file.name} ===\n${text.slice(0, 12000)}`);
    } else {
      results.push({ items: [], source: file.name, skipped: true, skip_reason: note });
    }
  }

  if (!fileBlocks.length) {
    return NextResponse.json({ error: "No readable file contents", results }, { status: 422 });
  }

  // Call Anthropic
  const prompt = buildPrompt(fileBlocks);
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const extracted = parseTaskArrayResilient(raw);

  // Normalize and insert tasks
  if (extracted.length) {
    const tasks = extracted.map((item) => ({
      plan_id: planId,
      user_id: user.id,
      title: item.title,
      cat: item.cat,
      date: item.date ?? null,
      end_date: item.end_date ?? null,
      all_day: item.all_day ?? true,
      start: item.start ?? null,
      dur: item.dur ?? null,
      prio: item.prio ?? "medium",
      reason: item.reason ?? null,
      source: item.source ?? null,
      recurrence: item.recurrence ?? null,
      condition: item.condition ?? null,
    }));

    await supabase.from("tasks").insert(tasks);

    // Update document statuses to done
    for (const block of fileBlocks) {
      const filename = block.match(/^=== (.+) ===/)?.[1];
      if (filename) {
        await supabase
          .from("documents")
          .update({ status: "done", item_count: extracted.filter((t) => t.source === filename).length })
          .eq("plan_id", planId)
          .eq("filename", filename);
      }
    }
  }

  return NextResponse.json({ extracted, results, count: extracted.length });
}
