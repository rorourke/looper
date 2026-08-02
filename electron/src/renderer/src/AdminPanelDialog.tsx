import {
  ChevronRight,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  Files,
  RefreshCw,
  Search,
  Users,
  X
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from "react";
import type { CloudSheet } from "../../shared/cloudAccount";
import type {
  AdminAccountSummary,
  AdminOverview,
  AdminSheetSummary
} from "../../shared/admin";
import { createAdminPanelRequestGate } from "./adminPanelRequestGate";
import "./adminPanelDialog.css";

type AdminPanelDialogProps = {
  onClose: () => void;
  open: boolean;
};

function formatDate(value: string | null, includeTime = false): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {})
  }).format(date);
}

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    currency,
    style: "currency"
  }).format(amountCents / 100);
}

function sheetPreviewText(sheet: CloudSheet): string {
  const text = sheet.document.text;
  if (typeof text === "string") return text || "This sheet is empty.";
  return JSON.stringify(sheet.document, null, 2);
}

function plural(count: number, singular: string, pluralValue = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

export function AdminPanelDialog({
  onClose,
  open
}: AdminPanelDialogProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const overviewRequestGateRef = useRef(createAdminPanelRequestGate());
  const sheetRequestRef = useRef(0);
  const [overview, setOverview] = useState<AdminOverview>();
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>();
  const [selectedSheetId, setSelectedSheetId] = useState<string>();
  const [selectedSheet, setSelectedSheet] = useState<CloudSheet>();
  const [sheetLoadError, setSheetLoadError] = useState("");
  const [isSheetLoading, setIsSheetLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      try {
        dialog.showModal();
      } catch (error) {
        console.error("Could not present the Admin Panel modally.", error);
        if (!dialog.open) dialog.show();
      }
    }
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  const resetSheetSelection = useCallback((): void => {
    sheetRequestRef.current += 1;
    setSelectedSheetId(undefined);
    setSelectedSheet(undefined);
    setSheetLoadError("");
    setIsSheetLoading(false);
  }, []);

  const clearSensitiveAdminData = useCallback((): void => {
    setOverview(undefined);
    setSearchQuery("");
    setSelectedAccountId(undefined);
    resetSheetSelection();
  }, [resetSheetSelection]);

  const clearAdminPanelState = useCallback((): void => {
    overviewRequestGateRef.current.invalidate();
    clearSensitiveAdminData();
    setLoadError("");
    setIsLoading(false);
  }, [clearSensitiveAdminData]);

  useEffect(() => {
    if (!open) {
      clearAdminPanelState();
      return;
    }
    return () => {
      overviewRequestGateRef.current.invalidate();
      sheetRequestRef.current += 1;
    };
  }, [clearAdminPanelState, open]);

  const loadOverview = useCallback(async (page = 1): Promise<void> => {
    const requestId = overviewRequestGateRef.current.begin();
    setIsLoading(true);
    setLoadError("");
    try {
      const nextOverview = await window.looper.getAdminOverview(page);
      if (!overviewRequestGateRef.current.isCurrent(requestId)) return;
      if (nextOverview.pagination.page !== page) {
        throw new Error("Cloud returned the wrong admin page.");
      }
      setOverview(nextOverview);
      resetSheetSelection();
      setSelectedAccountId((current) =>
        current && nextOverview.accounts.some((account) => account.id === current)
          ? current
          : nextOverview.accounts[0]?.id
      );
    } catch (error) {
      if (!overviewRequestGateRef.current.isCurrent(requestId)) return;
      clearSensitiveAdminData();
      setLoadError(
        error instanceof Error
          ? error.message
          : "The admin data could not be loaded."
      );
    } finally {
      if (overviewRequestGateRef.current.isCurrent(requestId)) {
        setIsLoading(false);
      }
    }
  }, [clearSensitiveAdminData, resetSheetSelection]);

  useEffect(() => {
    if (!open) return;
    setSearchQuery("");
    resetSheetSelection();
    void loadOverview(1);
  }, [loadOverview, open, resetSheetSelection]);

  const filteredAccounts = useMemo(() => {
    if (!overview) return [];
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return overview.accounts;
    return overview.accounts.filter(
      (account) =>
        account.email.toLocaleLowerCase().includes(query) ||
        account.sheets.some((sheet) =>
          sheet.title.toLocaleLowerCase().includes(query)
        )
    );
  }, [overview, searchQuery]);

  useEffect(() => {
    if (
      filteredAccounts.length > 0 &&
      !filteredAccounts.some((account) => account.id === selectedAccountId)
    ) {
      setSelectedAccountId(filteredAccounts[0].id);
      resetSheetSelection();
    }
  }, [filteredAccounts, resetSheetSelection, selectedAccountId]);

  const selectedAccount = overview?.accounts.find(
    (account) => account.id === selectedAccountId
  );

  const selectAccount = (account: AdminAccountSummary): void => {
    if (account.id === selectedAccountId) return;
    setSelectedAccountId(account.id);
    resetSheetSelection();
  };

  const loadSheet = useCallback(
    async (sheet: AdminSheetSummary): Promise<void> => {
      const requestId = sheetRequestRef.current + 1;
      sheetRequestRef.current = requestId;
      setSelectedSheetId(sheet.id);
      setSelectedSheet(undefined);
      setSheetLoadError("");
      setIsSheetLoading(true);
      try {
        const detail = await window.looper.getAdminSheet(sheet.id);
        if (sheetRequestRef.current === requestId) setSelectedSheet(detail);
      } catch (error) {
        if (sheetRequestRef.current !== requestId) return;
        setSheetLoadError(
          error instanceof Error
            ? error.message
            : "The sheet could not be loaded."
        );
      } finally {
        if (sheetRequestRef.current === requestId) setIsSheetLoading(false);
      }
    },
    []
  );

  return (
    <dialog
      aria-labelledby="admin-panel-title"
      className="admin-panel-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      ref={dialogRef}
    >
      <section className="admin-panel-surface">
        <header className="admin-panel-header">
          <span className="admin-panel-heading">
            <span>Administration</span>
            <span className="admin-panel-title-row">
              <h1 id="admin-panel-title">Overview</h1>
              <small><i aria-hidden="true" /> Live</small>
            </span>
          </span>
          <span className="admin-panel-updated">
            {overview ? `Updated ${formatDate(overview.generatedAt, true)}` : "Connecting…"}
          </span>
          <button
            className="admin-panel-refresh"
            disabled={isLoading}
            onClick={() =>
              void loadOverview(overview?.pagination.page ?? 1)
            }
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={isLoading ? "spinning" : undefined}
            />
            {isLoading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            aria-label="Close Admin Panel"
            className="admin-panel-close"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="admin-panel-body">
          <section className="admin-panel-metrics" aria-label="Business metrics">
            <article>
              <span><Users aria-hidden="true" /> Accounts</span>
              <strong>{overview?.accountCount ?? "—"}</strong>
              <small>All registered users</small>
            </article>
            <article>
              <span><Files aria-hidden="true" /> Cloud sheets</span>
              <strong>{overview?.sheetCount ?? "—"}</strong>
              <small>Active and stored</small>
            </article>
            <article>
              <span><DollarSign aria-hidden="true" /> Gross revenue</span>
              <strong>
                {overview
                  ? formatCurrency(
                      overview.grossRevenueCents,
                      overview.paymentCurrency
                    )
                  : "—"}
              </strong>
              <small>Completed sheet-pack sales</small>
            </article>
            <article>
              <span><CreditCard aria-hidden="true" /> Payments</span>
              <strong>{overview?.paymentCount ?? "—"}</strong>
              <small>Successful transactions</small>
            </article>
          </section>

          <section className="admin-panel-workspace" aria-label="Account directory">
            <aside className="admin-panel-accounts">
              <header>
                <span>
                  <h2>Accounts</h2>
                  <small>
                    {overview
                      ? overview.pagination.totalItems === 0
                        ? "No accounts"
                        : `${
                            (overview.pagination.page - 1) *
                              overview.pagination.pageSize +
                            1
                          }–${
                            (overview.pagination.page - 1) *
                              overview.pagination.pageSize +
                            overview.accounts.length
                          } of ${overview.pagination.totalItems}`
                      : "Loading…"}
                  </small>
                </span>
                <label className="admin-panel-search">
                  <Search aria-hidden="true" />
                  <span className="admin-panel-sr-only">Search accounts and sheets</span>
                  <input
                    onChange={(event) => setSearchQuery(event.currentTarget.value)}
                    placeholder="Search this page"
                    type="search"
                    value={searchQuery}
                  />
                </label>
              </header>

              {loadError ? (
                <div className="admin-panel-error" role="alert">
                  <strong>Couldn’t load admin data</strong>
                  <span>{loadError}</span>
                  <button
                    onClick={() =>
                      void loadOverview(overview?.pagination.page ?? 1)
                    }
                    type="button"
                  >
                    Try again
                  </button>
                </div>
              ) : !overview ? (
                <div className="admin-panel-loading" aria-label="Loading accounts">
                  <span />
                  <span />
                  <span />
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="admin-panel-no-results">
                  No accounts or sheet previews on this page match “{searchQuery}”.
                </div>
              ) : (
                <div className="admin-panel-account-list">
                  {filteredAccounts.map((account) => (
                    <button
                      aria-pressed={account.id === selectedAccountId}
                      className="admin-panel-account-row"
                      key={account.id}
                      onClick={() => selectAccount(account)}
                      type="button"
                    >
                      <span className="admin-panel-account-avatar" aria-hidden="true">
                        {account.email.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="admin-panel-account-identity">
                        <strong>{account.email}</strong>
                        <small>
                          {plural(account.sheetCount, "sheet")} · {formatCurrency(
                            account.grossRevenueCents,
                            overview.paymentCurrency
                          )}
                        </small>
                      </span>
                      <ChevronRight aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
              {overview ? (
                <footer className="admin-panel-pagination">
                  <span>
                    Page {overview.pagination.page} of{
                      " "
                    }{Math.max(overview.pagination.pageCount, 1)} · Search is
                    page-only
                  </span>
                  <span>
                    <button
                      disabled={
                        isLoading || !overview.pagination.hasPreviousPage
                      }
                      onClick={() => {
                        setSearchQuery("");
                        void loadOverview(overview.pagination.page - 1);
                      }}
                      type="button"
                    >
                      Previous
                    </button>
                    <button
                      disabled={isLoading || !overview.pagination.hasNextPage}
                      onClick={() => {
                        setSearchQuery("");
                        void loadOverview(overview.pagination.page + 1);
                      }}
                      type="button"
                    >
                      Next
                    </button>
                  </span>
                </footer>
              ) : null}
            </aside>

            <section className="admin-panel-account-view">
              {selectedAccount && overview ? (
                <>
                  <header className="admin-panel-account-header">
                    <span>
                      <small>Account</small>
                      <h2>{selectedAccount.email}</h2>
                    </span>
                    <dl>
                      <div>
                        <dt>Joined</dt>
                        <dd>{formatDate(selectedAccount.createdAt)}</dd>
                      </div>
                      <div>
                        <dt>Last sign in</dt>
                        <dd>{formatDate(selectedAccount.lastSignInAt, true)}</dd>
                      </div>
                    </dl>
                  </header>

                  <section className="admin-panel-account-stats" aria-label="Account totals">
                    <span><strong>{selectedAccount.sheetCount}</strong> cloud sheets</span>
                    <span><strong>{selectedAccount.paymentCount}</strong> payments</span>
                    <span>
                      <strong>{formatCurrency(
                        selectedAccount.grossRevenueCents,
                        overview.paymentCurrency
                      )}</strong> revenue
                    </span>
                    <span><strong>{selectedAccount.purchasedSheetCount}</strong> sheets purchased</span>
                  </section>

                  <div className="admin-panel-account-content">
                    <section className="admin-panel-sheets">
                      <header>
                        <h3>Cloud sheets</h3>
                        <small>
                          {selectedAccount.sheetsTruncated
                            ? `Showing ${selectedAccount.sheets.length} most recent of ${selectedAccount.sheetCount}`
                            : "Select a sheet to inspect it"}
                        </small>
                      </header>
                      {selectedAccount.sheets.length > 0 ? (
                        <div className="admin-panel-sheet-list">
                          {selectedAccount.sheets.map((sheet) => (
                            <button
                              aria-pressed={sheet.id === selectedSheetId}
                              className="admin-panel-sheet-row"
                              key={sheet.id}
                              onClick={() => void loadSheet(sheet)}
                              type="button"
                            >
                              <span className="admin-panel-sheet-icon"><FileText aria-hidden="true" /></span>
                              <span>
                                <strong>{sheet.title}</strong>
                                <small>Updated {formatDate(sheet.updatedAt, true)}</small>
                              </span>
                              <Eye aria-hidden="true" />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="admin-panel-empty-sheets">
                          This account hasn’t created a cloud sheet yet.
                        </p>
                      )}
                    </section>

                    <section className="admin-panel-preview" aria-live="polite">
                      {isSheetLoading ? (
                        <div className="admin-panel-preview-state">
                          <span className="admin-panel-spinner" aria-hidden="true" />
                          Loading sheet…
                        </div>
                      ) : sheetLoadError ? (
                        <div className="admin-panel-preview-state admin-panel-preview-error" role="alert">
                          <strong>Couldn’t open this sheet</strong>
                          <span>{sheetLoadError}</span>
                        </div>
                      ) : selectedSheet ? (
                        <>
                          <header>
                            <span>
                              <small>Sheet preview</small>
                              <h3>{selectedSheet.title}</h3>
                            </span>
                            <small>Revision {selectedSheet.revision}</small>
                          </header>
                          <pre>{sheetPreviewText(selectedSheet)}</pre>
                        </>
                      ) : (
                        <div className="admin-panel-preview-state">
                          <span className="admin-panel-preview-icon"><Eye aria-hidden="true" /></span>
                          <strong>Choose a sheet to view it</strong>
                          <span>The sheet’s saved content will appear here.</span>
                        </div>
                      )}
                    </section>
                  </div>
                </>
              ) : (
                <div className="admin-panel-preview-state">
                  <strong>Select an account</strong>
                  <span>Account activity and cloud sheets will appear here.</span>
                </div>
              )}
            </section>
          </section>
        </div>
      </section>
    </dialog>
  );
}
