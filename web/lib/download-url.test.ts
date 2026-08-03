import assert from "node:assert/strict";
import test from "node:test";
import {
  preferredMacDownloadUrl,
  preferredWindowsDownloadUrl,
  resolveLatestMacDownloadManifest,
  resolveLatestWindowsDownloadManifest,
  resolveMacDownloadUrl,
  resolveMacUpdateArtifactUrl,
  resolveWindowsDownloadUrl,
  resolveWindowsReleaseArtifactUrl
} from "./download-url.ts";

test("normalizes a public Vercel Blob macOS artifact to a forced download", () => {
  assert.equal(
    resolveMacDownloadUrl(
      "https://example.public.blob.vercel-storage.com/releases/Looper-mac-arm64.zip"
    )?.href,
    "https://example.public.blob.vercel-storage.com/releases/Looper-mac-arm64.zip?download=1"
  );
});

test("accepts DMGs and an existing forced-download query", () => {
  assert.equal(
    resolveMacDownloadUrl(
      "https://example.public.blob.vercel-storage.com/releases/Looper.dmg?download=1"
    )?.href,
    "https://example.public.blob.vercel-storage.com/releases/Looper.dmg?download=1"
  );
});

test("rejects untrusted, credentialed, and non-artifact URLs", () => {
  const invalidUrls = [
    undefined,
    "https://example.com/Looper.zip",
    "http://example.public.blob.vercel-storage.com/Looper.zip",
    "https://user:password@example.public.blob.vercel-storage.com/Looper.zip",
    "https://example.public.blob.vercel-storage.com/Looper.txt",
    "https://example.public.blob.vercel-storage.com/Looper.zip?unexpected=1",
    "https://example.public.blob.vercel-storage.com/Looper.zip#fragment"
  ];

  for (const value of invalidUrls) {
    assert.equal(resolveMacDownloadUrl(value), null);
  }
});

test("normalizes only trusted Windows installers and archives", () => {
  const baseUrl =
    "https://example.public.blob.vercel-storage.com/releases/windows/";

  assert.equal(
    resolveWindowsDownloadUrl(`${baseUrl}Looper-1.2.3-Windows-x64.exe`)?.href,
    `${baseUrl}Looper-1.2.3-Windows-x64.exe?download=1`
  );
  assert.equal(
    resolveWindowsDownloadUrl(
      `${baseUrl}Looper-1.2.3-Windows-arm64.zip?download=1`
    )?.href,
    `${baseUrl}Looper-1.2.3-Windows-arm64.zip?download=1`
  );

  for (const value of [
    "https://example.com/Looper.exe",
    `${baseUrl}Looper.dmg`,
    `${baseUrl}Looper.exe?unexpected=1`,
    `${baseUrl}Looper.exe#fragment`
  ]) {
    assert.equal(resolveWindowsDownloadUrl(value), null);
  }
});

test("resolves only known Windows release artifacts", () => {
  const baseUrl =
    "https://example.public.blob.vercel-storage.com/releases/windows/";
  assert.equal(
    resolveWindowsReleaseArtifactUrl(baseUrl, "latest-download.json")?.href,
    `${baseUrl}latest-download.json`
  );
  assert.equal(
    resolveWindowsReleaseArtifactUrl(
      baseUrl,
      "Looper-1.2.3-Windows-arm64.exe"
    )?.href,
    `${baseUrl}Looper-1.2.3-Windows-arm64.exe`
  );

  for (const artifact of [
    "../latest-download.json",
    "arbitrary.exe",
    "Looper-1.2-Windows-x64.exe",
    "Looper-1.2.3-Windows-ia32.exe"
  ]) {
    assert.equal(resolveWindowsReleaseArtifactUrl(baseUrl, artifact), null);
  }
});

test("resolves only known updater artifacts inside the public Blob release folder", () => {
  const baseUrl =
    "https://example.public.blob.vercel-storage.com/releases/macos/";
  assert.equal(
    resolveMacUpdateArtifactUrl(baseUrl, "latest-mac.yml")?.href,
    `${baseUrl}latest-mac.yml`
  );
  assert.equal(
    resolveMacUpdateArtifactUrl(
      baseUrl,
      "Looper-1.2.3-beta.4-macOS-arm64.zip"
    )?.href,
    `${baseUrl}Looper-1.2.3-beta.4-macOS-arm64.zip`
  );
  assert.equal(
    resolveMacUpdateArtifactUrl(
      baseUrl,
      "Looper-Installer-1.2.3-beta.4.dmg"
    )?.href,
    `${baseUrl}Looper-Installer-1.2.3-beta.4.dmg`
  );

  const invalidArtifacts = [
    "../latest-mac.yml",
    "arbitrary.zip",
    "Looper-1.2-macOS-arm64.zip",
    "Looper-1.2.3-macOS-universal.zip"
  ];
  for (const artifact of invalidArtifacts) {
    assert.equal(resolveMacUpdateArtifactUrl(baseUrl, artifact), null);
  }
  assert.equal(
    resolveMacUpdateArtifactUrl(
      "https://example.com/releases",
      "latest-mac.yml"
    ),
    null
  );
});

