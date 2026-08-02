export const adminIpcChannels = {
  accessChanged: "admin:access-changed",
  cancelMfa: "admin:cancel-mfa",
  getAccess: "admin:get-access",
  getOverview: "admin:get-overview",
  getSheet: "admin:get-sheet",
  openPanel: "admin:open-panel",
  prepareMfa: "admin:prepare-mfa",
  verifyMfa: "admin:verify-mfa"
} as const;

export const adminOverviewMaximumResponseBytes = 1024 * 1024;
export const maximumAdminPage = 1_000_000;

export type AdminAccessStatus =
  | "denied"
  | "granted"
  | "mfa_activation_required"
  | "mfa_required";

export type AdminMfaPreparation =
  | Readonly<{
      factorLabel: string;
      mode: "challenge";
    }>
  | Readonly<{
      factorLabel: string;
      manualSecret: string;
      mode: "enrollment";
      qrCode: string;
    }>;

export type AdminSheetSummary = Readonly<{
  createdAt: string;
  id: string;
  title: string;
  updatedAt: string;
}>;

export type AdminAccountSummary = Readonly<{
  createdAt: string;
  email: string;
  grossRevenueCents: number;
  id: string;
  lastSignInAt: string | null;
  paymentCount: number;
  purchasedSheetCount: number;
  sheetCount: number;
  sheets: AdminSheetSummary[];
  sheetsTruncated: boolean;
}>;

export type AdminPagination = Readonly<{
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
}>;

export type AdminOverview = Readonly<{
  accountCount: number;
  accounts: AdminAccountSummary[];
  generatedAt: string;
  grossRevenueCents: number;
  paymentCount: number;
  paymentCurrency: string;
  pagination: AdminPagination;
  sheetCount: number;
}>;

const maximumAdminPageSize = 100;
const maximumAdminSheetPreviewCount = 25;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAdminAccessStatus(value: unknown): value is AdminAccessStatus {
  return (
    value === "denied" ||
    value === "granted" ||
    value === "mfa_activation_required" ||
    value === "mfa_required"
  );
}

export function normalizeAdminMfaCode(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{6}$/.test(value) ? value : undefined;
}

