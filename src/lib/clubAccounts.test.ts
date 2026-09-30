import { describe, it, expect } from "vitest";
import { filterClubAccounts } from "./clubAccounts";

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
