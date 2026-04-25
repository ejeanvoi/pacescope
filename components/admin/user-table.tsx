"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDistance, formatDuration } from "@/lib/calculations";
import { Search, ChevronDown, ChevronUp, Trash2, Shield, ShieldOff, UserCheck, UserX } from "lucide-react";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { activities: number };
}

interface UserStats {
  userId: string;
  totalDistance: number;
  totalDuration: number;
  activityCount: number;
}

interface UserTableProps {
  currentUserId: string;
}

export function UserTable({ currentUserId }: UserTableProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userStats, setUserStats] = useState<Record<string, UserStats>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.name?.toLowerCase().includes(q) ?? false) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const toggleRole = async (userId: string, currentRole: string) => {
    setActionLoading(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: currentRole === "ADMIN" ? "USER" : "ADMIN",
        }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update role");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const toggleActive = async (userId: string, currentActive: boolean) => {
    setActionLoading(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update status");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (userId: string) => {
    setActionLoading(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchUsers();
        setExpandedUser(null);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete user");
      }
    } finally {
      setActionLoading(null);
    }
  };

  const toggleExpand = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    // Fetch stats if not cached
    if (!userStats[userId]) {
      try {
        const res = await fetch(`/api/admin/users/${userId}/stats`);
        if (res.ok) {
          const data = await res.json();
          setUserStats((prev) => ({ ...prev, [userId]: data }));
        }
      } catch {
        // Stats fetch is optional, don't block
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Users ({filteredUsers.length})</CardTitle>
            <CardDescription>
              Manage registered PaceScope users
            </CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {search ? "No users match your search." : "No users found."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Activities
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Joined</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isExpanded = expandedUser === user.id;
                  const isLoading = actionLoading === user.id;
                  const stats = userStats[user.id];

                  return (
                    <React.Fragment key={user.id}>
                      <tr
                        className={cn(
                          "border-b transition-colors",
                          isSelf && "bg-primary/5",
                          isExpanded && "border-b-0"
                        )}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleExpand(user.id)}
                            className="flex items-center gap-1 hover:underline"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                            {user.name || "—"}
                            {isSelf && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">{user.email}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                              user.role === "ADMIN"
                                ? "bg-primary/10 text-primary"
                                : "bg-secondary text-secondary-foreground"
                            )}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                              user.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            )}
                          >
                            {user.isActive ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {user._count.activities}
                        </td>
                        <td className="px-4 py-3" suppressHydrationWarning>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleRole(user.id, user.role)}
                              disabled={isLoading || isSelf}
                              title={
                                user.role === "ADMIN"
                                  ? "Demote to User"
                                  : "Promote to Admin"
                              }
                            >
                              {user.role === "ADMIN" ? (
                                <ShieldOff className="h-4 w-4" />
                              ) : (
                                <Shield className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                toggleActive(user.id, user.isActive)
                              }
                              disabled={isLoading || isSelf}
                              title={
                                user.isActive
                                  ? "Disable Account"
                                  : "Enable Account"
                              }
                            >
                              {user.isActive ? (
                                <UserX className="h-4 w-4" />
                              ) : (
                                <UserCheck className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete user "${user.name || user.email}"? This will also delete all their activities. This cannot be undone.`
                                  )
                                ) {
                                  deleteUser(user.id);
                                }
                              }}
                              disabled={isLoading || isSelf}
                              title="Delete User"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${user.id}-stats`} className="border-b">
                          <td colSpan={7} className="bg-muted/30 px-4 py-3">
                            {stats ? (
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">
                                    Total Distance
                                  </p>
                                  <p className="font-medium">
                                    {formatDistance(stats.totalDistance)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">
                                    Total Time
                                  </p>
                                  <p className="font-medium">
                                    {stats.totalDuration > 0
                                      ? formatDuration(stats.totalDuration)
                                      : "0m"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">
                                    Activities
                                  </p>
                                  <p className="font-medium">
                                    {stats.activityCount}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                Loading stats...
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
