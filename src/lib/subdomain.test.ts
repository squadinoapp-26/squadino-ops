import { describe, it, expect } from "vitest";
import { normaliseSubdomain, subdomainProblem, slugify, isValidSlug } from "./subdomain";

describe("normaliseSubdomain", () => {
  it("tidies what an admin types into a web address", () => {
    expect(normaliseSubdomain("Berwick Lakers")).toBe("berwick-lakers");
    expect(normaliseSubdomain("  BerwickLakers  ")).toBe("berwicklakers");
    expect(normaliseSubdomain("berwick__lakers!!")).toBe("berwick-lakers");
    expect(normaliseSubdomain("-berwick-")).toBe("berwick");
  });

  it("keeps just the first part of a pasted address", () => {
    expect(normaliseSubdomain("berwick.squadino.com")).toBe("berwick");
    expect(normaliseSubdomain("https://berwick.squadino.com/dashboard")).toBe("berwick");
  });

  it("returns nothing when nothing usable is left", () => {
    expect(normaliseSubdomain("   ")).toBe("");
    expect(normaliseSubdomain("!!!")).toBe("");
  });
});

describe("subdomainProblem", () => {
  it("accepts a normal short address", () => {
    expect(subdomainProblem("berwicklakers")).toBeNull();
    expect(subdomainProblem("berwick-lakers-2")).toBeNull();
  });

  it("refuses empty, reserved and over-long addresses", () => {
    expect(subdomainProblem("")).toMatch(/Enter a web address/);
    expect(subdomainProblem("app")).toMatch(/reserved/);
    expect(subdomainProblem("platform")).toMatch(/reserved/);
    expect(subdomainProblem("a".repeat(64))).toMatch(/up to 63/);
  });
});

describe("slugify", () => {
  it("turns a club name into its default address, as before", () => {
    expect(slugify("Berwick Lakers Basketball Club")).toBe("berwick-lakers-basketball-club");
    expect(slugify("東京")).toBe("club");
    expect(isValidSlug(slugify("Berwick Lakers Basketball Club"))).toBe(true);
  });
});
