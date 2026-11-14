import { describe, expect, it } from "vitest";
import { bucketStreak } from "./admin-dashboard.service";

describe("bucketStreak", () => {
  it.each([
    [0, "0"],
    [1, "1-3"],
    [3, "1-3"],
    [4, "4-7"],
    [7, "4-7"],
    [8, "8-14"],
    [14, "8-14"],
    [15, "15-30"],
    [30, "15-30"],
    [31, "30+"],
    [365, "30+"],
  ] as const)("bucketStreak(%i) -> %s", (input, expected) => {
    expect(bucketStreak(input)).toBe(expected);
  });
});
