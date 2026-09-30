import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import SignupActions from "./SignupActions";
import SignupEditor from "./SignupEditor";
import { isDummyPaymentId } from "@/lib/payment";
import { getPlatformUser, canReviewSignups, canEditSignups, canViewLogs } from "@/lib/auth";
import { signupPackageLabel } from "@/lib/signupPackages";
import { slugify } from "@/lib/subdomain";
import { ROOT_DOMAIN } from "@/lib/hostClub";
import { withCurrentSports } from "@/lib/sportCatalog";
import { listSportNames } from "@/lib/sportCatalog.server";

export const dynamic = "force-dynamic";

export default async function SignupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [signup, viewer] = await Promise.all([
    prisma.signupRequest.findUnique({ where: { id }, include: { reviewedByPlatformUser: { select: { name: true } } } }),
    getPlatformUser(),
  ]);
  if (!signup) notFound();

  const address = [signup.street, signup.suburb, signup.postcode].filter(Boolean).join(", ");

  const dummy = isDummyPaymentId(signup.stripeCustomerId);
  const payment = !signup.stripeCustomerId
    ? "— free trial, no payment"
    : dummy
      ? `Dummy payment (test mode, nothing charged) · ${signup.stripeCustomerId}`
      : `Stripe customer ${signup.stripeCustomerId} · subscription ${signup.stripeSubscriptionId ?? "—"}`;
  const reviewer = signup.reviewedByPlatformUser?.name;

  // SignupRequest has no clubId, so find the club it created by name + owner.
  const club = signup.status === "APPROVED"
    ? await prisma.club.findFirst({
        where: { name: signup.clubName, users: { some: { email: signup.contactEmail, role: "ADMIN" } } },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, code: true, slug: true, subdomainReady: true },
      })
    : null;

  // The signup as submitted, or as last corrected. Editors get it wrapped in
  // an "Edit details" switch; everyone else just sees it.
  const details = (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
      <Field label="Package" value={`${signupPackageLabel(signup.packageKey, signup.interval)} · trial ${signup.trialDays} days`} />
      <Field label="Club / organisation name" value={signup.clubName} />
      <Field label="Registered name" value={signup.registeredName ?? "— same as above"} />
      <Field label="Organisation type" value={signup.orgType} />
      <Field label="Sports" value={signup.sports.join(", ") || "—"} />
      <Field label="Address" value={address || "—"} />
      <Field label="Requested URL" value={signup.requestedUrl ?? "— none requested"} />
      <Field label="Estimated users" value={String(signup.estimatedUsers)} />
      <Field label="Primary contact" value={`${signup.contactName} · ${signup.contactEmail}${signup.contactPhone ? ` · ${signup.contactPhone}` : ""}`} />
      <Field label="Payment" value={payment} />
      <Field label="Submitted" value={new Date(signup.createdAt).toLocaleString("en-AU")} />
      {signup.status !== "PENDING" && (
        <Field
          label="Reviewed"
          value={`${signup.status}${reviewer ? ` by ${reviewer}` : ""} at ${signup.reviewedAt ? new Date(signup.reviewedAt).toLocaleString("en-AU") : "—"}${signup.rejectionReason ? ` — ${signup.rejectionReason}` : ""}`}
        />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <Link href="/signups" className="text-slate-500 hover:text-white text-sm">← Back</Link>
        <h1 className="font-bold text-lg">{signup.clubName}</h1>
        <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono uppercase">{signup.status}</span>
        {canViewLogs(viewer?.role) && (
          <Link href={`/logs?item=${signup.id}`} className="ml-auto text-sm text-slate-400 hover:text-white">History →</Link>
        )}
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {signup.status === "PENDING" && canEditSignups(viewer?.role) ? (
          <SignupEditor
            id={signup.id}
            signup={{
              packageKey: signup.packageKey, interval: signup.interval, trialDays: signup.trialDays,
              clubName: signup.clubName, registeredName: signup.registeredName, orgType: signup.orgType,
              sports: signup.sports, street: signup.street, suburb: signup.suburb, postcode: signup.postcode,
              requestedUrl: signup.requestedUrl, estimatedUsers: signup.estimatedUsers,
              contactName: signup.contactName, contactEmail: signup.contactEmail, contactPhone: signup.contactPhone,
            }}
            sportOptions={withCurrentSports(await listSportNames(), signup.sports)}
            paymentKind={!signup.stripeCustomerId ? "none" : dummy ? "dummy" : "stripe"}
          >
            {details}
          </SignupEditor>
        ) : details}

        {club && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Club</p>
              <p className="text-sm mt-0.5">{club.name} · <span className="font-mono">{club.code}</span></p>
              <p className="text-xs text-slate-500 mt-0.5">
                <span className="font-mono">{club.slug}.squadino.com</span> · {club.subdomainReady ? "subdomain live" : "subdomain not set up yet"}
              </p>
            </div>
            <Link href={`/clubs/${club.id}`}
              className="bg-slate-700 hover:bg-slate-600 text-sm px-4 py-2 rounded-xl transition-colors whitespace-nowrap">
              {club.subdomainReady ? "Manage →" : "Finish setup →"}
            </Link>
          </div>
        )}

        {signup.status === "PENDING" && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
            {signup.stripeCustomerId && (
              <div className="rounded-xl bg-slate-900/60 border border-slate-700 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">Check the payment</p>
                <p className="mt-1">
                  {dummy
                    ? "This was a dummy (test mode) payment, so there's nothing to find in Stripe. Only approve it if you're expecting this test signup."
                    : `Find customer ${signup.stripeCustomerId} in the Stripe dashboard and check the ${signup.packageKey} subscription exists with a card saved and its ${signup.trialDays}-day trial started.`}
                </p>
              </div>
            )}
            <SignupActions id={signup.id} needsPaymentCheck={!!signup.stripeCustomerId} canReview={canReviewSignups(viewer?.role)}
              suggestedSubdomain={slugify(signup.clubName)} rootDomain={ROOT_DOMAIN} />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  );
}
