import { describe, it, expect } from "vitest";
import { DEFAULT_DELIVERY_OPTIONS } from "./merchDefaults";

describe("DEFAULT_DELIVERY_OPTIONS (ops mirror)", () => {
  it("is the three options in the order a club sees at checkout", () => {
    expect(DEFAULT_DELIVERY_OPTIONS.map((o) => o.label)).toEqual([
      "Pick up at training",
      "Pickup from someone",
      "Posted",
    ]);
    expect(DEFAULT_DELIVERY_OPTIONS.map((o) => o.type)).toEqual(["PICKUP", "COORDINATOR", "SHIP"]);
    expect(DEFAULT_DELIVERY_OPTIONS.map((o) => o.sortOrder)).toEqual([0, 1, 2]);
  });
});
