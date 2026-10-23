// Keeps the ops screens fresh without anyone pressing reload. The page asks a tiny question every so often ("has anything changed in
// the console?"), and only when the answer changes does it re-read the page. Pure rules only (no browser, no database), so they are
// unit-tested; the browser side is src/components/LiveRefresh.tsx and the question is answered by src/lib/liveVersion.server.ts.

/** How often a visible tab asks. */
export const POLL_MS = 20_000;

/** After this long with no mouse, key or touch, the tab stops asking (so a screen left open overnight does not keep the database awake). */
export const IDLE_STOP_MS = 15 * 60_000;

export type RefreshAction = "none" | "baseline" | "baseline-refresh" | "refresh" | "banner";

/**
 * What to do when the console's version comes back.
 * - The first answer on a page becomes the starting point. The page itself was drawn a moment BEFORE that answer, so a change that
 *   landed in between would be missed for good; reading the page once more right after (when nobody is typing) closes that gap.
 * - A changed answer re-reads the page quietly, unless the person is typing (then a "new changes" bar is shown instead, so nothing
 *   moves under their hands).
 */
export function decideRefresh(input: { known: string | null; latest: string; busy: boolean }): RefreshAction {
  if (input.known === null) return input.busy ? "baseline" : "baseline-refresh";
  if (input.known === input.latest) return "none";
  return input.busy ? "banner" : "refresh";
}

/** A hidden tab, or one nobody has touched for a long time, does not ask. */
export function shouldPoll(input: { visible: boolean; idleMs: number }): boolean {
  return input.visible && input.idleMs < IDLE_STOP_MS;
}

// Inputs where a refresh could surprise the person: anything you type or choose in, but not plain buttons and ticks.
const NOT_TYPING_INPUTS = new Set(["button", "submit", "reset", "checkbox", "radio", "range", "color", "file", "image"]);

export interface FocusedElementLike {
  tagName?: string;
  type?: string;
  isContentEditable?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
}

/** True when the focused element is one the person is typing or choosing in. */
export function isTypingTarget(el: FocusedElementLike | null | undefined): boolean {
  if (!el || el.disabled) return false;
  if (el.isContentEditable) return true;
  const tag = (el.tagName ?? "").toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return !el.readOnly;
  if (tag === "INPUT") return !el.readOnly && !NOT_TYPING_INPUTS.has((el.type ?? "text").toLowerCase());
  return false;
}

/** The pages that are not part of the signed-in console, where nothing should be asked. */
const AUTH_PAGES = ["/login", "/forgot-password", "/reset-password"];

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
