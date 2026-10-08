import { describe, it, expect } from "vitest";
import {
  diffFields, formatAuditValue, auditActionLabel, searchWords, actionsMatching, escapeLike, SEARCH_MAX_WORDS, SEARCH_WORD_MAX_LENGTH,
  urlHost, slugOfHost, parseDayWord, parseDateInput, melbourneDayStart, melbourneRange, taskOptions, isAuditAction, AUDIT_ACTIONS,
} from "./auditLog";

const FIELDS = [
  { key: "name", label: "Name" },
  { key: "sports", label: "Sports" },
  { key: "phone", label: "Phone" },
  { key: "active", label: "Active" },
] as const;

describe("diffFields", () => {
  it("lists only the fields that changed, with old and new values", () => {
    const before = { name: "Berwick Lakers Basket Ball Club", sports: ["Basketball"], phone: null, active: true };
    const after = { name: "Berwick Lakers Basketball Club", sports: ["Basketball"], phone: null, active: true };
    expect(diffFields(before, after, FIELDS)).toEqual([
      { field: "name", label: "Name", from: "Berwick Lakers Basket Ball Club", to: "Berwick Lakers Basketball Club" },
    ]);
  });

  it("treats blank, null and missing as the same empty value", () => {
    expect(diffFields({ phone: null }, { phone: "" }, FIELDS)).toEqual([]);
    expect(diffFields({}, { phone: null }, FIELDS)).toEqual([]);
  });

  it("notices a list changing, including its order", () => {
    expect(diffFields({ sports: ["Basketball"] }, { sports: ["Basketball", "Netball"] }, FIELDS)).toHaveLength(1);
    expect(diffFields({ sports: ["A", "B"] }, { sports: ["B", "A"] }, FIELDS)).toHaveLength(1);
  });

  it("ignores fields it wasn't asked to compare", () => {
    expect(diffFields({ id: "1", name: "X" }, { id: "2", name: "X" }, FIELDS)).toEqual([]);
  });

  it("records a switch being turned off", () => {
    expect(diffFields({ active: true }, { active: false }, FIELDS)).toEqual([
      { field: "active", label: "Active", from: true, to: false },
    ]);
  });
});

describe("formatAuditValue", () => {
  it("shows empty values, switches and lists in plain words", () => {
    expect(formatAuditValue(null)).toBe("—");
    expect(formatAuditValue(true)).toBe("Yes");
    expect(formatAuditValue(false)).toBe("No");
    expect(formatAuditValue(["Basketball", "Netball"])).toBe("Basketball, Netball");
    expect(formatAuditValue([])).toBe("—");
    expect(formatAuditValue(200)).toBe("200");
  });

  it("shortens very long text", () => {
    const shown = formatAuditValue("x".repeat(1000));
    expect(shown.length).toBe(301);
    expect(shown.endsWith("…")).toBe(true);
  });
});

describe("auditActionLabel", () => {
  it("names known actions and passes unknown ones through", () => {
    expect(auditActionLabel("signup.edit")).toBe("Edited signup");
    expect(auditActionLabel("something.new")).toBe("something.new");
  });
});

describe("searchWords", () => {
  it("splits on spaces, lower-cases and drops repeats", () => {
    expect(searchWords("  Walkers   CYCLING walkers ")).toEqual(["walkers", "cycling"]);
  });

  it("gives nothing for an empty or non-text search", () => {
    expect(searchWords("")).toEqual([]);
    expect(searchWords("   ")).toEqual([]);
    expect(searchWords(undefined)).toEqual([]);
    expect(searchWords(42)).toEqual([]);
  });

  it("caps how many words and how long each can be", () => {
    expect(searchWords("a b c d e f g h")).toHaveLength(SEARCH_MAX_WORDS);
    expect(searchWords("x".repeat(500))[0]).toHaveLength(SEARCH_WORD_MAX_LENGTH);
  });
});

describe("actionsMatching", () => {
  it("finds actions by their wording or their code", () => {
    expect(actionsMatching("approved")).toContain("signup.approve");
    expect(actionsMatching("Approved")).toContain("request.approve");
    expect(actionsMatching("signup.reject")).toEqual(expect.arrayContaining(["signup.reject", "signup.reject_requested"]));
    expect(actionsMatching("re-instated")).toEqual(["signup.reinstate"]);
    expect(actionsMatching("pre-approved")).toContain("signup.preapprove");
  });

  it("finds nothing for a word that is not an action", () => {
    expect(actionsMatching("walkers")).toEqual([]);
  });
});

describe("escapeLike", () => {
  it("makes % _ and a backslash literal in a LIKE pattern", () => {
    expect(escapeLike("50%_off")).toBe("50\\%\\_off");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("plain")).toBe("plain");
  });
});

