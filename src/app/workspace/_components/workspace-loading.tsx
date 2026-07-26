export function WorkspaceLoading({ label }: Readonly<{ label: string }>) {
  return (
    <div
      className="workspace-skeleton"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Chargement : {label}…</span>
      <div className="workspace-skeleton__heading">
        <span className="workspace-skeleton__line workspace-skeleton__line--title" />
        <span className="workspace-skeleton__line workspace-skeleton__line--lede" />
      </div>
      <div className="workspace-skeleton__metrics" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className="workspace-skeleton__panel" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}
