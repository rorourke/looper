import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  CloudAccountService,
  createAuthStorageWithEphemeralFallback,
  createEncryptedAuthStorage,
  createEncryptionProviderWithSynchronousFallback,
  type AsyncAuthStorage
} from "./cloudAccount.ts";

const accountId = "11111111-1111-4111-8111-111111111111";
const sheetId = "22222222-2222-4222-8222-222222222222";
const shareToken = "a".repeat(64);
const clientCreatedId = "33333333-3333-4333-8333-333333333333";
const createdAt = "2026-07-18T17:00:00.000Z";
const updatedAt = "2026-07-18T17:01:00.000Z";

function memoryStorage(available = true): AsyncAuthStorage {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    isAvailable: () => available,
    removeItem: async (key) => {
      values.delete(key);
    },
    setItem: async (key, value) => {
      values.set(key, value);
    }
  };
}

function cloudSheet(revision = 1): Record<string, unknown> {
  return {
    id: sheetId,
    clientCreatedId,
    title: "Budget",
    document: { loopCount: 3, text: "rent = 2000" },
    shareEnabled: true,
    shareToken,
    schemaVersion: 1,
    revision,
    createdAt,
    updatedAt
  };
}

function cloudSheetMetadata(revision = 1): Record<string, unknown> {
  const { document: _document, ...metadata } = cloudSheet(revision);
  return metadata;
}

function legacyCloudSheet(revision = 1): Record<string, unknown> {
  const { shareEnabled: _shareEnabled, shareToken: _shareToken, ...sheet } =
    cloudSheet(revision);
  return sheet;
}

function authenticatedService(fetchImplementation: typeof fetch): CloudAccountService {
  return new CloudAccountService({
    authStorage: memoryStorage(),
    createSupabaseClient: () => ({
      auth: {
        getSession: async () => ({
          data: {
            session: {
              access_token: "secret-access-token",
              user: { id: accountId, email: "person@example.com" }
            }
          },
          error: null
        }),
        getUser: async () => ({
          data: { user: { id: accountId, email: "person@example.com" } },
          error: null
        }),
        signInWithOtp: async () => ({ data: {}, error: null }),
        signOut: async () => ({ data: {}, error: null }),
        verifyOtp: async () => ({ data: { session: null, user: null }, error: null })
      }
    }),
    environment: {
      apiUrl: "https://api.looper.example",
      supabasePublishableKey: "sb_publishable_test_key",
      supabaseUrl: "https://project.supabase.co"
    },
    fetch: fetchImplementation
  });
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status
  });
}

