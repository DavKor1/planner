import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { PlannerTask } from "@/components/planner/types";

type DbTask = Database["public"]["Tables"]["tasks"]["Row"];
type DbTaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];

// ── Priority mapping ──────────────────────────────────────────────────────────
// DB: low | medium | high   ↔   PlannerTask: low | med | high

function dbPriorityToClient(p: DbTask["priority"]): PlannerTask["prio"] {
  return p === "medium" ? "med" : p;
}

function clientPriorityToDb(p: PlannerTask["prio"]): NonNullable<DbTaskInsert["priority"]> {
  return p === "med" ? "medium" : p;
}

// ── Row ↔ PlannerTask ─────────────────────────────────────────────────────────

export function dbTaskToPlannerTask(row: DbTask): PlannerTask {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    cat: row.cat,
    date: row.due_date ?? null,
    endDate: row.end_date ?? null,
    allDay: row.all_day,
    start: row.start_time ?? null,
    dur: row.duration ?? null,
    prio: dbPriorityToClient(row.priority),
    reason: row.reason ?? "",
    source: row.source ?? "",
    phase: row.phase ?? null,
    isMilestone: row.is_milestone,
    isReminder: row.is_reminder,
    dependsOn: row.depends_on ?? [],
    recurrence: (row.recurrence as Record<string, unknown> | null) ?? null,
    condition: row.condition ?? null,
  };
}

export function plannerTaskToDbInsert(
  task: PlannerTask,
  projectId: string,
  userId: string
): DbTaskInsert {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(task.id);
  return {
    ...(isUuid ? { id: task.id } : {}),
    project_id: projectId,
    user_id: userId,
    title: task.title,
    description: task.description || null,
    status: "todo",
    priority: clientPriorityToDb(task.prio),
    due_date: task.date ?? null,
    cat: task.cat,
    all_day: task.allDay,
    start_time: task.start ?? null,
    duration: task.dur ?? null,
    end_date: task.endDate ?? null,
    reason: task.reason || null,
    source: task.source || null,
    phase: task.phase ?? null,
    is_milestone: task.isMilestone ?? false,
    is_reminder: task.isReminder ?? false,
    depends_on: task.dependsOn?.length ? task.dependsOn : null,
    recurrence: task.recurrence
      ? (task.recurrence as Database["public"]["Tables"]["tasks"]["Insert"]["recurrence"])
      : null,
    condition: task.condition ?? null,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/** Load all tasks for a project, ordered by scheduled date. */
export async function loadTasks(projectId: string): Promise<PlannerTask[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) { console.error("loadTasks:", error); return []; }
  return (data ?? []).map(dbTaskToPlannerTask);
}

/** Insert multiple tasks at once. Returns saved rows with DB-generated UUIDs. */
export async function insertTasks(
  tasks: PlannerTask[],
  projectId: string,
  userId: string
): Promise<PlannerTask[]> {
  if (!tasks.length) return [];
  const supabase = createClient();
  const rows: DbTaskInsert[] = tasks.map(t => plannerTaskToDbInsert(t, projectId, userId));

  const { data, error } = await supabase
    .from("tasks")
    .insert(rows)
    .select();

  if (error) { console.error("insertTasks:", error); return []; }
  return (data ?? []).map(dbTaskToPlannerTask);
}

/** Delete all tasks for a project (used by "Reset" action). */
export async function deleteAllTasks(projectId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("project_id", projectId);

  if (error) { console.error("deleteAllTasks:", error); return false; }
  return true;
}

/** Delete a single task. */
export async function deleteTask(taskId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) { console.error("deleteTask:", error); return false; }
  return true;
}

/** Upsert (update or insert) a single task. */
export async function upsertTask(
  task: PlannerTask,
  projectId: string,
  userId: string
): Promise<PlannerTask | null> {
  const supabase = createClient();
  const row = plannerTaskToDbInsert(task, projectId, userId);

  const { data, error } = await supabase
    .from("tasks")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) { console.error("upsertTask:", error); return null; }
  return dbTaskToPlannerTask(data);
}
