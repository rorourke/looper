import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute } from "node:path";
import { CLOUD_DOCUMENT_MAX_BYTES } from "../shared/cloudAccount.ts";
import { CloudAccountError } from "./cloudAccount.ts";

const maximumImportFileCount = 20;
const maximumImportFileBytes = CLOUD_DOCUMENT_MAX_BYTES + 64 * 1024;

export function normalizeLocalDocumentImportPaths(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > maximumImportFileCount
  ) {
    throw new CloudAccountError("Choose between 1 and 20 Looper sheets to import.");
  }

  const paths: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (
      typeof candidate !== "string" ||
      candidate.length === 0 ||
      candidate.length > 4096 ||
      candidate.includes("\0") ||
      !isAbsolute(candidate) ||
      extname(candidate).toLocaleLowerCase() !== ".loop"
    ) {
      throw new CloudAccountError("Only local .loop files can be imported.");
    }
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    paths.push(candidate);
  }

  if (paths.length === 0) {
    throw new CloudAccountError("Choose at least one .loop file to import.");
  }
  return paths;
}

export async function readLocalDocumentImport(path: string): Promise<string> {
  let metadata;
  try {
    metadata = await stat(path);
  } catch {
    throw new CloudAccountError("The selected Looper sheet could not be read.");
  }
  if (!metadata.isFile()) {
    throw new CloudAccountError("The selected item is not a Looper sheet file.");
  }
  if (metadata.size > maximumImportFileBytes) {
    throw new CloudAccountError("A Looper sheet cannot be larger than 1 MiB.");
  }

  try {
    return await readFile(path, "utf8");
  } catch {
    throw new CloudAccountError("The selected Looper sheet could not be read.");
  }
}
