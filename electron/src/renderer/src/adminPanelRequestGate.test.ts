import assert from "node:assert/strict";
import test from "node:test";
import { createAdminPanelRequestGate } from "./adminPanelRequestGate.ts";

test("closing the admin panel invalidates late overview completions", async () => {
  const gate = createAdminPanelRequestGate();
  const firstRequest = gate.begin();
  const lateCompletion = Promise.resolve().then(() =>
    gate.isCurrent(firstRequest)
  );

  gate.invalidate();
  assert.equal(await lateCompletion, false);

  const reopenedRequest = gate.begin();
  assert.equal(gate.isCurrent(firstRequest), false);
  assert.equal(gate.isCurrent(reopenedRequest), true);
});
