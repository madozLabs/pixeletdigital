import { getSiteUrl } from "@/app/_lib/site-url";

export function OrganizationJsonLd({
  name,
  path,
  description,
  parentName,
}: Readonly<{
  name: string;
  path: string;
  description: string;
  parentName?: string;
}>) {
  const url = new URL(path, getSiteUrl()).toString();
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    description,
    ...(parentName
      ? { parentOrganization: { "@type": "Organization", name: parentName } }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
