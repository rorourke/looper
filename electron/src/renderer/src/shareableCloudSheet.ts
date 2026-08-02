import type {
  CloudSheet,
  UpdateCloudSheetInput
} from "../../shared/cloudAccount";

type UpdateCloudSheet = (input: UpdateCloudSheetInput) => Promise<CloudSheet>;

export async function enableShareableUrlAfterCreate(
  sheet: CloudSheet,
  required: boolean,
  updateCloudSheet: UpdateCloudSheet
): Promise<CloudSheet> {
  if (!required || sheet.shareEnabled || !sheet.shareToken) return sheet;

  return updateCloudSheet({
    expectedRevision: sheet.revision,
    id: sheet.id,
    shareEnabled: true
  });
}
