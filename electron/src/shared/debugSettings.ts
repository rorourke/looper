export const debugSettingsIpcChannels = {
  billingPreviewChanged: "debug-settings:billing-preview-changed",
  demoTimeChanged: "debug-settings:demo-time-changed",
  getAvailability: "debug-settings:get-availability",
  getBillingPreview: "debug-settings:get-billing-preview",
  getDemoTime: "debug-settings:get-demo-time",
  getSignedOutPreview: "debug-settings:get-signed-out-preview",
  getUpdateButtonPreview: "debug-settings:get-update-button-preview",
  getWindowsClientSpoof: "debug-settings:get-windows-client-spoof",
  setBillingPreview: "debug-settings:set-billing-preview",
  setDemoTime: "debug-settings:set-demo-time",
  setSignedOutPreview: "debug-settings:set-signed-out-preview",
  setUpdateButtonPreview: "debug-settings:set-update-button-preview",
  setWindowsClientSpoof: "debug-settings:set-windows-client-spoof",
  showBillingDialog: "debug-settings:show-billing-dialog",
  signedOutPreviewChanged: "debug-settings:signed-out-preview-changed",
  windowsClientSpoofChanged: "debug-settings:windows-client-spoof-changed"
} as const;

export const billingPreviewModes = [
  "live",
  "quota-near-limit",
  "quota-at-limit",
  "quota-expanded"
] as const;

export type BillingPreviewMode = (typeof billingPreviewModes)[number];

export function isBillingPreviewMode(value: unknown): value is BillingPreviewMode {
  return billingPreviewModes.some((mode) => mode === value);
}
