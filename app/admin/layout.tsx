import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-screen">
      <Sidebar userRole={session.user.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userName={session.user.name} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
