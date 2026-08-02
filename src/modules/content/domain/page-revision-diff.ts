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
  fieldDiffs: readonly SectionFieldDiff[];
}>;

export type DiffSegment = Readonly<{
  type: "same" | "added" | "removed";
  text: string;
}>;

export type TextFieldDiff = Readonly<{
  key: string;
  segments: readonly DiffSegment[];
}>;

export type SectionFieldDiff = Readonly<{
  sectionKey: string;
  label: string;
  fields: readonly TextFieldDiff[];
}>;

const MAX_DIFF_WORDS = 400;

// Word-level diff via a classic LCS table. Bounded to MAX_DIFF_WORDS per
// side so a runaway-long field (e.g. someone pasting an article into a
// "text" field) can't blow up the O(n*m) table -- it falls back to a
// single before/after pair instead of word-by-word highlighting.
export function diffWords(
  before: string,
  after: string,
): readonly DiffSegment[] {
  if (before === after) return before ? [{ type: "same", text: before }] : [];
  const beforeWords = before.split(/(\s+)/).filter(Boolean);
  const afterWords = after.split(/(\s+)/).filter(Boolean);
  if (
    beforeWords.length > MAX_DIFF_WORDS ||
    afterWords.length > MAX_DIFF_WORDS
  ) {
    const segments: DiffSegment[] = [];
    if (before) segments.push({ type: "removed", text: before });
    if (after) segments.push({ type: "added", text: after });
    return segments;
  }

  const n = beforeWords.length;
  const m = afterWords.length;
  const table: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i]![j] =
        beforeWords[i] === afterWords[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  const segments: DiffSegment[] = [];
  function push(type: DiffSegment["type"], text: string) {
    const last = segments[segments.length - 1];
    if (last && last.type === type) {
      segments[segments.length - 1] = { type, text: last.text + text };
    } else {
      segments.push({ type, text });
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (beforeWords[i] === afterWords[j]) {
      push("same", beforeWords[i]!);
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      push("removed", beforeWords[i]!);
      i++;
    } else {
      push("added", afterWords[j]!);
      j++;
    }
  }
  while (i < n) push("removed", beforeWords[i++]!);
  while (j < m) push("added", afterWords[j++]!);
  return segments;
}

const TEXT_LIKE_KEY_PATTERN =
  /^(title|text|eyebrow|label|href|quote|attribution|context|scope|outcome|caption|formKey)$/;

function diffSectionFields(
  previous: Readonly<Record<string, unknown>>,
  current: Readonly<Record<string, unknown>>,
): readonly TextFieldDiff[] {
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const fields: TextFieldDiff[] = [];
  for (const key of keys) {
    if (!TEXT_LIKE_KEY_PATTERN.test(key)) continue;
    const before = typeof previous[key] === "string" ? previous[key] : "";
    const after = typeof current[key] === "string" ? current[key] : "";
    if (before === after) continue;
    fields.push({ key, segments: diffWords(before as string, after as string) });
  }
  return fields;
}

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
  const fieldDiffs: SectionFieldDiff[] = [];
  for (const section of draft) {
    const previous = publishedByKey.get(section.sectionKey);
    if (!previous) continue;
    if (
      previous.sectionType !== section.sectionType ||
      stableJson(previous.payload) !== stableJson(section.payload)
    ) {
      modified.push(label(section));
      if (
        previous.payload &&
        typeof previous.payload === "object" &&
        !Array.isArray(previous.payload) &&
        section.payload &&
        typeof section.payload === "object" &&
        !Array.isArray(section.payload)
      ) {
        const fields = diffSectionFields(
          previous.payload as Record<string, unknown>,
          section.payload as Record<string, unknown>,
        );
        if (fields.length > 0) {
          fieldDiffs.push({
            sectionKey: section.sectionKey,
            label: label(section),
            fields,
          });
        }
      }
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
    fieldDiffs,
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
