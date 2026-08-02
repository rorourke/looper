import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type RefObject
} from "react";
import { createPortal } from "react-dom";

const closeAnimationDuration = 340;
const dragDismissDistance = 96;
const dragDismissVelocity = 0.55;
const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

type MobileLoopSheetProps = {
  children: ReactNode;
  containerRef: RefObject<HTMLDivElement | null>;
  labelledBy: string;
  onRequestClose: () => void;
  open: boolean;
};

export function MobileLoopSheet({
  children,
  containerRef,
  labelledBy,
  onRequestClose,
  open
}: MobileLoopSheetProps): ReactElement | null {
  const [isRendered, setIsRendered] = useState(open);
  const [isVisible, setIsVisible] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{
    offset: number;
    pointerId: number;
    startedAt: number;
    startY: number;
  } | undefined>(undefined);

  useEffect(() => {
    if (open) {
      if (document.activeElement instanceof HTMLElement) {
        restoreFocusRef.current = document.activeElement;
      }
      setDragOffset(0);
      setIsRendered(true);
      const frame = window.requestAnimationFrame(() => {
        setIsVisible(true);
        panelRef.current?.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setIsVisible(false);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 1
      : closeAnimationDuration;
    const timeout = window.setTimeout(() => {
      setIsRendered(false);
      restoreFocusRef.current?.focus({ preventScroll: true });
    }, duration);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onRequestClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusableElements = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(focusableSelector)
    );
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === event.currentTarget)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const elapsed = Math.max(performance.now() - drag.startedAt, 1);
    const velocity = drag.offset / elapsed;
    dragRef.current = undefined;
    setIsDragging(false);
    if (drag.offset >= dragDismissDistance || velocity >= dragDismissVelocity) {
      onRequestClose();
      return;
    }
    setDragOffset(0);
  };

  if (!isRendered) return null;

  const panelStyle = {
    "--mobile-loop-sheet-drag-offset": `${dragOffset}px`
  } as CSSProperties;

  return createPortal(
    <div
      className="mobile-loop-sheet"
      data-state={isVisible ? "open" : "closed"}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onRequestClose();
      }}
      ref={containerRef}
    >
      <section
        aria-labelledby={labelledBy}
        aria-modal="true"
        className="loop-count-slider-popover mobile-loop-sheet-panel"
        data-dragging={isDragging ? "true" : "false"}
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
        style={panelStyle}
        tabIndex={-1}
      >
        <div
          aria-hidden="true"
          className="mobile-loop-sheet-grabber-area"
          onPointerCancel={(event) => {
            if (dragRef.current?.pointerId !== event.pointerId) return;
            dragRef.current = undefined;
            setIsDragging(false);
            setDragOffset(0);
          }}
          onPointerDown={(event) => {
            dragRef.current = {
              offset: 0,
              pointerId: event.pointerId,
              startedAt: performance.now(),
              startY: event.clientY
            };
            setIsDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) return;
            drag.offset = Math.max(0, event.clientY - drag.startY);
            setDragOffset(drag.offset);
          }}
          onPointerUp={finishDrag}
        >
          <span className="mobile-loop-sheet-grabber" />
        </div>
        {children}
      </section>
    </div>,
    document.body
  );
}
