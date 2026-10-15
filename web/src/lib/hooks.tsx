import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { ToastItem, ToastViewport, type ToastVariant } from '../components/ui/toast';

/** Load data for a page. `reload()` refetches after an action changes something. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((err: unknown) => !cancelled && setState({ data: null, error: err instanceof Error ? err.message : String(err), loading: false }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export type ToastInput = string | { title: string; description?: string; variant?: ToastVariant };
interface ToastState { id: number; title: string; description?: string; variant: ToastVariant; open: boolean }

const ToastContext = createContext<(input: ToastInput) => void>(() => {});

/** Stacked, dismissible confirmations ("Marked as applied") with success/error/warning/info styling. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastState[]>([]);
  const idRef = useRef(0);

  const show = useCallback((input: ToastInput) => {
    const opts = typeof input === 'string' ? { title: input } : input;
    const id = ++idRef.current;
    setItems((xs) => [...xs, { id, variant: 'success', ...opts, open: true }]);
  }, []);

  const close = useCallback((id: number) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, open: false } : x)));
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {items.map((item) => (
          <ToastItem key={item.id} {...item} onClose={() => close(item.id)} />
        ))}
        <ToastViewport />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Run an action, show a toast on success, an alert-styled message on failure. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      setBusy(true);
      setError(null);
      try {
        await fn();
        if (success) toast(success);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { run, busy, error };
}
