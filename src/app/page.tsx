import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlannerApp from "@/components/planner/PlannerApp";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Middleware already redirects unauthenticated users, but guard here too.
  if (!user) redirect("/login");

  return <PlannerApp />;
}