describe("Electron cloud account boundary", () => {
  test("accepts only an exact server-verified admin-access response", async () => {
    let request: { init: RequestInit; url: URL } | undefined;
    const service = authenticatedService(async (input, init = {}) => {
      request = {
        init,
        url: new URL(input instanceof Request ? input.url : input.toString())
      };
      return jsonResponse({ admin: true });
    });

    assert.equal(await service.getAdminAccess(), "granted");
    assert.equal(request?.url.pathname, "/api/v1/admin/access");
    assert.equal(request?.init.method, "GET");
    assert.equal(
      new Headers(request?.init.headers).get("Authorization"),
      "Bearer secret-access-token"
    );
  });

  test("fails admin access closed for denials and malformed success payloads", async () => {
    const denied = authenticatedService(async () =>
      jsonResponse({ error: { code: "admin_access_denied", message: "Denied" } }, 403)
    );
    assert.equal(await denied.getAdminAccess(), "denied");

    for (const payload of [
      { admin: false },
      { admin: true, email: "admin@example.invalid" },
      true,
      null
    ]) {
      const malformed = authenticatedService(async () => jsonResponse(payload));
      await assert.rejects(
        malformed.getAdminAccess(),
        /invalid admin-access response/
      );
    }

    const unavailable = authenticatedService(async () =>
      jsonResponse({ error: { code: "server_error", message: "Unavailable" } }, 500)
    );
    await assert.rejects(
      unavailable.getAdminAccess(),
      /Cloud storage could not complete the request/
    );
  });

  test("loads validated admin data with the signed-in app session", async () => {
    let request: { init: RequestInit; url: URL } | undefined;
    const service = authenticatedService(async (input, init = {}) => {
      request = {
        init,
        url: new URL(input instanceof Request ? input.url : input.toString())
      };
      return jsonResponse({
        overview: {
          accountCount: 1,
          accounts: [
            {
              createdAt,
              email: "person@example.com",
              grossRevenueCents: 299,
              id: accountId,
              lastSignInAt: updatedAt,
              paymentCount: 1,
              purchasedSheetCount: 5,
              sheetCount: 1,
              sheets: [
                {
                  createdAt,
                  id: sheetId,
                  title: "Budget",
                  updatedAt
                }
              ],
              sheetsTruncated: false
            }
          ],
          generatedAt: updatedAt,
          grossRevenueCents: 299,
          pagination: {
            hasNextPage: false,
            hasPreviousPage: false,
            page: 1,
            pageCount: 1,
            pageSize: 50,
            totalItems: 1
          },
          paymentCount: 1,
          paymentCurrency: "USD",
          sheetCount: 1
        }
      });
    });

    const overview = await service.getAdminOverview();
    assert.equal(overview.accounts[0].sheets[0].title, "Budget");
    assert.equal(request?.url.pathname, "/api/v1/admin/accounts");
    assert.equal(request?.url.search, "?page=1");
    assert.equal(request?.init.method, "GET");
    assert.equal(
      new Headers(request?.init.headers).get("Authorization"),
      "Bearer secret-access-token"
    );
  });

  test("rejects invalid admin pages before fetching and caps admin responses at one MiB", async () => {
    let requests = 0;
    const service = authenticatedService(async () => {
      requests += 1;
      return new Response("x", {
        headers: { "Content-Length": String(1024 * 1024 + 1) }
      });
    });

    await assert.rejects(service.getAdminOverview(0), /admin page is invalid/);
    assert.equal(requests, 0);
    await assert.rejects(service.getAdminOverview(1), /response that was too large/);
    assert.equal(requests, 1);
  });

  test("loads a full sheet through the admin-only detail endpoint", async () => {
    let request: { init: RequestInit; url: URL } | undefined;
    const service = authenticatedService(async (input, init = {}) => {
      request = {
        init,
        url: new URL(input instanceof Request ? input.url : input.toString())
      };
      return jsonResponse({ sheet: cloudSheet() });
    });

    const detail = await service.getAdminSheet(sheetId);
    assert.equal(detail.document.text, "rent = 2000");
    assert.equal(request?.url.pathname, `/api/v1/admin/sheets/${sheetId}`);
    assert.equal(request?.init.method, "GET");
  });

  test("validates billing status and Stripe-hosted checkout URLs", async () => {
    const requests: string[] = [];
    const service = authenticatedService(async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requests.push(`${init.method} ${url.pathname}`);
      if (url.pathname.endsWith("/status")) {
        return jsonResponse({
          billing: {
            billingConfigured: true,
            canCreateSheet: false,
            canPurchaseSheets: true,
            sheetCount: 4,
            sheetLimit: 4,
            unusedSheetCount: 0
          }
        });
      }
      if (url.pathname.endsWith("/checkout")) {
        return jsonResponse({ url: "https://checkout.stripe.com/c/pay/test" });
      }
      return jsonResponse({ url: "https://billing.stripe.com/p/session/test" });
    });

    assert.equal((await service.getBillingStatus()).canCreateSheet, false);
    assert.equal(
      await service.createBillingCheckout("sheet-pack-50"),
      "https://checkout.stripe.com/c/pay/test"
    );
    assert.deepEqual(requests, [
      "GET /api/v1/billing/status",
      "POST /api/v1/billing/checkout"
    ]);
  });

  test("normalizes email OTP input and never returns the Supabase session", async () => {
    const authCalls: Array<Record<string, unknown>> = [];
    const signOutScopes: string[] = [];
    let factoryOptions: Record<string, unknown> | undefined;
    const session = {
      access_token: "secret-access-token",
      user: { id: accountId, email: "person@example.com", private: "not-renderer-data" }
    };
    const service = new CloudAccountService({
      authStorage: memoryStorage(),
      createSupabaseClient: (_url, _key, options) => {
        factoryOptions = options.auth as unknown as Record<string, unknown>;
        return {
          auth: {
            getSession: async () => ({ data: { session }, error: null }),
            getUser: async (accessToken) => {
              assert.equal(accessToken, "secret-access-token");
              return { data: { user: session.user }, error: null };
            },
            signInWithOtp: async (input) => {
              authCalls.push(input);
              return { data: {}, error: null };
            },
            signOut: async (options) => {
              assert.ok(options?.scope === "local" || options?.scope === "global");
              signOutScopes.push(options.scope);
              return { data: {}, error: null };
            },
            verifyOtp: async (input) => {
              authCalls.push(input);
              return { data: { session, user: session.user }, error: null };
            }
          }
        };
      },
      environment: {
        apiUrl: "https://api.looper.example",
        supabasePublishableKey: "sb_publishable_test_key",
        supabaseUrl: "https://project.supabase.co"
      }
    });

    assert.deepEqual(await service.getCloudConfiguration(), {
      apiConfigured: true,
      authConfigured: true,
      configured: true,
      secureStorageAvailable: true
    });
    await service.requestEmailCode("  Person@Example.COM ");
    const verified = await service.verifyEmailCode("person@example.com", "123456");
    assert.deepEqual(verified, { email: "person@example.com", id: accountId });
    assert.deepEqual(await service.getAccount(), verified);
    assert.equal(JSON.stringify(verified).includes("secret-access-token"), false);
    assert.deepEqual(authCalls, [
      {
        email: "person@example.com",
        options: { shouldCreateUser: true }
      },
      { email: "person@example.com", token: "123456", type: "email" }
    ]);
    assert.equal(factoryOptions?.persistSession, true);
    assert.equal(factoryOptions?.autoRefreshToken, true);
    assert.equal(factoryOptions?.detectSessionInUrl, false);
    assert.equal(factoryOptions?.flowType, "pkce");

    await service.signOut();
    await service.signOut("global");
    assert.deepEqual(signOutScopes, ["local", "global"]);
  });

  test("deletes an account only through the authenticated confirmation route", async () => {
    let request: { init: RequestInit; url: URL } | undefined;
    const service = authenticatedService(async (input, init = {}) => {
      request = {
        init,
        url: new URL(input instanceof Request ? input.url : input.toString())
      };
      return jsonResponse({ deleted: true });
    });

    await service.deleteAccount();

    assert.equal(request?.url.pathname, "/api/v1/account");
    assert.equal(request?.init.method, "DELETE");
    assert.equal(
      new Headers(request?.init.headers).get("Authorization"),
      "Bearer secret-access-token"
    );
    assert.deepEqual(JSON.parse(String(request?.init.body)), {
      confirmation: "DELETE"
    });
  });

  test("uses a PKCE browser round trip for Google without exposing the session", async () => {
    const oauthCalls: unknown[] = [];
    const service = new CloudAccountService({
      authStorage: memoryStorage(),
      createSupabaseClient: () => ({
        auth: {
          exchangeCodeForSession: async (code) => {
            oauthCalls.push(code);
            return {
              data: {
                session: { access_token: "google-secret-token" },
                user: { id: accountId, email: "person@example.com" }
              },
              error: null
            };
          },
          getSession: async () => ({ data: { session: null }, error: null }),
          getUser: async () => ({ data: { user: null }, error: null }),
          signInWithOAuth: async (input) => {
            oauthCalls.push(input);
            return {
              data: {
                provider: "google",
                url: "https://project.supabase.co/auth/v1/authorize?provider=google"
              },
              error: null
            };
          },
          signInWithOtp: async () => ({ data: {}, error: null }),
          signOut: async () => ({ data: {}, error: null }),
          verifyOtp: async () => ({ data: { session: null, user: null }, error: null })
        }
      }),
      environment: {
        apiUrl: "https://api.looper.example",
        supabasePublishableKey: "sb_publishable_test_key",
        supabaseUrl: "https://project.supabase.co"
      }
    });

    assert.equal(
      await service.createGoogleSignInUrl("looper://auth/callback"),
      "https://project.supabase.co/auth/v1/authorize?provider=google"
    );
    const account = await service.completeGoogleSignIn(
      "looper://auth/callback?code=secure-oauth-code"
    );
    assert.deepEqual(account, { email: "person@example.com", id: accountId });
    assert.equal(JSON.stringify(account).includes("google-secret-token"), false);
    assert.deepEqual(oauthCalls, [
      {
        options: {
          redirectTo: "looper://auth/callback",
          skipBrowserRedirect: true
        },
        provider: "google"
      },
      "secure-oauth-code"
    ]);
  });

  test("rejects malformed authentication input before initializing Supabase", async () => {
    let factoryCalls = 0;
    const service = new CloudAccountService({
      authStorage: memoryStorage(),
      createSupabaseClient: () => {
        factoryCalls += 1;
        throw new Error("must not initialize");
      },
      environment: {
        apiUrl: "https://api.looper.example",
        supabasePublishableKey: "sb_publishable_test_key",
        supabaseUrl: "https://project.supabase.co"
      }
    });

    await assert.rejects(
      service.requestEmailCode("not-an-email"),
      /valid email address/
    );
    await assert.rejects(
      service.verifyEmailCode("person@example.com", "12345"),
      /six-digit code/
    );
    assert.equal(factoryCalls, 0);
  });

  test("treats a rejected local account identity as signed out", async () => {
    const service = new CloudAccountService({
      authStorage: memoryStorage(),
      createSupabaseClient: () => ({
        auth: {
          getSession: async () => ({
            data: {
              session: {
                access_token: "expired-or-forged-token",
                user: { id: accountId, email: "forged@example.com" }
              }
            },
            error: null
          }),
          getUser: async () => ({
            data: { user: null },
            error: Object.assign(new Error("invalid JWT"), {
              name: "AuthApiError",
              status: 401
            })
          }),
          signInWithOtp: async () => ({ data: {}, error: null }),
          signOut: async () => ({ data: {}, error: null }),
          verifyOtp: async () => ({ data: { session: null, user: null }, error: null })
        }
      }),
      environment: {
        apiUrl: "https://api.looper.example",
        supabasePublishableKey: "sb_publishable_test_key",
        supabaseUrl: "https://project.supabase.co"
      }
    });

    assert.equal(await service.getAccount(), null);
  });

  test("uses the locally stored account identity when verification is offline", async () => {
    const service = new CloudAccountService({
      authStorage: memoryStorage(),
      createSupabaseClient: () => ({
        auth: {
          getSession: async () => ({
            data: {
              session: {
                access_token: "cached-access-token",
                user: { id: accountId, email: "person@example.com" }
              }
            },
            error: null
          }),
          getUser: async () => {
            throw new TypeError("fetch failed");
          },
          signInWithOtp: async () => ({ data: {}, error: null }),
          signOut: async () => ({ data: {}, error: null }),
          verifyOtp: async () => ({
            data: { session: null, user: null },
            error: null
          })
        }
      }),
      environment: {
        apiUrl: "https://api.looper.example",
        supabasePublishableKey: "sb_publishable_test_key",
        supabaseUrl: "https://project.supabase.co"
      }
    });

    assert.deepEqual(await service.getAccount(), {
      email: "person@example.com",
      id: accountId
    });
  });

  test("restores the last verified identity after an offline token-refresh failure", async () => {
    let online = true;
    const service = new CloudAccountService({
      authStorage: memoryStorage(),
      createSupabaseClient: () => ({
        auth: {
          getSession: async () =>
            online
              ? {
                  data: {
                    session: {
                      access_token: "cached-access-token",
                      user: { id: accountId, email: "person@example.com" }
                    }
                  },
                  error: null
                }
              : {
                  data: { session: null },
                  error: Object.assign(new Error("fetch failed"), {
                    name: "AuthRetryableFetchError"
                  })
                },
          getUser: async () => ({
            data: { user: { id: accountId, email: "person@example.com" } },
            error: null
          }),
          signInWithOtp: async () => ({ data: {}, error: null }),
          signOut: async () => ({ data: {}, error: null }),
          verifyOtp: async () => ({
            data: { session: null, user: null },
            error: null
          })
        }
      }),
      environment: {
        apiUrl: "https://api.looper.example",
        supabasePublishableKey: "sb_publishable_test_key",
        supabaseUrl: "https://project.supabase.co"
      }
    });

    assert.equal((await service.getAccount())?.id, accountId);
    online = false;
    assert.deepEqual(await service.getAccount(), {
      email: "person@example.com",
      id: accountId
    });
  });

  test("treats a terminal refresh failure as signed out", async () => {
    const service = new CloudAccountService({
      authStorage: memoryStorage(),
      createSupabaseClient: () => ({
        auth: {
          getSession: async () => ({
            data: { session: null },
            error: Object.assign(new Error("Invalid Refresh Token"), {
              name: "AuthApiError",
              status: 400
            })
          }),
          getUser: async () => ({ data: { user: null }, error: null }),
          signInWithOtp: async () => ({ data: {}, error: null }),
          signOut: async () => ({ data: {}, error: null }),
          verifyOtp: async () => ({ data: { session: null, user: null }, error: null })
        }
      }),
      environment: {
        apiUrl: "https://api.looper.example",
        supabasePublishableKey: "sb_publishable_test_key",
        supabaseUrl: "https://project.supabase.co"
      }
    });

    assert.equal(await service.getAccount(), null);
  });

  test("keeps retryable refresh failures visible", async () => {
    const service = new CloudAccountService({
      authStorage: memoryStorage(),
      createSupabaseClient: () => ({
        auth: {
          getSession: async () => ({
            data: { session: null },
            error: Object.assign(new Error("fetch failed"), {
              name: "AuthRetryableFetchError",
              status: 0
            })
          }),
          getUser: async () => ({ data: { user: null }, error: null }),
          signInWithOtp: async () => ({ data: {}, error: null }),
          signOut: async () => ({ data: {}, error: null }),
          verifyOtp: async () => ({ data: { session: null, user: null }, error: null })
        }
      }),
      environment: {
        apiUrl: "https://api.looper.example",
        supabasePublishableKey: "sb_publishable_test_key",
        supabaseUrl: "https://project.supabase.co"
      }
    });

    await assert.rejects(service.getAccount(), /Could not restore your account session/);
  });

  test("sends only validated revisioned sheet payloads with the bearer token", async () => {
    const requests: Array<{ init: RequestInit; url: URL }> = [];
    const service = new CloudAccountService({
      authStorage: memoryStorage(),
      createSupabaseClient: () => ({
        auth: {
          getSession: async () => ({
            data: {
              session: {
                access_token: "secret-access-token",
                user: { id: accountId, email: "person@example.com" }
              }
            },
            error: null
          }),
          getUser: async () => ({
            data: { user: { id: accountId, email: "person@example.com" } },
            error: null
          }),
          signInWithOtp: async () => ({ data: {}, error: null }),
          signOut: async () => ({ data: {}, error: null }),
          verifyOtp: async () => ({ data: { session: null, user: null }, error: null })
        }
      }),
      environment: {
        apiUrl: "https://api.looper.example/a-prefix",
        supabasePublishableKey: "sb_publishable_test_key",
        supabaseUrl: "https://project.supabase.co"
      },
      fetch: async (input, init = {}) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        requests.push({ init, url });
        if (init.method === "GET" && url.pathname === "/api/v1/sheets") {
          return jsonResponse({ nextCursor: null, sheets: [cloudSheetMetadata()] });
        }
        if (init.method === "GET" && url.pathname === "/api/v1/sheets/batch") {
          return jsonResponse({ sheets: [cloudSheet()], missingIds: [] });
        }
        if (init.method === "POST") return jsonResponse({ sheet: cloudSheet() }, 201);
        if (init.method === "PATCH") return jsonResponse({ sheet: cloudSheet(2) });
        return new Response(null, { status: 204 });
      }
    });

    assert.equal((await service.listCloudSheets())[0].id, sheetId);
    await service.createCloudSheet({
      clientCreatedId,
      title: "  Budget  ",
      document: { text: "rent = 2000" }
    });
    await service.updateCloudSheet({
      id: sheetId,
      title: "Budget",
      document: { text: "rent = 2100" },
      expectedRevision: 1
    });
    await service.updateCloudSheet({
      id: sheetId,
      expectedRevision: 2,
      shareEnabled: false
    });
    await service.deleteCloudSheet({ id: sheetId, expectedRevision: 2 });

    assert.deepEqual(
      requests.map((request) => [request.init.method, request.url.pathname]),
      [
        ["GET", "/api/v1/sheets"],
        ["GET", "/api/v1/sheets/batch"],
        ["POST", "/api/v1/sheets"],
        ["PATCH", `/api/v1/sheets/${sheetId}`],
        ["PATCH", `/api/v1/sheets/${sheetId}`],
        ["DELETE", `/api/v1/sheets/${sheetId}`]
      ]
    );
    assert.equal(requests[0].url.searchParams.get("limit"), "100");
    assert.equal(requests[0].url.searchParams.has("cursor"), false);
    assert.equal(requests[1].url.searchParams.get("ids"), sheetId);
    for (const request of requests) {
      const headers = new Headers(request.init.headers);
      assert.equal(headers.get("Authorization"), "Bearer secret-access-token");
      assert.equal(request.init.credentials, "omit");
      assert.equal(request.init.redirect, "error");
    }
    assert.deepEqual(JSON.parse(String(requests[2].init.body)), {
      clientCreatedId,
      title: "Budget",
      document: { text: "rent = 2000" },
      schemaVersion: 1
    });
    assert.deepEqual(JSON.parse(String(requests[3].init.body)), {
      title: "Budget",
      document: { text: "rent = 2100" },
      schemaVersion: 1,
      expectedRevision: 1
    });
    assert.deepEqual(JSON.parse(String(requests[4].init.body)), {
      expectedRevision: 2,
      shareEnabled: false
    });
    assert.deepEqual(JSON.parse(String(requests[5].init.body)), {
      expectedRevision: 2
    });
  });

  test("keeps legacy sheet rows usable while the sharing API is still rolling out", async () => {
    const legacySheet = legacyCloudSheet();
    const { document: _document, ...legacyMetadata } = legacySheet;
    const service = authenticatedService(async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (init.method === "GET" && url.pathname === "/api/v1/sheets") {
        return jsonResponse({ nextCursor: null, sheets: [legacyMetadata] });
      }
      if (init.method === "GET" && url.pathname === "/api/v1/sheets/batch") {
        return jsonResponse({ sheets: [legacySheet], missingIds: [] });
      }
      return jsonResponse({ sheet: legacySheet }, 201);
    });

    const [listed] = await service.listCloudSheets();
    assert.equal(listed.id, sheetId);
    assert.equal(listed.shareEnabled, false);
    assert.equal(listed.shareToken, undefined);

    const created = await service.createCloudSheet({
      clientCreatedId,
      title: "Budget",
      document: { text: "rent = 2000" }
    });
    assert.equal(created.id, sheetId);
    assert.equal(created.shareEnabled, false);
    assert.equal(created.shareToken, undefined);
  });

  test("still rejects incomplete or malformed sharing fields", async () => {
    for (const invalidSheet of [
      { ...legacyCloudSheet(), shareEnabled: true },
      { ...legacyCloudSheet(), shareToken },
      { ...legacyCloudSheet(), shareEnabled: true, shareToken: "invalid" }
    ]) {
      const service = authenticatedService(async () =>
        jsonResponse({ sheet: invalidSheet }, 201)
      );
      await assert.rejects(
        service.createCloudSheet({
          clientCreatedId,
          title: "Budget",
          document: { text: "rent = 2000" }
        }),
        /sharing setting|Shareable sheet URL/
      );
    }
  });

  test("uses the capability URL without an account token and builds the canonical web link", async () => {
    const requests: Array<{ init: RequestInit; url: URL }> = [];
    const service = authenticatedService(async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requests.push({ init, url });
      if (init.method === "GET") return jsonResponse({ sheet: cloudSheet() });
      return jsonResponse({ sheet: cloudSheet(2) });
    });

    assert.equal((await service.getSharedCloudSheet(shareToken))?.id, sheetId);
    assert.equal(
      (
        await service.updateSharedCloudSheet({
          document: { text: "rent = 2100" },
          expectedRevision: 1,
          shareToken
        })
      ).revision,
      2
    );
    assert.equal(
      service.shareableUrl({ shareToken }),
      `https://api.looper.example/s/${shareToken}`
    );

    assert.equal(requests.length, 2);
    for (const request of requests) {
      assert.equal(new Headers(request.init.headers).has("Authorization"), false);
      assert.equal(request.init.credentials, "omit");
      assert.equal(request.init.redirect, "error");
      assert.equal(request.url.pathname, `/api/v1/shared-sheets/${shareToken}`);
    }
    assert.deepEqual(JSON.parse(String(requests[1].init.body)), {
      document: { text: "rent = 2100" },
      schemaVersion: 1,
      expectedRevision: 1
    });
  });

  test("paginates metadata and hydrates at most three sheets in six concurrent batches", async () => {
    const metadata = Array.from({ length: 100 }, (_, index) => {
      const suffix = (index + 1).toString(16).padStart(12, "0");
      return {
        id: `aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`,
        clientCreatedId: `bbbbbbbb-bbbb-4bbb-8bbb-${suffix}`,
        title: `Sheet ${index + 1}`,
        shareEnabled: true,
        shareToken: suffix.padStart(64, "0"),
        schemaVersion: 1,
        revision: 1,
        createdAt,
        updatedAt
      };
    });
    const listRequests: URL[] = [];
    let batchRequests = 0;
    let activeBatchRequests = 0;
    let maximumActiveBatchRequests = 0;
    const service = authenticatedService(async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/api/v1/sheets") {
        listRequests.push(url);
        const cursor = url.searchParams.get("cursor");
        return cursor === null
          ? jsonResponse({
              sheets: metadata.slice(0, 60),
              nextCursor: metadata[59].id
            })
          : jsonResponse({ sheets: metadata.slice(60), nextCursor: null });
      }

      assert.equal(url.pathname, "/api/v1/sheets/batch");
      assert.equal(init.method, "GET");
      batchRequests += 1;
      activeBatchRequests += 1;
      maximumActiveBatchRequests = Math.max(
        maximumActiveBatchRequests,
        activeBatchRequests
      );
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeBatchRequests -= 1;
      const ids = (url.searchParams.get("ids") ?? "").split(",");
      assert.ok(ids.length >= 1 && ids.length <= 3);
      const sheets = ids.map((id) => {
        const summary = metadata.find((candidate) => candidate.id === id);
        assert.ok(summary);
        return { ...summary, document: { text: summary.title } };
      });
      return jsonResponse({ sheets, missingIds: [] });
    });

    const sheets = await service.listCloudSheets();
    assert.equal(sheets.length, 100);
    assert.equal(new Set(sheets.map((sheet) => sheet.id)).size, 100);
    assert.equal(listRequests.length, 2);
    assert.equal(listRequests[0].searchParams.get("limit"), "100");
    assert.equal(listRequests[0].searchParams.has("cursor"), false);
    assert.equal(listRequests[1].searchParams.get("cursor"), metadata[59].id);
    assert.equal(batchRequests, Math.ceil(metadata.length / 3));
    assert.ok(maximumActiveBatchRequests > 1);
    assert.ok(maximumActiveBatchRequests <= 6);
  });

  test("omits only sheet IDs explicitly classified as missing by a complete batch", async () => {
    const ids = [
      "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
      "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
      "aaaaaaaa-aaaa-4aaa-8aaa-000000000003"
    ];
    const metadata = ids.map((id, index) => ({
      ...cloudSheetMetadata(),
      id,
      clientCreatedId: `bbbbbbbb-bbbb-4bbb-8bbb-${(index + 1)
        .toString(16)
        .padStart(12, "0")}`,
      title: `Sheet ${index + 1}`
    }));
    const service = authenticatedService(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/api/v1/sheets") {
        return jsonResponse({ sheets: metadata, nextCursor: null });
      }
      return jsonResponse({
        sheets: [
          { ...metadata[0], document: { text: "first" } },
          { ...metadata[2], document: { text: "third" } }
        ],
        missingIds: [metadata[1].id]
      });
    });

    assert.deepEqual(
      (await service.listCloudSheets()).map((sheet) => sheet.id).sort(),
      [ids[0], ids[2]]
    );
  });

  test("rejects duplicate, unknown, overlapping, and incomplete batch partitions", async () => {
    const first = {
      ...cloudSheet(),
      id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001"
    };
    const second = {
      ...cloudSheet(),
      id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002"
    };
    const unknown = {
      ...cloudSheet(),
      id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000003"
    };
    const metadata = [first, second].map((sheet) => ({
      ...cloudSheetMetadata(),
      id: sheet.id
    }));
    const invalidPartitions = [
      { sheets: [first, first], missingIds: [second.id] },
      { sheets: [first, unknown], missingIds: [second.id] },
      { sheets: [first], missingIds: [first.id, second.id] },
      { sheets: [first], missingIds: [] }
    ];

    for (const partition of invalidPartitions) {
      const service = authenticatedService(async (input) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        return url.pathname === "/api/v1/sheets"
          ? jsonResponse({ sheets: metadata, nextCursor: null })
          : jsonResponse(partition);
      });
      await assert.rejects(
        service.listCloudSheets(),
        /invalid sheet batch|incomplete sheet batch/
      );
    }
  });

  test("stops scheduling new hydration batches after the first failure", async () => {
    const metadata = Array.from({ length: 30 }, (_, index) => {
      const suffix = (index + 1).toString(16).padStart(12, "0");
      return {
        id: `aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`,
        clientCreatedId: `bbbbbbbb-bbbb-4bbb-8bbb-${suffix}`,
        title: `Sheet ${index + 1}`,
        shareEnabled: true,
        shareToken: suffix.padStart(64, "0"),
        schemaVersion: 1,
        revision: 1,
        createdAt,
        updatedAt
      };
    });
    let batchRequests = 0;
    let releaseInitialRequests: (() => void) | undefined;
    const initialRequestsStarted = new Promise<void>((resolve) => {
      releaseInitialRequests = resolve;
    });
    const service = authenticatedService(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/api/v1/sheets") {
        return jsonResponse({ sheets: metadata, nextCursor: null });
      }

      batchRequests += 1;
      const requestNumber = batchRequests;
      if (batchRequests === 6) releaseInitialRequests?.();
      await initialRequestsStarted;
      if (requestNumber === 1) {
        return jsonResponse(
          { error: { code: "database_error", message: "Unavailable." } },
          500
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
      const ids = (url.searchParams.get("ids") ?? "").split(",");
      return jsonResponse({
        sheets: ids.map((id) => ({
          ...metadata.find((sheet) => sheet.id === id)!,
          document: {}
        })),
        missingIds: []
      });
    });

    await assert.rejects(service.listCloudSheets(), /could not complete/);
    assert.equal(batchRequests, 6);
  });

  test("never treats a generic route 404 as a vanished sheet", async () => {
    const metadata = [cloudSheetMetadata()];
    const service = authenticatedService(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.pathname === "/api/v1/sheets") {
        return jsonResponse({ sheets: metadata, nextCursor: null });
      }
      return new Response("route missing", {
        headers: { "Content-Type": "text/html" },
        status: 404
      });
    });

    await assert.rejects(service.listCloudSheets(), /no longer exists/);
  });

  test("classifies only a validated sheet_not_found error as single-sheet disappearance", async () => {
    const vanished = authenticatedService(async () =>
      jsonResponse(
        { error: { code: "sheet_not_found", message: "The sheet was not found." } },
        404
      )
    );
    assert.equal(await vanished.getCloudSheet(sheetId), undefined);

    const genericRoute404 = authenticatedService(async () =>
      new Response("route missing", {
        headers: { "Content-Type": "text/html" },
        status: 404
      })
    );
    await assert.rejects(genericRoute404.getCloudSheet(sheetId), /no longer exists/);

    const wrongCode = authenticatedService(async () =>
      jsonResponse(
        { error: { code: "route_not_found", message: "The route was not found." } },
        404
      )
    );
    await assert.rejects(wrongCode.getCloudSheet(sheetId), /no longer exists/);
  });

  test("rejects metadata beyond the generous client safety ceiling", async () => {
    let requests = 0;
    const service = authenticatedService(async (input) => {
      requests += 1;
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const cursor = url.searchParams.get("cursor");
      const firstNumber = cursor
        ? Number.parseInt(cursor.slice(-12), 16) + 1
        : 1;
      const metadata = Array.from({ length: 100 }, (_, index) => {
        const suffix = (firstNumber + index).toString(16).padStart(12, "0");
        return {
          ...cloudSheetMetadata(),
          id: `aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`,
          clientCreatedId: `bbbbbbbb-bbbb-4bbb-8bbb-${suffix}`
        };
      });
      return jsonResponse({
        sheets: metadata,
        nextCursor: metadata.at(-1)!.id
      });
    });

    await assert.rejects(service.listCloudSheets(), /too many sheets/);
    assert.equal(requests, 100);
  });

  test("rejects malformed or looping metadata pagination", async () => {
    const service = authenticatedService(async () =>
      jsonResponse({ sheets: [], nextCursor: sheetId })
    );
    await assert.rejects(service.listCloudSheets(), /invalid sheet pagination/);
  });

  test("rejects unsafe sheet input without making a cloud request", async () => {
    let fetchCalls = 0;
    const service = new CloudAccountService({
      authStorage: memoryStorage(),
      createSupabaseClient: () => ({
        auth: {
          getSession: async () => ({
            data: {
              session: {
                access_token: "secret-access-token",
                user: { id: accountId, email: "person@example.com" }
              }
            },
            error: null
          }),
          getUser: async () => ({
            data: { user: { id: accountId, email: "person@example.com" } },
            error: null
          }),
          signInWithOtp: async () => ({ data: {}, error: null }),
          signOut: async () => ({ data: {}, error: null }),
          verifyOtp: async () => ({ data: { session: null, user: null }, error: null })
        }
      }),
      environment: {
        apiUrl: "https://api.looper.example",
        supabasePublishableKey: "sb_publishable_test_key",
        supabaseUrl: "https://project.supabase.co"
      },
      fetch: async () => {
        fetchCalls += 1;
        return jsonResponse({ sheet: cloudSheet() });
      }
    });

    await assert.rejects(
      service.createCloudSheet({
        clientCreatedId: "not-a-uuid",
        title: "Budget",
        document: {}
      }),
      /ID is invalid/
    );
    await assert.rejects(
      service.createCloudSheet({
        clientCreatedId,
        title: "x".repeat(201),
        document: {}
      }),
      /between 1 and 200/
    );
    await assert.rejects(
      service.createCloudSheet({ clientCreatedId, title: "Budget", document: [] }),
      /JSON object/
    );
    await assert.rejects(
      service.createCloudSheet({
        clientCreatedId,
        title: "Budget",
        document: { value: BigInt(1) }
      }),
      /only JSON values/
    );
    await assert.rejects(
      service.createCloudSheet({
        clientCreatedId,
        title: "Budget",
        document: { text: "x".repeat(1024 * 1024) }
      }),
      /larger than 1 MiB/
    );
    await assert.rejects(
      service.updateCloudSheet({
        id: sheetId,
        title: "Budget",
        document: {},
        expectedRevision: 0
      }),
      /revision is invalid/
    );
    assert.equal(fetchCalls, 0);
  });

  test("maps API failures to useful errors without echoing server secrets", async () => {
    const service = new CloudAccountService({
      authStorage: memoryStorage(),
      createSupabaseClient: () => ({
        auth: {
          getSession: async () => ({
            data: {
              session: {
                access_token: "secret-access-token",
                user: { id: accountId, email: "person@example.com" }
              }
            },
            error: null
          }),
          getUser: async () => ({
            data: { user: { id: accountId, email: "person@example.com" } },
            error: null
          }),
          signInWithOtp: async () => ({ data: {}, error: null }),
          signOut: async () => ({ data: {}, error: null }),
          verifyOtp: async () => ({ data: { session: null, user: null }, error: null })
        }
      }),
      environment: {
        apiUrl: "https://api.looper.example",
        supabasePublishableKey: "sb_publishable_test_key",
        supabaseUrl: "https://project.supabase.co"
      },
      fetch: async () =>
        jsonResponse({ error: "database-password-and-internal-query" }, 409)
    });

    await assert.rejects(service.listCloudSheets(), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /another device/);
      assert.doesNotMatch(error.message, /database-password/);
      assert.doesNotMatch(error.message, /secret-access-token/);
      return true;
    });
  });

  test("maps a sheet-limit rejection to the quota recovery path", async () => {
    const service = authenticatedService(async () =>
      jsonResponse(
        {
          error: {
            code: "sheet_limit_reached",
            message: "active sheet limit exceeded"
          }
        },
        402
      )
    );

    await assert.rejects(
      service.createCloudSheet({
        clientCreatedId,
        title: "Budget",
        document: { text: "rent = 2000" }
      }),
      /no unused sheets/i
    );
  });
});

