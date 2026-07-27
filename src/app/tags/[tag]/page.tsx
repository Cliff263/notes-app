import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${decodeURIComponent(tag)}` };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  return <Workspace filter={{ kind: "tag", value: decodeURIComponent(tag) }} />;
}
