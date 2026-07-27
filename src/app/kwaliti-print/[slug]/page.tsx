import type { Metadata } from "next";

import CmsPublicPage, {
  generateMetadata as generateCmsMetadata,
} from "@/app/(marketing)/[slug]/page";

type Props = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}>;

function withKwalitiWorld(
  searchParams: Props["searchParams"],
): Promise<{ preview?: string; world: string }> {
  return searchParams.then((params) => ({
    ...params,
    world: "kwaliti-print",
  }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  return generateCmsMetadata({
    params: props.params,
    searchParams: withKwalitiWorld(props.searchParams),
  });
}

export default function KwalitiCmsPage(props: Props) {
  return CmsPublicPage({
    params: props.params,
    searchParams: withKwalitiWorld(props.searchParams),
  });
}
