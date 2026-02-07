import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HistoryClient } from "./HistoryClient";

const LIMIT = 50;

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/history");
  }

  const { data, error } = await supabase
    .from("estimates")
    .select("id, meal, portion, details, calories, protein_g, carbs_g, fat_g, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  const list = error ? [] : (data ?? []);

  return <HistoryClient initialData={list} />;
}
