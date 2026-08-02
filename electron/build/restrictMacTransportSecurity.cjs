const { execFile } = require("node:child_process");
const { basename, join } = require("node:path");
const { isDeepStrictEqual, promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const restrictedAppTransportSecurity = {
  NSAllowsArbitraryLoads: false,
  // electron-updater hands the downloaded ZIP to Squirrel.Mac through a
  // randomized, authenticated HTTP server bound specifically to 127.0.0.1.
  NSExceptionDomains: {
    "127.0.0.1": {
      NSExceptionAllowsInsecureHTTPLoads: true,
      NSIncludesSubdomains: false
    }
  }
};

module.exports = async function restrictMacTransportSecurity(context) {
  if (context.electronPlatformName !== "darwin") return;

  const productFilename = context.packager?.appInfo?.productFilename;
  if (
    typeof productFilename !== "string" ||
    productFilename.length === 0 ||
    productFilename.length > 128 ||
    basename(productFilename) !== productFilename
  ) {
    throw new Error("Cannot safely resolve the packaged macOS app bundle.");
  }

  const infoPlistPath = join(
    context.appOutDir,
    `${productFilename}.app`,
    "Contents",
    "Info.plist"
  );
  await execFileAsync("/usr/bin/plutil", [
    "-replace",
    "NSAppTransportSecurity",
    "-json",
    JSON.stringify(restrictedAppTransportSecurity),
    infoPlistPath
  ]);

  const { stdout } = await execFileAsync(
    "/usr/bin/plutil",
    ["-extract", "NSAppTransportSecurity", "json", "-o", "-", infoPlistPath],
    { encoding: "utf8" }
  );
  const actual = JSON.parse(stdout);
  if (!isDeepStrictEqual(actual, restrictedAppTransportSecurity)) {
    throw new Error("Could not enforce the packaged macOS transport policy.");
  }
};
