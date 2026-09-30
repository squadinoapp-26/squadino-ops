// Shared host-header parsing for the subdomain-per-club feature — used by
// both proxy.ts (routing) and the login routes (credential scoping), so the
// two can never disagree about what a given request's hostname means.

// The apex domain clubs live under, e.g. "wantirnatc.squadino.com". Only
// ever changed via env for local/testing use (see hosts-file testing in the
// implementation plan) — production always uses squadino.com.
export const ROOT_DOMAIN = process.env.ROOT_DOMAIN || "squadino.com";

// Where to send anyone whose hostname doesn't (yet) resolve to a real,
// ready club — the club-agnostic shell's login/chooser.
export function shellLoginUrl(): string {
  return `https://app.${ROOT_DOMAIN}/login`;
}

export function clubSubdomainUrl(slug: string, path = "/dashboard"): string {
  return `https://${slug}.${ROOT_DOMAIN}${path}`;
}

export interface HostInfo {
  // true when this request should be treated as the club-agnostic shell
  // (app.squadino.com, localhost, *.vercel.app previews) — no
  // hostname-derived club binding at all, existing behavior applies.
  isShell: boolean;
  // The slug this request's hostname claims to be, if it's a club subdomain
  // (e.g. "wantirnatc" for wantirnatc.squadino.com). Null on the shell.
  slug: string | null;
}

function bareHost(host: string): string {
  return host.split(":")[0].toLowerCase();
}

export function resolveHost(hostHeader: string | null): HostInfo {
  const host = bareHost(hostHeader ?? "");

  if (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".vercel.app") ||
    host === `app.${ROOT_DOMAIN}`
  ) {
    return { isShell: true, slug: null };
  }

  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const slug = host.slice(0, -(ROOT_DOMAIN.length + 1));
    return { isShell: false, slug: slug || null };
  }

  // Any other hostname (a club's own custom domain, or something
  // unrecognized) isn't a squadino.com club subdomain at all — callers that
  // care about custom domains look those up separately by exact hostname.
  return { isShell: false, slug: null };
}
