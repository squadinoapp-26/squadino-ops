import { prisma } from "@/lib/prisma";
import { requirePlatformSessionOrRedirect, canManageClients } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import Link from "next/link";
import NewClubForm from "./NewClubForm";

export const dynamic = "force-dynamic";

export default async function NewClubPage() {
  const staff = await requirePlatformSessionOrRedirect();
  if (!canManageClients(staff.role)) redirect("/");

  const packages = await prisma.package.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, userCap: true, priceCents: true },
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-white text-sm">← Back</Link>
        <h1 className="font-bold text-lg">New Client</h1>
        <SignOutButton className="ml-auto text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors" />
      </div>
      <div className="max-w-2xl mx-auto p-6">
        <NewClubForm packages={packages} />
      </div>
    </div>
  );
}
