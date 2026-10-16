import { describe, it, expect } from "vitest";
import { clubPlanLabels, filterClubAccounts } from "./clubAccounts";

const clubs = [
  { name: "Monbulk Swimming Club", code: "MONBULK", slug: "monbulk", customDomain: "monbulkmarlins.com.au", active: true, subdomainReady: true },
  { name: "Belgrave Panthers", code: "BELGRAVE", slug: "belgrave-panthers", customDomain: null, active: true, subdomainReady: false },
  { name: "Old Timers FC", code: "OLDTIMER", slug: "oldtimers", customDomain: null, active: false, subdomainReady: false },
];
const names = (list: typeof clubs) => list.map((c) => c.name);

describe("filterClubAccounts", () => {
  it("searches name, code, web address and own domain, ignoring capitals", () => {
    expect(names(filterClubAccounts(clubs, "panthers", "all"))).toEqual(["Belgrave Panthers"]);
    expect(names(filterClubAccounts(clubs, "OLDTIMER", "all"))).toEqual(["Old Timers FC"]);
    expect(names(filterClubAccounts(clubs, "marlins", "all"))).toEqual(["Monbulk Swimming Club"]);
    expect(filterClubAccounts(clubs, "  ", "all")).toHaveLength(3);
  });

  it("filters by status", () => {
    expect(names(filterClubAccounts(clubs, "", "active"))).toEqual(["Monbulk Swimming Club", "Belgrave Panthers"]);
    expect(names(filterClubAccounts(clubs, "", "inactive"))).toEqual(["Old Timers FC"]);
    expect(names(filterClubAccounts(clubs, "", "notlive"))).toEqual(["Belgrave Panthers"]);
  });
});

describe("clubPlanLabels", () => {
  it("names the package a club is on", () => {
    const l = clubPlanLabels({ package: { name: "Growth" }, userCapOverride: null });
    expect(l.packageLabel).toBe("Package: Growth");
    expect(l.packageTone).toBe("ok");
    expect(l.overrideLabel).toBeNull();
    expect(l.packageHint).toBe("");
  });

  it("shows the user limit override next to the package, with thousands separated", () => {
    const l = clubPlanLabels({ package: { name: "Full" }, userCapOverride: 1250 });
    expect(l.packageLabel).toBe("Package: Full");
    expect(l.overrideLabel).toBe("User limit override: 1,250");
    expect(clubPlanLabels({ package: { name: "Starter" }, userCapOverride: 75 }).overrideLabel).toBe("User limit override: 75");
    expect(clubPlanLabels({ package: { name: "Full" }, userCapOverride: 1000000 }).overrideLabel).toBe("User limit override: 1,000,000");
  });

  it("calls out a club with no package and no override: it can't add members", () => {
    const l = clubPlanLabels({ package: null, userCapOverride: null });
    expect(l.packageLabel).toBe("No package (can't add members)");
    expect(l.packageTone).toBe("warn");
    expect(l.packageHint).toMatch(/can't add any new members/);
    expect(l.overrideLabel).toBeNull();
  });

  it("does not raise the alarm for a club with an override but no package (it can still add members)", () => {
    const l = clubPlanLabels({ package: null, userCapOverride: 500 });
    expect(l.packageLabel).toBe("No package");
    expect(l.packageTone).toBe("none");
    expect(l.packageHint).toBe("");
    expect(l.overrideLabel).toBe("User limit override: 500");
  });

  it("shows an override of 0 rather than hiding it", () => {
    expect(clubPlanLabels({ package: { name: "Starter" }, userCapOverride: 0 }).overrideLabel).toBe("User limit override: 0");
  });
});
