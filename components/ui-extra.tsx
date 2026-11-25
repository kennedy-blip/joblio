'use client';

import { useEffect, useState } from 'react';

/** Two-step destructive action that never relies on window.confirm. */
export function ConfirmButton({
  children,
  label,
  confirmLabel,
  onConfirm,
  className = 'btn btn-xs',
  timeout = 4000,
}: {
  children?: React.ReactNode;
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  timeout?: number;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), timeout);
    return () => clearTimeout(t);
  }, [armed, timeout]);

  return (
    <button
      className={className}
      onClick={() => {
        if (armed) {
          onConfirm();
          setArmed(false);
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : (children ?? label)}
    </button>
  );
}

export { Toast } from '@/components/ui';
