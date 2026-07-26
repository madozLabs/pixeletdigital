"use client";

export function MediaUrlField({
  title,
  publicUrl,
}: Readonly<{
  title: string;
  publicUrl: string;
}>) {
  return (
    <label className="cms-gallery__url-field">
      URL publique
      <input
        readOnly
        value={publicUrl}
        onFocus={(event) => event.currentTarget.select()}
        aria-label={`URL de ${title}`}
      />
    </label>
  );
}
