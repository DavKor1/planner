import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

function logSupabaseError(label: string, error: unknown) {
  try {
    const e = error as Record<string, unknown>;
    // Capture every own property (including non-enumerable) plus prototype name
    const own: Record<string, unknown> = {};
    if (e && typeof e === "object") {
      for (const key of Object.getOwnPropertyNames(e)) {
        own[key] = e[key];
      }
    }
    console.error(label, {
      name: e?.name ?? (e?.constructor as { name?: string } | undefined)?.name,
      code: e?.code,
      message: e?.message,
      details: e?.details,
      hint: e?.hint,
      status: e?.status,
      ...own,
    });

    if (!e?.code && !e?.message) {
      console.error(
        "→ Empty error usually means one of:\n" +
        "  1. The `projects` table doesn't exist yet — run supabase/migrations/001_initial_schema.sql.\n" +
        "  2. The Supabase URL / anon key in .env.local is wrong (network/auth failure).\n" +
        "  3. The dev server wasn't restarted after editing .env.local."
      );
    }
  } catch {
    console.error(label, String(error));
  }
}

/** Returns the user's default (first) project, creating one if none exists. */
export async function getOrCreateDefaultProject(userId: string): Promise<Project | null> {
  const supabase = createClient();

  // Use limit(1) + maybeSingle() so "no rows" is data=null, error=null (no throw)
  const { data: existing, error: selectError } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    logSupabaseError("getOrCreateDefaultProject select error:", selectError);
    return null;
  }

  if (existing) return existing;

  // No project found — create the default one
  const { data: created, error: createError } = await supabase
    .from("projects")
    .insert({ user_id: userId, title: "My Plan", description: "Default planning project" })
    .select()
    .single();

  if (createError) {
    logSupabaseError("getOrCreateDefaultProject insert error:", createError);
    return null;
  }

  return created;
}

export async function listProjects(userId: string): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) { console.error("listProjects:", error); return []; }
  return data ?? [];
}

export async function createProject(userId: string, title: string, description?: string): Promise<Project | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: userId, title, description: description ?? null })
    .select()
    .single();

  if (error) { console.error("createProject:", error); return null; }
  return data;
}

export async function deleteProject(projectId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) { console.error("deleteProject:", error); return false; }
  return true;
}
