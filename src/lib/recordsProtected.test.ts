import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

// The review trail (who approved or rejected a signup, and why) must last for good. Nothing in this app may delete or
// change the Logs, the signup requests, the change requests or the portal users. If one of these tests fails, someone
// added a way to remove or rewrite a record: take it out, don't change the test.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "generated" || name === "node_modules") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(join(process.cwd(), "src")).map((path) => ({ path, text: readFileSync(path, "utf8") }));

function offenders(pattern: RegExp): string[] {
  return files.filter((f) => pattern.test(f.text)).map((f) => f.path.replace(process.cwd(), ""));
}

describe("records that must be kept", () => {
  it("has source files to check", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("never deletes or edits a Logs entry", () => {
    expect(offenders(/platformAuditLog\s*\.\s*(delete|deleteMany|update|updateMany|upsert)\b/)).toEqual([]);
  });

  it("never deletes a signup request, a change request or a portal user", () => {
    expect(offenders(/\b(signupRequest|changeRequest|platformUser)\s*\.\s*(delete|deleteMany)\b/)).toEqual([]);
  });

  it("never removes these records with raw SQL", () => {
    expect(
      offenders(/(DELETE\s+FROM|TRUNCATE|DROP\s+TABLE)[^;`'"]*\b(platform_audit_logs|signup_requests|change_requests|platform_users)\b/i),
    ).toEqual([]);
  });
});
