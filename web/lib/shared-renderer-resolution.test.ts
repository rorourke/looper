import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const nextConfigUrl = new URL("../next.config.ts", import.meta.url);
const tsconfigUrl = new URL("../tsconfig.json", import.meta.url);

test("resolves shared Electron renderer dependencies from the web project", async () => {
  const [nextConfig, tsconfig] = await Promise.all([
    readFile(nextConfigUrl, "utf8"),
    readFile(tsconfigUrl, "utf8")
  ]);

  assert.match(
    nextConfig,
    /"lucide-react":\s*"\.\/node_modules\/lucide-react\/dist\/esm\/lucide-react\.mjs"/
  );
  assert.match(
    nextConfig,
    /rebound:\s*"\.\/node_modules\/rebound\/dist\/rebound\.js"/
  );
  const parsedTsconfig = JSON.parse(tsconfig) as {
    compilerOptions: { paths: object; typeRoots: string[]; types: string[] };
  };
  for (const dependency of ["lucide-react", "rebound"]) {
    assert.ok(
      Object.hasOwn(parsedTsconfig.compilerOptions.paths, dependency),
      `Expected a web-local TypeScript path for ${dependency}`
    );
  }
  assert.deepEqual(parsedTsconfig.compilerOptions.typeRoots, [
    "./node_modules/@types"
  ]);
  assert.deepEqual(parsedTsconfig.compilerOptions.types, [
    "node",
    "react",
    "react-dom"
  ]);
});
