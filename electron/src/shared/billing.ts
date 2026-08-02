export const INCLUDED_SHEET_LIMIT = 5;
export const SMALL_SHEET_PACK_SIZE = 5;
export const SMALL_SHEET_PACK_PRODUCT = "sheet-pack-5" as const;
export const SMALL_SHEET_PACK_PRICE_CENTS = 299;
export const SHEET_PACK_SIZE = 50;
export const SHEET_PACK_PRODUCT = "sheet-pack-50" as const;
export const SHEET_PACK_PRICE_CENTS = 1_999;
export const SHEET_PACK_CURRENCY = "usd";

export const billingOffers = {
  smallSheetPack: {
    displayPrice: "$2.99",
    name: `${SMALL_SHEET_PACK_SIZE} more sheets`,
    priceCents: SMALL_SHEET_PACK_PRICE_CENTS,
    product: SMALL_SHEET_PACK_PRODUCT,
    sheetCount: SMALL_SHEET_PACK_SIZE
  },
  sheetPack: {
    displayPrice: "$19.99",
    name: `${SHEET_PACK_SIZE} more sheets`,
    priceCents: SHEET_PACK_PRICE_CENTS,
    product: SHEET_PACK_PRODUCT,
    sheetCount: SHEET_PACK_SIZE
  }
} as const;

export const sheetPackOffers = [
  billingOffers.smallSheetPack,
  billingOffers.sheetPack
] as const;

export type SheetPackOffer = (typeof sheetPackOffers)[number];
export type SheetPackProduct = SheetPackOffer["product"];

export function isSheetPackProduct(value: unknown): value is SheetPackProduct {
  return sheetPackOffers.some((offer) => offer.product === value);
}

export type BillingStatus = {
  billingConfigured: boolean;
  canCreateSheet: boolean;
  canPurchaseSheets: boolean;
  sheetCount: number;
  sheetLimit: number;
  unusedSheetCount: number;
};

export function billingStatusAllowsSheetCreation(
  status: BillingStatus
): boolean {
  return (
    status.canCreateSheet &&
    status.sheetCount < status.sheetLimit &&
    status.unusedSheetCount > 0
  );
}

export const billingIpcChannels = {
  checkoutCompleted: "billing:checkout-completed",
  getStatus: "billing:get-status",
  startCheckout: "billing:start-checkout"
} as const;

export function quotaBillingStatus(
  sheetCount: number,
  sheetLimit = INCLUDED_SHEET_LIMIT,
  billingConfigured = true
): BillingStatus {
  const normalizedCount = Math.max(0, Math.trunc(sheetCount));
  const normalizedLimit = Math.max(0, Math.trunc(sheetLimit));
  return {
    billingConfigured,
    canCreateSheet: normalizedCount < normalizedLimit,
    canPurchaseSheets: true,
    sheetCount: normalizedCount,
    sheetLimit: normalizedLimit,
    unusedSheetCount: Math.max(0, normalizedLimit - normalizedCount)
  };
}
