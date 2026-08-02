import { isAbsolute, relative, resolve, sep } from "node:path";

const allowedDevRendererHostnames = new Set([
  "127.0.0.1",
  "[::1]",
  "localhost"
]);

export const packagedRendererScheme = "looper-app";
const packagedRendererHost = "renderer";
export const packagedRendererEntryUrl =
  `${packagedRendererScheme}://${packagedRendererHost}/index.html`;
export const packagedSettingsRendererEntryUrl =
  `${packagedRendererEntryUrl}?window=settings`;
const maximumPackagedRendererUrlLength = 4_096;
const packagedRendererRequestPattern =
  /^looper-app:\/\/renderer(\/[^?#]*)?(?:\?[^#]*)?$/;
const unsafeUrlCodePointPattern = /[\u0000-\u001f\u007f]/;

export const disallowedPackagedChromiumSwitches = [
  "disable-web-security",
  "ignore-certificate-errors",
  "no-sandbox",
  "remote-debugging-pipe",
  "remote-debugging-port"
] as const;

type ChromiumCommandLine = Readonly<{
  hasSwitch: (name: string) => boolean;
}>;

export function resolveDevRendererUrl(
  value: unknown,
  isPackaged: boolean
): string | undefined {
  if (
    isPackaged ||
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 2_048 ||
    value !== value.trim()
  ) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (
      url.protocol !== "http:" ||
      !allowedDevRendererHostnames.has(url.hostname) ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}

export function findDisallowedPackagedChromiumSwitch(
  commandLine: ChromiumCommandLine,
  isPackaged: boolean
): (typeof disallowedPackagedChromiumSwitches)[number] | undefined {
  if (!isPackaged) return undefined;
  return disallowedPackagedChromiumSwitches.find((name) =>
    commandLine.hasSwitch(name)
  );
}

export function resolvePackagedRendererRequestPath(
  requestUrl: string,
  rendererRoot: string
): string | undefined {
  if (
    requestUrl.length === 0 ||
    requestUrl.length > maximumPackagedRendererUrlLength ||
    unsafeUrlCodePointPattern.test(requestUrl) ||
    !isAbsolute(rendererRoot)
  ) {
    return undefined;
  }

  const match = packagedRendererRequestPattern.exec(requestUrl);
  const encodedPath = match?.[1];
  if (!encodedPath || encodedPath === "/") return undefined;

  try {
    const parsed = new URL(requestUrl);
    if (
      parsed.protocol !== `${packagedRendererScheme}:` ||
      parsed.hostname !== packagedRendererHost ||
      parsed.username.length > 0 ||
      parsed.password.length > 0 ||
      parsed.port.length > 0 ||
      parsed.hash.length > 0
    ) {
      return undefined;
    }

    const decodedSegments = encodedPath.slice(1).split("/").map((segment) => {
      const decoded = decodeURIComponent(segment);
      if (
        decoded.length === 0 ||
        decoded === "." ||
        decoded === ".." ||
        decoded.includes("/") ||
        decoded.includes("\\") ||
        unsafeUrlCodePointPattern.test(decoded)
      ) {
        throw new Error("Unsafe packaged renderer path segment.");
      }
      return decoded;
    });

    const absoluteRendererRoot = resolve(rendererRoot);
    const filePath = resolve(absoluteRendererRoot, ...decodedSegments);
    const relativePath = relative(absoluteRendererRoot, filePath);
    if (
      relativePath.length === 0 ||
      relativePath === ".." ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      return undefined;
    }
    return filePath;
  } catch {
    return undefined;
  }
}

export function isTrustedPackagedRendererDocumentUrl(value: string): boolean {
  return (
    value === packagedRendererEntryUrl ||
    value === packagedSettingsRendererEntryUrl
  );
}
