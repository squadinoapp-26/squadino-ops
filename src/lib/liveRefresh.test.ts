import { describe, it, expect } from "vitest";
import { IDLE_STOP_MS, POLL_MS, decideRefresh, isAuthPage, isTypingTarget, shouldPoll } from "./liveRefresh";

describe("decideRefresh", () => {
  it("remembers the first answer, and reads the page once more right after it unless the person is typing (the page was drawn just before that answer)", () => {
    expect(decideRefresh({ known: null, latest: "a", busy: false })).toBe("baseline-refresh");
    expect(decideRefresh({ known: null, latest: "a", busy: true })).toBe("baseline");
  });

  it("does nothing while nothing has changed", () => {
    expect(decideRefresh({ known: "a", latest: "a", busy: false })).toBe("none");
    expect(decideRefresh({ known: "a", latest: "a", busy: true })).toBe("none");
  });

  it("re-reads the page quietly when something changed and the person is not typing", () => {
    expect(decideRefresh({ known: "a", latest: "b", busy: false })).toBe("refresh");
  });

  it("shows the bar instead when the person is typing", () => {
    expect(decideRefresh({ known: "a", latest: "b", busy: true })).toBe("banner");
  });
});

describe("shouldPoll", () => {
  it("asks while the tab is visible and the person is around", () => {
    expect(shouldPoll({ visible: true, idleMs: 0 })).toBe(true);
    expect(shouldPoll({ visible: true, idleMs: IDLE_STOP_MS - 1 })).toBe(true);
  });

  it("stops for a hidden tab or after a long idle time", () => {
    expect(shouldPoll({ visible: false, idleMs: 0 })).toBe(false);
    expect(shouldPoll({ visible: true, idleMs: IDLE_STOP_MS })).toBe(false);
  });

  it("asks every 20 seconds and gives up after 15 minutes of nobody there", () => {
    expect(POLL_MS).toBe(20_000);
    expect(IDLE_STOP_MS).toBe(15 * 60_000);
  });
});

describe("isTypingTarget", () => {
  it("counts text boxes, areas, drop-downs and editable text as typing", () => {
    expect(isTypingTarget({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT" })).toBe(true);
    expect(isTypingTarget({ tagName: "input", type: "search" })).toBe(true);
    expect(isTypingTarget({ tagName: "INPUT", type: "date" })).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT" })).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("does not count buttons, ticks, links or nothing at all", () => {
    for (const type of ["button", "submit", "checkbox", "radio", "file"]) expect(isTypingTarget({ tagName: "INPUT", type })).toBe(false);
    expect(isTypingTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTypingTarget({ tagName: "A" })).toBe(false);
    expect(isTypingTarget({ tagName: "BODY" })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(undefined)).toBe(false);
  });

  it("ignores boxes that can't be typed in", () => {
    expect(isTypingTarget({ tagName: "INPUT", type: "text", readOnly: true })).toBe(false);
    expect(isTypingTarget({ tagName: "TEXTAREA", disabled: true })).toBe(false);
  });
});

describe("isAuthPage", () => {
  it("recognises the sign-in pages, which never ask", () => {
    for (const p of ["/login", "/forgot-password", "/reset-password", "/reset-password/abc"]) expect(isAuthPage(p)).toBe(true);
    for (const p of ["/", "/approvals", "/signups/s1", "/logs", "/loginx"]) expect(isAuthPage(p)).toBe(false);
  });
});
