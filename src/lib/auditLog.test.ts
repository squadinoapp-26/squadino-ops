import { describe, it, expect } from "vitest";
import { diffFields, formatAuditValue, auditActionLabel } from "./auditLog";

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
