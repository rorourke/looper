import assert from "node:assert/strict";
import test from "node:test";
import {
  idleAppUpdateState,
  isAppUpdateState
} from "./appUpdates.ts";

test("accepts renderer-safe app update states", () => {
  assert.equal(isAppUpdateState(idleAppUpdateState), true);
  assert.equal(
    isAppUpdateState({
      preview: false,
      releaseName: "1.2.3",
      status: "available"
    }),
    true
  );
  assert.equal(
    isAppUpdateState({
      errorMessage: "The update could not be downloaded.",
      preview: false,
      releaseName: "1.2.3",
      status: "available"
    }),
    true
  );
  assert.equal(
    isAppUpdateState({
      preview: true,
      progress: 100,
      releaseName: "Preview update",
      status: "installing"
    }),
    true
  );
});

test("rejects malformed app update states", () => {
  assert.equal(isAppUpdateState({ status: "available" }), false);
  assert.equal(
    isAppUpdateState({
      preview: "yes",
      releaseName: "1.2.3",
      status: "available"
    }),
    false
  );
  assert.equal(
    isAppUpdateState({
      preview: false,
      releaseName: "",
      status: "available"
    }),
    false
  );
  assert.equal(
    isAppUpdateState({
      errorMessage: "",
      preview: false,
      releaseName: "1.2.3",
      status: "available"
    }),
    false
  );
  assert.equal(
    isAppUpdateState({
      preview: false,
      progress: 101,
      releaseName: "1.2.3",
      status: "downloading"
    }),
    false
  );
});
