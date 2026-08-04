"use client";

import { useEffect, useRef, useState } from "react";
import {
  heartbeatEditPresence,
  leaveEditPresence,
  type PresenceEntityType,
  type PresenceViewer,
} from "./edit-presence-actions";

const HEARTBEAT_MS = 30_000;

// Re-broadcast on the window so the page builder (a sibling client
// component under the same server-rendered PageEditor, with no shared
// React state tree to lift a prop through) can cross-reference "is anyone
// else's sectionId the same block I'm looking at right now" without this
// component needing to know the builder exists.
const PRESENCE_UPDATED_EVENT = "cms:presence-updated";

export function EditPresence({
  entityType,
  entityId,
}: Readonly<{ entityType: PresenceEntityType; entityId: string }>) {
  const [viewers, setViewers] = useState<readonly PresenceViewer[]>([]);
  const contextLabel = useRef<string | null>(null);
  const sectionId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void heartbeatEditPresence(
        entityType,
        entityId,
        contextLabel.current,
        sectionId.current,
      )
        .then((next) => {
          if (!active) return;
          setViewers(next);
          window.dispatchEvent(
            new CustomEvent(PRESENCE_UPDATED_EVENT, { detail: { viewers: next } }),
          );
        })
        .catch(() => active && setViewers([]));
    };
    refresh();
    const handleSectionSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ label?: string; sectionId?: string }>)
        .detail;
      contextLabel.current = detail?.label ?? null;
      sectionId.current = detail?.sectionId ?? null;
      refresh();
    };
    window.addEventListener("cms:section-selected", handleSectionSelection);
    const interval = window.setInterval(refresh, HEARTBEAT_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener(
        "cms:section-selected",
        handleSectionSelection,
      );
      void leaveEditPresence(entityType, entityId);
    };
  }, [entityId, entityType]);

  if (viewers.length === 0) return null;
  const names = viewers
    .map((viewer) =>
      viewer.contextLabel
        ? `${viewer.name} (${viewer.contextLabel})`
        : viewer.name,
    )
    .join(", ");
  return (
    <p className="edit-presence" role="status">
      Aussi consulté par {names}
    </p>
  );
}
