import { useCallback, useRef, useState, type ReactNode } from 'react';
import { BottomSheet } from './mobile';

export interface ConfirmRequest {
  /** Short question, shown as the sheet title. */
  readonly title: string;
  /** What will happen, in one or two plain sentences. */
  readonly message: string;
  /** The action button, for example "Delete night". */
  readonly confirmLabel: string;
  /** Marks actions that remove something for good. */
  readonly destructive?: boolean;
}

/**
 * An in-app confirmation sheet in the app's own style, in place of the browser's plain pop-up.
 * `confirm(request)` resolves true when the action button is tapped, false on Cancel or dismiss.
 * Render the returned element once in the component that asks.
 */
export function useConfirm(): [(request: ConfirmRequest) => Promise<boolean>, ReactNode] {
  const [open, setOpen] = useState(false);
  // Kept after closing so the sheet does not go blank while it slides away.
  const [shown, setShown] = useState<ConfirmRequest | null>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);

  const confirm = useCallback((request: ConfirmRequest) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setShown(request);
    setOpen(true);
  }), []);

  const answer = (value: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setOpen(false);
    resolve?.(value);
  };

  const element = <BottomSheet open={open} onOpenChange={(next) => { if (!next) answer(false); }} title={shown?.title ?? ''} snap={0.4}>
    {shown && <div className="confirm-sheet">
      <p>{shown.message}</p>
      <button className={'primary' + (shown.destructive ? ' destructive' : '')} onClick={() => answer(true)}>{shown.confirmLabel}</button>
      <button className="secondary" onClick={() => answer(false)}>Cancel</button>
    </div>}
  </BottomSheet>;

  return [confirm, element];
}
