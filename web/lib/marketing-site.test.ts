import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../app/", import.meta.url);

test("serves one account-free marketing and download surface", async () => {
  const [page, layout, sitemap, robots] = await Promise.all([
    readFile(new URL("page.tsx", appRoot), "utf8"),
    readFile(new URL("layout.tsx", appRoot), "utf8"),
    readFile(new URL("sitemap.ts", appRoot), "utf8"),
    readFile(new URL("robots.ts", appRoot), "utf8")
  ]);

  assert.match(page, /Think in numbers/);
  assert.match(page, /No account\. No subscription/);
  assert.match(page, /\.loop/);
  assert.match(page, /Download for Mac/);
  assert.match(page, /Download for Windows/);
  assert.match(page, /View source/);
  assert.match(page, /© \{currentYear\}/);
  assert.match(page, /Ryan Rorke/);
  assert.match(page, /looperCreatorUrl/);
  assert.doesNotMatch(page, /LooperWebApp|SUPABASE|Stripe|Sign In/);
  assert.match(layout, /open-source notebook calculator/);
  assert.doesNotMatch(layout, /renderer\/src\/styles\.css|accountDialog\.css/);
  assert.doesNotMatch(sitemap, /privacy|support|terms/);
  assert.match(robots, /disallow: \["\/api\/"\]/);
});

test("keeps the website footer at the natural bottom of the viewport", async () => {
  const [page, styles, openSource] = await Promise.all([
    readFile(new URL("page.tsx", appRoot), "utf8"),
    readFile(new URL("globals.css", appRoot), "utf8"),
    readFile(new URL("../../electron/src/shared/openSource.ts", appRoot), "utf8")
  ]);

  assert.match(page, /<footer className="site-footer">/);
  assert.match(styles, /\.marketing-site\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*100svh;[^}]*flex-direction:\s*column;/s);
  assert.match(styles, /\.site-footer\s*\{[^}]*margin:\s*auto auto 0;/s);
  assert.match(styles, /\.site-footer a:hover\s*\{[^}]*border-radius|\.site-footer a\s*\{[^}]*border-radius:\s*999px;/s);
  assert.match(openSource, /looperCreatorUrl = "https:\/\/rorkery\.com\/"/);
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

test("does not ship retired browser interfaces", async () => {
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

test("retires the legacy web app worker and its cached main menu", async () => {
  const worker = await readFile(
    new URL("../public/looper-sw.js", import.meta.url),
    "utf8"
  );

  assert.match(worker, /legacyCachePrefix = "looper-app-shell-"/);
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.match(worker, /key\.startsWith\(legacyCachePrefix\)/);
  assert.match(worker, /caches\.delete\(key\)/);
  assert.match(worker, /self\.clients\.claim\(\)/);
  assert.match(worker, /client\.navigate\(client\.url\)/);
  assert.match(worker, /self\.registration\.unregister\(\)/);
  assert.doesNotMatch(worker, /addEventListener\("fetch"/);
});
