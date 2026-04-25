import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserTable } from "@/components/admin/user-table";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Manage registered users and their roles
        </p>
      </div>
      <UserTable currentUserId={session.user.id} />
    </div>
  );
}
