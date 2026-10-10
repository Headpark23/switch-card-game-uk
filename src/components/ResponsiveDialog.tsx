import React, { forwardRef } from 'react';
import { X } from '@phosphor-icons/react';

export function MobileScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={`responsive-scroll-view ${className || ''}`}>{children}</div>;
}

export const KeyboardInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => {
  return <input ref={ref} {...props} />;
});
KeyboardInput.displayName = 'KeyboardInput';

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="companion-sheet-overlay" onClick={() => onOpenChange(false)}>
      <div className="companion-sheet-container" onClick={(e) => e.stopPropagation()}>
        <div className="companion-sheet-drag-pill" />
        <div className="companion-sheet-header">
          <div>
            <h3>{title}</h3>
            {description && <p className="companion-sheet-desc">{description}</p>}
          </div>
          <button
            type="button"
            className="companion-sheet-close"
            onClick={() => onOpenChange(false)}
            aria-label="Close sheet"
          >
            <X size={20} weight="bold" />
          </button>
        </div>
        <div className="companion-sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function useKeyboard() {
  return {
    hide: () => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    show: () => {},
    visible: false,
  };
}

export function useKeyboardInsets() {
  return {
    bottomInset: 0,
    keyboardHeight: 0,
    isKeyboardVisible: false,
    keyboardDragging: false,
  };
}
