"use client";

// A plain <form action="/api/logout"> navigates the browser to whatever that
// route returns — and it returns JSON, not a redirect, so that approach left
// people staring at a raw {"ok":true} page with no way back. This does the
// POST client-side and then drives the redirect itself, same pattern as
// squadino's own Navbar sign-out.
export default function SignOutButton({ className }: { className?: string }) {
  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button onClick={handleLogout} className={className}>
      Sign Out
    </button>
  );
}
