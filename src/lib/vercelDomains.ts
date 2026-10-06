// Adds a club's {slug}.squadino.com to this app's Vercel project, so a
// platform admin can set a subdomain up with one button instead of by hand
// in the Vercel dashboard (see the "Set up subdomain" action on
// /clubs/[id]). Plain fetch over Vercel's REST API, no SDK — same
// style as src/lib/stripe.ts.
//
// Needs, in this app's env:
//   VERCEL_API_TOKEN         a Vercel access token with access to the project
//   CLUB_VERCEL_PROJECT_ID   the CLUB app's project ID (Project → Settings → General).
//                            Not called VERCEL_PROJECT_ID on purpose: Vercel fills that
//                            name in itself with this (ops) project's own ID, which hid
//                            the value we set and gave "Project not found".
//   VERCEL_TEAM_ID           the team's ID, if the project belongs to a team
//
// And one-time DNS so every new subdomain resolves without a per-club
// record: either squadino.com uses Vercel's nameservers, or its DNS host has
// a wildcard CNAME  *.squadino.com → cname.vercel-dns.com. See
// Website/docs/DOMAIN-SETUP.md.

const VERCEL_API = "https://api.vercel.com";

export function vercelDomainsConfigured(): boolean {
  return !!process.env.VERCEL_API_TOKEN && !!process.env.CLUB_VERCEL_PROJECT_ID;
}

export type SubdomainSetupResult =
  | { status: "ready" }
  // Added, but DNS or verification hasn't caught up yet — pressing the
  // button again in a minute or two usually finishes it.
  | { status: "pending"; message: string }
  | { status: "error"; message: string };

async function vercelFetch(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: unknown) {
  const url = new URL(`${VERCEL_API}${path}`);
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function apiError(step: string, r: { status: number; data: { error?: { message?: string } } }): SubdomainSetupResult {
  const id = process.env.CLUB_VERCEL_PROJECT_ID ?? "";
  // Project IDs aren't secret; showing the start of the one in use makes a wrong value easy to spot.
  return { status: "error", message: `Vercel couldn't ${step}: ${r.data?.error?.message ?? `HTTP ${r.status}`} (project ${id.slice(0, 8)}…)` };
}

/** Makes sure `host` is on the Vercel project, verified, and pointed at Vercel. Safe to call repeatedly. */
export async function ensureProjectDomain(host: string): Promise<SubdomainSetupResult> {
  if (!vercelDomainsConfigured()) {
    return {
      status: "error",
      message: "Automatic subdomain setup isn't configured (VERCEL_API_TOKEN / CLUB_VERCEL_PROJECT_ID). Add the domain in Vercel by hand, then tick \"Subdomain is live\" below.",
    };
  }
  const project = encodeURIComponent(process.env.CLUB_VERCEL_PROJECT_ID!);
  const domain = encodeURIComponent(host);

  try {
    // 1. On the project yet? Add it if not.
    let projectDomain = await vercelFetch(`/v9/projects/${project}/domains/${domain}`);
    if (projectDomain.status === 404) {
      const added = await vercelFetch(`/v10/projects/${project}/domains`, "POST", { name: host });
      if (!added.ok) return apiError("add the domain", added);
      projectDomain = added;
    } else if (!projectDomain.ok) {
      return apiError("look up the domain", projectDomain);
    }

    // 2. Verified? A subdomain of a domain the team already owns normally
    //    is straight away; if not, ask Vercel to check again.
    if (!projectDomain.data?.verified) {
      const verify = await vercelFetch(`/v9/projects/${project}/domains/${domain}/verify`, "POST");
      if (!verify.ok || !verify.data?.verified) {
        return { status: "pending", message: "Added to Vercel, waiting for it to verify the domain. Try again in a minute." };
      }
    }

    // 3. Does DNS actually point at Vercel? If not, the one-time wildcard
    //    record (or Vercel nameservers) is missing.
    const config = await vercelFetch(`/v6/domains/${domain}/config`);
    if (!config.ok) return apiError("check the domain's DNS", config);
    if (config.data?.misconfigured) {
      return {
        status: "pending",
        message: `Added to Vercel, but ${host} doesn't point at Vercel yet. If this is the first club, add the one-time wildcard DNS record (*.squadino.com → cname.vercel-dns.com) or switch squadino.com to Vercel's nameservers; otherwise try again in a minute.`,
      };
    }

    return { status: "ready" };
  } catch (e) {
    return { status: "error", message: `Couldn't reach Vercel: ${e instanceof Error ? e.message : "network error"}` };
  }
}

/**
 * Takes `host` off the Vercel project when its club is deleted, so the
 * address no longer lingers there. Best-effort: the club is already gone, so
 * a failure is only reported (and logged), never undone. An address that
 * isn't on the project counts as removed.
 */
export async function removeProjectDomain(host: string): Promise<"removed" | "skipped" | { error: string }> {
  if (!vercelDomainsConfigured()) return "skipped";
  const project = encodeURIComponent(process.env.CLUB_VERCEL_PROJECT_ID!);
  try {
    const res = await vercelFetch(`/v9/projects/${project}/domains/${encodeURIComponent(host)}`, "DELETE");
    if (res.ok || res.status === 404) return "removed";
    return { error: res.data?.error?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "network error" };
  }
}
