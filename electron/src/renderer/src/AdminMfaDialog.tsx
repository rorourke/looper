import { KeyRound, LoaderCircle, ShieldCheck, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement
} from "react";
import type { AdminMfaPreparation } from "../../shared/admin";
import "./adminMfaDialog.css";

type AdminMfaDialogProps = {
  onClose: () => void;
  onVerified: () => void;
  open: boolean;
};

function conciseError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message && message.length <= 180) return message;
  }
  return "Admin verification could not be completed. Please try again.";
}

export function AdminMfaDialog({
  onClose,
  onVerified,
  open
}: AdminMfaDialogProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const generationRef = useRef(0);
  const wasOpenRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const [preparation, setPreparation] = useState<AdminMfaPreparation>();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const generation = ++generationRef.current;
      setPreparation(undefined);
      setCode("");
      setError("");
      setIsPreparing(true);
      setIsVerifying(false);
      void window.looper
        .prepareAdminMfa()
        .then((nextPreparation) => {
          if (generationRef.current === generation) {
            setPreparation(nextPreparation);
          } else {
            void window.looper.cancelAdminMfa().catch(() => undefined);
          }
        })
        .catch((preparationError: unknown) => {
          if (generationRef.current === generation) {
            setError(conciseError(preparationError));
          }
        })
        .finally(() => {
          if (generationRef.current === generation) setIsPreparing(false);
        });
    } else if (!open && wasOpenRef.current) {
      generationRef.current += 1;
      setPreparation(undefined);
      setCode("");
      setError("");
      setIsPreparing(false);
      setIsVerifying(false);
      void window.looper.cancelAdminMfa().catch(() => undefined);
    }
    wasOpenRef.current = open;
  }, [open]);

  const close = useCallback((): void => {
    if (isVerifying) return;
    generationRef.current += 1;
    void window.looper.cancelAdminMfa().catch(() => undefined);
    onClose();
  }, [isVerifying, onClose]);

  const verify = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      if (!preparation || !/^\d{6}$/.test(code) || isVerifying) return;
      const generation = generationRef.current;
      setIsVerifying(true);
      setError("");
      try {
        await window.looper.verifyAdminMfa(code);
        if (generationRef.current !== generation) return;
        generationRef.current += 1;
        onVerified();
      } catch (verificationError) {
        if (generationRef.current === generation) {
          setError(conciseError(verificationError));
          setCode("");
        }
      } finally {
        if (generationRef.current === generation) setIsVerifying(false);
      }
    },
    [code, isVerifying, onVerified, preparation]
  );

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="admin-mfa-dialog"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      ref={dialogRef}
    >
      <section className="admin-mfa-card">
        <button
          aria-label="Close admin verification"
          className="admin-mfa-close"
          disabled={isVerifying}
          onClick={close}
          type="button"
        >
          <X aria-hidden="true" size={16} />
        </button>

        <div className="admin-mfa-icon" aria-hidden="true">
          <ShieldCheck size={24} strokeWidth={1.8} />
        </div>
        <p className="admin-mfa-eyebrow">Two-step verification</p>
        <h2 id={titleId}>Secure admin access</h2>
        <p className="admin-mfa-copy" id={descriptionId}>
          {preparation?.mode === "enrollment"
            ? "Scan this one-time setup code with an authenticator app, then enter its six-digit code."
            : "Enter the six-digit code from your authenticator app."}
        </p>

        {isPreparing ? (
          <div className="admin-mfa-loading" role="status">
            <LoaderCircle className="admin-mfa-spinner" size={18} />
            Preparing secure verification…
          </div>
        ) : null}

        {preparation?.mode === "enrollment" ? (
          <div className="admin-mfa-enrollment">
            <img
              alt="Authenticator setup QR code"
              className="admin-mfa-qr"
              height={184}
              src={preparation.qrCode}
              width={184}
            />
            <div className="admin-mfa-secret">
              <span>Manual setup key</span>
              <code>{preparation.manualSecret}</code>
            </div>
          </div>
        ) : null}

        {preparation ? (
          <form className="admin-mfa-form" onSubmit={(event) => void verify(event)}>
            <label htmlFor="admin-mfa-code">
              <KeyRound aria-hidden="true" size={14} />
              {preparation.factorLabel}
            </label>
            <input
              aria-describedby={error ? errorId : undefined}
              autoComplete="one-time-code"
              autoFocus
              id="admin-mfa-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              pattern="[0-9]{6}"
              required
              value={code}
            />
            <button disabled={isVerifying || code.length !== 6} type="submit">
              {isVerifying ? "Verifying…" : "Verify and open Admin"}
            </button>
          </form>
        ) : null}

        {error ? (
          <p className="admin-mfa-error" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
        <p className="admin-mfa-recovery">
          Losing this factor requires administrator recovery through Supabase; there is
          no email-only bypass.
        </p>
      </section>
    </dialog>
  );
}
