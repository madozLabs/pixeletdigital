const HUES = 8;

function hueForName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % HUES;
}

function initialFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function Avatar({
  name,
  size = "sm",
}: Readonly<{ name: string | null; size?: "xs" | "sm" | "md" }>) {
  const label = name?.trim() || "Non affecté";
  const hue = hueForName(label);
  return (
    <span
      className={`avatar avatar--${size} avatar--hue-${hue}`}
      title={label}
      aria-label={label}
    >
      {initialFor(label)}
    </span>
  );
}

export function AvatarGroup({
  names,
  size = "xs",
  max = 4,
}: Readonly<{
  names: readonly string[];
  size?: "xs" | "sm" | "md";
  max?: number;
}>) {
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;
  return (
    <span className="avatar-group">
      {shown.map((name, index) => (
        <Avatar key={`${name}-${index}`} name={name} size={size} />
      ))}
      {overflow > 0 ? (
        <span className={`avatar avatar--${size} avatar--overflow`}>
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
