import { LoaderCircle, X } from "lucide-react";
import {
  sheetPackOffers,
  type BillingStatus,
  type SheetPackProduct
} from "../../shared/billing";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactElement
} from "react";
import "./billingDialog.css";

export type BillingDialogProps = {
  onCheckout: (product: SheetPackProduct) => Promise<void>;
  onClose: () => void;
  open: boolean;
  preview: boolean;
  status: BillingStatus;
};

export function BillingDialog({
  onCheckout,
  onClose,
  open,
  preview,
  status
}: BillingDialogProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openedAtRef = useRef(0);
  const [operation, setOperation] = useState<SheetPackProduct>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<SheetPackProduct>();
  const atLimit =
    !status.canCreateSheet || status.sheetCount >= status.sheetLimit;
  const usagePercent =
    status.sheetLimit > 0
      ? Math.max(
          0,
          Math.min(100, (status.sheetCount / status.sheetLimit) * 100)
        )
      : 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      openedAtRef.current = window.performance.now();
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setOperation(undefined);
    setMessage("");
    setError(undefined);
  }, [open]);

  const runCheckout = async (product: SheetPackProduct): Promise<void> => {
    if (operation) return;
    setOperation(product);
    setMessage("");
    setError(undefined);
    try {
      await onCheckout(product);
      setMessage(
        preview
          ? "Preview only — live checkout opens securely in your browser."
          : "Checkout opened in your browser. Your sheets will update after payment."
      );
    } catch (error) {
      console.error("Could not open checkout.", error);
      setError(product);
    } finally {
      setOperation(undefined);
    }
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>): void => {
    const openedLongEnoughAgo =
      window.performance.now() - openedAtRef.current > 300;
    if (
      event.target === event.currentTarget &&
      !operation &&
      openedLongEnoughAgo
    ) {
      onClose();
    }
  };

  return (
    <dialog
      aria-labelledby="billing-dialog-title"
      className="billing-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!operation) onClose();
      }}
      onClick={handleBackdropClick}
      ref={dialogRef}
    >
      <div aria-hidden="true" className="billing-dialog-web-scrim" />

      <button
        aria-label="Close cloud storage"
        className="billing-dialog-close icon-button titlebar-icon-button"
        disabled={Boolean(operation)}
        onClick={onClose}
        title="Close"
        type="button"
      >
        <X aria-hidden="true" className="ui-icon" />
      </button>

      <section className="billing-dialog-content">
        <header className="billing-dialog-header">
          <h1 id="billing-dialog-title">
            {atLimit ? "Limit Reached" : "Cloud Storage"}
          </h1>
        </header>

        <section
          aria-label={`${status.sheetCount} sheets used of ${status.sheetLimit}`}
          className={`billing-quota-visualization ${atLimit ? "is-at-limit" : ""}`}
        >
          <span
            aria-label={`${status.sheetCount} of ${status.sheetLimit} sheets used`}
            aria-valuemax={status.sheetLimit}
            aria-valuemin={0}
            aria-valuenow={status.sheetCount}
            className="billing-quota-progress"
            role="progressbar"
          >
            <span className="billing-quota-boundary">0</span>
            <span
              aria-hidden="true"
              className="billing-quota-progress-meter"
              style={
                {
                  "--billing-quota-progress": `${usagePercent}%`
                } as CSSProperties
              }
            >
              <span className="billing-quota-progress-track">
                <span className="billing-quota-progress-fill" />
              </span>
            </span>
            <span className="billing-quota-boundary billing-quota-limit">
              {status.sheetLimit}
            </span>
          </span>
        </section>

        <div className="billing-purchase-options">
          {sheetPackOffers.map((offer) => (
            <article className="billing-purchase-card" key={offer.product}>
              <strong className="billing-purchase-title">+ {offer.name}</strong>
              <span className="billing-purchase-action">
                <span className="billing-purchase-price">
                  {offer.displayPrice}
                </span>
                <button
                  aria-label={`Buy ${offer.name} for ${offer.displayPrice} with Apple Pay`}
                  className="billing-apple-pay-button"
                  disabled={
                    Boolean(operation) ||
                    !status.billingConfigured ||
                    !status.canPurchaseSheets
                  }
                  onClick={() => void runCheckout(offer.product)}
                  type="button"
                >
                  {operation === offer.product ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="billing-spinner"
                    />
                  ) : (
                    <span aria-hidden="true" className="billing-apple-pay-mark">
                      <span className="billing-apple-logo"></span>Pay
                    </span>
                  )}
                </button>
              </span>
            </article>
          ))}
        </div>

        {message ? (
          <p className="billing-dialog-message" role="status">
            {message}
          </p>
        ) : null}
      </section>

      {error ? (
        <div className="billing-dialog-error" role="alert">
          <span>Could not open checkout</span>
          <button
            disabled={Boolean(operation)}
            onClick={() => void runCheckout(error)}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
