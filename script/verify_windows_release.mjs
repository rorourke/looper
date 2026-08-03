#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const requestedArchitecture = process.argv[2] ?? "all";
const signingWasRequested = Boolean(process.env.CSC_LINK);
assert.ok(
  ["all", "arm64", "x64"].includes(requestedArchitecture),
  "usage: verify_windows_release.mjs <all|arm64|x64>"
);

const repositoryRoot = resolve(import.meta.dirname, "..");
const projectDir = join(repositoryRoot, "electron");
const releaseDir = join(projectDir, "release");
const packageJson = JSON.parse(
  await readFile(join(projectDir, "package.json"), "utf8")
);
const version = packageJson.version;
assert.match(
  version,
  /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/,
  "The Electron package version must be a semantic version."
);

const architectures =
  requestedArchitecture === "all"
    ? ["arm64", "x64"]
    : [requestedArchitecture];
const peMachineByArchitecture = {
  arm64: 0xaa64,
  x64: 0x8664
};

function peMetadata(contents, label) {
  assert.ok(contents.length >= 256, `${label} is too small to be a PE file.`);
  assert.equal(contents.subarray(0, 2).toString("ascii"), "MZ", `${label} is not a PE file.`);
  const peOffset = contents.readUInt32LE(0x3c);
  assert.ok(peOffset + 128 <= contents.length, `${label} has a truncated PE header.`);
  assert.equal(
    contents.subarray(peOffset, peOffset + 4).toString("binary"),
    "PE\u0000\u0000",
    `${label} has an invalid PE signature.`
  );
  const machine = contents.readUInt16LE(peOffset + 4);
  const optionalHeaderOffset = peOffset + 24;
  const optionalHeaderMagic = contents.readUInt16LE(optionalHeaderOffset);
  const dataDirectoryOffset =
    optionalHeaderMagic === 0x20b
      ? optionalHeaderOffset + 112
      : optionalHeaderMagic === 0x10b
        ? optionalHeaderOffset + 96
        : undefined;
  assert.ok(dataDirectoryOffset, `${label} has an unknown PE optional header.`);
  const certificateTableSize = contents.readUInt32LE(
    dataDirectoryOffset + 4 * 8 + 4
  );
  return { certificateTableSize, machine };
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesBelow(path) : entry.isFile() ? [path] : [];
    })
  );
  return nested.flat();
}

async function validateAuthenticode(path) {
  assert.equal(
    process.platform,
    "win32",
    "Authenticode validation must run on Windows."
  );
  await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$signature = Get-AuthenticodeSignature -LiteralPath $env:LOOPER_SIGNATURE_PATH; " +
        "if ($signature.Status -ne 'Valid') { " +
        "Write-Error \"Invalid Authenticode status: $($signature.Status)\"; exit 1 }"
    ],
    {
      env: {
        ...process.env,
        LOOPER_SIGNATURE_PATH: path
      }
    }
  );
}

for (const architecture of architectures) {
  const installerName = `Looper-${version}-Windows-${architecture}.exe`;
  const zipName = `Looper-${version}-Windows-${architecture}.zip`;
  const installerPath = join(releaseDir, installerName);
  const zipPath = join(releaseDir, zipName);
  const [installerStat, zipStat] = await Promise.all([
    stat(installerPath),
    stat(zipPath)
  ]);
  assert.ok(installerStat.size > 1_000_000, `${installerName} is unexpectedly small.`);
  assert.ok(zipStat.size > 1_000_000, `${zipName} is unexpectedly small.`);

  const installerMetadata = peMetadata(
    await readFile(installerPath),
    installerName
  );
  assert.ok(
    [0x14c, 0x8664, 0xaa64].includes(installerMetadata.machine),
    `${installerName} uses an unexpected PE architecture.`
  );

  const extractionDirectory = await mkdtemp(
    join(tmpdir(), `looper-windows-${architecture}-verify-`)
  );
  try {
    await execFileAsync("tar", ["-xf", zipPath, "-C", extractionDirectory]);
    const extractedFiles = await filesBelow(extractionDirectory);
    const appExecutables = extractedFiles.filter(
      (path) => relative(extractionDirectory, path).replaceAll("\\", "/") === "Looper.exe"
    );
    const asarFiles = extractedFiles.filter(
      (path) =>
        relative(extractionDirectory, path).replaceAll("\\", "/") ===
        "resources/app.asar"
    );
    assert.equal(
      appExecutables.length,
      1,
      `${zipName} must contain one Looper.exe at its root.`
    );
    assert.equal(
      asarFiles.length,
      1,
      `${zipName} must contain resources/app.asar.`
    );
    const appMetadata = peMetadata(
      await readFile(appExecutables[0]),
      `${zipName}:Looper.exe`
    );
    assert.equal(
      appMetadata.machine,
      peMachineByArchitecture[architecture],
      `${zipName} contains the wrong Looper.exe architecture.`
    );
    const installerHasSignature = installerMetadata.certificateTableSize > 0;
    const appHasSignature = appMetadata.certificateTableSize > 0;
    assert.equal(
      installerHasSignature,
      appHasSignature,
      `${installerName} and its packaged app must have the same signing state.`
    );
    if (signingWasRequested) {
      assert.ok(
        installerHasSignature,
        "Windows signing was requested, but the release is unsigned."
      );
    }
    if (installerHasSignature) {
      await validateAuthenticode(installerPath);
      await validateAuthenticode(appExecutables[0]);
    }
    const signatureState = installerHasSignature ? "signed" : "unsigned";
    console.log(
      `Verified ${installerName} and ${zipName} (${signatureState}).`
    );
  } finally {
    await rm(extractionDirectory, { force: true, recursive: true });
  }
}
