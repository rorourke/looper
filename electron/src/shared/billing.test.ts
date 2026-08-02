import assert from "node:assert/strict";
import test from "node:test";
import {
  billingStatusAllowsSheetCreation,
  quotaBillingStatus
} from "./billing.ts";

test("allows sheet creation only when every quota field has room", () => {
  assert.equal(billingStatusAllowsSheetCreation(quotaBillingStatus(4)), true);
  assert.equal(billingStatusAllowsSheetCreation(quotaBillingStatus(5)), false);
  assert.equal(
    billingStatusAllowsSheetCreation({
      ...quotaBillingStatus(5),
      canCreateSheet: true
    }),
    false
  );
  assert.equal(
    billingStatusAllowsSheetCreation({
      ...quotaBillingStatus(4),
      unusedSheetCount: 0
    }),
    false
  );
});