function normalizeAdminMfaQrCode(value: unknown): string | undefined {
  const prefix = "data:image/svg+xml;utf-8,";
  if (
    typeof value !== "string" ||
    value.length <= prefix.length ||
    value.length > 64 * 1024 ||
    !value.startsWith(prefix)
  ) {
    return undefined;
  }
  let svg: string;
  try {
    svg = decodeURIComponent(value.slice(prefix.length)).trim();
  } catch {
    return undefined;
  }
  if (
    !/^<svg(?:\s|>)/i.test(svg) ||
    !/<\/svg>$/i.test(svg) ||
    /<!|<script|<foreignObject|\son[a-z]+\s*=|(?:href|xlink:href)\s*=|url\s*\(|@import/i.test(svg)
  ) {
    return undefined;
  }
  const normalized = `${prefix}${encodeURIComponent(svg)}`;
  return normalized.length <= 64 * 1024 ? normalized : undefined;
}

export function normalizeAdminMfaPreparation(
  value: unknown
): AdminMfaPreparation | undefined {
  if (!isRecord(value)) return undefined;
  const factorLabel = boundedString(value.factorLabel, 80);
  if (!factorLabel) return undefined;
  if (
    value.mode === "challenge" &&
    Object.keys(value).length === 2
  ) {
    return { factorLabel, mode: "challenge" };
  }
  const manualSecret = boundedString(value.manualSecret, 128);
  const qrCode = normalizeAdminMfaQrCode(value.qrCode);
  if (
    value.mode !== "enrollment" ||
    Object.keys(value).length !== 4 ||
    !manualSecret ||
    !/^[A-Z2-7]{16,128}$/.test(manualSecret) ||
    !qrCode
  ) {
    return undefined;
  }
  return {
    factorLabel,
    manualSecret,
    mode: "enrollment",
    qrCode
  };
}

function boundedString(value: unknown, maximumLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized &&
    normalized.length <= maximumLength * 2 &&
    Array.from(normalized).length <= maximumLength
    ? normalized
    : undefined;
}

function timestamp(value: unknown): string | undefined {
  const normalized = boundedString(value, 64);
  return normalized && Number.isFinite(Date.parse(normalized))
    ? normalized
    : undefined;
}

function nonnegativeSafeInteger(value: unknown): number | undefined {
  const normalized =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^(?:0|[1-9]\d{0,15})$/.test(value)
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(normalized) && normalized >= 0
    ? normalized
    : undefined;
}

function positiveSafeInteger(value: unknown): number | undefined {
  const normalized = nonnegativeSafeInteger(value);
  return normalized !== undefined && normalized > 0 ? normalized : undefined;
}

export function normalizeAdminPage(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= maximumAdminPage
    ? value
    : undefined;
}

function sheetSummary(value: unknown): AdminSheetSummary | undefined {
  if (!isRecord(value)) return undefined;
  const createdAt = timestamp(value.createdAt);
  const id = boundedString(value.id, 36);
  const title = boundedString(value.title, 200);
  const updatedAt = timestamp(value.updatedAt);
  if (!createdAt || !id || !uuidPattern.test(id) || !title || !updatedAt) {
    return undefined;
  }
  return { createdAt, id, title, updatedAt };
}

function accountSummary(value: unknown): AdminAccountSummary | undefined {
  if (!isRecord(value) || !Array.isArray(value.sheets)) return undefined;
  if (value.sheets.length > maximumAdminSheetPreviewCount) return undefined;
  const createdAt = timestamp(value.createdAt);
  const email = boundedString(value.email, 320)?.toLowerCase();
  const grossRevenueCents = nonnegativeSafeInteger(value.grossRevenueCents);
  const id = boundedString(value.id, 36);
  const lastSignInAt =
    value.lastSignInAt === null ? null : timestamp(value.lastSignInAt);
  const paymentCount = nonnegativeSafeInteger(value.paymentCount);
  const purchasedSheetCount = nonnegativeSafeInteger(value.purchasedSheetCount);
  const sheetCount = nonnegativeSafeInteger(value.sheetCount);
  const sheets = value.sheets.map(sheetSummary);
  if (
    !createdAt ||
    !email ||
    !email.includes("@") ||
    grossRevenueCents === undefined ||
    !id ||
    !uuidPattern.test(id) ||
    lastSignInAt === undefined ||
    paymentCount === undefined ||
    purchasedSheetCount === undefined ||
    sheetCount === undefined ||
    sheets.some((sheet) => sheet === undefined) ||
    sheetCount < sheets.length ||
    typeof value.sheetsTruncated !== "boolean" ||
    value.sheetsTruncated !== (sheetCount > sheets.length)
  ) {
    return undefined;
  }
  return {
    createdAt,
    email,
    grossRevenueCents,
    id,
    lastSignInAt,
    paymentCount,
    purchasedSheetCount,
    sheetCount,
    sheets: sheets as AdminSheetSummary[],
    sheetsTruncated: value.sheetsTruncated
  };
}

function pagination(value: unknown): AdminPagination | undefined {
  if (!isRecord(value)) return undefined;
  const page = positiveSafeInteger(value.page);
  const pageCount = nonnegativeSafeInteger(value.pageCount);
  const pageSize = positiveSafeInteger(value.pageSize);
  const totalItems = nonnegativeSafeInteger(value.totalItems);
  if (
    page === undefined ||
    pageCount === undefined ||
    pageSize === undefined ||
    pageSize > maximumAdminPageSize ||
    totalItems === undefined ||
    typeof value.hasNextPage !== "boolean" ||
    typeof value.hasPreviousPage !== "boolean"
  ) {
    return undefined;
  }
  const expectedPageCount =
    totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);
  if (
    pageCount !== expectedPageCount ||
    (pageCount === 0 ? page !== 1 : page > pageCount) ||
    value.hasPreviousPage !== (page > 1) ||
    value.hasNextPage !== (page < pageCount)
  ) {
    return undefined;
  }
  return {
    hasNextPage: value.hasNextPage,
    hasPreviousPage: value.hasPreviousPage,
    page,
    pageCount,
    pageSize,
    totalItems
  };
}

export function normalizeAdminOverview(value: unknown): AdminOverview | undefined {
  if (!isRecord(value) || !Array.isArray(value.accounts)) return undefined;
  const normalizedPagination = pagination(value.pagination);
  if (!normalizedPagination || value.accounts.length > normalizedPagination.pageSize) {
    return undefined;
  }
  const accountCount = nonnegativeSafeInteger(value.accountCount);
  const generatedAt = timestamp(value.generatedAt);
  const grossRevenueCents = nonnegativeSafeInteger(value.grossRevenueCents);
  const paymentCount = nonnegativeSafeInteger(value.paymentCount);
  const paymentCurrency = boundedString(value.paymentCurrency, 3)?.toUpperCase();
  const sheetCount = nonnegativeSafeInteger(value.sheetCount);
  const accounts = value.accounts.map(accountSummary);
  const expectedAccountCountOnPage =
    normalizedPagination.totalItems === 0
      ? 0
      : Math.min(
          normalizedPagination.pageSize,
          normalizedPagination.totalItems -
            (normalizedPagination.page - 1) * normalizedPagination.pageSize
        );
  if (
    !generatedAt ||
    accountCount === undefined ||
    accountCount !== normalizedPagination.totalItems ||
    accounts.length !== expectedAccountCountOnPage ||
    grossRevenueCents === undefined ||
    paymentCount === undefined ||
    !paymentCurrency ||
    !/^[A-Z]{3}$/.test(paymentCurrency) ||
    sheetCount === undefined ||
    accounts.some((account) => account === undefined)
  ) {
    return undefined;
  }
  return {
    accountCount,
    accounts: accounts as AdminAccountSummary[],
    generatedAt,
    grossRevenueCents,
    paymentCount,
    paymentCurrency,
    pagination: normalizedPagination,
    sheetCount
  };
}
