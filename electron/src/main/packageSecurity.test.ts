import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

test("the macOS after-pack hook removes Electron Builder's broad ATS exception", async () => {
  const packageJson = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8")
  );
  assert.equal(
    packageJson.build?.afterPack,
    "build/restrictMacTransportSecurity.cjs"
  );

  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "looper-package-security-")
  );
  const infoPlistPath = join(
    temporaryDirectory,
    "Looper.app/Contents/Info.plist"
  );
  await mkdir(dirname(infoPlistPath), { recursive: true });
  await writeFile(
    infoPlistPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>NSAppTransportSecurity</key><dict>
<key>NSAllowsArbitraryLoads</key><true/>
<key>NSAllowsLocalNetworking</key><true/>
<key>NSExceptionDomains</key><dict><key>localhost</key><dict/></dict>
</dict></dict></plist>`
  );

  try {
    const restrictMacTransportSecurity = require(
      "../../build/restrictMacTransportSecurity.cjs"
    ) as (context: {
      appOutDir: string;
      electronPlatformName: string;
      packager: { appInfo: { productFilename: string } };
    }) => Promise<void>;
    await restrictMacTransportSecurity({
      appOutDir: temporaryDirectory,
      electronPlatformName: "darwin",
      packager: { appInfo: { productFilename: "Looper" } }
    });

    const { stdout } = await execFileAsync(
      "/usr/bin/plutil",
      ["-convert", "json", "-o", "-", infoPlistPath],
      { encoding: "utf8" }
    );
    const info = JSON.parse(stdout);
    assert.deepEqual(info.NSAppTransportSecurity, {
      NSAllowsArbitraryLoads: false,
      NSExceptionDomains: {
        "127.0.0.1": {
          NSExceptionAllowsInsecureHTTPLoads: true,
          NSIncludesSubdomains: false
        }
      }
    });
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
