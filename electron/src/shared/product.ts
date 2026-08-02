export const looperProductName = "Looper";
export const looperOperatorName = "Ryan O'Rourke";
export const looperPublicOrigin = "https://looper.app";
export const looperSupportEmail = "support@looper.app";

export const looperPrivacyUrl = `${looperPublicOrigin}/privacy`;
export const looperSupportUrl = `${looperPublicOrigin}/support`;
export const looperTermsUrl = `${looperPublicOrigin}/terms`;

export const minimumSupportedMacOSVersion = "13.0";
export const deletedSheetRetentionDays = 30;
export const accountReauthenticationWindowMinutes = 15;
export const accountDeletionConfirmation = "DELETE" as const;

export function isLooperPublicPageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.origin === looperPublicOrigin &&
      ["/privacy", "/support", "/terms"].includes(url.pathname) &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function isLooperSupportEmailUrl(value: string): boolean {
  return value === `mailto:${looperSupportEmail}`;
}
