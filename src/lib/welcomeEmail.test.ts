import { describe, it, expect } from "vitest";
import { welcomeEmail } from "./email";

// This function is copied between the club app and ops: keep this test file identical in both.
const links = {
  signInUrl: "https://otters.squadino.com/login",
  inviteUrl: "https://otters.squadino.com/register?code=OTTERS",
  email: "owner@example.com",
};

describe("welcomeEmail", () => {
  it("has the three steps in order: password, sign in, set up", () => {
    const { text } = welcomeEmail("https://x.test/reset-password?token=t", "Otters", 60, links);
    const step1 = text.indexOf("STEP 1: Set your password");
    const step2 = text.indexOf("STEP 2: Sign in");
    const step3 = text.indexOf("STEP 3: Set up your club");
    expect(step1).toBeGreaterThan(-1);
    expect(step2).toBeGreaterThan(step1);
    expect(step3).toBeGreaterThan(step2);
  });

  it("gives the set-password link and how long it works", () => {
    const { text, html } = welcomeEmail("https://x.test/reset-password?token=t", "Otters", 60, links);
    expect(text).toContain("https://x.test/reset-password?token=t");
    expect(text).toContain("expires in 60 minutes");
    expect(html).toContain('href="https://x.test/reset-password?token=t"');
  });

  it("says where to sign in and with which email", () => {
    const { text, html } = welcomeEmail("https://x.test/r", "Otters", 60, links);
    expect(text).toContain("Go to https://otters.squadino.com/login and sign in with owner@example.com");
    expect(html).toContain("<strong>owner@example.com</strong>");
  });

  it("gives the club tips and the join link", () => {
    const { text, html } = welcomeEmail("https://x.test/r", "Otters", 60, links);
    for (const tip of ["Add your logo", "Create your first team", "Schedule your first event", "Post a welcome on the Wall", "Invite your members"]) {
      expect(text).toContain(tip);
      expect(html).toContain(tip);
    }
    expect(text).toContain("https://otters.squadino.com/register?code=OTTERS");
    expect(text).toContain("You approve each person before they get in.");
    expect(text).toContain("Import from Excel / CSV");
    expect(text).toContain('"Get your club set up" checklist');
  });

  it("gives a Coach-plan owner the coach tips", () => {
    const { text } = welcomeEmail("https://x.test/r", "Coach Co", 60, { ...links, coach: true });
    expect(text).toContain("STEP 3: Set up your business");
    expect(text).toContain("Put up your first session");
    expect(text).toContain("Invite your clients");
    expect(text).not.toContain("Create your first team");
    expect(text).toContain('"Get your coaching set up" checklist');
  });

  it("still works with no links (clubs made by hand in ops)", () => {
    const { text, html } = welcomeEmail("https://x.test/r", "Otters", 60);
    expect(text).toContain("Go to the SQUADINO sign-in page");
    expect(text).toContain("Share your join link (it's on your dashboard)");
    expect(html).toContain("Set your password");
  });

  it("escapes the club name and addresses in the HTML part", () => {
    const { html } = welcomeEmail("https://x.test/r?a=1&b=2", `<script>x</script>`, 60, { ...links, email: `a"b@example.com` });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a&quot;b@example.com");
    expect(html).toContain("https://x.test/r?a=1&amp;b=2");
  });
});
