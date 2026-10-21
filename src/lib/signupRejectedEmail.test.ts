import { describe, it, expect } from "vitest";
import { signupRejectedEmail } from "./signupRejectedEmail";

// Owner's rule (2026-10-18), the same one the club app's customerWording test enforces: nothing a customer reads says a person
// approved, checked or reviewed their request, or that they must wait for one.
const FORBIDDEN = /approv|being checked|checked by|checks your|reviewed|waiting for|is decided|been decided/i;

describe("signupRejectedEmail", () => {
  const base = { clubName: "Otters FC", contactName: "Sam Lee" };

  it("says plainly that we can't set the account up, and how to talk it through", () => {
    const m = signupRejectedEmail(base);
    expect(m.subject).toBe("Your SQUADINO signup for Otters FC");
    expect(m.replyTo).toBe("hello@squadino.com");
    expect(m.text).toBe(
      [
        "Hi Sam,",
        "",
        "Thanks for your interest in SQUADINO for Otters FC.",
        "",
        "Unfortunately we aren't able to set up an account for you.",
        "",
        "If you'd like to talk it through, reply to this email or write to hello@squadino.com.",
      ].join("\n"),
    );
  });

  it("adds the admin's message for the customer, as typed, and only that", () => {
    const m = signupRejectedEmail({ ...base, message: "We've cancelled the card you entered, so nothing will be taken.\n\nSorry for the trouble." });
    expect(m.text).toContain("Unfortunately we aren't able to set up an account for you.\n\nWe've cancelled the card you entered, so nothing will be taken.\n\nSorry for the trouble.\n\nIf you'd like to talk it through");
    expect(m.html ?? "").toContain("nothing will be taken.");
  });

  it("leaves out an empty or blank message, and greets without a name", () => {
    expect(signupRejectedEmail({ ...base, message: "   " }).text).not.toContain("\n\n\n");
    expect(signupRejectedEmail({ ...base, contactName: "  " }).text.startsWith("Hello,")).toBe(true);
  });

  it("escapes what was typed into the page version", () => {
    const m = signupRejectedEmail({ clubName: "A&B <Club>", contactName: "Sam", message: "Line <b>one</b> & more" });
    expect(m.html ?? "").toContain("A&amp;B &lt;Club&gt;");
    expect(m.html ?? "").toContain("Line &lt;b&gt;one&lt;/b&gt; &amp; more");
    expect(m.html ?? "").not.toContain("<b>one</b>");
  });

  it("reads as automatic: no mention of anyone approving, checking or reviewing", () => {
    for (const m of [signupRejectedEmail(base), signupRejectedEmail({ ...base, message: "Thanks for understanding." })]) {
      expect(m.text).not.toMatch(FORBIDDEN);
      expect(m.html ?? "").not.toMatch(FORBIDDEN);
      expect(m.subject).not.toMatch(FORBIDDEN);
    }
  });
});
