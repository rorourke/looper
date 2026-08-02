import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  normalizeIpcError,
  normalizeIpcErrorMessage
} from "./ipcError.ts";

describe("Electron IPC error normalization", () => {
  test("removes Electron and main-process error wrappers", () => {
    const channel = "cloud-account:get-account";
    const error = new Error(
      `Error invoking remote method '${channel}': CloudAccountError: ` +
        "Could not restore your account session. Check your connection and try again."
    );

    assert.equal(
      normalizeIpcErrorMessage(error, channel),
      "Could not restore your account session. Check your connection and try again."
    );
    assert.equal(
      normalizeIpcError(error, channel).message,
      "Could not restore your account session. Check your connection and try again."
    );
  });

  test("preserves ordinary errors and supplies a safe fallback", () => {
    assert.equal(
      normalizeIpcErrorMessage(new Error("Could not open this document."), "document:open"),
      "Could not open this document."
    );
    assert.equal(
      normalizeIpcErrorMessage(undefined, "document:open"),
      "The app could not complete this action."
    );
  });
});
