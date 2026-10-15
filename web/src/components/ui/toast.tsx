import { Toast as ToastPrimitive } from 'radix-ui';
import { AlertTriangle, CheckCircle2, Info, X, XOctagon, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

const ICON: Record<ToastVariant, LucideIcon> = { success: CheckCircle2, error: XOctagon, warning: AlertTriangle, info: Info };
const DURATION: Record<ToastVariant, number> = { success: 4000, info: 4000, warning: 5000, error: 6500 };

export function ToastItem({
  title,
  description,
  variant,
  open,
  onClose,
}: {
  title: string;
  description?: string;
  variant: ToastVariant;
  open: boolean;
  onClose: () => void;
}) {
  const Icon = ICON[variant];
  return (
    <ToastPrimitive.Root className={cn('toast', `toast-${variant}`)} open={open} duration={DURATION[variant]} onOpenChange={(o) => !o && onClose()}>
      <Icon className="toast-icon" size={20} aria-hidden="true" />
      <div className="toast-body">
        <ToastPrimitive.Title className="toast-title">{title}</ToastPrimitive.Title>
        {description && <ToastPrimitive.Description className="toast-description">{description}</ToastPrimitive.Description>}
      </div>
      <ToastPrimitive.Close className="toast-close" aria-label="Dismiss">
        <X size={14} aria-hidden="true" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function ToastViewport() {
  return <ToastPrimitive.Viewport className="toast-viewport" label="Notifications" />;
}
