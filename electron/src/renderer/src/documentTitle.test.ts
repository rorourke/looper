import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { autoTitleForSheet } from "./documentTitle.ts";

describe("automatic sheet titles", () => {
  test("names an untitled sheet from its first section title", () => {
    assert.equal(autoTitleForSheet("Untitled", "House Estimate:"), "House Estimate");
    assert.equal(
      autoTitleForSheet("Untitled", "amount = 30\n\nHouse Estimate:\nprice = 40"),
      "House Estimate"
    );
  });

  test("uses only the title portion of an inline title", () => {
    assert.equal(
      autoTitleForSheet("Untitled", "House Estimate: rough numbers"),
      "House Estimate"
    );
  });

  test("ignores colons in comments and ordinary sheet content", () => {
    assert.equal(
      autoTitleForSheet("Untitled", "// House Estimate:\nprice = 40"),
      "Untitled"
    );
  });

  test("never changes a sheet after it has a name", () => {
    assert.equal(autoTitleForSheet("30-40", "House Estimate:"), "30-40");

    const firstAutomaticTitle = autoTitleForSheet("Untitled", "House Estimate:");
    assert.equal(autoTitleForSheet(firstAutomaticTitle, "Updated Estimate:"), "House Estimate");
  });
});
