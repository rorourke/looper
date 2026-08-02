import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../app/", import.meta.url);

test("serves the account-free interactive Looper demo", async () => {
  const [page, layout, sitemap, robots] = await Promise.all([
    readFile(new URL("page.tsx", appRoot), "utf8"),
    readFile(new URL("layout.tsx", appRoot), "utf8"),
    readFile(new URL("sitemap.ts", appRoot), "utf8"),
    readFile(new URL("robots.ts", appRoot), "utf8")
  ]);

  assert.match(page, /<LooperWebApp \/>/);
  assert.doesNotMatch(page, /SUPABASE|Stripe|Sign In/);
  assert.match(layout, /renderer\/src\/styles\.css/);
  assert.match(layout, /accountDialog\.css/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.doesNotMatch(sitemap, /privacy|support|terms/);
  assert.match(robots, /disallow: \["\/api\/"\]/);
});

test("retires account, cloud-sheet, billing, and admin API routes", async () => {
  const retiredRoutes = [
    "api/v1/account/route.ts",
    "api/v1/admin/access/route.ts",
    "api/v1/billing/status/route.ts",
    "api/v1/shared-sheets/[shareToken]/route.ts",
    "api/v1/sheets/route.ts",
    "api/webhooks/stripe/route.ts"
  ];

  for (const route of retiredRoutes) {
    await assert.rejects(access(new URL(route, appRoot)));
  }
  await access(new URL("api/v1/market-data/route.ts", appRoot));
  await access(new URL("download/route.ts", appRoot));
});

test("does not ship retired private interfaces", async () => {
  for (const route of [
    "admin/page.tsx",
    "billing/complete/page.tsx",
    "privacy/page.tsx",
    "s/[shareToken]/page.tsx",
    "support/page.tsx",
    "terms/page.tsx"
  ]) {
    await assert.rejects(access(new URL(route, appRoot)));
  }
});
