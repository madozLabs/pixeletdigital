import Image from "next/image";
import type { CSSProperties } from "react";

import {
  storedSectionImageSetting,
  type SectionImageSettingKey,
} from "@/modules/content/domain/section-image-settings";

import type { CmsMediaAsset } from "./cms-section";

const FONT_VALUES = {
  OUTFIT: "var(--font-outfit), system-ui, sans-serif",
  MANROPE: "var(--font-manrope), system-ui, sans-serif",
  BALOO: "var(--font-baloo), system-ui, sans-serif",
  SYSTEM: "system-ui, sans-serif",
} as const;

const WEIGHTS = ["400", "500", "600", "700", "800", "900"] as const;
const STYLES = ["normal", "italic"] as const;
const TONES = ["AUTO", "LIGHT", "DARK"] as const;
const OVERLAYS = ["NONE", "LIGHT", "MEDIUM", "STRONG"] as const;
const POSITIONS = ["CENTER", "TOP", "BOTTOM"] as const;

type DesignStyle = CSSProperties & {
  "--cms-heading-font"?: string;
  "--cms-heading-weight"?: string;
  "--cms-heading-style"?: string;
  "--cms-body-font"?: string;
  "--cms-body-weight"?: string;
  "--cms-body-style"?: string;
  "--cms-image-opacity"?: string;
  "--cms-image-fit"?: string;
  "--cms-image-position-x"?: string;
  "--cms-image-position-y"?: string;
  "--cms-image-zoom"?: string;
  "--cms-image-width"?: string;
  "--cms-image-height"?: string;
  "--cms-image-overlay-color"?: string;
  "--cms-image-overlay-opacity"?: string;
  "--cms-background-image-opacity"?: string;
  "--cms-background-position-x"?: string;
  "--cms-background-position-y"?: string;
  "--cms-background-zoom"?: string;
  "--cms-background-overlay-color"?: string;
  "--cms-background-overlay-opacity"?: string;
};

type ImageDesignVariable =
  | "--cms-image-opacity"
  | "--cms-image-position-x"
  | "--cms-image-position-y"
  | "--cms-image-zoom"
  | "--cms-image-width"
  | "--cms-image-overlay-opacity"
  | "--cms-background-image-opacity"
  | "--cms-background-position-x"
  | "--cms-background-position-y"
  | "--cms-background-zoom"
  | "--cms-background-overlay-opacity";

const OVERLAY_COLORS = {
  BLACK: "rgb(0 0 0)",
  WHITE: "rgb(255 255 255)",
  ACCENT: "var(--accent)",
} as const;

export function cmsSectionDesignProps(
  payload: Readonly<Record<string, unknown>>,
  baseClassName: string,
) {
  const headingFont = enumValue(payload.headingFont, Object.keys(FONT_VALUES));
  const bodyFont = enumValue(payload.bodyFont, Object.keys(FONT_VALUES));
  const headingWeight = enumValue(payload.headingWeight, WEIGHTS);
  const bodyWeight = enumValue(payload.bodyWeight, WEIGHTS);
  const headingStyle = enumValue(payload.headingStyle, STYLES);
  const bodyStyle = enumValue(payload.bodyStyle, STYLES);
  const tone = enumValue(payload.textTone, TONES) ?? "AUTO";
  const hasBackground = Boolean(stringValue(payload.backgroundMediaId));
  const resolvedTone = tone === "AUTO" && hasBackground ? "LIGHT" : tone;
  const classNames = [baseClassName, "cms-designed-section"];
  const style: DesignStyle = {};

  if (hasBackground) classNames.push("cms-section--has-background");
  if (resolvedTone !== "AUTO")
    classNames.push(`cms-section--text-${resolvedTone.toLowerCase()}`);
  if (headingFont) {
    classNames.push("cms-section--custom-heading-font");
    style["--cms-heading-font"] =
      FONT_VALUES[headingFont as keyof typeof FONT_VALUES];
  }
  if (bodyFont) {
    classNames.push("cms-section--custom-body-font");
    style["--cms-body-font"] =
      FONT_VALUES[bodyFont as keyof typeof FONT_VALUES];
  }
  if (headingWeight) {
    classNames.push("cms-section--custom-heading-weight");
    style["--cms-heading-weight"] = headingWeight;
  }
  if (bodyWeight) {
    classNames.push("cms-section--custom-body-weight");
    style["--cms-body-weight"] = bodyWeight;
  }
  if (headingStyle) {
    classNames.push("cms-section--custom-heading-style");
    style["--cms-heading-style"] = headingStyle;
  }
  if (bodyStyle) {
    classNames.push("cms-section--custom-body-style");
    style["--cms-body-style"] = bodyStyle;
  }
  applyImageDesignVariables(payload, style);
  return { className: classNames.join(" "), style };
}

