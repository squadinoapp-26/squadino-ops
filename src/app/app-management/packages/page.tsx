import { prisma } from "@/lib/prisma";
import { requirePlatformSessionOrRedirect, canManagePackages } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import PackagesManager from "./PackagesManager";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const staff = await requirePlatformSessionOrRedirect();
  if (!canManagePackages(staff.role)) redirect("/app-management");

  const packages = await prisma.package.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { clubs: true } } },
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/app-management" className="text-slate-400 hover:text-white text-sm">← Back</Link>
        <h1 className="font-bold text-lg">Packages</h1>
      </div>
      <div className="max-w-3xl mx-auto p-6">
        <PackagesManager initial={packages.map(p => ({
          id: p.id, key: p.key, name: p.name, userCap: p.userCap, priceCents: p.priceCents,
          trialDays: p.trialDays, active: p.active, sortOrder: p.sortOrder, clubCount: p._count.clubs,
        }))} />
      </div>
    </div>
  );
}
