import { put } from "@vercel/blob";
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
  !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
    version
  )
) {
  throw new Error(`Invalid release version: ${String(version)}`);
}

const artifactNames = [
  `Looper-${version}-macOS-arm64.dmg`,
  `Looper-${version}-macOS-arm64.zip`,
  `Looper-${version}-macOS-arm64.zip.blockmap`,
  `Looper-${version}-macOS-x64.dmg`,
  `Looper-${version}-macOS-x64.zip`,
  `Looper-${version}-macOS-x64.zip.blockmap`,
  `Looper-Installer-${version}.dmg`
];
const uploaded = new Map();
const artifactContents = new Map();

for (const artifactName of artifactNames) {
  const artifact = await readFile(join(releaseDir, artifactName));
  const result = await put(`releases/macos/${artifactName}`, artifact, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    cacheControlMaxAge: 31_536_000,
    multipart: true,
    token
  });
  uploaded.set(artifactName, result);
  artifactContents.set(artifactName, artifact);
  console.log(`Uploaded ${artifactName}: ${result.url}`);
}

function zipMetadata(architecture) {
  const name = `Looper-${version}-macOS-${architecture}.zip`;
  const contents = artifactContents.get(name);
  const upload = uploaded.get(name);
  if (!contents || !upload) {
    throw new Error(`Missing uploaded update ZIP: ${name}`);
  }
  return {
    name,
    sha512: createHash("sha512").update(contents).digest("base64"),
    size: contents.byteLength,
    url: upload.url
  };
}

const arm64Zip = zipMetadata("arm64");
const x64Zip = zipMetadata("x64");
const publishedAt = new Date().toISOString();
const latestMacYaml = [
  `version: ${JSON.stringify(version)}`,
  "files:",
  `  - url: ${JSON.stringify(arm64Zip.url)}`,
  `    sha512: ${JSON.stringify(arm64Zip.sha512)}`,
  `    size: ${arm64Zip.size}`,
  `  - url: ${JSON.stringify(x64Zip.url)}`,
  `    sha512: ${JSON.stringify(x64Zip.sha512)}`,
  `    size: ${x64Zip.size}`,
  `path: ${JSON.stringify(arm64Zip.url)}`,
  `sha512: ${JSON.stringify(arm64Zip.sha512)}`,
  `releaseDate: ${JSON.stringify(publishedAt)}`,
  `releaseName: ${JSON.stringify(`Looper ${version}`)}`,
  `releaseNotes: ${JSON.stringify(`Looper ${version} is ready to install.`)}`,
  ""
].join("\n");
const latestMacResult = await put(
  "releases/macos/latest-mac.yml",
  latestMacYaml,
  {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
    contentType: "text/yaml",
    token
  }
);
console.log(`Uploaded latest-mac.yml: ${latestMacResult.url}`);

const latestDownloadManifest = JSON.stringify(
  {
    version,
    arm64Url: uploaded.get(`Looper-${version}-macOS-arm64.dmg`).url,
    arm64ZipUrl: uploaded.get(`Looper-${version}-macOS-arm64.zip`).url,
    installerUrl: uploaded.get(`Looper-Installer-${version}.dmg`).url,
    publishedAt,
    x64Url: uploaded.get(`Looper-${version}-macOS-x64.dmg`).url,
    x64ZipUrl: uploaded.get(`Looper-${version}-macOS-x64.zip`).url
  },
  null,
  2
);
const latestDownloadResult = await put(
  "releases/macos/latest-download.json",
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