describe("encrypted Supabase auth storage", () => {
  test("falls back to synchronous OS encryption when async Keychain writes fail", async () => {
    const encryption = createEncryptionProviderWithSynchronousFallback({
      decryptString: (encrypted) =>
        Buffer.from(
          encrypted.toString("utf8").slice("sync:".length),
          "base64"
        ).toString("utf8"),
      decryptStringAsync: async () => {
        throw new Error("async Keychain authorization failed");
      },
      encryptString: (plainText) =>
        Buffer.from(
          `sync:${Buffer.from(plainText, "utf8").toString("base64")}`,
          "utf8"
        ),
      encryptStringAsync: async () => {
        throw new Error("async Keychain authorization failed");
      },
      isAsyncEncryptionAvailable: async () => true,
      isEncryptionAvailable: () => true
    });

    assert.equal(await encryption.isAsyncEncryptionAvailable(), true);
    const encrypted = await encryption.encryptStringAsync("secret");
    assert.equal(encrypted.toString("utf8").startsWith("sync:"), true);
    assert.deepEqual(await encryption.decryptStringAsync(encrypted), {
      result: "secret",
      shouldReEncrypt: false
    });
  });

  test("reports encryption unavailable when neither OS provider can be used", async () => {
    const encryption = createEncryptionProviderWithSynchronousFallback({
      decryptString: () => {
        throw new Error("unexpected synchronous decryption");
      },
      decryptStringAsync: async () => {
        throw new Error("unexpected async decryption");
      },
      encryptString: () => {
        throw new Error("unexpected synchronous encryption");
      },
      encryptStringAsync: async () => {
        throw new Error("unexpected async encryption");
      },
      isAsyncEncryptionAvailable: async () => false,
      isEncryptionAvailable: () => false
    });

    assert.equal(await encryption.isAsyncEncryptionAvailable(), false);
    await assert.rejects(
      encryption.encryptStringAsync("secret"),
      /Platform encryption is unavailable/
    );
  });

  test("serializes mutations and never writes plaintext session values", async () => {
    const directory = await mkdtemp(join(tmpdir(), "looper-cloud-auth-"));
    const filePath = join(directory, "auth.json");
    const encryption = {
      decryptStringAsync: async (encrypted: Buffer) => {
        const encoded = encrypted.toString("utf8");
        if (!encoded.startsWith("encrypted:")) throw new Error("invalid ciphertext");
        return {
          result: Buffer.from(
            encoded.slice("encrypted:".length),
            "base64"
          ).toString("utf8"),
          shouldReEncrypt: false
        };
      },
      encryptStringAsync: async (plainText: string): Promise<Buffer> =>
        Buffer.from(`encrypted:${Buffer.from(plainText).toString("base64")}`, "utf8"),
      isAsyncEncryptionAvailable: async (): Promise<boolean> => true
    };
    const storage = createEncryptedAuthStorage({ encryption, filePath });

    try {
      await Promise.all([
        storage.setItem("session-a", "refresh-token-a"),
        storage.setItem("session-b", "refresh-token-b")
      ]);
      assert.equal(await storage.getItem("session-a"), "refresh-token-a");
      assert.equal(await storage.getItem("session-b"), "refresh-token-b");
      const raw = await readFile(filePath, "utf8");
      assert.equal(raw.includes("refresh-token-a"), false);
      assert.equal(raw.includes("refresh-token-b"), false);

      await storage.removeItem("session-a");
      assert.equal(await storage.getItem("session-a"), null);
      assert.equal(await storage.getItem("session-b"), "refresh-token-b");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("fails closed when platform encryption is unavailable", async () => {
    const storage = createEncryptedAuthStorage({
      encryption: {
        decryptStringAsync: async () => ({ result: "", shouldReEncrypt: false }),
        encryptStringAsync: async () => Buffer.alloc(0),
        isAsyncEncryptionAvailable: async () => false
      },
      filePath: join(tmpdir(), "looper-cloud-auth-unavailable.json")
    });
    await assert.rejects(storage.setItem("session", "token"), /unavailable/);
    await assert.rejects(storage.getItem("session"), /unavailable/);
  });

  test("clears an unreadable saved session so a fresh sign-in can begin", async () => {
    const directory = await mkdtemp(join(tmpdir(), "looper-cloud-auth-recovery-"));
    const filePath = join(directory, "auth.json");
    let decryptionAvailable = true;
    let codeRequests = 0;
    const storage = createEncryptedAuthStorage({
      encryption: {
        decryptStringAsync: async (encrypted) => {
          if (!decryptionAvailable) throw new Error("key changed");
          return {
            result: encrypted.toString("utf8"),
            shouldReEncrypt: false
          };
        },
        encryptStringAsync: async (plainText) => Buffer.from(plainText, "utf8"),
        isAsyncEncryptionAvailable: async () => true
      },
      filePath
    });

    try {
      await storage.setItem("session", JSON.stringify({ access_token: "old-token" }));
      decryptionAvailable = false;
      const service = new CloudAccountService({
        authStorage: storage,
        createSupabaseClient: () => ({
          auth: {
            getSession: async () => {
              await storage.getItem("session");
              return { data: { session: null }, error: null };
            },
            getUser: async () => ({ data: { user: null }, error: null }),
            signInWithOtp: async () => {
              codeRequests += 1;
              return { data: {}, error: null };
            },
            signOut: async () => ({ data: {}, error: null }),
            verifyOtp: async () => ({
              data: { session: null, user: null },
              error: null
            })
          }
        }),
        environment: {
          apiUrl: "https://api.looper.example",
          supabasePublishableKey: "sb_publishable_test_key",
          supabaseUrl: "https://project.supabase.co"
        }
      });

      assert.equal(await service.getAccount(), null);
      assert.equal(await storage.getItem("session"), null);
      await service.requestEmailCode("person@example.com");
      assert.equal(codeRequests, 1);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  test("explains email-code rate limits without exposing provider details", async () => {
    const service = new CloudAccountService({
      authStorage: memoryStorage(),
      createSupabaseClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: null }, error: null }),
          getUser: async () => ({ data: { user: null }, error: null }),
          signInWithOtp: async () => ({
            data: {},
            error: {
              code: "over_email_send_rate_limit",
              message: "provider-specific response",
              name: "AuthApiError",
              status: 429
            }
          }),
          signOut: async () => ({ data: {}, error: null }),
          verifyOtp: async () => ({ data: { session: null, user: null }, error: null })
        }
      }),
      environment: {
        apiUrl: "https://api.looper.example",
        supabasePublishableKey: "sb_publishable_test_key",
        supabaseUrl: "https://project.supabase.co"
      }
    });

    await assert.rejects(
      service.requestEmailCode("person@example.com"),
      /Too many sign-in codes were requested/
    );
  });

  test("keeps auth in memory when platform encryption rejects an unsigned build", async () => {
    const directory = await mkdtemp(join(tmpdir(), "looper-cloud-auth-ephemeral-"));
    const filePath = join(directory, "auth.json");
    const storage = createAuthStorageWithEphemeralFallback({
      encryption: {
        decryptStringAsync: async () => {
          throw new Error("keychain authorization failed");
        },
        encryptStringAsync: async () => {
          throw new Error("keychain authorization failed");
        },
        isAsyncEncryptionAvailable: async () => true
      },
      filePath
    });

    try {
      assert.equal(await storage.isAvailable?.(), true);
      await storage.setItem("session", "temporary-secret");
      assert.equal(await storage.getItem("session"), "temporary-secret");
      await assert.rejects(readFile(filePath, "utf8"), { code: "ENOENT" });

      await storage.removeItem("session");
      assert.equal(await storage.getItem("session"), null);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
