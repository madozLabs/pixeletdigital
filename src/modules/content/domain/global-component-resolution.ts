// A PageRevisionSection that's a global-component instance stores no
// payload of its own -- render callers must resolve it to the component's
// live (sourceSection) content instead. Shared by every place that renders
// sections publicly (the marketing home page and the generic [slug] route),
// so a page can't silently forget to resolve instances.
export function resolveEffectiveSection<
  T extends {
    sectionType: string;
    payload: unknown;
    globalComponentId: string | null;
    globalComponent: {
      sourceSection: { sectionType: string; payload: unknown };
    } | null;
  },
>(section: T): T {
  if (!section.globalComponentId || !section.globalComponent) return section;
  return {
    ...section,
    sectionType: section.globalComponent.sourceSection.sectionType,
    payload: section.globalComponent.sourceSection.payload,
  };
}
