#!/usr/bin/env node

import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = dirname(scriptDirectory);

const artifactRoots = {
  electron: join(repositoryRoot, "electron/out"),
  web: join(repositoryRoot, "web/.next/static")
};

const forbiddenPatterns = [
  ["server admin UUID allowlist", /LOOPER_ADMIN_USER_IDS/i],
  ["server MFA-ready UUID allowlist", /LOOPER_ADMIN_MFA_READY_USER_IDS/i],
  ["server approved admin TOTP bindings", /LOOPER_ADMIN_TOTP_FACTOR_IDS/i],
  ["Supabase service credential variable", /SUPABASE_SECRET_KEY/i],
  ["historical hard-coded administrator email", /rorourke@gmail\.com/i],
  ["legacy hard-coded administrator symbol", /ADMIN_ACCOUNT_EMAIL|isAdminAccountEmail/i],
  ["Supabase secret key value", /sb_secret_[A-Za-z0-9._-]{20,}/],
  ["Stripe live secret key value", /(?:sk|rk)_live_[A-Za-z0-9]{16,}/],
  ["Stripe webhook secret value", /whsec_[A-Za-z0-9]{16,}/]
];

const jwtPattern = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g;

function containsServiceRoleJwt(contents) {
  for (const jwt of contents.matchAll(jwtPattern)) {
    try {
      const payload = JSON.parse(
        Buffer.from(jwt[0].split(".")[1], "base64url").toString("utf8")
      );
      if (payload?.role === "service_role") return true;
    } catch {
      // Ignore JWT-shaped source text unless it decodes to a service-role claim.
    }
  }
  return false;
}

async function artifactFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return artifactFiles(path);
      return entry.isFile() ? [path] : [];
    })
  );
  return nested.flat();
}

export async function verifyClientArtifactRoot(root) {
  const rootStat = await stat(root).catch(() => undefined);
  assert.ok(rootStat?.isDirectory(), `Client artifact directory is missing: ${root}`);

  const files = await artifactFiles(root);
  assert.ok(files.length > 0, `Client artifact directory is empty: ${root}`);
  for (const file of files) {
    const contents = await readFile(file, "utf8");
    for (const [label, pattern] of forbiddenPatterns) {
      assert.doesNotMatch(
        contents,
        pattern,
        `${label} was compiled into ${relative(repositoryRoot, file)}`
      );
    }
    assert.equal(
      containsServiceRoleJwt(contents),
      false,
      `Supabase service-role JWT was compiled into ${relative(repositoryRoot, file)}`
    );
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const requestedTargets = process.argv.slice(2);
  assert.ok(
    requestedTargets.length > 0,
    "usage: verify_client_artifacts.mjs <electron|web> [...]"
  );
  for (const target of requestedTargets) {
    assert.ok(
      Object.hasOwn(artifactRoots, target),
      `Unknown client artifact target: ${target}`
    );
    await verifyClientArtifactRoot(resolve(artifactRoots[target]));
    console.log(`Verified ${target} client artifacts contain no privileged values.`);
  }
}
