import { Dialog } from 'radix-ui';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1] as const;

/** A popup for reviewing something in place, instead of navigating to its own page. */
export function Modal({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  // Freeze the content shown while closing, so the exit animation plays over the job that was
  // open rather than over blank space (the caller clears its id the instant it calls onClose).
  const last = useRef({ title, children });
  if (open) last.current = { title, children };
  const shown = open ? { title, children } : last.current;
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.18 }} />
            </Dialog.Overlay>
            <div className="modal-container">
              <Dialog.Content asChild forceMount>
                <motion.div
                  className={cn('modal-content', className)}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: EASE }}
                >
                  <Dialog.Title className="visually-hidden">{shown.title}</Dialog.Title>
                  <div className="modal-head">
                    <Dialog.Close className="modal-close" aria-label="Close">
                      <X size={18} aria-hidden="true" />
                    </Dialog.Close>
                  </div>
                  <div className="modal-body">{shown.children}</div>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
