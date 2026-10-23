import { describe, it, expect } from "vitest";
import { EMAIL_PROBLEM_DAYS, emailProblemHref, emailProblemsSince } from "./emailProblems";
import { AUDIT_ACTIONS, auditActionLabel, isAuditAction, taskOptions } from "./auditLog";

describe("emails that could not be sent", () => {
  it("looks back a week", () => {
    expect(EMAIL_PROBLEM_DAYS).toBe(7);
    const now = new Date("2026-10-23T10:00:00Z");
    expect(emailProblemsSince(now).toISOString()).toBe("2026-10-16T10:00:00.000Z");
  });

  it("links to a club's page, and to nothing for a Full package request (it is on the dashboard)", () => {
    expect(emailProblemHref("club", "c1")).toBe("/clubs/c1");
    expect(emailProblemHref("signup", "s1")).toBe("/signups/s1");
    expect(emailProblemHref("request", "r1")).toBeNull();
    expect(emailProblemHref("club", null)).toBeNull();
  });

  it("is a task the Logs can show and filter on, under its own heading", () => {
    // The club app writes this exact word; if it changes there, change it here.
    expect(isAuditAction("email.failed")).toBe(true);
    expect(auditActionLabel("email.failed")).toBe("An email could not be sent");
    expect(Object.keys(AUDIT_ACTIONS)).toContain("email.failed");
    expect(taskOptions().find((g) => g.group === "Emails")?.tasks.map((t) => t.key)).toEqual(["email.failed"]);
  });
});
