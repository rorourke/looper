export type AdminPanelRequestGate = Readonly<{
  begin: () => number;
  invalidate: () => void;
  isCurrent: (requestId: number) => boolean;
}>;

export function createAdminPanelRequestGate(): AdminPanelRequestGate {
  let latestRequestId = 0;
  return {
    begin: () => {
      latestRequestId += 1;
      return latestRequestId;
    },
    invalidate: () => {
      latestRequestId += 1;
    },
    isCurrent: (requestId) => requestId === latestRequestId
  };
}
