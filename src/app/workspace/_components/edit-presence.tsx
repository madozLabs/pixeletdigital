"use client";

import { useEffect, useState } from "react";
import {
  heartbeatEditPresence,
  leaveEditPresence,
  type PresenceEntityType,
  type PresenceViewer,
} from "./edit-presence-actions";

const HEARTBEAT_MS = 30_000;

export function EditPresence({
  entityType,
  entityId,
}: Readonly<{ entityType: PresenceEntityType; entityId: string }>) {
  const [viewers, setViewers] = useState<readonly PresenceViewer[]>([]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void heartbeatEditPresence(entityType, entityId)
        .then((next) => active && setViewers(next))
        .catch(() => active && setViewers([]));
    };
    refresh();
    const interval = window.setInterval(refresh, HEARTBEAT_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
      void leaveEditPresence(entityType, entityId);
    };
  }, [entityId, entityType]);

  if (viewers.length === 0) return null;
  const names = viewers.map((viewer) => viewer.name).join(", ");
  return (
    <p className="edit-presence" role="status">
      Aussi consulté par {names}
    </p>
  );
}
