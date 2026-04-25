import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CompareView } from "@/components/dashboard/compare-view";

export default async function ComparePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <CompareView />;
}
