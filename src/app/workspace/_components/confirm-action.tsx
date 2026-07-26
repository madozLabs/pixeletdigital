"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

export function ConfirmAction({
  children,
  consequence,
  confirmLabel = "Confirmer",
  pendingLabel = "Traitement…",
  className = "admin-table__action",
}: Readonly<{
  children: string;
  consequence: string;
  confirmLabel?: string;
  pendingLabel?: string;
  className?: string;
}>) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();

  if (!armed) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => setArmed(true)}
      >
        {children}
      </button>
    );
  }

  return (
    <span className="confirm-action" role="group" aria-label={children}>
      <span className="confirm-action__message" role="status">
        {consequence}
      </span>
      <input type="hidden" name="confirmed" value="on" />
      <span className="confirm-action__controls">
        <button type="submit" className={className} disabled={pending}>
          {pending ? pendingLabel : confirmLabel}
        </button>
        <button
          type="button"
          className="admin-table__action"
          disabled={pending}
          onClick={() => setArmed(false)}
        >
          Conserver
        </button>
      </span>
    </span>
  );
}
