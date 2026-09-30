import { describe, it, expect } from "vitest";
import { parseNewStaff, staffChangeProblem } from "./platformStaff";

describe("parseNewStaff", () => {
  const good = { name: " Mia Moderator ", email: " Mia@Example.com ", role: "MODERATOR", password: "correct-horse-battery" };

  it("accepts a person and tidies their details", () => {
    expect(parseNewStaff(good)).toEqual({
      ok: true,
      data: { name: "Mia Moderator", email: "mia@example.com", role: "MODERATOR", password: "correct-horse-battery" },
    });
  });

  it("refuses a missing name, bad email, unknown role or short password", () => {
    expect(parseNewStaff({ ...good, name: " " }).ok).toBe(false);
    expect(parseNewStaff({ ...good, email: "mia@example" }).ok).toBe(false);
    expect(parseNewStaff({ ...good, role: "OWNER" }).ok).toBe(false);
    expect(parseNewStaff({ ...good, password: "short" })).toEqual({ ok: false, error: "Password must be at least 12 characters" });
  });
});

describe("staffChangeProblem", () => {
  const superA = { id: "a", role: "SUPER_ADMIN" as const, active: true };
  const mod = { id: "m", role: "MODERATOR" as const, active: true };

  it("lets a super admin change someone else", () => {
    expect(staffChangeProblem({ actorId: "a", target: mod, next: { role: "ADMIN", active: true }, activeSuperAdmins: 1 })).toBeNull();
    expect(staffChangeProblem({ actorId: "a", target: mod, next: { role: "MODERATOR", active: false }, activeSuperAdmins: 1 })).toBeNull();
  });

  it("stops people demoting or switching off themselves", () => {
    expect(staffChangeProblem({ actorId: "a", target: superA, next: { role: "SUPER_ADMIN", active: false }, activeSuperAdmins: 3 })).toMatch(/your own account/);
    expect(staffChangeProblem({ actorId: "a", target: superA, next: { role: "ADMIN", active: true }, activeSuperAdmins: 3 })).toMatch(/your own role/);
  });

  it("keeps at least one active super admin", () => {
    const otherSuper = { id: "b", role: "SUPER_ADMIN" as const, active: true };
    expect(staffChangeProblem({ actorId: "a", target: otherSuper, next: { role: "ADMIN", active: true }, activeSuperAdmins: 1 })).toMatch(/at least one active super admin/);
    expect(staffChangeProblem({ actorId: "a", target: otherSuper, next: { role: "ADMIN", active: true }, activeSuperAdmins: 2 })).toBeNull();
  });
});
