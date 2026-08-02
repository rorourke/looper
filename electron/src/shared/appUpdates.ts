export const appUpdateIpcChannels = {
  getState: "app-update:get-state",
  install: "app-update:install",
  stateChanged: "app-update:state-changed"
} as const;

export type AppUpdateState =
  | Readonly<{ status: "idle" }>
  | Readonly<{
      preview: boolean;
      releaseName: string;
      status: "available";
    }>
  | Readonly<{
      preview: boolean;
      progress: number;
      releaseName: string;
      status: "downloading" | "installing";
    }>;

export const idleAppUpdateState: AppUpdateState = { status: "idle" };

export function isAppUpdateState(value: unknown): value is AppUpdateState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  if (state.status === "idle") return true;
  const hasUpdateIdentity =
    typeof state.preview === "boolean" &&
    typeof state.releaseName === "string" &&
    state.releaseName.trim().length > 0;
  if (!hasUpdateIdentity) return false;
  if (state.status === "available") return true;
  return (
    (state.status === "downloading" || state.status === "installing") &&
    typeof state.progress === "number" &&
    Number.isFinite(state.progress) &&
    state.progress >= 0 &&
    state.progress <= 100
  );
}
