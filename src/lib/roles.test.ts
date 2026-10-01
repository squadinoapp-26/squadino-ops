import { describe, it, expect } from "vitest";
import { canApproveChanges, canManagePackages, canReviewSignups, canManageSportsList, canEditSignups, canViewLogs, canManageClubStatus, canManageRestrictedWords, canManageStaff } from "./auth";

describe("canReviewSignups", () => {
  it("lets everyone who can sign in approve signups and set clubs up (everyday work)", () => {
    expect(canReviewSignups("SUPER_ADMIN")).toBe(true);
    expect(canReviewSignups("ADMIN")).toBe(true);
    expect(canReviewSignups("MODERATOR")).toBe(true);
    expect(canReviewSignups("CUSTOMER_CARE")).toBe(true);
  });

  it("refuses when nobody is signed in", () => {
    expect(canReviewSignups(null)).toBe(false);
    expect(canReviewSignups(undefined)).toBe(false);
  });
});

describe("canManageSportsList", () => {
  it("is limited to super admins and admins", () => {
    expect(canManageSportsList("SUPER_ADMIN")).toBe(true);
    expect(canManageSportsList("ADMIN")).toBe(true);
    expect(canManageSportsList("MODERATOR")).toBe(false);
    expect(canManageSportsList("CUSTOMER_CARE")).toBe(false);
    expect(canManageSportsList(null)).toBe(false);
  });
});

describe("canEditSignups", () => {
  it("lets super admins and admins correct a signup, not moderators or customer care", () => {
    expect(canEditSignups("SUPER_ADMIN")).toBe(true);
    expect(canEditSignups("ADMIN")).toBe(true);
    expect(canEditSignups("MODERATOR")).toBe(false);
    expect(canEditSignups("CUSTOMER_CARE")).toBe(false);
    expect(canEditSignups(null)).toBe(false);
  });
});

describe("canViewLogs", () => {
  it("is limited to super admins and admins", () => {
    expect(canViewLogs("SUPER_ADMIN")).toBe(true);
    expect(canViewLogs("ADMIN")).toBe(true);
    expect(canViewLogs("MODERATOR")).toBe(false);
    expect(canViewLogs("CUSTOMER_CARE")).toBe(false);
    expect(canViewLogs(undefined)).toBe(false);
  });
});

describe("canManageClubStatus", () => {
  it("lets only super admins and admins deactivate, reactivate or delete clubs", () => {
    expect(canManageClubStatus("SUPER_ADMIN")).toBe(true);
    expect(canManageClubStatus("ADMIN")).toBe(true);
    expect(canManageClubStatus("MODERATOR")).toBe(false);
    expect(canManageClubStatus("CUSTOMER_CARE")).toBe(false);
    expect(canManageClubStatus(null)).toBe(false);
  });
});

describe("canManageRestrictedWords", () => {
  it("lets only super admins and admins edit the restricted-words list", () => {
    expect(canManageRestrictedWords("SUPER_ADMIN")).toBe(true);
    expect(canManageRestrictedWords("ADMIN")).toBe(true);
    expect(canManageRestrictedWords("MODERATOR")).toBe(false);
    expect(canManageRestrictedWords("CUSTOMER_CARE")).toBe(false);
    expect(canManageRestrictedWords(null)).toBe(false);
  });
});

describe("canManageStaff", () => {
  it("lets only super admins change portal users", () => {
    expect(canManageStaff("SUPER_ADMIN")).toBe(true);
    expect(canManageStaff("ADMIN")).toBe(false);
    expect(canManageStaff("CUSTOMER_CARE")).toBe(false);
  });
});

describe("canApproveChanges / canManagePackages", () => {
  it("lets only super admins and admins make or approve plan, billing and package changes", () => {
    for (const fn of [canApproveChanges, canManagePackages]) {
      expect(fn("SUPER_ADMIN")).toBe(true);
      expect(fn("ADMIN")).toBe(true);
      expect(fn("MODERATOR")).toBe(false);
      expect(fn("CUSTOMER_CARE")).toBe(false);
    }
  });

  it("refuses when nobody is signed in", () => {
    expect(canApproveChanges(null)).toBe(false);
    expect(canApproveChanges(undefined)).toBe(false);
  });
});
