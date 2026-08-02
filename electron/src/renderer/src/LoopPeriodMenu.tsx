import { Check } from "lucide-react";
import type { ReactElement, RefObject } from "react";

type LoopPeriodMenuProps = {
  allowNone: boolean;
  className?: string;
  customEditing: boolean;
  draft: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isCustom: boolean;
  label: string;
  onBeginCustom: () => void;
  onCancel: () => void;
  onCommit: (value: string) => void;
  onDraftChange: (value: string) => void;
  presets: readonly string[];
};

export function LoopPeriodMenu({
  allowNone,
  className = "",
  customEditing,
  draft,
  inputRef,
  isCustom,
  label,
  onBeginCustom,
  onCancel,
  onCommit,
  onDraftChange,
  presets
}: LoopPeriodMenuProps): ReactElement {
  const classes = `loop-period-menu ${className}`.trim();

  if (customEditing) {
    return (
      <form
        aria-label="Custom iteration label"
        className={`${classes} loop-period-custom-form`}
        onSubmit={(event) => {
          event.preventDefault();
          onCommit(draft);
        }}
        role="dialog"
      >
        <label htmlFor="loop-period-custom-input">Custom label</label>
        <input
          id="loop-period-custom-input"
          onChange={(event) => onDraftChange(event.currentTarget.value)}
          placeholder="e.g. Sprint"
          ref={inputRef}
          spellCheck={false}
          value={draft}
        />
        <div className="loop-period-custom-actions">
          <button onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary" disabled={!draft.trim()} type="submit">
            Save
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={classes} role="menu" aria-label="Iteration label">
      {allowNone ? (
        <button
          aria-checked={label === "None"}
          className={label === "None" ? "selected" : ""}
          onClick={() => onCommit("None")}
          role="menuitemradio"
          type="button"
        >
          <span className="loop-period-menu-check" aria-hidden="true">
            {label === "None" ? <Check className="ui-icon" focusable="false" strokeWidth={2} /> : null}
          </span>
          <span>None</span>
        </button>
      ) : null}
      {presets.map((preset) => (
        <button
          aria-checked={label === preset}
          className={label === preset ? "selected" : ""}
          key={preset}
          onClick={() => onCommit(preset)}
          role="menuitemradio"
          type="button"
        >
          <span className="loop-period-menu-check" aria-hidden="true">
            {label === preset ? <Check className="ui-icon" focusable="false" strokeWidth={2} /> : null}
          </span>
          <span>{preset}</span>
        </button>
      ))}
      <button
        aria-checked={isCustom}
        className={isCustom ? "selected" : ""}
        onClick={onBeginCustom}
        role="menuitemradio"
        type="button"
      >
        <span className="loop-period-menu-check" aria-hidden="true">
          {isCustom ? <Check className="ui-icon" focusable="false" strokeWidth={2} /> : null}
        </span>
        <span>Custom</span>
      </button>
    </div>
  );
}
