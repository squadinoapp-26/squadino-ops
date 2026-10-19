import { describe, it, expect } from "vitest";
import { normaliseSubdomain, subdomainProblem, slugify, isValidSlug, suggestSubdomains } from "./subdomain";

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

describe("suggestSubdomains", () => {
  const slugs = (name: string) => suggestSubdomains(name).map((s) => s.slug);

  it("offers the initials first for a club of three or more words", () => {
    expect(slugs("Clayton Cricket Club")).toEqual(["ccc", "claytoncc", "clayton-cricket-club"]);
    expect(slugs("Monbulk Motorcycle Sporting Club")).toEqual(["mmsc", "monbulkmsc", "monbulk-motorcycle-sporting-club"]);
  });

  it("gives the first word plus initials, the pattern live clubs already use", () => {
    expect(slugs("Walkers Cycling Club")).toContain("walkerscc");
    expect(slugs("Wantirna Tennis Club")).toContain("wantirnatc");
  });

  it("leaves out words like the, of and and, and ignores punctuation and accents", () => {
    expect(slugs("The Walkers Cycling Club")[0]).toBe("wcc");
    expect(slugs("Smith & Sons Cricket Club")[0]).toBe("sscc");
    expect(slugs("Club of the Year")[0]).toBe("clubyear");
    expect(slugs("Ünited Brunswick Sports Club")[0]).toBe("ubsc");
  });

  it("joins up a two-word name and offers the whole name last", () => {
    expect(slugs("Berwick Lakers")).toEqual(["berwicklakers", "berwick-lakers"]);
  });

  it("offers just the name when there is one word", () => {
    expect(slugs("Berwick")).toEqual(["berwick"]);
  });

  it("never offers a reserved or unusable address, or the same one twice", () => {
    expect(slugs("App")).toEqual([]);
    for (const name of ["Clayton Cricket Club", "Berwick Lakers", "A B C", "!!! ???"]) {
      const list = slugs(name);
      expect(new Set(list).size).toBe(list.length);
      for (const s of list) expect(isValidSlug(s)).toBe(true);
    }
  });

  it("labels each choice in plain words", () => {
    expect(suggestSubdomains("Clayton Cricket Club").map((s) => s.label)).toEqual(["Initials", "First word + initials", "Full name"]);
  });
});
