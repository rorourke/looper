import assert from "node:assert/strict";
import test from "node:test";
import {
  adminIpcChannels,
  isAdminAccessStatus,
  normalizeAdminMfaCode,
  normalizeAdminMfaPreparation,
  normalizeAdminOverview,
  normalizeAdminPage
} from "./admin.ts";

const accountId = "10000000-0000-4000-8000-000000000001";
const sheetId = "20000000-0000-4000-8000-000000000001";

test("defines a dedicated admin-access verification IPC channel", () => {
  assert.equal(adminIpcChannels.getAccess, "admin:get-access");
  assert.equal(adminIpcChannels.accessChanged, "admin:access-changed");
  assert.equal(adminIpcChannels.prepareMfa, "admin:prepare-mfa");
  assert.equal(adminIpcChannels.verifyMfa, "admin:verify-mfa");
  assert.equal(adminIpcChannels.cancelMfa, "admin:cancel-mfa");
});

test("accepts only exact admin access states and six-digit MFA codes", () => {
  for (const status of [
    "denied",
    "granted",
    "mfa_activation_required",
    "mfa_required"
  ] as const) {
    assert.equal(isAdminAccessStatus(status), true);
  }
  for (const status of [true, false, "mfa-required", "admin", undefined]) {
    assert.equal(isAdminAccessStatus(status), false);
  }
  assert.equal(normalizeAdminMfaCode("012345"), "012345");
  for (const code of [123456, "12345", "1234567", "12 3456", "１２３４５６"]) {
    assert.equal(normalizeAdminMfaCode(code), undefined);
  }
});

test("normalizes only bounded renderer-safe MFA preparations", () => {
  assert.deepEqual(
    normalizeAdminMfaPreparation({ factorLabel: "Authenticator", mode: "challenge" }),
    { factorLabel: "Authenticator", mode: "challenge" }
  );
  const enrollment = {
    factorLabel: "Looper admin",
    manualSecret: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    mode: "enrollment",
    qrCode: "data:image/svg+xml;utf-8,%3Csvg%3E%3C/svg%3E"
  };
  assert.deepEqual(normalizeAdminMfaPreparation(enrollment), {
    ...enrollment,
    qrCode: "data:image/svg+xml;utf-8,%3Csvg%3E%3C%2Fsvg%3E"
  });
  for (const value of [
    { ...enrollment, factorId: accountId },
    { ...enrollment, manualSecret: "not-a-base32-secret" },
    { ...enrollment, qrCode: "javascript:alert(1)" },
    {
      ...enrollment,
      qrCode:
        "data:image/svg+xml;utf-8,%3Csvg%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E%3C%2Fsvg%3E"
    },
    {
      ...enrollment,
      qrCode:
        "data:image/svg+xml;utf-8,%3Csvg%3E%3Cimage%20href%3D%22https%3A%2F%2Fevil.example%2Ftrack%22%2F%3E%3C%2Fsvg%3E"
    },
    { factorLabel: "Authenticator", mode: "challenge", secret: "extra" },
    { factorLabel: "", mode: "challenge" }
  ]) {
    assert.equal(normalizeAdminMfaPreparation(value), undefined);
  }
});

test("accepts only bounded numeric admin page inputs", () => {
  assert.equal(normalizeAdminPage(1), 1);
  assert.equal(normalizeAdminPage(1_000_000), 1_000_000);
  for (const value of [undefined, "1", 0, -1, 1.5, 1_000_001]) {
    assert.equal(normalizeAdminPage(value), undefined);
  }
});

test("normalizes one bounded account page without deriving global totals from it", () => {
  const overview = normalizeAdminOverview({
    accountCount: 51,
    accounts: [
      {
        createdAt: "2026-07-20T12:00:00.000Z",
        email: " Person@Example.com ",
        grossRevenueCents: 299,
        id: accountId,
        lastSignInAt: null,
        paymentCount: 1,
        purchasedSheetCount: 5,
        sheetCount: 2,
        sheets: [
          {
            createdAt: "2026-07-20T12:00:00.000Z",
            id: sheetId,
            title: " Budget ",
            updatedAt: "2026-07-21T12:00:00.000Z"
          }
        ],
        sheetsTruncated: true
      }
    ],
    generatedAt: "2026-07-22T12:00:00.000Z",
    grossRevenueCents: 2298,
    pagination: {
      hasNextPage: false,
      hasPreviousPage: true,
      page: 2,
      pageCount: 2,
      pageSize: 50,
      totalItems: 51
    },
    paymentCount: 2,
    paymentCurrency: "usd",
    sheetCount: 200
  });

  assert.equal(overview?.accounts[0].email, "person@example.com");
  assert.equal(overview?.accounts[0].sheets[0].title, "Budget");
  assert.equal(overview?.accounts[0].sheetsTruncated, true);
  assert.equal(overview?.paymentCurrency, "USD");
  assert.equal(overview?.sheetCount, 200);
  assert.ok(overview);

  const astralTitleOverview = normalizeAdminOverview({
    ...overview,
    accounts: [
      {
        ...overview.accounts[0],
        sheets: [
          {
            ...overview.accounts[0].sheets[0],
            title: "😀".repeat(200)
          }
        ]
      }
    ]
  });
  assert.equal(
    Array.from(astralTitleOverview?.accounts[0].sheets[0].title ?? "").length,
    200
  );
  assert.equal(
    normalizeAdminOverview({
      ...overview,
      accounts: [
        {
          ...overview.accounts[0],
          sheets: [
            {
              ...overview.accounts[0].sheets[0],
              title: "😀".repeat(201)
            }
          ]
        }
      ]
    }),
    undefined
  );

  assert.equal(
    normalizeAdminOverview({ ...overview, accountCount: 52 }),
    undefined
  );
  assert.equal(
    normalizeAdminOverview({
      ...overview,
      pagination: { ...overview?.pagination, hasNextPage: true }
    }),
    undefined
  );
  assert.equal(
    normalizeAdminOverview({
      ...overview,
      accounts: [
        { ...overview?.accounts[0], sheetsTruncated: false }
      ]
    }),
    undefined
  );
  assert.equal(
    normalizeAdminOverview({
      ...overview,
      accounts: [{ ...overview?.accounts[0], id: "account-1" }]
    }),
    undefined
  );
});
