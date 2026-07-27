"use client";

import { useEffect } from "react";

const CMS_PREVIEW_READY = "pixel-digital:cms-preview-ready";

/** Signals the visual editor only after the preview React tree has hydrated. */
export function CmsPreviewBridge() {
  useEffect(() => {
    if (window.parent === window) return;
    window.parent.postMessage(
      { type: CMS_PREVIEW_READY },
      window.location.origin,
    );
  }, []);

  return null;
}

export { CMS_PREVIEW_READY };
