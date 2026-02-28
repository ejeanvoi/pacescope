import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { GlobalView } from "@/components/dashboard/global-view";

export default async function GlobalPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <GlobalView />;
}
