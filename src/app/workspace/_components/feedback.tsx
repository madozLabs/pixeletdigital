"use client";

import { useFormStatus } from "react-dom";

export type ActionState = Readonly<{
  status: "idle" | "success" | "error";
  message?: string;
}>;

export const IDLE_ACTION_STATE: ActionState = { status: "idle" };

export function Feedback({ state }: Readonly<{ state: ActionState }>) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      className={`admin-feedback admin-feedback--${state.status}`}
      role={state.status === "error" ? "alert" : "status"}
    >
      {state.message}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Traitement…",
  className = "admin-table__action",
}: Readonly<{
  children: string;
  pendingLabel?: string;
  className?: string;
}>) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