describe("urlHost / slugOfHost", () => {
  it("reduces a typed web address to its host", () => {
    expect(urlHost("https://www.walkerscc.squadino.com/login?x=1")).toBe("walkerscc.squadino.com");
    expect(urlHost("walkerscc.squadino.com")).toBe("walkerscc.squadino.com");
    expect(urlHost("http://localhost.test:3001/")).toBe("localhost.test");
    expect(urlHost("WalkersCC.Squadino.com")).toBe("walkerscc.squadino.com");
  });

  it("does not take names, emails or plain words for web addresses", () => {
    expect(urlHost("walkers")).toBeNull();
    expect(urlHost("jane@walkers.test")).toBeNull();
    expect(urlHost("100%")).toBeNull();
    expect(urlHost("")).toBeNull();
  });

  it("finds a club's slug from its own address only", () => {
    expect(slugOfHost("walkerscc.squadino.com", "squadino.com")).toBe("walkerscc");
    expect(slugOfHost("squadino.com", "squadino.com")).toBeNull();
    expect(slugOfHost("walkers.example.org", "squadino.com")).toBeNull();
    expect(slugOfHost("a.b.squadino.com", "squadino.com")).toBeNull();
  });
});

describe("dates", () => {
  it("reads Australian day/month/year and ISO dates, and refuses impossible ones", () => {
    expect(parseDayWord("9/10/2026")).toEqual({ y: 2026, m: 10, d: 9 });
    expect(parseDayWord("09-10-2026")).toEqual({ y: 2026, m: 10, d: 9 });
    expect(parseDayWord("9.10.2026")).toEqual({ y: 2026, m: 10, d: 9 });
    expect(parseDayWord("2026-10-09")).toEqual({ y: 2026, m: 10, d: 9 });
    expect(parseDayWord("31/2/2026")).toBeNull();
    expect(parseDayWord("2026-13-01")).toBeNull();
    expect(parseDayWord("walkers")).toBeNull();
    expect(parseDayWord("10/2026")).toBeNull();
  });

  it("reads the value of a date box", () => {
    expect(parseDateInput("2026-10-09")).toEqual({ y: 2026, m: 10, d: 9 });
    expect(parseDateInput("2026-02-30")).toBeNull();
    expect(parseDateInput("")).toBeNull();
    expect(parseDateInput(undefined)).toBeNull();
  });

  it("starts a Melbourne day at its real midnight, in summer and winter time", () => {
    expect(melbourneDayStart({ y: 2026, m: 10, d: 9 }).toISOString()).toBe("2026-10-08T13:00:00.000Z"); // +11
    expect(melbourneDayStart({ y: 2026, m: 7, d: 1 }).toISOString()).toBe("2026-06-30T14:00:00.000Z"); // +10
  });

  it("copes with the days the clocks change", () => {
    // Daylight saving starts 2am on Sunday 4 Oct 2026: that day is only 23 hours long.
    expect(melbourneDayStart({ y: 2026, m: 10, d: 4 }).toISOString()).toBe("2026-10-03T14:00:00.000Z");
    expect(melbourneDayStart({ y: 2026, m: 10, d: 5 }).toISOString()).toBe("2026-10-04T13:00:00.000Z");
    // And it ends 3am on Sunday 5 Apr 2026: that day is 25 hours long.
    expect(melbourneDayStart({ y: 2026, m: 4, d: 5 }).toISOString()).toBe("2026-04-04T13:00:00.000Z");
    expect(melbourneDayStart({ y: 2026, m: 4, d: 6 }).toISOString()).toBe("2026-04-05T14:00:00.000Z");
  });

  it("makes a range that includes the whole of the last day", () => {
    const one = { y: 2026, m: 10, d: 9 };
    expect(melbourneRange(one, one)).toEqual({ gte: new Date("2026-10-08T13:00:00.000Z"), lt: new Date("2026-10-09T13:00:00.000Z") });
    expect(melbourneRange({ y: 2026, m: 9, d: 30 }, { y: 2026, m: 9, d: 30 }).lt).toEqual(new Date("2026-09-30T14:00:00.000Z"));
    expect(melbourneRange(one, null)).toEqual({ gte: new Date("2026-10-08T13:00:00.000Z") });
    expect(melbourneRange(null, null)).toEqual({});
  });
});

describe("tasks", () => {
  it("groups every task once for the filter", () => {
    const groups = taskOptions();
    const keys = groups.flatMap((g) => g.tasks.map((t) => t.key));
    expect(keys.sort()).toEqual(Object.keys(AUDIT_ACTIONS).sort());
    expect(groups.map((g) => g.group)).toEqual(expect.arrayContaining(["Signups", "Billing and account hold"]));
    expect(groups.find((g) => g.group === "Signups")?.tasks.map((t) => t.key)).toContain("signup.approve");
  });

  it("only accepts a real task", () => {
    expect(isAuditAction("club.setup_email")).toBe(true);
    expect(isAuditAction("club.delete_everything")).toBe(false);
    expect(isAuditAction(undefined)).toBe(false);
  });
});
