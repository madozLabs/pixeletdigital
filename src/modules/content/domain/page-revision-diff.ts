export type ComparableRevisionSection = Readonly<{
  sectionKey: string;
  sectionType: string;
  order: number;
  payload: unknown;
}>;

export type PageRevisionDiff = Readonly<{
  added: readonly string[];
  removed: readonly string[];
  modified: readonly string[];
  moved: readonly string[];
  totalChanges: number;
}>;

export function comparePageRevisionSections(
  published: readonly ComparableRevisionSection[],
  draft: readonly ComparableRevisionSection[],
): PageRevisionDiff {
  const publishedByKey = new Map(
    published.map((section) => [section.sectionKey, section]),
  );
  const draftByKey = new Map(
    draft.map((section) => [section.sectionKey, section]),
  );
  const added = draft
    .filter((section) => !publishedByKey.has(section.sectionKey))
    .map(label);
  const removed = published
    .filter((section) => !draftByKey.has(section.sectionKey))
    .map(label);
  const modified: string[] = [];
  const moved: string[] = [];
  for (const section of draft) {
    const previous = publishedByKey.get(section.sectionKey);
    if (!previous) continue;
    if (
      previous.sectionType !== section.sectionType ||
      stableJson(previous.payload) !== stableJson(section.payload)
    ) {
      modified.push(label(section));
    }
    if (previous.order !== section.order) moved.push(label(section));
  }
  return {
    added,
    removed,
    modified,
    moved,
    totalChanges:
      added.length + removed.length + modified.length + moved.length,
  };
}

function label(section: ComparableRevisionSection): string {
  if (
    section.payload &&
    typeof section.payload === "object" &&
    !Array.isArray(section.payload)
  ) {
    const title = (section.payload as Record<string, unknown>).title;
    if (typeof title === "string" && title.trim())
      return `${section.sectionType} — ${title.trim()}`;
  }
  return section.sectionType;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
