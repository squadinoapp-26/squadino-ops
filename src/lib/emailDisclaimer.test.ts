import { describe, it, expect } from "vitest";
import { EMAIL_DISCLAIMER, withDisclaimer } from "./emailDisclaimer";

describe("withDisclaimer", () => {
  it("adds the notice to the plain text and the html, keeping the rest", () => {
    const out = withDisclaimer({ to: "a@b.com", subject: "Hi", text: "Hello", html: "<p>Hello</p>" });
    expect(out.text.startsWith("Hello")).toBe(true);
    expect(out.text.endsWith(EMAIL_DISCLAIMER)).toBe(true);
    expect(out.html?.startsWith("<p>Hello</p>")).toBe(true);
    expect(out.html).toContain(EMAIL_DISCLAIMER);
    expect(out.to).toBe("a@b.com");
  });

  it("does not invent an html part for a text-only email", () => {
    expect(withDisclaimer<{ text: string; html?: string }>({ text: "Hello" }).html).toBeUndefined();
  });
});
