import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <DashboardView userName={session.user.name || "Runner"} />;
}
