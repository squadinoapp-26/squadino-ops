import { describe, it, expect } from "vitest";
import { OFFER_VALID_DAYS, isOfferKind, isValidChoice, offerExpiry, offerState, offerStatusLabel } from "./holdOffers";

const now = new Date("2026-10-05T00:00:00Z");
const later = new Date("2026-10-10T00:00:00Z");
const earlier = new Date("2026-10-01T00:00:00Z");

describe("isValidChoice / isOfferKind", () => {
  it("allows only the answers that fit the kind of offer", () => {
    expect(isValidChoice("START", "accept")).toBe(true);
    expect(isValidChoice("START", "decline")).toBe(true);
    expect(isValidChoice("START", "end")).toBe(false);
    expect(isValidChoice("END", "continue")).toBe(true);
    expect(isValidChoice("END", "end")).toBe(true);
    expect(isValidChoice("END", "accept")).toBe(false);
    expect(isValidChoice("END", 5)).toBe(false);
    expect(isOfferKind("START")).toBe(true);
    expect(isOfferKind("EXTEND")).toBe(true);
    expect(isValidChoice("EXTEND", "accept")).toBe(true);
    expect(isValidChoice("EXTEND", "continue")).toBe(false);
    expect(isOfferKind("OTHER")).toBe(false);
  });
});

describe("offerExpiry", () => {
  it("is two weeks later", () => {
    expect(offerExpiry(now).getTime() - now.getTime()).toBe(OFFER_VALID_DAYS * 24 * 60 * 60 * 1000);
  });
});

describe("offerState", () => {
  it("is open only while pending and unexpired", () => {
    expect(offerState({ status: "PENDING", expiresAt: later }, now)).toBe("open");
    expect(offerState({ status: "PENDING", expiresAt: earlier }, now)).toBe("expired");
    expect(offerState({ status: "ACCEPTED", expiresAt: later }, now)).toBe("used");
    expect(offerState({ status: "DECLINED", expiresAt: later }, now)).toBe("used");
    expect(offerState({ status: "CANCELLED", expiresAt: later }, now)).toBe("cancelled");
  });
});

describe("offerStatusLabel", () => {
  it("tells staff where an offer stands", () => {
    expect(offerStatusLabel({ status: "PENDING", choice: null, expiresAt: later }, now)).toBe("Waiting for the customer");
    expect(offerStatusLabel({ status: "PENDING", choice: null, expiresAt: earlier }, now)).toBe("Expired without an answer");
    expect(offerStatusLabel({ status: "ACCEPTED", choice: "accept", expiresAt: later }, now)).toBe("Customer accepted: on hold");
    expect(offerStatusLabel({ status: "DECLINED", choice: "decline", expiresAt: later }, now)).toBe("Customer declined");
    expect(offerStatusLabel({ status: "ACCEPTED", choice: "accept", expiresAt: later, kind: "EXTEND" }, now)).toBe("Customer accepted: hold extended");
    expect(offerStatusLabel({ status: "ACCEPTED", choice: "end", expiresAt: later }, now)).toBe("Customer chose to end the subscription");
  });
});
