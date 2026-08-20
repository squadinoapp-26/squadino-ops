import { prisma } from "@/lib/prisma";
import { requirePlatformSession, canManageStaff } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import StaffManager from "./StaffManager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const staff = await requirePlatformSession();
  if (!canManageStaff(staff.role)) redirect("/app-management");

  const users = await prisma.platformUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/app-management" className="text-slate-400 hover:text-white text-sm">← Back</Link>
        <h1 className="font-bold text-lg">Staff</h1>
      </div>
      <div className="max-w-2xl mx-auto p-6">
        <StaffManager initialUsers={users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() }))} currentUserId={staff.id} />
      </div>
    </div>
  );
}