test("validates the architecture-specific latest download manifest", () => {
  const manifest = resolveLatestMacDownloadManifest({
    version: "1.2.3",
    arm64Url:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-arm64.dmg",
    arm64ZipUrl:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-arm64.zip",
    installerUrl:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-Installer-1.2.3.dmg",
    publishedAt: "2026-07-23T03:30:00.000Z",
    x64Url:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-x64.dmg",
    x64ZipUrl:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-x64.zip"
  });

  assert.equal(manifest?.version, "1.2.3");
  assert.equal(manifest?.arm64Url.search, "?download=1");
  assert.equal(manifest?.installerUrl?.search, "?download=1");
  assert.equal(manifest?.x64Url.search, "?download=1");

  const legacyManifest = resolveLatestMacDownloadManifest({
    version: "1.2.3",
    arm64Url:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-arm64.dmg",
    arm64ZipUrl:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-arm64.zip",
    publishedAt: "2026-07-23T03:30:00.000Z",
    x64Url:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-x64.dmg",
    x64ZipUrl:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-x64.zip"
  });
  assert.equal(legacyManifest?.installerUrl, undefined);
  assert.equal(legacyManifest?.version, "1.2.3");

  assert.equal(
    resolveLatestMacDownloadManifest(
      {
        version: "1.2.3",
        arm64Url:
          "https://attacker.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-arm64.dmg",
        arm64ZipUrl:
          "https://attacker.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-arm64.zip",
        publishedAt: "2026-07-23T03:30:00.000Z",
        x64Url:
          "https://attacker.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-x64.dmg",
        x64ZipUrl:
          "https://attacker.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-x64.zip"
      },
      "https://example.public.blob.vercel-storage.com/releases/macos/latest-download.json"
    ),
    null
  );

  assert.equal(
    resolveLatestMacDownloadManifest({
      version: "1.2.3",
      arm64Url:
        "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.2-macOS-arm64.dmg",
      arm64ZipUrl:
        "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-arm64.zip",
      publishedAt: "2026-07-23T03:30:00.000Z",
      x64Url:
        "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-x64.dmg",
      x64ZipUrl:
        "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-x64.zip"
    }),
    null
  );

  assert.equal(
    resolveLatestMacDownloadManifest({
      version: "1.2.3",
      arm64Url:
        "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-arm64.dmg",
      arm64ZipUrl:
        "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-arm64.zip",
      installerUrl:
        "https://example.public.blob.vercel-storage.com/releases/macos/Looper-Installer-1.2.2.dmg",
      publishedAt: "2026-07-23T03:30:00.000Z",
      x64Url:
        "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-x64.dmg",
      x64ZipUrl:
        "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-x64.zip"
    }),
    null
  );
});

test("uses only downloads from the signed release manifest", () => {
  const manifest = resolveLatestMacDownloadManifest({
    version: "1.2.3",
    arm64Url:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-arm64.dmg",
    arm64ZipUrl:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-arm64.zip",
    installerUrl:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-Installer-1.2.3.dmg",
    publishedAt: "2026-07-23T03:30:00.000Z",
    x64Url:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-x64.dmg",
    x64ZipUrl:
      "https://example.public.blob.vercel-storage.com/releases/macos/Looper-1.2.3-macOS-x64.zip"
  });

  assert.equal(
    preferredMacDownloadUrl(manifest)?.pathname,
    "/releases/macos/Looper-Installer-1.2.3.dmg"
  );
  assert.equal(
    preferredMacDownloadUrl(
      manifest ? { ...manifest, installerUrl: undefined } : null
    )?.pathname,
    "/releases/macos/Looper-1.2.3-macOS-arm64.dmg"
  );
  assert.equal(preferredMacDownloadUrl(null), null);
});

test("validates and prefers the x64 Windows installer manifest", () => {
  const baseUrl =
    "https://example.public.blob.vercel-storage.com/releases/windows";
  const manifestValue = {
    version: "1.2.3",
    arm64Url: `${baseUrl}/Looper-1.2.3-Windows-arm64.exe`,
    arm64ZipUrl: `${baseUrl}/Looper-1.2.3-Windows-arm64.zip`,
    publishedAt: "2026-08-03T05:30:00.000Z",
    x64Url: `${baseUrl}/Looper-1.2.3-Windows-x64.exe`,
    x64ZipUrl: `${baseUrl}/Looper-1.2.3-Windows-x64.zip`
  };
  const manifest = resolveLatestWindowsDownloadManifest(manifestValue);

  assert.equal(manifest?.version, "1.2.3");
  assert.equal(
    preferredWindowsDownloadUrl(manifest)?.href,
    `${baseUrl}/Looper-1.2.3-Windows-x64.exe?download=1`
  );
  assert.equal(preferredWindowsDownloadUrl(null), null);
  assert.equal(
    resolveLatestWindowsDownloadManifest(
      {
        ...manifestValue,
        x64Url:
          "https://attacker.public.blob.vercel-storage.com/releases/windows/Looper-1.2.3-Windows-x64.exe"
      },
      `${baseUrl}/latest-download.json`
    ),
    null
  );
  assert.equal(
    resolveLatestWindowsDownloadManifest({
      ...manifestValue,
      arm64Url: `${baseUrl}/Looper-1.2.2-Windows-arm64.exe`
    }),
    null
  );
});
