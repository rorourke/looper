import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import {
  armMacUpdateExitWatchdog,
  macUpdateExitWatchdogDelaySeconds
} from "./updateShutdown.ts";

test("macOS update shutdown arms a detached, identity-checked watchdog", () => {
  let spawned:
    | {
        arguments_: string[];
        command: string;
        options: {
          detached: true;
          env: { LANG: "C"; LC_ALL: "C" };
          stdio: "ignore";
        };
      }
    | undefined;
  let errorListener: ((error: Error) => void) | undefined;
  let reportedError: Error | undefined;
  let unreferenced = false;

  const armed = armMacUpdateExitWatchdog({
    executablePath: "/Applications/Looper.app/Contents/MacOS/Looper",
    onError: (error) => {
      reportedError = error;
    },
    pid: 12_345,
    platform: "darwin",
    readProcessIdentity: () => ({
      executablePath: "/Applications/Looper.app/Contents/MacOS/Looper",
      startedAt: "Tue Aug  4 08:53:12 2026"
    }),
    spawnWatchdog: (command, arguments_, options) => {
      spawned = { arguments_, command, options };
      return {
        once: (_event, listener) => {
          errorListener = listener;
        },
        unref: () => {
          unreferenced = true;
        }
      };
    }
  });

  assert.equal(armed, true);
  assert.equal(spawned?.command, "/bin/sh");
  assert.deepEqual(spawned?.options, {
    detached: true,
    env: { LANG: "C", LC_ALL: "C" },
    stdio: "ignore"
  });
  assert.equal(spawned?.arguments_[0], "-c");
  assert.match(spawned?.arguments_[1] ?? "", /-o comm=/);
  assert.match(spawned?.arguments_[1] ?? "", /-o lstart=/);
  assert.match(
    spawned?.arguments_[1] ?? "",
    /"\$current_executable" = "\$expected_executable"/
  );
  assert.match(
    spawned?.arguments_[1] ?? "",
    /"\$current_started" = "\$expected_started"/
  );
  assert.match(spawned?.arguments_[1] ?? "", /\/bin\/kill -KILL "\$pid"/);
  assert.deepEqual(spawned?.arguments_.slice(2), [
    "looper-update-exit-watchdog",
    String(macUpdateExitWatchdogDelaySeconds),
    "12345",
    "/Applications/Looper.app/Contents/MacOS/Looper",
    "Tue Aug 4 08:53:12 2026"
  ]);
  assert.equal(typeof errorListener, "function");
  assert.equal(unreferenced, true);
  const spawnError = new Error("spawn failed");
  errorListener?.(spawnError);
  assert.equal(reportedError, spawnError);
});

test("the update exit watchdog fails closed outside a valid macOS app process", () => {
  let spawnCount = 0;
  const spawnWatchdog = () => {
    spawnCount += 1;
    throw new Error("should not spawn");
  };

  assert.equal(
    armMacUpdateExitWatchdog({
      executablePath: "/Applications/Looper.app/Contents/MacOS/Looper",
      pid: 12_345,
      platform: "win32",
      readProcessIdentity: () => undefined,
      spawnWatchdog
    }),
    false
  );
  assert.equal(
    armMacUpdateExitWatchdog({
      executablePath: "Looper",
      pid: 12_345,
      platform: "darwin",
      readProcessIdentity: () => undefined,
      spawnWatchdog
    }),
    false
  );
  assert.equal(
    armMacUpdateExitWatchdog({
      executablePath: "/Applications/Looper.app/Contents/MacOS/Looper",
      pid: 1,
      platform: "darwin",
      readProcessIdentity: () => undefined,
      spawnWatchdog
    }),
    false
  );
  assert.equal(spawnCount, 0);
});

test("the watchdog refuses a process whose executable identity changed", () => {
  let spawnCount = 0;
  assert.equal(
    armMacUpdateExitWatchdog({
      executablePath: "/Applications/Looper.app/Contents/MacOS/Looper",
      pid: 12_345,
      platform: "darwin",
      readProcessIdentity: () => ({
        executablePath: "/Applications/Another.app/Contents/MacOS/Another",
        startedAt: "Tue Aug 4 08:53:12 2026"
      }),
      spawnWatchdog: () => {
        spawnCount += 1;
        throw new Error("should not spawn");
      }
    }),
    false
  );
  assert.equal(spawnCount, 0);
});

test(
  "the real macOS watchdog kills only the exact process identity",
  { skip: process.platform !== "darwin" },
  async () => {
    const exactChild = spawn("/bin/sleep", ["30"], { stdio: "ignore" });
    try {
      assert.ok(exactChild.pid);
      assert.equal(
        armMacUpdateExitWatchdog({
          delaySeconds: 1,
          executablePath: "/bin/sleep",
          pid: exactChild.pid
        }),
        true
      );
      const exactExit = Promise.race([
        once(exactChild, "exit"),
        new Promise<never>((_resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Exact watchdog timed out.")),
            5_000
          );
          timeout.unref();
        })
      ]);
      const [, signal] = await exactExit;
      assert.equal(signal, "SIGKILL");
    } finally {
      if (exactChild.exitCode === null && exactChild.signalCode === null) {
        exactChild.kill("SIGKILL");
      }
    }

    const mismatchedChild = spawn("/bin/sleep", ["30"], { stdio: "ignore" });
    try {
      assert.ok(mismatchedChild.pid);
      assert.equal(
        armMacUpdateExitWatchdog({
          delaySeconds: 1,
          executablePath: "/bin/sleep",
          pid: mismatchedChild.pid,
          readProcessIdentity: () => ({
            executablePath: "/bin/sleep",
            startedAt: "Mon Jan 1 00:00:00 1900"
          })
        }),
        true
      );
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      assert.equal(mismatchedChild.exitCode, null);
      assert.equal(mismatchedChild.signalCode, null);
    } finally {
      if (mismatchedChild.exitCode === null && mismatchedChild.signalCode === null) {
        mismatchedChild.kill("SIGKILL");
        await once(mismatchedChild, "exit");
      }
    }
  }
);
