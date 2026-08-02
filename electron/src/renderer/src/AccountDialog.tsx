import { ArrowRight, ChevronLeft, LoaderCircle, X } from "lucide-react";
import { SpringSystem, type Spring } from "rebound";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type MouseEvent,
  type ReactElement
} from "react";
import "./accountDialog.css";

export type AccountDialogAccount = {
  email: string;
  id?: string;
};

export type AccountDialogCloseReason = "cancel" | "verified";

export type AccountDialogProps = {
  dismissible?: boolean;
  initialEmail?: string;
  lockEmail?: boolean;
  onClose: (reason: AccountDialogCloseReason) => void;
  onRequestCode: (email: string) => Promise<void>;
  onVerified?: (account: AccountDialogAccount) => void;
  onVerifyCode: (
    email: string,
    code: string
  ) => Promise<AccountDialogAccount | void>;
  open: boolean;
  title?: string;
  verificationErrorLabel?: string;
};

type AccountDialogStep = "email" | "code";
type AccountDialogOperation = "requesting" | "resending" | "verifying";
type AccountDialogErrorKind = "request" | "resend" | "verify";
type AccountDialogError = {
  kind: AccountDialogErrorKind;
  message: string;
};

const ACCOUNT_DIALOG_ERROR_COPY: Record<AccountDialogErrorKind, string> = {
  request: "Could not send code",
  resend: "Could not send code",
  verify: "Could not sign in"
};

function operationError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length <= 160) {
    return error.message.trim();
  }
  if (
    typeof error === "string" &&
    error.trim() &&
    error.trim().length <= 160
  ) {
    return error.trim();
  }
  return fallback;
}

function normalizedEmail(value: string): string {
  return value.trim();
}

function normalizedCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AccountDialog({
  dismissible = true,
  initialEmail = "",
  lockEmail = false,
  onClose,
  onRequestCode,
  onVerified,
  onVerifyCode,
  open,
  title = "Sign up or log in",
  verificationErrorLabel = ACCOUNT_DIALOG_ERROR_COPY.verify
}: AccountDialogProps): ReactElement {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const operationRef = useRef<AccountDialogOperation | undefined>(undefined);
  const operationGenerationRef = useRef(0);
  const contentSpringRef = useRef<Spring | undefined>(undefined);
  const contentProgressRef = useRef(1);
  const dismissTimeoutRef = useRef<number | undefined>(undefined);
  const isDismissingRef = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  const titleId = useId();
  const codePromptId = useId();
  const errorId = useId();

  const [step, setStep] = useState<AccountDialogStep>("email");
  const [emailDraft, setEmailDraft] = useState(initialEmail);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [operation, setOperation] = useState<AccountDialogOperation>();
  const [isDismissing, setIsDismissing] = useState(false);
  const [error, setError] = useState<AccountDialogError>();
  const [statusMessage, setStatusMessage] = useState("");

  const isBusy = operation !== undefined;

  const applyAnimationProgress = useCallback((progress: number): void => {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    dialogRef.current?.style.setProperty(
      "--account-dialog-progress",
      `${clampedProgress}`
    );

    const content = contentRef.current;
    if (!content) return;
    contentProgressRef.current = clampedProgress;
    content.style.filter = `blur(${(1 - clampedProgress) * 10}px)`;
    content.style.opacity = `${clampedProgress}`;
    content.style.transform = `scale(${1 + (1 - clampedProgress) * 0.2})`;
  }, []);

  const animateContentTo = useCallback(
    (endValue: 0 | 1, onRest?: () => void): void => {
      const content = contentRef.current;
      if (!content) {
        onRest?.();
        return;
      }

      contentSpringRef.current?.destroy();
      contentSpringRef.current = undefined;

      if (prefersReducedMotion()) {
        applyAnimationProgress(endValue);
        if (endValue === 1) {
          content.style.filter = "";
          content.style.opacity = "";
          content.style.transform = "";
        }
        content.style.willChange = "";
        onRest?.();
        return;
      }

      const springSystem = new SpringSystem();
      const spring = springSystem.createSpringWithBouncinessAndSpeed(
        0,
        endValue === 0 ? 60 : 36
      );
      contentSpringRef.current = spring;
      spring.setOvershootClampingEnabled(true);
      spring.setCurrentValue(contentProgressRef.current);
      content.style.willChange = "filter, opacity, transform";
      spring.addListener({
        onSpringAtRest: () => {
          if (contentSpringRef.current !== spring) return;
          contentSpringRef.current = undefined;
          if (endValue === 1) {
            content.style.filter = "";
            content.style.opacity = "";
            content.style.transform = "";
          }
          content.style.willChange = "";
          spring.destroy();
          onRest?.();
        },
        onSpringUpdate: (updatedSpring) => {
          applyAnimationProgress(updatedSpring.getCurrentValue());
        }
      });
      spring.setEndValue(endValue);
    },
    [applyAnimationProgress]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.style.setProperty("--account-dialog-progress", "0");
      try {
        dialog.showModal();
      } catch (presentationError) {
        console.error("Could not present the account dialog modally.", presentationError);
        if (!dialog.open) {
          try {
            dialog.show();
          } catch (fallbackError) {
            console.error("Could not present the account dialog.", fallbackError);
          }
        }
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      if (dismissTimeoutRef.current !== undefined) {
        window.clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = undefined;
      }
      operationGenerationRef.current += 1;
      isDismissingRef.current = false;
      setIsDismissing(false);
      setStep("email");
      setEmailDraft(initialEmail);
      setEmail("");
      setCode("");
      operationRef.current = undefined;
      setOperation(undefined);
      setError(undefined);
      setStatusMessage("");
    } else if (!open && wasOpenRef.current) {
      if (dismissTimeoutRef.current !== undefined) {
        window.clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = undefined;
      }
      operationGenerationRef.current += 1;
      operationRef.current = undefined;
      setOperation(undefined);
    }
    wasOpenRef.current = open;
  }, [initialEmail, open]);

  useEffect(() => {
    const content = contentRef.current;
    if (!open || !content) return;

    applyAnimationProgress(0);
    animateContentTo(1);

    return () => {
      contentSpringRef.current?.destroy();
      contentSpringRef.current = undefined;
      content.style.filter = "";
      content.style.opacity = "";
      content.style.transform = "";
      content.style.willChange = "";
      dialogRef.current?.style.removeProperty("--account-dialog-progress");
    };
  }, [animateContentTo, applyAnimationProgress, open]);

  useEffect(() => {
    if (!open || isBusy || isDismissing) return;

    const animationFrame = window.requestAnimationFrame(() => {
      if (step === "email") {
        emailInputRef.current?.focus();
      } else {
        codeInputRef.current?.focus();
      }
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isBusy, isDismissing, open, step]);

  const closeDialog = useCallback((reason: AccountDialogCloseReason): void => {
    if (reason === "cancel" && !dismissible) return;
    if (isDismissingRef.current) return;

    operationGenerationRef.current += 1;
    operationRef.current = undefined;
    setOperation(undefined);

    isDismissingRef.current = true;
    setIsDismissing(true);
    let didFinishDismissal = false;
    const finishDismissal = (): void => {
      if (didFinishDismissal) return;
      didFinishDismissal = true;
      if (dismissTimeoutRef.current !== undefined) {
        window.clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = undefined;
      }
      contentSpringRef.current?.destroy();
      contentSpringRef.current = undefined;
      applyAnimationProgress(0);
      onClose(reason);
    };
    animateContentTo(0, finishDismissal);
    dismissTimeoutRef.current = window.setTimeout(finishDismissal, 90);
  }, [animateContentTo, applyAnimationProgress, dismissible, onClose]);

  const requestCode = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      if (operationRef.current) return;

      const requestedEmail = normalizedEmail(emailDraft);
      if (!requestedEmail || !emailInputRef.current?.checkValidity()) {
        emailInputRef.current?.reportValidity();
        return;
      }

      const generation = ++operationGenerationRef.current;
      operationRef.current = "requesting";
      setOperation("requesting");
      setError(undefined);
      setStatusMessage("");

      try {
        await onRequestCode(requestedEmail);
        if (generation !== operationGenerationRef.current || !openRef.current) return;

        setEmail(requestedEmail);
        setEmailDraft(requestedEmail);
        setCode("");
        setStep("code");
      } catch (requestError) {
        if (generation !== operationGenerationRef.current || !openRef.current) return;
        console.error("Could not send a sign-in code.", requestError);
        setError({
          kind: "request",
          message: operationError(
            requestError,
            ACCOUNT_DIALOG_ERROR_COPY.request
          )
        });
      } finally {
        if (generation === operationGenerationRef.current && openRef.current) {
          operationRef.current = undefined;
          setOperation(undefined);
        }
      }
    },
    [emailDraft, onRequestCode]
  );

  const verifyCode = useCallback(
    async (requestedCode: string): Promise<void> => {
      const verificationCode = normalizedCode(requestedCode);
      if (operationRef.current || verificationCode.length !== 6 || !email) return;

      const generation = ++operationGenerationRef.current;
      operationRef.current = "verifying";
      setOperation("verifying");
      setError(undefined);
      setStatusMessage("");

      try {
        const account = await onVerifyCode(email, verificationCode);
        if (generation !== operationGenerationRef.current || !openRef.current) return;

        onVerified?.(account ?? { email });
        closeDialog("verified");
      } catch (verificationError) {
        if (generation !== operationGenerationRef.current || !openRef.current) return;
        console.error("Could not verify the sign-in code.", verificationError);
        setError({
          kind: "verify",
          message: operationError(
            verificationError,
            verificationErrorLabel
          )
        });
      } finally {
        if (generation === operationGenerationRef.current && openRef.current) {
          operationRef.current = undefined;
          setOperation(undefined);
        }
      }
    },
    [closeDialog, email, onVerified, onVerifyCode, verificationErrorLabel]
  );

  const submitCode = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      void verifyCode(code);
    },
    [code, verifyCode]
  );

  const updateCode = useCallback(
    (value: string): void => {
      const nextCode = normalizedCode(value);
      setCode(nextCode);
      setError(undefined);
      setStatusMessage("");
      if (nextCode.length === 6) void verifyCode(nextCode);
    },
    [verifyCode]
  );

  const pasteCode = useCallback(
    (event: ClipboardEvent<HTMLInputElement>): void => {
      const pastedCode = normalizedCode(event.clipboardData.getData("text/plain"));
      if (!pastedCode) return;
      event.preventDefault();
      updateCode(pastedCode);
    },
    [updateCode]
  );

  const resendCode = useCallback(async (): Promise<void> => {
    if (operationRef.current || !email) return;

    const generation = ++operationGenerationRef.current;
    operationRef.current = "resending";
    setOperation("resending");
    setError(undefined);
    setStatusMessage("");

    try {
      await onRequestCode(email);
      if (generation !== operationGenerationRef.current || !openRef.current) return;
      setCode("");
      setStatusMessage("A new code is on its way.");
    } catch (requestError) {
      if (generation !== operationGenerationRef.current || !openRef.current) return;
      console.error("Could not resend the sign-in code.", requestError);
      setError({
        kind: "resend",
        message: operationError(
          requestError,
          ACCOUNT_DIALOG_ERROR_COPY.resend
        )
      });
    } finally {
      if (generation === operationGenerationRef.current && openRef.current) {
        operationRef.current = undefined;
        setOperation(undefined);
      }
    }
  }, [email, onRequestCode]);

  const retryError = useCallback((): void => {
    if (!error || operationRef.current) return;

    if (error.kind === "request") {
      emailInputRef.current?.form?.requestSubmit();
    } else if (error.kind === "resend") {
      void resendCode();
    } else {
      void verifyCode(code);
    }
  }, [code, error, resendCode, verifyCode]);

  const changeEmail = useCallback((): void => {
    if (operationRef.current) return;
    setStep("email");
    setEmailDraft(email);
    setCode("");
    setError(undefined);
    setStatusMessage("");
  }, [email]);

  const describedBy = [step === "code" ? codePromptId : "", error ? errorId : ""]
    .filter(Boolean)
    .join(" ");

  const handleDialogClick = useCallback(
    (event: MouseEvent<HTMLDialogElement>): void => {
      if (step !== "email" || event.target !== event.currentTarget) return;
      closeDialog("cancel");
    },
    [closeDialog, step]
  );

  return (
    <dialog
      aria-label={title}
      aria-modal="true"
      className="account-dialog"
      onCancel={(event) => {
        event.preventDefault();
        closeDialog("cancel");
      }}
      onClick={handleDialogClick}
      ref={dialogRef}
    >
      <div aria-hidden="true" className="account-dialog-web-scrim" />

      {dismissible ? (
        <button
          aria-label={`Close ${title.toLowerCase()}`}
          className="account-dialog-close icon-button titlebar-icon-button"
          disabled={isDismissing}
          onClick={() => closeDialog("cancel")}
          title="Close"
          type="button"
        >
          <X aria-hidden="true" className="ui-icon" />
        </button>
      ) : null}

      {step === "code" && !lockEmail ? (
        <button
          aria-label="Edit email address"
          className="account-dialog-email-back-button icon-button titlebar-icon-button mobile-sheet-nav-button mobile-sheet-back-button"
          disabled={isBusy || isDismissing}
          onClick={changeEmail}
          title="Edit email address"
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="ui-icon back-icon" />
        </button>
      ) : null}

      <div className="account-dialog-content" ref={contentRef}>
        <h1 className="account-dialog-title">{title}</h1>

        <div className="account-dialog-step">
          {step === "email" ? (
            <form
              aria-busy={isBusy}
              className="account-dialog-form"
              data-auth-method="email-code"
              onSubmit={(event) => void requestCode(event)}
            >
              {/* Keep sign-in email-only until another live provider is explicitly configured. */}
              <label className="account-dialog-sr-only" htmlFor={`${titleId}-email`}>
                Email address
              </label>
              <div className="account-dialog-email-field">
                <input
                  aria-describedby={describedBy || undefined}
                  aria-invalid={Boolean(error)}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isBusy || isDismissing}
                  id={`${titleId}-email`}
                  inputMode="email"
                  onChange={(event) => {
                    setEmailDraft(event.currentTarget.value);
                    setError(undefined);
                    setStatusMessage("");
                  }}
                  placeholder="Email address"
                  readOnly={lockEmail}
                  ref={emailInputRef}
                  required
                  spellCheck={false}
                  type="email"
                  value={emailDraft}
                />
                {normalizedEmail(emailDraft).length > 0 ? (
                  <button
                    aria-label={operation === "requesting" ? "Sending code" : "Continue"}
                    className="account-dialog-email-submit"
                    disabled={isBusy || isDismissing}
                    title="Continue"
                    type="submit"
                  >
                    {operation === "requesting" ? (
                      <LoaderCircle aria-hidden="true" className="account-dialog-spinner" />
                    ) : (
                      <ArrowRight aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </div>

            </form>
          ) : (
            <form
              aria-busy={isBusy}
              className="account-dialog-form code-step"
              onSubmit={submitCode}
            >
              <label className="account-dialog-sr-only" htmlFor={`${titleId}-code`}>
                Six-digit verification code
              </label>
              <div
                className="account-dialog-code-cells"
                data-busy={isBusy || undefined}
                onClick={() => codeInputRef.current?.focus()}
              >
                <input
                  aria-describedby={describedBy || undefined}
                  aria-invalid={Boolean(error)}
                  autoComplete="one-time-code"
                  className="account-dialog-code-input"
                  disabled={isBusy || isDismissing}
                  id={`${titleId}-code`}
                  inputMode="numeric"
                  maxLength={6}
                  name="one-time-code"
                  onChange={(event) => updateCode(event.currentTarget.value)}
                  onPaste={pasteCode}
                  pattern="[0-9]{6}"
                  ref={codeInputRef}
                  required
                  spellCheck={false}
                  type="text"
                  value={code}
                />
                {Array.from({ length: 6 }, (_, index) => (
                  <span
                    aria-hidden="true"
                    className="account-dialog-code-cell"
                    data-active={
                      index === Math.min(code.length, 5) ? true : undefined
                    }
                    data-filled={Boolean(code[index]) || undefined}
                    key={index}
                  >
                    {code[index] ?? ""}
                  </span>
                ))}
              </div>

              <p className="account-dialog-code-prompt" id={codePromptId}>
                Sent to <strong title={email}>{email}</strong>
              </p>

              {statusMessage ? (
                <p className="account-dialog-status" role="status">
                  {statusMessage}
                </p>
              ) : null}

              <div className="account-dialog-code-links">
                <button
                  disabled={isBusy || isDismissing}
                  onClick={() => void resendCode()}
                  type="button"
                >
                  {operation === "resending" ? "Sending…" : "Resend Code"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {operation === "verifying" ? (
        <div className="account-dialog-code-verifying" role="status">
          <LoaderCircle aria-hidden="true" className="account-dialog-spinner" />
          <span className="account-dialog-sr-only">Checking code…</span>
        </div>
      ) : null}

      {error ? (
        <div className="account-dialog-error" id={errorId} role="alert">
          <span>{error.message}</span>
          <button
            disabled={isBusy || isDismissing}
            onClick={retryError}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : null}
    </dialog>
  );
}

export default AccountDialog;