export function CmsSectionBackground({
  payload,
  mediaById,
  priority = false,
}: Readonly<{
  payload: Readonly<Record<string, unknown>>;
  mediaById: ReadonlyMap<string, CmsMediaAsset>;
  priority?: boolean;
}>) {
  const backgroundId = stringValue(payload.backgroundMediaId);
  const asset = backgroundId ? mediaById.get(backgroundId) : null;
  if (!asset?.mimeType.startsWith("image/")) return null;
  const overlay = enumValue(payload.backgroundOverlay, OVERLAYS) ?? "MEDIUM";
  const position = enumValue(payload.backgroundPosition, POSITIONS) ?? "CENTER";
  return (
    <div
      className={`cms-section-background cms-section-background--${position.toLowerCase()}`}
      data-cms-media-slot="background"
      aria-hidden="true"
    >
      <Image
        src={asset.publicUrl}
        alt=""
        fill
        priority={priority}
        sizes="100vw"
      />
      <span
        className={`cms-section-background__overlay cms-section-background__overlay--${overlay.toLowerCase()}`}
      />
    </div>
  );
}

export function CmsPrimaryImageOverlay() {
  return <span className="cms-primary-image-overlay" aria-hidden="true" />;
}

function applyImageDesignVariables(
  payload: Readonly<Record<string, unknown>>,
  style: DesignStyle,
) {
  setPercentVariable(payload, style, "imageOpacity", "--cms-image-opacity");
  setPercentVariable(
    payload,
    style,
    "imagePositionX",
    "--cms-image-position-x",
    "%",
  );
  setPercentVariable(
    payload,
    style,
    "imagePositionY",
    "--cms-image-position-y",
    "%",
  );
  setScaleVariable(payload, style, "imageZoom", "--cms-image-zoom");
  setPercentVariable(payload, style, "imageWidth", "--cms-image-width", "%");
  const imageHeight = storedSectionImageSetting(payload, "imageHeight");
  if (imageHeight && imageHeight !== "0") {
    style["--cms-image-height"] = `${imageHeight}px`;
  }
  const imageFit = storedSectionImageSetting(payload, "imageFit");
  if (imageFit) style["--cms-image-fit"] = imageFit.toLowerCase();
  setPercentVariable(
    payload,
    style,
    "imageOverlayOpacity",
    "--cms-image-overlay-opacity",
  );
  const imageOverlayColor = storedSectionImageSetting(
    payload,
    "imageOverlayColor",
  ) as keyof typeof OVERLAY_COLORS | null;
  if (imageOverlayColor) {
    style["--cms-image-overlay-color"] = OVERLAY_COLORS[imageOverlayColor];
  }

  setPercentVariable(
    payload,
    style,
    "backgroundImageOpacity",
    "--cms-background-image-opacity",
  );
  setPercentVariable(
    payload,
    style,
    "backgroundPositionX",
    "--cms-background-position-x",
    "%",
  );
  setPercentVariable(
    payload,
    style,
    "backgroundPositionY",
    "--cms-background-position-y",
    "%",
  );
  setScaleVariable(payload, style, "backgroundZoom", "--cms-background-zoom");
  setPercentVariable(
    payload,
    style,
    "backgroundOverlayOpacity",
    "--cms-background-overlay-opacity",
  );
  const overlayColor = storedSectionImageSetting(
    payload,
    "backgroundOverlayColor",
  ) as keyof typeof OVERLAY_COLORS | null;
  if (overlayColor) {
    style["--cms-background-overlay-color"] = OVERLAY_COLORS[overlayColor];
  }
}

function setPercentVariable(
  payload: Readonly<Record<string, unknown>>,
  style: DesignStyle,
  key: SectionImageSettingKey,
  variable: ImageDesignVariable,
  suffix = "",
) {
  const value = storedSectionImageSetting(payload, key);
  if (value === null) return;
  style[variable] = suffix ? `${value}${suffix}` : String(Number(value) / 100);
}

function setScaleVariable(
  payload: Readonly<Record<string, unknown>>,
  style: DesignStyle,
  key: SectionImageSettingKey,
  variable: ImageDesignVariable,
) {
  const value = storedSectionImageSetting(payload, key);
  if (value !== null) style[variable] = String(Number(value) / 100);
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
