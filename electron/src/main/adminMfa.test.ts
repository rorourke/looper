import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  CloudAccountService,
  type AsyncAuthStorage
} from "./cloudAccount.ts";

const accountId = "11111111-1111-4111-8111-111111111111";
const factorId = "22222222-2222-4222-8222-222222222222";
const manualSecret = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const qrCode = "data:image/svg+xml;utf-8,%3Csvg%3E%3C%2Fsvg%3E";

function memoryStorage(): AsyncAuthStorage {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    isAvailable: () => true,
    removeItem: async (key) => {
      values.delete(key);
    },
    setItem: async (key, value) => {
      values.set(key, value);
    }
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status
  });
}

type MfaHarness = {
  challengeAndVerify: (input: {
    code: string;
    factorId: string;
  }) => Promise<{ data: unknown; error: unknown }>;
  enroll: (input: {
    factorType: "totp";
    friendlyName: string;
  }) => Promise<{ data: unknown; error: unknown }>;
  listFactors: () => Promise<{ data: unknown; error: unknown }>;
  unenroll: (input: {
    factorId: string;
  }) => Promise<{ data: unknown; error: unknown }>;
};

function serviceWithMfa(
  mfa: MfaHarness,
  fetchImplementation: typeof fetch = async () => jsonResponse({ admin: true })
): CloudAccountService {
  return new CloudAccountService({
    authStorage: memoryStorage(),
    createSupabaseClient: () => ({
      auth: {
        getSession: async () => ({
          data: {
            session: {
              access_token: "secret-access-token",
              user: { email: "person@example.com", id: accountId }
            }
          },
          error: null
        }),
        getUser: async () => ({
          data: { user: { email: "person@example.com", id: accountId } },
          error: null
        }),
        mfa,
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

function defaultMfa(overrides: Partial<MfaHarness> = {}): MfaHarness {
  return {
    challengeAndVerify: async () => ({ data: {}, error: null }),
    enroll: async () => ({
      data: {
        friendly_name: "Looper admin",
        id: factorId,
        totp: { qr_code: qrCode, secret: manualSecret },
        type: "totp"
      },
      error: null
    }),
    listFactors: async () => ({
      data: { all: [], phone: [], totp: [], webauthn: [] },
      error: null
    }),
    unenroll: async () => ({ data: {}, error: null }),
    ...overrides
  };
}

describe("Electron administrator MFA boundary", () => {
  test("distinguishes server grants, identity denials, and required AAL2 step-up", async () => {
    assert.equal(await serviceWithMfa(defaultMfa()).getAdminAccess(), "granted");
    const denied = serviceWithMfa(defaultMfa(), async () =>
      jsonResponse({ error: { code: "admin_access_denied", message: "Denied" } }, 403)
    );
    assert.equal(await denied.getAdminAccess(), "denied");
    const stepUp = serviceWithMfa(defaultMfa(), async () =>
      jsonResponse({ error: { code: "admin_mfa_required", message: "Step up" } }, 403)
    );
    assert.equal(await stepUp.getAdminAccess(), "mfa_required");
    const activation = serviceWithMfa(defaultMfa(), async () =>
      jsonResponse(
        { error: { code: "admin_mfa_activation_required", message: "Activate" } },
        403
      )
    );
    assert.equal(
      await activation.getAdminAccess(),
      "mfa_activation_required"
    );

    const unknownDenial = serviceWithMfa(defaultMfa(), async () =>
      jsonResponse({ error: { code: "unknown", message: "Denied" } }, 403)
    );
    await assert.rejects(unknownDenial.getAdminAccess(), /access to that sheet/);
  });

  test("challenges one verified TOTP factor without exposing its identifier", async () => {
    let verifiedInput: { code: string; factorId: string } | undefined;
    const factor = {
      factor_type: "totp",
      friendly_name: "Primary authenticator",
      id: factorId,
      status: "verified"
    };
    const service = serviceWithMfa(
      defaultMfa({
        challengeAndVerify: async (input) => {
          verifiedInput = input;
          return { data: {}, error: null };
        },
        listFactors: async () => ({
          data: { all: [factor], phone: [], totp: [factor], webauthn: [] },
          error: null
        })
      })
    );

    assert.deepEqual(await service.prepareAdminMfa(), {
      factorLabel: "Primary authenticator",
      mode: "challenge"
    });
    await service.verifyAdminMfa("012345");
    assert.deepEqual(verifiedInput, { code: "012345", factorId });
    await assert.rejects(service.verifyAdminMfa("012345"), /Start admin verification/);
  });

  test("enrolls one TOTP factor and removes an unfinished enrollment on cancel", async () => {
    const unenrolled: string[] = [];
    const service = serviceWithMfa(
      defaultMfa({
        unenroll: async ({ factorId: removedFactorId }) => {
          unenrolled.push(removedFactorId);
          return { data: {}, error: null };
        }
      })
    );

    assert.deepEqual(await service.prepareAdminMfa(), {
      factorLabel: "Looper admin",
      manualSecret,
      mode: "enrollment",
      qrCode
    });
    await service.cancelAdminMfa();
    assert.deepEqual(unenrolled, [factorId]);
    await assert.rejects(service.verifyAdminMfa("012345"), /Start admin verification/);
  });

  test("rejects malformed factor data and non-ASCII six-digit codes", async () => {
    const malformed = serviceWithMfa(
      defaultMfa({
        enroll: async () => ({
          data: {
            id: factorId,
            totp: { qr_code: "javascript:alert(1)", secret: manualSecret },
            type: "totp"
          },
          error: null
        })
      })
    );
    await assert.rejects(malformed.prepareAdminMfa(), /invalid MFA enrollment/);

    const valid = serviceWithMfa(defaultMfa());
    await valid.prepareAdminMfa();
    await assert.rejects(valid.verifyAdminMfa("１２３４５６"), /six-digit authenticator code/);
  });

  test("retains a server-created factor for cleanup when enrollment display data is malformed", async () => {
    const unenrolled: string[] = [];
    const service = serviceWithMfa(
      defaultMfa({
        enroll: async () => ({
          data: {
            id: factorId,
            totp: { qr_code: "javascript:alert(1)", secret: manualSecret },
            type: "totp"
          },
          error: null
        }),
        unenroll: async ({ factorId: removedFactorId }) => {
          unenrolled.push(removedFactorId);
          return { data: {}, error: null };
        }
      })
    );

    await assert.rejects(service.prepareAdminMfa(), /invalid MFA enrollment/);
    await service.cancelAdminMfa();
    assert.deepEqual(unenrolled, [factorId]);
  });

  test("rejects contradictory all-factor and TOTP-factor listings", async () => {
    const service = serviceWithMfa(
      defaultMfa({
        listFactors: async () => ({
          data: {
            all: [
              {
                factor_type: "phone",
                friendly_name: "Not a TOTP factor",
                id: factorId,
                status: "verified"
              }
            ],
            phone: [],
            totp: [
              {
                factor_type: "totp",
                friendly_name: "Contradictory authenticator",
                id: factorId,
                status: "verified"
              }
            ],
            webauthn: []
          },
          error: null
        })
      })
    );

    await assert.rejects(service.prepareAdminMfa(), /invalid MFA factor data/);
  });

  test("rejects a verified TOTP factor omitted from the specialized factor list", async () => {
    const service = serviceWithMfa(
      defaultMfa({
        listFactors: async () => ({
          data: {
            all: [
              {
                factor_type: "totp",
                friendly_name: "Hidden authenticator",
                id: factorId,
                status: "verified"
              }
            ],
            phone: [],
            totp: [],
            webauthn: []
          },
          error: null
        })
      })
    );

    await assert.rejects(service.prepareAdminMfa(), /invalid MFA factor data/);
  });

  test("serializes preparation so concurrent renderer calls cannot enroll twice", async () => {
    let enrollmentCount = 0;
    const service = serviceWithMfa(
      defaultMfa({
        enroll: async () => {
          enrollmentCount += 1;
          return {
            data: {
              friendly_name: "Looper admin",
              id: factorId,
              totp: { qr_code: qrCode, secret: manualSecret },
              type: "totp"
            },
            error: null
          };
        }
      })
    );

    const attempts = await Promise.allSettled([
      service.prepareAdminMfa(),
      service.prepareAdminMfa()
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
    assert.match(String((attempts.find((attempt) => attempt.status === "rejected") as PromiseRejectedResult).reason), /already in progress/);
    assert.equal(enrollmentCount, 1);
  });

  test("retains a new factor for cleanup retry when unenrollment fails", async () => {
    let cleanupAttempts = 0;
    const service = serviceWithMfa(
      defaultMfa({
        unenroll: async () => {
          cleanupAttempts += 1;
          return { data: {}, error: cleanupAttempts === 1 ? new Error("offline") : null };
        }
      })
    );

    await service.prepareAdminMfa();
    await assert.rejects(service.cancelAdminMfa(), /could not be cleared/);
    await service.cancelAdminMfa();
    assert.equal(cleanupAttempts, 2);
  });
});
