import { execFileSync, spawn } from "node:child_process";
import { isAbsolute } from "node:path";

export const macUpdateExitWatchdogDelaySeconds = 15;

type WatchdogChild = {
  once: (event: "error", listener: (error: Error) => void) => unknown;
  unref: () => void;
};

type SpawnWatchdog = (
  command: string,
  arguments_: string[],
  options: {
    detached: true;
    env: { LANG: "C"; LC_ALL: "C" };
    stdio: "ignore";
  }
) => WatchdogChild;

type MacUpdateExitWatchdogOptions = {
  delaySeconds?: number;
  executablePath?: string;
  onError?: (error: Error) => void;
  pid?: number;
  platform?: NodeJS.Platform;
  readProcessIdentity?: (pid: number) => MacProcessIdentity | undefined;
  spawnWatchdog?: SpawnWatchdog;
};

type MacProcessIdentity = {
  executablePath: string;
  startedAt: string;
};

const macWatchdogEnvironment = { LANG: "C", LC_ALL: "C" } as const;

const macUpdateExitWatchdogScript = [
  "delay=$1",
  "pid=$2",
  "expected_executable=$3",
  "expected_started=$4",
  '/bin/sleep "$delay"',
  'current_executable=$(/bin/ps -p "$pid" -o comm= 2>/dev/null)',
  'current_started=$(/bin/ps -p "$pid" -o lstart= 2>/dev/null)',
  "set -- $current_started",
  'current_started="$*"',
  'if [ "$current_executable" = "$expected_executable" ] &&',
  '   [ "$current_started" = "$expected_started" ]; then',
  '  /bin/kill -KILL "$pid"',
  "fi"
].join("\n");

function normalizedIdentityField(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function readMacProcessIdentity(pid: number): MacProcessIdentity | undefined {
  try {
    const commandOptions = {
      encoding: "utf8" as const,
      env: macWatchdogEnvironment,
      maxBuffer: 8_192,
      timeout: 1_000
    };
    const executablePath = normalizedIdentityField(
      execFileSync(
        "/bin/ps",
        ["-p", String(pid), "-o", "comm="],
        commandOptions
      )
    );
    const startedAt = normalizedIdentityField(
      execFileSync(
        "/bin/ps",
        ["-p", String(pid), "-o", "lstart="],
        commandOptions
      )
    );
    if (!executablePath || !startedAt) return undefined;
    return { executablePath, startedAt };
  } catch {
    return undefined;
  }
}

export function armMacUpdateExitWatchdog(
  options: MacUpdateExitWatchdogOptions = {}
): boolean {
  const platform = options.platform ?? process.platform;
  const pid = options.pid ?? process.pid;
  const executablePath = options.executablePath ?? process.execPath;
  const delaySeconds =
    options.delaySeconds ?? macUpdateExitWatchdogDelaySeconds;
  if (
    platform !== "darwin" ||
    !Number.isSafeInteger(pid) ||
    pid <= 1 ||
    !Number.isSafeInteger(delaySeconds) ||
    delaySeconds < 1 ||
    delaySeconds > 60 ||
    !isAbsolute(executablePath) ||
    executablePath.length > 4_096 ||
    /[\u0000-\u001f\u007f]/.test(executablePath)
  ) {
    return false;
  }

  const identity = (options.readProcessIdentity ?? readMacProcessIdentity)(pid);
  if (!identity || identity.executablePath !== executablePath) return false;
  const startedAt = normalizedIdentityField(identity.startedAt);
  if (!startedAt || /[\u0000-\u001f\u007f]/.test(startedAt)) return false;

  const spawnWatchdog = options.spawnWatchdog ?? (spawn as SpawnWatchdog);
  try {
    const watchdog = spawnWatchdog(
      "/bin/sh",
      [
        "-c",
        macUpdateExitWatchdogScript,
        "looper-update-exit-watchdog",
        String(delaySeconds),
        String(pid),
        executablePath,
        startedAt
      ],
      {
        detached: true,
        env: macWatchdogEnvironment,
        stdio: "ignore"
      }
    );
    watchdog.once("error", (error) => options.onError?.(error));
    watchdog.unref();
    return true;
  } catch (error) {
    options.onError?.(
      error instanceof Error
        ? error
        : new Error("Could not start the update exit watchdog.")
    );
    return false;
  }
}
