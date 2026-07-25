import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";
import { CATEGORIES } from "@/lib/types";

/** Categories are a fixed set, so the routes can be prerendered. */
export function generateStaticParams() {
  return CATEGORIES.filter((category) => category !== "Archive").map((category) => ({
    category: category.toLowerCase(),
  }));
}

function resolveCategory(slug: string) {
  return CATEGORIES.find(
    (category) => category.toLowerCase() === decodeURIComponent(slug).toLowerCase(),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const resolved = resolveCategory(category);
  return { title: resolved ? `${resolved} · Square Notes` : "Square Notes" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const resolved = resolveCategory(category);
  if (!resolved || resolved === "Archive") notFound();

  return <Workspace filter={{ kind: "category", value: resolved }} />;
}
