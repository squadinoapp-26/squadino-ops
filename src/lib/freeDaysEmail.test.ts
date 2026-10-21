import { describe, it, expect } from "vitest";
import { effectSentence, freeDaysEmail, type FreeDaysEmailInput } from "./freeDaysEmail";

const base: FreeDaysEmailInput = {
  clubName: "Otters FC",
  recipientName: "Sam Lee",
  title: "Service interruption on 3 November",
  whatHappened: "Our database provider had an outage.\n\nThe app could not load for about 6 hours.",
  whatWeAreDoing: "We have moved to a second region and added an alert.",
  dates: ["2026-11-03", "2026-11-04"],
  effect: "STRIPE",
  oldDateText: "14 November 2026",
  newDateText: "16 November 2026",
};

describe("freeDaysEmail", () => {
  it("tells the customer what happened, what is being done, and how they are compensated", () => {
    const m = freeDaysEmail(base);
    expect(m.subject).toBe("Service interruption on 3 November: free days for Otters FC");
    expect(m.replyTo).toBe("hello@squadino.com");
    expect(m.text).toContain("Hi Sam,");
    expect(m.text).toContain("What happened\nOur database provider had an outage.");
    expect(m.text).toContain("What we're doing about it\nWe have moved to a second region");
    expect(m.text).toContain("We're giving Otters FC 2 days of SQUADINO free of charge: 3 to 4 November 2026.");
    expect(m.text).toContain("Your next payment has moved from 14 November 2026 to 16 November 2026.");
    expect(m.text).toContain("hello@squadino.com");
  });

  it("says the right thing about money for each kind of club", () => {
    expect(effectSentence({ effect: "STRIPE", oldDateText: "14 November 2026", newDateText: "16 November 2026" })).toMatch(/next payment has moved from 14 November 2026 to 16 November 2026/);
    expect(effectSentence({ effect: "STRIPE", newDateText: "16 November 2026" })).toMatch(/next payment now falls on 16 November 2026/);
    expect(effectSentence({ effect: "TRIAL", oldDateText: "30 October 2026", newDateText: "2 November 2026" })).toMatch(/trial now ends on 2 November 2026 instead of 30 October 2026/);
    expect(effectSentence({ effect: "NONE" })).toMatch(/don't have a payment coming up/);
    // No date to show: never print "undefined" or an empty sentence.
    expect(effectSentence({ effect: "STRIPE" })).not.toMatch(/undefined|null/);
  });

  it("uses a plain hello without a name, and one day in the singular", () => {
    const m = freeDaysEmail({ ...base, recipientName: null, dates: ["2026-11-03"] });
    expect(m.text.startsWith("Hello,")).toBe(true);
    expect(m.text).toContain("1 day of SQUADINO");
    expect(m.html ?? "").toContain("Hello,");
  });

  it("adds the extra note only when there is one", () => {
    expect(freeDaysEmail(base).text).not.toContain("Thank you for staying");
    const m = freeDaysEmail({ ...base, extraNote: "Thank you for staying with us." });
    expect(m.text).toContain("Thank you for staying with us.");
    expect(m.html ?? "").toContain("Thank you for staying with us.");
  });

  it("escapes what staff typed, and keeps their paragraphs", () => {
    const m = freeDaysEmail({ ...base, clubName: "A&B <Club>", whatHappened: "Line one\n\nLine <b>two</b> & more" });
    expect(m.html ?? "").not.toContain("<b>two</b>");
    const html = m.html ?? "";
    expect(html).toContain("Line &lt;b&gt;two&lt;/b&gt; &amp; more");
    expect(html).toContain("A&amp;B &lt;Club&gt;");
    expect(html.match(/What happened/g)?.length).toBe(1);
    expect((html.match(/<p style="color:#475569;line-height:1.5;margin:0 0 10px">Line/g) ?? []).length).toBe(2);
  });
});
