import { BlobNotFoundError, head, put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  throw new Error("BLOB_READ_WRITE_TOKEN is required.");
}

const projectDir = process.cwd();
const releaseDir = join(projectDir, "release");
const packageJson = JSON.parse(
  await readFile(join(projectDir, "package.json"), "utf8")
);
const version = packageJson.version;
if (
  typeof version !== "string" ||
  !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)
) {
  throw new Error(`Invalid release version: ${String(version)}`);
}

const latestManifestPath = "releases/windows/latest-download.json";

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

async function existingBlob(pathname) {
  try {
    return await head(pathname, { token });
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

async function refuseReleaseOlderThanCurrent() {
  const existingManifest = await existingBlob(latestManifestPath);
  if (!existingManifest) return;

  const response = await fetch(existingManifest.url, {
    cache: "no-store",
    headers: { "cache-control": "no-cache" },
    redirect: "error",
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) {
    throw new Error(
      `Could not read the current Windows release manifest (${response.status}).`
    );
  }
  const manifestText = await response.text();
  if (Buffer.byteLength(manifestText, "utf8") > 16_384) {
    throw new Error("The current Windows release manifest is unexpectedly large.");
  }
  const currentVersion = JSON.parse(manifestText)?.version;
  if (
    typeof currentVersion !== "string" ||
    !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(currentVersion)
  ) {
    throw new Error("The current Windows release manifest has an invalid version.");
  }
  if (compareVersions(version, currentVersion) < 0) {
    throw new Error(
      `Refusing to replace Windows ${currentVersion} with older release ${version}.`
    );
  }
}

await refuseReleaseOlderThanCurrent();

const artifactNames = [
  `Looper-${version}-Windows-arm64.exe`,
  `Looper-${version}-Windows-arm64.zip`,
  `Looper-${version}-Windows-x64.exe`,
  `Looper-${version}-Windows-x64.zip`
];
const uploaded = new Map();
const artifactContents = new Map();

for (const artifactName of artifactNames) {
  const artifact = await readFile(join(releaseDir, artifactName));
  const pathname = `releases/windows/${artifactName}`;
  const previousUpload = await existingBlob(pathname);
  if (previousUpload && previousUpload.size !== artifact.byteLength) {
    throw new Error(
      `${artifactName} already exists with a different byte length.`
    );
  }
  const result =
    previousUpload ??
    (await put(pathname, artifact, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: 31_536_000,
      multipart: true,
      token
    }));
  uploaded.set(artifactName, result);
  artifactContents.set(artifactName, artifact);
  console.log(
    `${previousUpload ? "Reused" : "Uploaded"} ${artifactName}: ${result.url}`
  );
}

function artifactMetadata(name) {
  const contents = artifactContents.get(name);
  const upload = uploaded.get(name);
  if (!contents || !upload) {
    throw new Error(`Missing uploaded Windows artifact: ${name}`);
  }
  return {
    sha512: createHash("sha512").update(contents).digest("base64"),
    size: contents.byteLength,
    url: upload.url
  };
}

const arm64InstallerName = `Looper-${version}-Windows-arm64.exe`;
const arm64ZipName = `Looper-${version}-Windows-arm64.zip`;
const x64InstallerName = `Looper-${version}-Windows-x64.exe`;
const x64ZipName = `Looper-${version}-Windows-x64.zip`;
const arm64Installer = artifactMetadata(arm64InstallerName);
const arm64Zip = artifactMetadata(arm64ZipName);
const x64Installer = artifactMetadata(x64InstallerName);
const x64Zip = artifactMetadata(x64ZipName);
const latestDownloadManifest = JSON.stringify(
  {
    version,
    arm64Sha512: arm64Installer.sha512,
    arm64Size: arm64Installer.size,
    arm64Url: arm64Installer.url,
    arm64ZipSha512: arm64Zip.sha512,
    arm64ZipSize: arm64Zip.size,
    arm64ZipUrl: arm64Zip.url,
    publishedAt: new Date().toISOString(),
    x64Sha512: x64Installer.sha512,
    x64Size: x64Installer.size,
    x64Url: x64Installer.url,
    x64ZipSha512: x64Zip.sha512,
    x64ZipSize: x64Zip.size,
    x64ZipUrl: x64Zip.url
  },
  null,
  2
);
const latestDownloadResult = await put(
  latestManifestPath,
  latestDownloadManifest,
  {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "application/json",
    token
  }
);
console.log(`Uploaded latest-download.json: ${latestDownloadResult.url}`);
