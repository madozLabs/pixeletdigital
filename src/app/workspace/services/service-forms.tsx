"use client";

import { useActionState } from "react";

import {
  Feedback,
  IDLE_ACTION_STATE,
  SubmitButton,
} from "../_components/feedback";
import { ConfirmAction } from "../_components/confirm-action";
import {
  archiveServiceAction,
  publishServiceAction,
  rejectServiceAction,
  submitForReviewAction,
} from "./actions";

export function ServiceLifecycleActions({
  serviceId,
  version,
  lifecycle,
}: Readonly<{ serviceId: string; version: number; lifecycle: string }>) {
  const [submitState, submitAction] = useActionState(
    submitForReviewAction,
    IDLE_ACTION_STATE,
  );
  const [publishState, publishAction] = useActionState(
    publishServiceAction,
    IDLE_ACTION_STATE,
  );
  const [rejectState, rejectAction] = useActionState(
    rejectServiceAction,
    IDLE_ACTION_STATE,
  );
  const [archiveState, archiveAction] = useActionState(
    archiveServiceAction,
    IDLE_ACTION_STATE,
  );

  if (lifecycle === "DRAFT") {
    return (
      <form action={submitAction}>
        <input type="hidden" name="id" value={serviceId} />
        <input type="hidden" name="expectedVersion" value={version} />
        <SubmitButton>Soumettre pour revue</SubmitButton>
        <Feedback state={submitState} />
      </form>
    );
  }

  if (lifecycle === "IN_REVIEW") {
    return (
      <>
        <form action={publishAction}>
          <input type="hidden" name="id" value={serviceId} />
          <input type="hidden" name="expectedVersion" value={version} />
          <SubmitButton>Publier</SubmitButton>
          <Feedback state={publishState} />
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="id" value={serviceId} />
          <input type="hidden" name="expectedVersion" value={version} />
          <SubmitButton>Renvoyer en brouillon</SubmitButton>
          <Feedback state={rejectState} />
        </form>
      </>
    );
  }

  if (lifecycle === "PUBLISHED") {
    return (
      <form action={archiveAction}>
        <input type="hidden" name="id" value={serviceId} />
        <input type="hidden" name="expectedVersion" value={version} />
        <ConfirmAction consequence="Le service sera retiré des contenus publiés.">
          Archiver
        </ConfirmAction>
        <Feedback state={archiveState} />
      </form>
    );
  }

  return <span className="admin-table__note">Aucune action</span>;
}
