import { requirePlatformSessionOrRedirect, canManageStaff, canManagePackages } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AppManagementPage() {
  const staff = await requirePlatformSessionOrRedirect();
  if (!canManageStaff(staff.role)) redirect("/");

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-white text-sm">← Back</Link>
        <h1 className="font-bold text-lg">App Management</h1>
      </div>

      <div className="max-w-3xl mx-auto p-6 grid sm:grid-cols-2 gap-4">
        {canManageStaff(staff.role) && (
          <Link href="/app-management/staff"
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-blue-600 transition-colors">
            <span className="text-2xl">👥</span>
            <h2 className="font-semibold mt-3">Staff</h2>
            <p className="text-sm text-slate-400 mt-1">Add workers, assign roles, deactivate access.</p>
          </Link>
        )}
        {canManagePackages(staff.role) && (
          <Link href="/app-management/packages"
            className="bg-slate-800 border border-slate-700 rounded-2xl p-6 hover:border-blue-600 transition-colors">
            <span className="text-2xl">💳</span>
            <h2 className="font-semibold mt-3">Packages</h2>
            <p className="text-sm text-slate-400 mt-1">Create packages and set user limits and pricing.</p>
          </Link>
        )}
      </div>
    </div>
  );
}
