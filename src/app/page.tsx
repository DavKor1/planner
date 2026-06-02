import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlannerApp from "@/components/planner/PlannerApp";
import LandingPage from "@/components/landing/LandingPage";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Show landing page for unauthenticated users
  if (!user) return <LandingPage />;

  // Show planner for authenticated users
  return <PlannerApp />;
}
