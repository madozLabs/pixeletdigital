export const SECTION_IMAGE_SETTING_KEYS = [
  "imageOpacity",
  "imageFit",
  "imagePositionX",
  "imagePositionY",
  "imageZoom",
  "imageWidth",
  "imageHeight",
  "imageOverlayColor",
  "imageOverlayOpacity",
  "backgroundImageOpacity",
  "backgroundPositionX",
  "backgroundPositionY",
  "backgroundZoom",
  "backgroundOverlayColor",
  "backgroundOverlayOpacity",
] as const;

export type SectionImageSettingKey =
  (typeof SECTION_IMAGE_SETTING_KEYS)[number];

type NumericSettingSpec = Readonly<{
  kind: "NUMBER";
  min: number;
  max: number;
  defaultValue: number;
}>;

type EnumSettingSpec = Readonly<{
  kind: "ENUM";
  values: readonly string[];
  defaultValue: string;
}>;

const SETTING_SPECS: Readonly<
  Record<SectionImageSettingKey, NumericSettingSpec | EnumSettingSpec>
> = {
  imageOpacity: { kind: "NUMBER", min: 0, max: 100, defaultValue: 100 },
  imageFit: {
    kind: "ENUM",
    values: ["COVER", "CONTAIN"],
    defaultValue: "COVER",
  },
  imagePositionX: { kind: "NUMBER", min: 0, max: 100, defaultValue: 50 },
  imagePositionY: { kind: "NUMBER", min: 0, max: 100, defaultValue: 50 },
  imageZoom: { kind: "NUMBER", min: 100, max: 200, defaultValue: 100 },
  imageWidth: { kind: "NUMBER", min: 20, max: 100, defaultValue: 100 },
  imageHeight: { kind: "NUMBER", min: 0, max: 1200, defaultValue: 0 },
  imageOverlayColor: {
    kind: "ENUM",
    values: ["BLACK", "WHITE", "ACCENT"],
    defaultValue: "BLACK",
  },
  imageOverlayOpacity: {
    kind: "NUMBER",
    min: 0,
    max: 100,
    defaultValue: 0,
  },
  backgroundImageOpacity: {
    kind: "NUMBER",
    min: 0,
    max: 100,
    defaultValue: 100,
  },
  backgroundPositionX: {
    kind: "NUMBER",
    min: 0,
    max: 100,
    defaultValue: 50,
  },
  backgroundPositionY: {
    kind: "NUMBER",
    min: 0,
    max: 100,
    defaultValue: 50,
  },
  backgroundZoom: {
    kind: "NUMBER",
    min: 100,
    max: 200,
    defaultValue: 100,
  },
  backgroundOverlayColor: {
    kind: "ENUM",
    values: ["BLACK", "WHITE", "ACCENT"],
    defaultValue: "BLACK",
  },
  backgroundOverlayOpacity: {
    kind: "NUMBER",
    min: 0,
    max: 100,
    defaultValue: 30,
  },
};

export function isSectionImageSettingKey(
  value: string,
): value is SectionImageSettingKey {
  return SECTION_IMAGE_SETTING_KEYS.includes(value as SectionImageSettingKey);
}

/** Returns a canonical, CSS-safe value or null when the value is invalid. */
export function normalizeSectionImageSetting(
  key: SectionImageSettingKey,
  value: unknown,
): string | null {
  const spec = SETTING_SPECS[key];
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string") return null;
  if (spec.kind === "ENUM") {
    return spec.values.includes(raw) ? raw : null;
  }
  if (!/^\d+$/.test(raw)) return null;
  const numericValue = Number(raw);
  if (numericValue < spec.min || numericValue > spec.max) return null;
  return String(numericValue);
}

export function storedSectionImageSetting(
  payload: Readonly<Record<string, unknown>>,
  key: SectionImageSettingKey,
): string | null {
  return normalizeSectionImageSetting(key, payload[key]);
}

export function sectionImageFormValue(
  payload: Readonly<Record<string, unknown>>,
  key: SectionImageSettingKey,
): string {
  const stored = storedSectionImageSetting(payload, key);
  if (stored !== null) return stored;
  if (key === "backgroundOverlayOpacity") {
    return legacyOverlayOpacity(payload.backgroundOverlay);
  }
  if (key === "backgroundPositionY") {
    if (payload.backgroundPosition === "TOP") return "0";
    if (payload.backgroundPosition === "BOTTOM") return "100";
  }
  return String(SETTING_SPECS[key].defaultValue);
}

function legacyOverlayOpacity(value: unknown): string {
  if (value === "NONE") return "0";
  if (value === "LIGHT") return "18";
  if (value === "STRONG") return "58";
  return "30";
}
