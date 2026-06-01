// ── Task / Calendar item ──────────────────────────────────────────────────────

export type TaskCategory = "work" | "meet" | "focus" | "life";
export type TaskPriority = "high" | "medium" | "low";

export interface RecurrenceRule {
  perWeek?: number;
  total?: number;
  daysInARow?: number;
  daysOfWeek?: number[]; // 0 = Sun … 6 = Sat
  timeOfDay?: string; // "09:00"
  duration?: number; // minutes
  months?: number[]; // 1–12
  wholeYear?: boolean;
}

export interface Task {
  id: string;
  plan_id: string;
  user_id: string;
  title: string;
  cat: TaskCategory;
  date: string; // ISO date "YYYY-MM-DD"
  end_date?: string;
  all_day: boolean;
  start?: string; // "HH:MM"
  dur?: number; // minutes
  prio: TaskPriority;
  reason?: string; // AI explanation
  source?: string; // filename it came from
  recurrence?: RecurrenceRule;
  condition?: string;
  created_at: string;
}

// ── Plan ─────────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// ── Document ──────────────────────────────────────────────────────────────────

export type DocumentStatus = "pending" | "processing" | "done" | "error";

export interface Document {
  id: string;
  plan_id: string;
  user_id: string;
  filename: string;
  size: number;
  storage_path: string;
  status: DocumentStatus;
  item_count?: number;
  error_message?: string;
  created_at: string;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  display_name?: string;
  created_at: string;
}

// ── Extraction ────────────────────────────────────────────────────────────────

export interface ExtractedItem {
  title: string;
  cat: TaskCategory;
  date?: string;
  end_date?: string;
  all_day?: boolean;
  start?: string;
  dur?: number;
  prio: TaskPriority;
  reason?: string;
  recurrence?: RecurrenceRule;
  condition?: string;
}

export interface ExtractionResult {
  items: ExtractedItem[];
  source: string;
  skipped?: boolean;
  skip_reason?: string;
}
